# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `agents_fatal` 판정이 두 개의 독립 저장소(JSON 필드 ∪ `_fatal/<name>` 파일시스템 sentinel)로 갈라지고, 올바른 값은 오직 `reconcile_state_with_disk`를 거쳐야만 얻어진다.
  - 위치: `.claude/_shared/retry_state.py:213-214`(`reconcile_state_with_disk` 의 union 계산), `.claude/_shared/retry_state.py:145-189`(`_record_fatal`)
  - 상세: `state.get("agents_fatal")`(JSON 원본)만 읽으면 손실된 fatal 전이를 놓칠 수 있고, 반대로 sentinel 파일만 읽으면 이 변경 이전에 커밋된 세션의 fatal 이 전부 사라진다. 두 값을 합쳐야만 정답이라는 불변식이 `reconcile_state_with_disk` 안에만 구현돼 있고, 이를 우회해 `agents_fatal` 을 직접 읽는 호출부가 생기면(현재는 grep 상 없음을 확인) 조용히 stale 판정을 내리게 된다. 접근 지점이 하나가 아니라 "state dict 직접 접근"과 "reconcile 경유 접근" 둘로 열려 있다는 점이 구조적 위험이다.
  - 제안: `agents_fatal` 을 읽는 모든 신규 호출부는 반드시 `reconcile_state_with_disk`(또는 이를 감싼 accessor)를 거치도록 하는 규약을 SKILL.md/README 에 명시하거나, `state["agents_fatal"]` 직접 접근 대신 항상 union 을 계산해 반환하는 단일 getter 를 추가로 노출하는 것을 고려. 현재는 README(`.claude/skills/code-review-agents/README.md`)의 "운영 함정" 절이 문서로만 이를 경고하고 있다.

- **[WARNING]** `apply_status_update` 안에서 "sentinel 을 `save_state` 보다 먼저 쓴다"는 정합성 불변식이 오직 코드 작성 순서 + 주석으로만 강제된다.
  - 위치: `.claude/_shared/retry_state.py:285-288` (`_record_fatal(sd, agent, status == "fatal")` 호출이 `save_state` 호출보다 앞섬), 관련 계약 서술은 `retry_state.py:152-155`, `:280-283`
  - 상세: 이 순서가 깨지면(JSON 을 먼저 저장하고 sentinel 을 나중에 쓰면) 이번 변경이 닫으려던 바로 그 실패 모드 — "JSON 쓰기가 유실돼도 sentinel 이 남아 복구된다" — 가 성립하지 않는다. 그런데 이를 보장하는 장치는 두 줄의 호출 순서와 주석뿐이고, 두 부수효과(디스크에 sentinel 쓰기 / JSON read-modify-write)가 하나의 함수 안에 나열돼 있을 뿐 구조적으로 묶여 있지 않다. 이 저장소는 정확히 이 종류의 실패("나중에 순서가 바뀌며 불변식이 조용히 깨짐")를 이미 여러 차례(round 7 의 leading-space 버그, 이번 diff 자체가 고친 `except Exception` 좁힘 등) 겪었다는 점에서 재발 가능성이 낮지 않다.
  - 제안: 두 부수효과를 `_persist_fatal_then_state(...)` 류의 단일 헬퍼로 묶어 순서를 구조적으로 고정하거나, 최소한 "sentinel 쓰기가 반드시 JSON 저장보다 먼저 완료된다"를 직접 검증하는 회귀 테스트(예: `save_state` 를 훅해 호출 시점에 sentinel 존재 여부를 단언)를 추가해 향후 리팩터링이 순서를 흐트러뜨리면 즉시 RED 가 나도록 한다.

- **[INFO]** `.claude/_shared/git_probe.py` 가 push-gate 훅 계층(`review_guard.py`/`plan_guard.py`/`branch_guard.py`)과 스킬 오케스트레이터 계층(`code_review_orchestrator.py`/`consistency_orchestrator.py`)을 동시에 서비스하는 "shared kernel" 로 확장됐다 — 모듈 자신의 docstring 이 이를 명시적으로 인정한다.
  - 위치: `.claude/_shared/git_probe.py:1-8` (모듈 docstring), `branch_diff_files` 정의부 `.claude/_shared/git_probe.py:197-241`
  - 상세: 두 계층은 실패 시 요구되는 안전 방향이 원래 다를 수 있다 — 게이트는 "실패 시 무엇을 놓치면 안 되는가"가 기준(fail-closed 지향), 오케스트레이터는 "실패 시 빈 changeset 으로 처리"가 기준(fail-open 지향)이다. 현재는 `on_error` 콜백 + "실패 시 빈 값" 계약으로 양쪽을 통일해 문제가 없고, `errors="surrogateescape"`/`core.quotePath=false`/broad `except Exception` 등 실제로는 게이트 쪽의 더 엄격한 요구 수준을 그대로 유지한 채 확장했다(뮤테이션 6/6, `test_branch_diff_shared.py`/`UndecodableGitOutputTest` 로 핀됨). 다만 이 모듈에 향후 훅 전용 정책이 섞여 들어가면 두 레이어의 경계가 흐려질 수 있다는 점은 계속 주시할 필요가 있다.
  - 제안: 현재 조치 불요. 다만 `_shared/` 패키지에 세 번째 축(훅+두 스킬 외의 새 소비자)이 추가될 때는 이 모듈의 실패 계약("빈 값" vs "예외")이 그 소비자에도 맞는지 재확인할 것.

