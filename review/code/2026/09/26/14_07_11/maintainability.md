# 유지보수성(Maintainability) 리뷰 — success-advert (2R, 1R 조치 후)

이 변경 세트는 1R `/ai-review`(`review/code/2026/09/26/13_39_09`)에서 지적된 유지보수성 WARNING 2건(`judgeHandler` SRP 압박,
2xx/3xx 분류 중복)이 이미 `bf1fa96fc`(`classifyDecorators` 순수 함수 분리 + `advertise()` 헬퍼 통합)로 조치된 뒤의 상태다. 직접
`codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` 를 열어 조치 결과를 재확인했다.

## 발견사항

- **[INFO]** `TriggersService.rotateNotificationSecret`/`revokePerTriggerToken` 는 여전히 인라인 리터럴 반환 타입이라, 이번 조치(`bf1fa96fc`)가 인용한 "같은 파일 `rotateBotToken` 관례"가 서비스 계층까지는 확장되지 않았다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rotateNotificationSecret()`(`Promise<{ secret: string; rotatedAt: string }>`), `revokePerTriggerToken()`(`Promise<{ token: string }>`)
  - 상세: `bf1fa96fc` 는 컨트롤러(`triggers.controller.ts`)만 `Promise<NotificationRotateSecretDto>`/`Promise<InteractionRevokeTokenDto>` 로 좁혔고(git show --stat 으로 확인 — 이 커밋이 건드린 파일은 `triggers.controller.ts` 뿐), 커밋 메시지·1R `api_contract.md` 가 함께 언급했던 서비스 쪽 반환 타입은 인라인 리터럴 그대로다. 기능적으로는 문제 없다 — 컨트롤러가 명시적 반환 타입을 선언하고 있어 서비스가 필수 필드를 빼거나 이름을 바꾸면 `return` 문에서 구조적 할당 실패로 `tsc` 가 여전히 잡는다(값이 아니라 리터럴이 아니므로 초과 필드 추가는 못 잡지만, 그 축은 e2e `assertMatchesContract` 의 "선언되지 않은 키" 검사가 대신 덮는다). 다만 서비스 시그니처가 DTO 를 참조하지 않아, 다음 사람이 `rotateBotToken` 바로 옆의 두 메서드를 보고 "이 파일의 관례는 서비스도 DTO 로 선언한다" 로 오해하거나, 반대로 "관례가 컨트롤러에서만 적용된다" 는 것을 알아채지 못한 채 새 secret 발급 메서드를 추가할 때 서비스·컨트롤러 어느 쪽에 타입을 둘지 판단 기준이 불명확해진다.
  - 제안: 급하지 않음(회귀 방지력은 이미 확보됨) — 다음에 이 영역을 만질 때 서비스 시그니처도 `Promise<NotificationRotateSecretDto>`/`Promise<InteractionRevokeTokenDto>` 로 맞추면 "DTO 는 서비스에서 만들어 컨트롤러까지 그대로 흐른다" 는 한 문장으로 관례를 설명할 수 있다.

- **[INFO]** `trigger-secret-issue-response.dto.ts` — 파일명(단수 "issue")이 서로 다른 두 하위 액션(알림 secret 회전 / interaction token 재발급)의 DTO `NotificationRotateSecretDto`·`InteractionRevokeTokenDto` 를 함께 담아 이름과 내용이 살짝 어긋난다
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts`
  - 상세: 1R `architecture.md` 가 이미 지적했고 "기존 관례(`webauthn-response.dto.ts` 도 여러 무관한 응답 DTO 를 한 파일에 묶음)와 일관되므로 새 안티패턴은 아니다" 로 처분 불요 판정을 받은 항목이다. 재확인한 결과 지금도 그대로이며, 새로운 관례 이탈은 아니다.
  - 제안: 조치 불필요 — 세 번째 secret 발급 DTO 가 추가될 때 분리 검토.

## 점검 관점별 확인 결과

1. **가독성**: `classifyDecorators`(데코레이터 순회 → 사실 수집) / `judgeHandler`(그 사실로 위반·미광고 판정 조립)로 책임이 갈려, 각 함수를 한 화면에서 읽고 검증할 수 있다. DTO 파일들(`assistant-session-response.dto.ts` 등)은 필드마다 JSDoc + `@ApiProperty` 설명이 붙어 의도가 명확하다.
2. **네이밍**: `advertise(status)`, `isSuccess`/`isRedirect`, `HandlerDecorators`, `HttpStatusUnadvertised` 등 새 식별자가 하는 일을 정확히 반영한다. 컨벤션(카멜케이스 함수, `HttpStatusX` 인터페이스 접두)도 기존 파일과 일치.
3. **함수 길이**: `classifyDecorators` ~45줄, `judgeHandler` ~55줄로 리팩터 이전(78줄 단일 함수)보다 짧아졌다. `AssistantSessionDetailDto` 계열 DTO 파일은 265줄이지만 선언적 클래스 나열이라 실질 복잡도는 낮다.
4. **중첩 깊이**: `classifyDecorators` 의 `for` + `if/else-if` 체인은 한 단계 중첩에 그친다(분기 6갈래이지만 평탄). `judgeHandler` 도 조기 반환으로 중첩을 얕게 유지.
5. **매직 넘버**: `HttpStatus` enum·`isSuccess`/`isRedirect` 범위 상수만 쓰고 raw 숫자는 e2e/유닛 테스트의 예시 데이터(`inputTokens: 120` 등, 픽스처 값)뿐 — 의미가 명확한 테스트 데이터라 문제 아님.
6. **중복 코드**: 2xx/3xx 판정이 `advertise()` 하나로 합쳐져 `@ApiResponse` 분기와 이름 표 분기의 반복이 제거됐다(1R WARNING 조치 확인).
7. **코드 복잡도**: `judgeHandler`/`classifyDecorators` 분리로 각 함수의 순환 복잡도가 낮아졌다. 뮤턴트 8/8 KILLED(`plan/in-progress/success-advert.md` 표, `RESOLUTION.md`)로 분기 커버리지가 실측됐다.
8. **일관성**: `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse` 는 기존 `wrapDataSchema`/`ApiOkWrappedResponse` 계열과 동일한 3줄 보일러플레이트를 그대로 반복 — 파일 전체 관례(래퍼 함수 하나 = 스키마 빌더 하나)를 정확히 따른다. `triggers.controller.ts` 반환 타입도 이제 DTO 로 선언돼(`Promise<NotificationRotateSecretDto>`) 인라인 리터럴을 쓰던 이전 상태보다 파일 내부 일관성이 개선됐다(서비스 계층은 위 INFO 참고).

## 요약

1R 에서 지적된 유지보수성 WARNING 2건(`judgeHandler` SRP 압박, 2xx/3xx 분류 중복)은 `bf1fa96fc` 의 `classifyDecorators` 순수 함수 분리 + `advertise()` 헬퍼 통합으로 깔끔하게 해소됐음을 직접 코드를 읽어 확인했다 — 판정 로직이 짧아지고 각 조각의 책임이 분명해졌으며 뮤턴트 8/8 KILLED 로 동작 동등성도 실측됐다. 남은 항목은 모두 INFO 수준이다: triggers 서비스 계층 반환 타입이 컨트롤러만큼 DTO 로 좁혀지지 않은 점(회귀 방지력 자체는 이미 확보돼 있어 급하지 않음), DTO 파일명(단수)이 두 하위 액션을 묶은 점(기존 관례와 일관, 새 안티패턴 아님). 신규 DTO 파일들은 네이밍·문서화·기존 컨벤션 준수 면에서 견고하다.

## 위험도

LOW
