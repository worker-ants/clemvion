# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `review_guard.py` 모듈 독스트링 — freshness 설명 구식화
- 위치: `.claude/hooks/_lib/review_guard.py`, 모듈 독스트링 `"Fresh, resolved review"` 단락 (라인 617–635)
- 상세: 모듈 독스트링은 freshness 판단 기준을 `mtime >= the newest changed codebase file's mtime` 라고 설명하고 있으나, 이번 변경으로 실제 구현은 `_authoritative_code_time`(checkout-immune; 더티 파일은 mtime, 클린 파일은 commit time)과 `_path_session_time`(세션 디렉터리 이름 파싱)으로 교체됐다. 독스트링 마지막 단락 `"The freshness check uses filesystem mtime for both sides…"` 역시 더 이상 정확하지 않다.
- 제안: 독스트링 `"Fresh, resolved review"`, `"Fresh impl-done consistency report"`, 마지막 freshness 단락을 checkout-immune 방식(세션 디렉터리 timestamp + dirty 파일 mtime fold-in)으로 업데이트한다.

### [INFO] `_newest_code_mtime` 후방호환 shim — 독스트링 부재
- 위치: `.claude/hooks/_lib/review_guard.py`, `_newest_code_mtime` 함수 (라인 367–368)
- 상세: 함수 위에 인라인 주석(`# Back-compat name retained…`)이 달려 있지만, 함수 자체에는 독스트링이 없다. 이 함수는 테스트와 `evaluate_review` 내부 양쪽에서 직접 참조되므로 심(seam) 역할이 명시적으로 문서화되지 않으면 미래 유지보수 시 의도치 않게 제거될 수 있다.
- 제안: 짧은 독스트링을 추가한다. 예: `"""Back-compat shim for tests/callers; delegates to _authoritative_code_time."""`

### [INFO] `bootstrap-session.sh` 헤더 주석 — 책임 목록 미갱신
- 위치: `.claude/tools/bootstrap-session.sh`, 파일 상단 주석 블록 (라인 10–12)
- 상세: 주석은 "Two responsibilities: 1. … 2. …" 라고 명시하고 있으나, 이번 변경으로 책임 3번(guard state 마커 GC)이 추가됐다. 헤더와 코드가 불일치한다.
- 제안: `# Two responsibilities:` 를 `# Three responsibilities:` 로 바꾸고 3번 항목을 추가한다.

### [INFO] `guard_review_before_stop.py` — `_mtime` 함수 독스트링 부재
- 위치: `.claude/hooks/_lib/review_guard.py`, `_mtime` 함수 (라인 769–773)
- 상세: `_mtime`는 OSError 시 0.0을 반환하는 조용한 실패 규약을 가지고 있으나 독스트링이 없다. 호출 측이 0.0 반환의 의미(실패)를 파악하기 위해 구현을 직접 봐야 한다. 이는 규모가 작지만 공개적으로 사용되는 유틸리티다.
- 제안: `"""Return os.path.getmtime(path), or 0.0 on any error."""` 수준의 짧은 독스트링 추가.

### [INFO] `_dirty_set` — `_run_git` 호출 위치 문서화 미흡
- 위치: `.claude/hooks/_lib/review_guard.py`, `_dirty_set` 함수 (라인 776–786)
- 상세: `_dirty_set`은 `repo_root`를 cwd로 넘기는 반면 다른 `_run_git` 호출들은 `cwd`(작업 디렉터리)를 넘긴다. 이 차이는 함수 독스트링에 `repo_root`에서 실행한다는 사실을 명시하면 더 명확해진다. 현재 독스트링은 반환값 집합의 의미만 설명한다.
- 제안: 독스트링에 `Runs git status from repo_root (not cwd).` 한 줄을 추가한다.

