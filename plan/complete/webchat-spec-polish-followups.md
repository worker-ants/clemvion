---
worktree: .claude/worktrees/webchat-spec-polish-followups-0fd355
started: 2026-06-28
owner: project-planner
spec_impact:
  - spec/7-channel-web-chat/0-architecture.md
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/7-channel-web-chat/2-sdk.md
  - spec/7-channel-web-chat/3-auth-session.md
  - spec/7-channel-web-chat/4-security.md
---

# Channel Web Chat — spec polish followups (D/A/B+C/B1 검토 중 이연분)

> 출처: #732·#737·#744·#746 진행 중 consistency/ai-review 가 발견한 비차단 spec 품질 항목 묶음.
> 전부 spec/ 변경(planner). 코드 변경 없음.

## 변경 항목
1. **GET /:id status 410→200+status 정합(가장 substantive)**: `3-auth-session §3.1 step 2` 가
   `GET → 410 Gone(종료)` 로 기술하나, 코드 확인 결과 `getStatus`(@Get(':executionId'))는
   `@ApiGoneResponse` 없음 — 200+ExecutionStatusDto / 401 / 404 만. EIA-IN-12 의 410 은 *명령*(interact)
   전용이고 §5.3 상태조회는 200+status. → step 2 를 200+terminal-status·404 분기로 재서술.
2. **frontmatter `code:` 신규 훅 명시**: `3-auth-session` 에 `use-token-refresh.ts`, `1-widget-app` 에
   `use-pending-message-queue.ts` 추가(현 0-architecture `channel-web-chat/**` glob 커버, 명시성 강화).
3. **§R6 localStorage 잔류 정책 한 줄**: 3-auth-session §R6 에 "구 localStorage 잔류 항목은 읽기 경로
   sessionStorage 전용이라 무시 — 단명 토큰 만료로 자연 소멸" 한 줄.
4. **에러 일반화 정책 spec home**: `4-security §1` 표에 에러 메시지 일반화(내부 원문 UI 비노출) 행/주석
   신설 — use-widget errMessage 의 spec 근거(현 코드 주석 §5 인용 정합).
5. **`## Overview` 4파일**: `0-architecture`·`1-widget-app`·`2-sdk`·`3-auth-session` 에 1~2문장 Overview.

## 절차
- [x] 위 변경 spec 반영 — 3-auth-session(§3.1 410→200+status·404 / frontmatter use-token-refresh.ts / §R6 localStorage 잔류 / Overview),
      4-security §1(에러 일반화 행), 0-architecture·1-widget-app·2-sdk Overview. (1-widget-app `code:` 은 `**` glob 이라 use-pending-message-queue.ts 자동 커버 — frontmatter 변경 불요.)
- [x] /consistency-check --spec → **BLOCK: NO** (`review/consistency/2026/06/28/10_26_12/`). WARNING 2 둘 다 pre-existing:
      W-1(§R5 interact ack body 표현) **본 PR 수정**, W-2(V-18 §3.1 구현범위 단서) **별도 open**(본 polish 는 410→200 오기 정정만).
- [ ] commit `docs(spec):`.

### 검토 노트 (W-2 / V-18)
본 polish 는 `3-auth-session §3.1 step 2` 의 **응답 코드 사실 오류**(GET status 가 410 반환한다는 서술 → 코드상 getStatus 는
410 미반환, EIA §5.3 은 200+status·404)만 정정한다. §3.1 서술은 실제 위젯 코드 동작(getStatus 로 waiting 표면 시드, terminal/404
는 SSE·cleanup 으로 [ended])과 정합한다. V-18 audit 의 "§3.1 복원 시퀀스 구현 범위 단서를 달지" 결정은 별개 open 항목이며,
코드가 getStatus 를 실제 호출하므로 부정확한 "v1 미구현" 단서는 추가하지 않는다.

### 코드 측 후속(별도, 비차단)
- use-widget.ts errMessage 주석의 `4-security §5` → `§1 에러 메시지 노출 행` 으로 교정(developer, trivial). 현 §5 인용도 데이터 노출 맥락이라 오류는 아님.

## 비고
- §R6 영역 번호 컨벤션(W-2)은 "현행 유지"(파일명 병기) 결정 — 별도 조치 없음.
