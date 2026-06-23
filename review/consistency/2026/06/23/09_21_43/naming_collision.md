# 신규 식별자 충돌 분석 — `spec/7-channel-web-chat/` (impl-prep)

## 발견사항

### [INFO] NAV-WC-01 ~ NAV-WC-06 — 신규 요구사항 ID, 기존 충돌 없음
- target 신규 식별자: `NAV-WC-01` ~ `NAV-WC-06` (`spec/2-navigation/_product-overview.md` §3.14 신설)
- 기존 사용처: 기존 navigation product-overview 에 사용 중인 namespace는 `NAV-WF-*`, `NAV-TR-*`, `NAV-SC-*`, `NAV-IN-*`, `NAV-KB-*`, `NAV-AM-*` 등으로 `NAV-WC-*` 는 미사용
- 상세: 충돌 없음. `WC` = Web Chat 으로 명확하게 구분되는 신규 namespace.
- 제안: 없음.

### [INFO] spec 문서 ID `web-chat-admin-console` — 기존 충돌 없음
- target 신규 식별자: `id: web-chat-admin-console` (`spec/7-channel-web-chat/5-admin-console.md` frontmatter)
- 기존 사용처: 전체 `spec/` 트리에서 `web-chat-admin-console` ID 를 가진 문서 없음. 기존 7-channel-web-chat 내 IDs는 `web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security` 이며 패턴 일관.
- 상세: 충돌 없음.
- 제안: 없음.

### [INFO] ENV 키 `NEXT_PUBLIC_WIDGET_CDN_BASE` — 신규, 기존 코드 미존재
- target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` (admin 프론트엔드용 선택 env, `0-architecture.md` §4 / `5-admin-console.md` §5·§R4)
- 기존 사용처: `codebase/frontend/.env.example` 에 이 키가 없고, `codebase/frontend/src/` 어디에도 `NEXT_PUBLIC_WIDGET_CDN_BASE` 로 참조하는 코드 미존재. 기존 유사 키 `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_WEBHOOK_BASE_URL` 과 의미가 다름(위젯 CDN origin 전용).
- 상세: 충돌 없음. spec-only 단계이므로 구현 시 `.env.example` 에 추가 필요.
- 제안: 없음.

### [WARNING] `NEXT_PUBLIC_BASE_PATH` 경로 불일치 — spec 와 `.env.example` 간 micro-drift
- target 신규 식별자: `NEXT_PUBLIC_BASE_PATH=/_widget/web-chat/v1/app` (새 `0-architecture.md` §4.1 동봉 빌드 경로)
- 기존 사용처: `codebase/channel-web-chat/.env.example:35` 에 `# NEXT_PUBLIC_BASE_PATH="/web-chat/v1/app"` 로 주석 예시 — `/_widget/` prefix 없는 형태. 동일 변수명의 다른 경로.
- 상세: spec 이 `/_widget/web-chat/v1/app` 로 동봉 경로를 확정했으나, `channel-web-chat/.env.example` 샘플은 `/web-chat/v1/app` (prefix 없음)을 주석으로 안내한다. 구현 시 두 경로 중 어느 쪽인지 혼동될 수 있다. 동봉 빌드 경로는 spec 이 확정하므로 `.env.example` 갱신이 필요하다. 충돌 방향: **같은 ENV 키에 다른 경로 예시** — 구현자가 `.env.example` 만 보고 잘못된 base path 로 빌드할 위험.
- 제안: 구현 착수 전 `codebase/channel-web-chat/.env.example:35` 를 `# NEXT_PUBLIC_BASE_PATH="/_widget/web-chat/v1/app"` 로 갱신해 spec 동봉 경로와 일치시킨다.

