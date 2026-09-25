# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 22개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (동일 22행, 154~183줄) 을 SSOT 로 적재했다. 변경 set 은 `codebase/**` 24개 파일 — backend `modules/integrations/**` (신규 `integration-visibility.ts`/`.spec.ts`, `integration-oauth.service.ts`, `integrations.service.ts`, `integrations.controller.ts` 등) + `modules/workflow-assistant/tools/**` 일부 + `test/integration-personal-owner.e2e-spec.ts` + `06-integrations-and-config/integration-management.{mdx,en.mdx}`. `.md`/`.json` 은 프롬프트 예산상 제외됐으나 `git log`(`e2be81db8`, `f47069564`)로 spec·CHANGELOG·docs 가 이미 별도 커밋에서 갱신된 것을 확인했다.

## 발견사항

### [CRITICAL] 신규 "Admin 필요" 거부 메시지가 영문 하드코딩 — ko 매핑 전무, 프론트가 원문을 그대로 토스트에 노출

- **변경 파일**:
  - `codebase/backend/src/modules/integrations/integrations.service.ts` (라인 657-658, 663-665, 1428-1429)
  - `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (라인 423-429, `assertRequesterStillAllowed`)
- **매트릭스 항목**: 정확히 일치하는 행은 없으나 "신규 warningCode 발행" 행의 middle column과 동일한 위해 — *"`codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `WARNING_KO` 한국어 매핑 (영문 SoT — 백엔드 영문 코드, frontend 매핑)"* — 및 `spec/conventions/i18n-userguide.md` Principle 3-C *"코드만 안정적이고 메시지는 throw-site 별로 다르거나 ... 이 두 부류는 코드 / ruleId 를 안정 키로 쓰고 보간 값을 분리한 매핑으로 처리한다"* 의 정의(throw-site 별로 다른 문구, 코드만 고정 = `ADMIN_REQUIRED`)에 정확히 해당하는 케이스.
- **근거**:
  1. `integrations.service.ts:657-658` — `` this.throwAdminRequired(`Admin role is required to ${action} organization-scope integrations`) `` (action ∈ create/modify/delete/rotate/reauthorize, `IntegrationModifyAction` 타입, 385-391행 주석에 "동사"라고 명시)
  2. `integrations.service.ts:1428-1429` — `this.throwAdminRequired('Admin role is required to change integration scope')`
  3. `integration-oauth.service.ts:423-429` — `assertRequesterStillAllowed` 의 콜백 커밋-직전 재판정: `throw new ForbiddenException({ ...ROLE_REQUIRED.admin, message: 'Admin role is required to reauthorize organization-scope integrations' })`
  4. 반면 같은 `code: 'ADMIN_REQUIRED'` 의 **기존** 기본 문구(`codebase/backend/src/common/constants/workspace-roles.ts` `ROLE_REQUIRED.admin`)는 한국어다: `"Admin 이상의 권한이 필요합니다."` — 이 PR 의 새 3개 throw 지점만 그 기본값을 영문으로 **overwrite** 한다.
  5. `codebase/frontend/src/lib/i18n/backend-labels.ts` 전체에 `ADMIN_REQUIRED` 참조 0건(`grep` 확인) — 코드 기반 매핑 테이블이 이 케이스를 커버하지 않는다.
  6. **프론트가 원문 그대로 노출하는 소비처를 실측 확인**:
     - `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/danger-tab.tsx:46-48` — scope 변경 mutation 의 `onError`: `` toast.error(e.response?.data?.message ?? t("integrations.scopeUpdateFailedDefault")) `` → 위 2번 메시지가 그대로 노출.
     - `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx:449-452` — credential rotate mutation의 `onError` 동일 패턴(`e.response?.data?.message ?? t(...)`) → 위 1번 메시지(`action='rotate'`)가 그대로 노출.
     - `codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts:73-76` — OAuth 팝업 postMessage 핸들러: `` const msg = event.data.error ?? t("integrations.oauthFailedShort"); toast.error(msg); `` — 콜백 라우트가 예외 message 를 그대로 postMessage 에 실어 보내면 위 3번 메시지가 노출될 경로.
     - (대조: 같은 파일의 다른 mutation들, 예 `reauthorize`(팝업 시작)·`OWNER_REQUIRED`(workspace 설정 페이지)은 알려진 code 를 `t()` 로 매핑하는 정상 패턴을 쓴다 — 이번 3개 신규 지점만 그 관례를 벗어난다.)
- **상세**: 한국어 제품에서 Admin 이 아닌 사용자가 Organization 통합의 scope 변경·재인증·자격 교체를 시도하면 토스트에 영문 문장(`"Admin role is required to change integration scope"` 등)이 그대로 뜬다. `spec/2-navigation/4-integration.md:815`는 "동작별 문구를 싣는다"고만 규정할 뿐 언어를 지정하지 않았고, plan 문서(`plan/in-progress/integration-personal-owner*.md`) 어디에도 이 영문 노출이 알려진 후속 항목으로 기록돼 있지 않다 — 실측 대비 미인지 상태의 회귀다.
- **제안**: (a) `throwAdminRequired`/`assertRequesterStillAllowed` 의 override 문구를 한국어로 교체(예: `"Organization 통합의 ${action} 에는 Admin 이상의 권한이 필요합니다."`) 하거나, (b) Principle 3-C 패턴을 따라 `ADMIN_REQUIRED` + 동작별 안정 키(`action`)를 `backend-labels.ts` 에 `ERROR_KO`-류 매핑으로 등록하고 프론트가 `code`+`action` 조합으로 `t()` 매핑을 쓰도록 `danger-tab.tsx`/`page.tsx` 를 같은 PR에서 갱신. 최소한 (a) 만이라도 즉시 반영해야 한다.

