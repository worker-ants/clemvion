# Code Review 통합 보고서

## 전체 위험도
**LOW** — 애플리케이션 코드 변경 없는 순수 문서/spec PR(마이그레이션 재실행 안전성 컨벤션 + 리뷰 인용 규약 신설). CRITICAL 없음. WARNING 1건은 `plan/complete/` 산출물의 마크다운 코드펜스 중첩으로 부록 B 전체가 깨져 렌더링되는 구조적 문제(내용 손실은 없음). 강제 화이트리스트(requirement·documentation·database) 3명 전원 결과 확보 확인됨 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 "부록 A" 코드펜스(3-backtick)가 내부 SQL 예제 펜스(역시 3-backtick)와 충돌해 조기 종료됨 — 그 결과 부록 A 후반부 설명이 일반 텍스트로 풀리고, 뒤이은 234줄 펜스가 새 코드블록을 열어 "## 부록 B" 헤더와 `review-citations.md` 전문(238~303줄)을 통째로 `<pre><code>` 블록에 삼켜버림. 텍스트 손실은 없으나 헤더·표·볼드가 전부 날것으로 렌더링됨. `python3 -c "import markdown; ..."` (fenced_code 확장)로 직접 렌더링해 확인. 같은 결함이 `review/consistency/2026/09/05/09_13_39/_target/` 스냅샷에도 있음(consistency-checker 는 마크다운 구문 검사 대상 아님) | `plan/complete/spec-draft-migration-rerun-and-citations.md:199,204,208,234,236,238,303` | 부록 A 바깥 펜스를 4-backtick(` ```` `)으로 올리거나, 내부 SQL 예제를 4-space 들여쓰기 코드블록으로 전환. `plan/complete/` 는 봉인된 산출물이지만 다른 문서 3곳(`spec-draft-nullable-notation-followups.md:402,438,462`)이 여전히 이 문서를 링크로 참조하므로 소급 정정 가치 있음(정정 전 `git log -S` 로 작성 세션 확인 후 plan 관례에 맞게 처리) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement + database (중복 지적) | `codebase/backend/migrations/README.md` §5 가 "`V056`·`V106` 은 0) DROP-먼저가 없어 `V110`과 같은 위험을 갖는다"고 서술하나, 두 파일 실물 대조 결과 위험 발생 경로가 다르다 — `V056`은 실제 CREATE→DROP **교체** 패턴이라 서술이 그대로 적용되지만, `V106`은 짝이 되는 DROP 자체가 없는 **단일 `CREATE INDEX CONCURRENTLY IF NOT EXISTS`**(신규 추가)뿐이라 "옛 인덱스가 지워져 0개가 된다"는 메커니즘이 성립하지 않는다(결과 상태는 유사하게 나쁘지만 원인이 다름 — invalid 인덱스가 방치되는 것이지 삭제되는 게 아님) | `codebase/backend/migrations/README.md:159`, `plan/complete/spec-draft-migration-rerun-and-citations.md` 부록 A 말미 | "재실행 시 0개가 된다(V056형, 진짜 교체)" 와 "재실행해도 invalid 인덱스가 영구히 고쳐지지 않는다(V106형, 짝이 되는 DROP 없음)"로 문구 분리. 처방(`indisvalid` 확인)은 동일해 실무 영향은 낮음 |
| 2 | documentation | 문서 내 교차참조가 "(§3)" 형태(다른 곳은 `§1.2`/`§2.2` 아라비아 넘버링)를 쓰는데, 실제 최상위 섹션 헤딩은 `①·②·③`(circled digit)로 매겨져 있어 표기가 실제 헤딩 문자열과 문자 그대로 매칭되지 않음 | `plan/complete/spec-draft-migration-rerun-and-citations.md:103`(참조) → `:187`(실제 헤딩 "## ③ …") | "(§3)"을 "(③ 이 draft 가 등재하는 후속 참고)"로 바꾸거나 최상위 섹션도 `§1`/`§2`/`§3` 표기로 통일 |
| 3 | documentation | 신설 `spec/conventions/review-citations.md` 는 스코프를 "코드·테스트 주석"(frontmatter `code:` + Overview 문구)으로 명시하는데, 같은 PR 이 `plan/in-progress/spec-draft-nullable-notation-followups.md` 안에는 날짜 없는 bare `hh_mm_ss` 인용을 계속 추가하고 있음. 규약 위반은 아니나(스코프 밖) 의도적 제외인지 논의 밖이었는지 문서에 명시돼 있지 않음 | `spec/conventions/review-citations.md:13` vs `plan/in-progress/spec-draft-nullable-notation-followups.md:401,403,422,439` | 의도적이라면 "`plan/**` 문서 내 인용은 이 규약 대상이 아니다(사유: N)" 한 줄 추가. 아니라면 후속 검토 대상으로 별도 등재 |

