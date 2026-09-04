# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(테스트 캐너리 커버리지 갭). 나머지는 전부 INFO 이며, 이 changeset(`AlertRuleDto.threshold` wire 타입 정정 + 재발 방지 가드 + e2e)은 이미 5라운드의 코드 리뷰·mutation 검증을 거친 상태에서 8개 reviewer 전원(강제 7명 + 라우터 선택 1명)이 결과를 정상 반환했다. 강제 화이트리스트 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `readOption<T>` 제네릭화 이후 "리터럴을 만날 때까지 계속 훑는다" 분기가 `readBooleanOption` 인스턴스(`DUPLICATE_KEY` 캐너리)로만 고정돼 있고, `readStringOption`(→`readColumnType`, numeric/decimal 컬럼 판별)인스턴스에는 동등한 대조군이 없음. `pick` 콜백이 두 인스턴스에서 서로 다르므로(`TrueKeyword`/`FalseKeyword` 판정 vs `isStringLiteralLike`) 한쪽 캐너리가 다른 쪽 회귀를 담보하지 않음 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:296-311`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:69-109` | `@Column({ type: someExpr, type: 'numeric' })` 형태의 대조군을 추가해 `readStringOption`/`readColumnType` 경로에서도 "앞의 비-리터럴을 건너뛰고 뒤의 리터럴을 집는다"를 직접 캐너리로 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Documentation (SPEC-DRIFT 성격) | `spec/1-data-model.md:873` 이 `threshold` 를 `Float` 로 라벨링 — 실제 타입(엔티티·DTO 모두 `string`, `numeric(12,4)` 컬럼)과 불일치. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:327-341` 에 planner 트랙 후속 항목으로 정확히 등재돼 있어 developer 권한(spec read-only) 경계를 올바르게 지킨 상태 | `spec/1-data-model.md:873`, `plan/in-progress/spec-draft-nullable-notation-followups.md:327-341` | 조치 불요(이미 경로 지정됨) — 다음 planner 턴에서 `swagger.md` numeric 불변식 성문화와 함께 처리 |
| 2 | Scope | changeset 이 표면적 결함 크기(필드 1개)에 비해 11개 커밋·78개 파일·+6564줄로 큼 | 전체 changeset (`origin/main...HEAD`) | 조치 불요 — 5라운드 review-fix 루프가 정직하게 누적된 결과이며 각 코드 커밋이 직전 라운드 지적만 좁게 고쳤음을 `git show --stat` 로 확인 |
| 3 | Scope | 자매 라운드(`21_25_50`)가 이미 닫은 "프롬프트 페이로드가 HEAD 보다 1커밋 stale" 하네스 타이밍 특성이 구조적으로 재발 가능 | `review/code/2026/09/04/21_25_50/RESOLUTION.md` (#1) | 조치 불요 — 이번 diff 재확인 결과 `codebase/**` 에 영향 없음, 하네스 개선은 이 PR 범위 밖 |
| 4 | Side Effect | `AlertRuleDto.threshold` 공개 인터페이스 타입 변경(`number`→`string`)은 저장소 내부 런타임(직렬화)에 영향 없음(`ClassSerializerInterceptor` 0건, 컨트롤러가 엔티티 그대로 반환) — 외부 codegen 클라이언트 영향은 CHANGELOG 로 이미 고지 | `alert-rule-response.dto.ts:28-29`, `CHANGELOG.md:25` | 조치 불요 — 5라운드 누적 검증으로 수렴 |
| 5 | Side Effect | 신규 e2e 델타는 순수 테스트 값 교체(정수→소수부 4자리)와 재조회 단언 추가뿐, 프로덕션 코드·전역 상태·환경변수·네트워크 패턴 변경 없음 | `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts:70-117` | 조치 불요 |
| 6 | Side Effect | 신규 정적분석 가드(`findNumericAsNumber`/`scanNumericExposure`)는 순수 읽기 전용, 전역 가변 상태 없음. 이전 라운드가 우려했던 `g`-플래그 정규식(`NUMERIC_COLUMN`)은 AST 전환으로 완전히 제거됨(저장소 전체 0건) | `swagger-dto-contract-guard.ts:260-262, 353-418` | 조치 불요 |
| 7 | Maintainability | `collectNumericFields`/`collectDtoFieldTypes` 두 함수가 "클래스 선언을 찾아 순회한다"는 거의 동일한 AST 트리워커 뼈대를 각각 반복(각 15~20줄) | `swagger-dto-contract-guard.ts:296-317, 320-339` | 즉각 조치 불요. 같은 형태의 스캐너가 하나 더 추가되면 `walkClasses(sf, callback)` 류 공유 헬퍼로 추출 고려 |
| 8 | Maintainability | `@ApiProperty({ type: String, ... })` 의 명시적 `type: String` 이 같은 파일의 다른 `string` 필드들(타입 미명시, 리플렉션 추론)과 스타일이 다름 — 이전 라운드(`19_43_18`)부터 미해결로 남은 항목 | `alert-rule-response.dto.ts:28` | 필요 시 "타입 정정 직후라 리플렉션 추론에 기대지 않고 명시했다"는 근거를 JSDoc 에 한 줄 남기거나, 다른 필드처럼 `type:` 생략해 통일 |
| 9 | Testing | `[전제]` 테스트가 실제 프로덕션 스키마 값(`AlertRule.threshold`, `LlmUsageLog.costUsd`)에 이름으로 결속돼 있어, 향후 컬럼명 변경 시 가드 로직과 무관하게 테스트가 깨질 수 있음(의도된 설계, "공허한 assertion 방지" 근거 명시) | `swagger-dto-contract.spec.ts:338-346` | 조치 불요 — 향후 실패 시 "가드가 깨졌다"가 아니라 "전제 스키마가 바뀌었다"를 먼저 의심 |
| 10 | Testing | e2e 테스트가 `DELETE /api/alerts/:id` 응답은 다루지 않음(threshold wire 타입 스코프에서는 자연스러운 배제, 204 No Content) | `alerts-threshold-wire-type.e2e-spec.ts:73` | 조치 불요 |
| 11 | Documentation | `review/**` 아카이브 중 초기 라운드(`19_43_18`) 산출물이 이후 정정된 사실과 다른 서술(예: "list()만" 언급)을 여전히 담고 있음 — 시점 스냅숏 보존이 의도된 관례 | `review/code/2026/09/04/19_43_18/documentation.md` 등 | 선택 사항 — 이번 라운드 RESOLUTION.md 에 "과거 산출물은 시점 스냅숏, 현재 상태는 CHANGELOG/plan 최신본 참조" 각주 추가 고려 |
| 12 | API Contract | `CHANGELOG.md` 신규 항목에 codegen 클라이언트 영향(`**영향**:`) 문단이 이미 포함돼 있음(1라운드 WARNING 이 이후 라운드에서 조치 완료) | `CHANGELOG.md` | 조치 불요 — 이미 반영됨 |
| 13 | API Contract | repo-guard(`findNumericAsNumber`)는 런타임 API 표면이 아니라 CI/개발 시점 정적분석. DTO-엔티티 원시 타입 불일치의 근본 원인(컨트롤러 반환 타입 미표기로 `tsc` 가 대조 못함)은 이 가드로도 닫히지 않으며, plan 문서가 이를 "(b) 응답 대조 e2e 만 성립"으로 스스로 정리해 이번 diff 가 그 대표 사례를 채움 | `swagger-dto-contract-guard.ts`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 설계상 의도된 잔여 갭이며 plan 에 이미 반영 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증/인가·입력검증·암호화·에러처리·의존성 전 축에서 발견 없음 |
| requirement | NONE | 핵심 요구사항 5개 파일에 완전 구현, entity/service/controller/frontend/spec 전 계층 정합 확인. spec Float 라벨은 이미 planner 트랙 등재 |
| scope | NONE | 실질 변경 6개 파일이 단일 서사(11개 커밋)로 정확히 연결, 범위 이탈 없음 |
| side_effect | LOW | 신규 e2e 델타는 순수 테스트값 교체, 프로덕션/전역 상태 부작용 없음(전부 INFO) |
| maintainability | LOW | AST 클래스 워커 소규모 중복 + `@ApiProperty` 스타일 비일관(전부 INFO) |
| testing | LOW | `readOption` 제네릭화 후 `readStringOption` 인스턴스 캐너리 커버리지 갭 1건(WARNING), 33/33 테스트 로컬 재현 PASS |
| documentation | NONE | 이전 5라운드 WARNING(라우트 오기, 영향 축소 서술, 산술 불일치) 전부 정정 확인 |
| api_contract | LOW | wire 바이트·인증/인가·검증·에러응답 무변경, CHANGELOG 영향 고지 확인(전부 INFO) |

## 발견 없는 에이전트

- security — 구체적 결함/INFO 항목 없음(전체 관점 "해당 없음")

## 권장 조치사항

1. (WARNING 조치) `swagger-dto-contract-guard.ts`/`.spec.ts` 에 `@Column({ type: someExpr, type: 'numeric' })` 형태의 대조군을 추가해 `readStringOption`(`readColumnType`) 경로에서도 "리터럴을 만날 때까지 계속 훑는다" 분기를 캐너리로 고정한다.
2. (INFO, 선택) 다음에 같은 형태(클래스 선언 → 멤버 스캔)의 AST 축이 하나 더 추가되면 `collectNumericFields`/`collectDtoFieldTypes` 순회 골격을 공유 헬퍼로 추출한다.
3. (INFO, 선택) `alert-rule-response.dto.ts` 의 `@ApiProperty({ type: String })` 명시 사유를 한 줄 근거로 남기거나 다른 필드와 스타일을 통일한다.
4. (조치 불요, 추적만) `spec/1-data-model.md:873` 의 `threshold: Float` 라벨 정정과 `spec/conventions/swagger.md` numeric 불변식 성문화는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 항목으로 정확히 등재돼 있으므로, 다음 planner 턴에서 처리한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(success, 전문 인라인 확인)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 changeset(DTO 타입 정정 + 정적가드 + e2e)에 성능 관련 실행 경로 변경 없음 |
  | architecture | 라우터 판단 — 아키텍처/모듈 구조 변경 없음 |
  | dependency | 라우터 판단 — 신규 패키지/lockfile 변경 없음(기존 devDependency `typescript` 재사용) |
  | database | 라우터 판단 — 스키마/마이그레이션 변경 없음(컬럼 타입은 기존 그대로, DTO 문서 표기만 정정) |
  | concurrency | 라우터 판단 — 동시성 관련 코드 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 대면 문서/가이드 갱신 대상 아님(내부 repo-guard·e2e·DTO 타입 정정) |
