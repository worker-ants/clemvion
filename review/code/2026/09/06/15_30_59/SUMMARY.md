# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 4건 모두 저위험이며 근거·실측·테스트가 이미 갖춰져 있거나 planner 후속 항목으로 정당하게 위임되어 있음. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과 확보됨(누락 없음) — router 강제 이행 정상.

## Critical 발견사항

없음 — 8개 reviewer 전원 Critical 발견 0건.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `WorkspacesService.listMembers`가 여전히 `User`를 투영 없이(`relations: ['user']`) 로드하고, JS 레벨 수동 매핑으로만 `email`/`name`을 좁힌다. 신규 구조 가드(`user-entity-exposure-guard.ts`)는 TypeORM `select`/`relations` 형태만 보므로 이 자리는 보호 범위 밖 — 현재 유일한 안전망은 런타임 테스트(검출)뿐, 강제(enforcement)가 아니다. | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `listMembers` | 장기적으로 `select: { user: { id, email, name } }` 투영을 적용해 구조 가드의 보호 범위 안으로 들여올 것을 고려 |
| 2 | Testing | YAML frontmatter 파서의 "인용 스칼라 + 트레일링 주석" 버그 수정에 대한 회귀 테스트가 block-list 형태에만 추가됨. 같은 헬퍼(`_strip_comment`)를 타는 단일값/인라인 리스트 형태는 회귀 테스트가 없다(현재 구현 자체는 정확함을 직접 실행해 확인 — 활성 버그 아님, 커버리지 공백). | `.claude/hooks/_lib/review_guard.py` `_strip_comment`; `.claude/tests/test_review_guard.py` | 단일값(`code: "a.ts"  # note`), 인라인 리스트(`code: ["a.ts","b.ts"]  # note`) 형태에도 인용 스칼라+트레일링 주석 케이스 추가 |
| 3 | Documentation | `_strip_comment`의 docstring이 "따옴표 없는 스칼라만" 처리한다고 적혀 있는데, 이번 커밋이 추가한 새 분기(`if quote:`)는 정확히 그 반대(따옴표 **있는** 스칼라)를 처리한다 — 같은 결함 클래스(트레일링 주석 처리)가 세 번째로 한 칸씩 좁게 닫혀온 이력이 있어, docstring이 실제 분기를 반영 못 하면 4번째 재발 위험을 키운다. | `.claude/hooks/_lib/review_guard.py` `_strip_comment` (626~641행) | docstring 첫 줄을 "따옴표 유무에 따라 갈라 처리 — 언쿼트는 ` #` 이후, 인용 스칼라는 닫는 따옴표 뒤를 자른다"로 갱신 |
| 4 | API Contract | 에러 봉투 `details` 필드가 배열(검증 오류, `§5.3` 명문화된 유일한 형태)과 객체(단일 도메인 예외) 두 형태로 쓰이는데, 이번 diff가 신설한 `TRIGGER_ENDPOINT_PATH_CONFLICT`도 `{ field, code }` 단일 객체 형태(message 키 없음)라 `§5.3` 미명문화 상태가 유지된다. `ErrorResponseBodyDto.details`가 `unknown`으로 느슨히 선언돼 있어 OpenAPI 계약 파손은 없으나, 배열을 가정하는 제네릭 에러 클라이언트가 있다면 런타임 위험. | `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict`; `spec/5-system/2-api-convention.md §5.3` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(443~455행)에 planner 후속 항목으로 등재됨 — 이번 PR 범위 조치 불요, 다음 planner 턴에서 §5.3에 array/object 택일 기준 명문화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / API Contract / Side Effect | (수정 확인) `WorkflowVersionsService.findOne`이 `relations: ['creator']`(무투영)로 `User` 전 컬럼(`passwordHash`·`twoFactorSecret`·복구 코드·토큰 등)을 워크스페이스 viewer 포함 전 멤버에게 노출하던 기존 Critical 유출을, 이 diff가 `select: CREATOR_PROJECTION({id,name,email})`으로 닫음. e2e(`assertMatchesContract`+`expectNoUserSecrets`)로 회귀 고정. | `workflow-versions.service.ts`, `workflow-versions.controller.ts`, `workflow-crud.e2e-spec.ts` `H.` | 조치 불요 — 이미 닫힘 |
| 2 | Security | `User` 엔티티에 데이터 계층 방어(`select:false`/`@Exclude()`/전역 직렬화 인터셉터)가 여전히 0건 — 3축(구조 AST 가드/이름 스캔/JSDoc 인용 가드) 모두 탐지(detection)이지 방지(prevention)가 아님. 대안(select:false)은 46개 호출지점 회귀 위험 때문에 실측 근거와 함께 기각된 명시적 아키텍처 결정. | `user.entity.ts`, `user-entity-exposure-guard.ts`, `user-secret-absence.ts` | 조치 불요(근거 있는 채택 결정). 향후 `pendingEmail` 등 PII성 필드도 이름 축 확장 고려 |
| 3 | Security / Side Effect | `TriggersService`의 UNIQUE 위반 처리(`isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict`)는 SQL 원문·제약명 등 내부 정보를 wire에 노출하지 않고, 매칭 안 되는 다른 UNIQUE 위반은 그대로 재throw — 안전 | `triggers.service.ts` | 조치 불요 |
| 4 | Security | `review_guard.py` frontmatter 파서 정규식 3개는 선형시간·비-사용자입력(저장소 내부 spec)이라 ReDoS/인젝션 위험 없음. 신규 테스트의 시크릿형 리터럴은 전부 명백한 더미. | `.claude/hooks/_lib/review_guard.py`, `workspaces.service.spec.ts` | 조치 불요 |
| 5 | Requirement | 신규 검출 2축(`user-entity-exposure-guard.ts`, `user-secret-absence.ts`)이 아직 spec `§5.4`/`swagger.md §5-1`의 `code:` glob에 등재되지 않음 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 후속 항목으로 등재된 상태(JSDoc 인용 축은 이미 등재 완료). | `spec/5-system/2-api-convention.md §5.4`, 신규 가드 4파일 | 조치 불요 — 다음 planner 턴에서 등재 예정 |
| 6 | Requirement / Scope / Side Effect / API Contract | `WorkspaceMemberDto.joinedAt` 필드 추가는 `WorkspacesService.listMembers`가 이미 wire로 내보내던 값(`joinedAt: m.joinedAt`)에 뒤늦게 DTO 선언을 맞춘 것 — spec은 이 필드에 침묵, 런타임 응답 불변, 하위 호환 문제 없음(additive). | `workspace-response.dto.ts:81-93`, `workspaces.service.ts:223` | 조치 불요 |
| 7 | Scope | 트리거 `endpoint_path` UNIQUE 충돌 처리, `review_guard.py` YAML 파서 수정은 "User 컬럼 방어"라는 워크트리 본래 목적과 무관한 두 개의 별개 관심사이나, 파서 수정 → `workspace-response.dto.ts` spec-linked화 → `2-trigger-list.md` 게이트 범위 진입이라는 연쇄로 같은 PR에 합류했다. 커밋 메시지·CHANGELOG에 원인·실측이 투명하게 공개되어 은폐성 스코프 확장은 아님. | `triggers.service.ts`, `pg-error.ts`, `.claude/hooks/_lib/review_guard.py` | 조치 불요 — 향후 유사 상황에서는 가능하면 별도 PR 분리 검토 권고 |
| 8 | Scope | `spec/conventions/review-citations.md`·`spec-impl-evidence.md` 편집은 developer가 아니라 정식 planner 턴(`90c1751e8`)이 만든 문장의 정정으로, `git log -S` 대조 및 취소선 보존 방식이 CLAUDE.md 절차와 일치 — spec 쓰기 권한 이탈 아님. | `spec/conventions/review-citations.md`, `spec-impl-evidence.md` | 조치 불요 |
| 9 | Scope | 신규 e2e 라벨(`workspace-rbac.e2e-spec.ts` `J.`, `workflow-crud.e2e-spec.ts` `H.`)은 파일 내 유일·순서 유지 — 이전 라운드가 지적한 `F.` 라벨 충돌 재발 없음(직접 확인) | `workspace-rbac.e2e-spec.ts`, `workflow-crud.e2e-spec.ts` | 조치 불요 |
| 10 | Maintainability | PG 에러 duck-typing이 `pg-error.ts`의 기존 SoT(`pgErrorCode`)에 `pgErrorConstraint`를 추가하는 방향으로 수렴(4번째 사본 생성 대신 재사용으로 되돌림). YAML 파서 트레일링 주석 처리는 3연속 협소화 끝에 인용/비인용 스칼라를 명시적으로 갈라 반대 방향 대조군까지 테스트로 고정. | `pg-error.ts`, `review_guard.py` | 조치 불요 |
| 11 | Testing | 트리거 UNIQUE 충돌의 서비스 레벨 통합 테스트(`it.each` 409+details 검증)가 `driverError` 표면 하나만 사용 — 술어 자체(`isEndpointPathUniqueViolation`)는 두 표면(driverError/top-level) 모두 별도 테스트로 커버되어 실질 위험은 낮음. | `triggers.service.spec.ts` | 통합 테스트에도 `surface` 축 추가 고려, 또는 술어 테스트만으로 충분한 이유를 주석으로 명시 |
| 12 | Documentation | 직전 라운드(`14_59_48`) WARNING #1(SoT 우회)·#2(엔티티 대조 부재)·#5(단위 테스트 부재)·#6(CHANGELOG 누락)이 이번 커밋에서 실제로 해소됨을 직접 대조 확인 | `pg-error.ts`, `user-secret-absence.spec.ts`, `workspaces.service.spec.ts`, `CHANGELOG.md:127-137` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `WorkflowVersionsService.findOne` 기존 Critical 유출 수정 확인 / `listMembers` 무투영 로드는 런타임 테스트만 보호(WARNING) |
| requirement | LOW | 핵심 주장(관계 이름 집합·투영 없는 로드 지점·비밀 컬럼 7개·트리거 계약·파서 회귀·spec 문장) 전수 재확인, 새 결함 없음 |
| scope | LOW | 핵심 목적 밖 두 관심사(트리거 계약, harness 파서 수정)가 게이트 확장 연쇄로 합류했으나 투명하게 문서화됨 |
| side_effect | LOW | `.catch()` 추가·반환타입 축소·필드 추가 모두 안전한 방향, 신규 가드 3종 전부 읽기전용 정적분석(쓰기/네트워크 0건) |
| maintainability | LOW | 이전 라운드 지적 전부 해소, 이번 델타는 SoT 수렴·파서 협소화 마무리로 결함 없음 |
| testing | LOW | 매우 높은 테스트 품질, WARNING 1건(인용스칼라 회귀 테스트 커버리지 갭)·INFO 1건(표면 하나만 통합 테스트) |
| documentation | LOW | 이전 WARNING 4건 해소 확인, WARNING 1건(docstring이 새 분기와 반대 방향 서술) |
| api_contract | LOW | 계약 위반을 닫는 방향의 변경들, WARNING 1건(`details` array/object 이형, 이미 tracked) |

