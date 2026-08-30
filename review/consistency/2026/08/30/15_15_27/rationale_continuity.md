# Rationale 연속성 검토 결과

## 검토 범위

- 검토 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`
- 실제 diff 는 spec 파일을 전혀 건드리지 않는다. 변경은 전부 backend 테스트 인프라 + 1개 helper 파일:
  - `codebase/backend/src/common/__test-utils__/source-scan.ts` / `.spec.ts` — `countRawUpdateReturning`/`hasRawUpdateReturning` 신설 (raw `UPDATE`/`DELETE … RETURNING` 발견형 스캐너)
  - `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 손큐레이션 3파일 목록 가드에 더해 `src/**` 전수 발견 + 부분 커버리지(개수 비교) 가드 추가
  - `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` / `.spec.ts` — raw `UPDATE … RETURNING` 쿼리의 타입 인자를 `{...}[]` → `[{...}[], number]` 튜플로 정정 (mock 도 동일하게 정정)
- Rationale 비교 대상: 번들에 포함된 `spec/data-flow/*.md` 전체 Rationale + 발췌된 `spec/5-system/4-execution-engine.md`, `8-embedding-pipeline.md`, `10-graph-rag.md`, `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/{1-workflow-list,2-trigger-list}.md` 의 Rationale.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 가드 설계 결정("왜 래퍼(DataSource/EntityManager 타입 경계)로 가지 않았나")이 spec Rationale 이 아니라 테스트 파일 docstring 에만 존재
  - target 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 신규 블록 (diff L722-728, "## 왜 래퍼(타입 경계)로 가지 않았나")
  - 과거 결정 출처: 해당 없음 — 이 결정은 이번 diff 에서 처음 등장하며, 번들된 어떤 spec Rationale 에도 "raw UPDATE 반환 unwrap 강제"에 관한 선행 결정이 없다(검색 결과 `updateReturningRows`/`DataSource`/`EntityManager`/`래퍼` 키워드가 diff 밖에서 전혀 등장하지 않음).
  - 상세: 기각 대상이 되는 과거 Rationale 항목이 없으므로 "번복"이 아니라 신규 결정이다. 다만 CLAUDE.md 정보 저장 규약상 "결정의 배경·근거"는 spec 문서 말단 `## Rationale` 이 SoT 인데, 이 결정은 코드 테스트 파일에만 적혀 있어 다음 사람이 spec 을 훑을 때 이 근거를 못 찾을 수 있다. 단, 이 결정은 도메인/제품 결정이 아니라 내부 테스트 하네스 설계라 `spec/conventions/` 대상 여부도 애매하다.
  - 제안: 조치 불요(Rationale 연속성 위반 아님). 필요하면 추후 `spec/conventions/spec-impl-evidence.md` 류 conventions 문서에 "발견형 vs 큐레이션형 가드" 원칙으로 승격을 고려할 수 있음 — 이번 라운드의 필수 조치는 아님.

## 정합성 확인 (참고, 위반 아님)

- 이번 diff 가 강화하는 "raw `UPDATE ... RETURNING` 은 `[rows, affectedCount]` 튜플이며 소비 시 unwrap 이 필요하다"는 사실은 번들된 여러 Rationale 항목이 이미 못박아 둔 것과 **일치**한다 — 예: `spec/data-flow/2-auth.md` §2.2/§3.3 및 Rationale "OAuth state 의 one-shot DELETE"(원자적 `DELETE ... RETURNING`), `spec/5-system/4-execution-engine.md` Rationale "재개 race 보장을 DB 원자 claim으로"·"TOCTOU 원자화"(조건부 `UPDATE ... RETURNING`), `spec/5-system/8-embedding-pipeline.md` Rationale "V024 reembed_status"(`UPDATE ... WHERE reembed_status='idle' RETURNING id`). 즉 이 PR 은 새 원칙을 도입한 게 아니라 이미 합의된 원자적 conditional UPDATE/DELETE ... RETURNING 패턴의 **타입 정확성을 사후에 강제**하는 하드닝이다.
- `kb-stats.helper.ts` 관련 기존 Rationale(`spec/5-system/8-embedding-pipeline.md` §"결정: spec 정합성 정비" — `kb:graph_stats_updated` WS 이벤트가 dead path 라는 서술)은 이번 diff 의 타입 수정과 무관한 별개 사실이며 diff 로 인해 그 서술이 무효화되지도 않는다.
- diff 내 주석이 "정규식 스캐너를 SQL 파서로 바꾸지 않는다"고 명시한 스코프 제한(CTE 미탐지·변수담긴 SQL 미탐지 등을 의도적 한계로 고정)은 이 저장소의 기존 관행(유한한 문제를 무한한 문제로 바꾸지 않는다)과 결이 같아 원칙 위반이 아니다.

## 요약

이번 diff 는 `spec/data-flow/` 를 포함해 어떤 spec 문서도 수정하지 않는 순수 backend 테스트 인프라 하드닝(raw `UPDATE/DELETE … RETURNING` 발견형 가드 신설 + `kb-stats.helper.ts` 타입 정정)이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다. 오히려 이 변경은 `spec/data-flow/2-auth.md`·`spec/5-system/4-execution-engine.md`·`spec/5-system/8-embedding-pipeline.md` 등에 이미 기록된 "원자적 conditional UPDATE/DELETE … RETURNING" 패턴의 타입 정확성을 코드 레벨에서 뒷받침하는 방향으로, 기존 Rationale 과 정합적이다. 유일한 관찰 사항은 "래퍼 대신 발견형 가드를 택한" 신규 결정이 spec Rationale 이 아니라 테스트 파일 docstring 에만 남아 있다는 점이나, 이는 도메인 결정이 아닌 내부 테스트 하네스 설계이므로 위반으로 분류하지 않는다.

## 위험도

NONE
