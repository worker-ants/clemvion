# Background output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. fire-and-forget 격리 컨트랙트 + `meta.backgroundRunId` (모니터링 API 조회 키) 유지. 잔여 권고 없음.

> 대상 spec: `spec/4-nodes/1-logic/12-background.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/12-background.md:96-111` — §5.1 (port `main`, pass-through):

```json
{
  "config": {
    "notes": "Fan out analytics event after user signup",
    "notifyOnFailure": true,
    "maxDurationMs": 300000
  },
  "output": { "event": "user_signup", "userId": "u_1" },
  "meta": {
    "durationMs": 0,
    "backgroundRunId": "8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234",
    "forkedAt": "2026-05-10T05:04:37.123Z"
  },
  "port": "main"
}
```

§5.2 — `background` 포트는 핸들러가 활성화하지 않음 (별도 ExecutionContext, fire-and-forget).

## 진단

Background 는 **fire-and-forget 특수 컨테이너 + pass-through**. 메인 흐름의 단계 1개 + background 흐름은 별도.

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 메인 흐름 통과 (`main` 포트) | input pass-through | 적절 — Logic 공통 §10 |
| background 본문 진입 | (별도 ExecutionContext, 메인 노드의 output 아님) | 적절 — fire-and-forget 격리 컨트랙트 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = input pass-through | 적절 | spec §5.1 |
| `meta.backgroundRunId: UUID v4` | 적절 (meta) | 모니터링 API 의 조회 키 — 워크플로우 실행 내 백그라운드 run 식별. 비즈니스 데이터 아닌 식별자 |
| `meta.forkedAt: ISO8601` | 적절 (meta) | fork 시점 타임스탬프 |
| `meta.durationMs` | 적절 | 핸들러 자체의 즉시 처리 시간 (fire-and-forget) — 백그라운드 본문 시간 아님 |
| `meta.jobId?` (예약) | 적절 (meta) | BullMQ job ID — 향후 모니터링 API 확장 지점 |
| `config.notes` / `notifyOnFailure` / `maxDurationMs` (raw echo) | 적절 | Principle 7 |
| `port: 'main'` (handler return) | 적절 | 항상 `main`. `background` 포트는 엔진이 별도 활성화 |

부적절 항목 없음.

추가 점검:

- **`backgroundRunId` 의 위치** — `meta` vs `output` 검토:
  - `meta` 에 두면 다운스트림이 `$node["X"].meta.backgroundRunId` 로 접근 — Principle 2 (실행 메트릭) 에 정확히 맞지는 않음 (식별자 ≠ 메트릭)
  - `output` 에 두면 비즈니스 데이터로 분류 — 그러나 메인 흐름의 후속 노드가 이 ID 를 받아 모니터링 API 호출에 사용한다면 비즈니스적 가치 있음
  - 현 spec 은 `meta` 선택 — Principle 2 의 "토큰/모델/duration 외 실행 컨텍스트 식별자" 카테고리로 해석 가능. 합리적이며 변경 권장 안 함.
- **`output` 에 본문 결과가 없음** — fire-and-forget 컨트랙트의 핵심. spec §5.2 가 "메인 흐름에서 본문 결과 접근 불가" 명시. 결과를 받아야 하면 Parallel 사용. 적절.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
{
  "config": {
    "notes": <string raw>,
    "notifyOnFailure": <boolean>,
    "maxDurationMs": <number>
  },
  "output": { /* input 전체 pass-through */ },
  "meta": {
    "durationMs": <number>,                          // handler-side fork 처리 시간 (보통 0~수 ms)
    "backgroundRunId": <UUID v4>,                    // 본문 run 식별자
    "forkedAt": <ISO8601>,                            // fork 시점
    "jobId"?: <string>                               // BullMQ job ID (향후 확장)
  },
  "port": "main"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- fire-and-forget 노드의 메인 흐름은 본질적으로 pass-through — `output` 에 본문 결과를 두면 격리 컨트랙트 위반.
- `backgroundRunId` 는 모니터링용 식별자로 `meta` 에 위치 — Principle 2 의 실행 컨텍스트 메트릭 카테고리에 부합.
- 본문 컨텍스트의 노드들은 자체 NodeExecution 레코드를 가지며 `parentNodeExecutionId` 로 Background 그룹에 묶임 — 본 noof output 이 아니라 별도 관측 영역.
