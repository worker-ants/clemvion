---
title: Personal 통합 소유자 강제 — 목록 · :id 경로 · oauth/begin · precheck · 워크플로우 어시스턴트
status: in-progress
owner: developer
worktree: integration-personal-owner
spec_impact:
  - spec/2-navigation/4-integration.md
  - spec/3-workflow-editor/4-ai-assistant.md
  - spec/5-system/3-error-handling.md
  - spec/4-nodes/4-integration/_product-overview.md
started: 2026-09-25
---

# Personal 통합 소유자 강제

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «personal-scope 통합의 «본인 것만» 소유자 검증이 코드에
없다» 를 닫는다. spec 은 같은 PR 의 planner 커밋이 `spec/2-navigation/4-integration.md §8` «판정 규칙» 으로 적었다(draft
`plan/in-progress/spec-draft-integration-personal-owner.md` — 사용자 결정 셋 포함). 이 plan 은 그 규칙을 구현한다. 노드 실행 시점 등
나머지는 `plan/in-progress/integration-personal-owner-followup.md`(spec `pending_plans`).

## 요구 (spec §8 판정 규칙)

1. **보이는가** — `scope !== 'personal' || created_by === 요청자`. 아니면 없는 통합과 같은 `404 RESOURCE_NOT_FOUND`. 역할 우위 없음.
   - 목록 `GET /api/integrations` — SQL 에서 걸러낸다(페이지네이션 · `total` 이 남의 personal 을 세지 않도록).
   - `:id` 경로 전부: 상세 · 사용처 · 활동 · 연결 테스트 · 별칭 수정 · 삭제 · rotate(락 안 재읽기 포함) · reauthorize ·
     request-scopes · scope 전환.
   - `oauth/begin` 의 `reauthorize` · `request_scopes` 모드(`integrationId` 지정) — `:id` 경로와 같은 판정.
   - precheck(cafe24 · makeshop) — 충돌은 알리되 남의 personal 이면 `existingIntegrationId` · `existingName` 생략.
   - 워크플로우 어시스턴트 — `list_integrations` 도구 · 노드 후보(integration-selector · mcp-server-selector).
2. **Organization 변경은 Admin 이상** — 별칭 수정 · 삭제 · reauthorize(신규) · 생성 · rotate · request-scopes · scope 전환(기존).
   거부 `403 ADMIN_REQUIRED`(공유 표 `ROLE_REQUIRED.admin` 의 코드 + 동작별 문구) — 기존 4곳의 `FORBIDDEN` 도 함께 올린다(spec §8).
3. 판정 순서 — 보이는가(404) → Organization 이면 Admin(403). 남의 personal 에는 역할과 무관하게 404 만.

## 설계

- `modules/integrations/integration-visibility.ts` — 순수 술어 `isIntegrationVisibleTo(row, userId)` 와 SQL 절
  `integrationVisibilityClause(alias)` 를 한 파일에 둔다. 서비스 · OAuth 서비스 · 어시스턴트 도구가 같은 규칙을 쓴다.
- `IntegrationsService` — `requireVisible(id, ws, userId)`(404) · `assertCanModify(row, role, action)`(403 `ADMIN_REQUIRED`, 종전 `assertCanRotate` 일반화) ·
  공개 `requireModifiable(id, ws, userId, role, action)`(둘을 합친 것, `oauth/begin` 이 쓴다). `requireEntity` 는 실행 엔진
  (`getForExecution`) 전용으로 남긴다 — 후속 plan 범위.
- 컨트롤러 — 해당 핸들러에 `@CurrentUser()` · `resolveRole` 를 붙여 서비스로 넘긴다.
- **완결성 안전망 (`--impl-prep` W2)** — 판정이 핸들러별 수동 배치라 새 `:id` 라우트가 빠질 수 있다(라우트별 수동 부착 누락이
  이 저장소에서 두 번 났다 — `data-flow/12-workspace.md` Rationale «멤버십 검증은 가드 1곳에서» · «경로 파라미터 워크스페이스도 가드가
  본다»). 컨트롤러 캐너리 테스트가 `IntegrationsController` 의 `:id` 경로 핸들러를 **리플렉션으로 전수** 세고, 각 핸들러를 실제
  `IntegrationsService` 에 물려 «남의 personal → 404» 를 확인한다. 새 `:id` 라우트는 이 표에 올리기 전까지 테스트가 실패한다.

## `--impl-prep` 처리 (`review/consistency/2026/09/25/21_49_24` — BLOCK: NO, WARNING 5)

| # | 지적 | 처분 |
| --- | --- | --- |
| W1 · W3 | 어시스턴트 spec(`4-ai-assistant.md`)의 통합 목록 · 후보 계약이 §8 을 반영하지 않음 | planner 보강 draft `spec-draft-integration-personal-owner-assistant.md` → `--spec` `22_00_14` BLOCK: NO → 반영(`1e7ee5123`). `spec_impact` 추가 |
| W2 | 판정이 핸들러별 수동 배치 — 완결성 안전망 없음 | 컨트롤러 `:id` 라우트 전수 캐너리(위 «설계») |
| W4 | `FORBIDDEN → ADMIN_REQUIRED` 가 `error-codes.md §5` Rename 이력에 없음 | **해당 없음 — 실측.** §5 머리말은 «구 코드는 더 이상 발행되지 않는다(코드베이스에서 완전 제거)» 는 retired 코드만 받는다. `FORBIDDEN` 은 전역 기본값으로 계속 발행된다. 같은 성격의 `#1399` 가드 변경(`FORBIDDEN` → `ADMIN_REQUIRED` 등)도 §5 에 없다 |
| W5 | `3-error-handling.md §1.2` `ADMIN_REQUIRED` 행을 다른 열린 항목(트래커 «`removeMember` 리팩터로 낡은 spec 서술 세 줄» 표 #2)과 겹쳐 편집 | 그 항목에 조율 각주 — 이 PR 이 행을 먼저 편집했고 남은 것은 `removeMember` 한 발행처 |

## 체크리스트

- [x] `--impl-prep` — `21_49_24` BLOCK: NO, 처리 위
- [ ] 테스트 선작성(unit) — 경로별 «남의 personal → 부재와 같은 404 · 역할 무관», «Organization 변경 → 비Admin 403 `ADMIN_REQUIRED`»,
      «본인 personal → 역할 무관 통과», 어시스턴트 도구 · 후보는 남의 personal 을 **목록에서 조용히 뺀다(에러 아님)**
- [ ] 컨트롤러 `:id` 라우트 전수 캐너리(W2)
- [ ] 구현
- [ ] 뮤턴트 — 술어 · 각 경로의 판정 제거가 테스트에 잡히는지
- [ ] e2e — 다중 액터(Admin · Editor · Viewer · 생성자) 권한 경계
- [ ] 사용자 가이드(`integration-management.mdx` + en) — personal 은 생성자만 보인다 · Organization 변경은 Admin
- [ ] CHANGELOG — 제품 동작 변경(보이는 범위 · Editor 권한 축소) + 보안 수정(reauthorize)
- [ ] TEST WORKFLOW — lint · unit · build · e2e
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기
