# Plan 정합성 검토 — spec/5-system/ (--impl-done)

## 발견사항

- **[INFO]** `spec-fix-swagger-forbidden-response.md` 의 "반영 완료" 기록과 draft 본문 인용이 서로 다르다 (target 과 무관, 인접 plan 위생)
  - target 위치: 해당 없음 (target=`spec/5-system/`, 이 항목은 `spec/conventions/swagger.md` 관련)
  - 관련 plan: `plan/in-progress/spec-fix-swagger-forbidden-response.md` §"제안 변경"(L79-85, `1-auth.md §3.3` 인용 잔존) vs §"반영 완료"(L108-122, "인용을 `1-auth.md §3.3` → `data-flow/12-workspace.md §Rationale` 로 교체" 라고 자체 기록)
  - 상세: 실측(`Read spec/5-system/1-auth.md §3.3`, 본 세션에서 확인)으로 §3.3 은 header-first 우선순위만 서술하고 "`@Roles()` 무관 무조건 멤버십 검증"을 명문화하지 않는다 — plan 이 정정 사유로 든 관찰 자체는 정확하다. 다만 그 plan 문서의 "제안 변경" 절 원문(적용 전 draft 본문)이 정정 이전 인용을 그대로 남겨 두어, 나중에 이 문서만 훑는 사람이 "제안"과 "반영 완료" 두 절에서 서로 다른 인용을 보게 된다. 실제 적용 대상 `spec/conventions/swagger.md`(target 밖)에 어느 인용이 반영됐는지는 이번 검토 범위에서 재확인하지 않았다.
  - 제안: 본 auth-guard-reflection-hardening PR 의 작업 범위는 아니다(별 plan·별 worktree 소유). 다음에 그 plan 을 만지는 사람이 draft 절 원문도 함께 정정하거나 "적용본과 다름" 각주를 남기면 재확인 비용을 던다.

## 확인한 것 (충돌 없음 — 근거)

- **spec_impact: none 주장 검증** — `auth-guard-reflection-hardening.md` 는 비-UUID `X-Workspace-Id` 400 응답 코드로 `VALIDATION_ERROR` 를 재사용하며 "`2-api-convention.md §5.3` 이 정한 400 기본값이라 spec 변경 불요"라 주장한다. target 실측(`spec/5-system/2-api-convention.md §5.3` L1033: `400=VALIDATION_ERROR`)으로 그 주장은 참이다. git diff(`origin/main...HEAD`)에도 `spec/` 하위 파일 diff 가 0건이라 `spec_impact: none` 과 실제 변경이 일치한다.
- **"후속 (이 PR 밖)" 두 항목의 target 미반영은 의도된 지연이지 누락이 아니다** — plan 은 (1) `3-error-handling.md §1.3` 에 "헤더 present-but-malformed → `VALIDATION_ERROR`" 행 추가, (2) `1-auth.md` frontmatter `code:` 글로브에 `common/decorators/*.ts`·`common/utils/{workspace-context.util,uuid}.ts` 추가를 developer 권한 밖(`spec/` write) 이라 planner 턴으로 명시 이관했다. target 실측(`3-error-handling.md §1.3` 표, `1-auth.md` frontmatter)으로 둘 다 아직 미반영 상태임을 확인했으며, 이는 plan 의 서술과 정확히 일치한다(누락이 아니라 문서화된 지연).
- **`plan-lifecycle.md §3` 이동 규칙 준수** — 이 plan 은 미체크 항목(`push + PR`, "후속" 섹션 다수)이 남아 있어 `complete/` 로 옮기지 않고 `in-progress/` 에 그대로 있다. 규칙과 일치.
- **인접 plan(`spec-fix-swagger-forbidden-response.md`·`spec-sync-stop-editor-and-forbidden-routes.md`·`spec-sync-auth-gaps.md`)과의 전제 충돌 없음** — 이들은 모두 `handlerConsumesWorkspaceId`/`RolesGuard` 의 **기존 의미론**(멤버십 검증은 `@Roles()` 유무와 무관)을 전제로 삼는데, 본 PR 의 diff 는 그 함수의 판별 로직 자체(`workspace.decorator.ts`, `roles.guard.ts`)를 변경하지 않았다(diff 목록에 두 파일의 `.spec.ts` 만 있고 본체 변경 없음) — 부트 캐너리 추가·400 사전검증·메모이제이션 보류만 있다. 따라서 다른 plan 이 실측한 "73개 라우트" 등 수치·전제는 무효화되지 않는다.
- **`spec-draft-workspace-header-membership-invariant.md` → `complete/` 이동 근거 재확인** — plan 이 "checker 권고를 오버라이드했다"고 적은 부분을 실측(`Read plan/complete/spec-draft-workspace-header-membership-invariant.md`)으로 확인, 실제로 `complete/` 에 존재하고 내용도 plan 서술과 일치한다.
- 워크스페이스 헤더 검증에서 `isUuidShaped`(canonical 8-4-4-4-12, nil UUID·v7 허용) 채택 결정은 다른 in-progress plan 이 nil UUID 를 거부 대상으로 전제하는 곳이 없어(전수 grep) 충돌 없음.

## 요약

target(`spec/5-system/`)은 이번 diff 로 전혀 수정되지 않았고(`git diff origin/main...HEAD -- spec/` 0건), 이는 plan 이 명시한 `spec_impact: none` 과 정확히 일치한다. plan(`plan/in-progress/auth-guard-reflection-hardening.md`)이 "이 PR 밖"으로 이관한 두 spec 갱신 항목(에러 코드 카탈로그 행 추가·frontmatter code glob 확장)은 target 에 아직 반영돼 있지 않지만, 이는 plan 자체가 developer 권한 밖이라고 명시적으로 기록한 의도된 지연이며 방치·은폐가 아니다. 같은 영역(워크스페이스 멤버십 가드)을 다루는 인접 in-progress plan 들(`spec-fix-swagger-forbidden-response.md`·`spec-sync-stop-editor-and-forbidden-routes.md`·`spec-sync-auth-gaps.md`)의 전제·수치는 이 PR 이 `handlerConsumesWorkspaceId`/`RolesGuard` 의 판별 로직 자체를 바꾸지 않았으므로 무효화되지 않는다. 발견된 유일한 항목은 target 과 무관한 인접 plan 문서 내부의 사소한 인용 불일치(INFO)뿐이다.

## 위험도
NONE
