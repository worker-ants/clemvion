# Rationale 연속성 검토 — spec-draft-redis-key-registry.md

## 발견사항

- **[CRITICAL]** `background:run:<id>` 는 Redis 키가 아니라 WebSocket(Socket.IO) 채널명 — 신설 SoT 에
  "실재하지 않는 항목"을 다시 심는다
  - target 위치: target 문서 "실측 ① §9.1 의 패턴 선언이 실제 키 전부와 어긋난다" 표의 마지막 행
    (`background:run:<id>` | Background 노드) 및 "제안 변경 → 1. `spec/conventions/redis-keys.md`
    신설 → 전역 인벤토리" 절 (이 표를 그대로 신규 SoT 의 인벤토리로 옮기겠다고 명시)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §9.2 각주("위 표는 **실제 사용 중인 키만**
    나열한다") 및 같은 절의 "Pub/sub 채널" 표(`integration:cache:invalidate` **단 1개**만 등재) —
    이 두 서술이 "Redis 인벤토리 = 실사용 키/채널의 완전한 목록" 이라는 invariant 를 이미 확립해
    두었다. 또한 `spec/data-flow/15-external-interaction.md` Rationale "단일 sink (R10) 를 그대로
    따르는 서술" + `spec/5-system/4-execution-engine.md` Rationale "SSE 버퍼 single-instance 한정
    이유"가 "이벤트 fan-out 은 in-process (Socket.IO/Subject) 이고 Redis pub/sub 를 경유하지 않는다"
    (수평 확장 시 Redis Pub/Sub 전환은 **아직 하지 않은 미래 이관**으로 명시)는 아키텍처 전제를
    확립한다.
  - 상세: 코드 실측으로 확인한 결과 `background:run:<id>` 는 `WebsocketService.emitBackgroundRunEvent`
    가 `this.gateway.broadcastToChannel(channel, ...)` 로 발행하는 **Socket.IO 룸 이름**이며
    (`codebase/backend/src/modules/websocket/websocket.service.ts:599`,
    `websocket.gateway.ts`, `background-run-channel-authorizer.ts`), 저장소 전체에 이 문자열을
    Redis client(`redis.get/set/publish` 등)로 쓰는 지점이 **0건**이다(`@socket.io/redis-adapter`
    등 Socket.IO 용 Redis 어댑터 자체가 도입돼 있지 않음). 즉 target 이 "코드에서 실재하는 Redis 키
    계열을 전수로 뽑아 보면" 이라며 제시한 표에, 이번엔 반대 방향의 오탐(Redis 아닌 것을 Redis 로)이
    섞여 들어갔다. target 본인이 같은 절에서 "느슨한 정규식으로 세니 `core:`/`ws:` 가 각각
    10파일/24파일 나왔는데 따옴표 시작에 고정해 재검증하니 둘 다 0건이었다" 고 정확히 같은 클래스의
    자기 오류를 이미 한 번 잡아냈음에도, 이 항목은 그 재검증을 통과하지 못한 채 표에 남아 있다.
    이 표가 그대로 신설 `redis-keys.md` 로 옮겨지면, §9.2 각주가 이미 두 번(예정) 지켜낸 "실제
    사용 중인 것만 등재" 약속을 **새 SoT 에서 세 번째로** 어기게 된다 — target 자신이 "실재하지
    않는 항목을 지우는 것이 왜 중요한가" Rationale 에서 서술한 바로 그 실패 모드다.
  - 제안: `background:run:<id>` 행을 Redis 인벤토리에서 제거한다. Background 노드가 실제로 소유한
    Redis 표면(있다면)만 남기고, WS 채널 네이밍(`execution:`/`background:run:`/`workflow:`/`kb:`/
    `notifications:<userId>` 등)은 별도로 — 필요하다면 `5-system/6-websocket-protocol.md` 쪽
    "채널 네이밍" 절로 — 분리해 다룬다. `redis-keys.md` 서두에 "Socket.IO 채널명은 본 문서 범위
    밖(Redis 미경유)" 한 줄을 명시해 향후 동일 혼동을 구조적으로 차단하는 것도 고려.

