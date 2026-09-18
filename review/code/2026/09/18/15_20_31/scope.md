# 변경 범위(Scope) 리뷰 — 그래프 RAG 삭제 연쇄 FK 인덱스 넷 (V117~V120)

## 검토 방법

`review/code/2026/09/18/15_20_31/_prompts/scope.md` 에 실린 30개 파일에 더해, 페이로드에서
잘렸거나 아예 누락된 항목은 `Read`/`git diff origin/main` 으로 직접 대조했다:

- `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 전체 파일 (프롬프트 페이로드는 "크기 제한으로 실리지 않음"으로 표시)
- `git diff origin/main --stat` 전수 — 페이로드의 30개 파일 목록에 **없던** 2개 파일도 확인:
  `plan/complete/spec-draft-deletion-cascade-indexes.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`

## 발견사항

- **[INFO]** 리뷰 페이로드(`scope.md`)가 실제 PR diff(`git diff origin/main`, 32개 파일)의 2개 파일을 빠뜨렸다
  - 위치: `plan/complete/spec-draft-deletion-cascade-indexes.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` (둘 다 `_prompts/scope.md` 에 항목 없음)
  - 상세: `git diff origin/main --stat` 은 32개 파일을 보여주지만 `scope.md` 는 30개만 나열한다. 두 파일을 직접 열어 대조한 결과, 내용은 이 PR 이 닫은 트래커 항목(«선두 인덱스가 없는 FK … 32개 → 28개 남음», 부록 표의 4행에 `✅ V117`~`V120` 표기)을 반영하는 **의도된 트래커 갱신**이었고 plan 문서 자신의 `## 트래커 반영` 절이 명시적으로 예고한 작업이라 범위 위반은 아니다. 다만 이 항목들이 리뷰 페이로드 생성 과정에서 빠진 것은 harness 쪽 커버리지 갭이며, 다른 병렬 리뷰어(예: consistency/spec 관점)가 이 두 파일을 아예 못 볼 수 있다.
  - 제안: scope 자체는 문제 없음(조치 불요). 다만 리뷰 오케스트레이션이 `git diff origin/main` 전체 파일 집합과 `scope.md` 나열 집합을 대조하는 sanity check 을 두면 이런 누락을 잡을 수 있다.

- **[INFO]** 마이그레이션 4쌍(`V117`~`V120`)의 SQL 헤더 주석이 서로 대부분 동일한 5~6개 문단(실측 배경·비-트랜잭션 이유·DROP-먼저 근거)을 그대로 복제한다
  - 위치: `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.sql:1-23`, `V118__relation_evidence_chunk_id_index.sql:1-23`, `V119__relation_head_entity_id_index.sql:1-22`, `V120__relation_tail_entity_id_index.sql:1-22`
  - 상세: 직전 PR(V112~V116, commit `6dbac1f53`)도 같은 패턴(마이그레이션 파일마다 반복 헤더)을 썼다 — 이 저장소의 확립된 컨벤션이며, 이번 PR 이 새로 도입한 스타일이 아니다. 범위 이탈이 아니라 선례를 따른 것으로 판단.
  - 제안: 조치 불요 (선례 일치).

## 스코프 정합성 점검 결과 (요청 항목별)

1. **의도 이상의 변경**: 없음. `git diff origin/main --stat` 32개 파일 전부가 "그래프 RAG 삭제 연쇄 FK 인덱스 넷" 작업 하나로 수렴한다 — 신규 마이그레이션 4쌍(.conf+.sql), 기존 e2e 스펙 확장(V112~V116 선례에 4건 추가), 이 작업의 plan draft, 이 작업이 유발한 consistency-check 세션 2회(`--spec`, `--impl-prep`) 산출물, spec 3개 문서(계획서 `spec_impact` 목록과 정확히 일치), 그리고 이 PR 이 닫은 트래커 항목의 상태 갱신 2건. 애플리케이션 서비스 코드·프론트엔드·무관 설정 파일 변경은 0건.
2. **불필요한 리팩토링**: 없음. e2e 스펙 파일은 기존 `EXPECTED` 배열에 4개 항목을 추가하고 헤더 주석·describe 제목의 범위 표기(`V112~V116` → `V112~V120`)만 넓혔을 뿐, 기존 로직·구조는 그대로다.
3. **기능 확장(over-engineering)**: 없음. 추가된 인덱스 4개는 plan 문서가 실측으로 근거를 댄 FK 컬럼(`entity.last_seen_chunk_id`, `relation.evidence_chunk_id`, `relation.head_entity_id`, `relation.tail_entity_id`) 각각과 1:1 대응하며, 그 이상의 인덱스나 스키마 변경은 없다.
4. **무관한 파일·영역 수정**: 없음(위 INFO 1건 제외 — 그마저도 동일 작업 범위 내 트래커 bookkeeping).
5. **포맷팅 변경**: 실질 변경과 섞인 순수 포맷팅 diff 없음. `spec/1-data-model.md`·`spec/5-system/10-graph-rag.md`·`spec/data-flow/6-knowledge-base.md` 의 diff 라인은 전부 새 인덱스 정보를 추가하는 실질 변경이다.
6. **주석 변경**: 마이그레이션 파일의 긴 헤더 주석은 선례(V111~V116) 컨벤션을 그대로 따른 것으로, 불필요한 추가가 아니라 실측·근거를 기록하는 이 저장소의 정착된 관행이다.
7. **임포트 변경**: 없음. e2e 스펙 파일의 `import` 구문은 변경 전과 동일.
8. **설정 변경**: `.conf` 4개(`executeInTransaction=false`)는 `CREATE/DROP INDEX CONCURRENTLY` 가 트랜잭션 블록 안에서 실행 불가하기 때문에 필요한, 선례와 동일한 의도된 설정이다.

## 요약

이 PR 은 그래프 RAG 삭제 연쇄의 FK 인덱스 넷(V117~V120)을 추가하는 단일 작업에 정확히 수렴한다. 신규 마이그레이션 4쌍, 기존 e2e 스펙의 정합 확장, plan draft, 의무화된 consistency-check 세션 2회 산출물, `spec_impact` 로 선언된 spec 문서 3개, 그리고 이 작업이 닫은 트래커 항목의 상태 갱신까지 — 전부 "무엇을, 왜, 어떻게 닫았는가"의 한 서사 안에 있고 애플리케이션 로직·무관 파일 변경은 전혀 없다. 유일한 특이사항은 리뷰 페이로드가 실제 diff 32개 파일 중 2개(트래커 갱신 파일)를 누락한 것인데, 직접 대조한 결과 그 2개도 plan 문서가 스스로 예고한 범위 내 작업이라 스코프 위반은 아니다.

## 위험도

NONE
