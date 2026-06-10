# Refactor 백로그 — 유지보수성·가독성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 4 / Major 7 / Minor 4 — **spec 대조(2026-06-10) 후 유효 14건 / 철회 1건(M-3)**. M-2 는 진단 방향 정정됨.
> **spec 대조 판정 분포**: A 4 (C-3, M-4, M-6, m-2) / B 2 / C(행위만 규정) 6 / D(drift) 2 / E 1. — M-6·m-2 는 ✅ 2026-06-10 사용자 승인(즉시 제거 진행 확정), C-3·M-4 는 deferral 결정 대기.
> **중복 참조**: C-1 분할 설계는 [02-architecture.md](./02-architecture.md) C-1 소유. M-5 는 02 M-3 참조.

## 정량 지표 (2026-06-10)

| 지표 | 값 |
| --- | --- |
| 소스 파일 수 (TS/TSX, 비테스트) | ~1,170 |
| 2,000줄 초과 / 1,000–1,999줄 파일 | 5 / 18 |
| backend `any` 사용 파일 수 | 44 |
| 최장 단일 메서드 | `processMultiTurnMessageInner` 971줄 |
| execution-engine.service.ts 메서드 / 조건 분기 | 116개 / 323개 |

## Critical

- [ ] **C-1 execution-engine.service.ts — 9,210줄·116메서드·323분기** — 최장: `executeNode` 412줄, `executeInline` 406줄, `runExecution` 402줄, `handleAiMessageTurn` 347줄.
  - **spec 대조**: C(행위만 규정) — 엔진 spec 은 세그먼트/park/rehydration 행위만 규정, 클래스 구조 미규정. 단 §4.4 가 구조 결정 하나를 명시 소유(WebsocketService canonical sink, 추상화 금지) — **분리 서비스의 이벤트 발행은 WebsocketService 직접 주입 유지** 필수.
  - **개선 방안**: [02-architecture.md](./02-architecture.md) C-1 의 strangler-fig 분리로 닫힘 (본 항목은 정량 근거 포인터). 분할 후 엔진 spec frontmatter `code:` 글로브에 신규 서비스 파일 추가.
  - 검증: 기존 spec 테스트 전량 + e2e green. / spec 갱신: frontmatter `code:` 만 (행위 불변 시 본문 불요).

- [ ] **C-2 ai-agent.handler.ts — `processMultiTurnMessageInner` 971줄 단일 메서드** — `:2084` (+ `executeSingleTurn` 540줄)
  - **spec 대조**: C — `1-ai-agent.md §6.2` 가 멀티턴 행위를 단계 열거(2.a~h, c.bypass/c.fallback, d.5 메모리 재주입, d.6 물리 압축)로 상세 규정, 메서드 구조는 미규정. `executeProviderToolBatch` 기존재(:1128) — 재활용 제안 유효.
  - **개선 방안**: 1. `buildTurnMessages`(§6.2 d.5/d.6) / `executeToolBatch`(기존 메서드 확대) / `classifyTurnResult`(§6.2 3 판정) / `handleTurnCompletion`(turn push·checkpoint) 분리 — **각 메서드 doc 에 spec §6.2 단계 번호 명기** (spec 추적성 향상). 2. form bypass/fallback(console.warn 문구는 spec 본문 명시)·`ai_user` push 가 LLM 호출 **전**, `ai_assistant` push 가 응답 **직후**인 ordering 보존. 3. `executeSingleTurn` 도 §6.1 단계 0.5~7 과 정렬해 파이프라인화.
  - 검증: handler spec 테스트 + multi-turn e2e + `_resumeCheckpoint` 재개 테스트. / 회귀 위험: turn push ordering·`_resumeState` 운반이 깨지면 park-rehydration 호환 파괴(checkpoint version 가드 발동). / spec 갱신: 불요.

