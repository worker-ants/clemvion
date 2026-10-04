---
id: "CLE-ENG-GUIDEEVIDENCE"
title: "사용자 가이드 근거 규약"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ENG"
ancestors: ["CLE-VISION", "CLE-ENG"]
area: "CLE-ENG"
content_hash: "8f048364375d7445a62b15e7eaf81124872b5f9ea70db7528616cfd92af446d2"
read_as: "approved_fallback"
task: "CLE-T-RGZBCQ"
source_paths: ["spec/conventions/user-guide-evidence.md"]
mirror_sha256: "fb49c378933775949545fd55496c2d27c80a36791e6c030b936acbf0c75ce772"
etag: "sha256-925a1f49c4eef99b53162bcd2eb60f29fe72ac1d95cb805375ea65f381ac4a5f"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/user-guide-evidence.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

사용자 가이드 본문이 약속한 UI·API 표면이 실제 코드에 있는지를 빌드에서 강제하는 규약이다. 강제 수단은 가이드 근거 앵커(`<ImplAnchor>`) MDX 컴포넌트와 이를 읽는 빌드 가드 3건이다. 텔레그램 채팅 채널 가이드가 GUI 흐름을 약속했는데 프론트엔드 UI 가 없었던 것 같은 가이드 → 코드 방향의 갭을 막는다.

`user-guide-sync-reviewer` 는 코드가 바뀔 때 가이드를 함께 고치게 하는 코드 → 가이드 한 방향 검사다. 이 규약은 그 반대 방향이다.

- 가이드 본문이 "트리거 생성 dialog 의 Chat Channel 체크박스를 켜기" 라고 설명한다.
- 그 체크박스가 코드에 없으면 빌드 시점에 막는다.

`nodes-coverage.test.ts` 가 백엔드 노드 열거에서 가이드 항목의 존재를 강제하듯, 이 규약은 가이드의 GUI 흐름 절에서 코드 앵커의 존재를 강제한다. `nodes-coverage` 패턴을 카테고리(통합, 트리거) 단위로 넓힌 것이다.

범위 밖:

- 가이드의 구조·라우트·공용 MDX 컴포넌트 목록과 빌드 검증은 [사용자 가이드](../CLE-UI/CLE-UI-GUIDE.md) 가 정한다.
- 가이드 문체·금지어·로케일 동등성과 "가이드 낡음" 의 자동 검출 한계는 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 가 정한다.
- 스펙 약속에서 구현 코드 경로로 가는 근거는 [스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) 이 정한다.

## 규칙

1. 통합 가이드(`06-integrations-and-config/<provider>.mdx`)와 트리거 가이드(`02-nodes/triggers.mdx`)의 GUI 흐름 절에는 `<ImplAnchor kind="ui-entry">` 를 1개 이상 둔다.
2. GUI 흐름 절은 제목(h2·h3)에 단어 `GUI` 가 있거나 절 본문에 `GUI` 를 포함한 굵은 글씨(`**…GUI…**` / `__…GUI…__`)가 있는 절이다.
3. `<ImplAnchor>` 는 frontmatter 가 아니라 본문 안, 해당 GUI 흐름 절의 바로 앞이나 뒤에 둔다.
4. `file` 은 저장소 루트 기준 상대 경로로 실존해야 한다. `symbol` 은 그 파일 안에 문자열로 있어야 한다.
5. 가이드 본문에 API curl 예시가 있으면 `kind="api-endpoint"` 앵커를 더한다. `describes` 에는 `METHOD /path` 를 적는다.
6. `<ImplAnchor>` 는 사용자 화면에 렌더하지 않는다. 빌드 가드만 읽는다.
7. 개념 설명 절(워크플로우 디자인, 데이터 모델 설명, 표현식 의미 설명 등)은 앵커 대상이 아니다. 이 영역의 낡음은 코드 리뷰와 사람 검수에 맡긴다.
8. 트리거 가이드의 provider 별 절에 앵커가 의무인지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

## `<ImplAnchor>` 컴포넌트

구현 위치는 `codebase/frontend/src/components/docs/mdx/impl-anchor.tsx` 다.