- **[INFO]** §9.1 원 패턴의 계보를 밝히면 "규칙을 실제에 맞추는" 결정의 근거가 더 단단해진다
  - target 위치: target 문서 "Rationale → 왜 규칙을 실제에 맞추나 (거꾸로가 아니라)" 절
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` Rationale "실행 컨텍스트 in-memory + DB
    durable — Redis context store 미채택" — 옛 Phase-1 설계가 정확히 `exec:{ws}:...:context`
    형태의 workspaceId-scoped 키를 쓰려 했으나 구현되지 않고 폐기됐다고 이미 기록돼 있다. §9.2
    본문 각주("실행 상태는 Redis 키가 아니다 (Phase-1 설계 대체)")도 같은 사실을 반복한다.
  - 상세: target 은 "워크스페이스 종속이 자연스러운 키가 없다"는 논증만으로 §9.1 패턴 교체를
    정당화하는데, 사실 §9.1 의 `{service}:{workspaceId}:...` 패턴 자체가 바로 그 폐기된 Phase-1
    설계의 잔재라는 점은 이미 같은 문서 Rationale 에 적혀 있다 — 즉 target 의 결정은 새로운 번복이
    아니라 기존에 이미 성립된 폐기 판단의 자연스러운 연장이다. 이 연결을 명시하지 않으면 리뷰어가
    "왜 지금 와서 §9.1 을 뒤집나"를 독립적으로 재입증해야 하는 것처럼 보인다.
  - 제안: target Rationale 에 "§9.1 의 워크스페이스-세그먼트 패턴은 §Rationale 'Redis context
    store 미채택' 이 이미 폐기 처리한 Phase-1 설계의 유일한 생존 흔적이다" 한 문장을 추가해 교차
    링크한다. 새 Rationale 작성 의무(관점 ③)를 더 명확히 충족.

- **[INFO]** in-memory throttler storage 의 "제거 사유" 각주가 향후 Layer 1(분산 throttle store)
  착지 시점에 stale 해질 potential 을 미리 문서화
  - target 위치: target 문서 "제안 변경 → 2. `4-execution-engine.md` §9.1/§9.2 정정" 표의
    `core:{wsId}:rate:{userId}` 제거 각주("API rate limit 은 in-memory")
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install endpoint rate
    limiting — Redis 분산 throttle + 실패 페널티" 의 "Layer 1 — 분산 throttle store (deferred —
    후속 infra PR)" — `@nestjs/throttler` storage 가 **전역 단일 설정**이라, 이 후속 PR 이
    착지하면 install 뿐 아니라 API 전반의 throttle 이 Redis storage 로 전환될 수 있다고 이미 예고돼
    있다.
  - 상세: target 의 각주가 틀린 것은 아니지만("현재는" in-memory, 사실이다), 이 각주만 읽는 미래
    독자는 "API rate limit 은 항상 in-memory" 로 오독하고 Layer 1 착지 후에도 갱신을 놓칠 수 있다.
    이는 CRITICAL/WARNING 급 충돌은 아니고, 정합 보완 제안 수준.
  - 제안: 제거 각주 끝에 "Layer 1(분산 throttle store, `2-navigation/4-integration.md` §Rationale)
    착지 시 재검토" 한 줄을 추가해, 향후 이 조건이 충족되면 자동으로 재조사 대상임을 표시해 둔다.

## 요약

target 은 착수 전 실측·자기 검증(느슨한 정규식 오탐을 스스로 재검증해 뒤집은 이력)을 성실히
수행했고, §9.1 패턴 교체·§9.2 phantom 제거·인벤토리를 포인터로만 두는 결정 모두 기존 Rationale
(Phase-1 Redis context store 폐기, KB S3 키 workspaceId 제외 선례, 이중 SoT 회피 원칙)과 정합하며
어떤 기각된 대안도 재도입하지 않는다. 다만 target 이 스스로 "실재 키 전수"라 주장하는 인벤토리
표 안에 `background:run:<id>`(실은 Redis 미경유 Socket.IO 채널)가 잘못 섞여 있고, 이 표가 그대로
신설 `spec/conventions/redis-keys.md` 로 옮겨질 예정이므로, target 이 막 정정하려는 바로 그 "§9.2
각주가 약속하는 실사용 전용 인벤토리" invariant 를 새 SoT 에서 다시 어길 위험이 있다 — 원문
Rationale 과의 충돌이라기보다 target 자신의 방법론(정규식 재검증)이 이번엔 반대 방향 오탐을
놓친 사례이지만, §9.2 각주가 이미 세운 합의된 약속을 직접 위반하는 결과이므로 CRITICAL 로 표기.
그 외 두 건은 새 Rationale 을 더 튼튼히 하기 위한 교차 링크 제안(INFO) 수준이다.

## 위험도
CRITICAL
