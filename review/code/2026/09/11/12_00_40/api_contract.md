# API 계약(API Contract) 리뷰

## 검증 방법

`git log --oneline origin/main..HEAD` 로 3개 커밋(`0710021f0`·`0fb691248`·`2d0270fbd`)을 확인하고,
`git diff origin/main..HEAD -- codebase/ CHANGELOG.md` 로 누적 diff 를 직접 대조했다(프롬프트가
`triggers.service.ts`/`triggers.service.spec.ts` 전체 diff 를 크기 제한으로 생략해, 두 파일은
`Read`/`grep` 으로 저장소 최종 상태를 직접 열어 확인했다). 이전 두 라운드
(`review/code/2026/09/11/11_05_27`, `11_33_35`)의 `api_contract.md`가 이미 낸 결론(LOW, INFO 다수)을
재현하되, 두 라운드 모두 놓친 지점이 있는지 `details[].code`/`details.code` 신규 배선 15자리
전수를 `grep -rn "code: 'INVALID_FIELD'\|code: ErrorCode.INVALID_FIELD"`로 다시 훑어 top-level
`code`와의 조합을 하나씩 대조했다. 저장소 파일은 뮤테이션하지 않았다(`git status --short`에
이 리뷰가 만든 변경 없음 — 유일한 untracked 항목은 이 라운드의 출력 디렉터리 자신).

## 발견사항

- **[WARNING]** `authConfigId` 거부 응답이 도메인 특화 top-level `code`(`AUTH_CONFIG_NOT_FOUND`)와 generic `details.code`(`INVALID_FIELD`)를 함께 실어, 이 PR이 스스로 규약화·적용한 「둘을 겹쳐 쓰지 않는다」 원칙과 어긋난다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1009-1011`(`throw new BadRequestException({ code: 'AUTH_CONFIG_NOT_FOUND', ..., details: { field: 'authConfigId', code: ErrorCode.INVALID_FIELD } })`)
  - 상세: `spec/5-system/2-api-convention.md` §5.3의 "도메인 세부 사유를 어디에 싣는가" 표는 두 갈래를 **택일**로 규정한다 — (a) 사유가 엔드포인트 결과 그 자체면 **top-level `code`를 특화 코드로 교체**하거나, (b) top-level은 상태 기본값을 유지하고 **`details[].code`에 도메인 사유를 싣는다. 이 표 바로 아래 줄이 "둘을 겹쳐 쓰지 않는다 — top-level을 특화 코드로 바꾸면서 같은 사유를 details[].code 에도 넣으면 소비자가 어느 쪽으로 분기할지 갈린다"고 명시한다. 이번 PR이 같은 파일에서 다루는 다른 12곳(`triggers.service.ts`)과 2곳(`password.util.ts`)은 전부 top-level이 상태 기본값(`VALIDATION_ERROR`)이라 (b) 갈래에 정확히 들어맞고, `rethrowEndpointPathConflict`(`:1833-1852`, top-level `RESOURCE_CONFLICT`=409 기본값 + `details.code: 'TRIGGER_ENDPOINT_PATH_CONFLICT'`)도 (b) 갈래를 정확히 따른다 — 세 자리 리뷰(11_05_27 architecture, 11_33_35 architecture)가 이 지점을 "정합적으로 남아 있다"고 이미 검증했다. 그런데 `authConfigId` 자리는 top-level이 **이미 (a) 갈래를 택해 `AUTH_CONFIG_NOT_FOUND`로 교체**한 상태였는데, 이번 배선이 여기에도 무조건 `details.code: 'INVALID_FIELD'`를 얹었다 — 15자리를 "field가 있으면 code도 싣는다"는 단일 규칙으로 기계적으로 훑으면서, 이 한 자리만 (a)/(b) 두 갈래가 이미 충돌하는 지점이라는 것을 놓쳤다. `plan/in-progress/impl-details-code-wiring.md:44`("객체 `{ field, code }` | `rethrowEndpointPathConflict` | 무조치 (선례, 도메인 코드 보유)")는 정확히 이 예외를 다뤘지만 `rethrowEndpointPathConflict` 한 곳만 짚었고, top-level이 특화 코드인 `authConfigId` 자리는 "13곳" 안에 섞여 동일 처리를 받았다. `triggers.service.spec.ts:696-721`의 신규 테스트가 이 조합을 그대로 단언하며 `// top-level 은 도메인 코드를 쓰고 details 는 어느 필드가 문제인지 + generic 사유를 싣는다 — §5.3 의 「둘을 겹쳐 쓰지 않는다」를 어기지 않는다(서로 다른 층의 서로 다른 정보다)`라는 방어 주석을 남겼지만, 이 자리에서 `authConfigId`는 이 throw를 발동시킬 수 있는 **유일한** 필드라 `details.field`가 이미 함의하는 것 이상의 신규 정보를 주지 않고, `details.code: 'INVALID_FIELD'`는 top-level이 이미 말한 것보다 **더 거친(정보량이 적은)** 사유를 덧붙일 뿐이다 — "서로 다른 정보"라는 방어는 이 특정 자리에서는 성립하지 않는다. 실질 위험은 낮다: 기존 클라이언트가 top-level `code==='AUTH_CONFIG_NOT_FOUND'`로 분기하고 있었다면 그 분기는 그대로 동작한다(추가 키라 breaking 아님). 다만 `details[].code`를 프로젝트 전역에서 하나의 닫힌 열거형처럼 소비하는 클라이언트(예: 향후 자동 생성 SDK가 "details.code → 사용자 메시지" 매핑 테이블을 만드는 경우)가 있다면, `AUTH_CONFIG_NOT_FOUND` 케이스가 그 테이블에서 `INVALID_FIELD`(제네릭 필드 오류)로 뭉개져 실제로는 "리소스가 존재하지 않는다"는 더 구체적인 신호를 잃는다.
  - 제안: 이 한 자리만 `rethrowEndpointPathConflict`와 동일한 논리를 적용해 `details`에서 `code` 키를 제거하거나(top-level이 이미 사유를 특화했으므로 §5.3 (a) 갈래 그대로 유지), 반대로 유지하고 싶다면 plan/커밋 본문에 "이 자리는 예외적으로 (a)+(b)를 겹친다 — 이유는 X"를 명시적으로 남겨 다음 사람이 15자리를 다시 훑을 때 "무조건 code 추가"로 오독하지 않게 한다. 어느 쪽이든 CRITICAL은 아니다(하위 호환 깨짐 없음) — 신규 규약을 스스로 어긴 자기모순이라는 점에서 WARNING.

