# Code output 개선안

> 대상 spec: `spec/4-nodes/5-data/2-code.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/5-data/2-code.md:130-148` — §5.1 정상 종료 (port `success`):

```json
{
  "config": { "language": "javascript", "code": "return $input.value * 2;", "timeout": 30 },
  "output": 42,
  "meta": { "durationMs": 7, "success": true, "logs": [] },
  "port": "success"
}
```

`spec/4-nodes/5-data/2-code.md:191-220` — §5.3.1 사용자 코드 throw (port `error`):

```json
{
  "config": { "language": "javascript", "code": "throw new Error('boom');", "timeout": 30 },
  "output": {
    "error": {
      "code": "CODE_EXECUTION_FAILED",
      "message": "boom",
      "details": { "legacyCode": "CODE_RUNTIME_ERROR", "stack": "Error: boom\n    at code-node.js:3:7" }
    }
  },
  "meta": { "durationMs": 5, "success": false, "logs": [] },
  "port": "error"
}
```

§5.3.2 타임아웃: `output.error.code: 'CODE_TIMEOUT'`.

## 진단

Code 는 사용자 정의 JS 실행 노드 (단계 1개). 정상 / 런타임 throw / 타임아웃 = 3 케이스.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = 사용자 `return` 값 | 적절 — Principle 8.2 예외 | spec footnote: "shape 은 사용자 코드가 결정. `output.result` 래핑은 적용하지 않음 — 개선안 §5 근거". Transform 과 동일 의도 (사용자 자유 형태 보존) |
| `output: undefined` (return 없음) 시 생략 | 적절 | Principle 11 |
| `output.error.{code, message, details?}` (런타임) | 적절 | Principle 3.2 |
| `output.error.details.legacyCode` | 적절 | 내부 분류용 (`CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT`) — 후속 노드는 `output.error.code` 사용 |
| `output.error.details.stack` (`NODE_ENV !== 'production'` 한정) | 적절 | 프로덕션 내부 경로 노출 방지 |
| `meta.success: boolean` | 적절 (meta) | Code 노드 전용 편의 필드 (Principle 2 권장) |
| `meta.logs: string[]` (`console.*` 캡처, 100줄 cap) | 적절 (meta) | 디버깅 메트릭 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.language` / `config.code` / `config.timeout` (raw echo) | 적절 | Principle 7. `code` 는 expression 평가 안 됨 (`expression-exclusions`) |

부적절 항목 없음.

추가 점검:

1. **`output` root 자유 형태 (vs `output.result` wrapper)** — Transform 과 같은 의도. 사용자가 `return { items: [...] }` 하면 다운스트림이 `$node["X"].output.items` 로 직접 접근. wrapper 강제는 사용자 경험 악화. spec 명시 폐기.
2. **`output.error` (런타임) wrapper 사용** — 정상은 root 자유 형태이지만 에러는 표준 envelope. 시멘틱 분기로 합리적: 다운스트림은 `output.error` 존재 여부 / `port === 'error'` 로 판별.
3. **`meta.success` boolean 필드** — Principle 2 가 권장 필드로 명시 (Code 계열). `port === 'success'` 와 의미 중복이지만 expression 안정성을 위해 유지.
4. **`output.error.details.legacyCode`** — 내부 정규화 매핑 가시화. `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED` 매핑 spec footnote 표 참조.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// 정상
{
  "config": { "language": "javascript", "code": <raw>, "timeout": <number> },
  "output": <사용자 return 값 — primitive | object | array | undefined>,
  "meta": { "durationMs": <number>, "success": true, "logs": [<string>, ...] },
  "port": "success"
}

// 런타임 throw / 타임아웃
{
  "config": {...},
  "output": {
    "error": {
      "code": "CODE_EXECUTION_FAILED" | "CODE_TIMEOUT" | "CODE_MEMORY_LIMIT" /* 로드맵 */,
      "message": <string>,
      "details": {
        "legacyCode": <string>,
        "stack"?: <string>           // NODE_ENV !== 'production'
      }
    }
  },
  "meta": { "durationMs": <number>, "success": false, "logs": [<string>, ...] },
  "port": "error"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 (의도적 Principle 8 예외) |

## Rationale

- Code 노드는 사용자가 직접 정의한 JS 의 결과를 그대로 노출 — Transform 과 같은 "shape 자유" 패턴.
- 정상 vs 에러 시 `output` shape 이 다른 것은 시멘틱 분기 — `port` 또는 `output.error` 존재 여부로 판별. spec 이 명시.
- `meta.success` 는 Principle 2 가 명시 권장 — Code 계열 노드의 빠른 분기 키.
- 사용자 코드 throw 와 타임아웃을 모두 `port: 'error'` 로 흘리는 결정 (Data 공통 §4.1) 은 "사용자 코드의 throw / 타임아웃은 정상 시나리오의 일부" 라는 시멘틱 — 코드는 외부 호출과 같은 신뢰성 모델로 다루는 것이 합리적.
- 컴파일 실패는 pre-flight throw (사용자 코드를 단 한 번도 실행하지 못한 상태이므로 runtime 에러 포트 부적절).
