# 정식 규약 준수 검토 결과

- 검토 모드: `--impl-prep`
- 검토 대상: `spec/5-system/15-chat-channel.md`
- 검토 기준: `spec/conventions/**`
- 검토 일시: 2026-05-23

---

## 발견사항

### [INFO] 문서 구조 — `## Overview` 하위의 섹션 번호 체계 혼용

- target 위치: `spec/5-system/15-chat-channel.md`, line 7 `## Overview (제품 정의)` 아래 `### 1. 개요` / `### 2. 사용 시나리오` / `### 3. 요구사항`, 이후 본문 `## 3. 처리 흐름` / `## 4. 데이터 모델` …
- 위반 규약: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장. 별도 spec 파일 구조 컨벤션에는 구체적인 섹션 번호 부여 방식이 명문화되어 있지 않음.
- 상세: `## Overview` 안의 소제목이 `### 1. 개요` / `### 2. 사용 시나리오` / `### 3. 요구사항` 으로 번호를 달고 있으나, 이후 본문의 최상위 섹션이 `## 3. 처리 흐름` 부터 시작하여 Overview 내부 번호와 충돌한다. 동일 spec 문서군(`12-webhook.md`, `14-external-interaction-api.md`)의 관례 확인 시 본문 섹션 번호가 1부터 시작하는 패턴을 사용하는 파일도 있어 일관성 차이가 있다. 기능적 문제는 없으나 가독성 혼란.
- 제안: Overview 내부 소제목 번호를 제거하거나(`### 개요`, `### 사용 시나리오`, `### 요구사항`), 본문 최상위 섹션 번호를 Overview 와 독립적인 체계로 명확히 구분하는 것을 권장. 규약 자체에 번호 체계 세부 규칙이 없으므로 이는 규약 갱신보다 이 파일 내 통일이 적절.

---

### [INFO] 문서 구조 — `## 5. Identity / 보안` 의 h2 번호 레이블 오류

- target 위치: `spec/5-system/15-chat-channel.md`, line 220 `## 5. Identity / 보안`
- 위반 규약: CLAUDE.md — 문서 내 3섹션(Overview / 본문 / Rationale) 권장. 형식 규약 파일은 별도 없음.
- 상세: `## 4. 데이터 모델` 다음이 `## 5. Identity / 보안` 이고, 이 섹션 아래에는 `### 5.4 Bot Token Rotation API 응답 계약` → `### 5.4.1` → `### 5.4.2` → `### 5.5 Inbound HTTP Contract` 순으로 이어진다. 하지만 `## 5` 섹션 제목이 "Identity / 보안"임에도, `5.4.1 Bot Token 변경 single-path 정책` 및 `5.5 Inbound HTTP Contract` 는 보안보다는 API 계약에 가깝다. 섹션 명칭과 내용 사이의 의미 불일치가 있다.
- 제안: `## 5` 를 `## 5. 보안 / API 계약` 으로 확장하거나, `5.5 Inbound HTTP Contract` 를 `## 6` 으로 승격 분리. 기능적 블로커 아님.

---

### [INFO] 에러 코드 표기 — `VALIDATION_ERROR` vs `details.field` 형식

- target 위치: `spec/5-system/15-chat-channel.md`, line 279 — `400 VALIDATION_ERROR (details.field='botTokenRef')` 표기
- 위반 규약: `spec/5-system/2-api-convention.md §5.3` 에러 응답 형식: `details` 는 배열 `[{ field, message }]` 형태로 정의됨.
- 상세: API Convention §5.3 의 예시에서 `details` 는 `[ { "field": "name", "message": "..." } ]` 배열이다. 본 spec 의 line 279 는 `details.field='botTokenRef'` 라고 단수 점 표기로 언급하는데, 이는 배열 형식과 외관상 충돌한다. 실제 구현에서는 배열 원소로 표현해야 하며 spec 설명 문구가 혼동을 줄 수 있다.
- 제안: `400 VALIDATION_ERROR (details: [{ field: 'botTokenRef', message: '...' }])` 형태로 API Convention §5.3 배열 형식과 정렬하도록 표기 수정.

---

### [INFO] 에러 코드 표기 — `error.code` 형식의 일관성

- target 위치: `spec/5-system/15-chat-channel.md`, line 261-267 에러 표 (§5.4)
- 위반 규약: `spec/conventions/node-output.md §3.2` — `code` 는 `UPPER_SNAKE_CASE`. `spec/5-system/2-api-convention.md §5.3` 에서도 `VALIDATION_ERROR` 예시.
- 상세: 에러 코드들 (`TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`) 은 모두 `UPPER_SNAKE_CASE` 를 따른다. 규약 준수 확인됨. 별도 위반 없음.
- 제안: 현재 정상. 참고용 기재.

---

### [INFO] 섹션 순서 — Rationale 내 `R-K` 항목의 위치

- target 위치: `spec/5-system/15-chat-channel.md`, 끝에서 두 번째 섹션 (line 508) `### R-K. chat_channel_token_v2 컬럼 명명의 semantic 비대칭 (2026-05-21)`
- 위반 규약: CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" — 내부 순서에 대한 규약은 없음.
- 상세: Rationale 섹션 안에서 항목들이 `R1`, `R2`, …, `R9`, `Rationale ID 컨벤션 (2026-05-23)`, `R-CC-10`, `R-CC-11`, `R-CC-12`, `R-K` 순으로 나열되어 있다. `R-K` 는 날짜 기준으로 2026-05-21 로 오래된 항목인데 맨 마지막에 위치해 시간순 정렬이 아니다. 이는 이미 spec 내 Rationale 에 "기존 R1~R9 / R-K 는 하위 호환 위해 그대로 유지" 라고 설명하고 있어 의도된 배치. 기능적 문제 없음.
- 제안: 현 배치는 의도된 것. 다만 새 R-CC-N 항목과 구형 R-K 의 공존이 혼돈될 수 있으니 `R-K` 바로 위에 간단한 "레거시 항목" 구분 주석을 추가하면 가독성 향상.

