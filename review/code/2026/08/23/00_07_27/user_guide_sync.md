STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read.

## 변경 파일 컨텍스트
- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (신규)
- `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` (신규, 캐너리 테스트)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (`@ApiBody({ type: ExecuteWorkflowDto })` 추가)
- `plan/in-progress/execute-body-openapi.md` (신규 plan)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (트래커 항목 종결 + 신규 이연 항목 등재)
- `review/consistency/2026/08/22/23_46_23/**` (직전 `/consistency-check` 산출물 — BLOCK:NO, Critical 0)

## 매칭된 trigger
`dto/**` + `*.controller.ts` 글롭이 매트릭스 `backend-api-change` 행(semantic)에 매칭된다:

> "백엔드 API 추가·변경 | (a) controller·DTO 의 swagger jsdoc<br>(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"

다른 행(새 노드 추가·노드 schema 변경·신규 UI 문자열·통합/제공자 변경·신규 섹션 디렉토리·인증/세션 흐름·표현식 언어·실행/디버깅 흐름·신규 warning/error code)은 이 changeset 의 어떤 파일과도 매칭되지 않는다 — `codebase/backend/src/nodes/**` 변경 없음, `*.tsx` 변경 없음, `auth/**` 변경 없음, `expression-engine/**` 변경 없음, 새 `docs/<NN>-*/` 디렉토리 없음, `ErrorCode` enum·`warningRules` 변경 없음.

## 동반 갱신 검증

### (a) swagger jsdoc — 충족
`ExecuteWorkflowDto`(`execute-workflow.dto.ts` 1-53줄)가 `@ApiPropertyOptional` 로 `parameterValues`/`input` 양쪽 필드에 상세 description 을 달았고, `workflows.controller.ts` 253-256줄이 `@ApiBody({ type: ExecuteWorkflowDto, required: false })` 로 배선했다. 이 changeset 자체가 target (a) 이므로 누락 없음.

### (b) API 노출 변경이 사용자 안내에 영향 — 갭 없음으로 판단
이 PR 은 **런타임 동작을 한 줄도 바꾸지 않는** 것이 명시적 설계 결정이다(`execute-workflow.dto.ts` docstring 6-24줄, `plan/in-progress/execute-body-openapi.md` "핵심 판단" 절). `@Body()` 파라미터는 인라인 타입을 그대로 유지해 `CustomValidationPipe` 가 여전히 검증을 skip 하고, `workflows-execute-body.spec.ts` 가 그 사실을 캐너리로 고정한다(빈 객체·여분 키 모두 통과 확인). 즉 API 계약(요청/응답 shape, 허용 필드, 에러 코드)이 **바뀐 게 없다** — 문서화되지 않았던 기존 동작(마스킹 마커 재제출 거부 `MASKED_VALUE_RESUBMITTED`, 레거시 `input.parameters` 봉투)을 Swagger 스키마에만 명문화했다.

이 마스킹 재제출 거부 UX 는 이미 `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` 134번째 줄에서 Re-run 흐름 관점으로 문서화돼 있다("자격증명으로 판별된 입력은 `***` 로 가려져 있어 프리필되지 않아요 — 직접 입력하기 전까지 Re-run 이 비활성되고, **원본 입력 그대로 사용**을 켜면 서버가 원본을 직접 읽어 실행"). `02-nodes/triggers.mdx` 55-56줄도 `POST /workflows/:id/execute` + `parameterValues` 예시를 이미 담고 있다. 따라서 target (b) 가 요구하는 "사용자 안내"는 이미 커버돼 있고, 이번 PR 이 그 커버리지를 축소·모순시키지도 않는다.

방금 전에 실행된 `/consistency-check`(`review/consistency/2026/08/22/23_46_23/SUMMARY.md`, BLOCK:NO, Critical 0)도 cross_spec·rationale_continuity·convention_compliance·plan_coherence·naming_collision 5개 checker 로 이 diff 를 검토했고, user-guide MDX 갱신 누락을 지적한 항목은 0건이다(WARNING 1건은 `swagger.md §1-4` 의 `type: Object` vs `additionalProperties: true` 표기 규약이며 본 리뷰어 영역 밖).

## 발견사항
없음.

## 요약
매트릭스 21개 행 중 `backend-api-change`(semantic) 1개가 diff 의 `dto/**` + `*.controller.ts` 변경에 매칭됐다. target (a) swagger jsdoc 는 이 changeset 자체가 충족하고, target (b) user-guide 페이지 영향은 이 PR 이 런타임 동작을 전혀 바꾸지 않는(캐너리 테스트로 고정된) OpenAPI 문서화 전용 변경이며 관련 사용자 동작(마스킹 재제출 거부)이 이미 `05-run-and-debug/run-results.mdx`·`02-nodes/triggers.mdx` 에 문서화돼 있어 동반 갱신 누락으로 보지 않는다. 다른 20개 행은 트리거 글롭/semantic 조건에 매칭되는 파일이 changeset 에 없다. 누락 0건.

## 위험도
NONE
