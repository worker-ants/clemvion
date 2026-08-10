# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `create_session_dir` 의 예산 소진/기타 OSError 폴백 경로가 자신이 고치려는 바로 그 경쟁 조건을 다시 연다
  - 위치: `.claude/skills/code-review-agents/lib/session.py:77-82`
  - 상세: 이 함수의 핵심 수정은 `os.makedirs(session_dir, exist_ok=False)` 를 루프(`_MAX_SESSION_NAME_ATTEMPTS = 50`)로 반복 시도해, 동시에 뜬 두 프로세스(배치 분할 `--prepare`, 또는 병렬 Claude 세션 두 개)가 같은 초에 같은 이름을 놓고 경합할 때 `mkdir` syscall 의 원자성에 기대어 "둘 다 이겼다고 믿는" 상황을 막는다. 설계와 구현 모두 정확하다 — `os.makedirs` 는 중간 디렉터리(연/월/일)의 존재 경쟁은 내부적으로 `FileExistsError` 를 흡수하고, leaf 디렉터리 생성만 `exist_ok=False` 로 원자적으로 실패하므로 TOCTOU 창이 없다. 다만 (a) 50회 시도가 모두 `FileExistsError` 로 소진되거나 (b) 그 사이 다른 `OSError`(권한 오류 등)가 나서 루프를 `break` 하면, 마지막에 `os.makedirs(session_dir, exist_ok=True)` 로 **같은 `stamp` 경로**를 재사용해 반환한다 — 이 경로는 이 함수가 고치기 전의 동작(silent overwrite)과 동일하다. 즉 극단적으로 같은 초에 대량의 동시 세션이 몰리는 버스트에서는 여전히 두 세션이 같은 디렉터리를 공유해 `meta.json`/프롬프트가 덮일 수 있다.
  - 제안: 이미 docstring 에 "그 실개수는 이 상한보다 한참 아래"라는 실측 근거로 의도적 트레이드오프임을 밝혀 두었고("세션 디렉터리를 잃는 것보다 리뷰를 아예 안 돌리는 게 더 나쁘다"), 실제로 51개 이상의 동시 세션이 몰리는 시나리오는 현재 워크플로에서 관측되지 않는다. 그대로 두어도 무방하나, 폴백에 진입한 사실 자체를 `debug_log` 등으로 남겨두면(현재는 조용히 구버전 동작으로 강등) 나중에 이 트레이드오프가 실제로 발동했는지 사후에 판별할 수 있다.

## 요약

이번 변경분에서 동시성과 직접 관련된 실질 코드는 `.claude/skills/code-review-agents/lib/session.py` 의 `create_session_dir` 뿐이다. 이 함수는 "같은 초에 두 세션이 생성되면 뒤의 `os.makedirs(..., exist_ok=True)` 가 앞 세션의 `meta.json`/프롬프트를 조용히 덮어쓴다"는 실측된 경쟁 조건(배치 분할 `--prepare` 74파일 사례, 병렬 Claude 세션)을 `os.makedirs(exist_ok=False)` 원자적 생성 + 접미사 재시도 루프로 정확히 고쳤다 — `mkdir` syscall 의 OS 레벨 원자성에 기대므로 체크-후-생성 방식의 TOCTOU 취약점이 없고, 새로 추가된 `test_review_session_dir_collision.py` 가 `datetime.now()` 를 고정해 같은-초 충돌을 결정적으로 재현·검증한다. 나머지 변경 파일들(`git_probe.py` 의 `worktree_changed_files`, `consistency_orchestrator.py` 의 랭킹/스플라이스/트렁케이션 로직, 프런트엔드 링크·plan 무결성 테스트)은 모두 단일 프로세스·순차 실행 코드로 스레드·async/await·락·커넥션 풀 등 동시성 프리미티브를 전혀 도입하지 않으며, 모듈 전역 `_READ_CACHE` 는 "단명 CLI, 단일 프로세스"라는 명시적 전제 위에서 안전하게 재사용된다(이번 diff 는 그 캐시를 정확히 두 호출 지점에서 재사용하도록 확장했을 뿐 새로운 공유 상태를 만들지 않았다). `--update` CLI 의 "동일 agent 동시 호출 시 unlocked read-modify-write" 문구는 이번 diff 범위 밖(변경되지 않은 기존 코드)이라 채점에서 제외했다.

## 위험도
LOW
