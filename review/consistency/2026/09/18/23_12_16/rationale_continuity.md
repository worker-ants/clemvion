# Rationale 연속성 검토 — FK 인덱스 열 (V121~V130)

## 검토 범위 및 방법

scope 는 `spec/conventions/` 이나 해당 영역 델타는 0개다. 실제 판단 대상은 이 PR 이 구현한
`codebase/backend/migrations/V121__*.sql` ~ `V130__*.sql`(+ `.conf`) 열 개와, 그 근거인
`spec/1-data-model.md` 의 `## Rationale`(이미 커밋된 `4dfc5787b`)이 과거 같은 문서·인접 문서의
Rationale 과 충돌 없이 이어지는지다. `spec/conventions/migrations.md` 를 워크트리에서 직접
읽고, `spec/1-data-model.md` 의 관련 Rationale 네 절(«쓸 인덱스가 없는 FK 서른하나의 처분»·
«그래프 RAG 삭제 연쇄의 FK 인덱스 넷»·«삭제 연쇄의 FK 인덱스 다섯»·«Trigger `(workflow_id)`
인덱스», 모두 2026-09-18/2026-09-17 계열)와 `spec/data-flow/10-triggers.md`(Webhook
`endpoint_path` UNIQUE 범위 절)를 대조했다. V121·V122·V129·V130 네 마이그레이션 파일을
워크트리에서 직접 Read 해 헤더 주석의 근거 인용과 수치가 spec Rationale 과 일치하는지도 확인했다.

## 발견사항

발견된 CRITICAL·WARNING 없음.

- **[INFO]** 이전 절의 오류(«37개» 셈)를 되쓰지 않고 범위를 좁혀 정정한 방식은 이 저장소의
  일반 관례(§2 `select: false` 표 각주, WorkflowVersion.snapshot 정정)와 같은 결로 일관적이다
  - target 위치: `spec/1-data-model.md` `## Rationale` «쓸 인덱스가 없는 FK 서른하나의 처분» 「셈법 보정」 문단
  - 과거 결정 출처: 같은 문서 `## Rationale` «삭제 연쇄의 FK 인덱스 다섯» 절의 "단일 컬럼 FK 87개 중 그런 것이 37개"
  - 상세: 「셈법 보정」 문단은 옛 «37개» 를 삭제·치환하지 않고, "그 절이 부분 인덱스를 「있음」으로 셌다" 는 방법론 차이를 설명한 뒤 보정치 40개를 옆에 병기했다. 옛 문장 자체는 그대로 남아 "그 방법(`pg_index.indkey[0]` 대조)으로는 37" 이라는 좁은 의미에서 여전히 참으로 읽힌다 — 침묵 번복이 아니라 방법론 각주를 단 정정이다. 같은 패턴이 «Trigger `(workflow_id)` 인덱스» 절 말미 "그 여섯의 처분" 문단에도 있다 — V127·V128 로 이후 실제 처분된 두 항목을 원 문장 옆에 추가해 "이 문단은 V111 시점 결정 범위에서 그대로 참이다" 라고 스코프를 명시했다.
  - 제안: 없음 (기록용). 향후 유사 정정 시 이 두 사례를 선례로 인용 가능.

- **[INFO]** `alert_rule.workflow_id` 비대상 결정의 재검증 — 규모가 바뀌어도 재확인 후 유지
  - target 위치: `spec/1-data-model.md` `## Rationale` «삭제 연쇄의 FK 인덱스 다섯» 절 말미
  - 과거 결정 출처: 같은 절의 "그중 선두 인덱스가 없는 `alert_rule.workflow_id`·`edge.target_node_id` 는 작은 테이블이라 넣지 않았다"(원 실측: 워크플로 약 1만 행 규모)
  - 상세: 이번 PR 은 워크플로 10만 규모로 재측정해 `edge.target_node_id` 는 결론이 바뀌어 V121 로 승격했지만, `alert_rule.workflow_id` 는 그 규모에서도 1.3 ms 로 재확인하고 비대상을 유지했다. 옛 결론을 그대로 상속하지 않고 규모를 바꿔 실측으로 재검증한 뒤 유지한 것으로, "유예 근거는 실측해야 한다" 원칙에 부합한다.
  - 제안: 없음 (기록용).

