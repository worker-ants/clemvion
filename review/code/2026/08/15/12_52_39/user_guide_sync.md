STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — EIA 종결 이벤트 `durationMs`

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(133~155행)을 Read 했다.

## 변경 파일 컨텍스트

이번 changeset(194개 변경 파일 중 실질 코드/문서)은 EIA 종결 이벤트(`execution.completed`/`failed`/`cancelled`)에 `durationMs` 필드를 채우는 작업이다. 관련 실체 파일:

- backend: `chat-channel.dispatcher.ts`, `chat-channel/types.ts`, `dashboard.service.ts`, `execution-engine.service.ts`, `retry-turn.service.ts`, `executions.service.ts`, `statistics.service.ts`, `shared/utils/terminal-duration.ts`(신규) + 각 `.spec.ts`
- docs: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`, `run-results.en.mdx`
- spec: `spec/3-workflow-editor/3-execution.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md`
- plan/review: `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**` (대량, 이전 라운드 산출물)

frontend `.tsx`, `codebase/frontend/src/lib/i18n/dict/**`, `backend-labels.ts`, `codebase/frontend/src/lib/docs/locale.ts`, `codebase/backend/src/nodes/**`, `error-codes.ts`, `codebase/packages/expression-engine/**`, `codebase/backend/src/modules/auth/**` 변경은 이 changeset 에 **없음**.

## trigger 매칭

- **run-debug-flow-change** (실행·디버깅 흐름 변경, semantic) — `execution-engine.service.ts` / `retry-turn.service.ts` / `executions.service.ts` 가 종결 이벤트의 `durationMs` 산출·전파 로직을 바꿨다. targets: `codebase/frontend/src/content/docs/05-run-and-debug/`.
  - **매칭됨. 그리고 이미 동일 changeset 안에서 co-update 완료.** `run-results.mdx`(138~140행 삽입) + `run-results.en.mdx`(128~130행 삽입) 양쪽에 "취소/타임아웃으로 끝난 실행의 소요 시간은 실제 처리 시간이 아니라 대기 시간일 수 있다" 는 동일 caveat 이 구조적으로 동일한 위치(같은 `<Steps>` 블록 뒤, "전용 실행 내역 페이지" 절 앞)에 ko/en 대칭으로 들어갔다. 내용도 1:1 대응(취소/타임아웃 → 대기 시간 반영, 완료 실행은 항상 실제 처리 시간)이라 parity 이슈 없음.
  - CHANGELOG.md 도 이 caveat 을 명시적으로 예고("내부 UI 의 '소요 시간' 컬럼은 아직 대기 시간을 그대로 보여준다... 그 전까지 유저 가이드에 캐비엇을 넣었다")하고 있어, 개발자가 이 매트릭스 항목을 의식적으로 처리한 것으로 보인다.
- **backend-api-change** — trigger glob(`*.controller.ts`, `dto/**`)에 매칭되는 파일이 changeset 에 없음(전부 `*.service.ts`). 비매칭.
- **new-warning-code / new-error-code** — `warningRules`·`error-codes.ts` 변경 없음. 비매칭.
- **new-node / node-schema-change / integration-provider-change / new-userguide-section-dir / auth-session-flow-change / expression-language-change / new-ui-string** — 해당 파일 변경 없음. 비매칭.

## dashboard/statistics 집계 변경(부수 확인)

`dashboard.service.ts`/`statistics.service.ts` 의 `AVG(e.duration_ms)` 필터에 `status = 'completed'` 조건이 추가됐다(취소·타임아웃 실행이 대기 시간으로 평균을 오염시키던 것을 막는 수정). 이는 **집계 정확도가 개선**되는 방향이고 사용자에게 노출되는 라벨·정의("평균 실행 시간")는 그대로이므로 doc-sync 매트릭스의 어떤 trigger 에도 해당하지 않는다. `codebase/frontend/src/content/docs/01-getting-started/ui-tour.mdx` 의 "평균 실행 시간" 언급은 일반적 설명이라 stale 화되지 않았다.

## 발견사항

없음. 이번 PR 이 유일하게 매칭시킨 trigger(실행·디버깅 흐름 변경)는 같은 changeset 안에서 ko/en 양쪽 문서에 이미 정확히 co-update 됐다.

## 요약

매트릭스 21행 중 1행(`run-debug-flow-change`, 실행·디버깅 흐름 변경)이 이번 diff 에 매칭됐고, 해당 trigger 의 target(`codebase/frontend/src/content/docs/05-run-and-debug/`)은 `run-results.mdx` + `run-results.en.mdx` 양쪽에 구조·내용이 대칭인 caveat 삽입으로 같은 changeset 안에서 이미 충족됐다(개발자가 CHANGELOG 에도 이 동반 갱신을 명시적으로 예고). i18n dict·backend-labels·섹션 locale·노드 문서·통합 문서·인증 흐름·표현식 언어 관련 trigger 는 이번 diff 범위에 해당 파일 변경이 없어 전부 비매칭. 누락된 동반 갱신 없음.

## 위험도

NONE
