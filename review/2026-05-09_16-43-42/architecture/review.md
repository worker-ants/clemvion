## 발견사항

### [CRITICAL] rendered HTML 과 items/rows 배열 간 의미 불일치
- **위치**: `carousel.handler.ts:168` / `table.handler.ts:136`
- **상세**: `rendered` HTML 은 캡 적용 전 전체 `items`/`dataRows` 로 생성되지만, `output.items`/`output.rows` 는 캡 적용 후 잘린 배열을 담는다. 동일한 `output` 객체 안에서 두 필드가 다른 데이터셋을 표현한다. 다운스트림이 `output.items[i]` 를 인덱스로 렌더링된 슬라이드와 1:1 매핑한다고 가정하면 인덱스 5 의 아이템이 `rendered` 에는 존재하지만 `items` 에는 없는 상황이 발생한다.
- **제안**: 둘 중 하나의 일관성을 선택해야 한다. (a) `rendered` 도 `cappedItems.value` 로 재생성해 두 필드를 동기화하거나, (b) 스펙에 명시적으로 "rendered 는 전체를 표현하는 독립 뷰이며 items 와 인덱스 대응을 보장하지 않는다"는 계약을 추가하고, 프론트엔드가 `rendered` 대신 `items` 를 iterate 하도록 강제한다.

---

### [WARNING] 도메인 경계 위반: Presentation 핸들러가 `integration/_base/` 유틸을 직접 import
- **위치**: `carousel.handler.ts:7`, `table.handler.ts:12`
- **상세**: `PRESENTATION_MAX_BYTES` 와 `truncateArrayForOutput` 가 `nodes/integration/_base/truncate-body.util.ts` 에 정의되어 있다. `presentation/` 노드가 `integration/` 내부 유틸을 import 하면 도메인 간 결합이 생긴다. 이름도 오해를 부른다 — `truncate-body.util.ts` 는 원래 HTTP body / email body 를 위한 파일이다.
- **제안**: `nodes/core/` 또는 `nodes/shared/truncate-output.util.ts` 와 같은 중립적 위치로 이동하거나, `integration/_base/` 내에 `truncate-body.util.ts` 와 별도로 `truncate-array.util.ts` 를 분리하고 presentation 전용 상수와 함수를 그곳에 둔다.

---

### [WARNING] `rawConfig` 전파 경로가 `Record<string, unknown>` 로 타입 안전성 소실
- **위치**: `ai-agent.handler.ts:1285`, `information-extractor.handler.ts:84`
- **상세**: `rawConfig?: Record<string, unknown>` 로 인터페이스 전역에서 사용되고, `buildMultiTurnConfigEcho` 내부에서 `raw.systemPrompt as string | undefined` 형태의 수동 캐스팅이 8회 반복된다. `rawConfig` 의 형태가 런타임에서만 검증되므로 필드 명 오타나 타입 변경이 컴파일 타임에 잡히지 않는다.
- **제안**: 핸들러별 `RawAiAgentConfig`, `RawInformationExtractorConfig` 인터페이스를 정의하고, `rawConfig` 파라미터 타입을 구체화한다. `buildMultiTurnConfigEcho` 의 캐스팅 코드를 제거할 수 있다.

---

### [WARNING] `totalRows` 와 `itemsTotalCount`/`rowsTotalCount` 의 의미 중복·비대칭
- **위치**: `table.handler.ts:142`, `carousel.handler.ts:178`
- **상세**: Table 은 원본 행 수를 `output.totalRows` (기존 필드, cap 이전) 와 `output.rowsTotalCount` (신규 필드, cap 이전 동일 의미) 두 곳에 노출한다. 두 필드가 cap 발생 여부와 무관하게 항상 같은 값을 가리키므로 중복이다. 또한 Carousel 의 `itemsTotalCount` 는 truncation 발생 시만 포함되는 반면 Table 의 `totalRows` 는 항상 포함되어 소비자가 일관된 방식으로 처리하기 어렵다.
- **제안**: `totalRows` 를 제거하거나 cap 이전 계수 전용으로 의미를 통일하고, Carousel/Table 모두 동일한 `*TotalCount` 패턴을 적용한다. 또는 `totalRows` 를 cap 이후 `rows.length` 와 동기화하고 cap 이전 값은 `rowsTotalCount` 만 사용한다.

---

### [INFO] Binary search truncation 의 최악 경우 비용
- **위치**: `truncate-body.util.ts:119`
- **상세**: `measure(arr.slice(0, mid))` 는 매 iteration 마다 `JSON.stringify` 를 실행한다. 원소 수 N 의 배열에 대해 O(log N) 번 `JSON.stringify` 를 호출하며, 각 호출은 O(k) (k = 직렬화 바이트). 현재 1MB 기준이라 실제로 truncation 이 발생하는 케이스는 드물고 성능 상 허용 범위 내이지만, `measure` 에서 캐싱 없이 매번 `arr.slice` 를 생성하는 점은 불필요한 GC 압력을 만든다.
- **제안**: 즉각 수정 불필요. 향후 성능 이슈 발생 시 `lo` 부터 `hi` 까지의 incremental 직렬화로 교체 고려.

---

### [INFO] `rawConfig ?? config` 폴백 패턴의 분산
- **위치**: `ai-agent.handler.ts:622`, `information-extractor.handler.ts:288`, `carousel.handler.ts:168`, `table.handler.ts:132`
- **상세**: `context.rawConfig ?? config` 또는 `state.rawConfig ?? {}` 폴백이 핸들러 전역에 분산되어 있다. 이 폴백의 의미(엔진이 첫 waiting tick 전까지 rawConfig 를 주입하지 않을 수 있다)가 각 핸들러에 복제된다.
- **제안**: `ExecutionContext` 에 `rawConfig` 접근 헬퍼를 추가하거나, 엔진이 항상 `context.rawConfig` 를 채워 핸들러가 폴백을 직접 처리하지 않도록 보장한다.

---

## 요약

이번 변경의 핵심 목표인 raw config echo 통일과 1MB cap 은 올바른 방향이며 테스트 보강도 충분하다. 단, 아키텍처 관점에서 두 가지 문제가 눈에 띈다. 첫째, `truncate-body.util.ts` 가 Integration 도메인의 네임스페이스에 있으면서 Presentation 도메인의 상수와 로직을 담게 되어 모듈 경계가 흐려졌다. 둘째, `output.rendered` 와 `output.items`/`output.rows` 가 서로 다른 데이터셋을 가리키는 의미 불일치가 생겼는데, 이 부분은 스펙에 명시적 계약이 없으면 프론트엔드가 인덱스 기반으로 두 필드를 상호 참조할 때 잠재적 버그가 된다. `rawConfig` 의 `Record<string, unknown>` 타입 침식은 점진적으로 개선하면 충분하다.

## 위험도

**MEDIUM** — 기능 동작에 즉각적인 회귀는 없으나, `rendered` 와 `items` 의 불일치는 프론트엔드 렌더링 의존 방식에 따라 잠재적 버그를 내포하고, Presentation → Integration 크로스 도메인 import 는 추후 리팩토링 비용을 높인다.