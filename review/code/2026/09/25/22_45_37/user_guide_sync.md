# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows[] 22개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read.

## 변경 파일 (origin/main...HEAD, 총 51개 중 doc-sync 관련 요약)

- Backend: `integrations/*.ts`(controller·service·oauth.service·신규 `integration-visibility.ts`) + 각 `*.spec.ts`, `workflow-assistant/tools/*.ts`(candidate-lookup·assistant-tool-router·assistant-finish-guard·explore-tools) + `workflow-assistant-stream.service.ts`, `test/integration-personal-owner.e2e-spec.ts`
- Frontend docs: `content/docs/06-integrations-and-config/integration-management.mdx` + `.en.mdx`
- Spec: `spec/2-navigation/4-integration.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/4-integration/_product-overview.md`, `spec/5-system/3-error-handling.md`
- `CHANGELOG.md`, `plan/in-progress/*` 5건
- frontend `*.tsx` / `dict/{ko,en}` / `backend-labels.ts` / `locale.ts` / `codebase/backend/src/nodes/**` — **변경 없음** (전체 changeset 에 파일 0건, `git diff --name-only origin/main...HEAD` 로 확인)

## Trigger 매칭 결과

| trigger id | 매칭 여부 | 근거 |
| --- | --- | --- |
| new-node | 매칭 안 됨 | `codebase/backend/src/nodes/**` 변경 파일 0건 |
| node-schema-change | 매칭 안 됨 | 동일 |
| new-ui-string | 매칭 안 됨 | `codebase/frontend/src/**/*.tsx` 변경 파일 0건 |
| integration-provider-change | **매칭 (semantic)** | `integration-oauth.service.ts`(cafe24·makeshop precheck 판정) + `integrations.controller/service.ts` 가 cafe24/makeshop 이 걸리는 공용 permission·precheck 로직을 변경 |
| new-userguide-section-dir | 매칭 안 됨 | 신규 `docs/<NN>-<name>/` 디렉토리 없음 |
| backend-api-change | **매칭 (glob)** | `integrations.controller.ts` 변경 — swagger jsdoc(`@ApiForbiddenResponse`/`@ApiNotFoundResponse`) 동반 갱신 확인됨(아래) |
| new-warning-code / new-error-code | 매칭 안 됨 | `ADMIN_REQUIRED` 는 `#1399/#1400` 에서 이미 발행되던 기존 공유 코드(`ROLE_REQUIRED.admin.code`) 재사용 — 신규 enum 값 아님. `error-codes.ts` 변경 파일 0건 |
| auth-session-flow-change | **매칭 안 됨 (glob 불일치, semantic 판단으로도 보류)** | 아래 발견사항 1 참고 |
| expression-language-change / run-debug-flow-change | 매칭 안 됨 | 대상 경로 변경 없음 |
| userguide-gui-flow-section | 그레이존 (INFO) | `06-integrations-and-config/integration-management.mdx` 변경이 "GUI 흐름 절 신규/변경"인지 "기존 FieldTable 문구 갱신"인지 애매 — `<ImplAnchor>` 신설 의무는 신규 절에 한정으로 보임, 기존 anchor 존재 여부 미확인이나 텍스트만 수정된 기존 표라 신규 anchor 불필요로 판단 |

## 발견사항

### [INFO] 인증·권한·세션 흐름 변경 trigger 는 glob 불일치 — 그러나 실질 대체 갱신은 이미 존재
- 변경 파일: `codebase/backend/src/modules/integrations/integrations.controller.ts`, `integrations.service.ts`, `integration-oauth.service.ts`, `integration-visibility.ts`
- 매트릭스 항목: `auth-session-flow-change` — trigger.globs = `["codebase/backend/src/modules/auth/**"]`, targets = "`codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e"
- 상세: 이번 변경은 Personal/Organization 통합에 대한 가시성·역할 판정(404 마스킹, `ADMIN_REQUIRED` 403)을 도입하는 인가(authorization) 로직 변경이지만, 물리적으로 `codebase/backend/src/modules/auth/**` 가 아니라 `codebase/backend/src/modules/integrations/**` 안에 있다. 매트릭스의 리터럴 glob 은 매칭되지 않으며, 의미상으로도 이 변경은 로그인·세션·워크스페이스 멤버십 같은 범용 인증 흐름이 아니라 "통합" 리소스 하나에 국한된 리소스-레벨 인가다. 실제로 이 PR 은 더 구체적인 대체 타겟(`06-integrations-and-config/integration-management.mdx` + `.en.mdx`, `CHANGELOG.md`)을 ko/en parity 로 이미 갱신했고 `test/integration-personal-owner.e2e-spec.ts` e2e 도 신설했다 — `07-workspace-and-team/` 에 별도 서술을 추가하지 않은 것이 실제 갭인지는 판단이 갈린다.
- 제안: 액션 불요로 판단(리스크 낮음). 다만 후속에서 "인증·권한·세션 흐름 변경" 행의 glob 을 리소스-레벨 인가(예: `integrations.controller.ts` 류의 역할 검사)까지 포함할지, 아니면 이 판단(모듈-스코프 인가는 해당 리소스의 06-integrations 문서로 충분)을 매트릭스에 명시할지 project-planner 검토 권고.

