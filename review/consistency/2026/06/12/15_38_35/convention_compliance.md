# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/` (--impl-done, diff-base=origin/main)
**검토 일시**: 2026-06-12
**diff 변경 파일**: `spec/5-system/15-chat-channel.md` (3개 hunk)

---

## 발견사항

### [INFO] 15-chat-channel.md — 오류 코드 표의 HTTP 상태 코드·코드명 정합 수정 (규약 준수)

- **target 위치**: `spec/5-system/15-chat-channel.md` §5.4, 에러 응답 표 `WORKSPACE_ID_REQUIRED` row
- **관련 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명), `spec/conventions/error-codes.md §2` (rename 안정성)
- **상세**: diff가 `401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED` 로 교체했다. `3-error-handling.md §1.3` canonical 에 `WORKSPACE_ID_REQUIRED` (400) 이 정의되어 있으므로, 수정 전 `WORKSPACE_REQUIRED`(401) 는 canonical 코드와 어긋난 비규약 표기였으며 이번 수정으로 규약과 정합하게 됐다. 단, 이 변경이 **기존에 발행되던 실제 응답 코드를 바꾼 것**인지(breaking change) 아니면 spec 문서의 오기를 정정한 것인지 명확히 기술되어 있지 않다.
  - 만약 코드베이스가 실제로 `WORKSPACE_REQUIRED`(401)를 발행하고 있었고 이 diff가 그것을 고치는 것이라면, 클라이언트 분기에 영향을 주는 `error-codes.md §2` breaking change 절차(deprecated alias·이중 발행·마이그레이션 부담 고려)가 필요하다.
  - 만약 코드베이스가 이미 `WORKSPACE_ID_REQUIRED`(400)를 발행하고 있고 spec 오기만 수정한 것이라면 문제없다.
- **제안**: spec 문서에 "spec 오기 수정 (코드베이스는 이미 `WORKSPACE_ID_REQUIRED` 발행)" 또는 "코드베이스 동반 수정 포함" 임을 한 줄 주석으로 명시하면 리뷰어 혼동을 없앨 수 있다. 코드베이스 확인 후 실제 발행 코드가 변경된 경우 `error-codes.md §5 Rename 이력` 에 추가 권장 (소비자가 자사 클라이언트인 경우의 표준 절차).

---

### [INFO] 15-chat-channel.md — `botIdentity.teamId` 필드 추가 (규약 준수, 문서 충분)

- **target 위치**: `spec/5-system/15-chat-channel.md` §4.1 `chatChannel` 구성 예시 JSON
- **관련 규약**: `spec/conventions/spec-impl-evidence.md §2` (frontmatter `code:` 증거), `CLAUDE.md §정보 저장 위치`
- **상세**: `botIdentity` 객체에 `"teamId": "T012ABCDE"` optional 필드를 추가하면서 `// optional — workspace/team 개념 있는 provider(Slack 등) 한정. SoT conventions/chat-channel-adapter.md §2.3` 주석으로 SoT를 명시했다. 규약이 요구하는 단일 진실 원칙(SoT 명시)을 정확히 이행하고 있다. 발견사항 없음.

---

### [INFO] 15-chat-channel.md — R-CC-16 Rationale 의 이벤트 타입명 정정 (정합)

- **target 위치**: `spec/5-system/15-chat-channel.md` §R-CC-16 (2번 항)
- **관련 규약**: `spec/conventions/chat-channel-adapter.md §1.2` 참조 (EiaEvent union 타입)
- **상세**: `EiaAiMessageEvent` → `EiaEvent` 의 `execution.ai_message` variant 로 표현을 정정했다. 이는 Convention §1.2 의 타입 구조 (`EiaEvent` = union, `execution.ai_message` = variant) 와 일치하도록 표현을 정확하게 한 것이다. 규약 위반 아님.

---

### [WARNING] spec/5-system/ 전반 — 일부 spec 문서에서 `## Overview` 섹션이 본문 내부에 중첩 위치

