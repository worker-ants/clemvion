# 성능(Performance) 코드 리뷰

## 발견사항

### 파일 1: backend/src/migrations.spec.ts

- **[INFO]** 변경 내용은 순수 코드 포매팅(줄바꿈 위치 조정)으로, 성능 관련 변경 없음
  - 위치: 전체 diff (line 110-165)
  - 상세: `findDuplicateVersions` 함수 자체는 O(n) 시간복잡도로 Set 기반으로 잘 구현되어 있음. `seen` 과 `dup` 두 Set 을 사용해 단일 순회로 중복을 검출하며, 마지막 `[...dup].sort()` 도 중복 수가 전체 파일 수보다 훨씬 적으므로 실용적으로 무시 가능한 비용
  - 제안: 현행 구현 유지. 성능상 추가 개선 불필요

- **[INFO]** `readdirSync` 동기 I/O 사용
  - 위치: line 124, `beforeAll(() => { entries = readdirSync(MIGRATIONS_DIR); })`
  - 상세: 테스트 파일이므로 동기 I/O 사용이 적절하며, 빌드/CI 시점 1회 실행임. `entries` 를 `beforeAll` 에서 한 번만 읽어 재사용하는 패턴도 올바름
  - 제안: 현행 유지. 운영 코드가 아니므로 문제 없음

---

### 파일 2: backend/src/modules/integrations/third-party-oauth.controller.ts

- **[INFO]** 변경 내용은 Swagger 데코레이터 문자열 포매팅으로, 성능 관련 변경 없음
  - 위치: line 236-238 (`@ApiOkResponse` description 줄바꿈)
  - 상세: 순수 스타일 변경으로 런타임 성능에 영향 없음

- **[WARNING]** `oauthCallback` 핸들러에서 환경변수를 매 요청마다 읽음
  - 위치: line 456, `const targetOrigin = process.env.FRONTEND_URL || process.env.APP_URL;`
  - 상세: `process.env` 접근은 매우 빠르므로 실제 병목은 아니지만, `isValidPostMessageOrigin` 검증(new URL 생성 포함)도 매 요청마다 반복 수행됨. 앱 부팅 시 한 번 검증해 두면 요청 경로에서 URL 파싱 비용을 제거할 수 있음
  - 제안: NestJS `OnModuleInit` 또는 `constructor` 에서 `targetOrigin` 을 캐싱하고, `isValidPostMessageOrigin` 검증을 부팅 시 1회만 실행. 잘못 설정된 경우 앱 구동 자체를 실패시키는 방향이 더 나음

- **[INFO]** `req.url.includes('?') ? req.url.split('?', 2)[1] : ''` 패턴
  - 위치: line 359, `cafe24Install` 핸들러
  - 상세: URL 문자열을 두 번 순회하나(includes + split), URL 길이가 제한적이므로 실질 성능 영향 없음. `req.url.indexOf('?')` 를 사용해 한 번의 순회로 통합 가능하지만 마이크로 최적화 수준
  - 제안: 허용 가능한 수준이나, `const qIdx = req.url.indexOf('?'); const rawQuery = qIdx >= 0 ? req.url.slice(qIdx + 1) : '';` 형태로 개선 가능

---

### 파일 3: backend/src/nodes/integration/send-email/send-email.schema.spec.ts

- **[INFO]** 변경 내용은 순수 코드 포매팅으로, 성능 관련 변경 없음
  - 위치: line 237-577 (테스트 assertion 줄바꿈 조정)
  - 상세: 테스트 파일 스타일 변경이며 런타임 성능에 영향 없음

---

### 파일 4: backend/src/nodes/logic/if-else/if-else.schema.ts

- **[INFO]** 변경 내용은 escape 방식 변경 (`\'` → `"`)으로, 성능 관련 변경 없음
  - 위치: line 160, `warningRules[1].message`
  - 상세: 정적 문자열 리터럴 변경으로 성능에 영향 없음

