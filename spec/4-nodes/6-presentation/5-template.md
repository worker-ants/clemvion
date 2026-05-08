# Spec: Template

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md)

Handlebars 스타일 템플릿으로 입력 데이터를 바인딩하여 리치 텍스트/HTML/Markdown 콘텐츠를 생성한다.

ButtonDef / 포트 토폴로지 / Blocking 모드 / 출력 포맷은 [공통 규약](./0-common.md) 참조.

---

## 1. Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| template | String | ✓ | — | Handlebars 문법 템플릿 문자열 |
| outputFormat | Enum | ✗ | html | `html` / `markdown` / `text` |
| helpers | Boolean | ✗ | true | 내장 Handlebars 헬퍼 활성화 |
| buttons | ButtonDef[] | ✗ | `[]` | 버튼 정의 배열. 비어있지 않으면 Blocking Mode 활성화. ButtonDef 구조는 [공통 §1](./0-common.md#1-buttondef-구조) |

> 버튼 클릭 시까지 무제한 대기합니다. (외부 cancel/종료 외에는 타임아웃이 발생하지 않습니다.)

**내장 헬퍼:**

| 헬퍼 | 설명 | 예시 |
|------|------|------|
| `{{#if}}` | 조건부 렌더링 | `{{#if user.active}}...{{/if}}` |
| `{{#each}}` | 배열 반복 | `{{#each items}}...{{/each}}` |
| `{{#unless}}` | 부정 조건 | `{{#unless error}}...{{/unless}}` |
| `{{formatDate}}` | 날짜 포맷팅 | `{{formatDate createdAt "YYYY-MM-DD"}}` |
| `{{formatNumber}}` | 숫자 포맷팅 | `{{formatNumber price "0,0.00"}}` |
| `{{truncate}}` | 문자열 자르기 | `{{truncate description 100}}` |
| `{{uppercase}}` | 대문자 변환 | `{{uppercase status}}` |
| `{{lowercase}}` | 소문자 변환 | `{{lowercase tag}}` |
| `{{json}}` | JSON 문자열화 | `{{json data}}` |

## 2. 포트 정의

[공통 §2 포트 토폴로지](./0-common.md#2-포트-토폴로지-non-blocking-vs-blocking) 참조.

## 3. 실행 로직

1. 입력 데이터를 Handlebars 컨텍스트로 바인딩
2. `helpers` 활성화 시 내장 헬퍼 등록
3. 템플릿 컴파일 및 렌더링
4. `outputFormat`에 따른 후처리 (HTML 새니타이징, Markdown→HTML 변환 등)
5. 렌더링 결과 생성
6. **Blocking Mode** (`buttons`가 비어있지 않은 경우): [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) 흐름. 외부 cancel/종료 전까지 무제한 대기.
7. **Non-blocking** (`buttons`가 비어있는 경우): `out` 포트로 출력 전달

## 4. 출력 형식

[공통 §4 출력 포맷](./0-common.md#4-출력-포맷-principle-11--43--45) 참조. `output.rendered` 는 expression resolver 가 치환한 **런타임** 결과. 원본 템플릿 문자열과 `outputFormat` 은 `config` 에 echo된다.

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>{{title}}</h1><p>Total: {{count}}</p>"
  },
  "output": {
    "rendered": "<h1>Monthly Report</h1><p>Total: 1,234</p>…"
  }
}
```

버튼이 설정된 경우 `status:'waiting_for_input'` → `status:'resumed'` + `output.interaction.*` 흐름 (CONVENTIONS §4.5) 을 따른다.

## 5. 설정 UI

```
┌──────────────────────────────┐
│  Template Settings                   │
│  ────────────────────────────── │
│  Output Format: [html ▼]            │
│  ☑ Enable Built-in Helpers           │
│  ────────────────────────────── │
│  Template:                           │
│  ┌──────────────────────────────┐│
│  │ 1│ <h1>{{title}}</h1>            ││
│  │ 2│ <p>Generated: {{formatDate .. ││
│  │ 3│                                ││
│  │ 4│ {{#each items}}               ││
│  │ 5│   <div class="item">         ││
│  │ 6│     <h2>{{this.name}}</h2>    ││
│  │ 7│     <p>{{this.desc}}</p>      ││
│  │ 8│   </div>                      ││
│  │ 9│ {{/each}}                     ││
│  └──────────────────────────────┘│
│                                      │
│  ─── Rendered Preview ──────────── │
│  ┌──────────────────────────────┐│
│  │ Monthly Report                    ││
│  │ Generated: 2026-03-29            ││
│  │                                   ││
│  │ Item A                            ││
│  │ Description of item A            ││
│  └──────────────────────────────┘│
└──────────────────────────────┘
```

- 코드 에디터: Handlebars 구문 강조, `{{` 입력 시 입력 데이터 필드 자동완성
- 하단 Rendered Preview: 마지막 실행 데이터 기준 렌더링 결과 미리보기

## 6. 버튼 설정 UI

[Carousel §6](./1-carousel.md#6-버튼-설정-ui) 와 동일한 접이식 "Buttons" 섹션을 Template 설정 UI 하단에 추가한다.
