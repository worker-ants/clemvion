# Refactor 백로그 — 유지보수성·가독성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 4 / Major 7 / Minor 4 — **spec 대조(2026-06-10) 후 유효 14건 / 철회 1건(M-3)**. M-2 는 진단 방향 정정됨.
> **spec 대조 판정 분포**: A 4 (C-3, M-4, M-6, m-2) / B 2 / C(행위만 규정) 6 / D(drift) 2 / E 1. — M-6·m-2 는 ✅ 2026-06-10 사용자 승인(즉시 제거 진행 확정), C-3·M-4 는 deferral 결정 대기.
> **중복 참조**: C-1 분할 설계는 [02-architecture.md](./02-architecture.md) C-1 소유. M-5 는 02 M-3 참조.
> 옵션 비교·권장안 보강 (2026-06-10)

## 정량 지표 (2026-06-10)

| 지표 | 값 |
| --- | --- |
| 소스 파일 수 (TS/TSX, 비테스트) | ~1,170 |
| 2,000줄 초과 / 1,000–1,999줄 파일 | 5 / 18 |
| backend `any` 사용 파일 수 | 44 |
| 최장 단일 메서드 | `processMultiTurnMessageInner` 971줄 |
| execution-engine.service.ts 메서드 / 조건 분기 | 116개 / 323개 |

## Critical

### C-1 [Critical] execution-engine.service.ts — 9,210줄·116메서드·323분기

- [ ] 미착수 — `execution-engine.service.ts` (02-architecture.md C-1 소유 — 본 항목은 정량 근거 포인터)

최장: `executeNode` 412줄, `executeInline` 406줄, `runExecution` 402줄, `handleAiMessageTurn` 347줄.

**spec 대조**: C(행위만 규정) — 엔진 spec 은 세그먼트/park/rehydration 행위만 규정, 클래스 구조 미규정. 단 §4.4 가 구조 결정 하나를 명시 소유(WebsocketService canonical sink, 추상화 금지) — **분리 서비스의 이벤트 발행은 WebsocketService 직접 주입 유지** 필수.

**개선 방안**:

1. [02-architecture.md](./02-architecture.md) C-1 의 strangler-fig 분리로 닫힘 (본 항목은 정량 근거 포인터). 분할 후 엔진 spec frontmatter `code:` 글로브에 신규 서비스 파일 추가.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 02 C-1 소유 유지 (본 항목은 정량 근거 포인터) | 분할 설계 단일 소유로 이중 추적·설계 충돌 방지. §4.4 WebsocketService 직주입 제약을 한 문서에서만 관리 | 03 단독으로는 닫히지 않음 — 02 C-1 진행에 종속 |
| B. 03 에서 독자 분할 설계 추진 | 02 일정과 무관하게 착수 가능 | 동일 파일 분할 설계가 두 문서로 갈라짐 — 02 C-1 strangler-fig 와 충돌 위험, §4.4 제약(WebsocketService canonical sink, 추상화 금지) 준수 책임이 이중화 |

**권장**: A — 헤더 "중복 참조" 가 이미 02 C-1 소유로 명시한 구도다. 본 항목은 정량 지표(9,210줄·116메서드·323분기)와 spec frontmatter `code:` 갱신 체크리스트만 보유하고, 분리 설계·실행은 02 에서 닫는다.

- **검증**: 기존 spec 테스트 전량 + e2e green.
- **spec 갱신**: frontmatter `code:` 만 (행위 불변 시 본문 불요).

### C-2 [Critical] ai-agent.handler.ts — `processMultiTurnMessageInner` 971줄 단일 메서드

- [ ] 미착수 — `ai-agent.handler.ts:2084` (+ `executeSingleTurn` 540줄)

**spec 대조**: C — `1-ai-agent.md §6.2` 가 멀티턴 행위를 단계 열거(2.a~h, c.bypass/c.fallback, d.5 메모리 재주입, d.6 물리 압축)로 상세 규정, 메서드 구조는 미규정. `executeProviderToolBatch` 기존재(:1128) — 재활용 제안 유효.

**개선 방안**:

1. `buildTurnMessages`(§6.2 d.5/d.6) / `executeToolBatch`(기존 메서드 확대) / `classifyTurnResult`(§6.2 3 판정) / `handleTurnCompletion`(turn push·checkpoint) 분리 — **각 메서드 doc 에 spec §6.2 단계 번호 명기** (spec 추적성 향상).
2. form bypass/fallback(console.warn 문구는 spec 본문 명시)·`ai_user` push 가 LLM 호출 **전**, `ai_assistant` push 가 응답 **직후**인 ordering 보존.
3. `executeSingleTurn` 도 §6.1 단계 0.5~7 과 정렬해 파이프라인화.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. §6.2 단계 정렬 파이프라인 분리 (개선 방안 1~3) | spec §6.2 가 단계 열거(2.a~h, d.5/d.6)로 분리 경계를 이미 제공 — 경계를 발명할 필요 없음. 메서드 doc 에 단계 번호 명기로 spec↔코드 추적성 향상, 단계별 단위 테스트 가능. `executeProviderToolBatch` 기존재로 일부는 확대만 | turn push ordering(`ai_user` 호출 전 / `ai_assistant` 응답 직후)·`_resumeState` 운반이 깨지면 park-rehydration 호환 파괴(checkpoint version 가드 발동). 행위 불변 리팩토링임에도 971줄 diff 리뷰 부담 큼 |
| B. 보류 (현 상태 유지 + 단계 주석 마킹만) | 회귀 위험 0. 비용 최소 | 971줄 단일 메서드 잔존 — §6.2 신규 단계 추가·디버깅 때마다 대조 비용 지속, 최장 메서드 정량 지표 미개선 |

