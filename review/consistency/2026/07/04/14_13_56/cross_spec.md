# Cross-Spec 일관성 Check — PR2b 동시성 cap + 5분 queue-wait cancel

대상: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md` (--spec 모드)

## 발견사항

- **[WARNING]** `execution.cancelled` 이벤트 계약에 신규 `EXECUTION_QUEUE_WAIT_TIMEOUT` 이 어떻게 실리는지 draft 가 명시하지 않음
  - target 위치: draft "planner 결정" §2, "변경안 > 3-error-handling.md §1.4 + conventions/error-codes.md §3"
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.1 line 179 (`execution.cancelled` payload = `{ executionId, cancelledBy, duration }`, `error` 필드 없음) · `spec/5-system/14-external-interaction-api.md` §6.5 (`cancelledBy: "user" | "system" | "timeout"` 만 채운다고 서술, `error` 필드 미언급) · `spec/conventions/chat-channel-adapter.md` line 133/342 (`cancelledBy` + `error?.code` 동봉이 실제로는 이미 쓰이고 있으며, `RESUME_*` 코드는 `cancelledBy:'system'` 로 매핑되고 어댑터가 특수 "세션 만료" UX 를 렌더하는 정책이 존재)
  - 상세: 기존 코드베이스에는 `cancelledBy: 'user' | 'system' | 'timeout'` 3-value enum 이 타입 선언돼 있으나 `'timeout'` 값은 실제로 어디서도 emit 되지 않는다(`execution-engine.service.ts` 는 `'user'`/`'system'` 만 set). draft 의 5분 queue-wait cancel 은 이 미사용 슬롯을 채우기 가장 유력한 후보이거나, 기존 `RESUME_*` 선례(system-cancel + error.code)를 따라 `cancelledBy:'system'` + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'` 로 가야 할 수도 있다 — draft 는 이 매핑을 전혀 언급하지 않는다. 또한 WS 프로토콜 §4.1 의 `execution.cancelled` payload 표 자체가 `error` 필드를 노출하지 않아(§7.5 RESUME_* 선례가 이미 이 표와 어긋나는 pre-existing drift), draft 가 이 표를 갱신하지 않으면 두 번째 미문서화 사례가 쌓인다.
  - 제안: draft 의 "변경안" 에 (a) `cancelledBy` 값 결정(`'timeout'` 신규 활성화 vs `'system'` 재사용) 명시, (b) `6-websocket-protocol.md §4.1` `execution.cancelled` 행에 `error?` 필드 추가(또는 최소한 §7.5 RESUME_* 선례와 함께 정정), (c) `14-external-interaction-api.md §6.5` 에 신규 케이스의 `error.code` 동봉 여부 명시 — 를 side-effect 점검 항목에 추가.

- **[WARNING]** `Workflow.settings.maxConcurrentExecutions` 의 쓰기 API·RBAC 미정의 (Workspace 레벨과 비대칭)
  - target 위치: draft "planner 결정" §1 ("`PATCH .../settings` 부분 머지(기존 timezone/interactionAllowedOrigins 관례 계승)")
  - 충돌 대상: `spec/1-data-model.md` §2.2 Workspace.settings (`PATCH /api/workspaces/:id/settings` — Admin+, [Spec 사용자/워크스페이스 §4.2/§6.1]) vs `spec/2-navigation/1-workflow-list.md` §3 API 표 (`PATCH /api/workflows/:id` 만 존재, "이름/상태 등" 서술, 전용 `.../settings` sub-route 없음) · `spec/2-navigation/9-user-profile.md` §4.2 역할 매트릭스 (워크플로우 생성/수정/삭제 = Editor+, Workspace 설정과 RBAC floor 가 다름)
  - 상세: draft 는 "기존 timezone/interactionAllowedOrigins 관례 계승" 이라 서술하지만 그 관례는 **Workspace.settings** 전용(Admin+, 전용 endpoint)이고, Workflow 레벨에는 그런 전용 `.../settings` endpoint 도, 알려진 키 목록도 현재 spec 에 없다. Workflow 수정은 일반 `PATCH /api/workflows/:id` (Editor+)로 이뤄지므로, `maxConcurrentExecutions` 를 이 경로로 쓰면 Workspace 레벨(Admin+ 로 cap 상향/변경 승인)과 달리 Editor 가 자기 워크플로우 cap 을 임의로 올릴 수 있다 — 워크스페이스 cap 을 우회하는 수단은 아니지만(둘 다 통과해야 admission, draft §1), 거버넌스 비대칭이 새로 생긴다.
  - 제안: draft 에 Workflow.settings 쓰기 경로(전용 sub-route 신설 여부 또는 기존 `PATCH /api/workflows/:id` 재사용)와 RBAC(Editor+ 유지 vs Admin+ 상향)를 명시적으로 결정해 `1-workflow-list.md §3` 에도 반영 대상으로 추가.

