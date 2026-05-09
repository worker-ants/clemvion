### 발견사항

---

**[WARNING] `config.model` 등 config 필드의 값 의미(semantics) 변경**
- 위치: `ai-agent.handler.ts` `buildMultiTurnConfigEcho`, `information-extractor.handler.ts` `multiTurnConfigEcho`
- 상세: 이전에는 `config.model`이 엔진이 resolve한 실제 모델 ID(예: `"gpt-4o"`)를 반환했으나, 이제는 `rawConfig`가 존재할 경우 raw 템플릿(예: `"{{ vars.model }}"`)을 반환한다. `$node["AI_Agent"].config.model`을 참조해 실제 LLM 식별·표시·로깅 용도로 사용하는 다운스트림 노드는 resolve되지 않은 템플릿 문자열을 받게 된다. `systemPrompt`, `maxTurns` 등 다른 필드도 동일.
- 제안: `config` 에 `rawModel` / `resolvedModel` 두 필드를 병치하거나, 다운스트림 소비자가 템플릿 수신을 예상하고 있음을 spec에 명시적 마이그레이션 가이드로 추가할 것. 현재 spec(§7) 에 정책이 기재되어 있으나, 이 변경이 silent breaking change로 작용할 수 있다.

---

**[WARNING] `rendered` HTML과 `items`/`rows` 배열 사이의 내용 불일치**
- 위치: `carousel.handler.ts:168-182`, `table.handler.ts:136-157`
- 상세: `rendered`는 cap 적용 전 전체 배열(`items`/`dataRows`)로 생성되지만, `output.items`/`output.rows`는 1MB 초과 시 tail이 잘린다. 결과적으로 `rendered` HTML에는 N개 항목이 표시되나 `output.items`에는 M < N 개가 담겨, 동일 응답 안에서 두 필드가 서로 다른 데이터를 나타낸다. spec의 "rendered는 cap 대상이 아님" 설명이 이 불일치를 정당화하고 있으나, 소비자 입장에서 HTML 렌더링과 programmatic array가 동기화되지 않는 것은 계약 위반에 가깝다.
- 제안: truncation 발생 시 `rendered`도 잘린 배열로 재생성하거나, 최소한 spec에 "rendered가 items/rows보다 많은 항목을 포함할 수 있음"을 명시적 경고로 추가.

---

**[INFO] `totalRows`와 `rows.length`의 의미(semantics) 이중화**
- 위치: `table.handler.ts:136-157`
- 상세: 기존에는 `totalRows === rows.length` (pageSize 적용 후)였다. 이제 truncation 발생 시 `totalRows === rowsTotalCount === cappedRows.originalLength`이지만 `rows.length < totalRows`가 된다. `rows.length !== totalRows`라는 조건이 이전에는 "데이터가 있음(비어있지 않음)"을 암시했다면, 이제는 페이지네이션과 truncation 두 경우 모두를 포함한다. `rowsTotalCount`와 `totalRows`가 truncation 시 항상 동일한 값을 가져 필드가 중복된다.
- 제안: `totalRows`는 pageSize/sort 후 전체 행 수, `rowsTotalCount`는 cap 전 행 수로 구분이 명확한지 재검토. truncation이 없을 때는 `totalRows === rows.length`임이 보장되어야 한다면 spec에 명시.

---

**[INFO] `truncateArrayForOutput`의 non-array 입력 처리**
- 위치: `truncate-body.util.ts:107-109`
- 상세: 배열이 아닌 입력에 대해 `{ value: [], truncated: false, originalLength: 0 }`를 반환한다. `truncated: false`이지만 실제로는 입력 데이터가 `[]`로 교체되어 소비자 입장에서 데이터 손실이 감지되지 않는다. 테스트도 이 동작을 그대로 검증하고 있다.
- 제안: 의미상 `truncated: false`는 "size cap 미초과"를 뜻하므로 non-array 케이스는 별도의 `invalid: true` 플래그나 빈 배열 반환 이유를 구분해서 표면화하는 것이 계약상 더 명확하다. 단, 현재 호출 경로(Carousel/Table)에서는 입력이 이미 array임이 보장되므로 실질적 위험은 낮다.

---

### 요약

이번 변경의 핵심은 두 가지다: (1) AI Agent / Information Extractor multi-turn 출력의 `config` 필드를 raw 템플릿 값으로 echo하는 것, (2) Carousel/Table의 `items`/`rows`에 1MB cap을 적용하는 것. 두 변경 모두 기존 클라이언트에 대해 additive하게 설계되었고 대부분의 경우 backward-compatible하다. 그러나 `config.model`이 resolved 값에서 raw 템플릿으로 바뀌는 것은 silent semantic breaking change로, `$node["X"].config.model`을 실제 LLM 식별에 사용하는 다운스트림 노드에 영향을 줄 수 있다. 또한 `rendered` HTML과 `items`/`rows` 배열이 1MB 초과 시 서로 다른 데이터를 나타내는 내부 불일치가 존재한다. 전반적으로 테스트 커버리지는 충실하며 spec 갱신도 잘 이루어졌다.

### 위험도
**LOW**