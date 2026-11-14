---
id: "CLE-UI-I18N"
title: "다국어와 화면 문구"
type: "convention"
version: 10
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-UI"
ancestors: ["CLE-VISION", "CLE-UI"]
area: "CLE-UI"
content_hash: "235949b59b08f6fe5385b1ec33b8c35d56611cc9d43c1eee18a6f99bd02570e1"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/_product-overview.md", "spec/conventions/i18n-userguide.md"]
mirror_sha256: "26a0e5f5dec3b0ce9cdde425e308bfc726b2d0996dafa5b93f39269ac7452a43"
etag: "sha256-3693dc2eff53cbe5c778322d2be524950bde752984577397d55d6277c5e868cc"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/i18n-userguide.md` (전체), `spec/5-system/_product-overview.md` (§6 국제화 및 접근성) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 규약은 화면 문구의 다국어(i18n) 처리와 사용자 가이드 본문의 작성 규칙을 정한다. 화면 문구 사전(dict, `dict/{ko,en}`)·백엔드가 내보내는 라벨·사용자 가이드(`/docs`) MDX 가 서로 어긋나거나 갱신이 빠지는 것을 막는 것이 목적이다.

이 규약은 두 부분으로 나뉜다.

- [규칙](#규칙): 제품이 늘 지켜야 하는 불변 조건이다. 문자열이 화면에 나가는 경로, 두 언어 키의 일치, 가이드 문체를 정한다. 백엔드 문구 매핑(규칙 3~5)의 세부는 하위 문서가 맡는다.
- [동반 갱신 규율](#동반-갱신-규율): 개발 과정에서 지키는 규칙이다. 코드를 바꿀 때 무엇을 같은 변경 안에서 함께 고쳐야 하는지를 정한다. 어느 파일을 만지고 어떤 명령으로 확인하는지의 목록은 저장소 운영 문서(`PROJECT.md` 의 "변경 유형 → 갱신 위치 매핑")가 갖는다.

관련 요구사항은 [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 의 REQ-NFR-037(원본 NF-I18N-01, 한국어·영어 기본 다국어 구조)과 REQ-NFR-038(원본 NF-I18N-02, 날짜·시간·숫자의 로케일별 형식)이다. REQ-NFR-038 의 표기 형식은 이 문서가 정하지 않는다. 접근성 요구(REQ-NFR-039~041, 원본 NF-A11Y-*)도 그 문서에 있다. 가이드의 구조·라우트·빌드 검증은 [사용자 가이드](CLE-UI-GUIDE.md), 가이드가 약속한 화면의 코드 근거는 [사용자 가이드 근거 규약](../CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md) 이 정한다.

## 하위 문서

- [다국어와 화면 문구 — 백엔드 문구 매핑](CLE-UI-I18N-BACKEND.md): 규칙 3 · 4 · 5 의 세부(백엔드 영문 원문과 `backend-labels.ts` 정적 매핑, zod `ui.*` 메타 매핑, 코드 · 규칙 ID 기반 매핑과 어시스턴트 · 통합 화면 에러 코드 표), 그 구현 위치와 근거. 맡는 요구사항 번호: 없음(이 규약에는 요구사항 줄이 없다).

## 적용 범위

| 코드 영역 | 적용 |
| --- | --- |
| `codebase/frontend/**` | 전면 적용. 메인 앱 화면·운영 콘솔·사용자 가이드(`/docs`)가 화면 문구 사전 경유(규칙 1·2)를 따른다 |
| `codebase/backend/**` | 사용자에게 보이는 문자열의 영문 원문을 내보내는 곳이다(정적 경고 `warningRules[].message`, 그래프 경고 메시지, 노드 `label`·`hint` 등). 한국어 매핑은 프론트엔드 `backend-labels.ts` 가 맡는다(규칙 3~5). 어시스턴트 SSE `error` 코드와 통합 화면 에러 코드는 예외로 화면 모듈의 표(`ERROR_MESSAGE_KEYS`, `integration-error-codes.ts` 의 `INTEGRATION_ERROR_CODE_TO_I18N`)가 사전 키로 매핑한다(규칙 5, [백엔드 문구 매핑](CLE-UI-I18N-BACKEND.md)). 백엔드는 영문만 내보내고 매핑 파일은 프론트엔드에 있다 |
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
   - **알려진 예외: 어시스턴트 도구 호출 배지 요약**: [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md#i18n-키) 의 도구 호출 배지 요약(`tool-call-badge.tsx` 의 `summarize()`)은 사전 키를 거치지 않는 영문 고정 문자열이라 한국어 로케일에서도 영문으로 보인다. 재시도 후 성공 표시만 `assistant.toolCallBadgeRetryRecovered` 를 쓴다. 프론트엔드가 만드는 문자열이라 규칙 3 의 대상이 아니고, 한국어가 아니라 하드코딩 한국어 가드에도 걸리지 않아 여기에 예외로 적는다. 사전 키로 옮기는 일은 NERV Task `CLE-T-F9QEJC` 가 맡고, 옮기면 이 항목을 지운다.

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

3. **백엔드 문자열은 영문을 원문으로 두고 프론트엔드가 한국어로 매핑한다(원본: Principle 3).** 백엔드가 사용자에게 보이게 내보내는 `warningRules[].message` 와 노드 스키마 `label`·`description` 은 영문 원문으로 두고, 한국어는 프론트엔드 `backend-labels.ts` 의 정적 매핑 표에 등록한다. 백엔드 응답에 한국어를 직접 넣지 않는다. 세부 금지 · 폴백 · 매핑 대상이 아닌 값은 [백엔드 문구 매핑 §백엔드 영문 원문과 정적 매핑 (규칙 3)](CLE-UI-I18N-BACKEND.md#백엔드-영문-원문과-정적-매핑-규칙-3) 이 정한다.

4. **백엔드 zod `ui.*` 메타도 매핑한다(원본: Principle 3-B).** `ui.label`·`ui.hint`·`ui.group`·`ui.itemLabel`·`ui.options[].label` 다섯 키는 `backend-labels.ts` 매핑을 빌드에서 강제하고 `ui.placeholder` 는 폴백만 적용한다. 키와 매핑 표의 대응은 [백엔드 문구 매핑 §zod ui 메타 매핑 (규칙 4)](CLE-UI-I18N-BACKEND.md#zod-ui-메타-매핑-규칙-4) 이 정한다.

5. **코드·동적 백엔드 메시지는 코드와 규칙 ID 를 키로 매핑한다(원본: Principle 3-C).** 코드만 안정적이거나 실행 중 값을 끼운 백엔드 메시지는 에러 코드나 규칙 ID 를 안정 키로 쓰고 끼운 값은 `params` 로 따로 받는다. 서버에서 지역화하지 않는다. 다만 어시스턴트 SSE `error` 코드와 통합 화면 에러 코드는 `ERROR_KO` 밖에 두고 화면 모듈의 표가 ko/en 짝이 있는 사전 키로 매핑한다. 원천별 매핑 표, 끼워 넣기 계약, 알려진 예외, 의무와 점진의 경계는 [백엔드 문구 매핑 §코드와 동적 메시지 매핑 (규칙 5)](CLE-UI-I18N-BACKEND.md#코드와-동적-메시지-매핑-규칙-5) 이 정한다.

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
   - 메신저 봇 안내 문구는 이 규칙의 대상이 아니다. 그 문구의 기준은 [채팅 채널 데이터와 흐름 「안내 문구 기본값」](../CLE-CHAT/CLE-CHAT-DATA.md#안내-문구-기본값) 이 정한다. 한국어 기본 문구는 합쇼체로 쓴다. 근거는 [메신저 봇 안내 문구를 규칙 7 밖에 두는 이유](#메신저-봇-안내-문구를-규칙-7-밖에-두는-이유-2026-11-12) 에 있다.

8. **가이드에 내부 기준 문서를 드러내지 않는다(원본: Principle 6-B).** 사용자 가이드는 사용자가 열어 볼 수 있는 화면만 가리킨다. 다음은 사용자가 열 수 없으므로 본문에 쓰지 않고, 같은 사실을 사용자가 보는 표현으로 다시 쓴다.
   - `spec/<area>/...`·`/spec/...` 경로와 NERV 스펙 키(`CLE-...`). 프론트매터의 `spec:` 필드(NERV 키 목록)는 빌드 검증용 메타데이터이고, 렌더되지 않는 부분(MDX · HTML 주석, `<ImplAnchor>`)도 화면에 나오지 않으므로 별개다. `spec:` 키가 실제로 있는지는 [사용자 가이드](CLE-UI-GUIDE.md) 의 빌드 검증이 본다(미러에 넣지 않는 카탈로그 영역 키는 이름 목록으로만 확인한다).
   - `plan/in-progress/...`·`plan/complete/...` 경로
   - "별 plan `<name>`", "별도 plan", "separate plan" 처럼 내부 작업 단위를 가리키는 표현
   - `REQ-XX-NNN`, `CCH-XX-NN`, `R-XX-N` 같은 내부 앵커 ID(요구사항 ID, Rationale ID 등)
   - 매핑 표 이름(예: `ERROR_KO`, `GRAPH_WARNING_KO`, `WARNING_KO`, `LABEL_KO`, `HINT_KO`, `GROUP_KO`, `ITEM_LABEL_KO`, `OPTION_LABEL_KO`. 자동 검출은 이 목록만 본다)과 매핑 파일 이름(`backend-labels.ts`). 컴포넌트 지역 표 이름(어시스턴트 패널 모듈의 `ERROR_MESSAGE_KEYS` 등)도 쓰지 않는다. 이 이름들은 자동 검출 목록 밖이라 사람이 검수한다.

   또 사용자 가이드는 지금 동작하는 상태만 적는다. "v2 (후속)", "v2 (planned)", "향후 ~ 예정", "별 plan 진입 후" 같은 로드맵 문구는 쓰지 않는다. 변경이 들어가면 그 변경 안에서 본문을 고친다. 추후 예정 안내와 내부 기준 문서 참조는 사용자를 헷갈리게 한다.

## 동반 갱신 규율

개발 과정에서 지키는 규칙이다. 제품 동작을 정하지 않고, 변경 하나 안에서 무엇을 함께 고칠지를 정한다.

1. **백엔드 라벨 매핑은 같은 변경 안에서 등록한다(원본: Principle 3·3-B·3-C).** 백엔드에 사용자에게 보이는 영문(경고 메시지, 노드 라벨·설명, `ui.*` 메타, 새 그래프 경고 규칙)을 더하면 같은 변경 안에서 `backend-labels.ts` 의 매핑을 등록한다. 매핑 누락을 뒤 변경에서 메우는 것을 정상 흐름으로 두지 않는다. 어시스턴트 SSE `error` 코드를 더하면 같은 변경 안에서 백엔드 `workflow-assistant-stream-errors.ts` 의 문구 표나 함수(한도 숫자가 문구에 들어가는 코드), 어시스턴트 패널 모듈의 `ERROR_MESSAGE_KEYS`, `assistant.*` 사전 키(ko/en), 양쪽 테스트(`workflow-assistant-stream-errors.spec.ts`, `assistant-message-error.test.tsx`)의 코드 목록을 함께 고친다. `ERROR_MESSAGE_KEYS` 선언의 리터럴 모양을 바꾸면 백엔드 테스트의 추출식도 같은 변경에서 고친다.

2. **새 노드를 더하면 가이드를 함께 고친다(원본: Principle 4).** `codebase/backend/src/nodes/<cat>/<name>/` 에 새 노드 핸들러를 더하면 같은 변경 안에서 다음을 고친다.
   1. `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx`: 카테고리 페이지에 노드 항목을 더한다. `<cat>` 은 백엔드 디렉터리 이름과 가이드 파일 이름이 다를 수 있다(백엔드 `trigger` · `integration`, 가이드 `triggers.mdx` · `integrations.mdx`).
   2. `codebase/frontend/src/content/docs/02-nodes/<cat>.en.mdx`: 영어 형제 파일. 없으면 한국어로 폴백하지만, 정식으로 더할 때는 함께 쓴다.
   3. `dict/{ko,en}/<section>.ts`: 노드 이름·필드 이름·placeholder·도움말 문구.
   4. `backend-labels.ts`: 노드 스키마의 `z.meta({ ui: { label, hint, placeholder, ... } })` 영문 라벨이 늘어난 만큼 한국어 매핑을 보강한다.

3. **가이드 페이지가 낡지 않게 한다(원본: Principle 7).** 코드 변경이 사용자 동선·화면 구조·에러 메시지·필드 의미에 영향을 주면 같은 변경 안에서 관련 가이드 페이지를 고친다. 영향 목록은 `PROJECT.md` 의 "변경 유형 → 갱신 위치 매핑" 표를 따른다. 표에 없는 영역이라도 사용자가 보는 면이 바뀌면 변경한 사람이 가이드 점검 결과를 변경 설명에 적는다.
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
| 5(코드·동적 메시지 매핑) | `backend-labels.test.ts` 의 그래프 경고 규칙 ID 동등성(P3-C-1: `GRAPH_WARNING_RULES_BY_TYPE` 의 규칙, 그래프 수준 규칙(`UNESCAPABLE_CYCLE_RULE_ID`), 테스트의 백엔드 전용 목록에 등록한 규칙의 `ruleId` 가 모두 `GRAPH_WARNING_KO` 에 있는가. 백엔드 전용 규칙은 그 목록에 등록해야 가드가 본다. [그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md) 참고)과 등록 에러 코드 동등성(P3-C-2: 사용자 노출용으로 등록한 코드, 처음은 `GRAPH_VALIDATION_FAILED`, 이 `ERROR_KO` 에 있는가). 어시스턴트 SSE `error` 코드는 위 등록 코드 집합에 들어가지 않는다. 백엔드 문구 표와 프론트엔드 `ERROR_MESSAGE_KEYS` 의 코드 집합은 백엔드 테스트(`workflow-assistant-stream-errors.spec.ts`)가 프론트엔드 소스의 `ERROR_MESSAGE_KEYS` 리터럴을 읽어 맞춘다. `backend-checks` 의 경로 목록에 그 프론트엔드 파일이 있어 프론트엔드만 바꾼 변경에서도 이 테스트가 돈다. 코드마다 사전 문구가 나오는지는 프론트엔드 테스트(`assistant-message-error.test.tsx`)가 따로 본다. 통합 화면 에러 코드는 `integration-error-codes.test.ts` 가 코드마다 사전 키를 단언하고 매핑 값의 타입(`TranslationKey`)이 사전에 없는 키를 타입 검사에서 막는다 | 빌드 실패 |
| 5(원천 표 4행인 통합 화면 에러 토스트의 괄호에 붙는 서버 `message`, [백엔드 문구 매핑 §코드와 동적 메시지 매핑 (규칙 5)](CLE-UI-I18N-BACKEND.md#코드와-동적-메시지-매핑-규칙-5)) | 없음 | 사람 검수. 표에 코드를 더하는 리뷰에서 확인한다 |
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
- 어시스턴트 · 통합 화면 에러 매핑과 어시스턴트 SSE 백엔드 문구 표의 구현 위치는 [다국어와 화면 문구 — 백엔드 문구 매핑 §구현 위치](CLE-UI-I18N-BACKEND.md#구현-위치) 에 있다.

## Rationale

### ko/en 동등성을 빌드 실패로 강제하는 이유

한쪽 키만 더하고 다른 쪽을 잊으면, 그 로케일에서 사전 경로가 비어 키 자체(예: `"node.aiAgent.maxTurns"`)가 화면에 드러난다. 동등성 가드는 커밋 시점에 이 결손을 확실하게 막는다.

### 노드 가이드 누락을 가드로 막는 이유

사전 키 동등성 가드는 사전만 본다. 백엔드에 노드를 더하고 `02-nodes/<cat>.mdx` 카탈로그에 노드 항목을 더하는 것을 잊는 일이 가드를 통과해 뒤 변경으로 메워져 왔다. 백엔드 노드 디렉터리와 MDX 본문의 차집합 검증이 이것을 확실하게 막는다.

### 하드코딩 한국어 가드를 ratchet 으로 둔 이유

기존 코드에는 하드코딩 한국어가 남아 있어(주석·JSDoc 같은 정당한 잔존 포함) 한 번에 0 으로 만들 수 없다. baseline 허용 목록 ratchet 으로 "지금보다 늘지 않는다" 만 강제하면 점진적으로 0 에 다가갈 수 있다. ESLint 사용자 규칙은 후속 과제다.

### 영어 형제 파일 누락을 위반으로 보지 않는 이유

가이드 로케일 규약이 한국어 본문과 안내 배너 폴백을 정상 동작으로 정한다. 영어 번역은 점진적으로 늘어나는 자산이다. 형제 파일이 없다고 빌드를 실패시키면 한국어 작성까지 막혀 작성 동력이 떨어진다. 영어 비율은 경고만 하는 ratchet 으로 따로 둘 수 있다.

### 웹채팅 위젯이 메인 앱 사전 밖에서 자체 카탈로그를 쓰는 이유

위젯(`codebase/channel-web-chat`)은 따로 빌드 · 배포하는(정적 export → CDN) 독립 SPA 라 메인 앱 사전과 `translate()` 를 불러올 수 없다. 처음에는 위젯이 한국어만 보여 사전 경유의 이득이 없어 메인 앱 사전 범위 밖에 두었다. 하드코딩 ratchet 과 문서 동기화 매트릭스 가드도 위젯을 보지 않았다.

2026-07-12 위젯 화면 틀의 영어 다국어화를 시작하면서 "이득이 없다" 는 전제는 폐기됐다. 이제 위젯 화면 틀에도 ko/en 동등성이 필요하다. 그러나 물리적 분리라는 근거는 그대로라, 위젯은 메인 앱 사전으로 들어가지 않고 위젯 로컬 카탈로그와 자체 동등성 테스트를 쓴다. 이 로컬 가드가, 위젯을 보지 않던 기존 가드의 빈자리를 메운다. 문체는 계속 공유한다.

"전역 규약 + 위젯 전용 카탈로그 + 명시한 근거" 구조는 범위를 나누는 방식으로 보면 새로 만든 것이 아니다. [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 같은 위젯의 렌더링 결정에서 먼저 적용 범위를 나눈 선례("결정을 뒤집은 것이 아니라 적용 범위를 나눈 것")와 같은 방식이다. 위젯 화면 틀에 한정하며, 운영자 콘텐츠와 AI 본문의 현지화는 여전히 목표가 아니다([웹채팅](../CLE-WEBCHAT/CLE-WEBCHAT.md)). `BootConfig.locale` 활성화의 근거는 [웹채팅 SDK](../CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) 가 다룬다.

### 가이드 본문에서 NERV 키와 요구사항 ID 를 막는 이유

스펙이 NERV 로 옮겨 가면서 가이드 작성자가 다루는 내부 식별자가 옛 경로에서 NERV 키(`CLE-...`)와 서버가 발급하는 요구사항 ID(`REQ-...`)로 바뀌었다. 둘 다 사용자가 열어 볼 수 없는 내부 문서를 가리키므로 옛 경로와 같은 이유로 본문에 쓰지 않는다. 옛 가드의 앵커 ID 패턴(`CCH-…`, `R-…`)은 `REQ-SESSION-001` 같은 모양을 잡지 못해서 패턴을 따로 더했다(2026-10-02, NERV 정본 전환 단계 4b).

MDX 주석(`{/* … */}`)과 HTML 주석은 예전부터 본문 검사 밖에 있었다. 작성자가 문장의 근거 문서를 키로 적어 둘 자리라서 예외를 이 규칙에 함께 적는다. 주석은 렌더에서 빠지므로 사용자에게 보이지 않는다.

### 어시스턴트 에러 코드를 컴포넌트 지역 표로 매핑하는 이유 (2026-10-24)

→ [다국어와 화면 문구 — 백엔드 문구 매핑 §어시스턴트 에러 코드를 컴포넌트 지역 표로 매핑하는 이유 (2026-10-24)](CLE-UI-I18N-BACKEND.md#어시스턴트-에러-코드를-컴포넌트-지역-표로-매핑하는-이유-2026-10-24)

### 메신저 봇 안내 문구를 규칙 7 밖에 두는 이유 (2026-11-12)

채팅 채널의 봇 안내 문구는 메신저로 나가는 봇 메시지다. 제품 화면 문구나 사용자 가이드가 아니어서 규칙 7 의 해요체를 따르지 않는다. 한국어 기본 문구의 문체와 띄어쓰기는 [채팅 채널 데이터와 흐름 「안내 문구 기본값」](../CLE-CHAT/CLE-CHAT-DATA.md#안내-문구-기본값) 한 곳이 정하고 합쇼체로 쓴다. 사람 결정(2026-11-12, 발견 F48)이고 반영 작업은 NERV Task `CLE-T-GNTWP9` 다.
