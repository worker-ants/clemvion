# API 계약(API Contract) 리뷰

## 발견사항

없음. 이번 변경은 backend REST API(엔드포인트·요청/응답 스키마·에러 포맷·인증/인가·페이지네이션)를 전혀 건드리지 않는다. 대상 파일 11건은 다음과 같다.

- `codebase/frontend/src/lib/stores/workspace-store.ts` — `setWorkspaces` 폴백 로직을 `resolveFallbackWorkspace` 공용 함수로 위임(DRY 리팩터, 순수 클라이언트 상태관리)
- `codebase/frontend/src/lib/workspace/href.ts` (+ 테스트) — `buildWorkspaceHref` 가 backslash·제어문자(tab/CR/LF)까지 정규화해 open-redirect 우회 클래스를 추가 차단. 이는 프런트엔드 **내부 링크 생성 헬퍼**(`/w/<slug>/...` 클라이언트 경로 문자열 조합)이며 backend API 요청 URL 이 아니다.
- `codebase/frontend/src/lib/workspace/resolve-fallback.ts` — 활성/폴백 워크스페이스 해소 규칙 주석 갱신(코드 로직 자체는 이미 기존 커밋에서 확정, 이번 diff 는 JSDoc 갱신뿐)
- `spec/2-navigation/0-dashboard.md`, `1-workflow-list.md`, `11-error-empty-states.md`, `3-workflow-editor/4-ai-assistant.md`, `5-system/13-replay-rerun.md` — 문서 내 예시 경로를 `/workflows/...` → `/w/<slug>/workflows/...` 로 갱신하는 각주/산문 정정. §3 "API" 표에 나열된 `GET/POST/PATCH /api/workflows`, `POST /api/executions/:id/re-run` 등 실제 backend 엔드포인트 정의는 변경 없음.
- `CHANGELOG.md`, `review/code/.../RESOLUTION.md` — 문서/리뷰 산출물

CHANGELOG 본문이 명시하듯 이번 슬러그 라우팅은 **FE 전용(backend 무변경)** 이며, "URL slug = FE 라우팅 SoT 이며 backend 인가 SoT 가 아니다" — header-first → 토큰 클레임 인가 모델(`X-Workspace-Id` 헤더 첨부)은 그대로 유지된다. `[slug]` 가 무효/비멤버여도 서버 인가 경계는 FE redirect 가 아니라 기존 `RolesGuard` 403 이 그대로 담당한다는 점을 `11-error-empty-states.md` 각주가 명시적으로 재확인하고 있어, API 계약 관점의 인가 모델에는 아무 영향이 없다.

## 요약

이번 커밋(슬러그 라우팅 round-2 warning 조치)은 프런트엔드 라우팅 헬퍼 보안 강화(open-redirect 정규화 확장), 스토어 내부 DRY 리팩터, 그리고 spec 문서의 경로 표기를 `/w/<slug>/...` 로 맞추는 각주 정정으로 구성되며, backend 컨트롤러·DTO·에러 코드·페이지네이션·인증/인가 로직에는 어떤 변경도 없다. API 계약 관점에서 검토할 대상 자체가 없다.

## 위험도

NONE

---

STATUS=success ISSUES=0
