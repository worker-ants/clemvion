# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 4건(전부 신규 가드 `findNumericAsNumber`/기존 가드 관련 구조적 갭). 핵심 변경(`AlertRuleDto.threshold: number → string` 정정)은 wire·엔티티·프런트엔드 소비자와 전수 재대조로 정합 확인됨. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `readStringOption`/`collectNumericFields` 가 TypeORM `@Column` 의 **포지셔널 타입 인자** 형태(`@Column('numeric', { precision, scale })`)를 인식 못함 — 오브젝트 리터럴 안 `type:` 프로퍼티만 읽어 이 형태는 조용히 "numeric 아님"으로 분류됨. 현재 저장소엔 사용처 0건(전부 `@Column({`)이라 실질 오탐 없음, 다만 가드 존재 이유가 "미래 재발 방지"라 미검증 상태로 남으면 세 번째 재발 위험 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`readStringOption`, `collectNumericFields`) | 첫 인자가 문자열 리터럴인 경우도 `type` 값으로 읽는 분기 추가 + `swagger-dto-contract.spec.ts` 의 "정규식이 놓쳤던 형태" `it.each` 에 포지셔널 타입 인자 형태를 5번째 대조군으로 추가 |
| 2 | maintainability | 신규 `readStringOption` 이 기존 `readBooleanOption` 을 순회 골격 12줄 그대로 복제 — 마지막 값 매핑 두 줄만 다름. 이 저장소가 같은 디렉터리(`repo-guards/`)에서 최근 "동일 보일러플레이트 5개 통합" 작업(`b79dafdf9`)을 한 것과 같은 성격의 자리 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:62-77`(`readBooleanOption`), `:80-95`(`readStringOption`) | 공통 골격을 `findOptionInitializer(call, key, sf)` 로 뽑거나 `readOption<T>(call, key, sf, pick)` 제네릭 헬퍼로 통합 |
| 3 | testing | 신설 `findNumericAsNumber` 의 실저장소 스캔 단언(`저장소에 그런 자리가 없다`)에 형제 축(`findSwaggerContractMismatches`)에는 있는 `[전제]` 테스트가 없음 — 뮤테이션 실측: `ENTITY_DIR`/`RESPONSE_DTO_DIR` 상수를 존재하지 않는 경로로 바꿔도 `[대조군]` 6개는 RED 이지만 실저장소 단언은 GREEN 유지(`expect([]).toEqual([])` 가 "위반 없음"과 "애초에 스캔 안 됨"을 구분 못함) | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:291-294`, 원인은 `swagger-dto-contract-guard.ts:238-239`(`ENTITY_DIR`/`RESPONSE_DTO_DIR`) | 저장소에 실재하는 numeric 컬럼(`alert_rule.threshold`, `llm_usage_log.cost_usd`)이 스캔에서 최소 1개 이상 발견됨을 확인하는 `[전제]` 테스트 추가 |
| 4 | testing | (직전 라운드 `19_43_18` W1 잔여) `AlertRuleDto.threshold` 를 되잡을 런타임 계약 테스트 여전히 없음 — 신규 가드는 선언-대-선언(엔티티 `@Column` 타입 텍스트 vs DTO 필드 타입 텍스트) 정적 비교일 뿐, 실제 `GET/POST/PATCH /api/alerts/rules` 응답이 문자열을 내려주는지 확인하는 controller/e2e 테스트는 없음. plan 에 이미 후속(b)으로 추적 중이나 미구현 | `codebase/backend/src/modules/alerts/alerts.controller.ts`(반환 타입 미표기 3곳), `modules/alerts/` 아래 controller/e2e 테스트 0건 | `GET /api/alerts/rules` 최소 1건 컨트롤러/e2e 테스트 추가해 `data[0].threshold` 가 `typeof === 'string'` 임을 실제 응답으로 단언 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | 신규 numeric 축 테스트 6곳이 파일이 이미 세운 `judge`/`axes` 헬퍼 패턴을 따르지 않고 `withFiles(...)` 호출을 매번 반복 | `swagger-dto-contract.spec.ts:301-418` | `judgeNumeric(entitySource, dtoSource)` 로컬 헬퍼 추가해 6곳 통일 |
| 2 | testing | `collectDtoFieldTypes`/`collectNumericFields` 가 `node.members` 만 순회 — 상속(`extends`)·`PickType`/`IntersectionType` 합성으로 얻은 numeric 필드는 사각지대. 현재 실사례 없음 | `swagger-dto-contract-guard.ts:252-273`, `:276-295` | `<Entity>Dto` 이름 관례 한계와 같은 방식으로 "[알려진 한계]" 캐너리 테스트 추가 |
| 3 | requirement / api_contract | `spec/1-data-model.md:873` 의 `threshold \| Float` 라벨이 정정된 실제 타입(`string`)과 여전히 불일치. diff 범위 밖, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner 트랙 항목으로 정확히 등재됨(신규 결함 아님) | `spec/1-data-model.md:873` | 조치 불요 — planner 트랙에서 처리 |
| 4 | side_effect | 신규 가드 `findNumericAsNumber` 가 alerts 모듈을 넘어 backend 전역 `dto/responses/**` 에 상시 CI 게이트로 확장 적용 — 문서화된 의도적 설계, 현재 위반 0건 | `swagger-dto-contract-guard.ts`(`findNumericAsNumber`), `swagger-dto-contract.spec.ts`(전수 스캔 단언) | 조치 불요 — `spec/conventions/swagger.md` 성문화가 이미 plan W2 로 예정됨 |
| 5 | documentation | committed consistency-check 산출물(`naming_collision.md`)이 fix 커밋(`c15489e61`)으로 삭제된 `NUMERIC_COLUMN` 심볼을 여전히 존재하는 것처럼 서술 — 이 저장소의 "리뷰 산출물은 시점 스냅샷" 관례에 부합, 결함 아님 | `review/consistency/2026/09/04/20_05_42/naming_collision.md` | 조치 불요(스냅샷 보존 관례) |
| 6 | scope | changeset 2,512줄 삽입 중 2,462줄이 이전 두 리뷰 라운드 산출물 — 실질 코드/문서 변경은 5개 파일에 국한. 범위 판단 시 참고 | 전체 diff (`git diff --stat origin/main...HEAD`) | 조치 불요 — 이 저장소의 review-fix 루프가 만든 정상 감사 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증/인가·암호화 등 실질 취약점 없음. 신규 가드는 외부 입력 없는 CI 전용 정적 분석 |
| requirement | LOW | `readStringOption` 포지셔널 `@Column` 타입 인자 미인식(WARNING). 나머지 이전 라운드 지적 전부 해소 재확인 |
| scope | NONE | 실질 변경 5개 파일이 단일 서사에 정확히 대응, 범위 이탈 없음 |
| side_effect | NONE | 컴파일/런타임 side effect 없음(grep 전수 확인). CI 게이트 전역 확장은 의도된 설계(INFO) |
| maintainability | LOW | `readStringOption`↔`readBooleanOption` 중복(WARNING). 이전 라운드 WARNING 2건은 실제로 닫힘 재확인 |
| testing | LOW | 실저장소 스캔 assertion premise 테스트 부재(WARNING, 뮤테이션 실측) + 런타임 계약 테스트 잔여 부재(WARNING) |
| documentation | NONE | fix 커밋이 실제 반영됨을 재검증. consistency 산출물의 스냅샷 서술은 관례상 결함 아님 |
| api_contract | LOW | API 표면 새 변경 없음(이전 라운드 WARNING 전량 해소 상태 유지 확인). requirement WARNING #1 과 동일 근거로 LOW |
| user_guide_sync | NONE | doc-sync-matrix 20개 trigger 중 1건 매칭(백엔드 DTO), target 충족 또는 해당 없음. frontend 변경 전무 |

