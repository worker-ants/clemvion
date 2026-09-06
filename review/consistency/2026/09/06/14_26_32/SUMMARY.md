# Consistency Check 통합 보고서

**BLOCK: YES** — `convention_compliance` 가 CRITICAL 1건 발견 (문서한 에러 응답 계약이 실제 구현보다 넓다).

## 전체 위험도
**HIGH** — 나머지 4개 checker(cross_spec/rationale_continuity/plan_coherence/naming_collision)는 LOW~NONE 이지만, `convention_compliance` 의 CRITICAL 1건이 전체 판정을 끌어올린다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `TRIGGER_ENDPOINT_PATH_CONFLICT` 서브코드·`details.field='endpoint_path'` 를 문서가 확정적으로 단정하지만, 실제 `codebase/` 전체에 해당 문자열이 0건 존재하고 실제로는 전역 `isUniqueViolation` 분기가 `details` 없이 `RESOURCE_CONFLICT` 만 발행함 — "문서한 보장이 구현보다 넓다" 결함 클래스 | `spec/2-navigation/2-trigger-list.md` §3 API blockquote 및 §2.3.1 필드 권한 매트릭스 "Webhook Configuration \| endpointPath" 행 | `spec/conventions/error-codes.md`(에러 코드=장기 계약) · `spec/5-system/2-api-convention.md §5.3`(에러 envelope SoT) · `spec/conventions/swagger.md §5-5`(`ErrorResponseDto` 는 필터 출력을 1:1 표현) | (a) `triggers.service.ts` 의 `update()` 에 `endpointPath` UNIQUE 위반 명시 catch 추가해 `TRIGGER_ENDPOINT_PATH_CONFLICT`+`details.field` 를 실제로 발행(다른 도메인 충돌 코드와 동일 패턴), 또는 (b) 구현 계획이 없다면 문구를 실측대로 "409 `RESOURCE_CONFLICT`(전역 unique-violation 매핑, `details` 없음)" 로 정정 |

**주**: 이 Critical 의 1차 해소 경로(a: 코드에 conflict 처리 구현)는 `codebase/**` 변경으로 **developer 권한 내**에서 완결 가능하다 — 이미 승인된 spec 서술을 실제로 구현하는 작업이라 별도 spec 승인이 불필요하다. 따라서 §planner 인계 표에는 올리지 않는다. 다만 "구현하지 않고 문서만 실측대로 낮춘다"(b)를 택할 경우 이는 API 계약 문구 정정이므로 **자기-반증형 소정정 5조건 중 조건 2("예고·트리거"만 해당, API 계약은 제외)를 충족하지 못해** developer 직접 수정 예외가 적용되지 않는다 — 이 경로를 택한다면 planner 턴 필요.

## planner 인계 (권한 밖 Critical)

