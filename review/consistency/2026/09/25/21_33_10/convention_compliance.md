# 정식 규약 준수 검토 — spec-draft-integration-personal-owner.md

대상: `plan/in-progress/spec-draft-integration-personal-owner.md` (spec draft, `spec/2-navigation/4-integration.md` 변경안)
검토 모드: `--spec`

## 발견사항

- **[WARNING]** precheck 응답의 신규 조건부 필드 생략이 그 필드의 "문서화하는 절"(§9.2)에는 반영되지 않는다
  - target 위치: draft §변경안(B) "**precheck 의 중복 감지는 scope 를 가리지 않는다**" 불릿 (충돌 행이 남의 personal 이면 `existingIntegrationId`·`existingName` 을 안 싣는다)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.4` — "키 생략은 (a)/(b) 중 하나에 해당할 때만 쓰고, **그 필드를 문서화하는 절에 사유를 명시**한다"
  - 상세: `existingIntegrationId?`/`existingName?` 은 이미 `spec/2-navigation/4-integration.md §9.2` (line 823-824, `Cafe24PrecheckResultDto`/makeshop 동형)에 optional 필드로 선언돼 있고, 그 절이 이 필드의 "문서화하는 절"이다. draft 는 이 새 생략 조건(남의 personal 충돌 시 두 필드 미포함)을 §8 아래의 새 "판정 규칙" 블록과 Rationale "받아들인 잔여"에만 적고, §9.2 의 precheck 엔드포인트 서술 자체는 손대지 않는다(변경안 A/B/C 어디에도 §9 갱신이 없음 — `grep §9` 결과 §9.2 참조뿐, 편집 대상 아님). PR 반영 후 §9.2 만 읽는 독자는 두 필드가 항상 present-when-conflict 라고 오해한다.
  - 제안: 변경안에 (D) 항목을 추가해 §9.2 의 `cafe24/precheck`·`makeshop/precheck` 두 행에 "충돌 행이 다른 사용자의 personal 통합이면 `existingIntegrationId`·`existingName` 을 생략한다"는 한 문장과 §8 규칙 블록으로의 역참조를 넣는다.

- **[WARNING]** 신규 "Organization 통합 Admin 필요" 거부가 같은 날 확립된 "역할 거부 전용 코드" 원칙과 근거 없이 갈린다
  - target 위치: draft 변경안(B) "**Organization 통합의 변경은 Admin 이상이다** ... 거부는 `403 FORBIDDEN` 이다"
  - 위반(소지) 규약: `spec/5-system/2-api-convention.md §5.3` — "`RolesGuard` 의 멤버십·역할 거부는 기본값이 아니라 전용 코드를 갖는다(`NOT_A_MEMBER`·`EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED`). 2026-09-25 이전에는 코드를 지정하지 않아 이 기본값 `FORBIDDEN` 이었다" / `spec/5-system/3-error-handling.md` 카탈로그의 `ADMIN_REQUIRED` 행은 발행처를 `RolesGuard` 뿐 아니라 **서비스 계층** `WorkspacesService.assertAdmin()` 도 명시
  - 상세: 이 규칙은 오늘(2026-09-25, `#1399`/`#1400`/`#1401`) 바로 이 저장소에서 막 확립됐고, target draft 자신도 그 커밋의 Rationale 문구를 그대로 인용한다(§(C) "남의 personal 은 404 다" 문단). 그런데 정작 자신이 새로 여는 Admin-필요 거부(별칭 수정·삭제)에는 그 갓 확립된 원칙을 적용하지 않고 generic `FORBIDDEN` 을 선택했다 — `ADMIN_REQUIRED` 를 쓸지, 왜 안 쓰는지에 대한 근거가 draft 어디에도 없다. 다만 실측하면 `integrations.service.ts` 의 기존 4개 발행처(`create`/`assertCanRotate`/`requestScopes`/`updateScope`)가 이미 **module-local 로 일관**되게 `code: 'FORBIDDEN'` 을 쓰고 있어(§3 예외 레지스트리에는 미등재), 새 2곳만 `ADMIN_REQUIRED` 로 바꾸면 같은 모듈·같은 조건 안에서 코드가 갈리는 **국소 비일관**을 새로 만든다(`error-codes.md` R-8 이 lowercase 초대 코드군에 적용한 것과 같은 논리의 반대 방향).
  - 제안: 어느 쪽을 택하든 draft 의 Rationale 에 한 문장으로 명시한다 — (a) module-local 일관성을 우선해 `FORBIDDEN` 유지(왜 `ADMIN_REQUIRED` 로 통일하지 않는지), 또는 (b) 이 기회에 6곳 전체(기존 4 + 신규 2)를 `ADMIN_REQUIRED` 로 승격(그러면 `error-codes.md §5` rename 이력에도 등재 필요). 근거 없이 침묵하면 다음 검토자가 같은 질문을 반복한다.

