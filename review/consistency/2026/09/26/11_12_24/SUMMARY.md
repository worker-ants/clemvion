# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견(현재 배포된 `spec/conventions/swagger.md` §5-4 문구가 이미 정착된 SoT 결정과 어긋나며, 실측으로 129곳의 실제 불일치를 낳았다).

## 전체 위험도
**HIGH** — CRITICAL 원인은 이미 진단됐고 반영할 spec draft 도 준비돼 있어 즉시 해소 가능하지만, 그 반영(project-planner `--spec` 턴)이 아직 이뤄지지 않은 채로는 구현 착수를 막아야 한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 현재 `swagger.md` §5-4 문구("`@Roles()` 있으면 역할 코드만, 없으면 `NOT_A_MEMBER`만")가 이미 정착된 SoT 결정과 어긋나며, 이 문구를 따른 결과 실측 157곳 중 129곳이 실제로 코드 일부(비멤버 `NOT_A_MEMBER`)를 누락한 상태다 | `spec/conventions/swagger.md` §5-4 (새 엔드포인트 체크리스트) | `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드(2026-09-25)" — 채택안 (나) "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`" | `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 변경 (2)·(3) 은 이미 준비돼 있고 12-workspace.md·기존 코드 상수와 대조해 정확함이 확인됐다 — project-planner `--spec` 턴으로 반영 후 `--impl-prep` 진행 |

## planner 인계 (권한 밖 Critical)

> 이 Critical 의 수정 대상(`spec/conventions/swagger.md`)은 `spec/` 이며, 쓰기 권한은 `project-planner` 에게만 있다(`developer`/`--impl-prep` 턴은 `spec/` read-only). 여기 실려도 등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 그대로다 — 다음 행동을 지정하는 표일 뿐 차단을 푸는 장치가 아니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/conventions/swagger.md` 는 `spec/` 이므로 developer/`--impl-prep` 턴이 직접 고칠 권한이 없다(자기-반증형 소정정 조건에도 해당 없음 — 제품 정의/API 계약이며 developer 가 쓴 문장도 아님) | project-planner | `spec/conventions/swagger.md` §5-4 문구를 `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 변경 (2)·(3) 대로 반영 — "가드가 낼 수 있는 거부 코드를 전부 싣는다(`NOT_A_MEMBER` + 요구 중 가장 낮은 역할 코드)"로 정정 | `plan/in-progress/spec-draft-swagger-forbidden-codes.md`; `plan/in-progress/forbidden-desc-codes.md` §체크리스트 1번째 항목("spec draft `--spec` · 반영") |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | integrations 4개 엔드포인트(`create`/`update`/`rotate`/`remove`)의 403 설명을 현재의 `@Roles('editor')` 를 전제로 고정하려는데, 정확히 같은 4곳의 `@Roles()` 자체가 다른 plan 에서 아직 결정 대기 중 — 그 결정이 "가드를 내린다" 쪽으로 나면 방금 고정한 문구가 다시 gap 이 된다 | `spec/conventions/swagger.md` §5-4 (via `forbidden-desc-codes.md` "129곳 문구" 표, integrations 4건) | `plan/in-progress/integration-personal-owner-followup.md` §항목 3 (Viewer 가 자기 personal 통합을 관리 못 하는 문제 — planner 결정 대기) | (a) `forbidden-desc-codes.md` 의 129곳 교체 단계에서 이 4곳에 "Viewer 역할 결정이 나면 재검토" 각주 추가, 또는 (b) `integration-personal-owner-followup.md` 의 Viewer 결정을 먼저 매듭짓고 이 4곳 문구를 나중에 고정 |
| 2 | convention_compliance | §3 길이 규약 표가 엔드포인트 `summary`/`description`/DTO `description` 세 갈래만 분류하고 응답 레벨 데코레이터(`@ApiForbiddenResponse` 등)의 `description` 은 범주가 없다 — 이번 draft 가 신설하는 헬퍼가 최대 두 코드 문장을 이어 붙인 설명을 129곳(+기존 28곳)에 채우면서 이 사각지대가 계속 넓어진다 | `spec/conventions/swagger.md` §3 (길이 — 강제되는 것과 지향하는 것을 가른다) | 없음(구조적 공백, 하드 위반은 아님) | §3 표에 "응답 데코레이터 `description`" 행 추가(성격: 지향/무제한) 또는 "위 표는 `@ApiOperation`·DTO 필드에 한정" 각주를 남기는 후속 spec-draft 를 트래커에 등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 역할 문구 대소문자 표준화("`editor`" vs "`Editor`") 근거가 구현 plan 에는 있지만 spec draft 의 `## Rationale` 자체에는 한 문장으로 명시되지 않았다 | `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 변경 (3) | spec draft 변경 (3)에 "역할 문구 대소문자는 `ROLE_REQUIRED` 상수 메시지를 canonical 로 삼는다" 한 문장 추가 |
| 2 | rationale_continuity | (결함 아님, 긍정 확인) "기각한 대안 — `@Roles()` 를 읽어 자동 생성"이 실제 과거 이력으로 오인용되지 않고 "이 draft 작성 중 검토·기각"으로 정확히 귀속돼 있음 | `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 하단 `## Rationale (이 draft 의)` | 조치 불필요, 기록만 |
| 3 | convention_compliance | 이번 `--impl-prep` 번들이 실제 변경 대상인 spec draft(`spec-draft-swagger-forbidden-codes.md`)를 포함하지 않아, `swagger.md` §5-4 의 새 문구 자체를 이 라운드에서 직접 검토하지 못했다(구조적으로 `plan/**` draft 는 스코프 수집 대상이 아님) | 프롬프트 "Target 문서" 절 | "spec draft 선행 → planner 반영 → impl-prep" 순서를 따르는 작업은 prep-scope 구성 시 `plan/in-progress/spec-draft-*.md` 도 함께 번들 |
| 4 | plan_coherence | `forbidden-desc-codes.md` 내부에서 spec draft 적용 시점이 `## 요구`(코드 변경 4단계 뒤)와 `## 체크리스트`(1번째, 코드보다 먼저) 두 절에서 다르게 서술됨 | `plan/in-progress/forbidden-desc-codes.md` `## 요구` vs `## 체크리스트` | "요구" 절 순서를 "체크리스트" 순서에 맞추거나, 두 절이 순서를 나타내지 않는 별개 목록임을 명시 |
| 5 | plan_coherence | 트래커(`spec-draft-nullable-notation-followups.md`, 2026-09-25 집계 63/54/4/2/20여)와 `forbidden-desc-codes.md`(2026-09-26 재실측 54/53/4/14) 사이 숫자 drift 가 설명되지 않음(방향은 같으나 절대값 다름) | `plan/in-progress/spec-draft-nullable-notation-followups.md` L5052-5059 vs `forbidden-desc-codes.md` §실측 | 트래커 항목을 닫는 커밋 메시지·plan 각주에 두 수치 차이의 원인을 한 줄로 남긴다 |
| 6 | naming_collision | 신규 `FORBIDDEN_NOT_A_MEMBER`(완성 문장 상수)와 기존 `NOT_A_MEMBER`(코드 객체)의 표기적 근접 — 타입·import 경로는 다르므로 실사용 충돌 없음 | `common/swagger/forbidden-descriptions.ts`(신규) vs `common/constants/workspace-roles.ts:45` | 헬퍼 파일 JSDoc 에 "`NOT_A_MEMBER.code` 를 보간한 완성 문장"이라는 한 줄 추가(강제 아님) |
| 7 | naming_collision | 신규 헬퍼 명명 축(`FORBIDDEN_<코드명>`)이 `workspaces.controller.ts` 의 구 로컬 상수 축(`FORBIDDEN_<권한>_ROUTE`)과 같은 파일에서 일시 공존할 수 있음 — plan 이 구 상수 이관을 명시했으므로 계획대로면 잔존하지 않음 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts:71-73` | `--impl-done` 리뷰에서 `FORBIDDEN_MEMBER_ROUTE` 등 구 로컬 상수가 헬퍼 이관 후 잔존(중복 정의)하지 않는지 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 새 개념 도입 없이 기존 결정(2026-08-08, 2026-09-25)을 문서 문구에 뒤늦게 맞추는 동기화 draft. 신규 식별자도 전 저장소 grep 0건. 충돌 없음 |
| rationale_continuity | LOW | 핵심 결정 전부 기존 `## Rationale` 과 정합. 대소문자 표준화 근거가 spec draft 자체에는 없고 plan 에만 있다는 SoT 배치 문제(INFO)만 |
| convention_compliance | HIGH | CRITICAL: 현재 merge 된 `swagger.md` §5-4 문구가 SoT 와 불일치하며 실측 129곳 불일치를 이미 낳음. 원인 진단·수정 draft 는 준비돼 있어 반영만 남음. §3 길이 규약 사각지대(WARNING)도 확인 |
| plan_coherence | LOW | integrations 4곳의 `@Roles('editor')` 자체가 별도 plan 에서 결정 대기 중 — 순서 충돌 위험(WARNING). plan 내부 절 간 순서 불일치·트래커 숫자 drift(INFO 2건) |
| naming_collision | LOW | 신규 식별자 전 저장소 grep 0건, 명명 컨벤션 일치. 표기적 근접·구 상수 축 공존 가능성(INFO 2건)만 |