- [ ] **C-3 Cafe24/MakeShop API 클라이언트 ~1,600줄 구조 중복** ⚠️ **(A — 문서화된 DRY-deferral, 단 결정의 사각)** — `cafe24-api.client.ts`(1,547줄), `makeshop-api.client.ts`(1,060줄)
  - **spec 대조**: **A** — ① 미러는 명시 설계(`makeshop-api.client.ts:216` "mirror of cafe24's...", plan `makeshop-integration.md` "cafe24 미러"). ② DRY 보류 결정 문서화 — 같은 plan §후속 "**세 번째 Internal Bridge 추가 시** 트리거" (단 명시 목록은 frontend 3건뿐 — **1,600줄 API 클라이언트는 결정의 사각**). ③ **정정**: 원안이 "버그 누락" 예로 든 `insufficient_scope` 비대칭은 버그가 아니라 **spec 명시 의도**(`5-makeshop.md §6.1` "cafe24 한정(INT-AU-07)" — makeshop 은 per-scope 승인 티어 부재). ④ 큐 분리(`5-makeshop.md §4` "토큰 endpoint·rotation 정책이 달라 큐 공유 안 함")·배경 cron 부재(TTL 30~90일)도 의도. **사용자 보고 대상.**
  - **개선 방안**:
    1. **결정 정리 먼저**: 본 refactor 가 deferral 트리거(3번째 provider)를 앞당기는 것임을 plan 에 명기 — 또는 3번째 provider 까지 보류 결정 (어느 쪽이든 기록).
    2. 추진 시 `BaseIntegrationApiClient<TCredentials, TPolicy>` template-method: 공통 = `withIntegrationLock`/`ensureFreshToken`/`refreshViaQueue`/`performAuthRefresh`/`markAuthFailed`/`recordNetworkFailure`/`pingConnection` 골격. **provider policy 주입(통합 금지 대상)**: (a) refresh 큐 이름·source enum, (b) 403→insufficient_scope 전이(cafe24 only), (c) `{request:{...}}` envelope(cafe24 only), (d) rate-limit 헤더 메트릭(cafe24 only), (e) base URL+SSRF 가드 방식(서브도메인 vs 단일 호스트).
    3. 에러 코드 prefix(`CAFE24_*`/`MAKESHOP_*`) 는 rename 금지 (`error-codes.md §2` breaking change).
  - 검증: 양 클라이언트 spec 전량 + catalog-sync + 통합 e2e, §6 에러코드 표 출력 diff 0. / 회귀 위험: refresh race 보호(BullMQ jobId dedup vs PG row-lock 폴백)의 미세 차이가 base 클래스로 뭉개지면 멀티 인스턴스 회귀. / spec 갱신: 행위 불변이면 frontmatter `code:` 에 base 클래스 추가만 + plan 갱신 필수(1번).

- [ ] **C-4 WebSocket Gateway — 5개 핸들러 인증+소유권 보일러플레이트 복붙** — `websocket.gateway.ts` (핸들러 :376/:451/:525/:598/:683)
  - **spec 대조**: C — `6-websocket-protocol.md §7.1` 이 오히려 "통일" 을 의도(UNAUTHENTICATED/NOT_FOUND 코드 통일, IDOR 은 의도적 NOT_FOUND). **단 §7.2 가 ack wire shape 를 명령군별로 의도적으로 다르게 규정** (continuation 4종 = 평면 `{success,error,errorCode?}`, retry_last_turn = nested) — helper 가 응답 포맷까지 획일화하면 spec 위반.
  - **개선 방안**: 1. `requireAuthenticated(client)` + `requireOwnership(executionId, workspaceId)` private helper (Guard 보다 helper 권장 — ack 포맷 제어가 핸들러에 남아야 §7.2 shape 차이 보존 용이). 2. `as Socket & {...}` 단언 7회 → `AuthenticatedSocket` 타입 alias 1곳. 3. 에러 메시지 문자열 상수화로 "미세 불일치" 해소 — 단 §3.3 구독 거부의 평문 error 포맷은 spec 명문화 — 변경 금지.
  - 검증: gateway spec 테스트 + ack shape snapshot(diff 0) + WS e2e. / 회귀 위험: ack payload 필드/중첩 변화 = 클라이언트 분기 파괴. / spec 갱신: 불요.

## Major

