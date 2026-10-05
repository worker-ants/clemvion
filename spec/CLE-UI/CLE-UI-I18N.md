---
id: "CLE-UI-I18N"
title: "다국어와 화면 문구"
type: "convention"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-UI"
ancestors: ["CLE-VISION", "CLE-UI"]
area: "CLE-UI"
content_hash: "f5a181ef5a79004b7bd0b8bd25d02d482877827f4af77be7aa515882baef9c15"
read_as: "approved_fallback"
task: "CLE-T-K9S0TE"
source_paths: ["spec/5-system/_product-overview.md", "spec/conventions/i18n-userguide.md"]
mirror_sha256: "cc8a4189a627620e31c675e418d2bee1525a2199b02c6ef57cdc5314e51d361e"
etag: "sha256-7e4c0b34e0c86a9aa8e41ef4c399d8f50ed951dd5965ac649259a69b8e7a4758"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/i18n-userguide.md` (전체), `spec/5-system/_product-overview.md` (§6 국제화 및 접근성) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 규약은 화면 문구의 다국어(i18n) 처리와 사용자 가이드 본문의 작성 규칙을 정한다. 화면 문구 사전(dict, `dict/{ko,en}`)·백엔드가 내보내는 라벨·사용자 가이드(`/docs`) MDX 가 서로 어긋나거나 갱신이 빠지는 것을 막는 것이 목적이다.

이 규약은 두 부분으로 나뉜다.

- [규칙](#규칙): 제품이 늘 지켜야 하는 불변 조건이다. 어떤 문자열이 어디를 거쳐 화면에 나가는지, 두 언어의 키가 어떻게 맞아야 하는지, 가이드를 어떤 문체로 쓰는지를 정한다.
- [동반 갱신 규율](#동반-갱신-규율): 개발 과정에서 지키는 규칙이다. 코드를 바꿀 때 무엇을 같은 변경 안에서 함께 고쳐야 하는지를 정한다. 어느 파일을 만지고 어떤 명령으로 확인하는지의 목록은 저장소 운영 문서(`PROJECT.md` 의 "변경 유형 → 갱신 위치 매핑")가 갖는다.

관련 요구사항은 [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 의 REQ-NFR-037(원본 NF-I18N-01, 한국어·영어 기본 다국어 구조)과 REQ-NFR-038(원본 NF-I18N-02, 날짜·시간·숫자의 로케일별 형식)이다. REQ-NFR-038 의 표기 형식은 이 문서가 정하지 않는다. 접근성 요구(REQ-NFR-039~041, 원본 NF-A11Y-*)도 그 문서에 있다. 가이드의 구조·라우트·빌드 검증은 [사용자 가이드](CLE-UI-GUIDE.md), 가이드가 약속한 화면의 코드 근거는 [사용자 가이드 근거 규약](../CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md) 이 정한다.

## 적용 범위

| 코드 영역 | 적용 |
| --- | --- |
| `codebase/frontend/**` | 전면 적용. 메인 앱 화면·운영 콘솔·사용자 가이드(`/docs`)가 화면 문구 사전 경유(규칙 1·2)를 따른다 |
| `codebase/backend/**` | 사용자에게 보이는 문자열의 영문 원문을 내보내는 곳이다(정적 경고 `warningRules[].message`, 그래프 경고 메시지, 노드 `label`·`hint` 등). 한국어 매핑은 프론트엔드 `backend-labels.ts` 가 맡는다(규칙 3~5). 백엔드는 영문만 내보내고 매핑 파일은 프론트엔드에 있다 |
| `codebase/packages/**` | 지금은 화면 문자열(TSX)이 없다. 화면 문자열이 생기면 이 범위를 다시 본다 |
| `codebase/channel-web-chat/**` (웹채팅 위젯 SPA) | 일부만 적용. 아래 참조 |

웹채팅 위젯의 적용 범위:

- **메인 앱 사전 기구는 범위 밖이다.** 위젯은 따로 빌드되는 정적 번들이라 메인 앱 사전(`frontend/src/lib/i18n/dict`)과 `translate()`·`t()` 를 불러올 수 없다.
- **위젯 화면 틀 문자열도 ko/en 동등성 원칙을 따른다(2026-07-12 영어 활성).** 다만 메인 앱 사전 파일과 `translate()` 대신 위젯 로컬 카탈로그를 쓴다. 카탈로그 구조·동등성 검사·대상 문구는 [웹채팅 위젯 §위젯 고유 문구 다국어](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md#위젯-고유-문구-다국어), `locale` 활성은 [웹채팅 SDK](../CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) 가 정한다.
- **여전히 제외**: 운영자가 입력한 콘텐츠(`headerTitle`, `welcome`, `launcher.suggestions`, `disclaimer`), 백엔드 페이로드, AI 본문은 카탈로그 밖이다. 입력한 언어 그대로 보인다.
- **경계**: 웹채팅 운영 콘솔(`codebase/frontend/src/app/(main)/w/[slug]/web-chat/**`)은 프론트엔드 화면이라 메인 앱 사전 대상이다([웹채팅 운영 콘솔](../CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md)). 위젯 로컬 카탈로그를 쓰는 것은 위젯 SPA 뿐이다.
- **문체는 공유한다**: 위젯 화면 틀도 해요체(ko)·정중하고 간결한 영어(en)·용어 사전·금지어를 따른다. 제품 화면 사이의 말투를 맞추기 위해서다. 단 개발용 시뮬레이터(`codebase/channel-web-chat/src/app/demo/**`)는 배포되는 위젯이 아니라 개발자용 데모라 문체 규칙 밖이다(합쇼체가 남아 있어도 된다). 이 경로의 문체를 지적하는 것은 오탐이다.

## 규칙

1. **화면 문자열은 사전 키를 거친다(원본: Principle 1).** 프론트엔드 컴포넌트(TSX·TS) 안의 사용자에게 보이는 문자열은 반드시 `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 의 키를 `translate()`·`t()` 로 불러 보인다.
   - 금지: JSX 텍스트, 속성(`label`, `placeholder`, `title`, `aria-label`, `alt` 등), 문자열 리터럴에 한국어를 직접 쓰는 것.
   - 허용: 주석(`//`, `/** */`)·JSDoc·테스트 fixture·스토리북 데모·하위 호환용 영문 폴백. 폴백도 되도록 키로 옮긴다.
   - 영문 폴백이나 접근성 전용 문자열도 사전 경유를 먼저 쓴다.

   위반 예:

   ```tsx
   <Button>저장</Button>                       // 금지
   <input placeholder="이름을 입력하세요" />     // 금지
   const label = "에러가 발생했어요";            // 금지(화면에 나가는 문자열)
   ```

   올바른 예:

   ```tsx
   <Button>{t("common.save")}</Button>
   <input placeholder={t("user.namePlaceholder")} />
   ```

2. **ko/en 사전의 끝 키 집합은 늘 같다(원본: Principle 2).** `dict/ko/<section>.ts` 와 `dict/en/<section>.ts` 의 끝 키(leaf key) 집합이 일치해야 한다.
   - 한쪽 사전에만 키가 있는 상태로 커밋하지 않는다.
   - 새 키는 양쪽에 함께 더한다. 번역하지 못했으면 같은 영문을 양쪽에 임시로 둘 수 있고, 번역은 뒤 변경에서 한다.
   - 한쪽은 객체(branch)이고 다른 쪽은 문자열(leaf)인 것도 불일치다. 양쪽 구조가 같아야 한다.

3. **백엔드 문자열은 영문을 원문으로 두고 프론트엔드가 한국어로 매핑한다(원본: Principle 3).** 백엔드(`codebase/backend/`)가 사용자에게 보이는 응답으로 내보내는 `warningRules[].message` 와 노드 스키마 `label`·`description` 은 영문 원문으로 둔다. 한국어는 프론트엔드 `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 매핑 표(`WARNING_KO`, `NODE_LABEL_KO`, `NODE_DESCRIPTION_KO`)에 등록한다. 이것은 영문 문자열 전체를 키로 쓰는 정적 매핑이다. 정적 문자열 키로 나타낼 수 없는 코드 기반·동적 메시지는 규칙 5 가 다룬다.
   - 금지: 백엔드 응답에 한국어를 직접 넣는 것. 지역화할 수 없게 된다.
   - 금지: 백엔드만 새 경고 문구(`warningRules[].message`)나 라벨을 내보내고 프론트엔드 매핑을 빠뜨리는 것.
   - 매핑이 없으면 `pickKo` 같은 폴백으로 영문이 그대로 보인다. 이것은 의도한 안전장치이지만 매핑 누락은 규칙 위반이다.
   - 매핑 대상이 아닌 값: 트리거의 `chat_channel_last_error` 다. 서버가 저장한 진단 원문을 그대로 보여 주는 필드다. 어댑터 에러 메시지(프로바이더 응답 포함)와 서버가 정한 문구가 섞이고 값이 끼는 문구(`Inbound rate limit exceeded (N/min)`)도 있어 키로 쓸 코드가 없다. 코드로 저장하는 진단 필드는 규칙 5 를 따른다. 화면에는 보이되 번역하지 않는다. 화면은 고정폭 글꼴로 원문임을 드러내고 곁의 안내 문구만 화면 문구 사전을 거친다. 이 면제를 지키는 가드는 없다([진단 원문을 매핑하지 않는 이유](#진단-원문을-매핑하지-않는-이유-2026-10-05)).

4. **백엔드 zod `ui.*` 메타도 매핑한다(원본: Principle 3-B).** 백엔드 `*ConfigSchema` 가 `z.toJSONSchema` 로 내보내는 `ui.*` 메타는 그 자체가 사용자에게 보이는 영문이다. AI 에이전트 노드의 `Presentation Tools` 그룹, `Description override`, `Defaults overlay` 라벨이 번역되지 않던 회귀를 막으려고 다음 다섯 키에도 같은 매핑 의무를 둔다.

   | 백엔드 `ui` 키(영문 원문) | 프론트엔드 `backend-labels.ts` 매핑 표 |
   | --- | --- |
   | `ui.label` | `LABEL_KO` |
   | `ui.hint` | `HINT_KO` |
   | `ui.group` | `GROUP_KO` |
   | `ui.itemLabel`(field-array) | `ITEM_LABEL_KO` |
   | `ui.options[].label`(select 위젯) | `OPTION_LABEL_KO` |

   `ui.placeholder` 도 별도 매핑 표(`PLACEHOLDER_KO`, `translateBackendPlaceholder`)가 있다. 그러나 지금 placeholder 값은 대부분 표현식 예시(`$input.items`, `{{ ... }}`)라 강제 매핑 대상에서 뺀다(`EXCLUDE_VALUE_PREFIXES`). 위 다섯은 빌드에서 강제하고 placeholder 는 폴백만 적용한다.

5. **코드·동적 백엔드 메시지는 코드와 규칙 ID 를 키로 매핑한다(원본: Principle 3-C).** 일부 백엔드 메시지는 (a) 코드만 안정적이고 메시지는 던지는 자리마다 다르거나(`ErrorCode` enum, `GRAPH_VALIDATION_FAILED`), (b) `Parallel "${node.label}" ... depth > 2` 처럼 실행 중 값을 끼운 동적 문자열이라 문자열 키로 번역할 수 없다. 이 두 부류는 코드나 규칙 ID 를 안정 키로 쓰고, 끼운 값은 따로 받는다.

   | 원천(영문 원문) | 키 | 프론트엔드 매핑 표 | 번역 함수 |
   | --- | --- | --- | --- |
   | API 에러 응답 봉투 코드(`GRAPH_VALIDATION_FAILED` 등), 노드 `output.error.code`(`ErrorCode` enum) | 에러 코드(UPPER_SNAKE) | `ERROR_KO` | `translateBackendError(code, params, locale, fallback)` |
   | `graphWarningRules[].message`(노드를 넘는 동적 경고) | 규칙 ID(`ruleId`, 예: `parallel:nested-depth-exceeded`) | `GRAPH_WARNING_KO` | `translateGraphWarning(result, locale)` |

   - **끼워 넣기 계약**: 백엔드는 영문 `message`(원문이자 폴백)와 함께 동적 값을 `params: Record<string, string | number>` 로 보낸다. 그래프 경고는 `GraphWarningRule.evaluate` 의 반환 타입 `{ message, params? }` 가 그 계약이다([그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md)). 프론트엔드 템플릿은 기존 `core.ts` 의 `interpolate()` 와 `{{name}}` 이중 중괄호를 그대로 쓴다. 새 끼워 넣기 문법을 만들지 않는다. 매핑이 없거나 한국어가 아닌 로케일이면 영문 `message` 로 폴백한다.
   - **표를 둘로 나눈 이유**: 에러 코드(UPPER_SNAKE)와 규칙 ID(`domain:kebab`)는 네임스페이스가 달라, 한 표에 섞으면 출처 구분과 동등성 가드가 흐려진다. 도메인별로 표를 나눈 기존 방식(`LABEL_KO`, `HINT_KO` …)과 같다.
   - 금지: 백엔드 응답에 한국어를 직접 넣는 것, `Accept-Language` 로 서버에서 지역화하는 것. 규칙 3 의 영문 원문 원칙을 어기고 사전이 둘로 갈린다.
   - **의무와 점진의 경계**: 등록된 모든 `GraphWarningRule.id` 는 `GRAPH_WARNING_KO` 매핑과 동적 값 `params` 노출이 의무다(새 규칙을 더하면 같은 변경 안에서). `GRAPH_VALIDATION_FAILED` 의 `ERROR_KO` 매핑도 의무다. `ErrorCode` enum 전체의 `ERROR_KO` 매핑은 한꺼번에 강제하지 않는다. 영문 폴백 상태에서 사용자에게 자주 보이는 순서로 늘린다. 강제 동등성은 그래프 경고 규칙 전체와, 사용자 노출용으로 명시 등록한 API 에러 코드 집합에 한정한다. `ERROR_KO` 는 `backend-labels.ts` 에 구현돼 있다.
   - **정적 매핑 가드와의 경계**: 규칙 3 의 가드(P1-B)는 `*.schema.ts` 의 정적 `warningRules[].message` 만 본다. 동적 `graphWarningRules` 메시지와 에러 코드는 그 가드 밖이고, 규칙 5 의 가드(P3-C-1, P3-C-2)가 맡는다.

6. **가이드 파일과 locale 형제 파일(원본: Principle 5).** 형식의 세부 규약은 `codebase/frontend/src/content/docs/_i18n-conventions.md` 가 기준이다. 여기서는 불변 조건만 적는다.
   - 기본 파일은 `<slug>.mdx`(한국어)다. 프론트매터는 여기에만 둔다.
   - 영어 형제 파일은 `<slug>.en.mdx` 이고 프론트매터 없이 본문만 둔다. 이유는 [사용자 가이드](CLE-UI-GUIDE.md#영어-형제-파일에-프론트매터를-두지-않는-이유) 에 적었다.
   - 영어 형제 파일이 없는 것은 위반이 아니다. 한국어 본문과 안내 배너로 폴백하는 것이 의도한 동작이다.
   - 새 섹션 디렉터리(`<NN>-<name>/`)를 더하면 `codebase/frontend/src/lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE` 두 로케일과 `codebase/frontend/src/lib/docs/registry.ts` 의 `SECTION_LABELS` 에 모두 등록한다([사용자 가이드](CLE-UI-GUIDE.md)).

7. **용어와 문체(원본: Principle 6).** 사용자 가이드 본문(`codebase/frontend/src/content/docs/**`)과 화면에 보이는 한국어 문자열은 가이드 용어집(`codebase/frontend/src/content/docs/_glossary.md`)의 표기·문체·금지어를 따른다.
   - 해요체로 통일한다. "~합니다", "~한다" 는 쓰지 않는다.
   - 금지어를 쓰지 않는다. 예: "엣지" → "연결선", "작업 흐름" → "워크플로우", "아웃풋" → "결과·출력".
   - 영문 고유명사는 화면 표기와 맞춘다. 예: `Manual Trigger` → "수동 트리거".
   - 이 문체 규칙의 대상은 화면 문구와 사용자 가이드다. OpenAPI 설명의 문체는 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 가 정한다.

8. **가이드에 내부 기준 문서를 드러내지 않는다(원본: Principle 6-B).** 사용자 가이드는 사용자가 열어 볼 수 있는 화면만 가리킨다. 다음은 사용자가 열 수 없으므로 본문에 쓰지 않고, 같은 사실을 사용자가 보는 표현으로 다시 쓴다.
   - `spec/<area>/...`·`/spec/...` 경로와 NERV 스펙 키(`CLE-...`). 프론트매터의 `spec:` 필드(NERV 키 목록)는 빌드 검증용 메타데이터이고, 렌더되지 않는 부분(MDX · HTML 주석, `<ImplAnchor>`)도 화면에 나오지 않으므로 별개다. `spec:` 키가 실제로 있는지는 [사용자 가이드](CLE-UI-GUIDE.md) 의 빌드 검증이 본다(미러에 넣지 않는 카탈로그 영역 키는 이름 목록으로만 확인한다).
   - `plan/in-progress/...`·`plan/complete/...` 경로
   - "별 plan `<name>`", "별도 plan", "separate plan" 처럼 내부 작업 단위를 가리키는 표현
   - `REQ-XX-NNN`, `CCH-XX-NN`, `R-XX-N` 같은 내부 앵커 ID(요구사항 ID, Rationale ID 등)
   - 매핑 표 이름(예: `ERROR_KO`, `GRAPH_WARNING_KO`, `WARNING_KO`, `LABEL_KO`, `HINT_KO`, `GROUP_KO`, `ITEM_LABEL_KO`, `OPTION_LABEL_KO`. 자동 검출은 이 목록만 본다)과 매핑 파일 이름(`backend-labels.ts`)

   또 사용자 가이드는 지금 동작하는 상태만 적는다. "v2 (후속)", "v2 (planned)", "향후 ~ 예정", "별 plan 진입 후" 같은 로드맵 문구는 쓰지 않는다. 변경이 들어가면 그 변경 안에서 본문을 고친다. 추후 예정 안내와 내부 기준 문서 참조는 사용자를 헷갈리게 한다.

## 동반 갱신 규율

개발 과정에서 지키는 규칙이다. 제품 동작을 정하지 않고, 변경 하나 안에서 무엇을 함께 고칠지를 정한다.

1. **백엔드 라벨 매핑은 같은 변경 안에서 등록한다(원본: Principle 3·3-B·3-C).** 백엔드에 사용자에게 보이는 영문(경고 메시지, 노드 라벨·설명, `ui.*` 메타, 새 그래프 경고 규칙)을 더하면 같은 변경 안에서 `backend-labels.ts` 의 매핑을 등록한다. 매핑 누락을 뒤 변경에서 메우는 것을 정상 흐름으로 두지 않는다.

2. **새 노드를 더하면 가이드를 함께 고친다(원본: Principle 4).** `codebase/backend/src/nodes/<cat>/<name>/` 에 새 노드 핸들러를 더하면 같은 변경 안에서 다음을 고친다.
   1. `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx`: 카테고리 페이지에 노드 항목을 더한다. `<cat>` 은 백엔드 디렉터리 이름과 가이드 파일 이름이 다를 수 있다(백엔드 `trigger` · `integration`, 가이드 `triggers.mdx` · `integrations.mdx`).
   2. `codebase/frontend/src/content/docs/02-nodes/<cat>.en.mdx`: 영어 형제 파일. 없으면 한국어로 폴백하지만, 정식으로 더할 때는 함께 쓴다.
   3. `dict/{ko,en}/<section>.ts`: 노드 이름·필드 이름·placeholder·도움말 문구.
   4. `backend-labels.ts`: 노드 스키마의 `z.meta({ ui: { label, hint, placeholder, ... } })` 영문 라벨이 늘어난 만큼 한국어 매핑을 보강한다.

3. **가이드 페이지가 낡지 않게 한다(원본: Principle 7).** 코드 변경이 사용자 동선·화면 구조·에러 메시지·필드 의미에 영향을 주면 같은 변경 안에서 관련 가이드 페이지를 고친다. 영향 목록은 `PROJECT.md` 의 "변경 유형 → 갱신 위치 매핑" 표를 따른다. 표에 없는 영역이라도 사용자가 보는 면이 바뀌면 가이드가 낡았을 수 있으므로, 변경한 사람이 점검 결과를 변경 설명에 적는다.
   - 자동 검출은 일부만 된다. 통합 가이드와 트리거 가이드의 화면 조작 흐름 절(GUI 흐름 절)은 `<ImplAnchor kind="ui-entry">` 를 함께 둬야 한다. 가이드에 둔 앵커의 화면 진입 심볼이 코드에서 사라지면 빌드에서 막는다. 그 밖의 가이드 페이지는 사람이 검수한다. GUI 흐름 절을 가리는 기준(제목에 `GUI` 가 있거나 본문 굵은 글씨에 `GUI` 가 있는 절)과 가드의 범위는 [사용자 가이드 근거 규약](../CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md) 이 정한다.
   - 개념 설명 절(워크플로우 설계, 데이터 모델, 표현식 의미 등)은 자동으로 검출할 수 없다. 코드 리뷰와 사람 검수의 점검 기준으로 쓴다.

## 자동 가드 요약

| 규칙 | 가드 위치 | 가드 종류 |
| --- | --- | --- |
| 1(화면 문자열 하드코딩) | `hardcoded-korean-ratchet.test.ts` 의 baseline ratchet(`hardcoded-korean-baseline.json`) | ratchet. 파일별 한국어 수가 baseline 을 넘거나 새 파일에 한국어 줄이 생기면 실패한다 |
| 2(ko/en 동등성) | `i18n.test.ts` 의 `dict parity (ko ↔ en)` | 빌드 실패 |
| 2(위젯 화면 틀 ko/en 동등성) | 위젯 로컬 카탈로그 동등성 테스트(`catalog.test.ts`, [웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md)) | 빌드 실패 |
| 3(백엔드 라벨 매핑) | `backend-labels.test.ts` 의 `backend-labels parity`(P1-B). 백엔드 `*.schema.ts` 에서 정적으로 뽑은 `warningRules[].message`·`NodeMetadata.label`·`NodeMetadata.description` 과 매핑 표 키의 차집합을 본다. 정적 파싱이라 동적 메시지(`` `${...}` ``), 명령형 `validateConfig` 반환, import 한 상수는 보지 못한다 | 빌드 실패 |
| 4(`ui.*` 메타 매핑) | `ui-label-parity.test.ts`(P3-B-1). 백엔드 `*.schema.ts` 를 문자열로 읽어 정규식으로 `label`·`hint`·`group`·`itemLabel` 리터럴을 뽑고(`z.toJSONSchema` 런타임 덤프가 아니라 정적 파싱이라 `label: someConst` 같은 동적 표현은 보지 못한다), `LABEL_KO`·`OPTION_LABEL_KO`·`NODE_LABEL_KO`·`HINT_KO`·`GROUP_KO`·`ITEM_LABEL_KO` 에 있는지 본다. [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) 와 같은 "갱신 위치 여럿을 함께 바꾼다" 원칙이다 | ratchet. `KNOWN_MISSES` baseline 을 넘으면 빌드 실패 |
| 5(코드·동적 메시지 매핑) | `backend-labels.test.ts` 의 그래프 경고 규칙 ID 동등성(P3-C-1: `GRAPH_WARNING_RULES_BY_TYPE` 의 규칙, 그래프 수준 규칙(`UNESCAPABLE_CYCLE_RULE_ID`), 테스트의 백엔드 전용 목록에 등록한 규칙의 `ruleId` 가 모두 `GRAPH_WARNING_KO` 에 있는가. 백엔드 전용 규칙은 그 목록에 등록해야 가드가 본다. [그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md) 참고)과 등록 에러 코드 동등성(P3-C-2: 사용자 노출용으로 등록한 코드, 처음은 `GRAPH_VALIDATION_FAILED`, 이 `ERROR_KO` 에 있는가) | 빌드 실패 |
| 6(섹션 라벨) | `locale.test.ts` 의 `SECTION_LABELS_BY_LOCALE coverage` | 빌드 실패 |
| 6(영어 형제 파일은 본문만) | `registry.test.ts` 의 영어 형제 파일 프론트매터 검사 | 빌드 실패 |
| 7(용어와 문체) | 없음 | 사람 검수 |
| 8(내부 기준 문서 노출) | `no-internal-refs.test.ts` 의 본문 패턴 가드 | 결정적인 패턴만 빌드 실패. 로드맵 문구는 자동 검출이 어려워 `user-guide-writer` 에이전트와 사람 검수가 맡는다. 나머지는 `documentation-reviewer`(사후)나 사람 검수 |
| 동반 갱신 2(노드 가이드) | `nodes-coverage.test.ts`(P1-C). 백엔드 노드 디렉터리 집합과 `02-nodes/<cat>.mdx` 본문의 노드 항목 차집합을 본다 | 빌드 실패 |
| 동반 갱신 3(가이드 낡음) | 통합 · 트리거 가이드의 GUI 흐름 절에 앵커가 있는가: `integrations-coverage.test.ts`, `triggers-coverage.test.ts`. 가이드에 둔 앵커의 심볼이 코드에 있는가: `impl-anchor-existence.test.ts`([사용자 가이드 근거 규약](../CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md)). 개념 설명 절과 그 밖의 페이지: 없음 | 앵커 의무와 심볼 실재는 빌드 실패, 나머지는 사람 검수 |

## 구현 위치

- `codebase/frontend/src/lib/i18n/backend-labels.ts`
- `codebase/frontend/src/lib/i18n/dict/**`
- `codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts`
- `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts`
- `codebase/frontend/src/lib/i18n/__tests__/ui-label-parity.test.ts`
- `codebase/frontend/src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts`
- `codebase/frontend/src/lib/docs/locale.ts`
- `codebase/frontend/src/lib/docs/registry.ts`
- `codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/nodes-coverage.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/locale.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/registry.test.ts`

## Rationale

### 백엔드 문자열을 영문 원문으로 두는 이유

백엔드 응답에 한국어를 직접 넣으면 (a) 로케일을 더할 때 백엔드 코드를 한꺼번에 고쳐야 하고, (b) 프론트엔드 다국어 체계와 떨어진 섬이 생기고, (c) 백엔드 테스트가 한국어 문자열에 매달려 회귀 부담이 는다. 영문 원문과 프론트엔드 매핑은 백엔드 코드를 언어와 무관하게 두고, 프론트엔드 사전이 모든 사용자 언어를 한곳에서 관리하게 한다.

### ko/en 동등성을 빌드 실패로 강제하는 이유

한쪽 키만 더하고 다른 쪽을 잊으면, 그 로케일에서 사전 경로가 비어 키 자체(예: `"node.aiAgent.maxTurns"`)가 화면에 드러난다. 동등성 가드는 커밋 시점에 이 결손을 확실하게 막는다.

### 노드 가이드 누락을 가드로 막는 이유

사전 키 동등성 가드는 사전만 본다. 백엔드에 노드를 더하고 `02-nodes/<cat>.mdx` 카탈로그에 노드 항목을 더하는 것을 잊는 일이 가드를 통과해 뒤 변경으로 메워져 왔다. 백엔드 노드 디렉터리와 MDX 본문의 차집합 검증이 이것을 확실하게 막는다.

### 하드코딩 한국어 가드를 ratchet 으로 둔 이유

기존 코드에는 하드코딩 한국어가 어느 정도 남아 있다(주석·JSX 주석·JSDoc 같은 정당한 잔존도 있다). 한 번에 0 으로 만드는 것은 현실적이지 않다. baseline 허용 목록 ratchet 으로 "지금보다 늘지 않는다" 만 강제하면 점진적으로 0 에 다가갈 수 있다. ESLint 사용자 규칙은 후속 과제다.

### 영어 형제 파일 누락을 위반으로 보지 않는 이유

가이드 로케일 규약이 한국어 본문과 안내 배너 폴백을 정상 동작으로 정한다. 영어 번역은 점진적으로 늘어나는 자산이다. 형제 파일이 없다고 빌드를 실패시키면 한국어 작성까지 막혀 작성 동력이 떨어진다. 영어 비율은 경고만 하는 ratchet 으로 따로 둘 수 있다.

### 웹채팅 위젯이 메인 앱 사전 밖에서 자체 카탈로그를 쓰는 이유

위젯(`codebase/channel-web-chat`)은 따로 빌드하고 따로 배포하는(정적 export → CDN) 독립 SPA 라 메인 앱 사전과 물리적으로 떨어져 있다. 그래서 그 사전과 `translate()` 를 불러올 수 없다. 처음에는 위젯이 한국어만 보여 사전 경유의 지역화 이득이 없었고, 그래서 위젯을 메인 앱 사전 범위 밖에 두었다. 하드코딩 ratchet 과 문서 동기화 매트릭스 가드도 위젯을 보지 않았다.

2026-07-12 위젯 화면 틀의 영어 다국어화를 시작하면서 "이득이 없다" 는 전제는 폐기됐다. 이제 위젯 화면 틀에도 ko/en 동등성이 필요하다. 그러나 물리적 분리라는 근거는 그대로라, 위젯은 메인 앱 사전으로 들어가지 않고 위젯 로컬 카탈로그와 자체 동등성 테스트를 쓴다. 이 로컬 가드가, 위젯을 보지 않던 기존 가드의 빈자리를 메운다. 문체는 계속 공유한다.

"전역 규약 + 위젯 전용 카탈로그 + 명시한 근거" 구조는 범위를 나누는 방식으로 보면 새로 만든 것이 아니다. [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 같은 위젯의 렌더링 결정에서 먼저 적용 범위를 나눈 선례("결정을 뒤집은 것이 아니라 적용 범위를 나눈 것")와 같은 방식이다. 위젯 화면 틀에 한정하며, 운영자 콘텐츠와 AI 본문의 현지화는 여전히 목표가 아니다([웹채팅](../CLE-WEBCHAT/CLE-WEBCHAT.md)). `BootConfig.locale` 활성화의 근거는 [웹채팅 SDK](../CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) 가 다룬다.

### 가이드 본문에서 NERV 키와 요구사항 ID 를 막는 이유

스펙이 NERV 로 옮겨 가면서 가이드 작성자가 다루는 내부 식별자가 옛 경로에서 NERV 키(`CLE-...`)와 서버가 발급하는 요구사항 ID(`REQ-...`)로 바뀌었다. 둘 다 사용자가 열어 볼 수 없는 내부 문서를 가리키므로 옛 경로와 같은 이유로 본문에 쓰지 않는다. 옛 가드의 앵커 ID 패턴(`CCH-…`, `R-…`)은 `REQ-SESSION-001` 같은 모양을 잡지 못해서 패턴을 따로 더했다(2026-10-02, NERV 정본 전환 단계 4b).

MDX 주석(`{/* … */}`)과 HTML 주석은 예전부터 본문 검사 밖에 있었다. 작성자가 문장의 근거 문서를 키로 적어 둘 자리라서 예외를 이 규칙에 함께 적는다. 주석은 렌더에서 빠지므로 사용자에게 보이지 않는다.

### 진단 원문을 매핑하지 않는 이유 (2026-10-05)

`chat_channel_last_error` 는 [채팅 채널 「채널 건강도」](../CLE-CHAT/CLE-CHAT-CORE.md#채널-건강도) 의 원인마다 다른 출처의 문구를 담는다. 어댑터 실패면 그 에러 메시지(프로바이더 응답 포함)이고 그 밖의 원인은 서버가 정한 문구다. 필드 하나에 출처 둘이 섞여 있어 필드 전체를 면제한다. 정적 키로 옮길 수 있는 고정 문구(`Workflow not found for this trigger`)도 같이 면제한다. 규칙 3 의 정적 키로는 프로바이더 메시지와 값이 끼는 문구를 잡지 못한다. 규칙 5 로 옮기려면 서버가 코드와 `params` 를 따로 저장해야 해 동작이 바뀐다. [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-25-워크플로우가-다른-워크스페이스에-있으면-202-ignored-와-degraded-로-답한다) 의 「워크플로우가 다른 워크스페이스에 있으면 202 ignored 와 degraded 로 답한다」 가 이 필드를 «화면에 보이는 필드» 로 보고 고정 문구를 고른 것과는 부딪치지 않는다. 보이되 진단용 원문이라 번역하지 않는다. 저장할 때 원문을 바꾸지 않는 점은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 «진단용 필드» 를 저장할 때 지우지 않는 것과 같다. 다만 그 문서는 나가는 시점에 마스킹하고 트리거 상세 응답은 지금 그 표면 목록에 없다. 올릴지는 NERV Task `CLE-T-H0GF4K` 가 정한다. 화면 안내 문구가 원인을 나열하지 않고 «마지막 오류» 를 가리키게 고친 것도 같은 날이다(NERV Task `CLE-T-K9S0TE`).
