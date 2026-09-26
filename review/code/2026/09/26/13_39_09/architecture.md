# 아키텍처 리뷰 — success-advert (11개 엔드포인트 성공 응답 스키마 광고 + 가드 강화)

## 발견사항

- **[WARNING]** `judgeHandler` 가 세 가지 독립적 분류 축(위반/`unresolved`/`unadvertised`)을 한 함수 안에서 같이 계산하도록 확장됐다 — SRP 압박 증가
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:214` (`judgeHandler` 함수, 반환 인터페이스는 `:219-224`)
  - 상세: 이 PR 이전에도 `judgeHandler` 는 `violation`/`unresolved`/`checked` 세 개를 한 함수에서 계산했는데, 이번 변경은 네 번째 축(`unadvertised`, `redirectAdvertised`)을 같은 루프·같은 상태 변수 집합에 추가했다. 데코레이터 순회 하나에서 "실제 코드를 알아내기", "광고 집합 모으기", "리다이렉트인지 구분하기", "위반 여부 판정" 이 전부 얽혀 있어, 다음에 새 분류 축(예: 4xx 광고 누락 검사)을 추가하려는 사람은 함수 전체의 상태 흐름을 다시 읽어야 한다. 테스트 커버리지가 넓어 회귀는 거의 안 잡히겠지만, 변경 비용은 축이 늘 때마다 커진다.
  - 제안: 데코레이터 순회를 "분류만 하는" 순수 함수(예: `classifyDecorators(method, sf, statuses) -> { verb, httpCode, excluded, advertised, redirectAdvertised, unresolved }`)로 분리하고, `judgeHandler` 는 그 결과를 받아 `violation`/`unadvertised`/`checked` 를 각각 독립적으로 파생시키는 순수 함수들로 나누면 새 축 추가 시 기존 로직을 건드리지 않아도 된다.

- **[INFO]** `advertised-response-contract.e2e-spec.ts` 가 서로 무관한 두 도메인(WebAuthn·Trigger secret rotation)을 하나의 스펙 파일에 모았다 — 기존 "도메인별 e2e 파일" 관례에서 벗어난 조직
  - 위치: `codebase/backend/test/advertised-response-contract.e2e-spec.ts` (describe 블록 전체)
  - 상세: 저장소의 다른 e2e 파일들(`workflow-assistant.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`)은 도메인(리소스) 단위로 조직돼 있는데, 이 파일은 "이번 PR 이 새로 광고한 것 중 다른 e2e 가 이미 커버하지 않는 잔여 두 라우트" 라는 PR-scoped 기준으로 조직됐다. 파일 헤더 주석에 그 이유가 명시돼 있어 당장 혼란은 적지만, 시간이 지나 다음 사람이 "WebAuthn availability e2e 는 어디 있지?" 라고 찾을 때 `webauthn` 이 아니라 `advertised-response-contract` 를 뒤져야 한다 — 도메인 경계가 파일 경계와 어긋난다.
  - 제안: 당장 급하지 않다면 두 테스트를 각 도메인 e2e 파일(`webauthn`, `triggers` 계열)로 옮기고 이 파일은 폐기하는 편이 장기적으로 탐색성이 낫다. 지금 구조를 유지한다면 최소한 plan 문서에 "이 파일은 임시 카탈로그이며 후속 통합 대상" 임을 남겨 둘 것.

- **[INFO]** 응답 DTO 파일이 서로 다른 두 하위 액션(알림 secret 회전 / interaction token 재발급)의 DTO 를 한 파일에 묶었다
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts` (`NotificationRotateSecretDto`, `InteractionRevokeTokenDto`)
  - 상세: 두 DTO 는 각각 `POST .../notification/rotate-secret` 과 `POST .../interaction/revoke-token` 이라는 서로 다른 하위자원의 응답이다. 파일명 `trigger-secret-issue-response`(단수)가 실제로는 "trigger 가 갖는 두 종류의 secret 발급 응답"을 가리키는 복수 개념이라 이름과 내용이 살짝 어긋난다. 다만 저장소의 기존 관례(`webauthn-response.dto.ts` 도 여러 무관한 응답 DTO를 한 파일에 묶음)와 일관되므로 새 안티패턴은 아니다.
  - 제안: 굳이 지금 쪼갤 필요는 없음 — 다만 세 번째 secret 발급 DTO 가 추가되면 파일을 `trigger-secrets/` 하위로 나누는 것을 고려.

## 요약

이번 변경은 성공 응답을 광고하지 않던 11개 라우트에 `@ApiOkWrappedResponse` 계열 데코레이터·응답 DTO를 붙이고, 이를 강제하는 정적 가드(`http-status-advertised-guard.ts`)에 "성공 응답을 하나도 광고하지 않는 라우트" 판정 축을 추가한 순수 부가(additive) 변경이다. `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse` 신설은 기존 `wrapDataSchema`/`ApiOkWrappedResponse` 를 수정하지 않고 새 함수로 확장했다는 점에서 개방-폐쇄 원칙을 잘 지켰고, DTO는 프레젠테이션(Swagger 문서) 레이어에만 존재하며 서비스·엔티티 레이어를 침범하지 않는다. 순환 의존이나 레이어 경계 위반은 발견되지 않았다. 유일하게 주목할 점은 가드 함수(`judgeHandler`)가 이번 확장으로 한 함수 안에 판정 축이 넷으로 늘어나 SRP 압박이 누적되고 있다는 것과, 신규 e2e 파일이 도메인이 아닌 PR 단위로 조직돼 기존 관례와 결이 다르다는 것인데, 둘 다 구조적 위험이라기보다 유지보수성 관찰에 가깝다.

## 위험도

LOW