- [ ] **M-1 `handleInstall` vs `handleMakeshopInstall` — 77% 동일 흐름 중복** — `integration-oauth.service.ts:1459,1763`
  - **spec 대조**: C — 양쪽 흐름 모두 행위 spec 존재(cafe24 §9.8 HMAC 규칙, makeshop §9.7 "HMAC 메시지 구성은 공식 문서 미확정 — `VERIFY` 마킹"), 공통화는 미규정.
  - **개선 방안**: 1. 공통 파이프라인 추출(timestamp ±5min 가드 → install_token 조회 → HMAC 검증 → status 분기 → redirect) + `IntegrationInstallConfig = { hmacMessageBuilder, errorCodePrefix, authorizeUrlBuilder, redirectPolicy }` 주입. 2. **makeshop HMAC 빌더는 `VERIFY` 미확정이므로 반드시 주입 함수로 격리** — cafe24 식 메시지 구성(raw-encoded 보존)을 makeshop 에 강제하지 말 것. 3. 에러 코드는 provider 별 유지(rename 금지). `handleCallback` 공통화는 02 M-2 strategy 화에 위임.
  - 검증: cafe24 oauth spec(HMAC·scope 콤마 회귀 가드) + makeshop spec + install e2e 24케이스. / 회귀 위험: **HMAC byte-매칭** — 공통화 중 인코딩 정규화가 끼면 설치 전면 장애. / spec 갱신: 불요.

- [ ] **M-2 frontend `API_BASE_URL` 분산 정의 + 포트 불일치 — 진단 방향 정정** — 정포트 = **3011**
  - **spec 대조**: D(drift) — **원안 서술이 역방향**: docker-compose(`APP_PORT: 3011`)·backend/.env.example(`APP_PORT=3011`)·frontend/.env.example(`localhost:3011/api`) 모두 3011 이 정답. **잘못된 3001 fallback 은 `lib/api/client.ts:4`·`lib/api/assistant.ts:315` 쪽** (login/register 의 3011 이 옳음). env 미설정 환경에서 **메인 API 클라이언트 전체**가 잘못된 포트를 친다 — 원안 추정보다 심각.
  - **개선 방안**: 1. `lib/api/constants.ts`: `API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api"` — 5개 파일 모두 교체. 2. `auth-providers.ts` 의 서버사이드 `INTERNAL_API_URL` 우선 로직은 `getServerApiBaseUrl()` 별도 export 유지. 3. `grep -rn "3001" frontend/src` 0건 확인.
  - 검증: env 미설정 dev 기동 후 login/일반 API 동일 포트 확인. / 회귀 위험: 거의 없음 — `NEXT_PUBLIC_*` 인라인 치환 동작만 확인. / spec 갱신: 불요 (spec 은 포트 미규정이 적절).

- [x] ~~**M-3 AI 핸들러들의 LLM retry 루프 독자 구현 3벌**~~ — **철회 (2026-06-10 spec 대조)**
  - **사유**: E — ① rate-limit 재시도는 이미 중앙화(`LlmService.withRetry` + `isLlmRateLimit` — 코드 주석이 "세 곳 중복을 단일 함수로 통합(SUMMARY#W5)" 명시). ② text-classifier 에 자체 retry 루프 **없음**. ③ ai-agent 의 재시도 3종(render_* 1회 / `retry_last_turn` / rate-limit)은 spec 이 별도 의미로 규정. ④ 유일 잔존 루프(IE `:502` JSON 파싱 재시도 총 3 attempt)는 **spec 고유 행위**(`3-information-extractor.md:154`) — 공유 유틸로 흡수하면 의미가 다른 재시도를 한 축으로 합치는 위험만 생김.
  - (선택 잔여) IE 루프에 "spec §4 step 6 고유 — withRetry 로 흡수 금지" 주석 1줄.

