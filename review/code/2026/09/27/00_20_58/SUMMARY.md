# Code Review 통합 보고서

## 전체 위험도

**LOW** — Critical 0건, WARNING 1건(`changeSummary` 가 "항상 실리고 null 일 수 있다"는 새 계약의 `null` 값 wire 검증 테스트 갭). 핵심 방어선(`CREATOR_PROJECTION` 민감 컬럼 차단, `VERSION_METADATA_SELECT` 상수 통합, DTO 선언 캐너리)은 뮤테이션 테스트(M1~M5, 전부 KILLED)로 실측 확인됐다. forced(router_safety) 7개 reviewer(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 — 누락 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `changeSummary` 가 새로 "required + nullable" 로 광고되는데, 값이 실제 `null` 인 wire 응답을 `assertMatchesContract` 로 검증하는 테스트가 없다. `H` 케이스는 `changeSummary: 'v1'`(non-null)만 대조하고, `changeSummary` 를 생략하는 저장(테스트 `I`/`C`)은 목록·상세로 조회돼 계약 대조되지 않는다 | `codebase/backend/test/workflow-crud.e2e-spec.ts` 테스트 H(~587행, 561행 `changeSummary: 'v1'`) vs 테스트 I(~610행, `buildFiveNodeGraphPayload()` 623행 — `changeSummary` 키 없음); `workflow-versions.service.ts:219` (`changeSummary: changeSummary || undefined`) | `changeSummary` 를 생략한 버전을 목록/상세로 조회해 `assertMatchesContract` 로 대조하거나 최소 `expect(...changeSummary).toBeNull()` 양성 단언 추가. 경량 대안: `assertMatchesContract({ ...validPayload, changeSummary: null }, await contractForDto(WorkflowVersionDto))` 단위 테스트 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement | `creator`/`changeSummary` DTO 선언이 optional→required 로 넓어진 것은 실제 노출 필드 확장이 아니라 런타임(FK `NOT NULL REFERENCES user(id)`, `ON DELETE` 없음)과 문서의 정합화다. `CREATOR_PROJECTION`(id/name/email 3필드)은 이번 diff에서 불변 — 과거 Critical(투영 누락 PII 유출) 재발 없음 | `workflow-version-response.dto.ts:36-88`, `workflow-versions.service.ts:97-101` | 없음(개선 확인) |
| 2 | Security | `VERSION_METADATA_SELECT` 상수 통합이 "자매 메서드 중 하나만 투영 누락" 결함 클래스를 구조적으로 재발 방지. 대칭 단위 테스트 + 뮤턴트 M4 KILLED 실측 | `workflow-versions.service.ts:109-116, 158, 177-180` | 없음(방어 강화 확인) |
| 3 | Security / API Contract | 목록 엔드포인트(`GET .../versions`)에 없던 `expectNoUserSecrets`+계약 대조를 신설해 기존 커버리지 갭 해소. 뮤턴트 M5(select 에서 creator 투영 제거) 가 이 신설 검증으로 KILLED 실측 | `codebase/backend/test/workflow-crud.e2e-spec.ts:573-579` | 없음 |
| 4 | Scope | DTO §5.4 계약 정정과 `select` 중복 제거 리팩터가 한 커밋(`f35fedaac`)에 번들링됨. plan 에 사전 고지되고 같은 대상 코드에 국한돼 스코프 위반은 아님 | `workflow-versions.service.ts:103-116`, `workflow-version-response.dto.ts:36-88` | 향후 계약 정정과 내부 리팩터는 가능하면 별도 커밋으로 분리 권장 |
| 5 | Requirement | plan(`workflow-version-creator.md`)이 목표를 코드로 충족했지만 트래커(`spec-draft-nullable-notation-followups.md`)의 대응 체크박스 2건이 아직 `[ ]` 로 남아 있다 | `plan/in-progress/spec-draft-nullable-notation-followups.md:1026, 1032` | `--impl-done` 이전 마무리 커밋에서 두 항목 `[x]` 처리 |
| 6 | Requirement / API Contract | spec `5-version-history.md` §7.2 가 응답 타입을 엔티티와 동명(`WorkflowVersion`)으로 표기하고 `## Rationale` 이 없는 이격은 이번 PR 범위 밖 기존 상태 — `--impl-prep` consistency check(WARNING 1·2)에서 이미 식별돼 플래너 트래커에 등재됨 | `spec/3-workflow-editor/5-version-history.md` §7.2; `plan/in-progress/spec-draft-nullable-notation-followups.md:1056-1062` | 조치 불필요(이미 추적 중, planner 소관) |
| 7 | Maintainability | `changeSummary`/`creator` 필드 선언 + 근거 주석이 `WorkflowVersionListItemDto`/`WorkflowVersionDto` 두 클래스에 문자 그대로 중복. 새 캐너리(`it.each`)가 편집 누락은 잡지만 주석 텍스트 drift 는 못 잡음 | `workflow-version-response.dto.ts:36-40, 46-50, 70-74, 84-88` | 향후 이 DTO 쌍을 다시 만질 때 `OmitType` 등으로 `WorkflowVersionListItemDto` 를 `WorkflowVersionDto` 에서 파생시키는 리팩터 고려 |
| 8 | Maintainability | `CREATOR_PROJECTION` 과 `VERSION_METADATA_SELECT` 두 select 관련 상수의 명명 접미사가 다름(`_PROJECTION` vs `_SELECT`) | `workflow-versions.service.ts:97, 109` | 급하지 않음. JSDoc 에 접미사가 다른 이유 한 줄 추가 고려 |
| 9 | Maintainability | `WorkflowVersionDetailProjection` JSDoc 블록이 PR 을 거듭하며 계속 길어짐(2026-09-06·09-08 이력 + 이번 09-27 결정 문단 추가) | `workflow-versions.service.ts:46-74` | 다음 확장 시 오래된 이력 일부를 `plan/complete/` 로 이관하고 "현재 유효한 계약"만 남기는 정리 고려 |
| 10 | Side Effect / API Contract | OpenAPI 상 `creator`/`changeSummary` optional→required 전환은 wire 바이트 변경이 없는 하위호환 스키마 좁힘. 단일 버전 운영 정책(`spec/5-system/2-api-convention.md` §1)상 버전 범프 불요. CHANGELOG 에 소비자 대상 명시 완료 | `workflow-version-response.dto.ts:36-88`; `CHANGELOG.md:26-31` | 없음 |
| 11 | Side Effect | `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫에서 4행 제거(허용 폭 감소) — DTO 변경과 같은 커밋 세트에서 동기화됨 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` | 없음 |
| 12 | Testing | `changeSummary` 가 빈 문자열(`''`)로 와도 falsy 판정으로 `undefined`(→DB NULL)로 뭉개지는 기존 분기가, 이번 required+nullable 계약 승격으로 더 눈에 띔. 이번 diff 범위 밖 | `workflow-versions.service.ts:219` | 없음(참고, 별도 이슈로 검토 가능) |
| 13 | Documentation | `workflow-crud.e2e-spec.ts` 최상단 모듈 JSDoc "핵심:" 요약이 이번에 확장된 목록 응답 계약 대조(H 케이스)를 반영 안함(기존 갭, 이번 diff 범위 밖) | `codebase/backend/test/workflow-crud.e2e-spec.ts` 파일 상단(~24-38행) | 다음 편집 시 "핵심:" 목록에 H(목록/상세 creator 계약·비밀 유출 검증) 한 줄 추가 |
| 14 | Documentation | `CHANGELOG.md` Unreleased 항목 제목이 `creator` 만 언급하나 본문은 `changeSummary` 도 함께 설명 — 제목 범위가 본문보다 좁음 | `CHANGELOG.md:26` | 제목을 "creator · changeSummary 를 광고한다" 식으로 확장(사소, 비블로킹) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. `CREATOR_PROJECTION` 불변 확인, DTO 확장은 노출 필드 확대 아님 |
| requirement | LOW | spec/DB 제약과 line-level 일치 확인. 트래커 체크박스 미동기화만 남음 |
| scope | LOW | plan 목표에 정확히 대응. 계약정정+내부리팩터 번들링은 고지됨(위반 아님) |
| side_effect | LOW | 상태변경·전역가변상태·시그니처 파괴 없음. OpenAPI required 전환은 하위호환 |
| maintainability | LOW | DTO 필드+주석 이중 선언 잔존(캐너리로 방어), 명명/JSDoc 사소 관찰 |
| testing | LOW | 뮤턴트 5건 전부 KILLED, 단 `changeSummary=null` wire 검증 갭 1건(WARNING) |
| documentation | NONE | 전반적으로 모범적(인라인 근거 주석 충실). 사소한 요약/제목 범위 갭 2건 |
| api_contract | LOW | 하위호환 스키마 좁힘, 버전범프 불요. 목록 엔드포인트 계약 갭 해소 확인 |
| user_guide_sync | NONE | 매트릭스 20개 trigger 중 1개(backend-api-change) 매치, 갱신 대상 없음 확인 |

## 발견 없는 에이전트

- **user_guide_sync** — 매칭된 유일한 trigger(`backend-api-change`) 의 (a)(b) 요건이 이미 충족돼 있어 동반 갱신 누락 0건.

## 권장 조치사항

1. (WARNING) `changeSummary` 가 `null` 인 wire 응답을 `assertMatchesContract` 로 검증하는 테스트(또는 최소 `toBeNull()` 양성 단언)를 목록/상세 엔드포인트에 추가한다.
2. (INFO, plan 위생) `plan/in-progress/spec-draft-nullable-notation-followups.md:1026, 1032` 체크박스를 `[x]` 로 마무리 커밋에서 닫는다.
3. (INFO, 선택) 다음에 `WorkflowVersionListItemDto`/`WorkflowVersionDto` 를 만질 기회에 `OmitType` 파생으로 필드+주석 이중 선언을 구조적으로 제거하는 리팩터를 고려한다.
4. (INFO, 선택) CHANGELOG Unreleased 항목 제목 범위를 `changeSummary` 까지 포함하도록 넓힌다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff(DTO 선언 정정 + select 리터럴 상수화)와 성능 관련성 낮음 |
  | architecture | router 판단 — 아키텍처 변경 없음(기존 모듈 구조 내 리팩터) |
  | dependency | router 판단 — 의존성 추가/변경 없음 |
  | database | router 판단 — 스키마/마이그레이션 변경 없음(기존 select 재구성뿐) |
  | concurrency | router 판단 — 동시성 관련 코드 경로 변경 없음 |