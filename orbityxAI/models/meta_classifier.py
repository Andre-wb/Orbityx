"""
Meta-Classifier  v5
====================
Lopez de Prado's Meta-Labelling (AFML ch. 3.6) — properly wired.

HOW IT WORKS
  Stage 1  Primary ensemble predicts direction (long / short).
  Stage 2  Meta-classifier answers: "Given that the primary model says X,
           should we ACT on it?"

  Meta-label = 1  iff  primary prediction == actual label  AND  label != 0
  Meta-label = 0  otherwise (wrong direction OR neutral)

  Meta-classifier input = [original features | primary proba | regime]
  Meta-classifier target = meta-label ∈ {0, 1}

EFFECT
  • Precision improves dramatically (fewer false positives).
  • Recall decreases (model abstains more).
  • Net: sharper edge — only the high-conviction, genuinely-correct signals pass.

ZERO-LEAKAGE PROTOCOL
  Meta-classifier is trained on the SAME OOF fold structure as the primary.
  For each OOF fold val_idx:
    1. Primary model (trained on tr_idx) predicts proba on val_idx.
    2. We know actual labels on val_idx (no lookahead — labels are formed
       purely from price action, already computed before any model touches them).
    3. meta_label[val_idx] = (primary_proba > 0.5) == (labels[val_idx] == 1)
                             AND labels[val_idx] != 0
    4. Meta-classifier trained on stacked OOF (features ‖ primary_proba).

This is identical to training the primary model in OOF — no future information
leaks into val_idx because:
  • features are built without lookahead
  • labels are triple-barrier (closed at most max_holding bars ahead of i,
    which is ENTIRELY within the labelling window, not the prediction target)

INTEGRATION
  StackingEnsemble.fit() now:
    Phase A  →  OOF primary base learners  (unchanged)
    Phase A2 →  OOF meta-classifier        (NEW)
    Phase B  →  Final primary models       (unchanged)
    Phase C  →  Final meta-classifier      (NEW)
    Phase D  →  Conformal calibration      (unchanged)

  StackingEnsemble.predict() now:
    p_primary  = weighted blend of base learners
    p_meta     = meta-classifier P(primary is correct)
    If p_meta < meta_threshold → confidence shrunk toward 0  (abstain signal)
    Else → use p_primary as-is (high confidence signal)
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
        primary_proba: np.ndarray,   # OOF P(up), shape (n,)
        true_labels:   np.ndarray,   # triple-barrier labels ∈ {-1, 0, 1}
        threshold:     float = 0.50,
) -> np.ndarray:
    """
    Meta-label[i] = 1  iff  sign(primary_proba[i] - 0.5) == sign(true_labels[i])
                            AND true_labels[i] != 0
    Meta-label[i] = 0  otherwise.

    Training target: "did the primary model get this one right?"
    """
    n       = len(primary_proba)
    ml      = np.zeros(n, dtype=int)
    pred_up = primary_proba >= threshold  # True = primary says UP
    for i in range(n):
        if true_labels[i] == 0:
            ml[i] = 0   # neutral — primary had nothing to be right or wrong about
        elif pred_up[i] and true_labels[i] == 1:
            ml[i] = 1   # primary said UP, market went UP ✓
        elif (not pred_up[i]) and true_labels[i] == -1:
            ml[i] = 1   # primary said DOWN, market went DOWN ✓
        else:
            ml[i] = 0   # wrong
    return ml


class MetaClassifier:
    """
    Second-stage binary classifier:
    Input:  [scaled_features ‖ primary_proba ‖ regime_onehot]
    Output: P(primary model is correct)

    P(correct) close to 1 → trust the primary signal
    P(correct) close to 0 → abstain / reduce position size

    The final confidence is modulated:
        adjusted_confidence = base_confidence * P(correct)
    so that only high-P(correct) signals survive the confidence threshold.
    """

    def __init__(self, meta_threshold: float = 0.55):
        self.meta_threshold = meta_threshold
        self.model          = None
        self.scaler_meta    = None
        self._trained       = False
        self._n_meta_train  = 0
        self._meta_accuracy = float("nan")  # OOF accuracy of meta-classifier itself

    # ─────────────────────────────────────────────────────────
    #  Build meta feature matrix
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def build_meta_X(
            Xs:            np.ndarray,   # scaled primary features, shape (n, p)
            primary_proba: np.ndarray,   # shape (n,)
            regime_arr:    Optional[np.ndarray] = None,  # shape (n,) ints 0-3
    ) -> np.ndarray:
        """
        Concatenate primary features + proba + regime one-hot.
        Regime is one-hot encoded so the meta-model can learn regime-specific
        reliability of the primary.
        """
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
    #  Fit on OOF meta-labels
    # ─────────────────────────────────────────────────────────

    def fit(
            self,
            Xs_oof:        np.ndarray,   # scaled primary features at OOF indices
            proba_oof:     np.ndarray,   # primary OOF proba at OOF indices
            meta_labels:   np.ndarray,   # 0/1, shape (n_oof,)
            sample_weight: Optional[np.ndarray] = None,
            regime_oof:    Optional[np.ndarray] = None,
    ) -> "MetaClassifier":
        """Train the meta-classifier on OOF data."""
        non_neutral = np.sum(meta_labels >= 0)  # all — meta labels have no neutral
        positive    = np.sum(meta_labels == 1)

        if non_neutral < 50 or positive < 10:
            log.warning(f"[MetaClassifier] Too few samples "
                        f"(n={non_neutral}, pos={positive}) — skipping.")
            self._trained = False
            return self

        log.info(f"[MetaClassifier] Fitting on {non_neutral} OOF samples "
                 f"({positive} correct / {non_neutral - positive} wrong).")

        Xm = self.build_meta_X(Xs_oof, proba_oof, regime_oof)
        self.scaler_meta = RobustScaler() if _SK else None
        if self.scaler_meta is not None:
            Xm = self.scaler_meta.fit_transform(Xm)

        # Class balance: primary model is usually right ~55-65% of the time
        # Use class_weight-equivalent via scale_pos_weight
        n_pos = int(np.sum(meta_labels == 1))
        n_neg = int(np.sum(meta_labels == 0))
        spw   = n_neg / (n_pos + 1e-9)

        if _LGBM:
            self.model = lgb.LGBMClassifier(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.05,
                num_leaves=15,
                min_child_samples=15,
                subsample=0.8,
                colsample_bytree=0.7,
                scale_pos_weight=spw,
                n_jobs=-1, random_state=42, verbose=-1,
            )
        elif _XGB:
            self.model = xgb.XGBClassifier(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.7,
                scale_pos_weight=spw,
                eval_metric="logloss",
                n_jobs=-1, random_state=42, verbosity=0,
                use_label_encoder=False,
            )
        elif _SK:
            self.model = LogisticRegression(
                C=0.5, class_weight="balanced",
                max_iter=1000, random_state=42,
            )
        else:
            log.warning("[MetaClassifier] No ML library available.")
            self._trained = False
            return self

        self.model.fit(Xm, meta_labels, sample_weight=sample_weight)

        # OOF accuracy of meta-classifier (in-sample here, just for logging)
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
            Xs_row:       np.ndarray,   # single scaled feature row, shape (1, p)
            primary_proba: float,
            regime:       Optional[int] = None,
    ) -> float:
        """
        Return P(primary model is correct) for a single bar.
        If not trained, returns 1.0 (no filtering).
        """
        if not self._trained or self.model is None:
            return 1.0
        try:
            regime_arr = np.array([regime if regime is not None else 3])
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
        """
        Apply meta-classification filter to primary confidence.

        Returns:
            adjusted_confidence: shrunk if meta says "don't trust primary"
            p_correct:           P(primary is correct)
            meta_gate:           1.0 if meta says act, 0.0 if meta says abstain
        """
        p_correct  = self.predict_correctness(Xs_row, primary_proba, regime)
        meta_gate  = 1.0 if p_correct >= self.meta_threshold else 0.0

        if meta_gate < 0.5:
            # Meta says the primary is unreliable → pull confidence to zero
            # Soft shrinkage: multiply by p_correct / threshold
            # (allows partial signal rather than hard cutoff)
            shrink_factor     = p_correct / self.meta_threshold
            adj_confidence    = base_confidence * shrink_factor
        else:
            # Meta endorses the primary signal → slight boost
            boost             = 1.0 + (p_correct - self.meta_threshold) * 0.3
            adj_confidence    = min(base_confidence * boost, 1.0)

        return (float(np.clip(adj_confidence, 0.0, 1.0)),
                float(p_correct),
                float(meta_gate))

    # ─────────────────────────────────────────────────────────
    #  Serialization helpers (called by StackingEnsemble.save/load)
    # ─────────────────────────────────────────────────────────

    def state_dict(self) -> dict:
        return {
            "model":           self.model,
            "scaler_meta":     self.scaler_meta,
            "_trained":        self._trained,
            "_n_meta_train":   self._n_meta_train,
            "_meta_accuracy":  self._meta_accuracy,
            "meta_threshold":  self.meta_threshold,
        }

    @classmethod
    def from_state(cls, state: dict) -> "MetaClassifier":
        obj = cls(meta_threshold=state.get("meta_threshold", 0.55))
        for k, v in state.items():
            setattr(obj, k, v)
        return obj