### [INFO] cafe24/makeshop precheck 의 "남의 personal 충돌 시 식별자 마스킹" 이 provider별 문서에 없음
- 변경 파일: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (`pickPrecheckConflict` 신설), `integration-oauth.service.cafe24.spec.ts`, `integration-oauth.service.makeshop.spec.ts`
- 매트릭스 항목: `integration-provider-change` — targets: "`codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키"
- 누락된 동반 갱신(있다면): `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx`/`.en.mdx`, `makeshop.mdx`/`.en.mdx` — 두 provider 문서 모두 mall_id/shop_uid 사전 중복 감지(precheck) 동작을 설명하는 절이 있으나 "충돌 대상이 다른 멤버의 personal 통합이면 id/name 이 안 뜬다"는 새 마스킹 규칙은 어느 provider 문서에도 없음 (grep 0건)
- 상세: 실제 사용자 영향은 낮다 — `auth-step.tsx` 가 이미 `existingIntegrationId`/`existingName` 을 옵셔널로 조건부 렌더링하고 있어(변경 전부터 optional 필드였음) 프론트 UI 는 깨지지 않고 그냥 "충돌만 알리고 상세 링크는 생략"되는 정도로 우아하게 축소된다. 이 변화가 사용자에게 노출되는 문구 차이는 크지 않아(애초에 "충돌"이라는 사실만 사용자가 보고, id/name 유무는 화면상 클릭 가능한 딥링크의 유무로만 나타남) 별도 문서 절을 요구할 정도의 "제공자 변경"은 아니라고 판단했다. 다만 일반 `integration-management.mdx` 의 "팀 워크스페이스에서 공유 사용" 절이 Personal 비가시성 규칙을 이미 포괄적으로 설명하고 있어 provider 페이지가 이를 반복할 필요가 낮다는 점도 근거.
- 제안: 액션 불요(낮은 리스크) — 다만 향후 cafe24/makeshop precheck UI에 딥링크 생략을 사용자가 인지 가능한 문구로 노출하게 되면 그때 provider 문서에 한 줄 추가 권고.

## 확인된 정상 동반 갱신 (누락 아님 — 참고용)

- `integrations.controller.ts` swagger jsdoc: `FORBIDDEN_MEMBER`/`FORBIDDEN_MEMBER_OR_ORG_ADMIN`/`FORBIDDEN_EDITOR_OR_ORG_ADMIN`/`NOT_FOUND_INTEGRATION` 상수화 + 각 핸들러의 `@ApiForbiddenResponse`/`@ApiNotFoundResponse` 문구 갱신 — `backend-api-change` 타겟 (a) 충족
- `06-integrations-and-config/integration-management.mdx` + `.en.mdx` — "팀 워크스페이스에서 공유 사용" 절, `FieldTable`(Viewer/Editor/Admin·Owner 권한), "Danger zone" 행이 Personal/Organization 가시성·삭제·scope 전환 규칙을 ko/en **parity** 로 정확히 반영 — `backend-api-change` 타겟 (b), `integration-provider-change` 타겟 실질 충족
- `CHANGELOG.md` — "Unreleased — 남의 Personal 통합은 보이지 않고..." 항목이 관측 가능한 사용자 가시 변화(404 마스킹, `ADMIN_REQUIRED`, precheck 마스킹, 후속 범위 명시)를 상세히 기록 — "사후 보정 PR 패턴 금지 · 같은 turn 원칙" 충족
- `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/_product-overview.md` (INT-MG-07 각주 보강) — spec 본문이 구현과 함께 갱신됨(다른 리뷰어 스코프이나 doc-sync 관점에서도 정합)
- i18n dict / backend-labels.ts / locale.ts 변경 불요 — 이번 changeset 에 TSX·노드·warningCode·errorCode·신규 섹션 디렉토리 변경이 전혀 없어 해당 트리거 자체가 미매칭

## 검증용 뮤테이션
본 리뷰는 읽기 전용으로 진행했다 — 저장소 파일을 수정하지 않았다(`git status --short` 로 확인, untracked `review/code/2026/09/25/22_45_37/` 외 변경 없음).

## 요약
매트릭스 22개 trigger 중 이 changeset 에 유의미하게 매칭된 것은 `integration-provider-change`(semantic) 와 `backend-api-change`(glob) 두 개이며, 둘 다 이미 같은 changeset 안에서 `integration-management.mdx`/`.en.mdx` ko/en parity 갱신 + swagger jsdoc 갱신 + `CHANGELOG.md` 항목으로 충족되어 있다. `auth-session-flow-change` 는 glob 이 `modules/auth/**` 를 가리켜 문자 그대로는 미매칭이고, 의미상으로도 리소스-스코프 인가라 보수적으로 그레이존 INFO 로만 남긴다. `new-ui-string`/`new-node`/`node-schema-change`/`new-warning-code`/`new-error-code`/`new-userguide-section-dir` 등 나머지 trigger 는 대상 파일이 이번 changeset 에 전혀 없어 명백히 무관하다. CRITICAL/WARNING 급 동반 갱신 누락은 발견되지 않았다.

## 위험도
LOW
