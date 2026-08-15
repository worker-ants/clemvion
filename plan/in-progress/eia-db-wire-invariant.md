---
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-15
owner: developer
branch: claude/eia-db-wire-invariant
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/conventions/node-cancellation.md
---

# EIA — "DB 와 wire 가 같은 값을 말한다" 불변식 닫기

직전 PR(#1171)이 종결 이벤트에 `durationMs` 를 실으면서 **"DB = wire"** 를 불변식으로
세웠다. 그런데 spec §6.5 에 **알려진 예외**를 남겼고, REST 재조회에는 필드가 아예 없다.
이 작업이 그 셋을 닫는다.

## 다른 plan 과의 관계

**정본 트래커는 [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)**
다. 여기 ①②③은 그 문서의 항목을 이번 PR 범위로 **집행**하는 것이고, 새 사실을 만들지
않는다. 이 문서는 작업 단위, 저 문서가 SoT 다.

- ①② → 정본 트래커의 *"retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다"* 절.
  **①의 처방은 그 절에서 이미 한 번 정정했다** (`RETURNING` 이 아니라 "반환을 읽어라")
- ③ → 같은 문서의 *"`durationMs` 후속 2건"* W4
- 같은 호출부를 겨냥한 열린 항목: [`retry-turn-terminal-guard.md`](./retry-turn-terminal-guard.md)
  #2 (`cancelledBy`, P2 미완료) — 리베이스 마찰만 인지

> **자매 트래커 동시 갱신은 이 작업의 체크리스트 항목이다.** 같은 `durationMs` 계열에서
> 트래커 미동기화가 이미 네 번 반복됐다(`13_43_10` plan_coherence 가 다섯 번째 재발
> 조건으로 지목). **구현 커밋과 같은 턴에** 양쪽을 닫는다.

## ① `finalizeCancelledExecution` 이 guarded UPDATE 의 결과를 안 본다 (**진짜 결함**)

> **트래커 서술이 이 결함을 덮고 있었다.** `spec-sync-external-interaction-api-gaps.md`
> 는 이 항목을 *"emit 되는 `durationMs` 가 실제 DB 영속값과 다를 수 있다 → `RETURNING`
> 추가"* 라고 적어 뒀다. **실측하니 값은 같다** — `updateExecutionStatus` 의 else 분기가
> `duration_ms = $5` 로 **로컬 값을 그대로 쓰기** 때문이다. 진짜 결함은 그 아래에 있었다.

```ts
await this.updateExecutionStatus(savedExecution, ExecutionStatus.CANCELLED);
await this.emitCancellationEvent(savedExecution.id, { ... });   // ← 무조건
```

`updateExecutionStatus` 는 `status IN (non-terminal)` 조건부 UPDATE 라 **동시 writer 가
이미 terminal 로 선점했으면 0행 매칭 → `false`** 를 돌려준다. 이 함수는 그 반환을 읽지
않고 `EXECUTION_CANCELLED` 를 발행한다 → **DB 에 쓰이지 않은 종결 이벤트**가 나간다.
DB 는 FAILED 인데 수신자는 cancelled 를 받는다.

**바로 옆 자매의 주석이 이 대칭을 명시적으로 주장한다** (`finalizeFailedExecution`):

> *"CRITICAL #1 — 형제 `finalizeCancelledExecution` **과 동일한 guarded 경로**. DB 가 이미
> terminal 이면 0행 매칭 → false 반환, FAILED 로 재마킹하지 않는다."*

**주장은 절반만 참이다.** 둘 다 guarded UPDATE 를 쓰지만 반환을 읽는 쪽은 하나뿐이다.
이 저장소의 기록된 형태 그대로다 — *"문서한 보장이 구현보다 넓으면 안 된다"*.

이 결함 클래스는 이 저장소가 이미 세 번 CRITICAL 로 잡았다 (CHANGELOG: *"DB 는
RUNNING 인데 caller 가 종결 이벤트를 발행하는 사후 오시그널"*).

- [x] `persisted` 를 확인해 `false` 면 emit skip + warn — RED→GREEN, 뮤테이션 확인
- [x] 자매 주석이 주장하던 대칭을 **실제로 성립**시켰다 (서술을 낮추는 대신 구현을 올림)
- [x] **`spec/conventions/node-cancellation.md` 정정** (`13_43_10` cross_spec W1) — Rationale 이
      *"guarded UPDATE 가 이미 terminal 인 행을 **걸러낸다**"* 라고 쓴다. 0행 매칭은 맞지만
      **그 결과를 아무도 읽지 않았으므로 걸러진 것이 없었다.** 같은 표의 자매 행은
      *"emit 을 모두 skip"* 이라 정확히 적혀 있다 — **같은 과대서술의 세 번째 자리**다
      (자매 코드 주석 · 이 규약 문서 · 그리고 정본 트래커의 오진). §2.4 매트릭스에
      `finalizeCancelledExecution` 행 자체가 없다
- [x] 회귀 테스트 고정 (0행 → emit 0회)

## ② retry-turn CANCELLED 재진입 — 여기는 **진짜** DB≠emit

`finalizeGuarded` 의 CANCELLED 분기는 `COALESCE(duration_ms, :newDurationMs)` 로 **먼저
커밋된 T1 을 의도적으로 보존**한다. 그런데 `RETURNING` 이 없어 caller 는 로컬 T2 를 emit
한다. "retry-turn 처리 중 Stop" 이라는 **일반 흐름에서 결정적으로** 어긋난다.

- [x] CANCELLED 분기에 `.returning(...)` → 영속값 되읽기. 뮤테이션 RED (1234 vs 600000)
- [x] spec §6.5 "알려진 예외 1건" 단락을 **`~~취소선~~ + (2026-08-15 해소)` 노트로 전환**
      — 삭제가 아니다. 같은 파일 `:577` 이 쓰는 관행이고, 원문을 지우면 *왜* 그 예외가
      있었는지가 사라진다 (`13_43_10` rationale_continuity W2)

## ③ REST 재조회에 `durationMs` 가 없다

push 계열(webhook/SSE/WS/chat-channel)은 싣는데 `GET /api/external/executions/:id` 는
필드 자체가 없다. **이벤트 유실 후 재조회로 복구하는 클라이언트 패턴**에서 값이 사라진다.

- [x] `ExecutionStatusDto` + projection 컬럼 + 정확집합 가드(`BASE_COLUMNS`) 갱신
- [x] spec §5.3 응답 예시 동기
- [x] CHANGELOG — additive. 종전 "REST 에는 아직 없다" 문구도 취소선 처리

## 범위 밖 (등재됨)

- `finalizeStalledExhausted` 트랜잭션 (자매 셋 중 하나만 밖) — 별도 PR
- 관용구 16곳 헬퍼 추출 — 별도 PR (넓은 일괄 편집이 대상 밖을 바꾼 전례)
- 종결 emit 타입 파사드 — 위 둘의 구조적 원인, 별도 PR
- 프런트엔드 Duration 컬럼 — **필드 분리가 유일한 정답** (status 로 못 가름)
- **`finalizeGuarded` CANCELLED 분기의 중첩 5단 + QB mock 체인 15곳 중복**
  (`13_58_27` maintainability W5·W7) — 정본 트래커의 *"관용구 16곳 헬퍼 추출"* 항목과 같은
  뿌리다. **이번 PR 에서 안 한다**: 넓은 일괄 편집이 대상 밖 8곳을 조용히 바꿔 전량 되돌린
  전례가 이 계열에 있다. W6(`toPersistedDate`)만 "파싱은 한 곳에" 원칙이라 함께 처리했다
- **`Execution` 엔티티가 nullability 를 거짓말한다** — `finishedAt: Date` / `durationMs: number`
  로 선언돼 있는데 두 컬럼 모두 `@Column({ nullable: true })` 다. 그래서 테스트가
  `null as never` 관용구를 쓰고 서비스 코드가 `?? null` 을 덧붙인다. 정정하면 호출부가
  넓게 흔들리므로 별도 PR (`13_58_27` documentation W9 — 이 주장을 **주석에만 쓰고 등재하지
  않았던 것**이 지적이었다)

## 체크리스트

- [x] `--impl-prep` **BLOCK: NO** (`13_43_10`) — WARNING 3건 전부 이 문서에 반영
- [x] **자매 트래커 동시 갱신** — 3항목 `[x]` (이 커밋과 같은 턴)
- [x] ①②③ 구현 + 회귀 테스트 (①② 뮤테이션 RED 확인, ③ 은 RED→GREEN)
- [x] spec §5.3(REST 예시)·§6.5(취소선+해소) + `node-cancellation.md` 정정·매트릭스 행
- [ ] `/ai-review` CRITICAL 0
- [ ] `--impl-done` BLOCK: NO
- [ ] push 게이트 통과 → PR
