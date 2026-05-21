# 문서화(Documentation) 리뷰 결과

검토 일시: 2026-05-21  
검토 대상: cafe24-planned-impl-060c7f worktree — Batch 2-A~2-E / Batch 3-A / planned.ts 정리 / plan 파일 / consistency review 산출물

---

## 발견사항

### [INFO] order.ts / product.ts / store.ts — 모듈 레벨 독스트링 없음

- 위치: `/codebase/backend/src/nodes/integration/cafe24/metadata/order.ts` 1행, `/codebase/backend/src/nodes/integration/cafe24/metadata/product.ts` 1행, `/codebase/backend/src/nodes/integration/cafe24/metadata/store.ts` 1행
- 상세: `planned.ts` 는 파일 최상단에 JSDoc 블록이 있어 파일의 역할·SoT 위치·drift 검출 방식을 설명한다. 반면 `order.ts`, `product.ts`, `store.ts` 는 모듈 레벨 주석이 전혀 없이 import 문에서 바로 배열 선언으로 시작한다. 동일한 패키지 내 파일 간 문서화 수준 불일치가 발생한다.
- 제안: `planned.ts` 의 헤더 블록을 참고하여 각 파일 상단에 최소한 "어떤 resource 의 supported operations 를 담는 파일인지", "SoT 가 catalog MD 임", "catalog-sync.spec 에 의해 동기 가드됨" 을 한 블록으로 기재한다.

---

### [INFO] 새로 추가된 operation 항목 — body 필드 누락 문서화

- 위치: `product.ts` 의 `product_variants_update`, `product_additionalimages_update`, `product_decorationimages_update`, `product_icons_update` 등 다수 PUT/POST 항목; `order.ts` 의 `order_cancellation_create`, `order_exchange_create`, `order_items_create`, `order_items_update` 등
- 상세: 추가된 entries 의 `fields` 객체는 대부분 path 파라미터만 정의하고 있다. PUT/POST 시 실제 body 에 필요한 필드(예: 수정할 variant 속성, 취소 사유, 교환 사유 등)가 명시되지 않은 채 `fields: { product_no: {...} }` 한 줄만 있다. 이는 metadata 레이어 설계상 의도된 최소 정의일 수 있으나, 그 의도가 어디에도 주석으로 설명되지 않는다.
- 제안: 각 `Cafe24OperationMetadata` 타입 정의(`types.ts`) 또는 `_overview.md` §6 등재 절차에 "body 필드는 Cafe24 공식 API 문서를 직접 참조 — metadata 에는 path/query 파라미터만 명시" 라는 설계 결정을 한 줄 기재한다. 그래야 이후 유지보수자가 "body 필드를 왜 안 넣었지?" 라는 의문을 해소할 수 있다.

---

### [INFO] Batch 구분 인라인 주석의 일관성

- 위치: `order.ts` 350행 이후 추가분의 `// Batch 3-A — ...` 주석; `product.ts` 의 `// Batch 2-A — ...`, `// Batch 2-B — ...` 등
- 상세: Batch 구분 주석 형식은 유용하나 `order.ts` 의 경우 전체 추가분이 `Batch 3-A` 단일 주석 하나로만 표기되고, `product.ts` 는 `2-A` ~ `2-E` 까지 sub-batch 별로 별도 주석이 달려 있어 일관성이 없다. 리뷰어가 git blame 으로 batch 경계를 찾을 때 `order.ts` 에서는 sub-batch 경계를 주석으로 구분할 수 없다.
- 제안: `order.ts` 에도 `product.ts` 처럼 `// Batch 3-B — ...`, `// Batch 3-C — ...` 구분 주석을 해당 항목 앞에 삽입한다. 단, 현재 diff 기준 3-A batch 만 추가되어 있으므로, 이후 3-B~3-G 진행 시 패턴을 통일하면 된다.

---

### [WARNING] planned.ts — `product: []`, `order: []` 빈 배열 전환에 대한 주석 없음

- 위치: `planned.ts` 의 `product: []`, `order: []` 항목
- 상세: `product` 와 `order` 배열이 `[]` 로 비워졌다. 이는 49개 product / 89개 order planned 항목이 모두 supported 로 승격되었음을 의미하지만, 코드만 보면 "원래부터 빈 배열이었는지", "언제 비워졌는지" 알 수 없다. 파일 헤더 JSDoc 은 "배열에서 항목을 제거하는 행위" 의 의미를 설명하지만 완전히 비워진 상태의 의미는 별도로 설명하지 않는다.
- 제안: 빈 배열 옆에 단행 주석으로 `// fully implemented — all rows promoted to supported (2026-05-21)` 를 추가한다. 또는 파일 헤더 JSDoc 에 "배열이 [] 이면 해당 resource 의 모든 operations 가 구현 완료된 상태" 임을 한 줄 보충한다. `store` 배열처럼 privacy_* 6건이 남아 있는 경우와 구별되어 가독성이 높아진다.

