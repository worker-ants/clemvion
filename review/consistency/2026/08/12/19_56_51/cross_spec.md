# Cross-Spec 일관성 검토 — spec-draft-eia-idempotency-key-scope

## 검토 방법

target(`plan/in-progress/spec-draft-eia-idempotency-key-scope.md`)이 완전히 로드된 두 대상 spec
(`spec/5-system/14-external-interaction-api.md` · `spec/data-flow/15-external-interaction.md`)과
실제 코드(`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` ·
`interaction.guard.ts` · `interaction.controller.ts` · `dto/cancel.dto.ts`)를 대조했다. 나머지 spec 은
컨텍스트 예산 초과로 헤더만 실렸으므로, `idempoten` 전수 grep(레포 전체)으로 별도 커버했다 —
`spec/5-system/15-chat-channel.md`·`spec/conventions/chat-channel-adapter.md`·
`spec/7-channel-web-chat/1-widget-app.md`가 걸렸고 각각 실 코드(`chat-channel/providers/*.ts`,
`chat-channel.dispatcher.ts`, `hooks.service.ts`, `interaction.service.ts`)까지 추적했다.

target 이 인용하는 라인 번호(L93/L98/L258/L81/L140)와 §R8 rationale, `CancelDto` all-optional 특성,
`IdempotencyInterceptor`가 HTTP 컨트롤러 두 자리(`interact`/`cancel`)에만 `@UseInterceptors`로 바인딩된
사실은 실 코드로 전부 확인되어 정확했다.

## 발견사항

- **[WARNING]** in-process trusted 경로(chat-channel)가 참조하는 "EIA Idempotency-Key" 가 이 draft 의
  스코프 모델과 아예 다른 층에 있다 — draft 가 이 axis 를 명시적으로 배제하지 않는다
  - target 위치: "무엇이 깨지는가 — 두 축"(축 1·축 2) 및 "스코프 식별자를 무엇으로 할 것인가" — 값의
    출처를 `req.interaction.executionId`(HTTP `Request` 객체)로만 정의
  - 충돌 대상: `spec/5-system/15-chat-channel.md` L88 `CCH-SE-02` — "인터랙션 명령 처리는 EIA
    `Idempotency-Key` 를 어댑터가 자동 발급(텔레그램 `update_id` 기반). 동일 `update_id` 30초 안
    재도착은 무시" (우선순위: 필수)
  - 상세: `CCH-SE-02` 는 chat-channel 인바운드 처리가 "EIA Idempotency-Key" 메커니즘(= 바로 이 draft
    가 스코프를 고치려는 `IdempotencyInterceptor`/`interaction:idempotency:<key>` Redis 캐시)을 재사용해
    dedup 한다고 명시한다. 그러나 실제 코드는:
    1. `IdempotencyInterceptor` 는 `interaction.controller.ts` 의 두 HTTP 핸들러(`interact`/`cancel`)
       에만 `@UseInterceptors` 로 바인딩되며, `context.switchToHttp().getRequest<Request>()` 로
       express `Request` 를 직접 읽는다.
    2. chat-channel 인바운드(`hooks.service.ts` `handleChatChannelWebhook`)는 **HTTP 를 거치지 않고**
       `InteractionService.interact()` 를 in-process 직접 호출한다(EIA-AU-08·§3.3.1) — `req` 객체
       자체가 없으므로 이 interceptor 가 물리적으로 실행될 수 없는 경로다.
    3. 각 provider parser(`telegram-update.parser.ts`·`discord-update.parser.ts`·
       `slack-update.parser.ts`)가 채우는 `ParsedUpdate.idempotencyKey`(update_id 기반)는
       `hooks.service.ts`·`interaction.service.ts`·`chat-channel.dispatcher.ts` 어디에서도
       소비되지 않는다(레포 전체 `\.idempotencyKey\b` grep 0건, `spec/**`·`*.spec.ts` 제외) —
       사실상 dead field 다.
    즉 `CCH-SE-02` 가 약속하는 "동일 update_id 30초 무시"는 이 draft 가 다루는 Redis 캐시 메커니즘과
    **애초에 배선돼 있지 않다**(draft 이전부터 존재하던 gap). draft 는 스코프 결손을 "execution 간"·
    "endpoint 간" 두 축으로 나눠 자매 호출부를 좁게 잡는 반복 실패("한 칸 좁게 잡는다")를 스스로
    경계하면서도, 세 번째로 존재하는 호출 경로(HTTP 를 아예 거치지 않는 in-process caller가 별도
    스펙에서 같은 이름의 메커니즘을 주장하는 경우)는 언급하지 않는다. 이 draft 를 그대로 채택해도
    `CCH-SE-02` 를 더 깨뜨리지는 않지만(원래도 미배선), 향후 누군가 `CCH-SE-02` 를 실제로 구현하려 할
    때 이 draft 의 새 키 포맷(`req.interaction` HTTP 컨텍스트 + `endpoint` 세그먼트 전제)이 in-process
    caller 에는 그대로 적용될 수 없다는 점(там `req`도 `endpoint`도 없음)을 미리 알리지 않으면, 구현자가
    "이 draft 로 chat-channel dedup 도 해결됐다"고 오판할 위험이 있다.
  - 제안: (a) target 의 "왜 지금 하나"/"무엇이 깨지는가" 절에 "본 draft 는 HTTP 인바운드(`interact`/
    `cancel`) 경로만 스코프하며, in-process trusted caller(chat-channel)의 `CCH-SE-02` 는 별도 미배선
    상태로 이 draft 범위 밖" 이라는 한 줄 caveat 추가. (b) `CCH-SE-02` dead-field 갭 자체는 이 draft 의
    책임이 아니므로 별도 spec-sync/plan 항목으로 분리 등록(project-planner 후속 판단) 권장.