**권장**: A — spec 이 단계 경계를 명시 소유하므로 분리선이 자의적이지 않고, ordering·`_resumeState` 회귀는 기존 spec 테스트 + multi-turn e2e + `_resumeCheckpoint` 재개 테스트로 고정 가능하다. B 는 위험은 없지만 본 백로그의 목적(유지보수성) 자체를 해소하지 못한다.

- **검증**: handler spec 테스트 + multi-turn e2e + `_resumeCheckpoint` 재개 테스트.
- **회귀 위험**: turn push ordering·`_resumeState` 운반이 깨지면 park-rehydration 호환 파괴(checkpoint version 가드 발동).
- **spec 갱신**: 불요.

### C-3 [Critical] Cafe24/MakeShop API 클라이언트 ~1,600줄 구조 중복 ⚠️ (A — 문서화된 DRY-deferral, 단 결정의 사각)

- [ ] 결정 대기 (사용자) — deferral 결정 (권장: B 보류 + plan 갱신) — `cafe24-api.client.ts`(1,547줄), `makeshop-api.client.ts`(1,060줄)

**spec 대조**: **A** — ① 미러는 명시 설계(`makeshop-api.client.ts:216` "mirror of cafe24's...", plan `makeshop-integration.md` "cafe24 미러"). ② DRY 보류 결정 문서화 — 같은 plan §후속 "**세 번째 Internal Bridge 추가 시** 트리거" (단 명시 목록은 frontend 3건뿐 — **1,600줄 API 클라이언트는 결정의 사각**). ③ **정정**: 원안이 "버그 누락" 예로 든 `insufficient_scope` 비대칭은 버그가 아니라 **spec 명시 의도**(`5-makeshop.md §6.1` "cafe24 한정(INT-AU-07)" — makeshop 은 per-scope 승인 티어 부재). ④ 큐 분리(`5-makeshop.md §4` "토큰 endpoint·rotation 정책이 달라 큐 공유 안 함")·배경 cron 부재(TTL 30~90일)도 의도. **사용자 보고 대상.**

**개선 방안**:

1. **결정 정리 먼저**: 본 refactor 가 deferral 트리거(3번째 provider)를 앞당기는 것임을 plan 에 명기 — 또는 3번째 provider 까지 보류 결정 (어느 쪽이든 기록).
2. 추진 시 `BaseIntegrationApiClient<TCredentials, TPolicy>` template-method: 공통 = `withIntegrationLock`/`ensureFreshToken`/`refreshViaQueue`/`performAuthRefresh`/`markAuthFailed`/`recordNetworkFailure`/`pingConnection` 골격. **provider policy 주입(통합 금지 대상)**: (a) refresh 큐 이름·source enum, (b) 403→insufficient_scope 전이(cafe24 only), (c) `{request:{...}}` envelope(cafe24 only), (d) rate-limit 헤더 메트릭(cafe24 only), (e) base URL+SSRF 가드 방식(서브도메인 vs 단일 호스트).
3. 에러 코드 prefix(`CAFE24_*`/`MAKESHOP_*`) 는 rename 금지 (`error-codes.md §2` breaking change).

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. deferral 트리거를 앞당겨 `BaseIntegrationApiClient<TCredentials, TPolicy>` 전면 도입 | ~1,600줄 구조 중복 즉시 해소. refresh/lock 골격(`withIntegrationLock`/`ensureFreshToken`/`refreshViaQueue`/`performAuthRefresh`/`markAuthFailed`) 버그 수정이 1회로 전 provider 전파. 3번째 provider 추가 시 base 상속만으로 골격 완성 | ① policy 주입 5종((a) 큐 이름·source enum, (b) 403→insufficient_scope cafe24 only, (c) `{request:{...}}` envelope cafe24 only, (d) rate-limit 헤더 메트릭 cafe24 only, (e) base URL+SSRF 가드 방식) 설계·구현 비용 선불. ② refresh race 보호(BullMQ jobId dedup vs PG row-lock 폴백)의 provider 별 미세 차이가 base 골격으로 뭉개지면 멀티 인스턴스 환경 회귀 — 본 항목 최대 위험. ③ spec 명시 비대칭(`5-makeshop.md §6.1` insufficient_scope cafe24 한정, §4 큐 비공유)을 base 가 **계속 비대칭으로 유지할 의무**가 추상화 계층 위로 이전 — hook 누락 한 번이 의도와 다른 동질화가 됨. ④ 문서화된 deferral 결정("3번째 Internal Bridge 시 트리거", plan `makeshop-integration.md` §후속) 번복을 plan 에 기록해야 함. ⑤ provider 2개 샘플 기준 추상화 — 3번째 provider 가 경계를 깨면 재설계 |
| B. 3번째 provider 까지 보류 (deferral 준수) + 결정의 사각만 기록 | 기존 문서화된 결정과 일관 — 번복 불요. 회귀 위험 0. 3번째 provider 의 실제 요구가 추상화 경계를 검증해 준 뒤 일반화 가능(잘못된 조기 일반화 회피). "1,600줄 클라이언트가 deferral 명시 목록(frontend 3건) 밖" 인 사각은 plan 한 줄 추가로 해소 | 그때까지 refresh/lock 계열 버그를 양쪽에 2회 수정하는 의무 지속. 구조 중복 1,600줄 잔존 — 정량 지표 미개선. mirror drift(한쪽만 고친 수정) 리스크가 리뷰 규율에만 의존 |
| C. 부분 공통화 — 버그-위험 메서드(refresh/lock 계열)만 공유 유틸 추출, 에러 매핑·envelope·rate-limit 메트릭 등 provider 색채 영역은 그대로 | 회귀 파급이 가장 큰 지점(멀티 인스턴스 refresh race)의 이중 수정 의무만 해소. policy 주입은 (a) 큐 이름·source enum 정도만 필요 — (b)(c)(d) 의 spec 명시 비대칭은 손대지 않아 동질화 위험 차단. 전면 base 대비 비용·diff 소폭 | 가장 민감한 race 보호 코드를 직접 만지는 작업이라 "부분" 임에도 검증 부담은 A 와 유사(멀티 인스턴스 동시 refresh 시나리오 필요). 구조 중복 대부분 잔존. 공유 유틸 vs 클라이언트 본문 경계 문서화 필요, 3번째 provider 시 전면 재설계 가능성 잔존 |