- **target 위치**: `spec/5-system/10-graph-rag.md` 라인 684 (`## Overview (제품 정의)`)
- **관련 규약**: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항 → `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
- **상세**: `10-graph-rag.md` 의 `## Overview (제품 정의)` 섹션이 문서 본문 최상단(헤더 직후) 이 아니라 `---` 구분선 뒤에 위치하며, 이후 `## 1. 개요` 가 다시 등장하는 이중 구조다. 3섹션 권장 구조(Overview / 본문 / Rationale)에서 Overview와 본문이 혼재된 양상이다. 기능상 문제는 없고 spec 내용은 완전하나, 다른 도메인의 관례(`1-auth.md`는 Overview 없이 바로 본문, `11-mcp-client.md`는 `## 1. 개요`로 시작)와 구조가 불일치한다.
- **제안**: 규약 자체가 "3섹션 권장"으로 강제가 아니므로 CRITICAL이 아니다. 단, 신규 spec 문서 작성 시 `## Overview` → 본문 → `## Rationale` 순서를 명시적으로 따르도록 CLAUDE.md의 "권장" 표현을 강화하거나, 현행 혼재를 용인하는 것을 Rationale에 명시하면 좋다.

---

### [INFO] spec/5-system/1-auth.md §1.5.4 — historical-artifact 에러 코드 표의 lower_snake_case 예외 레지스트리 준수 확인

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 및 주석
- **관련 규약**: `spec/conventions/error-codes.md §3` (historical-artifact 예외 레지스트리)
- **상세**: `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 의 `lower_snake_case` 표기와, `UPPER_SNAKE_CASE` 규약 위반이 의도적 historical artifact임을 §3 레지스트리에 등재하고 §1.5.4 주석에도 명시했다. 규약을 완전히 준수한다. 특히 `forbidden`·`rate_limited` 의 lowercase가 초대 흐름 전용 한정임을 `error-codes.md §3` 과 `1-auth.md §1.5.4` 양쪽 모두에 명기한 점이 정확하다.

---

### [INFO] spec/5-system/1-auth.md §5 API 엔드포인트 표 — 응답 래핑 스키마 Swagger 규약 명시 불필요

- **target 위치**: `spec/5-system/1-auth.md` §5 API 엔드포인트 표
- **관련 규약**: `spec/conventions/swagger.md §2-5` (응답 wrapping), `spec/conventions/node-output.md §3.2` (output.error 표준 형태)
- **상세**: §5 표의 `{ data: { message } }` 형태 응답 표기는 `swagger.md §2-5`의 `TransformInterceptor`가 모든 성공 응답을 `{ data: ... }` 로 감싼다는 규약과 정확히 일치한다. API 문서 규약 준수 이상 없음.

---

### [INFO] spec/5-system/15-chat-channel.md — `pending_plans` 목록 내 실존 경로 확인 필요

- **target 위치**: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:`
- **관련 규약**: `spec/conventions/spec-impl-evidence.md §4` (`spec-pending-plan-existence.test.ts` 가드)
- **상세**: frontmatter의 `pending_plans`에 4개의 plan 경로가 선언되어 있다 (`chat-channel-discord-gateway.md`, `chat-channel-slack-socket-mode.md`, `chat-channel-visual-ssr-png.md`, `spec-sync-chat-channel-gaps.md`). build-time 가드(`spec-pending-plan-existence.test.ts`)가 이들의 실존을 강제하므로, 해당 plan 파일들이 `plan/in-progress/` 또는 `plan/complete/`에 존재해야 한다. diff 자체는 frontmatter를 변경하지 않으므로 기존 상태 그대로다.

---

## 요약

`spec/5-system/15-chat-channel.md`의 이번 diff(3개 hunk)는 모두 정식 규약을 준수하거나 오기를 규약에 맞게 수정하는 내용이다. `WORKSPACE_REQUIRED`(401) → `WORKSPACE_ID_REQUIRED`(400) 수정이 spec 오기 정정인지 코드베이스 동반 수정인지를 명확히 기술하지 않은 점이 유일한 INFO 수준 모호성이다. `error-codes.md §2`의 breaking change 정책 관점에서 코드베이스가 실제로 코드·상태코드를 변경한 경우 rename 이력(`§5`) 등재가 권장된다. 그 외 `10-graph-rag.md`의 Overview/본문 중첩 구조 불일치는 WARNING 수준이나 규약 자체가 강제가 아닌 권장이므로 차단 수준은 아니다. `1-auth.md`와 `11-mcp-client.md`는 명명·에러 코드·frontmatter 등 모든 정식 규약을 준수하고 있다.

## 위험도

LOW
