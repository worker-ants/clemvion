# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보, CRITICAL 발견 0건 (모두 WARNING/INFO 이하).

## 전체 위험도
**MEDIUM** — 차단 사유는 없으나 `spec/2-navigation/2-trigger-list.md` 를 축으로 한 다중 문서 정합성 결함(폐기된 Rationale 잔존·frontmatter 상태 오표기·RBAC 노출 경계 불일치)이 누적돼 있고, 그중 일부는 다른 spec 영역(`5-system/15-chat-channel.md`)의 근거로도 인용되고 있어 방치 시 파급 범위가 넓다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드는 CRITICAL 발견이 없어 인계 대상 자체가 없다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | 폐기된 v1.1 `hmacSecret` PATCH+rotate 이원 설계(R-2)가 취소선/정정 표시 없이 남아, 같은 문서 §2.3.1·R-14·§3 각주와 자기모순일 뿐 아니라 다른 spec 파일이 이를 여전히 유효한 설계로 인용 | `spec/2-navigation/2-trigger-list.md` `### R-2` | 같은 문서 §2.3.1/R-14/§3 각주(폐기 명시) + `spec/5-system/15-chat-channel.md` `### R-CC-10`(R-2 를 현재 유효 설계로 인용) | R-2 본문에 취소선 + "정정: authConfigId 단일 경로로 대체됨 — R-14 참조" 콜아웃 추가. `R-CC-10` 의 R-2 인용 문구도 "과거(폐기된) 설계"로 갱신 — 두 spec 파일 동시 편집 필요 |
| 2 | cross_spec | 트리거 drawer "+ 새 인증 설정 만들기" 링크가 `editor+` 노출인데, 목적지(`/authentication`) 의 "Add Config" 생성 액션은 `Admin+` 전용이라 editor 입장에서 dead-end | `spec/2-navigation/2-trigger-list.md` §2.3.1 Auth Config 행 | `spec/2-navigation/6-config.md` §A.4 권한(Admin+ 전용, 근거 `5-system/1-auth.md §3.2`) | 링크를 `admin+` 노출로 제한하거나, `editor` 도달 시 읽기 전용임을 명시적으로 서술 |
| 3 | convention_compliance | frontmatter `status: implemented` 가 본문이 자백한 미구현 surface(`GET /api/triggers` sort/order 무시, `created_at DESC` 하드코딩)와 모순 — `spec-impl-evidence.md §3` 상태 라이프사이클 위반 | `spec/2-navigation/2-trigger-list.md` frontmatter | 같은 문서 본문 §3 API 표; 자매 문서 `3-schedule.md` 의 기존 정상 처리 선례(`pending_plans:` 등재 후 구현 완료 시 해제) | `status: partial` + `pending_plans:` 신규 plan(예: `spec-sync-trigger-sort-order.md`) 등재, 또는 sort/order whitelist 정렬 구현 후 현행 유지 |
| 4 | naming_collision | 백엔드 신규 `WorkflowVersionDetail` 타입이 프런트엔드 기존 동명 타입과 손-미러 상태로 갈라짐(옵셔널→고정 3필드로 더 좁아짐). 이름이 같아 이 세션에서만 3라운드 연속 사람 오판 유발 이력이 있는데도 plan 미등재 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` `export type WorkflowVersionDetail` | `codebase/frontend/src/lib/api/workflows.ts:109` `export interface WorkflowVersionDetail` | 백엔드 타입을 `WorkflowVersionDetailProjection` 등으로 개명하거나 공유 타입 패키지로 승격. 최소한 코드 주석의 "다음에 만지면 열어라"를 `plan/in-progress/` 항목으로 격상 |
| 5 | plan_coherence | `2-trigger-list.md` §2.3.1 `botToken` 행이 "`hasBotToken: boolean` 만 노출"과 "마스킹 placeholder(`•••• <last4>`) 노출"을 한 문장에서 동시 주장하는 자기모순 — **이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 등재됨(2026-09-06)**, 이 PR 이 만든 것도 고칠 책임도 아님 | `spec/2-navigation/2-trigger-list.md` §2.3.1 `Chat Channel | botToken` 행 | 문장 내부 자기모순 | 추가 등재 불필요 — 다음 planner 턴에서 처리. 이 검토를 근거 인용으로만 사용 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 이번 PR 의 `triggers.service.ts` 409 `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 구현이 `2-trigger-list.md` §2.3.1/§3 이 이미 문서화한 계약을 뒤늦게 실현 — 새 충돌 아님 | `spec/2-navigation/2-trigger-list.md` §3, `triggers.service.ts` | 조치 불필요 |
| 2 | rationale_continuity | `WorkspaceMemberDto.joinedAt` 신규 필드는 `2-api-convention.md §5.4` 기본형(nullable, 상시 존재) 을 정확히 준수. nav-spec 문서화는 `spec-draft-nullable-notation-followups.md` 가 이미 추적 중 | `workspace-response.dto.ts`, `spec/5-system/2-api-convention.md §5.4` | 조치 불필요(이미 추적됨) |
| 3 | convention_compliance | `2-trigger-list.md` Rationale 번호 R-9~R-11 결번(R-8→R-12) | `spec/2-navigation/2-trigger-list.md` Rationale 섹션 | 필요 시 재정렬 또는 결번 사유 각주. 우선순위 낮음 |
| 4 | plan_coherence | §2.3.1 External Interaction 행이 가리키는 `eia-trigger-edit-ui` plan 이 트래커에 존재하지 않음(오래된 dangling 참조, `#265` 유래, 이 세션과 무관) | `spec/2-navigation/2-trigger-list.md` §2.3.1 | 다음 spec 정비 턴에서 실제 plan 이름으로 갱신 또는 참조 제거 |
| 5 | naming_collision | `TRIGGER_ENDPOINT_PATH_CONFLICT` 값을 담은 `details.code`(flat object) 가 `error-codes.md §4.2`/`api-convention §5.3` 의 `details[].code`(array) 와 컨테이너 모양이 다름 — 이미 `spec-draft-nullable-notation-followups.md` 에 "code 표현 방식 정식화" 항목으로 선행 등재돼 재등재 불요 | `triggers.service.ts` `rethrowEndpointPathConflict()`, `spec/5-system/2-api-convention.md §5.3` | 조치 불필요(이미 추적됨) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | R-2(hmacSecret) 폐기 미정리 + 타 spec 인용 오염, Auth Config 생성 링크 RBAC 노출 불일치 |
| rationale_continuity | NONE | `triggers.service.ts` 변경은 기존 spec 계약을 그대로 구현, Rationale 위반 없음 |
| convention_compliance | LOW | frontmatter `status: implemented` 오표기(자매 문서 대조), R-2 정정 표시 누락 |
| plan_coherence | LOW | target(`2-navigation/`) 델타 0, `botToken` 자기모순은 이미 plan 등재됨(신규 아님) |
| naming_collision | LOW | `WorkflowVersionDetail` 백엔드/프런트 손-미러 타입 충돌(3라운드 오판 이력), plan 미등재 |

## 권장 조치사항
1. `spec/2-navigation/2-trigger-list.md` R-2 에 취소선+정정 콜아웃 추가하고 `spec/5-system/15-chat-channel.md` R-CC-10 인용 문구 갱신 (동시 편집, planner 턴).
2. `2-trigger-list.md` §2.3.1 Auth Config "새 인증 설정 만들기" 링크 노출 범위를 `6-config.md §A.4` 의 Admin+ 경계와 정합화 (planner 턴).
3. `2-trigger-list.md` frontmatter `status` 를 실제 구현 상태(`partial` + `pending_plans:`)로 정정하거나 sort/order 구현을 완료 (planner/developer 턴, `3-schedule.md` 선례 참고).
4. `WorkflowVersionDetail` 명명 충돌을 개명 또는 공유 타입 승격으로 해소하고 `plan/in-progress/` 에 등재 (developer 턴).
5. `botToken` 자기모순·`eia-trigger-edit-ui` dangling 참조·`details.code` 표현 방식 정식화는 이미 plan 에 등재돼 있으므로 추가 조치 없이 다음 planner 턴에서 일괄 처리.