# 정식 규약 준수 검토 — rotate-bot-token-body

대상: `rotate-bot-token-body` 브랜치의 구현 diff(10파일/457줄) — `POST /triggers/:id/chat-channel/rotate-bot-token` ·
`POST /executions/:id/continue` · `POST /hooks/:endpointPath` 세 라우트에 문서 전용(`@ApiBody`) 요청 스키마 추가,
런타임(`@Body()` 파라미터 타입·검증 파이프 경로) 불변. `spec/**` 델타는 0(예상대로 — 코드 전용 PR). 대조군은
`spec/conventions/swagger.md`(번들에 실림) 와 `spec/5-system/15-chat-channel.md` §5.4/§5.4.1.

## 발견사항

- **[WARNING]** 신규 "문서 전용 DTO" 계열의 명명이 이 PR 이 스스로 인용한 선례와 다르고, `swagger.md` §1-7 이 이 패턴을 다루지 않는다
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts` (`ChatChannelRotateBotTokenRequestDto`) · `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts` (`ContinueExecutionRequestDto`)
  - 위반 규약: `spec/conventions/swagger.md` §1-7 「요청 DTO 명명 — `Update` 접두는 top-level 요청 바디에만 건다」 — 이 절은 `Update<Entity>Dto` 접두 규칙만 다루고, "class-validator 데코레이터 없이 `@ApiBody({ type })` 로만 쓰는 문서 전용 DTO" 라는 이 PR 이 만든 카테고리의 명명은 규정하지 않는다.
  - 상세: 이 PR 의 plan(`plan/in-progress/rotate-bot-token-body.md` §방향)이 명시적으로 따르겠다고 밝힌 선례는 `workflows/dto/execute-workflow.dto.ts` 의 `ExecuteWorkflowDto`(접미 없음)인데, 새 DTO 둘은 `*RequestDto` 접미를 붙였다 — 선례와 동일 계열(문서 전용·비검증) 안에서 명명이 갈린다. 다만 저장소 전체로 보면 `*RequestDto` 접미 자체는 이미 흔한 패턴이다(`ReRunRequestDto`, `EmailChangeRequestDto`, `AssistantMessageRequestDto` — 모두 class-validator 로 검증되는 "진짜" 요청 DTO). 즉 갈리는 축은 "Request 접미냐 아니냐"가 아니라 "문서 전용·비검증 DTO 라는 새 카테고리를 규약이 아직 이름 짓지 않았다"는 것이다. `--impl-prep review/consistency/2026/09/26/17_20_45` 가 이미 이 간극을 INFO2·INFO4·INFO5 로 잡았고, plan 은 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 후속 항목으로 "§1-7 접미 행" 추가를 등재하기로 했다(체크리스트 마지막 항목 `트래커 항목 닫기 · 전역 가드 후속 등재`, 아직 미완료 — `--impl-done` 전 단계).
  - 제안: 코드 자체는 재작업 불필요(저장소 지배적 패턴과 정합). `spec/conventions/swagger.md` §1-7 에 "문서 전용(비검증) top-level 요청 DTO 는 `<Action><Entity>RequestDto`" 같은 행을 추가하는 planner 턴을 plan 이 예고한 대로 실제로 등재·완결할 것. 이미 트래커에 흔적이 있으므로 이 항목은 발견이라기보다 "아직 닫히지 않은 자기 예고"에 대한 확인이다.

- **[INFO]** 형제 DTO 간 단어 순서 비대칭 — `ExecutionContinueResultDto`(응답) vs `ContinueExecutionRequestDto`(요청)
  - target 위치: `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts` (신규) / `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:223` (기존)
  - 위반 규약: 명시적 조항은 없음 — `swagger.md` §5-1 이 "같은 개념을 층별로 나눠 선언할 때 이름을 다르게 둔다"는 원칙만 제시하고 어순은 규정하지 않는다.
  - 상세: 같은 엔드포인트의 요청/응답 DTO 가 `Execution+Continue` / `Continue+Execution` 로 어순이 반대라 접두사 기준 grep·IDE 자동완성으로 짝을 찾기 어렵다. 규약 위반은 아니지만 `chat-channel-rotate-bot-token-request.dto.ts` ↔ `chat-channel-rotate-bot-token-response.dto.ts`(§5.4.2, 어순 동일)처럼 같은 PR 안에서도 다른 처리를 보인다.
  - 제안: 후속 리네임 시(있다면) `ContinueExecutionRequestDto` → `ExecutionContinueRequestDto` 로 맞추는 선택지를 트래커에 함께 적어 두면 다음 사람이 "왜 짝이 안 맞나" 를 다시 조사하지 않는다. 지금 당장 고칠 필요는 없음(비검증 DTO 리네임은 계약에 영향 없음).

## 규약 준수가 확인된 항목 (근거 남김 — 재조사 방지)

- **`writeOnly` 의무** (`swagger.md` §1-5) — `ChatChannelRotateBotTokenRequestDto.newBotToken` 에 `@ApiProperty({ writeOnly: true })` 적용, 캐너리(`triggers-rotate-bot-token-body.spec.ts` 렌더 테스트)가 고정. §1-5 예시가 정확히 "bot token plaintext" 를 든다.
- **JSDoc/`//` 서사 분리** (`swagger.md` §3, 2026-09-05 규약) — 두 신규 DTO 모두 소비자용 설명은 `/** */`, 설계 경위(전역 파이프 우회 이유·선례 링크)는 `//` 에 분리. `newBotToken` JSDoc 은 "요청 값이 정책으로 거부될 수 있는 필드" 캐비엇(§3, 없거나 비-string 이면 400 사유)을 규약대로 담았다.
- **열린 map 의 적법한 사용** (§1-4) — `formData?: Record<string, unknown>` (`type:'object', additionalProperties:true`) 는 실제 키가 런타임 결정되는 폼 필드 맵이라 "번거로움 회피" 금지 사유에 해당하지 않음. `hooks` 의 `schema: {}` 도 "형태가 발신자 정의"인 진짜 임의값 케이스라 §1-4 열린 map 규정과 결이 다르지만 §6 "빈 껍데기 응답 스키마" 금지(응답 전용 규정)에도 해당하지 않는다.
- **파일 위치** — 신규 request DTO 둘 다 `dto/responses/` 가 아닌 평평한 `dto/` 에 위치, §5-1 은 응답 DTO 위치만 규정하므로 위반 아님. `chat-channel-rotate-bot-token-request.dto.ts` 파일명은 `15-chat-channel.md` frontmatter `code:` glob `dto/**/chat-channel-*.dto.ts` 에 포함(R-CC-22 의 `**/` 확장 설계와 일치).
- **클래스명 유일성 가드** (§5-1) — `ChatChannelRotateBotTokenRequestDto`/`ContinueExecutionRequestDto` 저장소 전역 중복 없음(grep 확인).
- **와이어 계약 일치** — `newBotToken` 필드명·필수성·400 `INVALID_BOT_TOKEN` 사유가 `15-chat-channel.md` §5.4 요청 예시·에러표와 정확히 일치. `hooks` 의 `@ApiConsumes('application/json','application/x-www-form-urlencoded')` 는 `12-webhook.md` WH-EP-04 문구("JSON, form-urlencoded 요청 본문 수신")와 정확히 일치.
- **CHANGELOG** — `Unreleased` 섹션에 "OpenAPI 가 3개 엔드포인트의 요청 본문 스키마를 광고한다" 항목 존재, 저장소 기존 항목 포맷(변경 요약 + 라우트별 불릿 + 계약 불변 근거)과 동일.
- **런타임 불변 계약** — 세 라우트 모두 `@Body()` 파라미터가 인라인 타입 유지, `bodyParamDesignType` 캐너리가 `design:paramtypes === Object` 를 고정해 전역 `CustomValidationPipe` 우회를 검증. plan 의 뮤턴트 표(6/6 KILLED)가 "DTO 로 타입하면 계약이 깨진다"는 주장을 실측했다.

## 요약

세 라우트(`rotate-bot-token`·`continue`·`webhook`)에 문서 전용 `@ApiBody` 를 추가하면서 런타임을 바꾸지 않는다는 이 PR 의 핵심 제약은 `swagger.md` 의 명명·`writeOnly`·JSDoc 분리·응답 wrapping·에러코드 규약을 정확히 지키며 구현됐고, 특히 보안 민감 필드(`newBotToken`)의 `writeOnly` 의무와 정책-거부 필드의 JSDoc 서술 의무를 모두 충족한다. 유일하게 남는 것은 "문서 전용·비검증 요청 DTO" 라는 이번에 등장한 카테고리의 명명을 `swagger.md` §1-7 이 아직 규정하지 않는다는 점인데, 이는 코드의 결함이라기보다 규약 문서의 공백이며 개발자 스스로 `--impl-prep` 단계에서 INFO 로 식별해 트래커 후속 항목으로 등재해 둔 상태다(아직 완결되지 않은 self-tracked 항목). 이를 제외하면 명명·출력 포맷·문서 구조·API 문서 데코레이터·금지 패턴 다섯 관점 모두에서 CRITICAL 급 위반은 발견되지 않았다.

## 위험도

LOW
