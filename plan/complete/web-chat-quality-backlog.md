---
worktree: (unstarted)
started: 2026-06-27
owner: developer (TBD)
---

# Channel Web Chat — 품질·하드닝 backlog

> 웹챗 영역의 구현·spec 은 전부 종결됐다(`channel-web-chat-impl` · `channel-web-chat-followups` ·
> `webchat-eager-start` 모두 `plan/complete/`, spec 6문서 전부 `implemented`). 본 plan 은 그 과정에서
> **비차단으로 이연된 품질·하드닝·spec-polish 항목**을 한 곳에 모은 backlog 다. **영역 기능 surface 는 완결**
> (전부 비차단) — 활성 강제 TODO 아님, 우선순위 낮음. 여유/필요 시 picking 하며 큰 항목은 착수 시 별도 plan 분리 가능.

## 출처
- `webchat-eager-start` 종결(2026-06-27) 시 이관한 비차단 backlog (impl-done/ai-review followup).
- `channel-web-chat-followups` 종결 시 `4-security.md` consistency-check 가 발견한 spec-quality 항목
  (`review/consistency/2026/06/27/20_41_56/SUMMARY.md` — W1·I1~I6. W2 는 #727 에서 해소).

## A. 위젯 보안 하드닝 (eager-start 이관) — ✅ PR #744 (머지)
- [x] **per_execution 토큰 저장 localStorage → sessionStorage** — spec(3-auth-session §R6 신설·4-security·2-sdk·1-widget-app)
      + 코드(session-store) 동반. 탭 종료 자동 소거, N1 재로드 복원 보존. PR #744.
- [x] `start()` 에러 메시지 UI 일반화(W1) — errMessage 일반화 문구 + console 진단. 동 PR #744.

## B. 위젯 리팩터 (eager-start 이관)
- [x] `useWidget` God hook 분리 — `useTokenRefresh` / `usePendingMessageQueue`. — PR `webchat-usewidget-split`(B1).
- [x] `isTextInputSurface()` 헬퍼 추출(텍스트표면 판정 3중 중복 제거). — PR `webchat-widget-refactor` (commit df77e61e6+)
- [x] `teardownSession` 헬퍼 · `start()` check-then-set(이미 충족·유지) · composer allowlist 전환 · SSE 이벤트명 배열 파생. — 동 PR

## C. 테스트 보강 (eager-start 이관)
- [x] `ended` Composer 미렌더 · fake timer(토큰 refresh) · C1 buttons/form 폐기 · ended 재open reducer · ERROR→ended reducer 강화. — 동 PR
  - 추가 backlog 메모(ai-review/impl-done INFO): `configFromQuery` apiBase origin 검증(보안 #6) · `phase=blocked` Panel 테스트(#14) · `1-widget-app §3.1·§2` spec 문서화(SPEC-DRIFT, planner) — 전부 비차단.

## D. spec polish — ✅ 전부 완료 (PR 미정, consistency-check BLOCK: NO `review/consistency/2026/06/27/21_35_06/`)
- [x] `0-architecture §R6` 중복 ID 재번호화 + C1 buttons/form 폐기 동작 Rationale 한 줄(eager-start 이관).
      → 실상 "중복"이 아니라 R1→R5 **번호 공백**(R2/R3/R4 부재, git 확인)이라 0-architecture Rationale 을
      **R1–R5 연속으로 재번호화** + spec 트리 교차참조(§R6/§R8 → §R3/§R5) 7건 전부 정합. C1 buttons/form 폐기
      Rationale 은 **이미 `1-widget-app §R6`(큐 게이팅 단락)에 존재**해 중복 생성하지 않음.
- [x] **`4-security` Rationale R5 신설** — `allow-same-origin` sandbox 가 `0-architecture §R1` "완전 분리"와의 긴장
      관계·공급망 무결성 전제를 명문화(consistency W1).
- [x] `4-security §4` EIA §8.4 인용 — SSE 동시 3(구현) vs interact 분당 60(Planned) 구분 기재(I1).
- [x] `spec/5-system/12-webhook.md` "POST 전용" SoT 에 `/embed-config` 서브경로 스코프 한정 문구(I2).
- [x] `4-security` R2 — 인증 webhook `embed-config enforce:false` 결정 Rationale(I3).
- [x] `4-security` Rationale — CORS(empty→CDN-only) vs 임베드(empty→allow-all) 비대칭을 의도된 설계로 기록(I4).
- [x] `4-security` `id`↔basename 불일치 주석 · `## Overview` 섹션 추가(I5/I6, 선택).
