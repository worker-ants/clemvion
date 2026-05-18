### 발견사항

- **[INFO]** `buildSystemContextPrefixFromContext` — `Intl.DateTimeFormat` 이 호출당 2회 생성됨
  - 위치: `system-context-prefix.ts` `getPartsInTimezone()` (line 167) + `computeOffsetMinutes()` (line 196)
  - 상세: 하나의 `buildSystemContextPrefix` 호출에서 `formatIsoWithTimezone`이 `getPartsInTimezone`과 `computeOffsetMinutes`를 각각 호출하고, `formatUtcOffsetLabel`도 다시 `computeOffsetMinutes`를 호출한다. 결과적으로 동일한 `(date, timezone)` 쌍에 대해 `Intl.DateTimeFormat` 인스턴스가 최대 3회 생성된다. `Intl.DateTimeFormat` 생성 비용은 JavaScript 엔진마다 다르지만 일반 객체 생성보다 수십~수백 배 비싸다. 단일 LLM 호출 전처리 코드이므로 실제 처리량(throughput)에 미치는 영향은 제한적이나, 동시 워크플로 실행이 많아지면 누적될 수 있다.
  - 제안: `computeOffsetMinutes`의 결과를 로컬 변수로 한 번만 계산해 `formatIsoWithTimezone`과 `formatUtcOffsetLabel` 두 함수에 인자로 전달하도록 리팩터링. 또는 `buildSystemContextPrefix` 내부에서 offset을 한 번 계산 후 `renderSection`에 넘기는 구조로 개선.

- **[INFO]** `isValidIanaTimezone` — 호출마다 `Intl.DateTimeFormat` 인스턴스 생성 (캐싱 없음)
  - 위치: `system-context-prefix.ts` `isValidIanaTimezone()` (line 62–69), `resolveSystemContextTimezone()` (line 51–60)
  - 상세: `resolveSystemContextTimezone`이 후보 목록(`[workspaceTimezone, process.env.TZ, 'UTC']`)을 순회하며 각각 `isValidIanaTimezone`을 호출한다. `process.env.TZ`와 `'UTC'`는 프로세스 수명 동안 불변이지만 호출마다 새 `Intl.DateTimeFormat` 인스턴스로 재검증한다. 단일 실행 경로에서 최대 3회 소비. 동시 실행 수가 많은 멀티테넌트 환경에서는 합산 비용이 누적된다.
  - 제안: 검증 결과를 `Map<string, boolean>` 모듈-레벨 캐시에 메모이제이션. IANA timezone 이름 집합은 런타임 중 변하지 않으므로 캐시 무효화 전략 불필요. 예: `const _tzCache = new Map<string, boolean>(); function isValidIanaTimezone(name: string): boolean { if (_tzCache.has(name)) return _tzCache.get(name)!; ... _tzCache.set(name, result); return result; }`.

- **[INFO]** `execution-engine.service.ts` — `findOne` with `relations: ['workspace']` 로 변경된 단일 쿼리
  - 위치: `execution-engine.service.ts` diff 기준 `createContext` 단계 (line 1269–1284)
  - 상세: 변경 전 `findOneBy({ id: workflowId })`에서 `findOne({ where: { id: workflowId }, relations: ['workspace'] })`로 교체하여 **N+1 방지** 목적은 달성했다. 단, JOIN 쿼리로 workspace 전체 row를 적재한다. workspace `settings` JSONB에서 실제로 필요한 값은 `settings.timezone` 단일 필드이나, ORM 레이어가 workspace 엔티티 전체를 메모리에 로드한다. 워크스페이스에 대용량 JSONB settings가 없는 일반 케이스에서는 무시할 수준이지만, 이 점은 인지해 두어야 한다.
  - 제안: 현재 구조(ORM 관계 로드)는 프레임워크 일반 관행에 부합하므로 즉각 수정 불필요. 향후 `settings` 컬럼이 비대해질 경우 `QueryBuilder`로 `workspace.settings->>'timezone'`만 SELECT하는 경량 쿼리로 전환 고려.

- **[INFO]** `buildSystemContextPrefixFromContext` — `new Date()` 가 핸들러에서 3곳에 흩어져 생성됨
  - 위치: `ai-agent.handler.ts` (single-turn 경로 + multi-turn 경로), `text-classifier.handler.ts`, `information-extractor.handler.ts` 각각 `now: new Date()` 전달
  - 상세: 각 호출 지점이 독립적으로 `new Date()`를 생성하므로 동일 execution 내에서 두 경로가 모두 실행될 경우 미세하게 다른 타임스탬프가 생성될 수 있다. 현재는 `now`가 단순 prefix 출력에만 사용되고, multi-turn 주석에도 "execution-frozen" 의도가 기술되어 있으므로 실제 오류를 유발하지는 않는다. 그러나 설계 의도(execution-frozen `$now`)와 구현이 미묘하게 어긋난다.
  - 제안: `runExecution` 시작 시점의 `Date`를 ExecutionContext에 포함시키거나, 혹은 `savedExecution.startedAt` 같은 기존 persistence 값을 `now`로 전달하면 frozen 의도를 구현 수준에서도 보장할 수 있다. 단기적으로는 현재 동작에 실질적 성능 문제가 없으므로 INFO 등급.

- **[INFO]** `metadata.spec.ts` — `listAllCafe24Operations()` 전수 순회 테스트
  - 위치: `metadata.spec.ts` `date/time field descriptions declare KST or YYYY-MM-DD format` 테스트 (line 932–967)
  - 상세: 테스트 시간 내 메타데이터 전수 순회는 정적 배열을 반복하는 것이므로 실제 I/O 없이 O(N) 순회다. 현재 메타데이터 규모(수십~수백 개 operation)에서 실행 시간에 미치는 영향은 무시할 수준. 향후 메타데이터가 대폭 증가하더라도 이 테스트 자체가 병목이 될 가능성은 낮다.
  - 제안: 유지 현행. 별도 조치 불필요.

---

### 요약

이번 변경의 핵심인 N+1 쿼리 방지(워크플로 + 워크스페이스 단일 JOIN 쿼리)와 AI 핸들러별 독립 조회 제거는 올바르게 구현되어 있다. 성능 관점에서 중요한 설계 결정들이 코드와 주석에 명확히 반영되어 있다. 지적할 사항은 모두 `Intl.DateTimeFormat` 인스턴스 중복 생성과 IANA 검증 결과 미캐싱으로 한정되며, 단일 LLM 호출 전처리 단계에서 수 밀리초 이하 영역의 문제이다. 고부하 멀티테넌트 환경에서 동시 실행이 많아질 경우 모듈-레벨 메모이제이션을 도입하면 CPU 사이클을 절약할 수 있으나, 현재 구조에서 실질적 성능 병목이 될 가능성은 낮다. CRITICAL·WARNING 등급 발견사항 없음.

---

### 위험도

LOW
