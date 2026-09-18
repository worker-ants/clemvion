# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. `trigger (workflow_id)` 인덱스(V111) + `releaseExternalForParent` select 좁히기는 설계·테스트·문서가 정합적이나, `plan/complete/` 로 아직 이동하지 않은 draft 를 가리키는 forward reference 가 이번 구현 커밋에서 자동 가드가 못 잡는 2곳(SQL 주석·e2e 테스트 주석)으로 늘었고, 정책 SoT(`spec/conventions/migrations.md`)가 README 의 확장된 컨벤션 범위를 아직 반영하지 못하는 WARNING 2건이 있다. **forced(router_safety) 8개 reviewer(database, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨** — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / documentation | `plan/complete/spec-draft-trigger-workflow-index.md` 를 가리키는 forward reference 가 이번 구현 커밋에서 **2곳 더 늘어 총 3곳**이 됨 — 실제 파일은 아직 `plan/in-progress/`에 있어 현재 시점 모두 거짓. `spec-link-integrity.test.ts`는 마크다운 링크만 잡고 backtick 텍스트는 검사하지 않아 자동 가드 사각지대(기존에 이미 확인된 사실) | `spec/1-data-model.md:987`(기존 WARNING, 재확인) / `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:5`(신규) / `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:196`(신규) | plan 이 이미 "이 PR 마지막 커밋에서 draft 를 `plan/complete/`로 이동"을 명시했으므로, 그 이동 커밋 시점에 `grep -rn "plan/complete/spec-draft-trigger-workflow-index" spec/ codebase/` 로 세 참조 전부 유효해졌는지 재확인 필요. `--impl-done` 게이트가 스코프에 포함하나, backtick 참조는 자동 가드가 못 잡으므로 수동 확인이 안전망 |
| 2 | documentation | 정책 SoT `spec/conventions/migrations.md` §5 콜아웃이 이번 PR 이 `codebase/backend/migrations/README.md`에 새로 넓힌 범위("신규 추가에도 0) DROP-먼저 적용")를 반영하지 못함 — "기존 인덱스를 갈아 끼우는 마이그레이션만" README §5 를 따른다고 읽혀, 신규 추가 케이스를 배제하는 것처럼 오독될 수 있음. 이는 이 PR 이 스스로 지적하는 V106 갭(신규 추가에 짝 DROP 미적용→실패 시 인덱스 영구 invalid)을 재생산하는 경로 | `spec/conventions/migrations.md` §5 "새 마이그레이션 추가 절차" 절 말미 콜아웃 | 콜아웃을 "기존 인덱스 교체 또는 신규 인덱스 추가 모두 README §5 의 DROP-먼저(0단계) 패턴을 따른다"로 넓혀 README 범위와 재정합 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `releaseExternalForParent` select 좁히기(`config` 포함)를 실제 chat-channel 트리거 + 워크플로/워크스페이스 삭제 경로로 검증하는 e2e 없음. 유일한 방어는 단위 테스트의 `find` 호출 인자 구조적 대조(mock 은 select 값과 무관하게 전체 객체 반환) | `trigger-deletion-releases-resources.e2e-spec.ts`, `trigger-resource-releaser.service.spec.ts:14-15,96-99` | chat-channel `config` 세팅된 트리거로 부모 삭제 후 provider teardown 관측 가능한 e2e 케이스 추가 검토 (백로그 가능) |
| 2 | side_effect | `select` 축소는 "필요한 필드만 정확히 나열"하는 계약이라, 향후 `releaseExternalMany`/하위 협력자가 새 필드를 읽도록 확장되면 컴파일 오류 없이 조용히 `undefined` 참조 가능. 현재는 주석+뮤테이션 테스트로 방어됨 | `trigger-resource-releaser.service.ts:70-78` | 조치 불요. select 확장 시 이 서비스 select 리스트 동반 확인 관례화 |
| 3 | performance | `releaseExternalMany` 의 chat-channel teardown 이 트리거 수만큼 순차 `await` — 이 diff 밖 기존 코드, plan 트래커에 이미 스코프 밖으로 명시 등재됨(악화 없음) | `trigger-resource-releaser.service.ts:159-164` | 조치 불요(별도 트래커 항목) |
| 4 | performance | 같은 함수의 `Schedule.find`는 select 미적용 — Trigger 패턴과 비대칭이나, 실패 복구 경로(`registerJob`)가 엔티티 전체를 재사용하므로 섣불리 좁히면 위험 | `trigger-resource-releaser.service.ts:154` | 조치 불요, 좁힐 경우 `registerJob` 소비처부터 확인 |
| 5 | scope | `spec/1-data-model.md` §3 표에 이번 스코프 밖의 기존 `notification_health` 부분 인덱스(V061) 행이 같은 편집에서 함께 추가됨 — plan Rationale 에 사유 명시, consistency-check 전원 통과, 은폐 아님 | `spec/1-data-model.md` §3 표 | 현 상태 수용 가능. 향후 유사 상황은 별도 커밋/트래커로 분리 권장 |
| 6 | maintainability | README §5 컨벤션 문장이 개정을 거듭하며 한 문장에 절이 누적됨(예외 대상·근거·앵커 2곳) | `codebase/backend/migrations/README.md:127` | 세 번째 케이스 추가 시 표로 분기 이전 검토 |
| 7 | maintainability | V111 SQL 헤더 주석과 README §5 가 "신규 추가에도 DROP-먼저" 근거를 거의 같은 문장으로 중복 서술 — V110 선례를 따른 의도된 자기완결형 패턴 | `V111__trigger_workflow_id_index.sql:23-30` vs `README.md:177` | 조치 불요(기존 컨벤션) |
| 8 | database / performance | `CREATE INDEX CONCURRENTLY` 는 락은 회피하나 대형 테이블에서 스캔 시간 자체는 길 수 있음 — 설계 본질, 실측 표 문서화됨 | `V111__trigger_workflow_id_index.sql:31-33` | 조치 불요 |
| 9 | database / side_effect | `DROP INDEX CONCURRENTLY IF EXISTS`를 항상 `CREATE` 앞에 두는 패턴은 실패 후 재실행 시 invalid 잔재 점유를 막지만, 이미 성공한 인덱스를 수동 재실행하면 정상 인덱스도 지웠다 재빌드하는 비대칭을 감수 — README/spec Rationale/plan 세 곳에 이미 문서화됨 | `V111__trigger_workflow_id_index.sql:31`, `README.md` §5 | 조치 불요 |
| 10 | security | SQL 마이그레이션·e2e 신규 쿼리 전부 정적 문자열 또는 파라미터 바인딩, 인젝션 표면 없음. `select` 좁히기는 오히려 노출 축소(데이터 최소화). e2e 비밀 시딩은 placeholder 암호문. `.conf`/문서 변경은 민감정보 없음 | 각 파일 전반 | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인가 이슈 없음, select 좁히기는 노출 축소로 긍정적 |
| performance | NONE | 인덱스 설계 실측(Seq Scan 7.52ms→Bitmap 0.04ms) 타당, 스코프 밖 순차 처리는 이미 트래커 등재 |
| requirement | LOW | 핵심 요구사항 line-level 충족, `plan/complete/` forward reference WARNING 1건 |
| scope | LOW | diff 가 plan 목표와 정밀히 일치, notification_health 행 동반 추가는 disclosed |
| side_effect | LOW | 공개 시그니처/네트워크/이벤트 순서 불변, select 축소의 미래 위험은 테스트로 방어됨 |
| maintainability | NONE | 범위 작고 단일 책임, 문서 누적·중복 서술은 INFO 수준 |
| testing | LOW | 단위 테스트 뮤테이션 방어는 견고하나 e2e 커버리지 갭 존재 |
| documentation | LOW | PR 자체 문서화 품질 높음, 정책 SoT drift(WARNING) + forward reference(INFO, requirement 와 중복) |
| database | NONE | 인덱스 설계·마이그레이션 안전성·쿼리 최적화 모두 검증됨 |

