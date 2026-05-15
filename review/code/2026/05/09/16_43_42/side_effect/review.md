### 발견사항

---

**[WARNING] `rendered` HTML이 1MB cap을 우회 — payload 총량이 cap을 초과할 수 있음**
- 위치: `carousel.handler.ts` L168–188, `table.handler.ts` L136–158
- 상세: `rendered` HTML은 `truncateArrayForOutput` 적용 전 full `items` / `dataRows`에서 생성된다. `cappedItems.value`는 1MB 이하로 제한되지만, `rendered`는 전체 행의 HTML을 담고 있어 total payload가 cap을 훨씬 초과할 수 있다. 예: 6개 × 200KB 항목이면 `items`는 ~0.9MB로 잘리지만 `rendered` HTML은 ~1.2MB 이상이 그대로 `NodeExecution.outputData` JSONB에 적재된다. 스펙 주석 "items/rows가 잘리면 자동으로 함께 작아진다"는 현재 구현과 다르다 — rendered는 자동으로 작아지지 않는다.
- 제안: `rendered`를 capped items/rows 기준으로 재생성하거나(`this.renderHtml(cappedItems.value, layout)`), 적어도 `rendered` 크기도 별도로 점검해 DB row 크기 상한을 보장할 것.

---

**[WARNING] `truncateArrayForOutput`의 O(N log N) JSON 직렬화 — 메모리 압박**
- 위치: `truncate-body.util.ts` L116–155
- 상세: `measure(arr.slice(0, mid))`는 매 이진탐색 반복마다 `arr.slice()`로 새 배열을 생성한 뒤 `JSON.stringify()`를 호출한다. 10,000개 항목 × 1KB 원소 기준 약 14회 반복, 회당 최대 5,000개 직렬화. 메모리 할당과 GC 압력이 한 번의 노드 실행에 집중된다. cap이 거의 트리거되지 않는 정상 경로에서는 무해하지만, runaway 데이터(cap 트리거 시나리오)에서 정확히 가장 느린 경로를 밟는다.
- 제안: 이진탐색 대신 prefix-sum 방식(각 element를 개별 직렬화해 누적, 첫 번째 초과 인덱스 선형 탐색)으로 전체 슬라이스 재할당을 제거하거나, slicing 없이 byte estimate를 근사할 수 있다.

---

**[WARNING] `information-extractor` — `rawConfig`가 DB에 누적 저장됨**
- 위치: `information-extractor.handler.ts` L288–306
- 상세: `rawConfig`가 `stateBase`에 포함되어 multi-turn 재개(resume) 시마다 DB에서 읽고 쓴다. rawConfig가 크면(중첩 outputSchema, 긴 instructions 등) multi-turn 세션 동안 매 tick마다 state row 크기가 동일하게 증가한다. 기존 세션(rawConfig 없이 persist된)에 대한 하위 호환은 `?? {}` fallback으로 올바르게 처리됨.
- 제안: 현재 처리는 기능상 올바름. 다만 매우 큰 config를 가진 세션에서 state row 크기를 모니터링할 것.

---

**[INFO] `context.rawConfig ?? config` fallback — 첫 턴 evaluated 값 사용 위험**
- 위치: `information-extractor.handler.ts` L288
- 상세: `context.rawConfig`가 엔진에서 주입되지 않는 경우(레거시 경로 또는 엔진 누락 시), `config`(engine-evaluated 값)가 `rawConfig`로 저장되어 raw echo 보장이 깨진다. 엔진이 항상 `context.rawConfig`를 주입한다는 전제에 의존한다.
- 제안: 엔진 측에서 `context.rawConfig` 주입 누락이 가능한 경로가 있는지 확인. 가능하다면 경고 로그 추가.

---

**[INFO] `buildMultiTurnFinalOutput` / `buildConditionOutput` 시그니처 변경 — 하위 호환 확인 필요**
- 위치: `ai-agent.handler.ts` L1285, L1341
- 상세: 양쪽 모두 선택적 파라미터(`rawConfig?`)가 끝에 추가되어 기존 호출자는 영향 없음. diff에서 확인되는 호출자 4곳은 모두 업데이트됨. 단, handler를 직접 단위 테스트하거나 extend하는 외부 코드가 있다면 시그니처 갱신 확인 필요.
- 제안: 현재는 문제 없음.

---

**[INFO] `output.items` / `output.rows`와 `output.rendered` 간 의미 불일치 노출**
- 위치: `carousel.handler.ts`, `table.handler.ts`
- 상세: truncation 발생 시 `output.items` (capped)와 `output.rendered` (full)는 서로 다른 항목 수를 나타낸다. `itemsTruncated` 플래그를 확인하지 않는 다운스트림 소비자는 데이터 손실을 인지하지 못할 수 있다. 스펙이 이를 명시하고 있으나 소비자 구현 단에서 방어 처리가 필요하다.
- 제안: 스펙 레벨에서 이미 처리됨. 프론트엔드 Run Results Drawer가 `itemsTruncated`를 표시하도록 처리 필요 여부 확인.

---

### 요약

변경 전반에 걸쳐 의도치 않은 전역 상태 변경, 환경 변수 접근, 외부 네트워크 호출 등의 부작용은 없다. 가장 주목할 리스크는 두 가지다: (1) Carousel/Table의 `rendered` HTML이 1MB cap 외부에서 생성되어 DB payload 상한 보장이 깨질 수 있으며 — 스펙 주석의 "자동으로 작아진다"는 가정이 현재 구현에서 성립하지 않는다. (2) `truncateArrayForOutput`의 이진탐색이 cap 트리거 시나리오(정확히 문제가 되는 상황)에서 가장 많은 메모리와 CPU를 소비하는 구조이다. rawConfig plumbing 부분(AI Agent/InformationExtractor)은 하위 호환 처리가 올바르며 기능적 부작용은 없다.

### 위험도

**MEDIUM** — `rendered` HTML의 cap 우회가 DB JSONB 크기 상한을 위반할 수 있는 실질적 경로가 존재함.