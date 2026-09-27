# Code Review 통합 보고서

## 전체 위험도

**HIGH** — 이번 PR이 직접 건드린 `workflows.service.ts` `settings` 병합 분기에서, `PATCH /workflows/:id` 에 `{"settings": null}` 을 보내면 **처리되지 않은 예외로 500 이 발생하는 신규 회귀**가 실측으로 확인됐다(requirement reviewer, 레포 밖 scratch 재현). 고치기 전에는 같은 입력이 조용히 성공(no-op)했다. forced 화이트리스트(security·requirement·scope·side_effect·maintainability·testing·documentation) 7명은 전원 결과를 확보했고 누락은 없다 — 즉 이 CRITICAL은 라우팅 공백이 아니라 실제 코드 리뷰에서 나온 발견이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `PATCH /workflows/:id` 에 `settings: null`(객체 자체가 null)을 보내면 500 회귀. `UpdateWorkflowDto.settings` 는 `@IsOptional()` 이라 `null` 도 400 없이 통과하고 `dto.settings === null` 로 남는데, 서비스의 `settings !== undefined` 가드는 `null` 을 걸러내지 못해 `omitUndefined(null)` → `Object.entries(null)` 에서 `TypeError` 발생, 전역 예외 필터가 500 으로 응답. 수정 전에는 `{...null}` 스프레드가 예외 없이 빈 객체가 되어 같은 입력이 조용히 성공했다. 실측: `dto.settings: null`, `validation errors: []`, `settings !== undefined: true`, `THREW: Cannot convert undefined or null to object` (레포 밖 scratch 재현, 저장소 무변경 확인). 세 호출부 중 필드 전체가 명시적 `null` 이 될 수 있는 곳은 `settings` 뿐이라 다른 두 호출부(`nodes`/`auth-configs`)는 이 결함이 없다. | `codebase/backend/src/modules/workflows/workflows.service.ts:255-259` | `omitUndefined` 를 `obj == null ? {} : ...` 로 null-safe 하게 만들거나, 호출부에서 `if (settings != null)` 로 가드(둘 중 하나 선택 시 "생략=불변" 원칙에 맞춰 null도 무시하는 쪽 권장). `PATCH { settings: null }` 회귀 테스트를 e2e/단위에 추가. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | scope | `nodes.service.ts` 수정이 이 PR의 표제 결함 클래스(undefined 필드가 응답을 덮는 문제)와 다른 결함(IDOR 검사용 `workflow` 관계 전체가 응답에 노출되는 정보 과다노출)을 같은 작업 범위에 함께 고쳤다 — 서비스 반환 타입 자체를 `Promise<Node>` → `Promise<Omit<Node,'workflow'>>` 로 넓혀 원 요청보다 큰 변경. 별도 커밋(`814a99605`)·전용 단위 테스트·뮤턴트 N1·plan 문서화로 격리돼 있어 차단 사유는 아니다. | `codebase/backend/src/modules/nodes/nodes.service.ts:58, 76-83` | 재작업 불요. 향후 유사 상황에서도 "발견 즉시 별도 커밋+별도 plan 절+별도 뮤턴트" 관행 유지 권장. |
| 3 | side_effect, api_contract (중복 관측) | 리뷰 도중 공유 워크트리에서 `nodes.service.ts` `update()` 의 반환문이 일시적으로 `const { workflow: _workflow, ...response } = saved; return response;` 대신 `return saved as unknown as Omit<Node,'workflow'>;`(타입 단언만, 런타임엔 `workflow` 안 지워짐 — 이 PR이 고친 노출 결함을 조용히 재도입하는 형태)로 미커밋 변경돼 있는 것을 두 reviewer가 독립적으로 관측했다. 어느 reviewer도 이 파일을 직접 고치거나 `git checkout/restore` 하지 않았으며, 리포트 작성 시점 재확인 및 본 SUMMARY 작성 시점 재확인(`git status --short`, `git diff --stat HEAD`) 모두 클린 — 이미 destructuring 버전(HEAD)으로 원복되어 있다. | `codebase/backend/src/modules/nodes/nodes.service.ts` (`update()`, 리뷰 시점 한정 uncommitted 상태 — 커밋된 diff엔 해당 없음) | 이미 clean 확인됨(본 SUMMARY 작성 시점 `git status --short`/`git diff --stat HEAD` 모두 무변경). 동일 워크트리를 동시에 쓰는 세션이 있었다는 신호이므로, 향후 최종 push 직전 재확인 습관 유지. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 4 | requirement, testing (중복) | 신규 e2e 케이스 C가 `toolOwnerId` 를 라운드트립 검증하지만 생성 바디에 값을 채우지 않아 저장값·응답값이 항상 `null` — 결함이 재발해도 이 필드에 한해서는 e2e가 가르지 못한다. | `codebase/backend/test/patch-partial-body.e2e-spec.ts` (케이스 C) | `child` 생성 바디에 `toolOwnerId` 값을 채우고 다른 필드처럼 사전 단언 추가. |
| 5 | testing | §5.4 tri-state("키 생략=불변·`null`=초기화·값=설정") 중 "명시적 `null` → 초기화" 경로가 이번 세 서비스 어디에도 새로 테스트되지 않음(기존 폴더/트리거 선례에도 있던 기존 갭이라 이 PR이 새로 만든 결손은 아님). | workflows/nodes/auth-configs 각 `*.service.spec.ts` | 필수는 아니나 최소 한 곳에 "명시적 null이 로드한 값을 지운다" 캐너리 추가 권장. |
| 6 | security | `Object.assign(entity, omitUndefined(dto))` 패턴은 DTO 화이트리스트(`forbidNonWhitelisted`)에 계속 의존하는 mass-assignment 형태 — 이 diff로 신규 도입된 신뢰 경계는 아니며, 병합되는 키 집합 자체는 바뀌지 않았다. | workflows/nodes/auth-configs `*.service.ts` update() | 새 DTO 필드 추가 시 화이트리스트 유지 여부·엔티티에 그대로 얹혀도 되는 필드인지 재확인 권고. |
| 7 | security | `omitUndefined` 가 `null` 을 명시적 "값 지우기"로 남기는 기존 설계상, `WorkflowSettingsDto.maxConcurrentExecutions: null` 이 `@IsOptional()` 때문에 검증을 통과해 JSONB에 저장될 수 있음 — 이 DTO 파일은 이번 diff의 변경 대상이 아니고 런타임 backstop(`resolveConcurrencyCap` 이 부적합 값을 defaultCap 으로 무시)이 이미 있어 기존 의도된 설계. | `codebase/backend/src/common/utils/omit-undefined.ts:15` (JSDoc) | 이번 PR 범위 밖, 참고용. |
| 8 | maintainability | `omitUndefined` 호출 부위 "왜" 주석이 3개 서비스 파일에 거의 동일한 문장 패턴으로 반복 — plan 문서가 이미 "정규식/AST 가드 대신 이 주석+e2e 값 단언" 트레이드오프를 명시적으로 검토·채택. | workflows/nodes/auth-configs `*.service.ts` update() 주석 | 지금은 조치 불요. 다섯째 호출부가 생기면 공용 JSDoc 참조로 축약 고려. |
| 9 | maintainability | `NotArray<T>` 타입 트릭(`T extends readonly unknown[] ? never : unknown` 과 교차)이 비직관적 — 동작·근거(주석+`@ts-expect-error` 캐너리)는 정확하지만 처음 보는 사람에겐 설명 없이 이해하기 어려움. | `codebase/backend/src/common/utils/omit-undefined.ts:1-2, 17-19` | 이 패턴이 다른 헬퍼로 확산되면 "교차는 no-op, 목적은 배열만 never로 좁히는 것" 한 문장 추가 권장. |
| 10 | api_contract, documentation (중복) | `PATCH /nodes/:id` 응답에서 undeclared `workflow` 관계 필드가 제거됨 — `NodeDto`/OpenAPI 에 애초에 선언된 적 없는 필드라 계약 위반(breaking change)이 아니라 계약대로 되돌린 것. 실제 소비 중이던 FE 클라이언트도 조사 결과 없음(plan 문서). | `codebase/backend/src/modules/nodes/nodes.service.ts:78-83` | 조치 불요 — 이미 plan에 근거 기록됨. |
| 11 | documentation | PATCH "키 생략=값 불변" tri-state 계약이 `spec/2-navigation/2-trigger-list.md` 에만 명시되고 워크플로/노드/인증설정 spec 본문엔 없음 — 이미 같은 세션 `--impl-prep` consistency-check(WARNING #2/#4)가 포착해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (6)(7)(8)로 planner 인계 완료. | `spec/2-navigation/1-workflow-list.md` §3.2, `spec/2-navigation/6-config.md` | 이 code-only PR(spec_impact: none) 범위 밖, 중복 지적 불요 — planner 턴 대기 중. |
| 12 | scope | 이 PR과 무관한 기존 spec drift(Schedule 타임존 fallback, W1)를 트래커에 새 백로그로 등재 — `--impl-prep` consistency-check 산출물, 절차적 문서화. | `plan/in-progress/spec-draft-nullable-notation-followups.md:6312-6326` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | `settings: null` PATCH 500 회귀 CRITICAL 1건 실측; e2e toolOwnerId 미검증 INFO |
| security | NONE | 신규 취약점 없음(하드코딩 시크릿/인젝션/암호화 없음); 기존 IDOR 노출은 이미 이 PR에서 수정 확인; mass-assignment/`null` 우회는 기존 설계 |
| scope | LOW | nodes.service.ts에 별개 결함(관계 과다노출) 수정이 번들됐으나 격리·문서화 양호 |
| side_effect | LOW | 리뷰 중 공유 워크트리 일시 오염 관측(현재 원복 확인), 최종 push 전 재확인 권고 |
| maintainability | LOW | 주석 반복·타입 트릭 비직관성 등 경미한 사항, 대부분 plan이 이미 검토한 트레이드오프 |
| testing | LOW | 핵심 뮤턴트 2건(P1/N1) 재현 KILLED 확인, 172개 GREEN; toolOwnerId·명시적 null 경로 커버리지 갭은 INFO |
| documentation | NONE | JSDoc·인라인 주석·CHANGELOG·plan 트래커 정확·일관, 문서화 결함 없음 |
| api_contract | LOW | 계약 위반 없음(응답값이 저장값/선언에 맞춰짐), workflow 필드 제거는 undeclared 필드 원복 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 INFO 이상의 관측/확인 사항을 보고했다(security·documentation은 위험도 NONE이나 양성 확인 항목을 보고).

## 권장 조치사항

1. **(최우선)** `PATCH /workflows/:id` 의 `settings: null` 500 회귀를 고친다 — `omitUndefined` null-safe화 또는 호출부 `!= null` 가드, 회귀 테스트(e2e/단위) 추가. (requirement, CRITICAL)
2. 최종 push 직전 `git status --short` / `git diff --stat HEAD` 로 `nodes.service.ts` 가 HEAD(destructuring 버전)와 일치하는지 한 번 더 확인 — 현재(본 SUMMARY 작성 시점) 확인 결과 이미 clean. (side_effect/api_contract, WARNING)
3. e2e 케이스 C에 `toolOwnerId` 값을 채워 그 필드도 회귀를 가르도록 보강. (requirement/testing, INFO)
4. 여유가 되면 "명시적 null → 초기화" tri-state 경로에 대한 캐너리 테스트를 최소 한 서비스에 추가. (testing, INFO)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(부분 PATCH 병합 필드 필터링)과 관련성 낮음 (세부 사유 미제공) |
  | architecture | router 판단상 이번 변경과 관련성 낮음 (세부 사유 미제공) |
  | dependency | router 판단상 이번 변경과 관련성 낮음 (세부 사유 미제공) |
  | database | router 판단상 이번 변경과 관련성 낮음 (세부 사유 미제공) |
  | concurrency | router 판단상 이번 변경과 관련성 낮음 (세부 사유 미제공) |
  | user_guide_sync | router 판단상 이번 변경과 관련성 낮음 (세부 사유 미제공) |