- [ ] **M-4 `integration-configs.tsx` — Cafe24Config/MakeshopConfig 구조 중복** ⚠️ **(A — 의도된 미러 + deferral family)** — `:404,716`
  - **spec 대조**: **A** — `5-makeshop.md §2` 자체가 "[Cafe24 §2] 와 동일한 패턴. 차이점만 명시" 프레임이고, 비대칭(⚠ 별도 승인 라벨은 cafe24 only)은 spec 명시(§9.5). C-3 과 같은 deferral family — 3번째 provider 시 3중 복제 예약 상태라 제네릭 추출 타당. **사용자 보고 대상.**
  - **개선 방안**: 1. C-3 의 1번과 동일하게 deferral 관계 먼저 기록. 2. `IntegrationOperationConfig<TExtras>` 제네릭(Integration→Resource→Operation→Fields→Pagination 공통 레이아웃) + provider descriptor 주입 `{ findOperation, findPlanned, pruneFields, FieldRow, operationBadge? }` — cafe24 의 ⚠ 라벨은 badge 주입으로만(makeshop 미주입 — §9.5). 3. pagination 노출 조건(`paginated: true` 일 때만) 등 spec 델타를 descriptor 플래그로.
  - 검증: frontend 테스트 + 에디터 e2e(양 노드 설정 폼) + ⚠ 라벨 스냅샷. / 회귀 위험: 호환 키 보존 규칙·planned/supported 표기 정책 누락. / spec 갱신: 불요.

- [ ] **M-5 `streamMessage` 882줄 제너레이터** — [02-architecture.md](./02-architecture.md) M-3 에서 추적 (포인터).
  - **spec 대조**: C — 행위 spec(`4-ai-assistant.md` SSE·가드)만 존재, 구조 미규정. 02 M-3 완료 시 동반 체크 — SSE 이벤트 순서·`auto_resume` 버블 분리 semantics 보존이 경계 조건.

- [ ] **M-6 dead code — `registerContinuationHandlers` + deprecated `on()`** ✅ **승인(2026-06-10) — 권고안대로 진행 확정 (즉시 제거, m-2 와 단일 PR)** — `execution-engine.service.ts:877-880`, `continuation-bus.service.ts:154`
  - **spec 대조**: **A** — 코드 주석("후속 정리 시 제거 예정")·spec 서사(`§7.4` "in-memory 머신 완전 제거(full B3) — §7.5 단일 경로 일원화") 모두 **제거가 예약된 상태**. 호출부: 프로덕션 no-op 1곳 + spec 테스트 직접 호출 2곳(:524,:14214).
  - **개선 방안**: 1. 본체·`:868` 호출·spec 테스트 훅 2곳 일괄 제거. 2. `on()` deprecated 메서드 + 해당 테스트 제거. 3. m-2 와 단일 cleanup PR.
  - 검증: backend unit 전량 + continuation e2e(form/button/AI resume). / 회귀 위험: 낮음 — no-op 제거, 레포 내 subclass 없음 확인됨. / spec 갱신: 불요 (spec 은 이미 worker 단일 경로 기술).

- [ ] **M-7 execution-engine 내 inline 타입 단언 50+ 곳** — 샘플 `:370-371,523-525,2941,4717-4718`
  - **spec 대조**: B — 타입 단언/파싱 전략 규약 없음 (eslint 도 `no-unsafe-*: 'warn'` 미강제). 단 단언 대상 다수가 spec 에 타입 정의된 필드(ai-agent config §1, `_resumeState` §7.4) — 명시 인터페이스 도입이 spec 표와 자연 정렬.
  - **개선 방안**: 1. 노드별 config/resume-state 인터페이스를 `nodes/<type>/<type>.types.ts`(또는 기존 zod schema)에서 단일 정의, 엔진은 dispatch boundary 1곳에서 `safeParse`/타입 가드로 narrow. 2. C-1 분할과 동시 진행 — 분리되는 서비스 단위로 점진 적용(9,210줄 일괄 수정 회피). 3. (후속) `no-unsafe-*` 를 engine 디렉토리 한정 error 승격.
  - 검증: tsc + spec 테스트 — 단언이 가리던 실타입 불일치가 드러나면 케이스별 수정. / 회귀 위험: 단언→파싱 전환 시 조용히 통과하던 malformed 값이 명시 실패로 — `?? 0` 류 fallback 을 zod `.catch()`/default 로 보존. / spec 갱신: 불요.

## Minor

