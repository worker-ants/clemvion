# 테스트(Testing) 리뷰 결과

델타는 `no-unsafe-*` lint warning 처분(마지막 21건, 7파일)을 위한 타입 주석/제네릭/단언 추가 —
로직 변경 없음(side_effect 가 emit 바이트 동일까지 확인)이 전제된 커밋. 코드 자체는 순수
타입 강화이므로 이 델타가 "새 버그"를 만들 가능성은 낮지만, 테스트 리뷰의 관점은 다르다 —
**타입 변경이 손댄 정확히 그 줄이, 지금 테스트로 실행되는가**를 확인했다. 각 파일의 대응
spec 을 직접 열어 diff 가 닿은 라인이 실제로 실행 경로에 있는지 grep + Read 로 대조했다.

## 발견사항

- **[WARNING]** `idempotency.interceptor.ts` — 이번 diff 가 신설한 `HttpResponseLike` 타입과
  그 존재 이유(코드 주석: "테스트 mock 을 가리지 않고 도는 자리라 방어가 살아 있어야 한다")를
  실제로 검증하는 테스트가 없다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34-37`
    (`HttpResponseLike` 정의), `:105`(`getResponse<HttpResponseLike>()` 1차 호출부,
    `res.status(cached.statusCode)`), `:128-131`(2차 호출부, `statusCode` fallback +
    `>= 400` 캐시 제외 분기)
  - 상세: `idempotency.interceptor.spec.ts` 를 전수 확인했다. 이 파일의 4개 테스트는 전부
    `makeRedis().get` 을 `mockResolvedValue(null)` 로 고정한다 — 즉 **캐시 미스(신규 처리)
    경로만** 돈다. 다음 경로들은 이 스펙에서 단 한 번도 실행되지 않는다:
    (1) 같은 key + 같은 body → 캐시된 응답 재생(`:105` `res.status(cached.statusCode)` 호출),
    (2) 같은 key + 다른 body → 409 `ConflictException`,
    (3) 손상된 캐시 JSON → catch 후 신규 처리 fallback,
    (4) `cacheTapped` 의 4xx 응답 캐시 제외(`statusCode >= 400 → return`),
    (5) `res.statusCode` 가 `number` 가 아닐 때의 `200` 기본값 fallback.
    `interaction.controller.spec.ts` 는 인터셉터가 메타데이터로 "부착돼 있는지"만 확인하고
    실제 흐름은 실행하지 않는다(`some((i) => i === IdempotencyInterceptor)` 형태). e2e 검색
    결과 `IdempotencyInterceptor` 를 실제로 태우는 e2e 도 없다(유일한 "idempotency" e2e 는
    MakeShop OAuth begin 의 별개 개념).
    추가로 **Mock 적절성** 문제: 유일하게 존재하는 mock(`makeContext`)의 `res` 는 항상
    `status: jest.fn()`(함수) + `statusCode: number` 를 갖는다 — 즉 이 인터셉터의 신규
    `typeof res.status === 'function'` / `typeof res.statusCode === 'number'` 가드가 지키려는
    바로 그 "형태가 없을 수도 있는 응답 객체" 시나리오를 mock 이 애초에 재현하지 않는다.
    가드가 죽어도(예: 누군가 실수로 `res.status!(...)` 로 바꿔도) 이 스펙은 여전히 통과한다.
  - 제안: (a) 캐시 히트 재생 경로 — `redis.get` 이 유효한 `IdempotencyEntry` JSON 을 반환하는
    테스트를 추가해 `res.status` 가 캐시된 statusCode 로 호출되는지 단언. (b) 같은 key + 다른
    body → 409 단언. (c) `cacheTapped` 를 별도로 또는 `next.handle()` 이 4xx 를 방출하는
    케이스로 호출해 `redis.set` 이 호출되지 않음을 단언. (d) `status`/`statusCode` 가 없는
    `res` mock(빈 객체 `{}`) 을 한 번은 사용해 `typeof` 가드가 실제로 방어하는지 회귀 고정.

- **[INFO]** `chat-channel.dispatcher.ts` — 이번 diff 가 손댄 `logFn` 분기(`isSubFilterNull`
  → `debug`/`warn` 선택 + `.bind` 단언)가 `ChatChannelDispatcher.handle()` 경유로는 스펙에서
  도달 불가능한 상태다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:192-201`
  - 상세: 이 파일의 스펙에는 `toChatChannelEvent` 를 다루는 `describe` 블록이 다수 있지만
    전부 **standalone 순수 함수**(`toChatChannelEvent(event)`)를 직접 호출해 null/non-null 을
    확인한다 — `ChatChannelDispatcher` 클래스를 거치지 않는다. `ChatChannelDispatcher.handle`
    을 실제로 호출하는 테스트는 `:702` 의 `describe('ChatChannelDispatcher.handle — form
    게이팅 state persist')` 블록 2건뿐이고, 둘 다 `toChatChannelEvent` 가 non-null 을 반환하는
    (`form_modal`/`form_prompt`) 이벤트만 쓴다. 그 결과 `logFn` 삼항식의 두 분기(`debug` /
    `warn`) 어느 쪽도 `.handle()` 을 통해서는 한 번도 실행되지 않는다 — 향후 누군가 조건을
    반대로 뒤집어도(로그 레벨이 뒤바뀌어도) 이 스펙은 잡지 못한다. 이번 diff 자체는 emit
    동일(괄호만 추가)이라 지금 당장의 회귀는 아니지만, 커버리지 공백은 diff 가 닿은 그 줄에
    정확히 걸쳐 있다.
  - 제안: `.handle()` 에 `execution.node.completed` 이벤트(sub-filter null, `debug` 기대) 와
    다른 eventType 으로 `toChatChannelEvent` 가 null 이 되는 이벤트(`warn` 기대) 를 각각 넣어
    `this.logger` mock 의 `debug`/`warn` 호출 여부를 단언하는 테스트 2건을 추가할 것.

