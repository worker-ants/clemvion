---
worktree: fix-mail-send-status-59d3b3
started: 2026-05-29
owner: project-planner
---

# Spec draft — 메일 발송/연결테스트 동작 정합화

## Overview

구현 완료(브랜치 claude/fix-mail-send-status-59d3b3)된 동작을 spec 본문에 반영한다.
신규 기획이 아니라 **구현된 동작의 문서 정합화**다. 신규 코드 2종
(`EMAIL_CONNECT_FAILED`, `EMAIL_HOST_BLOCKED`)·동작(SMTP `verify()`, SSRF 가드)이
본문에 미반영이라 추가한다.

## 변경 1 — spec/2-navigation/4-integration.md §5.5 (Email SMTP) 테스트 설명

현재: "테스트: SMTP 핸드셰이크 + `NOOP` 명령. 실제 메일은 전송하지 않음."

변경 후:
> 테스트: `nodemailer` transporter 의 `verify()` 로 SMTP 연결 + 인증 +
> (STARTTLS/TLS) 핸드셰이크를 검증한다. 실제 메일은 전송하지 않음. 저장 전
> 사전 검증(`preview-test`)·저장 후 테스트(`:id/test`)·rotate 세 경로 모두 동일하게
> 실제 SMTP `verify()` 를 수행한다. **Cafe24 사전 검증이 외부 호출을 하지 않는
> 것(§5.8 / line 608)과 의도적으로 다르다** — SMTP 는 자격증명 자체가 외부 서버
> 인증을 거쳐야만 검증되므로 구조 검증만으로 불충분(§Rationale).
>
> **결과 코드** (`IntegrationTestResult.code` — 노드 런타임 `ErrorCode` enum 과는
> 별개 namespace, `MCP_CONNECT_FAILED` 와 동일 계열. 값 형식은 동일 UPPER_SNAKE):
> 인증/연결/TLS 실패 시 `EMAIL_CONNECT_FAILED`(nodemailer 원본 메시지 동반),
> SSRF 가드 차단 시 `EMAIL_HOST_BLOCKED`.
>
> **SSRF 가드**: SMTP host 는 HTTP Request 노드의 SSRF 가드([§8 SoT](../4-nodes/4-integration/1-http-request.md))와
> **동일한 메커니즘·플래그**를 공유한다 — 사설(RFC1918)·loopback·link-local·CGNAT·
> IPv6 사설 대역을 기본 차단, self-host 는 `ALLOW_PRIVATE_HOST_TARGETS=true` 로
> opt-out(내부 SMTP relay 보존). 연결 테스트와 실제 발송(send_email 노드) 양쪽에
> 동일 적용.

## 변경 2 — spec/2-navigation/4-integration.md 에러 코드 vocabulary 표 (현 §991 부근)

- `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 정정 (stale. 타 문서
  `3-error-handling.md §1.4`·`3-send-email.md §5.3`·error-codes.ts 는 이미
  `EMAIL_SEND_FAILED` 로 정확 — 본 표만 initial draft 잔재).
- 행 추가: `EMAIL_HOST_BLOCKED` | SMTP host 가 사설/loopback 이라 SSRF 가드 차단
  (기본 ON, `ALLOW_PRIVATE_HOST_TARGETS` opt-out) | send_email 노드는 `error`
  포트 / 연결 테스트는 `result.code`.
- 행 추가: `EMAIL_CONNECT_FAILED` | SMTP `verify()` 실패(연결/인증/TLS) |
  **`IntegrationTestResult.code` namespace** — 노드 런타임 `output.error.code`
  (node-output §3.2 envelope)와 별개. 연결 테스트 전용.

## 변경 3 — spec/5-system/3-error-handling.md §1.4 노드 런타임 에러 코드 표

Email 행에 `EMAIL_HOST_BLOCKED` 추가:
> | Email | `EMAIL_SEND_FAILED` (+ details.integrationCode …) · `EMAIL_HOST_BLOCKED`
>   (SSRF 가드 차단 — host 사설/loopback, `ALLOW_PRIVATE_HOST_TARGETS` opt-out) |

(`EMAIL_CONNECT_FAILED` 는 노드 런타임 코드가 아니라 연결 테스트 결과 코드이므로
§1.4 에는 추가하지 않음.)

## 변경 4 — spec/4-nodes/4-integration/3-send-email.md 병행 반영 (send_email 노드 spec)

- §4 실행 로직: credentials 충족 검증 직후 단계로 "SSRF 가드 — host 가 사설/
  loopback 이면 `EMAIL_HOST_BLOCKED` 로 §5.3 라우팅 (HTTP Request §8 과 동일
  메커니즘, `ALLOW_PRIVATE_HOST_TARGETS` opt-out)" 추가.
- §5.3 `output.error.code` enum (표 1): `EMAIL_HOST_BLOCKED` 행 추가.
- §81 error 포트 설명 줄에 `EMAIL_HOST_BLOCKED` 추가.
- §Rationale: SSRF 가드 신설 + http/db 와 동일 플래그 통일 결정 항 추가.

## 변경 5 — spec/4-nodes/4-integration/1-http-request.md §8 SSRF 가드

§8(또는 §5.3 HTTP_BLOCKED 설명)에 한 줄 추가: SSRF 가드는 self-host 가
`ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out 할 수 있으며, 이 플래그는 HTTP /
Database Query / Send Email(SMTP) 통합 노드 전반의 SSRF 가드를 공통 제어한다.
(env var 를 spec 에 최초 명시 — 현재 .env.example·코드에만 존재.)

