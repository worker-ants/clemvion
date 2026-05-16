# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[INFO]** 코드 포매팅 전용 변경 — 기능 부작용 없음 (파일 1, 3, 5, 6, 9)
  - 위치: `migrations.spec.ts`, `send-email.schema.spec.ts`, `parallel.schema.spec.ts`, `switch.schema.spec.ts`, `carousel.schema.spec.ts`
  - 상세: 모든 변경이 Prettier 스타일 재포매팅(줄바꿈·들여쓰기·인라인 vs. 멀티라인 배치)에 해당한다. 테스트 로직·단언문·인자 자체는 변경되지 않았으며, 런타임 동작에 아무런 부작용이 없다.
  - 제안: 별도 조치 불필요.

- **[INFO]** 문자열 리터럴 따옴표 변환 — 내용 동일, 부작용 없음 (파일 4, 7, 8)
  - 위치: `if-else.schema.ts` L860, `variable-declaration.schema.ts` L1652, `variable-modification.schema.ts` L1809
  - 상세: `warningRules[].message` 필드의 이스케이프 문자(`\'`)를 더블 쿼터(`"`)로 치환. 세 곳 모두 런타임 문자열 값이 동일하므로(`First condition's field must be entered.` 등) 소비자가 이 메시지를 key 로 비교하거나 i18n 조회에 사용하는 경우에도 영향이 없다. TypeScript 컴파일 결과도 동일한 바이트 열이다.
  - 제안: 별도 조치 불필요.

- **[WARNING]** `oauthCallback` — 환경 변수 읽기 순서 및 폴백 정책의 런타임 부작용 (파일 2)
  - 위치: `third-party-oauth.controller.ts` L456 (`const targetOrigin = process.env.FRONTEND_URL || process.env.APP_URL`)
  - 상세: 이 줄은 이번 diff 에 포함되지 않은 기존 코드이나, diff 맥락상 함께 검토 대상이 된다. `FRONTEND_URL` 이 빈 문자열(`""`)로 설정된 경우 `||` 연산자는 falsy 로 평가해 `APP_URL` 로 폴백한다. 운영 환경에서 잘못된 값으로 `FRONTEND_URL=""` 가 주입되면 `APP_URL` 의 값이 실제로 사용되는 무언의 폴백이 발생한다. `isValidPostMessageOrigin` 검증이 이후 단계에서 차단하긴 하나, 원인 파악이 어렵다.
  - 제안: `process.env.FRONTEND_URL?.trim() || process.env.APP_URL?.trim()` 또는 엄격한 `?? ''` 체인으로 변경하거나, 빈 문자열인 경우 명시적인 경고 로그를 추가해 디버깅 편의성을 높일 것.

- **[WARNING]** `oauthCallback` — `process.env` 직접 읽기가 테스트·배포 경계에서 숨겨진 전역 상태 의존 유발 (파일 2)
  - 위치: `third-party-oauth.controller.ts` L456–L475
  - 상세: `oauthCallback` 핸들러는 요청마다 `process.env.FRONTEND_URL` / `process.env.APP_URL` 을 직접 읽는다. NestJS DI 컨텍스트 바깥에서 환경 변수를 직접 참조하므로, ConfigService 를 통한 검증·변환 없이 원시 값이 그대로 사용된다. 단위 테스트에서 환경 변수를 `jest.resetModules()` 없이 조작하면 다른 테스트 케이스에 오염될 수 있다(전역 상태 공유). 또한 운영 환경에서 환경 변수가 실행 중 변경될 경우(예: Kubernetes secret rotation) 핸들러가 즉시 새 값을 사용해 버그를 추적하기 어렵다.
  - 제안: NestJS `ConfigService` 또는 생성자에서 `@Inject` 로 주입받은 상수로 이동해 DI 컨테이너가 수명을 관리하도록 변경. 생성자에서 유효성 검사를 한 번 수행하고 결과를 인스턴스 필드로 보관하면 요청마다 검증 비용이 사라지고 부작용 범위가 줄어든다.

- **[INFO]** `oauthCallback` — `diff` 변경 내용 자체(주석 줄바꿈)는 부작용 없음 (파일 2)
  - 위치: `third-party-oauth.controller.ts` L235–L237 (`@ApiOkResponse description` 줄바꿈)
  - 상세: Swagger 데코레이터의 description 문자열 값은 동일하고 줄바꿈만 추가된 포매팅 변경이다. Swagger 스펙 생성 결과나 런타임 동작에 영향이 없다.
  - 제안: 별도 조치 불필요.

---

## 요약

이번 변경 세트는 대부분 Prettier 자동 포매팅(줄바꿈·들여쓰기·따옴표 스타일 통일)에 해당한다. 파일 1·3·4·5·6·7·8·9 는 기능·로직·인터페이스 변경이 전혀 없어 부작용 위험이 없다. 유의할 지점은 파일 2(`third-party-oauth.controller.ts`)의 기존 코드에 있다: `oauthCallback` 이 `process.env` 를 요청 경로 직접 읽어 전역 환경 변수를 공유 상태로 사용하며, `FRONTEND_URL=""` 폴백 동작이 무음으로 발생할 수 있다. 이번 diff 에서 해당 로직을 직접 수정한 것은 아니지만, 맥락 코드 검토 결과로 문서화한다. 시그니처 변경·공개 API 변경·파일시스템 부작용·이벤트 발생 변경은 발견되지 않았다.

---

## 위험도

LOW
