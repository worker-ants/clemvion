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
- [x] (1) dev 포트 분리 — `package.json` `dev`: `source .env 2>/dev/null; next dev --port ${PORT:-3013}`
- [x] (1) `.env.example`(committed) — PORT=3013 + 데모 prefill 변수 + prod opt-in 문서화
- [x] (1) `.gitignore` — `.env*` + `!.env.example` (frontend 미러; 현재 `.env*.local` 만)
- [x] (3) TDD: `demo-config.test.ts` — `buildBootConfig`/`parseSuggestions`/`isDemoEnabled`/`isBootReady` 순수함수
- [x] (2) `src/app/demo/demo-config.ts` — 순수 헬퍼 + 기본 폼 상태
- [x] (2) `src/app/demo/demo-host.tsx` — 설정 폼 + iframe(`src=/`) 임베드 + wc:boot 전송 + wc:event 로그
- [x] (2) `src/app/demo/page.tsx` — NODE_ENV 게이팅(notFound) + DemoHost 렌더
- [x] (4) DOCUMENTATION — `README.md` 데모 사용법 섹션, PROJECT.md 매핑 점검(데모는 매트릭스 trigger 비해당)
- [x] (8) TEST WORKFLOW — lint·unit(120건)·build(정적 export, prod /demo 제외 검증) 통과. e2e 보류 승인(사용자, 2026-06-03)
- [x] (9) REVIEW WORKFLOW — `/ai-review` RISK LOW, Critical 0 / Warning 4 → 수동 fix + RESOLUTION (review/code/2026/06/03/09_15_11)

## 비목표
- 위젯 본체 동작/상태기계 변경 없음(추가만). `wc:resize` 방출 미구현(위젯 측) — 데모 iframe 은 고정 박스, 수신 핸들러만 forward-compat.
- SDK(`@workflow/web-chat`) 변경 없음.

## 사전 검토
- [x] `/consistency-check --impl-prep spec/7-channel-web-chat` → **BLOCK: NO** (review/consistency/2026/06/03/08_56_55)
  - Critical 0. WARNING 4건(W1~W5)은 모두 **기존 spec/ 문서 갭**(SSE 재연결 시나리오·stale 토큰 blacklist 처리·`WEB_CHAT_WIDGET_ORIGINS` env 문서화·`4-security.md` Rationale 누락·spec-impl-evidence 가드)으로 본 dev-harness PR 범위 밖 → **project-planner 후속**으로 이관(아래 후속 항목).
  - 데모 구현 반영: **I6** (iframe 메시지 수신 시 `event.source`/origin 검증), **I9** (위젯 미구현 명령 `show`/`hide`/`updateProfile` 미노출 — `open`/`close`/`sendMessage` 만).

## 섹션2 — spec 갭 W1~W5 (사용자 결정 2026-06-03: 본 PR 에 포함)
draft: `spec-draft-channel-web-chat-gaps.md`. consistency-check --spec(09_46_31) BLOCK 은 **타 worktree 동일파일
경합(W3 spec-impl-evidence ↔ spec-sync-audit / W5 .env.example ↔ system-status)** 뿐 — 사용자가 "충돌 감수 진행 +
재검토 생략" 결정. 머지 시 두 파일 수동 resolve 필요.
- [x] W1: `1-widget-app.md §3.1` SSE 재연결 시나리오(Last-Event-Id/5분 버퍼/snapshot 폴백)
- [x] W2: `3-auth-session.md §3.1` 재로드 복원 시퀀스 + 401 구분 + storage 정리 + Rationale R4
- [x] W4: `4-security.md` `## Rationale`(CORS 분리·soft/hard·fixed-window) + §3-① blocked enum + §2.1 env 키
- [x] W5(spec): `0-architecture.md §4` `WEB_CHAT_WIDGET_ORIGINS` 명시
- [x] W3(spec): `spec-impl-evidence.md §1` INCLUDE_PREFIXES 에 `spec/7-channel-web-chat/**.md` 추가
- [x] W3(codebase): `spec-frontmatter-parse.ts` INCLUDE_PREFIXES 동기 → frontend 가드 4 files/842 tests 통과
- [x] W5(codebase): `codebase/backend/.env.example` 에 `WEB_CHAT_WIDGET_ORIGINS=`(CORS 섹션 배치, 말미충돌 회피)

## 섹션4 — show/hide/updateProfile (사용자 결정: 본 PR 에 포함)
- [x] 설계: `1-widget-app §2/§3.2`(가시성 visible/hidden 축 + updateProfile 소급불가 + blocked 분리) + R5
- [x] 구현(developer): `use-widget` onCommand `show`/`hide`/`updateProfile` + reducer `hidden`(SHOW/HIDE) +
  `widget-app` 렌더 게이트 + 테스트(reducer 3 + 명령 3). channel-web-chat unit 134/134
- [x] TEST + REVIEW WORKFLOW(섹션2·4) — /ai-review(10_10_09) RISK MEDIUM, Critical 0, Warning 12(전부 spec
  SoT/cross-ref/plan 정제, 코드 지적 0) → 수동 조치 + RESOLUTION. lint·unit 134·frontend 가드 843 통과
