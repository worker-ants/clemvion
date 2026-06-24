---
title: 라이브 미리보기 동봉 위젯 서빙 픽스 (PR #679 후속 hotfix)
worktree: webchat-console-95fe1e
started: 2026-06-24
owner: developer
status: complete
spec_impact:
  - spec/7-channel-web-chat/0-architecture.md
  - spec/2-navigation/10-auth-flow.md
related_spec:
  - spec/7-channel-web-chat/0-architecture.md
  - spec/2-navigation/10-auth-flow.md
---

# 라이브 미리보기 동봉 위젯 서빙 픽스

PR #679(웹채팅 운영 콘솔) 머지 후, 라이브 미리보기 iframe·설치 스니펫이 동봉 위젯 SPA
(`/_widget/web-chat/v1/app/`)를 열지 못해 "라이브 미리보기는 위젯 번들이 동봉된 후 사용할 수 있어요"
fallback 과 iframe 안 "페이지를 찾을 수 없음"이 로컬·운영 모두에서 뜨던 버그 수정. main 기준 별도 브랜치
`claude/web-chat-preview-serve-fix`.

## 원인
- **proxy 미들웨어(`proxy.ts`)**: 위젯 앱 진입 `…/app/`(점 없는 디렉토리 경로)이 `includes(".")` 정적 예외를
  못 타 인증 redirect 대상이 됨 → iframe 이 `/login` 으로 튕김.
- **Next `public/` 서빙**: 디렉토리 index 자동 폴백 미지원 → `…/app/`(디렉토리)가 404.

## 처리 (완료)
- [x] `proxy.ts`: `/_widget/**` 를 인증 예외로(matcher 제외 + 함수 prefix) — 동봉 위젯 정적 번들은 공개
- [x] `next.config.ts`: `/_widget/:seg*/app[/]` → `…/app/index.html` rewrite (디렉토리 폴백 보완)
- [x] `proxy.test.ts`: `/_widget` 통과 + 보호경로 redirect 회귀 가드 (6/6)
- [x] spec: `0-architecture §4.1`(동봉 서빙 라우팅 전제) + `2-navigation/10-auth-flow §7.1`(proxy 제외 목록에 `/_widget`)
- [x] 검증: dev curl 실측(`…/app/?q` → 308 → 200 위젯 index.html, 보호경로 307 `/login` 유지) · frontend lint/build/test(4676) · proxy 6/6
- [x] `/ai-review`(09_47_47) Critical 0, WARNING 4(W4 spec fix·W1/W2 의도된 이중방어 dismiss·W3 e2e defer) + `/consistency-check --impl-done`(09_59_21) BLOCK: NO

## 후속 (defer, 비차단 — RESOLUTION 09_47_47 등록)
- `proxy.ts` JSDoc + 이중방어 의도 주석, `SESSION_COOKIE_NAME` 상수화
- rewrite smoke e2e(위젯 번들 동봉 의존), publicPaths/prefix-overlap 경계 테스트
- `/_widget/**` headers() no-store 제외 → 불변 자산 장기 캐시
