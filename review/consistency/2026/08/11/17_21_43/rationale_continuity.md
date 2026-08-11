# Rationale 연속성 검토 — stop-editor-403-docs

## 검토 대상

`spec/conventions/**` scope, `--impl-done`(diff-base `origin/main`). 실제 target 변경은 diff 로
확인한 결과 세 갈래:

1. `spec/3-workflow-editor/3-execution.md` — §4 표에 "권한 | Editor+" 행 추가, §9 API 표 `/stop` 행에
   "Editor+" 부기.
2. `spec/conventions/node-cancellation.md` §2.3 — "사용자 cancel 버튼" 항목에 "Editor+ 전용(viewer
   미노출, FE `canEdit` 가드, 서버 `@Roles('editor')` 403)" 문구 추가.
3. `spec/conventions/swagger.md` §5-4 체크리스트 + `12-workspace.md` 인용 2곳에 앵커 프래그먼트 추가.
4. (code_areas diff) 16개 컨트롤러 51곳에 `@ApiForbiddenResponse({ description: '워크스페이스
   멤버가 아님' })` 일괄 부착.

plan 근거 문서: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` — "신규 결정이
아니다, §3.2 가 이미 확정한 권한을 파생 문서에 반영하는 것" 이라고 명시.

## 확인 1 — `1-auth.md §3.2` vs `/stop` `@Roles('editor')` 의 선후 관계

- `git log --all -S "Workflow 실행" -- spec/5-system/1-auth.md` → 유일한 히트: `ca227cc36`
  ("PRD, SPEC" 초안, **2026-03-26**). §3.2 "Workflow 실행 | Owner ✅ | Admin ✅ | Editor ✅ |
  Viewer —" 행은 이 초안 이후 문구 변경 없이 유지됐다(그 이후 diff 는 §3.2 의 "멤버 관리" 행
  Admin CRU→CRUD 정정뿐, "Workflow 실행" 행은 미변경).
- `git blame -L 121,123 codebase/backend/src/modules/executions/executions.controller.ts` →
  `@Post(':id/stop')` 자체는 `8ff4e85644`(2026-03-30, 초기 스캐폴드)부터 있었으나, **`@Roles('editor')`
  는 `8d84f6e9f4`(2026-08-08)** 에서 처음 부착됐다.
- `git show -s 8d84f6e9f4` → `fix(auth): @Roles() 없는 라우트의 워크스페이스 멤버십 검증 누락 —
  cross-tenant 차단 (P0) (#1103)`. plan 이 인용한 `auth-workspace-membership-guard` P0 PR 과 일치.

**판정**: §3.2 (2026-03-26) 가 `@Roles('editor')` 코드 부착(2026-08-08)보다 **4개월 이상 선행**한다.
코드가 먼저이고 §3.2 가 사후 정당화인 패턴(순서 역전)이 **아니다** — plan 의 "신규 결정이 아니라
기존 §3.2 를 파생 문서에 반영" 이라는 판정은 실측과 일치한다. 새 Rationale 불요 결론은 타당.

## 확인 2 — EIA R14 (`R14. 토큰 실패 status 통일 — 모두 401, 403 미사용`) 와의 충돌 여부

`spec/5-system/14-external-interaction-api.md` §Rationale R14 전문을 확인했다. 범위 문구를
직접 인용:

> "**채택**: EIA inbound 의 모든 **토큰류** 실패(`TOKEN_INVALID`/`TOKEN_EXPIRED`/`TOKEN_REVOKED`/
> `TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH`)를 단일 `401` 로 표기…" / "EIA **토큰 인증** 실패
> 코드(`TOKEN_*` 계열)의 status·코드명 정합은 §5.1 에러 표 + 아래 R14 가 SoT"

R14 는 **EIA 전용 `interaction-token`(`iext_<JWT>`/`itk_<opaque>`) 토큰 인증 실패**에 국한된
결정이다(swagger.md §2-1 이 `interaction-token` Bearer scheme 을 EIA 전용으로 별도 등록한다고
명시). 반면 이번 PR 이 건드리는 51 라우트·`/stop` 은 전부 `access-token`(대시보드 로그인 사용자)
Bearer scheme + `@Roles()`/`RolesGuard` 워크스페이스 멤버십 인가 표면이며, 코드상으로도
`interaction.controller.ts` 류는 diff 에 전혀 등장하지 않는다.

또한 `spec/5-system/3-error-handling.md` 를 보면 내부 API 는 애초부터 403 을 role/membership
실패의 표준 status 로 광범위하게 쓴다 — `FORBIDDEN`(403, generic), `ADMIN_REQUIRED`(403),
`NOT_A_MEMBER`(403), `CANNOT_ASSIGN_OWNER`(403), `WORKSPACE_TYPE_MISMATCH`(403) 등. "403 을 쓰지
않는다"는 저장소 전역 원칙은 존재하지 않는다 — R14 는 EIA 토큰 인증이라는 **한 표면에 한정된
예외적 채택**이고, 그 결정문 자체가 이유로 "EIA 토큰은 execution-scoped 라 scope 불일치가 사실상
인증 실패에 가깝다"는 **EIA 토큰 특유의 논거**를 들고 있어 내부 RBAC 표면으로 일반화되도록 쓰여
있지 않다.

