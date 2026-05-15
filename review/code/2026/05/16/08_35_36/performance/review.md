# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `$thread.text` 반복 접근에 대한 메모이제이션 경고 — 문서에 명시되어 있으나 런타임 보장 범위가 명확하지 않음
  - 위치: `frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx` 및 `variables-and-context.mdx` — `$thread.text` Callout 섹션
  - 상세: 문서는 `$thread.text`가 "첫 접근 시 메모이즈(memoized after the first access)"된다고 서술하고 있으나, 이는 단일 표현식 평가 컨텍스트 내의 메모이제이션인지, 노드 실행 수명 동안의 메모이제이션인지 범위가 문서에서 명시되지 않는다. 루프(`ForEach` / `Map`) 내부에서 `{{ $thread.text }}`를 반복 참조하면 — 메모이제이션이 표현식 단위로만 적용된다면 — 매 이터레이션마다 전체 thread 텍스트 렌더가 재실행될 수 있다. 실제 구현(`expression-resolver.service.ts` L100-145)을 참조하는 spec에 따르면 이 동작의 경계가 기술되어 있으나 사용자 문서는 그 범위를 충분히 구체화하지 않는다.
  - 제안: Callout 문구에 "same node evaluation scope" 또는 "same expression context" 같이 메모이제이션 경계를 명확히 기재. 예: "Memoized within a single node's evaluation — calling it in separate iterations of a ForEach loop will re-render each time."

- **[INFO]** `contextScope: thread` 의 무제한 토큰 성장에 대한 경고 수위가 약함
  - 위치: `frontend/src/content/docs/02-nodes/ai.en.mdx` 및 `ai.mdx` — `### Conversation Context` 섹션
  - 상세: 문서는 "`contextScope: thread` — token usage can grow quickly in long conversations"이라고 경고하지만 이것이 실제 LLM API 비용 폭증 및 context window 초과(일부 모델의 경우 에러)로 이어질 수 있음을 명시하지 않는다. 프로덕션 워크플로우에서 `contextScope: thread`를 무심코 선택한 사용자가 예상치 못한 API 비용 급증이나 입력 토큰 한도 초과 오류를 만날 수 있다.
  - 제안: 경고를 Callout으로 격상하거나, "Token usage grows linearly with thread length and may exceed the model's context window — prefer `lastN` for production workflows with many turns."처럼 구체적인 결과를 명시.

- **[INFO]** `contextScopeN` 기본값 20의 성능 의미가 문서에서 충분히 설명되지 않음
  - 위치: `frontend/src/content/docs/02-nodes/ai.en.mdx` 및 `ai.mdx` — `contextScopeN` 필드 행
  - 상세: 기본값 20 turns는 대화 내용에 따라 수천 토큰에 달할 수 있다. 문서는 기본값을 단순히 나열할 뿐 이것이 토큰 비용에 어떤 영향을 미치는지, 짧은 워크플로우에서는 실질적으로 `thread` 와 동일하게 동작할 수 있음을 알리지 않는다. 사용자가 기본값을 그대로 사용하면서 의도치 않게 큰 context를 LLM에 주입할 수 있다.
  - 제안: 필드 설명에 "(token cost scales with turn count)"처럼 비용 의존성을 간략히 언급.

- **[INFO]** `$thread.turns[0].data.email` 와 같은 인덱스 접근 패턴의 성능·안전성 주의가 없음
  - 위치: `frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx` 및 `variables-and-context.mdx` — Example "Pick a field from the first form turn"
  - 상세: `$thread.turns`가 readonly snapshot 배열임을 문서가 명시하고 있으나, 전체 turns 배열을 메모리에 유지한 채 인덱스로 직접 접근하는 패턴은 대규모 thread(수백 turn)에서 스냅샷 자체의 메모리 점유가 커질 수 있다. 이 패턴이 문서 예시로 노출되면서 사용자가 turns 전체를 순회하는 복잡한 표현식(예: filter/reduce on `$thread.turns`)을 작성하도록 유도할 수 있다. 표현식 엔진 안에서 해당 연산이 어떻게 평가되는지(eager vs lazy)에 대한 안내가 없다.
  - 제안: 예시 Callout 또는 Tips & notes에 "For large threads, prefer `$thread.length` checks over iterating all turns inside an expression"처럼 안내 추가.

## 요약

이번 변경은 전적으로 문서(MDX) 및 plan/review 마크다운 파일 수정이며, 실행 코드 경로(TypeScript, NestJS 로직 등)는 포함되지 않는다. 따라서 알고리즘 복잡도, N+1 쿼리, 메모리 누수, 블로킹 I/O, 데이터 구조 선택 등 전통적인 코드 성능 문제는 이번 diff 범위에서 발생하지 않는다. 성능 관점에서 주목할 부분은 새로 도입된 `$thread.text` 메모이제이션 경계의 모호함과, `contextScope: thread` 사용 시 토큰 비용 폭증 위험에 대한 문서의 경고 수위가 실제 위험 대비 약하다는 점이다. `contextScopeN` 기본값 20이 암묵적으로 대규모 context 주입으로 이어질 수 있다는 사용자 인지 부족도 잠재적 성능 비용 문제(LLM API 비용, context window 초과)를 야기할 수 있다. 이 모두는 런타임 코드가 아닌 문서 표현의 개선으로 해결 가능하며, 코드베이스 자체의 성능 위험은 없다.

## 위험도

LOW
