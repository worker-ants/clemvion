# Background (`background`)

> `background` 포트로 연결된 서브그래프를 비동기 큐(BullMQ)로 떼어내고, 메인 흐름은 `main` 포트로 즉시 통과시키는 fire-and-forget 노드.

- **카테고리**: `logic`
- **컨테이너**: no (서브그래프를 실행하지만 handler 관점에서는 단순 pass-through)
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

출처: `backend/src/nodes/logic/background/background.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `notes` | string | no | `''` | 운영용 메모. 핸들러 동작에는 영향 없음 | no (schema상 그대로 저장) |
| `notifyOnFailure` | boolean | no | `false` | 백그라운드 본문 실행이 실패하면 워크스페이스 Admin에게 인앱 알림 전송 | no |
| `maxDurationMs` | integer (≥0) | no | `300000` (5분) | 백그라운드 본문의 최대 실행 시간. `0`이면 무제한 | no |

## Ports

출처: `backend/src/nodes/logic/background/background.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 이전 노드의 출력 |
| Output | `main` | Main | data | 메인 흐름. 핸들러가 즉시 이 포트로 input을 pass-through |
| Output | `background` | Background | data | 비동기로 실행될 분기의 진입점. 엔진이 `main` 처리 직후 엔트리 노드들을 큐로 enqueue |

## Input

핸들러는 input을 그대로 pass-through 합니다. `background` 포트에 연결된 노드들은 별도의 실행 컨텍스트 스냅샷과 함께 BullMQ (`BACKGROUND_EXECUTION_QUEUE`)로 enqueue 되어 `BackgroundExecutionProcessor`가 `executeBackgroundSubgraph`로 돌립니다.

## Output

### 1단계: 핸들러 반환 (main 포트로 즉시 라우팅)

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

| 필드 | 설명 |
| --- | --- |
| `config` | 전달된 config 그대로 (notes / notifyOnFailure / maxDurationMs) |
| `output` | input 그대로 (pass-through) |
| `port` | 항상 `'main'` — `background` 포트는 핸들러가 아니라 엔진이 별도 활성화 |

`meta` / `status` 는 사용하지 않습니다.

### 2단계: 백그라운드 서브그래프 실행 (큐 워커)

- `BackgroundExecutionProcessor.process` 가 `engine.executeBackgroundSubgraph(data)` 호출
- 실패 시 `notifyOnFailure: true` 면 워크스페이스 Admin에게 `background_failure` 타입 인앱 알림 전송
- 실패는 **메인 Execution 상태를 바꾸지 않음** (격리). BullMQ는 job을 `failed`로 기록하고 정책에 따라 재시도할 수 있음
- 메인 Execution은 `main` 포트로 이미 계속 진행된 상태이므로 백그라운드 결과는 메인 흐름에 반영되지 않음

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Async Log`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Async Log"].output }}` | `{ event: "...", userId: "..." }` | input 그대로 (main 포트 흐름 기준) |
| `{{ $node["Async Log"].port }}` | `"main"` | 메인 측에서 활성화된 포트 |
| `{{ $node["Async Log"].config.notifyOnFailure }}` | `true` | 설정 값 |
| `{{ $node["Async Log"].config.maxDurationMs }}` | `300000` | 설정 값 |

> 백그라운드 서브그래프 내부의 노드들은 메인 Execution의 `$node[...]` cache에는 같은 execution ID로 기록되지만 실행 시점이 메인 흐름과 **비동기**이므로, 메인 후속 노드에서 참조하면 "미완" 상태로 보일 수 있습니다. 백그라운드 결과에 의존하지 마세요.

## 주의사항

- Background는 **한 번 fan-out 하면 결과를 기다리지 않습니다.** 결과를 모아야 한다면 `parallel` 노드를 쓰세요.
- 백그라운드 본문 실패는 메인 워크플로우 상태에 영향을 주지 않습니다. 실패 추적이 필요하면 `notifyOnFailure: true` 로 설정하세요 (워크스페이스 Admin에게 알림).
- `maxDurationMs: 0` = 무제한이지만, BullMQ / 큐 레벨에서의 타임아웃이 별도로 있을 수 있습니다.
- `background` 포트 하류에 Blocking 노드(예: `form`)를 두면 백그라운드 실행은 대기 상태로 남을 수 있습니다 — 사용자 입력을 기대하지 않는 자동화된 그래프만 연결하세요.
- 핸들러 자체는 output을 input pass-through로 내므로, `main` 포트 하류에서는 일반적인 데이터 흐름 그대로 이어집니다.