---

### [INFO] plan 파일 — 결정 로그 섹션의 Phase 1 종료 기록 미완

- 위치: `/plan/in-progress/cafe24-planned-implementation.md` §결정 로그 `2026-05-21 — Phase 1 종료` 섹션 (diff 1385~1401행)
- 상세: Phase 1 종료 기록에 "lint pre-existing 22 problem" 에 대한 결론이 "별도 후속 plan … 또는 본 PR 안 별 commit 으로 … 단 본 plan §Scope 밖이므로 우선 진행 후 처리" 로 미결 상태로 기술되어 있다. 결정이 확정되지 않은 채 plan 에 기록되어 있어, 후속 작업자가 어떤 결론이 났는지 알 수 없다.
- 제안: lint 처리 방향이 확정된 시점에 해당 단락을 갱신하거나, `## 결정 로그` 에 별도 항목으로 "2026-05-21 — lint pre-existing: 후속 plan X 에 포함" 형태로 결론을 기재한다.

---

### [INFO] plan 파일 — Phase 4 체크박스 미완 항목이 `/ai-review` 로 표기됨

- 위치: `/plan/in-progress/cafe24-planned-implementation.md` Phase 4 섹션 (diff 1285~1288행)
- 상세: `- [ ] /ai-review SUMMARY 0 Critical / 0 Warning 확보` 항목은 plan 파일 내에서 아직 미완료로 표기되어 있는데, 현재 본 리뷰가 바로 그 과정이다. 리뷰 완료 후 해당 체크박스를 닫는 절차가 plan 에서 명시되어 있지 않다 (자동으로 누가 닫는지 불명).
- 제안: Phase 4 의 `/ai-review` 항목 아래에 "결과 반영: `review/code/<날짜>/SUMMARY.md` 확인 후 수동 체크" 를 주석으로 추가한다. 또는 developer SKILL.md 에 리뷰 종료 후 plan 체크박스 닫기 절차를 명시한다.

---

### [INFO] consistency review 산출물 — `_retry_state.json` 의 문서화 목적 불명

- 위치: `/review/consistency/2026/05/21/07_31_53/_retry_state.json`
- 상세: `_retry_state.json` 은 내부 오케스트레이터 상태를 저장하는 파일이나, 리뷰 디렉토리에 그대로 커밋되어 있다. 파일 최상단이나 `SUMMARY.md` 어디에도 이 파일의 목적("재시도 상태 추적용 임시 파일인지", "영구 보존 산출물인지")이 설명되지 않는다.
- 제안: `subagent-call-contract.md` 또는 consistency-checker SKILL.md 에 `_retry_state.json` 이 review 세션 디렉토리에 커밋되는 이유와 이후 정리 정책(삭제 여부, 보존 기간)을 한 단락으로 기술한다.

---

## 요약

이번 변경의 핵심은 TypeScript metadata 배열 rows 의 대규모 추가(product 49개, order 일부)와 `planned.ts` 정리다. 문서화 관점에서 가장 큰 공백은 `order.ts` / `product.ts` / `store.ts` 가 `planned.ts` 와 달리 모듈 레벨 JSDoc 이 없다는 점이다. 추가된 operation 항목 자체는 `id`, `label`, `description`, `scopeType`, `method`, `path`, `requiredFields`, `fields`, `responseShape` 필드를 모두 갖추고 있어 개별 엔트리 레벨의 문서화는 일관적이다. 그러나 "body 필드를 metadata 에 왜 포함하지 않는가"라는 설계 결정이 어디에도 명시적으로 기록되지 않아 유지보수자에게 의문을 남긴다. plan 파일의 결정 로그와 Phase 4 미완 체크박스 처리 절차도 경미한 보완이 필요하다. `planned.ts` 의 빈 배열 전환은 주석 한 줄로 의도를 명확히 할 수 있다. 전반적으로 심각한 문서화 부재는 없으며, 발견사항은 모두 INFO 또는 WARNING 수준이다.

---

## 위험도

LOW

STATUS: SUCCESS
