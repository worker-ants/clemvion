# 문서화(Documentation) 리뷰 — cafe24-mcp-label-i18n

리뷰 일시: 2026-05-28
대상 파일: 29개 (metadata 18개 + public-meta 2개 + types 2개 + frontend 3개 + plan/review 문서)

---

## 발견사항

### [INFO] `public-meta.ts` — `toPublicSupportedOperation` JSDoc 파라미터 누락
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts`, `toPublicSupportedOperation` 함수 서명
- 상세: 함수에 기존 JSDoc 블록이 있으나, 신규 추가된 `resource: Cafe24Resource` 파라미터에 대한 `@param` 설명이 누락되었다. `toPublicPlannedOperation` (private 함수)도 동일하게 `resource` 파라미터 추가 후 문서 없음.
- 제안: `toPublicSupportedOperation` JSDoc 에 `@param resource - Cafe24 resource 식별자. labelKey 생성에 사용 (cafe24.<resource>.<id> 형식).` 추가. private 함수인 `toPublicPlannedOperation` 은 선택사항.

---

### [INFO] `types.ts` — 제거된 `label` 필드 처리 방식이 주석과 코드 표현의 분리
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts`, `Cafe24OperationMetadata` 인터페이스
- 상세: `label` 필드를 삭제하면서 인터페이스 본문 내에 `// label 필드는 frontend i18n dict 로 이주됨 (2026-05-28). SoT: spec/conventions/cafe24-api-metadata.md §7.5.` 주석을 남겼다. 삭제 이유를 설명하는 의도는 좋으나, 이미 필드가 완전 삭제된 자리에 사유 주석을 인터페이스 본문에 인라인으로 남기는 방식은 향후 혼란을 유발할 수 있다. 보통 이런 설명은 JSDoc 또는 CHANGELOG 에 두는 것이 관례다. CHANGELOG 는 이미 spec §9 에 잘 기록되어 있으므로, 인터페이스 본문의 잔류 주석은 6개월 뒤 "이게 무슨 뜻이지?" 의문을 낳을 수 있다.
- 제안: 인라인 주석을 제거하거나, JSDoc 의 `@deprecated` 또는 `@see` 섹션으로 이동. spec §9 CHANGELOG 에 이미 기록되어 있으므로 코드에 중복 설명이 불필요하다.

---

### [INFO] `planned.ts` — 동일한 이주 주석이 `Cafe24PlannedOperationEntry` 인터페이스에 잔류
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/planned.ts`, `Cafe24PlannedOperationEntry` 인터페이스
- 상세: `types.ts` 와 동일하게 `// label 필드는 frontend i18n dict 이주 (2026-05-28). SoT: spec/conventions/cafe24-api-metadata.md §7.5.` 주석이 삭제된 필드 자리에 남아 있다. 인터페이스가 단순하고 두 라인으로 작은 상황에서 이 주석이 공간의 절반을 차지한다.
- 제안: `types.ts` 와 동일한 처리 — 주석 제거 또는 JSDoc 으로 이동.

---

### [INFO] `integration-configs.tsx` — `resolveCafe24OperationLabel` 함수 JSDoc 위치 이상
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`, `resolveCafe24OperationLabel` 함수 직전
- 상세: JSDoc 블록(`/** ... */`) 이 앞의 일반 block comment(`/* ... */`) 와 연속으로 등장한다. 코드 상 위에 `/** surfaced as hint text ... */` 로 시작하는 이전 함수의 JSDoc 종료 후 새 함수의 JSDoc 가 바로 이어지는데, git diff 상 `+/**` 위에 `*/` 종료 줄이 보인다. 결과적으로 함수 문서는 잘 작성되어 있다. 다만 `locale: "ko" | "en"` 파라미터 타입과 `labelKey: string` 파라미터 설명이 JSDoc 에 `@param` 형식으로 없다.
- 제안: `@param locale` 및 `@param labelKey` 설명을 JSDoc 에 추가하면 IDE 호버 시 즉시 확인 가능.

---

### [INFO] `integration-configs.tsx` — 인라인 주석의 한국어/영어 혼용
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`, `Cafe24Config` 함수 내 `locale` 선언 직후 주석
- 상세: `// Cafe24 operation 라벨은 i18n 의 nested key 시스템과 호환되지 않는 / flat dict (cafe24Catalog.<dotted-key>) 이라 locale 스토어를 직접 보고 / dict 를 import 해서 lookup한다. SoT: spec §7.5.` 주석은 한국어로 잘 작성됐다. `SoT: spec §7.5` 는 파일 내 다른 주석들의 표기 방식과 일치한다. 특별한 문제는 없으나, 파일 내 일부 다른 JSDoc/주석은 영어로 작성되어 있어 일관성이 부분적으로 깨진다. 코드베이스 전체의 언어 정책이 명확하지 않다면 정보 수준의 지적.
- 제안: 코드베이스가 한국어 인라인 주석을 허용하는 방향이라면 현 상태 유지. 영어 JSDoc 기준이라면 번역 필요.

---

