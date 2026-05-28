---
worktree: cafe24-mcp-label-i18n
started: 2026-05-28
owner: developer
parent_branch: claude/integration-activity-api-label-ed0a6e
---

# Cafe24 operation 라벨 i18n 일원화

## 배경

직전 PR `integration-activity-api-label` 에서 cafe24 catalog 라벨의 i18n 책임 분리를 결정했다 (DB 는 catalog key, frontend dict 가 KO/EN 사람 친화 라벨 SoT). 그러나 backend `Cafe24OperationMetadata.label` (한국어 hardcoded) 는 그대로 두고 본 PR 에서 점진 이주하기로 결정했었다.

본 PR 은 그 이주의 마무리 — backend metadata 의 한국어 label 필드를 제거하고, frontend node editor 의 cafe24 operation 드롭다운도 `cafe24Catalog` dict lookup 으로 일원화한다.

## 영향 분석 (이미 grep 으로 확정)

`Cafe24OperationMetadata.label` 의 실제 소비처:

1. **`metadata/public-meta.ts:104, 122`** — `/nodes/definitions` API 응답에 `label: op.label` 그대로 노출
2. **frontend `integration-configs.tsx:484-490`** — cafe24 operation 드롭다운에서 `op.label` 렌더
3. **planned operations** (`metadata/planned.ts`) — 모든 resource 가 빈 배열이라 실질 영향 없음. type 만 유지

**`Cafe24McpBridge` 는 `op.description` (영문) 만 쓰고 `op.label` 은 사용 안 함** (확인됨, `cafe24-mcp-tool-provider.ts:761` `buildToolDescription`). 따라서 MCP bridge 개조 불필요 — 본 PR 의 작업 범위가 좁아짐.

## 변경 범위

### Spec
- `spec/conventions/cafe24-api-metadata.md §7.5` 의 책임 분리 표 갱신 — `Cafe24OperationMetadata.label` 의 완전 제거 명시. 신규 catalog key 형식 단독 SoT. dict lookup miss fallback 정책 (`labelKey` 자체 노출) 도 §7.5 본문에 포함
- §2 의 metadata 형식 정의에서 `label` 필드 **완전 제거** (deprecated 마크 아님)

### Backend
- `metadata/types.ts` — `Cafe24OperationMetadata` 에서 `label: string` 필드 제거
- 18 metadata 파일 — 모든 operation 의 `label: '...'` 라인 제거 (정규식 일괄)
- `metadata/public-meta.ts` — `PublicCafe24OperationSupported.label` 을 `labelKey: \`cafe24.${resource}.${op.id}\`` 로 교체. planned 도 동일 (label → labelKey)
- `metadata/planned.ts` `Cafe24PlannedOperationEntry` interface 에서 `label` 제거 (실 데이터 없음)
- 관련 spec 테스트 (`metadata.spec.ts`, `catalog-sync.spec.ts`) 갱신

### Frontend
- `integration-configs.tsx:484-490` — `op.label` → `t(\`cafe24Catalog.${op.labelKey}\`)` lookup. fallback: labelKey 자체 (`cafe24.<resource>.<operation>`) 또는 op.id. 어느 fallback 이 사용자에게 의미 있는지 결정 필요
- PublicCafe24Operation type 정의 갱신 (label → labelKey)

### Migration / 호환성
- DB 영향 없음 (compile-time 데이터)
- `/nodes/definitions` 응답 shape 변경: `label: string` → `labelKey: string`. 호환성 단절이라 frontend ↔ backend 동시 머지 필요
- 본 PR 머지 후 사용자 영향: cafe24 operation 드롭다운이 i18n dict lookup 으로 KO/EN 정상 표시 (회귀 없음)

## 의존성·리스크

- **선행 PR**: 본 PR 은 PR #338 (`integration-activity-api-label`, OPEN) 위에 stacked. §7.5 자체가 PR #338 에서 신설된 절이라 PR #338 머지 전에는 main 기준으로 본 PR 의 spec/code 변경이 적용 불가. **머지 순서**: PR #338 먼저 머지 → 본 PR rebase (필요 시) → 머지.
- **호환성 단절**: `/nodes/definitions` 응답 shape (`extras.operationsByResource[].label` → `labelKey`) 가 frontend ↔ backend 동시 머지 의무. partial deploy 환경에선 frontend 만 머지되면 드롭다운이 깨진다 — staging 머지 직후 e2e 회귀 확인.

## Phase

- [ ] Phase 0 — plan 작성, spec 영역 식별 (본 turn 일부)
- [ ] Phase 1 — spec 갱신 (project-planner 위임)
- [ ] Phase 2 — `consistency-check --impl-prep` 통과
- [ ] Phase 3 — backend: types/metadata 18 파일 label 제거 + public-meta.ts labelKey 도입
- [ ] Phase 4 — frontend: PublicCafe24Operation type 갱신 + integration-configs dict lookup
- [ ] Phase 5 — TEST WORKFLOW (lint/unit/build/e2e)
- [ ] Phase 6 — REVIEW WORKFLOW (/ai-review + RESOLUTION + 재테스트)
- [ ] Phase 7 — plan complete 이동

## 확정된 설계 결정

- backend `Cafe24OperationMetadata.label` 필드 **완전 제거** (deprecate 가 아님 — 실 소비처가 명확하고 frontend 갱신 동시에 가는 게 깔끔)
- `/nodes/definitions` 응답 의 `label` → `labelKey` 필드명 변경 (의미가 lookup key 라는 점 명시)
- frontend dict lookup 실패 시 fallback: catalog key 자체 그대로 노출 (사용자가 보면 어색하지만 dict 누락 즉시 감지 가능). 사용자 결정 필요 시 escalate

## 미해결 결정 사항

- (해소됨) frontend dict lookup miss 시 fallback 정책 — **catalog key 자체 그대로 노출**로 결정. spec §7.5 본문에 명문화 (drift 가 silent 하게 진행되는 것을 막기 위함). op.id 또는 임의 영문 변환은 채택하지 않음.