## 발견 없는 에이전트

없음 (9개 reviewer 전원 최소 1건 이상 INFO/WARNING 보고, 단 CRITICAL 은 전원 0건).

## 권장 조치사항

1. **(WARNING #2)** `spec/conventions/migrations.md` §5 콜아웃을 README 의 확장된 "신규 추가에도 DROP-먼저" 범위와 일치하도록 갱신 — 정책 SoT drift 를 남기면 다음 신규 인덱스 작성자가 V106 갭을 재생산할 수 있음.
2. **(WARNING #1)** 이 PR 마지막 커밋에서 `plan/in-progress/spec-draft-trigger-workflow-index.md` → `plan/complete/` 이동 시, `grep -rn "plan/complete/spec-draft-trigger-workflow-index" spec/ codebase/` 로 3곳(spec 문서, V111 SQL 주석, e2e 테스트 주석) 참조가 전부 유효해졌는지 수동 재확인.
3. **(INFO #1, 백로그)** chat-channel `config` 를 세팅한 트리거의 워크플로/워크스페이스 삭제 e2e 케이스를 추가해 select 좁히기의 실제 provider teardown 경로를 검증 — 당장 회귀는 아니므로 후속 PR 로도 무방.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: database, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — **전원 결과 확보됨**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단 (워크플로 출력에 개별 사유 미제공) — diff 가 소규모 마이그레이션+서비스 쿼리 축소로 아키텍처 변경 없음에 부합 |
  | dependency | 라우터 판단 (신규 의존성 추가 없음에 부합) |
  | concurrency | 라우터 판단 (동시성 로직 변경 없음에 부합) |
  | api_contract | 라우터 판단 (공개 API 계약 변경 없음에 부합) |
  | user_guide_sync | 라우터 판단 (사용자 가이드 영향 없는 내부 인덱스/쿼리 변경에 부합) |
