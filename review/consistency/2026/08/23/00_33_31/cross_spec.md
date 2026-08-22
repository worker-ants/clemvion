# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-done)

## 조사 방법 메모

프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/` 17개 파일 중 `2-api-convention.md`·
`3-error-handling.md`·`12-webhook.md`·`13-replay-rerun.md` 4개(+ Re-run Rationale 조각)만
본문이 실렸고, `<git diff origin/main...HEAD -- code_areas>` 자체를 포함한 나머지 15개 파일과
"관련 spec 본문" 섹션은 **전량 절단**됐다("본문 생략됨" 표시). 이를 "해당 내용이 없다"의
근거로 삼지 않고, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/execute-body-dto-c37965`)
에서 `git diff origin/main...HEAD --stat`·`git log`·실제 코드/spec 파일을 직접 읽어 교차검증했다.

## 배경 확인

이 라운드의 실제 diff (39 files, +2472/-1)는 거의 전부 `plan/`·`review/**`(직전 라운드 산출물)
이고, **`spec/` 디렉터리는 이번 diff 에서 단 한 줄도 변경되지 않았다**
(`git diff origin/main...HEAD --stat -- spec/` → 빈 출력). 실질 코드 변경은 3파일뿐:

- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (신규) — `POST
  /workflows/:id/execute` 요청 본문을 위한 **OpenAPI 스키마 전용** DTO (`@Body()` 파라미터는
  여전히 인라인 `{ input?, parameterValues? }` 타입 유지, class-validator 데코레이터 없음).
- `workflows.controller.ts` — `@ApiBody({ type: ExecuteWorkflowDto, required: false })` 1줄
  추가.
- `workflows-execute-body.spec.ts` (신규) — 런타임 계약 무변경 캐너리 + OpenAPI 노출 가드.

`plan/complete/execute-body-openapi.md`(`spec_impact: none`)와 정본 트래커
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 항목("`execute` 본문의 여분 키를
400 으로 거부할 것인가"는 이연 결정으로 신규 등재)도 이 사실과 일치한다. 즉 이번 target 은
API 계약을 바꾸지 않는 순수 문서화 변경이다.

## 발견사항

CRITICAL/WARNING 급 충돌 없음. 확인한 교차 참조는 모두 정합했다:

- **데이터 모델/API 계약**: 신규 DTO 의 필드 `{ parameterValues?, input? }` 는
  `spec/4-nodes/7-trigger/0-common.md:30`("`POST /workflows/:id/execute { parameterValues }`")
  · `spec/data-flow/10-triggers.md:41`("`POST /api/workflows/:id/execute {
  parameterValues?, input? }`") · `spec/5-system/4-execution-engine.md:788`(컨트롤러가
  `{ parameterValues }` 수신) 세 문서가 기술하는 wire shape 와 필드명·optionality 모두
  일치한다. `@Body()` 파라미터의 인라인 타입도 diff 확인 결과 그대로 유지되어(`workflows.controller.ts:281-285`),
  DTO 는 문서 표면만 추가할 뿐 실제 계약을 바꾸지 않는다.
- **요구사항 ID**: `SoT: EIA §R17` 참조는 `spec/5-system/14-external-interaction-api.md` 의
  `R17` 절("getStatus 의 currentNode/context 실값 노출 … egress 마스킹")과 동일 의미로
  일치하며, 이는 `error-codes.md:129`·`3-error-handling.md:195`·`12-webhook.md:312`·
  `13-replay-rerun.md:246` 등 기존 다수 문서가 `MASKED_VALUE_RESUBMITTED` 정의 SoT 로
  이미 지목해 온 절과 같다 — 신규 ID 충돌 없음, 기존 카탈로그 확장에 정확히 부합.
- **Swagger 설명 길이 규약**: 신규 DTO 두 필드의 긴 설명은 `spec/conventions/swagger.md
  §3`(2026-08-22 커밋 `4ba15859f` 로 "요청 필드까지" 확장된 보안·정책 캐비엇 예외 — "요청
  값이 정책으로 거부될 수 있는 필드(예약어·재제출 금지 값 등)")에 정확히 해당하는 사례다.
  해당 예외는 이번 작업이 근거로 든 바로 그 규약이며, 위반이 아니라 그 규약이 미리 넓혀 둔
  범위를 채우는 사례다.
- **열린 map 규약(`swagger.md §1-4`)**: `parameterValues`/`input` 은 `additionalProperties:
  true` 로 선언돼 있는데, 두 값 다 (Manual Trigger 스키마별 파라미터·레거시 입력 봉투) 키
  집합이 런타임에 결정되는 **진짜 열린 map** 이라 §1-4 가 금지하는 "닫힌 union 을
  additionalProperties 로 뭉갬" 에 해당하지 않는다.
- **동명 필드 구분**: 같은 컨트롤러 모듈의 `ExecuteNodeDto.input`(단일 노드 실행, 노드 입력
  값 자체)과 신규 `ExecuteWorkflowDto.input`(워크플로 실행, `parameters` 를 담는 레거시
  봉투)은 이름이 같지만 의미가 다르다 — 신규 DTO JSDoc 이 이를 명시적으로 구분해 두어
  요구사항 ID/필드 충돌로 오인될 소지를 이미 차단했다(직전 라운드 INFO 반영 확인).
- **RBAC/권한**: `execute()` 의 `@Roles(...)` 가드·워크스페이스 스코핑은 diff 에서 변경되지
  않았다 (`@ApiBody` 데코레이터 추가 1줄, import 1줄뿐) — `1-auth.md §3.2` RBAC 매트릭스와의
  정합은 직전 impl-prep 라운드(`23_46_23`)에서 이미 확인된 상태 그대로 유지된다.
- **계층 책임**: DTO 는 "OpenAPI 스키마 보유자" 로만 쓰고 런타임 검증·해석(`resolveTriggerParametersRejectingMasked`)
  은 여전히 기존 서비스 계층(`execution-engine`)이 담당 — `spec/5-system/2-api-convention.md`
  가 규정하는 컨트롤러/서비스 책임 분할과 어긋나지 않는다.
- **직전 코드 리뷰(`review/code/2026/08/23/00_24_55/SUMMARY.md`)** 도 독립적으로 Critical 0 ·
  Warning 0 · 위험도 NONE 을 보고했으며, INFO 항목(13건)은 전부 문서 표면 세부(설명 길이·
  중복 표·비공개 메타데이터 키 의존 등)로 cross-spec 관점의 모순이 아니다.

## 요약

이번 target(`spec/5-system/`)의 diff 는 `spec/` 하위 어떤 파일도 변경하지 않았다 — 실질
변경은 `POST /workflows/:id/execute` 요청 본문을 위한 OpenAPI 문서 전용 DTO 1개 신설과
컨트롤러 데코레이터 1줄이며, `@Body()` 파라미터의 런타임 타입·검증 동작은 캐너리 테스트로
무변경이 실측 고정되어 있다. 신규 DTO 가 참조하는 필드 shape·요구사항 ID(EIA §R17)·Swagger
설명 길이 예외·열린 map 규약은 모두 기존 `spec/**` 문서(트리거 §0-common, data-flow §10,
execution-engine §, error-codes, swagger.md §3)와 정확히 일치했고, RBAC·계층 책임 어느
관점에서도 새로운 충돌을 만들지 않았다. 직전 impl-prep 라운드(`23_46_23`, 위험도 NONE)의
결론이 impl-done 시점에도 그대로 유지된다.

## 위험도

NONE