**권장**: B — DRY 보류는 이미 plan 에 문서화된 결정이고, 본 항목에서 "버그 누락" 으로 보였던 비대칭들이 spec 대조 결과 전부 의도(§6.1·§4)로 판정된 이상, 지금 추상화로 얻는 것은 중복 제거뿐인데 치를 위험(refresh race 회귀 + 비대칭 유지 의무 이전)이 그보다 크다. 단 deferral 명시 목록에 양 API 클라이언트를 추가해 "결정의 사각" 을 닫는 plan 갱신은 즉시 수행한다. 이중 수정 부담이 실제로 누적되면(동일 버그 2회 수정 사례 발생) C 로 승급 검토. **최종 선택은 사용자 결정 사항.**

- **검증**: 양 클라이언트 spec 전량 + catalog-sync + 통합 e2e, §6 에러코드 표 출력 diff 0.
- **회귀 위험**: refresh race 보호(BullMQ jobId dedup vs PG row-lock 폴백)의 미세 차이가 base 클래스로 뭉개지면 멀티 인스턴스 회귀.
- **spec 갱신**: 행위 불변이면 frontmatter `code:` 에 base 클래스 추가만 + plan 갱신 필수(1번).

### C-4 [Critical] WebSocket Gateway — 5개 핸들러 인증+소유권 보일러플레이트 복붙

- [ ] 미착수 — `websocket.gateway.ts` (핸들러 :376/:451/:525/:598/:683)

**spec 대조**: C — `6-websocket-protocol.md §7.1` 이 오히려 "통일" 을 의도(UNAUTHENTICATED/NOT_FOUND 코드 통일, IDOR 은 의도적 NOT_FOUND). **단 §7.2 가 ack wire shape 를 명령군별로 의도적으로 다르게 규정** (continuation 4종 = 평면 `{success,error,errorCode?}`, retry_last_turn = nested) — helper 가 응답 포맷까지 획일화하면 spec 위반.

**개선 방안**:

1. `requireAuthenticated(client)` + `requireOwnership(executionId, workspaceId)` private helper (Guard 보다 helper 권장 — ack 포맷 제어가 핸들러에 남아야 §7.2 shape 차이 보존 용이).
2. `as Socket & {...}` 단언 7회 → `AuthenticatedSocket` 타입 alias 1곳.
3. 에러 메시지 문자열 상수화로 "미세 불일치" 해소 — 단 §3.3 구독 거부의 평문 error 포맷은 spec 명문화 — 변경 금지.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. private helper (`requireAuthenticated` + `requireOwnership`) | ack 포맷 제어가 각 핸들러에 잔류 — §7.2 가 의도적으로 다르게 규정한 ack wire shape(continuation 4종 = 평면 `{success,error,errorCode?}`, retry_last_turn = nested)를 그대로 보존하기 쉬움. 도입 diff 작고 gateway 파일 내부에서 닫힘 | 신규 핸들러가 helper 호출을 누락해도 컴파일러·프레임워크가 강제하지 않음 — 리뷰 규율 의존. NestJS 관용구(Guard) 대비 비표준 |
| B. NestJS `@UseGuards` (CanActivate) | 프레임워크 관용구 — 신규 핸들러에 데코레이터로 일관 적용, 인증 로직이 핸들러 본문에서 완전 분리 | Guard 의 예외→응답 변환은 본질적으로 응답 포맷을 한 경로로 모는 구조 — §7.2 의 명령군별 shape 차이를 보존하려면 exception filter 에 명령별 분기를 다시 구현해야 해 복잡도가 이동만 됨. WS Guard 의 ack 콜백 접근도 우회 필요 |

**권장**: A — 기존 권고 유지. §7.1 의 "통일" 대상은 에러 **코드**(UNAUTHENTICATED/NOT_FOUND)이지 ack **shape** 가 아니며, shape 차이가 spec 명문(§7.2)인 이상 포맷 결정권을 핸들러에 남기는 helper 가 spec 위반 위험이 구조적으로 더 낮다.

- **검증**: gateway spec 테스트 + ack shape snapshot(diff 0) + WS e2e.
- **회귀 위험**: ack payload 필드/중첩 변화 = 클라이언트 분기 파괴.
- **spec 갱신**: 불요.

## Major

### M-1 [Major] `handleInstall` vs `handleMakeshopInstall` — 77% 동일 흐름 중복

- [ ] 미착수 — `integration-oauth.service.ts:1459,1763`

