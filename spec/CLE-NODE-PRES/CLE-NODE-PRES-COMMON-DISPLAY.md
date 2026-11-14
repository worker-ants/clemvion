---
id: "CLE-NODE-PRES-COMMON-DISPLAY"
title: "Presentation 노드 공통 — 표시 표면"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-PRES-COMMON"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-PRES", "CLE-NODE-PRES-COMMON"]
area: "CLE-NODE-PRES"
content_hash: "3ce914f3d5ecfac6d4057565ff9a6cf3a24d7b22967de33aadbc355a968d8e04"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "4f79135ec514d5c2f08a5eab6efaa73cce6b0d8354990622212e71bcdc7e9f07"
etag: "sha256-f7dce7a1926ef3d172d5343727e465a41ad22a1cf72a02791d7c9d39fd65f77b"
---
## 개요

이 문서는 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md) 의 하위 문서로 Presentation 노드 결과를 사람에게 보여 주는 표면의 규칙을 정한다. 실행 결과 드로어의 노드별 표시, 웹채팅·채팅 채널로 결과를 보내는 경로, Template 본문 정화 책임을 다룬다. 버튼 정의·포트·블로킹 모드 흐름은 부모 문서가, AI 에이전트 표시 도구가 그리는 페이로드는 [표시 도구 모드](CLE-NODE-PRES-COMMON-TOOLS.md) 가 정한다.

## 실행 결과 드로어 표시

