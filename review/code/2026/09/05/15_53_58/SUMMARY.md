# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 0건. `testing`·`api_contract` 두 에이전트가 잔여 유예 항목(이미 plan 트래커에 등재된 §5.4 drift 스윕 대상)으로 LOW 를 부여했을 뿐, 이번 diff(`origin/main..HEAD`, 실질 코드는 `codebase/` 9개 파일·1,101줄)가 만든 신규 결함은 없다. forced(router_safety) 화이트리스트 7명(`documentation`/`maintainability`/`requirement`/`scope`/`security`/`side_effect`/`testing`) 전원 결과 확보 확인 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `User` 엔티티에 `select: false`/`@Exclude()`/전역 `ClassSerializerInterceptor` 같은 구조적 방어가 없어, 이번에 고친 `audit-logs` 호출 지점 외의 다른 곳에서 `leftJoinAndSelect('...','user')` 를 쓰면 같은 클래스의 자격증명 유출이 재발할 수 있음(이번 diff 가 만든 결함 아님, 사전 존재) | `codebase/backend/src/modules/users/entities/user.entity.ts` 전체 | 후속 항목으로 인증 비밀 컬럼에 `select: false` 도입을 별도 트래킹(이미 이전 라운드 architecture WARNING 으로 지목됨) |
| 2 | requirement | `assertMatchesContract` 는 payload 가 plain object 가 아니면(빈 배열 인덱싱 등) `invalid-payload` 위반으로 던져, 재사용 시 사전 존재/배열 길이 단언을 빠뜨리면 "응답이 비어 있다"는 별개 결함이 "계약 위반"으로 오분류될 수 있음 | `codebase/backend/src/shared/testing/response-contract.ts` `findContractViolations`(비-객체 payload 분기) | JSDoc 에 "먼저 배열/존재를 단언한 뒤 호출할 것" 한 줄 추가(현재 4개 e2e 는 이미 사전 단언 있어 문제 없음) |
| 3 | maintainability | `visit()`/`visitUnion()` 의 "선언에 없는 키를 undeclared 로 보고"하는 루프(각 9줄)가 판정 조건·문구만 다르고 골격이 동일하게 두 번 반복됨 | `response-contract.ts:264-272`, `response-contract.ts:294-302` | 필수 아님. 공용 헬퍼(`reportUndeclaredKeys`)로 통합 가능 |
| 4 | maintainability | `find → toBeDefined → assertMatchesContract` 3문장 패턴이 정확히 2곳에서 반복(이미 plan 등재·3라운드 재확인된 유예 항목) | `workflow-crud.e2e-spec.ts:164-165`, `workflow-execution.e2e-spec.ts:154-155` | 조치 불요 — §5.4 스윕 착수 시 헬퍼로 접을 것(`plan/in-progress/spec-draft-nullable-notation-followups.md` 등재됨) |
| 5 | testing | `descend()` 의 방어 분기(참조된 `$ref` 가 생성 문서 `schemas` 에 없는 경우)가 현재 테스트로 도달 불가(2라운드 전 실측 근거로 이미 유예) | `response-contract.ts:194-204` | 조치 불요 — `contractForDto` 가 여러 문서를 다루게 될 때 재평가 |
| 6 | testing | `workflow-execution.e2e-spec.ts` 의 계약 대조가 "정상 완료" 응답만 검증 — `ExecutionDto` 의 실패/미완료 전용 optional+nullable 10개 필드가 "값이 채워진" 형태로 검증된 적 없음(§5.4 drift 트래커에 이미 위임됨) | `workflow-execution.e2e-spec.ts` (`assertMatchesContract(mine, executionContract)` 호출부) | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` §5.4 drift 배치 2단계에서 처리 예정 |
| 7 | documentation | §5.4 를 실제로 시행하는 유일한 코드 `response-contract.ts` 가 `spec/5-system/2-api-convention.md` frontmatter `code:` glob 에 여전히 미등재 — 이 파일 변경에 SPEC-CONSISTENCY 게이트가 반응하지 않음(4라운드 연속 재확인, developer 권한 밖) | `codebase/backend/src/shared/testing/response-contract.ts`(신규 파일) | 조치 불요(이번 PR 범위 밖) — 다음 planner 턴에서 `code:` glob 등재 |
| 8 | database | `action`/`resource_type`/`user_id` 단독 필터 조합 전용 복합 인덱스가 없음(diff 이전부터 있던 상태, 이번 PR 이 만든 문제 아님) | `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts` | 선택 사항 — 트래픽 프로파일 확인 후 별도 plan 항목으로 검토 |
| 9 | api_contract | `AuditLogDto.user`/`ipAddress` 가 optional+nullable 조합으로 선언돼 §5.4 3형태 밖에 있음(이번 diff 가 만든 것 아닌 기존 drift, `ExecutionDto`/`WorkflowDto` 도 동일 패턴) — 방향은 안전(런타임이 선언보다 엄격)해 결함은 아님 | `AuditLogDto`, `ExecutionDto`, `WorkflowDto` 선언부 | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에서 처리 중 |
| 10 | api_contract | `GET /api/audit-logs` 의 `user` 응답 축소(26키→3키)는 기술적으로 breaking change 이나 CHANGELOG 가 영향 범위·소비자 점검 권고까지 이미 문서화함 | `CHANGELOG.md` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `GET /api/audit-logs` 자격증명 유출(26키→3키) 수정 확인. 파라미터 바인딩·정렬 allowlist 유지, 시크릿 없음. `User` 엔티티 구조적 방어 부재는 사전 존재(INFO#1) |
| requirement | NONE | `AuditLogUserDto`/spec §4.2 와 line-level 일치. "12개+"→"12개" producer 카운트 정정 실측 확인(grep 정확히 12개). §5.4 헬퍼 판정 로직 spec 과 일치 |
| scope | NONE | 핵심 변경 9개 파일·1,101줄로 범위 이탈 없음. `codebase/`·`plan/`·`review/`·`CHANGELOG.md` 밖 파일 변경 0건 |
| side_effect | NONE | 5차 재확인. 전역상태·env·파일시스템·네트워크·공개 시그니처 영향 없음 |
| maintainability | NONE | 이전 CRITICAL 1건·WARNING 3건 모두 해소 재확인. 경미한 중복 2건(INFO#3,#4) |
| testing | LOW | 3개 스펙 파일 직접 실행 75/75 통과 확인. 유예된 INFO 2건(#5,#6)만 잔존 |
| documentation | NONE | 4라운드 연속 정합 확인, 수치(26/23키, 37=12+10+8+7 등) 산술 일치. `code:` glob 미등재(INFO#7) planner 트랙 등재 완료 |
| database | NONE | select 축소는 순정 개선(전송량 감소), N+1·트랜잭션·인덱스·인젝션 결함 없음 |
| api_contract | LOW | 직전 라운드 WARNING(`workspace` 형제 필드 미좁힘)이 `Omit<AuditLog,'user'\|'workspace'>` 로 해소됨을 재확인. breaking change 는 CHANGELOG 문서화 완료 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 중 매칭 0건 — 백엔드 전용 변경 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 INFO(대부분 "확인 완료, 결함 아님" 또는 이미 추적 중인 유예 항목)를 보고했다.

## 권장 조치사항

1. (선택, 후속 트래킹) `User` 엔티티 인증 비밀 컬럼에 TypeORM `select: false` 도입 검토 — 다른 조인 지점에서 동일 클래스 유출 재발 방지(INFO#1).
2. `response-contract.ts` 를 `spec/5-system/2-api-convention.md` frontmatter `code:` glob 에 등재(planner 턴, 이미 plan 등재됨, INFO#7).
3. 기존 plan 트래커(`spec-draft-nullable-notation-followups.md`) 의 §5.4 drift 배치 2단계 스윕 진행 시 INFO#4·#6·#9 를 함께 처리.
4. 나머지 INFO(#2,#3,#5,#8,#10)는 조치 불요 또는 선택 사항 — 블로킹 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(prompt 에 개별 사유 미제공) |
  | architecture | router 판단(prompt 에 개별 사유 미제공) |
  | dependency | router 판단(prompt 에 개별 사유 미제공) |
  | concurrency | router 판단(prompt 에 개별 사유 미제공) |