**spec 대조**: C — 양쪽 흐름 모두 행위 spec 존재(cafe24 §9.8 HMAC 규칙, makeshop §9.7 "HMAC 메시지 구성은 공식 문서 미확정 — `VERIFY` 마킹"), 공통화는 미규정.

**개선 방안**:

1. 공통 파이프라인 추출(timestamp ±5min 가드 → install_token 조회 → HMAC 검증 → status 분기 → redirect) + `IntegrationInstallConfig = { hmacMessageBuilder, errorCodePrefix, authorizeUrlBuilder, redirectPolicy }` 주입.
2. **makeshop HMAC 빌더는 `VERIFY` 미확정이므로 반드시 주입 함수로 격리** — cafe24 식 메시지 구성(raw-encoded 보존)을 makeshop 에 강제하지 말 것.
3. 에러 코드는 provider 별 유지(rename 금지). `handleCallback` 공통화는 02 M-2 strategy 화에 위임.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 공통 파이프라인 + `IntegrationInstallConfig` 주입 (개선 방안 1~3) | 77% 중복 흐름(timestamp 가드→install_token→HMAC→status 분기→redirect) 단일화. makeshop HMAC 가 spec 상 `VERIFY` 미확정(§9.7)이므로 빌더를 주입 함수로 격리하면 확정 시 주입부만 교체. callback 은 02 M-2 에 위임해 추상화 중복 없음 | **HMAC byte-매칭 위험** — 공통화 과정에서 인코딩 정규화(예: raw-encoded 보존 깨짐)가 끼어들면 설치 전면 장애. makeshop HMAC 메시지 구성이 미확정인 상태라 주입 인터페이스 시그니처가 나중에 흔들릴 수 있음 |
| B. 02 M-2 strategy 화에 install 까지 흡수 | provider 전략 축 단일화 — install/callback 이 한 strategy 인터페이스로. 별도 `IntegrationInstallConfig` 추상화 불요 | 02 M-2 범위 확대·일정 종속. install(install_token+HMAC 검증)과 callback(code 교환)은 검증 축이 달라 한 인터페이스에 합치면 strategy 가 비대해짐 |
| C. 보류 | HMAC 관련 회귀 위험 0 | 보안-민감 흐름 77% 중복이 양쪽 유지 — 가드(±5min·status 분기) 수정 시 이중 작업, drift 리스크 지속 |

**권장**: A — 중복이 보안 가드 로직이라 방치(C)의 drift 비용이 크고, B 는 검증 축이 다른 두 흐름을 한 strategy 로 묶는 비용이 추상화 이득을 상회한다. 단 HMAC 빌더는 provider 주입 함수로 byte 단위 보존을 강제하고(cafe24 식 메시지 구성을 makeshop 에 강제 금지), install e2e 24케이스로 byte-매칭을 고정한다.

- **검증**: cafe24 oauth spec(HMAC·scope 콤마 회귀 가드) + makeshop spec + install e2e 24케이스.
- **회귀 위험**: **HMAC byte-매칭** — 공통화 중 인코딩 정규화가 끼면 설치 전면 장애.
- **spec 갱신**: 불요.

### M-2 [Major] frontend `API_BASE_URL` 분산 정의 + 포트 불일치 — 진단 방향 정정

- [ ] 미착수 — 정포트 = **3011**, 잘못된 3001 fallback 은 `lib/api/client.ts:4`·`lib/api/assistant.ts:315`

**spec 대조**: D(drift) — **원안 서술이 역방향**: docker-compose(`APP_PORT: 3011`)·backend/.env.example(`APP_PORT=3011`)·frontend/.env.example(`localhost:3011/api`) 모두 3011 이 정답. **잘못된 3001 fallback 은 `lib/api/client.ts:4`·`lib/api/assistant.ts:315` 쪽** (login/register 의 3011 이 옳음). env 미설정 환경에서 **메인 API 클라이언트 전체**가 잘못된 포트를 친다 — 원안 추정보다 심각.

**개선 방안**:

1. `lib/api/constants.ts`: `API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api"` — 5개 파일 모두 교체.
2. `auth-providers.ts` 의 서버사이드 `INTERNAL_API_URL` 우선 로직은 `getServerApiBaseUrl()` 별도 export 유지.
3. `grep -rn "3001" frontend/src` 0건 확인.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 단일 상수 `constants.ts` + `3011` fallback 통일 (개선 방안 1~3) | 5개 파일 분산 정의 즉시 해소, env 미설정 dev 도 정포트(3011 — docker-compose·양쪽 .env.example 과 일치)로 동작. diff 작고 회귀 거의 없음 | fallback 의 존재 자체가 env 미설정/오설정을 조용히 가림 — 값이 또 drift 하면 같은 류의 버그 재발 가능(단 정의처가 1곳이라 탐지 쉬움) |
| B. env 강제 — fallback 제거, `NEXT_PUBLIC_API_URL` 미설정 시 명시 실패 | 포트 drift 원천 차단 — "잘못된 fallback" 이라는 버그 클래스 자체 제거 | `NEXT_PUBLIC_*` 는 빌드 타임 인라인 치환이라 미설정 검출 로직을 런타임/빌드 한곳에 별도 구현해야 함. 로컬 dev 에 .env 설정이 필수가 되어 진입 장벽 상승 — .env.example 이 이미 3011 을 제공하므로 추가 이득 제한적 |

