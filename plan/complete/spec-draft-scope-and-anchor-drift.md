---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-04
owner: project-planner
status: complete
spec_impact:
  - spec/5-system/2-api-convention.md
  - spec/2-navigation/3-schedule.md
  - spec/3-workflow-editor/3-execution.md
  - spec/1-data-model.md
  - spec/5-system/3-error-handling.md
---

# Draft — 스코프 미명시 · 없는 규칙 인용 · 앵커 소속 미구분

네 항목 모두 **문서가 자기 적용 범위를 말하지 않아 다음 사람이 틀리게 읽은** 자리다.
셋은 실제 오독이 이미 관측됐고, 하나는 없는 규칙을 인용하고 있다.

| # | 대상 | 무엇이 문제인가 | 기원 |
|---|---|---|---|
| ① | `2-api-convention.md` §5.4 | 응답 바디 전용인데 스코프 문구 부재 → 요청 DTO 에 오적용 | `--impl-done` `11_33_21`·`13_00_49` cross_spec |
| ② | `2-navigation/3-schedule.md` §2.1 | `next_run_at` 이 NULL 일 수 있는데 표시 규칙 없음 | `--spec` `#1277` INFO#2 |
| ③ | `2-api-convention.md` §2.2 | `3-execution.md` 가 **§2.2 에 없는 규칙**을 인용 | `--spec` `#1277` W2 |
| ④ | `1-data-model.md` · `3-error-handling.md` | 에러 코드를 **소속 구분 없이** 나열 | `spec-conventions-engine-error-code-surface` 후속 |

---

## ① §5.4 — "응답 바디 한정" 스코프 명시

### 문제

§5.4 는 `## 5. 응답 형식` 하위 절이고 본문도 *"한 **응답** 안에 섞여도 무방하나"* 로 응답을
전제한다. 그런데 **그 사실이 본문에 없다** — 섹션 nesting 으로만 암시된다.

**오독이 실제로 일어났다.** `#1278` 이 요청 DTO 인 `create-assistant-session.dto.ts`
`llmConfigId` 를 고치며 CHANGELOG 에 *"형태는 §5.4 를 따랐다"* 라고 적었다가 되돌렸다.

### 왜 중요한가 — 기계적 마이그레이션이 계약을 깬다

`spec-draft-nullable-notation-followups.md` 의 **drift 104곳 배치**에 `update-*.dto.ts` 류가
섞여 있다. 그쪽은 **PATCH tri-state** 다:

| 요청 형태 | 의미 |
|---|---|
| 키 생략 | 값 불변 |
| `null` | 초기화(기본값으로 되돌림) |
| 값 | 설정 |

§5.4 의 "상시 존재 → `@ApiProperty` + non-optional" 을 여기 기계 적용하면 `?` 가 사라져
**"필드를 생략하면 값이 유지된다" 는 부분 업데이트 계약이 깨진다.** 표기 문제가 아니라
실제 회귀다. 선례는 `update-assistant-session.dto.ts` 가 이미 주석으로 명시하고 있다 —
*"Allow explicit null to clear the pinned config"*.

### 변경안

§5.4 서두(표 앞)에 스코프 문단을 넣는다:

```
> **적용 범위 — 응답 바디.** 본 절은 `## 5. 응답 형식` 하위 절이며, 서버가 **내보내는**
> 표현을 정한다. **요청 바디는 대상이 아니다** — 특히 PATCH 부분 업데이트는 키 생략(=값
> 불변) · `null`(=초기화) · 값(=설정) 의 **tri-state** 가 의미를 갖는 별개 계약이라,
> `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 조합이 정당하다
> (선례: `UpdateAssistantSessionDto.llmConfigId`). 아래 "DTO 선언 형태" 규칙을 요청 DTO 에
> 적용하면 부분 업데이트 계약이 깨진다.
```

---

## ② `3-schedule.md` §2.1 — `다음 실행 시각` NULL 표시

### 문제

`#1277` 이 `1-data-model.md` §2.9 의 `next_run_at` 을 `Timestamp?` 로 정정했다. 그런데 이
값을 **화면에 보여주는** 문서(`3-schedule.md:58`)는 *"다음 예정된 실행 시각 (절대 시간)"*
이라고만 적어 **NULL 일 때 무엇을 보이는지 말하지 않는다.**

### 실측 — FE 는 이미 방어하고 있다

`codebase/frontend/src/app/(main)/w/[slug]/schedules/page.tsx:1080-1082`

