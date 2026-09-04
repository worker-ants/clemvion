# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. `AlertRuleDto.threshold` 를 `number`→`string` 으로 정정하고 재발 방지 정적 가드(numeric/decimal 컬럼 축) + e2e wire-type 테스트를 추가한 changeset. 8개 reviewer(강제 화이트리스트 7명 + 라우터 선정 api_contract) 전원이 결과를 확보했고 전원 실제 코드 변경(6개 파일)을 직접 대조해 새로운 CRITICAL/WARNING 을 찾지 못했다. side_effect 만 위험도를 LOW 로 보고했으나(근거: 공개 인터페이스 타입 변경이라는 항목 자체의 성격 표기) 내용은 전부 INFO 이며 조치 불요로 결론짓는다. **강제 화이트리스트 미이행 없음** — forced 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 전문 확보됨.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/api_contract | `AlertRuleDto.threshold` 타입 정정(`number`→`string`)이 엔티티(`numeric(12,4)`)·컨트롤러 반환·프런트엔드 소비처·CHANGELOG 서술과 완전히 일치. 이전 6라운드 리뷰가 지적한 영향 문단 누락·"list()만" 축소 서술은 이미 반영됨 | `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28-29`, `CHANGELOG.md` | 조치 불요 |
| 2 | security | 신규 정적 가드(`findNumericAsNumber`/`scanNumericExposure`)는 저장소 내부 소스만 읽는 빌드타임 도구, 새 공격 표면 없음 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` | 조치 불요 |
| 3 | testing | `[전제]` 테스트가 스캔 vacuous-pass(위반 0건이 "스캔이 비었기 때문"인지)를 분리해 검증, 정규식 위음성 4형태 + 포지셔널 `@Column` 2형태 + boolean/string 옵션 리더 양쪽 인스턴스 캐너리 확보 | `swagger-dto-contract.spec.ts:353-500` | 조치 불요 |
| 4 | testing | e2e 값(`12.3456`/`7.0625`)이 `numeric(12,4)` scale 을 꽉 채워 정수만 썼을 때의 공허한 통과를 방지, POST/GET/PATCH 세 응답 + DB 재조회 양쪽 검증 | `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts:70-118` | 조치 불요 |
| 5 | maintainability | 남은 미조치 INFO 3건(스캐너 뼈대 소규모 중복, `it.each` 콜백 중복, `type: String` 명시 이유 미기재)은 전부 이전 라운드가 근거와 함께 명시적으로 유예 처분한 항목, 이번 재확인에서도 판단을 뒤집을 새 사실 없음 | `swagger-dto-contract-guard.ts:296-339`, `swagger-dto-contract.spec.ts:423-483`, `alert-rule-response.dto.ts:28` | 조치 불요, 다음에 해당 자리를 편집할 때 한 줄 사유 추가 권장 |
| 6 | requirement/api_contract | spec fidelity gap — `spec/1-data-model.md:873` 이 `threshold` 를 `Float` 로 라벨링해 실제 wire(`string`)와 어긋남. 이번 diff 범위 밖이며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 후속으로 정확히 등재됨 | `spec/1-data-model.md:873` | developer 조치 불요(권한 밖) — planner 세션에서 라벨 정정 예정대로 진행 |
| 7 | api_contract | 신규 가드는 `<Entity>Dto` 이름 관례를 벗어난 응답 DTO(예: `StatisticsResponseDto` 류)의 numeric 노출은 못 잡는 알려진 한계 — 자체 docstring/대조군 테스트로 명시됨. 이번 PR 범위 내 실제 위반은 없음 | `swagger-dto-contract-guard.ts` (`findNumericAsNumber` docstring) | plan 이 이미 등재한 "일반화된 응답-대-DTO 대조 헬퍼" 후속 트랙에서 함께 검토 |
| 8 | scope | 유일한 비-append 리팩토링(`readOption<T>` 제네릭 통합)은 직전 라운드 WARNING(코드 중복)의 직접 조치이자 신규 축에 실사용됨 — 드라이브바이 아님 | `swagger-dto-contract-guard.ts:58-113` | 조치 불요 |
| 9 | documentation | `review/**` 아카이브 33개 파일이 각 라운드 시점의 스냅숏 서술을 담고 있어 이후 정정과 문자 그대로 어긋나는 문장이 남아있음 — 이 저장소가 명시 채택한 관례(시점 스냅샷), 결함 아님 | `review/code/2026/09/04/{19_43_18,...}/**` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | wire 바이트 불변, 정적 가드는 빌드타임 read-only, e2e 하드코딩 시크릿 없음 |
| requirement | NONE | `threshold` 정정이 엔티티·wire·프런트엔드·spec 실측과 전부 일치, 가드 vacuous-pass 방지 확인 |
| scope | NONE | 13커밋 전부 단일 결함(threshold 타입 오기)과 그 재발방지에 결속, 무관한 수정 없음 |
| side_effect | LOW | 유일한 공개 인터페이스 변경(threshold 타입)이 저장소 내부 런타임에 영향 없음, 전역 상태/부작용 없음 |
| maintainability | NONE | 6라운드 걸쳐 정규식→AST 전환 등 실질 개선 완료, 남은 INFO 3건은 근거와 함께 유예됨 |
| testing | NONE | 34/34 PASS 재실행 재확인, tsc 무오류, 커버리지 갭 없음 |
| documentation | NONE | 6라운드 지적 문서화 WARNING 전부 정정 확인, CHANGELOG/plan 서술 정확 |
| api_contract | NONE | wire-호환 정정, 이름 관례 한계는 명시적으로 문서화된 알려진 트레이드오프 |

## 발견 없는 에이전트

없음 — 전원 최소 1건 이상 INFO 참고사항을 보고했으나 실질 조치가 필요한 결함은 없음.

## 권장 조치사항

1. (선택, 낮은 우선순위) `spec/1-data-model.md:873` 의 `threshold` `Float` 라벨을 실제 wire 타입(`string`, `NUMERIC(12,4)`)에 맞게 정정 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 후속으로 등재되어 있으므로 별도 조치 불요, 예정대로 진행.
2. (선택) `spec/conventions/swagger.md` 에 numeric/decimal 컬럼은 응답 DTO 에서 `string` 으로 문서화한다는 불변식을 성문화 — 이미 plan 에 등재됨.
3. (선택, 낮은 우선순위) `alert-rule-response.dto.ts` 의 `threshold` 필드에 `@ApiProperty({ type: String, ... })` 명시 이유를 한 줄 주석으로 남기는 것을 다음 편집 시 고려(이미 유예된 항목, 급하지 않음).
4. 이 changeset 은 CRITICAL/WARNING 이 없으므로 fix 없이 머지 가능한 상태로 판단됨.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음
  - **제외**: 6명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 changeset 과 무관 (DTO 타입 정정 + 정적 가드 + e2e, 런타임 성능 경로 미변경) |
  | architecture | router 판단상 이번 changeset 과 무관 (구조적 변경 없음) |
  | dependency | router 판단상 이번 changeset 과 무관 (의존성 변경 없음) |
  | database | router 판단상 이번 changeset 과 무관 (스키마/마이그레이션 변경 없음) |
  | concurrency | router 판단상 이번 changeset 과 무관 (동시성 로직 변경 없음) |
  | user_guide_sync | router 판단상 이번 changeset 과 무관 (사용자 가이드 대상 기능 변경 없음) |
