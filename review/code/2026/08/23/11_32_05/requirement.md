# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** `durationMs()` 헬퍼가 `res.rows[0]` 를 무가드로 인덱싱한다
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:99` (`durationMs` 함수, `const raw = res.rows[0].duration_ms;`)
  - 상세: 같은 파일의 `column()` 헬퍼(`:165`, `res.rows[0] ?? null`)는 방어를 하는 반면 `durationMs()` 는 안 한다. 실질 위험은 낮다 — 서브쿼리가 리터럴 단일 행(`SELECT $2::timestamptz AS started_at`)이라 항상 정확히 1행을 반환한다. 직전 라운드(`11_15_39` 리뷰)에서 이미 INFO 로 지적됐고 "리터럴 subquery 라 항상 1행, 방어를 늘리면 틀린 신호를 남긴다" 는 사유로 의도적으로 미반영됐다(`RESOLUTION.md` INFO #5). 그 판단에 동의 — 재지적 아님, 기록 목적.
  - 제안: 조치 불요. 향후 이 subquery 형태가 JOIN/필터로 바뀌어 0행 가능성이 생기면 그때 가드 추가.

- **[INFO]** spec 은 `durationMs` 의 `null` 부재 표현·5경로 SQL 계산·`RETURNING` 동일값 보장까지는 명시하지만 int4 saturate(`PG_INT4_MAX`) 클램프 자체는 언급하지 않는다
  - 위치: `spec/5-system/14-external-interaction-api.md:592` (§6 "종결 이벤트의 필드 집합" 표, `durationMs` 행)
  - 상세: 이번 e2e(`terminal-duration-sql.e2e-spec.ts`)가 새로 검증하는 핵심 비즈니스 규칙 하나(24.8일 초과 시 saturate, 문장 실패 방지)는 순수 내부 구현 제약(DB 컬럼이 int4)에서 비롯한 것이고, `durationMs` 의 외부 계약("밀리초, 모르면 null")은 이 클램프로 바뀌지 않는다. `plan/complete/terminal-duration-sql-safety-net.md` 의 `spec_impact: none` 과 일치하며, 동일 라운드 documentation reviewer 도 "spec 결함도 spec-코드 불일치도 아님" 으로 명시했다(`11_15_39/documentation.md`, `11_15_39/requirement.md` INFO #7 상당). 회색지대 판단에 동의.
  - 제안: 조치 불요. spec 본문에 클램프 근거(왜 24.8일에서 saturate 하는지)를 남기고 싶다면 §6 각주에 한 줄 추가 검토 가능하나 필수 아님.

## 검증 내역 (요약)

- `TERMINAL_DURATION_MS_SQL` (`codebase/backend/src/shared/utils/terminal-duration.ts:120-123`)의 SQL 의미를 손으로 전개해 각 `it` 기대값과 대조 — 6개 케이스(단위/부호/경계-0/클램프-4배/컷오프 정확값/컷오프+1) 전부 실제 SQL 산술과 일치. `LEAST`/`THEN NULL` 위치·파라미터 바인딩(`$1`=finishedAt, `$2`=startedAt) 도 `db.query(sql, [finishedAt, startedAt])` 호출부와 정합.
- JS 쌍둥이 `resolveTerminalDurationMs`(같은 파일 `:37-57`)와 SQL 경로의 sentinel(음수→null, 상한→`PG_INT4_MAX`)이 대칭임을 확인 — "부호 sentinel 일치" 주장(코드 주석)이 실제로 참.
- `entityTable()`/`entityColumn()` 이 유도하는 값(`execution` 테이블, `started_at`/`duration_ms` 컬럼)을 `execution.entity.ts:23,56,62-63` 및 `migrations/V001__initial_schema.sql:214-225`(`duration_ms INTEGER`)와 대조 — 일치. 테스트 주석의 "처음엔 `'executions'` 라 적었다가 실패했다" 부수 서술도 실제 엔티티 데코레이터(`@Entity('execution')`)와 부합.
- 프로덕션 소비처 5곳(`execution-engine.service.ts:1032,1166,2815,2886,3354`)이 모두 `durationMs: () => TERMINAL_DURATION_MS_SQL` + `.setParameter(TERMINAL_FINISHED_AT_PARAM, ...)` 형태로 정본 SQL·파라미터명을 verbatim 사용 — 테스트가 검증하는 그 문자열이 실제 운영 경로와 동일함을 확인(테스트가 자기 사본을 만들어 검증하는 함정 없음).
- `it.each` 컷오프 경계 케이스(정확히 `PG_INT4_MAX` / `+1ms`)는 "넉넉히 초과"만 보는 이전 버전의 사각지대(상한이 `PG_INT4_MAX` 인지 하나 작은지 구분 불가)를 실제로 해소 — off-by-one 회귀를 잡을 수 있는 형태로 확인.
- TODO/FIXME/HACK/XXX 주석: 없음 (`grep` 확인).
- 반환값: `durationMs()` 는 모든 경로에서 `number | null` 을 명시적으로 반환(널 아닌 raw 는 `Number()` 로 강제 좁힘 — pg 드라이버가 정수를 문자열로 줄 수 있다는 주석과 일치), `column()` 도 `{data_type} | null` 로 일관.
- plan 문서 정합성: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 W10·W7 항목이 모두 `[x]` 로 전환됐고 본문 blockquote 의 수치(9케이스=전제1+값4+경계2+스키마2, e2e 276→282→285)가 실제 파일의 `it`/`it.each` 개수(9)와 일치. `plan/complete/terminal-duration-sql-safety-net.md` 체크리스트 4항목 모두 `[x]`, 이전 라운드 stale-checkbox WARNING(11_15_39 Warning #1)이 이번엔 재발하지 않음.
- `review/**` 아래 위치한 파일 4~22(이전 `11_15_39` 리뷰·`10_48_33` consistency 라운드 산출물)는 이번 diff 에서 실행 코드 변경이 아니라 과거 산출물의 커밋 반영이므로 별도 기능 결함 판단 대상 아님 — 내용은 자기완결적이고 이번 e2e/plan 변경과 모순되지 않음.

## 요약

신규 e2e(`terminal-duration-sql.e2e-spec.ts`)는 `TERMINAL_DURATION_MS_SQL` 이라는, 단위 테스트로는 원리적으로 검증 불가능한 SQL 문자열 산술(초→밀리초 변환, 부호 sentinel, int4 saturate)을 실제 Postgres 로 태워 값으로 확인한다는 의도를 완전히 충족한다. 모든 테스트 케이스가 정본 SQL(`terminal-duration.ts`)·엔티티 메타데이터·실 스키마·프로덕션 5개 소비처와 line-level 로 일치하며, TODO/FIXME 나 미완성 표시는 없고, 클램프 경계(정확히 `PG_INT4_MAX`/`+1ms`)까지 다뤄 이전 리뷰가 지적한 사각지대도 해소됐다. 남은 두 관찰(무가드 `rows[0]` 인덱싱, spec 이 클램프 세부까지는 다루지 않음)은 모두 이미 의도적으로 판단·수용된 회색지대로 재확인했을 뿐 신규 결함이 아니다. Critical/Warning 없음.

## 위험도
NONE