- [ ] **m-1 NestJS 서비스 내 `console.warn` 직접 사용 — 경로 정정 + 1건 추가** — `modules/chat-channel/providers/telegram/telegram-message.renderer.ts:416`, `modules/audit-logs/audit-logs.service.ts:85`, `modules/chat-channel/shared/language-hint-defaults.ts:75`, `modules/mcp/mcp-test-connection.service.ts:153`, (추가 발견) `nodes/core/node-handler.registry.ts:89`
  - **spec 대조**: D(drift) — `3-error-handling.md §6.2` 구조화 JSON 로그 형식을 우회, `chat-channel-adapter.md:84` 는 "swallow (logger.warn)" 명시 — telegram renderer 가 규약 불일치. (원안의 경로 2건 stale — 위로 정정.)
  - **개선 방안**: 1. 5곳 `Logger` 교체 (scripts/·instrumentation.ts 예외). 2. eslint `no-console` 을 backend src 에 추가(scripts override 제외) — 재발 차단. 3. (별건) ai-agent spec §6.2.c.fallback 의 "console.warn" spec 원문은 planner 정정 위임.
  - 검증: lint green + 해당 모듈 테스트, audit-logs 의 "never throws" 보장 유지. / 회귀 위험: 출력 채널 변경 수준. / spec 갱신: ai-agent.md 한 줄 (planner).

- [ ] **m-2 `@deprecated` 심볼 4건 잔류** ✅ **승인(2026-06-10) — 권고안대로 진행 확정 (M-6 와 단일 cleanup PR)** — `chat-channel.dispatcher.ts:632-636`(toEiaEvent), `system-status.constants.ts:117-119`(상수 2건), `execution-engine.service.ts:877`(M-6 와 동일 건), `chat-channel/types.ts:102`
  - **spec 대조**: **A** — 각 주석이 제거 예약("후속 PR 에서 제거"), 외부 참조 0건 grep 확인. **단 `types.ts:102` 는 성격이 다름** — 제거된 옛 키에 대한 **문서 주석**이고 spec 이 폐기를 명문화(§4.1 breaking change 안내) — "심볼 제거" 아닌 "주석 정리" 가 올바른 액션.
  - **개선 방안**: 1. `toEiaEvent` alias + 상수 2건 삭제(참조 0건 — 기계적). 2. types.ts 는 본문(:86-96)에 마이그레이션 안내가 이미 있으므로 중복 @deprecated 태그만 정리. 3. M-6 와 단일 PR.
  - 검증: tsc + backend unit. / 회귀 위험: 거의 없음. / spec 갱신: 불요.

- [ ] **m-3 `integrations/new/page.tsx` 1,444줄 — 8개 컴포넌트 단일 파일**
  - **spec 대조**: C — `4-integration.md §3` 의 step 상태 기계(§3.1 쿼리 파라미터 제어, §3.5 OAuth 팝업 postMessage, §3.6 이탈·복원)가 분리 경계를 그대로 제공.
  - **개선 방안**: 1. `components/integrations/steps/` 로 `AuthStep`(§5 서비스별 분기)/`TestStep`/`SaveStep` 분리, page 는 step 상태 기계만. 2. 팝업 postMessage(§3.5)·이탈 복원(§3.6)은 `useOauthPopupReturn`/`useDraftRestore` hook 으로. 3. M-4 의 제네릭 폼과 별건(이쪽은 Integration 생성 폼).
  - 검증: integrations e2e(cafe24 private·makeshop·google 흐름). / 회귀 위험: step deep-link·뒤로가기·팝업 race — e2e 로 고정. / spec 갱신: 불요.

- [ ] **m-4 catch 변수명 혼재 (`err` 180 / `error` 37 / `e` 10)** — backend 전체 (카운트 재검증 일치)
  - **spec 대조**: B — 명명 규약 부재(`error-codes.md` 는 에러 **코드 문자열**만 소유), unicorn 플러그인 미설치.
  - **개선 방안**: 1. `eslint-plugin-unicorn` 추가 + `unicorn/catch-error-name: ['error', { name: 'err' }]` 만 활성(전체 preset 비활성 — 부수 규칙 유입 차단). 2. `--fix` 일괄(약 47파일, 단일 커밋). 3. `^_` ignore 유지.
  - 검증: lint + tsc + unit 전량(컴파일이 shadowing 검출). / 회귀 위험: 매우 낮음. / spec 갱신: 불요(lint 설정이 SoT).