- **[WARNING]** Rationale 이 안전 근거로 인용하는 `INTEGRATION_NAME_TAKEN` 이 §1 에러 카탈로그에 미등재
  - target 위치: draft Rationale "받아들인 잔여" 문단 — "생성·이름 변경의 `INTEGRATION_NAME_TAKEN` ... 남의 personal 이 **있다는 사실**을 드러낸다"
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3` — "어느 쪽을 택하든 [에러 처리 §1 카탈로그]에 등재한다. 등재되지 않은 코드는 소비자가 존재를 알 방법이 없다"
  - 상세: 실측(`grep`) 결과 `INTEGRATION_NAME_TAKEN` 은 `codebase/backend/src/modules/integrations/integrations.service.ts:1594` 에서 실제 발행되지만 `spec/5-system/3-error-handling.md §1` 카탈로그에도, `spec/2-navigation/4-integration.md §9.4` (본 모듈 자신의 에러 목록)에도 등재돼 있지 않다. 이 PR 이전이라면 사소한 spec-drift 지만, 이 draft 는 바로 이 코드를 **existence-oracle 잔여 위험을 사용자에게 받아들이게 하는 근거**로 승격시켰다 — 보안 판단의 근거로 쓰이는 코드가 공식 카탈로그 밖에 있는 상태로 남는 것은 이 PR 의 취지(본인 것만 보이게 한다)와 충돌한다.
  - 제안: 같은 커밋에서 `INTEGRATION_NAME_TAKEN (409)` 을 `spec/2-navigation/4-integration.md §9.4` 공통 응답 포맷 목록에 추가한다(선택: `error-handling.md §1` 도메인 카탈로그에도). 이 draft 의 스코프에 포함시키거나, 포함시키지 않는다면 그 사실을 "아직 강제되지 않는 것"에 명시한다.

## 준수 확인 (위반 아님 — 교차검증으로 확인된 항목)

- frontmatter 스키마(`status: partial` + `pending_plans:`)는 `spec-impl-evidence.md §2·§3` 형식과 정확히 일치하며, `implemented → partial` 역행 전이도 동 컨벤션 R-11 이 인정한 선례(`secret-store.md`)와 같은 패턴(새 미구현 surface 발견에 따른 하향)이다.
- `RESOURCE_NOT_FOUND`(404)·`FORBIDDEN`(403 기본값)은 `api-convention.md §5.3` 표의 상태코드 기본값과 일치하고 신규 코드를 만들지 않는다는 draft 의 명시적 결정도 `error-codes.md §2` 안정성 정책과 부합한다.
- `created_by` 필드명은 `spec/1-data-model.md §2.10` Integration 엔티티 컬럼과 정확히 일치.
- 크로스링크 앵커(`5-system/1-auth.md#32-...`, `data-flow/5-integration.md#12-...`, `data-flow/12-workspace.md#경로-파라미터...`)는 전부 실제 heading slug 와 일치.
- `pending_plans` 경로(`plan/in-progress/integration-personal-owner-followup.md`)의 네이밍은 기존 `-followup.md` 선례(`spec-draft-workspace-path-guard-followup.md`)와 일치하며, `동반 산출물(같은 커밋)`로 명시해 `spec-pending-plan-existence` 가드 시점 요구를 인지하고 있다.
- Rationale 항목을 맨 앞(최신 우선)에 추가하는 것은 대상 문서(`4-integration.md`)의 기존 Rationale 정렬 순서(2026-09-19 → 2026-09-10 → 2026-07-17 …)와 일치.
- `plan/in-progress/spec-draft-integration-personal-owner.md` 자체 frontmatter(`worktree`/`started`/`owner`)는 `plan-frontmatter.test.ts` 의 의무 필드를 충족하며, `owner: planner`(축약형)는 자신이 인용하는 트래커(`spec-draft-nullable-notation-followups.md`) 및 다수 선례와 표기가 같다.
- "판정 규칙"/"아직 강제되지 않는 것"을 `###` 서브섹션이 아닌 **볼드 단락**으로 addressing 하는 형식은 같은 문서 §9.3 "**(a) `ActivityItem` shape**" 선례와 같은 스타일로 이질적이지 않다.

## 요약

target spec draft 는 frontmatter 스키마(`status`/`pending_plans`), 에러 코드 기본값·안정성 정책, 데이터 모델 필드명, 링크 앵커, plan 네이밍 등 대부분의 정식 규약 축에서 견고하게 정합한다. 다만 세 가지 지점에서 규약과의 정합을 더 다듬을 여지가 있다 — (1) precheck 필드 생략의 신규 조건이 그 필드 자신의 문서화 절(§9.2)에는 반영되지 않아 `api-convention §5.4` 의 "문서화 절에 사유 명시" 요구가 §8/Rationale 로만 우회 충족되고, (2) 같은 날 확립된 "역할 거부 전용 코드" 원칙과 신규 Admin-필요 거부의 `FORBIDDEN` 선택 사이의 긴장이 draft 안에서 설명되지 않으며, (3) draft 가 보안 근거로 승격시킨 `INTEGRATION_NAME_TAKEN` 이 정작 공식 에러 카탈로그에는 없다. 셋 다 빌드 가드가 잡아내지 못하는 문서-완결성 성격의 gap 이라 CRITICAL 로 분류하지 않았으나, 정식 채택 전에 반영하면 후속 구현·리뷰 단계의 재작업을 줄일 수 있다.

## 위험도

LOW
