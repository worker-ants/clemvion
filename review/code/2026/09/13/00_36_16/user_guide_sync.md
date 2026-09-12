# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(155~224행)을 Read 하여 SSOT 로 사용.

## 변경 파일 (11개, 전부 backend + plan + CHANGELOG)
- `CHANGELOG.md`
- `codebase/backend/src/common/utils/uuid.ts` / `uuid.spec.ts` (JSDoc·테스트 docstring 갱신 — 로직 변경 없음)
- `codebase/backend/src/modules/auth/login-history.service.ts` / `.spec.ts` (keyset 커서 `id` 성분 UUID 형태 검증 추가)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` / `.spec.ts` (keyset 커서 `i` 성분 UUID 형태 검증 추가)
- `codebase/backend/test/background-monitoring.e2e-spec.ts`, `codebase/backend/test/session-revocation.e2e-spec.ts` (실 DB e2e 회귀 케이스 추가)
- `plan/in-progress/keyset-cursor-uuid-validation.md` (신규), `plan/in-progress/spec-draft-nullable-notation-followups.md` (항목 종결)

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**` 변경은 **0건**. 전부 `codebase/backend/**` + `codebase/backend/test/**` + `plan/**` + `CHANGELOG.md` 범위.

## trigger 매칭 검토

matrix 21행을 전수 대조했다.

**glob 매칭 행** (`new-node`, `node-schema-change`, `new-ui-string`, `new-widget-chrome-string`, `new-userguide-section-dir`, `new-bullmq-queue`, `new-error-code`, `spec-major-change`, `userguide-gui-flow-section`) — 전부 glob 이 변경 file 목록과 교차 없음: `codebase/backend/src/nodes/**` 미변경, `*.tsx` 미변경, `codebase/frontend/src/content/docs/*/` 미변경, `system-status.constants.ts` 미변경, `codebase/backend/src/nodes/core/error-codes.ts` 미변경, `spec/{2,3,4,5}-*`/`spec/conventions/**` 미변경. **미매칭.**

**backend-api-change** (`*.controller.ts`, `dto/**`) — 변경 파일이 `.service.ts`/`.spec.ts`/`.e2e-spec.ts`/util 뿐이고 controller·DTO 없음. 요청/응답 스키마·엔드포인트 계약 자체는 불변(각 디코더가 **기존 실패 계약을 유지**하며 malformed 입력의 disposition 만 바뀜 — plan §B). **미매칭.**

semantic 매칭 후보로 검토한 것은 다음 두 행이며, 직접 grep 으로 문서 본문을 대조했다.

1. **`auth-session-flow-change`** (trigger glob `codebase/backend/src/modules/auth/**`, match=semantic) — `login-history.service.ts`/`.spec.ts` 가 경로상 이 glob 에 든다. 그러나 실제 diff 는 로그인·2FA·세션 발급/폐기 로직이 아니라 `GET /api/users/me/login-history` 의 **keyset 커서 `id` 성분** 검증(Postgres 22P02 → 500 마스킹 방지)뿐이다. `codebase/frontend/src/content/docs/07-workspace-and-team/` 전체를 `grep -rn -i "login.history\|커서\|cursor"` 로 확인 — `password-and-sessions.mdx`/`.en.mdx` 어디에도 로그인 이력 API 의 페이지네이션·에러코드를 서술하는 내용이 없다(`system-status.mdx` 의 "login-history-pruner" 는 BullMQ 큐 이름 언급일 뿐 이번 변경(pruner 로직 무변)과 무관). 정상 UI 로는 도달 불가능한 malformed-cursor 엣지케이스의 내부 방어 코드라 가이드에 반영할 사용자 가시 서술이 없다. 매트릭스가 요구하는 "+ e2e" 요건은 `session-revocation.e2e-spec.ts` 의 신규 케이스 F(`res.status).toBe(200)` + 대조군)로 이미 충족됨.
   → **매칭 아님 (회색지대, INFO).**
2. **`run-debug-flow-change`** (semantic, targets `05-run-and-debug/`) — `background-runs.service.ts` 가 실행 모니터링 read-only API(spec/4-nodes/1-logic/12-background.md §8)라 후보로 검토. `codebase/frontend/src/content/docs/05-run-and-debug/*.mdx` 를 grep 했으나 background-run 커서/페이지네이션 서술 자체가 없다. 한편 `codebase/frontend/src/content/docs/02-nodes/logic.mdx` §Background(431행)가 이 엔드포인트를 "cursor 페이지네이션" 존재만 언급하는데, 이번 diff 는 malformed 커서의 disposition 을 기존 400 `INVALID_CURSOR` catch-all 로 합류시켰을 뿐 정상 발급 커서의 형태·응답 계약은 그대로라 그 서술을 반증하지 않는다. `session-revocation`/`background-monitoring` e2e 도 신규 케이스로 보강됨.
   → **매칭 아님 (회색지대, INFO).**

