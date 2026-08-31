# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `WorkflowAssistantController` 7개 라우트에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 를 신규 부착 — 하위 호환 유지되는 순수 additive 문서화 개선
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:59,79,97,111,125,141,164`
  - 상세: 클래스 레벨에 `@ApiBearerAuth('access-token')` (파일 42번째 줄)이 이미 걸려 있어 전 라우트가 인증을 요구하는데, 그동안 401 OpenAPI 문서가 0건이었다(`swagger.md §2-4` 위반). 이번 diff 는 그 갭을 컨트롤러 시그니처·실제 가드 동작 변경 없이 스키마 문서만 보강했다 — 응답 바디·상태 코드·URL·인가 로직에 아무 영향이 없어 breaking change 가 아니다. 배치 순서(401 → 403, status 오름차순)도 저장소 선례(`nodes.controller.ts`)와 일치한다.
  - 회귀 테스트: `workflow-assistant.controller.swagger.spec.ts` (신규) 가 `buildSwaggerDocument` 프로브로 라우트 7개 전수와 401 description 문구를 고정한다. 실행 확인: `npx jest workflow-assistant.controller.swagger.spec.ts` → `Tests: 2 passed, 2 total`(로컬 재현). `shared/testing/swagger-probe.ts` import 경로(`../../shared/testing/swagger-probe`)도 실제 파일 위치와 일치함을 확인했다.
  - 제안: 없음 — 조치 불요, 정상 개선.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` §8.2 의 HMAC 알고리즘 화이트리스트 문구가 `hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512` 두 값으로 정정됨
  - 위치: `spec/5-system/14-external-interaction-api.md:948-950` (diff 게이트 기준)
  - 상세: 코드 변경이 아니라 **이미 구현된 동작을 반영하지 못했던 spec 문구를 실측대로 정정**한 것이다. `notification-signature.util.ts`(`SupportedHmacAlgorithm = 'hmac-sha256' | 'hmac-sha512'`)·`notification-config.dto.ts`(`@IsIn(['hmac-sha256','hmac-sha512'])`)가 이미 두 알고리즘을 화이트리스트하고 있으므로, 이번 diff 로 실제 outbound webhook 서명 검증 범위가 넓어지거나 좁아지지 않는다. 클라이언트 영향 없음.
  - 제안: 없음.

- **[INFO]** `codebase/backend/src/modules/chat-channel/{chat-channel.dispatcher.ts, chat-channel.dispatcher.spec.ts, types.ts}` 의 변경은 주석/JSDoc 안 SoT 인용에서 썩은 줄 번호(`line 536`, `line 89`)만 제거하고 §번호·앵커는 그대로 둔 것으로, `EiaAiMessageEvent.presentations` 필드의 타입·추출 로직·API 응답 바디에는 아무 변화가 없다.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:375-378`
  - 상세: API 계약(요청/응답 스키마, 검증 로직)에 영향 없음.

- **[INFO]** `spec/5-system/6-websocket-protocol.md`(§4.3~§4.7 재번호)·`spec/5-system/14-external-interaction-api.md:1125`·`spec/data-flow/8-notifications.md` 의 변경은 인용이 0건이던 §4.3(KB 문서 이벤트)을 앞으로 옮기고 뒤따르는 절(알림/시스템/외부 표면 매핑)의 절 번호만 순연시킨 것이다. 이벤트 이름·채널 키·payload 필드·엔드포인트 경로는 모두 동일하게 유지된다 — WebSocket/REST 계약 자체의 변경이 아니라 문서 내부 참조 번호 정합화다.
  - 위치: 해당 없음(문서 재번호 전수)
  - 상세: 크로스 링크 96건을 전수 대조했다는 plan 기록(`spec-sync-external-interaction-api-gaps.md`)과 대조해도 실 API 계약 변화는 없다.

- **[INFO]** `plan/**` 하위 다수 파일(`cafe24-backlog-residual.md`, `node-output-redesign/README.md`, `spec-draft-eia-notification-payload-contract.md`, `spec-sync-*-gaps.md` 등)은 전부 진행 중 조사·의사결정 기록(markdown)이며 런타임 API 표면에 영향을 주는 코드 변경을 포함하지 않는다. API 계약 관점에서 검토 대상 밖.

## 요약

이번 변경분에서 실제 API 표면(엔드포인트 코드)에 손을 댄 것은 `WorkflowAssistantController` 의 `@ApiUnauthorizedResponse` 7건 추가뿐이며, 이는 이미 인증이 강제되던 라우트의 OpenAPI 문서 누락(`swagger.md §2-4` 위반)을 메우는 순수 additive 변경으로 하위 호환성·응답 스키마·에러 코드·URL 설계·인가 로직 어느 것도 깨지 않는다. 신규 회귀 테스트(`workflow-assistant.controller.swagger.spec.ts`)가 라우트 수·description 문구를 고정하며 로컬 재실행으로 통과를 확인했다. 나머지 변경(consistency-checker 하니스, chat-channel 주석 정리, spec 문서 절번호 재정렬·HMAC 화이트리스트 문구 정정, plan 트래커 갱신)은 API 계약과 무관하거나 코드 없이 문서만 실측에 맞춘 것이라 계약 위험이 없다.

## 위험도

NONE