## 발견 없는 에이전트

security, scope, side_effect, documentation, user_guide_sync — 실질 취약점/범위 이탈/부작용/문서 결함/유저가이드 동반 갱신 누락 모두 없음(INFO 성격의 참고 사항만 존재).

## 권장 조치사항
1. `readStringOption` 에 TypeORM `@Column` 포지셔널 타입 인자 형태 인식 분기 추가 + 회귀 대조군 테스트 추가 (WARNING #1).
2. `readBooleanOption`/`readStringOption` 공통 골격을 단일 헬퍼로 통합 (WARNING #2).
3. `findNumericAsNumber` 실저장소 스캔에 `[전제]` 테스트 추가해 경로 분류 붕괴 시 침묵 통과 방지 (WARNING #3).
4. `GET/POST/PATCH /api/alerts/rules` 컨트롤러/e2e 테스트를 신설해 `threshold` 가 실제로 문자열로 응답됨을 런타임 검증 (WARNING #4, plan 후속(b) 항목과 연계).
5. (선택) numeric 축 테스트에 `judge`/`axes` 스타일 헬퍼 도입, `PickType`/`extends` 합성 사각지대 캐너리 추가 (INFO #1~#2).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **제외**: 표 (reviewer · 이유, 5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 는 CI 전용 정적 분석 도구/DTO 타입 애노테이션 정정으로 런타임 성능 경로 무관 |
  | architecture | router 판단 — 구조적 재설계 없음, 함수 추가 수준 |
  | dependency | router 판단 — 패키지/의존성 변경 없음 |
  | database | router 판단 — DB 스키마/마이그레이션 변경 없음(컬럼 타입 불변, DTO 문서만 정정) |
  | concurrency | router 판단 — 동시성 관련 코드 변경 없음 |
