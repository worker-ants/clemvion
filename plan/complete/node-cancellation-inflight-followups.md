---
worktree: node-cancel-e2e-98b61f
started: 2026-06-28
owner: developer
status: complete
# §2(Email in-flight 미채택) 처분이 이 문서의 §2.1 Email row·§6 표를 정정했다.
spec_impact:
  - spec/conventions/node-cancellation.md
---

> **종결 (2026-07-24)**: §1(DB driver-level in-flight cancel) 완료 · §2(SMTP) won't-do 확정 ·
> §3(다단계 전파 e2e) 완료 — 사용자가 **(A) 결정적 하네스**를 선택해 착수했다. 두 plan 이
> 서로에게 미뤄 **커버리지 0** 이던 시나리오가 이제 e2e 로 잠긴다.

# Node Cancellation — In-flight cancel & e2e (best-effort 후속)

> 분리 출처: [`node-cancellation-infrastructure.md`](node-cancellation-infrastructure.md) (2026-06-28 완료·이동). 본체 plan 의 수용 기준(ExecutionContext.abortSignal 필드 + HTTP/AI/DB/Email pre-dispatch 가드 + cancellation convention spec + 단위/통합 테스트)은 전부 충족됐고, **신규 구현·설계가 필요한 best-effort in-flight cancel 과 e2e** 만 본 plan 으로 이관.
>
> 본체 plan 의 scope 는 "이미 배선된 취소 시그널 + pre-dispatch 가드" 였다. 아래 항목들은 모두 **driver/transport 레벨의 진행 중(in-flight) 작업 중단** 또는 **다단계 e2e** 로, 새 코드 + 설계 결정을 요구하므로 본체에서 분리됐다.

## 배경

현재 cancellation 인프라(`ExecutionContext.abortSignal`)는 노드 dispatch **직전** abort 를 가드하고(`*.handler.ts` 의 `abortSignal?.aborted` 사전 체크), AI 노드는 SDK `signal` 옵션으로 진행 중 호출을 즉시 throw 시킨다. 그러나 DB 쿼리·SMTP 전송은 일단 시작되면 abort 시그널이 와도 **driver/transport 가 자체적으로 in-flight 작업을 끊지 못해** best-effort 로 작업 완료까지 계속된다 (spec `node-cancellation.md` 에 best-effort 로 명시됨). 본 plan 은 그 best-effort 갭을 driver 별로 좁히는 후속 작업이다.

## 관련 문서

- [`spec/conventions/node-cancellation.md`](../../spec/conventions/node-cancellation.md) — cancellation 컨트랙트 (best-effort 정의 SoT)
- [`codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`](../../codebase/backend/src/nodes/integration/database-query/database-query.handler.ts) — pre-dispatch 가드 `:140`
- [`codebase/backend/src/nodes/integration/send-email/send-email.handler.ts`](../../codebase/backend/src/nodes/integration/send-email/send-email.handler.ts) — pre-dispatch 가드 `:87`

## 작업 단위

### 1. Database 노드 driver-level in-flight cancel — ✅ DONE (2026-07-08)

현황: pre-dispatch abort 가드만 구현·테스트됨 (`database-query.handler.ts:140`). 쿼리 시작 후 in-flight cancel 미지원 → **구현 완료**.

