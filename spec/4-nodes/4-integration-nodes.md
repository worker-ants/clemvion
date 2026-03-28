# Spec: Integration 노드

> 관련 문서: [PRD Integration 노드](../../prd/3-node-system.md#6-integration-노드-7종) · [PRD 통합/연동](../../prd/4-integration.md) · [Spec 노드 개요](./0-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 데이터 모델](../1-data-model.md)

---

## 1. 공통 패턴

### 1.1 Integration 참조

모든 서비스 특화 Integration 노드는 `integrationId` 설정을 통해 Integration 엔티티(spec/1-data-model.md §2.10)에 저장된 인증 정보를 참조한다.

| 설정 필드 | 타입 | 설명 |
|-----------|------|------|
| integrationId | UUID | FK → Integration. 설정 UI에서 드롭다운으로 선택 |

### 1.2 Integration 선택 UI

- 노드 설정 패널 상단에 Integration 선택 드롭다운 표시
- 워크스페이스에 등록된 해당 서비스 타입의 Integration만 필터링하여 표시
- 개인/조직 Integration 구분 표시
- 연결 상태(connected/expired/error) 배지 표시
- "새 Integration 추가" 링크 → Integration 관리 화면으로 이동

### 1.3 공통 출력 구조

모든 Integration 노드의 기본 출력 구조:

```json
{
  "data": { ... },
  "meta": {
    "statusCode": 200,
    "duration_ms": 150,
    "integration": "my-slack-bot"
  }
}
```

---

## 2. HTTP Request

범용 HTTP 요청 노드. 인증 없이 사용하거나 Integration을 참조하여 인증 헤더를 자동 주입할 수 있다.

### 2.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| method | Enum | ✓ | GET | GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS |
| url | String (표현식) | ✓ | — | 요청 URL |
| authentication | Enum | ✓ | none | none / integration / custom |
| integrationId | UUID | — | — | authentication=integration 시 필수 |
| headers | KeyValue[] | — | [] | 요청 헤더 |
| queryParams | KeyValue[] | — | [] | URL 쿼리 파라미터 |
| body | Object | — | — | 요청 본문 |
| bodyType | Enum | — | json | json / form-data / x-www-form-urlencoded / raw / binary |
| responseType | Enum | — | json | json / text / binary |
| timeout | Integer | — | 30000 | 요청 타임아웃 (ms) |
| followRedirects | Boolean | — | true | 리다이렉트 따라가기 |
| verifySsl | Boolean | — | true | SSL 인증서 검증 |

### 2.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Success | 출력 | `success` | HTTP 2xx 응답 시 |
| Error | 출력 | `error` | HTTP 4xx/5xx 또는 네트워크 에러 시 |

### 2.3 출력 구조

**Success 포트:**
```json
{
  "data": { "response_body": "..." },
  "meta": {
    "statusCode": 200,
    "headers": { ... },
    "duration_ms": 250
  }
}
```

**Error 포트:**
```json
{
  "error": {
    "statusCode": 500,
    "message": "Internal Server Error",
    "body": { ... }
  },
  "meta": {
    "duration_ms": 100
  }
}
```

### 2.4 설정 UI

- Method 드롭다운 + URL 입력 필드 (한 줄)
- Authentication 선택: None / Integration (드롭다운) / Custom (직접 헤더 입력)
- 탭: Headers, Query Params, Body, Advanced
- Body 탭: bodyType에 따라 JSON 에디터 / Key-Value 폼 전환
- Advanced 탭: timeout, followRedirects, verifySsl

---

## 3. Database Query

SQL 쿼리를 실행하여 데이터베이스에서 데이터를 조회하거나 조작한다.

### 3.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | DB Integration 참조 |
| query | String (표현식) | ✓ | — | SQL 쿼리 |
| parameters | Array | — | [] | 파라미터 바인딩 (`$1`, `$2`, ...) |
| queryType | Enum | ✓ | select | select / insert / update / delete / raw |

### 3.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | 쿼리 결과 |

### 3.3 출력 구조

**SELECT:**
```json
{
  "data": {
    "rows": [ { "id": 1, "name": "..." }, ... ],
    "rowCount": 42
  }
}
```

**INSERT/UPDATE/DELETE:**
```json
{
  "data": {
    "affectedRows": 5
  }
}
```

### 3.4 설정 UI

- Integration 선택 드롭다운 (DB 타입만 필터)
- Query Type 드롭다운
- SQL 에디터 (구문 강조, 줄 번호)
- Parameters 섹션: 순서 기반 바인딩 (`$1`, `$2`) — 각 파라미터에 표현식 입력

---

## 4. Slack

Slack API를 호출하여 메시지 전송, 채널 관리 등을 수행한다.

### 4.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | Slack Integration 참조 |
| action | Enum | ✓ | send_message | send_message / update_message / add_reaction / list_channels / upload_file |
| actionConfig | JSONB | ✓ | — | 액션별 설정 (아래 참조) |

**actionConfig by action:**

| action | actionConfig 필드 |
|--------|-------------------|
| send_message | `channel` (String), `text` (String, 표현식), `blocks` (JSON?, Block Kit) |
| update_message | `channel`, `ts` (메시지 타임스탬프), `text`, `blocks` |
| add_reaction | `channel`, `ts`, `emoji` (String) |
| list_channels | `types` (public_channel, private_channel), `limit` |
| upload_file | `channels` (String[]), `filename`, `content` 또는 `fileUrl` |

### 4.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | Slack API 응답 |

### 4.3 설정 UI

- Integration 선택 드롭다운
- Action 드롭다운
- Action별 동적 폼:
  - send_message: 채널 검색/선택 드롭다운 + 텍스트 입력 + Block Kit 에디터(고급)
  - upload_file: 채널 다중 선택 + 파일명 + 내용/URL 입력

---

## 5. Google Sheets

Google Sheets API를 호출하여 스프레드시트 데이터를 읽고 쓴다.

### 5.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | Google Integration 참조 |
| action | Enum | ✓ | read_rows | read_rows / append_rows / update_rows / get_sheet_info |
| spreadsheetId | String | ✓ | — | 스프레드시트 ID |
| range | String | — | — | 시트 및 범위 (예: "Sheet1!A1:D10") |
| actionConfig | JSONB | — | — | 액션별 추가 설정 |

**actionConfig by action:**

| action | actionConfig 필드 |
|--------|-------------------|
| read_rows | `hasHeader` (Boolean, 기본 true), `valueRenderOption` (FORMATTED_VALUE / UNFORMATTED_VALUE) |
| append_rows | `rows` (Array), `valueInputOption` (RAW / USER_ENTERED) |
| update_rows | `rows` (Array), `valueInputOption` |
| get_sheet_info | (없음) |

### 5.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | 시트 데이터/결과 |

### 5.3 설정 UI

- Integration 선택 드롭다운
- Spreadsheet ID 입력 (검색/브라우저 가능하면 권장)
- Action 드롭다운
- Range 입력
- Action별 동적 폼

---

## 6. GitHub

GitHub API를 호출하여 Issue, PR, Comment 등을 관리한다.

### 6.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | GitHub Integration 참조 |
| action | Enum | ✓ | create_issue | create_issue / update_issue / get_issue / create_pr / get_pr / add_comment |
| owner | String | ✓ | — | 리포지토리 소유자 |
| repo | String | ✓ | — | 리포지토리 이름 |
| actionConfig | JSONB | ✓ | — | 액션별 설정 |

**actionConfig by action:**

| action | actionConfig 필드 |
|--------|-------------------|
| create_issue | `title`, `body`, `labels` (String[]), `assignees` (String[]) |
| update_issue | `issue_number`, `title`, `body`, `state`, `labels`, `assignees` |
| get_issue | `issue_number` |
| create_pr | `title`, `body`, `head` (브랜치), `base` (브랜치) |
| get_pr | `pull_number` |
| add_comment | `issue_number` 또는 `pull_number`, `body` |

### 6.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | GitHub API 응답 |

### 6.3 설정 UI

- Integration 선택 드롭다운
- Owner / Repo 입력 (자동완성)
- Action 드롭다운
- Action별 동적 폼

---

## 7. Send Email

SMTP를 통해 이메일을 발송한다.

### 7.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | SMTP Integration 참조 |
| to | String[] (표현식) | ✓ | — | 수신자 이메일 목록 |
| cc | String[] | — | [] | 참조 |
| bcc | String[] | — | [] | 숨은 참조 |
| subject | String (표현식) | ✓ | — | 제목 |
| body | String (표현식) | ✓ | — | 본문 |
| bodyType | Enum | — | text | text / html |
| attachments | Attachment[] | — | [] | 첨부 파일 목록 |

**Attachment 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| filename | String | 파일명 |
| content | String (Base64) 또는 URL | 파일 내용 또는 다운로드 URL |

### 7.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | 발송 결과 |

### 7.3 출력 구조

```json
{
  "data": {
    "messageId": "<message-id@smtp.example.com>",
    "accepted": ["user@example.com"],
    "rejected": []
  }
}
```

### 7.4 설정 UI

- Integration 선택 드롭다운 (SMTP 타입만 필터)
- To / CC / BCC: 이메일 칩 입력 (표현식 지원)
- Subject 입력
- Body: 텍스트/HTML 탭 전환, HTML 시 리치 에디터 제공
- Attachments: 파일 추가 UI

---

## 8. Google Drive

Google Drive API를 호출하여 파일을 업로드, 다운로드, 관리한다.

### 8.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | Google Integration 참조 |
| action | Enum | ✓ | list_files | upload_file / download_file / list_files / delete_file |
| folderId | String | — | root | 대상 폴더 ID |
| fileId | String | — | — | 대상 파일 ID (download/delete 시 필수) |
| actionConfig | JSONB | — | — | 액션별 추가 설정 |

**actionConfig by action:**

| action | actionConfig 필드 |
|--------|-------------------|
| upload_file | `filename`, `content` 또는 `sourceUrl`, `mimeType` |
| download_file | (없음 — fileId만 필요) |
| list_files | `query` (Drive 검색 쿼리), `pageSize`, `orderBy` |
| delete_file | (없음 — fileId만 필요) |

### 8.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | Drive API 응답 |

### 8.3 설정 UI

- Integration 선택 드롭다운
- Action 드롭다운
- 폴더 브라우저 (트리 형태 또는 ID 직접 입력)
- Action별 동적 폼