- **[INFO]** `executions.service.ts` — `snapshotCache` LRU-유사 evict 로직(이번 diff 가 타입을
  붙인 바로 그 줄)에 대한 테스트가 전무하다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:192-199`
    (`SNAPSHOT_CACHE_MAX_ENTRIES` 도달 시 `oldest` 계산·삭제)
  - 상세: `executions.service.spec.ts` 전체를 `snapshotCache`/`SNAPSHOT_CACHE_MAX_ENTRIES`/
    `evict`/`oldest` 로 검색했으나 매치 0건. 즉 (a) 캐시가 256건에 도달했을 때 실제로 evict 가
    일어나는지, (b) evict 되는 키가 삽입 순서상 가장 오래된 것이 맞는지(재삽입으로 갱신되는
    `has(id)` 분기와 상호작용 포함), 어느 것도 회귀 고정돼 있지 않다. `oldest !== undefined`
    체크는 `size >= MAX_ENTRIES`(즉 `size > 0`) 분기에서만 도달하므로 사실상 항상 참인
    방어적 분기인데, 이 사실 자체도 테스트로 뒷받침되지 않는다. evict 가 깨지면 캐시가
    무한히 자라는 메모리 누수로 이어질 수 있는 자리라 낮은 확률·높은 잠재 비용 조합이다.
  - 제안: 이번 diff 의 필수 수정 사항은 아니지만, `SNAPSHOT_CACHE_MAX_ENTRIES` 를 테스트에서
    주입 가능하게 하거나(생성자 옵션·상수 export) 256회 삽입을 직접 수행하는 경계값 테스트
    하나를 추가해 evict 가 정확히 1건만 일어나고 가장 먼저 삽입된 키가 사라지는지 확인할 것.

## 회귀 테스트 유효성

diff 가 닿은 나머지 자리는 실제로 그 줄을 실행하는 테스트가 이미 존재해 회귀 안전망이
살아 있음을 직접 확인했다:
- `workspace-reflection-canary.ts` — `handlerConsumesWorkspaceId(cls, handler)` 로 바뀐 호출은
  `workspace-reflection-canary.spec.ts` 가 실제 `@WorkspaceId()` 데코레이터로 양성 검출
  (`toBe(2)`)까지 고정한다(mock 없이 실동작).
- `chat-channel-config.dto.ts` — `visualNode: 'text_only' → 'text'` `@Transform` 은
  `trigger-dto-validation.spec.ts:413` 이 `plainToInstance` 로 실제 transform 을 실행해 단언.
- `ai-agent.schema.ts` — `presentationTools` 루프(`tool: unknown`)는
  `ai-agent.schema.spec.ts:521` 의 duplicate-type 테스트가 `validateAiAgentConfig` 를 직접
  호출해 그 루프를 실행한다.
- `render-tool-provider.ts` — `backfillButtonUuids`/`backfillFormOptionValues` 는 각각
  전용 `describe` 블록으로 광범위하게 커버된다(단언 다수, 여러 노드 타입).
- `migrate-node-output-refs.ts`/`.spec.ts` — 이전 라운드에서 이미 지적된 Pass 2 공백이 이번
  델타에 포함된 신규 테스트로 메워졌고, `RESOLUTION.md` 가 명시한 대로 뮤테이션(치환 무력화 →
  정확히 1건 RED)으로 판별력까지 검증됐다 — 모범 사례.
- `triggers.service.ts` 의 `SetupResult`/`Object.getPrototypeOf(...) as object` 는 다수의
  create/update/find 경로 테스트를 통해 간접적으로 이미 실행되고 있다(직접 이름으로는
  안 잡히지만 `sanitizeChatChannelForResponse` 호출부 7곳이 각 public 메서드 스펙에 얽혀 있음).
- `execution-engine.service.ts` 의 `m.query<{id:string}[]>` 는 이전 라운드 리뷰(requirement/
  security)가 이미 unit mock + e2e(`execution-concurrency-cap`) 이중 커버를 확인했다 — 이번
  델타에서 재확인할 새 코드 변화 없음.

타입 주석만 추가된 자리이므로 기존 단언 자체가 무효화될 가능성은 없다(emit 동일이 이미
증명됨) — 이 항목에서는 결함을 찾지 못했다.

## 요약

이번 델타는 순수 타입 강화 커밋이라 즉각적인 런타임 회귀 위험은 낮지만, 테스트 관점에서
diff 가 닿은 12개 파일 중 3곳(`idempotency.interceptor.ts`, `chat-channel.dispatcher.ts`,
`executions.service.ts`)은 **정확히 그 줄이 지금 테스트 스위트에서 실행되지 않는** 공백을
갖고 있다. 그중 `idempotency.interceptor.ts` 가 가장 무겁다 — 캐시 히트 재생·409 충돌·4xx
캐시 제외라는 이 인터셉터의 핵심 계약(Spec EIA §R8)이 unit/e2e 어느 쪽에도 없고, 유일한
mock 은 이번 diff 가 신설한 방어 가드가 지키려는 "형태 없는 응답" 시나리오를 아예 재현하지
않는다. 나머지 9개 파일은 diff 가 닿은 줄이 실제로 실행되는 기존 테스트가 있음을 개별
확인했고, `migrate-node-output-refs.spec.ts` 의 신규 Pass 2 테스트는 뮤테이션으로 판별력까지
검증된 모범 사례다.

## 위험도

LOW
