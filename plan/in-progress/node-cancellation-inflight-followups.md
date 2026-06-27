---
worktree: (unstarted)
started: 2026-06-28
owner: developer
---

# Node Cancellation — In-flight cancel & e2e (best-effort 후속)

> 분리 출처: [`node-cancellation-infrastructure.md`](../complete/node-cancellation-infrastructure.md) (2026-06-28 완료·이동). 본체 plan 의 수용 기준(ExecutionContext.abortSignal 필드 + HTTP/AI/DB/Email pre-dispatch 가드 + cancellation convention spec + 단위/통합 테스트)은 전부 충족됐고, **신규 구현·설계가 필요한 best-effort in-flight cancel 과 e2e** 만 본 plan 으로 이관.
>
> 본체 plan 의 scope 는 "이미 배선된 취소 시그널 + pre-dispatch 가드" 였다. 아래 항목들은 모두 **driver/transport 레벨의 진행 중(in-flight) 작업 중단** 또는 **다단계 e2e** 로, 새 코드 + 설계 결정을 요구하므로 본체에서 분리됐다.

## 배경

현재 cancellation 인프라(`ExecutionContext.abortSignal`)는 노드 dispatch **직전** abort 를 가드하고(`*.handler.ts` 의 `abortSignal?.aborted` 사전 체크), AI 노드는 SDK `signal` 옵션으로 진행 중 호출을 즉시 throw 시킨다. 그러나 DB 쿼리·SMTP 전송은 일단 시작되면 abort 시그널이 와도 **driver/transport 가 자체적으로 in-flight 작업을 끊지 못해** best-effort 로 작업 완료까지 계속된다 (spec `node-cancellation.md` 에 best-effort 로 명시됨). 본 plan 은 그 best-effort 갭을 driver 별로 좁히는 후속 작업이다.

## 관련 문서

- [`spec/conventions/node-cancellation.md`](../../spec/conventions/node-cancellation.md) — cancellation 컨트랙트 (best-effort 정의 SoT)
- [`codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`](../../codebase/backend/src/nodes/integration/database-query/database-query.handler.ts) — pre-dispatch 가드 `:140`
- [`codebase/backend/src/nodes/integration/send-email/send-email.handler.ts`](../../codebase/backend/src/nodes/integration/send-email/send-email.handler.ts) — pre-dispatch 가드 `:87`

## 작업 단위

### 1. Database 노드 driver-level in-flight cancel

현황: pre-dispatch abort 가드만 구현·테스트됨 (`database-query.handler.ts:140`, spec `:1025`). 쿼리 시작 후 in-flight cancel 미지원.

- [ ] 사용 중 driver 의 cancel 지원 확인 (PostgreSQL `pg`: `client.cancel()` / 별도 cancel connection, MySQL `mysql2`: connection destroy, MongoDB: `signal` option 직접 지원 등)
- [ ] driver 별 `context.abortSignal` → in-flight cancel 전파 구현 (signal listener 등록 + abort 시 driver cancel 호출, 정상 완료 시 listener 해제로 누수 방지)
- [ ] 단위 테스트 — 실행 중 abort 시 쿼리가 driver-level 로 중단되는지 (mock driver 의 cancel 호출 검증)

### 2. Send Email (SMTP) in-flight connection close

현황: pre-dispatch 가드만 구현·테스트됨 (`send-email.handler.ts:87`, spec `:776`). 전송 시작 후 in-flight 중단 미지원.

- [ ] nodemailer `transporter` 의 in-flight 중단 방식 검토 (`transporter.close()` 가 진행 중 SMTP 전송에 미치는 영향 — 부분 전송/중복 전송 리스크 평가 포함)
- [ ] `context.abortSignal` → abort 시 `transporter.close()` 전파 구현 (안전하다고 판단될 경우)
- [ ] 단위 테스트 — 실행 중 abort 시 transporter 가 close 되는지 (mock transporter 검증)

### 3. e2e — 다단계 워크플로우 cancel 전파

본체 plan §7.2 이관.

- [ ] e2e 테스트 — 다단계 워크플로우에서 외부 cancel signal(사용자 Stop 버튼 / timeout)이 진행 중 노드까지 전파돼 `cancelled` 상태로 확정되는지

## 수용 기준

- DB / Email 중 **driver 가 in-flight cancel 을 지원하는 노드**에서 abort 시 진행 중 작업이 중단 (미지원 driver 는 best-effort 로 spec 에 명시 유지)
- 다단계 cancel 전파 e2e 가 signal → `cancelled` 상태 확정을 잠금

## 의존성·리스크

- **의존**: 본체 cancellation 인프라(완료). 추가 의존 없음.
- **리스크**:
  - driver 가 in-flight cancel 을 안전하게 지원하지 않을 수 있음 — driver 별 best-effort 유지 (spec 의 best-effort 원칙 불변)
  - SMTP `transporter.close()` 의 부분 전송/중복 전송 부작용 — 안전성 미확인 시 미구현 유지가 정답일 수 있음 (설계 결정 필요)