- **[INFO]** `exec-intake-queue-impl.md` 의 기존 PR2b 스코프 기록과 draft 의 스코프 분리 결정 간 최신화 필요
  - target 위치: draft 상단 "배경·스코프" (2026-07-04 사용자 결정 — priority 3-tier 분리)
  - 충돌 대상: `plan/in-progress/exec-intake-queue-impl.md` line 46 ("Q-scope=**전체 한 PR**(cap + queue-wait 5분 cancel + TOCTOU + priority 3-tier + INFO 4건)")
  - 상세: 실제 모순은 아님(draft 가 최신 사용자 결정으로 명시적으로 갱신) — draft 본문의 "side-effect 점검" 에 이미 "exec-intake plan: PR2b 항목을 spec-정의 완료 + 구현 후속으로 갱신" 이 있어 인지되고 있다. 다만 line 46 의 오래된 "전체 한 PR" 문구가 그대로 남아 있으면 후속 개발자가 구식 스코프로 착수할 위험이 있다.
  - 제안: spec 반영과 함께 `exec-intake-queue-impl.md` 의 PR2b 항목을 실제로 갱신(스코프 분리 반영)하는 것을 developer 인계 전 필수로 명시.

- **[INFO]** §8 cap 표의 "2단계 후속 per-workflow 설정" 계보와 draft 의 `maxConcurrentExecutions` 키 신설 간 문서상 연결 고리 약함
  - target 위치: draft "변경안 > 4-execution-engine.md §8"
  - 충돌 대상: `spec/5-system/4-execution-engine.md` line 1521 Rationale ("per-workflow 설정 필드(+UI)는 2단계 후속(`exec-intake-queue-impl.md` PR2b 이후)") — 이는 **active-running 누적 타임아웃**(§8 세 번째 행, 별개 정책)의 per-workflow 세분화를 가리키는 것이지 동시성 cap 키가 아니다.
  - 상세: 두 정책(동시성 cap vs 누적 타임아웃)이 §8 같은 표 안에 있고 둘 다 "Workflow.settings" 를 설정 위치로 갖는다는 점에서, draft 가 `maxConcurrentExecutions` 만 추가하고 타임아웃의 per-workflow 필드는 손대지 않는다는 경계를 명시하지 않으면 두 후속 항목이 섞일 수 있다. 실질 충돌은 아니고 문서 명료성 이슈.
  - 제안: draft 변경안에 "타임아웃의 per-workflow 세분화는 본 스코프 밖(별도 후속)" 한 줄 추가.

## 확인되어 충돌 없음으로 판정한 항목 (참고)

