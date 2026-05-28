# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] label 필드 제거 — 전체적으로 기계적이고 일관된 변경
- 위치: 파일 1~9, 11~16, 18~19, 21~22 (18개 metadata 파일 전반)
- 상세: `label: '...'` 한 줄 제거가 operation 단위로 반복 적용됐다. 기계적 일괄 변경이므로 실수(누락·오삭제)의 흔적은 없다. 제거 후 각 operation 객체는 `id`, `description`, `scopeType`, `method`, `path`, `fields`, `constraints` 구조로 정렬되어 가독성이 오히려 개선됐다.
- 제안: 없음 (변경 자체는 의도적이고 완전함).

---

### [INFO] `types.ts` 주석 스타일 — 인터페이스 필드 제거 설명이 주석으로만 남음
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts` (파일 23)
- 상세: 제거된 `label: string` 자리에 두 줄짜리 주석을 삽입했다. 주석은 이주 날짜와 SoT 링크를 포함하고 있어 나중에 필드 삭제 배경을 추적하기에 좋다. 다만 TypeScript 인터페이스 본문에 주석만 단독으로 남는 형태라 동료가 인터페이스 정의를 읽을 때 "삭제된 필드를 설명하는 주석"처럼 보일 수 있다.
- 제안: 주석은 현재로서는 적절하다. 추후 clean-up PR 타이밍에 주석 자체도 제거해도 무방하다고 명기해두면 유지보수성이 높아진다.

---

### [INFO] `planned.ts` 주석 스타일 — 인터페이스와 동일한 패턴
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/planned.ts` (파일 12)
- 상세: `Cafe24PlannedOperationEntry` 인터페이스에서 `label: string` 삭제 뒤 두 줄 주석 삽입. `types.ts` 의 패턴과 일관성이 있다. 동일 이유로 이슈 없음.
- 제안: 없음.

---

### [INFO] `public-meta.ts` 함수 시그니처 변경 — 호출 방식이 두 곳에서 달라짐
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts` (파일 17), `buildCafe24Extras` 함수 내부
- 상세: `toPublicSupportedOperation(op)` / `toPublicPlannedOperation(op)` 에 두 번째 인수 `resource` 가 추가됐다. `buildCafe24Extras` 내부에서 `ops.map(toPublicSupportedOperation)` 을 point-free 스타일로 쓸 수 없게 되어 람다 `(op) => toPublicSupportedOperation(op, resource)` 로 감쌌다. 가독성 측면에서 명확하고 이유가 이해 가능한 변경이다. 단, `toPublicPlannedOperation` 이 `private` (파일 내 helper) 임에도 동일 패턴으로 처리되어 일관성 있다.
- 제안: 없음. 변경 의도와 구현이 잘 맞는다.

---

### [INFO] `resolveCafe24OperationLabel` 함수 — 역할·네이밍·배치 모두 적절
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (파일 25)
- 상세: 독립 helper 함수로 분리되어 단일 책임(catalog key → 사람 친화 라벨)을 명확히 한다. 함수명 `resolveCafe24OperationLabel` 은 목적을 정확히 나타낸다. 함수 본문 3줄, 복잡도 1 — 군더더기 없다.
- 제안: 없음.

---

### [WARNING] `integration-configs.tsx` — locale 스토어 직접 구독 방식이 기존 `useT()` 패턴과 상이함
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (파일 25), L411~415
- 상세: 컴포넌트 안에서 `useT()` 와 `useLocaleStore((s) => s.locale)` 두 훅을 병용한다. 같은 파일의 다른 텍스트는 `useT()` (nested key lookup) 를 쓰고, cafe24 operation 라벨만 `useLocaleStore` + 직접 import dict 방식을 쓴다. dot 포함 key 가 기존 `useT()` 의 nested lookup 과 충돌한다는 기술적 이유가 있어 우회가 불가피하지만, 두 패턴이 혼재하면 유지보수자가 "왜 이 부분만 다른가?"를 매번 추적해야 한다. 현재 함수 주석(JSDoc 블록)이 이 이유를 설명하고 있어 완화된다.
- 제안: JSDoc 주석이 이미 이유를 충분히 설명하므로 수용 가능. 향후 `useT()` 가 flat key 를 지원하게 된다면 패턴 통일이 가능하다. 현재는 현행 유지 권장.

---

### [INFO] `public-meta.spec.ts` 테스트 — 변경된 시그니처 대응이 완전함
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.spec.ts` (파일 16)
- 상세: 6개 테스트 케이스 모두 `toPublicSupportedOperation(meta)` → `toPublicSupportedOperation(meta, 'product')` 로 일관되게 수정됐다. `label` 확인 assertion 이 `labelKey` 확인으로 대체됐고, `pub.label` 이 `undefined` 임도 명시적으로 검증한다. 테스트 의도가 명확하다.
- 제안: 없음.

