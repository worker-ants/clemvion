# 신규 식별자 충돌 Check 결과

검토 모드: --impl-done (scope=spec/, diff-base=origin/main)

---

## 발견사항

### 1. [WARNING] `$item.index` 와 `$itemIndex` 의 의미 혼동 위험

- **target 신규 식별자**: `$itemIsFirst`, `$itemIsLast` (ForEach top-level 표현식 변수, `spec/4-nodes/1-logic/9-foreach.md` §3 / `spec/5-system/5-expression-language.md`)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md:308` — `$item.index = 1` (Loop > ForEach 중첩 예시 다이어그램에서 `$item` 이 Split 출력 객체 `{ index, value }` 인 경우의 프로퍼티 접근)
  - `spec/4-nodes/1-logic/6-split.md:133` — `$item.index` 로 순번 참조 (Split → ForEach 패턴)
- **상세**: 신규 `$itemIsFirst` / `$itemIsLast` 는 별도 top-level 변수이고 `$item.index` 는 `$item` 객체의 속성 접근이라 기술적으로 충돌하지 않는다. 그러나 `execution-engine.md §3.4.2` 다이어그램이 `$item.index = 1` 을 보여주고 같은 표(`spec/5-system/4-execution-engine.md:544`)에 `$item`, `$itemIndex`, `$itemIsFirst`, `$itemIsLast` 가 함께 나열되면서 독자가 `$item.index` 를 `$itemIndex` 와 혼동하거나 `$itemIsFirst`/`$itemIsLast` 를 `$item.isFirst`/`$item.isLast` 로 오해할 수 있다.
- **제안**: `execution-engine.md §3.4.2` 다이어그램의 `$item.index = 1` 에 한 줄 주석 (`-- $item is a Split output object { index, value }`) 을 추가하거나, ForEach top-level 변수 테이블(`§6.1` 또는 해당 표)에 "`$item.index` 는 `$item` 객체의 속성 — `$itemIndex`(ForEach 인덱스 top-level 변수)와 무관"임을 한 줄 노트로 명시한다.

---

### 2. [INFO] `retryDelay` vs `retryInterval` 병용 (기존 불일치, 신규 악화 없음)

- **target 신규 식별자**: `config.errorHandling.retryConfig.retryInterval` (Retry 설정 패널 및 엔진 계약, `spec/3-workflow-editor/1-node-common.md:169`)
- **기존 사용처**: `spec/5-system/4-execution-engine.md:579` — Integration 재시도 파라미터를 `(maxRetries, retryDelay)` 로 표기
- **상세**: `retryInterval`(노드 공통 errorHandling 스키마)과 `retryDelay`(execution-engine §9 Integration 재시도 테이블)는 다른 도메인(노드 에러 핸들링 vs Integration 레이어 자체 재시도)이라 직접 충돌은 아니다. 본 diff 가 `retryInterval` 을 새로 도입한 것이 아니라 기존 `3-error-handling.md:239` 에 이미 정의돼 있었다. 다만 두 이름이 같은 "재시도 간격" 개념에 대해 다른 키를 쓰는 기존 불일치가 있음을 확인한다.
- **제안**: 향후 `execution-engine.md §9` 표의 `retryDelay` 를 `retryInterval` 로 통일하거나, 각각이 다른 레이어임을 inline 주석으로 구분한다. 본 diff 범위의 변경은 없으므로 현재 차단 사유 없음.

---

### 3. [INFO] `config.errorPolicy`(컨테이너 전용) vs `config.errorHandling.policy`(일반 노드) 구분 명시 추가

- **target 신규 식별자**: `config.errorHandling = { policy, retryConfig, defaultOutput }` nested 객체 계약 명시 (`spec/3-workflow-editor/1-node-common.md:169`)
- **기존 사용처**: `spec/4-nodes/1-logic/0-common.md:91` — `config.errorPolicy` (컨테이너 노드용 `stop`/`skip`/`continue`), `spec/4-nodes/1-logic/10-parallel.md:28` — `config.errorPolicy` (Parallel 전용)
- **상세**: target diff 가 이미 `spec/4-nodes/1-logic/0-common.md:95` 에 `config.errorPolicy` vs `config.errorHandling.policy` 구분 설명을 추가했다. 두 키가 의도적으로 공존하며 같은 노드에서 동시 사용하지 않는다는 규약이 명시되었으므로 충돌 없음. 단, Parallel 노드가 `errorHandling.policy` 가 명시되지 않은 경우 fallback 매핑(`skip_node`/`use_default_output`/`route_to_error_port` → `continue`)을 사용한다는 사실이 컨테이너 노드와 일반 노드 간 의미가 다름을 독자가 파악해야 한다는 점은 INFO 수준 인지 권장.
- **제안**: 현 수준으로 문서화가 충분하며 추가 조치 불필요.

---

## 요약

이번 diff 가 도입한 신규 식별자(`$itemIsFirst`, `$itemIsLast`, `config.errorHandling` nested 계약, summaryTemplate 업데이트, `EXCLUDE_BASENAMES` basename 매칭, spec status `implemented` 격상)는 기존 식별자와 기술적 충돌이 없다. 유일한 주의점은 `spec/5-system/4-execution-engine.md §3.4.2` 다이어그램의 `$item.index` 표기가 새로 추가된 `$itemIndex`/`$itemIsFirst`/`$itemIsLast` top-level 변수와 같은 표에 인접해 독자의 혼동을 유발할 수 있는 잠재적 WARNING 이다. 이는 기존 텍스트와 신규 식별자의 병용에서 비롯된 문서 명확성 문제이며 실제 식별자 재정의·덮어쓰기는 아니다.

## 위험도

LOW

STATUS: SUCCESS