- **[WARNING]** `validateIfElseConfig` 에서 오류 메시지 생성 시 `conditionOperatorSchema.options.join(', ')` 반복 호출
  - 위치: line 999, `conditionOperatorSchema.options.join(', ')`
  - 상세: `conditions` 배열의 각 항목이 잘못된 operator 를 가질 때마다 `join` 이 호출됨. 옵션 목록 문자열은 고정값이므로 모듈 레벨 상수로 캐싱하지 않으면 O(k) 비용이 매 오류 항목마다 발생함 (k = operator 종류 수 = 15)
  - 제안: `const OPERATOR_LIST = conditionOperatorSchema.options.join(', ');` 를 모듈 레벨 또는 함수 외부에 선언해 재사용

---

### 파일 5: backend/src/nodes/logic/parallel/parallel.schema.spec.ts

- **[INFO]** 변경 내용은 순수 코드 포매팅으로, 성능 관련 변경 없음
  - 위치: line 169-171 (테스트 assertion 인라인화)
  - 상세: 테스트 파일 스타일 변경이며 런타임 성능에 영향 없음

---

### 파일 6: backend/src/nodes/logic/switch/switch.schema.spec.ts

- **[INFO]** 변경 내용은 순수 코드 포매팅으로, 성능 관련 변경 없음
  - 위치: line 273-276 (테스트 assertion 인라인화)
  - 상세: 테스트 파일 스타일 변경이며 런타임 성능에 영향 없음

---

### 파일 7: backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts

- **[INFO]** 변경 내용은 escape 방식 변경 (`\'` → `"`)으로, 성능 관련 변경 없음
  - 위치: line 121, `warningRules[1].message`
  - 상세: 정적 문자열 리터럴 변경으로 성능에 영향 없음

---

### 파일 8: backend/src/nodes/logic/variable-modification/variable-modification.schema.ts

- **[INFO]** 변경 내용은 escape 방식 변경 (`\'` → `"`)으로, 성능 관련 변경 없음
  - 위치: line 166, `warningRules[1].message`
  - 상세: 정적 문자열 리터럴 변경으로 성능에 영향 없음

- **[WARNING]** `validateVariableModificationConfig` 에서 `VALID_OPERATIONS` Set 을 함수 호출마다 재생성
  - 위치: line 1931-1938, `const VALID_OPERATIONS = new Set([...])`
  - 상세: `validateVariableModificationConfig` 는 노드 실행·검증 시마다 호출될 수 있는데, 매 호출마다 6개 문자열로 새 Set 을 생성함. GC 압력을 유발하며 불필요한 할당임. 동일 데이터가 `modOperationSchema` enum 에 이미 존재하므로 중복이기도 함
  - 제안: `const VALID_OPERATIONS = new Set(modOperationSchema.options);` 를 모듈 레벨 상수로 이동. 또는 `modOperationSchema.options` 를 직접 참조해 Set 변환을 제거하고 `includes` 사용 (단, Set `has` 가 Array `includes` 보다 O(1) vs O(n) 이므로 Set 을 모듈 레벨 상수로 유지하는 것이 최적)

---

### 파일 9: backend/src/nodes/presentation/carousel/carousel.schema.spec.ts

- **[INFO]** 변경 내용은 순수 코드 포매팅으로, 성능 관련 변경 없음
  - 위치: line 297-300 (테스트 assertion 인라인화)
  - 상세: 테스트 파일 스타일 변경이며 런타임 성능에 영향 없음

---

## 요약

이번 변경의 대부분(9개 파일 중 7개)은 Prettier/ESLint 스타일 포매팅(줄바꿈 위치 조정, 이스케이프 방식 통일)이며 성능에 직접적인 영향을 주지 않는다. 실질적 성능 관련 관찰은 두 가지다. 첫째, `variable-modification.schema.ts` 의 `validateVariableModificationConfig` 함수가 호출마다 `VALID_OPERATIONS` Set 을 재생성하는 패턴은 모듈 레벨 상수로 이동하면 간단히 개선 가능하다. 둘째, `if-else.schema.ts` 의 `conditionOperatorSchema.options.join(', ')` 도 오류 경로에서 반복 호출될 수 있어 캐싱이 권장된다. `third-party-oauth.controller.ts` 에서는 매 요청마다 `isValidPostMessageOrigin`(URL 파싱 포함)이 반복 실행되는 점이 있으나, throttle 으로 호출 빈도가 제어되고 있어 현재 트래픽 규모에서 병목이 될 가능성은 낮다. 전반적으로 이 PR 의 성능 위험도는 낮다.

## 위험도

LOW
