---
worktree: docs-cafe24-urls-iridescent-dove
started: 2026-05-14
owner: developer
---

# 사용자 가이드 cafe24 페이지 — URL → 메뉴/사이트 이름 정정

사용자 보고: 사용자 가이드의 `06-integrations-and-config/cafe24` 페이지에서 메뉴/사이트 이름이 표시돼야 할 자리에 URL 이 그대로 노출되어 있다.

대상 파일:
- `frontend/src/content/docs/06-integrations-and-config/cafe24.mdx`
- `frontend/src/content/docs/06-integrations-and-config/cafe24.en.mdx`

API URL / Redirect URI / 환경변수 등 **사용자가 그대로 입력하는 설정값 리터럴은 유지**한다.

## 작업 체크리스트

### A. 외부 포털 URL `https://developers.cafe24.com` → `[Cafe24 Developers](https://developers.cafe24.com)`

- [x] cafe24.mdx Line 30 (Step 2-(2)-① 로그인)
- [x] cafe24.mdx Line 71 (Step 4 Private 앱 (4)) — 괄호 안 중복 URL 제거하며 통합
- [x] cafe24.mdx Line 158 (FAQ scope 트러블슈팅)
- [x] cafe24.en.mdx Line 30
- [x] cafe24.en.mdx Line 70
- [x] cafe24.en.mdx Line 157

### B. 내부 앱 경로 → 사이드바/버튼 라벨

- [x] cafe24.mdx Line 20 헤딩에서 `` (`/integrations`) `` 꼬리표 제거
- [x] cafe24.mdx Line 24 본문 nav 시퀀스를 `사이드바 **통합** → **+ 통합 추가** → … → Cafe24 통합 생성 폼` 으로 치환
- [x] cafe24.mdx Line 170 FAQ "개발 중인 단계에서도 통합을 등록할 수 있나요?" 의 `` `/integrations` `` → `사이드바 **통합**` (점검 중 발견한 추가 위치)
- [x] cafe24.en.mdx Line 20 헤딩에서 `` (`/integrations`) `` 꼬리표 제거
- [x] cafe24.en.mdx Line 24 본문 nav 시퀀스를 `Sidebar **Integrations** → **+ Add Integration** → … → Cafe24 integration form` 으로 치환

### 검증

- [x] 변경된 두 파일이 표준 마크다운 링크 문법(`[text](url)`)만 사용 — 같은 파일의 기존 `[Cafe24 공식 문서](...)` 와 동일 패턴이라 MDX 빌드 회귀 위험 없음
- [x] grep 으로 `developers.cafe24.com` / `/integrations` 의 남은 등장이 의도된 형태(공식 docs 링크·api 경로·frontmatter·코드 토큰)뿐임을 확인

### Wrap up

- [x] 모든 항목 완료 → `git mv plan/in-progress/docs-cafe24-urls.md plan/complete/docs-cafe24-urls.md`
- [x] 단일 커밋 (브랜치 `claude/docs-cafe24-urls-iridescent-dove`). 원격 push / PR 생성은 사용자 확인 후 진행
