# Cross-Spec 일관성 검토 — spec-draft-redis-key-registry.md

## 발견사항

- **[WARNING]** `background:run:<id>` 를 "Redis 키" 전역 인벤토리에 포함시킨 것은 데이터 모델(엔티티 종류) 오분류
  - target 위치: `plan/in-progress/spec-draft-redis-key-registry.md` §① 실측 표 "`background:run:<id>` | Background 노드" 행 (이 값이 그대로 신설 `spec/conventions/redis-keys.md` 의 "전역 인벤토리"에 옮겨질 예정, 제안 변경 §1)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` (WS 채널 인가 표 — `background:run:{id}` | workspace 소유 검증), `spec/4-nodes/1-logic/12-background.md` (§8.5 부근, WS 채널로 문서화), 구현 `codebase/backend/src/modules/websocket/websocket.service.ts:599` (`emitBackgroundRunEvent` → `this.gateway.broadcastToChannel(channel, …)`, Socket.IO room 브로드캐스트 — ioredis 클라이언트를 전혀 거치지 않음. 저장소에 `@socket.io/redis-adapter` 류 Redis WS 어댑터도 없어 이 채널은 순수 in-process 라우팅이다)
  - 상세: `background:run:<id>` 는 Redis 키가 아니라 Socket.IO room/channel 이름이다. GET/SET/INCR 등 Redis 오퍼레이션의 대상이 아니고, 값도 Redis 서버에 존재하지 않는다. 반면 같은 표의 `integration:cache:invalidate` 행은 pub/sub 이라도 실제로 ioredis `PUBLISH`(`integration-cache-bus.service.ts`)를 거치므로 "Redis 관련"이 맞다. 이 초안 자체가 §③ 각주에서 "느슨한 정규식 오탐으로 `core:`/`ws:` 를 실재한다고 잘못 셀 뻔했다"고 자기 검증 기준을 세워 놨는데, `background:run:<id>` 를 같은 표에 무자격으로 섞는 것은 같은 계열의 오류를 다른 형태로 재현하는 셈이다. 신설 규약 문서가 "Redis 키 레지스트리"를 자처하면서 WS 채널 이름을 섞으면, 정의 자체가 흐려져 이후 독자가 "이 문자열이 Redis 에 실재한다"는 잘못된 전제를 세울 수 있다(§9.2 phantom 항목을 지우는 것과 정확히 같은 이유로 문제).
  - 제안: `spec/conventions/redis-keys.md` "전역 인벤토리"에는 `background:run:<id>` 를 넣지 않거나, 넣는다면 별도 절("WS 채널 — Redis 무관")로 명확히 분리해 "Redis 키"와 혼동되지 않게 한다. 혹은 인벤토리 스코프를 "Redis 키 + 인접 in-process 라우팅 키" 로 넓히려면 그 확장을 명시적으로 정의해야 한다.

- **[WARNING]** EIA rate-limit 키 3종의 "소유 문서 포인터" 전제가 초안 자신의 실측 표와 어긋난다
  - target 위치: `plan/in-progress/spec-draft-redis-key-registry.md` §① 실측 표 "`eia:rl:interact:<executionId>` · `eia:rl:status:<executionId>` · `eia:notif:rl:<triggerId>` | EIA rate limit" 행, 그리고 "제안 변경 → 3. `data-flow/15` §2.2 — 규약 문서 역참조 한 줄" (원문: "EIA 표는 그대로 두고(상세 소유는 여기가 맞다) …")
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` §2.2 (실제로는 `iext:blacklist:<jti>` · `interaction:idempotency:<executionId>:<route>:<key>` · `exec:seq:<executionId>` 3행만 있음 — rate-limit 3키의 리터럴 표기 없음), `spec/5-system/14-external-interaction-api.md` §8.4 (rate-limit 버킷·TTL 서술은 있지만 `eia:rl:*`/`eia:notif:rl:*` 리터럴 키 문자열은 이 문서에도 없음 — 코드에만 존재: `interaction-rate-limiter.service.ts:149,152`, `outbound-notification-rate-limiter.service.ts:82`)
  - 상세: 초안이 세운 신설 규약의 설계 원칙은 "인벤토리는 포인터, 상세는 소유 문서가 갖는다"이다. 그런데 EIA 도메인으로 분류된 5개 키 중 실제로 `data-flow/15` §2.2 에 등재된 것은 2개(`iext:blacklist`, `interaction:idempotency`) + 중복 `exec:seq` 뿐이고, rate-limit 3키는 **어느 spec 파일에도 리터럴 키 형태로 등재돼 있지 않다**(동작 서술만 `5-system/14` §8.4 에 있음, 키 문자열은 없음). "EIA 표는 그대로 두고" 라는 전제를 그대로 실행하면 신설 인벤토리의 이 3행이 가리킬 "상세 소유 문서"가 실제로는 존재하지 않는 상태로 남는다 — 신설 문서가 세우려는 원칙을 스스로 첫 판올림에서 어기게 된다.
  - 제안: (a) rate-limit 3키의 포인터 대상을 `5-system/14-external-interaction-api.md` §8.4 로 명시하고, 필요하면 그 절에 리터럴 키 문자열을 한 줄 추가하거나, (b) `spec_impact` 목록에 `spec/5-system/14-external-interaction-api.md` 를 추가해 이 갭을 이번 작업 범위에 포함시킨다.

