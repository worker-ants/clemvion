# 정식 규약 준수 검토 — Personal 통합 소유자 강제 (impl-prep)

대상: `spec/2-navigation/4-integration.md`(§8 판정 규칙 신설 + Rationale 추가) · `spec/5-system/3-error-handling.md`(§1.2 `ADMIN_REQUIRED` 발행처 갱신) · `spec/4-nodes/4-integration/_product-overview.md`(INT-MG-07 한 구) — 커밋 `f47069564`.
검토 모드: `--impl-prep` (구현 plan: `plan/in-progress/integration-personal-owner.md`)

이 diff 는 직전 `--spec` 검토(`review/consistency/2026/09/25/21_33_10`)의 WARNING 3건에 대한 반영 커밋이다. 그 3건 중 2건(precheck §9.2 필드 생략 사유 명시, `INTEGRATION_NAME_TAKEN` §9.4 등재)은 완전히 반영됐다. 남은 1건(FORBIDDEN vs ADMIN_REQUIRED)은 "무엇을 택했는지" 는 명시했지만, 그 선택이 조건부로 요구한 후속 등재가 빠졌다.

## 발견사항

- **[WARNING]** `FORBIDDEN → ADMIN_REQUIRED` 승격이 `error-codes.md §5` Rename 이력에 미등재
  - target 위치: `spec/2-navigation/4-integration.md` §8 "판정 규칙" 4번째 불릿("Organization 통합의 변경은 Admin 이상이다 ... 거부는 `403 ADMIN_REQUIRED`") · 같은 문서 Rationale "Personal 통합 소유자 강제" (2026-09-25) 중 "거부 코드는 `ADMIN_REQUIRED` 로 올렸다 ... 이 모듈의 기존 Admin 판정 4곳만 `FORBIDDEN` 으로 남아 있었다 ... 이 PR 이 그 자리를 전부 손보므로 함께 올렸다" 문단
  - 위반 규약: `spec/conventions/error-codes.md §5` "Rename 이력 (Retired codes)" — 기존에 발행되던 코드가 다른 코드로 교체될 때 흡수 등급(A/B)·근거·PR 을 표에 등재해야 한다(선례: `WORKSPACE_REQUIRED → WORKSPACE_ID_REQUIRED`, `INVALID_INPUT → INVALID_TRIGGER_PARAMETERS` 등). 같은 문서 Overview 가 "본 문서가 유일하게 소유하는 것 ... ② rename 안정성 정책 ③ historical-artifact 예외 레지스트리" 라고 SoT 임을 선언한다.
  - 상세: 실측 — `codebase/backend/src/modules/integrations/integrations.service.ts` 634/1106/1251/1327 행에 `code: 'FORBIDDEN'` 발행처 4곳이 현존하고(`create`/`assertCanRotate`/`requestScopes`/`updateScope`), 프런트엔드에는 `'FORBIDDEN'` 문자열 분기가 0건이다(`grep -rn "FORBIDDEN'" codebase/frontend/src` → 0). target Rationale 은 이 4곳 + 신규 2곳(별칭 수정·삭제) 전부를 `ADMIN_REQUIRED` 로 승격시키기로 했고, 근거로 정확히 이 실측("프런트엔드 FORBIDDEN 참조 0곳")을 든다 — `error-codes.md §5` 등급 A("영향 부재 확인")가 요구하는 형태의 근거다. 그런데 직전 `--spec` 검토(WARNING 2)는 "이 기회에 6곳 전체를 ADMIN_REQUIRED 로 승격(그러면 `error-codes.md §5` rename 이력에도 등재 필요)" 라고 **조건부로 명시**했다 — target 은 그 조건(6곳 전체 승격)을 그대로 택했는데, `error-codes.md` 파일 자체는 이 커밋에서 전혀 수정되지 않았다(`git show --stat f47069564` 에 `spec/conventions/error-codes.md` 없음). 결과적으로 이 breaking-risk 판단(등급·근거·실측)이 지정된 SoT 표가 아니라 다른 문서(`4-integration.md` Rationale)에만 존재하는 상태로 남는다. `spec/5-system/3-error-handling.md §1.2` 의 `ADMIN_REQUIRED` 행 자체는 발행처 목록에 `IntegrationsService` 를 올바르게 추가했으므로(카탈로그 등재 요구는 충족), 이 항목은 카탈로그 누락이 아니라 **rename-이력 등재 누락**이다.
  - 제안: `spec/conventions/error-codes.md §5` 표에 `FORBIDDEN → ADMIN_REQUIRED` 행을 추가한다 — 대상: IntegrationsService `create`/`assertCanRotate`(rotate)/`requestScopes`/`updateScope`(scope 전환) 기존 4곳 + 별칭 수정·삭제 신규 2곳, 등급 A(프런트엔드 `FORBIDDEN` 참조 0곳 실측), 비고에 `plan/in-progress/integration-personal-owner.md` 인용. 코드 변경이 실제로 나가는 시점(--impl-done)에 등재해도 무방하나, 그렇다면 그 사실이 지금 빠져 있다 — `plan/in-progress/integration-personal-owner.md` 의 체크리스트(현재 `--impl-prep`/테스트/구현/뮤턴트/e2e/가이드/CHANGELOG/`/ai-review`/`--impl-done`/트래커 닫기)에 "`error-codes.md §5` Rename 이력 갱신" 항목이 없어, 구현 시점에 조용히 누락될 위험이 있다. 두 시점 중 하나를 택해 항목을 명시할 것.

