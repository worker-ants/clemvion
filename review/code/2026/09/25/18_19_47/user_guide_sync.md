# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json`(`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read. 이번 5라운드 changeset(`codebase/**` 30개 파일 — 28개는 3·4라운드와 동일한 backend RBAC 가드/데코레이터/workspaces 모듈/repo-guards/e2e, 신규 편입 2건은 `codebase/backend/src/modules/workspaces/dto/add-member.dto.ts`·`codebase/frontend/src/components/auth/role-gate.tsx`)를 각 행의 trigger 에 매칭했다.

## trigger 매칭 및 검토

### 1) `auth-session-flow-change` (인증·권한·세션 흐름 변경)
- trigger: `codebase/backend/src/modules/auth/**`(semantic) — `auth.controller.ts`/`auth.service.ts` 직접 매칭, `common/guards/roles.guard.ts`·`common/decorators/workspace*.ts`·`common/constants/workspace-roles.ts`·`modules/workspaces/**` 는 같은 RBAC 흐름의 semantic 확장으로 포함.
- target: `codebase/frontend/src/content/docs/07-workspace-and-team/` 관련 페이지 + e2e.
- **e2e**: `workspace-path-guard.e2e-spec.ts`(신규)·`workspace-rbac.e2e-spec.ts`·`workspace-delete-concurrency.e2e-spec.ts` 가 같은 changeset — 충족.
- **`07-workspace-and-team/*.mdx`**: 이번에도 미변경.
- **독립 재검증(3·4라운드 결론 재확인, 새 파일 2건 포함)**:
  - `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` 를 직접 Read — 역할표(Owner: 삭제·이양 / Admin: 초대·제거·설정 / Editor: CRUD+실행 / Viewer: 읽기전용), "나가기(유일 Owner 차단)", "Owner 이양(비-Owner 대상, 트랜잭션 swap)", "삭제(Owner 전용)" 서술이 이번 changeset 의 실제 동작(`transferOwnership` 인가 순서 수정 `1f616ef05`, `RolesGuard` 경로 파라미터 확장)과 **여전히 부합** — 권한 규칙 자체는 하나도 바뀌지 않았다.
  - `add-member.dto.ts`(신규 편입) diff 확인 — `WORKSPACE_ROLES` 값(`owner/admin/editor/viewer`)은 그대로이고 `satisfies readonly WorkspaceRoleName[]` 타입 안전성만 추가됐다. 새 역할 이름·새 필드 없음 → 문서 갱신 대상 아님.
  - `role-gate.tsx`(신규 편입) diff 확인 — 주석만 "Backend `roles.guard.ts`" → "Backend `common/constants/workspace-roles.ts`" 로 갱신(내부 리팩터 추적용), JSX·사용자 문자열 변경 없음 → `new-ui-string` trigger(신규 한국어 리터럴) 미해당, i18n dict 갱신 불요.
  - `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` grep — frontend 는 여전히 `workspace/settings/page.tsx`·`workspace-store.ts`·`lib/api/auth.ts` 3곳만 `OWNER_REQUIRED` 하나를 분기 소비(변경 없음), `error-codes.ts`/`backend-labels.ts` 어디에도 이 4개 코드가 등재돼 있지 않음을 재확인 — `new-error-code`/`new-warning-code` 계열과 무관(3라운드 결론과 동일).
  - `workspaces.controller.ts` swagger — `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE` 상수가 여전히 `@ApiForbiddenResponse` 전부에 부착돼 있음(`backend-api-change` target (a) 계속 충족).

## 판단 — 이번 라운드에도 `07-workspace-and-team/` 미갱신이 실제 갭인가

**"아니오"** — 3라운드(`17_14_49`)가 스펙 실측·frontend 기존 코드 매핑으로 도달한 결론이, 4라운드 fix(`1f616ef05`/`61ca58343`/`4c6f4f033`)로 편입된 2개 파일(`add-member.dto.ts`, `role-gate.tsx`)을 포함해도 그대로 유지된다. 이 판단은 `plan/in-progress/workspace-path-guard-impl.md` §구현 중 결정에 "유저 가이드 `07-workspace-and-team/workspaces-and-members.mdx`(+`.en`) — 검토함, 갱신 불필요(`/ai-review` `16_03_32` W8)" 로 이미 명문화됐고, 4라운드 `RESOLUTION.md` 가 "W8: 변경 없음 — 검토 후 갱신 불필요, 근거는 plan §구현 중 결정" 으로 재확인·종결했다. 4라운드 SUMMARY 는 이를 WARNING(LOW)으로 잠정 표기했지만 RESOLUTION 이 "변경 없음이 옳은 처분" 이라고 결론지었고, 이번 라운드의 독립 재검증(위)도 같은 결론에 도달했다 — 문서 텍스트·frontend 소비처·swagger·e2e 어느 것도 이번 changeset 으로 stale 해지지 않았다.

## 발견사항

- **[INFO]** `auth-session-flow-change` trigger 매칭(semantic) — `07-workspace-and-team/*.mdx` 는 이번 changeset 에도 없지만, 3회 연속(3·4·5라운드) 독립 검증 결과 사용자 가시 권한·흐름에 실질 변경이 없어 stale 위험 없음. 절차 항목으로는 이미 plan 에 명문화·처분 완료.
  - 변경 파일: `codebase/backend/src/modules/auth/auth.controller.ts`, `codebase/backend/src/modules/auth/auth.service.ts`, `codebase/backend/src/common/guards/roles.guard.ts`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts`, `codebase/backend/src/modules/workspaces/workspaces.service.ts`, `codebase/backend/src/modules/workspaces/dto/add-member.dto.ts` 등
  - 매트릭스 항목: `auth-session-flow-change` — targets `["codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"]`
  - 누락된 동반 갱신(형식상): `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` + `.en.mdx` — 다만 실질적 stale 은 아님(위 판단 참고)
  - 상세: e2e 몫은 3건 신설로 충족. 문서 몫은 `plan/in-progress/workspace-path-guard-impl.md` §구현 중 결정에 "검토함, 갱신 불필요" 로 명문 근거가 있고, 4라운드 RESOLUTION 이 "변경 없음" 으로 이미 종결. 이번 라운드에 새로 편입된 `add-member.dto.ts`(역할 이름 불변, 타입 안전성만 추가)·`role-gate.tsx`(주석 갱신, UI 문자열 불변) 도 이 결론을 흔들지 않는다.
  - 제안: 강제 조치 불필요(추가 조치 없음). 다음 라운드가 다시 같은 재조사를 하지 않도록, 이 판단은 이미 3라운드 연속(`17_14_49`·`17_47_18`·본`18_19_47`) 동일하게 도달했다는 점만 기록해 둔다.

## 요약
매트릭스 21행 중 이번 changeset(30개 파일, 29개 backend + 1개 frontend 주석-only)에 매칭되는 trigger 는 `auth-session-flow-change` 1건(+ 부수적으로 `backend-api-change` swagger 몫은 이미 충족 확인)이며, `07-workspace-and-team/` MDX 미갱신은 3라운드 연속 독립 검증으로 실질 stale 이 아님이 확인됐고 plan 에 처분 근거가 명문화돼 있다. `role-gate.tsx`(신규 UI 문자열 없음)·`add-member.dto.ts`(역할 이름 불변)를 포함해도 i18n parity·backend-labels·신규 섹션 locale 등록 등 CRITICAL 대상 trigger 는 매칭되지 않는다. CRITICAL 0 · WARNING 0 · INFO 1.

## 위험도
NONE
