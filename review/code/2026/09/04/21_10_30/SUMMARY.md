# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 2건(테스트 미검증 방어 분기 1건, plan 문서 구조적 재부모화 1건) 외에는 대부분 INFO. 이번 changeset 의 실질 코드 변경(`AlertRuleDto.threshold: number → string` 정정 + `findNumericAsNumber` 재발방지 가드 + 신규 e2e)은 3개 선행 리뷰 라운드(19_43_18→20_16_17→20_39_25)를 거치며 CRITICAL/WARNING 이 전부 해소된 상태이고, 이번 라운드는 그 사실을 9개 reviewer 전원이 소스 레벨로 재검증했다. forced 화이트리스트 7명 전원 결과 확보됨(누락 없음) — "clean 처럼 보이지만 실은 결과 미확보"인 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `readOption` 이 JSDoc 으로 명시한 "동일 키 중복 시 리터럴 값을 계속 찾는다" 방어 분기가 테스트 0건. `if (picked !== undefined) return picked;` → `return picked;` 로 뮤테이션해도 `swagger-dto-contract.spec.ts` 32/32 GREEN 유지(회귀 미검출) — 실측 확인, 원복 후 `git diff --quiet` clean 확인 완료. 같은 파일이 이미 세운 "실사례 0건 분기도 캐너리로 고정한다"(`@Transform` 예외) 원칙과 내적 불일치 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:61-85` (`readOption`) | 동일 키가 두 번 나오는 (문법적으로 유효한) 픽스처로 `readBooleanOption`/`readStringOption` 이 두 번째 리터럴을 집는지 단언하는 `[전제]` 테스트 추가. 픽스처 구성이 어렵다면 JSDoc 을 "이론상 방어, 미검증"으로 낮출 것 |
| 2 | documentation | plan 문서에 신규 불릿 2개(`spec/conventions/swagger.md` 성문화, `spec/1-data-model.md:873` Float 라벨링)를 끼워 넣으면서, 기존 "§5.4 drift 배치 — 2단계" 불릿의 연속 서술(`(a)/(b)` → `ExecutionDto` 관련 3문단)이 마크다운 들여쓰기상 무관한 "Float 라벨링" 불릿의 하위 내용처럼 재부모화됨. "(b) ... 아래 참조"가 가리키는 대상이 실제로는 두 개의 무관한 불릿을 건너뛴 자리로 옮겨 붙었음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:270-333` | 신규 두 불릿을 "2단계" 불릿의 continuation 이 끝난 뒤로 옮기거나, "(a) 가 왜 안 되는가" 블록을 "2단계" 불릿의 `(a)` 서술 바로 아래(실제 참조 지점)로 이동. 최소한 "(§5.4 2단계 참고)" 역참조 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `spec/1-data-model.md:873` `threshold` 라벨이 여전히 `Float` — wire·엔티티 실제 타입(string)과 불일치 | `spec/1-data-model.md:873` | 조치 불요 — `spec/` 은 developer 권한 밖, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 항목으로 이미 정확히 등재됨 |
| 2 | requirement, maintainability | `numeric`/`decimal` 원시 타입 불변식(코드 가드로는 강제되나)이 `spec/conventions/swagger.md` 에 아직 성문화되지 않음 | `spec/conventions/swagger.md` | 조치 불요 — planner 트랙(`20_05_42` W2)에 이미 등재 |
| 3 | maintainability | 이번 diff 가 도입한 "내부 서사는 `//` 주석, 소비자용 설명은 JSDoc" 분리 패턴이 컨벤션 문서에 미성문화 — 다음 DTO 작성자가 같은 실수(서사를 JSDoc 에 적어 공개 OpenAPI 로 유출)를 반복할 여지 | `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:20-27`, `spec/conventions/swagger.md` | `spec/conventions/swagger.md` §1-1 에 가이드 한 문단 추가 검토(planner 트랙, 위 #2 와 같은 세션에 묶으면 비용 절감) |
| 4 | maintainability | `numeric` 축 대조군 테스트가 `withFiles(...)` 보일러플레이트를 8곳에서 반복(presence/null 축은 `judge()` 헬퍼로 압축돼 있는 것과 비대칭) | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:323-470` | 조치 불요 — `20_39_25` 라운드에서 이미 판정된 캐리오버(순수 가독성, 검출력 영향 없음). 세 번째 판정 패턴 추가 시 로컬 헬퍼로 묶는 것 고려 |
| 5 | testing | `collectNumericFields`/`collectDtoFieldTypes` 가 `extends`/`PickType`/`OmitType` 합성 필드를 못 본다 — 알려진 한계, 실사례 0건 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:296-317, 320-339` | 조치 불요(현재) — `[알려진 한계]` 캐너리 테스트 1건 추가를 후속으로 유지 |
| 6 | side_effect | `AlertRuleDto.threshold` 의 공개 OpenAPI 원시 타입이 `number`→`string` 으로 바뀜 — 저장소 내부 런타임(직렬화 인터셉터 없음, 유일한 소비자는 이미 string 기대)에는 무영향이나 외부 codegen 클라이언트에는 실질 인터페이스 변경 | `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` | 조치 불요 — CHANGELOG 에 이미 codegen 영향 고지 포함됨 |
| 7 | side_effect | `review/**/_retry_state.json` 4개 파일에 이번 워크트리의 절대경로가 하드코딩되어 그대로 커밋됨 | `review/code/2026/09/04/{19_43_18,20_16_17,20_39_25}/_retry_state.json`, `review/consistency/2026/09/04/20_05_42/_retry_state.json` | 조치 불요 — 런타임에 재참조되지 않는 기록용 파일(소비 코드 없음 확인), 참고만 |
| 8 | scope | 코드 변경 5개 파일 대비 이전 3개 리뷰 라운드 + consistency-check 산출물 27개 파일이 같은 브랜치에 누적 커밋되어 diff 볼륨의 상당 부분을 차지 | `review/code/2026/09/04/{19_43_18,20_16_17,20_39_25}/*`, `review/consistency/2026/09/04/20_05_42/*` | 조치 불요 — CLAUDE.md 가 명시한 저장 위치·"구현 완료 후 자동 review/fix 상시 의무" 워크플로에 부합 |
| 9 | scope | 가드 파일(`swagger-dto-contract-guard.ts`)이 같은 changeset 안에서 "정규식 신설 → AST 로 교체 → 포지셔널 인자 보강" 3단계 왕복 수정 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` | 조치 불요 — 각 단계가 직전 리뷰 WARNING 에 1:1 대응(RESOLUTION.md 근거), 최종 diff 는 원 의도를 벗어나지 않음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 없음. DTO 타입 정정은 오히려 codegen 오해석 위험을 줄이는 방향 |
| requirement | NONE | 핵심 변경과 엔티티·DB·서비스·프런트엔드·spec 전수 재대조 정합. 남은 항목 2건은 planner 트랙에 정확히 등재됨 |
| scope | NONE | 52개 파일 전부 단일 서사(threshold 타입 정정 → 가드 신설 → review-fix 루프)에 귀속, 무관한 파일/설정/포맷팅 변경 없음 |
| side_effect | LOW | 공개 OpenAPI 타입 변경(내부 런타임 무영향, 외부 codegen 영향 이미 고지됨), `_retry_state.json` 경로 하드코딩 참고 |
| maintainability | LOW | 기존 WARNING(readStringOption 중복) 해소 재확인. 신규는 INFO 2건(테스트 보일러플레이트 캐리오버, JSDoc 컨벤션 미문서화) |
| testing | LOW | WARNING 1건 — `readOption` 중복키 방어 분기 테스트 부재(뮤테이션 실측으로 32/32 GREEN 확인). 나머지는 기존 WARNING 해소 재확인 |
| documentation | LOW | WARNING 1건 — plan 문서 신규 불릿 삽입으로 기존 항목이 구조적으로 재부모화. 코드 파일 문서화 자체는 결함 없음 |
| api_contract | LOW | 전부 INFO. DTO 정정·e2e·가드 모두 실제 라우트/엔티티/요청 DTO 와 정합 확인 |
| user_guide_sync | NONE | 매칭된 유일한 trigger(`backend-api-change`)의 target 2개 — swagger jsdoc 충족, user-guide 페이지는 대응 서술 부재로 적용 대상 아님 |

## 발견 없는 에이전트

- security — 발견된 보안 취약점 없음
- user_guide_sync — 매칭된 trigger 의 target 전부 충족/해당없음, 누락 0건

## 권장 조치사항

1. (WARNING #1) `swagger-dto-contract.spec.ts` 에 `readOption` 동일 키 중복 방어 분기를 겨누는 `[전제]` 테스트 추가 — 현재 이 분기는 뮤테이션해도 스위트가 GREEN 을 유지해 실질적으로 무방비다.
2. (WARNING #2) `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 삽입 불릿 2개 위치를 조정하거나 역참조를 명시해, "§5.4 2단계" 항목의 기존 서술이 무관한 "Float 라벨링" 항목 하위로 재부모화된 것을 바로잡는다.
3. (INFO, 선택) `spec/conventions/swagger.md` 갱신 시 numeric/decimal 불변식 성문화(#2)와 JSDoc/plain-comment 분리 가이드(#3)를 같은 편집 세션에 묶어 planner 트랙에서 함께 처리 — 이미 plan 에 앞의 항목은 등재돼 있으므로 뒤의 것만 추가하면 됨.
4. 그 외 INFO 항목(#4·#5·#8·#9)은 전부 조치 불요로 판정된 캐리오버/정상 워크플로이며, 재론 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(이번 changeset 은 성능 관련 표면 없음) |
  | architecture | router 판단 |
  | dependency | router 판단(`package.json`/lockfile 변경 없음) |
  | database | router 판단(마이그레이션/스키마 DDL 변경 없음, `numeric` 컬럼 타입 자체는 불변) |
  | concurrency | router 판단 |
