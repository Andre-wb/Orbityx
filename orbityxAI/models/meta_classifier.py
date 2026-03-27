"""
Meta-Classifier  v5.1
======================
BUG FIX (v5.1):
  MetaClassifier predict error: X has 55 features, but RobustScaler expecting 51.

  ROOT CAUSE:
    fit() called with regime_oof=None (not passed from ensemble.fit())
    → build_meta_X produces (n, 51) features: [Xs(50) | proba(1)]
    → scaler_meta fitted on 51 features

    predict_correctness() called with regime_int=3 (always passed)
    → build_meta_X produces (1, 55) features: [Xs(50) | proba(1) | onehot(4)]
    → scaler_meta.transform crashes: expected 51, got 55

  FIX:
    Added self._uses_regime flag (default False).
    fit() sets it True only when regime_oof is not None.
    predict_correctness() passes regime=None when _uses_regime is False,
    so both training and inference always produce the same feature count.

    Also added to state_dict() / from_state() for persistence.
"""

from __future__ import annotations

import numpy as np
from typing import Optional, Tuple
from utils.logger import log

try:
    import lightgbm as lgb
    _LGBM = True
except ImportError:
    _LGBM = False

try:
    import xgboost as xgb
    _XGB = True
except ImportError:
    _XGB = False

try:
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import RobustScaler
    _SK = True
except ImportError:
    _SK = False


def build_meta_labels(
        primary_proba: np.ndarray,
        true_labels:   np.ndarray,
        threshold:     float = 0.50,
) -> np.ndarray:
    n       = len(primary_proba)
    ml      = np.zeros(n, dtype=int)
    pred_up = primary_proba >= threshold
    for i in range(n):
        if true_labels[i] == 0:
            ml[i] = 0
        elif pred_up[i] and true_labels[i] == 1:
            ml[i] = 1
        elif (not pred_up[i]) and true_labels[i] == -1:
            ml[i] = 1
        else:
            ml[i] = 0
    return ml