### [INFO] `_path_session_time` — timezone 해석 암묵적
- 위치: `.claude/hooks/_lib/review_guard.py`, `_path_session_time` 함수 (라인 839–855)
- 상세: 함수는 `datetime(...).timestamp()`를 사용해 파싱하는데, 이는 **로컬 타임존**으로 해석한다. 세션 디렉터리 이름이 UTC가 아닌 로컬 시각으로 생성되는지는 오케스트레이터 코드에 달려 있다. 독스트링에 timezone 가정이 명시되지 않아 혼동 가능성이 있다.
- 제안: 독스트링에 `The timestamp is interpreted as local time (matching how the session dir is created).` 를 추가한다. 만약 UTC가 맞다면 `datetime.utcfromtimestamp` + `calendar.timegm` 계열로 교체해야 한다.

### [WARNING] `_code_review_in_flight` — `now` 파라미터 공개 시그니처 문서화 누락
- 위치: `.claude/hooks/_lib/review_guard.py`, `_code_review_in_flight` 함수 (라인 1145)
- 상세: `now: float | None = None` 파라미터는 테스트 주입 목적의 의존성 역전 인터페이스다. 독스트링은 함수 동작을 잘 설명하지만 이 파라미터의 목적(테스트에서 현재 시각을 주입하기 위해 존재)은 명시되지 않았다. 외부 테스트 코드에서 직접 `now=` 를 전달하므로, 이 파라미터가 프로덕션 코드에서 어떤 기본값을 사용하는지 독스트링에서 확인 가능해야 한다.
- 제안: 독스트링 끝에 `The \`now\` parameter is for testing only — production callers omit it (defaults to time.time()).` 추가.

### [INFO] 테스트 파일 `test_review_guard_hardening.py` — `_harness` import side-effect 주석만으로 충분하나 모듈 독스트링 유지보수 힌트 부재
- 위치: `.claude/tests/test_review_guard_hardening.py`, 모듈 독스트링 (라인 1753)
- 상세: 모듈 독스트링은 커버하는 케이스를 잘 열거하고 있다. 다만 `import _harness` 의 side effect(sys.path 변조)가 `# noqa: F401` 주석에만 언급되고 독스트링에서는 언급되지 않아, 이 파일을 독립적으로 실행하려는 개발자가 환경 의존성을 파악하기 어렵다.
- 제안: 독스트링에 `Run via: python -m pytest .claude/tests/ (requires _harness on sys.path).` 수준의 실행 방법 힌트를 추가한다.

### [INFO] `_IN_FLIGHT_TTL_SECONDS` — 상수 값 근거 주석만, spec 연결 없음
- 위치: `.claude/hooks/_lib/review_guard.py`, 라인 671
- 상세: `1800`(30분) 선택의 근거는 인라인 주석(`comfortably covers a slow review fan-out`)에 설명돼 있어 좋다. 그러나 이 값이 변경될 경우 테스트 파일(`test_stale_started_session_not_in_flight`)도 함께 변경해야 함을 알려주는 힌트가 없다.
- 제안: 주석에 `(keep in sync: test_stale_started_session_not_in_flight uses this constant)` 를 덧붙인다.

---

## 요약

이번 변경의 핵심은 review guard의 freshness 판단을 파일시스템 mtime(checkout 시 리셋되는 부정확한 시계)에서 checkout-immune한 git commit time + 세션 디렉터리 이름 파싱 방식으로 교체한 것이다. 개별 함수 독스트링들은 새로운 동작을 비교적 잘 설명하고 있으나, **모듈 레벨 독스트링이 구식 mtime 기반 freshness 설명을 그대로 유지**하고 있어 모듈 전체의 정책 이해를 위해 독스트링을 읽는 개발자에게 혼란을 줄 수 있다. `bootstrap-session.sh` 헤더 주석의 책임 수 불일치도 즉시 수정할 수 있는 작은 부정확성이다. 그 외 항목들은 경미한 문서화 보완 사항으로, 기능 정확성에 영향을 주지 않는다.

## 위험도

LOW

STATUS: SUCCESS