> (없음) — 위 Critical 은 developer 권한 내 코드 구현으로 1차 해소 가능(§주 참고). 문서 정정 경로를 택할 경우에만 별도 planner 턴이 필요하며, 이는 택일 조건부라 표에 등재하지 않는다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `User` 민감 7컬럼("passwordHash" 등)의 "응답 절대 미노출" 불변식이 `spec/1-data-model.md` §2.1 `User` 표에 규범 문장으로 없음 — SoT 가 코드(가드 3종)뿐이라 `secret-store.md §1.1`(Trigger/AuthConfig 계열)과 비대칭 | `spec/1-data-model.md` §2.1 `User` 엔티티 표 | `spec/conventions/secret-store.md §1.1` | 새 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md:457-467` 에 이미 planner 담당 미해결 항목(`[ ]`)으로 정확히 등재됨. 그 항목 집행 시 해소 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `WorkspaceMemberDto.joinedAt` 신규 필드가 `9-user-profile.md` §4.1/§4.2 어디에도 언급 안 됨(모순은 아닌 단순 미기술 확장) | `codebase/backend/.../workspace-response.dto.ts` `WorkspaceMemberDto.joinedAt` | UI 노출 계획 있으면 추후 별도 planner 턴에서 §4.1 표에 "가입일" 열 추가. 지금 조치 불요 |
| 2 | rationale_continuity | `WorkflowVersionsService` 의 `User` 관계 projection 강화 근거(`select:false` 기각 결정)가 `spec/2-navigation/*.md` Rationale 범위 밖에 있음 | `codebase/backend/.../workflow-versions.service.ts` (`CREATOR_PROJECTION` 등) | 조치 불요, 참고용 |
| 3 | plan_coherence | `ScheduleDto.trigger`/`TriggerDto.workflow` 의 §5.4 표기 사유를 nav-spec 으로 옮기는 문서화가 아직 미착수(plan 자체가 열린 채 정확히 추적 중) | `spec/2-navigation/3-schedule.md §4`, `2-trigger-list.md` | 해당 planner 턴에서 문서 갱신. 이번 PR 무관 |
| 4 | plan_coherence | `2-trigger-list.md` §2.3.1 이 이미 `git rm` 으로 삭제된 plan 파일(`eia-trigger-edit-ui`, `#387`)을 인용하는 dangling reference | `spec/2-navigation/2-trigger-list.md` §2.3.1 "External Interaction (Notification)" 행 | 다음에 그 절을 손댈 때 "구현 완료, `#235` 로 추적됨" 식 역사적 각주로 정리 |
| 5 | naming_collision | 백엔드 신규 `WorkflowVersionDetail` vs 프론트엔드 기존 동명 타입 — 이전 라운드에 JSDoc 상호 참조로 이미 처분 완료, 이번 라운드도 유지 확인 | `codebase/backend/.../workflow-versions.service.ts` vs `codebase/frontend/src/lib/api/workflows.ts:109` | 조치 불요 — 둘 중 하나 수정 시 JSDoc 생존 여부만 재확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | target(`spec/2-navigation/`) 델타 0, 무관한 diff 확인 + 이전 CRITICAL(frontmatter 파서 버그로 41개 entry 유실) 해소를 실행으로 재검증. `User` 7컬럼 비노출 규범 부재는 이미 추적 중인 WARNING |
| rationale_continuity | NONE | scope 와 diff 사이 코드/문서 교집합 0, Rationale 위반 없음. INFO 2건만 |
| convention_compliance | HIGH | `TRIGGER_ENDPOINT_PATH_CONFLICT` 서브코드가 실제로 발행되지 않는데 spec 이 확정적으로 서술 — CRITICAL 1건 |
| plan_coherence | NONE | target 변경 없음, 이 PR 의 실질 작업은 이미 plan 에서 `[x]` 로 닫혀 있고 후속 3건도 정확히 이월됨. INFO 2건(무관 항목) |
| naming_collision | NONE | 신규 식별자 전수 대조, CRITICAL/WARNING 없음. 완전 동명 1건은 이미 JSDoc 으로 처분됨 |

## 권장 조치사항
1. **(BLOCK 해소)** `triggers.service.ts` `update()` 에 `endpointPath` UNIQUE 위반 명시 catch 를 추가해 `TRIGGER_ENDPOINT_PATH_CONFLICT`+`details.field='endpoint_path'` 를 실제로 발행하도록 구현 — 다른 도메인 충돌 코드(`assertChatChannelInputSafe` 등)와 동일 패턴. 구현하지 않기로 결정하면 그 대신 `2-trigger-list.md` §3/§2.3.1 문구를 실측대로 "409 `RESOURCE_CONFLICT`(전역 unique-violation 매핑, `details` 없음)" 로 정정 — 이 경로는 API 계약 문구 정정이라 planner 턴 필요(자기-반증형 예외 조건 2 불충족).
2. `plan/in-progress/spec-draft-nullable-notation-followups.md:457-467` 의 `User` 7컬럼 비노출 규범화 항목(`[ ]`)을 다음 planner 턴에서 집행 — `spec/1-data-model.md §2.1` 또는 `secret-store.md §1.1` 확장.
3. (Nice-to-have) `WorkspaceMemberDto.joinedAt` UI 노출 계획이 서면 `9-user-profile.md §4.1` 표 갱신.
4. (Nice-to-have) `2-trigger-list.md §2.3.1` 의 삭제된 plan(`eia-trigger-edit-ui`) 인용을 역사적 각주로 정리.