- [x] 사용 중 driver 의 cancel 지원 확인 — PG(`pg`): 별도 연결에서 `SELECT pg_cancel_backend(client.processID)` (57014). MySQL(`mysql2`): `getConnection()` 으로 `threadId` 확보 후 별도 연결에서 `KILL QUERY <threadId>`. Mongo 는 현 노드 미지원(pg/mysql 만).
- [x] driver 별 `context.abortSignal` → in-flight cancel 전파 구현 — abort 리스너 등록 + 완료 시 `removeEventListener` 해제(누수 방지). **취소 driver 에러는 catch 에서 `AbortError` 재throw → `cancelled` 분류**(§5, impl-prep CRITICAL — 그러지 않으면 error 포트로 흡수돼 failed 오분류). execute() catch 는 `err.name==='AbortError'` 만 재throw(광의 `abortSignal.aborted` 아님 — 무관 실패 오분류 방지, ai-review WARNING).
  - **ai-review CRITICAL 반영**: (1) 취소는 **캐시 pool 이 아닌 일회성 연결**(`new PgClient`/`createConnection`, `connectTimeout` 2s)로 발행 — 공유 pool(max 5) 사용 시 포화 상황에서 취소가 빈 슬롯을 기다리다 데드락. (2) 취소 promise 를 `connection.release()` **전에 await** — 지연된 취소가 재사용된 연결의 무관한 쿼리를 죽이는 cross-kill 방지. (3) connect 대기 중 abort 는 쿼리 시작 없이 즉시 `AbortError` throw(no-op 취소 후 쿼리 완주하던 race 제거). 취소 실패는 `logger.debug` + swallow(best-effort).
- [x] 단위 테스트 — `database-query.handler.spec.ts` `in-flight cancellation (§2.1)` describe 4건: PG cancel(일회성 Client→pg_cancel_backend+연결 close+AbortError)·MySQL cancel(KILL QUERY+AbortError)·정상완료 시 미발행+리스너해제·signal 부재 no-op. 90 pass.

### 2. Send Email (SMTP) in-flight connection close — 🚫 won't-do (best-effort 유지, 2026-07-08 결정)

현황: pre-dispatch 가드만 구현. **설계결정 = in-flight 중단 미채택**.

- [x] nodemailer `transporter` in-flight 중단 검토 → **미채택**: `transporter.close()` 를 전송 중 호출하면 부분 전송/중복 전송 리스크가 있고 SMTP 전송은 통상 단시간이라 이득 < 리스크. 진입 직전 사전 abort 체크만 유지(§5 계약 충족). spec `node-cancellation.md` §2.1 Email row·§6 표를 "의도적 best-effort(미채택)"로 정정. 향후 안전한 중단 방식 확인 시 재검토.
- [x] ~~transporter.close 전파 구현~~ — 위 결정으로 미구현(의도).
- [x] ~~단위 테스트~~ — 코드 변경 없음(사전 체크는 기존 테스트가 커버).

### 3. e2e — 다단계 워크플로우 cancel 전파

본체 plan §7.2 이관.

