# 테스트(Testing) 리뷰 — `terminal-duration-sql.e2e-spec.ts` 신설 + plan 트래커 갱신

## 리뷰 범위 메모

리뷰 대상 11개 파일 중 실제 코드는 **파일 1**(`codebase/backend/test/terminal-duration-sql.e2e-spec.ts`, 신규 e2e)
하나뿐이다. 파일 2·3 은 plan 트래커(md) 갱신, 파일 4~11 은 이전 라운드 `/consistency-check` 산출물
(review/consistency/**)로 코드가 아니라 리포트 아티팩트라 테스트 관점 점검 대상이 아니다(mock·커버리지·격리
같은 기준이 적용될 대상 자체가 없음). 이하는 파일 1 을 실제 소스(`terminal-duration.ts`,
`terminal-duration.spec.ts`, `test/helpers/db.ts`, 기존 49개 e2e-spec)와 대조해 검증한 결과다.

## 발견사항

- **[INFO]** int4 클램프의 정확한 컷오프 경계값은 검증되지 않는다 — 100일(≈`PG_INT4_MAX`의 4배) 입력으로
  "클램프가 발동한다"는 것만 확인하고, `PG_INT4_MAX` ms 정확히 또는 `PG_INT4_MAX + 1` ms 같은 **경계 바로
  옆**의 off-by-one/부동소수점 반올림(`EXTRACT(EPOCH …) * 1000)::bigint` 캐스팅) 오차는 이 테스트로는
  갈리지 않는다.
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:116` (`'[클램프] int4 를 넘는 경과는 saturate...'` it 블록)
  - 상세: 클램프가 "동작 자체"는 확실히 검증하지만, "정확히 어디서 꺾이는가"는 미검증이다. `LEAST` 식이므로
    off-by-one 가능성은 낮지만, `EXTRACT(EPOCH …)` 의 `double precision` → `bigint` 캐스팅 반올림이
    경계 부근에서 1ms 오차를 낼 가능성은 이론적으로 남는다.
  - 제안: 여유가 되면 `PG_INT4_MAX` ms 정확히 → `PG_INT4_MAX`, `PG_INT4_MAX + 1` ms → `PG_INT4_MAX` 두
    케이스를 추가해 경계를 직접 고정. 우선순위는 낮음 — 이번 PR 의 핵심 갭(단위 초/ms 혼동)은 이미 강하게
    커버됨(plan 문서의 뮤테이션 실측상 M1 이 RED).

- **[INFO]** `toPgSql()` 의 vacuous-guard(`expect(occurrences).toBeGreaterThan(0)`)가 별도 테스트가 아니라
  `durationMs()` 호출마다(즉 사실상 파일 내 모든 `it` 블록마다) 반복 실행된다.
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:56-62` (`toPgSql()`)
  - 상세: `TERMINAL_FINISHED_AT_PARAM` 이름이 SQL 상수와 어긋나는 회귀가 생기면, 원인을 짚어주는 단일
    실패가 아니라 파일 내 6개 `it` 전부가 동시에 실패해 신호가 흐려진다(테스트 격리·가독성 축의 사소한
    트레이드오프). vacuous 방지 의도 자체는 타당함(코멘트에 명시돼 있음).
  - 제안: `describe` 최상단에 `it('SQL 에 named 파라미터가 실제로 있다', () => { expect(occurrences...) })`
    형태의 독립 테스트 하나를 추가하고 `toPgSql()` 자체는 guard 없이 순수 변환만 하도록 분리하면 실패
    지점이 명확해진다. 선택 사항 — 현재도 오탐/누락은 없다.

- **[INFO]** `durationMs()` 헬퍼는 `res.rows[0].duration_ms` 를 무가드로 인덱싱하는데, 같은 파일의 `column()`
  헬퍼는 `res.rows[0] ?? null` 로 방어한다 — 파일 내 방어 스타일이 비대칭이다.
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:81-89`(`durationMs`) vs
    `:131-138`(`column`)
  - 상세: `durationMs()` 의 서브쿼리(`SELECT $2::timestamptz AS started_at`)는 WHERE 절 없는 리터럴
    subquery라 항상 정확히 1행을 반환하므로 실질 위험은 없다. 다만 `tsconfig.json` 이
    `noUncheckedIndexedAccess` 를 켜지 않아(`strictNullChecks`만 true) 타입 레벨에서도 안 잡힌다 — 이후
    쿼리가 조건부로 바뀌면 조용히 `undefined.duration_ms` 로 깨질 수 있다.
  - 제안: 낮은 비용이면 `res.rows[0]` 존재를 한 번 assert 해 스타일을 통일. 차단 사유 아님.

## 확인된 강점 (테스트 관점에서 특기할 만함)

- **Mock 적절성**: 이 SQL 은 `EXTRACT(EPOCH …) * 1000` 같은 Postgres 고유 산술 의미를 담고 있어, mock 으로는
  "문자열에 특정 토큰이 있는가" 이상을 검증할 수 없다는 한계를 JSDoc 에 명시하고 실제 Postgres 로 값을
  검증한다 — mock 회피가 정당화된 드문 케이스. `codebase/backend/test/webchat-idle-reaper.e2e-spec.ts` 를
  grep 해 "duration_ms 를 SELECT/assert 하는 기존 e2e 가 없다"는 JSDoc 상 주장도 실제로 일치함을 확인했다.
- **테스트 격리**: `durationMs()` 쿼리는 리터럴 subquery(`SELECT $2::timestamptz AS started_at`) 위에서
  동작하는 순수 계산이라 테이블 쓰기가 전혀 없다 — 다른 e2e spec 이 관례로 쓰는 unique email/name
  prefix(`test/helpers/db.ts` 주석)조차 필요 없는 형태로, 실질적인 병렬 오염 위험이 없다.
  `beforeAll`/`afterAll` 의 connect/disconnect 도 표준 패턴과 일치한다.
- **하드코딩 회피**: 테이블/컬럼명을 문자열로 손으로 적지 않고 `getMetadataArgsStorage()` 로 엔티티에서
  유도한다 — JSDoc 에 "처음엔 `'executions'`로 적었다가 실패했다"는 시행착오까지 기록해 "SQL 이 가진
  하드코딩과 같은 종류의 하드코딩을 테스트가 반복하지 않는다"는 설계 의도가 뚜렷하다.
- **회귀 검출력 실측**: `plan/in-progress/terminal-duration-sql-safety-net.md` 에 뮤테이션 3종(M1 `* 1000`
  제거, M2 `LEAST` 제거, M3 `THEN NULL`→`THEN 0`)을 커밋 후 실제로 적용해 RED/GREEN 을 기록해 뒀다 —
  기존 단위 스펙(`terminal-duration.spec.ts`)이 M2·M3 은 이미 문자열 단언으로 잡고 있었고(`toContain('LEAST(...)')`,
  `toContain('THEN NULL')`), 신규 e2e 가 유일하게 잡는 것은 M1(단위 초/ms 혼동)이라는 점을 직접 확인한
  근거가 남아 있다 — vacuous 테스트가 아님을 스스로 실증했다.
- **가독성**: `it` 이름에 `[단위]`/`[부호]`/`[경계]`/`[클램프]` 태그를 붙이고 각 케이스가 "왜 이 값인가"를
  주석으로 남겨(예: "초로 계산하면 여기서 갈린다") 실패 시 원인 추정이 쉽다.
- **회귀 안전성**: `tsc --noEmit` 로 백엔드 전체를 돌려도 신규 파일에서 발생하는 타입 오류는 0건(기존
  베이스라인 오류들과 무관). `.e2e-spec.ts$` 네이밍으로 `test/jest-e2e.json` 의 `testRegex` 에 자동
  포함되어 별도 설정 없이 `test:e2e` 러너가 픽업한다. 기존 단위 스펙(`terminal-duration.spec.ts`)은 이번
  변경으로 건드리지 않아 유효성 그대로 유지된다.

## 요약

신규 e2e 파일은 "SQL 문자열은 실행해야만 의미가 갈린다"는 명확한 문제의식 위에서, mock 없이 실제
Postgres 로 값을 검증하고 정본 SQL 을 재작성 없이 그대로 태우며, 자체 뮤테이션 테스트로 판별력까지
실측 확인해 둔 높은 완성도의 e2e다. 코드 쓰기가 없어 테스트 격리도 자연스럽고, 엔티티 메타데이터로
테이블/컬럼명을 유도해 SQL 이 가진 하드코딩을 테스트가 반복하지 않는다. 지적 사항은 전부 INFO 급 폴리시
(정확한 int4 경계값 미검증, vacuous-guard 의 실패 지점 분산, 헬퍼 간 방어 스타일 비대칭)이며 차단 사유가
되는 커버리지 갭이나 mock 오남용, 회귀 위험은 발견되지 않았다. plan 문서(파일 2·3)는 이 e2e 의 트레이드오프와
검증 결과를 정확히 반영하고 있어 문서-코드 간 괴리도 없다.

## 위험도

LOW
