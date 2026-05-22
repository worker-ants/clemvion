# i18n / 유저 가이드 정식 규약 (Conventions)

UI 다국어 문자열·백엔드 발행 라벨·사용자 가이드(`/docs`) MDX 의 갱신 누락을 차단하기 위한 **정식 규약**. 모든 신규·변경 코드가 본 규약을 위반하지 않아야 한다. `convention-compliance-checker` 가 본 문서를 자동 inheritance 하여 spec 작성·구현 착수 직전 위반을 검출한다.

> **위치 매핑·검증 명령**: 본 규약이 가리키는 갱신 위치와 실제 명령은 `PROJECT.md §변경 유형 → 갱신 위치 매핑` 의 표를 따른다. 본 문서는 "어떤 invariant 가 깨지면 안 되는가" 를 정의하고, `PROJECT.md` 는 "어디를 만져야 하는가" 를 정의한다.

---

## Principle 1 — UI 문자열은 dict 키 경유, TSX 하드코딩 금지

프론트엔드 컴포넌트(TSX / TS) 안의 사용자 가시 문자열은 **반드시** `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 의 키를 통해 `translate()` / `t()` 호출로 노출한다.

- ❌ 금지: JSX text·attribute(`label`, `placeholder`, `title`, `aria-label`, `alt` 등)·string literal 에 한국어 문자열을 직접 박는 행위.
- ✅ 허용: 주석(`//`, `/** */`)·JSDoc·테스트 fixture·스토리북 데모·역방향 호환 fallback (영문 SoT 원칙의 일부). 단 fallback 도 가능한 한 키로 옮긴다.
- 영문 fallback / accessibility-only 문자열도 동일하게 dict 경유를 우선한다.

**위반 패턴**:
```tsx
<Button>저장</Button>                       // ❌
<input placeholder="이름을 입력하세요" />     // ❌
const label = "에러가 발생했어요";            // ❌ (UI 노출 string)
```

**올바른 형태**:
```tsx
<Button>{t("common.save")}</Button>
<input placeholder={t("user.namePlaceholder")} />
```

---

## Principle 2 — ko/en 사전 leaf key parity

`dict/ko/<section>.ts` 와 `dict/en/<section>.ts` 의 leaf 키 집합은 **항상 일치**한다.

- 한쪽 사전에만 키가 존재하는 상태로 commit 금지.
- 신규 키 추가 시 양쪽 동시에 추가. 미번역이면 임시로 동일 영문 문자열을 양쪽에 둘 수 있다 (단 후속 PR 로 번역).
- 한쪽이 객체(branch), 다른 쪽이 string(leaf) 인 경우도 mismatch — 양쪽 동일 구조를 강제.

**자동 가드**: `codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts` 의 `describe("dict parity (ko ↔ en)")` 가 빌드 단계에서 차단.

---

## Principle 3 — 백엔드 발행 warningCode / 노드 라벨의 frontend 매핑 의무

백엔드 코드(`codebase/backend/`)가 사용자 가시 응답으로 던지는 `warningRules[].message` · 노드 schema `label`·`description` 은 **영문 SoT** 로 두고, 프론트엔드 `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 매핑 테이블(`WARNING_KO` · `NODE_LABEL_KO` · `NODE_DESCRIPTION_KO`) 에 **동일 PR 안에서** 한국어 매핑을 등록한다.

- ❌ 금지: 백엔드 응답에 한국어 문자열을 직접 박는 행위 (지역화 불가능 상태).
- ❌ 금지: 백엔드만 새 warningCode 발행, frontend 매핑 누락.
- ✅ 허용: 매핑 없는 상태로 코드 통과는 `pickKo` 등의 graceful fallback 으로 영문이 그대로 노출되도록 한 의도적 설계 — 그러나 매핑 누락은 정식 위반이며 후속 보정 commit 으로 회수되지 않도록 한다.

**자동 가드 (P1-B)**: backend `*.schema.ts` 의 정적 추출(`warningRules[].message` · `NodeMetadata.label` · `NodeMetadata.description`) 결과와 `WARNING_KO` · `NODE_LABEL_KO` · `NODE_DESCRIPTION_KO` 키 집합의 차집합을 검증. 누락 시 fail. 정적 파싱이라 동적 message (`\`${...}\``) · imperative `validateConfig` 반환 · import 해온 상수는 미커버 — 향후 ts-morph 기반 정적 분석으로 보강.

### Principle 3-B — backend zod `ui.label` / `hint` / `group` / `itemLabel` 매핑 의무 (2026-05-22)

