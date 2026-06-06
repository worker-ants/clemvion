# 요구사항(Requirement) 리뷰 — harden-review-hooks

대상 커밋: `2bcc2a52 fix(hooks): harden review-coverage guard — kill false Stop-hook firing + latent bugs`

---

## 발견사항

### [INFO] spec fidelity: `.claude/hooks/` 는 제품 spec 외 harness-internal 영역
- 위치: 변경된 6개 파일 전체 (`.claude/hooks/`, `.claude/tests/`, `.claude/tools/`)
- 상세: `spec/` 내에 이 hook 들을 명세하는 문서가 존재하지 않는다. `.claude/skills/developer/SKILL.md` 가 `guard_review_before_stop.py`/`guard_review_before_push.py` 를 언급하고 동작을 기술하나, 이는 spec 본문(요구사항 ID·필드 정의·상태 전이 표)이 아니라 워크플로 서술이다. spec fidelity 점검 대상 spec 자체가 없으므로 spec 불일치 발견사항은 없다.
- 제안: 해당 없음 (harness-internal).

---

### [INFO] `_code_review_in_flight` — consistency-check 세션의 in-flight 미처리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/hooks/_lib/review_guard.py` L566-586
- 상세: in-flight 감지는 `review/code` (ai-review) 세션만 탐지하고 `review/consistency` (impl-done) 세션은 포함하지 않는다. Gate 2 (SPEC-CONSISTENCY) 도 Stop 훅이 차단하므로, 사용자가 `/consistency-check --impl-done` 을 실행 중인 동안 Stop 훅이 Gate 2 때문에 오발화할 가능성이 남아있다. 단, consistency-check 세션도 궁극적으로 SUMMARY.md 를 기록하면 즉시 게이트를 통과하므로, 실제 피해는 ai-review 보다 작다. 이 PR 의 주 타깃(ai-review 레이스)은 완전히 해결됐다.
- 제안: 필요 시 후속 PR 에서 `_consistency_in_flight` 를 유사 방식으로 추가. 현재 범위에서는 INFO 수준.

---

### [INFO] `_path_session_time` — naive datetime (timezone-unaware)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/hooks/_lib/review_guard.py` L440-459
- 상세: `datetime(Y, m, d, H, M, S)` 는 timezone 정보가 없어 로컬 타임존을 기준으로 `timestamp()` 를 계산한다. 코드 편집 시각(commit time, mtime)도 같은 로컬 시계를 사용하므로 비교 내부 일관성은 유지된다. DST 전환이 일어나는 경계(시간당 1초 오차)에서만 미세 부정확이 발생할 수 있으나, 이 시계는 수십 분~수시간 범위의 freshness 판단이 목적이므로 실제 영향 없음.
- 제안: 완벽한 구현은 `datetime.now(timezone.utc)` 기반이지만 현재 사용 맥락에서는 불필요.

---

### [INFO] `_summary_is_resolved` — heading identity check (`probe is not ln`)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/hooks/_lib/review_guard.py` L318-322
- 상세: `if probe is not ln and probe.lstrip().startswith("#"):` 는 Python 객체 동일성(`is`)으로 "현재 줄(위험도 섹션 헤딩 자체)이 다음 섹션 헤딩으로 오인되지 않도록" 첫 줄을 건너뛰는 의도다. Python 은 동일 문자열 리터럴을 인터닝하므로 `lines[i]` 와 이후에 같은 문자열이 또 나타날 경우 `is` 가 True 를 반환해 헤딩으로 인식하지 않는 경우가 발생할 수 있다. 그러나 실제 SUMMARY.md 에서 `## 전체 위험도` 가 두 번 등장하는 경우는 없으므로 실질적 영향 없음. 더 명확한 구현은 인덱스 기반(`for probe in lines[i+1:]` 이후 첫 줄에 별도 처리)이지만 현재 동작은 정확하다.
- 제안: 로버스트 구현을 원한다면 `for j, probe in enumerate(lines[i:]):` + `if j > 0 and probe.lstrip().startswith("#"):` 패턴으로 교체.

---

### [INFO] `_porcelain_path` — `len(ln) < 4` 경계 조건
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/hooks/_lib/review_guard.py` L261-267
- 상세: `len(ln) < 4` 는 `"XY "` 의 최소 길이 3 + 경로 최소 1자 = 4를 보호한다. `git status --porcelain v1` 의 실제 최소 줄은 `"?? x"` (4자) 이므로 조건이 정확하다. 빈 줄(길이 0)이나 짧은 줄은 안전하게 `""` 를 반환한다.
- 제안: 해당 없음 — 구현 정확.

---

### [INFO] `_glob_to_regex` — trailing `**` (슬래시 없음) 동작 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/hooks/_lib/review_guard.py` L405-418
- 상세: 변경 전 `**` 는 항상 `.*` 로 변환됐다. 변경 후 `**/` (슬래시 포함) 만 `(?:.*/)?` 가 되고, 그 외 (trailing `**`) 는 여전히 `.*` 다. `codebase/**` 같은 trailing double-star 패턴은 변경 전과 동일하게 동작한다. 유효성 테스트(`GlobBoundaryTest`)가 이를 명시적으로 검증한다.
- 제안: 해당 없음.

---

### [INFO] `bootstrap-session.sh` — `find -mtime +30` macOS/Linux 호환성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/tools/bootstrap-session.sh` L151-157
- 상세: `find -mtime +30` 은 GNU coreutils 와 BSD find 양쪽에서 동일하게 "30일 초과"를 의미한다. `|| true` 로 오류를 무시하며 `exit 0` 으로 항상 세션 부팅을 허용하므로 GC 실패가 세션을 차단하지 않는다. 상태 디렉터리가 없으면 `[ -d "$state_dir" ]` 로 조기 건너뛴다.
- 제안: 해당 없음.

---

### [INFO] `_throttle_token` — detached HEAD 폴백 경로 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/hooks/guard_review_before_stop.py` L436-462; `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/tests/test_review_guard_hardening.py` L3114-3124
- 상세: 테스트는 (1) branch slashes sanitize, (2) session_id fallback, (3) marker path format 세 가지를 커버한다. 그러나 detached HEAD 시 SHA fallback (`ref == "HEAD"` 경우), git 미설치 시 "norepo" 반환, 첫 번째 `subprocess.run` 성공 후 두 번째가 실패하는 경우는 테스트되지 않는다. 이 경로들은 단순해 버그 가능성은 낮다. 현재 93/93 그린이라는 커밋 메시지가 기존+신규 테스트 전체 통과를 확인한다.
- 제안: 중요도 낮으나, 완결성을 위해 `ref == "HEAD"` 케이스 단위 테스트 추가 고려.

---

## 요약

6개 파일의 변경은 의도한 기능 — (a) async /ai-review ↔ 동기 Stop 훅 레이스 제거, (b) worktree checkout mtime 리셋에 의한 false-block 제거, (c) Stop 훅 throttle 키를 HEAD SHA에서 branch 이름으로 전환, (d) mermaid-lint 타임아웃 추가, (e) GC 부팅 스크립트 추가 — 을 완전히 구현한다. 핵심 로직(in-flight 감지, checkout-immune 시계, porcelain 경로 파서, glob-to-regex 경계 수정, 위험도 탐색 창 확장, dead code 제거)은 엣지 케이스 분석에서 모두 정확하다. 사전 정의된 spec 문서(harness-external spec/)가 이 hook 들을 명세하지 않으므로 spec fidelity 불일치는 없다. 발견된 사항은 모두 INFO 수준이며 코드 수정이 필요한 결함은 없다.

BLOCK: NO

---

## 위험도

NONE
