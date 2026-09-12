# 요구사항(Requirement) 리뷰 — trigger-uuid-and-guide-codes

## 검증 요약

`rotateBotToken`(`triggers.controller.ts`)의 `:id` 에 `ParseUUIDPipe` 부재로 비-UUID 입력이
Postgres SQLSTATE 22P02 → `GlobalExceptionFilter` 의 세 분기(`HttpException` · http-error-like ·
`isPostgresUniqueViolation(23505)`) 어디에도 안 걸려 `500 INTERNAL_ERROR` 로 마스킹된다는 핵심
주장을, 아래 세 파일을 직접 열어 코드 레벨로 실측 확인했다 — **정확**.

- `codebase/backend/src/common/filters/http-exception.filter.ts`: `QueryFailedError`(22P02)는
  `HttpException` 도 `isPostgresUniqueViolation` 도 아니고 `status`/`statusCode` 필드가 없어
  `mapHttpErrorLike` 도 `null` 반환 → `else` 분기로 떨어져 `status=500, code='INTERNAL_ERROR'`
  유지. 마스킹 주장과 정확히 일치.
- `triggers.service.ts:342` `findById` → `triggerRepository.findOne({where:{id, workspaceId}})`,
  트리거 미존재 시 `NotFoundException({code:'RESOURCE_NOT_FOUND'})` — 가이드 MDX 4곳 수정
  (`TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND`)과 정확히 일치.
- `Trigger` 엔티티 PK 가 `@PrimaryGeneratedColumn('uuid')` — 실 트리거 ID 는 항상 UUID 이므로
  `ParseUUIDPipe` 추가로 깨지는 정상 케이스 없음.

`param-uuid-pipe` AST 가드도 직접 실행해 확인 — `codebase/backend`에서
`npx jest src/repo-guards/__tests__/param-uuid-pipe.spec.ts` → 7/7 통과. 관련 컨트롤러
회귀 스위트(`triggers.controller.spec.ts` · `auth.controller.spec.ts` · `src/repo-guards` 전체)
도 16 suites / 267 tests 전부 통과. `grep` 으로 `codebase/backend/src/modules/**/*.controller.ts`
전수를 다시 세어 "id-형 `@Param` 136건 중 파이프 없는 자리 0건"(수정 후) 주장도 확인했다 —
비-id-형 9건(`provider`×3·`installToken`×2·`endpointPath`×2·`token`·`type`)도 claim 과 정확히
일치. `MCP_ALLOW_INSECURE_URL` 실재 여부(`.env.example:331`, `mcp-client.service.ts`)와
`MCP_INSECURE_URL_ALLOWED` 저장소 내 잔존 0건도 확인. `chat-channel-card.tsx` 의
`rotateMutation.onError`가 인자 없이 고정 토스트만 띄운다는 CHANGELOG 의 "유일한 소비자는
status 를 분기하지 않는다" 주장도 소스로 확인했다. `translateBackendError` 프로덕션 호출부
0건(정의 파일 자신 + 테스트뿐)도 재확인.

리뷰 저장소는 read-only 로만 다뤘다(뮤테이션 없음) — 종료 시 `git status --short` 에는 이
리뷰 세션이 만든 `review/**` 산출물만 나타난다.

## 발견사항