**권장**: A — 이번 결함의 실체는 "fallback 의 존재" 가 아니라 "fallback **값** 불일치(3001 vs 3011)" 다. 정의처를 1곳으로 모으고 정포트로 통일하면 원인이 해소되며, B 의 DX 비용(로컬 필수 env)은 막는 버그 대비 과하다. `grep 3001` 0건 확인을 검증에 포함해 재발을 잡는다.

- **검증**: env 미설정 dev 기동 후 login/일반 API 동일 포트 확인.
- **회귀 위험**: 거의 없음 — `NEXT_PUBLIC_*` 인라인 치환 동작만 확인.
- **spec 갱신**: 불요 (spec 은 포트 미규정이 적절).

### ~~M-3 [Major] AI 핸들러들의 LLM retry 루프 독자 구현 3벌~~ — 철회

- [x] 철회 (2026-06-10 spec 대조)

**사유**: E — ① rate-limit 재시도는 이미 중앙화(`LlmService.withRetry` + `isLlmRateLimit` — 코드 주석이 "세 곳 중복을 단일 함수로 통합(SUMMARY#W5)" 명시). ② text-classifier 에 자체 retry 루프 **없음**. ③ ai-agent 의 재시도 3종(render_* 1회 / `retry_last_turn` / rate-limit)은 spec 이 별도 의미로 규정. ④ 유일 잔존 루프(IE `:502` JSON 파싱 재시도 총 3 attempt)는 **spec 고유 행위**(`3-information-extractor.md:154`) — 공유 유틸로 흡수하면 의미가 다른 재시도를 한 축으로 합치는 위험만 생김.

(선택 잔여) IE 루프에 "spec §4 step 6 고유 — withRetry 로 흡수 금지" 주석 1줄.

### M-4 [Major] `integration-configs.tsx` — Cafe24Config/MakeshopConfig 구조 중복 ⚠️ (A — 의도된 미러 + deferral family)

- [ ] 결정 대기 (사용자) — deferral 결정 (권장: B 보류, C-3 결정과 연동 재평가) — `integration-configs.tsx:404,716`

**spec 대조**: **A** — `5-makeshop.md §2` 자체가 "[Cafe24 §2] 와 동일한 패턴. 차이점만 명시" 프레임이고, 비대칭(⚠ 별도 승인 라벨은 cafe24 only)은 spec 명시(§9.5). C-3 과 같은 deferral family — 3번째 provider 시 3중 복제 예약 상태라 제네릭 추출 타당. **사용자 보고 대상.**

**개선 방안**:

1. C-3 의 1번과 동일하게 deferral 관계 먼저 기록.
2. `IntegrationOperationConfig<TExtras>` 제네릭(Integration→Resource→Operation→Fields→Pagination 공통 레이아웃) + provider descriptor 주입 `{ findOperation, findPlanned, pruneFields, FieldRow, operationBadge? }` — cafe24 의 ⚠ 라벨은 badge 주입으로만(makeshop 미주입 — §9.5).
3. pagination 노출 조건(`paginated: true` 일 때만) 등 spec 델타를 descriptor 플래그로.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `IntegrationOperationConfig<TExtras>` 제네릭 추출 + provider descriptor 주입 | 3번째 provider 시 예약된 3중 복제 차단. spec 델타(⚠ 별도 승인 라벨 = cafe24 only §9.5, pagination 노출 조건)가 descriptor 플래그로 명시화되어 비대칭의 근거가 코드에 드러남. UI 컴포넌트라 C-3 의 refresh race 같은 동시성 회귀 축은 없음 | C-3 과 같은 deferral family 의 결정 번복 — plan 기록 필요. 비대칭(⚠ 라벨·pagination)을 descriptor 가 계속 옳게 비대칭으로 유지할 의무 발생 — badge 주입 누락/오주입 시 §9.5 위반. provider 2개 샘플 기준 제네릭이라 3번째에서 경계 재조정 가능성 |
| B. 3번째 provider 까지 보류 (deferral 준수) | `5-makeshop.md §2` 의 "동일 패턴 + 차이점만 명시" 프레임과 일치하고, frontend 미러는 deferral 명시 목록(frontend 3건)에 **이미 포함** — 기존 결정과 가장 일관. 회귀 0 | 구조 중복(:404,716) 잔존 — 공통 레이아웃 수정 시 이중 작업, 3번째 provider 시 복제 1회 추가 후 그때 3벌을 일반화 |

**권장**: B — C-3 과 달리 이쪽은 deferral 명시 목록 안에 있는 정식 보류 대상이라 "결정의 사각" 조차 없고, 트리거(3번째 Internal Bridge) 도래 전에 앞당길 독립 사유가 약하다. 단 C-3 을 사용자가 A(추진)로 결정하면 같은 deferral family 로서 본 항목도 함께 재평가한다. **최종 선택은 사용자 결정 사항.**

- **검증**: frontend 테스트 + 에디터 e2e(양 노드 설정 폼) + ⚠ 라벨 스냅샷.
- **회귀 위험**: 호환 키 보존 규칙·planned/supported 표기 정책 누락.
- **spec 갱신**: 불요.

### M-5 [Major] `streamMessage` 882줄 제너레이터

- [ ] 미착수 — [02-architecture.md](./02-architecture.md) M-3 에서 추적 (포인터)