## 권장 조치사항
1. (BLOCK 해소 우선) project-planner `--spec` 턴으로 `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 변경 (2)·(3)을 `spec/conventions/swagger.md` §5-4 에 반영 — 내용은 이미 12-workspace.md·기존 코드 상수와 대조해 정확함이 확인됐으므로 반영만 남았다.
2. `plan/in-progress/integration-personal-owner-followup.md` 의 Viewer 역할 결정과 `forbidden-desc-codes.md` 의 integrations 4곳 문구 고정 순서를 조율(각주 추가 또는 순서 변경)해 동일 4줄을 두 번 고치는 rework 를 방지.
3. `forbidden-desc-codes.md` 내부 `## 요구`/`## 체크리스트` 두 절의 spec 적용 시점 서술을 일치시킨다.
4. 트래커(2026-09-25 집계)와 이번 재실측(2026-09-26) 사이 숫자 drift(63/54/4/2/20여 → 54/53/4/14) 원인을 트래커 종결 커밋에 한 줄로 남긴다.
5. §3 길이 규약에 응답 데코레이터(`@ApiXxxResponse`) `description` 행 또는 각주를 추가하는 후속 spec-draft 를 트래커에 등재(이번 스코프 밖, 비강제).
6. (선택) 헬퍼 JSDoc 에 `FORBIDDEN_NOT_A_MEMBER` 가 `NOT_A_MEMBER.code` 보간 결과임을 명시하고, `--impl-done` 리뷰에서 구 로컬 상수(`FORBIDDEN_*_ROUTE`) 잔존 여부를 확인.
