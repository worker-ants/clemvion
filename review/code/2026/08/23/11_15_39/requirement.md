# 요구사항(Requirement) 리뷰 — `terminal-duration-sql-safety-net` (W10·W7)

## 검토 범위

- `codebase/backend/test/terminal-duration-sql.e2e-spec.ts` (신설, 154줄) — 실제 코드 변경의 전부
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 트래커 W10·W7 체크박스 `[x]` 전환 + 종결 메모
- `plan/in-progress/terminal-duration-sql-safety-net.md` (신설) — 이번 작업 plan
- `review/consistency/2026/08/23/10_48_33/*` (신설 8개) — `--impl-prep` consistency check 산출물(자동 생성)

핵심 프로덕션 로직(`codebase/backend/src/shared/utils/terminal-duration.ts`)은 이번 diff 에 포함되지 않음 —
`terminal-duration.ts` 를 직접 열어 `TERMINAL_DURATION_MS_SQL`/`PG_INT4_MAX`/`resolveTerminalDurationMs` 를
읽고, 신설 e2e 의 각 단언이 그 SQL 의 실제 의미론과 line-level 로 맞는지 대조했다.

## 발견사항

- **[WARNING] plan 체크리스트가 실제 완료 상태를 반영하지 않는다**
  - 위치: `plan/in-progress/terminal-duration-sql-safety-net.md:55-58`
  - 상세: "## 작업" 절의 `- [ ] /consistency-check --impl-prep` · `- [ ] e2e 신설 — SQL 값 검증
    4케이스 + 스키마 전제 2건` · `- [ ] 뮤테이션으로 판별력 검증` · `- [ ] 트래커 W10·W7 종결`
    4개 항목이 전부 `[ ]`(미완료) 상태다. 그런데 같은 파일 하단 "## 검증 결과" 절(라인 62 이후)은
    뮤테이션 M1/M2/M3 결과표를 이미 채워 완료를 서술하고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    diff 는 W10·W7 을 이미 `[x]` 로 닫았으며, `review/consistency/2026/08/23/10_48_33/` 8개 파일은
    `--impl-prep` consistency check 가 이미 실행·완료(BLOCK:NO)됐음을 증명한다. 4개 항목 모두 완료
    증거가 diff 안에 있는데 체크박스만 미동기화 상태다. (`- [ ] TEST WORKFLOW 4단계 + 타입체크
    ratchet` · `- [ ] /ai-review` 2개는 이 리뷰 자체가 그 마지막 단계이므로 미체크가 타당할 수
    있다 — 다만 mutation 검증이 실제 e2e 실행을 전제하므로 최소 e2e 실행은 이미 있었을 개연성이
    높다.)
  - 제안: 완료가 확인된 4개 항목(`/consistency-check --impl-prep`, e2e 신설, 뮤테이션 검증, 트래커
    W10·W7 종결)을 `[x]` 로 갱신. `CLAUDE.md`/MEMORY 컨벤션("plan 체크박스 = 실제 상태")과 어긋난다.

- **[INFO] spec 본문은 이 SQL/테스트의 존재를 요구하지 않는다 (spec fidelity — 결함 아님)**
  - 위치: `spec/5-system/14-external-interaction-api.md` §6 (필드 집합 표, `durationMs` 행)
  - 상세: EIA spec 은 종결 이벤트 payload 의 `durationMs` **필드**만 정의하며, 그 값을 계산하는
    SQL 표현식이나 e2e 검증 요구는 spec 본문에 없다(순수 구현 세부사항). `terminal-duration-sql-safety-net.md`
    의 `spec_impact: none` 프런트매터와 `naming_collision.md`/`convention_compliance.md` consistency
    체커 결과(신규 spec 식별자 0개, `spec/5-system/` diff 0)도 이를 뒷받침한다. 조치 불요 — spec 결함도
    아니고 spec-코드 불일치도 아니다.

- **[INFO] 클램프 경계값 자체(≈24.8일)는 테스트되지 않음 — 저위험**
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:116-120` (`[클램프]` 케이스)
  - 상세: 클램프 테스트는 `'2026-01-01T00:00:00.000Z'` → `'2026-04-11T00:00:00.000Z'`(경과 100일,
    `PG_INT4_MAX`≈24.855일을 한참 초과)로 saturate 여부만 확인한다. `LEAST(PG_INT4_MAX, …)` 는 단순
    비교라 정확한 경계(24.855일 ± 1ms)에서 off-by-one 이 날 가능성은 낮지만, 정확한 경계값 테스트는
    없다. 차단 사유 아님 — nice-to-have.

## 기능 검증 상세 (문제 없음 확인)

- `toPgSql()` 이 `:terminalFinishedAt` → `$1` 치환 후 쿼리 파라미터 `[finishedAt, startedAt]` 순서와
  결합하는 방식은 프로덕션(`execution-engine.service.ts` 의 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` TypeORM named-parameter 바인딩)과 동등한 치환을 재현한다.
- 4개 값 케이스(단위 1500ms·부호 NULL·경계 0ms·클램프 saturate)를 실제 SQL 산술로 역산해 검증함 —
  전부 `TERMINAL_DURATION_MS_SQL` 문면과 일치(부호 분기 `< started_at THEN NULL`, `EXTRACT(EPOCH…)×1000`,
  `LEAST(PG_INT4_MAX,…)`).
- 스키마 전제 테스트(`entityTable()`/`entityColumn()`)는 `Execution` 엔티티(`@Entity('execution')`,
  `@Column({name:'started_at'})`, `@Column({name:'duration_ms'})`)와 `V001__initial_schema.sql:223`
  (`duration_ms INTEGER`)에 대조해 실측 확인 — 하드코딩 없이 SoT 에서 유도하는 설계 의도대로 동작.
- `getMetadataArgsStorage` import 순서상 `terminal-duration-sql.e2e-spec.ts` 는 `'typeorm'` import
  (`typeorm/index.js` 최상단 `require("reflect-metadata")`)가 `Execution` 엔티티 import보다 먼저 실행돼
  `reflect-metadata` 명시적 import 없이도 데코레이터 메타데이터가 정상 등록됨 — 잠재 버그로 의심했으나
  실측상 문제 없음.
- `durationMs()` 헬퍼는 모든 경로에서 `number | null` 을 반환(단일 행 서브쿼리라 `rows[0]` undefined
  불가), TODO/FIXME/HACK 주석 없음, 실패 시나리오(`entityTable`/`entityColumn` 못 찾으면 throw)도 명시적.

## 요약

이번 diff 의 실질 코드 변경은 신설 e2e 파일(`terminal-duration-sql.e2e-spec.ts`) 하나뿐이며, 이는
`TERMINAL_DURATION_MS_SQL` 의 실제 Postgres 동작(단위·부호·경계·클램프)과 그 전제(컬럼명·타입)를
프로덕션 소스와 line-level 로 대조해 검증한 결과 기능적으로 정확하고 완전하다 — TODO/FIXME 없음,
모든 경로 반환값 처리 적절, 에러 시나리오(메타데이터 미발견) 명시적 처리, spec 은 이 구현 세부사항을
정의하지 않아(spec_impact: none) 불일치 없음. 유일한 실질 발견은 코드가 아니라 문서 위생 문제로,
`terminal-duration-sql-safety-net.md` 의 작업 체크리스트가 이미 완료된 4개 항목을 미체크 상태로
남겨 두어 "plan 체크박스 = 실제 상태" 컨벤션과 어긋난다.

## 위험도

LOW