## 검토했으나 문제 없음으로 판정한 항목

- **부모가 `user` 인 FK 13개를 인덱스 대상에서 제외한 근거**("사용자 삭제는 지금 스키마가 받아 주지 않는 동작") — `spec/2-navigation/9-user-profile.md` 등 사용자-대면 spec 에 계정 삭제/탈퇴 기능이 명시돼 있는지 grep 했으나 해당 앱 자체의 `User` 삭제 경로는 발견되지 않았다(매치된 것은 전부 Cafe24 외부 API 카탈로그의 `customer_delete` 로 무관). 이 문서가 세운 "user 삭제 경로 없음" 전제와 스펙 전반이 충돌하지 않는다.
- **`select: false` 채택/기각 표와의 관계** — 이번 diff 는 `select`/`select: false` 를 다루지 않아 해당 Rationale(2026-09-06)과 직접 상호작용하지 않는다. 재도입 없음.
- **Schedule 인덱스 절(2026-09-04)이 세운 "선두는 술어 컬럼" 원칙** — V130 `model_config (workspace_id, kind)` 은 두 컬럼 모두 목록 조회의 등치 술어이고 선두가 FK 조회가 쓰는 `workspace_id` 다. 원칙과 정합하며 위반 없음. 같은 절이 "부분 조건만 제거" · "단순 DROP" 을 기각했던 대안들도 이번 V121~V130 에서 재도입되지 않았다(오히려 nullable 컬럼마다 partial index 를 유지하는 기존 관례(V115~V118)를 그대로 계승 — V122 등 헤더 주석에 명시).
- **`migrations.md` §5 의 `CREATE INDEX CONCURRENTLY` 패턴(DROP 선행 필수, `IF NOT EXISTS` 만으로는 불충분 — V056·V106 실패 선례)** — V121·V122·V129·V130 모두 `DROP INDEX CONCURRENTLY IF EXISTS` 를 `CREATE` 앞에 두고 헤더 주석에서 그 선례를 직접 인용한다. 합의된 규약을 우회하지 않는다.
- **Webhook `endpoint_path` 조회 인덱스를 이번에 넣지 않고 트래커로 넘긴 것** — `data-flow/10-triggers.md` Rationale "Webhook `endpoint_path` 의 UNIQUE 범위" 절은 라우팅 키가 `(workspace_id, endpoint_path)` UNIQUE 와 별도로 `endpoint_path` 단독이라는 기존 설계를 그대로 두고, 이번 FK 처분 절은 "유일성 범위 결정이 걸려" 있다고만 언급하며 그 결정 자체를 건드리지 않았다. 기존 설계를 뒤집거나 재해석하지 않았다.

## 요약

이번 diff(V121~V130 인덱스 열 + 그 근거인 `spec/1-data-model.md` Rationale)는 과거 절들이 세운
계산 공식("자식 테이블 크기 × 연쇄로 지워지는 부모 행 수")과 처분 범주(가~바)를 그대로 재사용하고,
규모가 커져 결론이 바뀐 항목(`edge.target_node_id`)은 재실측으로, 결론이 유지된 항목
(`alert_rule.workflow_id`)도 재실측으로 검증했다. 이전 절의 셈 오류(37→40)는 삭제·치환이 아니라
범위를 명시한 정정 문단으로 처리해 과거 서술을 침묵 번복하지 않았고, 관련 인접 Rationale
(Schedule 인덱스의 "선두는 술어 컬럼" 원칙, `migrations.md` §5 의 CONCURRENTLY DROP-선행 패턴,
Webhook `endpoint_path` UNIQUE 범위 결정)과도 충돌이 없다. 기각된 대안의 무단 재도입, 합의 원칙
위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