실행이 끝난 Presentation 노드는 실행 결과 드로어에 **채팅형 기록 항목**으로 쌓인다. 항목은 실행 순서대로 쌓이고 하나씩 접고 펼 수 있다. 드로어 자체의 레이아웃과 탭은 [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 이 정한다. 이 절은 노드별로 무엇을 어떻게 보여 주는지 정한다.

### Carousel

| 항목 | 설명 |
|------|------|
| 렌더링 | **텍스트 위주 데이터 뷰**. `output.items`(동적 모드) 또는 `config.items`(정적 모드)를 가로 스크롤 목록으로 늘어놓고 슬라이드마다 제목·설명·버튼 라벨을 보여 준다. `config.layout`(card / image / minimal)은 **배지**로 보여 준다. 시각 레이아웃 재구성은 인터랙티브 채널이 맡는다([Carousel 노드](CLE-NODE-CAROUSEL.md)). 드로어는 이미 끝난 실행의 스냅샷이라 조작할 수 없으므로 시각 재현보다 데이터·이미지 매핑 확인에 맞춘다 |
| 이미지 | `imageField` 나 `image` 가 있으면 **lazy 로딩 썸네일**로 보여 주고 URL 도 확인할 수 있게 한다. 불러오지 못하면 placeholder 를 보여 준다. 여러 이미지를 한꺼번에 불러오지 않는다 |
| 빈 데이터 | "No items" 메시지와 `mode` 힌트 |
| 버튼 대기 중(`waiting_for_input`) | 카드 목록 아래에 **버튼 바**를 보여 준다. 포트 버튼을 누르면 `execution.click_button` WebSocket 명령을 보내고 그 포트로 실행이 재개된다. 링크 버튼을 누르면 새 탭에서 URL 을 열고 실행 상태는 바뀌지 않는다. 링크 버튼만 있으면 `[Continue →]` 버튼을 함께 보여 주고 누르면 `__continue__` ID 로 명령을 보낸다. 대기 기한이 없으므로 남은 시간 카운트다운을 보여 주지 않는다 |
| 버튼 클릭 후 | "Button clicked: {label}" 과 클릭 시각, 클릭한 사람 정보 |

### Table

| 항목 | 설명 |
|------|------|
| 렌더링 | `output.columns` 와 `output.rows` 를 표로 보여 준다 |
| 인터랙션 | `sortable` 컬럼 헤더를 누르면 오름차순·내림차순을 바꾼다. 페이지네이션 컨트롤 |
| 포맷 | `format` 이 있는 컬럼은 날짜·숫자 포맷을 적용한다 |
| 빈 데이터 | 컬럼 헤더와 "No data" 행 |
| 대량 데이터 | 한 번에 보여 줄 행 수는 정의가 갈린다. [미결 사항](CLE-NODE-PRES-COMMON.md#미결-사항) 참조 |
| 버튼 대기 중(`waiting_for_input`) | 표 아래에 버튼 바를 보여 준다. 동작은 Carousel 과 같다 |
| 버튼 클릭 후 | Carousel 과 같다 |

### Chart

| 항목 | 설명 |
|------|------|
| 렌더링 | 에디터는 recharts 로 `output.data` 와 `config.{chartType, title, xAxis, yAxis, colors}` 를 받아 차트를 직접 그린다. 웹채팅 위젯은 자체 SVG 렌더러로 그린다. 백엔드는 SVG 를 만들지 않는다([Chart 노드](CLE-NODE-CHART.md)) |
| 인터랙션 | 데이터 포인트에 마우스를 올리면 값 툴팁. 축 라벨(`config.xAxis.label`·`config.yAxis.label`)은 에디터가 아직 그리지 않는다(미구현, CLE-T-ETS2WE) |
| 차트 유형 | bar·line·area 는 X-Y 축 차트, pie·donut 은 라벨-값 차트 |
| 시리즈와 색 | bar·line·area 는 포인트의 `series` 이름별로 시리즈를 나눠 그리고 범례를 보여 준다. 시리즈 묶음과 색 순서는 [Chart 노드](CLE-NODE-CHART.md#시리즈와-색) 가 정한다 |
| 빈 데이터 | 그릴 포인트가 없으면 차트 대신 받은 출력 값을 JSON 으로 보여 준다. `output.data` 가 배열이 아니거나 빈 배열이거나 객체인 항목이 하나도 없는 경우다. 객체가 아닌 항목은 건너뛰고 나머지로 그린다. 빈 차트 대신 JSON 을 보여 주는 이유는 [Chart 노드](CLE-NODE-CHART.md#그릴-포인트가-없으면-에디터는-출력-값을-json-으로-보여-준다-2026-11-05) 에 있다 |
| 크기 변경 | 드로어 크기가 바뀌면 차트도 따라 바뀐다 |
| 버튼 대기 중(`waiting_for_input`) | 차트 아래에 버튼 바를 보여 준다. 동작은 Carousel 과 같다 |
| 버튼 클릭 후 | Carousel 과 같다 |

### Form

| 항목 | 설명 |
|------|------|
| 대기 중(`waiting_for_input`) | 실제 폼 UI 를 그린다. 제목, 설명(Markdown), 필드 목록, 제출 버튼. 필드 유효성 검증을 입력하는 동안 적용한다 |
| 파일 업로드 | `type: file` 필드는 드래그앤드롭과 파일 선택 UI 를 쓴다. MIME·크기 제한을 바로 검증한다. 제출 형식은 [Rationale](#파일-필드는-메타데이터만-보낸다) 을 본다 |
| 제출 | 제출 버튼을 누르면 `execution.submit_form` WebSocket 명령을 보낸다. 검증에 실패하면 에러를 보여 주고 성공하면 실행이 재개된다 |
| 제출 후 | 제출한 데이터를 키-값 표로 보여 준다. 제출 시각과 제출한 사람 정보를 함께 보여 준다 |
| 대기 기한 | 없다. 폼을 제출하거나 외부에서 실행을 취소할 때까지 기다리고 남은 시간 카운트다운을 보여 주지 않는다 |

### Template

| 항목 | 설명 |
|------|------|
| HTML 출력 | 허용 목록으로 정화한 뒤 그린다([Template 본문 정화 책임](#template-본문-정화-책임)) |
| Markdown 출력 | Markdown 을 HTML 로 바꾸고 정화한 뒤 그린다 |
| Text 출력 | 코드 블록(`<pre>`)으로 보여 준다 |
| 빈 결과 | "Empty output" 메시지 |
| 버튼 대기 중(`waiting_for_input`) | 렌더링한 내용 아래에 버튼 바를 보여 준다. 동작은 Carousel 과 같다 |
| 버튼 클릭 후 | Carousel 과 같다 |

## 웹채팅·채팅 채널 전달

버튼 없는 표시 전용 노드(Carousel·Table·Chart·Template)의 결과를 외부로 보내는 경로는 두 가지다. 같은 결과를 두 경로로 중복해서 보내지 않는다.

- 웹채팅: SSE 표시 메시지 이벤트 `execution.message` 로 받는다([EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md#표시-메시지-이벤트), [웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md#표시물-렌더)).
- 채팅 채널: 서버 안 listener 가 `execution.node.completed` 를 받아 채널 메시지로 바꾼다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md#노드와-채널-ui-매핑)). 렌더러 입력 모양은 [미결 사항](CLE-NODE-PRES-COMMON.md#미결-사항) 참조.

버튼이 있는 노드와 Form 은 `execution.waiting_for_input` 입력 대기 흐름으로 전달한다. 웹채팅 위젯은 v1 에서 첨부를 꺼 두므로 Form 파일 필드로 파일을 받지 못한다([웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md#패널)).

## Template 본문 정화 책임

[Template 노드](CLE-NODE-TEMPLATE.md)의 `output.rendered` 와 표시 도구 `render_template` 의 본문(`content`)은 정화하지 않은 데이터다. 백엔드와 표현식 해석기는 본문을 정화하거나 escape 하지 않는다. 그래서 본문을 해석하는 소비처가 자기 표면에 맞게 처리한다.

| 소비처 | 처리 |
|------|------|
| 실행 결과 드로어 | `html` 은 허용 목록으로 정화한 뒤 그린다. `markdown` 은 HTML 로 바꾸고 정화한 뒤 그린다. `text` 는 태그를 해석하지 않고 `<pre>` 에 글자로 보여 준다 |
| 웹채팅 위젯 | 드로어보다 좁은 거부 기본 허용 목록으로 정화한 뒤 그린다. 허용 목록과 링크 규칙은 [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md#마크다운html-sanitize) 이 정한다([웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md#표시물-렌더)) |
| 채팅 채널 | 본문을 HTML 로 해석하지 않으므로 HTML 정화는 하지 않는다. 채널 문법 escape 는 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 이 프로바이더별로 정한다. 지금 Telegram 렌더러는 MarkdownV2 escape 를 하고 Slack · Discord 렌더러는 Template 본문을 그대로 보낸다. 두 채널의 멘션 처리는 NERV Task `CLE-T-FQTQ7K` 가 정한다 |
| EIA 응답 · 웹훅 · 다음 노드 | 본문을 바꾸지 않고 넘긴다. 받는 쪽이 HTML 로 그리면 그쪽이 정화한다 |

정화 규칙은 다음과 같다.

- 허용 목록 방식으로 정화한다. 목록에 없는 태그와 속성(`<script>`, `<iframe>`, `<style>`, `on*` 이벤트 핸들러, `style` 속성 등)은 지운다. 정화 라이브러리는 DOMPurify 다.
- `href` · `src` 에 든 `javascript:` 같은 위험한 URL 은 지운다.
- 위 두 항목은 모든 표면이 지키는 하한이다. 실제 허용 목록은 표면마다 다르다. 웹채팅 위젯은 SVG 와 `class` 속성도 받지 않는 더 좁은 목록을 쓰고 그 정본은 [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md#마크다운html-sanitize) 이다. 드로어 목록의 정본은 `presentation-renderers.tsx` 의 `SANITIZE_CONFIG` 다.
- 본문을 HTML 로 그리는 소비처를 새로 만들면 같은 의무를 진다.

## 구현 위치

- `codebase/frontend/src/components/editor/run-results/**` (드로어 렌더러, `presentation-renderers.tsx`, `dynamic-form-ui.tsx`)
- 파일 필드: 백엔드 `formNodeConfigSchema` 의 `formFieldSchema.type` enum 과 파일 네 필드, 프런트엔드 `dynamic-form-ui.tsx` 의 `<input type="file" multiple={maxFiles > 1} accept={allowedMimeTypes.join(",")}>` 와 제출 때 `FileList` 를 메타데이터 배열로 바꾸는 코드.
- Template 본문 정화: 드로어 `presentation-renderers.tsx` 의 `SANITIZE_CONFIG` · `sanitizeHtml`, 웹채팅 위젯 `codebase/channel-web-chat/src/lib/safe-html.ts` 의 `renderTemplateHtml`.

## Rationale

### 파일 필드는 메타데이터만 보낸다

[Form 노드](CLE-NODE-FORM.md) 에 `type: 'file'` 필드의 화면 동작과 제출 payload 형식을 정한다.

**배경**: 스펙의 `formFieldSchema.type` enum 에 `'file'` 이 있고 파일 관련 네 필드(`allowedMimeTypes`·`maxFileSize`·`maxTotalSize`·`maxFiles`)도 적혀 있었다. 그런데 프런트엔드 `DynamicFormUI.renderField` 에 file 분기가 없어 텍스트 입력으로 대신 그려졌다. 화면 동작 없이 백엔드 네 필드만 스펙에 있어 기준이 어긋났다.

**제출 payload 는 메타데이터만 보낸다**: 파일 제출 payload 는 `{name, size, type, lastModified}` 객체 배열이다. base64 로 인코딩해 LLM 에 직접 넣는 안은 쓰지 않았다. 멀티모달을 지원하지 않는 모델에서는 쓸모가 없고 base64 가 1MB 한도의 대부분을 차지한다. 클라이언트에서 file 유형을 막는 안도 쓰지 않았다. 스펙 enum 에 있는 값을 UI 만 막으면 기준이 더 어긋난다.

**채택 근거**:

- 멀티모달을 지원하지 않는 모델(텍스트 전용 LLM, 이미지 전용 멀티모달 등)에서도 파일 필드는 화면에 보이고 사용자가 제출할 수 있다. LLM 은 메타데이터만 받아 "사용자가 X.pdf 를 첨부했다" 정도를 알고 텍스트로 답할 수 있다.
- 파일 본문을 LLM 에 넘겨야 하면(예: PDF 에서 뽑은 텍스트) 별도 업로드 경로나 파일 추출 노드로 다른 턴의 입력에 넣는 워크플로우 패턴으로 처리한다. 이 결정과 독립이다.
- "LLM 페이로드는 작게 둔다" 는 1MB 한도 방향과 맞는다. 파일 본문은 그것만으로 한도를 거의 다 차지할 수 있다.

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 `form_submitted` payload `{ [fieldName]: value }` 는 value 자리에 어떤 타입이든 받으므로 파일 메타데이터 배열도 들어간다. 스키마를 바꿀 필요가 없다.

### Template 본문은 그리는 쪽이 정화한다 (2026-11-12)

**배경**: 이 문서의 원문은 드로어가 Template HTML 을 "샌드박스 iframe 안에서 그린다" 고 적었고 [Template 노드](CLE-NODE-TEMPLATE.md)는 정화를 "별도 보안 과제" 로 미뤄 두었다. 코드와 대조하니 드로어는 iframe 없이 DOMPurify 허용 목록으로 정화한 뒤 그리고, 웹채팅 위젯은 더 좁은 허용 목록으로 따로 정화한다. 백엔드는 정화하지 않는다. 문서만 보면 정화 책임이 어디에 있는지 알 수 없었다(NERV Task `CLE-T-MBGDA4`).

**결정**: 사용자가 2026-11-12 에 소비 쪽 정화 의무를 규약으로 적는 안을 골랐다(NERV 질문 `01a1cd71-0bab-70ba-9168-49e83c564256`). 지금 코드와 같은 동작이라 코드 변경은 없다.

**기각한 대안**:

- **백엔드가 `output.rendered` 를 정화한다**: 본문은 HTML 로 그리는 화면 말고도 채팅 채널, EIA 응답, 웹훅, 다음 노드로 나간다. 서버에서 HTML 기준으로 정화하면 이 경로의 본문까지 바뀐다. 예를 들어 다음 노드가 본문을 이메일 HTML 로 쓰면 `style` 같은 정상 마크업이 지워지고, Text · Markdown 본문에 꺾쇠 괄호로 쓴 글자가 지워지거나 바뀐다. 표면마다 허용 목록도 다르다(웹채팅 위젯이 드로어보다 좁다). 그래서 서버 정화 하나로 소비 쪽 정화를 없앨 수 없다. 백엔드에는 서버용 DOM 구현과 정화 라이브러리라는 새 의존성도 생긴다.
- **백엔드와 소비처가 둘 다 정화한다**: 첫 대안의 본문 훼손 문제가 그대로 남는다. 소비 쪽 정화는 어차피 있어야 하므로 이 안은 첫 대안의 비용을 그대로 지고 얻는 것은 중복 방어뿐이다.

채팅 채널의 멘션 · 채널 문법 처리는 HTML 정화와 다른 문제라 이 결정에 넣지 않았다. NERV Task `CLE-T-FQTQ7K` 가 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 에서 정한다.
