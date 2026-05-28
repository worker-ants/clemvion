# 부작용(Side Effect) 리뷰 — cafe24-mcp-label-i18n

## 발견사항

### [WARNING] `toPublicSupportedOperation` / `toPublicPlannedOperation` 시그니처 변경 — 호출자 영향
- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts` — `toPublicSupportedOperation` 및 내부 `toPublicPlannedOperation` 함수
- **상세**: 두 함수 모두 `resource: Cafe24Resource` 인자가 추가됨. `toPublicSupportedOperation` 은 exported이므로 이 파일 외부에서 직접 호출하는 코드가 있다면 컴파일 오류 발생. `toPublicPlannedOperation` 은 module-private 이라 외부 노출은 없음. 테스트(`public-meta.spec.ts`)는 이미 갱신되었고 `buildCafe24Extras` 내부 호출도 lambda 래핑으로 수정되어 있음. 실제 외부 직접 호출자가 없다면 안전하나, exported 함수 시그니처 변경임은 분명.
- **제안**: `toPublicSupportedOperation` 이 exported 함수이므로, codebase 전체에서 직접 임포트해 호출하는 곳이 없는지 추가 확인 필요. `grep -rn 'toPublicSupportedOperation' codebase/` 로 확인하고, 있다면 동일 PR 안에서 갱신.

### [WARNING] `/nodes/definitions` API 응답 shape 파괴적 변경 — `label` → `labelKey` 필드명 교체
- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts` (응답 생성) / `codebase/frontend/src/lib/node-definitions/types.ts` (소비 타입)
- **상세**: `PublicCafe24OperationSupported.label: string` 과 `PublicCafe24OperationPlanned.label: string` 이 `labelKey: string` 으로 교체됨. REST API 응답 shape가 변경되어 frontend ↔ backend 동시 머지가 의무적임(plan 에도 명시됨). 부분 배포(frontend만 머지) 시 드롭다운이 모두 raw labelKey(`cafe24.product.product_list` 등)를 노출하게 되어 UX 회귀 발생. 반대로 backend만 머지된 경우 `op.label` 참조 코드가 TypeScript 런타임에서 `undefined` 를 반환해 드롭다운 항목이 빈 문자열이 됨.
- **제안**: 배포 원자성 보장 필요. 동시 머지 불가능한 환경이라면 이행 기간 동안 `label` + `labelKey` 를 모두 응답에 포함하는 backward-compatible 중간 단계를 고려.

### [INFO] `Cafe24OperationMetadata` 에서 `label` 필드 완전 제거 — TypeScript 컴파일 오류가 남은 소비처 보호막
- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts`
- **상세**: `label: string` 이 인터페이스에서 제거되고 주석 처리됨. 기존에 `label` 을 읽는 코드가 있었다면 TypeScript 빌드 단계에서 즉시 오류로 잡히므로 런타임 부작용 위험은 낮음. `Cafe24McpBridge` 가 `op.description` 만 사용하고 `op.label` 을 사용하지 않는다는 점은 plan 에서도 확인됨.
- **제안**: CI 빌드(`tsc --noEmit`)가 통과하는 것을 확인하면 충분.

### [INFO] `integration-configs.tsx` 에 전역 스토어 구독 추가 (`useLocaleStore`)
- **위치**: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`, line 453
- **상세**: `Cafe24Config` 컴포넌트가 새로 `useLocaleStore((s) => s.locale)` 를 구독함. 로케일이 변경될 때마다 컴포넌트 리렌더가 발생하게 됨. 이 패턴은 다른 컴포넌트에서도 이미 광범위하게 사용 중이어서 아키텍처적으로 일관성이 있고 `useLocaleStore` 의 설계 의도와도 부합함. 전역 상태를 수정하지 않고 읽기만 하므로 부작용은 없음.
- **제안**: 조치 불필요.

### [INFO] `cafe24Catalog` dict 를 모듈 최상위에서 직접 import — 번들 크기 영향
- **위치**: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`, lines 8–9
- **상세**: `cafe24CatalogKo` 와 `cafe24CatalogEn` 두 dict 객체(`Record<string, string>`)가 모듈 최상위에서 정적으로 import됨. 이 파일이 로드될 때 두 dict가 모두 메모리에 올라감. dict 의 현재 크기(516줄 내외)는 작지만, 향후 operation 이 증가함에 따라 같이 증가함. 두 언어 dict 가 항상 동시에 로드되므로 현재 locale 과 무관한 dict 도 메모리에 상주함. 프로젝트 전반 lazy-loading 전략과의 정합성 검토가 필요할 수 있음. 단, 의도치 않은 부작용 범주(파일시스템·네트워크·이벤트 등)는 아님.
- **제안**: 현재 규모에서는 허용 가능. dict 가 현저히 커질 경우 locale 별 dynamic import 전환 검토.

### [INFO] `Cafe24PlannedOperationEntry.label` 인터페이스에서 제거 — planned 배열은 현재 모두 빈 배열
- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/planned.ts`
- **상세**: `Cafe24PlannedOperationEntry` 인터페이스에서 `label: string` 제거. plan 에서 "planned 배열이 모두 빈 배열이라 실질 영향 없음" 으로 명시되어 있고, 실제 `CAFE24_PLANNED_BY_RESOURCE` 가 빈 배열만 포함한다면 런타임 영향은 없음. 그러나 향후 planned entry 를 추가하는 개발자가 이전 인터페이스를 기억하고 `label` 을 포함한 객체를 작성할 경우, TypeScript 가 오류를 낼 것이므로 자연스럽게 보호됨.
- **제안**: 조치 불필요.

### [INFO] `constraint-validator.spec.ts` 테스트 내 stub 에서 `label` 제거
- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.spec.ts`
- **상세**: 테스트 헬퍼 `op()` 함수의 반환 객체에서 `label: 'test'` 제거. 테스트 파일 자체이므로 프로덕션 부작용 없음. 주석 문구도 `id`/`label` → `id`/`description` 으로 정합성 있게 갱신됨.
- **제안**: 조치 불필요.

---

## 요약

이번 변경의 핵심은 `Cafe24OperationMetadata.label` (한국어 하드코딩) 을 backend 에서 완전 제거하고, API 응답의 `label` 필드를 `labelKey` (`cafe24.<resource>.<id>` 형식 i18n 키) 로 교체하며, frontend 에서 `cafe24Catalog` dict lookup 으로 일원화하는 것이다. 부작용 관점에서 가장 중요한 리스크는 `/nodes/definitions` REST API 응답 shape 의 파괴적 변경(`label` → `labelKey`)으로, 이는 frontend ↔ backend 를 원자적으로 동시 배포하지 않으면 드롭다운 UX 회귀가 발생한다. 이 점은 plan 에 명시되어 있고 팀이 인지하고 있으나, 실제 배포 시 절차적 통제가 뒷받침되어야 한다. 그 외 전역 상태·파일시스템·네트워크·이벤트 관련 의도치 않은 부작용은 발견되지 않았으며, TypeScript 타입 시스템이 잔여 `label` 참조를 빌드 단계에서 차단하는 구조로 안전하게 설계되어 있다.

## 위험도

**LOW** — 의도치 않은 런타임 부작용은 없음. 유일한 실질 위험은 partial-deploy 시나리오의 API shape 불일치이며, 이는 운영 절차로 관리 가능하고 plan 에 이미 명시됨.