**new-warning-code / new-error-code** — `INVALID_CURSOR` 는 `background-runs.service.ts` 에 기존부터 있던 catch-all 400 분기(base64/JSON/날짜 오류와 동일 처분, 변경 전 코드에도 존재)를 `i` 검증까지 확장한 것뿐이며 신규 코드가 아니다. `login-history` 쪽은 애초에 에러를 던지지 않고 `null` 반환(500→200)이라 코드 자체가 없다. `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum, `warningRules` 모두 미변경. `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 는 노드 실행 결과(warningRules/ErrorCode) 전용이고 REST 일반 에러 채널(`INVALID_CURSOR` 등)은 그 관할 밖이다. **미매칭.**

`CHANGELOG.md`·`plan/in-progress/*.md` 는 매트릭스 target 어디에도 속하지 않는 릴리스노트/작업추적 문서이며, 오히려 이번 변경 자체가 CHANGELOG 를 (배포 확인 문구까지 포함해) 이미 충실히 채운 상태다.

## 발견사항

- **[INFO]** `codebase/backend/src/modules/auth/**` 변경이 `auth-session-flow-change` trigger glob 과 경로상 매칭되지만, 실질은 로그인 이력 조회의 내부 커서 검증 강화(500→200)이며 `07-workspace-and-team/` 문서가 다루는 사용자 가시 흐름과 무관 — 갱신 불필요로 판단.
  - 변경 파일: `codebase/backend/src/modules/auth/login-history.service.ts:53-61`, `login-history.service.spec.ts`
  - 매트릭스 항목: `auth-session-flow-change` — "`codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e" (PROJECT.md 176행)
  - 상세: 로그인·세션 발급/검증·`RolesGuard` 등 흐름 로직 무변. `password-and-sessions.mdx`(+`.en.mdx`) 에 로그인 이력 API 의 페이지네이션·에러 계약을 서술하는 내용 자체가 없음. e2e 보강은 `session-revocation.e2e-spec.ts` 케이스 F 로 이미 충족.
  - 제안: 조치 불필요. 후속 라운드에서 재-flag 되면 "문서에 해당 서술 자체가 없다"는 이 판정을 근거로 기각 — 이 판정은 이미 3개 이전 라운드(`23_19_03`, `23_40_57`, `00_13_51`)에서 grep 기반으로 독립 확인됐고 본 라운드가 4번째 재확인이다.

- **[INFO]** `codebase/backend/src/modules/executions/background-runs/**` 변경이 `run-debug-flow-change` 의 대상 모듈군과 근접하지만, `05-run-and-debug/*.mdx` 및 `02-nodes/logic.mdx` §Background 모두 이 변경으로 stale 해지는 서술이 없어 갱신 대상 아님.
  - 변경 파일: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-180`
  - 매트릭스 항목: `run-debug-flow-change` — "`codebase/frontend/src/content/docs/05-run-and-debug/`" (PROJECT.md 179행)
  - 상세: `02-nodes/logic.mdx:431` 이 이 엔드포인트의 "cursor 페이지네이션" 존재만 언급하고 malformed-cursor 처분은 서술하지 않음 — 이번 500→400 강화가 그 서술을 반증하지 않음. e2e 는 `background-monitoring.e2e-spec.ts` 신규 케이스로 보강됨(대조군 포함).
  - 제안: 조치 불필요.

## 요약
매트릭스 21행 중 glob 매칭 후보 9행 + `backend-api-change` 는 전부 파일 미교차로 무관, semantic 매칭 후보 2행(`auth-session-flow-change`, `run-debug-flow-change`)은 실제 docs 본문 grep 대조까지 수행했으나 둘 다 사용자 가이드가 서술하지 않는 API 레벨 내부 방어 로직(keyset 커서 uuid 형태 검증)이라 동반 갱신 누락으로 볼 수 없다(INFO 2건, 조치 불요, e2e 요건은 이미 신규 e2e 2건으로 충족). `new-warning-code`/`new-error-code` 도 `INVALID_CURSOR` 가 신규 코드가 아니고 REST 일반 에러 채널(backend-labels.ts 관할 밖)이라 무관. `codebase/frontend/**`·`spec/**` 변경이 0건이라 i18n dict·docs MDX·backend-labels 동반 갱신 자체가 애초에 필요하지 않은 순수 backend 방어 로직 fix 로 판단한다. 동일 작업에 대한 이전 3개 리뷰 라운드(`23_19_03`·`23_40_57`·`00_13_51`)와 독립적으로 같은 결론에 도달했다.

## 위험도
NONE