---

### [INFO] `constraint-validator.spec.ts` 주석 수정 — 정확도 향상
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.spec.ts` (파일 5)
- 상세: 주석에서 `id/label/etc. are not consulted` 를 `id/description/etc. are stubs` 로 수정하여 필드 실제 상황을 반영했다. 정확한 변경이다.
- 제안: 없음.

---

### [INFO] `cafe24-config.test.tsx` 테스트 픽스처 — mock 데이터 일관성 확보
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx` (파일 24)
- 상세: `PRODUCT_LIST_OP`, `PRODUCT_GET_OP`, `PLANNED_PRODUCT_COUNT` 세 픽스처 모두 `label` → `labelKey: "cafe24.product.<id>"` 로 수정됐다. 실제 `resolveCafe24OperationLabel` 이 사용하는 key 형식과 동일하여 일관성이 있다.
- 제안: 없음.

---

### [INFO] `frontend/src/lib/node-definitions/types.ts` — JSDoc 상세도 양호
- 위치: `codebase/frontend/src/lib/node-definitions/types.ts` (파일 26)
- 상세: `labelKey` 필드에 형식(`cafe24.<resource>.<id>`), SoT 링크, fallback 동작을 JSDoc 에 기술했다. `Cafe24PlannedOperation.labelKey` 는 "same shape as supported" 한 줄로 중복을 피했다. 적절한 수준의 문서화다.
- 제안: 없음.

---

### [INFO] `spec/conventions/cafe24-api-metadata.md` — 주석 내 설계 의도 문서화 수준
- 위치: `spec/conventions/cafe24-api-metadata.md` (파일 36), §7.5 및 §2
- 상세: `descriptionKey` 파생 규칙, fallback 정책, 책임 분리 이유가 모두 spec 문서에 명문화됐다. 이후 유지보수자가 backend / frontend 코드를 읽을 때 의도를 오해할 여지가 줄었다. spec §2 의 인터페이스 예시 코드에서도 `label` 이 제거됐고 대체 설명이 인라인 주석으로 추가됐다.
- 제안: §2 의 인라인 주석 `// 사람 친화 라벨은 본 metadata 에 보관하지 않는다 ...` 가 두 줄로 줄 바꿈됐는데, 코드 블록 내 주석 가독성을 위해 현재 줄 길이가 적당하다.

---

## 요약

이 PR 은 backend metadata 전반의 한국어 hardcoded `label` 필드를 일괄 제거하고, `/nodes/definitions` API 응답에 `labelKey` (catalog key) 를 추가하여 frontend i18n dict 가 단일 SoT 가 되도록 정리한 변경이다. 18개 metadata 파일의 변경은 기계적이고 일관되며, 핵심 로직 변경인 `public-meta.ts` 와 `integration-configs.tsx` 는 단일 책임 함수로 분리되어 가독성이 높다. 타입 정의(backend `types.ts`, frontend `types.ts`)와 테스트(spec, config test)가 동기되어 파편화 없이 완전하게 이주됐다. 유일한 유지보수성 주의 사항은 `integration-configs.tsx` 에서 `useT()` 와 `useLocaleStore` 두 패턴이 혼재하는 점이나, 기술적 이유(dot 포함 key의 nested lookup 충돌)가 명확하고 JSDoc 으로 설명되어 있어 실제 혼란 위험은 낮다.

## 위험도

LOW
