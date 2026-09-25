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

## 뮤턴트 (예측 / 실측)

원복은 cp(절대경로), 커밋 뒤에 돌렸다. 하네스: scratch `mutants_ipo.py`.

| # | 뮤턴트 | 예측 | 실측 |
| --- | --- | --- | --- |
| P1 | 가시성 술어 항상 참 | KILLED | KILLED — 60 failed |
| P2 | 술어가 scope 를 안 봄(생성자만) | KILLED | KILLED — 42 failed(Organization 이 남에게 안 보임) |
| P3 | 목록 SQL 필터 제거 | KILLED | KILLED — 2 failed(서비스 · 컨트롤러) |
| P4 | `requireVisible` 가 가시성 안 봄 | KILLED | KILLED — 50 failed |
| P5 | `assertCanModify` 무력화 | KILLED | KILLED — 18 failed |
| P6 · P7 · P8 | reauthorize · update · remove 가 Admin 판정 없이 가시성만 | KILLED | KILLED — 각 4 · 2 · 2 failed |
| P9 | rotate 락 안 가시성 재판정 제거 | KILLED | KILLED — 1 failed |
| P10 | `oauth/begin` 판정 제거 | KILLED | KILLED — 5 failed |
| P11 | `oauth/begin` 이 reauthorize 만 판정 | KILLED | KILLED — 2 failed(request_scopes · request-scopes) |
| P12 | precheck 식별자 항상 노출 | KILLED | KILLED — 3 failed |
| P13 | 어시스턴트 목록 SQL 필터 제거 | **SURVIVED** | SURVIVED → 테스트 추가 후 KILLED(1) |
| P14a · P14b | 후보 조회가 요청자 대신 워크스페이스(integration · mcp) | KILLED | KILLED — 각 1 failed. 첫 시도는 앵커가 두 자리에 맞아 **무효 뮤턴트** — 둘로 나눠 다시 돌렸다 |
| P15 | getUsages 가시성 판정 제거 | KILLED | KILLED — 6 failed |
| P16 | updateScope 가 `requireEntity` | KILLED | KILLED — 3 failed |
| P17 | 거부 코드 `FORBIDDEN` 으로 회귀 | KILLED | KILLED — 22 failed |
| P18 | 스트림이 explore 컨텍스트에 워크스페이스를 요청자로 | **SURVIVED** | SURVIVED → 테스트 추가 후 KILLED(1) |
| P19 | finish-guard 가 워크스페이스로 후보 조회 | **SURVIVED** | SURVIVED → 테스트 추가 후 KILLED(1) |
| P20 | requestScopes Admin 판정 제거 | KILLED | KILLED — 2 failed |
| R1 | 쓰기 조건(`judgedRow`)에서 판정 scope 제거 — 1라운드 W1 · W2 | KILLED | KILLED — 19 failed |
| R3 | 콜백 재판정 호출 제거 — W3 | KILLED | KILLED — 6 failed |
| R4 | 콜백 재판정의 `pending_install` 제외 제거 | KILLED | KILLED — 1 failed(설치 흐름) |
| R5 · R6 | 콜백 재판정이 Organization Admin · 가시성을 안 봄 | KILLED | KILLED — 각 4 · 2 failed |
| R7 | begin 소진 switch 에서 request_scopes → 판정 없음 — W5 | KILLED | KILLED — 2 failed |
| R8 | update 의 0행 판정 제거 | KILLED | KILLED — 1 failed |
| R9 | 역할 조회 불가 시 통과(fail-open) | KILLED | KILLED — 1 failed |

## `/ai-review` 처리

멈춤 규칙(라운드 시작 전 선언): Critical 0 · Warning 0 · 그 라운드 `codebase/**` 수정 0건이면 종결. 2라운드부터 구조 · 문서 잔여만
남으면 developer SKILL «수렴 예외».

