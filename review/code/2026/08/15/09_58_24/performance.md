# 성능(Performance) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

프롬프트 번들에 실제 소스가 실리지 않은 파일(1~6번, 전부 55KB 안팎으로 크기 제한에 걸림)은 `Read`로 직접 열어 대조했다. 리뷰 대상 중 성능과 실질적으로 관련 있는 파일은 코드 파일 4개다:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규)
- 나머지(스펙 `*.spec.ts` 테스트 mock 확장, `plan/**`, `review/consistency/**`, `spec/**`)는 프로덕션 런타임 성능에 영향을 주지 않는 테스트/문서 변경이라 점검 관점에서 제외했다(`grep`으로 `TERMINAL_DURATION_MS_SQL`/`resolveTerminalDurationMs` 호출부 전수를 확인해 핫루프·N+1 여부를 교차 검증).

## 발견사항

- **[INFO]** `resolveTerminalDurationMs(savedExecution)` 를 같은 함수 안에서 두 번 호출 — 첫 호출로 `savedExecution.durationMs` 를 이미 확정한 직후, emit payload 를 만들며 동일 인자로 재호출한다. 함수 내부는 `typeof`+`Number.isFinite` 체크와 산술 한 줄뿐이라 비용은 무시할 수준(실행당 1회, 노드 순회 루프 안이 아님)이지만, 첫 호출의 결과(`savedExecution.durationMs`)를 그대로 재사용하면 되는 자리다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2413`(대입) / `:2424`(재호출)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3565`(대입) / `:3576`(재호출)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4755`(대입) / `:4768`(재호출)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4883`(대입) / `:4887`(재호출)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:896`(대입) / `:907`(재호출)
  - 상세: `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` 로 확정한 값을 몇 줄 뒤 `durationMs: resolveTerminalDurationMs(savedExecution)` 로 다시 계산한다. 이미 확정된 `savedExecution.durationMs` 는 함수 진입부의 `typeof row.durationMs === 'number' && Number.isFinite(...)` 분기에서 즉시 통과하므로 결과는 동일하지만 함수 호출이 중복된다.
  - 제안: `durationMs: savedExecution.durationMs` 로 직접 참조하거나, 대입 시점의 반환값을 지역 변수에 담아 재사용. 실질적 영향은 극히 미미하므로 우선순위는 낮음(스타일/DRY 성격에 가까움).

## 그 외 점검 결과 (문제 없음으로 판정)

- **N+1 쿼리**: `finalizeStalledExhausted`/`cancelParkedExecution`/`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`markExecutionCancelled` 전부 실행(execution) 1건당 1회 호출되는 종결 경로이며, 노드 순회나 배치 루프 내부에서 호출되지 않는다(`grep` 으로 호출부 전수 확인). 새로 추가된 `.returning(['id', 'duration_ms'])` 는 오히려 UPDATE 직후 별도 SELECT 로 값을 다시 읽어오는 추가 왕복을 막아준다 — N+1 을 만들지 않고 기존에 있었을 수도 있는 재조회 패턴을 예방하는 방향.
- **알고리즘 복잡도**: `TERMINAL_DURATION_MS_SQL` (`GREATEST(0, EXTRACT(EPOCH FROM (...)) * 1000)`) 은 DB 가 단일 행 UPDATE 문장 안에서 계산한다 — `WHERE id = :id` 로 PK 스캔이라 연산 비용은 O(1). JS 쪽에서 엔티티를 별도로 로드해 재계산하지 않는 설계라 왕복이 늘지 않는다.
- **메모리 할당**: `toFiniteNumber`/`resolveTerminalDurationMs` 모두 원시값 처리이며 대규모 배열·객체를 만들지 않는다. `result.raw` 는 단일 행(`[0]`)만 참조한다.
- **캐싱**: `durationMs` 는 실행 1건의 종결 시점에만 계산되는 파생값이라 캐싱 대상이 아니다(재사용되는 반복 계산이 아님).
- **블로킹 I/O**: 전부 기존과 동일하게 `await` 기반 비동기 TypeORM 호출. 새로 동기 I/O 를 추가하지 않았다.
- **데이터 구조**: 변경 없음 — 기존 QueryBuilder 체인에 `setParameter`/`returning` 을 추가한 것뿐.
- **지연 로딩**: 해당 없음.
- **테스트 파일(`*.spec.ts`) mock 확장**: `setParameter`/`returning` mock 을 ~20개 체인 리터럴에 반복 추가했다. 프로덕션 런타임과 무관하고, 테스트 스위트 실행 비용 증가도 무시할 수준(mock 함수 객체 몇 개 추가)이라 성능 관점에서는 이슈 아님.

## 요약

이번 변경은 종결 이벤트(`completed`/`failed`/`cancelled`) payload 에 `durationMs` 를 채우는 배관 작업으로, 계산을 가능한 한 SQL(`GREATEST`+`EXTRACT EPOCH`) 로 밀어넣고 `RETURNING` 으로 같은 UPDATE 문장에서 값을 되받는 설계를 택해 추가 SELECT 왕복(N+1)을 만들지 않았다. 각 헬퍼(`resolveTerminalDurationMs`/`toFiniteNumber`)는 O(1) 순수 함수이고 호출 지점 전부가 실행(execution) 1건당 1회뿐인 종결 경로라 노드 수·행 수에 비례하는 반복 호출 패턴은 없다. 유일하게 지적할 점은 완료 경로 5곳에서 같은 인자로 `resolveTerminalDurationMs` 를 두 번 부르는 사소한 중복 계산(INFO)이며, 실질 성능 영향은 무시할 수준이다. 전반적으로 성능 리스크는 낮다.

## 위험도

LOW