```mdx
<ImplAnchor
  kind="ui-entry"
  file="codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx"
  symbol="chatChannelProvider"
  describes="트리거 목록의 webhook Chat Channel provider 식별자"
/>
```

| Prop | 타입 | 의무 | 뜻 |
| --- | --- | --- | --- |
| `kind` | `"ui-entry" \| "component" \| "api-endpoint" \| "e2e-scenario"` | ✓ | 아래 `kind` 표 참조 |
| `file` | string (저장소 루트 기준 상대 경로) | ✓ | 가드가 실존을 검증한다 |
| `symbol` | string | ✓ | `file` 안에서 찾을 문자열(변수 이름·JSX prop·`data-testid`·함수 이름 등) |
| `describes` | string | ✓ | 가이드 독자용 한 줄 설명 |

### `kind` 값

| 값 | 용도 | 예 |
| --- | --- | --- |
| `ui-entry` | 라우트·페이지 진입점. 사용자가 "여기서 시작" 하는 클릭 가능한 진입점 | 트리거 생성 dialog 의 체크박스, `/integrations/new` 버튼 |
| `component` | 재사용 컴포넌트. 여러 페이지에서 같은 동작 | `ChatChannelCard`, `DynamicForm` |
| `api-endpoint` | controller route. 가이드 본문이 밝힌 API 호출 | `POST /api/triggers/:id/chat-channel/rotate-bot-token` |
| `e2e-scenario` | e2e spec 파일. 가이드가 약속한 시나리오의 회귀 보장 | `test/triggers-chat-channel.e2e-spec.ts` 의 `'should rotate bot token'` |

### 렌더 정책

일반 사용자 화면에는 **렌더하지 않는다**. 구현(`impl-anchor.tsx`)은 `return null` 이라 DOM 출력 자체가 없다. 가이드 본문의 가독성을 지키려는 것이다. 빌드 가드만 이 컴포넌트를 쓴다. dev mode(`?dev=1`)에서 앵커를 보이는 기능은 이 규약 범위 밖의 후속 개선으로 남겨 두었다.

## 빌드 가드 (3건)

모두 `codebase/frontend/src/lib/docs/__tests__/` 에 있다.

| 가드 | 검증 |
| --- | --- |
| `impl-anchor-existence.test.ts` | 모든 `<ImplAnchor>` 의 `kind` 값이 유효하고 `file` 이 실존하고 `symbol` 이 그 파일 안에 부분 문자열로 1번 이상 나온다. `kind="api-endpoint"` 는 NestJS HTTP route 데코레이터(`@Post`/`@Get`/`@Put`/`@Patch`/`@Delete`) 선언과 `describes` 의 `METHOD /path` 경로가 controller 파일에 있는지도 검증한다 |
| `integrations-coverage.test.ts` | `06-integrations-and-config/<provider>.mdx` 의 GUI 흐름 절 안에 `<ImplAnchor kind="ui-entry">` 가 1개 이상 있어야 한다. GUI 흐름 절은 `findGuiFlowSections()` 가 두 신호 중 하나로 가린다. (1) h2·h3 제목 텍스트에 단어 `GUI` 가 있다 (2) 절 본문에 `GUI` 를 포함한 굵은 글씨(`**…GUI…**` / `__…GUI…__`)가 있다 |
| `triggers-coverage.test.ts` | `02-nodes/triggers.mdx`(와 `.en.mdx`)에 **같은 `findGuiFlowSections()`** 를 적용한다. provider 이름으로 절을 찾지 않는다. provider 별 절이라도 위 GUI 신호가 없으면 검사 대상이 아니다 |

