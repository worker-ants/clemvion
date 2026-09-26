# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 전문 확보, Critical 0건.

## 전체 위험도
**LOW** — Critical 없음. cross_spec/rationale_continuity/convention_compliance 는 NONE, plan_coherence/naming_collision 이 LOW를 보고했고 근거는 모두 "예정된 마무리 커밋 범위에서 처리되는 트래커/이동 채무" 로 한정된다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `/ai-review` 2라운드 RESOLUTION(W2)이 약속한 트래커 신규 항목 "성공 응답을 광고하지 않는 라우트 핸들러가 15곳 있다" 가 아직 등재되지 않음 | `plan/in-progress/post-status-openapi.md` §요구 6, 체크리스트 `- [ ] 트래커 항목 닫기 · 신규 등재` | `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 문구 grep 0건), `review/code/2026/09/26/10_23_50/RESOLUTION.md` W2 | 마무리 커밋 전에 트래커에 신규 항목 신설(15곳 목록 인용) + `swaggerResponseStatuses` docstring 수치 오기 정정 메모를 함께 실을 것 |
| 2 | plan_coherence | 4개 변경 전부 반영 완료된 spec draft plan 이 `plan/complete/` 로 이동되지 않고 `status: in-progress` 로 남아 있음 | `plan/in-progress/spec-draft-swagger-http-status-guard.md` | 선례 `plan/complete/spec-draft-web-chat-console.md` | `status: complete` 로 갱신 후 `plan/complete/` 로 이동 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `api-convention.md` §6 표가 신규 "광고=실제 성공 코드" 불변식(`swagger.md` §2-4, 가드 `http-status-advertised`)을 역참조하지 않음 | `spec/5-system/2-api-convention.md` §6 vs `spec/conventions/swagger.md` §2-4 | 이미 `spec-draft-nullable-notation-followups.md` 백로그에 등재됨 — planner 여유 있을 때 처리, 신규 조치 불요 |
| 2 | cross_spec | §6 "204=삭제 성공" 일반 서술과 `workspaces` DELETE 3곳(`revokeInvitation` 포함, 모두 200 광고)의 괴리가 한 곳 더 명문화됨 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts` `revokeInvitation` vs `spec/5-system/2-api-convention.md` §6 | 이미 백로그 등재, 이번 diff가 그 항목 본문("셋째 라우트")을 함께 갱신 — 신규 조치 불요 |
| 3 | rationale_continuity | `swagger.md` §2-4 신설 Rationale 스스로 "자원을 만들지 않는 POST 액션" 분류가 §6 표에 명문 규칙 없이 교차 추론으로 결정됐음을 인정 | `spec/conventions/swagger.md` §2-4 Rationale vs `spec/5-system/2-api-convention.md` §3/§6 | 이미 트래커(W4)·`spec-draft-nullable-notation-followups.md` 등재, 후속 planner 턴에서 §6/§2-4에 행 추가 시 이 Rationale 인용 |
| 4 | convention_compliance, plan_coherence | plan 경로 전방 참조 2곳(`e2e` 헤더 docstring + 트래커 4885행)이 아직 존재하지 않는 `plan/complete/post-status-openapi.md` 를 인용 | `codebase/backend/test/action-success-status.e2e-spec.ts:13`, `plan/in-progress/spec-draft-nullable-notation-followups.md:4885` | `review/code/2026/09/26/10_23_50/RESOLUTION.md` INFO1 이 e2e 헤더 1곳은 이미 처분함 — 마무리 커밋에서 `post-status-openapi.md` → `plan/complete/` 이동 시 두 참조 모두 유효해지는지 함께 재확인 |
| 5 | plan_coherence | 신규 repo-guard 쌍(`http-status-advertised{-guard.ts,.spec.ts}`) 추가로 `spec-conventions-engine-error-code-surface.md` 의 파일-쌍 카운트(14/15)가 stale (실제 15/16) | `codebase/backend/src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}` | 급하지 않음 — 그 문서가 이미 "결정 턴에 재측정" 을 관례로 명시, `repo-guards.md` 신설/등재 결정 턴에 포함해 재측정 |
| 6 | naming_collision | 신규 e2e 헬퍼 `createInvitation`(`test/helpers/auth.ts`)이 기존 컨트롤러 핸들러 `WorkspacesController.createInvitation` 과 동명 | `codebase/backend/test/helpers/auth.ts` vs `codebase/backend/src/modules/workspaces/workspaces.controller.ts:468` | 계층 분리(e2e 클라이언트 헬퍼 vs 서버 핸들러)로 컴파일/런타임 충돌 없음, 저장소 기존 헬퍼 명명 관례와도 일치 — 강제 아니지만 원하면 `createInvitationViaApi` 로 개명 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 15곳 상태 코드 정정이 기존 spec 서술(200)과 오히려 더 정합해짐. 남은 두 관찰은 이미 백로그 등재됨 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복·암묵적 가정 충돌 전부 없음. 유일한 INFO도 트래커에 이미 위임된 사안 |
| convention_compliance | NONE | 명명·문서구조·API 데코레이터 재사용·`code:` frontmatter 등재 모두 기존 정본과 일치. INFO 1건은 이전 라운드가 이미 처분 |
| plan_coherence | LOW | 두 미해결 정책 결정(204 전환 여부·repo-guard 등재 여부)은 정당하게 보류됐으나, `/ai-review` 라운드2 RESOLUTION이 약속한 트래커 신규 항목 미등재 + 반영 완료 draft plan 미이동이 마무리 커밋 전 확인 필요 |
| naming_collision | LOW | 신규 식별자 표면(가드 파일·타입·e2e 헬퍼) 전수 grep 대조 결과 충돌 없음. 유일한 관찰(`createInvitation` 동명)은 계층 분리로 위험 낮음 |

## 권장 조치사항

1. (BLOCK 해소 사유 없음 — Critical 0건이므로 필수 선행 조치는 없음)
2. 마무리 커밋 전, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "성공 응답을 광고하지 않는 라우트 핸들러가 15곳 있다" 신규 항목을 추가하고 `swaggerResponseStatuses` docstring 수치 오기 정정 메모를 함께 싣는다 (WARNING 1).
3. `plan/in-progress/spec-draft-swagger-http-status-guard.md` 를 `status: complete` 로 갱신 후 `plan/complete/` 로 이동한다 (WARNING 2).
4. 같은 마무리 커밋에서 `plan/in-progress/post-status-openapi.md` 를 `plan/complete/` 로 이동하며, `action-success-status.e2e-spec.ts:13` 과 `spec-draft-nullable-notation-followups.md:4885` 두 전방 참조가 모두 유효해지는지 확인한다 (INFO 4).
5. 나머지 INFO(1·2·3·5·6)는 이미 추적 중이거나 급하지 않은 사안으로, 이번 PR에서 추가 조치 불요.
