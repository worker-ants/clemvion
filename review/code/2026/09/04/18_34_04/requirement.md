# 요구사항(Requirement) 리뷰 — `QueryExecutionDto.workflowId` 죽은 쿼리 파라미터 제거

## 검증 방법

저장소 파일은 뮤테이션하지 않고 `Read`/`Grep`/`Bash`(read-only)로 diff 의 4개 파일(`CHANGELOG.md`,
`query-execution.dto.ts`, `swagger-dto-contract-guard.ts`, `plan/in-progress/spec-draft-nullable-notation-followups.md`)과
관련 소비처(controller, service, spec, e2e, frontend, `PaginationQueryDto`)를 대조했다. 저장소 트리는
변경하지 않았다(`git status --short` 확인 — 리뷰 산출물 디렉터리만 untracked).

## 발견사항

- **[WARNING]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "종결 조건" 서술이 이
  diff 로 인해 즉시 stale 해졌다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:368-370` (실제 파일 줄 번호,
    `Read` 로 재확인)
  - 상세: 368~370행은 *"현재 열려 있는 것은 **넷**이다"* 라고 단언하지만, 바로 아래 372~377행
    추적 표는 이 diff 가 `QueryExecutionDto.workflowId` 행을 취소선(`~~...~~`, **종결**)으로 바꾸면서
    이제 표 4행 중 **2행만 미종결**(`§5.4 drift 2단계`, `idx_schedule_next_run`)이다. `## 후속`
    섹션의 실제 미체크(`[ ]`) 항목 수도 정확히 2개로 이와 일치한다. 즉 "넷" 은 이 diff 가 수정한
    바로 그 표와도, 체크박스 개수와도 더 이상 맞지 않는다. 이 diff 는 372~377행(표)은 갱신했지만
    368~370행(서술)은 갱신하지 않아 같은 섹션 안에서 숫자가 어긋났다 — `feedback_stale_plan_claims_and_checklist_sync.md`
    가 지적한 것과 같은 클래스의 결함("체크박스 두 군데" 비동기화)이 이번에도 재발했다.
  - 제안: "넷" → "둘"로 정정하거나(가장 직접적), 아니면 그 문장이 "표의 총 행 수"를 뜻하는
    것이라면 "열려 있는 것은" 대신 "추적 중인 항목은" 등으로 표현을 바꿔 open/closed 혼동을
    없앤다. 코드 변경(DTO/가드) 자체는 옳으므로 이 항목은 plan 문서 정확성 문제에 한정된다.

- **[INFO]** `@Transform` 예외 실사례 개수(1,095 / 17 / 0)는 세 문서(`CHANGELOG.md`,
  `swagger-dto-contract-guard.ts` 주석, plan 파일 체크박스 항목)에 걸쳐 **상호 일관**되게
  기록돼 있다. AST 기반 재집계 로직(`findSwaggerContractMismatches`)이 실제로 `[대조군]
  @Transform 예외` 픽스처(`swagger-dto-contract.spec.ts:173-191`)로 뒷받침되는 것도 확인했다 —
  숫자 자체를 전수 재현하지는 않았으나(별도 AST 스캔이 필요해 이 리뷰 범위를 벗어남), 방법론
  서술과 코드상 근거는 일치한다.

## 교차검증한 사실관계 (정합 확인됨)

- `QueryExecutionDto` 에서 `workflowId`(`@IsOptional`+`@IsUUID`+`@Transform`) 필드와 미사용이 된
  `IsUUID`/`Transform` import 를 함께 제거 — 파일 내 다른 곳에서 `Transform` 을 쓰지 않음을 확인,
  dangling import 없음.
- `ExecutionsService.findByWorkflow`(`executions.service.ts:750-756`)는 실제로
  `{page, limit, sort, order, status}` 만 구조분해하고 `query.workflowId` 를 참조하지 않음 —
  CHANGELOG/plan 의 "서비스가 읽지 않는다" 주장과 정확히 일치.
  - 코드: `executions.service.ts:746` `findByWorkflow(workflowId: string, query: QueryExecutionDto)`
- 컨트롤러의 `@ApiParam({ name: 'workflowId', ... })`(`executions.controller.ts:97-101`)는 경로
  파라미터 문서화이며 제거된 쿼리 필드와 무관 — 잔존 Swagger 선언 없음, OpenAPI 노출 완전 제거 확인.
- `PaginationQueryDto`(부모 클래스)에는 `workflowId` 필드가 없어 상속으로 되살아나지 않음.
- `spec/2-navigation/14-execution-history.md:345`(및 "목록 API 쿼리 파라미터" 표, `:352-357`)는
  `page/limit/sort/order/status` 만 약속하고 `workflowId` 를 문서화한 적이 없음 — 이번 제거가
  spec 이 약속한 계약을 위반하지 않음(spec 과 line-level 로 불일치하는 부분 없음).
- frontend `codebase/frontend/src/lib/api/executions.ts:208` 의 `getByWorkflow` 호출은 경로
  파라미터만 쓰고 `workflowId` 를 쿼리로 보내지 않음 — 클라이언트 소비처 없음 확인.
- `forbidNonWhitelisted: true` 가 전역 `ValidationPipe`(`common/pipes/validation.pipe.ts:31`)에
  실제로 걸려 있어, CHANGELOG 가 예고한 "미지 쿼리 키 400" 영향 서술이 근거 있음.
- 백엔드 e2e(`workflow-execution.e2e-spec.ts:108-133`)는 `workflowId` 를 쿼리로 보내지 않아 이
  변경으로 깨지지 않음. 이 DTO 를 전용으로 검증하는 unit spec 파일은 존재하지 않아 별도 테스트
  파손도 없음.
- `swagger-dto-contract-guard.ts` 주석의 수치 전환(1,096→1,095 필드, 18→17개 `@Transform`,
  1→0개 null-축 불일치)은 `workflowId` 필드 삭제 1건과 정확히 정합.

## 요약

핵심 변경(죽은 `workflowId` 쿼리 필터 제거)은 기능적으로 완전하고 안전하다 — 서비스·컨트롤러·
부모 DTO·spec·frontend·e2e 전수 교차검증 결과 잔존 참조나 파손되는 소비처가 없으며, 제거로 인한
행동 변화(미지 쿎리 키 400)도 CHANGELOG 서술과 실제 글로벌 `ValidationPipe` 설정이 일치한다.
spec 본문(`14-execution-history.md`)도 애초에 이 필드를 약속한 적이 없어 spec-fidelity 위반이
없다. 유일한 결함은 코드가 아니라 부속 plan 문서(`spec-draft-nullable-notation-followups.md`)의
"종결 조건" 서술이 같은 diff 가 갱신한 추적 표·체크박스 개수와 어긋나게 stale 해진 것 — 사실관계
오류이지만 코드 동작에는 영향이 없다.

## 위험도

LOW
