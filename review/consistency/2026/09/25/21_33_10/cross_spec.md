# Cross-Spec 일관성 검토 — spec-draft-integration-personal-owner

대상: `plan/in-progress/spec-draft-integration-personal-owner.md` (target: `spec/2-navigation/4-integration.md` §8 판정 규칙 · frontmatter `status: partial`)

## 발견사항

- **[WARNING]** `spec/4-nodes/4-integration/_product-overview.md` INT-MG-07 이 draft 의 "영향 — 다른 spec" 감사에서 빠졌다
  - target 위치: 변경안 (B) 판정 규칙 블록 — "scope 전환은 Admin 이 볼 수 있는 통합에만 된다 — 자기 personal → organization, organization → personal."
  - 충돌 대상: `spec/4-nodes/4-integration/_product-overview.md:25` `INT-MG-07` — "Personal ↔ Organization 범위 전환 — **Admin만 가능**하며 확인 다이얼로그 필수. 기존 자격 증명 승계"
  - 상세: INT-MG-07 은 이 기능(Personal↔Organization 전환)을 정의하는 요구사항 ID 인데 "Admin만 가능"이라고만 적혀 있고, 그 Admin 이 "자기 personal 만" 전환할 수 있다는 새 제약을 담지 않는다. 현재 코드가 바로 이 문구(단순 "Admin만") 그대로 구현돼 "Admin 이면 남의 personal 도 organization 으로 공유 가능"한 상태였다(draft 배경 표의 실측). draft 는 이 간극을 §8 새 판정 규칙으로 정확히 좁히지만, INT-MG-07 자체는 그대로 두면 "Admin만 가능"만 보고 이 요구사항을 구현하는 사람이 소유자 제약을 놓칠 수 있다. draft 의 "영향 — 다른 spec" 절은 `5-system/1-auth.md §3.2` · `0-overview.md` · `9-user-profile.md §4.2` · `data-flow/5-integration.md` 4곳만 "변경 없음"으로 확인했고, 정작 같은 동작을 요구사항 레벨에서 서술하는 이 문서는 감사 대상에서 누락됐다.
  - 제안: "영향 — 다른 spec" 절에 `spec/4-nodes/4-integration/_product-overview.md` 를 추가하고, INT-MG-07 문구가 새 판정 규칙과 모순되지 않는 이유("Admin만 가능"은 필요조건으로 여전히 참, 소유자 제약은 §8 이 세부화)를 한 줄로 명시하거나, INT-MG-07 자체에 "(단, 대상이 자신의 Personal 통합일 때)" 를 보강.

- **[INFO]** 404 선택 근거로 인용한 워크스페이스 가드 선례는 실제로는 403 을 쓴다 — 같은 도메인 내 더 정확한 선례가 있다
  - target 위치: `## Rationale` → "Personal 통합 소유자 강제" 항목, 결정 2 — "경로 파라미터 워크스페이스 가드가 비멤버와 부재를 같은 응답으로 묶은 원칙([`data-flow/12-workspace.md`](../data-flow/12-workspace.md) Rationale «경로 파라미터 워크스페이스도 가드가 본다»)과 같다."
  - 충돌 대상: `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드 (2026-09-25)" — 이 선례는 존재/비멤버를 **403 `NOT_A_MEMBER`** 로 묶는다(404 아님). 반면 draft 는 존재/비소유를 **404 `RESOURCE_NOT_FOUND`** 로 묶는다.
  - 상세: 두 선례가 공유하는 것은 "두 구분 가능한 상태(부재·권한없음)를 하나의 응답으로 접어 열거(enumeration)를 막는다"는 **원칙**이지, HTTP status/코드 계열 자체는 아니다(하나는 403, 하나는 404). "같다"는 서술이 상태코드까지 같다는 오해를 줄 수 있다. 더 정확히 부합하는 선례는 같은 Integration 엔티티 안에 이미 있다 — `spec/4-nodes/4-integration/0-common.md §4.2` / `2-navigation/4-integration.md §14.1` 의 `requireEntity` 가 "integrationId 가 존재하지 않거나 **타 워크스페이스 소속**"인 경우를 이미 `RESOURCE_NOT_FOUND`(404) 로 통합해 왔다(§14.1 에러 코드 vocabulary 표). 이 쪽이 status code 까지 정확히 일치하는 선례다.
  - 제안: 인용을 `4-nodes/4-integration/0-common.md §4.2` (또는 `2-navigation/4-integration.md §14.1` 자기 자신)의 기존 404 관행으로 바꾸거나, 두 선례를 함께 들면서 "원칙은 같고 status code 는 도메인마다 다르다"를 한 문장으로 명시. 블로킹은 아님 — 결론(404 채택) 자체는 바뀌지 않는다.

- **[INFO]** `INTEGRATION_NAME_TAKEN` 은 spec 에 카탈로그되지 않은 코드다 (draft 가 만든 갭은 아님)
  - target 위치: `## Rationale` "받아들인 잔여" 문단 — "그래서 생성 · 이름 변경의 `INTEGRATION_NAME_TAKEN` 과 begin · precheck 의 충돌 응답은 남의 personal 이 있다는 사실을 드러낸다."
  - 충돌 대상: `spec/2-navigation/4-integration.md §9.4` (공통 응답 포맷의 에러 코드 목록) / `spec/conventions/error-codes.md` — 둘 다 `INTEGRATION_NAME_TAKEN` 을 등재하지 않는다. 실측: 코드에는 존재한다(`codebase/backend/src/modules/integrations/integrations.service.ts:1594`, `integrations.service.spec.ts:1875`).
  - 상세: 이 갭은 draft 이전부터 있던 것이고 draft 가 새로 만들지 않는다. 다만 draft 의 Rationale 이 이 코드명을 기정사실처럼 인용하면서도 §9.4 갱신이나 후속 항목으로 남기지 않아, spec 상 근거가 코드에만 있고 문서에는 없는 상태가 그대로 이어진다.
  - 제안: 블로킹 아님. 후속 spec 위생 항목으로 `§9.4` 에 `INTEGRATION_NAME_TAKEN (409)` 한 줄 추가를 권장(이 PR 범위 밖이어도 무방).

