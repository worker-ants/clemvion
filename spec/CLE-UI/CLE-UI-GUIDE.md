---
id: "CLE-UI-GUIDE"
title: "사용자 가이드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-GUIDE-001", "REQ-GUIDE-002", "REQ-GUIDE-003", "REQ-GUIDE-004", "REQ-GUIDE-005", "REQ-GUIDE-006", "REQ-GUIDE-007", "REQ-GUIDE-008", "REQ-GUIDE-009", "REQ-GUIDE-010", "REQ-GUIDE-011", "REQ-GUIDE-012", "REQ-GUIDE-013", "REQ-GUIDE-014", "REQ-GUIDE-015", "REQ-GUIDE-016", "REQ-GUIDE-017", "REQ-GUIDE-018", "REQ-GUIDE-019", "REQ-GUIDE-020", "REQ-GUIDE-021", "REQ-GUIDE-022", "REQ-GUIDE-023", "REQ-GUIDE-024", "REQ-GUIDE-025", "REQ-GUIDE-026", "REQ-GUIDE-027", "REQ-GUIDE-028", "REQ-GUIDE-029", "REQ-GUIDE-030", "REQ-GUIDE-031", "REQ-GUIDE-032", "REQ-GUIDE-033"]
basis_superseded: false
parent: "CLE-UI"
ancestors: ["CLE-VISION", "CLE-UI"]
area: "CLE-UI"
content_hash: "e8640abfceebab54907c2fbca67ae665844fa9b874da8162b9ac3e5defb7ece9"
read_as: "approved_fallback"
task: "CLE-T-BDRZVX"
source_paths: ["spec/2-navigation/13-user-guide.md", "spec/2-navigation/_product-overview.md"]
mirror_sha256: "d8094b93ab6d578191be82372b88c5813661d96a7894a35665d2994e6d8adefe"
etag: "sha256-e2aaa9ee2af0c32b7daaa1fbc10d09bc5ca549b681140521c63cf89f47ebd688"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/13-user-guide.md` (전체), `spec/2-navigation/_product-overview.md` (§3.11 User Guide) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

사용자 가이드(User Guide, `/docs`)는 화면만으로 알기 어려운 개념을 제품 안에서 안내하는 설명서다. 워크플로우 구조, 노드 종류, 표현식 언어, 실행과 디버깅, 통합과 설정 같은 내용을 다룬다. 별도 외부 문서 사이트가 아니라 앱 안의 `/docs` 경로로 제공해, 에디터 작업 중에도 흐름을 끊지 않고 바로 볼 수 있게 한다. 노드 설정 폼의 필드 도움말과 빈 캔버스의 시작 안내가 가이드의 해당 절로 딥링크된다.

이 문서는 가이드의 정보 구조, 라우트, 파일 형식, 탐색 생성, 접근과 표시, 빌드 검증을 정한다.

범위 밖:

- 가이드 문체·용어·로케일 형제 파일 규약과 동반 갱신 의무는 [다국어와 화면 문구](CLE-UI-I18N.md) 가 정한다.
- 가이드가 약속한 화면·API 가 코드에 있는지 빌드에서 확인하는 `ImplAnchor` 규약은 [사용자 가이드 근거 규약](../CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md) 이 정한다.
- 전역 사이드바는 [레이아웃과 내비게이션](CLE-UI-LAYOUT.md) 이 정한다.

## 요구사항

### 제공과 진입

- REQ-GUIDE-001 WHEN 사용자가 `/docs` 아래 가이드 페이지를 열면 THE SYSTEM SHALL 섹션 탐색과 본문의 2단 레이아웃으로 보인다. (원본: NAV-UG-01)
- REQ-GUIDE-002 WHEN 가이드를 구성하면 THE SYSTEM SHALL "시작하기 · 노드 · 워크플로우 에디터 · 표현식 · 실행/디버깅 · 통합/설정 · 워크스페이스와 팀 · FAQ" 섹션으로 나눈다. (원본: NAV-UG-02)
- REQ-GUIDE-003 WHEN 사용자가 노드 설정 폼 필드 옆 `?` 아이콘을 누르면 THE SYSTEM SHALL 팝오버로 짧은 설명과 가이드 딥링크를 보인다. (원본: NAV-UG-03)
- REQ-GUIDE-004 WHEN 새 워크플로우의 캔버스가 비어 있으면 THE SYSTEM SHALL 가이드 딥링크가 든 "시작하기" 빈 상태 카드를 보인다. (원본: NAV-UG-04)
- REQ-GUIDE-005 WHEN 로그인한 사용자가 사이드바를 보면 THE SYSTEM SHALL 역할과 상관없이 사용자 가이드 메뉴를 보인다. (원본: NAV-UG-05, 13 §10)
- REQ-GUIDE-006 WHEN 사용자가 에디터에서 가이드 링크를 누르면 THE SYSTEM SHALL 작업 맥락을 지키도록 새 탭(`target="_blank"`)으로 연다. (원본: NAV-UG-06, 13 §6)
- REQ-GUIDE-007 WHEN 사용자가 가이드 안에서 검색하면 THE SYSTEM SHALL `fuse.js` 기반 클라이언트 검색 결과를 보인다. (원본: NAV-UG-07)
- REQ-GUIDE-008 WHEN 사용자가 ⌘K 를 누르면 THE SYSTEM SHALL 가이드 검색창에 포커스한다. (원본: NAV-UG-07)
- REQ-GUIDE-009 WHILE 사용자가 로그인하지 않은 동안 THE SYSTEM SHALL 가이드를 보이지 않는다. (원본: 13 §10)

### 언어

- REQ-GUIDE-010 WHEN 가이드 페이지를 제공하면 THE SYSTEM SHALL 한국어(`ko`, 기본 locale)와 영어(`en`) 두 언어로 제공한다. (원본: 13 §1)
- REQ-GUIDE-011 IF `en` 으로 요청한 페이지에 영어 파일(`<slug>.en.mdx`)이 없으면 THE SYSTEM SHALL 한국어 본문으로 폴백하고 `DocBodyNotice` 로 폴백 사실을 알린다. (원본: 13 §1)
- REQ-GUIDE-012 WHEN `en` locale 로 페이지를 그리면 THE SYSTEM SHALL `title_en`·`summary_en` 이 있으면 쓰고 없으면 `title`·`summary` 로 폴백한다. (원본: 13 §4)

### 라우트

- REQ-GUIDE-013 WHEN `/docs/<locale>/<section>/<slug>` 를 요청하면 THE SYSTEM SHALL 첫 세그먼트를 locale 로 떼고 나머지를 파일 경로에 1:1 로 맞춰 MDX 를 그린다. (원본: 13 §3)
- REQ-GUIDE-014 WHEN 첫 세그먼트가 locale 이 아닌 옛 북마크 경로를 요청하면 THE SYSTEM SHALL 쿠키 locale(없으면 기본 locale)을 앞에 붙인 `/docs/<locale>/...` 로 리다이렉트한다. (원본: 13 §3)
- REQ-GUIDE-015 IF 첫 세그먼트가 locale 인데 세그먼트가 모자라거나 없는 슬러그이면 THE SYSTEM SHALL `notFound()` 로 404 를 보인다. (원본: 13 §3)
- REQ-GUIDE-016 WHEN `/docs` 를 요청하면 THE SYSTEM SHALL 첫 섹션의 첫 페이지로 리다이렉트한다. (원본: 13 §3)

### 탐색과 섹션

- REQ-GUIDE-017 WHEN 빌드하면 THE SYSTEM SHALL `codebase/frontend/src/content/docs/**/*.mdx` 를 스캔해 섹션 트리를 만든다. (원본: 13 §9)
- REQ-GUIDE-018 WHEN 탐색 트리를 만들면 THE SYSTEM SHALL 기본 locale 파일(`<slug>.mdx`)만 스캔하고 locale 형제 파일은 뺀다. (원본: 13 §2)
- REQ-GUIDE-019 IF 파일이나 디렉터리 이름이 `_` 로 시작하면 THE SYSTEM SHALL 스캔에서 뺀다. (원본: 13 §9)
- REQ-GUIDE-020 IF 프론트매터가 `draft: true` 이면 THE SYSTEM SHALL production 빌드에서 그 파일을 뺀다. (원본: 13 §4, §9)
- REQ-GUIDE-021 IF 섹션 디렉터리에 `index.mdx` 가 있으면 THE SYSTEM SHALL 그 파일을 섹션 랜딩 페이지로 쓴다. (원본: 13 §9)
- REQ-GUIDE-022 WHEN 사이드바 섹션 순서를 정하면 THE SYSTEM SHALL 섹션 디렉터리 이름의 숫자 접두 순서를 따르고, 섹션 안 페이지는 `order` 순서를 따른다. (원본: 13 §5)
- REQ-GUIDE-023 WHEN 섹션을 그리면 THE SYSTEM SHALL FAQ 섹션(`99-faq`)을 늘 맨 아래에 둔다. (원본: 13 §5)

### 딥링크

- REQ-GUIDE-024 WHEN 코드에 가이드 딥링크 상수를 두면 THE SYSTEM SHALL locale 접두 없는 `/docs/<dir>/<slug>` 형태로 저장한다. (원본: 13 §6)
- REQ-GUIDE-025 WHEN 딥링크를 그리면 THE SYSTEM SHALL `localizedDocsHref(slug, locale)` 로 현재 locale 접두를 붙인다. (원본: 13 §6)
- REQ-GUIDE-026 WHEN 가이드 페이지를 그리면 THE SYSTEM SHALL 제목마다 `rehype-slug` 로 앵커를 만든다. (원본: 13 §6)
- REQ-GUIDE-027 WHEN 사용자가 가이드 안에서 다른 가이드 페이지 링크를 누르면 THE SYSTEM SHALL 같은 탭에서 이동한다. (원본: 13 §6)

### 표시와 성능

- REQ-GUIDE-028 WHEN 가이드를 그리면 THE SYSTEM SHALL 데스크톱 사이드바와 모바일 상세 드로어 양쪽에 같은 검색(`DocsSearch`)을 보인다. (원본: 13 §10)
- REQ-GUIDE-029 WHILE 뷰포트 너비가 1024px(lg) 미만인 동안 THE SYSTEM SHALL 본문 위 고정 토글 버튼으로 가이드 사이드바와 검색이 든 상세 드로어를 연다. (원본: 13 §10)
- REQ-GUIDE-030 WHEN 가이드 페이지를 빌드하면 THE SYSTEM SHALL 서버 컴포넌트에서 MDX 를 정적으로 불러와 HTML 을 미리 만든다. (원본: 13 §11)
- REQ-GUIDE-031 WHEN 클라이언트 컴포넌트(`'use client'`)를 작성하면 THE SYSTEM SHALL `@/content/**` 를 불러오지 않아 MDX 컴파일러와 `fs` 접근을 서버에만 둔다. (원본: 13 §11)

### 검증

- REQ-GUIDE-032 WHEN 빌드 테스트를 돌리면 THE SYSTEM SHALL 모든 MDX 프론트매터의 `spec:` 키가 가리키는 스펙의 미러 파일과 `code:` 경로가 실제로 있는지, 영어 형제 파일에 프론트매터가 없는지 확인한다. (원본: 13 §11, §12)
- REQ-GUIDE-033 WHEN 배포 전 품질 점검을 하면 THE SYSTEM SHALL 내부 `/docs/...` 링크가 실제 슬러그를 가리키는지와 `FieldHelp` 딥링크 앵커가 있는지 확인한다. (원본: 13 §12)

## 정보 구조

아래는 기본 locale(한국어) 페이지 목록이다. 페이지마다 같은 디렉터리에 영어 형제 파일(`<slug>.en.mdx`)을 둘 수 있다. 사이드바 항목 수는 기본 locale 페이지 수와 같다.

| 섹션 디렉터리 | 페이지(슬러그 — 내용) |
| --- | --- |
| `01-getting-started` | `what-is-this` — 제품 소개 · `ui-tour` — 화면 구성 · `first-workflow` — 첫 워크플로우 만들기 |
| `02-nodes` | `overview` — 노드 개념 · `triggers` · `logic` · `flow` · `data` · `ai` · `integrations` · `presentation` — 카테고리별 노드 |
| `03-workflow-editor` | `overview` — 에디터 개요(화면 구성·진입과 이탈·저장 모델·하위 페이지 목록) · `canvas-basics` — 캔버스 다루기(뷰포트·팔레트·노드 추가·미니맵) · `editing-nodes` — 노드 편집과 정리(선택·이동·복제·삭제·비활성화·상태 표시) · `connecting-nodes` — 노드 연결하기(포트·연결선 유효성·색상·낡은 연결 정리) · `settings-panel` — 노드 설정 패널(필드·표현식·JSON 모드·Use Default Output) · `containers-and-tools` — 컨테이너와 AI 에이전트 도구(그룹·중첩·설정 패널 기반 도구 연결) · `saving-and-sharing` — 저장·자동 저장·가져오기와 내보내기 · `keyboard-shortcuts` — 단축키 · `ai-assistant` — AI 어시스턴트 개요(UI·대화 루프·도구·세션·v1 한계·오류) · `ai-assistant-walkthrough` — AI 어시스턴트 직접 써 보기(자연어로 4노드 워크플로우 만들기) |
| `04-expression-language` | `basics` — 표현식 기본 · `variables-and-context` — 변수와 컨텍스트 · `cheatsheet` — 요약 |
| `05-run-and-debug` | `running-a-workflow` — 실행 방법 · `run-results` — 실행 내역 조회 · `error-handling` — 에러 처리 정책 · `version-history` — 버전 기록 · `validation-errors` — 그래프 검증 오류(저장 거부·경고) |
| `06-integrations-and-config` | `integration-management` — 통합 관리 · `models` — 모델 설정(Chat·Embedding·Rerank) · `knowledge-base` — 지식 저장소 · `mcp-servers` — MCP 서버 통합 · `cafe24` · `discord` · `slack` · `telegram` · `makeshop` — 채널·서비스 연동 · `web-chat` — 웹채팅 위젯 · `web-chat-sdk` — 웹채팅 SDK 직접 통합 · `agent-memory` — 에이전트 메모리 |
| `07-workspace-and-team` | `workspaces-and-members` — 개인·팀 워크스페이스, 멤버 초대, 공유 표시 · `security-2fa` — 2단계 인증(TOTP·Passkey) · `system-status` — 시스템 상태 · `password-and-sessions` — 비밀번호 변경과 세션 관리 |
| `99-faq` | `faq` — 자주 묻는 질문. 늘 사이드바 맨 아래 |

## 라우트

`/docs/[...slug]` 하나가 모든 가이드 URL 을 처리한다. 첫 세그먼트는 locale(`ko`·`en`)이고 나머지가 기본 파일 경로(섹션 + 페이지)다. 그래서 정상 URL 은 `/docs/<locale>/<section>/<slug>` 로 세그먼트가 최소 셋이다(`parseDocsRoute`, `route.ts`). 지원 locale 과 기본 locale 은 `codebase/frontend/src/lib/i18n/types.ts` 의 `LOCALES`(`["ko", "en"]`)와 `DEFAULT_LOCALE`(`ko`)이 기준이다.

| 경로 | 동작 |
| --- | --- |
| `/docs/<locale>/<section>/<slug>` | MDX 를 그린다. 예: `/docs/ko/02-nodes/ai` → `content/docs/02-nodes/ai.mdx`, `/docs/en/02-nodes/ai` → `content/docs/02-nodes/ai.en.mdx`. 영어 파일이 없으면 한국어 본문으로 폴백한다 |
| 첫 세그먼트가 locale 이 아닌 경로(옛 북마크) | 쿠키 locale(없으면 `DEFAULT_LOCALE`)을 앞에 붙여 `/docs/<locale>/...` 로 리다이렉트한다(`page.tsx`) |
| 첫 세그먼트가 locale 이지만 세그먼트가 모자라거나 없는 슬러그 | `notFound()` 로 표준 404 |
| `/docs` | 허브 경로다. 현재 구현은 섹션 카드를 그리지 않고 첫 섹션의 첫 페이지로 리다이렉트만 한다(`docs/page.tsx`). 페이지가 하나도 없으면 폴백 경로로 보낸다 |

`/docs` 는 워크스페이스와 무관해 슬러그(`/w/<slug>`) 밖에 둔다([레이아웃과 내비게이션](CLE-UI-LAYOUT.md)).

## 파일 형식

### 프론트매터

모든 MDX 파일 맨 위에 YAML 프론트매터를 둔다. 영어 형제 파일은 프론트매터 없이 본문만 둔다([다국어와 화면 문구](CLE-UI-I18N.md)).

| 키 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `title` | 필수 | string | 페이지 제목(기본 locale). 사이드바와 본문 H1 에 쓴다 |
| `title_en` | 선택 | string | 영어 제목. `en` 으로 그릴 때 먼저 쓰고, 없으면 `title` 로 폴백한다(`locale.ts` `localizedTitle`) |
| `section` | 필수 | string | 섹션 키(예: `02-nodes`). 디렉터리 이름과 같다 |
| `order` | 필수 | number | 섹션 안 정렬 기준 |
| `summary` | 필수 | string | 사이드바 미리보기와 OG 설명(기본 locale) |
| `summary_en` | 선택 | string | 영어 요약. 없으면 `summary` 로 폴백한다(`locale.ts` `localizedSummary`) |
| `spec` | 선택 | string[] | 1차 원천 스펙의 NERV 키(예: `CLE-WF-EDITOR`). 저장소에서는 미러 `spec/<영역 키>/<KEY>.md`(영역 밖 문서는 `spec/<KEY>.md`)로 읽는다 |
| `code` | 선택 | string[] | 검증에 쓸 코드 경로(파일이나 디렉터리. glob 은 쓰지 않는다) |
| `draft` | 선택 | boolean | `true` 면 production 빌드에서 뺀다 |

예시:

```yaml
---
title: "AI 노드"
section: "02-nodes"
order: 6
summary: "자연어 처리·분류·추출 노드의 사용법을 알아봐요."
spec: ["CLE-NODE-AI-COMMON", "CLE-AI-LLM"]
code: ["codebase/backend/src/nodes/ai", "codebase/frontend/src/components/editor/settings-panel/auto-form/schema-form.tsx"]
---
```

### 섹션 순서와 라벨

섹션 디렉터리 이름의 숫자 접두(`01-`, `02-` …)가 사이드바 순서를 정하고, 섹션 안 순서는 `order` 가 정한다. FAQ 는 늘 맨 아래다. 새 섹션이 `08-`, `09-` … 로 늘어나도 FAQ 가 아래에 남도록 FAQ 디렉터리에는 `99-faq` 처럼 충분히 큰 숫자를 쓴다.

새 섹션 디렉터리를 더하면 섹션 라벨을 두 곳에 등록한다. `codebase/frontend/src/lib/docs/registry.ts` 의 `SECTION_LABELS` 와 `codebase/frontend/src/lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE`(두 locale 모두)다. 뒤쪽의 등록 누락은 테스트가 막는다([다국어와 화면 문구](CLE-UI-I18N.md)).

### 딥링크

- 코드의 딥링크 상수(`lib/docs/links.ts` 의 `DOCS`)는 locale 접두가 없는 `/docs/<dir>/<slug>` 로 저장한다. 실제 이동 URL 은 그릴 때 `localizedDocsHref(slug, locale)` 로 현재 locale 을 붙여 `/docs/<locale>/<dir>/<slug>` 로 만든다(`lib/docs/locale.ts`).
- 사이드바 탐색, 빈 상태 카드, 필드 도움말(`FieldHelp`), 가이드 페이지 사이 링크가 모두 이 규칙을 따른다.
- 페이지 안 앵커는 `rehype-slug` 가 제목 텍스트를 슬러그로 바꿔 만든다(예: `/docs/<locale>/02-nodes/ai#fallback`).
- 에디터에서 가이드로 가는 링크는 새 탭으로 연다. 가이드 사이 링크는 같은 탭 이동(`<Link>`)이다.

### 공용 MDX 컴포넌트

| 컴포넌트 | 쓰임 |
| --- | --- |
| `<Steps>` | 순서형 안내. 자식은 `<li>` |
| `<FieldTable>` | 필드 표. 열은 이름·필수·타입·설명·기본값 |
| `<Callout type="note\|tip\|warn">` | 강조 상자 |
| `<Example>` | 코드·표현식 예시. 언어 태그 필수 |
| `<ImplAnchor>` | 가이드 본문이 약속한 화면·API 가 코드에 있는지 빌드에서 확인하는 앵커. 사용자 화면에는 보이지 않는다. props 는 `kind`(`ui-entry`·`component`·`api-endpoint`·`e2e-scenario`), `file`(저장소 루트 기준 상대 경로), `symbol`(검색 대상), `describes` 다. `kind="api-endpoint"` 는 NestJS 라우트 데코레이터(`@Post`·`@Get`·`@Put`·`@Patch`·`@Delete`)와 `describes` 의 `METHOD /path` 가 컨트롤러 파일에 있는지도 확인한다. 규약은 [사용자 가이드 근거 규약](../CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md), 가드는 `impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts` 다 |

## 작성 정책

| 항목 | 규칙 |
| --- | --- |
| 독자 | 비개발자와 개발자 모두. 페이지마다 "랜딩 → 상세 → 팁·참고" 3층 구조로 쓴다 |
| 문체 | 정중한 해요체. 세부 원칙은 가이드 용어집(`codebase/frontend/src/content/docs/_glossary.md`)과 [다국어와 화면 문구](CLE-UI-I18N.md) |
| 원천 | 스펙 문서를 1차 원천으로 다시 쓴다. 필드 이름은 `codebase/backend/src/nodes/**` 스키마와 `codebase/frontend/src/components/editor/settings-panel/node-configs/*` 로 확인한다 |
| 이미지 | 텍스트·코드 예시를 먼저 쓴다. 스크린샷은 후속 작업이다 |
| 예시 표현식 | `{{ ... }}` 문법. `@workflow/expression-engine` 이 파싱할 수 있어야 한다 |

## 접근과 표시

| 항목 | 규칙 |
| --- | --- |
| 사이드바 메뉴 | 로그인한 모든 사용자에게 보인다(역할 제한 없음) |
| 비로그인 | 지금은 로그인이 필요하다(`(main)` 그룹이 보호한다). 나중에 공개 경로로 나눌 수 있다 |
| 검색 | `DocsSearch`. 데스크톱 사이드바와 모바일 상세 드로어에 같은 컴포넌트를 둔다 |
| 모바일 진입 | 1024px(lg) 미만에서 본문 위 고정 토글 버튼을 누르면 왼쪽 상세 드로어(`SlideDrawer`)가 `DocsSidebar` 와 `DocsSearch` 를 같은 컴포넌트로 보인다. 데스크톱 사이드바는 그대로 둔다(`hidden lg:block`). 전역 사이드바와 기준이 다른 이유는 [Rationale](#가이드-사이드바의-반응형-기준이-전역-사이드바와-다른-이유) 에 있다 |
| 인쇄용 CSS | 없다 |

## 빌드와 품질 점검

| 항목 | 기준 |
| --- | --- |
| 렌더 방식 | 서버 컴포넌트에서 MDX 를 정적으로 불러온다. 빌드 때 HTML 을 미리 만든다 |
| 클라이언트 번들 누수 방지 | MDX 컴파일러와 `fs` 접근은 서버 전용이다. `'use client'` 파일에서 `@/content/**` 를 불러오지 않는다 |
| 빌드 검증 | `registry.ts` 단위 테스트가 모든 `spec:` 키의 미러 파일(`spec/<영역 키>/<KEY>.md`)과 `code:` 경로가 있는지, 영어 형제 파일에 프론트매터가 없는지 확인한다. 미러는 구현할 때 받은 문서만 담으므로, 미러에 없는 키를 새로 적으면 같은 PR 에서 그 문서를 미러로 받는다. 미러에 넣지 않는 카탈로그 영역(`CLE-C24` · `CLE-MKS`)의 키는 테스트가 따로 둔 목록으로 확인한다 |

배포 전에는 다음을 점검한다.

- 모든 MDX 프론트매터의 `spec:` 키와 `code:` 경로가 있는가
- 용어 사전의 금지어를 쓰지 않았는가
- 내부 `/docs/...` 링크가 모두 실제 슬러그인가
- `FieldHelp` 딥링크 앵커가 있는가
- 페이지마다 3층 구조를 지켰는가
- 해요체가 일관적인가

## 구현 위치

- `codebase/frontend/src/app/(main)/docs/layout.tsx`
- `codebase/frontend/src/app/(main)/docs/page.tsx`
- `codebase/frontend/src/app/(main)/docs/[...slug]/page.tsx`
- `codebase/frontend/src/mdx-components.tsx`
- `codebase/frontend/src/lib/docs/registry.ts`
- `codebase/frontend/src/lib/docs/locale.ts`
- `codebase/frontend/src/lib/docs/route.ts`
- `codebase/frontend/src/lib/docs/links.ts`
- `codebase/frontend/src/lib/i18n/**`
- `codebase/frontend/src/components/docs/**`

## Rationale

### 가이드 사이드바의 반응형 기준이 전역 사이드바와 다른 이유

전역 사이드바는 1280px 미만에서 햄버거로 바뀐다([레이아웃과 내비게이션](CLE-UI-LAYOUT.md)). 가이드 안의 사이드바는 본문 안의 보조 탐색이라 1024px(lg)까지는 본문 옆에 자리가 넉넉하다. 모든 화면에 걸친 틀과 페이지 안 탐색은 맥락이 달라 기준도 따로 둔다. 두 사이드바가 같은 너비에서 동시에 햄버거로 바뀔 필요는 없다.

### 섹션 라벨 등록처를 두 곳 모두 적는 이유

코드에는 `registry.ts` 의 `SECTION_LABELS` 와 `locale.ts` 의 `SECTION_LABELS_BY_LOCALE` 두 표가 있고, 새 섹션은 두 곳 모두에 등록해야 한다. 옛 문서는 가이드 명세가 앞의 것만, 다국어 규약이 뒤의 것만 적어서 어느 문서를 따라도 한 곳을 빠뜨렸다. 이 문서와 [다국어와 화면 문구](CLE-UI-I18N.md) 는 두 등록처를 함께 적는다.

### 프론트매터 `spec:` 에 NERV 키를 쓰는 이유

스펙의 정본이 NERV 로 옮겨 가면서(2026-10-01) 저장소의 옛 스펙 경로(`spec/<번호>-<영역>/…`)는 동결됐고 정본 전환 마지막 단계에서 지운다. 가이드가 옛 경로를 계속 적으면 그때 모두 끊긴다. NERV 키는 문서가 트리 안에서 자리를 옮겨도 바뀌지 않고, 저장소 미러 파일 이름이 키라서 빌드 테스트가 그대로 확인할 수 있다. 옛 문서 하나가 여러 NERV 문서로 나뉜 경우가 많아서 키는 옛 경로를 기계적으로 옮기지 않고 페이지가 다루는 내용에 맞는 문서를 고른다(2026-10-02, NERV 정본 전환 단계 4b).

미러에 넣지 않는 카탈로그 영역(`CLE-C24` · `CLE-MKS`)의 키는 파일로 확인할 수 없어서 테스트가 둔 이름 목록으로만 확인한다. 그 키가 NERV 에 실제로 있는지는 빌드가 보지 않는다. 카탈로그를 미러에서 뺀 결정(정본 전환 단계 4a)을 따르면서 생긴 약화다.

### 영어 형제 파일에 프론트매터를 두지 않는 이유

영어 형제 파일은 본문만 둔다는 규칙은 [다국어와 화면 문구](CLE-UI-I18N.md) 규칙 6 이 정한다. 규칙은 전부터 있었지만 가드가 없어서 프론트매터를 붙인 영어 파일 5편이 남아 있었다. 그 프론트매터는 렌더와 검색에 쓰이지 않았고 `spec:`·`code:` 도 검증 밖이라 낡아도 알 수 없었다. 프론트매터를 지우고 빌드 테스트가 다시 생기지 않게 막는다(2026-10-02, NERV 정본 전환 단계 4b).
