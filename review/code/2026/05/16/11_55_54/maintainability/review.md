# 유지보수성(Maintainability) Review

## 발견사항

### 파일 5: integration-expiry-scanner.service.spec.ts

- **[WARNING]** TypeORM 내부 구현 세부 사항(`_value`)에 직접 의존하는 테스트
  - 위치: 파일 5, 추가된 테스트 블록 (REQ-C1)
  - 상세: `statusOp._value._value` 형태로 TypeORM Not/In operator 의 내부 프로퍼티(`_value`)를 직접 접근한다. 이 필드는 TypeORM 의 공개 API 가 아니라 내부 구현이므로, TypeORM 버전 업그레이드 시 해당 구조가 변경되면 테스트가 조용히 깨지거나 잘못 통과할 수 있다. 유지보수 부담이 크다.
  - 제안: TypeORM 내부를 직접 검사하는 대신, `find()` 가 올바른 결과를 반환하는지 통합 레벨에서 검증하거나, 조회 파라미터를 추상화한 helper 함수를 테스트하는 방식을 고려한다. 혹은 내부 접근의 fragility 를 인정하고 주석에 TypeORM 버전 고정 의도를 명시한다.

---

### 파일 6: integration-oauth.service.cafe24.spec.ts

- **[INFO]** 반복되는 DTO 분기 단언 패턴
  - 위치: Public 분기 테스트 (`publicResp.*`) 와 Private 분기 테스트 (`privateResp.*`)
  - 상세: 두 블록 모두 `result as Record<string, unknown>` 캐스팅 후 필드별 `toBeUndefined()` 단언을 나열하는 구조가 유사하다. 현재 두 곳에 그치고 있어 중복 부담이 낮지만, 분기가 추가될 경우 같은 패턴이 늘어날 수 있다.
  - 제안: DTO 분기 불변성을 검증하는 헬퍼(예: `assertIsPopupResult`, `assertIsCafe24PendingResult`)를 추출해 재사용성을 확보한다.

---

### 파일 7: integration-oauth.service.ts

- **[INFO]** `urlToken` 매개변수 비사용 처리 방식
  - 위치: `params` 비구조화 시 `const { query } = params;` 로만 추출
  - 상세: `urlToken` 이 params 타입에 선언되어 있지만 실제로 사용되지 않음을 주석으로 설명하고 있다. 주석 설명은 충분히 명확하나, TypeScript 컴파일러 관점에서 미사용 변수 경고를 피하려고 의도적으로 미추출한 것임을 한눈에 파악하기 어렵다.
  - 제안: 현 방식은 허용 가능하나, `_urlToken` 또는 `/** @unused */` 어노테이션 등을 고려해 의도를 더 명시적으로 표현할 수 있다. 단, 프로젝트 ESLint 규칙이 `no-unused-vars` 에 underscore prefix 예외를 두고 있으면 그 컨벤션을 따르는 것이 일관성 면에서 낫다.

- **[INFO]** `formUrlEncode` 함수 내 연쇄 `.replace()` 포매팅 변경
  - 위치: `formUrlEncode` 함수 전체
  - 상세: 함수 본문을 괄호로 감싸 들여쓰기를 한 단계 추가했다. 기능상 동일하나, 괄호 없이도 `return encodeURIComponent(value).replace(...)...` 형태로 체이닝이 가능하다. 새 포매팅도 읽기 어렵지 않지만, 기존 코드베이스 내 다른 method chain 포매팅 패턴과 일치하는지 확인이 필요하다.
  - 제안: Prettier/ESLint 설정이 자동 포매팅을 결정하도록 두면 일관성 문제가 사라진다. 수동 포매팅 결정이라면 프로젝트의 다른 긴 method chain 패턴을 따른다.

---

### 파일 4: integration-response.dto.ts

- **[INFO]** `OAuthBeginPopupResultDto` 와 `OAuthBeginCafe24PendingResultDto` 분리 — 긍정적 변경
  - 위치: 두 클래스 선언부 전체
  - 상세: 기존 단일 `OAuthBeginResultDto` 에서 모든 필드를 optional 로 두던 방식에서, 두 개의 명확한 DTO 클래스로 분리한 것은 가독성과 타입 안전성 모두에서 개선이다. 각 DTO 가 자신이 담당하는 분기의 필드만 필수(`!`)로 선언함으로써 의도가 코드 자체에 명확히 드러난다. 유지보수성 측면의 적극적 개선 사례.

