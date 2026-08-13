# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 21행) Read 완료
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표(21행) + "자주 누락되는 항목"/"DOCUMENTATION 단계 종료 체크리스트" prose Read 완료

## 변경 파일 목록 (실측 — `git diff --name-only origin/main...HEAD`)

`codebase/`·`plan/` 범위 12개 (핵심 코드 9 + plan 3):
1. `codebase/backend/src/common/utils/assert-row-array.spec.ts` (주석/카운트 갱신)
2. `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
3. `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼)
4. `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts` (테스트 추가)
5. `codebase/backend/src/modules/auth/auth-oauth.service.ts` (버그 수정)
6. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
7. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
8. `codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts`
9. `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
10. `plan/in-progress/ie-resume-turn-boundary-cancel.md`
11. `plan/in-progress/retry-turn-terminal-guard.md`
12. `plan/in-progress/update-returning-tuple-shape.md`

나머지 ~90개 파일은 `review/code/2026/08/13/**`·`review/consistency/2026/08/13/**` 하위 자동 리뷰 산출물(RESOLUTION/meta/`*.md`) — 매트릭스 target 도 trigger 도 아님.

## 매칭 분석

핵심 변경은 TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE … RETURNING` 에서만 `[rows, rowCount]` 튜플을 돌려주는데, 8개 소비 지점(execution-engine 2·knowledge-base 5·auth-oauth 1)이 이를 행 배열로 오인해 발생한 결함을 `updateReturningRows()` 헬퍼로 통일 수정한 것이다.

21행 전수 대조:

- **new-node / node-schema-change** (`src/nodes/**`) — 변경 경로 밖. 미매칭.
- **new-ui-string / new-widget-chrome-string** (`*.tsx`) — 변경 파일 전부 `.ts`/`.md`. 미매칭.
- **integration-provider-change** — 신규/변경 provider 없음. 미매칭.
- **new-userguide-section-dir** — `content/docs/` 변경 없음. 미매칭.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 컨트롤러·DTO 변경 없음(전부 service/spec). 미매칭.
- **new-bullmq-queue** — 미매칭.
- **new-warning-code / new-error-code** — `error-codes.ts` 변경 없음. `KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS` 문자열 자체는 diff 이전부터 존재(신규 아님) — 이번 diff 는 CAS 락 게이트(`if (updateReturningRows(acquired).length === 0)`)를 실제로 작동하게 고쳤을 뿐이다. 프런트 확인 결과 이 두 에러는 `page.tsx` 의 `onError: () => toast.error(t("knowledgeBases.kbReembedFailed"))` 류 **고정 dict 키 토스트**로만 노출되고 백엔드 raw `message`/`code` 를 그대로 표시하는 경로가 아니다(`translateBackendError`/`ERROR_KO` 경유 아님) — CAS 락이 배포 후 처음 발동해도 사용자에게는 이미 번역된 일반 실패 문구만 보인다. **미매칭 확정** (raw 영문 노출 리스크 없음, 확인 완료).
- **new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field** — 해당 패턴 없음. 미매칭.
- **auth-config-type-enum-change** (`api_key`/`bearer_token`/...) — 무관. 미매칭.
- **expression-language-change** (`packages/expression-engine/**`) — 미매칭.
- **run-debug-flow-change** (semantic, `05-run-and-debug/`) — `execution-engine.service.ts`(admission/종결 이벤트) 검토: `running-a-workflow.mdx`/`validation-errors.mdx` 에 이번에 고친 워크스페이스 admission cap·종결 metrics emit 관련 서술 없음(직접 grep, `validation-errors.mdx` 의 "동시 실행 수 한도" 는 Parallel 노드 branch fan-out 한도로 별개 개념). 이 수정은 버그 경로(무가드 admission/미발동 metrics)를 의도된 정상 경로로 되돌리는 내부 정합성 수정이며 최종 사용자 관측 결과(실행 종결 상태)는 이미 문서화된 대로 유지된다. **미매칭 확정**(회색지대였으나 불요로 판단).
- **auth-session-flow-change** (semantic, `codebase/backend/src/modules/auth/**`) — `auth-oauth.service.ts`/`.spec.ts` 가 **정확히 이 glob 에 매칭**. 아래 발견사항 참조.
- **env-runtime-change / spec-major-change / userguide-gui-flow-section / spec-defect-found** — 해당 없음.

`plan/in-progress/*.md` 3건은 이 변경 set 을 설명/소급정정하는 plan 산출물 자체이며 매트릭스 target 이 아니다.

## 발견사항

- **[WARNING]** 인증 흐름(OAuth 소셜 로그인 콜백)의 CRITICAL 버그 수정인데 e2e 보강이 없다 — 매트릭스가 "가이드 갱신 + e2e 한 묶음"으로 명시한 항목 중 e2e 쪽이 비어 있다.
  - 변경 파일: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (핸들러 로직 수정), `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts` (신규 unit 테스트 2건)
  - 매트릭스 항목: `auth-session-flow-change` — trigger glob `codebase/backend/src/modules/auth/**` (match: semantic). PROJECT.md 표 148행: "인증·권한·세션 흐름 변경 | `codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e | `make e2e-test`". 같은 문서 181행 "자주 누락되는 항목": "인증·권한·세션 흐름 변경 vs 워크스페이스 가이드(`07-workspace-and-team/`) 미갱신 — **흐름 변경 + 가이드 갱신 + e2e 가 한 묶음**".
  - 실측: `git diff --name-only origin/main...HEAD | grep -E '^codebase/(backend/test|frontend/e2e)'` → **0건**. 이 PR 전체(12개 코드/plan 파일)에 e2e 스펙(`codebase/backend/test/**.e2e-spec.ts`, `codebase/frontend/e2e/**`)이 단 하나도 없다. `codebase/frontend/e2e/auth/login.spec.ts` 는 `**/api/auth/oauth/providers` 목록 API만 mock 하고, 실제 `state` 소비·콜백(`handleCallback`, `DELETE … RETURNING`) 경로는 어떤 e2e 도 건드리지 않는다. 이번 라운드가 추가한 검증은 `dataSource.query` 를 통째로 mock 하는 unit 테스트 2건뿐이다.
  - 누락된 동반 갱신: (검증) `codebase/backend/test/*.e2e-spec.ts` 또는 `codebase/frontend/e2e/auth/**` 에 실제 DB 왕복(mock 아님)으로 OAuth state 소비 경로를 exercise 하는 케이스 — `make e2e-test` 검증 명령이 실질적으로 이 결함 클래스를 잡을 수 있는 상태가 아님.
  - 상세: 이 버그는 "Google/GitHub 소셜 로그인이 상시 실패"하는 CRITICAL 결함이었고(`review/code/2026/08/13/20_36_35/RESOLUTION.md` CRITICAL 1), 같은 RESOLUTION 문서가 스스로 "이 스위트도 `[validState]`(행 배열)를 mock 하고 있었다 — engine 과 똑같은 원인이다. **e2e 도 없다.** 반증 증거가 없었기에 4개월간 아무도 못 봤다" 라고 명시한다. 즉 이번 수정으로 회귀를 막는 계층이 여전히 "실제 드라이버 shape 을 아는 사람이 mock 값을 정확히 채웠는가" 에 의존하는 unit 테스트뿐이다 — 다음에 드라이버/TypeORM 버전이 바뀌어 shape 이 또 달라지면, mock 이 실제 응답과 다시 괴리돼도 동일한 클래스의 회귀를 4개월씩 놓칠 수 있는 구조가 그대로 남는다. 매트릭스가 이 trigger 에 대해 특별히 `verify: make e2e-test` 를 지정하고 "e2e 가 한 묶음"이라고 못박은 이유도 바로 이 mock-경계 맹점이다.
  - 제안: `codebase/backend/test/auth.e2e-spec.ts` (또는 신규 `auth-oauth.e2e-spec.ts`)에 실제 테스트 DB에 `auth_oauth_state` 행을 심고 `/api/auth/oauth/callback` 왕복으로 정상 콜백 성공 + 만료/재사용 state 거절을 검증하는 케이스를 추가한다. 이렇게 하면 unit mock 이 실제 드라이버 shape 과 다시 괴리되더라도 e2e 가 잡는다. `plan/in-progress/update-returning-tuple-shape.md` 후속 체크리스트(이미 "통합 레벨 관측"·배포 후 관측 항목이 등재돼 있음)에 이 항목도 명시적으로 등재할 것을 권고.
  - 참고(오탐 방지): 07-workspace-and-team/ **문서 내용 자체**는 갱신 불요로 확인했다 — `password-and-sessions.mdx` 가 이미 "Google·GitHub 등 소셜 로그인(OAuth)으로만 가입한 계정" 을 기존 사실로 서술하고 있고(:70, :131), 이 PR 은 그 문서가 가정한 "OAuth 로그인이 정상 동작한다"는 상태를 실제로 만드는 버그 수정일 뿐 새 사용자 가시 흐름/문구를 추가하지 않는다. 따라서 이번 발견은 **e2e 갭에 한정**이며 MDX 콘텐츠 누락은 아니다.

## 요약

매트릭스 21행 전수 대조 결과, 이번 변경 set(codebase/plan 12개 파일 + 자동 리뷰 산출물 ~90개)은 노드/스키마/UI 문자열/provider/신규 docs 섹션/표현식 언어/신규 warning·error 코드 어느 trigger 에도 매칭되지 않으며, `run-debug-flow-change` 도 내부 정합성 버그 수정으로 판단해 불요 처리했다. 유일하게 매칭된 것은 `auth-oauth.service.ts` 변경이 건드린 `auth-session-flow-change`(semantic, `codebase/backend/src/modules/auth/**`) 로, 매트릭스가 명시한 "가이드 + e2e 한 묶음" 중 가이드 쪽은 기존 문서가 이미 정확해 불요로 확인했으나 **e2e 쪽은 실제로 비어 있다** — 4개월간 상시 실패했던 소셜 로그인 결함의 회귀 방어가 여전히 mock 경계 안쪽 unit 테스트에만 의존한다(개발자 본인 RESOLUTION.md 도 "e2e 도 없다"고 인정). WARNING 1건.

## 위험도

LOW