**spec 대조**: C — 행위 spec(`4-ai-assistant.md` SSE·가드)만 존재, 구조 미규정. 02 M-3 완료 시 동반 체크 — SSE 이벤트 순서·`auto_resume` 버블 분리 semantics 보존이 경계 조건.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 02 M-3 소유 유지 (본 항목은 포인터, 02 완료 시 동반 체크) | 분리 설계 단일 소유 — 헤더 "중복 참조" 구도와 일치, 동일 제너레이터에 대한 이중 설계 방지 | 03 단독으로 닫히지 않음 — 02 M-3 일정 종속 |
| B. 03 에서 독자 분리 설계 | 02 와 무관하게 착수 가능 | 같은 882줄 제너레이터의 분리안이 두 문서로 갈라짐 — SSE 이벤트 순서·`auto_resume` 버블 분리 semantics 같은 경계 조건 관리가 이중화 |

**권장**: A — C-1 과 동일 원칙. 본 항목은 경계 조건(SSE 순서·`auto_resume` semantics) 체크리스트만 보유하고 실행은 02 M-3 에서 닫는다.

### M-6 [Major] dead code — `registerContinuationHandlers` + deprecated `on()`

- [x] 완료 — ✅ 2026-06-10 (refactor-approved-batch): registerContinuationHandlers no-op+호출+`on()` 제거, spec 테스트 훅 3곳 동반. `execution-engine.service.ts`, `continuation-bus.service.ts`

**spec 대조**: **A** — 코드 주석("후속 정리 시 제거 예정")·spec 서사(`§7.4` "in-memory 머신 완전 제거(full B3) — §7.5 단일 경로 일원화") 모두 **제거가 예약된 상태**. 호출부: 프로덕션 no-op 1곳 + spec 테스트 직접 호출 2곳(:524,:14214).

**개선 방안**:

1. 본체·`:868` 호출·spec 테스트 훅 2곳 일괄 제거.
2. `on()` deprecated 메서드 + 해당 테스트 제거.
3. m-2 와 단일 cleanup PR.

**옵션 비교** (✅ 확정안 — 2026-06-10 사용자 승인, A 로 진행):

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 즉시 제거 — m-2 와 단일 cleanup PR (확정안) | 코드 주석("후속 정리 시 제거 예정")과 spec 서사(§7.4 full B3, §7.5 단일 경로 일원화)가 모두 제거를 예약한 상태 — spec↔코드 정합 회복. 호출부가 프로덕션 no-op 1곳 + spec 테스트 직접 호출 2곳뿐이고 subclass 0 확인 — 기계적 제거 | 테스트 훅 2곳(:524,:14214) 동반 수정 필요(소폭). 그 외 사실상 없음 |
| B. deprecated 상태로 잔류 | 작업 0 | dead code 잔존 — §7.5 단일 경로 서사와 코드 불일치 지속, 신규 기여자가 in-memory 경로를 살아있는 것으로 오인할 여지 |

**권장**: A — ✅ 확정안. 제거가 spec·코드 양쪽에서 이미 예약된 상태라 비교의 실익이 없고, 사용자 승인(2026-06-10)으로 즉시 제거가 확정되었다. m-2 와 단일 PR 로 묶어 cleanup 커밋을 한 번에 닫는다.

- **검증**: backend unit 전량 + continuation e2e(form/button/AI resume).
- **회귀 위험**: 낮음 — no-op 제거, 레포 내 subclass 없음 확인됨.
- **spec 갱신**: 불요 (spec 은 이미 worker 단일 경로 기술).

### M-7 [Major] execution-engine 내 inline 타입 단언 50+ 곳

- [ ] 미착수 — 샘플 `:370-371,523-525,2941,4717-4718`

**spec 대조**: B — 타입 단언/파싱 전략 규약 없음 (eslint 도 `no-unsafe-*: 'warn'` 미강제). 단 단언 대상 다수가 spec 에 타입 정의된 필드(ai-agent config §1, `_resumeState` §7.4) — 명시 인터페이스 도입이 spec 표와 자연 정렬.

**개선 방안**:

1. 노드별 config/resume-state 인터페이스를 `nodes/<type>/<type>.types.ts`(또는 기존 zod schema)에서 단일 정의, 엔진은 dispatch boundary 1곳에서 `safeParse`/타입 가드로 narrow.
2. C-1 분할과 동시 진행 — 분리되는 서비스 단위로 점진 적용(9,210줄 일괄 수정 회피).
3. (후속) `no-unsafe-*` 를 engine 디렉토리 한정 error 승격.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. zod `safeParse` 일괄 — dispatch boundary 1곳에서 전 노드 config/resume-state 파싱 즉시 전환 | 런타임 검증으로 malformed 값이 명시 실패 — 단언이 가리던 실타입 불일치 전수 노출. 기존 zod schema 재사용 시 단일 정의로 spec 표(ai-agent config §1, `_resumeState` §7.4)와 자연 정렬 | 노드 dispatch 마다 파싱 비용 발생(hot path). 조용히 통과하던 값이 실패로 바뀌는 행위 변화 — `?? 0` 류 fallback 을 `.catch()`/default 로 일일이 보존해야 함. 9,210줄 대상 일괄 수정은 C-1 분할과 충돌하는 거대 diff |
| B. 타입 가드만 (zod 없이 수동 narrow) | 파싱 비용 사실상 0, 도입 단위가 작아 점진 적용 쉬움 | 가드 본문이 수동 — 필드 추가 시 가드 갱신 누락 가능, 중첩 필드 미검증으로 검증 깊이 얕음. spec 타입 표와의 정렬이 zod schema 단일 정의 대비 약함 |
| C. 점진 — C-1 분할과 동시, 분리되는 서비스 단위로 boundary 파싱 도입 (개선 방안 2) | 9,210줄 일괄 수정 회피 — 분할 리뷰에 검증 도입이 편승해 diff 가 한 번만 읽힘. `no-unsafe-*` engine 한정 error 승격(현 eslint 은 warn 미강제)을 서비스 분리 마일스톤별로 잠글 수 있음 | 완료 시점이 C-1(02 소유) 일정에 종속. 과도기에 단언·파싱이 혼재해 일관성 일시 저하 |

