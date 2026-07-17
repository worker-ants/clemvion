# User Guide Sync Review — 2026/07/17 02_04_13

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 20행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (동일 20행, 표+prose nuance) Read 완료.

## 변경 파일 컨텍스트
prompt 에 포함된 16개 파일:
1. `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts`
2. `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
3. `codebase/channel-web-chat/src/widget/use-widget.ts`
4–16. `review/code/2026/07/17/01_42_44/*` (RESOLUTION.md, SUMMARY.md, `_retry_state.json`, meta.json, 9개 reviewer 산출물 md) — 전부 이전 ai-review 라운드의 산출물이며 `codebase/**`·`docs`·`i18n dict`·`backend-labels.ts` 어느 것도 아님. 매트릭스 어떤 trigger glob 도 매칭 불가(review pipeline 메타 파일) → 이하 분석에서 제외.

`git status --short` / `git diff --name-only HEAD` 확인 결과 worktree 는 이 review 산출물 폴더(신규 미추적)만 남기고 clean — 즉 1–3번 파일은 이미 커밋된 diff(`01_42_44` 라운드 fix 커밋, RESOLUTION.md 상 `436ee334e`)를 리뷰 대상으로 재확인하는 것.

## trigger 매칭 분석

### 파일 1 — `webauthn.controller.spec.ts` (`codebase/backend/src/modules/auth/**`)
- glob 매칭: `auth-session-flow-change` (semantic, targets: `codebase/frontend/src/content/docs/07-workspace-and-team/` 관련 페이지 + e2e).
- 실질 검토: diff 는 `describe('webauthnList', ...)` 신규 `it` 2건 + mock 에 `listCredentials` 추가뿐 — **컨트롤러/서비스 프로덕션 코드 변경 없음**(이 diff 안에는 `webauthn.controller.ts`/`webauthn.service.ts` 파일 자체가 없음). `webauthn.controller.ts:269-288` 확인 결과 `GET credentials` (`webauthnList`) 엔드포인트는 이미 존재하는 기능이며, `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx:64` (`목록의 연필 아이콘 → 새 이름 입력 → 저장`)에 이미 문서화돼 있다. 즉 이 diff 는 새 인증 흐름이 아니라 **이전 라운드(01_42_44, WARNING #2)가 지적한 테스트 커버리지 갭을 메우는 test-only 백필**(`RESOLUTION.md` W2 참고).
- 판정: 신규 사용자 가시 흐름 변경이 아니므로 `07-workspace-and-team/` 갱신 불필요. **INFO** — glob 은 매칭되지만 "흐름 변경" 실질 없음(회색 지대, 조치 불요로 기록).

### 파일 2·3 — `use-widget.ts` / `use-widget-eager-start.test.ts` (channel-web-chat)
- `use-widget.ts` 는 `.ts` (not `.tsx`) — `new-widget-chrome-string` trigger(`codebase/channel-web-chat/src/**/*.tsx`)에 미매칭. 신규 UI 문자열(사용자 노출 텍스트) 도입 없음 — `dispatch({type:"ENDED"})`/`bridgeRef.sendEvent("conversationEnded")` 는 내부 상태전이·host 브릿지 이벤트이지 화면 텍스트가 아님.
- `run-debug-flow-change`(`05-run-and-debug/`) 후보로 검토했으나, 그 절은 메인 제품(워크플로 에디터)의 실행/디버그 로그 UI를 다루고 channel-web-chat 위젯의 SSE 재연결·버퍼만료 폴백과는 무관(관련 문서 grep 결과 `web-chat.mdx`/`web-chat-sdk.mdx` 는 임베드 스크립트 설정 안내이고 재연결/버퍼만료 내부 동작 서술 없음, 애초에 이 레벨의 내부 견고성 디테일은 사용자 가이드 서술 대상이 아님).
- 판정: 사용자 가시 기능·문자열·설정 변경이 아니라 내부 SSE 상태기계 견고성 버그 fix(무기한 streaming 스피너 정지 방지) — 매트릭스 어떤 trigger 도 실질적으로 요구하지 않음. **INFO** (회색 지대, 조치 불요 기록).

### 파일 4–16 — review 산출물
- `codebase/**`, `docs`, `dict`, `backend-labels.ts` 어느 경로도 아니므로 매칭 없음.

## 발견사항

- **[INFO]** `webauthn.controller.spec.ts` 가 `codebase/backend/src/modules/auth/**` glob(매트릭스 `auth-session-flow-change`)에 매칭되나, 실제로는 이미 존재하는 `GET credentials`(`webauthnList`) 엔드포인트에 대한 test-only 백필(프로덕션 코드 변경 없음)이다. 해당 기능은 `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx` 에 이미 문서화돼 있어 추가 갱신 불필요.
  - 변경 파일: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts`
  - 매트릭스 항목: "인증·권한·세션 흐름 변경" → `codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e
  - 누락된 동반 갱신: 없음(신규 흐름 아님)
  - 상세: glob 은 auth 하위 경로라 매칭됐지만 실질은 이전 리뷰 라운드의 테스트 갭 메움. 사용자 가시 동작 변화 없음.
  - 제안: 조치 불필요. 향후 이 endpoint 의 실제 동작(예: 응답 shape, 신규 필드)이 바뀌면 그때 `security-2fa.mdx` 재확인.

- **[INFO]** `use-widget.ts` / `use-widget-eager-start.test.ts` (channel-web-chat) 의 `execution.replay_unavailable` 폴백 terminal-state 처리 추가는 SSE 재연결 견고성 버그 fix로, 신규 UI 문자열·설정·사용자 가시 흐름 변경이 아니라 매트릭스 trigger 실질 매칭 없음.
  - 변경 파일: `codebase/channel-web-chat/src/widget/use-widget.ts`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
  - 매트릭스 항목: "신규 위젯 chrome 문자열" (`*.tsx` 한정, `.ts` 파일이라 glob 불일치) / "실행·디버깅 흐름 변경" (05-run-and-debug 는 메인 제품 실행 로그 UI 대상, 위젯 SSE 내부 동작과 무관으로 판단)
  - 누락된 동반 갱신: 없음
  - 상세: 사용자에게 노출되는 신규 텍스트·config 없음(내부 상태 전이 로직).
  - 제안: 조치 불필요.

## 요약

매트릭스 20개 trigger 중 glob 상으로 1건(`auth-session-flow-change`, `codebase/backend/src/modules/auth/**`)이 파일 1에 매칭됐으나 실질은 test-only 백필로 대상 기능이 이미 `07-workspace-and-team/security-2fa.mdx` 에 문서화돼 있어 동반 갱신 불필요. channel-web-chat 위젯 변경 2건은 `.tsx`/신규 문자열/사용자 가시 흐름 조건 어느 것도 충족하지 않아 trigger 미매칭. 나머지 13개 파일은 이전 라운드의 review 산출물(메타 파일)로 매트릭스 영역 자체와 무관. **CRITICAL/WARNING 0건, INFO 2건(둘 다 회색 지대·조치 불요로 판단)** — 실질적 동반 갱신 누락 없음.

## 위험도
NONE