### [INFO] `constraint-validator.spec.ts` — JSDoc helper 설명이 갱신되었으나 불완전
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.spec.ts`, `op` 헬퍼 함수 JSDoc
- 상세: 변경 전 `id/label/etc.` → 변경 후 `id/description/etc.` 로 정확하게 갱신되었다. 이 변경은 올바르다. 다만 `id: 'test_op'` 와 `description: 'test'` 만 남고 `label` 이 제거된 내용이 타입 스텁 설명에 반영됐다. 완전히 정합성이 유지된다.
- 제안: 추가 수정 불필요.

---

### [WARNING] `cafe24Catalog` KO dict JSDoc — `backend metadata.label 에서 자동 추출` 표현이 이제 사실과 다름
- 위치: `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts`, 파일 상단 JSDoc (1-13줄)
- 상세: JSDoc 의 `라벨은 backend metadata.label 에서 자동 추출` 이라는 설명이 이번 PR 의 핵심 변경 (`backend metadata.label 완전 제거`) 과 직접 충돌한다. 이제 `label` 은 backend metadata 에 없으므로 "자동 추출" 이라는 설명은 오해를 유발한다. dict 의 실제 SoT 는 이제 `operation.id` + 수동 한국어 라벨이다.
- 제안: 해당 문장을 `라벨은 operation id 및 의미에 기반해 수동 작성. 새 operation 이 추가되면 같은 PR 안에서 본 dict + EN 동반 갱신.` 으로 교체. (또는 단순히 "자동 추출" 표현만 제거.)

---

### [INFO] `cafe24Catalog` EN dict JSDoc — `Auto-derived from backend metadata.label` 과 유사한 오해 소지
- 위치: `codebase/frontend/src/lib/i18n/dict/en/cafe24Catalog.ts`, 파일 상단 JSDoc (1-9줄)
- 상세: `Auto-derived from operation.id (snake_case → verb + nouns).` 는 영어 라벨의 생성 방식을 설명하므로 KO dict 와 달리 `metadata.label` 을 직접 언급하지 않는다. 그러나 `KO sibling at dict/ko/cafe24Catalog.ts is the SoT for catalog meaning` 이라는 표현은 여전히 유효하다. 이 파일의 문서는 현재 변경과 충돌하지 않는다.
- 제안: 추가 수정 불필요.

---

### [INFO] `public-meta.spec.ts` — 테스트 설명 문자열이 새 의도를 잘 반영함
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.spec.ts`
- 상세: `'preserves id, scope, paginated, description, and emits labelKey'` 로 테스트 설명이 갱신되어 변경된 동작을 명확히 설명한다. 인라인 주석 `// INT-US-05 + spec/conventions/cafe24-api-metadata.md §7.5 — label is gone...` 도 맥락을 잘 제공한다. 좋은 문서화 사례.
- 제안: 추가 수정 불필요.

---

### [INFO] `plan/in-progress/cafe24-mcp-label-i18n.md` — phase 체크박스 미완료 상태
- 위치: `plan/in-progress/cafe24-mcp-label-i18n.md`, Phase 섹션
- 상세: 모든 phase 가 `[ ]` (미완료) 로 표시되어 있다. 실제로 Phase 0~4 는 이미 완료된 것으로 보인다 (spec 갱신, backend 변경, frontend 변경 모두 이 PR 에 포함됨). plan 파일의 phase 상태가 구현 현황을 정확히 반영하지 않는다.
- 제안: 완료된 phase 를 `[x]` 로 갱신하거나, plan 을 `plan/complete/` 로 이동. plan-lifecycle 규약에 따라 머지 전 이동 필요.

---

### [INFO] `spec/conventions/cafe24-api-metadata.md` — `spec-only` status 이나 구현 이미 진행 중
- 위치: `spec/conventions/cafe24-api-metadata.md` frontmatter
- 상세: consistency check (파일 30) 에서 이미 지적됐으나, 문서화 관점에서도 같은 이슈: `status: spec-only`, `pending_plans: []` 인 상태에서 이 PR 이 해당 spec 을 직접 구현하므로 merge 시 `status: partial` 또는 `implemented` 로 갱신하고 `code:` 배열을 채워야 한다. 미갱신 시 TTL 90일 (2026-08-11) 초과 후 build fail 가능.
- 제안: merge 시 frontmatter 를 `status: implemented`, `code: [codebase/backend/src/nodes/integration/cafe24/metadata/**, codebase/frontend/src/lib/i18n/dict/*/cafe24Catalog.ts, ...]` 로 갱신.

---

## 요약

이번 변경은 backend `Cafe24OperationMetadata.label` 필드를 완전 제거하고 frontend i18n dict lookup (`labelKey`) 으로 일원화하는 작업으로, 아키텍처 결정 자체는 `spec/conventions/cafe24-api-metadata.md §7.5` 와 plan 문서에 잘 기록되어 있다. 핵심 공개 인터페이스(`PublicCafe24OperationSupported`, `Cafe24SupportedOperation`)의 `labelKey` 필드에 JSDoc 이 추가되어 있고, `resolveCafe24OperationLabel` 함수에도 fallback 정책이 명시되어 있다. 다만 두 가지 실질적 문제가 존재한다: (1) `cafe24Catalog` KO dict 의 JSDoc 가 삭제된 `backend metadata.label` 을 여전히 "SoT" 로 지칭하고 있어 향후 기여자가 이미 없는 필드를 찾아 헤맬 수 있고, (2) `types.ts` 와 `planned.ts` 의 인터페이스 본문 내 이주 사유 인라인 주석이 장기적으로 의문을 유발할 수 있다. plan phase 미갱신과 spec frontmatter 미승격도 추적이 필요하다.

## 위험도

LOW

---

STATUS: SUCCESS