backend 의 `*ConfigSchema` 가 `z.toJSONSchema` 로 노출하는 `ui.*` 메타데이터는 그 자체가 사용자 가시 영문 문자열이다. PR #271 의 이슈 #2 (AI Agent 의 `Presentation Tools` 그룹 / `Description override` / `Defaults overlay` 라벨이 한글로 번역 안 됨) 와 같은 회귀를 차단하기 위해, 다음 4종 ui 키도 동일 매핑 의무를 적용한다.

| Backend ui 키 (영문 SoT) | Frontend `backend-labels.ts` 매핑 테이블 |
|---|---|
| `ui.label` | `LABEL_KO` |
| `ui.hint` | `HINT_KO` |
| `ui.group` | `GROUP_KO` |
| `ui.itemLabel` (field-array) | `ITEM_LABEL_KO` |
| `ui.options[].label` (select widget) | `OPTION_LABEL_KO` |

**자동 가드 (P3-B-1)**: `codebase/frontend/src/lib/i18n/__tests__/ui-label-parity.test.ts` 가 backend 의 모든 `*ConfigSchema` 를 `z.toJSONSchema` 로 dump 해 ui.* 값을 추출하고, 위 5 매핑 테이블에 존재하는지 검증. 누락 = build hard fail. spec/conventions/interaction-type-registry.md 와 동일한 "N 개 갱신 위치 동시 변경" 원칙을 적용한다.

### errorCode 의 처리 (현재 갭)

