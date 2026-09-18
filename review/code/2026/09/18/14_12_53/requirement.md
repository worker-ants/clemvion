# 요구사항(Requirement) 리뷰 — 삭제 연쇄의 FK 인덱스 다섯 (V112~V116)

## 검토 범위

`codebase/backend/migrations/V112~V116` (5쌍 `.sql`/`.conf`), 신규 e2e
`codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`, spec 문서 4개
(`spec/1-data-model.md`, `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md`),
plan draft `plan/in-progress/spec-draft-deletion-cascade-indexes.md`, 그리고 두 차례의
`--spec`/`--impl-prep` consistency-check 산출물(`review/consistency/2026/09/18/{13_44_08,13_55_55}/`).

## 검증 방법

- `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts`,
  `.../integrations/entities/integration-usage-log.entity.ts`,
  `.../llm/entities/llm-usage-log.entity.ts` 를 직접 Read.
- `codebase/backend/migrations/V001__initial_schema.sql`(node_execution.node_id),
  `V008__integration_usage_log_and_metadata.sql`(node_execution_id/workflow_id),
  `V014__llm_usage_logs.sql`(node_execution_id/execution_id) 를 직접 Read 해 FK 방향·NULL 허용
  여부를 각 마이그레이션 헤더 주석의 주장과 대조.
- `python3 scripts/check-migration-versions.py --base origin/main` 실행 — `OK: 116
  migration(s), max V116` 확인.
- `python3 scripts/check-backend-typecheck-ratchet.py` 실행 — `197건/36파일, baseline 과 일치`
  확인 (plan 체크리스트의 수치 주장과 일치).
- `npx tsc --noEmit -p tsconfig.json` — 신규 e2e 파일 관련 오류 0건(기존 unrelated
  carousel/chart/table spec 오류만 존재, 이 PR 과 무관, baseline 에 포함됨).
- `npx eslint test/deletion-cascade-indexes.e2e-spec.ts` — 오류 0건.
- `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts`,
  `schedule-trigger.e2e-spec.ts` 의 기존 `pg_index`/`pg_get_indexdef` 패턴과 신규 e2e 를 대조.
- 리뷰 중 저장소에 어떤 파일도 쓰거나 고치지 않았다. 종료 시 `git status --short` 로 확인:
  세션 시작 시점과 동일하게 `plan/in-progress/spec-draft-deletion-cascade-indexes.md`(M, 이 PR
  자신의 체크리스트 갱신)와 `review/code/2026/09/18/14_12_53/`(신규 세션 디렉터리)만 남아 있음 — 잔여
  뮤테이션 없음.

## 발견사항

- **[INFO]** plan 체크리스트의 "e2e backend 327(직전 322 + 새 파일 다섯)" 수치는 이 세션에서
  docker e2e 인프라를 띄우지 않아 직접 재현 검증하지 못했다.
  - 위치: `plan/in-progress/spec-draft-deletion-cascade-indexes.md` `## 체크리스트` (working tree
    unstaged 변경분, `git diff` 로 확인한 새 항목)
  - 상세: 신규 e2e 파일이 `test/jest-e2e.json` 의 `testRegex: ".e2e-spec.ts$"` 에 자동으로 걸리는
    것은 정적으로 확인했고(파일 15/17/26/28 등 이미 독립 checker 들이 실물 pg18 컨테이너로 인덱스
    유효성·정의를 직접 검증함), typecheck ratchet 수치(backend 197)는 이 세션에서 직접 재실행해
    일치를 확인했다. 다만 e2e 카운트 자체는 이 세션에서 재현하지 않았다 — 코드 결함 의심은 아니고
    (`.each` 5건 추가는 산술적으로 타당), 절차적 재확인 필요성만 기록한다.
  - 제안: 조치 불필요 — `/ai-review`·`--impl-done` 게이트가 실제 CI e2e 실행으로 재검증한다.

## 항목별 평가

1. **기능 완전성**: V112~V116 다섯 인덱스 각각 파일당 `CREATE INDEX CONCURRENTLY` 1개 + 선행
   `DROP INDEX CONCURRENTLY IF EXISTS`(invalid 잔재 정리) + `.conf executeInTransaction=false` 3종
   세트를 모두 갖췄다. 완전 구현.
2. **엣지 케이스**: `llm_usage_log` 의 두 컬럼(`node_execution_id`, `execution_id`)은 실제로
   nullable(`V014__llm_usage_logs.sql`: `UUID REFERENCES ... ON DELETE SET NULL`, `NOT NULL` 아님)이라
   `WHERE ... IS NOT NULL` partial 조건이 정확하다. 반대로 `node_execution.node_id`,
   `integration_usage_log.{node_execution_id,workflow_id}` 는 실제로 `NOT NULL`(V001/V008 확인)이라
   non-partial 로 둔 것도 정확 — nullable/NOT NULL 경계 처리가 실제 스키마와 100% 일치한다.
