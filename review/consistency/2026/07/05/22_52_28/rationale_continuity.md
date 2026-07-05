### 발견사항

- **[WARNING]** `4-cafe24.md` §4 step 2 가 CONVENTIONS Principle 7 D1(spread 금지)을 명시적으로 위반
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §4 실행 로직, step 2 ("Config echo 빌드 (Principle 7): `context.rawConfig` 를 그대로 spread")
  - 과거 결정 출처: `spec/conventions/node-output.md` Principle 7 **D1** ("`config` echo 구현 방식 — 명시 enumeration 의무화" — "❌ 금지 — spread 패턴: `{ ...context.rawConfig }` … 이유: 1. credential leak 위험 … 2. 회귀 감지 곤란 … 3. dead field echo"). 같은 target 폴더 내 `1-http-request.md` §4 step 2 는 "Principle 7 D1 — 명시 열거, spread 금지" 를 인용하며 `{{ }}` 필드를 개별 참조로 명시 열거하고, `{ ...rawConfig }` spread 는 "향후 추가될 credential-shape 필드를 자동 누출시키므로 사용하지 않는다" 고 이유까지 재서술한다.
  - 상세: `4-cafe24.md` 는 같은 공통 규약(`0-common.md`) 아래 있는 형제 노드 문서이면서, D1 이 정확히 금지한 spread 패턴을 여전히 채택 중이라고 스스로 문서화한다. `plan/in-progress/http-ssrf-all-auth-followups.md` 는 D1 을 unit 테스트(credential 미포함 단언)로 능동 강제 중인 살아있는 컨벤션으로 취급하고 있어 폐기되거나 완화된 규칙이 아니다. 현재 cafe24 config 스키마(`integrationId`/`resource`/`operation`/`fields`/`pagination`)에 당장 credential-shape 필드가 없어 실질 누출은 없으나, D1 의 근거(스키마에 향후 민감 필드 추가 시 자동 누출) 가 바로 이런 case 를 겨냥한 것이라 "현재 안전"이 예외 정당화가 되지 못한다. `git blame` 상 이 spread 서술은 2026-05-14 부터 있었고 D1 강제(및 http-request 개정)는 그 이후 도입됐지만, cafe24.md 는 D1 채택 시점에 동반 갱신되지 않은 채 남아 있다 — 이번 세션의 신규 변경은 아니지만 target 문서 세트(`spec/4-nodes/4-integration`) 안에서 형제 문서 간 원칙 불일치가 여전히 존재한다.
  - 제안: (a) cafe24 handler 를 명시 enumeration 으로 리팩터링하고 spec 문구를 http-request.md 패턴과 정렬하거나, (b) cafe24 만의 예외(예: "`fields`/`pagination` 은 사용자 정의 key-value 라 열거가 무의미하고 스키마에 credential 필드가 구조적으로 존재할 수 없다")를 **새 Rationale 항목**으로 D1 옆에 명시해 예외를 성문화. 현재는 둘 다 없이 방치된 상태.

- **[INFO]** cafe24 §4.6(활동 로그 API 식별)와 `2-navigation/4-integration.md` Rationale "활동 로그 API 식별 — 3컬럼" 간 표기 정합은 양호하나, 최근 product.ts 메타데이터 대량 확장(커밋 `53e78c725`, `spec/4-nodes/4-integration/4-cafe24.md` 비변경)이 spec 의 field 개수·예시("`product_list` 8개 필드" 류)를 참조하는 문구가 없는지 재확인 권장
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` (본 세션 diff 없음)
  - 과거 결정 출처: 해당 없음 (신규 Rationale 요구 아님)
  - 상세: 이번 세션의 유일한 코드 변경(`53e78c725`)은 `codebase/backend/src/nodes/integration/cafe24/metadata/product.ts` 의 field 목록을 docs 기준으로 대폭 확장(예: `product_list` 8→57)한 것으로, `spec/4-nodes/4-integration/4-cafe24.md` 자체에는 field 개수나 alias(`since/until`, `category_no`) 를 하드코딩한 문구가 없어 직접적 stale 위험은 확인되지 않았다. `plan/in-progress/cafe24-backlog-residual.md` G-1-P 항목도 "SoT = cafe24-api-catalog 문서" 로 스코프해 spec 본문 변경 불요를 정확히 판단하고 있다.
  - 제안: 특별한 조치 불요. 향후 다른 resource(store 등)로 G-1-remaining 이 확장될 때도 동일하게 spec 본문이 field 개수를 언급하지 않는지 재확인.

### 요약

이번 세션에서 실제로 변경된 코드(`cafe24/metadata/product.ts` field-set 확장)는 `spec/4-nodes/4-integration/4-cafe24.md` 본문을 건드리지 않았고, 관련 Rationale(§9.9 "메타데이터 SoT", cafe24-api-metadata 컨벤션)과 충돌하지 않는다. 반면 target 문서 세트를 폭넓게 대조하는 과정에서, HTTP Request 문서가 최근 강화한 CONVENTIONS Principle 7 D1(config echo spread 금지, credential-leak 방지 근거)을 같은 폴더의 Cafe24 문서가 여전히 위반 서술 중인 **형제 문서 간 원칙 불일치**를 발견했다. 이는 이번 PR 이 유발한 신규 위반은 아니고 이전부터 존재한 gap 이지만, D1 이 활성 강제 중인 컨벤션(unit test 로 뒷받침)이라는 점에서 rationale 연속성 관점의 잔존 리스크로 보고할 가치가 있다. 그 외 SSRF 관련 Rationale 체인(§8.2 all-auth 적용 → §8.3 메시지 일반화, DB/Email 대칭)과 D4(throw→error 포트 전환) 계열은 근거·기각 대안·breaking-change 고지가 모두 갖춰져 있어 연속성 문제가 없다.

### 위험도
LOW
