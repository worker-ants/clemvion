# Spec: ForEach

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Map 노드](./7-map.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

배열의 각 항목에 대해 body 서브그래프를 순차 실행하고, 각 반복의 `emit` 포트 출력을 수집해 배열로 내보내는 **컨테이너 노드**. 컨테이너 패턴은 [공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach) 참조.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| arrayField | Expression | 대상 배열 필드 경로 |
| errorPolicy | Enum | 에러 정책: `stop` / `skip` / `continue` (기본 `stop`). [공통 §4](./0-common.md#4-에러-정책-errorpolicy) |

## 2. 포트
- 입력: `in` (외부 데이터 진입), `emit` (body 서브그래프에서 수집 지점)
- 출력: `body` (각 항목 처리 본문 진입), `done` (전체 완료 후 수집된 배열)

## 3. 실행 컨텍스트 변수
- `$item`: 현재 배열 항목
- `$itemIndex`: 현재 인덱스
- `$item.isFirst`, `$item.isLast`: 첫/마지막 항목 여부 (itemContext 기반)

## 4. 실행 로직
1. `arrayField`로 배열 추출. **dot-path 문자열**(`"items"`)이면 `$input`에 적용, **inline 표현식**(`{{ $var.a }}`)이면 resolver가 치환한 값을 직접 사용. 배열이 아니면 빈 배열로 처리.
2. 각 항목에 대해:
   - `$item` / `$itemIndex`를 바인딩하고 body 서브그래프를 토폴로지 순서로 실행.
   - `emit` 포트에 연결된 body 노드의 출력을 해당 iter 결과로 수집.
3. `errorPolicy`에 따른 에러 처리 (원본 배열과 **동일 인덱스** 유지):
   - `skip`: 스킵된 인덱스에 `{ _skipped: true, error: { code, message } }` 삽입.
   - `continue`: 에러 발생 항목도 결과에 포함 (에러 정보는 NodeExecution에 기록).
   - `stop`: 즉시 실행 실패.
4. 전체 완료 후 **`{ items: [...], count: N }`** 를 `done` 포트로 전달 ([공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92)).

## 5. 출력 구조

```json
{
  "config": { "arrayField": "$input.rows", "errorPolicy": "stop" },
  "output": {
    "items": [ /* 각 항목의 emit 출력 (skip/continue 정책 시 에러 항목 포함) */ ],
    "count": 5
  }
}
```

다운스트림은 `$node["ForEach"].output.items[i]` 로 접근한다. `Map` 노드는 동일 패턴이지만 `{ mapped, count }` 로 내보낸다.

## 6. 제약 / 컨테이너 렌더링

[공통 §3 컨테이너 노드 패턴](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach) 참조. 실행 시각화는 헤더에 현재 항목 인덱스를 표시한다 (예: "Item 2/5").

> **결과 배열 인덱스 유지 및 중첩 컨테이너 스코프**: [실행 엔진 §3.2](../../5-system/4-execution-engine.md#32-foreach-실행) 및 [§3.4](../../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프) 참조.