**권장**: C — 50+ 단언의 일괄 전환(A)은 행위 변화(fallback 의미)와 C-1 분할 diff 가 겹쳐 회귀 추적이 어려워진다. 분리 서비스 단위로 boundary 를 만들 때 기존 zod schema 가 있으면 `safeParse`(+`.catch()` 로 fallback 보존), 없으면 가드로 시작해 점진 승격하는 것이 spec 표 정렬과 회귀 통제를 양립시킨다.

- **검증**: tsc + spec 테스트 — 단언이 가리던 실타입 불일치가 드러나면 케이스별 수정.
- **회귀 위험**: 단언→파싱 전환 시 조용히 통과하던 malformed 값이 명시 실패로 — `?? 0` 류 fallback 을 zod `.catch()`/default 로 보존.
- **spec 갱신**: 불요.

## Minor

### m-1 [Minor] NestJS 서비스 내 `console.warn` 직접 사용 — 경로 정정 + 1건 추가

- [ ] 미착수 — `modules/chat-channel/providers/telegram/telegram-message.renderer.ts:416`, `modules/audit-logs/audit-logs.service.ts:85`, `modules/chat-channel/shared/language-hint-defaults.ts:75`, `modules/mcp/mcp-test-connection.service.ts:153`, (추가 발견) `nodes/core/node-handler.registry.ts:89`

**spec 대조**: D(drift) — `3-error-handling.md §6.2` 구조화 JSON 로그 형식을 우회, `chat-channel-adapter.md:84` 는 "swallow (logger.warn)" 명시 — telegram renderer 가 규약 불일치. (원안의 경로 2건 stale — 위로 정정.)

**개선 방안**:

1. 5곳 `Logger` 교체 (scripts/·instrumentation.ts 예외).
2. eslint `no-console` 을 backend src 에 추가(scripts override 제외) — 재발 차단.
3. (별건) ai-agent spec §6.2.c.fallback 의 "console.warn" spec 원문은 planner 정정 위임.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `Logger` 교체 5곳 + eslint `no-console` 추가 (개선 방안 1~3) | `3-error-handling.md §6.2` 구조화 JSON 로그 규약·`chat-channel-adapter.md:84` "swallow (logger.warn)" 명문과 정렬. lint 룰이 재발을 기계적으로 차단 — drift 가 5곳까지 자란 전례에 대한 근본 대응 | eslint 설정에 scripts/·instrumentation.ts 예외 override 추가 필요. 룰 도입 시 기존 위반 전수 정리가 선행 조건 |
| B. `Logger` 교체만 (lint 룰 없이) | 최소 diff — 규약 위반 5곳 즉시 해소 | 재발 차단 장치 부재 — 신규 코드의 `console.*` 유입이 다시 리뷰 규율에만 의존, 같은 drift 재누적 |

**권장**: A — 교체 자체는 양쪽 동일하고 차이는 재발 차단 유무뿐인데, 본 항목이 이미 "원안 경로 2건 stale + 1건 추가 발견" 으로 drift 의 누적성을 보여줬다. 위반이 5곳뿐인 지금이 룰 도입 비용이 최소인 시점이다. audit-logs 의 "never throws" 보장은 교체 후에도 유지 확인.

- **검증**: lint green + 해당 모듈 테스트, audit-logs 의 "never throws" 보장 유지.
- **회귀 위험**: 출력 채널 변경 수준.
- **spec 갱신**: ai-agent.md 한 줄 (planner).

### m-2 [Minor] `@deprecated` 심볼 4건 잔류

- [ ] 진행 확정 — ✅ 2026-06-10 사용자 승인 (권고안: 심볼 3건 삭제 + types.ts 주석 정리, M-6 와 단일 cleanup PR) — `chat-channel.dispatcher.ts:632-636`(toEiaEvent), `system-status.constants.ts:117-119`(상수 2건), `execution-engine.service.ts:877`(M-6 와 동일 건), `chat-channel/types.ts:102`

**spec 대조**: **A** — 각 주석이 제거 예약("후속 PR 에서 제거"), 외부 참조 0건 grep 확인. **단 `types.ts:102` 는 성격이 다름** — 제거된 옛 키에 대한 **문서 주석**이고 spec 이 폐기를 명문화(§4.1 breaking change 안내) — "심볼 제거" 아닌 "주석 정리" 가 올바른 액션.

**개선 방안**:

1. `toEiaEvent` alias + 상수 2건 삭제(참조 0건 — 기계적).
2. types.ts 는 본문(:86-96)에 마이그레이션 안내가 이미 있으므로 중복 @deprecated 태그만 정리.
3. M-6 와 단일 PR.

**옵션 비교** (✅ 확정안 — 2026-06-10 사용자 승인, A 로 진행):

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 심볼 3건 삭제 + types.ts 는 주석만 정리, M-6 와 단일 PR (확정안) | 각 주석이 제거 예약("후속 PR 에서 제거") + 외부 참조 0건 grep 확인 — 기계적 삭제. `types.ts:102` 를 "심볼 제거" 가 아닌 "주석 정리" 로 구분해 §4.1 breaking change 안내(본문 :86-96 마이그레이션 가이드)는 보존 | 사실상 없음 — tsc 가 잔여 참조를 즉시 검출 |
| B. @deprecated 잔류 | 작업 0 | IDE deprecation 경고 소음 지속, "후속 PR 제거" 약속의 코드-주석 불일치 잔존 |
| C. types.ts 문서 주석까지 일괄 삭제 | 정리 범위 단순 | spec 이 명문화한 폐기 안내(§4.1)의 코드 측 흔적 소실 — 옛 키 사용자의 마이그레이션 단서 약화. 원안이 이미 "성격이 다름" 으로 배제한 방향 |

