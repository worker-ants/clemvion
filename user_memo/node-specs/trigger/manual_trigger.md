# Manual Trigger (`manual_trigger`)

> 워크플로우의 시작점. 사용자가 정의한 파라미터를 받아 그대로 후속 노드에 전달합니다.

- **카테고리**: `trigger`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `parameters` | `TriggerParameterDefinition[]` | no | `[]` | 트리거가 받을 파라미터 정의 목록. 각 항목: `{ name, type, required?, defaultValue?, description? }` | no |

`TriggerParameterDefinition` 항목 필드:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `name` | string | 파라미터 키 |
| `type` | `'string' \| 'number' \| 'boolean' \| 'object' \| 'array'` | 값 타입 |
| `required` | boolean | 필수 여부 (누락 시 trigger adapter가 400 반환) |
| `defaultValue` | unknown | 미전달 시 채워질 기본값 |
| `description` | string | 설명 (UI 힌트) |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | (없음) | — | 트리거 노드이므로 입력 포트 없음 |
| Output | `out` | Output | 다음 노드로 파라미터 전달 |

## Input (이전 노드로부터 받는 값)

트리거 어댑터(webhook / schedule / 수동 실행)가 만든 입력 객체. 형태:

```json
{
  "parameters": { "userId": "u_123", "verbose": true },
  "...": "추가 메타데이터 (어댑터에 따라)"
}
```

핸들러는 `input.parameters`를 떼어 `output.parameters`로 노출하고, 나머지 키는 `output`에 평탄하게 합칩니다. **파라미터 검증 및 `defaultValue` 채움은 트리거 어댑터에서 사전 처리**되어 들어옵니다.

## Output

### Case 1: 정상 실행

```json
{
  "config": {
    "parameters": [
      { "name": "userId", "type": "string", "required": true },
      { "name": "verbose", "type": "boolean", "defaultValue": false }
    ]
  },
  "output": {
    "parameters": { "userId": "u_123", "verbose": true }
  }
}
```

| 필드 | 설명 |
| --- | --- |
| `config.parameters` | 정의된 파라미터 스펙 목록 (값이 아니라 정의) |
| `output.parameters` | 실제 전달된 파라미터 값 객체 |
| `output.<나머지 키>` | input에서 `parameters` 외의 키가 있다면 같은 위치에 그대로 노출 (어댑터별 메타데이터 등) |

`meta` / `port` / `status` 는 사용하지 않습니다. 항상 기본 포트 `out`으로 라우팅됩니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Manual Trigger`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Manual Trigger"].output.parameters.userId }}` | `"u_123"` | 특정 파라미터 값 |
| `{{ $node["Manual Trigger"].output.parameters }}` | `{ userId: "u_123", verbose: true }` | 파라미터 객체 전체 |
| `{{ $node["Manual Trigger"].config.parameters }}` | `[{ name: "userId", ... }]` | 파라미터 정의 목록 |

또한 트리거 직후의 노드는 다음 단축 표현도 사용할 수 있습니다.

| 표현식 | 설명 |
| --- | --- |
| `{{ $input.parameters.userId }}` | 현재 노드 input(즉 트리거 output)의 파라미터 |
| `{{ $params.userId }}` | `$input.parameters`의 단축 |

## 주의사항

- 파라미터 검증 실패는 핸들러 실행 전에 어댑터에서 거르므로, 핸들러 자체는 파라미터 누락 에러를 발생시키지 않습니다.
- `output`에 `parameters` 외의 키가 보일 경우 트리거 어댑터(webhook 본문 등)에서 추가한 메타데이터입니다. 어댑터별로 다르므로 사용 시 실제 입력을 한 번 확인하세요.
- 같은 이름의 라벨이 워크플로우에 여러 개 있으면 두 번째부터 `Manual Trigger#2` 형식으로 자동 disambiguation 됩니다.
