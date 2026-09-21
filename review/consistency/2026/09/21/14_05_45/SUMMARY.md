# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문을 모두 확보했고, Critical 판정은 하나도 없다.

## 전체 위험도
**LOW** — 신규 위반은 없음. 이 diff(`WorkspacesService.removeMember()` 동시 삭제 감사 중복 수정, `spec/2-navigation` 델타 0)는 형제 5건(#1369~#1372)과 동일 패턴을 그대로 재사용했고, 발견된 WARNING 2건은 모두 이 PR 이전부터 있던 기존 갭이며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 재현·처방·등재까지 마쳐 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `removeMember()` owner 보호 가드가 무락 `findOne`~`delete()` 사이 TOCTOU 로 뚫림 — 동시 `transferOwnership` 이 대상을 owner 로 승격시키면 가드를 통과한 채 owner 가 삭제됨(재현: `status=200, rows_remaining=0`) | `workspaces.service.ts:795-838`(`removeMember()`) | `spec/data-flow/12-workspace.md:141`("owner 는 제거 불가", 예외 미서술), `spec/5-system/1-auth.md:377-381`(§3.2 † 각주, 레이스 조건 미언급) | 이 PR 이전부터 있던 결함이며 이 PR 이 만들거나 악화시키지 않음 — 차단 사유 아님. `plan/in-progress/spec-draft-nullable-notation-followups.md`(재현 레시피·후보 처방 등재 완료)의 후속 PR 에서 처방과 함께 `12-workspace.md:141`/`1-auth.md §3.2` 에 레이스 각주 추가 |
| 2 | rationale_continuity | `spec/5-system/2-api-convention.md §3` "DELETE=멱등 O"(각주 없음) 표와 실제 "동시 요청 시 진 쪽=404" 동작이 정면 충돌 — 이번 PR로 인스턴스 수가 5→6(workflow/workspace/trigger/schedule/integration/**member**)으로 증가 | `workspaces.service.ts:795-838`(원자적 `delete`+`affected===0`) | `spec/5-system/2-api-convention.md:111` | 신규 위반 아님, 기존 미해결 충돌의 인스턴스 증가일 뿐. tracker(`spec-draft-nullable-notation-followups.md:4926-4935`)가 이미 "인스턴스 수 대신 계약 문장(멱등성은 최종 상태 기준)만 각주로 적을 것"으로 처분 확정 — planner 소관, 추가 조치 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "동시 삭제 → 두 번째 404" 서술 부재 목록에 `9-user-profile.md §6.1`/`data-flow/12-workspace.md §1.6` 두 자리가 이미 반영됨 | `spec/2-navigation/9-user-profile.md:378`, `spec/data-flow/12-workspace.md §1.6` | 조치 불필요 — 계획대로 진행 |
| 2 | rationale_continuity | 기각된 대안(advisory lock) 재도입 없음 — 형제(#1372) 선례와 동일 논리 재사용 확인 | `workspaces.service.ts:786-838` 주석 | 없음(정보성 확인) |
| 3 | convention_compliance | 리뷰 예산 절단으로 `spec/2-navigation` 다수 파일·`spec/conventions/**` 대부분이 빈 섹션으로 번들됨 — 본문 로드된 3파일(`1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md`)만 확정 판정 | `spec/2-navigation/*.md` 다수 | target 수정 불필요. 하네스 한계(`feedback_consistency_spec_mode_budget.md`)로 기록만 |
| 4 | convention_compliance | Rationale 소제목 표기 방식이 형제 문서 간 다름(`R-N` prefix vs 자유 제목) — 정식 규약 위반 아님 | `spec/2-navigation/2-trigger-list.md` vs `1-workflow-list.md`/`3-schedule.md` | 강제 아님. 통일하려면 project-planner가 SKILL.md 에 anchor 표기 규칙 성문화 |
| 5 | plan_coherence | `member-dup-remove.md` 하단 `## 체크리스트`의 "`/ai-review` → 수렴" 항목이 실제 수렴(라운드 3 LOW·Critical 0) 이후에도 미체크 | `plan/in-progress/member-dup-remove.md` 하단 체크리스트 | `plan/complete/` 이관 전 마무리 커밋에서 `- [x]`로 갱신(근거로 라운드 3 SUMMARY/RESOLUTION 경로 첨부) |
| 6 | naming_collision | 신규 e2e 파일명이 형제 다섯의 `*-delete-concurrency.e2e-spec.ts` 패턴과 다른 `-remove-` 사용 — 실제 경로 충돌 아님, 관례 드리프트 | `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` | 조치 불요 — developer 자신이 이미 tracker(`spec-draft-nullable-notation-followups.md`)에 자체 정정·등재. 재-flag 로 중복 백로그 생성 금지 |
| 7 | naming_collision | `throwMemberNotFound()` — 형제 서비스(`throwTriggerNotFound`/`throwScheduleNotFound`/`throwIntegrationNotFound`)와 명명 대칭, 충돌 없음 확인 | `workspaces.service.ts:342` | 없음(확인용) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 코드가 impl-prep 예고와 1:1 일치, 새 충돌 없음. owner TOCTOU 는 기존 갭(이미 추적) |
| rationale_continuity | LOW | 형제 5건과 동일 패턴 재사용, 기각 대안 재도입 없음. DELETE 멱등성 충돌 6번째 인스턴스(기존 처분 재확인) |
| convention_compliance | NONE | 로드된 3파일 전부 명명·출력포맷·API 문서 규약 위반 없음. 예산 절단으로 스코프 제한 |
| plan_coherence | NONE | 미해결 결정 우회 없음, 선행 plan 완료 확인, `--impl-prep` WARNING 이미 해소. 체크리스트 한 줄 미체크만 잔존 |
| naming_collision | NONE | spec/2-navigation 델타 0, 신규 식별자(`throwMemberNotFound`, e2e 파일명) 실제 충돌 없음. e2e 명명 드리프트는 기추적 |

## 권장 조치사항
1. (선택) `member-remove-concurrency.e2e-spec.ts` 명명 드리프트·owner TOCTOU·DELETE 멱등성 각주는 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 이미 등재돼 있으므로 별도 조치 불요 — 이 PR 을 막을 근거 없음.
2. `plan/complete/` 이관 전 마무리 커밋에서 `plan/in-progress/member-dup-remove.md` 하단 체크리스트의 "`/ai-review` → 수렴" 항목을 `- [x]`로 갱신.
3. 이 PR 자체는 즉시 진행 가능 — BLOCK 해소 대상 없음.
