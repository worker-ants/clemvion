# 요구사항(Requirement) 리뷰

## 검증 방법

diff 로만 판단하지 않고 실제 소스를 직접 열어 대조했다:
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` — `sessions/latest` 라우트 순서·`@ApiOkWrappedNullableResponse`·응답 상태코드(200만).
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts` — `findLatestActive`(status active, `lastInteractionAt DESC`, `findOne` → 없으면 `null`), `create`(`lastInteractionAt: now`).
- `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts` — `AssistantToolCallDto` 의 `result`/`planStepId`/`planStepIds`/`signature` 가 `@ApiPropertyOptional`, `kind: 'explore'` 가 `TOOL_CALL_KINDS` 유효값.
- `codebase/backend/src/shared/testing/response-contract.ts` — 배열 원소마다 내려가는 대조 규칙(주석에 명시) 확인, 테스트 H 의 "두 끝" 전략이 실제로 그 경로를 태우는지 근거 확인.
- `spec/3-workflow-editor/4-ai-assistant.md` §12.2 실행/디버깅(714행) 원문과 `spec/3-workflow-editor/_product-overview.md` ED-DB-05 행(134행)의 표기 선례 대조.
- `git status --short` 로 리뷰 중 저장소 뮤테이션 없음 확인(읽기만 수행).

## 발견사항

- **[INFO]** 테스트 F 의 `expect(latest.body.data.id).toBe(sessionId)` 는 동일 `workflowId` 아래 여러 활성 세션이 존재할 때(테스트 A·B·D 가 세션을 생성만 하고 삭제하지 않아 파일 끝까지 `status: 'active'` 로 남는다) `lastInteractionAt DESC` 순서가 시각(밀리초) 기준이라는 암묵적 가정에 의존한다. HTTP 왕복 지연 때문에 실제로 동시 삽입이 될 가능성은 낮지만, 이 경합을 깨는 명시적 tie-breaker(`id` 보조 정렬 등)는 코드·테스트 어느 쪽에도 없다.
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts` 테스트 F(`it('F. sessions/latest ...')`), 비교 대상 `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:47-61`(`findLatestActive`)
  - 상세: 종전 테스트는 `latest.body.data?.id).toBeDefined()` 로 약하게만 단언해 이 경합을 드러내지 않았다. 이번 강화(`toBe(sessionId)`)는 실제 회귀(라우트 순서·정렬 방향)를 더 잘 잡지만, 동시에 테스트 스위트가 커지며 같은 `workflowId` 에 활성 세션이 누적될수록(타 파일 A/B/D 미삭제) 이론적 tie 리스크가 함께 커진다.
  - 제안: 차단 사유는 아님(경험적으로 안전). 이후 이 suite 에 세션을 더 추가할 계획이 있으면 `lastInteractionAt` 동률 시 `id`/`createdAt` 보조 정렬을 서비스 쪽에 추가하거나, 테스트가 `DELETE` 로 선행 세션을 정리하는 편이 더 견고하다.

- **[INFO]** `plan/in-progress/spec-draft-ed-ai-19-status.md` 의 frontmatter 는 `status: in-progress` 이지만, 이 draft 가 제안한 변경(`spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행에 미구현 표기 추가)은 이번 diff(파일 30)에 이미 실측·적용돼 있다(실제 파일과 대조해 표기·앵커까지 일치 확인).
  - 위치: `plan/in-progress/spec-draft-ed-ai-19-status.md:3` (frontmatter `status`)
  - 상세: `plan-lifecycle.md` 관례상 실제 반영이 끝난 draft 는 `plan/complete/` 로 옮기고 상태를 갱신하는 것이 정상 라이프사이클이다. 다만 같은 PR 의 메인 plan(`assistant-e2e-contract-gaps.md`)도 체크리스트 마지막 두 항목(`/ai-review`, 트래커 항목 닫기)이 아직 미완료로 남아 있어, 이번 review 턴 종료 후 마무리 커밋에서 함께 이동될 가능성이 높다 — 지금 시점에 결함으로 단정하기는 이르다.
  - 제안: 이 PR 을 마무리하는 커밋에서 두 plan 문서(`spec-draft-ed-ai-19-status.md`, `assistant-e2e-contract-gaps.md`) 체크박스 갱신 + `plan/complete/` 이동을 함께 수행할 것.

## 코드 변경(`workflow-assistant.e2e-spec.ts`) 개별 점검 결과 — 이상 없음