- **[INFO]** endpoint discriminator 리터럴이 문서 내부에서 이미 두 이름으로 갈라져 있다
  - target 위치: "제안 변경 1" — `interaction:idempotency:<executionId>:<endpoint>:<key>` (`<endpoint>`
    값의 구체적 산출 규칙 미정의)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` L256(`"submit": "/api/external/executions/{id}/interact"`)
    vs URL 경로 자체(`/interact`) — 같은 엔드포인트를 트리거 응답 payload 는 `submit` 키로, 나머지 문서
    전체(§5.1 제목·EIA-IN-01·코드 파일명)는 `interact` 로 부른다.
  - 상세: 치명적 충돌은 아니다 — `<endpoint>` 세그먼트는 두 라우트를 구분하는 임의의 안정적 문자열이면
    기능상 무엇이든 동작한다. 다만 구현자가 트리거 응답의 `endpoints.submit` 명명을 그대로 따라 Redis
    키에 `submit` 을 쓰는지, 라우트 핸들러명을 따라 `interact` 를 쓰는지가 문서만으로는 결정되지 않아,
    `idempotency.interceptor.spec.ts` 의 회귀 테스트 문자열(`stringContaining('interaction:idempotency:...')`)
    을 작성할 때 리뷰어·구현자 간 사소한 재작업이 생길 수 있다.
  - 제안: "구현 인계" 절에 `<endpoint>` 값은 `context.getHandler().name`(또는 라우트 경로) 기준 — 즉
    `interact`/`cancel` 로 고정하고 `endpoints.submit` 표시용 별칭과는 무관함을 한 줄 명시하면 충분.

## 확인했지만 충돌 없음으로 판정한 항목 (근거만 요약)

- 데이터 모델: Redis 키 네임스페이스 변경뿐, `spec/1-data-model.md`·`execution_token`(V060) 등 Postgres
  엔티티/필드 정의와 무관 — 충돌 없음.
- API 계약: 외부 관측 가능한 요청/응답 shape·헤더(`Idempotency-Key`)·상태 코드는 변경 없음. 캐시 네임
  스페이스는 서버 내부 구현 세부이며 EIA-IN-11/EIA-RL-02 원문도 전역 유일성을 명시적으로 약속한 적이
  없다(draft 가 정확히 그 모호성을 근거로 스코프를 좁힌다) — 하위 호환.
  `spec/12-webhook.md`·`6-websocket-protocol.md` 등 인접 API 는 `Idempotency-Key` 개념 자체를 쓰지
  않아 접점 없음.
- 요구사항 ID: 신규 ID 미부여, `EIA-IN-11`/`EIA-RL-02` 문구 한정 추가뿐. 레포 전체에서 이 두 ID 를
  인용하는 다른 spec 파일 없음(grep 0건) — staleness 위험 없음.
- 상태 전이: 상태 머신 변경 없음(`iext_*`/`itk_*` 라이프사이클, execution 상태 전이 모두 무변경).
- 권한/RBAC: "ctx 부재 시 캐시만 건너뛰고 요청은 통과" 는 `spec/data-flow/15-external-interaction.md`
  Rationale 의 기존 fail-open 정책(blacklist·idempotency·jti 추적 전 경로)과 동일 기조 — 충돌 없음.
  `ExternalInteractionRequestContext`(scope 필드 없음)만 HTTP guard 가 합성한다는 §3.3.1 invariant 도
  draft 의 "클라이언트가 조작할 수 없는 값" 전제와 정합.
- 계층 책임: draft 가 전제하는 "Guard → Interceptor" NestJS 실행 순서(guard 가 먼저 돌아 `req.interaction`
  을 채운 뒤 interceptor 가 읽음)는 실제 바인딩(`interaction.controller.ts` 의 `@UseInterceptors`)과
  일치.

## 요약

target 이 다루는 두 spec 파일(`5-system/14`·`data-flow/15`)은 컨텍스트 전량 로드로 대조했고, 인용된
라인 번호·§R8 rationale·CancelDto 형태·인터셉터 바인딩 위치 등 모든 사실 주장이 실 코드와 정확히
일치했다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점에서 직접적 모순은
없다. 다만 grep 로 넓힌 인접 영역에서 `spec/5-system/15-chat-channel.md` `CCH-SE-02` 가 이 draft 가
재정의하려는 바로 그 "EIA Idempotency-Key" 메커니즘을 in-process caller 경로에서도 쓴다고 명시하는데,
그 경로는 애초에 이 interceptor 를 물리적으로 거치지 않아 draft 이전부터 미배선 상태였다(코드 확인:
`ParsedUpdate.idempotencyKey` dead field). draft 는 이를 언급하지 않아 향후 구현자가 범위를 오판할
소지가 있으므로 WARNING 으로 표시했다 — draft 채택을 막을 결함은 아니고, 한 줄 caveat 또는 후속 항목
분리로 해소 가능하다.

## 위험도
LOW
