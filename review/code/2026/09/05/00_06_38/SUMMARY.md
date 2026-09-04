# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(모두 spec/코드 주석의 "출처 인용" 정확성 문제이며 동작·보안 결함 아님). forced 화이트리스트 8명 전원 결과 확보(누락 없음).

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `spec/1-data-model.md` `## Rationale` 신설 항목의 출처 인용 `#1284`가 이 변경과 무관한(이미 병합된) 다른 PR 번호. 실제 항목은 `#1277`에서 처음 등재됨(`git log`/`merge-base`로 확인) | `spec/1-data-model.md:977` | `#1284`를 실제 출처(`#1277`, 필요시 후속 갱신 `#1278`/`#1280`도 병기)로 정정. `spec/` 수정이므로 project-planner 트랙 |
| 2 | documentation | 리뷰 세션 ID(`23_02_51`/`23_26_09`/`23_47_43`) 인용이 마이그레이션 SQL뿐 아니라 e2e·unit 테스트 주석까지 3개 파일 6곳으로 확산. 직전 라운드가 "완화 권고"를 낸 직후의 fix 커밋조차 같은 패턴을 새로 추가해 권고를 스스로 어김 | `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:32,53`, `codebase/backend/test/schedule-trigger.e2e-spec.ts:344,392,405`, `codebase/backend/src/modules/schedules/schedules.service.spec.ts:140` | `spec/conventions/` 또는 `migrations/README.md`에 "코드/테스트 주석의 리뷰 근거 인용은 PR 번호/커밋 SHA 사용"을 성문화하거나, 의도적 채택이면 그 결정을 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/database/side_effect | `CREATE INDEX CONCURRENTLY` 실패 후 재실행 시 invalid 인덱스 잔존 위험은 DROP-먼저(DROP→CREATE→DROP) 패턴으로 이미 해소·재현 검증됨. 다만 이 패턴이 "이미 성공한 마이그레이션의 수동 재실행 시 살아있는 인덱스를 재빌드"하는 비대칭을 새로 만듦(문서화된 의식적 트레이드오프, 정상 Flyway 배포에서는 미발동) | `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:53-65` | 조치 불요. 규약화 후속은 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이미 등재 |
| 2 | security | 인젝션 표면 없음 — 마이그레이션은 정적 DDL, 목록 쿼리는 기존 DTO 정규식/화이트리스트(`sort`/`order`) 경로 재사용 | `codebase/backend/migrations/V110__*.sql:60-65`, `schedules.service.ts` `resolveOrderBy` | 없음 |
| 3 | security | 하드코딩 시크릿 없음 — plan 문서의 `POSTGRES_PASSWORD=probe`는 로컬 일회용 더미 | `plan/complete/spec-draft-schedule-index.md:191` | 없음 |
| 4 | security | 워크스페이스 인가 경계 변경 없음 — 신규 e2e가 타 워크스페이스 조회 시 빈 배열을 직접 단언해 경계 유지를 실증 | `codebase/backend/test/schedule-trigger.e2e-spec.ts` `J.` 테스트 | 없음 |
| 5 | requirement | 인덱스명·정렬 화이트리스트·spec 미러(`1-data-model.md`/`10-triggers.md`)·e2e/unit 검증이 line-level로 전부 일치 | `V110__*.sql:60-65`, `schedules.service.ts:80-124`, spec 두 문서 | 없음 |
| 6 | requirement | TODO/FIXME/HACK 흔적 없음, 모든 분기 반환값 존재 | `git diff` 전체 grep 0건 | 없음 |
| 7 | scope | `(trigger_id)` spec 표 행 추가는 V106(기존 적용분) 문서화 공백을 메우는 드라이브바이 — 3라운드 연속 동일 지적·저위험 유지 | `spec/1-data-model.md:915` | 조치 불요 |
| 8 | scope/documentation | 마이그레이션 헤더가 저장소 리뷰-세션 ID를 인용 — 영구 코드 주석에 일시적 프로세스 식별자가 새어 들어간 경계선 사례(→ 위 WARNING #2로 격상 확인) | `V110__*.sql:32,53` | WARNING #2 조치로 해결 |
| 9 | side_effect | 신규 e2e `J.` 테스트가 생성한 스케줄/워크스페이스에 명시적 cleanup 없음 — 파일 전체 기존 관례(A.~I.)와 동일, `make e2e-down`으로 초기화 | `schedule-trigger.e2e-spec.ts` `J.` | 조치 불요 |
| 10 | maintainability | 신규 e2e `J.` 테스트가 73줄로 파일 내 최장(2.4배), "정렬"과 "격리" 두 독립 관심사를 한 테스트에 담아 실패 원인 진단이 느림 | `schedule-trigger.e2e-spec.ts:347-419` | 강제 아님. 향후 리팩터링 시 `J. 정렬`/`K. 격리` 분리 고려 |
| 11 | maintainability | asc/desc 3단 체인 추출 반복은 "나란히 비교"가 테스트 요점이라는 이전 라운드의 의도적 미조치 결정이 유지됨 | `schedule-trigger.e2e-spec.ts:373-376,385-388` | 조치 불요 |
| 12 | testing | 신규 unit 테스트를 `resolveOrderBy` 뮤테이션(`next_run_at`→`last_run_at`)으로 직접 검증 — RED 확인 후 원복, vacuous 아님을 실증 | `schedules.service.spec.ts:142-147` | 없음 (검증 완료) |
| 13 | testing | `resolveOrderBy`의 `last_run_at` 축은 이 PR 이전부터 어떤 테스트에도 없음(이번 PR이 만든 갭 아님) | `schedules.service.ts` `resolveOrderBy` | 이 PR 범위 밖. 향후 해당 함수 리팩터링 시 함께 채울 것 |
| 14 | testing | `CREATE INDEX CONCURRENTLY` 중단→재실행 복구는 3라운드 내내 일회성 수동 재현만 있고 자동화 CI 회귀 테스트는 없음 | `V110__*.sql:32-58` | defer 유지(DBA 시나리오, 비용 대비 실익 낮음). 후속 항목에 자동화 헬퍼 스크립트화 고려 가능 |
| 15 | database | partial→full 인덱스 전환으로 쓰기 경로(INSERT/UPDATE) 유지비용 증가는 크기 추정(+2.6MB)만 있고 별도 처리량 벤치마크 없음 | `V110__*.sql:26-27` | 배포 차단 사유 아님. 운영 스케일에서 `n_tup_upd` 모니터링 권장 |
| 16 | scope | `CONCURRENTLY` 재실행 규약화(V056/V106 대상)는 코드 변경 없이 plan 후속 항목으로만 정당하게 분리·등재 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/인가 우회 없음, 신규 e2e가 격리 경계를 실증 |
| requirement | LOW | spec Rationale 출처 인용 `#1284` 오류(WARNING); 기능 완전성은 line-level 일치 |
| scope | NONE | 스코프 위반 없음. 드라이브바이 2건 모두 이전 라운드부터 저위험 유지 |
| side_effect | LOW | DROP-first 수동 재실행 비대칭(문서화된 트레이드오프), 신규 결함 없음 |
| maintainability | NONE | 유지보수성 결함 없음. e2e 테스트 길이/관심사 혼합은 INFO |
| testing | NONE | 뮤테이션 테스트로 신규 unit이 vacuous 아님을 직접 실증. 잔여는 defer 항목뿐 |
| documentation | LOW | 리뷰 세션 ID 인용이 코드/테스트 주석 3파일 6곳으로 확산(WARNING) |
| database | LOW | 쓰기 경로 비용 미실측(INFO), 신규 DB 결함 없음. invalid 인덱스 위험은 실증 해소 |

## 발견 없는 에이전트

해당 없음 — 8개 에이전트 전원이 최소 INFO 이상의 발견사항을 보고함(Critical은 전원 0건).

## 권장 조치사항

1. `spec/1-data-model.md:977`의 `## Rationale` 출처 인용 `#1284`를 실제 출처 `#1277`(필요시 `#1278`/`#1280` 병기)로 정정한다 — project-planner 트랙, spec 사실 오류 정정.
2. 코드/테스트 주석에 리뷰 세션 ID를 인용하는 관행(현재 3개 파일 6곳)을 `spec/conventions/` 또는 `migrations/README.md`에 성문화하거나, 향후에는 PR 번호/커밋 SHA로 대체한다.
3. (선택) `resolveOrderBy` `last_run_at` 축과 `CREATE INDEX CONCURRENTLY` 중단→재실행 복구의 자동화 회귀 테스트는 이번 PR 범위 밖으로 defer 유지 — 후속 항목 진행 상황만 추적.
4. (선택) 신규 e2e `J.` 테스트를 정렬/격리 두 테스트로 분리하는 것은 강제 아님, 다음 파일 수정 기회에 고려.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database` (8명)
  - **강제 포함(router_safety)**: `database, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명 전원 — forced 전원 결과 확보됨, 누락 없음)
  - **제외**: 6명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — prompt에 개별 사유 미제공 (diff가 DDL 인덱스 교체+테스트뿐이라 성능 영향은 database/side_effect가 실측치로 커버) |
  | architecture | router 판단 — prompt에 개별 사유 미제공 |
  | dependency | router 판단 — prompt에 개별 사유 미제공 (신규 의존성 변경 없음) |
  | concurrency | router 판단 — prompt에 개별 사유 미제공 |
  | api_contract | router 판단 — prompt에 개별 사유 미제공 (wire 계약 불변, DB 인덱스만 교체) |
  | user_guide_sync | router 판단 — prompt에 개별 사유 미제공 (사용자 대면 문서 변경 없음) |