---

### [WARNING] `rotate-bot-token` API 응답 — `202 Accepted` 래퍼 헬퍼 명시 없음

- target 위치: `spec/5-system/15-chat-channel.md`, line 247 `성공 응답 (200 OK)`
- 위반 규약: `spec/conventions/swagger.md §5.2` — `ApiAcceptedWrappedResponse(Dto)` 헬퍼 존재. `spec/5-system/2-api-convention.md §5.1` — 성공 응답은 `{ data }` 래퍼.
- 상세: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 성공 응답이 `200 OK` 로 명시되어 있다. `spec/5-system/2-api-convention.md §6` HTTP 상태 코드 표에 따르면 "수정 성공" 은 `200 OK` 가 맞으나, rotate 는 새 상태를 생성하는 부작용 동작이므로 `200 OK` 와 `201 Created` 사이의 의도가 모호하다. `swagger.md §5.2` 에는 `ApiAcceptedWrappedResponse(Dto)` 도 제공하는데 구현 시 어느 래퍼를 사용해야 하는지 spec 에서 명시하지 않는다.
- 제안: spec 에 `@ApiOkWrappedResponse(RotateBotTokenResponseDto)` 사용을 명시하거나, rotate 동작의 HTTP 상태가 `200 OK` 임을 Rationale 에서 명시적으로 정당화. (현재 R-CC-10 은 경로 선택 이유를 설명하지만 상태 코드에 대한 논거는 없음.) 규약 위반 수준은 낮으나 구현자가 잘못된 래퍼를 선택할 위험이 있어 WARNING.

---

### [INFO] secret ref 형식 — `{triggerId}` 와 `{id}` 혼용

- target 위치: `spec/5-system/15-chat-channel.md`, line 154-155 (`botTokenRef: "secret://triggers/{triggerId}/bot-token"`), line 190 (`chat_channel_token_v2 TEXT NULL ... secret://triggers/{id}/bot-token.v2`)
- 위반 규약: `spec/conventions/secret-store.md §1` URI Scheme 예시에서 `{triggerId}` 를 일관되게 사용.
- 상세: §4.1 코드 블록(line 154-155)에서는 `{triggerId}`, §4.2 SQL 주석(line 190)에서는 `{id}` 를 사용한다. 두 표현이 같은 의미이지만 단일 문서 안에서 혼용되면 혼란을 줄 수 있다.
- 제안: §4.2 SQL 주석의 `{id}` 를 `{triggerId}` 로 통일. `secret-store.md §1` 예시와도 정렬됨.

---

### [INFO] `spec/conventions/chat-channel-adapter.md §7` 변경 관리 조항과의 정합

- target 위치: `spec/5-system/15-chat-channel.md`, Rationale `R-CC-11` (line 478)
- 위반 규약: `spec/conventions/chat-channel-adapter.md §7` — "본 인터페이스 변경은 다음 두 spec 동시 갱신 의무: `15-chat-channel.md` + `providers/<name>.md`"
- 상세: R-CC-11 에서 `visualNode` enum 변경을 설명하면서 "컨벤션 파일 자체 = 3 파일을 한 commit 으로 묶음" + "`providers/_overview.md` 갱신 불필요" 라고 서술한다. §7 의 "두 spec 동시 갱신 의무" 는 interface 변경 시 적용이고 enum 한 필드 변경은 구현 세부라고 구분하고 있다. 이 구분 논리는 R-CC-11 본문에 설명되어 있으나 Convention §7 자체에는 "interface 변경" 과 "config 타입 필드 변경" 의 적용 범위 구분이 없어, 향후 유사 변경 시 혼선 발생 가능.
- 제안: `spec/conventions/chat-channel-adapter.md §7` 에 "ChatChannelConfig 필드 변경은 interface 서명 변경과 달리 `providers/<name>.md` 전수 갱신 의무 없음 — 해당 provider 명세에만 영향 있는 경우 해당 파일만 갱신" 을 한 줄 추가. 규약 갱신 쪽이 적절.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 `spec/conventions/chat-channel-adapter.md`, `spec/conventions/secret-store.md`, `spec/5-system/2-api-convention.md` 를 전반적으로 잘 준수한다. 에러 코드 표기는 `UPPER_SNAKE_CASE` 를 따르고, secret ref URI 는 `secret-store.md §1` 형식을 사용하며, 응답 envelope 은 `{ data }` 래퍼 + `{ error: { code, message, details? } }` 를 따른다. CRITICAL 수준의 위반은 없다. 발견된 사항은 대부분 INFO 수준의 형식 일관성 제안이며, 단 하나의 WARNING 으로 `rotate-bot-token` 응답 코드의 Swagger 래퍼 헬퍼 미명시가 구현자 혼선을 유발할 수 있는 수준이다. `details` 배열 표기 불일치(INFO)와 secret ref `{id}` / `{triggerId}` 혼용(INFO)은 구현 착수 전에 수정하면 좋다. Convention 수준 갱신이 필요한 항목은 `chat-channel-adapter.md §7` 의 "config 필드 변경 범위" 명확화 한 건이다.

## 위험도

LOW
