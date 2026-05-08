# Spec: Map

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [ForEach 노드](./9-foreach.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

배열의 각 항목에 대해 body 서브그래프를 실행하고, 각 반복의 `emit` 포트 출력을 모아 새 배열을 생성하는 **컨테이너 노드**. ForEach와 동일한 실행 모델을 사용하지만 시맨틱이 "결과 수집(transform)"으로 특화되어 있다. 컨테이너 패턴은 [공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach) 참조.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| inputField | Expression | 변환 대상 배열 필드 경로 (예: `$input.items`) |
| errorPolicy | Enum | `stop` / `skip` / `continue` (기본 `stop`). [공통 §4](./0-common.md#4-에러-정책-errorpolicy) |

## 2. 포트
- 입력: `in` (외부 데이터 진입), `emit` (body 서브그래프에서 수집 지점)
- 출력: `body` (각 항목을 body 내부 첫 노드로 전달), `done` (전체 변환 완료 후 수집된 배열)

## 3. 실행 로직
1. `inputField`로 배열 추출. **dot-path 문자열**(`"items"`)이면 `$input`에 적용, **inline 표현식**(`{{ $var.a }}`)이면 resolver가 치환한 값을 직접 사용. 배열이 아니면 빈 배열로 처리.
2. 각 항목에 대해:
   - `$item`/`$itemIndex`를 바인딩하고 body 서브그래프의 첫 노드로 항목을 전달.
   - body 노드를 토폴로지 순서로 실행.
   - `emit` 포트에 연결된 body 노드의 출력을 해당 iter 결과로 수집.
3. 모든 iter 완료 시 **`{ mapped: [...], count: N }`** 를 `done` 포트로 전달 ([공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92)).
4. `errorPolicy`에 따라 iter 에러 처리: `stop`은 즉시 실패, `skip`/`continue`는 에러 항목에 `{_skipped, error}`를 넣고 진행.

## 4. 출력 구조

```json
{
  "config": { "inputField": "$input.items", "errorPolicy": "stop" },
  "output": { "mapped": [ /* 변환된 항목 */ ], "count": 3 }
}
```

다운스트림은 `$node["Map"].output.mapped[i]` 로 접근한다.

## 5. 제약

[공통 §3 컨테이너 노드 패턴](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach) 참조.

## 6. ForEach와의 차이
ForEach는 "각 항목에 대해 side effect 중심의 body 실행", Map은 "각 항목을 새로운 값으로 변환하여 배열을 생성"에 의미적으로 특화. 엔진 내부에서 동일한 executor(`ForEachExecutor`)를 공유하지만 UX·시맨틱상 두 노드를 구분한다.
