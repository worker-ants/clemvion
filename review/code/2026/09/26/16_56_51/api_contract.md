# API 계약(API Contract) 리뷰

## 범위 확인

이번 변경 30개 파일 중 실제 API 구현 코드(컨트롤러·서비스·DTO)는 **하나도 없다**. 구성은 다음과 같다:

- `codebase/backend/test/workflow-assistant.e2e-spec.ts` — 기존 `sessions/latest` 엔드포인트의 e2e 테스트 **단언 보강**(제품 코드 변경 없음)
- `plan/**`, `review/consistency/**` — 계획·컨시스턴시 체크 산출물(문서)
- `spec/3-workflow-editor/_product-overview.md` — PRD 표 ED-AI-19 행에 "(미구현 — 계획)" 표기 추가(문서 주석, 요구사항·API 자체는 불변)

즉 응답 스키마, 라우트, 상태 코드, 에러 포맷, 인증/인가 로직 등 **API 계약의 실제 구현은 이번 diff 로 전혀 바뀌지 않는다**. 아래는 테스트 파일의 내용이 실제 API 계약과 일치하는지에 대한 확인 결과다(구현 코드는 참고용으로 직접 열람).

## 발견사항

- **[INFO]** `sessions/latest` 라우트 순서 가정을 테스트가 명시적으로 검증 — 실제 컨트롤러와 일치 확인
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts:197`-`198` (신설 주석), `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:85`-`88` (해당 코드, 이번 diff 범위 밖)
  - 상세: 테스트 주석은 "`sessions/:id` 가 `latest` 를 가로채면 `ParseUUIDPipe` 가 400 을 낸다"는 라우트 순서 리스크를 지적한다. 실제 컨트롤러를 확인한 결과 `@Get('sessions/latest')`(88행)가 `@Get('sessions/:id')`(113행)보다 먼저 선언되어 있고, 같은 취지의 코드 주석(85~87행: "must be declared BEFORE `sessions/:id`")이 이미 존재한다. 테스트가 실제 계약을 정확히 반영해 회귀 가드 역할을 한다.
  - 제안: 없음(정상). 향후 이 컨트롤러에 라우트를 추가/재배치할 때 리터럴 경로(`latest`)가 파라미터 라우트(`:id`)보다 먼저 선언되어야 한다는 관례를 유지할 것.
- **[INFO]** `{ data: null }` 널러블 응답 봉투를 `toStrictEqual` 로 엄격 검증
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts:218`
  - 상세: 세션이 없는 워크플로에 대해 `sessions/latest` 가 `{ data: null }`(추가 키 없음)을 정확히 반환하는지 `toStrictEqual` 로 확인한다. `TransformInterceptor`/`ApiOkWrappedNullableResponse` 계약의 "null 쪽" 형태를 고정하는 좋은 회귀 가드다.
  - 제안: 없음(정상).

전체 구현 코드(컨트롤러·서비스·DTO)에 대한 변경이 없으므로 하위 호환성·버전 관리·응답 형식·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가 관점에서 breaking change 나 신규 리스크는 발견되지 않았다.

## 요약

이번 diff 는 API 구현 코드를 전혀 건드리지 않고, 기존 `GET /api/workflow-assistant/sessions/latest` 엔드포인트에 대한 e2e 단언을 보강(상태 코드 200 고정·반환된 세션 id 검증·`data: null` 널 분기 검증·도구 호출 DTO 의 선택 필드 생략 케이스 추가)하는 테스트 전용 변경과, plan/consistency 리뷰 산출물, PRD 문서에 미구현 표기 한 줄을 추가하는 문서 변경으로 구성된다. 테스트가 검증하는 라우트 순서·널 응답 봉투 형태는 실제 컨트롤러 코드와 대조해 정확함을 확인했다. API 계약 관점에서 위험 요소는 없다.

## 위험도
NONE
