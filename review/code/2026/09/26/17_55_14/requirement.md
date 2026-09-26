# 요구사항(Requirement) 충족 검토 — rotate-bot-token-body

## 관측된 이상 상태 (내 변경 아님, 반드시 보고)

리뷰 시작 시 `git status --short` 를 돌리기 전, 프롬프트 컨텍스트만으로 분석을 마쳤음에도
검증 단계에서 확인한 저장소 상태가 다음과 같았다:

```
 M codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts
?? codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts.bakmut
?? review/code/2026/09/26/17_55_14/
```

`chat-channel-rotate-bot-token-request.dto.ts` 가 현재 워킹트리에서 `@ApiProperty({ writeOnly: true })`
→ `@ApiProperty({})` 로 **live 하게 뮤테이션**돼 있고, 파일명이 `.bakmut` 인 untracked 백업까지 있다.
이는 병렬 fan-out 중인 **다른 reviewer 가 뮤테이션 테스트를 진행 중인 것**으로 보인다(본 세션은
이 파일을 Read/Write/Edit 하지 않았다 — 아래 모든 판단은 프롬프트에 실린 diff/전체 파일 컨텍스트
스냅숏을 근거로 했고, 그 스냅숏은 `writeOnly: true` 가 있는 정상 상태였다). **내가 만든 변경도,
내가 원복해야 할 대상도 아니라 손대지 않았다** — 다음 사람이 이 라인을 "코드 결함"으로 오인하지
않도록 사실만 남긴다. 이 세션 종료 시점에도 저장소는 위 상태 그대로다.

## 발견사항

검토 대상 3개 라우트(`triggers.rotateBotToken` / `executions.continueExecution` /
`hooks.receiveWebhook`)에 대해 실제 spec 문서(`spec/5-system/15-chat-channel.md` §5.4,
`spec/5-system/12-webhook.md` WH-EP-04/05, `spec/4-nodes/6-presentation/4-form.md` §"FIRST 오류만",
`spec/data-flow/3-execution.md`)와 `spec/conventions/swagger.md` §1-5/§1-7/§3 을 line-level 로
대조했다. 사전에 이 작업을 검토한 `review/consistency/2026/09/26/17_20_45/` 의 WARNING 5건
(newBotToken required 누락 위험·writeOnly 누락 위험·파일명 code-glob 이탈 위험·JSDoc 내부서사
복제 위험·응답/요청 DTO 접미사 비대칭)이 실제 구현에서 어떻게 처리됐는지 확인했다 — 전부 코드로
반영됐다(required `newBotToken: string`, `@ApiProperty({ writeOnly: true })`, 파일명
`chat-channel-rotate-bot-token-request.dto.ts`, class JSDoc 은 소비자 설명만 남기고 설계 서사는
`//` 로 이동, 응답 DTO 와 분리된 flat 배치). CRITICAL 급 결함은 찾지 못했다.

- **[INFO]** `bodyParamDesignType` 헬퍼는 Nest 의 `ROUTE_ARGS_METADATA` 키 포맷(`${paramtype}:${index}`,
  `RouteParamtypes.BODY === 3`)을 정확히 겨냥한다 — `node_modules/@nestjs/common/decorators/http/route-params.decorator.js`
  의 `assignMetadata` 로 직접 대조 확인. "파라미터 순서에 기대지 않는다"는 JSDoc 의 주장과 실제
  구현이 일치한다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` — `bodyParamDesignType` 함수
  - 상세: 결함 아님, 정합성 확인 기록.

- **[INFO]** 캐너리 테스트(`executions-continue-body.spec.ts`, `triggers-rotate-bot-token-body.spec.ts`,
  `hooks-webhook-body.spec.ts`)의 "여분 키도 파이프를 통과한다" 단언은 `CustomValidationPipe.toValidate()`
  가 `metatype === Object` 일 때 `!this.toValidate(metatype)` 로 조기 return 하는 실제 분기와 정확히
  맞물려 있어 공허(vacuous)하지 않다 — `codebase/backend/src/common/pipes/validation.pipe.ts` 로 대조.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:69-73`(`toValidate`) 및 위 3개
    `.spec.ts` 파일의 "[캐너리] 여분 키…" 테스트
  - 상세: 결함 아님, 정합성 확인 기록.

