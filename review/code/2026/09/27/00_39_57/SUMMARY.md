# Code Review 통합 보고서

## 전체 위험도
**LOW** — 신규 CRITICAL·WARNING 없음. 9개 reviewer(전원 forced, 전원 결과 확보) 전부 NONE~LOW 범위이며, 실질 결함은 발견되지 않았다. `scope`·`side_effect`·`maintainability`·`testing` 4개 reviewer가 공개 OpenAPI 계약 변경(§5.4 필드 정정)과 잔여 편집 표면(주석 중복, null-wire 상세 미검증)을 근거로 LOW 를 매겼으나 전부 INFO 수준이고 기존 테스트가 이중으로 방어한다.

**리뷰어 간 사실 상충 1건 발견 및 직접 검증으로 해소**: `maintainability` reviewer는 `CHANGELOG.md:26` 제목이 "여전히 `creator` 만 언급한다"고 적었으나, `documentation` reviewer는 같은 위치가 이미 `creator`·`changeSummary` 둘 다 언급하도록 갱신됐다고 적어 상충했다. 본 요약 작성 중 `CHANGELOG.md:26` 을 직접 Read 로 대조한 결과 **현재 제목은 "OpenAPI 가 워크플로 버전 응답의 `creator` · `changeSummary` 를 항상 실리는 필드로 광고한다"로 이미 둘 다 포함** — `documentation` reviewer 판정이 맞고 `maintainability` reviewer의 해당 관찰은 stale/오류이므로 아래 표에서 조치 불요로 처리했다. forced 화이트리스트 미이행이나 결과 누락은 없었다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/3-workflow-editor/5-version-history.md` §7.2 가 응답 타입을 엔티티와 동명(`WorkflowVersion`)으로 표기해 실제 DTO(`WorkflowVersionDto`)와 어긋난다. 같은 문서에 `## Rationale` 섹션도 부재. | `spec/3-workflow-editor/5-version-history.md` §7.2 (108행) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:1056` planner 트래커에 등재됨 — 이번 라운드 추가 조치 불요, 재-flag로 중복 집계 금지. 처분은 project-planner 몫. |
| 2 | 문서/plan | plan 체크리스트가 실제 상태와 어긋난 채 diff 에 포함됨 — `workflow-version-creator.md` 의 `/ai-review`·`--impl-done`·"트래커 두 항목 닫기", 트래커의 `creator` §5.4 항목이 모두 `[ ]` 미체크. 실측 확인(sed) 결과도 동일. | `plan/in-progress/workflow-version-creator.md:83-86`, `plan/in-progress/spec-draft-nullable-notation-followups.md:1036` | plan 이 스스로 예고한 순서(마무리 커밋에서 처리)이므로 이번 라운드 판정 비블로킹. 마무리 커밋에서 체크박스 갱신 + `--impl-done` 실행. |
| 3 | API Contract | `creator`(optional+nullable→required)·`changeSummary`(optional+nullable→required+nullable) OpenAPI 선언 정정은 wire 바이트를 바꾸지 않는 하위 호환 변경. DB FK `NOT NULL`(`ON DELETE` 없음)·`select`/`relations` 구성으로 실제 항상 존재함을 소스 직접 확인. | `.../dto/responses/workflow-version-response.dto.ts:36-50,70-88`, `.../workflow-versions.service.ts` | 조치 불요 — 캐너리·e2e·뮤테이션(M1~M5 KILLED)로 뒷받침됨. |
| 4 | Maintainability | `VERSION_METADATA_SELECT` 상수화가 과거 Critical(자매 메서드 중 하나만 `creator` 투영 누락 → `User` 전 컬럼 유출) 재발 방지에 기여. `creator: CREATOR_PROJECTION`(보안 경계)은 값 불변, 두 호출부에 명시적으로 남음. | `.../workflow-versions.service.ts:97(CREATOR_PROJECTION)`, `:103-116(VERSION_METADATA_SELECT)`, `:158,174-180(적용부)` | 조치 불요. 대칭 단위 테스트+뮤턴트(M4)로 실측 방어됨. |
| 5 | Testing/API Contract | 목록(`GET /workflows/:wfId/versions`) 엔드포인트에 `expectNoUserSecrets`+`WorkflowVersionListItemDto` 계약 대조가 처음 추가됨 — 기존 커버리지 갭 해소, 뮤턴트 M5(목록 select 에서 creator 투영 제거)가 이 검증으로 KILLED. | `codebase/backend/test/workflow-crud.e2e-spec.ts` (테스트 H, 게이트 566-580) | 조치 불요(개선 확인). |
| 6 | Scope | DTO 계약 정정과 `select` 중복 제거 리팩터가 한 커밋(`f35fedaac`)에 번들링됨 — 1R scope 리뷰가 이미 지적, plan 이 사전 고지("트래커 인접 두 항목을 한 PR로 닫는다") + 대칭 테스트로 방어됨. | `.../workflow-versions.service.ts:103-180`, `.../workflow-version-response.dto.ts:36-88` | 이번 PR은 그대로 두되, 향후 계약 정정과 내부 리팩터는 가능하면 별도 커밋 분리 권장(1R과 동일, 변경 없음). |
| 7 | Testing | `changeSummary` null 값의 wire 계약 대조가 **목록(List)에만** 있고 **상세(Detail)** 엔드포인트에는 없음 — 1R WARNING(null wire 미검증)이 부분적으로만 닫힘. DTO 선언 캐너리 + select 대칭 테스트가 이중 방어하여 실사고 위험 낮음(WARNING→INFO 하향). | `codebase/backend/test/workflow-crud.e2e-spec.ts` 테스트 `I`(611-664, 특히 638-646) vs 테스트 `H`(536-601) | 테스트 `I`에 `GET .../versions/:id` 상세 재조회 + `assertMatchesContract(..., WorkflowVersionDto)` + `toBeNull()` 추가 권장. 급하지 않음. |
| 8 | Maintainability | `changeSummary`/`creator` 필드 선언 + 근거 주석이 `WorkflowVersionListItemDto`/`WorkflowVersionDto` 두 클래스에 문자 그대로 중복됨 — 향후 한쪽만 갱신되는 편집 표면 잔존(신규 캐너리가 선언 drift는 잡지만 주석 텍스트 drift는 못 봄). | `.../workflow-version-response.dto.ts:36-40,46-50,70-74,84-88` | 다음에 이 DTO 쌍을 만질 때 `OmitType(WorkflowVersionDto, ['snapshot'])` 등 매핑 타입으로 파생 구조 고려. 비블로킹. |
| 9 | Maintainability | `changeSummary || undefined` 가 빈 문자열을 `undefined`(→null)로 뭉갬 — `changeSummary`가 이번 PR로 "항상 실리고 null 가능"인 강한 계약으로 승격된 지금 더 눈에 띄지만, 이 diff 가 만지지 않은 기존 분기이며 안전(빈 문자열 vs null 구분 불필요). | `.../workflow-versions.service.ts:219` | 조치 불요(범위 밖). 별도 이슈로 검토 가능. |
| 10 | Maintainability | 같은 파일의 두 select 상수 명명 접미사 불일치(`CREATOR_PROJECTION` vs `VERSION_METADATA_SELECT`) — 층위 차이(관계 하위 투영 vs 최상위 컬럼)로 완전한 오분류는 아니나 관계 유추가 조금 어려움. | `.../workflow-versions.service.ts:97,109` | 급하지 않음. JSDoc에 명명 차이 근거 한 줄 추가 고려. |
| 11 | Maintainability | `WorkflowVersionDetailProjection` JSDoc이 PR을 거듭하며 계속 길어짐(이번에 2026-09-27 프런트엔드 미러 비변경 결정 문단 추가). | `.../workflow-versions.service.ts` 46-74행 부근 | 블로킹 아님. 다음 증가 시 오래된 이력 일부를 `plan/complete/` 문서로 이관 고려. |
| 12 | 문서(상충 해소) | `maintainability` reviewer는 `CHANGELOG.md:26` 제목이 "여전히 `creator`만 언급한다"고 기재했으나, 요약 작성 시 파일을 직접 Read 로 재확인한 결과 **현재 제목은 이미 `creator`·`changeSummary` 둘 다 포함**(`documentation` reviewer 판정과 일치, `69b1afca0`로 이미 반영됨). | `CHANGELOG.md:26` | 조치 불요 — `maintainability` reviewer 관찰은 stale, 이미 해소됨. |
| 13 | API Contract | 프런트엔드 미러(`lib/api/workflows.ts:106`, `creator?: {...} \| null`)가 백엔드 선언보다 여전히 넓게 유지됨 — 백엔드만 좁아졌을 뿐 소비처 방어 코드가 깨지는 방향이 아니므로 파괴적 변경 아님. | `codebase/frontend/src/lib/api/workflows.ts:106` | 조치 불요. 결정 근거는 `workflow-versions.service.ts`의 `WorkflowVersionDetailProjection` JSDoc에 기록됨. |
| 14 | API Contract | 목록(`GET /workflows/:wfId/versions`)에 페이지네이션 없음 — 워크플로당 버전 전량 반환. 이번 diff 도입 아니고 범위 밖. | `.../workflow-versions.service.ts` (`findByWorkflow`) | 비블로킹. 버전 수 무한 증가 도메인이면 장기적 검토 여지. |
| 15 | Side Effect | `WorkflowVersion.creator`의 `@ManyToOne(() => User)`에 `{ nullable: false }` 미명시 — DB 제약(FK NOT NULL)이 실질 보장하지만 TypeORM 엔티티 관계 자체는 타입 수준에서 "항상 존재"를 강제하지 않음. 이 PR이 건드린 자리 아님. | `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts` (엔티티 관계 선언) | 참고 사항. 조치 불요. |
| 16 | Security | 동시 저장 충돌 시 `QueryFailedError`를 고정 메시지로만 반환, 내부 DB 정보 미노출 — 이번 diff 미변경 로직, 인접 확인. | `.../workflow-versions.service.ts` `createVersion` catch 블록(228-238 부근) | 조치 불요. |
| 17 | Security | `WorkflowVersionCreatorDto.email` 노출은 이번 PR 범위 밖 기존 설계 — 워크스페이스 내 다른 멤버에게 작성자 email 노출은 새로 생기거나 넓어지지 않음. | `.../workflow-version-response.dto.ts` `WorkflowVersionCreatorDto`(3-15) | 조치 불요(범위 밖, 신규 아님). |
| 18 | Scope | `review/consistency/2026/09/26/23_55_27` W1·W2가 발견한 무관한 기존 spec 이격을 developer가 직접 고치지 않고 planner 트래커에만 등재 — `CLAUDE.md` "developer는 멈추고 project-planner 위임" 규약 정확 준수. | `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 8줄 삽입, 원본 1053행 뒤) | 조치 불요(정상 처리 확인용 기재). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | INFO만 — select 상수화가 과거 PII 유출 결함 클래스 재발 방지에 기여, 목록 엔드포인트 방어 강화 확인 |
| requirement | NONE | spec(§5.4, §7.1)·DB 제약과 line-level 일치, 1R WARNING(null wire)은 `69b1afca0`로 해소 재확인, §7.2 SPEC-DRIFT는 기등재 |
| scope | LOW | 계약 정정+select 리팩터 한 커밋 번들링(1R 재확인, 방어됨), 나머지는 정상 harness/위임 절차 |
| side_effect | LOW | 공개 OpenAPI required 전환은 wire 불변(DTO가 직렬화 미관여), 나머지 전역 상태/시그니처/FS 부작용 없음 |
| maintainability | LOW | DTO 필드+주석 이중 선언 잔존(편집 표면), select 명명 접미사 불일치, JSDoc 누적 — 전부 비블로킹 |
| testing | LOW | 1R WARNING(null wire)이 목록만 닫히고 상세는 미검증(선언/select 테스트가 이중 방어, INFO로 하향) |
| documentation | NONE | 1R INFO 2건 반영 확인, plan/트래커 체크박스 마무리 지연만 잔존(plan 자체 예고 순서) |
| api_contract | NONE | required 전환은 하위 호환·breaking 아님, 버전 범프 불필요, 페이지네이션 부재는 범위 밖 |
| user_guide_sync | NONE | 20개 trigger 중 `backend-api-change` 1개만 매칭, swagger jsdoc·user-guide 페이지 모두 이미 충족 — 갱신 대상 없음 |

## 발견 없는 에이전트

- user_guide_sync — 매칭된 유일한 trigger(`backend-api-change`)의 두 target(swagger jsdoc, user-guide 페이지) 모두 이미 충족되어 발견사항 0건.

## 권장 조치사항

1. 마무리 커밋에서 `plan/in-progress/workflow-version-creator.md`의 `/ai-review`·`--impl-done`·"트래커 두 항목 닫기" 체크박스와 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 `creator` §5.4 항목을 실제 완료 상태로 갱신하고 `--impl-done`을 실행한다.
2. (선택, 급하지 않음) `changeSummary` null 값의 wire 계약 대조를 상세(Detail) 엔드포인트까지 확장 — 테스트 `I`에 `GET .../versions/:id` 재조회 + `assertMatchesContract(..., WorkflowVersionDto)` + `toBeNull()` 추가.
3. (선택, 급하지 않음) `WorkflowVersionListItemDto`/`WorkflowVersionDto`의 `creator`/`changeSummary` 필드+주석 이중 선언을 매핑 타입(`OmitType` 등)으로 파생시켜 구조적 중복 제거.
4. `spec/3-workflow-editor/5-version-history.md` §7.2 응답 타입명 불일치·`## Rationale` 부재는 이미 planner 트래커에 등재됨 — project-planner 턴에서 처분, 이번 결과로 재-flag 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 changeset 과 무관 |
  | architecture | router 판단 — 이번 changeset 과 무관 |
  | dependency | router 판단 — 이번 changeset 과 무관 |
  | database | router 판단 — 이번 changeset 과 무관 |
  | concurrency | router 판단 — 이번 changeset 과 무관 |