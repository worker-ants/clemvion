---
id: user-guide
status: implemented
code:
  - codebase/frontend/src/app/(main)/docs/layout.tsx
  - codebase/frontend/src/app/(main)/docs/[...slug]/page.tsx
  - codebase/frontend/src/lib/docs/registry.ts
  - codebase/frontend/src/lib/docs/locale.ts
  - codebase/frontend/src/lib/docs/route.ts
  - codebase/frontend/src/lib/docs/links.ts
  - codebase/frontend/src/lib/i18n/**
  - codebase/frontend/src/components/docs/**
---

# Spec: User Guide (`/docs`)

> 관련 문서: [PRD 내비게이션](./_product-overview.md) · [Spec 레이아웃](./_layout.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 캔버스](../3-workflow-editor/0-canvas.md)

---

## 1. 목적

제품의 UI만으로는 파악이 어려운 개념(워크플로우 구조, 노드 종류, 표현식 언어, 실행/디버깅, 연동/설정)을 **제품 내부에서** 안내한다. 별도 외부 문서 사이트 대신 `/docs` 경로로 제공하여 에디터 작업 중 즉시 접근 가능하게 한다.

콘텐츠는 한국어(`ko`, 기본 locale)와 영어(`en`) **이중언어**로 제공한다. 기본 콘텐츠는 한글(`<slug>.mdx`)이며, 영어 번역은 같은 디렉터리의 sibling(`<slug>.en.mdx`)으로 둔다. 지원 locale 목록·기본 locale 은 `codebase/frontend/src/lib/i18n/types.ts` 의 `LOCALES`(`["ko", "en"]`)·`DEFAULT_LOCALE`(`ko`)가 단일 진실원이다. 특정 페이지에 `en` sibling 이 없으면 한국어 본문으로 폴백하고 `DocBodyNotice` 로 폴백 사실을 안내한다(`[...slug]/page.tsx`).

## 2. 정보 구조 (IA)

아래 트리는 **canonical(기본 locale, 한글) 페이지**를 나타낸다. 각 페이지는 같은 디렉터리에 선택적 영어 sibling(`<slug>.en.mdx`)을 가질 수 있다(§1). 내비게이션 트리는 canonical `<slug>.mdx` 만 스캔해 구성하고, locale sibling 은 중복 등록을 막기 위해 스캔에서 제외한다(`registry.ts` `listMdxFiles`·`isLocaleSibling`). 따라서 사이드바 항목 수는 아래 canonical 페이지 수와 같다.

```
/docs
├── 01-getting-started/
│   ├── what-is-this       # 제품 소개
│   ├── ui-tour            # 화면 구성
│   └── first-workflow     # 첫 워크플로우 만들기
├── 02-nodes/
│   ├── overview           # 노드 개념
│   ├── triggers           # Trigger 노드
│   ├── logic              # Logic 노드
│   ├── flow               # Flow 노드
│   ├── data               # Data 노드
│   ├── ai                 # AI 노드
│   ├── integrations       # Integration 노드
│   └── presentation       # Presentation 노드
├── 03-workflow-editor/
│   ├── overview           # AI 어시스턴트 개요 (UI · 대화 루프 · 도구 · 세션 · v1 한계 · 오류)
│   └── walkthrough        # AI 어시스턴트 직접 써 보기 (자연어 → 4-노드 워크플로우)
├── 04-expression-language/
│   ├── basics             # 표현식 기본
│   ├── variables-and-context  # 변수·컨텍스트
│   └── cheatsheet         # 요약 치트시트
├── 05-run-and-debug/
│   ├── running-a-workflow # 실행 방법
│   ├── run-results        # 실행 이력 조회
│   ├── error-handling     # 에러 정책
│   └── version-history    # 버전 히스토리
├── 06-integrations-and-config/
│   ├── integration-management  # 통합 관리
│   ├── llm-config             # LLM 설정
│   ├── knowledge-base         # 지식 저장소
│   ├── mcp-servers            # MCP 서버 통합 (AI Agent 도구 호출용)
│   ├── cafe24                 # Cafe24 채널 연동
│   ├── discord                # Discord 채널 연동
│   ├── slack                  # Slack 채널 연동
│   ├── telegram               # Telegram 채널 연동
│   └── web-chat               # 임베드형 웹채팅 위젯 연동
├── 07-workspace-and-team/
│   └── workspaces-and-members  # 개인·팀 워크스페이스, 멤버 초대, 공유 표시
└── 99-faq/                     # 항상 사이드바 맨 아래 (§5 규칙)
    └── faq
```

## 3. 라우트

단일 catch-all `/docs/[...slug]` 라우트가 모든 문서 URL 을 처리한다. **slug 의 첫 세그먼트는 locale**(`ko`|`en`)로 해석하고, 나머지가 canonical 파일 경로(섹션 + 페이지)에 매핑된다. 즉 정상 URL 은 `/docs/<locale>/<section>/<slug>` 형태로 **최소 3 세그먼트**다 (`parseDocsRoute`, `route.ts`).

| 경로 | 동작 |
| --- | --- |
| `/docs/<locale>/<section>/<slug>` | 동적 MDX 렌더링. 첫 세그먼트(locale) 를 제거한 나머지가 파일 경로와 1:1 (예: `/docs/ko/02-nodes/ai` → canonical `content/docs/02-nodes/ai.mdx`, `/docs/en/02-nodes/ai` → 번역 sibling `content/docs/02-nodes/ai.en.mdx`, sibling 부재 시 한글 본문 폴백) |
| 첫 세그먼트가 locale 이 아닌 경로 (레거시 북마크) | 쿠키 locale(없으면 `DEFAULT_LOCALE`) 을 프리픽스로 붙여 `/docs/<locale>/...` 로 `redirect` (`page.tsx`) |
| 첫 세그먼트가 locale 이지만 세그먼트 수 부족·존재하지 않는 슬러그 | `notFound()` 호출 → 표준 404 |
| `/docs` | 허브 페이지 — 섹션 카드/리다이렉트 (`docs/page.tsx`) |

## 4. 프론트매터 스키마

모든 MDX 파일 상단에 아래 YAML 프론트매터를 둔다.

| 키 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `title` | 필수 | string | 페이지 제목(기본 locale=ko). 사이드바와 본문 H1에 사용 |
| `title_en` | 선택 | string | 영어 제목. `en` locale 렌더 시 우선 사용, 없으면 `title` 폴백 (`locale.ts` `localizedTitle`) |
| `section` | 필수 | string | 섹션 키 (예: `02-nodes`) — 디렉터리명과 일치 |
| `order` | 필수 | number | 섹션 내 정렬 기준 |
| `summary` | 필수 | string | 사이드바 미리보기 및 OG 설명(기본 locale=ko) |
| `summary_en` | 선택 | string | 영어 요약. `en` locale 렌더 시 우선 사용, 없으면 `summary` 폴백 (`locale.ts` `localizedSummary`) |
| `spec` | 선택 | string[] | 1차 소스 spec 파일 경로 |
| `code` | 선택 | string[] | 검증에 사용할 코드 경로(glob 허용) |
| `draft` | 선택 | boolean | true면 production 빌드에서 제외 |

예시:

```yaml
---
title: "AI 노드"
section: "02-nodes"
order: 6
summary: "자연어 처리·분류·추출 노드의 사용법을 알아봐요."
spec: ["spec/4-nodes/3-ai/0-common.md", "spec/5-system/7-llm-client.md"]
code: ["codebase/backend/src/nodes/ai/**", "codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx"]
---
```

## 5. 섹션 순서

섹션 디렉터리명의 숫자 프리픽스(`01-`, `02-` ...)가 사이드바 표시 순서를 결정한다. 페이지 내 순서는 `order`로 결정한다.

**FAQ 섹션은 항상 사이드바 맨 아래에 위치한다.** 신규 섹션이 자유롭게 `08-`, `09-` ... 로 늘어나더라도 FAQ 가 아래로 밀려나도록, FAQ 디렉터리는 `99-faq` 와 같이 충분히 큰 숫자 프리픽스를 사용한다. `registry.ts` 의 `SECTION_LABELS` 도 `99-faq` 키로 라벨을 등록한다.

## 6. 딥링크 규약

- 코드 상의 딥링크 **상수**(`lib/docs/links.ts` `DOCS`)는 locale 프리픽스가 없는 **canonical** `/docs/<dir>/<slug>` 형태로 저장한다. 실제 내비게이션 URL 은 렌더 타임에 `localizedDocsHref(slug, locale)` 로 현재 locale 프리픽스를 붙여 `/docs/<locale>/<dir>/<slug>` 로 만든다(`lib/docs/locale.ts`).
- 사이드바 네비·Empty State·FieldHelp·다른 매뉴얼 페이지 간 링크 모두 위 규약(canonical 상수 → locale 프리픽스 부여)을 따른다.
- 페이지 내 앵커는 `rehype-slug`가 헤딩 텍스트를 슬러그화한 값으로 자동 생성한다(예: `/docs/<locale>/02-nodes/ai#fallback`).
- 에디터에서 매뉴얼로 이동하는 링크는 새 탭(`target="_blank"`)으로 열어 작업 맥락을 보존한다.
- 매뉴얼 간 링크는 기본 탭 전환(`<Link>`)을 사용한다.

## 7. 작성 정책

| 항목 | 규칙 |
| --- | --- |
| 독자 | 비기술자 + 개발자 모두. 각 페이지 "랜딩 → 상세 → 팁/참고" 3층 구조 |
| 문체 | 정중한 해요체. 세부 원칙은 [`_glossary.md`](../../codebase/frontend/src/content/docs/_glossary.md) |
| 소스 | `spec/*.md` 를 1차 소스로 재작성. `codebase/backend/src/nodes/**` 스키마와 `codebase/frontend/src/components/editor/settings-panel/node-configs/*` 로 필드명 검증 |
| 이미지 | 텍스트·ASCII·코드 예시 우선. 스크린샷은 후속 작업 |
| 예제 표현식 | `{{ ... }}` 문법. `@workflow/expression-engine`이 파싱 가능한 문법이어야 함 |

## 8. 공용 MDX 컴포넌트

| 컴포넌트 | 용도 |
| --- | --- |
| `<Steps>` | 순서형 가이드. 자식은 `<li>` |
| `<FieldTable>` | 필드 표. 컬럼: 이름·필수·타입·설명·기본값 |
| `<Callout type="note\|tip\|warn">` | 강조 박스 |
| `<Example>` | 코드/표현식 예제. 언어 태그 필수 |
| `<ImplAnchor>` | reverse-evidence 가드용 — 가이드 본문이 약속한 UI/API surface 가 코드에 존재함을 build-time 으로 검증. props: `kind` ∈ `{ui-entry, component, api-endpoint, e2e-scenario}` · `file` (레포 루트 기준 상대경로) · `symbol` (grep 대상) · `describes`. 사용자 view 에서 hidden 렌더. SoT: [`spec/conventions/user-guide-evidence.md`](../conventions/user-guide-evidence.md). 가드: `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts` |

## 9. 네비게이션 생성

빌드타임에 `codebase/frontend/src/lib/docs/registry.ts`가 `codebase/frontend/src/content/docs/**/*.mdx`를 스캔해 섹션 트리를 만든다.

- 프론트매터 `draft: true`인 파일은 production에서 제외
- `_`로 시작하는 파일·디렉터리는 스캔에서 제외(예: `_glossary.md`)
- 섹션 디렉터리에 `index.mdx`가 있으면 해당 섹션의 랜딩 페이지

## 10. 접근·표시

| 항목 | 규칙 |
| --- | --- |
| 사이드바 표시 | 모든 로그인 사용자 (권한 제한 없음) |
| 비로그인 표시 | 현재는 로그인 필수(`(main)` 그룹이 보호됨). 차후 공개 경로로 분리 가능 |
| 검색 | `DocsSearch` 로 제공. 데스크탑 사이드바·모바일 drawer 양쪽에 동일 노출 |
| 모바일 진입 | `< lg(1024px)` 에서 article 상단의 sticky 토글 버튼 → 좌측 `SlideDrawer` 가 `DocsSidebar` + `DocsSearch` 를 동일 컴포넌트로 노출. 데스크탑 사이드바는 그대로(`hidden lg:block`). 글로벌 사이드바와 breakpoint 가 다른 이유는 [Rationale R-1](#r-1-docs-내부-사이드바-breakpoint-가-글로벌--1280px-과-다른-이유) 참조 |
| 인쇄용 CSS | 미포함 |

## 11. 성능

| 항목 | 기준 |
| --- | --- |
| 렌더 방식 | 서버 컴포넌트에서 MDX 정적 import — 빌드 시 HTML 사전 생성 |
| 클라이언트 번들 누수 방지 | MDX 컴파일러·`fs` 접근은 서버 전용. `'use client'` 파일에서 `@/content/**` import 금지 |
| 빌드 시 검증 | `registry.ts` 단위 테스트에서 모든 `spec:`/`code:` 경로 존재 확인 |

## 12. 품질 체크 (배포 전)

- 모든 MDX 프론트매터의 `spec:`/`code:` 경로 실존
- 용어 사전 준수(금지어 검사)
- 모든 내부 `/docs/...` 링크가 실존 slug
- `FieldHelp` 딥링크 앵커가 실존
- 페이지별 3층 구조 준수
- 해요체 일관성

## Rationale

### R-1. /docs 내부 사이드바 breakpoint 가 글로벌 (< 1280px) 과 다른 이유

`spec/2-navigation/_layout.md §2.4` 의 글로벌 사이드바는 1280px 미만에서 햄버거로 전환된다. `/docs` 내부 사이드바는 article 안의 *보조 네비* 라 lg(1024px) 까지는 본문 옆에 자리가 충분히 남는다. 별 컨텍스트 (전역 chrome vs 페이지 내부) 이므로 breakpoint 도 별도. 두 사이드바가 동시에 햄버거로 전환되는 분기점을 일치시킬 필요가 없다.
