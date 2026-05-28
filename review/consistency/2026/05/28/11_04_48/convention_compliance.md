# 정식 규약 준수 검토 결과

- **검토 대상**: `spec/conventions/cafe24-api-metadata.md`
- **검토 모드**: 구현 착수 전 검토 (--impl-prep)
- **검토 일시**: 2026-05-28

---

## 발견사항

### [WARNING] frontmatter `status: spec-only` 이나 `pending_plans:` 없고 구현 plan 존재

- **target 위치**: `spec/conventions/cafe24-api-metadata.md` frontmatter (lines 1–5)
  ```yaml
  ---
  id: cafe24-api-metadata
  status: spec-only
  code: []
  ---
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 — `spec-only` 는 "구현 의도 결정됨" 상태이며, TTL 90일 내 구현 plan 을 `pending_plans:` 로 등록하는 것이 권장(recommended). 단, 현재 시점에 이 컨벤션이 직접 구현하는 plan(`plan/in-progress/cafe24-mcp-label-i18n.md`)이 존재하고 §7.5·§2 label 제거 변경이 이미 본 PR 의 scope 에 포함되어 있다.
- **상세**: 본 컨벤션 문서는 `status: spec-only`이면서 실제 구현 변경(§7.5 신설, `label` 필드 제거)이 진행 중인 plan을 등록하지 않았다. `spec-impl-evidence.md` §3 의 TTL 90일 가드는 `spec-only` 상태에서 90일이 지나면 build fail 을 유발하는데, 이 파일의 최초 생성은 2026-05-13으로 이미 15일 경과한 시점이다. 하지만 가드 TTL 90일에는 아직 여유가 있다. 더 중요한 점은, 현재 진행 중인 `cafe24-mcp-label-i18n` 작업이 이 컨벤션 문서의 §2, §7.5를 변경하므로 `status: partial` + `pending_plans: [plan/in-progress/cafe24-mcp-label-i18n.md]` 로 갱신하는 것이 lifecycle 규약에 더 맞다. 단, 본 plan이 완료 후 merge 시점에 `implemented`로 승격하면 되므로 TTL 위반은 아니다.
- **제안**: 현재 PR이 완료·merge 되는 시점에 `status: partial → implemented` 로 승격하고 `code:` 배열에 실제 구현 경로를 채우는 것을 권장. 이 작업을 본 PR scope 에 포함하지 않는다면, 최소한 `pending_plans: [plan/in-progress/cafe24-mcp-label-i18n.md]` 를 추가해 partial로 갱신할 것을 권장.

---

### [INFO] `## Overview` 섹션 부재 — 3섹션 구조 권장 불완전

- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md "정보 저장 위치" — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`". 각 SKILL.md 의 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장.
- **상세**: 문서는 도입부 설명 단락 다음 바로 `## 1. 디렉토리 구조`로 시작해 `## Rationale` 로 끝나는 구조다. `## Overview` 명시 섹션이 없다. 단, `spec/conventions/spec-impl-evidence.md`를 포함한 다른 규약 파일들도 동일 패턴(explicit `## Overview` 없이 본문 바로 시작)을 취하고 있어 conventions 디렉토리 내 관행으로 굳어 있다. 이 파일만의 문제가 아니므로 규약 자체의 명시 여부를 재검토해야 한다.
- **제안**: 규약 파일 전반에 `## Overview` 생략 패턴이 이미 정착돼 있으므로 규약 갱신(CLAUDE.md 또는 SKILL.md 에 "conventions 파일은 Overview 섹션 생략 허용" 명시)을 권장. 단, 이 파일 자체 수정은 불필요.

---

### [INFO] `status: spec-only` 이지만 `code: []` — §6 절차 단계 8에서 언급한 테스트 파일들이 `code:` 에 누락

- **target 위치**: `spec/conventions/cafe24-api-metadata.md` frontmatter `code: []`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 — `spec-only` 는 `code:` 가 비어도 가드 통과. 위반은 아니다.
- **상세**: 문서 본문 §6 step 8에서 `metadata.spec.ts`, `catalog-sync.spec.ts` 가 언급되고, §2의 `constraints` invariant도 `metadata.spec.ts` 가 검증한다고 명시한다. 이 파일들은 본 컨벤션의 직접 구현 증거인데, `code: []` 로 비어 있다. `status: spec-only` 이므로 현재 가드 위반은 아니나, `implemented`로 승격 시 `code:` 를 채워야 한다.
- **제안**: merge 시 `status: implemented` 로 승격할 때 다음 경로들을 `code:`에 포함할 것:
  - `codebase/backend/src/nodes/integration/cafe24/metadata/**`
  - `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`
  - `codebase/backend/src/nodes/integration/cafe24/metadata/metadata.spec.ts`

---

### [INFO] CHANGELOG §9 — 날짜 역순 정렬 불일치

- **target 위치**: `spec/conventions/cafe24-api-metadata.md` §9 CHANGELOG, 마지막 세 row (lines 447, 446, 445)
  ```
  | 2026-05-28 | §7.5 신설 ... |
  | 2026-05-28 (label 제거) | §2 `Cafe24OperationMetadata.label` 필드 제거 ... |
  | 2026-05-22 (G-1 store + supply + impliesValue) | ... |
  ```
- **위반 규약**: 명시적인 CHANGELOG 정렬 규약은 `spec/conventions/` 에 없다. 단, 다른 CHANGELOG (예: `cafe24-api-catalog/_overview.md §7`) 는 시간 오름차순으로 정렬되어 있다.
- **상세**: 2026-05-22 행이 2026-05-28 행 두 개 다음(아래)에 등장한다. 삽입 위치가 시간 역순이 아니라 PR 작성 맥락상 "2026-05-22 G-1 store+supply+impliesValue" 가 가장 마지막에 추가된 것으로 보인다. 일관성 관점에서 소폭 이탈이지만, 정식 규약에서 CHANGELOG 순서를 명문화하지 않으므로 INFO 등급.
- **제안**: CHANGELOG 의 마지막 row를 시간순으로 정렬 (2026-05-22 행을 해당 날짜 위치로 이동). 또는 `spec/conventions/cafe24-api-metadata.md §9` 에 "가장 최근 항목을 마지막(하단)에 추가" 정책을 한 줄 명시.

---

## 요약

`spec/conventions/cafe24-api-metadata.md` 는 정식 규약(`spec/conventions/spec-impl-evidence.md`)의 frontmatter 스키마를 올바른 형식으로 준수하고 있으며, 문서 구조(본문 + `## Rationale`)도 다른 컨벤션 파일들과 동일한 패턴을 따른다. 명명 규약(`scopeType`, `approvalGroup` 등 충돌 회피 명칭), API 메타데이터 포맷, 카탈로그 동기 정책, MCP 매핑 규약 모두 자체 참조 정합성이 유지된다. 유일한 준수 주의 사항은 현재 진행 중인 `cafe24-mcp-label-i18n` 작업이 본 컨벤션을 직접 변경하므로, merge 완료 시점에 `status: spec-only → implemented`와 `code:` 배열 갱신이 필요하다는 점이다. 이를 놓치면 `spec-impl-evidence.md` §3 의 TTL 90일 가드가 2026-08-11 이후 build fail 을 유발할 수 있다. 금지 항목 위반은 발견되지 않았다.

## 위험도

LOW
