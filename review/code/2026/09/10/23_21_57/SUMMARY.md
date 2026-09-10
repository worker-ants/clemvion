# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — Slack/Discord `chatChannel` 을 PATCH 로 편집(카드 저장 등, 비밀 필드 미포함)하면 `inboundSigningRef` 가 config 에서 통째로 사라져 이후 인입 웹훅 서명 검증이 **fail-open 으로 영구 스킵**된다. 이 결함은 forced whitelist(router_safety) 대상인 `security`·`requirement`·`side_effect` 세 reviewer 가 **독립적으로**, 그중 `requirement` 는 뮤테이션 프로브 실측까지 동원해 확인했다 — forced 전원 결과는 확보돼 누락 없이 이 CRITICAL 이 정상적으로 드러난 케이스다. 병합 전 필수 수정.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | Slack/Discord `chatChannel` PATCH 편집 시 `inboundSigningRef` 가 병합 config 에서 완전히 빠져 저장된다. `botTokenRef` 는 `buildSecretRef(trigger.id)` 로 매 호출 재유도돼 무조건 보존되지만, `inboundSigningRef` 는 "이번 호출에서 실제로 값을 새로 썼을 때만"(`providerIssuedStored`/`result.issuedInboundSigning`) 포함되도록 짜여 있다. D-1(PATCH 에서 `inboundSigningPlaintext` 차단)+D-2(`storeUserSuppliedSecrets:false`) 적용 후 slack/discord PATCH 경로에서는 이 조건이 **구조적으로 항상 거짓**이 된다. `ChatChannelInboundAuthenticator` 는 `inboundSigningRef` 부재를 "legacy — 검증 skip" 으로 처리하므로, 카드 편집 PATCH 한 번(이 PR 이 고치려던 바로 그 시나리오)만 성공해도 그 트리거의 인입 Slack/Discord 웹훅은 서명 없이 통과한다. `security`/`side_effect` 가 로직 재현으로, `requirement` 가 실제 테스트에 임시 로깅을 추가한 뮤테이션 프로브로(종료 후 원복 확인) 이를 실측 확인했다 — PATCH 후 저장되는 `chatChannel` 에 `inboundSigningRef` 키 자체가 없음. 신규 테스트는 `secrets.rotate` 미호출만 단언하고 최종 persisted config 의 `inboundSigningRef` 존재는 단언하지 않아 이 회귀를 못 잡는다. | `codebase/backend/src/modules/triggers/triggers.service.ts` `setupChatChannel()` — `internalCfg` 조립(~1104-1108), `mergedChannel` 조립(~1132-1139), 실패 catch 의 `fallbackConfig`(~1169-1173); 근본 원인 게이팅 `providerIssuedPlaintext`(~1084-1086); 소비측 `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts:64,93,129`; 무조건 호출 지점 `codebase/backend/src/modules/hooks/hooks.service.ts:291-296` | `inboundSigningRef` 도 `botTokenRef` 와 동일한 패턴으로 처리 — "새로 쓴 값 → 없으면 기존 `trigger.config.chatChannel.inboundSigningRef` 보존" 순으로 결정하거나 무조건 포함. `setupChannel` 실패 catch 블록(`fallbackConfig`)도 동일 수정 필요. "slack/discord PATCH 편집 후 `inboundSigningRef` 가 보존된다" 회귀 테스트를 `botTokenRef` D-3 테스트와 대칭으로 추가 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | 보안 | `assertChatChannelAlreadySetUp` 이 `config.chatChannel?.provider` 존재 여부만 확인하고, PATCH 로 들어온 provider 가 **기존과 같은지는 비교하지 않는다** — telegram 트리거에 `{provider:'slack', ...}` PATCH 를 보내도 통과해, telegram 용으로 재유도된 `botTokenRef` 를 slack adapter 에 그대로 넘기게 된다. CRITICAL #1 과 결합하면 provider 전환 직후 `inboundSigningRef` 없는 상태로 저장돼 fail-open 에 더 빨리 도달 | `codebase/backend/src/modules/triggers/triggers.service.ts` `assertChatChannelAlreadySetUp` (~696-706) | `assertChatChannelSameProvider` 로 확장(PATCH provider ≠ 기존 provider 면 400)하거나, 최소한 이 케이스가 의도된 동작인지 확인하는 테스트 추가 |
| 3 | 테스트 | `botToken`/`inboundSigningPlaintext` 에 **명시적 `null`/빈 문자열**을 실은 PATCH 가 어느 계층에서도 테스트되지 않는다. `@IsEmpty()` 는 `null`/`''` 를 통과시키므로 서비스 레이어 `assertPatchCarriesNoSecrets`(`typeof x !== 'undefined'`)가 실제 방어선인데, 신규 테스트는 전부 비어있지 않은 값만 입력으로 써서 이 방어선 자체가 실측되지 않았다 | `codebase/backend/src/modules/triggers/triggers.service.ts` `assertPatchCarriesNoSecrets` (669-687); `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (372-403) | `botToken: null` / `botToken: ''` 변형을 최소 1개씩 추가해 서비스 레이어가 실제로 잡는지 직접 고정 |
| 4 | 문서화 | `assertChatChannelInputSafe` 최상단 JSDoc 이 이번에 추가된 `mode` 매개변수/분기를 반영하지 못해 "slack: 필수 / discord: 필수" 서술이 남아 있다. 실제로는 `mode==='update'` 에서 이 필드들이 **완전히 금지**로 뒤집혔다(필수→금지, 정반대) | `codebase/backend/src/modules/triggers/triggers.service.ts` 함수 JSDoc(~601-617), 함수 시그니처(~618-621) | JSDoc 에 "`mode==='update'` 일 때는 이 절이 적용되지 않고 두 필드가 무조건 금지된다" 한 줄 추가 |
| 5 | API 계약 | PATCH `/api/triggers/:id` 컨트롤러 레벨 `@ApiBadRequestResponse` 설명이 이번에 신설된 두 400 사유(비밀 필드 포함 시, 미설정 트리거에 최초 `chatChannel` PATCH 시)를 반영하지 않는다. 필드 레벨 `@ApiPropertyOptional` 설명에는 있어 OpenAPI 스키마 자체는 정보를 담지만 엔드포인트 요약만 보면 놓치기 쉽다 | `codebase/backend/src/modules/triggers/triggers.controller.ts:110-123` (이번 diff 미포함 파일) | `@ApiBadRequestResponse` 설명에 두 신규 400 사유(필드명·`details.field` 값) 추가 |
| 6 | 유지보수성 / 스코프 | 신규 `type ChatChannelInput`/`ChatChannelInputMode` 선언 2개(JSDoc 포함 ~24줄)가 import 블록 한가운데 끼어들어 import 목록이 두 조각으로 쪼개진다(동작·lint 영향 없음, 가독성 저하) | `codebase/backend/src/modules/triggers/triggers.service.ts:33-63` | 두 `type` 선언을 전체 import 블록 뒤로 이동 |
| 7 | API 계약 (SPEC-DRIFT, 비차단·추적중) | spec `§5.4.1`/`R-CC-21` 산문("PATCH 는 어떤 비밀도 쓰지 않는다")이 telegram server-issued inbound-signing 재저장 예외를 포괄하지 못해 구현보다 좁다. 코드 자체는 옳게 구현됐고(telegram 축은 의도적으로 게이팅 대상 제외), 이 세션의 `/consistency-check`(`review/consistency/2026/09/10/21_37_56/`)가 이미 CRITICAL/BLOCK:YES 로 잡아 developer plan 이 자기-반증형 소정정 조건 미충족(API 계약 서술이라 developer 권한 밖)으로 planner 턴에 명시 위임함 | `spec/5-system/15-chat-channel.md` §5.4.1 / `R-CC-21`; 구현 `triggers.service.ts:1110-1124` | 이 PR 은 비차단. planner 턴에서 §5.4.1/R-CC-21/§1.3(data-flow) 에 telegram carve-out 명시 (이미 plan 체크리스트에 등재됨) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 8 | 유지보수성 | `update()` 가 이미 115줄대인데 이번 diff 가 분기(`assertChatChannelAlreadySetUp` 호출) 하나를 더 얹었다. diff 단독 결함은 아니고 누적 추세 | `triggers.service.ts` `update()` (484-598, 신규 조건 519-521) | 다음 변경 시 단계 함수로 추가 분리 고려 |
| 9 | 유지보수성 | `assertChatChannelInputSafe` 가 이미 캐스팅한 `blocked` 를 넘기지 않고 원본 `chatChannel` 을 `assertPatchCarriesNoSecrets` 에 다시 넘겨 동일한 `unknown` 캐스팅이 반복된다 | `triggers.service.ts:623`, `:670` | 캐스팅 공유(시그니처 조정), 우선순위 낮음 |
| 10 | 유지보수성 | DTO `@IsEmpty()` 메시지와 서비스 `assertPatchCarriesNoSecrets` 메시지가 문자 그대로 중복 — 다만 기존 `botTokenRef` 패턴을 그대로 따른 것(이 diff 신규 문제 아님) | `chat-channel-config.dto.ts:384-401`, `triggers.service.ts:671-686` | 이 PR 범위 밖. 향후 공유 상수 모듈 검토 |
| 11 | 유지보수성 | 테스트 fixture `cardBody` 헬퍼가 두 spec 파일에 문자 그대로 중복 정의 | `trigger-dto-validation.spec.ts:785`, `triggers.service.spec.ts:3000` | 공유 테스트 헬퍼로 추출 검토(비긴급) |
| 12 | 테스트 | `provider` 는 있지만 `botTokenRef` 가 비어 있는 "부분 setup(degraded)" 트리거에 대한 PATCH 복구 경계가 테스트로 고정돼 있지 않음 | `triggers.service.ts` `assertChatChannelAlreadySetUp`(689-706) | 경계 케이스 기대 동작을 테스트로 문서화 검토(비긴급) |
| 13 | 문서화 | 신설 에러 메시지 하나가 한 문장 안에서 해요체/합쇼체를 혼용, 같은 diff 의 형제 메시지들과도 어투가 어긋남 | `triggers.service.ts:703` | 문장 내 어투 통일 |
| 14 | 문서화 | `plan/in-progress/impl-chat-channel-patch-token.md` `## 설계` 절의 D-2 코드 줄 번호 인용이 같은 PR 구현으로 이미 stale (코드 자체는 `[쓰기 ①/②/③]` 앵커 주석으로 자가교정 완료) | plan md `## 설계` D-2 표 | 줄 번호 대신 코드가 채택한 앵커 표기로 교체 |
| 15 | API 계약 | PATCH 가 이제 `botToken`/`inboundSigningPlaintext` 를 실으면 항상 400 — 의도된 breaking change(R-CC-10 우회 차단). 유일하게 알려진 소비자(`ChatChannelCard`)는 영향 없음 | `chat-channel-config.dto.ts:372-403`, `update-trigger.dto.ts:100-109` | 릴리스 노트에 계약 변경 기록 권장 |
| 16 | API 계약 | 미설정 트리거에 PATCH 로 최초 `chatChannel` 설정 시도 시 이제 명시적 400 (종전엔 `chatChannelHealth=degraded` 로 조용히 200) — 개선 방향, 조치 불요 | `triggers.service.ts:696-706`, `:509-521` | 없음(관측 가능성 개선) |
| 17 | API 계약 | 에러 `details.field` 가 중첩 경로(`chatChannel.<field>`)로 나가 spec 의 flat 표기(`botTokenRef` 등)와 다름 — 이미 developer plan 이 planner 후속으로 등재 | `trigger-dto-validation.spec.ts:827-849` (실측) | planner 턴에서 spec 표기 정정(이미 계획됨) |
| 18 | 절차 (발견사항 아님) | 리뷰 진행 중 `plan/in-progress/impl-chat-channel-patch-token.md` 가 본 리뷰 세션 외부(병렬 프로세스)에 의해 TEST WORKFLOW/타입체크 ratchet 체크박스가 갱신되는 것이 `documentation`/`testing` reviewer 양쪽에서 관측됨. 각 reviewer 는 원복 시도 없이 그대로 기록만 남김(자신이 만든 변경 아님을 `git status --short` 로 확인) | plan md | 통합 SUMMARY 확정 전 해당 파일의 최신 diff 재확인 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | `inboundSigningRef` 소실로 슬랙/디스코드 인바운드 서명검증 fail-open(#1); provider 미검증(#2, WARNING) |
| requirement | CRITICAL | 동일 CRITICAL(#1)을 뮤테이션 프로브 실측으로 재확인; D-1/D-2 나머지 요구사항 정합 확인 |
| side_effect | CRITICAL | 동일 CRITICAL(#1) — "이 PR 이 처음으로 열어젖힌 경로"로 서술; 그 외 의도된 breaking change 는 정상 |
| scope | LOW | 스코프 위반 없음(spec/ 미접촉, 넓어 보이는 테스트 리팩터링도 DTO 계약 변경의 필연적 파생); import 배치(#6, INFO 수준) |
| maintainability | LOW | import 블록 분단(#6, WARNING) + 함수 비대화·캐스팅/메시지/fixture 중복(#8-11, INFO) |
| testing | LOW | null/빈문자열 미검증(#3, WARNING); degraded 복구 경로 미검증(#12, INFO); 실측 171/172 GREEN, 타입체크 ratchet baseline 일치 |
| documentation | LOW | JSDoc mode 미반영(#4, WARNING); 어투 혼용·plan 줄번호 stale(#13-14, INFO); 핵심 신규 코드 문서화 수준은 높음 |
| api_contract | LOW | Swagger 400 사유 미문서화(#5, WARNING); spec R-CC-21 갭 추적중·비차단(#7, WARNING); 나머지 breaking change 는 의도됨(#15-17, INFO) |

## 발견 없는 에이전트

없음 — 실행된 8개 에이전트 전원이 최소 INFO 이상의 발견사항을 보고했다.

## 권장 조치사항

1. **(최우선, 병합 차단)** `setupChatChannel()` 에서 `inboundSigningRef` 를 `botTokenRef` 와 동일하게 "새로 쓴 값 → 없으면 기존 config 값 보존" 순으로 처리하도록 수정하고, `internalCfg`/`mergedChannel`/실패 catch 의 `fallbackConfig` 세 지점 모두 반영. slack/discord PATCH 편집 후 `inboundSigningRef` 보존을 단언하는 회귀 테스트를 `botTokenRef` D-3 테스트와 대칭으로 추가한다.
2. `assertChatChannelAlreadySetUp` 에 provider 일치 검사를 추가하거나(WARNING #2), 최소한 provider 전환 PATCH 의 기대 동작을 테스트로 명시한다.
3. `assertPatchCarriesNoSecrets` 의 `null`/빈 문자열 방어를 직접 시험하는 테스트를 추가한다(WARNING #3).
4. `assertChatChannelInputSafe` JSDoc 을 `mode` 분기에 맞게 갱신하고(WARNING #4), PATCH 엔드포인트 Swagger `@ApiBadRequestResponse` 에 신규 400 사유 2건을 추가한다(WARNING #5).
5. `type ChatChannelInput`/`ChatChannelInputMode` 선언을 import 블록 뒤로 옮긴다(WARNING #6, 사소).
6. spec `§5.4.1`/`R-CC-21` telegram carve-out 명시는 이미 planner 턴으로 위임돼 있으므로 그대로 진행한다(WARNING #7, 이 PR 비차단).
7. 나머지 INFO 항목(#8-17)은 비긴급 — 다음 관련 변경 시 함께 정리 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — **forced 전원 결과 확보됨**(prompt 자체가 명시). 이번 CRITICAL(#1)을 발견한 3개 reviewer(`security`/`requirement`/`side_effect`)가 모두 이 강제 목록에 포함돼 있어, router 가 자동 제외했다면 놓쳤을 결함이 안전망을 통해 정상적으로 드러났다.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 선별 결과, 개별 사유는 prompt 에 미제공 |
  | architecture | router 선별 결과, 개별 사유는 prompt 에 미제공 |
  | dependency | router 선별 결과, 개별 사유는 prompt 에 미제공 |
  | database | router 선별 결과, 개별 사유는 prompt 에 미제공 |
  | concurrency | router 선별 결과, 개별 사유는 prompt 에 미제공 |
  | user_guide_sync | router 선별 결과, 개별 사유는 prompt 에 미제공 |
