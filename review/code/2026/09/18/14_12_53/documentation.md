# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[INFO]** 신규 마이그레이션 SQL 헤더 5개가 아직 존재하지 않는 `plan/complete/...` 경로를 인용
  - 위치: `codebase/backend/migrations/V112__node_execution_node_id_index.sql:4`,
    `V113__integration_usage_log_node_execution_id_index.sql:4`,
    `V114__integration_usage_log_workflow_id_index.sql:4`,
    `V115__llm_usage_log_node_execution_id_index.sql:4`,
    `V116__llm_usage_log_execution_id_index.sql:4`
    (각 파일 헤더 "실측·전수·쓰기 비용: `plan/complete/spec-draft-deletion-cascade-indexes.md`" 줄)
  - 상세: 이 시점(리뷰 대상 diff)에서 해당 plan 문서는 `plan/complete/`가 아니라
    `plan/in-progress/spec-draft-deletion-cascade-indexes.md`에 있다(`plan/complete/spec-draft-deletion-cascade-indexes.md`는
    워킹트리에 존재하지 않음, 직접 확인함). 다만 이 plan 문서 자체의 체크리스트가 "이동은 이 PR 의 마지막 커밋"이라고
    명시하고 있고, 직전 선례(V111, 커밋 `4dfa4ea94`)도 동일하게 `plan/complete/spec-draft-trigger-workflow-index.md`를
    미리 인용한 뒤 같은 PR 라인에서 실제로 옮겨졌다 — 이 저장소에서 이미 확립된 관례다. 따라서 결함이라기보다는,
    PR의 마지막 "트래커 반영 · draft `complete/` 이동" 커밋이 어떤 이유로든 누락되면 다섯 마이그레이션 파일(append-only,
    수정 불가)에 영구히 깨진 인용이 남는다는 점만 짚어 둔다.
  - 제안: 조치 불필요(선례와 동일 패턴, plan 체크리스트에 이미 추적됨). 다만 PR 마무리 시 "트래커 반영 · draft
    `complete/` 이동" 체크박스를 반드시 마지막 커밋에서 완료해 인용을 참으로 만들 것.

- **[INFO]** (재확인, 조치 불요) `migrations/README.md` §2의 `-- DOWN:` 예시가 CONCURRENTLY 전용 한 줄 변형을 보여주지 않음
  - 위치: `codebase/backend/migrations/README.md` §2 (이번 diff 대상 파일 아님 — 기존 문서)
  - 상세: 이번 PR의 V112~V116 다섯 파일 모두 `-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS <이름>;`
    형태를 정확히 선례(V111 등)대로 쓰고 있어 이번 PR 자체의 결함은 아니다. 이미 `review/consistency/2026/09/18/13_55_55/SUMMARY.md`
    INFO#4에서 독립적으로 지적·기록됐고 비차단으로 분류돼 있다 — 중복 조치 불요, 시야 확보 차원에서만 재언급.

