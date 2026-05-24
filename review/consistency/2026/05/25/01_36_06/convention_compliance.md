# 정식 규약 준수 검토 — convention_compliance

**검토 모드**: `--impl-prep`
**대상 문서**: `spec/5-system/15-chat-channel.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/6-websocket-protocol.md`
**검토일**: 2026-05-25

---

## 발견사항

### [WARNING] `pending_plans` 에 완료된 plan 항목 잔존 가능성 — `15-chat-channel.md`

- **target 위치**: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:` 목록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4 가드 4` — `spec-pending-plan-existence.test.ts` 규칙: `pending_plans:` 의 모든 path 가 `plan/in-progress/` 에 실존해야 함
- **상세**: frontmatter 에 `plan/in-progress/chat-channel-dispatcher-split.md` 가 `pending_plans:` 로 남아 있는지 불명확하다. `15-chat-channel.md` 의 Rationale R8 본문 (line 524) 에 "후속 추적: 본 정책 구현은 `plan/complete/chat-channel-dispatcher-split.md` (2026-05-24 완료)" 라고 명시되어 있으나, frontmatter 의 `pending_plans:` 에 `plan/in-progress/chat-channel-dispatcher-split.md` 가 아직 포함돼 있다면 실존하지 않는 경로를 참조하는 것이 된다. R8 이 2026-05-24 에 완료로 기록됐고 현재 PR 브랜치 이름도 `fix-chat-channel-dispatcher-and-cafe24-warn-*` 이므로, 해당 plan 이 `plan/complete/` 로 이동된 경우 frontmatter 도 함께 갱신되지 않았을 위험이 있다.
- **제안**: `plan/in-progress/chat-channel-dispatcher-split.md` 의 실존 여부 확인. 완료 이동됐다면 frontmatter `pending_plans:` 에서 제거하고, 나머지 pending plan 이 없으면 `status: partial → implemented` 로 승격 (또는 나머지 plan 이 아직 남아 있으면 그대로 `partial` 유지). spec-pending-plan-existence 가드 통과 여부를 `npm test --workspace frontend` 로 확인.

---

### [INFO] `6-websocket-protocol.md` 및 `11-mcp-client.md` 에 `## Overview` 섹션 불일치 — 문서 구조 규약

- **target 위치**: `spec/5-system/11-mcp-client.md` §1, `spec/5-system/6-websocket-protocol.md` §1
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: `15-chat-channel.md` 는 `## Overview (제품 정의)` 섹션을 명시적으로 두고, 그 아래에 요구사항 ID (`CCH-*`) 표를 배치한다. 반면 `11-mcp-client.md` 는 `## 1. 개요` 로 시작해 별도의 `## Overview` 섹션 없이 바로 본문 번호 섹션으로 진행하고, `6-websocket-protocol.md` 도 `## 1. 연결` 로 곧바로 시작한다. 3섹션 구성은 "권장" 수준이므로 CRITICAL 이 아니나, 일관성 측면에서 차이가 있다.
- **제안**: 구현 착수 전 수정 의무는 없으나, 향후 spec 갱신 시 `## Overview` 헤더 추가를 고려. 현행 구조가 의도적이라면 각 SKILL.md 에 명시해 규약 자체를 갱신하는 것도 방법.

---

### [INFO] `11-mcp-client.md` 의 `## Rationale` 섹션 부재

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체
- **위반 규약**: CLAUDE.md "결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `11-mcp-client.md` 에는 전체 12개 섹션이 있으나 문서 말미에 `## Rationale` 섹션이 없다. 주요 설계 결정 (예: stdio 미지원 사유 §2.2, 단일 노드 실행 = 단일 세션 §4.1, Internal Bridge vs 외부 HTTP 구분 §2.3) 의 근거가 인라인 블록 문장으로 분산돼 있다.
- **제안**: 구현 착수 전 block 조건은 아님. 향후 `## Rationale` 섹션을 문서 말미에 추가해 설계 결정들을 집약하면 규약 권장 구조와 정합된다.

---

