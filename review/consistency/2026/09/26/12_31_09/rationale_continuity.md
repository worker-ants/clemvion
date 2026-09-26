# Rationale 연속성 검토 — forbidden-desc-codes

## 검토 범위 요약

프롬프트 번들은 컨텍스트 예산으로 대부분 절단됐으나, 번들 말미의 "판단 전에 Read 로 직접 읽을 것" 지시에 따라
아래 문서를 절대경로로 직접 읽어 판정했다:

- `/Volumes/project/private/clemvion/.claude/worktrees/forbidden-desc-codes/spec/conventions/swagger.md` (§2-4, §5-4, `## Rationale` 전체)
- `/Volumes/project/private/clemvion/.claude/worktrees/forbidden-desc-codes/spec/data-flow/12-workspace.md` (§Rationale "멤버십 검증은 가드 1곳에서", "경로 파라미터 워크스페이스도 가드가 본다", "가드 거부의 오류 코드")
- `/Volumes/project/private/clemvion/.claude/worktrees/forbidden-desc-codes/spec/5-system/1-auth.md` (§3.1/§3.2 RBAC 역할·권한 매트릭스)
- `/Volumes/project/private/clemvion/.claude/worktrees/forbidden-desc-codes/spec/5-system/2-api-convention.md`, `5-system/3-error-handling.md`, `conventions/error-codes.md` (에러 코드 카탈로그, 교차 검증용)
- 코드 diff 전문 (`_code_diff.patch`, 32파일/2407줄) — 특히 `workspace-roles.ts`/`.spec.ts`, `roles.guard.ts`, `common/swagger/forbidden-descriptions.ts`/`.spec.ts`, `repo-guards/__tests__/forbidden-response-codes{-guard.ts,.spec.ts}`
- `plan/in-progress/forbidden-desc-codes.md` (실측·처방·검토 경고 처리·뮤턴트 표·체크리스트)

번들 앞부분에 실려 있던 `2-navigation/1-workflow-list.md`·`2-trigger-list.md` 등은 review_guard 가
"컨트롤러를 `code:` 로 소유"한다는 이유로 스코프에 걸린 파일들이며, 실측(`grep -rln
"NOT_A_MEMBER\|EDITOR_REQUIRED\|ADMIN_REQUIRED\|OWNER_REQUIRED\|워크스페이스 멤버가 아님" spec/`)으로 확인한 결과
403 거부 코드를 서술하는 spec 은 `2-navigation/4-integration.md`·`6-config.md`·`9-user-profile.md`·
`5-system/2-api-convention.md`·`3-error-handling.md`·`13-replay-rerun.md`·`1-auth.md`·`conventions/swagger.md`·
`conventions/error-codes.md`·`data-flow/12-workspace.md`·`data-flow/5-integration.md` 뿐이었다. 이 문서들은 모두
`data-flow/12-workspace.md §Rationale "가드 거부의 오류 코드"` 를 SoT 로 인용하며, 본 PR 의 헬퍼가 내는 문장·코드와
어긋나는 곳이 없었다 — workflow-list/trigger-list 는 403 문장을 서술하지 않으므로 이 축의 drift 후보가 아니다.

## 발견사항

이번 PR 은 오히려 기존 Rationale 을 **정확히 실행에 옮기는** 성격이 강하다. 기각된 대안의 재도입·합의 원칙 위반·
무근거 번복·암묵적 가정 충돌 중 어느 것도 발견하지 못했다.

- **[INFO] 새 헬퍼가 인용하는 두 Rationale 은 실제 이력과 정합**
  - target 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (신규), `spec/conventions/swagger.md` §5-4 "403 설명의 거부 코드"
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드 (2026-09-25)" — "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`" (채택안 나)
  - 상세: `forbiddenForRole()`/`FORBIDDEN_NOT_A_MEMBER` 가 만드는 문장·코드 조합(`NOT_A_MEMBER` 항상 + 역할 미달 시 `EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`, `viewer` 는 멤버십과 동일)이 위 Rationale 표·`ROLE_REQUIRED.viewer === NOT_A_MEMBER` 정의와 1:1 일치한다. `plan/in-progress/forbidden-desc-codes.md` 의 실측 수치(157/129/54/53/4 등)도 `swagger.md` §5-4 (2026-09-26) 본문 수치와 일치해, 지어내거나 소급 부여된 "기각된 대안" 이 아니라 실제 실측·결정 이력에 기반한다.
  - 제안: 없음 — 현 상태 유지.

- **[INFO] 과거 기각된 "opt-in 데코레이터" 패턴을 재도입하지 않았음을 확인**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts` (`scanForbiddenResponseCodes`, reflection 전수 스캔)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서" — "기각된 대안: 73개 라우트에 `@Roles('viewer')` 부착 — opt-in 모델의 연장이라 74번째 라우트에서 같은 누락이 재발한다"
  - 상세: 본 PR 은 개별 라우트에 데코레이터를 붙이는 방식이 아니라, `src/modules` 전수를 reflection 으로 스캔해 "가드가 낼 수 있는 코드가 설명에 빠졌는가" 를 구조적으로 검사한다 — 위에서 기각된 opt-in 확장과 반대 방향(구조적 강제)이라 재도입에 해당하지 않는다.
  - 제안: 없음.