- **[INFO]** (재확인, 조치 불요) 신규 e2e 파일이 선례와 다른 배치 패턴을 씀
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (신규 전용 파일)
  - 상세: 선례 V111은 "기존 리소스별 삭제 e2e 파일에 단언을 얹는" 패턴이었는데, 이번 PR은 5개 인덱스를 검증하는
    전용 파일을 새로 만들었다. 이름 충돌은 없고(`review/consistency/2026/09/18/13_55_55/naming_collision.md` INFO#5가 이미 확인),
    3개 테이블에 걸친 인덱스를 한 파일에 모으는 편이 오히려 자연스러워 이 PR에서 바꿀 필요는 없다. 다음에 유사한
    인덱스 전용 e2e를 또 추가할 때 두 패턴 중 하나로 수렴할지만 향후 판단 대상.

## 확인된 양호 사항 (참고)

- 5개 SQL 마이그레이션 헤더 모두 spec 앵커(`spec/1-data-model.md §3` · `## Rationale`)·plan 근거 경로·FK 트리거 비용 메커니즘·
  800k 규모 실측치·부분 인덱스 채택 이유·비-트랜잭션 사유·invalid 잔재 정리(DROP-먼저) 근거·수동 롤백 절차까지 갖춘
  상세한 인라인 문서를 갖고 있고, 다섯 파일 간 실측 수치(예: V115 "1,296.9 ms → 0.80 ms — 다섯 중 가장 컸다")가
  `spec/1-data-model.md` 새 Rationale 절·`plan/in-progress/spec-draft-deletion-cascade-indexes.md`의 표와 교차 대조해
  전부 일치함을 확인했다.
- 각 `.conf` 파일 주석이 대응 `.sql` 파일명을 정확히 가리키며 5쌍 모두 self-consistent 하다.
- 신규 e2e 스펙(`deletion-cascade-indexes.e2e-spec.ts`)의 파일 상단 JSDoc이 "왜 `indisvalid`까지 보는지"(존재만 보는 단언은
  실패한 `CREATE INDEX CONCURRENTLY`의 invalid 잔재를 초록으로 통과시킨다)를 명시적으로 설명해 단순 존재 확인보다
  방어 범위가 넓다는 근거를 남기고 있다.
- `spec/1-data-model.md`의 새 Rationale 절(`### 삭제 연쇄의 FK 인덱스 다섯`)은 바로 아래 있는 기존
  `### Trigger (workflow_id) 인덱스` 절의 "같은 클래스 전수" 문장을 고치지 않고 "그 범위에서는 참"이라고 명시하면서
  자신이 그 범위를 넓힌 사실만 추가했다 — 기존 서술을 소급 수정하지 않는 관례를 정확히 따른다.
- `spec/1-data-model.md`(§3 표 3곳 + §2.10.1/§2.24 본문 인덱스 줄) · `spec/data-flow/3-execution.md` · `spec/data-flow/5-integration.md` ·
  `spec/data-flow/7-llm-usage.md` 네 spec 문서 갱신이 plan draft의 `spec_impact` 목록과 정확히 일치하고, 각 삽입 위치가
  실제 diff와 대조해 서로 어긋나지 않는다.
- `migrations/README.md` §5의 "신규 추가에도 0) 을 둡니다" 인용 문구를 실제 README 원문과 대조해 정확함을 확인했다
  (오인용 아님).
- 이번 PR은 순수 DB 성능(인덱스 추가)이며 애플리케이션 동작 변경이 없다("애플리케이션 코드 변경 없음", plan 명시) —
  직전 선례 V111(커밋 `4dfa4ea94`)도 동일하게 순수 인덱스 추가로 `CHANGELOG.md` 항목을 남기지 않았다. 이번 PR도
  `CHANGELOG.md` 미갱신이 일관된 관례이며 결함이 아니다. `migrations/README.md`(운영 절차서)도 이미 성문화된
  기존 패턴을 그대로 따르므로 갱신이 불필요하다.
- `plan/in-progress/cafe24-backlog-residual.md`에 추가된 절(카탈로그 문서 위생 셋)은 이번 PR 범위 밖에서 우연히 발견된
  항목을 프로젝트 관례("아직 머지 안 된 PR 의 문서도 SoT 아님 · 미룬 항목은 그 턴에 plan/ 에 적는다")대로 올바르게
  별도 트래커에 등재했다 — 이번 PR의 범위를 흐리지 않으면서 유실 위험도 없앤 처리다.

## 요약

이번 변경(V112~V116 FK 인덱스 마이그레이션 + e2e 검증 + spec 4개 문서 갱신)은 문서화 관점에서 전반적으로 모범적이다.
SQL 마이그레이션 헤더 각각이 spec·plan·실측치·설계 근거를 상세히 인라인 주석으로 남기고, spec 문서 갱신이 plan의
`spec_impact` 선언 및 실제 삽입 위치와 정확히 대응하며, 기존 인접 Rationale 절을 소급 수정하지 않고 범위 차이만
명시적으로 이어 붙이는 등 이 저장소의 문서 규약을 충실히 따른다. 유일하게 짚을 만한 점은 다섯 마이그레이션
헤더가 아직 `plan/in-progress/`에 있는 문서를 `plan/complete/` 경로로 선인용한다는 것인데, 이는 V111 선례와
동일한 확립된 패턴이고 PR 체크리스트에도 마지막 커밋에서 이동하도록 명시돼 있어 결함이라기보다 "마지막 커밋을
빠뜨리면 위험해지는 지점"으로 기록해 둔다. README `-- DOWN` 예시 갭과 e2e 배치 패턴 이원화는 이미 두 차례의
`--spec`/`--impl-prep` consistency 세션이 독립적으로 짚어 비차단 처리한 사안으로, 추가 조치는 불요하다.
CHANGELOG 미갱신도 순수 성능 개선(애플리케이션 동작 변경 없음)이라는 점에서 직전 선례와 일관된 정상 처리다.

## 위험도

LOW