```tsx
{schedule.nextRunAt ? formatDate(schedule.nextRunAt, "datetime") : "-"}
```

동작 위험은 없다. **문서만 낡았다** — 구현이 정한 것을 spec 이 안 적고 있다.

### NULL 이 되는 경로 (`#1277` 실측 인용)

- `schedule-runner:189` — cron 파싱 실패 `catch`
- `schedules.service:241` — 계산 결과 없음

### 변경안

`3-schedule.md:58` 행을 고친다:

```
| 다음 실행 시각 | 다음 예정된 실행 시각 (절대 시간). **계산할 수 없으면 `-`** — cron 파싱 실패나 다음 발화 시각 부재로 `next_run_at` 이 NULL 인 경우다 ([트리거 데이터 흐름 §3.2](../data-flow/10-triggers.md#32-다음-실행-시각-계산) · [데이터 모델 §2.9](../1-data-model.md#29-schedule)) |
```

> 링크는 **`data-flow/10-triggers.md §3.2` 를 먼저** 건다 (`--spec` INFO#1) — NULL 이 되는
> 두 경로(파서 예외 · 계산 결과 없음)를 **둘 다** 서술하는 문서는 그쪽이고, 데이터 모델
> §2.9 는 컬럼 정의라 절반만 담는다. 형제 `2-trigger-list.md:100` 도 같은 표기다.

---

## ③ §2.2 — 자원 액션 패턴 성문화

### 문제 — 없는 규칙을 인용하고 있다

`spec/3-workflow-editor/3-execution.md:757` (R-1.3):

> 경로는 api-convention **§2.2 의 단일 동사 action 패턴**(`/execute`·`/stop` 선례)을 따라 …

§2.2 에 그런 규칙이 **없다.** §2.2 의 RPC-style 예외는
`{resource}/{id}/{channel}/{action}` — **4세그먼트 sub-channel** 형태이고,
`/executions/:id/stop` 은 `{resource}/{id}/{action}` — **3세그먼트**다. 다른 형태다.

### 실측 (2026-09-04) — 기준을 함께 적는다

**집계 기준**: `codebase/backend/src/**/*.controller.ts` 의 `@Controller` + 라우트 데코레이터를
합성해 전체 경로를 만들고, **마지막 세그먼트가 파라미터가 아니면서 그 앞이 `:param`** 인 것.

- 전체 라우트 **185개** 중 이 형태 **60개**
- 그중 **동사(액션) 33개** · **명사(하위 자원) 26개** · auth 예외 1개(`/auth/oauth/:provider/callback`)

> 명사/동사 분류는 **손으로** 했다. 자동 판별 기준이 없어서다. 전량을 아래에 적어 두니
> 다음 사람이 대조할 수 있다.

**동사 액션 33개**: `cancel` · `continue` · `dismiss` · `duplicate` · `execute`(2) ·
`export` · `interact` · `leave` · `re-embed`(2) · `re-extract`(2) · `re-run` · `read` ·
`reauthorize` · `refresh-token` · `regenerate` · `request-scopes` · `resend` · `restore` ·
`retry-failed` · `reveal` · `revoke` · `rotate` · `run-now` · `save` · `set-default` ·
`stop` · `switch` · `test`(2) · `transfer-ownership`

**명사 하위 자원 26개**: `activity`(2) · `catalog` · `chain` · `documents`(2) ·
`embed-config` · `embedding-stats` · `entities` · `graph-warnings` · `history` ·
`invitations`(2) · `members`(2) · `messages` · `models` · `preview` · `relations` ·
`scope` · `settings`(2) · `stream` · `usage` · `usages`(2)

### **"단일 동사" 는 이름부터 틀렸다**

33개 중 **9개가 하이픈 복합 동사구**다 — `re-run` · `run-now` · `set-default` ·
`transfer-ownership` · `request-scopes` · `retry-failed` · `refresh-token` · `re-extract` ·
`re-embed`. 규칙을 "단일 동사" 로 적으면 이 9개가 전부 위반이 된다.

`3-execution.md` R-1.3 이 실제로 결정한 것은 **동사 개수**가 아니라 **목적어의 위치**다 —
`execute-node` 가 아니라 `nodes/:nodeId/execute` 로 쓴 것, 즉 **목적어는 경로에 두고 액션
이름에 넣지 않는다**.

### 변경안 (A) — §2.2 에 행 추가

§2.2 표는 기존 3개 예외 행이 **전부 한 줄**이다(GFM 파이프 테이블). 새 행도 한 줄로 넣는다
(`--spec` W3 — 초판은 멀티라인이라 그대로 삽입하면 표가 붕괴한다):

```
| **자원 액션**: `/api/{resource}/{id}/{action}` 의 마지막 세그먼트는 자원이 아니라 **동사(구)** 다 — 앞의 경로가 가리키는 자원에 가하는 동작. 케밥 케이스 복합 동사구도 포함한다 (`run-now`, `transfer-ownership`, `set-default`). **목적어는 경로에 두고 액션 이름에 넣지 않는다** — `/workflows/:id/nodes/:nodeId/execute` 이지 `/workflows/:id/execute-node` 가 아니다. 위 RPC-style 예외는 `{channel}` 이 하나 더 끼는 자매 형태다. **Boolean 상태 필드의 단순 토글에는 적용하지 않는다** — [§12.1 상태 토글 패턴](#121-상태-토글-패턴)이 `PATCH /:id { field: value }` 를 규정하며 `POST /:id/activate` 류 전용 엔드포인트를 금지한다 | `/executions/:id/stop`, `/schedules/:id/run-now`, `/workflows/:id/nodes/:nodeId/execute` |
```

§12.1 쪽에도 역참조 한 문장을 넣어 두 절이 서로를 가리키게 한다:

```
> 상태 토글이 **아닌** 동작(실행·중단·복제·권한 이양 등)의 경로 형태는 [§2.2 자원 액션](#22-명명-규칙)이 정한다.
```

> **경계에 걸친 기존 엔드포인트 1건을 발견했다** — `PATCH /notifications/:id/read`.
> §12.1 은 `is_read`(Notification) 를 **Boolean 토글 필드**로 명시해 `PATCH /:id { is_read: true }`
> 를 요구하는데, 구현은 전용 `read` 액션 경로다. 다만 이것은 **일방향 전이**다 — 짝이 되는
> `unread` 엔드포인트가 없고 `markAsRead` 만 있다. 토글인지 전이인지에 따라 §12.1 적용
> 여부가 갈리므로 **여기서 판정하지 않고 등재**한다(경로 변경은 공개 API 표면 변경이다).
> 새 행의 경계 문장은 이 자리를 정당화하지 않는다.

### 변경안 (B) — `3-execution.md:757` 인용 정정

*"§2.2 의 단일 동사 action 패턴"* → *"§2.2 의 자원 액션 패턴"*. 괄호 안 부연도 실제 결정
(목적어의 위치)에 맞춘다.

---

## ④ 에러 코드 — 소속 구분 없이 나열

### ④-a `1-data-model.md:474` (`Execution.error` 행)

엔진 인프라 코드 **6종**을 나열하는데 **어디에 등재된 코드인지 말하지 않는다.**

**실측 (2026-09-04)**:

| 코드 | 앵커 |
|---|---|
| `SERVER_INTERRUPTED` | `EngineErrorCode` const |
| `WORKER_HEARTBEAT_TIMEOUT` | `EngineErrorCode` const |
| `EXECUTION_TIME_LIMIT_EXCEEDED` | `ErrorCode` const |
| `RESUME_CHECKPOINT_MISSING` | `RehydrationError.code` **생성자 positional 리터럴 유니온** (`ai-conversation-helpers.ts:38-43`) — 가드 `ANCHORED_ELSEWHERE` 등재 |
| `RESUME_INCOMPATIBLE_STATE` | 같은 유니온 — 가드 `ANCHORED_ELSEWHERE` 등재 |
| `RESUME_FAILED` | 같은 유니온에 **포함돼 있으나** 가드 `ANCHORED_ELSEWHERE` 에는 **미등재** — 일반 메서드 인자로만 쓰여 스캔 표면 밖이다 (`exec-intake-followups.md:56` 이 그 사유를 남겼다) |

> **내 1차 실측도 좁았다.** 처음엔 세 RESUME_* 의 앵커를 `markExecutionCancelled` 파라미터
> 유니온(`execution-engine.service.ts:2798-2801`)으로 적었다. 그것도 실재하지만 **정본
> 앵커가 아니다** — 저장소가 등재해 둔 것은 `RehydrationError.code` 이고, 셋의 처지도
> 같지 않다(`RESUME_FAILED` 만 가드 표면 밖). 내가 먼저 찾은 자리를 정본으로 착각했다.

> **선행 plan 의 전제도 정정한다.** `spec-conventions-engine-error-code-surface.md` 는 이
> 자리를 *"`EngineErrorCode` / `ErrorCode` / 둘 다 아님(raw literal) **삼분법**"* 이라
> 적었다. 이 6종에 한해 **세 번째 칸은 비어 있다** — 앵커 없는 맨 문자열이 하나도 없고,
> 대신 **클래스 필드 유니온**이라는 앵커 종류가 하나 더 있다.

### ④-b `1-data-model.md:562` (`error` 필드 관계 표의 "복사" 행)

> | 복사 | Execution.error — 워크플로우 실행이 `failed` 상태로 전이될 때, **최초 failed
> NodeExecution**의 에러 정보를 복사 |

**복사만이 유일한 채움 경로처럼 읽힌다. 아니다.** `markQueueWaitTimeout`
(`execution-engine.service.ts:2872-2889`) 은 admission 대기 초과 시 `Execution.error` 를
**직접 UPDATE** 한다 — 노드가 시작된 적이 없어 복사할 NodeExecution 자체가 없다.

```ts
.set({
  status: ExecutionStatus.CANCELLED,
  error: { code, message },   // code = EngineErrorCode.EXECUTION_QUEUE_WAIT_TIMEOUT
  ...
})
```

이 경로의 종결 상태는 **`cancelled`** 다(`failed` 아님). 그래서 §1.4("execution status →
`failed`") 목록에는 안 들어가는 것이 맞고, 정정 대상은 데이터 모델의 이 행 하나다.

### ④-c `3-error-handling.md` §1.4

*"엔진 수준 에러"* 10종을 **단일 집합처럼** 나열한다. 실측하면 앵커가 셋으로 갈린다:

| 앵커 | 코드 |
|---|---|
| `ErrorCode` const | `EXECUTION_TIME_LIMIT_EXCEEDED` |
| `EngineErrorCode` const | `WORKER_HEARTBEAT_TIMEOUT` |
| 에러 클래스 `readonly code` | `ERROR_PORT_FALLBACK` (`execution-engine.service.ts:315`) |
| **앵커 없음(맨 문자열)** | `EXECUTION_TIMEOUT` · `RECURSION_DEPTH_EXCEEDED` · `MAX_ITERATIONS_EXCEEDED` · `CYCLE_DETECTED` · `INVALID_EXPRESSION` · `VARIABLE_NOT_FOUND` · `TYPE_MISMATCH` |

> **주의 — 동명 문자열이 앵커로 보인다.** `CYCLE_DETECTED`·`INVALID_EXPRESSION` 은
> `shadow-workflow.ts` 의 유니온과 `execution-failure-classifier.ts` 의 목록에 같은 이름으로
> 나온다. 그러나 그것들은 **소비자·분류기 쪽 어휘**이지 엔진 발행 경로의 앵커가 아니다.
> 앵커를 세는 grep 이 이 둘을 세면 7종이 5종으로 줄어 보인다.

### 변경안

세 자리 모두 **소속을 함께 적는다**. 목록을 늘리지 않고, 각 코드 옆에 앵커 종류를 표기하고
"이 목록이 단일 등재처를 뜻하지 않는다" 를 명시한다. §1.4 에는 앵커 열을 추가한다.

---

## 자매 plan 동기화 — 이 변경이 착지할 때 함께 닫는다

`--spec` W4·INFO#4 지적. 이 draft 는 다른 두 plan 의 열린 항목을 해소하므로, **반영
커밋에서 그쪽 체크박스도 함께 닫는다**(따로 두면 다음 사람이 이미 끝난 일을 쫓는다).

| plan | 닫는 항목 | 비고 |
|---|---|---|
| `spec-draft-nullable-notation-followups.md` | §5.4 응답 바디 스코프 문구 (①) · §2.2 단일 동사 action 패턴 (③) · `3-schedule.md` §2.1 (②) | 3건 전부. 남는 것은 drift 배치·`idx_schedule_next_run` 둘 |
| `spec-conventions-engine-error-code-surface.md` | 인접 drift 하위 2건 — `1-data-model.md`(④-a·④-b) · `3-error-handling.md §1.4`(④-c) | **부분 해소.** `error-codes.ts` JSDoc 은 코드 주석이라 developer 트랙으로 남는다 — 그 항목을 하위 3개로 쪼개 2개만 닫는다 |

## 넘기는 것

- **`error-codes.ts` `EngineErrorCode` JSDoc 의 이분법 프레이밍** — `spec/` 이 아니라 코드
  주석이라 **developer 트랙**이다. `spec-conventions-engine-error-code-surface.md` 에 이미
  등재돼 있다. 위 ④ 가 spec 쪽을 고치면 그 주석과의 대조가 쉬워진다.

## Rationale

### ① 을 "요청도 포함하게 넓히기" 로 하지 않은 이유

§5.4 의 두 표현(`null` 상시 존재 vs 키 생략)은 **소비자가 응답을 어떻게 읽는가**에 대한
규칙이다. 요청의 tri-state 는 **서버가 부분 업데이트를 어떻게 해석하는가**로 축이 다르다.
한 절이 둘을 다 맡으면 "상시 존재" 같은 용어가 두 뜻을 갖게 된다. **경계를 긋는 쪽**을
택했다.

### ③ 을 "예외" 가 아니라 "형태" 로 적는 이유

§2.2 의 기존 두 예외(RPC-style sub-channel · 인증 family)는 *"규칙 위반처럼 보이지만
정당한 사유가 있다"* 는 서술이다. 자원 액션은 그것과 성격이 다르다 — **33개, 전체
라우트의 18%** 로 관행이 확립돼 있고, `3-execution.md` 가 이미 **규칙으로 인용**하고 있다.
예외로 적으면 "가급적 피하되 봐준다" 로 읽혀 실제 관행과 어긋난다.

> **기각한 대안 — "단일 동사" 로 성문화**: `3-execution.md` 의 표현을 그대로 옮기는
> 안이다. 실측이 반증했다 — 33개 중 9개가 하이픈 복합 동사구라 **그 규칙은 저장소의 27%
> 를 즉시 위반으로 만든다.** 인용문을 규칙으로 승격하기 전에 그 인용이 정확한지부터
> 확인해야 했다.

### ④ 를 "코드를 전부 const 로 옮기기" 로 하지 않은 이유

그것은 **구현 변경**이고 planner 권한 밖이다. 그리고 저장소가 이미 판단을 남겼다 —
`plan/complete/exec-intake-followups.md:56`:

> 셋 다 **이미 타입 앵커가 있다.** 상수로 또 옮기면 앵커가 둘이 되어 갈라진다. 가드의
> `ANCHORED_ELSEWHERE` 에 **사유와 함께** 등재했다.

같은 사실이 `codebase/backend/src/nodes/core/error-codes.ts:138` JSDoc 에도 미러돼 있다.
여기서 할 일은 **문서가 소속을 숨기지 않게** 하는 것뿐이다.

> **인용을 한 번 틀렸다** (`--spec` W2). 초판은 이 문장을
> `spec-conventions-engine-error-code-surface.md` 에서 인용했다고 적었는데 **그 문서에는
> 없다.** 내가 `error-codes.ts` JSDoc 에서 읽은 것을 옆의 plan 으로 잘못 귀속시켰다.
> checker 가 원문 위치를 특정해 잡았다.

### `--spec` 기본 예산을 올려서 돌렸다

기본 예산(`CONSISTENCY_MAX_CONTEXT_SIZE=262144`)으로 준비하니 프롬프트가 알파벳 순으로
`spec/2-navigation/` 까지만 담고 **`5-system/`·`3-workflow-editor/` 에 도달하지 못했다** —
이 draft 의 대상 4개 중 **0개가 적재되지 않은 상태**였다(`_prompts` 헤더로 실측). 그대로
돌렸으면 checker 가 대상 본문을 못 보고 판정했을 것이다.

`CONSISTENCY_MAX_CONTEXT_SIZE=900000` 으로 재준비해 `cross_spec` 에 §5.4·§2.2·§1.4·
`3-execution.md` 가 **전부 적재된 것을 확인한 뒤** 실행했다. 실제로 그 라운드가 §12.1 경계
문제와 인용 오귀속을 잡았다 — 기본 예산이었으면 둘 다 못 잡았을 지적이다.

### 실측이 선행 plan 의 전제를 정정한 건

`spec-conventions-engine-error-code-surface.md` 가 "삼분법" 이라 적은 자리를 실측하니
`1-data-model.md:474` 의 6종에는 **앵커 없는 코드가 하나도 없었고**, 대신 세 번째 앵커
종류(파라미터 유니온)가 있었다. 등재된 전제라도 착수 전에 다시 재는 것이 이 저장소의
반복된 교훈이다 (`execution-engine-residual-gaps` G2 장애물 1 이 조용히 낡았던 건과 같다).