**권장**: A — ✅ 확정안. 참조 0건이 확인된 예약 삭제라 위험이 없고, types.ts 만 액션을 "주석 정리" 로 달리하는 구분이 spec §4.1 과의 정합을 지킨다. 사용자 승인(2026-06-10)으로 M-6 와 단일 cleanup PR 확정.

- **검증**: tsc + backend unit.
- **회귀 위험**: 거의 없음.
- **spec 갱신**: 불요.

### m-3 [Minor] `integrations/new/page.tsx` 1,444줄 — 8개 컴포넌트 단일 파일

- [ ] 미착수 — `integrations/new/page.tsx`

**spec 대조**: C — `4-integration.md §3` 의 step 상태 기계(§3.1 쿼리 파라미터 제어, §3.5 OAuth 팝업 postMessage, §3.6 이탈·복원)가 분리 경계를 그대로 제공.

**개선 방안**:

1. `components/integrations/steps/` 로 `AuthStep`(§5 서비스별 분기)/`TestStep`/`SaveStep` 분리, page 는 step 상태 기계만.
2. 팝업 postMessage(§3.5)·이탈 복원(§3.6)은 `useOauthPopupReturn`/`useDraftRestore` hook 으로.
3. M-4 의 제네릭 폼과 별건(이쪽은 Integration 생성 폼).

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. steps/ 컴포넌트 분리 + `useOauthPopupReturn`/`useDraftRestore` hook 추출 (개선 방안 1~3) | `4-integration.md §3` 의 step 상태 기계(§3.1 쿼리 파라미터, §3.5 팝업 postMessage, §3.6 이탈·복원)가 분리 경계를 spec 으로 제공 — 경계 발명 불요. 팝업/복원 로직이 hook 으로 격리되어 단위 테스트 가능, page 는 상태 기계만 남아 1,444줄 해소 | step deep-link·뒤로가기·팝업 race 가 분리 과정에서 깨질 수 있음 — integrations e2e(cafe24 private·makeshop·google) 의존. M-4 deferral 과 별건임을 유지해야 범위 혼선 없음 |
| B. 보류 | 회귀 0 | 8개 컴포넌트 1,444줄 단일 파일 지속 — 신규 step/provider 분기 추가마다 비용 증가. M-4 와 달리 deferral 결정의 보호도 받지 않는 단순 비대 파일 |

**권장**: A — C-2 와 같은 논리로, spec 이 이미 상태 기계 경계를 규정하고 있어 분리선이 자의적이지 않다. M-4(보류 권장)와 달리 이쪽은 문서화된 deferral 대상이 아니므로 보류할 근거가 없고, 회귀 축(§3.5/§3.6)은 기존 e2e 로 고정 가능하다.

- **검증**: integrations e2e(cafe24 private·makeshop·google 흐름).
- **회귀 위험**: step deep-link·뒤로가기·팝업 race — e2e 로 고정.
- **spec 갱신**: 불요.

### m-4 [Minor] catch 변수명 혼재 (`err` 180 / `error` 37 / `e` 10)

- [ ] 미착수 — backend 전체 (카운트 재검증 일치)

**spec 대조**: B — 명명 규약 부재(`error-codes.md` 는 에러 **코드 문자열**만 소유), unicorn 플러그인 미설치.

**개선 방안**:

1. `eslint-plugin-unicorn` 추가 + `unicorn/catch-error-name: ['error', { name: 'err' }]` 만 활성(전체 preset 비활성 — 부수 규칙 유입 차단).
2. `--fix` 일괄(약 47파일, 단일 커밋).
3. `^_` ignore 유지.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `unicorn/catch-error-name` 단일 룰 + `--fix` 일괄 (개선 방안 1~3) | 자동 수정으로 약 47파일이 단일 커밋에 닫히고, 룰이 재발을 기계적으로 차단. preset 전체 비활성으로 부수 규칙 유입 차단. 컴파일이 rename 으로 인한 shadowing 을 검출 | `eslint-plugin-unicorn` 의존성 1개 추가(단일 룰만 사용) |
| B. 수동/스크립트 일괄 통일 (lint 룰 없이) | 신규 의존성 0 | 재발 차단 없음 — 180/37/10 혼재가 다시 누적, 명명 규약의 SoT 부재 지속(`error-codes.md` 는 코드 문자열만 소유) |
| C. 보류 | 비용 0 | 동작 영향은 없으나 grep·리뷰 시 인지 부담 지속 — Minor 지만 해소 비용이 가장 싼 부류 |

**권장**: A — 자동 fix 가능한 순수 명명 통일이라 A 의 한계 비용이 의존성 1개뿐이고, 룰 없는 통일(B)은 혼재가 재누적된다는 점에서 작업 의미가 반감된다. lint 설정이 SoT 가 되어 spec 갱신도 불요하다.

- **검증**: lint + tsc + unit 전량(컴파일이 shadowing 검출).
- **회귀 위험**: 매우 낮음.
- **spec 갱신**: 불요(lint 설정이 SoT).
