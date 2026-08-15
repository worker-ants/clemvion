# 성능(Performance) 리뷰 — EIA `durationMs` DB=wire 불변식 닫기 (2026-08-15 14:47:14)

## 검토 범위 요약

이번 diff 의 실질 코드 변경은 세 지점이다.

1. `finalizeCancelledExecution` (execution-engine.service.ts) — guarded UPDATE 가 0행일 때
   `findOneBy` 로 재조회하는 분기 추가
2. `finalizeGuarded` CANCELLED 분기 (retry-turn.service.ts) — 같은 UPDATE 문에 `.returning(...)`
   추가 + `toFiniteNumber`/`toPersistedDate` 로 값 파싱
3. `interaction.service.ts` — `STATUS_PROJECTION_COLUMNS` 에 `durationMs` 컬럼 1개 추가

나머지는 스펙/CHANGELOG/plan/과거 리뷰 산출물(review/**, 순수 문서) 변경이라 성능 관점에서
분석 대상이 아니다.

## 발견사항

- **[INFO]** `finalizeCancelledExecution` 0행 분기에 추가 DB 왕복(`findOneBy`) 1회
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4915` (`finalizeCancelledExecution`)
  - 상세: guarded UPDATE(`updateExecutionStatus`, `status IN (non-terminal)`)가 0행 매칭일 때만
    `this.executionRepository.findOneBy({ id })` 로 재조회한다. 이 분기는 "동시 writer 가 이미
    terminal 로 선점"한 레이스에서만 타므로 hot path 가 아니고, 반복문 안이 아니라 실행 1건당
    최대 1회(0행일 때만)라 N+1 로 이어지지 않는다. `id` 는 PK 이므로 인덱스 조회 비용도 무시할
    수준이다. 정합성(사후 오시그널 방지)을 위한 트레이드오프로 타당하다.
  - 제안: 조치 불요.

- **[INFO]** `retry-turn.service.ts` `.returning(['duration_ms', 'finished_at'])` 은 추가 왕복이 아님
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:656` (`finalizeGuarded` CANCELLED 분기)
  - 상세: `RETURNING` 절은 같은 `UPDATE` 문 실행의 일부로 처리되는 PostgreSQL 기능이라 별도
    SELECT 왕복을 만들지 않는다. `result.raw[0]` 을 읽어 `toFiniteNumber`/`toPersistedDate` 로
    파싱하는 것도 상수 시간 연산이라 성능 영향이 없다.
  - 제안: 조치 불요.

- **[INFO]** `interaction.service.ts` `durationMs` projection 추가 — 단일 컬럼, 단건 조회
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:78` (`STATUS_PROJECTION_COLUMNS`), `:434` (`durationMs: execution.durationMs ?? null`)
  - 상세: `getStatus` 는 `id` 단건 조회(`repo.findOne`) 경로이고 이미 존재하는 컬럼을 select 목록에
    추가한 것뿐이다. 페이지네이션·대량 조회·반복 호출 경로가 아니라 SELECT 폭 증가에 따른 실질
    비용은 무시할 수준이다.
  - 제안: 조치 불요.

- **[INFO]** `toPersistedDate`(terminal-duration.ts) — O(1) 순수 함수, 캐싱/최적화 불필요
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:89` (`toPersistedDate`)
  - 상세: `instanceof Date` 검사 또는 문자열 1회 `new Date(v)` 파싱으로 끝나는 상수 시간 함수다.
    반복 호출 경로(루프)에서 쓰이지 않고, `finalizeGuarded` 의 CANCELLED 분기당 최대 1회 호출된다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 파일(spec.ts) 변경은 mock 체인 확장(`setParameter`/`returning`) 및 신규 케이스
  추가로, 런타임 성능과 무관.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`,
    `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`,
    `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`,
    `codebase/backend/src/shared/utils/terminal-duration.spec.ts`

## 요약

이번 diff 는 EIA 종결 이벤트의 "DB=wire" 불변식을 닫는 정합성 버그 수정으로, 성능에 실질적 영향을
주는 변경은 없다. 추가된 DB 왕복은 `finalizeCancelledExecution` 의 guarded UPDATE 가 0행일 때만
(동시 선점 레이스, 실행 1건당 최대 1회) 발생하는 `findOneBy` 단건 조회뿐이며 반복문·N+1·배치
처리 대상이 아니다. `retry-turn.service.ts` 의 `.returning()` 추가는 같은 SQL 문 안에서 처리되어
추가 왕복이 없다. `interaction.service.ts` 의 컬럼 추가는 이미 로드되는 단건 조회에 필드 하나를
얹은 것뿐이다. 알고리즘 복잡도·캐싱·블로킹 I/O·자료구조 선택·문자열 누적 등 다른 관점에서도
우려할 변경이 없다.

## 위험도
NONE
