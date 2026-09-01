---
title: "spec draft — `clemvion.audit.write_failed` 를 NF-OB-07 카탈로그에 등재"
worktree: .claude/worktrees/audit-record-factory
started: 2026-09-01
completed: 2026-09-01
owner: project-planner
status: applied
priority: P2
spec_impact:
  - spec/5-system/_product-overview.md
  - spec/data-flow/9-observability.md
  - spec/data-flow/1-audit.md
---

**✅ 적용 완료 (2026-09-01).** §A~§C 를 spec 세 문서에 반영했다. planner 의무 게이트
`/consistency-check --spec` 은 `review/consistency/2026/09/01/15_00_54` 에서 **BLOCK: NO**
이고, 그 WARNING 2건(원칙 예외를 원 출처에 교차 참조 · 기존 plan 항목과 연결)도 함께
반영했다. 이 문서는 **그 결정의 근거 산출물**로 보존한다.

## Overview

감사 로그 적재 실패를 계측하는 카운터 `clemvion.audit.write_failed` 를 신설했는데
(`spec-sync-auth-gaps.md` 항목), spec 세 곳이 그 사실을 반영하지 못한다.

`spec/data-flow/9-observability.md` 의 Rationale 이 스스로 **"새 소비자를 배선할 때 유니온과
NF-OB-07 카탈로그 표를 동시에 넓히는 것이 규칙"** 이라고 못 박고 있고, 선례
(`clemvion.redis.fail_open`)도 전용 planner 턴으로 카탈로그를 갱신했다. 그 규칙을 이행한다.

**한 곳은 단순 누락이 아니라 이제 거짓이다** — `1-audit.md` 가 "실패는 로그로만 남는다" 고
적는데, 실패는 이제 로그 **와** 카운터로 남는다.

---

## 변경안

### A. `spec/5-system/_product-overview.md` — NF-OB-07

**A-1. 요약행 (`:75`)** — 도메인 나열에 감사를 더한다.

```diff
-| NF-OB-07 | 도메인/비즈니스 커스텀 메트릭 (OTel) — 워크플로 실행·큐·LLM·노드 지연·Redis fail-open 강등을 OTel MeterProvider(NF-OB-02) 위에 노출 | 권장 | … |
+| NF-OB-07 | 도메인/비즈니스 커스텀 메트릭 (OTel) — 워크플로 실행·큐·LLM·노드 지연·Redis fail-open 강등·감사 적재 실패를 OTel MeterProvider(NF-OB-02) 위에 노출 | 권장 | … |
```

**A-2. 카탈로그 표** — `clemvion.redis.fail_open` 행 **아래**에 신규 행. 두 메트릭이 같은
결함 클래스(조용히 삼킨 실패)라 나란히 두는 것이 읽는 사람에게 맞다.

| `clemvion.audit.write_failed` | Counter | `resource_type` (감사 대상 리소스 종류 — 코드가 정하는 값, 실측 12종) | 감사 로그 적재가 실패해 삼켜진 횟수. `AuditLogsService.record()` 는 감사 실패가 본 요청(회전·삭제 같은 특권 작업)을 깨뜨리지 않도록 예외를 삼키는데, 종전에는 그 뒤가 warn 로그뿐이라 **"작업은 200 으로 성공, 감사 행만 조용히 비어 있음"** 이 안 보였다. 감사 로그는 "계정 탈취 후 조용한 시크릿 교체를 재구성한다" 는 신뢰를 지탱하고, 그 신뢰는 적재가 실제로 됐을 때만 성립한다. 알람 예: `rate(clemvion_audit_write_failed[5m]) > 0` |

**A-3. 표 위 서술** — "모든 라벨은 bounded cardinality (enum·등록 모델 수·노드 타입·표준
에러 코드)" 에 이번 라벨의 성격을 더한다. `resource_type` 은 코드가 정하는 값이라 유계지만
**소스 시그니처가 `string`(열림)이라 컴파일러가 닫힘을 증명하지 못해** 64자 클램핑으로
방어한다 — `error_code` 와 같은 방식이다. 그 사실을 한 문장으로 적는다.

### B. `spec/data-flow/9-observability.md` (`:202`~`:205`)

인프라 메트릭 블록쿼트의 나열에 감사 카운터를 더한다.

```diff
-노드 지연(`clemvion.node.duration`)·Redis fail-open 강등(`clemvion.redis.fail_open`) — 을
+노드 지연(`clemvion.node.duration`)·Redis fail-open 강등(`clemvion.redis.fail_open`)·
+감사 적재 실패(`clemvion.audit.write_failed`) — 을
```

### C. `spec/data-flow/1-audit.md` (`:21`~`:23`) — **이제 거짓인 서술**