3. **TODO/FIXME**: 신규 `.sql`/`.conf`/`.ts` grep 0건.
4. **의도와 구현 간 괴리**: 각 마이그레이션 헤더 주석이 주장하는 FK 이름·방향(`ON DELETE
   CASCADE`/`SET NULL`)이 실제 마이그레이션 정의와 정확히 일치. e2e docstring 이 주장하는
   "`indisvalid` 까지 본다"·"선두 컬럼과 부분 조건까지 대조" 도 실제 `EXPECTED` 정규식 5개 모두에서
   구현대로 반영됨.
5. **에러 시나리오**: `CREATE INDEX CONCURRENTLY` 실패 시 invalid 잔재가 이름을 점유해 재실행이
   막히는 문제를, `migrations/README.md` §5 "신규 추가에도 0) 을 둡니다"(V111 선례) 패턴을 그대로
   재사용해 다섯 파일 모두 해결. 선례 문구까지 실물 대조(`V111__trigger_workflow_id_index.sql`)해
   정확히 일치함을 확인.
6. **데이터 유효성**: 해당 없음(스키마 마이그레이션, 입력 검증 대상 아님) — n/a.
7. **비즈니스 로직**: "실행 이력 보존 정리는 없다"(`node_execution` 은 캔버스 노드 삭제·워크플로
   삭제 두 경로로만 지워진다) 주장을 `integration-expiry-scanner.service.ts`(90일 배치 대상은
   `integration_usage_log` 뿐) 코드와 대조해 일치 확인. 캔버스 저장의 노드 삭제 경로
   (`workflows.service.ts:1068 manager.remove(Node, nodesToDelete)`)도 실물 확인.
8. **반환값**: n/a(마이그레이션/DDL, 반환값 개념 없음). e2e 는 각 `it.each` 케이스마다
   `toHaveLength(1)`·`indisvalid`·`indexdef` 세 단언 모두 값 있는 경로만 존재 — 인덱스가 없거나
   invalid 인 경우 해당 단언에서 실패하므로 조용한 통과 경로가 없다.
9. **spec fidelity**: `spec/1-data-model.md` §3 인덱스 표 5행 + §2.10.1·§2.24 "인덱스" 문구 + 신규
   `## Rationale` 절, `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md` sink 표 3곳을
   plan draft `S1~S4` 지시와 line-level 로 대조 — 삽입 위치(앵커 문자열)·마이그레이션 번호·인덱스
   정의·FK 방향 문구 전부 정확히 일치. 특히 초기 `--spec` 라운드(13:44:08)에서 cross_spec/
   rationale_continuity 두 checker 가 독립적으로 지적한 WARNING("로그 테이블 두 곳의 쓰기 비용이
   추론이며 선행 Rationale 이 요구한 '따로 잰다' 실측을 충족 못 함")이, 현재 버전의
   `plan/in-progress/spec-draft-deletion-cascade-indexes.md` `## 실측 > 쓰기 비용` 및
   `spec/1-data-model.md` 신규 Rationale 절 양쪽에서 `integration_usage_log`/`llm_usage_log` 실측
   표(10만 행 INSERT ×5, median 수치)로 대체되어 **해소된 상태**로 반영돼 있음을 확인했다 —
   재-flag 하지 않는다.

## 요약

FK 방향(CASCADE/SET NULL)·NULL 허용 여부·leading column·기존 인덱스와의 비적합성(예:
`(execution_id, node_id, started_at DESC)` 는 선두가 달라 이 FK 조회에 쓰이지 않음) 등 마이그레이션
헤더 주석의 모든 사실 주장을 실제 엔티티·기존 마이그레이션 파일과 직접 대조했고 전부 일치했다.
V112~V116 다섯 파일은 README §5 "신규 추가" 컨벤션(DROP-먼저+CONCURRENTLY, `.conf`
`executeInTransaction=false`)을 V111 선례와 문자 그대로 동일하게 재사용하며, 마이그레이션 버전은
gap·충돌 없이 단조 증가(`check-migration-versions.py` 로 재확인)한다. 신규 e2e 는 존재만이 아니라
`indisvalid`·인덱스 정의(선두 컬럼·partial 조건)까지 검증해 "invalid 인덱스가 조용히 통과"하는
경로를 막으며, 기존 e2e(`trigger-deletion-releases-resources.e2e-spec.ts` 등)와 동일한 검증
패턴을 정확히 재사용한다. spec 4개 문서의 변경분은 plan draft 의 S1~S4 지시와 line-level 로
완전히 일치하고, 두 차례의 독립 consistency-check(BLOCK: NO, Critical 0)에서 지적된 유일한
실질 WARNING(쓰기 비용 실측 누락)도 이후 커밋에서 실제 측정치로 해소된 것을 spec 본문에서
직접 확인했다. TODO/FIXME, 미완성 경로, 반환값 누락, 에러 시나리오 미정의는 발견되지 않았다.
유일한 기록 사항은 e2e 통과 건수(327) 자체를 이 세션에서 인프라를 띄워 재현하지 못했다는
절차적 INFO 뿐이며 코드 결함으로 보지 않는다.

## 위험도

NONE
