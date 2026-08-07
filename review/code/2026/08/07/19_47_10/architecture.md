# Architecture Review

## 발견사항

- **[WARNING]** `_shared/git_probe.py` 모듈 docstring 이 실제 소비자 범위를 더 이상 정확히 서술하지 않음
  - 위치: `.claude/_shared/git_probe.py:1` (모듈 최상단 docstring "Git probes shared by the three push-gate guards.")
  - 상세: 이 diff 는 `branch_diff_files()` 를 추가하면서 `code_review_orchestrator.py`, `consistency_orchestrator.py` 두 skill orchestrator 를 이 모듈의 신규 소비자로 편입시켰다(`code_review_orchestrator.py:47`, `consistency_orchestrator.py:52` 의 `from _shared import git_probe as _git_probe`). 그런데 모듈 최상단 한 줄 요약은 여전히 "세 개의 push-gate guard 가 공유" 라고만 말한다. 개별 함수(`branch_diff_files`, `git_probe.py:168-201`)의 docstring 은 orchestrator 소비 사실을 정확히 적어 두었지만, 파일을 열자마자 보이는 module-level 요약은 갱신되지 않아 이 모듈의 진짜 경계(hook 레이어 + skill-orchestrator 레이어 양쪽에 걸침)를 숨긴다. 이 프로젝트는 바로 이 diff 안에서도 "SSOT 문서가 실제 소비자와 어긋나면 안 된다"는 원칙을 다른 곳(README 의 `router_safety.py` SSOT 안내)에 명시하고 있어, 같은 기준을 이 모듈에도 적용해야 한다.
  - 제안: 모듈 docstring 첫 문단을 "세 push-gate guard + 두 skill orchestrator" 로 갱신하거나, 최소한 `branch_diff_files` 추가로 소비자 계층이 늘었다는 한 줄을 상단에 추가한다.

- **[INFO]** 한 모듈 안에 서로 다른 지연시간 요구사항(NFR)이 공존
  - 위치: `.claude/_shared/git_probe.py:168-169` (`def branch_diff_files(base_ref, cwd, *, timeout: float = 30.0, ...)`)
  - 상세: 같은 파일의 다른 프로브들은 `timeout=5.0`(기본) 또는 `timeout=2.0`(네트워크 폴백, `_origin_default_branch_over_network`)으로, "git push 를 막는 hook 경로이니 빨라야 한다"는 전제를 공유한다. 반면 `branch_diff_files` 는 skill orchestrator 의 prepare 단계에서 한 번 호출되는 용도라 30초까지 허용한다. 지금은 hook 쪽에서 이 함수를 쓰지 않아 실질적 위험은 없지만, 모듈이 "빠른 블로킹 프로브 모음" 과 "느려도 되는 1회성 prepare 프로브" 를 구분 없이 한 네임스페이스에 두고 있어, 향후 hook 이 무심코 이 함수를 재사용하면 기본값 30초가 push 경로에 그대로 얹힐 수 있다.
  - 제안: 당장 조치는 불필요하나, 이 모듈이 더 커질 경우 "hook-safe(≤5s)" 대 "orchestrator-only(길게 허용)" 프로브를 이름 또는 서브모듈로 분리하는 것을 고려.

