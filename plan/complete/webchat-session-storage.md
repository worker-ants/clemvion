---
worktree: .claude/worktrees/webchat-session-storage-ac439a
started: 2026-06-27
owner: developer
spec_impact:
  - spec/7-channel-web-chat/3-auth-session.md
  - spec/7-channel-web-chat/4-security.md
  - spec/7-channel-web-chat/2-sdk.md
  - spec/7-channel-web-chat/1-widget-app.md
---

# Channel Web Chat — 그룹 A: 세션 토큰 sessionStorage + start() 에러 메시지 일반화

> 출처: `web-chat-quality-backlog.md §A`. spec(planner) + code(developer) 동반 변경 → 한 PR.
> 선행 PR: D(#732 merged), B+C(#737 pending). 본 PR 은 session-store.ts(신규 영역)·use-widget errMessage(말단)
> 위주라 #737 과 hunk 비중복 — 머지 충돌 위험 낮음.

## 설계 핵심
- **localStorage → sessionStorage**: per_execution 단명 토큰을 sessionStorage 로 저장. 탭 종료 시 자동 소거
  (defense-in-depth, XSS 잔존 노출 면 축소). **N1 재로드 복원은 보존** — sessionStorage 는 같은 탭 reload 를 유지한다
  (탭 종료/새 탭에서만 소거). 트레이드오프: 탭 간 세션 미공유(탭마다 독립 대화) — 공개 위젯에 수용 가능/오히려 적합.
- **start() 에러 메시지 일반화(W1)**: 내부 에러 원문을 UI 에 직접 노출하지 않고 일반화 문구로 표시. 원문은 console 진단 유지.

## A-1. 기획(planner) — spec
- [x] `2-sdk.md §3 resetSession`: "저장 세션(localStorage)" → sessionStorage.
- [x] `3-auth-session.md §3·§3.1`: storage = sessionStorage 명시(I-6 통일 포함) + **Rationale R6 신설**(defense-in-depth, N1 보존, 탭 단위 트레이드오프).
- [x] `4-security.md §1 토큰 노출 row`: sessionStorage 저장 → 탭 종료 자동 소거(3-auth-session §R6 cross-ref).
- [x] `1-widget-app.md §3.1 새로고침 row`: iframe-origin storage = sessionStorage(같은 탭 reload 복원·탭 종료 소거) 명시.
- [x] /consistency-check --spec → **BLOCK: NO** (`review/consistency/2026/06/27/22_55_00/`). WARNING 2건 둘 다 pre-existing.

### 검토 중 발견 (별도 followup — 본 PR scope 밖)
- **W-1 (planner)**: `3-auth-session §3.1 step 2` 의 `GET /:id` `410 Gone` 처리가 EIA §5.3 `200+status` 계약과 drift(pre-existing, 내 diff 미접촉). 구현은 200/SSE 로 [ended] 수렴해 동작하나 spec 문구 정합 필요. EIA 계약 대조 후 별도 plan.
- **W-2 / I-5 (planner spec polish)**: 영역 R-번호 컨벤션 정립 · 4파일 `## Overview` carve-out — D·B+C 검토에서도 반복된 비차단 INFO.

## A-2. 구현(developer) — code
- [x] `session-store.ts`: getStorage 기본 localStorage → sessionStorage + 주석 갱신.
- [x] `use-widget.ts errMessage`: UI 일반화 문구(GENERIC_ERROR_MESSAGE) 반환 + 원문 console 진단. start()/sendCommand 에러 경로 적용.
- [x] 테스트: session-store/use-widget 의 localStorage 참조 → sessionStorage + 기본저장소=sessionStorage·에러 일반화(원문 미노출) 2건 추가. (231 green)
- [x] /consistency-check --impl-prep → 직전 --spec(같은 영역·세션) 이 pre-flight 검증 대체(BLOCK: NO). + --impl-done 으로 사후 검증.
- [x] TEST WORKFLOW (lint·unit·build·e2e) — 전부 PASS (e2e 218; 무관 backend e2e drift 1건 동반 수정).
- [x] /ai-review — 1차(00_23_13)는 diff base(local main stale) 오염으로 무효 → `--branch origin/main` 재실행(00_30_51). 보고 RISK=CRITICAL 이나 **Critical#1+Warning#1~3 전부 false positive**(큐는 MONITORED_QUEUES:75 등재·e2e green / spec 변경은 파일 반영 완료) — RESOLUTION.md 에 증거로 refute. W4(주석 §5)·INFO 는 planner/후속. impl-done(00_23_26) BLOCK:NO 가 SPEC-DRIFT 오탐을 교차 반증.
- [x] /consistency-check --impl-done → **BLOCK: NO** (`review/consistency/2026/06/28/00_23_26/`, 전원 NONE).

## 후속 (별도)
- **W-1 (planner)**: `3-auth-session §3.1 step 2` GET 410 Gone vs EIA §5.3 200+status drift — backlog 등재 + EIA 계약 대조.
- **§R6 보강 (planner spec polish)**: 구 localStorage 잔류 항목 무시 정책 한 줄(impl-done INFO #3). 본 PR 추가 spec commit 회피로 분리.
- **B1**: useWidget God hook 분리 (다음 PR).
