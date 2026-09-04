# Code Review 통합 보고서

## 전체 위험도
**LOW** — `AlertRuleDto.threshold` OpenAPI 타입 오기(`number`→`string`) 정정 + 재발 방지 AST 가드 + e2e 계약 테스트로 구성된 changeset. 9개 reviewer(전원 forced whitelist, 결과 전원 확보) 전체에서 CRITICAL 없음, WARNING 1건(코드 결함 아님 — 리뷰 프롬프트 페이로드가 직후 커밋 1개만큼 stale, 스코프 판정 자체는 불변으로 재검증됨), 나머지는 전부 INFO 수준 관찰·개선 제안. 5라운드 누적 리뷰를 거치며 실질 갭은 이미 수렴된 상태.

**forced whitelist 이행 상태**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7개 전원 결과 확보(`forced 전원 결과 확보됨` — 프롬프트 명시). 라우팅에서 제외된 `performance, architecture, dependency, database, concurrency` 5개는 router 판단이며 강제 목록에 없어 누락이 아님. 즉 이번 라운드는 화이트리스트 미이행 없이 판정 가능.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | 이 라운드(`21_25_50`)의 프롬프트 페이로드가 실제 HEAD보다 1커밋 stale — `meta.json`(21:25:50) 생성 직후(약 78초 뒤) `0ac45dfad`(review/plan 전용, `codebase/**` 무변경)가 커밋됨. `git diff`/`git show` 직접 대조 결과 동일 서사의 산출물 커밋 + planner 트랙 항목 1건 추가일 뿐이라 스코프 판정 자체는 불변 — 코드 결함 아님 | `review/code/2026/09/04/21_25_50/meta.json` vs `git log`(`0ac45dfad`, 21:27:08) | 조치 불요(코드 결함 아님). 다음 라운드 오케스트레이터가 프롬프트 생성-커밋 사이 경합 윈도우를 인지하도록 참고만 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract/security/side_effect/documentation | `AlertRuleDto.threshold: number → string` 은 실제 wire(TypeORM `numeric(12,4)` → 문자열 반환)에 OpenAPI 선언을 맞춘 순수 문서 정정. `ClassSerializerInterceptor` 부재로 저장소 내부 런타임 동작 불변, 프런트엔드 유일 소비자는 이미 `threshold: string` 으로 분리돼 있었음. codegen 클라이언트에는 관측 가능한 breaking change이며 CHANGELOG 에 영향 고지 포함 | `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`, `CHANGELOG.md` | 조치 불요 |
| 2 | testing | 신규 e2e(`alerts-threshold-wire-type.e2e-spec.ts`)의 `threshold` 예시 값이 전부 소수부 없는 정수(`10`, `15`)라 `numeric(12,4)` 스케일 포맷팅(정밀도 보존)을 직접 검증하지 못함 — 정수 입력만으로는 손실 변환(`Math.round`/`parseInt`)이 끼어들어도 GREEN 일 수 있음 | `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` | POST/PATCH 페이로드 중 하나를 `12.3456` 류 비-정수 값으로 바꾸고 GET 응답 단언에 반영 (새 `it` 추가보다 기존 케이스 값 교체 권장) |
| 3 | maintainability | `swagger-dto-contract.spec.ts` 의 두 `it.each` 블록(정규식 위음성 4형태, 포지셔널 `@Column` 인자 위음성 2형태)이 콜백 본문까지 완전히 동일 — 서로 다른 리뷰 라운드 근거를 설명하는 JSDoc 때문에 별도로 남아 있음 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:392-452` | 데이터 배열을 6개 케이스로 통합하고 두 근거(20_16_17/20_39_25) 인용을 한 문단으로 병합 — 우선순위 낮음(기존 INFO 급 유지) |
| 4 | side_effect | `review/code/2026/09/04/21_10_30/RESOLUTION.md` 의 TEST 결과 표에서 build·e2e 두 행이 "(실행 중 — 완료 후 실측 기입)" placeholder 로 커밋됨(lint·unit 만 실측). `review/**` 는 SoT 아니라는 관례가 있음에도 이 문서만 보면 build/e2e 도 PASS 확인된 것으로 오인될 여지 | `review/code/2026/09/04/21_10_30/RESOLUTION.md:42-43` | 후속 커밋에서 실측치로 채우거나 최소한 "미실측" 명시. 이번 changeset의 code 부작용 등급에는 미반영(문서 완결성 사안) |
| 5 | requirement | 리뷰 시점(`ps aux` 확인) `make e2e-test-full` 이 백그라운드에서 진행 중이었고, 당시 로그(`_test_logs/e2e-20260904-212820.log`, 534줄)에 `Tests:`/`Test Suites:` 요약이 없어 신규 e2e 파일(`alerts-threshold-wire-type.e2e-spec.ts`) 자체의 PASS 여부를 그 시점 로그만으로는 판정 못함. `jest-e2e.json` `testRegex` 매치로 자동 수집은 구조적으로 확인됨(설정 누락 아님) | `_test_logs/e2e-20260904-212820.log` | 조치 불요 — 관측 사실 보고. 완주 후 최신 `_test_logs/e2e-*.log` 에서 `alerts-threshold-wire-type` grep 하여 PASS 확정 권장 |
| 6 | requirement/scope | `spec/1-data-model.md:873` 의 `threshold \| Float` 라벨이 실제(`NUMERIC(12,4)`, wire `string`)와 불일치 — diff 범위 밖, 4개 라운드 연속 재확인된 기존 이슈이며 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙으로 이미 정확히 등재됨(중복 아님) | `spec/1-data-model.md:873` | 조치 불요(developer 권한 밖) — planner 트랙에서 처리 |
| 7 | scope | `spec/conventions/swagger.md` numeric 불변식 성문화 미완료 — consistency-check(20_05_42) 권고를 developer 가 직접 spec 수정 대신 planner 트랙 항목으로만 등재. CLAUDE.md 스코프 경계(`spec/` 는 project-planner 전용) 정확히 준수, "자기-반증형 소정정" 예외 요건 불해당도 올바르게 판단 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 스코프 준수 모범 사례로 참고 |
| 8 | security | 하드코딩 시크릿/자격증명 없음(`password|secret|token|api[_-]?key` grep 전수), repo-guard 정적 분석 코드는 dev-only 로 저장소 내부 TS 소스만 읽어 사용자 입력/런타임 요청 경로와 무관, 신규 e2e 는 매 실행 고유 계정 생성 + 표준 인증 헤더 사용 | 전체 diff | 조치 불요 |
| 9 | 다수(carry-over) | 4개 선행 라운드(19_43_18~21_10_30)가 지적한 WARNING(정규식 위음성, 경로 미정규화, `<Entity>Dto` 명명 한계, `readOption` 무방비 분기, plan 재부모화, JSDoc 노출, codegen 고지 누락 등)이 전부 소스 대조로 실제 해소 확인됨. `collectNumericFields`/`collectDtoFieldTypes` 의 `extends`/`PickType`/`OmitType` 미대응은 기결정(실사례 0건, 조치 불요) 상태 유지 | `swagger-dto-contract-guard.ts`, `.spec.ts`, `alert-rule-response.dto.ts` 등 | 조치 불요(기결정 유지) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 시크릿 없음, dev-only 가드, e2e 인증 적절 — 실질 코드 변경은 순수 문서 정합화(SQL 인젝션 등 벡터 없음) |
| requirement | LOW | e2e 백그라운드 실행 중이라 리뷰 시점 완주 미확인(관측, 구조적 결함 아님) + spec Float 라벨 불일치(기존 planner 트랙 등재) |
| scope | NONE | 실질 6파일 전부 단일 서사(threshold 정정+가드) 결속, spec/ 미침범. WARNING 은 프롬프트 페이로드 stale(경합 윈도우, 코드 결함 아님) |
| side_effect | LOW | 실질 변경 전부 additive/읽기전용, 내부 런타임 영향 없음. RESOLUTION.md build/e2e placeholder 미기입(문서 완결성) |
| maintainability | LOW | 4라운드 WARNING 전부 해소 재확인. `it.each` 중복 블록 병합 제안(경미) |
| testing | LOW | 회귀 가드 33/33 GREEN, e2e CI 수집 확인. e2e 예시값이 정수뿐이라 정밀도 보존 검증 약함(제안 있음) |
| documentation | NONE | 4라운드 문서화 WARNING 전부 소스 레벨 조치 재확인, 신규 결함 없음 |
| api_contract | LOW | wire 불변, codegen 영향 CHANGELOG 고지, 읽기/쓰기 비대칭은 범위 밖 기존 설계 |
| user_guide_sync | NONE | 매트릭스 20행 중 1건 매칭(백엔드 API 변경) — swagger jsdoc target 은 같은 changeset 내 충족, user-guide 페이지 target 은 대상 문서 자체 부재 |

## 발견 없는 에이전트

- **documentation** — "새로 발견된 문서화 결함 없음" 명시적 결론.
- **user_guide_sync** — "발견된 동반 갱신 누락 없음" 명시적 결론.

## 권장 조치사항

1. (선택, 낮은 우선순위) `alerts-threshold-wire-type.e2e-spec.ts` 의 `threshold` 예시값 중 하나를 `12.3456` 류 비-정수로 교체해 `numeric(12,4)` 정밀도 보존을 직접 검증한다 (testing #2).
2. (선택, 낮은 우선순위) `swagger-dto-contract.spec.ts` 의 동일 콜백을 갖는 두 `it.each` 블록을 6-케이스 단일 블록으로 통합한다 (maintainability #3).
3. (선택) `review/code/2026/09/04/21_10_30/RESOLUTION.md` 의 build/e2e 결과 행을 실측치로 채우거나 "미실측" 명시 (side_effect #4).
4. `spec/1-data-model.md:873` Float 라벨 정정, `spec/conventions/swagger.md` numeric 불변식 성문화 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 항목으로 등재됨. 다음 planner 턴에서 처리.
5. e2e 완주 후 `_test_logs/e2e-*.log` 에서 `alerts-threshold-wire-type` PASS 여부 확인(requirement #5) — 구조적 문제 아니므로 긴급하지 않음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(강제 목록 미포함) |
  | architecture | router 판단(강제 목록 미포함) |
  | dependency | router 판단(강제 목록 미포함) |
  | database | router 판단(강제 목록 미포함) |
  | concurrency | router 판단(강제 목록 미포함) |