- **[INFO]** `retry_state.py` 의 "양방향 복구 가능" 서술이 승격(promotion)과 강등(demotion) 방향에서 비대칭
  - 위치: `.claude/_shared/retry_state.py:26-29` (모듈 docstring "That arbitration covers both terminal buckets ... so an update lost to a concurrent writer is recoverable for either.") 및 `_record_fatal`/`reconcile_state_with_disk` (`retry_state.py:137-165`, `167-210`)
  - 상세: `reconcile_state_with_disk` 는 `agents_fatal` 을 `set(state.get("agents_fatal", [])) | set(fatal_on_disk(...))` 로 **합집합**해서 재도출한다(`retry_state.py:184-189`). 이 방식은 "pending/success → fatal" 승격이 유실됐을 때는 sentinel 이 양성 증거로 남아 정확히 복구되지만(`test_a_fatal_lost_to_a_concurrent_writer_is_restored_from_disk` 로 검증됨), 반대 방향 — 이미 fatal 이던 에이전트를 재시도가 "더 이상 fatal 아님"으로 강등하는 전이(`apply_status_update(..., "rate_limit", ...)` 가 sentinel 을 지우는 경로) — 는 그 전이를 담은 JSON 쓰기 자체가 동시 writer 의 stale 사본에 덮여 유실되면, 남는 것은 sentinel-없음(중립)과 stale JSON 의 `agents_fatal` 잔존값뿐이라 합집합 연산이 그 잔존값을 다시 살려낸다 — 즉 "지웠다"는 사실을 증명할 디스크 상의 양성 기록이 없다. success 방향은 리포트 파일 존재가 `missing` 목록 자체에서 그 이름을 제외시켜 fatal 판정에 도달하지 않도록 우선순위를 갖지만(`test_a_sentinel_does_not_outrank_a_report_that_arrived_later` 참고), fatal→pending/rate_limit 강등에는 그런 override 경로가 없다. 이 변경 이전에는 두 방향 모두 복구 불가였으므로 순수 개선이며 회귀는 아니지만, docstring 의 "recoverable for either" 표현은 두 방향이 대칭적으로 보장된다는 인상을 준다.
  - 제안: docstring 에 "fatal 로의 승격은 sentinel 로, 승격 해제(강등)는 sentinel 삭제 + 해당 write 가 살아남는 경우에만 보장" 처럼 방향성을 명시하거나, 후속 백로그 항목으로 등록.

- **[INFO]** `merge_coordinator_orchestrator` 의 상태 요약 출력이 공유 커널 모듈의 `print()` 부수효과에 결합
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:122-126` (`_emit_summary_state` → `_retry_state_lib.emit_summary_state(session_dir, lambda state: {...})`)
  - 상세: 이번 diff 로 세 번째 orchestrator까지 `_shared/retry_state.emit_summary_state` 의 `print(...)` 부수효과에 위임하게 됐다(레이어 관점에서 "공유 상태 조정 로직" 과 "CLI stdout 포맷팅"이 같은 함수 안에 섞여 있음). 이 자체는 이 프로젝트가 의도적으로 채택한 설계(merge_coordinator_orchestrator.py 상단 주석: "exposed as a CLI so main never has to Read _retry_state.json into its context" — 즉 stdout 한 줄이 곧 계약)이고 새로 도입된 문제는 아니지만, 이 diff 가 세 번째 소비자를 더하며 결합을 넓혔다. 실제로 테스트 쪽(`test_retry_state_shared.py` 의 `_quietly()` 헬퍼, subprocess stdout 파싱)에서 이미 이 결합 때문에 상태 검증이 stdout 캡처를 거쳐야 한다.
  - 제안: 조치 불요(의도된 트레이드오프로 판단). 다만 이 함수가 프로그래밍적 소비자(테스트 이외)를 더 필요로 하게 되면, "상태 계산"과 "라인 포맷팅"을 분리해 순수 함수로 만들 여지를 남겨둘 것.

## 요약

이번 변경은 세 orchestrator(`code_review_orchestrator`, `consistency_orchestrator`, `merge_coordinator_orchestrator`)에 걸쳐 반복되던 git 브랜치-diff 프로브와 `_retry_state.json` 자기치유 로직을 `.claude/_shared/git_probe.py` / `retry_state.py` 로 마저 통합한 리팩터링으로, 이 저장소가 이미 확립한 "공유 커널(`_shared/`)로 드리프트를 제거한다"는 패턴을 그대로 연장한다. `_run_git`/`_run_git_raw` 분리는 boolean-flag 오염 없이 계약(스칼라 trim vs 리스트 원본 보존)을 함수 단위로 분리한 좋은 설계이고, `on_error` 콜백과 `emit_summary_state` 의 `extra_fields` 콜러블 인자는 각각 로깅 채널과 orchestrator 별 차이 필드를 주입점으로 열어 OCP 를 지킨다. `_fatal/<name>` sentinel 도입은 기존 "디스크가 심판" 원칙을 `agents_fatal` 버킷까지 넓히는 자연스러운 확장이며, 세 orchestrator 간 순환 의존 없이 `_shared/` 로만 단방향으로 의존하는 계층 구조도 유지된다. 흠잡을 만한 지점은 모두 문서/서술의 정확성과 대칭성에 관한 INFO~WARNING 수준으로, 구조적 결함이나 순환 의존, 레이어 붕괴는 발견되지 않았다.

## 위험도

LOW
