# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read 하여 SSOT 로 사용.

## 변경 파일 요약 (10개, 전부 backend + plan)
- `CHANGELOG.md` (신규 항목)
- `codebase/backend/src/common/utils/uuid.spec.ts` (주석·테스트 docstring 갱신)
- `codebase/backend/src/modules/auth/login-history.service.ts` / `.spec.ts` (keyset 커서 `id` UUID 형태 검증 추가)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` / `.spec.ts` (keyset 커서 `i` UUID 형태 검증 추가)
- `codebase/backend/test/background-monitoring.e2e-spec.ts`, `codebase/backend/test/session-revocation.e2e-spec.ts` (회귀 e2e 추가)
- `plan/in-progress/keyset-cursor-uuid-validation.md` (신규), `plan/in-progress/spec-draft-nullable-notation-followups.md` (항목 종결)

전부 `codebase/backend/**` + `plan/**` 범위. `codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**` 변경은 **0건**.

## trigger 매칭 검토

matrix 21행을 전수 대조했다. glob 매칭 행(`new-node`, `node-schema-change`, `new-ui-string`, `new-widget-chrome-string`, `new-userguide-section-dir`, `new-bullmq-queue`, `new-error-code`, `spec-major-change`, `userguide-gui-flow-section`)은 전부 glob 이 이번 변경 file 목록과 겹치지 않아 **매칭 없음** (`codebase/backend/src/nodes/**` 미변경, `.tsx` 미변경, `docs/*/` 미변경, `system-status.constants.ts` 미변경, `error-codes.ts` 미변경, `spec/{2,3,4,5}-*` 미변경).

semantic 매칭 후보로 검토한 것은 다음 두 행이다.

1. **`auth-session-flow-change`** (trigger hint glob `codebase/backend/src/modules/auth/**`) — `login-history.service.ts`/`.spec.ts` 가 그 경로에 속해 후보로 검토했다. 그러나 실제 변경은 로그인/세션/권한의 **흐름**(로그인, 토큰 발급, 세션 폐기 로직)이 아니라 로그인 이력 조회 API 의 **keyset 커서 `id` 성분 검증**(22P02 → 500 마스킹 방지)이다. `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx`(+`.en.mdx`)를 grep 했으나 로그인 기록 API 의 커서·페이지네이션·에러코드를 다루는 서술이 전혀 없다(UX 레벨 문서라 API 에러 계약을 기술하지 않음). 사용자가 정상 UI 로는 만들 수 없는 malformed cursor 엣지케이스의 내부 방어 코드라 가이드에 반영할 사용자 가시 내용이 없다. → **매칭 아님 (회색지대, INFO)**.
2. **`run-debug-flow-change`** (targets `05-run-and-debug/`) — `background-runs.service.ts` 가 `codebase/backend/src/modules/executions/**` 아래라 후보로 검토했다. 동일하게 `05-run-and-debug/*.mdx` 를 grep 했으나 background run 모니터링의 커서/페이지네이션을 다루는 서술이 없고, 변경 내용도 keyset 커서 `i` 성분 UUID 검증(500→400) 뿐이라 사용자 가시 실행/디버깅 흐름 자체는 무변이다. → **매칭 아님 (회색지대, INFO)**.

새 error code 발행 여부도 확인했다 — `INVALID_CURSOR` 는 이번 변경으로 신설된 코드가 아니라 `background-runs.service.ts` 에 기존부터 있던 catch-all 400 분기(base64/JSON/날짜 오류와 동일 처분)를 `i` 검증까지 확장한 것이며(`codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:181-186`), `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 도 변경되지 않았다. 또한 `INVALID_CURSOR`/`INVALID_LIMIT`/`EXECUTION_NOT_FOUND` 류는 `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO`(노드 warningRules·`error-codes.ts` 전용)가 다루는 대상이 아니라 REST 일반 에러 채널이므로 `new-warning-code`/`new-error-code` 행도 매칭되지 않는다.

`spec-defect-found` 행(spec 누락 발견 시 `plan/in-progress/spec-update-<name>.md` + planner 위임)과 관련해, developer 는 별도 `spec-update-*.md` 파일 대신 같은 작업 plan(`keyset-cursor-uuid-validation.md` §D)에 spec 갭 3건을 "전부 planner 소관"으로 명시해 등재했다. 파일명 컨벤션은 다르지만 등재·planner 귀속 의도는 충족돼 있어 사용자 가시 영향은 없다 — User Guide Sync 리뷰 범위(docs MDX·i18n dict·backend-labels) 밖의 절차적 사안이라 참고로만 기록한다.

## 발견사항

- **[INFO]** `codebase/backend/src/modules/auth/**` 변경이 `auth-session-flow-change` trigger glob 과 문자열 매칭되지만, 실질은 로그인 이력 조회의 내부 커서 검증 강화(500→200)이며 `07-workspace-and-team/` 문서가 다루는 사용자 가시 흐름과 무관 — 갱신 불필요로 판단.
  - 변경 파일: `codebase/backend/src/modules/auth/login-history.service.ts`, `login-history.service.spec.ts`
  - 매트릭스 항목: `auth-session-flow-change` — "`codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e"
  - 상세: e2e 는 이미 `session-revocation.e2e-spec.ts` 에 회귀 케이스로 추가됨(매트릭스의 "+ e2e" 요건은 이미 충족). 문서 쪽만 회색지대.
  - 제안: 조치 불필요. 후속 세션에서 재-flag 되면 이 판정(문서에 해당 서술 자체가 없음)을 근거로 기각.

- **[INFO]** `codebase/backend/src/modules/executions/background-runs/**` 변경이 `run-debug-flow-change` 의 대상 모듈군과 근접하지만, `05-run-and-debug/*.mdx` 에 해당 API 의 커서 계약을 다루는 서술이 없어 갱신 대상 아님.
  - 변경 파일: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
  - 매트릭스 항목: `run-debug-flow-change` — "`codebase/frontend/src/content/docs/05-run-and-debug/`"
  - 상세: 500→400 처분 변경은 내부 에러코드 계약 강화이며 정상 UI 흐름에서 도달 불가능한 malformed cursor 케이스.
  - 제안: 조치 불필요.

## 요약
매트릭스 21개 행 중 glob 매칭 9개는 전부 파일 미교차로 무관, semantic 매칭 후보 2개(`auth-session-flow-change`, `run-debug-flow-change`)를 실제 docs 본문 대조까지 수행해 검토했으나 둘 다 문서가 다루지 않는 API 레벨 내부 방어 로직이라 동반 갱신 누락으로 볼 수 없다(INFO 2건, 조치 불요). `new-warning-code`/`new-error-code` 도 `INVALID_CURSOR` 가 신규 코드가 아니고 `backend-labels.ts` 관할 밖(노드 warningRules/ErrorCode 전용)이라 무관. `codebase/frontend/**`·`spec/**` 변경이 0건이라 i18n dict·docs MDX·backend-labels 동반 갱신 자체가 애초에 필요하지 않은 순수 backend 방어 로직 fix 로 판단한다.

## 위험도
NONE