| 라운드 | 세션 | 결과 | 처분 |
| --- | --- | --- | --- |
| 1 | `review/code/2026/09/25/22_45_37` | Critical 0 · Warning 11 | W1 · W2(판정 뒤 scope 변경 · lost update) — compare-and-set(`judgedRow`) · 부분 update. W3(콜백 TOCTOU) — 커밋 직전 재판정. W4 · W5 · W7~W11 조치. W6(역할 이중 조회) — 전역 가드 변경이라 트래커 등재. 커밋 `5999aedfe`. 뮤턴트 R1~R9 전부 KILLED |

## `--impl-prep` 처리 (`review/consistency/2026/09/25/21_49_24` — BLOCK: NO, WARNING 5)

| # | 지적 | 처분 |
| --- | --- | --- |
| W1 · W3 | 어시스턴트 spec(`4-ai-assistant.md`)의 통합 목록 · 후보 계약이 §8 을 반영하지 않음 | planner 보강 draft `spec-draft-integration-personal-owner-assistant.md` → `--spec` `22_00_14` BLOCK: NO → 반영(`1e7ee5123`). `spec_impact` 추가 |
| W2 | 판정이 핸들러별 수동 배치 — 완결성 안전망 없음 | 컨트롤러 `:id` 라우트 전수 캐너리(위 «설계») |
| W4 | `FORBIDDEN → ADMIN_REQUIRED` 가 `error-codes.md §5` Rename 이력에 없음 | **해당 없음 — 실측.** §5 머리말은 «구 코드는 더 이상 발행되지 않는다(코드베이스에서 완전 제거)» 는 retired 코드만 받는다. `FORBIDDEN` 은 전역 기본값으로 계속 발행된다. 같은 성격의 `#1399` 가드 변경(`FORBIDDEN` → `ADMIN_REQUIRED` 등)도 §5 에 없다 |
| W5 | `3-error-handling.md §1.2` `ADMIN_REQUIRED` 행을 다른 열린 항목(트래커 «`removeMember` 리팩터로 낡은 spec 서술 세 줄» 표 #2)과 겹쳐 편집 | 그 항목에 조율 각주 — 이 PR 이 행을 먼저 편집했고 남은 것은 `removeMember` 한 발행처 |

## 체크리스트

- [x] `--impl-prep` — `21_49_24` BLOCK: NO, 처리 위
- [x] 테스트 선작성(unit) — 경로별 «남의 personal → 부재와 같은 404 · 역할 무관», «Organization 변경 → 비Admin 403 `ADMIN_REQUIRED`»,
      «본인 personal → 역할 무관 통과», 어시스턴트 도구 · 후보는 남의 personal 을 **목록에서 조용히 뺀다(에러 아님)**
- [x] 컨트롤러 `:id` 라우트 전수 캐너리(W2) — `integrations.controller.owner.spec.ts`
- [x] 구현 — `d3ca80080`
- [x] 뮤턴트 — 아래 표. 예측이 전부 맞았다. 살아남은 셋(P13 · P18 · P19)은 **예측대로** 지키는 테스트가 없던 자리라
      테스트를 더하고(`d76e21357`) 다시 돌려 모두 죽였다
- [x] e2e — 다중 액터(Owner · Admin · Editor(생성자) · Viewer) 권한 경계 — `test/integration-personal-owner.e2e-spec.ts` 14건 PASS
- [x] 사용자 가이드(`integration-management.mdx` + en) — `user-guide-writer` 위임. 팀 워크스페이스 Personal 가시성 · 역할 표 셋 · Danger zone 권한
- [x] CHANGELOG — 한 항목(기준 1 — 제품 동작 변경). 컨트롤러 캐너리는 한 컨트롤러 범위 커버리지라 기준 3(전역 가드)이 아니다
- [x] TEST WORKFLOW — lint · unit(backend 10200 · frontend 6781) · build · e2e(72 스위트 · 405건)
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기