## 변경 6 — Rationale (integration.md ## Rationale 에 항목 추가)

- "SMTP 연결 테스트를 `verify()` 로 구현 (2026-05-29)": NOOP 단독 대신
  연결+인증+TLS 검증 채택 — 인증 실패를 사전 정확히 surface(사용자 보고: 인증
  실패가 '성공'으로 표시되던 문제). **preview-test 의 '외부 호출 없음' 원칙은
  Cafe24 한정**(§5.8, OAuth 토큰이라 구조 검증으로 충분) — Email 은 SMTP 인증이
  외부 네트워크 없이 검증 불가하므로 명시적 예외.
- "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일
  (2026-05-29)": 별도 opt-in 플래그 대신 기존 플래그 재사용 — integration 노드
  전반 SSRF posture 일관성 + secure-by-default. 연결 테스트만 막고 발송은 뚫리는
  비대칭 방지 위해 send_email 핸들러에도 동일 가드.

## side-effect 점검 결과

- **chat-channel-adapter.md §3.1 분류표**: `EMAIL_HOST_BLOCKED` 는 노드 레벨
  `output.error.code`(send_email) / 연결테스트 result.code 로만 surface. send_email
  실패가 워크플로 종료로 격상되면 execution 레벨 `error.code` 는
  `ERROR_PORT_FALLBACK`(이미 분류표 INTERNAL 군)이 되므로 분류표 행 추가 불필요.
  error 포트가 연결된 경우는 워크플로가 계속되어 execution.failed 자체가 발생 안
  함. (§1.4 enum 확장 시 분류표 검토 의무 → 검토 완료, 행 추가 없음.)
- **conventions/node-output.md §3.2**: error envelope `{code,message,details}` 형식
  불변 — 신규 코드는 형식 변경 없음. `IntegrationTestResult.code` 는 별개 타입임을
  변경 1·2 에 명시.
- **frontmatter status/code (item D)**: 본 draft 범위 제외. `spec-only` →
  `partial/implemented` 승격 + `code:` 채움은 전용 롤아웃
  (`spec-frontmatter-rollout.md`, spec-impl-evidence.md §6) 책임. 큰 spec 을
  `implemented` 로 과대주장하지 않기 위해 분리.

## Rationale (draft 자체)

구현이 §3.2 등 본문과 이미 정합하나 신규 코드·동작이 미반영이라 문서화. frontmatter
대규모 갱신은 별도 grooming 으로 분리해 본 PR blast radius 최소화. 1차
consistency-check 의 Critical(draft frontmatter 누락) + WARNING(send-email 병행
반영·preview-test 원칙 번복 서술·ALLOW_PRIVATE_HOST_TARGETS spec 근거·코드
namespace 구분)을 반영해 변경 4·5 추가 및 서술 보강.