- **[INFO]** `OAuthBeginCafe24PendingResultDto` 에 `export` 누락 가능성 확인 필요
  - 위치: `export class OAuthBeginCafe24PendingResultDto`
  - 상세: 파일 내에서 두 클래스 모두 `export` 키워드가 붙어 있고, 컨트롤러에서 named import 로 사용하고 있어 실제 누락은 없다. 다만 diff 상에서 `OAuthBeginCafe24PendingResultDto` 의 `export` 선언이 한 번에 보이지 않는 구조여서 리뷰 시 시선이 분산될 수 있다 — 발견사항 없음, 확인 완료.

---

### 파일 8: integrations.controller.ts

- **[INFO]** 세 엔드포인트에서 동일한 DTO 배열 `[OAuthBeginPopupResultDto, OAuthBeginCafe24PendingResultDto]` 반복
  - 위치: `beginOAuth`, `reauthorize`, `requestScopes` 엔드포인트 데코레이터 (라인 791, 808, 825 부근)
  - 상세: 동일한 두 DTO 클래스 배열이 세 곳에 중복 나열되어 있다. 현재는 두 항목이라 허용 가능하나, 분기 DTO 가 늘어나거나 이름이 변경될 때 세 곳을 모두 수정해야 한다.
  - 제안: `const OAUTH_BEGIN_RESULT_DTOS = [OAuthBeginPopupResultDto, OAuthBeginCafe24PendingResultDto] as const;` 처럼 상수로 추출하고 세 데코레이터에서 공유하면 유지보수 포인트가 줄어든다.

---

### 파일 2: api-wrapped.ts

- **[INFO]** `wrapDataSchema`, `wrapOneOfDataSchema`, `wrapItemsSchema`, `wrapPaginatedSchema` 의 최상위 구조 반복
  - 위치: 각 함수 본문의 `{ type: 'object', required: ['data'], properties: { data: ... } }` 패턴
  - 상세: 네 함수 모두 `type: 'object', required: ['data']` 라는 wrapper 구조를 반복하고 있다. `data` 키 이름이나 `required` 배열이 변경될 경우 네 곳 모두 수정해야 한다.
  - 제안: `buildDataWrapper(dataSchema: unknown): SchemaObject` 형태의 내부 헬퍼를 만들어 반복을 제거할 수 있다. 단, 현재 함수 수와 코드 분량이 많지 않아 선택적 개선 사항이다.

- **[INFO]** `ApiOkWrappedOneOfResponse` 추가로 인한 패턴 일관성
  - 위치: `ApiOkWrappedOneOfResponse` 함수 선언부 및 기존 `ApiOkWrappedResponse` 패턴
  - 상세: 기존 단일 DTO 래퍼들(`ApiOkWrappedResponse`, `ApiCreatedWrappedResponse`, `ApiAcceptedWrappedResponse`, `ApiOkWrappedArrayResponse`, `ApiOkPaginatedResponse`)은 모두 동일한 `applyDecorators(ApiExtraModels(...), ApiXxxResponse(...))` 패턴을 따른다. 새로 추가된 `ApiOkWrappedOneOfResponse` 도 같은 패턴을 따르므로 일관성이 유지된다. 긍정적 평가.

---

### 파일 11: llm-provider-rule.ts

- **[INFO]** Language SoT 관련 주석의 유지보수 책임 명시
  - 위치: 파일 상단 JSDoc 블록
  - 상세: 새로 추가된 `**Language SoT**` 문단은 영문 메시지 변경 시 프론트엔드 `WARNING_KO` 매핑도 함께 갱신해야 한다는 책임을 명확히 기술하고 있다. 이 종류의 coupling 을 코드 주석으로 선언하는 것은 유지보수자가 실수하지 않도록 돕는 좋은 패턴이다.

---

### 파일 17: cafe24-token-refresh.processor.spec.ts