현재:

> 두 `record` 모두 **실패를 삼킨다** (swallow) … 호출부가 `await` 해도 throw 되지 않으며,
> **실패는 로그로만 남는다** (`audit-logs.service.ts` 의 `logger.warn`,
> `login-history.service.ts` 의 `Logger.error` — 둘 다 NestJS `Logger`).

**두 `record` 의 사정이 갈렸으므로 하나로 묶어 서술할 수 없다.** 나눠 적는다:

> 두 `record` 모두 **실패를 삼킨다** (swallow) — 감사 기록 실패가 주 동작(리소스 변경·인증
> 흐름)을 깨서는 안 된다는 계약. 호출부가 `await` 해도 throw 되지 않는다.
>
> **삼킨 실패가 어떻게 관측되는지는 둘이 다르다**:
>
> - `audit-logs.service.ts` — `logger.warn` **에 더해** 카운터
>   `clemvion.audit.write_failed{resource_type}` 를 올린다(`spec/5-system/_product-overview.md` NF-OB-07 카탈로그).
>   로그는 사후 조회는 되지만 비율·추세로 알람을 걸 수 없어서다. 로그 메시지에는 **무엇이
>   유실됐는지**(`action`·`resourceType`·`resourceId`·`workspaceId`)를 함께 싣는다 — 유실
>   사실만 알고 대상을 모르면 조사도 복구도 시작할 수 없다.
> - `login-history.service.ts` — `Logger.error` 뿐이다. 카운터가 없다.

**`login_history` 쪽을 이번에 넓히지 않는 이유**: 그건 코드 변경이고 이 draft 는 spec
동기화다. 다만 "둘이 다르다" 를 명시해 두면 다음 사람이 비대칭을 **발견**할 수 있다 —
지금처럼 하나로 뭉뚱그리면 그 사실 자체가 안 보인다. 후속 항목으로 등재한다.

---

## Rationale

### 왜 카탈로그 표에 행을 더하는가 (문서 어딘가에 적는 것으로 안 되나)

`9-observability.md` 가 스스로 "카탈로그 표를 동시에 넓히는 것이 규칙" 이라 적고 있다.
그 규칙이 있는 이유는 **알람을 거는 사람이 표 하나만 보면 되게** 하기 위해서다. 표 밖에
흩어지면 "이 메트릭이 있는지" 를 코드에서 확인해야 하고, 그러면 카탈로그가 SoT 이기를
그만둔다.

### 왜 `redis.fail_open` **아래**인가

두 메트릭은 같은 결함 클래스다 — **조용히 삼킨 실패를 보이게 하는** 카운터. 표에서 이웃하면
다음에 같은 클래스가 생겼을 때 어디에 넣을지가 자명해진다. 알파벳순이나 추가순으로 흩으면
그 묶음이 안 보인다.

### 왜 `1-audit.md` 를 둘로 가르는가

원문은 두 `record` 를 하나로 묶어 "로그로만 남는다" 고 적었다. 이제 한쪽만 카운터가 있으므로
그 문장은 **어느 쪽으로 읽어도 틀리다** — 묶어서 "로그로만" 이라 하면 `audit-logs` 가 거짓,
묶어서 "로그와 카운터" 라 하면 `login-history` 가 거짓이다.

비대칭을 감추지 않고 드러내는 쪽을 택했다. 문서가 "둘이 다르다" 고 말하면 다음 사람이
`login_history` 쪽 갭을 발견할 수 있고, 뭉뚱그리면 못 한다.

### 기각한 대안

- **`login_history` 에도 카운터를 붙여 서술을 다시 묶는다** — 코드 변경이라 spec 동기화
  draft 의 범위를 넘는다. 그리고 그 결정("감사 실패 관측을 어디까지 넓히나")은 이 draft 가
  단독으로 내릴 것이 아니다. 후속 항목으로 등재한다.
- **`resource_type` 을 닫힌 유니온으로 spec 에 적는다** — 실측 12종이지만
  `AuditLogsService.record()` 시그니처가 `resourceType: string`(열림)이라 **컴파일러가 닫힘을
  증명하지 못한다.** 증명되지 않은 닫힘을 spec 이 주장하면 다음 사람이 그걸 믿고 클램핑을
  지운다. 클램핑으로 방어한다는 사실을 그대로 적는다.

## 관련

- 구현·리뷰: `plan/in-progress/spec-sync-auth-gaps.md` (감사 로깅 잔여)
- 리뷰 SD1: `review/code/2026/09/01/14_31_12/SUMMARY.md`
- 선례: `clemvion.redis.fail_open` 카탈로그 등재
