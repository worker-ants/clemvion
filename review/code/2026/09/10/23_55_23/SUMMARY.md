# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 0건. 다만 이번 PR 이 방금 닫은 CRITICAL(카드 편집 PATCH 후 `inboundSigningRef` 소실 → 인입 서명 fail-open)이 **동시 PATCH 레이스**를 통해 재발할 수 있는 경로가 남아 있다(concurrency, WARNING). 강제 화이트리스트(router_safety) 7명 전원 결과 확보 완료 — 누락된 forced reviewer 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | `update()`→`setupChatChannel()`(외부 어댑터 호출 포함, 여러 `await`) 전체가 트랜잭션/낙관적 잠금/행 잠금 없이 요청 시작 시점의 `trigger.config` 스냅샷을 신뢰한다. 같은 트리거에 동시 PATCH 가 겹치면 나중에 커밋되는 요청이 먼저 반영된 `inboundSigningRef` 를 오래된 스냅샷으로 되돌려 쓸 수 있다(lost update) — 이번 PR 이 막 닫은 "카드 편집 PATCH 후 인입 서명 fail-open" CRITICAL 이 동시성 경로로 재발 가능. database 리뷰도 같은 지점을 TOCTOU 로 별도 확인(INFO). | `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 491~556행(특히 526-528행 `previousInboundSigningRef` 캡처), `setupChatChannel()` 1203~1215행, 자매 패턴 `rotateChatChannelBotToken()` 1541~1550행 | 트리거 단위 advisory lock 또는 `SELECT ... FOR UPDATE` 로 read-modify-write 구간 직렬화, 최소한 `config` 낙관적 버전 비교. 범위 밖이면 최소한 인위적 인터리빙으로 소실을 재현하는 회귀 테스트를 추가하고 후속 턴에 명시 등재 |
| 2 | 문서 동기화(user_guide_sync) | 백엔드 API 계약 변경(`backend-api-change` 매트릭스 행) target (b) "관련 user-guide 페이지" 미충족. 4개 문서(ko/en telegram·triggers)가 이번 PR 이 실측 확정한 실제 값과 반대로 남아 있다 — 필드명이 `botTokenRef`(오기, 실제는 `botToken`)이고 `details.field` 형식도 flat(오기, 실제는 nested `chatChannel.botToken`)이다. slack/discord 문서(ko/en)에는 Signing Secret/Public Key PATCH 차단·회전 안내 자체가 없다. | `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:119`(+`.en.mdx:106`), `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429`(+`.en.mdx:418`); 부수: `slack.mdx`/`discord.mdx`(+en) 전체 | 4개 파일의 필드명·`details.field` 표기를 `chatChannel.botToken`(nested)로 정정. slack/discord(+en) 문서에 telegram 의 "Bot Token 회전" 절과 대응하는 "Signing Secret/Public Key 는 PATCH 불가 — 재생성 필요" 절 신설. `codebase/frontend/**` 는 developer 권한 내이므로 이번 PR 내 직접 수정 가능(별도 planner 턴 불요) |
| 3 | 요구사항/API계약 | `chatChannel` PATCH 가 비밀 필드를 거부할 때 `details.field` 표현이 값이 비어있는지(`null`/`''` vs non-empty)에 따라 flat(`{field:'botToken'}`)/nested(`chatChannel.botToken`, 배열)로 갈리는데, 이 갈림을 컨트롤러 Swagger 문서도 신규 `[실측]` 테스트도 포착하지 못했다. 이 실측이 spec(`§5.4.1`) 의 "미확정" placeholder 를 채우는 근거로 쓰일 예정이라 불완전한 실측이 그대로 확정될 위험. | `codebase/backend/src/modules/triggers/triggers.service.ts:683-699`(`assertPatchCarriesNoSecrets`, flat) / `dto/trigger-dto-validation.spec.ts:827-849`(`[실측]`, non-empty 값만 시험) / `triggers.controller.ts:122-127`(무조건 nested 로 서술) | `[실측]` 테스트에 `null`/`''` 케이스를 추가해 완전한 표를 만들거나, 서비스단 실패도 배열+nested 로 통일해 표현을 일치시킨다 |
| 4 | 아키텍처 | `assertChatChannelInputSafe` 의 `mode: 'create'\|'update'` 문자열 판별자가 실제 DTO 타입(`ChatChannelConfigDto` vs `ChatChannelUpdateConfigDto`)과 컴파일 타임에 상관되지 않는다 — `mode` 값과 실제 넘어온 타입의 짝이 깨져도(향후 리팩터링 실수) 컴파일러가 못 잡고 `as ChatChannelConfigDto` 캐스팅이 조용히 통과한다. 현재 호출부 2곳은 정확하지만, 이 함수가 지키는 것이 바로 이번 PR 이 닫은 보안 결함 클래스라 재발 시 검출 없이 되살아날 수 있다. | `codebase/backend/src/modules/triggers/triggers.service.ts:73`(`ChatChannelInputMode`), `:632-635`(`assertChatChannelInputSafe`), 호출부 `:430`·`:513`, 캐스팅 `:672-674` | 함수 오버로드로 `mode` 값과 DTO 타입을 타입 레벨에서 상관: `(chatChannel: ChatChannelConfigDto\|undefined, mode:'create')` / `(chatChannel: ChatChannelUpdateConfigDto\|undefined, mode:'update')` 두 시그니처 |
| 5 | 테스트 | `botToken` 에는 `null`·`''` 두 값 다 서비스 레벨 회귀 테스트가 추가됐지만, 동일 방어 코드 패턴(`typeof x !== 'undefined'`)을 쓰는 자매 필드 `inboundSigningPlaintext` 에는 `''` 하나만 추가돼 `null` 케이스가 없다 — 저장소가 반복 겪은 "축은 대칭인데 한쪽만 고정" 패턴과 동일 형태 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3234`(botToken, `it.each(['null',null],['빈 문자열',''])`) vs `:3250`(inboundSigningPlaintext, `''`만) | `inboundSigningPlaintext` 에도 `null` 케이스 1건 추가, 필요시 `it.each` 로 두 필드×두 값 4콤보 통합 |
| 6 | 유지보수성 | `setupChatChannel` 이 이번 라운드 수정(CRITICAL #1 fix)으로 133→186줄(+40%)로 늘었고, adapter 확인·secret 쓰기 게이팅 2종·`inboundSigningRefSurvives` 판정·config 3갈래 조립·성공/실패 두 경로 영속화까지 6~8가지 관심사를 한 함수가 계속 떠맡는다. JSDoc·근거 주석·대칭 테스트가 위험을 상쇄해 즉시 차단 사유는 아님 | `codebase/backend/src/modules/triggers/triggers.service.ts:1063`~`1248`(`setupChatChannel`), `update()` 485~607(같은 추세 3줄 추가) | 당장 불요 — 다음에 손댈 때 "secret 쓰기 게이팅 + ref 생존 판정"(앞쪽 절반)을 `resolveChatChannelSecretWrites(...)` 헬퍼로 분리 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (사전 존재) | `ChatChannelConfigDto.botToken` 이 Swagger 상 `minLength:1` 을 명시하지만 실제 `@MinLength(1)` validator 가 없어 **생성(POST) 경로**에서 빈 문자열 bot token 이 통과한다. 이번 PR 은 PATCH 경로만 게이팅했고 생성 경로는 스코프 밖 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:174-187` | 별도 후속으로 `@MinLength(1)`(또는 provider별 정규식) 추가 권고. 블로킹 아님 |
| 2 | 데이터베이스 | 트리거 본체 `save()` 와 `setupChatChannel` 내부의 secret-store 쓰기 + 두 번째 `triggerRepository.update()` 가 하나의 트랜잭션이 아니다(best-effort 두-단계 커밋, 기존 설계 CCH-SE-01) | `triggers.service.ts` `update()` 566~605행, `setupChatChannel` 1207/1239행 | 조치 불요(기존 설계). 향후 복구 로직 재검토 시 정합성 단위 재검토 |
| 3 | 데이터베이스/동시성 | `assertChatChannelAlreadySetUp` 판단 이후 `save()` 까지 낙관적 잠금 없음(TOCTOU) — WARNING #1(concurrency)과 동일 클래스 | `triggers.service.ts` `update()` 491~556행 | WARNING #1 조치로 함께 해소 |
| 4 | API 계약 | `ChatChannelUpdateConfigDto` 의 금지 필드(`botToken`/`inboundSigningPlaintext`)가 OpenAPI 상 `writeOnly:true` 로 선언돼 "보낼 수 있는 값"이라는 오신호를 준다(실제로는 보내면 100% 400) | `chat-channel-config.dto.ts:381,396` | `deprecated`/`readOnly` 마커 검토 또는 description 경고 유지·강화 |
| 5 | 아키텍처 | `ChatChannelInput`/`ChatChannelInputMode` 유니온 타입이 DTO 모듈이 아니라 서비스 파일에 선언돼 모듈 소속이 어긋난다 | `triggers.service.ts:60,73` | `chat-channel-config.dto.ts` 로 이동 권고 |
| 6 | 아키텍처 | `Trigger.config` JSONB 를 가리키는 인라인 구조적 캐스팅이 이 diff 로 2곳 더 늘어 파일 전체에 최소 3가지 표현이 산재 | `triggers.service.ts:526-528, 714-715`(+기존 `teardownChatChannel`) | 단일 접근자(`readTriggerChatChannelConfig`)로 통합 검토 |
| 7 | 요구사항 | `assertChatChannelAlreadySetUp` JSDoc이 "최초 setup 차단"만 설명하고 실제로 겸하는 "provider 전환 차단"은 인라인 주석에만 있음 | `triggers.service.ts:703-732` | JSDoc 한 줄 보강 또는 두 함수로 분리 |
| 8 | 테스트 | CRITICAL #1 회귀가 서비스층·인증층 두 개의 분리된 unit spec 에만 있고, 실제 HTTP PATCH→웹훅 서명검증까지 잇는 e2e 는 없음(배선 자체는 미검증) | `triggers.service.spec.ts` vs `chat-channel-inbound-authenticator.spec.ts` | 필수 아님 — 후속 e2e 케이스 고려 |
| 9 | 테스트 | `assertChatChannelAlreadySetUp` 의 provider 가드가 `incoming.provider` falsy 분기를 테스트하지 않음(HTTP 경로에서는 도달 불가하나 서비스 직접 호출 방어로서는 미검증) | `triggers.service.ts:728` | 우선순위 낮음 |
| 10 | 문서화 | spec `§5.4.1` 의 `details.field` placeholder("미확정")가 이번 PR 실측값으로 아직 갱신 안 됨 — developer 권한 밖, planner 후속으로 이미 3개 산출물이 일관되게 위임 처리 | `spec/5-system/15-chat-channel.md:375` | planner 턴에서 확정 (WARNING #3 실측 보완과 함께) |
| 11 | 범위(scope) | 이전 라운드 산출물(`review/code/.../23_21_57/api_contract.md`)이 컨트롤러 미변경이라 적었으나 최종 diff엔 컨트롤러 Swagger 문구 변경이 포함됨 — 리뷰 워크플로 스냅숏 시차, 코드 스코프 위반 아님 | `review/code/2026/09/10/23_21_57/api_contract.md` | 조치 불요(정보성) |
| 12 | 부작용 | PATCH `/api/triggers/:id` 계약이 3방향 breaking(비밀필드 거부/최초설정 거부/provider전환 거부) — 의도된 보안 수정이며 유일한 프런트 소비자(`ChatChannelCard`) 영향 없음을 직접 소스로 확인 | `update-trigger.dto.ts`, `chat-channel-config.dto.ts`, `triggers.service.ts` | 배포 노트 반영 권고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | R-CC-10 우회·inboundSigningRef fail-open 두 CRITICAL 모두 실제로 닫혔음을 소스로 검증. 잔여는 스코프 밖 사전 결함(botToken minLength) |
| performance | NONE | 신규 DB/외부 호출 없음, 오히려 PATCH 경로 I/O 감소 |
| architecture | LOW | mode 판별자 미상관(WARNING), 유니온 타입 위치·JSONB 캐스팅 산재(INFO) |
| requirement | LOW | CRITICAL/WARNING 5건 조치 확인. details.field flat/nested 갈림 미포착(WARNING) |
| scope | NONE | 변경 범위 전부 plan 목적에 부합, spec 미변경, 스냅숏 시차만 INFO |
| side_effect | LOW | PATCH 계약 3방향 breaking(의도됨, 소비자 영향 없음 확인) |
| maintainability | LOW | setupChatChannel 비대화(WARNING), 나머지는 개선·해소 확인 |
| testing | LOW | 179/180 GREEN 재실행 확인. null 대칭 결여(WARNING), e2e 배선 갭(INFO) |
| documentation | NONE | 이전 라운드 문서 결함 3건 전부 해소 확인, 신규 CRITICAL/WARNING 없음 |
| dependency | NONE | 신규 의존성 없음, 기존 export 재사용뿐 |
| database | NONE | 스키마/마이그레이션 변경 없음, 기존 비원자적 2단계 커밋·TOCTOU는 기존 설계(INFO) |
| concurrency | MEDIUM | 트리거 config 낙관적 잠금 부재로 동시 PATCH 레이스가 CRITICAL(fail-open)을 재발시킬 수 있음(WARNING) |
| api_contract | LOW | 이전 WARNING(Swagger 미반영) 해소 확인. writeOnly 마커 오신호(INFO) |
| user_guide_sync | WARNING | user-guide 4개 문서(ko/en)가 실제 필드명·details.field 형식과 불일치, slack/discord 문서에 회전 안내 부재 |

## 발견 없는 에이전트

performance, scope, documentation, dependency, database — 모두 확인된 사항은 있으나 차단급 발견 없음(NONE 등급).

## 권장 조치사항

1. **[동시성 WARNING #1]** 트리거 config 갱신 경로(`update()`/`setupChatChannel()`/`rotateChatChannelBotToken()`)에 advisory lock 또는 낙관적 버전 체크를 도입해, 이번 PR 이 닫은 fail-open CRITICAL 이 동시 PATCH 레이스로 재발하지 않도록 한다. 최소한 인터리빙 재현 회귀 테스트를 추가하고 후속 턴에 명시 등재.
2. **[user_guide_sync WARNING #2]** `telegram.mdx`/`triggers.mdx`(ko/en)의 `botTokenRef`/flat `details.field` 오기를 이번 PR 실측값(`botToken`/nested `chatChannel.botToken`)으로 정정하고, slack/discord(ko/en) 문서에 Signing Secret/Public Key PATCH 차단·회전 안내 절을 신설한다 — `codebase/frontend/**` 는 developer 권한 내이므로 같은 PR 에서 처리 가능.
3. **[requirement/api_contract WARNING #3]** `[실측]` 테스트에 `null`/`''` 케이스를 추가해 `details.field` flat/nested 갈림의 완전한 표를 만들고, 그 위에서 planner 턴이 spec `§5.4.1` placeholder 를 확정하도록 한다.
4. **[architecture WARNING #4]** `assertChatChannelInputSafe` 를 함수 오버로드로 재선언해 `mode` 값과 DTO 타입의 상관관계를 컴파일 타임에 강제한다.
5. **[testing WARNING #5]** `inboundSigningPlaintext` 에도 `null` 케이스를 추가해 `botToken` 과 테스트 대칭을 맞춘다.
6. **[maintainability WARNING #6]** 당장 불요 — 다음 `setupChatChannel` 수정 시 secret 쓰기 게이팅 로직을 별도 헬퍼로 분리하는 것을 고려.

## 라우터 결정

- `routing_status=skipped` — 라우터 호출이 생략되고 **전체 14개 reviewer 가 실행**됨(routing=skipped 로 명시 수신).
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success + 전문 확보)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보 완료**, 누락 없음(강제 화이트리스트 미이행에 따른 거짓 음성 위험 없음)
