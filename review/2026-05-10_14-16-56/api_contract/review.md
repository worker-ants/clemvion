### 발견사항

- **[INFO]** `output._llmCalls` 제거 → `meta.llmCalls` 이전: 잠재적 breaking change
  - 위치: `text-classifier.handler.ts` diff, catch 블록
  - 상세: 에러 경로에서 기존 `output._llmCalls` 필드가 삭제되고 `meta.llmCalls`로 이전되었다. `_` 접두어가 붙어 있어 내부용임을 암시하지만, 다운스트림 워크플로우 expression에서 `$node["X"].output._llmCalls`를 참조한 경우 silent break가 발생한다.
  - 제안: spec에서도 `output._llmCalls`는 공식 계약이 아니었으므로 위험도는 낮다. 단, 릴리즈 노트에 "에러 케이스의 `output._llmCalls` 제거 — `meta.llmCalls` 사용"을 명기하는 것이 안전하다.

- **[INFO]** 에러 경로 `meta` shape가 성공/fallback 경로와 불일치: `meta.{inputTokens, outputTokens, totalTokens, thinkingTokens}` 누락
  - 위치: `text-classifier.handler.ts:144–162` (새 에러 리턴)
  - 상세: 성공/fallback 경로의 `meta`는 `{ model, inputTokens, outputTokens, totalTokens, thinkingTokens?, llmCalls }` 구조를 반환한다. 에러 경로는 `{ durationMs, model, llmCalls }`만 반환해 토큰 카운트 필드가 없다. 에러 시 LLM 응답이 없어 토큰 정보를 알 수 없는 것은 맞지만, `$node[X].meta.inputTokens`를 읽는 expression이 `undefined`를 반환하게 된다.
  - 제안: `inputTokens: 0, outputTokens: 0, totalTokens: 0`을 에러 `meta`에 포함하거나, spec §5.3 필드 표에 "에러 경로에서는 토큰 필드 미포함"을 명시해 소비 측의 optional 처리 요건을 문서화한다.

- **[INFO]** `meta.durationMs` 출처 표기: spec §5.1 표에는 `engine inject`, §5.3 표에는 `handler return`
  - 위치: `spec/4-nodes/3-ai/2-text-classifier.md`, §5.1 vs §5.3 필드 표
  - 상세: 성공 경로의 `meta.durationMs`는 "engine inject"로 표기되어 있고, 에러 경로는 "handler return"이다. 실제 핸들러 코드에서 에러 경로는 `Date.now() - callStartedAt`을 직접 계산해 반환한다. 성공 경로에서는 엔진이 주입하는지 핸들러가 반환하는지 코드상 확인이 필요하다.
  - 제안: 성공 경로에서도 핸들러가 `durationMs`를 직접 반환한다면 spec 출처 표기를 `handler return`으로 통일한다.

---

### 요약

이번 변경은 REST HTTP 엔드포인트가 아닌 워크플로우 노드 내부 출력 계약(node handler output contract)에 대한 수정이다. 핵심 변경은 에러 경로에서 `meta: {}`(빈 객체)를 `meta: { durationMs, model, llmCalls }`로 채워 CONVENTIONS Principle 2를 이행한 것이며, 이는 additive하고 spec 정합을 높이는 방향이다. `output._llmCalls` 제거가 유일한 잠재적 breaking change이지만, `_` 접두어와 spec 미정의 필드라는 점에서 공식 계약 위반이 아니다. 스펙과 테스트 모두 새 형식을 명확히 기술하고 있어 계약 명확성은 오히려 향상되었다.

### 위험도

LOW