현재 구현에는 같은 방향(가이드 → 코드)의 가드가 두 개 더 있다. 가이드가 이름 붙인 에러 코드·환경변수의 실재를 보는 `guide-identifier-existence.test.ts` 와, 모델 설정 가이드의 연결 테스트 실패 문장표가 백엔드 반환 문장과 양방향으로 맞는지 보는 `guide-sanitized-message-parity.test.ts` 다. 두 가드는 이 규약의 가드 표에 없다. [미결 사항](#미결-사항) 참조.

### 다른 가드와의 관계

- **`registry.test.ts`**(가이드 frontmatter `spec:`/`code:` 경로 실존)와는 검증 대상이 직교한다.
  - `registry.test.ts`: frontmatter 메타. 가이드가 **참조하는** 스펙·코드 경로의 실존
  - `impl-anchor-existence.test.ts`: 본문 앵커. 가이드가 **약속한** 코드 심볼의 실존
  - 둘 다 통과해야 가이드가 정합하다. 한쪽이 다른 쪽을 대신하지 않는다.
- **`nodes-coverage.test.ts`** 와는 방향이 같다(등록부 → 가이드). 열거형과 자유 서술형으로 서로 보완한다.
  - `nodes-coverage`: 백엔드 노드 등록부 → 가이드에 항목이 나온다
  - `integrations-coverage` / `triggers-coverage`: 가이드 GUI 흐름 절 → 코드 진입점 심볼
- **`spec-impl-locations.test.ts`**([스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md))와는 방향이 다르다.
  - `spec-impl-locations`: 스펙 → 구현 코드 경로(스펙 본문 `## 구현 위치` 의 경로 실재, 스펙 책임 추적). 전환 단계 5 에서 옛 트리 frontmatter `code:` 를 보던 `spec-code-paths` 를 이 가드로 바꿨다
  - 이 가드: 가이드 → 구현 코드 심볼(가이드 진실성 추적)
  - 두 가드는 "스펙 → 코드" 와 "가이드 → 코드" 의 두 진실을 따로 검증한다.
- **스펙에서 가이드로 가는 링크**는 위 가드들과 방향이 반대다. 옛 스펙 frontmatter `user_guide:` 가 그 선언용 링크였고 빌드 가드가 없었다. 그 필드는 전환 단계 5 에서 옛 트리와 함께 걷었다([스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) R-10 · R-16). 지금 스펙 본문에는 가이드 페이지를 가리키는 고정 필드가 없다. 구현 작업이 가이드를 고쳤다는 근거는 NERV Task 의 증적 종류 `user_guide` 로 남길 수 있다.

## 사용 패턴

### 통합 가이드 (`06-integrations-and-config/<provider>.mdx`)

GUI 흐름 절에는 반드시 `<ImplAnchor kind="ui-entry">` 를 함께 둔다.

```mdx
## 2. 워크플로우 Webhook 트리거에 Chat Channel 설정

**GUI 등록 흐름 (권장)**:

<ImplAnchor
  kind="ui-entry"
  file="codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx"
  symbol="chatChannelProvider"
  describes="트리거 목록의 webhook Chat Channel provider 식별자"
/>

1. 좌측 메뉴 → **Triggers** → 우측 상단 **"+ Webhook 트리거 추가"** 클릭
2. ...
```

### 트리거 가이드 (`02-nodes/triggers.mdx`)

아래 예시는 provider 별 절에도 통합 가이드와 같은 방식으로 앵커를 다는 모습이다. 이 예시 절에는 GUI 신호가 없어 `triggers-coverage` 의 검사 대상이 아니다. provider 별 절의 앵커가 의무인지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

```mdx
### Telegram

<ImplAnchor
  kind="ui-entry"
  file="codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx"
  symbol="ChatChannelCard"
  describes="트리거 상세 drawer 의 Chat Channel 카드"
/>

Telegram 봇 토큰을 등록하면 ...
```

### API 흐름

API curl 예시에는 `kind="api-endpoint"` 를 더한다.

````mdx
```bash
curl -X POST https://<your-host>/api/triggers/<trigger-id>/chat-channel/rotate-bot-token \
  -H 'Authorization: Bearer <your-token>' \
  ...
```

<ImplAnchor
  kind="api-endpoint"
  file="codebase/backend/src/modules/triggers/triggers.controller.ts"
  symbol="rotateBotToken"
  describes="POST /api/triggers/:id/chat-channel/rotate-bot-token"
/>
````

## 강제 경로

이 규약은 다음 경로로 지켜진다. 스펙 쪽 근거는 [스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) 의 `spec-impl-locations` 가 따로 지킨다.

1. **빌드 가드 3건**: CI 에서 막는다(구현됨).
2. **`user-guide-writer` 서브에이전트의 자가 검증 체크리스트**: GUI 흐름 절을 쓸 때 `<ImplAnchor>` 를 함께 두는 의무가 저장소 `.claude/agents/user-guide-writer.md` 의 작성 지침과 완료 체크리스트에 있다(구현됨).
3. **저장소 `PROJECT.md` 의 "유저 가이드 파일 컨벤션 SoT 인덱스"**: 이 규약을 올려 두었다(결정 E-5, 구현됨).

## 가이드 낡음 검출과의 관계

[다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 의 가이드 작성 원칙(Principle 7)은 "페이지 낡음은 자동으로 검출할 수 없다" 고 적는다. 가이드 본문이 코드 변경을 따라가지 못한 상태를 말한다. 이 규약이 그 일부를 채운다.

- **GUI 흐름 절** 안의 약속은 이 가드가 잡는다. 앵커가 코드에 없으면 빌드를 막는다.
- **개념 설명 절**은 여전히 자동으로 검출할 수 없다. Principle 7 이 덮지 못하는 영역으로 남는다.

이 부분 커버 범위는 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 에도 반영돼 있다.

## 미결 사항

- **트리거 가이드의 provider 별 절에 앵커가 의무인가**: 가드 쪽(`triggers-coverage.test.ts`, 이 문서의 [빌드 가드](#빌드-가드-3건) 표)은 GUI 신호가 있는 절만 검사하고 provider 이름으로 절을 찾지 않는다. 이 규약의 [트리거 가이드 예시](#트리거-가이드-02-nodestriggersmdx)는 GUI 신호가 없는 `### Telegram` 절에 앵커를 달면서 provider 별 절도 통합 가이드와 "동일" 하다고 적는다. 저장소 `PROJECT.md` 의 가드 설명은 "`02-nodes/triggers.mdx` 의 provider 별 절에 `<ImplAnchor kind="ui-entry">` ≥1 의무" 라고 적는다. 현재 구현은 가드 쪽과 같다. 지금 `triggers.mdx`·`triggers.en.mdx` 에는 `GUI` 신호가 하나도 없어 `triggers-coverage` 가 검사하는 절이 없다(테스트는 "no GUI section — skip" 으로 통과한다). 가이드에는 `## Chat Channel 연결` 절과 Slack·Discord 설정 절에 앵커가 있고 `### Telegram 설정 방법` 절에는 없다. provider 별 절 전부를 의무로 하려면 가드를 넓히는 결정이 필요하다. 결정 필요.
- **가이드 → 코드 가드 두 개의 등재 위치**: `guide-identifier-existence.test.ts`(가이드가 이름 붙인 에러 코드·환경변수의 실재)와 `guide-sanitized-message-parity.test.ts`(모델 설정 가이드의 실패 문장표와 백엔드 반환 문장의 양방향 일치)는 가이드 → 코드 방향이라 이 규약과 같은 가족이다. 이 규약의 가드 표에는 3건만 있다. 저장소 `PROJECT.md` 는 앞의 가드의 기준 문서를 에러 코드 규약과 에러 처리 문서 §1 로 적고 "`user-guide-evidence.md §2` 표에는 아직 없다" 며 기획자 트래커 대기 중이라고 적는다. 옮기기 전 에러 코드 규약 문서에는 가이드 인용 규칙도 이 가드도 없다(관련: [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)). 두 가드를 이 규약에 올릴지, 다른 문서가 소유할지 결정 필요.

## 구현 위치

- `codebase/frontend/src/components/docs/mdx/impl-anchor.tsx`
- `codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/integrations-coverage.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/triggers-coverage.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/impl-anchor-parse.ts` (`findGuiFlowSections`·`parseImplAnchors`·`collectMdxFiles`)
- `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`, `tree-walk.test.ts` (공유 인프라. 2026-08-11 부터 `impl-anchor-parse.ts` 의 `collectMdxFiles` 가 `walkTree` 를 쓴다. [스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) 과 같은 헬퍼를 공유해 양쪽에 적는다. 한쪽만 보고 이 파일을 고칠 때의 영향을 놓치지 않으려는 것이다)

## Rationale

### R-1. `<ImplAnchor>` 를 렌더하지 않는다 (`return null`)

가이드 본문의 가독성을 지키려는 것이다. 일반 독자가 앵커 메타데이터를 볼 이유가 없다. 앵커는 설명용 콘텐츠가 아니라 검증용 메타다. 구현은 CSS `display: none` 으로 숨기지 않고 `return null` 로 DOM 출력 자체를 내지 않는다(보이는 결과는 같다). 다만 dev mode(URL `?dev=1`)에서 보이게 하면 가이드 작성자와 리뷰어가 앵커가 있는지 눈으로 확인할 수 있어 작성에 도움이 된다. 이것은 이 규약 범위 밖의 개선으로 나눴다.

### R-2. `registry.test.ts` 와 나눈다 (심볼 검색이 필요하다)

`registry.test.ts` 는 frontmatter `code:` 경로의 파일 실존만 검증한다. 다음 경우를 잡지 못한다.

- 파일은 살아 있는데 가이드가 약속한 함수·컴포넌트·심볼의 이름이 바뀌었다(예: `ChatChannelCard` → `TelegramCard`).
- 파일은 살아 있는데 본문이 통째로 다른 기능으로 바뀌었다.

이 가드는 심볼 검색으로 앵커 심볼의 식별자 단위 진실성까지 검증한다. 두 가드는 서로 보완하므로 하나로 합치지 않는다.

### R-3. `kind` 값을 4개로 둔다

`kind` 는 `ui-entry`·`component`·`api-endpoint`·`e2e-scenario` 네 값으로 단순하게 뒀다. 가이드 작성자가 분류에 쓰는 시간을 줄이려는 것이다. route·page·dialog·button·form-field 처럼 더 잘게 나누면 잘못 분류할 부담만 커지고 가드 강도는 같다. 그래서 택하지 않았다. 필요하면 나중에 나눌 수 있다.

### R-4. 새 coverage 가드는 통합과 트리거만 대상으로 한다

전체 가이드 페이지가 아니라 두 카테고리만 먼저 가드한다. 텔레그램 같은 외부 provider 통합과 트리거 노드 provider 가 GUI 흐름 약속과 코드 부재가 실제로 일어난 두 곳이다. 다른 카테고리(`01-getting-started`, `02-nodes` 의 일반 노드, `03-workflows`, `04-expression-language`, `05-run-and-debug`, `07-workspace-and-team`)는 GUI 흐름 절 비중이 낮거나 열거형 가드(`nodes-coverage`)로 이미 보호된다. 필요하면 후속 카테고리(예: `auth-coverage.test.ts`)를 더할 수 있다.

개념 설명 절(워크플로우 디자인·데이터 모델·표현식 의미 설명 등)은 GUI 흐름 절과 달리 coverage 가드 대상에서 뺀다. 코드의 특정 진입점 심볼에 1:1 로 대응하는 검증 가능한 약속이 아니라 결정적으로 매칭할 앵커 대상이 없다. 이 영역의 낡음은 자동으로 검출할 수 없어 코드 리뷰와 사람 검수에 맡긴다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) Principle 7 과 같은 경계).

### R-5. `<ImplAnchor>` 를 frontmatter 가 아니라 본문 안에 둔다

frontmatter `anchors:` 배열로 두지 않고 본문 안 컴포넌트로 뒀다. 이유는 셋이다.

- 앵커는 가이드 문맥(어느 절의 어느 단락 옆)에 붙어야 뜻이 있다. frontmatter 에 두면 문맥을 잃는다.
- 본문 안 컴포넌트로 두면 작성자가 앵커를 쓸 자리(해당 GUI 흐름 절 바로 앞이나 뒤)를 자연스럽게 안다.
- 나중에 dev mode 로 보이게 할 때 본문 흐름 안에서 보여 줄 수 있다.
