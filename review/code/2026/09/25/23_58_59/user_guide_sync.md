# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(§자주 누락되는 항목 포함)을 SoT 로 사용.

## 변경 set 요약
백엔드 22개 파일(`codebase/backend/src/modules/integrations/**`, `codebase/backend/src/modules/workflow-assistant/tools/**`, e2e 1개) + 프런트 docs MDX 4개(`06-integrations-and-config/integration-management.{mdx,en.mdx}`, `07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}`). frontend `.tsx`/`dict/**`/`backend-labels.ts` 변경은 이 changeset 에 **없음**.

## trigger 매칭 결과

1. **`auth-session-flow-change` (인증·권한·세션 흐름 변경)** — 문자 그대로의 `codebase/backend/src/modules/auth/**` glob 은 매치하지 않지만, `match:"semantic"` 이고 이 PR 은 정확히 PROJECT.md §자주 누락되는 항목 "인증·권한·세션 흐름 변경 vs 워크스페이스 가이드(`07-workspace-and-team/`) 미갱신 — 흐름 변경 + 가이드 갱신 + e2e 가 한 묶음" 사례의 실체(RBAC 판정 로직 신설 `integration-visibility.ts`, Admin 승격, 재인증 바꿔치기 차단)다.
   - target 1 (07-workspace-and-team 관련 페이지): **충족** — `workspaces-and-members.mdx` + `.en.mdx` 양쪽에 "통합은 이 표에 예외가 있다 — Personal 은 만든 사람에게만" 문단이 이미 추가됨(diff 확인).
   - target 2 (e2e 보강): **충족** — `codebase/backend/test/integration-personal-owner.e2e-spec.ts` 신규 파일이 같은 changeset 에 있음.
   - 결론: 누락 없음.

2. **`integration-provider-change` (통합 신규/제공자 변경, semantic)** — 신규 provider 는 아니지만 기존 provider 전반(Cafe24/MakeShop 포함)에 적용되는 권한 모델이 바뀌었고, target 은 `06-integrations-and-config/<provider>.{mdx,en.mdx}`.
   - **충족** — `integration-management.mdx` + `.en.mdx` 양쪽에 Viewer/Editor/Admin·Owner FieldTable 재작성 + "Danger zone" 권한 세분화 + 팀 워크스페이스 공유 절 갱신이 이미 반영됨. cafe24.mdx/makeshop.mdx 는 이미 기존에 "Scope: Personal/Organization, 조직 통합은 Admin 만 생성" 문구를 갖고 있어 새 규칙과 불일치 없음(변경 불요 확인).
   - 결론: 누락 없음.

3. **`new-ui-string` (신규 UI 문자열, TSX) / i18n parity** — 이 changeset 에 `*.tsx` 변경이 전혀 없음(백엔드 + docs MDX 뿐). 신규 한국어 리터럴 추가 없음 → 해당 없음.

4. **`new-warning-code` / 신규 errorCode 발행** — `codebase/backend/src/nodes/core/error-codes.ts` 는 이 changeset 에 없음. 신규 도입된 거부 코드 `ADMIN_REQUIRED` 는 `workspace-roles.ts` 의 기존 `ROLE_REQUIRED.admin`(`{ code: 'ADMIN_REQUIRED', message: '(한국어 완성 문구)' }`)을 재사용 — 서버가 이미 한국어 완성 메시지를 내려주므로 frontend `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 코드→라벨 매핑 대상이 아님(그 표는 영문 SoT 코드에 한국어를 매핑하는 용도인데, 여기는 백엔드가 이미 한국어 메시지를 완성해서 보낸다). 누락 아님.
   - 참고(매트릭스 밖, INFO 수준): `integration-visibility.ts` 의 `integrationNotFoundError()` 는 `message: 'Integration not found'`(영문)를 던진다. 이 문자열은 `Workflow not found`/`Schedule not found`/`Knowledge base not found` 등과 동일한 **기존 전역 관례**(모든 `RESOURCE_NOT_FOUND` 404 가 영문 message)이고, frontend `axiosMessage()` 는 `err.response.data.message` 를 그대로 토스트에 쓴다. 이 PR 은 이 관례를 새로 만들지 않았지만, "남의 personal 통합은 없는 통합과 같다" 규칙 때문에 이 404 가 발생하는 실제 빈도(팀 워크스페이스에서 동료의 Personal 통합 URL 직접 접근 등)를 종전보다 크게 늘린다. 매트릭스의 어떤 trigger 도 이 전역 404-메시지 관례를 대상으로 하지 않으므로(WARNING_KO/ERROR_KO 는 node-level warningRule/ui.label 코드용) 이 리뷰의 CRITICAL/WARNING 판정 대상은 아니지만, 참고로 남긴다.

5. **`new-node` / `node-schema-change`** — `codebase/backend/src/nodes/**` 변경 없음 → 해당 없음.

6. **`new-userguide-section-dir`** — 신규 `docs/<NN>-<name>/` 디렉토리 생성 없음(`06-`, `07-` 는 기존 섹션) → 해당 없음.

7. **`expression-language-change` / `run-debug-flow-change`** — `codebase/packages/expression-engine/**`, 실행 엔진 디버그 로깅 변경 없음 → 해당 없음.

8. **CHANGELOG / plan 동반** (매트릭스 범위 밖이지만 developer workflow 상 필수) — `CHANGELOG.md` Unreleased 최상단 항목이 이미 이 PR 의 관측 가능 변화(404 치환·Admin 승격·ADMIN_REQUIRED 코드 전환)를 전부 기술. 후속 범위(노드 실행 시점 판정·화면 버튼 조정 등)는 `plan/in-progress/integration-personal-owner-followup.md` 로 명시적으로 분리돼 있어 PROJECT.md §DOCUMENTATION 체크리스트의 "partial-implementation 분리" 항목도 충족.

## 발견사항

없음 — 매칭된 모든 trigger 에 대해 동반 갱신이 이미 같은 changeset(3라운드 누적) 안에 존재함을 확인했다.

## 요약

매트릭스 21개 행 중 이번 diff 에 유의미하게 매칭된 것은 `auth-session-flow-change`(semantic) 와 `integration-provider-change`(semantic) 2개이며, 두 trigger 의 target(07-workspace-and-team 문서 ko/en·06-integrations-and-config 문서 ko/en·e2e·CHANGELOG)이 모두 같은 changeset 안에서 이미 갱신돼 누락이 0건이다. TSX/신규 UI 문자열·신규 노드·신규 섹션 디렉토리·표현식 언어·신규 warning/error 코드 trigger 는 이 diff 에 해당 사항이 없다. 참고로 남긴 전역 "RESOURCE_NOT_FOUND 영문 message" 관례(사전부터 존재, 이 PR 이 발생 빈도만 높임)는 매트릭스 어떤 target 도 가리키지 않아 판정 대상 밖이다.

## 위험도

NONE