- **[WARNING]** `spec/5-system/15-chat-channel.md` §5.4 의 `rotate-bot-token` 실패 응답 표가
  이번 PR 이 새로 만든 관측 가능한 실패 분기(`400 VALIDATION_ERROR` — `:id` 가 UUID 형식이
  아님, `ParseUUIDPipe`)를 등재하지 않는다.
  - 위치: `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표 (행 "400 | `VALIDATION_ERROR`
    | `X-Workspace-Id` 헤더가 있으나 UUID 형태가 아님..." 바로 아래 자리가 비어 있음).
    대응 코드: `codebase/backend/src/modules/triggers/triggers.controller.ts`
    `rotateBotToken` 의 `@ApiBadRequestResponse` (신규 텍스트 "VALIDATION_ERROR (:id 가 UUID
    형식이 아님 — ParseUUIDPipe)").
  - 상세: 이 표는 이미 같은 `VALIDATION_ERROR` 코드를 "헤더 형식 오류"용으로 세분화해서
    "위 `WORKSPACE_ID_REQUIRED`(둘 다 부재)와 다른 케이스" 라고 명시할 만큼 정밀하게 관리되고
    있다. 이번 PR 은 CHANGELOG 에 "Behavior change" 로 등재할 만큼 관측 가능한 새 실패
    경로(500→400)를 endpoint(CCH-SE-04)에 추가했는데, 그 endpoint 의 canonical 실패
    응답표에는 반영되지 않았다. `spec/2-navigation/2-trigger-list.md` 의 route 테이블
    엔트리는 형제 엔드포인트(`GET/PATCH/DELETE :id`)도 `ParseUUIDPipe` 를 표에 안 적는
    관례라 그쪽은 문제 아니지만, §5.4 표는 그 관례와 다르게 "이 엔드포인트가 낼 수 있는 모든
    `error.code`" 를 나열하는 문서라서 성격이 다르다.
  - 이 항목은 developer 자기-반증형 소정정 조건 1(그 문장을 developer 자신이 썼다)을
    충족하지 못하므로(§5.4 표는 developer 가 쓴 문장이 아님) `developer` 가 직접 고칠 수
    없다 — `project-planner` 턴에서 표에 행 추가가 필요하다. plan 트래커에 이미 등재된
    "`swagger.md §5-4` 체크리스트가 런타임 축을 안 적는다" 항목(범용 컨벤션 문서)과는 별개
    항목이다 — 그건 신규 엔드포인트 작성 시 체크리스트고, 이건 이 특정 엔드포인트의 실패
    응답 계약 SoT다.
  - 제안: `project-planner` 가 §5.4 표에 `400 | VALIDATION_ERROR | :id 가 UUID 형식이 아님
    (ParseUUIDPipe)` 행을 추가.

- **[WARNING]** `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C 와
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 대응 항목(라인
  ~3141-3159)이 `LLM_AUTH_ERROR` 를 "실재 `LLM_AUTH_FAILED` 의 근접 오기로 보인다" 고
  적었는데, 이는 `spec/5-system/7-llm-client.md:345` 와 어긋난다.
  - 위치: `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C 첫 항목(파일 컨텍스트
    166-170행); `plan/in-progress/spec-draft-nullable-notation-followups.md` diff 3141-3159행.
  - 상세: `spec/5-system/7-llm-client.md:345` 는 `LLM_AUTH_ERROR`(401) · `LLM_MODEL_NOT_FOUND`
    (404) · `LLM_CONTEXT_EXCEEDED`(400) 를 **"미구현(Planned) — 세분화 에러 코드"** 로 명시
    등재하고 "현재는 모두 `LLM_CONNECTION_ERROR` 로 수렴한다" 고 적는다 — 즉 오탈자가 아니라
    **의도적으로 문서화된 예정 기능**이다. 반면 실측: `LLM_AUTH_FAILED` 는
    `codebase/backend/src` 어디에도 없고(grep 0건), 유일한 등장은
    `codebase/frontend/src/components/editor/run-results/__tests__/fixtures/
    conversation-scenarios.ts` 의 임의 mock fixture 값 하나뿐이라 "근접 오기의 실재 대상"
    으로 삼을 근거가 약하다. 같은 §C 항목이 `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR` 두
    개는 `spec/5-system/3-error-handling.md §1.4` 의 "구 에러 코드... 더 이상 사용하지
    않는다" 를 정확히 인용해 "은퇴한 이름" 으로 올바르게 재분류했으면서, 같은 파일의 인접
    §Planned 절은 확인하지 않아 `LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND` 는 "은퇴" 도 "오기"
    도 아닌 "예정" 범주로 놓쳤다.
  - 영향: 이 항목은 §C("이번 배치에서 하지 않는 것 — 등재만 한다")로 명시적으로 **이번 PR
    범위 밖**이라 코드 동작에는 영향이 없다. 다만 이 부정확한 진단이 나중에 그 백로그
    항목을 집는 사람의 조사 방향을 오도할 수 있다("오기를 고친다" 로 착수하면 틀린 수정이
    된다 — 실제로는 `models.mdx` 문서가 미구현 기능을 이미 구현된 것처럼 적은 문제다).
  - 제안: 두 plan 문서의 해당 문구에서 `LLM_AUTH_ERROR` 를 "근접 오기" 대신 "spec 이 Planned 로
    이미 등재한 미구현 코드 — 가이드가 이를 이미 나온 것처럼 서술" 로 정정. 코드 변경은
    불필요.

## 요약

핵심 변경(3곳)은 모두 실측 검증에서 일치했다: (1) `rotateBotToken` 의 500→400 마스킹 해소는
`GlobalExceptionFilter`·`findById`·`Trigger` 엔티티를 직접 대조해 CHANGELOG·plan 의 근거
사슬과 정확히 일치했고 관련 가드·컨트롤러 테스트가 전부 GREEN, (2) 유저가이드 6곳(MDX
4·backend-labels.ts·backend-labels.test.ts)의 `TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND` 정정도
`hooks.service.ts`(인입 경로) vs `triggers.controller.ts`(REST API)의 실제 발신처 분리와
일치, (3) `MCP_ALLOW_INSECURE_URL` 오탈자 수정도 실제 config 키와 일치하며 잔존 오기 0건.
`param-uuid-pipe` AST 가드는 vacuity floor·대조군 fixture·양방향 캐너리(면제가 런타임 축까지
끄지 않는지)를 갖춰 견고하고 실행 결과도 통과했다. 두 WARNING 은 모두 이번 PR 의 실제 코드
동작을 틀리게 만들지는 않는 **문서(spec 표 누락 1건 · plan 백로그 진단 오류 1건)** 성격이라
head 코드의 신뢰도에는 영향이 없으나, 전자는 이 endpoint 의 실패 계약을 다루는 canonical spec
표의 완전성 문제라 `project-planner` 반영이 적절하고, 후자는 향후 착수자의 오판을 막기 위한
정정이 필요하다. TODO/FIXME/HACK/XXX 잔존 없음, 반환값·엣지 케이스(빈 body, 잘못된 id, 존재하지
않는 트리거)는 모두 정의된 분기로 수렴한다.

## 위험도

LOW
