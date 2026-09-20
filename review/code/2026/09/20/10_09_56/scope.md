# 변경 범위(Scope) 리뷰 — SSRF 가드 소비자 넷의 catch 판정 분기 (2라운드, 머지 후 감사)

## 검토 방법

`git diff --stat origin/main...HEAD` 로 프롬프트에 실린 32개 파일이 실제 branch diff 와 정확히 일치함을 대조 확인(추가·누락 0건). 저장소에는 쓰지 않았다(`Read`/`Bash git diff/status`만 사용) — `git status --short` 는 이번 리뷰 세션이 만든 `review/code/2026/09/20/10_09_56/`(untracked, 아직 orchestrator 가 조립 중인 산출물) 외 다른 변경 없음을 확인했다.

## 발견사항

- **[INFO]** import 나열 순서가 형제 파일 5곳과 다름 (1라운드 scope 리뷰에서 이미 지적됐고 여전히 미수정 — 재확인)
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.spec.ts:5-8` (실제 파일을 열어 재확인: `assertSafeOutboundHostResolved, SsrfBlockedError` 순 — 소문자·알파벳 우선)
  - 상세: 같은 PR 에서 함께 바뀐 `database-connection-tester.ts:5-8`, `http-connection-tester.spec.ts:1-6`, `http-redirect.ts:1-5`, `http-request.handler.ts:19-24` 등은 전부 `SsrfBlockedError` 를 먼저 두는 순서다. 이 파일만 뒤집혀 있다. 1라운드 SUMMARY(`review/code/2026/09/20/09_35_16/SUMMARY.md` WARNING 목록의 INFO#7)에서 이미 "조치 불요" 로 처분됐고 이번 라운드에서도 실질 영향(빌드·lint·실행 결과)은 없다. 처분이 유지되는지만 확인차 재기재.
  - 제안: 조치 불요 — 이미 1라운드에서 명시적으로 defer 결정됨. 다음에 해당 파일을 만질 때 정렬만 맞추면 됨.

## 범위 밖 변경 없음 확인

- **애플리케이션 코드 10개 파일** — 전부 `plan/in-progress/ssrf-catch-instanceof.md` 가 선언한 단일 스코프(SSRF 가드 소비자 4곳 + 동반 1건의 `catch` 를 `instanceof SsrfBlockedError` 로 판정/비판정 분류) 의 직접 구현·테스트다. 원 구현 커밋(`840e8e7f9`)과 1라운드 리뷰 fix 커밋(`e8d810405`)이 같은 diff 안에 누적돼 있지만, `e8d810405` 의 내용은 `review/code/2026/09/20/09_35_16/RESOLUTION.md` 에 기록된 W1(메시지 마스킹 통일)·W2(타임아웃 예산 순서)·W3(DNS mock 누락)·W4(stale 주석) 4건의 처분과 diff 가 정확히 일치한다 — 새 기능·새 파일·무관한 리팩토링이 그 사이에 섞이지 않았다.
- `http-connection-tester.ts` 의 `outboundBlockReason` 호출을 `try` 블록 안으로 옮기고 `AbortSignal.timeout` 생성을 그 뒤로 미룬 것은 plan 문서 "동반 1건" 섹션에 사전 고지된 필연적 결과(no-throw 계약 유지)이자, 1라운드 리뷰 W2 의 fix 대상이었다 — 별개의 drive-by 변경이 아니다.
- **plan 파일 2건** — `plan/in-progress/ssrf-catch-instanceof.md`(신설)는 이 작업 자체의 plan 이며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신은 (1) 이 작업이 해소한 트래커 항목 체크(`[x]`), (2) 실행 중 발견한 무관한 e2e flake(`schedule-trigger` cron 재계산, 1분 창 충돌)를 고치지 않고 별도 백로그 항목으로 등재, (3) spec `code:` frontmatter 누락 갭을 planner 항목으로 등재 — 세 가지 모두 "미룬 항목은 그 턴에 plan 에 남긴다" 는 프로젝트 관례에 부합하며 코드로 고쳐 스코프를 넓히지 않았다(항목 2 는 이번 PR 코드에 손대지 않고 관찰만 기록).
- **리뷰/일관성 산출물 20건** (`review/code/2026/09/20/09_35_16/**`, `review/consistency/2026/09/20/09_06_34/**`) — `CLAUDE.md` "정보 저장 위치" 표가 요구하는 정규 프로세스 산출물(코드 리뷰·일관성 검토)이며, `--impl-prep`/`/ai-review` 게이트 실행 결과를 커밋에 포함하는 것은 이 저장소의 표준 워크플로다. 무관한 파일 혼입이 아니다.
- 설정 파일(`package.json`, eslint/tsconfig 등) 변경, 사용하지 않는 import 추가/정리, 포맷팅-only 변경, 요청 밖 기능 확장(over-engineering)은 32개 파일 어디에도 없다. 추가된 주석/JSDoc 은 전부 이번 `instanceof` 분기의 근거(왜 판정과 고장을 가르는지, 각 호출부의 no-throw/no-leak 계약)를 설명하는 것으로 diff 와 직접 결부돼 있다.

## 요약

`git diff --stat origin/main...HEAD` 대조로 프롬프트의 32개 파일이 실제 branch diff 전량과 정확히 일치함을 확인했다. 애플리케이션 코드 10개 파일은 plan 이 선언한 단일 스코프(SSRF 가드 4+1 소비자의 판정/비판정 분류) 안에 있고, 1라운드 리뷰 fix 커밋도 그 라운드 RESOLUTION 이 기록한 4건의 처분과 정확히 일치해 새로운 스코프 확장이 없다. plan 갱신은 해소 체크 + 무관하게 발견한 결함(e2e flake)의 관찰-only 등재이고, 리뷰/일관성 산출물은 프로젝트가 요구하는 정규 절차 산출물이다. 유일한 잔여 발견은 1라운드에서 이미 defer 처분된, 실질 영향 없는 import 순서 불일치 하나뿐이다.

## 위험도

NONE
