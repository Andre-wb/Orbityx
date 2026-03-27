"""
reporter.py — coloured terminal output for test results.
"""
from __future__ import annotations

import sys
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Status(Enum):
    PASS  = "PASS"
    FAIL  = "FAIL"
    WARN  = "WARN"
    SKIP  = "SKIP"
    INFO  = "INFO"


# ANSI colours (disabled automatically on non-TTY pipes)
_TTY = sys.stdout.isatty()

def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _TTY else text

GREEN  = lambda t: _c("32", t)
RED    = lambda t: _c("31", t)
YELLOW = lambda t: _c("33", t)
CYAN   = lambda t: _c("36", t)
BOLD   = lambda t: _c("1",  t)
DIM    = lambda t: _c("2",  t)


@dataclass
class TestResult:
    name:    str
    status:  Status
    message: str       = ""
    detail:  str       = ""
    elapsed: float     = 0.0
    data:    Any       = None


@dataclass
class Suite:
    name:    str
    results: list[TestResult] = field(default_factory=list)

    def add(self, result: TestResult) -> None:
        self.results.append(result)
        _print_result(result)

    @property
    def passed(self)  -> int: return sum(1 for r in self.results if r.status == Status.PASS)
    @property
    def failed(self)  -> int: return sum(1 for r in self.results if r.status == Status.FAIL)
    @property
    def warned(self)  -> int: return sum(1 for r in self.results if r.status == Status.WARN)
    @property
    def skipped(self) -> int: return sum(1 for r in self.results if r.status == Status.SKIP)

    def summary(self) -> str:
        total = len(self.results)
        ok    = self.passed + self.warned
        color = GREEN if self.failed == 0 else RED
        return color(
            f"  {self.name}: {self.passed} passed, {self.warned} warned, "
            f"{self.failed} failed, {self.skipped} skipped / {total} total"
        )


def _print_result(r: TestResult) -> None:
    icons = {
        Status.PASS: GREEN("✓"),
        Status.FAIL: RED("✗"),
        Status.WARN: YELLOW("⚠"),
        Status.SKIP: DIM("○"),
        Status.INFO: CYAN("ℹ"),
    }
    icon    = icons[r.status]
    elapsed = DIM(f"  {r.elapsed:.3f}s") if r.elapsed > 0 else ""
    msg     = f" — {r.message}" if r.message else ""
    print(f"  {icon}  {r.name}{msg}{elapsed}")
    if r.detail:
        for line in r.detail.strip().splitlines():
            print(f"       {DIM(line)}")


def section(title: str) -> None:
    print(f"\n{BOLD(CYAN(f'── {title} '))}" + "─" * max(0, 55 - len(title)))


def info(msg: str) -> None:
    print(f"  {CYAN('ℹ')}  {msg}")


def print_summary(suites: list[Suite]) -> bool:
    total_pass = sum(s.passed  for s in suites)
    total_fail = sum(s.failed  for s in suites)
    total_warn = sum(s.warned  for s in suites)
    total_skip = sum(s.skipped for s in suites)
    total      = sum(len(s.results) for s in suites)

    print("\n" + BOLD("═" * 57))
    print(BOLD("  RESULTS"))
    print("─" * 57)
    for s in suites:
        print(s.summary())
    print("─" * 57)

    ok_color = GREEN if total_fail == 0 else RED
    print(ok_color(BOLD(
        f"  Total: {total_pass} passed, {total_warn} warned, "
        f"{total_fail} failed, {total_skip} skipped / {total}"
    )))
    print(BOLD("═" * 57))
    return total_fail == 0