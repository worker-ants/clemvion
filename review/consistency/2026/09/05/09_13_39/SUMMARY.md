# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 없음 (LOW/LOW/LOW/LOW/NONE). WARNING 2건, INFO 다수.

## 전체 위험도
**LOW** — target(`spec-draft-migration-rerun-and-citations.md`)은 순수 프로세스 규약 2건(마이그레이션 CONCURRENTLY 재실행 패턴, 리뷰 산출물 인용 형식)을 다루며 데이터 모델·API 계약·요구사항 ID·RBAC 충돌 없음. 실행 가능한 WARNING 2건과 문서 완성도 관련 INFO 다수만 발견.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 부록 A(§5-1)가 README §5 "CREATE INDEX CONCURRENTLY 정확히 한 개만" 규정 바로 뒤에 DROP 2회+CREATE 1회(총 3-statement) 패턴을 §5 본문 수정 없이 덧붙임. 문자 그대로는 위반 아니나(§5는 CREATE 개수만 제한) 규정 취지와 거리가 있어 의도된 예외라면 스코프 조정 문구 필요 | 부록 A `### 5-1.` (README.md §5 뒤 삽입 예정), 1.5 "변경안 (A)" | `codebase/backend/migrations/README.md` §5 "executeInTransaction=false 파일은 한 statement 만" | 1.5 실행 시 §5 규정 문장 자체에 "CREATE는 한 개, 인덱스 교체 시 짝을 이루는 DROP은 예외 허용" 각주 추가. 최소한 부록 A 서두에 "본 패턴은 §5 CREATE 단일 제한과 배치되지 않는다" 한 줄 추가 |
| 2 | plan_coherence | 출처 plan(`spec-draft-nullable-notation-followups.md`)의 미체크 항목 2건(CONCURRENTLY 재실행 위험, 코드 주석 리뷰 세션 ID 인용)을 target이 실질적으로 결정했으나, 원본 체크박스를 닫는 절차가 target에 없음. 같은 plan 파일에서 이미 3회 확립된 "자식 draft로 위임 후 원본 체크박스 포인터 클로징" 패턴이 이번만 누락 | 문서 상단 인용문, §① 1.4 결정, §② 2.2 결정 | `plan/in-progress/spec-draft-nullable-notation-followups.md` line 400, 434 (미체크 항목 2건) + 그 plan의 `## 종결 조건`("후속 체크박스 전부 닫힘") | target 반영 커밋에 출처 plan의 두 체크박스를 `[x]` + "반영 완료 (`spec-draft-migration-rerun-and-citations.md` ①/②)" 포인터로 닫는 단계 명시적으로 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity | README.md 안에서 같은 현상(transactional statement + CONCURRENTLY 혼재 거부)의 원인을 기존 §5("PostgreSQL 자체 제약")와 신설 부록 A("Flyway mixed 판정")가 인접 섹션에서 다르게 서술 | README.md §5 vs 부록 A(§5-1) | 부록 A 삽입 시 §5 "PostgreSQL 자체 제약" 문구를 "Flyway의 mixed 판정(Postgres 자체 제약도 별도 존재하나 여기서 걸리는 것은 Flyway 가드)"로 정정해 원인 레이어 통일 |
| 2 | rationale_continuity | README §5 제목("한 statement 만")과 부록 A(§5-1) 3-statement 패턴이 표면적으로 상충돼 보임(§1 WARNING과 같은 근원, rationale 관점에서는 "이미 승인된 선례(V110)의 성문화"로 판정, 위반 아님) | 부록 A `### 5-1.` | (선택적) §5 본문에 "한 개는 CREATE 개수를 말하며 DROP-CREATE-DROP은 §5-1 예외로 허용" 명시 |
| 3 | convention_compliance, naming_collision | 부록 A의 서브섹션 번호(`5-1.`, 하이픈)가 README.md 기존 정수-only 넘버링(`### 1.`~`### 6.`)과도, `migrations.md`의 점 표기(`### 6.1`)와도 다른 세 번째 스타일을 도입 | 부록 A 첫 줄 `### 5-1.` | README.md 서두에 "N-1은 N의 하위 패턴" 규칙 명시 또는 §6 이하 재번호. `migrations.md`에서 인용 시 "README.md §5-1"(하이픈) 형태로 파일명 동반 표기해 `migrations.md` 자체 "§6.1" 표기와 혼동 방지 |
| 4 | convention_compliance | 변경안 (B)(`migrations.md`에서 README §5-1로 포인터 추가)는 정확한 삽입 문구 없이 의도만 서술 — 부록 A·B 대비 검토 깊이 비대칭 | 1.6 "변경안 (B)" | 구현 단계에서 `migrations.md`에 삽입할 정확한 문구를 plan에 남기거나 예시를 부록에 추가 |
| 5 | plan_coherence | 리뷰 인용 통계가 같은 날(`started: 2026-09-05`) 두 plan 문서에서 다른 수치로 인용(target §2.1: 107개 파일·514회 vs 출처 plan: 104개 파일·508회) | target §2.1 표 vs `spec-draft-nullable-notation-followups.md` line 437-439 | target §2.1에 측정 시각(세션 경로) 명시해 출처 plan보다 나중 값임을 밝히거나, 출처 plan 수치를 target 값으로 갱신 |
| 6 | plan_coherence | §3 "이 draft가 등재하는 후속" 두 항목(mixed=true 도입 여부, bare 인용 8건 해소)이 체크박스 형식이 아닌 산문 — `complete/` 이동 전 자가점검 시 누락 위험 | §③ "이 draft가 등재하는 후속" | 두 항목을 `- [ ]` 체크박스 형식으로 전환하거나 별도 `## 후속` 섹션 신설 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | README §5/부록 A 인접 서술의 원인 레이어 불일치(INFO) 외 충돌 없음 |
| rationale_continuity | LOW | 기각 대안 재도입·근거 없는 결정 번복 없음. §5 제목/부록 A 표현상 모호함만(INFO) |
| convention_compliance | LOW | §5 "CREATE 한 개" 규정과 부록 A 3-statement 패턴 정합성 미명시(WARNING) + 넘버링·상세도 INFO 2건 |
| plan_coherence | LOW | 출처 plan 체크박스 미동기화(WARNING) + 수치 불일치·체크박스 형식 미비 INFO 2건 |
| naming_collision | NONE | 신규 식별자(파일 경로·frontmatter id·코드 참조) 전수 대조 결과 충돌 없음. 넘버링 스타일 공존만 INFO |

## 권장 조치사항
1. (WARNING #1 해소) 부록 A 삽입 시 README §5 규정 문구에 "CREATE 한 개 제한 / 교체 시 DROP 예외 허용" 스코프 조정 문구 함께 추가
2. (WARNING #2 해소) target 반영 커밋에서 `spec-draft-nullable-notation-followups.md`의 미체크 항목 2건(line 400, 434)을 `[x]` + 포인터로 닫기
3. (INFO #1) README §5 vs 부록 A의 "PostgreSQL 자체 제약" vs "Flyway mixed 판정" 원인 서술 통일
4. (INFO #3) 부록 A 서브섹션 번호 표기 시 파일명 동반("README.md §5-1")으로 `migrations.md` §6.1과 혼동 방지
5. (INFO #5) §2.1 리뷰 인용 수치의 측정 시각 명시 또는 출처 plan과 값 동기화
