---
id: "CLE-NODE-FORM-FIELDS"
title: "Form 노드 — 필드 정의와 파일 필드"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-FORM"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-PRES", "CLE-NODE-FORM"]
area: "CLE-NODE-PRES"
content_hash: "d002af8702f545a7577145b3214494ef82f5029ae6509ea514c86989130200bb"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "d82a618a2fd0485ee0e7ba34ee0d7240951079d066aeb2fc16eb201f79031760"
etag: "sha256-904804319673724d1047c7fe4e098ce801f14a4c8d6a3887001f1585b3b06104"
---
## 개요

이 문서는 [Form 노드](CLE-NODE-FORM.md) 의 하위 문서로 폼 필드(`FormField`)와 검증 규칙(`ValidationRule`)의 구조, 검증 preset 카탈로그, `type: 'file'` 필드의 제약 기본값 · 화면 동작 · 제출 payload 를 정한다. 노드 설정 최상위 필드, 제출 검증 위치와 에러 처리, 출력 구조는 부모 문서가 정한다.

## FormField 구조

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | String | ✓ | 필드 식별자. 제출 데이터(`output.interaction.data`)의 키 |
| `type` | Enum | ✓ | `text` / `number` / `email` / `textarea` / `select` / `checkbox` / `radio` / `date` / `file` |
| `label` | String | ✓ | 필드 라벨 |
| `required` | Boolean? | | 폼 **사용자** 입력을 강제할지(기본 `false`). 폼 제출 검증이다. `config.fields` 를 1개 이상 정의해야 하는 설정 필수성(설정 패널의 별표 `config.fields.ui.required`)과는 다른 층이다 |
| `options` | Option[]? | | `select`·`radio`·`checkbox` 선택지(`{ label, value }`). `value` 가 빈 문자열·`null`·`undefined` 이면 표시 도구 `render_form` 에 한해 백엔드가 결정적 값 `opt-{fieldIdx}-{optIdx}` 로 채운다([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#스키마-위반-처리와-정규화)). 사용자가 직접 설정한 빈 value 는 프런트엔드가 입력 때 막는다 |
| `defaultValue` | Any? | | 기본값. 표현식을 쓸 수 있다 |
| `validation` | ValidationRule? | | 유효성 검증 규칙 |
| `allowedMimeTypes` | String[]? | | `type: 'file'` 전용. 허용 MIME 목록. 없으면 기본 14종 |
| `maxFileSize` | Number? | | `type: 'file'` 전용. 파일 하나의 최대 크기(MB). 없으면 10 |
| `maxTotalSize` | Number? | | `type: 'file'` 전용. 필드 안 전체 파일 합계 최대 크기(MB). 없으면 50 |
| `maxFiles` | Number? | | `type: 'file'` 전용. 필드당 최대 파일 수. 없으면 5 |

파일 옵션 네 개는 `formFieldSchema`(`form.schema.ts:71-74`)에서 모두 `optional()` 이고 zod 기본값이 없다. 파일이 아닌 필드의 설정 에코가 이 값으로 오염되지 않게 하려는 것이다. 대신 **`type: 'file'` 필드에만** 정규화 단계(`form-mode.ts` 의 `extractFormFields`)가 빈 옵션에 공유 기본값(MIME 14종, 10MB, 50MB, 5개)을 넣고 서버 검증(`validateFileField`)과 클라이언트 가드(`DynamicFormUI`)가 이 값을 강제한다. MB 비교는 `1024×1024` 바이트 기준이다. 기본값 상수의 단일 기준은 백엔드 `form-mode.ts` 의 `DEFAULT_FILE_*` 이고 프런트엔드 `dynamic-form-ui.tsx` 가 같은 값을 쓴다.

## ValidationRule 구조

| 필드 | 타입 | 설명 |
|------|------|------|
| `minLength` | Number? | 최소 길이(`text`, `textarea`) |
| `maxLength` | Number? | 최대 길이(`text`, `textarea`) |
| `min` | Number? | 최솟값(`number`) |
| `max` | Number? | 최댓값(`number`) |
| `pattern` | String? | 정규식 패턴 |
| `preset` | ValidationPreset? | **미구현.** 미리 정의한 검증 카탈로그. `pattern` 보다 먼저 쓴다. 채팅 채널 같은 외부 어댑터가 UI 힌트를 뽑는 데 쓴다 |
| `message` | String? | 검증 실패 에러 메시지 |

`preset` 은 지금 `validationRuleSchema`(`form.schema.ts:20-29`)에 **없다**(스키마에는 `minLength`·`maxLength`·`min`·`max`·`pattern`·`message` 만 있다). 카탈로그 · 서버 정규식 · 어댑터 UI 힌트 코드도 없다. 아래 카탈로그는 **계획**이다.

## ValidationPreset 카탈로그(미구현)

정규식 대신 이름으로 뜻을 알 수 있는 preset 으로 의도를 적는다. 사용자는 정규식을 쓰지 않아도 되고 외부 어댑터(예: [Telegram 어댑터](../CLE-CHAT/CLE-CHAT-TELEGRAM.md))는 preset 이름으로 UI 힌트(연락처 공유 키보드 등)를 뽑을 수 있다.

| preset | 적용 유형 | 의도 | 서버 검증 정규식 | 어댑터 UI 힌트 |
|---|---|---|---|---|
| `phone` | `text` | 전화번호. 국제 형식 허용(`+`, 숫자, 공백, `-`, `()`) | `^\+?[\d\s\-()]+$`(1자 이상) | Telegram: `request_contact: true`(연락처 공유 버튼). Slack·Discord: 텍스트 입력과 어댑터 형식 검증(연락처 공유 없음). 지원하지 않는 채널 프로바이더: 일반 텍스트 입력 |

계획상 v1 카탈로그는 1종이다. URL·datetime 같은 다음 preset 은 쓰임이 생기면 더한다. 계획상 `preset` 과 `pattern` 이 함께 있으면 `preset` 을 먼저 쓴다. `message` 가 없으면 preset 별 기본 메시지를 쓴다(`phone` → "전화번호 형식이 올바르지 않습니다.").

채널 어댑터의 `phone` 힌트는 preset 을 도입할 때 함께 구현할 대상이다. 지금은 세 어댑터 모두 preset 이 없어 일반 `text` 필드로 묻는다([Telegram 어댑터](../CLE-CHAT/CLE-CHAT-TELEGRAM.md), [Slack 어댑터](../CLE-CHAT/CLE-CHAT-SLACK.md), [Discord 어댑터](../CLE-CHAT/CLE-CHAT-DISCORD.md)).

URL 검증 preset 도 없다. Discord 채널은 v1 에서 파일 업로드를 받지 못해 외부 저장소 URL 을 URL preset 없는 일반 `text` 필드로 받는다([Discord 어댑터](../CLE-CHAT/CLE-CHAT-DISCORD.md)).

**`type: 'file'` 의 `allowedMimeTypes` 기본값**(문서와 이미지만 허용):

```json
[
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv"
]
```

실행 파일(`.exe`, `.sh`), 스크립트(`.js`, `.py`), 압축 파일(`.zip`, `.tar.gz`)은 기본 허용 목록에 없다. 필요하면 `allowedMimeTypes` 를 직접 넓힌다.

## 파일 필드 동작

`type: 'file'` 필드의 프런트엔드 렌더와 제출 payload 형식이다.

**UI 렌더**(`DynamicFormUI` 의 `renderFileField`·`validateFilesClient`):

- 입력 요소는 `<input type="file" accept={(allowedMimeTypes ?? []).join(",") || undefined} multiple={(maxFiles ?? 1) > 1}>` 다(`dynamic-form-ui.tsx`).
  - `maxFiles` 가 1이거나 없으면 파일 하나만, 1보다 크면 여러 개를 고른다.
  - `accept` 는 사용자가 적은 `allowedMimeTypes` 를 쉼표로 이어 붙이고 없으면 두지 않는다. 아래 클라이언트 가드는 없는 필드에 기본 MIME 목록을 적용한다.
- **제출 전 클라이언트 가드**: `onChange` 는 `FileList` 를 필드 상태에 넣기 **전에** `validateFilesClient` 로 검사하고 위반이면 선택을 거부한다. 검사 순서는 서버 `validateFileField` 와 같고 필드에 적지 않은 제약은 기본값을 쓴다.
  - `allowedMimeTypes`(없으면 기본 14종)와 맞지 않으면 바로 거부하고 "허용되지 않은 파일 형식입니다." 를 보여 준다.
  - 파일 하나가 `maxFileSize`(MB)보다 크면 거부하고 "파일 크기는 {N}MB 이하여야 합니다." 를 보여 준다.
  - 합계가 `maxTotalSize`(MB)보다 크면 거부하고 "전체 파일 크기는 {N}MB 이하여야 합니다." 를 보여 준다.
  - 고른 개수가 `maxFiles` 보다 많으면 거부하고 "최대 {N}개까지 업로드할 수 있습니다." 를 보여 준다.
- 검증에 실패하면 선택 자체를 거부한다. 고른 파일은 필드 상태에 들어가지 않고 파일 입력도 비운다. 에러 문구는 필드 아래에 보여 주고 제출 버튼은 켜진 채로 둔다.

메시지는 서버와 클라이언트가 함께 쓰는 **기본 메시지**다. `validation.message` 로 바꾸는 기능은 v1 에서 파일 필드에 적용하지 않고 일반 필드도 지금은 기본 메시지를 쓴다. 메시지 바꾸기는 두 필드 공통의 다음 과제다.

**제출 payload(메타데이터만):**

폼을 제출하면 프런트엔드는 파일 필드의 `FileList` 를 **메타데이터 객체 배열**로 바꿔 `execution.submit_form` 본문의 `formData[<fieldName>]` 에 넣는다.

```json
{
  "<fieldName>": [
    { "name": "report.pdf", "size": 524288, "type": "application/pdf", "lastModified": 1716470400000 },
    { "name": "image.png", "size": 102400, "type": "image/png", "lastModified": 1716470500000 }
  ]
}
```

| 필드 | 출처 | 설명 |
|------|------|------|
| `name` | `File.name` | 파일 이름(확장자 포함) |
| `size` | `File.size` | 바이트 크기 |
| `type` | `File.type` | MIME 타입. `allowedMimeTypes` 검증을 통과한 값 |
| `lastModified` | `File.lastModified` | UNIX epoch 밀리초 |

파일 **내용(바이너리)** 은 LLM 에 넘기지 않는다. 멀티모달을 지원하지 않는 모델과의 호환, 1MB 출력 크기 한도 보호, 별도 바이너리 업로드 채널이 정해질 때까지의 보류가 이유다([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#파일-필드는-메타데이터만-보낸다)).

`maxFiles == 1` 이어도 **길이 1 배열**로 보내므로 `formData[fieldName]` 은 늘 배열이다. 아무것도 고르지 않으면 `[]` 다. `required: true` 인 필드가 빈 배열이면 "필수 필드 미입력" 검증 실패다.

**어댑터마다 다른 파일 payload 모양**: 위 `{name, size, type, lastModified}` 는 워크스페이스 UI(`DynamicFormUI`) 경로의 형식이다. 채팅 채널 어댑터를 거친 파일 입력은 채널 프로바이더마다 다른 모양으로 같은 자리(`formData[fieldName]` → `output.interaction.data.<fieldName>`)에 들어온다. 예를 들어 Slack 은 `{ fileId, filename, mimeType, urlPrivate }` 다([Slack 어댑터](../CLE-CHAT/CLE-CHAT-SLACK.md)). 서버 파일 검증(`validateFileField`)은 메타데이터 경로(`size`·`type`)를 대상으로 하고 `size`·`type` 이 없는 다른 모양(Slack 등)은 건너뛴다(이유는 [Rationale](#파일-검증은-묶음으로-따로-구현했다)).

**재개 출력**: 위 메타데이터 배열이 그대로 `output.interaction.data.<fieldName>` 에 들어간다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 `form_submitted` payload 는 value 에 어떤 값이든 받는다). AI 에이전트 `render_form` 의 도구 결과 content(`{ok:true, type:'form_submitted', data:{…}, message:'<재호출 금지 안내문>'}`)에도 같은 메타데이터 배열이 `data` 안에 직렬화되어 LLM 에 돌아간다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)).

## Rationale

### 파일 검증은 묶음으로 따로 구현했다

숫자 범위와 정규식 검증은 공유 일반 필드 validator 를 넓히면 세 경로에 바로 적용됐다. `type: 'file'` 검증은 따로 **묶음**으로 구현했다. 함수 하나가 아니라 공유 기본값 상수(MIME 14종, 10MB·50MB, 개수 5), 서버 검사(`validateFileField`), 프런트엔드 거부, 재대기 흐름이 함께 와야 의미가 있기 때문이다. 파일은 메타데이터만 보내므로 검증 대상도 메타데이터 필드(`size`·`type`)와 개수로 한정된다.

파일 검증은 일반 필드 묶음 검증(`validateFormSubmission`)이 아니라 `assertFormSubmissionValid` 의 한 번 훑기 안에서 `validateFileField` 로 한다. 일반 필드 검증과 달리 **채팅 채널 모달 경로에는 적용하지 않는다**. 파일 필드는 네이티브 모달에 넣지 않아(`isFieldModalCompatible` 에서 제외, [채팅 채널 어댑터 규약 「Form 입력 흐름」](../CLE-CHAT/CLE-CHAT-ADAPTER.md#form-입력-흐름)) 모달 검증(`hooks.service` 의 `validateFormSubmission`)에 닿지 않기 때문이다. 그래서 파일 검증의 단일 기준 지점은 publisher `assertFormSubmissionValid` 이고 대상은 워크스페이스 UI 의 메타데이터 payload 다.

일반·파일 필드를 한 번에 훑게 되면서 EIA·WebSocket 의 타입 있는 값을 한꺼번에 문자열로 바꾸던 `coerceFormSubmission` 은 없애고 필드별 `coerceFormValue`(일반 필드 전용)로 바꿨다. 파일은 원래 메타데이터 배열을 그대로 `validateFileField` 에 넘겨야 하므로 한꺼번에 문자열로 바꾸는 방식이 더는 단일 진입점이 될 수 없다.