- **[WARNING]** `TEST-C2` 테스트 케이스의 위치 변경 — 중복 선언 문제
  - 위치: 파일 전체 (diff 에서 제거 후 전체 컨텍스트에서 재등장)
  - 상세: diff 를 보면 `TEST-C2` 테스트(`propagates refreshAccessToken failure`)가 `describe` 블록에서 삭제된 것으로 표시되지만, 전체 파일 컨텍스트에서는 동일한 테스트가 파일 말미에 다시 존재한다. 두 블록이 실제로 같은 테스트를 가리킨다면 이는 리팩토링 과정에서 위치를 이동한 것이다. 이동 자체는 문제가 없으나, 변경 의도(위치 이동인지 삭제 후 재추가인지)가 diff 만으로는 불명확해 리뷰어에게 혼란을 준다. 커밋 메시지 또는 주석에 이동 사유를 명시하면 좋다.
  - 제안: 테스트 이동의 경우 별도 commit 또는 `// moved from X to end of describe` 주석으로 의도를 명확히 한다.

---

### 파일 1: V050__integration_cafe24_connected_rotated_idx.conf

- **[INFO]** 마이그레이션 conf 파일에 상세 주석 추가 — 긍정적 변경
  - 위치: 파일 전체 (주석 6줄 추가)
  - 상세: `executeInTransaction=false` 설정의 기술적 이유(`CREATE INDEX CONCURRENTLY`, Flyway 트랜잭션 감싸기)를 한국어 주석으로 상세히 설명하고 있다. 인프라 설정 파일에서 이런 수준의 설명은 향후 유지보수자(또는 다른 팀원)가 설정 값을 임의로 바꾸는 실수를 예방한다. 모범 사례.

---

### 파일 3: migrations.spec.ts

- **[INFO]** 테스트 코드 포매팅 정리 (Prettier 스타일 통일)
  - 위치: 변경된 세 `it()` 블록
  - 상세: 인자 배열을 한 줄로 합치는 방향으로 포매팅을 조정했다. 기능 변경 없이 Prettier 기준에 맞게 정리한 것으로, 코드베이스 스타일 일관성을 높인다.

---

### 파일 10, 12, 13, 14, 15, 16, 18, 19, 21, 22, 23, 25, 26, 27: 테스트 설명문 언어 정규화

- **[INFO]** 테스트 `it()` 설명에서 "Korean" 이라는 표현 제거
  - 위치: 각 파일의 `evaluateMetadataBlockingErrors` describe 블록 내 it 설명
  - 상세: 메시지가 한국어에서 영어로 전환된 이후 테스트 설명(`'emits Korean warnings'` → `'emits warnings'`)이 실제 동작과 맞지 않던 문제를 일괄 수정했다. 테스트 설명이 행동을 정확히 반영해야 한다는 원칙에 맞는 정리이다.

---

### 파일 24: if-else.schema.ts

- **[INFO]** 문자열 리터럴 따옴표 스타일 통일
  - 위치: `warningRules` 배열 내 `message` 필드
  - 상세: `'First condition\'s field must be entered.'` (escaped single quote) 를 `"First condition's field must be entered."` (double quote) 로 변경했다. escape 없이 의도를 더 명확하게 표현하는 소폭 개선. Prettier 포매팅 규칙을 따른 것으로 일관성에 부합한다.

---

## 요약

이번 변경 세트는 전반적으로 유지보수성이 개선되는 방향이다. `OAuthBeginResultDto` 를 두 개의 명확한 DTO(`OAuthBeginPopupResultDto`, `OAuthBeginCafe24PendingResultDto`)로 분리한 것은 가독성과 타입 안전성을 동시에 높인 핵심 개선이며, Swagger 래퍼에 `wrapOneOfDataSchema`/`ApiOkWrappedOneOfResponse` 를 추가해 기존 패턴과 일관성 있게 확장한 점도 긍정적이다. 다수의 테스트 파일에서 테스트 설명 언어를 일관되게 정리하고, 마이그레이션 conf 파일에 상세한 기술 주석을 추가한 것도 유지보수자를 위한 배려이다. 한편, 컨트롤러에서 세 엔드포인트에 동일 DTO 배열이 반복되는 소폭의 중복, TypeORM 내부 프로퍼티 직접 접근이라는 취약한 테스트 구조, `api-wrapped.ts` 내 wrapper 객체 구조의 반복 등은 향후 개선 대상으로 남아 있다. 치명적 문제는 발견되지 않았으며, 지적된 사항들은 대부분 낮은 위험도의 개선 제안 수준이다.

## 위험도

LOW
