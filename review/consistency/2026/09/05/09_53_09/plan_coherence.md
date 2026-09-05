# Plan 정합성 검토 — `spec/conventions/migrations.md` · `spec/conventions/review-citations.md`

## 검토 경과

target 델타(2개 spec 파일 + `codebase/backend/migrations/README.md` 54줄)를 `plan/in-progress/spec-draft-nullable-notation-followups.md` 및 그 자식 `plan/complete/spec-draft-migration-rerun-and-citations.md` 와 대조했다. 두 target 변경 모두 이 plan 체인이 명시적으로 추적하던 두 항목의 산출물이었다.

- **`migrations.md` §5 포인터 + README §5 "DROP-먼저" 패턴** ↔ `spec-draft-nullable-notation-followups.md` 체크리스트 "`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험"(2026-09-05 완료 표기) 및 `spec-draft-migration-rerun-and-citations.md` §① 의 실측·결정(1.4)과 문언까지 일치한다.
- **`review-citations.md` 신설** ↔ 같은 plan 의 "코드 주석의 리뷰 세션 ID 인용" 항목(완료 표기) 및 동일 자식 plan §② 의 결정(2.2/2.3)과 일치한다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 인용 규약 결정 경위 재확인용 메모
  - target 위치: `spec/conventions/review-citations.md` 전체(신설), Rationale "왜 PR 번호로 전환하지 않았나"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:449-455` — 원 항목이 "결정이 필요한 것은 (a) 성문화 / (b) PR 번호 전환 중 하나이며, **어느 쪽이든 한 PR 이 단독으로 정할 일이 아니다 — 그래서 등재한다**" 라고 명시적으로 미해결로 남겼던 항목.
  - 상세: 그 유보 문구만 보면 target 이 이번 세션에서 (a) 를 선택해 버린 것이 "미해결 결정 우회" 처럼 보일 수 있다. 그러나 실제 처리 경로는 우회가 아니라 정공법이었다 — 별도 전용 planner 문서(`plan/complete/spec-draft-migration-rerun-and-citations.md`)를 만들어 실측(107개 파일·514회, bare 인용 중 해소 불가 8건 등)과 기각 근거("PR 번호 전환 시 514회가 고아화·PR은 라운드별 입도를 못 담음")를 갖춘 뒤 결정했다. 이는 CLAUDE.md 가 `project-planner` 에 위임한 `spec/conventions/` 쓰기 권한 범위 안의, 근거를 갖춘 결정이라 "일방적 우회" 로 등급을 올릴 근거는 없다.
  - 제안: 조치 불요. 다만 다음에 유사 "한 PR 이 단독으로 정할 일이 아니다" 유보 문구를 해소할 때는 이번처럼 별도 전용 plan 문서(실측+기각 대안 포함)를 남기는 패턴을 계속 따를 것.

## 확인된 정합 사항 (참고)

- **인접 미해결 결정 오염 없음** — 같은 항목군의 "Flyway `mixed=true` 도입 여부"(전역 mixed 가드 해제가 걸린 결정)는 target 이 손대지 않았고, `spec-draft-nullable-notation-followups.md:457-462` 에 여전히 `[ ]` 미해결로 정확히 남아 있다. README §5 diff 본문도 "그 설정은 혼합 금지 가드를 모든 마이그레이션에 대해 풀므로, 도입 여부는 별도 결정 항목입니다" 라고 명시해 이 유보를 재확인한다.
- **후속 항목 보존** — "해소 불가 bare 인용 8건 채우기"(developer, 2026-09-05 등재) 도 target 신설 `review-citations.md` §4("소급 정리 대상 아님")와 모순 없이 별도 후속으로 그대로 남아 있다.
- **선행 조건 충족** — README diff 가 예시로 드는 `V110__schedule_workspace_next_run_index.sql` 은 이미 별도 완료된 `plan/complete/spec-draft-schedule-index.md` 산출물이라 댕글링 참조가 아니다. (a)/(b) 두 완화책(패턴 성문화 + 레거시 파일용 `indisvalid` 수동 확인 절차) 모두 README 본문에 반영돼 원 항목의 두 선택지 모두 소화됐다.
- 다른 in-progress plan(`update-returning-tuple-shape.md` 등)이 언급하는 `migrations.md` 확장 후보(raw SQL RETURNING 결과 규약)는 이미 별도 `spec/conventions/raw-query-results.md` 로 승격 완료되어 있어 target 과 충돌하지 않는다.

## 요약

target 의 두 spec 변경은 즉흥적 결정이 아니라 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 명시적으로 추적하던 두 항목의 예정된 산출물이며, 그 결정 과정(실측·기각 대안·잔여 결정 분리)이 별도 완료 plan 문서에 온전히 기록돼 있다. 인접한 미해결 결정(`mixed=true` 도입, bare 인용 8건 해소)은 손대지 않고 그대로 열어 두었고, target 이 전제하는 선행 작업(V110 인덱스 교체)도 이미 완료 처리된 plan 이 뒷받침한다. Plan 정합성 관점에서 충돌·누락은 발견되지 않았다.

## 위험도

NONE
