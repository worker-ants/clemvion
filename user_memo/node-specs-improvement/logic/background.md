# Background (`background`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/background.md](../../node-specs/logic/background.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

`background` 포트로 연결된 서브그래프를 비동기 큐 (BullMQ) 로 떼어내고, 메인 흐름은 `main` 포트로 즉시 통과시키는 fire-and-forget 노드.

```json
{
  "config": {
    "notes": "Fan out analytics event",
    "notifyOnFailure": true,
    "maxDurationMs": 300000
  },
  "output": { "event": "user_signup", "userId": "u_1" },
  "port": "main"
}
```

특징 요약:

- **컨테이너 아님** (handler 관점에서 단순 pass-through). 서브그래프 실행은 엔진 + BullMQ worker 책임.
- `output` 은 input pass-through.
- `port: 'main'` (항상) — `background` 포트는 핸들러가 아닌 엔진이 별도 활성화.
- 실패는 메인 Execution 상태 무영향 (격리). `notifyOnFailure: true` 면 Admin 인앱 알림.
- 백그라운드 서브그래프의 결과 / 상태는 메인 흐름에서 접근 불가.
- `maxDurationMs: 0` = 무제한.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 백그라운드 실행의 추적 ID 없음 | Principle 2 | BullMQ job ID / background run ID 가 메인 흐름에 노출되지 않아 디버깅 시 job 을 찾기 어려움. `meta.backgroundRunId` 필요 |
| 2 | fork 시각 정보 없음 | Principle 2 | 언제 enqueue 됐는지 알 수 없음. `meta.forkedAt` 권장 |
| 3 | `output` pass-through | Principle 1 (형식적) | if_else 와 동일한 케이스 — 라우팅 / 비차단 분기가 의도. pass-through 유지 합리적. 문서 컨트랙트 명시 |
| 4 | `meta.durationMs` 부재 | Principle 2 | 공통 메트릭 — handler 의 enqueue 처리 시간 |
| 5 | 백그라운드 서브그래프 실패 가시화 부족 | Principle 3 | 메인 흐름에서 실패를 관측할 경로가 알림 외에 없음. `meta.backgroundRunId` 로 별도 조회 경로만이라도 확보 |

## 3. 제안된 Output 구조

### Before

```json
{
  "config": {
    "notes": "Fan out analytics event",
    "notifyOnFailure": true,
    "maxDurationMs": 300000
  },
  "output": { "event": "user_signup", "userId": "u_1" },
  "port": "main"
}
```

### After

```json
{
  "config": {
    "notes": "Fan out analytics event",
    "notifyOnFailure": true,
    "maxDurationMs": 300000
  },
  "output": { "event": "user_signup", "userId": "u_1" },
  "meta": {
    "durationMs": 3,
    "backgroundRunId": "bg_run_01HXYZ...",
    "forkedAt": "2026-04-19T10:12:33.000Z",
    "jobId": "bullmq_job_abc123"
  },
  "port": "main"
}
```

**핵심 변경점**:

- `output` 은 **input pass-through 유지** (minimal change). background 의 의미론은 "메인 흐름에 영향을 주지 않는 비동기 분기" 이므로 pass-through 자체가 기능.
- `meta.backgroundRunId` 추가 — 워크플로우 실행 내에서 백그라운드 서브그래프 run 을 식별. 메인 흐름 후속 노드가 필요 시 조회 API 호출 가능.
- `meta.forkedAt: ISO8601` 추가 — enqueue 시각. 디버깅 / 모니터링에 필수.
- `meta.jobId` 추가 — BullMQ job ID. 운영자가 큐 대시보드에서 해당 job 추적 가능.
- `meta.durationMs` 추가 — 공통 메트릭 (handler 자체의 enqueue 시간, 백그라운드 실행 시간 아님).
- 문서 컨트랙트 명시: "background 는 pass-through + 부수적으로 서브그래프를 enqueue. `meta.backgroundRunId` 로만 백그라운드 결과와 연결된다."

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output` | No | pass-through 유지 |
| `$node["X"].output.event` | `$node["X"].output.event` | No | input 필드 유지 |
| `$node["X"].port` | `$node["X"].port` | No | `'main'` 유지 |
| (없음) | `$node["X"].meta.backgroundRunId` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.forkedAt` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.jobId` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 공통 |
| `$node["X"].config.notifyOnFailure` | `$node["X"].config.notifyOnFailure` | No | echo 유지 |
| `$node["X"].config.maxDurationMs` | `$node["X"].config.maxDurationMs` | No | echo 유지 |

**권장 전략**:

1. P0 (additive): `meta.backgroundRunId`, `meta.forkedAt`, `meta.jobId`, `meta.durationMs` 추가. 모두 non-breaking.
2. P0 (운영 문서): 워크플로우 모니터링 UI 에 `meta.backgroundRunId` 를 키로 백그라운드 실행 상태를 조회할 수 있는 API 를 연결.
3. P1: 실패 시 `notifyOnFailure` 알림에 `backgroundRunId` 를 포함해 사용자가 바로 로그로 이동할 수 있도록.
4. 문서 보강: background 의 pass-through 컨트랙트 + "결과를 기다려야 하면 `parallel` 사용" 을 강조.

## 5. 근거

- **Principle 1 (output 은 비즈니스 데이터)**: background 의 "비즈니스 데이터" 는 **메인 흐름의 연속성 그 자체** — pass-through 가 정당. if_else/switch 와 동일한 분류.
- **Principle 2 (meta)**: 실행 추적 정보 (`backgroundRunId`, `forkedAt`, `jobId`, `durationMs`) 는 모두 실행 메트릭.
- **Principle 3 (에러 가시화)**: 격리된 실패를 `meta.backgroundRunId` 라는 추적 키로 연결해 silent failure 를 조금이라도 해소.
- **Minimal change 원칙**: background 의 핵심 컨트랙트 (fire-and-forget + main 흐름 pass-through) 는 유지하고 부가 정보만 `meta` 로 추가.
- INCONSISTENCY_MATRIX 축 6 "Pass-through 노드" 채택안: "input 그대로 유지하되 부가 정보는 `meta` 로 일괄 이동" — 본 제안이 해당 전략을 그대로 따름.
- **대응 관계**: `background` 는 `parallel` 의 fire-and-forget 분기 용 — `parallel` 이 `waitAll: false` 를 지원하지 않는 Phase P1 에서는 background 가 유일한 fire-and-forget 옵션. `meta.backgroundRunId` 가 이 관계에서 유일한 추적 수단이 되어야 함.