- **기능 완전성**: 트래커가 지정한 세 칸(F 의 `data: null` 분기, F 의 상태·id 단언 강화, H 의 도구 호출 "선택 키 전부 생략" 원소) 모두 실제로 diff 에 반영돼 있다.
- **엣지 케이스**: `data: null`(세션 0개), 선택 키 전부 채움/전부 생략 두 극단을 모두 실제 DTO 선언(`@ApiPropertyOptional`)과 대조해 검증했다 — 유효한 판별 입력이다(plan 의 자체 뮤테이션 프로브 결과도 `planStepId` 를 필수로 바꿨을 때만 "전부 생략" 원소가 위반을 내는 것으로 실측돼 있고, DTO 실물 확인으로도 동일하다).
- **에러 시나리오**: `newSession.status`/`emptyWorkflow.status` 를 `201` 로 먼저 확정한 뒤 후속 단언을 진행 — 선행 스텝 실패 시 조용히 넘어가지 않고 그 자리에서 실패한다.
- **반환값/비즈니스 로직**: `sessions/latest` 가 200 만 반환한다는 주석·단언이 컨트롤러 실제 구현과 정확히 일치(`@Get('sessions/latest')` 는 상태코드를 분기하지 않고 `session` 또는 `null` 그대로 반환 → 인터셉터가 `{data: ...}` 로 감쌈).
- **TODO/FIXME**: 없음.
- **spec fidelity**: 변경 대상 e2e 는 어떤 spec 문서의 `code:` 목록에도 등재돼 있지 않다(plan 자체가 `review_guard._spec_linked_changes` 실측으로 명시) — 직접 매핑되는 spec 본문은 없으나, 테스트가 검증하는 동작(`sessions/latest` 필드·상태 전이·널 케이스)은 `spec/3-workflow-editor/4-ai-assistant.md` §6.1·`workflow-assistant-session.service.ts` 구현과 line-level 로 일치한다.

## 부수 spec 변경(`_product-overview.md` ED-AI-19) 점검 결과 — 이상 없음, SPEC-DRIFT 아님

이 항목은 흔한 "코드가 spec 을 앞섰다" 케이스가 아니라 **PRD ↔ 상세 spec 두 문서 간 기존 모순**을 실측(코드에 `ASSISTANT_WORKFLOW_RUNNING` 0건, 프론트 분기 없음)으로 해소한 것이며, 이미 이 diff 안에서 정정이 완료돼 있다.
- 표기 형식(`_(미구현 — 계획, [§4-ai-assistant §12.2](...))_`)이 같은 문서 ED-DB-05 행의 기존 관례와 정확히 일치.
- 앵커(`122-실행디버깅`)가 대상 헤딩(`### 12.2 실행/디버깅`)과 일치.
- 요구사항 문장·우선순위(`필수`)는 보존 — "이행 여부 표기"만 정정했다는 draft 의 설명과 실제 diff 가 부합.
- 이번 developer 세션이 `spec/` 을 직접 고친 근거는 "자기-반증형 소정정" 예외가 아니라 **project-planner 턴**(`spec-draft-ed-ai-19-status.md`, owner: project-planner)을 통했다는 점도 plan 문서·`--spec` 게이트(`16_27_26` BLOCK: NO) 기록으로 확인된다 — 절차 위반 없음.

## 게이트 이력 확인

`--impl-prep`(`16_14_14` BLOCK: YES → planner 턴 → `16_35_16` BLOCK: NO)의 최종 SUMMARY 를 직접 열어 "5개 checker 모두 Critical 없음"을 확인했다. Critical 원인(ED-AI-19 모순)은 이 작업의 코드 결함이 아니라 선행 spec drift 였고, 별도 plan(`spec-draft-ed-ai-19-status.md`)으로 이미 해소됐다.

## 요약

핵심 변경은 `workflow-assistant.e2e-spec.ts` 의 테스트 강화 세 곳(세션-無 `data: null` 분기, 테스트 F 상태·id 단언 강화, 테스트 H 도구 호출 "전부 생략" 원소 추가)이며, 실제 컨트롤러·서비스·DTO 코드를 직접 열어 대조한 결과 테스트가 주장하는 모든 동작(라우트 순서, 정렬 기준, 응답 상태코드, 선택 필드의 optional 여부)이 구현과 정확히 일치한다. 함께 포함된 PRD 문서 정정(ED-AI-19 미구현 표기)도 관련 상세 spec·기존 표기 관례와 line-level 로 일치하며, planner 턴을 거쳐 절차상 하자 없이 반영됐다. CRITICAL/WARNING 급 결함은 발견되지 않았고, 남은 두 INFO(세션 정렬의 암묵적 tie-breaker 부재, 두 plan 문서의 `in-progress` 잔존)는 이번 PR 의 마무리 커밋에서 자연스럽게 해소될 수 있는 낮은 리스크다. 리뷰 중 저장소에 어떤 파일도 쓰지 않았다(`git status --short` 로 확인, untracked 는 리뷰 산출물 디렉터리뿐).

## 위험도

NONE
