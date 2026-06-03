---
worktree: .claude/worktrees/feat-web-chat-demo
started: 2026-06-03
owner: developer
spec: spec/7-channel-web-chat
---

# Channel Web Chat — 로컬 데모 호스트 + dev 포트 분리

> 위젯 SPA(`channel-web-chat`)는 그 자체가 iframe 내부에서 도는 임베드 본체라, `next dev` 로
> `/` 를 직접 열면 boot config 미주입 상태로만 떠 우측 하단 버튼이 무반응(=`widget-app.tsx`
> 의 `state.open && config` 조건에서 `config===null` 이라 Panel 미렌더)이다. 로컬에서 정상
> 테스트하려면 호스트(부모 페이지) 역할을 하는 설정 폼 + iframe 임베드 데모가 필요하다.
> 운영 호스트 통합은 SDK(`@workflow/web-chat`)지만, 본 데모는 dev 전용 하니스로 분리한다.

## 배경/결정 (사용자 confirm 2026-06-03)
- **풀 데모 + 포트 분리** 진행. 데모 위치 = `channel-web-chat` 앱 내 **`/demo` 라우트**.
- host bridge 는 **손수 구현**(SDK dogfooding 제외) — `wc:*` 프로토콜(2-sdk §3) 직접 사용.
- 게이팅 = **`NODE_ENV`** 기반: `next dev`(development) ON, `next build`(production static
  export) 자동 제외. prod 미리보기용 opt-in `NEXT_PUBLIC_ENABLE_DEMO=1` escape hatch.
- 포트 **3013** (backend 3011 / frontend 3012 / web-chat 3013).

## 작업 항목
- [ ] (1) dev 포트 분리 — `package.json` `dev`: `source .env 2>/dev/null; next dev --port ${PORT:-3013}`
- [ ] (1) `.env.example`(committed) — PORT=3013 + 데모 prefill 변수 + prod opt-in 문서화
- [ ] (1) `.gitignore` — `.env*` + `!.env.example` (frontend 미러; 현재 `.env*.local` 만)
- [ ] (3) TDD: `demo-config.test.ts` — `buildBootConfig`/`parseSuggestions`/`isDemoEnabled` 순수함수
- [ ] (2) `src/app/demo/demo-config.ts` — 순수 헬퍼 + 기본 폼 상태
- [ ] (2) `src/app/demo/demo-host.tsx` — 설정 폼 + iframe(`src=/`) 임베드 + wc:boot 전송 + wc:event 로그
- [ ] (2) `src/app/demo/page.tsx` — NODE_ENV 게이팅(notFound) + DemoHost 렌더
- [ ] (4) DOCUMENTATION — `README.md` 데모 사용법 섹션, PROJECT.md 매핑 점검
- [ ] (8) TEST WORKFLOW (lint·unit·build, e2e 판단)
- [ ] (9) REVIEW WORKFLOW (/ai-review + fix + RESOLUTION)

## 비목표
- 위젯 본체 동작/상태기계 변경 없음(추가만). `wc:resize` 방출 미구현(위젯 측) — 데모 iframe 은 고정 박스, 수신 핸들러만 forward-compat.
- SDK(`@workflow/web-chat`) 변경 없음.

## 사전 검토
- [x] `/consistency-check --impl-prep spec/7-channel-web-chat` → **BLOCK: NO** (review/consistency/2026/06/03/08_56_55)
  - Critical 0. WARNING 4건(W1~W5)은 모두 **기존 spec/ 문서 갭**(SSE 재연결 시나리오·stale 토큰 blacklist 처리·`WEB_CHAT_WIDGET_ORIGINS` env 문서화·`4-security.md` Rationale 누락·spec-impl-evidence 가드)으로 본 dev-harness PR 범위 밖 → **project-planner 후속**으로 이관(아래 후속 항목).
  - 데모 구현 반영: **I6** (iframe 메시지 수신 시 `event.source`/origin 검증), **I9** (위젯 미구현 명령 `show`/`hide`/`updateProfile` 미노출 — `open`/`close`/`sendMessage` 만).

## 후속(project-planner, 본 PR 밖)
- [ ] W1: `1-widget-app.md §3.1` SSE 재연결 시나리오 명시
- [ ] W2: `3-auth-session.md §3` 재로드 복원 시퀀스 명시
- [ ] W3: `spec-impl-evidence.md §1` INCLUDE_PREFIXES 에 `spec/7-channel-web-chat/` 추가
- [ ] W4: `4-security.md` `## Rationale` 추가
- [ ] W5: `0-architecture.md §4` + backend `.env.example` 에 `WEB_CHAT_WIDGET_ORIGINS` 명시