## 데이터 모델 · RBAC · 상태 전이 대조 결과 (충돌 없음, 근거 기록)

- `Integration.created_by` — `spec/1-data-model.md §2.10` 에 이미 `UUID | FK → User (NO ACTION)` 로 존재. draft 가 "«본인» 은 `created_by` 다"라고 규정하는 것과 정합.
- `spec/5-system/1-auth.md §3.2` RBAC 매트릭스 — `Integration (Personal) | 자기 것 ×4` (Owner/Admin/Editor/Viewer 전부 동일)로 이미 역할 우위 없음을 명시. draft 의 "Owner·Admin 도 남의 personal 을 보거나 바꾸지 못한다" 규칙과 정합(신규 발명이 아니라 기존 매트릭스를 코드에 강제하는 것).
- `spec/2-navigation/9-user-profile.md §4.2` — `Integration 생성 (Org) | Owner✅ Admin✅ Editor❌ Viewer❌`. draft 는 이 행을 건드리지 않으며 §8 표의 "생성(Org)=Admin 이상"과 일치. "변경 없음" 판단 정확.
- `spec/0-overview.md` "워크스페이스 단위 Integration 공유·RBAC" 행 — 이미 "이 `editor` 는 라우트 가드 floor 이며 ... Organization-scope 의 생성·수정·전환은 Admin+"라고 명시해 §8 를 SoT 로 위임. draft 가 "변경 없음"으로 판단한 것과 일치.
- `spec/data-flow/5-integration.md §1.2` OAuth 콜백 시퀀스 — `reauthorize`/`request_scopes` 분기가 `UPDATE integration SET credentials=ENC ...`로 자격증명을 통째로 교체함을 확인. draft 의 "reauthorize 의 OAuth 콜백은 credentials 를 통째로 교체한다"는 배경 서술과 정확히 일치.
- `spec/5-system/2-api-convention.md` · `spec/5-system/3-error-handling.md` — `RESOURCE_NOT_FOUND`(404, 리소스 없음) · `FORBIDDEN`(403, 역할 권한 부족 generic) 모두 이미 시스템 공용 코드로 카탈로그됨. draft 가 새 에러 코드를 만들지 않고 이 둘을 재사용하는 설계는 `spec/conventions/error-codes.md §1` 의 "prefix-less 공용 코드는 원칙 예외가 아니라 별개 범주" 규정과 정합.
- `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 은 `pending_plans:` 의무이고 승격 조건(모든 pending_plans 가 `complete/` 이동)까지 정의. draft 의 frontmatter 변경(`status: implemented → partial` + `pending_plans: [integration-personal-owner-followup.md]`)이 이 라이프사이클 규칙을 정확히 따름 — 동반 산출물로 그 plan 파일을 같은 커밋에 만드는 것도 `spec-pending-plan-existence.test.ts` 요구(`plan/in-progress/` 실존)를 충족.
- `INTEGRATION_OWNER_REQUIRED`(기각된 대안 코드명) — spec·코드 전체에 0건, 기존 코드와 충돌 없음.
- `integration_workspace_name_unique` 제약 — `migrations/V008__integration_usage_log_and_metadata.sql:37` 에 실재, draft Rationale "받아들인 잔여" 서술과 일치.

## 요약

target draft 가 새로 규정하는 "Personal 통합 소유자 강제" 규칙은 데이터 모델(`created_by` 컬럼 실재) · RBAC 매트릭스(`5-system/1-auth.md §3.2` 의 기존 "자기 것" 행) · OAuth 콜백 데이터 흐름(`data-flow/5-integration.md §1.2`) · 에러 코드 카탈로그(`RESOURCE_NOT_FOUND`/`FORBIDDEN` 재사용) · spec-impl-evidence 라이프사이클(`status: partial` + `pending_plans`) 과 전부 정합적이며, CRITICAL 급 모순은 발견되지 않았다. 다만 (1) 같은 기능을 요구사항 레벨에서 서술하는 `4-nodes/4-integration/_product-overview.md` INT-MG-07 이 draft 의 "영향 — 다른 spec" 감사에서 누락돼 Admin 의 scope 전환 범위에 대한 서술이 새 판정 규칙보다 느슨하게 남고, (2) 404 채택 근거로 인용한 워크스페이스 경로 가드 선례는 실제로 403 코드 계열이라 status code 까지 동일하다는 인상을 줄 수 있어 인용 정밀도를 높일 여지가 있다. 두 항목 모두 draft 의 결론 자체를 뒤집지 않는 문서 정밀도 문제로, 병합을 막을 필요는 없다.

## 위험도

LOW
