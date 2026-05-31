---
worktree: spec-frontmatter-status-rest-84fe70
started: 2026-05-31
owner: developer
---

# Plan — 전체화면 에러 페이지 5종 구현 (`2-navigation/11-error-empty-states §1`)

> spec frontmatter status 전이(B1–B4)의 사용자 결정 #3 결과: **(a) 구현** 선택.
> `spec/2-navigation/11-error-empty-states.md` 를 `partial` 로 전이하고(§2 빈 상태는 구현 완료,
> §1 에러 페이지는 본 plan 이 인수), 본 plan 완료 시 `implemented` 로 승격한다.

## 배경 / 현황

- `spec/2-navigation/11-error-empty-states.md §1` 은 전체화면 에러 페이지 5종을 약속하나 현재 미구현:
  - App Router 에러 파일 전무 — `app/not-found.tsx` / `app/error.tsx` / `app/global-error.tsx` 부재 → 404 는 Next.js 기본 페이지로 fallback.
  - 401: `auth-provider.tsx` 가 세션 복원 실패 시 `/login?redirect=<원래경로>` 로 보내 **리디렉트만** 충족, 전용 화면 없음.
  - 403 / 500 / 네트워크: 전역 처리 전무 (`lib/api/client.ts` interceptor 는 401 만 분기).
- `§2` 빈 상태는 구현됨 (`components/ui/empty-state.tsx` 공용 컴포넌트, 사용처 7곳) → 본 plan 범위 밖.

## 약속 surface (spec §1.2 / §1.3)

| 종류 | 아이콘 | 제목 | CTA | 동작 |
| --- | --- | --- | --- | --- |
| 401 세션 만료 | 🔒 | 세션이 만료되었습니다 | 다시 로그인 → 로그인 | 현재 로그인 리디렉트로 부분 충족 — 전용 화면 추가 여부는 구현 시 결정 |
| 403 권한 없음 | 🚫 | 접근 권한이 없습니다 | 워크스페이스 목록으로 | interceptor 403 감지 → 표시 |
| 404 페이지 없음 | 🔍 | 페이지를 찾을 수 없습니다 | 대시보드로 이동 | `not-found.tsx` |
| 500 서버 에러 | ⚠️ | 문제가 발생했습니다 | 다시 시도 + 대시보드로 | `error.tsx` / `global-error.tsx` |
| 네트워크 오류 | 📡 | 네트워크에 연결할 수 없습니다 | 다시 시도 | interceptor no-response 감지 → 표시 |

- §1.3: 401 은 사이드바 숨김, 403/404/500/네트워크 는 사이드바 표시.

## 작업 항목

- [ ] 공용 `<ErrorPage variant icon title description actions>` 컴포넌트 (5 variant) — `components/ui/error-page.tsx` (가칭).
- [ ] `app/not-found.tsx` (404), `app/error.tsx` (route-group 500/렌더 throw), `app/global-error.tsx` (루트 폴백).
- [ ] `lib/api/client.ts` interceptor 에 403 / 5xx / 네트워크(no-response, `ECONNABORTED`) 감지 → 에러 페이지 라우팅 또는 에러 바운더리 throw 분기 추가.
- [ ] 401: 현행 `auth-provider` 로그인 리디렉트 유지 + (제품 결정 시) "세션 만료" 전용 화면 표시. i18n 키·문자열(`error.session-expired` 등) 정의.
- [ ] i18n dict (KO/EN) + backend-labels 영향 없음(프론트 전용). 단 in-app 라우트 링크화 컨벤션 준수.
- [ ] 테스트: 각 에러 페이지 렌더 + interceptor 분기 단위 테스트.
- [ ] 완료 시 `spec/2-navigation/11-error-empty-states.md` frontmatter `partial → implemented`, `pending_plans` 제거, 본 plan `git rm`.

## 참고

- Next.js App Router 버전 특수성: 코드 작성 전 `codebase/frontend/node_modules/next/dist/docs/` 의 error/not-found 컨벤션 확인 (AGENTS.md 규약).
- `spec/5-system/3-error-handling.md` (백엔드 에러 envelope) 와 정합 — 프론트는 envelope `code` 로 variant 결정 가능.
