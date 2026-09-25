# Cross-Spec 일관성 검토 — workspace-path-guard (impl-prep)

대상: `impl-prep-scope/spec/{1-auth.md, 3-error-handling.md, 12-workspace.md}` (각각
`spec/5-system/1-auth.md` · `spec/5-system/3-error-handling.md` · `spec/data-flow/12-workspace.md` 의
2026-09-25 커밋 `e2e257707` 반영본 — «경로 파라미터 워크스페이스도 가드가 본다» · «가드 거부의 오류
코드» 결정)

## 방법 노트

`_prompts/cross_spec.md` 번들은 target 3개 파일(`1-auth.md`·`3-error-handling.md`·`12-workspace.md`)과
`spec/2-navigation/{6-config,9-user-profile}.md` 는 전문이 포함됐으나, 나머지 대다수 관련 spec(예:
`spec/1-data-model.md`·`spec/2-navigation/_layout.md`·`spec/5-system/2-api-convention.md`·
`spec/data-flow/1-audit.md` 등)은 컨텍스트 예산 초과로 **"본문 생략 — 의도된 절단"** 상태였다
(`feedback_consistency_spec_mode_budget` 선례와 동일 증상). 해당 영역은 번들 안에서 대조 불가 —
아래 위험도 판단에 이 한계를 반영했다. 전문이 주어진 두 파일과 target 3파일, 그리고 워크트리의
실제 `spec/**`·`codebase/backend/src/modules/workspaces/**` 코드를 직접 대조해 검증했다.