- **[INFO] `lowestRequiredRole` 추출이 `RolesGuard` 의 판정 로직을 바꾸지 않음(동작 불변) 확인**
  - target 위치: `codebase/backend/src/common/guards/roles.guard.ts` diff (인라인 `reduce` → `lowestRequiredRole()` 호출로 치환), `common/constants/workspace-roles.ts` 신설 함수
  - 과거 결정 출처: 없음(신규 리팩터) — 다만 `spec/5-system/1-auth.md` §3.1/§3.2 의 역할 서열(Owner>Admin>Editor>Viewer)과 `WORKSPACE_ROLE_LEVEL` 상수가 일치하는지가 확인 대상이었다.
  - 상세: 추출된 함수는 기존 `roles.guard.ts` 의 인라인 로직과 완전히 동일한 계산식이며(가장 낮은 서열을 문턱으로), 저장소 가드(`forbidden-response-codes-guard.ts`)가 **같은 함수**를 재사용해 가드와 검사가 갈릴 위험을 원천 차단한다 — swagger.md §5-4 Rationale 이 명시적으로 요구한 설계("따로 옮겨 적으면 갈리는 날 검사가 가드가 내지 않는 코드를 요구한다")와 일치. 서열 밖 문자열이 섞이면 요구가 사라진다는 기존 invariant(코드 인라인 주석)도 그대로 보존되고 새 함수 docstring 에도 재서술되어 있다.
  - 제안: 없음.

- **[INFO] 서비스 계층 403 코드는 여전히 "세지 않는다" — 스코프 경계가 spec 과 일치**
  - target 위치: `forbidden-response-codes-guard.ts` `scanForbiddenResponseCodes`(가드 코드만 대조), `plan/in-progress/forbidden-desc-codes.md` "남기는 것" 절
  - 과거 결정 출처: `spec/conventions/swagger.md` §5-4 "서비스 거부는 세지 않는다"
  - 상세: 새 가드는 `RolesGuard` 파생 코드(`NOT_A_MEMBER`/역할 코드)만 판정하고, 서비스가 내는 `FORBIDDEN`(예: `workflow-test-datasets` 소유자 아님) 은 판정 대상에서 제외한다 — plan 이 "이 PR 이 판정한 유일한 서비스 거부 자리(test-datasets 두 곳)" 라고 명시해 스코프를 넘지 않았음을 밝혔다. 원칙 위반 없음.
  - 제안: 없음.

## 요약

이 PR 은 새로운 설계를 도입하기보다, 이미 spec 에 명문화된 두 Rationale — `swagger.md` §5-4 "403 설명의 거부 코드" 와
`data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드"(둘 다 이 PR 의 planner 커밋·직전 PR 이 확정한 결정) —
를 코드로 실행하는 성격의 변경이다. 헬퍼 문장·코드 조합, `lowestRequiredRole` 공유, reflection 가드의 스코프(서비스
거부 제외)가 모두 해당 Rationale 의 문면과 정확히 대응하며, 과거 명시적으로 기각된 대안(라우트별 `@Roles('viewer')`
opt-in 부착)을 재도입하지도 않았다. `plan/in-progress/forbidden-desc-codes.md` 에 실린 실측 수치·검토 경고 처리
이력도 `swagger.md`/`data-flow/12-workspace.md` 본문 수치와 정합해, "지어낸 기각 이력" 이나 "소급 부여된 근거" 로
의심할 만한 지점이 없었다. Rationale 연속성 관점에서 CRITICAL·WARNING 급 발견사항은 없다.

## 위험도
NONE
