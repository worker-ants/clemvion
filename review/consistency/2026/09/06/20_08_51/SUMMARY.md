# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 모두 전문 확보(inline, authoritative) 및 정상 반영 완료. CRITICAL 발견 0건.

## 전체 위험도
**LOW** — target(`spec/2-navigation/`) 자체는 델타 0이며, 접점이 있는 트리거 409 충돌 구현은 기존 spec 계약을 그대로 실현한 것. 남은 이슈는 전부 WARNING/INFO이며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 등재되어 추적 중.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 발견이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance, naming_collision | 409 `RESOURCE_CONFLICT` 세부 코드 표현이 두 관례로 공존 — `details.code`(단일 object, 신설) vs top-level `code` 자체 치환(저장소 선례 7건 이상) | `spec/2-navigation/2-trigger-list.md` §3 / §2.3.1 (`TRIGGER_ENDPOINT_PATH_CONFLICT` 구현: `triggers.service.ts` `rethrowEndpointPathConflict()`) | `spec/5-system/3-error-handling.md` §1.3 (top-level 치환 선례 다수), `spec/5-system/2-api-convention.md` §5.3 (`details`는 배열만 정의, object 단일 사유 형태 미정의) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`("도메인 세부 에러 코드의 표현 방식을 정식화한다", 2026-09-06 등재)에 위임됨 — planner 턴에서 (a)/(b) 택일 기준을 `2-api-convention.md §5.3`에 명문화하고 `3-error-handling.md §1` 카탈로그에 `TRIGGER_ENDPOINT_PATH_CONFLICT` 등재. 결정 전까지 이 신설 형태를 추가로 늘리지 말 것. |
| 2 | naming_collision | `WorkflowVersionDetail` 타입명이 frontend/backend 양쪽에 별도 선언되어 형태가 다름(백엔드는 3필드 필수 투영, 프런트는 옵셔널/nullable) — 공유 타입 패키지를 거치지 않는 손-미러 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`(신규 export) | `codebase/frontend/src/lib/api/workflows.ts`(기존 `WorkflowVersionDetail`) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(~650행, developer 등재)에 개명(`WorkflowVersionDetailProjection` 등) 또는 `codebase/packages/` 공유 타입 승격 방안이 미해결 체크박스로 등재됨. 현재 런타임 오류 없음(백엔드가 더 좁음) — 신규 조치 불요, 트래커 유지 확인만. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `WorkspaceMemberDto.joinedAt` 신규 응답 필드가 `9-user-profile.md`에 아직 미반영 (doc-sync 지연, 모순 아님) | `codebase/backend/.../workspace-response.dto.ts` / `spec/2-navigation/9-user-profile.md` §4 | 다음 `9-user-profile.md` 편집 turn에 멤버 목록 표/카드에 `joinedAt` 노출 여부·형식 추가 |
| 2 | cross_spec, convention_compliance | `2-trigger-list.md §2.3.1` `botToken` 행 자기모순("hasBotToken boolean만 노출" vs "마스킹 placeholder `•••• <last4>`") — 선재 결함, 이번 PR 무관 | `spec/2-navigation/2-trigger-list.md` §2.3.1 | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(W2)에 등재 — 조치 불요, 다음 편집 turn에서 §5.4.2 서술로 통일 |
| 3 | rationale_continuity | 트리거 409 계약 구현은 기존 Rationale과 정합, 결정 번복 아님 | `triggers.service.ts` `rethrowEndpointPathConflict` | 없음 |
| 4 | rationale_continuity | `WorkspaceMemberDto.joinedAt` 신설에 대응하는 기존 Rationale 없음(순수 신규 필드) | `workspace-response.dto.ts` | 없음 |
| 5 | plan_coherence | `TRIGGER_ENDPOINT_PATH_CONFLICT` 구현이 미결 정책(details 표현 방식)을 일방 결정하지 않고 이미 등재된 planner 항목에 위임 | `triggers.service.ts` | 없음 — plan 항목 그대로 열어둠 |
| 6 | plan_coherence | 비대칭 `save()` 래핑(8곳 중 2곳만) 및 e2e 부재는 같은 세션에서 이미 plan에 등재 — 누락 아님 | `triggers.service.ts` | 후속 처리 시 `review/code/2026/09/06/19_31_04` INFO#2, `15_52_58` INFO#11 참조 |
| 7 | plan_coherence | `2-trigger-list.md`의 기존 3건 자기모순(R-2 vs §3, frontmatter status vs 본문, Auth Config dead-end 링크)은 이번 diff와 무관, 이미 plan이 처분 방향까지 확정 | `spec/2-navigation/2-trigger-list.md` | 다음 planner 턴에서 일괄 문구 정정 — push 차단 사유 아님 |
| 8 | naming_collision | `details.code` 세부 에러 코드 표현 관례가 아직 단일 규약으로 정식화되지 않은 채 신규 사용처(`TRIGGER_ENDPOINT_PATH_CONFLICT`) 1건 증가 | `triggers.service.ts` | WARNING #1과 동일 항목, 이미 tracked — 신규 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | target 스코프 델타 0. 트리거 409 구현은 spec 계약 정합. `details.code` 이원화(WARNING, tracked), `joinedAt` doc-sync 지연(INFO), botToken 자기모순(INFO, 선재) |
| rationale_continuity | NONE | 이번 diff는 `spec/2-navigation` 기존 Rationale(R-1~R-16 등)과 직교하거나 그 계약을 그대로 실현. 연속성 위반 없음 |
| convention_compliance | NONE | URL 명명·상태 토글·유니크 범위·에러 코드 표기·감사 액션·secret ref·chat-channel enum·페이지네이션·frontmatter 글롭 전부 정식 규약과 일치. 잔여 갭 3건은 신규 아니고 이미 planner 등재 |
| plan_coherence | LOW | 트리거 구현이 plan의 "결정 필요" 항목을 우회하지 않고 위임. 잔여 갭·기존 자기모순 3건 모두 이미 plan에 등재, 이번 PR 무관 |
| naming_collision | LOW | `WorkflowVersionDetail` 프론트/백엔드 손-미러 불일치(WARNING, tracked), `details.code` 관례 미정식화(INFO, tracked). 스코프 내 신규 차단급 identifier 충돌 없음 |

## 권장 조치사항
1. (BLOCK 없음 — 즉시 조치 불요) 이번 PR push를 막을 사유 없음.
2. 다음 planner 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 미해결 항목 일괄 처리: (a) 도메인 세부 에러 코드 표현 방식 택일(`2-api-convention.md §5.3` + `3-error-handling.md §1` 카탈로그 등재), (b) `WorkflowVersionDetail` 개명 또는 공유 타입 승격, (c) `2-trigger-list.md`의 R-2/frontmatter status/dead-end 링크 3건 문구 정정.
3. 다음 `9-user-profile.md` 편집 turn에 `joinedAt` 필드의 UI 노출 여부·형식 추가.
4. 후속 세션에서 `triggers.service.ts`의 비대칭 `save()` 래핑 및 e2e 부재 항목(`review/code/2026/09/06/19_31_04` INFO#2, `15_52_58` INFO#11)을 참조해 처리.