**참고(순수 확인, 조치 불요)**: requirement 리뷰어가 문서 주장 수치를 저장소에서 전수 재현(107파일/514회, 전체경로 10파일/15회, bare 499회 등 — 전부 일치) — 이 세션의 문서 신뢰도 근거로만 기록. database 리뷰어는 이번 changeset 에 신규 SQL 마이그레이션이 없어 인덱스/트랜잭션/락 등 실제 DB 런타임 영향이 없음을 확인. 선행 consistency-check(2026-09-05 09:13:39) 가 지적한 WARNING 2건·INFO 다수는 최종본에 이미 전부 반영되어 해소된 상태(requirement·documentation 양쪽에서 개별 확인).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | 실측 수치 전수 재현 일치(INFO), V106 일반화 서술 정밀도(INFO, database 와 중복) |
| documentation | LOW | 부록 A/B 코드펜스 중첩으로 부록 B 렌더링 붕괴(WARNING), 섹션참조 표기 불일치·review-citations 스코프 미명시(INFO) |
| database | NONE | V056/V106 위험 서술 구분 필요(INFO, requirement 와 중복), 신규 SQL 마이그레이션 없음 확인, V110 선례와 3-statement 패턴 정확 일치 확인 |

## 발견 없는 에이전트

없음 (실행된 3개 에이전트 전원이 최소 1건 이상의 INFO/WARNING 을 보고함).

## 권장 조치사항
1. `plan/complete/spec-draft-migration-rerun-and-citations.md` 부록 A 의 코드펜스 중첩을 해소해 부록 B 렌더링을 복구한다(4-backtick 승격 또는 SQL 예제 들여쓰기 전환) — 유일한 WARNING.
2. (선택) `codebase/backend/migrations/README.md:159` 의 "V056·V106 동일 위험" 서술을 실제 패턴 차이(교체 vs 신규추가)로 분리 서술한다.
3. (선택) 문서 내 "(§3)" 교차참조를 실제 헤딩(`③`)과 맞추거나 넘버링 스타일을 통일한다.
4. (선택) `review-citations.md` 의 `plan/**` 스코프 제외가 의도적인지 한 줄로 명시한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement`, `documentation`, `database` (3명)
  - **강제 포함(router_safety)**: `database`, `documentation`, `requirement` — 실행된 3명 전원이 강제 포함 대상이며, 전원 결과 확보 확인됨(누락 없음).
  - **제외**: 11명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | router 판단(이번 diff 가 문서/spec 전용이라 애플리케이션 코드·인증·인가 표면 변경 없음으로 판단된 것으로 추정 — manifest 에 개별 사유 미제공) |
  | performance | 상동 — 런타임 코드 변경 없음 |
  | architecture | 상동 |
  | scope | 상동 |
  | side_effect | 상동 |
  | maintainability | 상동 |
  | testing | 상동 — 신규/변경 테스트 코드 없음 |
  | dependency | 상동 — 의존성 변경 없음 |
  | concurrency | 상동 |
  | api_contract | 상동 — API 계약 변경 없음 |
  | user_guide_sync | 상동 |
