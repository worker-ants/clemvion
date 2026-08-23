# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(plan 체크리스트 미동기화, 코드 아님)과 문서화 품질 관련 INFO 다수뿐이며, 실질 코드 변경(신규 e2e 테스트 1개)은 7개 reviewer 전원이 기능적으로 정확하다고 확인했다. forced whitelist 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Plan 위생 | 신규 plan 파일의 `## 작업` 체크리스트 4개 항목(`/consistency-check --impl-prep`, e2e 신설, 뮤테이션 검증, 트래커 W10·W7 종결)이 미체크(`[ ]`) 상태인데, 같은 파일 하단 `## 검증 결과` 절과 diff 내 다른 파일들(트래커 `[x]` 전환, `review/consistency/2026/08/23/10_48_33/**` 8개 산출물)이 이미 완료됐음을 증명한다 | `plan/in-progress/terminal-duration-sql-safety-net.md:55-58` | 완료 확인된 4개 항목을 `[x]` 로 갱신 — "plan 체크박스 = 실제 상태" 컨벤션 준수 (`scope.md` 도 동일 사항을 INFO 로 중복 지적) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | int4 클램프의 정확한 컷오프 경계값(`PG_INT4_MAX` ms 부근의 off-by-one/반올림)은 미검증 — 100일 입력으로 "saturate 발동 자체"만 확인 | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:116-120` | 여유 되면 `PG_INT4_MAX` ms 정확히 / `PG_INT4_MAX + 1` ms 두 케이스 추가. 우선순위 낮음 |
| 2 | 유지보수성 | `toPgSql()` 이 동일 `.split(needle)` 연산을 두 번(치환 개수 계산용, 실제 치환용) 독립 수행 | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:57-61` | `const parts = ...split(needle)` 로 한 번만 계산 후 `parts.length - 1` 과 `parts.join('$1')` 양쪽에 재사용 |
| 3 | 유지보수성 | 클램프 테스트 종료 시각(`2026-04-11`, 시작 대비 ≈100일)이 `PG_INT4_MAX`(≈24.8일)를 넉넉히 초과하도록 고른 값인데 그 계산 근거가 주석에 없음 | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:118` | `// ≈100일 — PG_INT4_MAX(≈24.8일)를 넉넉히 초과` 한 줄 주석 추가 |
| 4 | 테스트 설계 | `toPgSql()` 내부의 vacuous-guard(`expect(occurrences).toBeGreaterThan(0)`)가 별도 테스트가 아니라 `durationMs()` 를 호출하는 사실상 모든 `it` 블록마다 반복 실행됨 — 파라미터명 회귀 시 단일 실패가 아니라 파일 내 전체 실패로 신호가 흐려짐 | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:56-62` | `toPgSql()` 자체는 순수 변환만 하고, guard 는 독립된 `it('SQL 에 named 파라미터가 실제로 있다', ...)` 로 분리. 현재도 오탐/누락은 없어 선택 사항 |
| 5 | 테스트 설계 | `durationMs()` 는 `res.rows[0].duration_ms` 를 무가드로 인덱싱하는 반면 같은 파일의 `column()` 은 `res.rows[0] ?? null` 로 방어 — 파일 내 방어 스타일 비대칭. 현재는 리터럴 subquery라 항상 1행 반환이라 실질 위험 없음(`noUncheckedIndexedAccess` 미설정이라 타입 레벨에서도 안 잡힘) | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:81-89`(durationMs) vs `:131-138`(column) | 낮은 비용이면 `res.rows[0]` 존재를 한 번 assert 해 스타일 통일. 차단 사유 아님 |
| 6 | 문서화 | `TERMINAL_DURATION_MS_SQL` verbatim 결속 메모가 W10 항목에만 있고, 아직 미해결인 "duration_ms 필드 분리" 항목에는 이 e2e 로의 역참조가 없음(편도 참조) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (W10 blockquote vs "duration_ms 에 대기 시간이 섞임" 절) | 필드 분리 plan 착수 시 해당 문서에 "이 e2e 가 SQL 을 verbatim 고정하므로 형태 변경 시 함께 갱신" 한 줄 추가. 동일 사항이 이미 consistency 리포트 권장 조치 4번에 등재돼 이번 PR 비차단 |
| 7 | Spec fidelity (결함 아님) | spec 은 `durationMs` 필드 자체만 정의하고 이를 계산하는 SQL 이나 e2e 검증 요구는 없음(`spec_impact: none` 과 일치) — spec 결함도 spec-코드 불일치도 아님, 참고용 기록 | `spec/5-system/14-external-interaction-api.md` §6 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 은 전부 파라미터 바인딩·ORM 메타데이터 유도값, 인젝션/시크릿/인가 이슈 없음 |
| requirement | LOW | 기능적으로 정확·완전(TODO 없음, 에러 처리 명시적, spec 불일치 없음). plan 체크리스트 미동기화 WARNING 1건 |
| scope | NONE | 전 파일 신규 추가 또는 타겟 패치, 무관한 변경 없음. plan 체크리스트 미동기화 INFO로 중복 지적 |
| side_effect | NONE | 프로덕션 코드 미변경, 신규 e2e 는 read-only 쿼리만 실행, 전역 상태/환경변수/네트워크 변경 없음 |
| maintainability | LOW | 함수 짧고 단일 책임, JSDoc 충실. 사소한 중복 계산·매직값 설명 부족 INFO 3건 |
| testing | LOW | mock 회피 정당화됨, 테스트 격리 우수, 뮤테이션 실측으로 판별력 자체 검증. INFO 3건(경계값 미검증 등) |
| documentation | NONE | 소스 대조 검증한 서술 전부 정확, e2e 카운트 수치 일치. 편도 상호참조 INFO 1건 |

## 발견 없는 에이전트

security, side_effect — 발견사항 0건(NONE 등급)

## 권장 조치사항
1. `plan/in-progress/terminal-duration-sql-safety-net.md:55-58` 의 완료된 4개 작업 체크박스를 `[x]` 로 갱신 (WARNING, plan 위생)
2. (선택) `toPgSql()` 의 중복 `.split()` 호출을 1회로 통합, vacuous-guard 를 독립 `it` 으로 분리해 실패 지점 명확화
3. (선택) 클램프 테스트에 정확한 `PG_INT4_MAX` 경계값 케이스 추가 및 종료 시각 산정 근거 주석 추가
4. (선택) "duration_ms 필드 분리" plan 항목에 이 e2e 로의 역참조 추가 — 필드 분리 착수 시점에 처리

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (reviewer · 이유, 7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 실행된 전원이 forced whitelist 로 강제 포함됨. forced 전원 결과 확보됨, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(신규 read-only e2e + 문서) 와 무관 |
  | architecture | 아키텍처 변경 없음(신규 테스트 파일 1개뿐) |
  | dependency | 신규 의존성 추가 없음 |
  | database | 스키마/마이그레이션 변경 없음(테스트가 기존 스키마를 읽기만 함) |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | 공개 API/계약 변경 없음 |
  | user_guide_sync | 사용자 대상 문서 영향 없음(내부 e2e 테스트) |