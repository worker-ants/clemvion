### 발견사항

---

**[WARNING] `buildMultiTurnConfigEcho` 의 `conditions` vs `knowledgeBases` 가드 불일치**
- 위치: `ai-agent.handler.ts` — `buildMultiTurnConfigEcho` 메서드
- 상세: `knowledgeBases` 는 `!== undefined` 체크만 하지만, `conditions` 는 `Array.isArray` + `.length > 0` 을 추가로 검사한다. `knowledgeBases` 가 빈 배열(`[]`)이면 echo 되고, `conditions` 가 빈 배열이면 echo 되지 않는다. 정책이 같다면 동일한 guard 를 써야 하고, 다르다면 주석으로 이유가 명시되어야 한다.
- 제안: 두 필드 모두 동일한 guard 패턴(`!== undefined && Array.isArray && length > 0`) 을 적용하거나, 의도적으로 다른 정책이라면 인라인 주석으로 명시

---

**[WARNING] Table 의 `rowsTotalCount` 가 `totalRows` 와 중복**
- 위치: `table.handler.ts` — payload 조립부, `table.handler.spec.ts` truncation 테스트
- 상세: Table 의 `output.totalRows` 는 항상 cap 이전 데이터셋 크기를 보여준다. 따라서 truncation 발생 시 `rowsTotalCount === totalRows` 가 항상 성립하여 `rowsTotalCount` 가 중복 필드가 된다. Carousel 은 `itemsTotalCount` 없이는 원래 크기를 알 방법이 없으므로 필드가 필수지만, Table 은 그렇지 않다. 소비자 입장에서 "어느 필드를 써야 하는가?" 혼란이 생긴다.
- 제안: Table spec 과 핸들러에 `rowsTotalCount === totalRows` 임을 명시하거나, 두 핸들러의 truncation 플래그 API 를 통일 (예: Carousel 도 `itemsTotalCount` 를 `totalItems` 로 항상 노출)

---

**[WARNING] Presentation 전용 유틸리티가 `integration/_base/` 에 위치**
- 위치: `backend/src/nodes/integration/_base/truncate-body.util.ts`
- 상세: `PRESENTATION_MAX_BYTES` 와 `truncateArrayForOutput` 는 Presentation 노드 전용이지만 Integration 경로 아래에 있다. `carousel.handler.ts` 와 `table.handler.ts` 가 `../../integration/_base/` 를 import 한다 — 계층적으로 역방향 의존성이다. 새 기여자가 Presentation 트런케이션 로직을 찾으려면 Integration 폴더를 열어야 한다.
- 제안: `nodes/_shared/truncate.util.ts` 또는 `nodes/presentation/_base/truncate.util.ts` 로 이동하거나, 기존 `integration/_base/` 파일을 `nodes/_base/` 로 격상

---

**[WARNING] `rendered` HTML 은 전체 items 로 생성되지만 `output.items` 는 cap 적용**
- 위치: `carousel.handler.ts` — `execute` 메서드
- 상세: `renderHtml(items, layout)` 은 cap 이전 전체 `items` 배열로 HTML 을 생성한다. 그러나 `payload.items` 에는 `cappedItems.value` (일부) 가 들어간다. 소비자가 `output.items.length` 로 슬라이드 수를 추론하면 `output.rendered` 와 불일치한다. spec 은 이 동작을 허용하지만, 핸들러 코드에 설명 주석이 없어 유지보수 시 버그로 오인할 수 있다.
- 제안: `renderHtml` 호출부 근처에 "`rendered` 는 cap 이전 전체 items 로 생성됨 — spec §4 참조" 한 줄 주석 추가

---

**[INFO] `rawConfig` 의 `Record<string, unknown>` 타입이 전역 캐스팅 부채를 만든다**
- 위치: `ai-agent.handler.ts` `buildMultiTurnConfigEcho`, `information-extractor.handler.ts` `buildMultiTurnFinalOutput`
- 상세: `(raw.mode as string | undefined)`, `(raw.conditions as unknown[])`, `(raw.outputSchema as OutputField[] | undefined)` 등의 unsafe cast 가 메서드 전반에 반복된다. `Record<string, unknown>` 을 통해 전달되는 rawConfig 의 형태가 사실상 두 핸들러 모두에서 동일한 필드 집합을 가진다.
- 제안: `RawAgentConfig` / `RawExtractorConfig` 등의 인터페이스를 정의하고 `rawConfig` 타입을 좁히면, 캐스팅이 사라지고 리네임/필드 추가 시 타입 에러로 조기 탐지 가능

---

**[INFO] `defined()` vs 조건부 할당 패턴 불일치**
- 위치: `information-extractor.handler.ts` `buildMultiTurnFinalOutput` vs `ai-agent.handler.ts` `buildMultiTurnConfigEcho`
- 상세: Information Extractor 는 `defined({ ... })` 헬퍼로 undefined 필드를 제거하지만, AI Agent 는 `if (raw.X !== undefined) echo.X = raw.X` 패턴을 사용한다. 동일한 목적을 두 가지 스타일로 구현하여 코드베이스 내 일관성이 낮아진다.
- 제안: 어느 한 쪽으로 통일 — `defined()` 헬퍼가 의도를 더 명시적으로 드러내므로 `buildMultiTurnConfigEcho` 도 같은 헬퍼 사용 고려

---

**[INFO] `truncateArrayForOutput` 의 binary search 에서 O(n) 슬라이스 반복**
- 위치: `truncate-body.util.ts` — `truncateArrayForOutput`
- 상세: 루프마다 `arr.slice(0, mid)` 를 생성하고 `JSON.stringify` 를 호출한다. 배열 크기가 크면 O(n log n) 직렬화가 발생한다. 현재 사용처(Presentation 노드 실행 경로)에서 배열이 매우 크거나 요소당 직렬화 비용이 큰 경우 눈에 띌 수 있다.
- 제안: 현재 용도(1MB 임계값, 일반 워크플로 배열)에서는 허용 범위이지만, 함수 docstring 에 성능 특성을 한 줄 명시하면 향후 오남용 예방

---

### 요약

전체적으로 코드 품질은 양호하다. `buildMultiTurnConfigEcho` 의 helper 추출, `truncateArrayForOutput` 의 binary-search 구현, 테스트 커버리지 모두 의도가 명확하고 기존 패턴을 일관되게 따른다. 가장 주의할 지점은 두 가지다: (1) `conditions` 와 `knowledgeBases` 의 가드 불일치는 조용한 동작 차이를 만들어 미래 버그의 씨앗이 되며, (2) Presentation 전용 유틸리티가 `integration/_base/` 에 위치하는 것은 계층 구조상 역방향 의존성으로, 코드베이스가 성장할수록 탐색 비용을 높인다. Table 의 `rowsTotalCount`/`totalRows` 중복과 `rendered`/`items` 불일치는 소비자 혼란을 막기 위해 문서(주석 또는 spec)로 명시적으로 다루면 충분하다.

### 위험도

**LOW**