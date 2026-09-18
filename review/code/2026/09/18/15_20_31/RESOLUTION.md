# RESOLUTION — review/code/2026/09/18/15_20_31

리뷰 대상: `95c6f26b5` (V117~V120 + e2e 네 건) + planner 커밋 `dfd4fd783` (spec 세 문서). Critical 0 · Warning 2 · INFO 9.

정지 규칙(1라운드 결과를 보기 전 `plan/in-progress/spec-draft-graph-fk-indexes.md` 체크리스트에 선언): Critical 0 이고 남은 Warning 이
동작 결함이 아니면 `codebase/**` 를 고치지 않고 판정·등재로 닫는다. 두 Warning 모두 plan 상태에 관한 것이라 **`codebase/**` 수정 0 인 라운드**로 종결한다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
|---|------|------|------|
| W1 | `plan/complete/spec-draft-graph-fk-indexes.md` 선인용 6곳(마이그레이션 헤더 4 · e2e 머리말 · spec Rationale)이 리뷰 시점엔 없는 경로 | 의도된 선인용 — draft 를 이 PR 의 마지막 커밋에서 `plan/complete/` 로 옮기고 `grep -rln "plan/complete/spec-draft-graph-fk-indexes.md" spec codebase plan` 로 인용 전부가 실재 경로를 가리키는지 확인한다(`--impl-prep` WARNING 1 과 같은 처분, plan 체크리스트 마지막 항목). 리뷰어가 «다른 세션이 트래커를 동시에 갱신 중» 이라 본 두 파일(`plan/complete/spec-draft-deletion-cascade-indexes.md` 부록 «처분» 칸 · 트래커)은 **이 세션이 리뷰 도중 적용한 트래커 반영분**이다 — 같은 grep 대상에 포함된다 | 마무리 커밋 |
| W2 | 리뷰 시점에 plan 의 `lint · unit · build · e2e` 체크박스가 `[ ]` | TEST WORKFLOW 는 리뷰와 **병렬로** 돌았고 전부 PASS 했다: lint PASS · unit PASS · build PASS · e2e PASS (331, `deletion-cascade-indexes.e2e-spec.ts` PASS — `it.each` 아홉 중 하나라도 실패하면 스위트가 FAIL). 체크박스는 통과 직후 `[x]` 로 갱신했다. 코드는 리뷰 대상 커밋 `95c6f26b5` 그대로다 | 리뷰-only 커밋 |
| INFO 1 | scope 페이로드가 트래커 두 파일을 누락 | W1 과 같은 원인 — `--prepare`(15:20:31) 뒤에 이 세션이 트래커를 갱신했다. 둘 다 plan draft «트래커 반영» 절이 예고한 범위 | 조치 불요 |
| INFO 2~9 | 쓰기·저장 비용 정당화 · skip scan 소명 · 헤더 반복(README §5 의도) · 성능 회귀 자동 테스트 부재(V112~V116 선례와 같은 설계) · `.conf` 역방향 가드 부재 · `@Index` 미추가(선례 동일) · 배포 후 `pg_stat_user_indexes` 관찰 · CONCURRENTLY 빌드 시간 | 전부 리뷰어 판정 «조치 불요» 에 동의 | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260918-151523.log`)
- unit: 통과 (`_test_logs/unit-20260918-151617.log`)
- build: 통과 (`_test_logs/build-20260918-151741.log`)
- e2e: 통과 (331, `_test_logs/e2e-20260918-152022.log`)