- **[INFO]** `retry_state.py` 가 JSON CRUD, 원자적 쓰기, fatal sentinel 파일 관리(경로 계산·조회·생성·삭제), 세 orchestrator 공통 reconcile 로직, CLI 출력 포맷팅(`emit_summary_state`)까지 한 모듈에 누적되고 있다.
  - 위치: `.claude/_shared/retry_state.py` 전체(특히 `FATAL_SENTINEL_DIR`~`_record_fatal` 블록 `:112-189`가 이번에 새로 추가된 축)
  - 상세: 지금은 모두 "재시도 상태의 내구성"이라는 하나의 관심사로 응집돼 있어 문제라 보기 어렵다. 다만 report-file 기반 수렴(`agents_success`)에 이어 파일시스템 sentinel 기반 수렴(`agents_fatal`)까지 더해지며 책임이 늘고 있어, 세 번째 유형의 "디스크 기반 수렴" 축(예: `agent_history`/`rate_limit_episodes` 를 나중에 수렴시키기로 결정할 경우)이 추가되면 모듈 분리(예: `fatal_sentinel.py` 서브모듈 추출)를 고려할 시점이 될 수 있다.
  - 제안: 지금 당장 조치 불요 — 향후 같은 종류의 축이 하나 더 추가되면 분리 검토.

## 긍정적으로 확인된 설계

- `_shared/git_probe.py`(의존성 없음) → `_shared/retry_state.py`(→`report_paths` 만 의존) → 세 orchestrator 로 이어지는 의존 방향이 단방향이며 순환 의존은 없음(실측: 세 `_shared` 모듈의 import 문 확인).
- `branch_diff_files(..., on_error=callback)` 는 로깅 채널을 콜백으로 주입받아 DIP 를 지킨다 — 공유 모듈이 각 오케스트레이터의 `debug_log` 구현에 의존하지 않는다.
- `emit_summary_state(session_dir, extra_fields=None)` 는 orchestrator 별로 달라지는 필드(`skipped=`/`routing=` vs `branches=`/`base=`)를 callable 파라미터로 주입받는 Strategy 형태로 열어두어, 코드 복제 없이 OCP 를 지킨다.
- `merge_coordinator_orchestrator.py` 는 이번 변경으로 `_reconcile_state_with_disk` 를 추가 위임해 나머지 두 orchestrator 와 자기치유 능력이 대칭을 이루게 됐다 — 세 사본 중 하나만 다른 계약을 갖던 구조적 비대칭이 해소됨.
- `test_plan_guard.py` 가 `git_probe` 의 `_`-prefixed 심볼만 훅 위임 대상으로 도출하는 기존 관례를 유지한 채, 이번에 추가된 `branch_diff_files` 는 의도적으로 public 이름을 써서 그 도출 로직에 걸리지 않도록 설계됐다(모듈 docstring 에 명시) — 네이밍 컨벤션이 암묵적 계약으로 쓰이는 기존 패턴과 충돌하지 않는다.

## 요약

이번 변경은 세 개의 orchestrator(`code_review_orchestrator`, `consistency_orchestrator`, `merge_coordinator_orchestrator`)에 흩어져 있던 "브랜치 diff 계산"과 "재시도 상태 자기치유" 로직을 `.claude/_shared/` 공유 모듈로 통합하고, 그 과정에서 실제로 갈라져 있던 버그(leading-space 경로 유실, `core.quotePath` 미적용, `UnicodeDecodeError` 크래시, `merge_coordinator` 의 자기치유 누락, `agents_fatal` lost-update)를 다수 발견·수정한 견고한 리팩터링이다. 의존 방향은 순환 없이 단방향이고, DIP(`on_error` 콜백)와 OCP(`extra_fields` callable) 적용이 적절하며, 세 orchestrator 간 계약 대칭성이 개선됐다. 다만 `agents_fatal` 을 JSON∪sentinel 두 저장소로 이원화한 설계는 (문서와 테스트로 충분히 방어되고 있지만) 향후 "reconcile 를 거치지 않은 직접 읽기"가 생길 경우 stale 판정으로 이어질 구조적 여지를 남기고, `_record_fatal`→`save_state` 호출 순서라는 정합성 불변식이 주석에만 의존한다는 점은 이 저장소가 반복적으로 겪어온 "순서 의존 결함"의 재발 표면이 될 수 있어 주의가 필요하다.

## 위험도

LOW