- **[INFO]** (재확인, 신규 아님) `botToken` `@MinLength(1)` 추가는 이전에 성공하던 요청(`botToken: ''`)을 이제 400으로 거부하는 동작 변경이나, OpenAPI 선언(`minLength: 1`)을 실제로 강제하는 정합화이며 CHANGELOG·plan·테스트에 모두 명시돼 있다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192,194`
  - 상세: 이전 두 라운드(api_contract 11_05_27 #1, side_effect 11_05_27, requirement 11_05_27 #관점6)가 이미 이 지점을 상세히 다뤘고 결론(정당한 버그 수정, breaking 이라기보다 "선언=구현" 좁히기)에 동의한다. 공백 전용 문자열(`'   '`)은 여전히 통과하는 스코프아웃도 코드 주석·테스트 JSDoc(`trigger-dto-validation.spec.ts` `[C]`)에 명시돼 있어 "빈 문자열 문제가 전부 닫혔다"는 오독 위험은 낮다.
  - 제안: 추가 조치 불필요.

- **[INFO]** `details[].code` 15자리 배선은 순수 additive 필드 추가이고, `GlobalExceptionFilter`/`ErrorResponseBodyDto.details`가 `type: 'object', additionalProperties: true`로 이미 열려 있어 OpenAPI 스키마 변경도 필요 없다 — 하위 호환성 문제 없음.
  - 위치: `codebase/backend/src/common/swagger/error-response.dto.ts:30-37`(`details?: unknown`, `additionalProperties: true`) · `codebase/backend/src/modules/triggers/triggers.service.ts`(13곳) · `codebase/backend/src/common/utils/password.util.ts:75,96`
  - 상세: 신규 키 추가만으로는 Swagger 계약을 깨지 않는다(스키마가 이미 폐쇄되지 않음). `codebase/frontend/src`를 grep 했을 때 `details`를 정확 일치(deep-equal)로 소비하는 프로덕션 코드는 없고, 유일하게 정확 일치를 쓰던 자리는 이번 PR이 함께 갱신한 unit(13+2)·e2e(5) 테스트뿐이다.
  - 제안: 추가 조치 불필요.

- **[INFO]** URL/경로 설계·페이지네이션·인증/인가·버전 관리 네 관점은 이번 diff와 무관하다 — 신규 엔드포인트, 목록 API, 인증/인가 로직, API 버전 변경이 없다.

## 요약

이번 3-커밋 누적 diff는 새 엔드포인트나 버전 변경 없이, 기존 chatChannel/password 검증 에러 응답의 `details[].code`를 15개 발행 지점에 배선하고(§5.3 2026-09-11 규약 준수), `botToken`의 OpenAPI `minLength: 1` 선언을 실제 검증 체인(`@MinLength(1)`)으로 정합화하며, 5쌍의 거부 메시지를 공유 상수로 통합한 것이 핵심이다. 대부분의 배선(14/15곳)은 top-level `code`가 상태 기본값(`VALIDATION_ERROR`/`RESOURCE_CONFLICT`)을 유지한 채 `details[].code`에 사유를 싣는 §5.3의 정규 갈래를 정확히 따르지만, `authConfigId`(`AUTH_CONFIG_NOT_FOUND`) 한 자리만은 top-level이 이미 도메인 특화 코드로 교체된 상태에서 generic `details.code: 'INVALID_FIELD'`를 겹쳐 실어, 이 PR이 스스로 세운 "둘을 겹쳐 쓰지 않는다" 원칙에 예외를 하나 만든다 — 하위 호환을 깨지는 않지만(additive, 기존 top-level 분기는 그대로 동작) 신규 규약 적용의 일관성 관점에서 WARNING으로 기록한다. `botToken` 빈 문자열 거부는 이전에 (버그로) 성공하던 요청을 실패로 바꾸는 의도된 동작 변경이나 정당한 정합화이고, 그 외 응답 스키마·에러 상태 코드·요청 검증·URL 설계·인증/인가·페이지네이션 축에서는 계약을 깨는 변경이 없다.

## 위험도

LOW
