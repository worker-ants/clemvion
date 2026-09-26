# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 모두 전문 확보, Critical 발견 없음(전원 위험도 LOW).

## 전체 위험도
**LOW** — `rotate-bot-token-body`(3개 라우트에 문서 전용 `@ApiBody` DTO 추가, `spec_impact: none`, 런타임 불변)는 구조적 Cross-Spec/Rationale/규약 충돌이 없다. 다만 새로 작성될 두 DTO(`ChatChannelRotateBotTokenRequestDto`, `ContinueExecutionRequestDto`)가 기존 규약(§1-5 secret `writeOnly` 의무·§1-4/§5.4 required 표기·`15-chat-channel.md` code glob·§3 JSDoc 공개노출 원칙)을 놓치고 작성될 위험이 여러 checker에서 겹쳐 지적됐다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity(INFO→상향 통합) | `newBotToken` 요청 필드가 실제로는 필수인데(핸들러가 누락 시 400 `INVALID_BOT_TOKEN`) 선례(`ExecuteWorkflowDto`, 전 필드 optional)를 그대로 미러링하면 `@ApiPropertyOptional`로 문서화돼 새 OpenAPI 문서가 "선택 필드"로 광고할 위험 | `plan/in-progress/rotate-bot-token-body.md` 실측 표 1행 (`ChatChannelRotateBotTokenRequestDto`) | `spec/5-system/15-chat-channel.md` §5.4 ("필수"), `spec/2-navigation/2-trigger-list.md`(`botToken` 필수 서술), CCH-SE-04 | `@ApiProperty({ required: true, ... })`로 선언(런타임 파라미터 타입 `?`는 유지). JSDoc/description에 "누락·비-string 시 서비스 계층이 400 INVALID_BOT_TOKEN"을 명시 |
| 2 | rationale_continuity, convention_compliance | `newBotToken`은 secret store에 저장되는 bot token plaintext인데 `writeOnly: true` 명시가 plan 어디에도 없음 — 같은 모듈 `chat-channel-config.dto.ts`는 동일 카테고리 필드 전부에 이미 적용 중인 의무 | `plan/in-progress/rotate-bot-token-body.md` §실측 표 (`ChatChannelRotateBotTokenRequestDto` 행) | `spec/conventions/swagger.md` §1-5 ("의무: secret store 입력 plaintext 필드는 항상 `writeOnly: true` 동반", 예시가 정확히 `botToken`) | `@ApiProperty({ writeOnly: true, required: true, ... })`로 선언. 캐너리에 "writeOnly 플래그가 렌더된 스키마에 실린다" 검증 항목 추가 |
| 3 | cross_spec | 신규 request DTO 파일명이 `chat-channel-` 접두 없이 지어지면 `15-chat-channel.md` frontmatter `code:` glob을 벗어나 spec-linked 판정에서 누락 — 동일 갭이 `#1317`/`#1319`/`#1320` 세 번 재발(R-CC-22)한 패턴의 4번째 사례가 될 위험 | `plan/in-progress/rotate-bot-token-body.md` — `ChatChannelRotateBotTokenRequestDto` 파일 경로 미확정 | `spec/5-system/15-chat-channel.md` frontmatter `code:` glob (`.../dto/**/chat-channel-*.dto.ts`) + `## R-CC-22` | 파일명을 `chat-channel-rotate-bot-token-request.dto.ts`로 지어 glob에 포함시킬 것 (`ContinueExecutionRequestDto`/hooks 인라인은 이 glob 대상 아님, 해당 없음) |
| 4 | convention_compliance | plan이 "그대로 따른다"고 명시한 선례 `execute-workflow.dto.ts`의 class-level JSDoc이 설계결정 서사(비교표·캐너리 파일명 등)를 담고 있고 `introspectComments: true`로 그대로 공개 OpenAPI description이 됨 — 이 패턴을 신규 DTO 2개에 복제하면 §3 위반 표면이 1곳→3곳으로 확대. 자동 가드(`dto-jsdoc-citation-guard`)는 `dto/responses/**` + "리뷰 인용" 패턴만 스캔해 이 두 신규 파일은 범위 밖 | `plan/in-progress/rotate-bot-token-body.md` §방향("ExecuteWorkflowDto 선례를 그대로 따른다") | `spec/conventions/swagger.md` §3 ("JSDoc은 공개 OpenAPI로 나간다 — 내부 서사를 담지 않는다") | 새 DTO의 class `/** */`는 소비자 관점 설명만 남기고, "왜 `@Body()` 타입이 아닌지" 설계결정·비교표·캐너리 참조는 바로 위 `//` 주석으로 옮길 것. 또는 `spec-draft-nullable-notation-followups.md`의 관련 open item(§3이 필드/클래스 JSDoc을 가르는지)을 이번 기회에 명문화 |
| 5 | naming_collision | 신규 `ChatChannelRotateBotTokenRequestDto`가 기존 응답 DTO `ChatChannelRotateBotTokenDto`와 어간이 같고 응답 쪽만 접미사가 없어(폴더로만 구분하는 기존 관례와 접미사 대칭이 어긋남) grep/import 자동완성에서 즉시 구분 안 됨 | 신규 파일 배치 예정 경로 | `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts:71` (`ChatChannelRotateBotTokenDto`) | 기능상 문제는 없으나, 응답과 대칭되는 `dto/chat-channel-rotate-bot-token-request.dto.ts`(플랫, `dto/responses/` 밖)에 배치해 "폴더가 request/response를 가른다"는 기존 패턴과 정합시킬 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 신규 DTO 클래스명(`ChatChannelRotateBotTokenRequestDto`/`ContinueExecutionRequestDto`)이 저장소 기존 식별자와 충돌 없음 확인 (grep 실측) | 해당 클래스명 | 조치 불필요, 기록용 |
| 2 | convention_compliance | `*RequestDto` 접미사 명명이 `swagger.md` §1-7 표에 명문화돼 있지 않음(§1-7은 `Update` 접두만 다룸). 저장소 실제 관례(`AssistantMessageRequestDto`·`ReRunRequestDto`)와는 일치 | `spec/conventions/swagger.md` §1-7 | 이번 PR 범위 아님. plan이 이미 등재 예정인 "전역 가드 후속" 트래커 항목에 "§1-7 표에 `<Domain><Action>RequestDto` 행 추가"를 함께 묶는 것을 planner 턴에서 고려 |
| 3 | naming_collision | plan이 인용한 선례(`ExecuteWorkflowDto`, 접미사 없음)와 신규 클래스 2개(`Request` 접미)의 명명 스타일이 다름. `ContinueExecutionRequestDto`(신규 요청)와 기존 응답 `ExecutionContinueResultDto`는 어간 어순이 반대(`ExecutionContinue` vs `ContinueExecution`)라 나란히 보면 오탈자처럼 보일 소지 | `ChatChannelRotateBotTokenRequestDto`/`ContinueExecutionRequestDto` | 실질 충돌 아님, 명명 자체를 막을 근거 없음. 기록용 |
| 4 | plan_coherence | 상위 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md:2459`)의 원래 처방 제안은 "요청 DTO 승격"이었으나, 실제 채택안은 "문서 전용 DTO + `@ApiBody`"로 실측 근거(전역 `CustomValidationPipe` 우회 필요성)를 바탕으로 갱신됨 — 무단 번복 아님 | 트래커 문구 vs 실제 채택안 | 이 항목을 닫는 커밋/planner 턴에서 트래커의 "처분 제안" 문구를 실채택안으로 정정 권고. 차단 사유 아님 |
| 5 | plan_coherence | plan의 "안 하는 것" 절이 예고한 "전역 `@ApiBody` 필수 가드" 후속 트래커 등재가 아직 미완료(체크리스트 마지막 항목 미체크) | `plan/in-progress/rotate-bot-token-body.md` 체크리스트 | `--impl-done` 전에 해당 체크박스가 실제 트래커 등재까지 마쳤는지 확인 |
| 6 | plan_coherence | `15-chat-channel.md` frontmatter `pending_plans`가 이번 작업 plan을 cross-reference하지 않음(기존에 이미 열려 있던 판단 보류, `spec_impact: none`이라 차단 사유 아님) | `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:` | planner가 `pending_plans` 포함 기준을 정할 때 이 사례도 함께 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `newBotToken` required 표기 위험 · 신규 DTO 파일명이 `15-chat-channel.md` code glob 이탈 위험(R-CC-22 4번째 재발 가능) |
| rationale_continuity | LOW | `newBotToken` `writeOnly` 누락 위험(§1-5 의무) · required 여부가 선례의 "전 필드 optional" 특성에 옮겨붙을 위험 |
| convention_compliance | LOW | `writeOnly` 누락 · 선례 class JSDoc 내부서사 복제 시 §3 위반 표면 확대 · `*RequestDto` 접미사 미규약화(기록용) |
| plan_coherence | LOW | 트래커 처방 문구 정정 권고 · 전역가드 후속 등재 여부 확인 필요 · `pending_plans` 포함 기준 보류(planner) |
| naming_collision | LOW | 응답/요청 DTO 접미사 비대칭(파일 배치 권장) · 선례와 명명 스타일 차이(기록용) |

## 권장 조치사항

1. `newBotToken` 필드를 `@ApiProperty({ required: true, writeOnly: true, description: '...핸들러가 누락/비-string 시 400 INVALID_BOT_TOKEN...' })`로 선언 — WARNING #1·#2를 한 번에 해소.
2. 신규 요청 DTO 파일명을 `chat-channel-rotate-bot-token-request.dto.ts`(`chat-channel-` 접두, `dto/responses/` 밖 플랫 배치)로 지어 `15-chat-channel.md` code glob에 포함시키고 응답 DTO와 폴더 대칭을 맞출 것 — WARNING #3·#5 해소.
3. 새 DTO 2개의 class-level JSDoc은 소비자 관점 설명만 남기고, `ExecuteWorkflowDto`류의 설계결정 서사(비교표·캐너리 참조)는 `//` 주석으로 옮겨 §3 위반 표면 확대를 막을 것 — WARNING #4 해소.
4. (비차단, planner 턴) 트래커(`spec-draft-nullable-notation-followups.md:2459`) 처방 문구를 실채택안으로 정정, `swagger.md` §1-7에 `<Domain><Action>RequestDto` 행 추가 검토, `pending_plans` 포함 기준 결정.
5. `--impl-done` 이전 "전역 `@ApiBody` 필수 가드 후속 등재" 체크박스가 실제 수행됐는지 확인.
