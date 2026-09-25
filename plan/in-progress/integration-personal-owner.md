---
title: Personal 통합 소유자 강제 — 목록 · :id 경로 · oauth/begin · precheck · 워크플로우 어시스턴트
status: in-progress
owner: developer
worktree: integration-personal-owner
spec_impact:
  - spec/2-navigation/4-integration.md
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

## 체크리스트

- [ ] `--impl-prep`
- [ ] 테스트 선작성(unit) — 경로별 «남의 personal → 404 · 역할 무관», «Organization 변경 → 비Admin 403», «본인 personal → 통과»
- [ ] 구현
- [ ] 뮤턴트 — 술어 · 각 경로의 판정 제거가 테스트에 잡히는지
- [ ] e2e — 다중 액터(Admin · Editor · Viewer · 생성자) 권한 경계
- [ ] 사용자 가이드(`integration-management.mdx` + en) — personal 은 생성자만 보인다 · Organization 변경은 Admin
- [ ] CHANGELOG — 제품 동작 변경(보이는 범위 · Editor 권한 축소) + 보안 수정(reauthorize)
- [ ] TEST WORKFLOW — lint · unit · build · e2e
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기