**판정**: 충돌 아님, **별개 표면**. `/stop` 403·51 라우트 403 문서화는 R14 가 기각한 대안(EIA
토큰 실패를 403 으로 세분)을 재도입하는 것이 아니다 — 애초에 같은 인증 메커니즘도, 같은
컨트롤러 계열도 아니다.

## 확인 3 — `swagger.md §Rationale` 과의 일관성

`swagger.md` §Rationale "§5-4 확장 배경 — `@WorkspaceId()` 소비 라우트로 확대 (2026-08-08)" 이
이미 다음을 명시적으로 확정해 두었다: `RolesGuard` 가 opt-out 불가능하게 재구성되어
`@Roles()` 유무와 무관하게 멤버십을 검증하므로, `@WorkspaceId()` 만 쓰는 라우트도 403 을
낼 수 있고 §5-4 체크리스트가 `@ApiForbiddenResponse` 부착을 요구한다는 내용이다. 이번 PR 의
51 라우트 일괄 부착(문구 통일: `'워크스페이스 멤버가 아님'`)은 이 기존 Rationale 이 이미
지시한 바를 실행에 옮긴 것으로, **새 결정도 아니고 기존 결정과 어긋나지도 않는다** — plan
§2 "트리거" 절이 이 인과관계를 정확히 서술하고 있다.

부수 확인: swagger.md 가 새로 단 앵커(`#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08`)는
`spec/data-flow/12-workspace.md` 의 실제 헤딩("### 멤버십 검증은 가드 1곳에서 — `@Roles()` 와
무관 (2026-08-08)")과 슬러그가 일치해 링크가 유효하다.

## 발견사항

이번 검토 관점(기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 가정 충돌) 중
어느 것에도 해당하는 CRITICAL·WARNING 급 결함을 찾지 못했다. 세 확인 항목 모두 실측(git
blame/log, Rationale 원문 대조)으로 뒷받침되며, plan 의 "신규 결정이 아니다" 판정과 실제
target 변경(새 Rationale 미신설, 기존 문구 인용만 추가) 이 일치한다.

- **[INFO]** EIA R14 와의 구분을 문서에 한 줄 명시하면 향후 혼동을 예방할 수 있음
  - target 위치: 해당 없음 (target 자체엔 문제 없음, 예방적 제안)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §Rationale R14
  - 상세: R14 는 "EIA 토큰 인증"이라는 좁은 스코프에 한정된 결정이지만, 리포지토리에 "403 은
    쓰지 않는다"는 취지의 표어로 잘못 일반화되어 회자될 위험이 있다(이번 검토 요청 자체가 그
    가능성을 전제로 했다). R14 본문은 이미 스코프를 명시하고 있어 강제 조치는 아니다.
  - 제안: 필요하다면 `swagger.md` §2-4 상태 코드 표 근처에 "EIA `interaction-token` 표면의 토큰
    인증 실패는 R14 에 따라 401 로 통일되며 이 표(내부 RBAC 403)와는 별개" 라는 각주를 추가할
    수 있음. 우선순위 낮음(현재 어떤 문서도 이를 혼동하지 않음 — 예방적 제안일 뿐).

## 요약

target 의 세 갈래 변경(`3-execution.md`/`node-cancellation.md` 의 Editor+ 부기, `swagger.md`
앵커 정정, 51 라우트 `@ApiForbiddenResponse` 일괄 부착) 모두 새 Rationale 을 요구하지 않는다.
`1-auth.md §3.2` 는 `git log`/`git blame` 실측상 `/stop` 의 `@Roles('editor')` 코드 부착보다
4개월 이상 앞서 존재했으므로 "코드가 먼저이고 spec 이 사후 정당화" 패턴이 아니며, plan 의
판정은 정확하다. EIA `R14`(토큰 인증 401 통일, 403 미사용)는 EIA 전용 토큰 인증이라는 좁은
스코프의 결정이고, 이번 변경이 건드리는 51 라우트·`/stop` 은 전혀 다른 인증 메커니즘(내부
`access-token` + RBAC)이라 충돌하지 않는다 — 오히려 내부 API 에서 403 은 `error-handling.md`
전역에 걸쳐 이미 표준적으로 쓰인다. `swagger.md §Rationale` 의 §5-4 확장 서술(2026-08-08)은
이번 51 라우트 일괄 부착의 트리거를 이미 정확히 예고해 두었으므로 이번 소급 이행과 완전히
일관된다. 억지로 만든 결함은 없다 — 특히 2번(EIA R14 충돌 가설)은 엄격히 대조했고 반증됐다.

## 위험도
NONE

BLOCK: NO
STATUS: OK