### [WARNING] `07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}` 의 일반 역할표가 새 Viewer 예외를 반영하지 못함

- **변경 파일**: (누락된 동반 갱신 대상) `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` / `.en.mdx` — 이번 changeset 에 포함되지 않음
- **매트릭스 항목**: "인증·권한·세션 흐름 변경" — *"`codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e"* (PROJECT.md 176행) 및 자주 누락 패턴 209행: *"인증·권한·세션 흐름 변경 vs 워크스페이스 가이드(`07-workspace-and-team/`) 미갱신 — 흐름 변경 + 가이드 갱신 + e2e 가 한 묶음"*.
- **트리거 판단**: `integration-oauth.service.ts`(`assertRequesterStillAllowed`) + `integrations.service.ts`(`assertCanModify`/`throwAdminRequired`)는 워크스페이스 역할(`WorkspacesService.getMemberRole`, `ADMIN_ROLES`)을 이용한 새 커밋-직전 권한 재판정을 도입한다 — glob 은 `modules/auth/**` 가 아니라 `modules/integrations/**` 이지만 이 행은 `match:"semantic"` 이라 "역할 기반 인가 흐름 변경"의 의미로 매칭했다. e2e(`test/integration-personal-owner.e2e-spec.ts`, 신규 259줄)는 이미 갖춰져 있어 매트릭스의 "+ e2e" 부분은 충족.
- **누락된 동반 갱신**: `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx:39` / `.en.mdx:39`
- **상세**: 두 파일의 RBAC 요약표가 `| **Viewer** | 모든 리소스 읽기 전용 |` / `| **Viewer** | Read-only on all resources |` 라고 여전히 단언한다. 그런데 이번 PR로 이미 갱신된 `06-integrations-and-config/integration-management.mdx`(37-40행)는 "Viewer 는 자신의 Personal 통합에 한해 재인증과 scope 추가 요청도 할 수 있다"고 명시한다 — Viewer 가 쓰기 동작(재인증·scope 요청)을 수행할 수 있는 예외가 새로 생겼는데, 워크스페이스 가이드의 일반 요약표는 "모든 리소스 읽기 전용"이라는 절대 문구를 그대로 유지해 두 문서가 상충한다. `git show e2be81db8 --stat` 확인 결과 이번 PR 의 docs 커밋은 `integration-management.{mdx,en.mdx}` 만 건드렸고 `07-workspace-and-team/` 은 손대지 않았다.
- **제안**: `workspaces-and-members.mdx`/`.en.mdx` 의 Viewer 행에 "단, 자신이 만든 Personal 통합의 재인증·scope 요청은 예외" 같은 각주를 추가하거나, 해당 표에 `06-integrations-and-config/integration-management` 링크와 함께 "리소스별 세부 권한은 각 리소스 페이지 참고" 문구를 보강해 절대 표현("모든 리소스 읽기 전용")을 완화.

## 확인 완료(누락 아님) — 참고

- `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.{mdx,en.mdx}` — Personal/Organization 가시성·역할표·Danger zone 권한이 KO/EN 모두 같은 PR(`e2be81db8`)로 이미 갱신됨.
- `codebase/backend/.../dto/responses/integration-response.dto.ts` + `integrations.controller.ts` 의 swagger jsdoc(`@ApiOkWrappedResponse`, `@ApiForbiddenResponse` 등)이 이번 changeset 안에서 새 판정("남의 personal 이면 id/name 미노출" 등)을 반영해 이미 갱신됨 — "백엔드 API 추가·변경" 행의 (a) 요건 충족.
- 이번 changeset 에 `.tsx` 변경이 없어 "신규 UI 문자열" i18n parity 트리거는 매칭되지 않음. 새 노드·새 provider·새 섹션 디렉토리·표현식 언어·BullMQ 큐 트리거도 해당 없음.
- spec(`spec/2-navigation/4-integration.md` §8 등)은 별도 선행 커밋(`f47069564`)에서 planner 가 이미 갱신 — spec 동반 갱신 누락 없음.

## 요약

매트릭스 22행 중 "인증·권한·세션 흐름 변경"(semantic) 1건이 부분 매칭됐다 — e2e 는 충족했으나 `07-workspace-and-team/` 워크스페이스 가이드의 일반 역할표가 새 Viewer 쓰기-예외를 반영하지 못해 WARNING 1건. 이와 별개로 매트릭스에 정확히 대응하는 행은 없지만 동일한 "영문 SoT 미매핑 → 사용자 영문 노출" 위해를 갖는 CRITICAL 1건을 실측으로 확인했다 — 신규 Admin 필요 거부 메시지 3곳이 영문 하드코딩이고, `backend-labels.ts` 매핑이 전무하며, 프론트 3개 소비처(`danger-tab.tsx`, `page.tsx` rotate, OAuth 팝업 postMessage 핸들러)가 그 원문을 그대로 토스트에 띄운다. `06-integrations-and-config` docs·swagger·spec 은 이미 동일 PR/선행 커밋에서 정확히 갱신돼 누락이 없다.

## 위험도

CRITICAL