## 발견 없는 에이전트

없음 — 8개 에이전트 전원 최소 INFO 이상 발견을 보고함(Critical/Warning 없이 "문제 없음" 확인만 보고한 항목 다수 포함).

## 권장 조치사항

1. `_strip_comment`의 docstring을 실제 분기(따옴표 유무 양쪽)를 반영하도록 갱신 — 같은 결함 클래스가 이미 3번 좁게 닫혀온 이력이 있어 4번째 재발을 막는 가장 저비용 조치.
2. YAML frontmatter 파서의 인용 스칼라+트레일링 주석 회귀 테스트를 단일값/인라인 리스트 형태에도 추가.
3. `WorkspacesService.listMembers`를 TypeORM `select` 투영으로 전환해 구조 가드(`user-entity-exposure-guard.ts`)의 보호 범위 안으로 편입 — 장기 과제.
4. 트리거 UNIQUE 충돌 통합 테스트에 `surface` 축(driverError/top-level) 추가, 또는 현재 상태 유지 사유를 주석으로 명시.
5. (이미 tracked, 참고) `details` 필드 array/object 이형과 신규 검출 2축의 `code:` 미등재는 다음 planner 턴에서 `§5.3`/`§5.4` 명문화로 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff와 관련성 낮음 |
  | architecture | router 판단상 이번 diff와 관련성 낮음 |
  | dependency | router 판단상 이번 diff와 관련성 낮음 |
  | database | router 판단상 이번 diff와 관련성 낮음(마이그레이션 신규 추가 없음) |
  | concurrency | router 판단상 이번 diff와 관련성 낮음 |
  | user_guide_sync | router 판단상 이번 diff와 관련성 낮음(사용자 대면 문서 변경 없음) |