`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum (UPPER_SNAKE_CASE — `HTTP_TIMEOUT`, `DB_QUERY_FAILED` 등) 이 발행하는 영문 `message` 는 현재 `backend-labels.ts` 의 매핑 대상이 아니다 (`ERROR_KO` 미존재). 따라서 errorCode 의 사용자 가시 message 는 ko 로케일에서도 영문이 그대로 노출된다.

후속 plan: `ERROR_KO` 신설 + `translateBackendError(code, message, locale)` 도입 검토. 그 전까지는 errorCode 추가 시 PR 본문에 "ko 로케일에서 영문 노출" 을 명시한다.

---

## Principle 4 — 신규 노드 추가 시 사용자 가이드 MDX 의무

`codebase/backend/src/nodes/<cat>/<name>/` 에 새 노드 핸들러가 추가되면 다음을 **동일 PR 안에서** 갱신한다.

1. `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx` — 해당 카테고리 페이지에 노드 항목 추가.
2. `codebase/frontend/src/content/docs/02-nodes/<cat>.en.mdx` — 영어 sibling (없으면 KO 폴백이 동작하지만, 정식 추가 시점에는 함께 작성).
3. `dict/{ko,en}/<section>.ts` — 노드명·필드명·placeholder·도움말 문구.
4. `backend-labels.ts` — 노드 schema 의 `z.meta({ ui: { label, hint, placeholder, ... } })` 영문 라벨이 추가된 만큼 한국어 매핑 보강.

**자동 가드 (P1-C)**: backend 의 노드 디렉토리 집합과 `02-nodes/<cat>.mdx` 본문 안 노드 항목 출현 차집합 검증.

---

## Principle 5 — 사용자 가이드 파일·로케일 sibling 규약

자세한 형식 규약은 [`codebase/frontend/src/content/docs/_i18n-conventions.md`](../../codebase/frontend/src/content/docs/_i18n-conventions.md) 가 단일 진실. 본 절은 invariant 만 요약한다.

- canonical = `<slug>.mdx` (한국어). frontmatter 는 여기에만.
- 영어 sibling = `<slug>.en.mdx` — frontmatter 없이 본문만.
- 영어 sibling 미존재는 정식 위반 아님 — KO 본문 + 안내 배너 폴백이 의도된 동작.
- 새 섹션 디렉토리(`<NN>-<name>/`) 추가 시 **반드시** `codebase/frontend/src/lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE` 양쪽 로케일에 등록.

**자동 가드 (기존)**: `codebase/frontend/src/lib/docs/__tests__/locale.test.ts` 의 `describe("SECTION_LABELS_BY_LOCALE coverage")` 가 양쪽 로케일 등록 누락을 차단.

---

## Principle 6 — 글로서리·문체

사용자 가이드 본문(`codebase/frontend/src/content/docs/**`) 과 UI 사용자 가시 한국어 문자열은 [`codebase/frontend/src/content/docs/_glossary.md`](../../codebase/frontend/src/content/docs/_glossary.md) 의 표기·문체·금지어 규약을 따른다.

- 해요체로 통일 (`~합니다`, `~한다` 금지).
- 금지어 (예: "엣지" → "연결선", "작업 흐름" → "워크플로우", "아웃풋" → "결과/출력") 사용 금지.
- 영문 고유명사는 UI 표기와 일관 (예: `Manual Trigger` → "수동 트리거").

본 항목은 자동 결정 검출이 어려우므로 `documentation-reviewer` (사후) 또는 사람 검수에 의존한다.

---

## Principle 7 — 사용자 가이드 페이지 stale 방지

코드 변경이 사용자 동선·UI 구조·에러 메시지·필드 의미에 영향을 줄 때 관련 user-guide 페이지를 **동일 PR 안에서** 갱신한다.

영향 매핑은 `PROJECT.md §변경 유형 → 갱신 위치 매핑` 의 표를 따른다. 표에 없는 영역의 변경이라도 사용자 가시면이 바뀐다면 page stale 의심 — 변경자가 명시적으로 점검 결과를 PR 본문에 적는다.

**자동 결정 검출 불가**. 본 규약은 코드 리뷰 / consistency-check 의 점검 가이드로 사용된다.

---

## 자동 가드 요약

| Principle | 자동 가드 위치 | 가드 종류 |
| --- | --- | --- |
| 1 (TSX 하드코딩) | `i18n.test.ts` 의 ratchet (P2-b) | warn → 추후 fail |
| 2 (ko/en parity) | `i18n.test.ts` 의 `dict parity (ko ↔ en)` | hard fail |
| 3 (backend-labels 매핑) | `backend-labels.test.ts` 의 `backend-labels parity` (P1-B) | hard fail |
| 4 (노드 MDX 추가) | `registry.test.ts` 또는 `nodes-coverage.test.ts` (P1-C) | hard fail |
| 5 (SECTION_LABELS) | `locale.test.ts` 의 `SECTION_LABELS_BY_LOCALE coverage` | hard fail |
| 6 (글로서리·문체) | — | manual / reviewer |
| 7 (페이지 stale) | — | manual / reviewer |

---

## Rationale

### 왜 영문 SoT 인가

백엔드 응답에 한국어를 직접 박으면 (a) 로케일 추가 시 백엔드 코드 일제 수정 필요, (b) frontend i18n 시스템과 분리된 사일로 발생, (c) 백엔드 테스트가 한국어 문자열에 매달리는 회귀 부담. 영문 SoT + frontend 매핑은 backend code 의 i18n-agnostic 을 보장하고 frontend dict 가 모든 사용자 언어를 단일 위치에서 관리한다.

### 왜 양쪽 사전 parity 를 hard fail 로 강제하는가

PR #57 (`fix(i18n): AI Agent 노드 설정 한/영 양방향 누락 번역 정리`) 케이스. 한쪽 키만 추가하고 다른 쪽을 잊으면 사용자 로케일에서 dictionary path 가 falsy 가 되어 키 자체 (예: `"node.aiAgent.maxTurns"`) 가 UI 에 노출된다. parity 가드는 commit 시점에 이 결손을 결정적으로 막는다.

### 왜 노드 MDX coverage 가 필요한가

P0 가드는 dict 키 parity 만 본다. 백엔드에 노드 추가했지만 `02-nodes/<cat>.mdx` 의 카탈로그 페이지에 노드 카드/표 항목 추가를 잊는 패턴은 가드 통과 후 사후 보정 PR 로 회수되어 왔다. backend nodes 디렉토리 ↔ MDX 본문 grep 차집합 검증이 결정적으로 차단한다.

### 왜 P2-b 는 hard fail 이 아닌 ratchet 인가

기존 코드베이스에 잔존한 하드코딩 한국어가 일정 수 있고 (주석/JSX-comment/JSDoc 등 정당한 잔존도 포함), 한 번에 0 화는 비현실적. baseline 화이트리스트 ratchet 으로 "현재 수 이상으로 늘지 않는다" 만 강제하면 점진적 0 화가 가능하다. ESLint custom rule 은 추후 P2-a 후속 과제.

### 왜 .en.mdx sibling 누락은 위반이 아닌가

`_i18n-conventions.md` 가 KO 본문 + 안내 배너 폴백을 정상 동작으로 명시. 영어 번역은 점진적으로 추가되는 자산이며, sibling 미존재를 hard fail 시키면 KO 작성 자체가 막혀 작성 동력을 떨어뜨린다. coverage 는 warn-only 로 별도 ratchet 화 가능 (P3 후속).
