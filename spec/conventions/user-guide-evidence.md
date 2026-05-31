---
id: user-guide-evidence
status: implemented
code:
  - codebase/frontend/src/components/docs/mdx/impl-anchor.tsx
  - codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts
---

# Convention: User-Guide Evidence (`<ImplAnchor>`)

> 관련 문서: [spec-impl-evidence](./spec-impl-evidence.md) · [i18n-userguide](./i18n-userguide.md) · [PROJECT.md §유저 가이드 파일 컨벤션](../../PROJECT.md#유저-가이드-파일-컨벤션) · [spec/2-navigation/13-user-guide.md §공용 MDX 컴포넌트](../2-navigation/13-user-guide.md)
>
> SoT 역할: 유저 가이드 본문이 약속한 UI / API surface 가 실제 코드에 존재함을 build-time 으로 강제하는 `<ImplAnchor>` 컴포넌트의 단일 진실. 텔레그램 chat-channel 가이드 GUI 흐름 약속 vs frontend UI 부재 같은 *가이드 → 코드* 역방향 갭을 차단한다.

---

## Overview (제품 정의)

`user-guide-sync-reviewer` 는 *code → guide* 단방향 (코드 변경 시 가이드 동반 갱신). 본 컨벤션은 그 역방향:
- 가이드 본문이 "트리거 생성 dialog 의 Chat Channel 체크박스를 켜기" 라고 설명
- 그 *체크박스* 가 실제 코드에 없으면 빌드 시점에 차단

`nodes-coverage.test.ts` 가 backend 노드 enumeration → 가이드 항목 존재를 강제하듯, 본 컨벤션은 가이드 GUI 흐름 절 → 코드 anchor 존재를 강제. `nodes-coverage` 패턴을 *카테고리* (integrations, triggers) 로 일반화한 것.

## 1. `<ImplAnchor>` MDX 컴포넌트

### 1.1 위치·시그니처

구현 위치: `codebase/frontend/src/components/docs/mdx/impl-anchor.tsx`.

```mdx
<ImplAnchor
  kind="ui-entry"
  file="codebase/frontend/src/app/(main)/triggers/page.tsx"
  symbol="chatChannelCheckbox"
  describes="트리거 생성 dialog 의 Chat Channel 체크박스"
/>
```

| Prop | 타입 | 의무 | 의미 |
|---|---|---|---|
| `kind` | `"ui-entry" \| "component" \| "api-endpoint" \| "e2e-scenario"` | ✓ | §1.2 참조 |
| `file` | string (레포 루트 기준 상대경로) | ✓ | 가드가 실존 검증 |
| `symbol` | string | ✓ | `file` 안 grep 대상 (변수명·JSX prop·data-testid·function name 등) |
| `describes` | string | ✓ | 가이드 독자용 한 줄 설명 |

### 1.2 `kind` enum

| 값 | 용도 | 예시 |
|---|---|---|
| `ui-entry` | 라우트/페이지 진입점 — 사용자가 "여기서 시작" 하는 클릭 가능한 entry | 트리거 생성 dialog 의 체크박스, `/integrations/new` 버튼 |
| `component` | 재사용 컴포넌트 — 여러 페이지에서 동일 동작 | `ChatChannelCard`, `DynamicForm` |
| `api-endpoint` | controller route — 가이드 본문이 명시한 API 호출 | `POST /api/triggers/:id/chat-channel/rotate-bot-token` |
| `e2e-scenario` | e2e spec 파일 — 가이드가 약속한 시나리오의 회귀 보장 | `test/triggers-chat-channel.e2e-spec.ts` 의 `'should rotate bot token'` |

### 1.3 렌더 정책

일반 사용자 view 에서는 **hidden** (`display: none`) — 가이드 본문 가독성 보호. build-time 가드만 사용. (옵션: dev mode `?dev=1` 노출은 후속 enhancement, 본 컨벤션 범위 외)

## 2. Build-time 가드 (3건)

모두 `codebase/frontend/src/lib/docs/__tests__/` 또는 별도 frontend test 영역.

| 가드 | 검증 |
|---|---|
| `impl-anchor-existence.test.ts` | 모든 `<ImplAnchor>` 의 `file` 실존 + `symbol` 이 file 안 grep ≥1 매치. `kind=api-endpoint` 인 경우 file 안 NestJS `@Post`/`@Get` 데코레이터 + path 매치 추가 검증 |
| `integrations-coverage.test.ts` | `06-integrations-and-config/<provider>.mdx` 의 "GUI flow" 절 (h2/h3 텍스트에 "GUI" 키워드 포함) 안에 `<ImplAnchor kind="ui-entry">` ≥1 의무 |
| `triggers-coverage.test.ts` | `02-nodes/triggers.mdx` 의 provider 별 절 (h2/h3 텍스트가 provider 이름 포함) 도 동일 |

### 2.1 다른 가드와의 관계

- **`registry.test.ts`** (user-guide frontmatter `spec:`/`code:` 경로 실존) 와 본 가드는 **검증 대상이 직교**:
  - `registry.test.ts` = frontmatter 메타 — 가이드가 *참조하는* spec/코드 경로 실존
  - `impl-anchor-existence.test.ts` = 본문 anchor — 가이드가 *약속한* 코드 symbol 실존
  - 둘 다 통과해야 가이드 정합. 한쪽이 다른 쪽을 대체하지 않음.
- **`nodes-coverage.test.ts`** 와는 **방향이 동일** (가이드 ← 등록부) 하나 **enumeration vs free-form** 으로 보완:
  - `nodes-coverage` = backend 노드 등록부 → 가이드에 항목 등장
  - `integrations-coverage` / `triggers-coverage` = 가이드 GUI 흐름 절 → 코드 entry symbol
- **`spec-code-paths.test.ts`** (spec-impl-evidence §4) 와는 **다른 방향**:
  - `spec-code-paths` = spec → 구현 코드 경로 (spec 책임 추적)
  - 본 가드 = 가이드 → 구현 코드 symbol (가이드 진실성 추적)
  - 두 가드는 "spec → code" 와 "guide → code" 의 두 진실을 독립으로 검증

## 3. 사용 패턴

### 3.1 통합 가이드 (`06-integrations-and-config/<provider>.mdx`)

GUI 흐름 절은 **반드시 `<ImplAnchor kind="ui-entry">` 동반**:

```mdx
## 2. 워크플로우 Webhook 트리거에 Chat Channel 설정

**GUI 등록 흐름 (권장)**:

<ImplAnchor
  kind="ui-entry"
  file="codebase/frontend/src/app/(main)/triggers/page.tsx"
  symbol="chatChannelCheckbox"
  describes="트리거 생성 dialog 의 Chat Channel 체크박스"
/>

1. 좌측 메뉴 → **Triggers** → 우측 상단 **"+ Webhook 트리거 추가"** 클릭
2. ...
```

### 3.2 트리거 가이드 (`02-nodes/triggers.mdx`)

provider 별 절도 동일:

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

### 3.3 API 흐름

API curl 예시는 `kind="api-endpoint"` 추가:

```mdx
```bash
curl -X POST https://<your-host>/api/triggers/<trigger-id>/chat-channel/rotate-bot-token \
  -H 'Authorization: Bearer <your-token>' \
  ...
```

<ImplAnchor
  kind="api-endpoint"
  file="codebase/backend/src/modules/chat-channel/chat-channel.controller.ts"
  symbol="rotateBotToken"
  describes="POST /api/triggers/:id/chat-channel/rotate-bot-token"
/>
```

## 4. user-guide-writer sub-agent 통합

`spec-impl-evidence` + 본 컨벤션의 강제력은 다음 3채널로 보장:

1. **build-time 가드 3건** (§2) — CI 차단
2. **`user-guide-writer` 자가 검증 체크리스트** — GUI 흐름 절 작성 시 `<ImplAnchor>` 동반 의무 항목. `.claude/agents/user-guide-writer.md` 에 등재
3. **`PROJECT.md §유저 가이드 파일 컨벤션 SoT 인덱스`** — 본 문서 등재 (결정 E-5)

## 5. i18n-userguide.md §Principle 7 와의 관계

`spec/conventions/i18n-userguide.md §Principle 7` 은 "page stale 자동 검출 불가" 라고 명시 (가이드 페이지 본문이 코드 변경을 따라가지 못한 stale 상태). 본 컨벤션 도입으로:

- **GUI 흐름 절** 안의 약속은 본 가드가 검출 (anchor 가 코드에 없으면 차단) → §Principle 7 의 부분 보완
- **개념 설명 절** (워크플로우 디자인, 데이터 모델 설명 등) 은 여전히 자동 검출 불가 — §Principle 7 의 미커버 영역으로 남음

후속으로 `i18n-userguide.md §Principle 7` 본문에 본 가드의 부분 커버 범위를 명시한다.

## Rationale

### R-1. `<ImplAnchor>` hidden 렌더 채택

가이드 본문 가독성 보호. 일반 독자가 anchor 메타데이터를 봐야 할 이유 없음 — anchor 는 *검증용* 메타이지 *설명용* 콘텐츠가 아님. 단 dev mode 노출 (URL `?dev=1`) 은 가이드 작성자/리뷰어가 "여기 anchor 가 있는지" 시각 확인할 수 있어 작성 편의에 유익. 본 컨벤션 범위 외 enhancement 로 분리.

### R-2. `registry.test.ts` 와 분리 — symbol grep 검증의 필요성

`registry.test.ts` 는 frontmatter `code:` 경로의 *파일 실존* 만 검증. 다음 케이스를 잡지 못함:
- 파일은 살아 있으나 가이드가 약속한 *함수/컴포넌트/symbol* 은 이름 변경됨 (예: `ChatChannelCard` → `TelegramCard` 리네임)
- 파일은 살아 있으나 본문이 통째로 다른 기능으로 교체됨

본 가드는 symbol grep 으로 *anchor symbol 의 식별자 단위 진실성* 까지 검증. 두 가드가 보완 관계 — 한쪽으로 통합하지 않음.

### R-3. `kind` enum 4 값 채택 vs 더 세분화

`kind` 은 ui-entry / component / api-endpoint / e2e-scenario 4 값으로 단순화 — 가이드 작성자가 분류에 고민하는 시간 최소화. route / page / dialog / button / form-field 식 더 세분화는 false-classification 부담만 키우고 가드 강도는 동일하므로 채택하지 않는다. 후속 enhancement 로 분리 가능.

### R-4. integrations + triggers 만 신규 coverage 가드 대상

전체 가이드 페이지가 아닌 두 카테고리만 우선 가드 — 텔레그램 같은 *외부 provider 통합* + *트리거 노드 provider* 가 GUI 흐름 약속 vs 코드 부재의 *실제 발생 사례* 두 곳. 다른 카테고리 (`01-getting-started`, `02-nodes` 의 일반 노드, `03-workflows`, `04-expression-language`, `05-run-and-debug`, `07-workspace-and-team`) 는 GUI 흐름 절 비중이 낮거나 enumerable 가드 (`nodes-coverage`) 로 이미 보호됨. 필요 시 후속 카테고리 (예: `auth-coverage.test.ts`) 추가 가능.

### R-5. `<ImplAnchor>` 가 본문 안 vs frontmatter

frontmatter `anchors:` 배열로 두지 않고 본문 안 컴포넌트로 둠. 이유:
- 가이드 *문맥* (어느 절의 어느 단락 옆) 에 anchor 가 붙어야 의미 — frontmatter 는 문맥 손실
- 본문 안 컴포넌트는 가이드 작성자가 *자연스럽게 anchor 작성 위치* 인지 (해당 GUI 흐름 절 직전/직후)
- 미래 dev mode 노출 시 본문 흐름 안에서 시각화 가능
