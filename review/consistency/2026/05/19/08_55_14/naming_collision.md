# 신규 식별자 충돌 Check — button-cap-spec-validator

검토 모드: plan draft (--plan)
대상 plan: `plan/in-progress/button-cap-spec-validator.md`

---

### 발견사항

- **[INFO]** `MAX_BUTTONS_PER_NODE` — 신규 상수, 기존 사용처 없음 (충돌 없음)
  - target 신규 식별자: `backend _shared/button.types.ts` 에 도입할 `MAX_BUTTONS_PER_NODE = 5`
  - 기존 사용처: 코드베이스 전체 검색 결과 해당 심볼 없음. `validateButtons` 내부에 리터럴 `10` 으로 하드코딩 (`button.types.ts:49`)
  - 상세: 신규 상수이므로 이름 충돌은 없다. 다만 현재 `button.types.ts` 의 `validateButtons` 는 `if (rawButtons.length > 10)` 으로 cap 값을 인라인으로 갖고 있어 `MAX_BUTTONS_PER_NODE` 도입 후 이 하드코딩 10도 함께 제거해야 일관성이 유지된다. plan 의 작업 항목에 이미 "validateButtons 가 상수 참조"로 명시되어 있으므로 누락 가능성은 낮다.
  - 제안: 충돌 없음. 현재 `button.types.spec.ts:112` 의 `"should fail when more than 10"` 케이스도 plan 에 갱신 대상으로 명시되어 있어 정합성 유지됨. 이상 없음.

- **[WARNING]** `maxButtons` — frontend prop 명과 spec 상수 명 혼동 가능
  - target 신규 식별자: plan 에서 `button-list-editor.tsx` 의 `maxButtons = 10` → `maxButtons = 5` 로 변경
  - 기존 사용처: `button-list-editor.tsx:21` — `maxButtons = 10` (default prop), `button-list-editor.tsx:25` — `maxButtons?: number` (prop 타입). backend 상수 `MAX_BUTTONS_PER_NODE` 와 별개의 식별자
  - 상세: `maxButtons` 는 frontend 컴포넌트 내부 prop 이고 `MAX_BUTTONS_PER_NODE` 는 backend 상수다. 이름이 다르므로 직접 충돌은 없다. 그러나 두 값이 5로 통일된다면 `maxButtons` prop 의 default 값이 `MAX_BUTTONS_PER_NODE` 를 참조하는 형태로 연결되어야 진정한 SSOT 가 된다 — 현재 plan 은 `maxButtons = 10 → 5` 단순 숫자 변경으로만 기술하고 있어 backend 상수와의 공유 경로가 명시되지 않는다. frontend 와 backend 가 각자 별개의 숫자를 유지하는 구조라면 향후 cap 이 다시 바뀔 때 누락 위험이 있다.
  - 제안: frontend 전용 prop 이므로 이름 충돌 자체는 WARNING 등급이 아닌 INFO 수준이나, 양쪽 cap 값의 단일 진실 부재라는 설계 관점에서 주의를 요한다. frontend 에서 `MAX_BUTTONS_PER_NODE` 를 직접 import 할 수 없다면 `packages/` 하위 shared 상수로 추출하거나, spec 주석/JSDoc 에 값 출처를 명시하는 방식을 권장. plan 의 범위가 숫자 변경에만 국한된다면 INFO 로 내릴 수 있다.

- **[INFO]** `validateCarouselItemButtons` — 기존 함수 식별자, 목적 변경 없음
  - target 신규 식별자: cap 값 `4 → MAX_BUTTONS_PER_NODE(5)` 로 변경
  - 기존 사용처: `carousel.schema.ts:313` 에 이미 정의됨. `carousel.schema.ts:388`, `carousel.schema.ts:399` 에서 호출
  - 상세: 함수명 변경이 아니라 내부 임계값만 변경. 식별자 충돌 없음. 신규 식별자 도입이 아니므로 CRITICAL/WARNING 대상 아님.
  - 제안: 이상 없음. plan 기술 그대로 진행 가능.

- **[INFO]** `validateButtons` — 기존 함수의 cap 로직 변경
  - target 신규 식별자: `validateButtons` 함수 내 하드코딩 cap 을 `MAX_BUTTONS_PER_NODE` 로 교체
  - 기존 사용처: `button.types.ts:40` — `validateButtons` (export), `carousel.schema.ts:6+403`, `template.schema.ts:6+128`, `table.schema.ts:6+273`, `chart.schema.ts:6+132` 에서 모두 import 사용
  - 상세: 함수 시그니처 변경 없음. cap 값이 10→5 로 바뀌므로 위 4개 schema 에서 호출하는 모든 글로벌 버튼 검증이 자동으로 5-cap 을 적용하게 된다. plan 은 이를 "자동 적용"이라고 정확히 기술하고 있다.
  - 제안: 이상 없음.

- **[INFO]** `ND-CL-08` — 요구사항 ID 재사용, 텍스트 수정
  - target 신규 식별자: plan 은 `ND-CL-08` 의 텍스트 중 "최대 4개" → "최대 5개" 수정을 명시
  - 기존 사용처: `spec/4-nodes/_product-overview.md:314` — 현재 "최대 4개/아이템" 로 정의됨
  - 상세: ID `ND-CL-08` 자체는 재할당이 아니라 동일 요구사항의 cap 수정이므로 요구사항 ID 충돌 없음. 텍스트 변경만으로 ID 범위가 유지됨.
  - 제안: 이상 없음.

- **[INFO]** `button.types.spec.ts` 테스트 케이스 설명문 변경
  - target 신규 식별자: `"should fail when more than 10"` → `"passes with exactly 5"` + `"should fail when more than 5"` (테스트 description 문자열)
  - 기존 사용처: `button.types.spec.ts:105` — `it('should fail when more than 10 buttons', ...)`
  - 상세: 테스트 description 은 식별자 충돌 범주가 아니며 단순 문자열. 동일 describe 블록 안에서 description 이 충돌하지 않는 한 문제 없음.
  - 제안: 이상 없음.

---

### 요약

target plan `button-cap-spec-validator` 이 도입하는 신규 식별자는 `MAX_BUTTONS_PER_NODE` 상수 하나다. 이 심볼은 코드베이스 전체에 기존 사용처가 없으므로 직접적 식별자 충돌은 존재하지 않는다. `validateButtons`, `validateCarouselItemButtons`, `maxButtons` 는 모두 기존 식별자의 내부 값 변경에 해당하므로 충돌이 아니다. 주의할 점은 frontend 의 `maxButtons = 5` (default prop) 와 backend 의 `MAX_BUTTONS_PER_NODE = 5` 가 구조적으로 연결되지 않고 같은 숫자를 독립적으로 보유하는 구조라는 점이다 — 명명 충돌은 아니지만 단일 진실 원칙 관점에서 향후 유지보수 위험을 내포한다. 이는 plan 범위 내에서 JSDoc 명시나 공유 상수 추출로 보완 가능하며, 지금 당장 차단 사유는 아니다.

### 위험도

LOW
