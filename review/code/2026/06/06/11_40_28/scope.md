# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] `lint_mermaid_posttooluse.py` 수정 — 직접적 관련성은 있으나 작업 범위 경계에 위치
- 위치: `.claude/hooks/lint_mermaid_posttooluse.py` 전체
- 상세: 이 파일은 review-guard hardening 작업의 주 대상(review_guard.py, guard_review_before_stop.py)과 다른 도메인(mermaid lint)이다. 단, 변경 내용은 `subprocess.run` 에 `timeout` 추가 및 `TimeoutExpired` 예외 처리로, hook 안정성(hung linter wedge 방지)이라는 동일한 "hook hardening" 맥락에 부합한다. 작업 이름이 `harden-review-hooks` 이고 변경이 "모든 hook 의 subprocess timeout 강화" 맥락이라면 범위 내로 볼 수 있다. 그러나 이 파일만 본다면 review/stop guard 와 직접 관련이 없는 별도 hook이다.
- 제안: 작업 plan 에 "모든 hook subprocess timeout 강화" 가 명시돼 있다면 범위 내. 아니라면 별도 커밋으로 분리 고려.

### [INFO] `bootstrap-session.sh` — GC 기능 추가로 기능 확장
- 위치: `.claude/tools/bootstrap-session.sh` lines 39–56
- 상세: 기존 bootstrap 은 githooks 설정 + mermaid-lint 의존성 설치 2가지만 담당했다. 새로 추가된 섹션(3. Garbage-collect stale guard state markers)은 state 파일 GC 기능으로, review_stop_nudged 마커 누적 방지를 목적으로 한다. 이 GC는 stop-hook 의 per-branch 마커 전략 변경(HEAD sha → branch 이름)의 직접적 후속 조치다 — 브랜치 단위 마커는 세션 종료 후에도 남으므로 GC가 없으면 무한 누적된다. 기능 확장이지만 stop-hook 변경과 직접 결합된 필수 후속 조치로 판단된다.
- 제안: 범위 내. 단, bootstrap 의 두 책임을 기술한 모듈 docstring("Two responsibilities: 1... 2...")이 세 번째 책임 추가를 반영하지 않았다 — docstring 갱신이 누락됐다.

### [INFO] `_summary_is_resolved` 의 dead code 제거
- 위치: `review_guard.py` diff 라인 +427–+429 영역 (삭제된 코드)
- 상세: 아래 로직이 삭제됐다:
  ```python
  # NONE/LOW/MEDIUM with no actionable rows, and no RESOLUTION → treat MEDIUM
  # as unresolved only if it carried rows (already handled). Clean report.
  if risk_level in (None, "MEDIUM") and has_actionable:
      return False
  ```
  이 조건은 `if has_actionable: return False` 직후에 위치했으므로 `has_actionable` 이 True인 경우는 이미 앞에서 반환된 후다 — 즉 이 분기는 도달 불가능한 dead code다. 제거는 버그 수정에 해당하며 리팩토링이 아니다.
- 제안: 범위 내. 정확한 수정이다.

### [INFO] `_newest_code_mtime` 이름 유지(back-compat alias) — 리팩토링 흔적
- 위치: `review_guard.py` +365–+368
- 상세: `_newest_code_mtime` 함수를 삭제하지 않고 `_authoritative_code_time` 으로 위임하는 alias 로 남겼다. 주석에 "Back-compat name retained as the seam evaluate_review/tests reference" 라고 명시돼 있다. evaluate_review 내부에서는 여전히 `_newest_code_mtime` 이름을 사용하고 있으며, 테스트도 이 이름을 참조한다. 의도적 선택이며 추가 리팩토링을 억제한 것이므로 범위 초과 아님.
- 제안: 범위 내.

## 요약

5개 파일의 변경은 모두 "review-hook hardening" 이라는 단일 목적(checkout-immune 타임스탬프, in-flight 탐지, stop-hook throttle 개선, subprocess timeout 강화, 상태 파일 GC)에 결합돼 있다. 각 변경은 감지된 버그(mtime 리셋, `**/` 경계 오류, 3줄 창 위험도 파싱 오류, 마커 None 비활성화)에 대한 직접적 수정이며, 불필요한 리팩토링·기능 확장·무관한 파일 수정은 없다. 단, `bootstrap-session.sh` 의 모듈 docstring 이 세 번째 책임(GC)을 반영하지 않은 소소한 누락이 있다.

## 위험도

LOW