## 준수 확인 (위반 아님 — 직전 --spec 검토 대비 재확인)

- precheck 필드 생략 사유(§9.2 WARNING 1) — `cafe24/precheck`·`makeshop/precheck` 두 행 모두에 "충돌 행이 남의 personal 이면 `existingIntegrationId`·`existingName` 을 싣지 않는다([§8 판정 규칙](#8-권한-규칙))" 이 추가됐고, `api-convention.md §5.4` 가 요구하는 "그 필드를 문서화하는 절에 사유 명시" 를 충족한다.
- `INTEGRATION_NAME_TAKEN` 등재(§9.4 WARNING 3) — `spec/2-navigation/4-integration.md §9.4` 공통 응답 포맷 목록에 `INTEGRATION_NAME_TAKEN (409)` 행이 추가돼 직전 검토가 요구한 최소 요건(§9.4 등재, `error-handling.md §1` 등재는 "선택" 이었음)을 충족한다. 다만 Integration 도메인은 여전히 `3-error-handling.md §1` 에 자기 전용 `§1.x (도메인 spec 참조)` 서브섹션이 없다(WS/EIA/Webhook/KB/워크스페이스-멤버/트리거/chat-channel 은 모두 있음) — 이 PR 이전부터 있던 구조적 격차이고 직전 검토도 이를 "선택" 으로 분류했으므로 이번 diff 의 신규 위반은 아니다(INFO 성격 — 별도 후속 검토 대상).
- `ADMIN_REQUIRED` 카탈로그 갱신 — `3-error-handling.md §1.2` 행에 `IntegrationsService` 의 Organization 통합 변경 판정이 기존 발행처(`RolesGuard`·`WorkspacesService.assertAdmin()`) 목록에 정확히 병기됐다. `UPPER_SNAKE_CASE` 명명·기존 코드 재사용(신규 코드 미발명) 모두 `error-codes.md §1·§2` 원칙과 일치한다.
- `INT-MG-07`(`_product-overview.md`) · §8 앵커 링크(`#8-권한-규칙`) · `data-flow/12-workspace.md` 상대경로 · `RBAC §3.2` 인용("자기 것") — 전부 대상 heading slug·상대경로·기존 매트릭스 문구와 정확히 일치한다.
- frontmatter 전이(`implemented → partial` + `pending_plans:`) — `spec-impl-evidence.md §2·§3` 스키마와 정확히 일치하며 R-11 이 인정한 역행 패턴과 같은 형태(신규 미구현 surface 발견에 따른 하향)다.
- `판정 규칙`/`아직 강제되지 않는 것` 을 `###` 서브섹션이 아닌 볼드 단락으로 적은 형식은 같은 문서 §9.3 선례와 이질적이지 않다.

## 요약

target 은 직전 `--spec` 검토가 지적한 3건의 WARNING 중 2건(precheck 필드 생략 사유 명시, `INTEGRATION_NAME_TAKEN` 카탈로그 등재)을 완전히 반영했고, 나머지 1건(FORBIDDEN vs ADMIN_REQUIRED)도 "어느 쪽을 택했는지" 를 Rationale 에 명시하라는 요구는 충족했다. 다만 그 선택(6곳 전체를 `ADMIN_REQUIRED` 로 승격)에 조건부로 붙어 있던 후속 요구 — `error-codes.md §5` Rename 이력 등재 — 는 빠졌다. `ADMIN_REQUIRED` 자체의 명명·카탈로그 등재는 정확하지만, breaking-risk 판단(등급·실측)이 지정된 SoT 표가 아닌 다른 문서에만 남아 있어 그 표를 참조하는 다음 사람이 이 전환을 놓칠 수 있다. 이 1건을 제외하면 명명·앵커·frontmatter·문서 구조 전반이 conventions 와 견고하게 정합한다.

## 위험도

LOW
