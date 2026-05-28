---
name: fix-mail-send-status
status: in-progress
worktree: .claude/worktrees/fix-mail-send-status-59d3b3
branch: claude/fix-mail-send-status-59d3b3
spec_refs:
  - spec/5-system/3-error-handling.md#32-route-to-error-port-상세
  - spec/5-system/4-execution-engine.md#10-integration-handler-계약
  - spec/4-nodes/4-integration/0-common.md#42-공통-에러-코드
---

# 메일 발송 실패가 실행 성공으로 표시되는 버그 수정

## 배경

사용자 보고: send_email 노드가 SMTP **인증 실패**로 발송에 실패했는데도
실행 결과가 "성공" 으로 표시됨. 또한 통합 화면의 메일 유형 **연결 테스트**가
인증 실패 자격증명에도 "성공" 으로 표시됨.

근본 원인 (코드 분석):

1. **엔진이 error-port 라우팅을 노드 실패로 반영하지 않음.** D4 결정
   (2026-05-17, 0-common.md §4.2/§7) 이후 Integration·LLM·Code·Workflow
   8종 노드는 런타임 실패를 throw 대신 `port: 'error'` 정상 return 으로
   surface 한다. 그런데 `execution-engine.service.ts` 의 success-path 는
   `waiting_for_input` 외 모든 정상 return 을 무조건 `COMPLETED` 로 마킹했고,
   `spec/5-system/3-error-handling.md §3.2` 가 정의한 동작(NodeExecution
   `failed`, error 포트 미연결 시 `ERROR_PORT_FALLBACK` → Stop Workflow)이
   엔진에 **전혀 구현돼 있지 않았다** (`ERROR_PORT_FALLBACK` 은 chat-channel
   분류기 상수로만 존재).

2. **email 통합에 transport tester 미등록.** `dispatchTest` 의
   `transportTesters` 에 `mcp` 만 있어 email 은 fallback 으로
   `validateCredentials`(구조 검증)만 하고 무조건 success 반환. 실제 SMTP
   접속·인증(`verify()`)을 하지 않았다.

사용자 결정 (AskUserQuestion): **엔진 전체 spec §3.2 준수** 선택 — 8종
error-port 노드를 엔진 차원에서 일괄 수정 (미연결 error 포트 = Stop Workflow
breaking change 포함).

## 작업 항목

- [x] 사전 일관성 검토 `/consistency-check --impl-prep` — BLOCK: NO
      (발견사항 전부 무관 영역, ERROR_PORT_FALLBACK naming 충돌 없음)
- [x] **Fix 1** — 엔진 error-port → NodeExecution FAILED + ERROR_PORT_FALLBACK
      - `executeNode` success-path: `_selectedPort==='error'` 감지 시
        NodeExecution.status=FAILED + NODE_FAILED (output.error.code/message 보존)
      - error 포트 미연결 시 `ErrorPortFallbackError` throw →
        top-level catch → Execution FAILED (error.code 보존)
      - 5개 호출부에 `outgoingEdgeMap` 전달
      - unit test 3종 (연결됨→FAILED+계속 / 미연결→Stop Workflow / 정상→COMPLETED)
- [x] **Fix 2** — email SMTP verify transport tester
      - `transportTesters` 에 `email` 등록, `nodemailer verify()` 로 접속+인증 검증
      - 실패 시 `EMAIL_CONNECT_FAILED`. preview-test/testConnection/rotate 공통
      - unit test 3종 (verify resolve→success / reject→fail / 구조검증 우선)
- [x] TEST WORKFLOW: lint PASS / unit PASS (5010) / build PASS / e2e (진행중)
- [x] REVIEW WORKFLOW: `/ai-review` (9 reviewer, MEDIUM, Critical 0) + 이슈 조치 +
      RESOLUTION.md (`review/code/2026/05/29/01_22_01/`)
- [x] **Fix 3** (ai-review W1 SSRF, 사용자 결정) — SMTP private-host SSRF 가드
      - `common/utils/smtp-host-guard.ts`: 기존 `ALLOW_PRIVATE_HOST_TARGETS`
        재사용(기본 ON, self-host opt-out), `ssrf.util` 재사용
      - testEmailTransport + send-email 핸들러 양쪽 적용, `EMAIL_HOST_BLOCKED`
      - unit test 3 spec (가드 로직 / 연결테스트 차단 / 발송 차단)

## DOCUMENTATION 점검

- 변경 유형 → 갱신 위치 매핑(PROJECT.md) 대조 결과 **동반 갱신 없음**:
  - 신규 errorCode(error-codes.ts enum)·warningCode·handler output field·
    UI·cross-cutting enum 추가 없음.
  - `EMAIL_CONNECT_FAILED` 은 `MCP_CONNECT_FAILED` 과 동일한 test-result code
    (ErrorCode enum 아님) → i18n 매핑 대상 아님. message 는 nodemailer 영문 그대로.
  - 연결 테스트 동작이 실제 검증으로 바뀌었으나, user-guide
    (`integration-management.mdx`) claim("테스트 통과해야 저장")은 그대로 정확.

## 후속 (project-planner 위임 — spec 영역)

- `spec/5-system/3-error-handling.md` / `spec/2-navigation/4-integration.md`
  frontmatter `code: []` → 구현 파일 링크 갱신 (pre-existing 갭).
- `spec/2-navigation/4-integration.md §5.5`: "테스트: SMTP 핸드셰이크 + NOOP" →
  실제 구현 `nodemailer verify()` (연결+인증) 로 갱신. previewTest 도 SMTP 검증
  수행함을 명시.
- `spec/2-navigation/4-integration.md` 에러 코드 표: `EMAIL_HOST_BLOCKED` 신규 코드
  + SMTP SSRF 가드(기본 ON, `ALLOW_PRIVATE_HOST_TARGETS` opt-out) 동작 명시.
- `spec/5-system/3-error-handling.md`: `ERROR_PORT_FALLBACK` 를 API/실행 결과
  스키마에 명시 (ai-review INFO16).

## 사용자 가시 노출 주의 (PROJECT.md 변경 매트릭스)

- 신규 `ErrorCode.EMAIL_HOST_BLOCKED` — `backend-labels.ts` 에 `ERROR_KO` 매핑
  테이블이 아직 없어 영문 message 가 그대로 노출됨 (기존 errorCode 와 동일 상태).