### [INFO] i18n 키 `sidebar.webChat` / `lib/i18n/dict/{ko,en}/web-chat.ts` — 신규, 기존 충돌 없음
- target 신규 식별자: `sidebar.webChat` (ko/en sidebar dict), 새 namespace 파일 `web-chat.ts` (`5-admin-console.md` §8)
- 기존 사용처: `codebase/frontend/src/lib/i18n/dict/ko/sidebar.ts` 및 `en/sidebar.ts` 에 `webChat` 키 미존재. 기존 파일 목록(`ko/`, `en/`)에도 `web-chat.ts` 파일 없음.
- 상세: 충돌 없음. 기존 sidebar 키 패턴(`knowledgeBase`, `agentMemory` 등)과 일관된 camelCase.
- 제안: 없음.

### [INFO] URL 경로 `/web-chat` — 신규, 기존 라우트 충돌 없음
- target 신규 식별자: `/web-chat` (admin 프론트엔드 사이드바 라우트, `_layout.md` §2.2 항목 5)
- 기존 사용처: `codebase/frontend/src/app/(main)/` 하위에 `web-chat` 디렉터리 없음. 기존 라우트: `/workflows`, `/triggers`, `/schedules`, `/integrations`, `/knowledge-bases`, `/models`, `/authentication`, `/statistics`, `/system-status`, `/agent-memory`, `/docs`, `/dashboard`, `/profile`.
- 상세: 충돌 없음.
- 제안: 없음.

### [INFO] 사이드바 메뉴 번호 재정렬 (5→13으로 하나씩 밀림) — spec-only 변경, 구현 코드 무관
- target 신규 식별자: `_layout.md` §2.2 메뉴 번호 5(Web Chat 신규)로 Integration 이하 모두 +1 재번호
- 기존 사용처: 사이드바 메뉴 번호는 spec 정렬용 표현이며 코드에서 하드코딩되지 않음(아이콘·경로·레이블이 구현 식별자). 코드 내 메뉴 순서는 컴포넌트 배열 순으로 관리되므로 spec 번호 변경이 코드 식별자 충돌을 유발하지 않는다.
- 상세: 충돌 없음.
- 제안: 없음.

### [INFO] 파일 경로 `spec/7-channel-web-chat/5-admin-console.md` — 신규, 기존 파일 없음
- target 신규 식별자: 파일 경로 `spec/7-channel-web-chat/5-admin-console.md`
- 기존 사용처: `spec/7-channel-web-chat/` 에 `5-admin-console.md` 없음(기존 4까지 존재: `0-architecture`, `1-widget-app`, `2-sdk`, `3-auth-session`, `4-security`). `admin-console` 이라는 이름이 다른 영역에 없음. `spec/2-navigation/` 의 파일들은 숫자 prefix 가 다른 패턴(`0-dashboard`, `1-workflow-list` 등)이며 영역이 분리돼 충돌 없음.
- 상세: 충돌 없음. 기존 `7-` 영역 내 prefix 연번(`0~4` 다음 `5`)과 일관.
- 제안: 없음.

---

## 요약

`spec/7-channel-web-chat/5-admin-console.md` 신설과 이에 따른 `_product-overview.md`, `0-architecture.md`, `spec/2-navigation/_product-overview.md`, `spec/2-navigation/_layout.md`, `spec/0-overview.md` 변경이 도입하는 신규 식별자들 — `web-chat-admin-console` spec ID, `NAV-WC-01~06` 요구사항 ID, `NEXT_PUBLIC_WIDGET_CDN_BASE` ENV 키, `sidebar.webChat` i18n 키, `/web-chat` URL 라우트, `lib/i18n/dict/{ko,en}/web-chat.ts` 파일 — 은 기존 사용처와 의미 충돌이 없다. 단, `NEXT_PUBLIC_BASE_PATH` 의 동봉 경로가 spec(`/_widget/web-chat/v1/app`)과 `channel-web-chat/.env.example` 샘플(`/web-chat/v1/app`) 사이에 미세한 불일치가 있어 구현 착수 전 `.env.example` 동기화가 권장된다. 이는 의미 충돌이 아닌 동일 변수에 대한 경로 표기 차이이므로 WARNING 수준이다.

## 위험도
LOW