- **상태 전이**: `pending → cancelled` 는 이미 `4-execution-engine.md §1.1` 허용 전이 표에 존재("큐 대기 중 취소") — draft 의 5분 queue-wait cancel 이 이 기존 전이를 그대로 재사용하는 것으로 정합.
- **§4.2 직렬화 불변식**: `jobId=executionId` dedup 으로 동일 Execution 의 active 세그먼트는 항상 1개 — draft 의 "admission gate 는 최초 PENDING→RUNNING 에만" 서술과 정합하며, `exec-intake-queue-impl.md` line 47-2 의 사전 재검토 결론("admission TOCTOU 는 직렬화 불변식과 직교한 별개 문제")과도 일치.
- **§7.1 stalled 재배달**: RUNNING arm 재개는 `running → running` 조건부 re-claim(§7.5 case B) 이지 `pending → running` 이 아니므로, draft 의 "admission gate 는 stalled 재배달·park 재개에서 skip" 주장은 기존 스펙과 일치. `exec-intake-queue-impl.md` line 47-3 의 "Admission 대상 한정" 사전 결정과도 부합.
- **에러 코드 신설**: `EXECUTION_QUEUE_WAIT_TIMEOUT` 은 `error-codes.md`/`3-error-handling.md` 어디에도 기존 사용 이력이 없어 신규 코드로 안전. `EXECUTION_TIME_LIMIT_EXCEEDED`(failed)·`WORKER_HEARTBEAT_TIMEOUT`(failed) 과 의미·status 모두 구분되어 있어 draft 의 구분 서술과 일치.
- **DB 마이그레이션 번호**: 현재 최대 `V103`(`V103__trigger_endpoint_path_uuid_validate.sql`) — draft 의 `V104` 는 다음 가용 번호로 충돌 없음. (참고: `exec-intake-queue-impl.md` 의 옛 메모는 "V092 이후" 를 언급하지만 이는 그 이후 여러 PR 이 머지되며 stale 해진 중간 기록이고, 실제 max 재확인 결과 draft 의 V104 는 정확하다.)
- **settings 알려진 키 SoT**: `1-data-model.md §2.2`(line 94, Workspace) / §2.4(line 120, Workflow) 에 `maxConcurrentExecutions` 가 아직 없어 신규 추가와 충돌 없음.
- **§9.2 Redis 키**: admission 카운트가 DB `COUNT(status='running')` 기반이라 Redis 키 신설 불요 — draft 서술과 기존 §9.2 "실행 상태는 Redis 키가 아니다" 원칙(2026-07-04 in-memory/DB durable 채택)과 일치.

## 요약

draft 는 §8 cap 정책의 핵심 골격(admission gate 위치, TOCTOU 우려, cap 재심사 skip 대상, 상태 전이 재사용, 신규 에러 코드·컬럼)에서 기존 spec(§4.2 직렬화 불변식, §7.1 stalled-redelivery 모델, Execution 상태 머신, error-codes 레지스트리, 마이그레이션 채번)과 잘 정합하며 Critical 급 직접 모순은 발견되지 않았다. 다만 신규 `cancelled`+`EXECUTION_QUEUE_WAIT_TIMEOUT` 조합이 기존 EIA/WS/chat-channel-adapter 의 `cancelledBy` 3-value enum(특히 미사용 상태로 남아있던 `'timeout'` 값) 및 `execution.cancelled` payload 의 `error` 필드 노출 여부와 어떻게 맞물리는지 draft 가 명시하지 않은 점, 그리고 신규 `Workflow.settings` 키의 쓰기 API·RBAC 가 Workspace 레벨과 다른 거버넌스 계층(Editor+ vs Admin+)에 놓이는 비대칭을 방치한 점은 구현 착수 전 명확화가 필요한 WARNING 이다.

## 위험도

MEDIUM

BLOCK: NO

- WARNING — `execution.cancelled`/`cancelledBy`/`error.code` 매핑 미정의 (EIA·WS·chat-channel-adapter 교차 확인 필요)
- WARNING — `Workflow.settings.maxConcurrentExecutions` 쓰기 API·RBAC 미정의 (Workspace 레벨과 거버넌스 비대칭)
- INFO — `exec-intake-queue-impl.md` 의 구식 "전체 한 PR" 스코프 기록 갱신 필요(발견 위험 낮음, draft 가 이미 인지)
- INFO — §8 표 안 "타임아웃 2단계 후속(per-workflow)" 과 신규 cap 키의 경계 명시 권장

STATUS: SUCCESS
