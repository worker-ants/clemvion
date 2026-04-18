# Background (`background`)

> 본문 분기를 백그라운드로 비동기 실행하면서, 메인 흐름은 즉시 다음 노드로 진행시키는 노드. fire-and-forget 패턴.

- **카테고리**: `logic`
- **컨테이너**: no (background 분기는 그래프상 다른 노드들로 구성)
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `notes` | string | no | `''` | 백그라운드 작업 목적·주의사항을 기록 (UI 메모) | no |
| `notifyOnFailure` | boolean | no | `false` | 백그라운드 본문 실패 시 워크스페이스 Admin에게 인앱 알림 발송 | no |
| `maxDurationMs` | int | no | `300000` (5분) | 본문 최대 실행 시간(ms). `0`이면 무제한 | no |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 입력 |
| Output | `main` | Main | 메인 흐름 — 핸들러 종료 직후 즉시 라우팅 |
| Output | `background` | Background | 백그라운드 분기 — 엔진이 컨텍스트 스냅샷과 함께 큐로 enqueue |

## Input

핸들러는 input을 그대로 사용 (변형 없이 main 포트로 통과).

## Output

### Case 1: 핸들러 반환 (메인 흐름 진행)

```json
{
  "config": {
    "notes": "주문 알림 비동기 발송",
    "notifyOnFailure": true,
    "maxDurationMs": 300000
  },
  "output": { "orderId": "o_1", "amount": 1000 },
  "port": "main"
}
```

### Case 2: background 포트 — 별도 실행 컨텍스트

핸들러 자체는 `port: "main"`만 명시하지만, **엔진이 핸들러 종료 직후 자동으로** background 분기의 본문 서브그래프를 큐에 등록합니다. 백그라운드 실행은:

- 별도 NodeExecution 트리로 추적
- 부모 실행 결과에 영향 주지 않음 (실패해도 메인 흐름 계속)
- `notifyOnFailure: true`이면 실패 시 Admin 알림
- `maxDurationMs` 초과 시 강제 종료

| 필드 | 설명 |
| --- | --- |
| `config.*` | 입력 설정 (resolved) |
| `output` | input pass-through |
| `port` | 항상 `'main'` (background는 엔진이 자동 dispatch) |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Send Notification`이라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Send Notification"].output }}` | `{ orderId: "o_1" }` | input 그대로 |
| `{{ $node["Send Notification"].port }}` | `"main"` | 항상 main |
| `{{ $node["Send Notification"].config.notifyOnFailure }}` | `true` | 실패 알림 설정 |

> 백그라운드 분기의 노드들은 별도 실행 컨텍스트에서 실행되므로, 메인 흐름의 후속 노드에서 그 결과를 변수로 참조할 수 없습니다.

## 주의사항

- 백그라운드 분기에서 발생한 데이터는 메인 흐름에서 접근 불가 — 결과를 공유하려면 외부 저장소(DB, KV 등)를 통해야 합니다.
- `maxDurationMs`를 너무 길게 설정하면 워커 자원이 묶일 수 있음. 기본 5분 권장.
- 백그라운드 분기 안에 form 같은 blocking 노드를 넣으면 워커가 무한 대기하므로 피하세요.
- `notifyOnFailure`는 워크스페이스 Admin 사용자에게만 인앱 알림을 보냅니다 — 외부(Slack/Email)는 별도 노드 사용.
