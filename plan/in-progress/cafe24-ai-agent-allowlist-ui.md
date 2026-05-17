---
worktree: TBD (follow-up)
started: 2026-05-17
owner: TBD
type: follow-up
---

# PLAN: AI Agent allowlist UI 의 ⚠ 별도 승인 라벨링

## 배경

`spec/4-nodes/4-integration/4-cafe24.md §8.3` AI Agent allowlist UI 가 카테고리 단위 grouping 으로 enabledTools 를 편집할 때 카페24 별도 승인 대상 카테고리/operation 에 ⚠ 라벨을 노출해야 한다.

현재 frontend (`components/integrations/mcp-server-selector.tsx`) 는 server (Integration) 단위 picker 만 제공하고 operation 단위 grouping UI 는 아직 advanced surface 로 구현 전. 본 PR (cafe24-restricted-scopes-a1b2c3) 의 범위 외로 분리.

## 본 PR 에서 이미 준비된 것

- backend `Cafe24OperationMetadata.restrictedApproval` + `public-meta.PublicCafe24OperationSupported.restrictedApproval` — frontend 가 사용 가능한 데이터는 이미 응답에 노출됨.
- frontend `Cafe24SupportedOperation.restrictedApproval` 타입 + 공통 컴포넌트 `ApprovalRequiredBadge`, `RestrictedScopeNotice` — 신규 화면에서도 그대로 재사용.
- i18n 키 (`integrations.approvalRequiredBadge` 등) — 이미 등록됨.

## 작업 항목 (advanced surface 도입 시)

- [ ] AI Agent allowlist UI 신설 (mcp-server-selector 에 expand 또는 별도 페이지)
- [ ] 카테고리 단위 grouping — `restrictedApproval.level==='scope'` 면 그룹 헤더 ⚠
- [ ] operation 단위 row — `restrictedApproval.level==='operation'` 면 행 단위 ⚠
- [ ] 공통 컴포넌트 재사용
