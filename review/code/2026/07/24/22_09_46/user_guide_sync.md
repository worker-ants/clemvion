# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

해당 없음.

## 매칭 분석 근거

변경 file 목록(7건) 대비 `.claude/config/doc-sync-matrix.json` `rows[]` (22개 trigger 행) 을 전수 매칭:

- `codebase/channel-web-chat/src/lib/session-store.ts` — 신규 필드 `PersistedSession.apiBase` + `loadSession()` 시그니처 변경(발급 origin 바인딩). `.ts` 파일이며 사용자 가시 텍스트 변경 없음(내부 필드·검증 로직).
- `codebase/channel-web-chat/src/widget/use-widget.ts` — `loadSession(cfg.triggerEndpointPath, cfg.apiBase)` 배선 변경. 마찬가지로 `.ts`, UI 문자열 무변경.
- `codebase/channel-web-chat/src/lib/session-store.test.ts`, `use-token-refresh.test.ts`, `use-widget-eager-start.test.ts` — 위 변경에 대응하는 테스트 갱신/추가.
- `plan/complete/webchat-session-apibase-binding.md` (신규), `plan/in-progress/webchat-session-apibase-binding.md` (삭제) — plan 라이프사이클 이동(in-progress → complete). 문서 자산이지만 매트릭스가 다루는 "유저 가이드"(`codebase/frontend/src/content/docs/**`) 범주 밖.

매트릭스 22행 중 channel-web-chat 을 trigger 로 갖는 행은 `new-widget-chrome-string` 1건뿐이며, 그 glob 은 `codebase/channel-web-chat/src/**/*.tsx` 로 **`.tsx` 파일만** 대상이다. 본 변경 set 은 전부 `.ts`(session-store.ts, use-widget.ts, `*.test.ts`) 이고 `.tsx` 는 하나도 없다 — 이 trigger 도 매칭되지 않는다. 또한 위 두 로직 변경 어디에도 사용자 가시 신규 문자열(라벨·placeholder·에러 메시지)이 추가되지 않았다(추가된 것은 JSDoc/코드 주석뿐이고, 기존 `console.warn` 문구는 이번 diff 밖의 pre-existing 코드다) — 설령 glob 이 `.ts` 를 포함했더라도 "신규 UI 문자열" 로 볼 근거가 없다.

`auth-session-flow-change`(인증·권한·세션 흐름 변경, glob `codebase/backend/src/modules/auth/**`) 행도 검토했으나, 이번 변경은 **`codebase/channel-web-chat/**` 임베드 위젯**의 클라이언트측 세션 영속화(sessionStorage) 로직이며 backend 의 `modules/auth/**`(운영 콘솔 로그인·세션·권한 미들웨어)와 무관하다. 매트릭스가 지시하는 동반 갱신 대상인 `codebase/frontend/src/content/docs/07-workspace-and-team/`(운영 콘솔 워크스페이스/팀 가이드) 페이지도 이 위젯 임베드 토큰 바인딩과 무관한 별개 표면이다.

나머지 20개 행(새 노드, 노드 schema, 통합/제공자, 신규 섹션 디렉토리, backend API, BullMQ 큐, warningCode/errorCode, cross-cutting enum, backend zod ui.label, handler output field, AuthConfig enum, 표현식 언어, 실행·디버깅 흐름, env/runtime, spec 대규모 변경, user-guide GUI 흐름 절, spec 결함)도 전부 대상 파일 경로·의미 범주가 이번 변경 set 과 겹치지 않는다 (`codebase/backend/**`, `codebase/frontend/**`, `spec/{2,3,4,5}-*`, `spec/conventions/**` 등이 전혀 touched 되지 않음).

plan 파일 2건(`plan/complete/webchat-session-apibase-binding.md` 신규, `plan/in-progress/` 동명 파일 삭제)은 표준 plan 라이프사이클 이동(완료 처리)이며 frontmatter `spec_impact: none` 근거(§3.1·§3 은 복원 자체만 규정, 동작 계약이 좁아졌을 뿐 spec 표면 자체는 무변경)를 명시하고 있어 spec 동반 갱신 누락도 아니다. 이는 project-planner/consistency-checker 영역이지 user-guide-sync 범주가 아니다.

## 요약

매트릭스 22개 trigger 행 중 이번 변경 set(channel-web-chat 세션-스토어 `.ts` 로직 3파일 + 테스트 3파일 + plan 라이프사이클 2파일, 총 7파일)과 매칭되는 행은 0건. 유일하게 channel-web-chat 을 다루는 `new-widget-chrome-string` 행도 `.tsx` 전용 glob 이라 `.ts` 전용인 이번 변경에는 적용되지 않고, 신규 사용자 가시 문자열도 없다. 인증·세션 흐름 관련 행도 대상이 backend `modules/auth/**`(운영 콘솔)로 이번 변경(위젯 임베드 세션 바인딩)과 표면이 다르다. 유저 가이드 MDX·i18n dict·backend-labels·locale.ts 등 어떤 동반 갱신 자산도 이번 diff 로 인해 stale 해지지 않는다.

## 위험도

NONE
