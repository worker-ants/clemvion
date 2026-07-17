# API 계약(API Contract) 리뷰

## 검토 범위 확인

이번 diff 의 실제 코드 변경은 3개 파일뿐이며, 나머지(파일 4~16)는 이전 리뷰 세션(`review/code/2026/07/17/01_42_44/`)의 산출물(RESOLUTION.md, SUMMARY.md, `_retry_state.json`, 각 checker `.md`)로 리뷰 프로세스 기록일 뿐 실행 코드가 아니다.

1. `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` — 테스트 파일. `WebAuthnController.webauthnList` 의 응답 envelope(`{ data: { items: [] } }`)을 신규로 pin 하는 테스트 2건 추가. 컨트롤러 자체(`webauthn.controller.ts`)나 DTO(`webauthn-response.dto.ts`)는 이번 diff 에 포함되지 않음 — 이전 세션에서 이미 구현·병합된 API 응답 shape 를 사후에 회귀 테스트로 고정하는 것뿐이다.
2. `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 프런트 위젯 훅 테스트 파일. 신규 엔드포인트 호출 없음, 기존 `GET /api/external/executions/:id`(EIA status 조회) mock 을 재사용.
3. `codebase/channel-web-chat/src/widget/use-widget.ts` — EIA(External Interaction API) 클라이언트를 소비하는 프런트 훅. `client.getStatus()` 응답의 기존 `status.status` 필드(EIA 스펙에 이미 정의된 enum: `completed`/`failed`/`cancelled` 등)가 terminal 값일 때 클라이언트 로컬 상태를 정리(`ENDED` 전이 + `conversationEnded` host 이벤트)하는 분기를 추가. 신규 API 호출·신규 요청 파라미터·신규 응답 필드가 전혀 없다 — 이미 서버가 내려주던 필드를 그동안 처리하지 않던 것을 처리하도록 프런트 로직만 보강한 것.

## 발견사항

이번 diff 범위 안에서 API 계약(엔드포인트 추가/변경, 요청·응답 스키마, 버전, 인증/인가, 페이지네이션, 에러 응답 포맷) 에 실질적 영향을 주는 변경은 없다.

- **[INFO]** `GET /auth/2fa/webauthn/credentials`(`webauthnList`) 응답 envelope 회귀 테스트 추가는 API 계약 관리 관점에서 긍정적
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` (신규 `describe('webauthnList', ...)`)
  - 상세: `{ data: { items: [] } }` shape 를 정상 케이스·빈 배열 케이스 양쪽에서 pin 하여, 향후 리팩터링이 응답 shape 를 bare array 등으로 축소(breaking change)하는 것을 자동 감지하게 한다. `SessionsController.listSessions` 와 동일 패턴이라 두 리소스 간 응답 포맷 일관성도 함께 보호된다. 단, 이 diff 는 컨트롤러 구현 자체를 변경하지 않으므로 계약 자체는 이번 변경으로 인해 달라지지 않는다.
  - 제안: 조치 불필요. 참고로 이 엔드포인트는 목록 API 이나 페이지네이션 파라미터가 없는데, 이는 이번 diff 범위 밖(기존 구현)이라 별도 이슈로 트래킹할 사안이며 이번 변경에 대한 지적은 아니다.
- **[INFO]** `use-widget.ts` 의 terminal 상태 처리 추가는 API 계약이 아니라 클라이언트 소비 로직 버그 픽스
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`seedWaitingFromStatus`)
  - 상세: EIA status 조회 응답의 `status` 필드는 기존에 이미 `completed`/`failed`/`cancelled` 등 terminal 값을 낼 수 있었고(EIA 스펙 기존 enum), 이번 변경은 그 값을 프런트가 처리하지 않던 gap 을 메운 것이다. 서버가 내려주는 응답 스키마·HTTP 상태 코드·엔드포인트 경로는 전혀 바뀌지 않았다.
  - 제안: 조치 불필요.

## 요약

이번 diff 는 (1) 기존에 이미 구현·병합된 webauthn credential 목록 응답 shape 를 사후에 pin 하는 테스트 추가, (2) 기존 EIA status 응답 필드를 프런트에서 처리하지 않던 gap 을 메우는 클라이언트 로직 보강, (3) 이전 리뷰 세션의 기록 문서로 구성되며, 신규/변경 엔드포인트, 요청·응답 스키마 변경, 버전 관리 이슈, 인증/인가 변경, 에러 응답 포맷 변경이 전혀 없다. 직전 리뷰 라운드(01_42_44)에서도 동일 이유로 api_contract reviewer 가 라우터에 의해 제외됐던 것과 결이 같다. API 계약 관점에서 위험 요소 없음.

## 위험도

NONE