이 target 은 이미 3라운드 `--spec` 검토(BLOCK:YES → BLOCK:YES → BLOCK:NO)를 거쳐 커밋된 상태다
(`review/consistency/2026/09/25/14_19_32`·`14_38_28`·`14_54_55`). 그 라운드에서 지적된 WARNING("없는
리소스는 어차피 404" 문장의 워크스페이스 `:id` 예외 미반영)은 현재 본문(§Rationale "UUID 검증 강도
비대칭" 정정 블록, "그 문단의 «없는 리소스는 어차피 404» 도 워크스페이스 `:id` 에는 예외다")에 반영돼
있음을 확인했다 — 재지적 아님.

## 발견사항

- **[WARNING]** `9-user-profile.md` §3 이 target 의 새 예외 조항을 반영하지 않은 채 "backend 인가
  모델은 불변" 이라고 단언한다
  - target 위치: `spec/data-flow/12-workspace.md` §Rationale "URL slug = FE 라우팅 SoT" — 2026-09-25
    갱신분: "이 절의 격리 모델과 우선순위(header-first)는 무번복이다 … **단, 경로 파라미터로
    워크스페이스를 받는 라우트는 이 모델의 예외다 — 경로 값이 인가 대상이다**"
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §3 "워크스페이스 전환" (159행, target 밖·미수정) —
    "backend 인가 모델은 **불변**: header-first(`X-Workspace-Id`) → 토큰 클레임(`activeWorkspaceId`).
    URL slug 는 FE 라우팅 SoT 일 뿐 **backend 인가 SoT 가 아니다**(계층 분리 — data-flow/12-workspace.md
    Rationale)."
  - 상세: 두 문장은 **같은 주제**(URL slug 라우팅과 backend 인가 모델의 계층 분리)를 다루고,
    9-user-profile.md 쪽이 명시적으로 `data-flow/12-workspace.md` Rationale 을 인용해 그 문서의
    보장을 그대로 반복한다. 그런데 target 커밋(`e2e257707`)이 바로 그 인용 대상 Rationale 에 "경로
    파라미터 워크스페이스 라우트는 이 모델의 예외" 라는 새 카브아웃을 추가하면서, 이를 인용하는
    9-user-profile.md 쪽 문장은 갱신되지 않았다. 실제로 이번 커밋은 같은 파일(`9-user-profile.md`)의
    다른 줄(§6.1 API 표의 `GET .../settings` 403 코드 등재)은 손댔으므로, 이 §3 문장은 "손 닿았는데
    빠뜨린" 누락이 아니라 **애초에 훑지 않은 자리**로 보인다. 이 문장만 읽는 독자는 `PATCH
    /api/workspaces/:id` 류 경로 라우트의 인가 판정이 여전히 header-first→토큰 클레임(즉 헤더로 다른
    워크스페이스를 지정하면 그 워크스페이스가 인가 대상이 된다)이라고 오해할 수 있다 — 실제로는
    2026-09-25부터 그 라우트들에서 경로 `:id` 가 인가 대상이고 헤더/토큰은 무시된다.
  - 제안: `9-user-profile.md` §3 159행에 target 의 카브아웃 한 문장을 미러링한다 — 예: "(단, 경로
    파라미터로 워크스페이스를 받는 라우트 — `/api/workspaces/:id/...` 등 — 는 예외다. 경로 값이 인가
    대상이며 header-first 는 적용되지 않는다. [data-flow §Rationale "경로 파라미터 워크스페이스도
    가드가 본다"](../data-flow/12-workspace.md#경로-파라미터-워크스페이스도-가드가-본다-2026-09-25))".
    developer 는 `spec/` 을 직접 고칠 권한이 없으므로(자기-반증형 소정정 조건 불충족 — 제품 정의
    카브아웃이라 예고·트리거 문장이 아님) 이 정정은 별도 `project-planner` 턴으로 처리해야 한다.

## 실측으로 반증되지 않은 항목 (참고 — 확인만, 지적 아님)

- Admin 8 / Owner 2 / 멤버 4(`@Roles()` 없음) + 전환 1 = 15곳 역할 분배(§Rationale "경로 파라미터
  워크스페이스도 가드가 본다")를 `workspaces.controller.ts` 실제 라우트 14개(+`auth.controller.ts`
  전환 1)와 대조 — 정확히 일치.
- `removeMember`(`DELETE :id/members/:memberId`)가 "멤버 4"(무-`@Roles()`) 그룹에 속하는 것은 §5/§1.6
  표의 "owner/admin" 서술과 표면상 어긋나 보이지만, 서비스 코드(`workspaces.service.ts`)가 실제로
  self-탈퇴(비-admin 허용)와 타인 제거(admin 요구)를 한 핸들러 안에서 갈라 처리하는 혼합 인가라 단순
  `@Roles()` 로 표현 불가 — target 의 그룹핑과 기존 서비스 구현이 일치, 신규 모순 아님.
- `3-error-handling.md` §1.2/§1.3 의 `NOT_A_MEMBER`·`EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED`·
  `WORKSPACE_ID_REQUIRED`·`VALIDATION_ERROR` 카탈로그 엔트리와 `12-workspace.md`·`1-auth.md` 의 상호
  링크(anchor) — 전부 앵커 텍스트와 대상 헤더가 일치, 깨진 링크 없음.
- `spec/2-navigation/6-config.md` (AuthConfig 라우트)는 워크스페이스를 헤더/토큰으로만 스코프하고
  경로 파라미터로 받지 않으므로 이번 변경의 영향 범위 밖 — 문서도 그렇게 서술.
- `spec/conventions/swagger.md` 의 체크리스트가 이미 `@WorkspaceParam(...)` 소비 케이스를 포함하도록
  갱신돼 있음(같은 커밋).

## 요약

target 3파일(`1-auth.md`·`3-error-handling.md`·`12-workspace.md`)은 서로 매우 촘촘하게 교차 링크돼
있고, 새 결정(경로 파라미터 워크스페이스 가드·가드 거부 코드)의 역할 분배·코드 카탈로그·앵커가 실제
컨트롤러/서비스 코드와도 정확히 일치한다. Critical 급 데이터 모델·API 계약·RBAC 모순은 발견하지 못했다.
유일한 실질 지적은 이 변경이 만든 "header-first 모델의 예외" 카브아웃이 같은 취지를 그대로 인용해
반복하던 `spec/2-navigation/9-user-profile.md` §3 로는 전파되지 않아, 그 문서만 읽으면 이제 정확하지
않은 "인가 모델은 불변" 이라는 단언이 남는다는 점(WARNING) — 이는 구현을 막을 결함은 아니지만
`project-planner` 턴에서 함께 정정해야 다음 사람이 그 문장을 SoT로 오독하지 않는다. 예산 절단으로
대조하지 못한 다수 영역(특히 `_layout.md`·`1-data-model.md`)은 이번 검토의 커버리지 밖으로 남는다.

## 위험도

LOW