- **[INFO]** 도메인 짧은 접두 목록(`eia`·`iext` 병렬 나열)이 실제 코드의 3-way 접두 drift 를 가린다
  - target 위치: "제안 변경 → 1. … 도메인은 코드 소유 모듈을 가리키는 짧은 접두(`exec`·`eia`·`iext`·`cc`·`wh`·`cafe24`·`background`·`integration`)"
  - 충돌 대상: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:41`(`iext:blacklist:`), `idempotency.interceptor.ts:21`(`interaction:idempotency:`), `interaction-rate-limiter.service.ts:149,152`(`eia:rl:*`), `outbound-notification-rate-limiter.service.ts:82`(`eia:notif:rl:*`) — 넷 다 같은 소유 모듈(`external-interaction`)인데 리터럴 접두가 `iext:`/`interaction:`/`eia:` 세 가지로 흩어져 있다
  - 상세: 목록이 `eia` 와 `iext` 를 나란히 적어 마치 서로 다른 두 도메인처럼 읽히지만 실제로는 한 모듈이 세 접두를 쓰는 것이다(그중 `interaction:` 은 약어화도 안 됨). "도메인 = 짧은 접두 1개"라는 신설 규칙이 자신의 첫 예시에서부터 어긋난 사실을 인벤토리 각주 없이 넘기면, 다음 사람이 표만 보고 `eia`/`iext` 를 별개 소유자로 오인할 수 있다.
  - 제안: 규약 문서에 "same-module, 3-prefix drift(`iext:`/`interaction:`/`eia:` = 전부 external-interaction)" 를 각주로 명시. 통일까지 강제할 필요는 없음(마이그레이션 비용 대비 실익 낮음 — 초안 스스로의 "지켜진 적 없는 규칙" 논지와 같은 이유).

- **[INFO]** §9.2 heading 앵커에 대한 타 spec 파일 참조 4건 — spec_impact 목록에 미포함
  - target 위치: "제안 변경 → 2. `4-execution-engine.md` §9.1 / §9.2 정정" (heading 자체는 유지되는 것으로 보이나 명시돼 있지 않음)
  - 충돌 대상: `#92-용도별-키-정의-및-ttl` 앵커를 참조하는 `spec/5-system/14-external-interaction-api.md`(3곳: L156, L1051, L1070), `spec/5-system/6-websocket-protocol.md`(L106), `spec/data-flow/3-execution.md`(L219) — 총 5회, 3개 문서
  - 상세: 제안된 정정(phantom 2행 제거 + 각주 추가)은 테이블 행 단위 변경이라 heading 문구(`### 9.2 용도별 키 정의 및 TTL`)를 바꾸지 않는 한 앵커는 깨지지 않는다. 다만 이 절이 그만큼 고빈도로 외부 참조되는 지점이라는 사실이 target 의 `spec_impact`(3개 파일만 나열)에는 드러나지 않아, 구현 시 heading 문구를 바꾸는 사소한 선택(예: "9.2 용도별 키 정의 및 TTL (규약 문서 참조)") 하나로 3개 문서의 링크가 조용히 깨질 위험이 있다.
  - 제안: `4-execution-engine.md` §9.2 heading 텍스트를 그대로 유지할 것을 체크리스트에 명시하거나, 변경한다면 위 3개 파일의 앵커도 함께 갱신.

- **[INFO]** 신설 규약의 "역참조" 가 EIA 소유 문서에만 계획돼 있고 다른 도메인 소유 문서(webhook·chat-channel·cafe24·background)에는 없음
  - target 위치: "제안 변경 → 3. `data-flow/15` §2.2 — 규약 문서 역참조 한 줄" (EIA 만 해당, `spec_impact` 도 EIA 문서만 포함)
  - 충돌 대상: `spec/5-system/12-webhook.md`(§6, `wh:rl:*` 소유), `spec/data-flow/14-chat-channel.md`(L91, `cc:rl:*` 소유), `spec/4-nodes/4-integration/4-cafe24.md`(§, `cafe24:install:*` 소유) — 이들 문서는 신설 규약 문서를 역참조하지 않는다
  - 상세: 비대칭 자체가 잘못은 아니다(spec_impact 범위를 EIA 로 좁힌 의도된 선택으로 읽힘). 다만 신설 규약 문서를 "전역 인벤토리"로 표방하면서 정작 절반 이상의 소유 문서 독자는 그 존재를 알 경로가 없다는 점은 후속 확장 항목으로 남겨둘 가치가 있다.
  - 제안: 즉시 처리 불필요. 후속 plan 항목으로 "타 도메인 소유 문서에도 역참조 추가" 를 기록해 두는 정도로 충분.

## 요약

핵심 리팩터링 방향(§9.1 패턴 선언을 사실에 맞추고, §9.2 phantom 2건을 제거하고, 흩어진 규약을 `spec/conventions/redis-keys.md` 로 모으는 것)은 실측과 정확히 부합하며 별도 spec 영역과 직접 모순되지 않는다. 다만 신설 문서가 스스로 표방하는 "정확한 실측 기반 레지스트리" 기준을 두 지점에서 못 미친다 — ① `background:run:<id>` 가 실제로는 Redis 키가 아니라 Socket.IO WS 채널인데 같은 표에 무자격으로 섞여 있고, ② EIA rate-limit 키 3종의 "소유 문서가 있다"는 전제가 실제로는 성립하지 않는다(리터럴 키 형태가 어느 spec 에도 없음). 두 지점 모두 CRITICAL 은 아니다 — 신설 문서를 작성하는 그 turn 에서 바로잡을 수 있는 범위이며, 방치해도 다른 영역이 즉시 작동 불가가 되지는 않는다. 그러나 "포인터가 실재하는 상세 소유 문서를 가리킨다"는 이 초안 자신의 설계 원칙을 지키려면 project-planner 가 본문 작성 시 두 항목을 먼저 정정해야 한다.

## 위험도

MEDIUM