class MetaClassifier:
    """
    Second-stage binary classifier — Lopez de Prado meta-labelling.
    """

    def __init__(self, meta_threshold: float = 0.55):
        self.meta_threshold = meta_threshold
        self.model          = None
        self.scaler_meta    = None
        self._trained       = False
        self._n_meta_train  = 0
        self._meta_accuracy = float("nan")
        # BUG FIX: track whether regime was included in training features
        self._uses_regime   = False

    # ─────────────────────────────────────────────────────────
    #  Build meta feature matrix
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def build_meta_X(
            Xs:            np.ndarray,
            primary_proba: np.ndarray,
            regime_arr:    Optional[np.ndarray] = None,
    ) -> np.ndarray:
        cols = [Xs, primary_proba.reshape(-1, 1)]
        if regime_arr is not None:
            n      = len(regime_arr)
            onehot = np.zeros((n, 4), dtype=float)
            for i, r in enumerate(regime_arr):
                if 0 <= int(r) < 4:
                    onehot[i, int(r)] = 1.0
            cols.append(onehot)
        return np.column_stack(cols)

    # ─────────────────────────────────────────────────────────
    #  Fit
    # ─────────────────────────────────────────────────────────

    def fit(
            self,
            Xs_oof:        np.ndarray,
            proba_oof:     np.ndarray,
            meta_labels:   np.ndarray,
            sample_weight: Optional[np.ndarray] = None,
            regime_oof:    Optional[np.ndarray] = None,
    ) -> "MetaClassifier":
        non_neutral = np.sum(meta_labels >= 0)
        positive    = np.sum(meta_labels == 1)

        if non_neutral < 50 or positive < 10:
            log.warning(f"[MetaClassifier] Too few samples "
                        f"(n={non_neutral}, pos={positive}) — skipping.")
            self._trained = False
            return self

        log.info(f"[MetaClassifier] Fitting on {non_neutral} OOF samples "
                 f"({positive} correct / {non_neutral - positive} wrong).")

        # BUG FIX: record whether we have regime in training features
        self._uses_regime = (regime_oof is not None)

        Xm = self.build_meta_X(Xs_oof, proba_oof, regime_oof)
        self.scaler_meta = RobustScaler() if _SK else None
        if self.scaler_meta is not None:
            Xm = self.scaler_meta.fit_transform(Xm)

        n_pos = int(np.sum(meta_labels == 1))
        n_neg = int(np.sum(meta_labels == 0))
        spw   = n_neg / (n_pos + 1e-9)

        if _LGBM:
            self.model = lgb.LGBMClassifier(
                n_estimators=200, max_depth=4, learning_rate=0.05,
                num_leaves=15, min_child_samples=15, subsample=0.8,
                colsample_bytree=0.7, scale_pos_weight=spw,
                n_jobs=-1, random_state=42, verbose=-1,
            )
        elif _XGB:
            self.model = xgb.XGBClassifier(
                n_estimators=200, max_depth=4, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.7, scale_pos_weight=spw,
                eval_metric="logloss", n_jobs=-1, random_state=42, verbosity=0,
                use_label_encoder=False,
            )
        elif _SK:
            self.model = LogisticRegression(
                C=0.5, class_weight="balanced", max_iter=1000, random_state=42,
            )
        else:
            log.warning("[MetaClassifier] No ML library available.")
            self._trained = False
            return self

        self.model.fit(Xm, meta_labels, sample_weight=sample_weight)

        p_meta = self.model.predict_proba(Xm)[:, 1]
        self._meta_accuracy = float(
            np.mean((p_meta >= 0.5).astype(int) == meta_labels))
        self._n_meta_train  = len(meta_labels)
        self._trained       = True
        log.info(f"[MetaClassifier] In-sample accuracy: {self._meta_accuracy:.3f} "
                 f"(n={self._n_meta_train})")
        return self

    # ─────────────────────────────────────────────────────────
    #  Predict
    # ─────────────────────────────────────────────────────────

    def predict_correctness(
            self,
            Xs_row:        np.ndarray,
            primary_proba: float,
            regime:        Optional[int] = None,
    ) -> float:
        if not self._trained or self.model is None:
            return 1.0
        try:
            # BUG FIX: only include regime if it was part of training
            effective_regime = regime if self._uses_regime else None
            regime_arr = (np.array([effective_regime])
                          if effective_regime is not None else None)
            Xm = self.build_meta_X(
                Xs_row,
                np.array([primary_proba]),
                regime_arr,
            )
            if self.scaler_meta is not None:
                Xm = self.scaler_meta.transform(Xm)
            p = float(self.model.predict_proba(Xm)[0, 1])
            return float(np.clip(p, 0.0, 1.0))
        except Exception as e:
            log.warning(f"[MetaClassifier] predict error: {e}")
            return 1.0

    def modulate_confidence(
            self,
            base_confidence: float,
            primary_proba:   float,
            Xs_row:          np.ndarray,
            regime:          Optional[int] = None,
    ) -> Tuple[float, float, float]:
        p_correct = self.predict_correctness(Xs_row, primary_proba, regime)
        meta_gate = 1.0 if p_correct >= self.meta_threshold else 0.0

        if meta_gate < 0.5:
            shrink_factor  = p_correct / self.meta_threshold
            adj_confidence = base_confidence * shrink_factor
        else:
            boost          = 1.0 + (p_correct - self.meta_threshold) * 0.3
            adj_confidence = min(base_confidence * boost, 1.0)

        return (float(np.clip(adj_confidence, 0.0, 1.0)),
                float(p_correct),
                float(meta_gate))

    # ─────────────────────────────────────────────────────────
    #  Serialization
    # ─────────────────────────────────────────────────────────

    def state_dict(self) -> dict:
        return {
            "model":           self.model,
            "scaler_meta":     self.scaler_meta,
            "_trained":        self._trained,
            "_n_meta_train":   self._n_meta_train,
            "_meta_accuracy":  self._meta_accuracy,
            "meta_threshold":  self.meta_threshold,
            "_uses_regime":    self._uses_regime,   # BUG FIX: persist flag
        }

    @classmethod
    def from_state(cls, state: dict) -> "MetaClassifier":
        obj = cls(meta_threshold=state.get("meta_threshold", 0.55))
        for k, v in state.items():
            setattr(obj, k, v)
        return obj