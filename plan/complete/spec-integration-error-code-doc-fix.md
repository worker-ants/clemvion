---
name: spec-integration-error-code-doc-fix
worktree: .claude/worktrees/integration-error-code-doc-fix-9e3de0
status: in-progress
started: 2026-07-10
owner: project-planner
spec_impact:
  - spec/2-navigation/4-integration.md
  - spec/4-nodes/4-integration/0-common.md
---

# spec 정정 — 미연결 통합의 노드 실행 에러코드 (INTEGRATION_NOT_CONNECTED, pending_install 포함)

## 배경 (verified against code)

`INTEGRATION_NOT_CONNECTED` vs `INTEGRATION_INCOMPLETE` 문서 표기가 코드와 어긋난 pre-existing stale. 실 코드 검증:

- **노드·AI Agent 실행 경로**: `IntegrationHandlerBase.resolveIntegration()`
  (`codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:71-73`) 가
  `if (integration.status !== 'connected') throw IntegrationError('INTEGRATION_NOT_CONNECTED', …)`.
  → **`pending_install` 포함** 모든 비-connected 상태가 `INTEGRATION_NOT_CONNECTED`.
- **`INTEGRATION_INCOMPLETE`** 는 다른 맥락 전용 (변경 없음):
  - `testConnection`(POST /test) 의 `pending_install` 가드 → `INTEGRATION_INCOMPLETE`
    (`integrations.service.ts:948-951`, "complete install" 친화 신호). §9.3·Rationale 정확.
  - credential **필드 누락** 검증 (cafe24/makeshop `IncompleteCredentialsError`,
    http/db/email 핸들러) → `INTEGRATION_INCOMPLETE`. §4.2 credential 검증 행 정확.

즉 §6 line 726 이 "노드·AI Agent 에서 사용 불가 (`INTEGRATION_INCOMPLETE`)" 라 한 것은 **오기** —
노드 실행은 `resolveIntegration` 의 status 검사로 `INTEGRATION_NOT_CONNECTED` 를 throw 한다.
그리고 세 곳의 status 목록이 `(expired, error)` 로 `pending_install` 을 누락.

## 변경 (3곳, doc-only) — consistency-check --spec WARNING 반영 후 확정

1. `spec/2-navigation/4-integration.md` §6 (line 726): §4.6(#894) 구분 반영 재작성 — 직결 노드는 `resolveIntegration` status 검사로 `INTEGRATION_NOT_CONNECTED` 즉시 실패([공통 §4.2] 명시 cross-file 링크), **AI Agent 는 MCP bridge 가 tool 미노출로 호출·에러코드 자체 없음**(§4.6), 연결 테스트는 별도 `INTEGRATION_INCOMPLETE`(§9.3). (WARNING #2·#3 반영)
2. `spec/2-navigation/4-integration.md` 에러표 (line 1084): `INTEGRATION_NOT_CONNECTED | 상태가 expired/error` → `connected 가 아님 (expired/error/pending_install)`.
3. `spec/4-nodes/4-integration/0-common.md` §4.2 (line 83): `connected가 아님(expired, error)` → `(expired, error, pending_install)`.
- ~~4. `3-send-email.md`~~ **제외** (WARNING #1): email(SMTP)은 pending_install 도달 불가(cafe24/makeshop install 전용 + serviceType 우선 검사) — 추가 시 신규 부정확성.

## Rationale

- 코드가 SoT — spec 을 코드에 맞춘 정정(신규 결정 아님, 회귀 아님). `1-data-model §2.10` enum·`data-flow/5-integration` 스캐너는 이미 pending_install 포함 — 본 3곳이 stale outlier였음.
- `INTEGRATION_INCOMPLETE` 의 testConnection·credential-누락 용법은 유지 — 노드 실행 status 검사와 다른 축.
- **노드 vs AI Agent 구분(§4.6)**: 노드는 `resolveIntegration` throw(`INTEGRATION_NOT_CONNECTED`), AI Agent 는 `buildTools` 가 미연결 통합을 `status:'skipped'` 로 조용히 건너뜀(throw·에러코드 없음). §6 이 이를 반영하도록 정밀화.
- #894 의 §4.6 배너 서술이 이미 정확했고 그것이 §6/§4.2 stale 을 노출(커밋이 `task_6f46d7eb` 예고).
- (backlog, 차단 아님) `_product-overview INT-US-03`·`0-common §2` UI 경고 배지 축의 pending_install 포함 여부는 별도 검토.

## 워크플로
- [x] consistency-check --spec — **BLOCK: NO** (WARNING 3건 draft 반영)
- [x] spec 3곳 반영 (send-email 제외)
- [x] doc guard (spec-link-integrity + spec-area-index 36 pass)
- [x] commit + PR