### [INFO] `6-websocket-protocol.md` 의 에러 코드 케이스 일부가 `UPPER_SNAKE_CASE` 아닌 소문자 텍스트로 설명

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §7.1 에러 코드 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — `output.error.code` 는 `UPPER_SNAKE_CASE` 규약
- **상세**: §7.1 의 에러 코드들 (`INVALID_MESSAGE`, `UNKNOWN_TYPE`, `FORBIDDEN` 등) 자체는 `UPPER_SNAKE_CASE` 를 준수한다. 단, §4.2 표의 "버튼 클릭 에러 코드" (`INVALID_BUTTON_ID`, `INVALID_EXECUTION_STATE`, `INTERACTION_TIMEOUT`) 와 `execution.retry_last_turn` 에러 코드 (`RETRY_STATE_NOT_FOUND`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY`) 도 동일하게 `UPPER_SNAKE_CASE` 를 지키고 있어 규약 준수 상태다.
- **제안**: 현행 유지. 이미 규약을 준수하고 있어 수정 불필요.

---

### [INFO] `15-chat-channel.md` 에서 `5.4` 섹션 번호 중복

- **target 위치**: `spec/5-system/15-chat-channel.md` `### 5.4 Bot Token Rotation API 응답 계약` 과 `### 5.4 Inbound HTTP Contract` 에서의 `#### 5.5.1` 등 (실제로 §5.4 와 §5.5 는 정상)
- **상세**: 문서를 면밀히 검토하면 `### 5.4 Bot Token Rotation API 응답 계약` 이 정의된 뒤 `### 5.4.1 Bot Token 변경 single-path 정책` 이 subsection 으로 이어지는 구조는 정상이다. 단, `### 5.5 Inbound HTTP Contract` 의 앞에 `### 5.4 Bot Token Rotation API 응답 계약` 이 먼저 등장하기 때문에 5.4/5.5 순서는 맞다. 이 항목은 실제 위반은 아님.
- **제안**: 해당 없음. 정상 구조.

---

### [WARNING] `chat-channel-adapter.md` Changelog 의 `secretTokenRef` → `inboundSigningRef` 리네임 후 `15-chat-channel.md` §4.1 의 `botToken`/`inboundSigningPlaintext` 입력 전용 필드 정책이 swagger 규약(`writeOnly: true`)에 대응하는 DTO 언급 부재

- **target 위치**: `spec/5-system/15-chat-channel.md` §4.1 `chatChannel` JSON 주석 (`"botToken"`, `"inboundSigningPlaintext"`) 및 §5.5 케이스 매트릭스
- **위반 규약**: `spec/conventions/swagger.md §1-5 writeOnly / readOnly` — 입력 전용 보안 민감 필드는 DTO 에 `@ApiProperty({ writeOnly: true })` 의무
- **상세**: `15-chat-channel.md` §4.1 의 `botToken` 과 `inboundSigningPlaintext` 는 "입력 전용 — 서비스가 SecretResolver 로 옮긴 뒤 strip, 응답·DB JSONB 미노출" 임을 주석으로 명시한다. `swagger.md §1-5` 는 이런 보안 민감 입력 필드에 `writeOnly: true` DTO 데코레이터를 요구한다. spec 자체가 DTO 구현을 직접 지정하지는 않지만, 구현 착수 시 `CreateTriggerDto` / `UpdateTriggerDto` 에 `writeOnly: true` 적용이 필요함을 spec 이 명시적으로 안내하지 않는다.
- **제안**: `15-chat-channel.md` §4.1 의 `botToken` / `inboundSigningPlaintext` 필드 설명에 "(DTO: `@ApiProperty({ writeOnly: true })`)" 주석을 추가해 구현자에게 swagger 규약 적용 의무를 명시. 또는 `7. 구현 파일 구조` 섹션에 DTO 가이드 문장 1줄 추가. CRITICAL 수준은 아님 — 구현 단계에서 `swagger.md` 직접 참조로 처리 가능하나 spec 에 명시되면 drift 위험 감소.

---

### [INFO] `11-mcp-client.md` `skipReason` vocabulary 의 `lower_snake_case` 규약 명시는 정상이나 위치 설명이 혼용

- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 `skipReason vocabulary` 상단 note
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — `code` 는 `UPPER_SNAKE_CASE`
- **상세**: `skipReason` 값은 `lower_snake_case` 를 의도적으로 사용하며, 그 정당화 ("에러 코드가 아닌 운영 진단용 enum") 를 spec 이 인라인으로 명시하고 있다. `node-output.md` Principle 3.2 의 `UPPER_SNAKE_CASE` 규약은 `output.error.code` 대상이므로 진단 enum 인 `skipReason` 에는 직접 적용 범위가 아니다. spec 이 명확하게 예외를 정당화하고 있어 규약 위반이 아님.
- **제안**: 현행 유지. 정당화 문장이 spec 내에 있으므로 추가 조치 불필요.

---

## 요약

세 문서(`15-chat-channel.md`, `11-mcp-client.md`, `6-websocket-protocol.md`) 는 전반적으로 정식 규약을 준수하고 있다. 가장 주목할 항목은 `15-chat-channel.md` frontmatter 의 `pending_plans:` 에 완료된 `chat-channel-dispatcher-split` plan 이 아직 참조로 남아 있을 가능성(WARNING)으로, 현재 PR 컨텍스트(`fix-chat-channel-dispatcher-and-cafe24-warn`)를 고려하면 R8 Rationale 기록과 frontmatter 간 drift 를 즉시 확인·수정해야 한다. 나머지 항목은 INFO 수준의 구조 권장사항(Overview/Rationale 섹션 권장, swagger writeOnly 명시 권장)이며 구현 차단 요인은 아니다. 에러 코드 케이스(`UPPER_SNAKE_CASE`)와 `skipReason` 예외 정당화는 규약을 이미 올바르게 처리하고 있다.

---

## 위험도

**LOW**

`pending_plans` 잔존 가능성(WARNING)이 해소되면 전체적으로 LOW 이하다. `spec-pending-plan-existence.test.ts` 가드가 이를 빌드 단계에서 잡아줄 수 있으나, 해당 가드 자체가 "예정 — 구현은 후속 plan" 상태이므로 수동 확인이 필요하다.