- [x] e2e 테스트 — 다단계 워크플로우에서 외부 cancel signal(사용자 Stop 버튼 / timeout)이 진행 중 노드까지 전파돼 `cancelled` 상태로 확정되는지
  > **완료 (2026-07-24) — 사용자 결정 (A) 결정적 하네스 채택.** 신설
  > `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` (3건, e2e 259 green).
  >
  > **flaky 전제를 두 축으로 깼다** (아래 "느린 쿼리 + 타이밍 맞춘 cancel" 우려의 해소):
  > 1. **고정 sleep 대신 관측** — `node_execution` 행이 `running` 이 되는 것을 폴링해
  >    "노드가 실제 진행 중" 을 확인한 뒤에만 stop 을 쏜다. 경합이 아니라 관측된 상태에
  >    반응하므로 느린 CI 에서도 순서가 뒤집히지 않는다.
  > 2. **in-flight 중단 자체를 단언하지 않는다** — code 노드는 driver-level 중단 대상이
  >    아니라 best-effort 로 완주하는 것이 정상(spec 명시)이다. 그래서 "얼마나 빨리
  >    끊겼나" 가 아니라 **전파의 결과**만 본다: 실행이 `cancelled` 로 확정되고
  >    **하류 노드가 실행되지 않는다**(엔진의 `context.abortSignal?.throwIfAborted()`).
  >    이 단언은 진행 중 노드가 언제 끝나든 성립한다 → 타이밍 축이 단언에서 제거됨.
  >
  > **대조군이 vacuous 통과를 잡았다 (기록해 둘 값어치가 있음)**: 초안은 A→B 엣지의
  > `sourcePort` 를 `'out'` 으로 썼는데 code 노드의 출력 포트는 `success`/`error` 다
  > (`code.schema.ts`). 엣지가 어디에도 붙지 않아 하류가 **취소와 무관하게** 도달 불가가
  > 됐고, "하류가 실행되지 않았다" 가 공허하게 참이 되어 **초판 e2e 가 통과했다**.
  > 취소 없이 같은 워크플로를 돌려 하류가 `completed` 됨을 단언하는 대조군 테스트를
  > 넣자 즉시 red → 포트 수정 후 green. 대조군은 영구 보존한다(향후 같은 vacuity 차단).
  >
  > **범위**: driver-level in-flight 중단(§1, pg_cancel_backend / KILL QUERY)은 여기서
  > 다루지 않는다 — 단위 테스트가 이미 결정적으로 잠그고 있고, e2e 로 옮기면 정확히
  > 원 plan 이 우려한 타이밍 의존이 돌아온다.
  > **잔여(2026-07-08)**: DB in-flight cancel 배선·AbortError→cancelled 분류는 단위 테스트(§1)로 결정적 검증됨. 다단계 in-flight cancel e2e 는 **느린 쿼리 + 타이밍 맞춘 외부 cancel** 이 필요해 non-deterministic(flaky) 리스크가 커 별도 후속으로 남긴다. ~~사용자 cancel→`cancelled` 확정의 기본 경로는 본체 `node-cancellation-infrastructure.md`(완료) e2e 가 이미 커버.~~
  >
  > **⚠ 위 마지막 문장은 사실이 아니다 — 정정 (2026-07-17 grooming, 실측)**: 본체 plan 의 e2e 는 이 항목을 커버하지 **않는다**. 오히려 [`node-cancellation-infrastructure.md:90`](node-cancellation-infrastructure.md) 이 *"(이관) e2e 테스트 — 다단계 워크플로우에서 외부 cancel signal 이 전파되는지 → `node-cancellation-inflight-followups.md` §3 로 분리 (2026-06-28)"* 라며 **이쪽으로 넘겼다**. 즉 두 plan 이 서로에게 미루는 **순환 참조**였고, 그 결과 이 시나리오의 실제 e2e 커버리지는 **0** 이다:
  > - `codebase/backend/test/` 에 cancel 전용 e2e 파일 **부재**.
  > - e2e 의 `status === 'cancelled'` 단언은 `execution-concurrency-cap.e2e-spec.ts:234`·`:298`(큐 대기 타임아웃/orphan 회수)와 `webchat-idle-reaper.e2e-spec.ts`(idle reaper) 뿐 — 셋 다 **노드 dispatch 전 회수**라 in-flight 전파 검증이 아니다. (다른 파일의 `cancelled` 는 `TERMINAL_STATUSES` 상수 나열일 뿐.)
  > - 사용자 Stop API 는 존재하나(`interaction.controller.ts`) e2e 미검증.
  >
  > **본 정정은 항목의 처분이 아니라 사실관계 교정이다** — flaky 리스크 판단(위 2026-07-08 노트)은 여전히 유효하므로 항목은 `[ ]` 로 열려 있다. 다만 "이미 커버되니 안전하다" 는 **잘못된 안심**을 제거한다: 결정적 하네스로 작성할지, `won't-do` 로 확정할지는 **미결정**이며 사용자 판단이 필요하다.

## 수용 기준

- DB / Email 중 **driver 가 in-flight cancel 을 지원하는 노드**에서 abort 시 진행 중 작업이 중단 (미지원 driver 는 best-effort 로 spec 에 명시 유지)
- 다단계 cancel 전파 e2e 가 signal → `cancelled` 상태 확정을 잠금

## 의존성·리스크

- **의존**: 본체 cancellation 인프라(완료). 추가 의존 없음.
- **리스크**:
  - driver 가 in-flight cancel 을 안전하게 지원하지 않을 수 있음 — driver 별 best-effort 유지 (spec 의 best-effort 원칙 불변)
  - SMTP `transporter.close()` 의 부분 전송/중복 전송 부작용 — 안전성 미확인 시 미구현 유지가 정답일 수 있음 (설계 결정 필요)