- **[INFO]** `ContinueExecutionRequestDto.formData` 필드 JSDoc "어긋나면 400 `VALIDATION_ERROR`(첫
  오류만)"은 `spec/4-nodes/6-presentation/4-form.md` "### field 검증은 FIRST 오류만 반환 (전수
  수집 아님)" 절과 정확히 일치한다. `executions.controller.ts` 의 `@ApiBadRequestResponse` 설명도
  같은 근거로 "FIRST 오류만"을 명시해 두 위치가 정합적이다.
  - 위치: `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts:14`,
    `codebase/backend/src/modules/executions/executions.controller.ts:169-172`
  - 상세: 결함 아님, spec fidelity 확인 기록.

- **[정보/경미]** `ChatChannelRotateBotTokenRequestDto.newBotToken` 필드 JSDoc 은 "없거나 문자열이
  아니면 400 `INVALID_BOT_TOKEN`" 만 적고, `spec/5-system/15-chat-channel.md` §5.4 로의 SoT 링크는
  없다. `swagger.md` §3 "보안·정책 캐비엇" 표는 "요청 값이 정책으로 거부될 수 있는 필드"에 대해
  "상세 근거는 spec 본문에 두고 여기서는 요약 1~2문장 + SoT 링크"를 요구한다. 다만 이 필드의 거부
  사유는 기본 타입 검사(누락/비-string)이지 §3 캐비엇이 겨냥하는 "예약어·재제출 금지 값" 류의
  정책적 거부와는 결이 달라, 이 캐비엇 적용 대상인지 자체가 애매하다 — CRITICAL/WARNING 으로 올리지
  않고 기록만 남긴다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts:15`
  - 제안: (선택) 필드 JSDoc 에 `spec/5-system/15-chat-channel.md §5.4` 링크를 덧붙이면 §3 캐비엇
    적용 여부와 무관하게 추적성이 좋아진다. 차단 사유는 아니다.

## 스펙 대조 요약 (양방향 확인)

| 코드 | spec 근거 | 일치 여부 |
| --- | --- | --- |
| `newBotToken` 필수, 누락/비-string → 400 `INVALID_BOT_TOKEN` (핸들러 검사, `triggers.controller.ts:321-326`) | `spec/5-system/15-chat-channel.md:351,372` | 일치 |
| `@Body() body?: { formData?: unknown }` — 본문 선택 | `spec/data-flow/3-execution.md:174` `body { formData? }` | 일치 |
| webhook `@ApiConsumes('application/json','application/x-www-form-urlencoded')`, `schema:{}` | `spec/5-system/12-webhook.md:52-54` WH-EP-04/05 | 일치 |
| 두 신규 DTO 모두 class-validator 데코레이터 없음(런타임 불변, `CustomValidationPipe` 우회) | plan `## 방향` 및 `swagger.md` 선례(`ExecuteWorkflowDto`) | 일치 |
| `writeOnly: true` on `newBotToken` | `spec/conventions/swagger.md:177` "의무" | 일치(구현에서 추가됨) |

TODO/FIXME/HACK/XXX 주석은 신규 파일 6개(`continue-execution.dto.ts`,
`executions-continue-body.spec.ts`, `chat-channel-rotate-bot-token-request.dto.ts`,
`triggers-rotate-bot-token-body.spec.ts`, `hooks-webhook-body.spec.ts`, `swagger-probe.ts` 증분)
전체에서 검색했으나 없음.

## 요약

3개 라우트(`rotateBotToken`/`continueExecution`/`receiveWebhook`)에 OpenAPI `@ApiBody` 를 추가해
"문서만 채우고 런타임 계약은 그대로 둔다"는 의도가 코드·캐너리 테스트·plan 서술 전체에서 일관되게
구현돼 있다. 사전 `--impl-prep` consistency-check 가 지적한 5개 WARNING(필수 표기·writeOnly·파일명
glob·JSDoc 내부서사·명명 대칭)이 모두 실제 diff 에 반영됐음을 spec 원문 및 관련 소스(`validation.pipe.ts`,
`route-params.decorator.js`) 대조로 확인했다. 캐너리 테스트는 Nest 내부 메타데이터 포맷과 파이프
분기 조건에 정확히 물려 있어 공허하지 않다. CRITICAL/WARNING 급 신규 결함은 발견되지 않았다.
단, 리뷰 시작 시점에 이미 다른 reviewer 의 뮤테이션(`newBotToken` 의 `writeOnly` 제거)이 워킹트리에
라이브로 남아 있었다 — 내가 만들지도 원복하지도 않았으며, 이는 이 작업의 코드 결함이 아니라
병렬 리뷰 세션 간 저장소 오염이다.

## 위험도

LOW
