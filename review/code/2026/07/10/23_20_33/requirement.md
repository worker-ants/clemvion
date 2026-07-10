# 요구사항(Requirement) 충족 리뷰 — EIA `getStatus.context` 스키마화 + 부재 표현 규칙

- 대상 커밋: `a02db4f9a`(docs/spec) + `0302bd7ea`(impl) — diff base `origin/main`
- 검증 방법: 코드 직접 Read + `git show`/`git diff` line-level 대조 + 실제 unit 테스트 재실행(`jest src/modules/external-interaction` 220/220, `responses.dto.spec.ts` 단독 15/15, `channel-web-chat` vitest 39/39) + `tsc --noEmit`(backend external-interaction 모듈, frontend eia-types.ts 관련 파일) 무오류 확인.

## 요구사항 대조

### (1) `ExecutionStatusDto.context` 를 union/discriminated DTO 로 스키마화

**충족 확인.** `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts`:
- `ButtonsContextDto`/`NodeOutputContextDto` 두 variant 클래스(공통 봉투 `WaitingContextBaseDto` 상속) 신설, `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)` + `context?: ButtonsContextDto | NodeOutputContextDto | null` + `@ApiPropertyOptional({ oneOf: [...], nullable: true })`.
- `discriminator` 는 **의도적으로 생략** — `interactionType==='buttons'` 인데 `buttonConfig` 복원 실패 시 `NodeOutputContextDto` 로 fallthrough 하는 실제 서비스 로직(`interaction.service.ts:312-323`)이 있어 `interactionType` 이 sound discriminator 가 아니기 때문. 이 근거는 `spec/conventions/swagger.md` 신설 Rationale(`### discriminator 는 판별자가 sound 할 때만`)에 명문화됐고, `interaction.service.spec.ts` 에 회귀 테스트(`buttons 인데 buttonConfig 부재면 nodeOutput 변형으로 fallthrough`)로 고정돼 있다. 사용자 요청 문구("discriminated DTO")를 문자 그대로 `discriminator` 키워드 사용으로 읽으면 어긋나 보이지만, 실제로는 판별 불가능한 필드에 `discriminator` 를 붙이면 SDK 생성기가 오분류하는 실제 결함을 야기하므로 **oneOf-without-discriminator 가 옳은 설계**다. 부수적으로 `CurrentNodeDto` 도 동일 원칙으로 신설(종전 `additionalProperties` 뭉개짐 — swagger.md §1-4 Rationale 이 인용하는 드리프트 실증 사례 자체였음).
- `responses.dto.spec.ts` 가 **실제 OpenAPI 문서를 `SwaggerModule.createDocument` 로 생성**해 (a) variant 가 `components.schemas` 에 등재됨(`@ApiExtraModels` 누락 시 dangling `$ref` 를 잡는 회귀 가드), (b) `context.oneOf` 정확히 2개, (c) `discriminator` 미선언, (d) `context.additionalProperties`/`type==='object'` 아님(뭉개짐 방지), (e) variant 별 `required` 필드셋을 검증한다. `jest` 재실행 결과 15/15 통과(단독), `src/modules/external-interaction` 전체 220/220 통과.
- `nodeOutput`/`buttonConfig` 내부는 여전히 열린 map(`additionalProperties: true`) — 노드 타입별 자유 payload 라 `spec/conventions/node-output.md` 와 SoT 이중화를 피하기 위한 의도적 설계이며 swagger.md Rationale 에 명시.

### (2) 부재 표현(`null` vs 키 생략) 규칙 명문화 + 위젯 소비자 안전성 검증

**충족 확인.**
- `spec/5-system/2-api-convention.md` 에 **§5.4 신설** — `null`(상시 존재, 기본값) vs 키 생략(present-when-available, wire parity 등 근거 필요) 규칙 + DTO 선언 대응 규칙(`| null` 금지/포함 매핑) + 소급 미적용 캐리브 + Rationale(`왜 conversationThread 를 null 로 정규화하지 않는가`).
- `spec/5-system/14-external-interaction-api.md` §5.3 예시 JSON 정정(`formConfig`/`conversationConfig` 유령 top-level 키 제거, `interactionType`/`waitingNodeId` 추가, `seq: 42→0`) + §R17 cross-ref(파일명 qualify로 EIA 자신의 §5.4 "명시적 취소" 와 오독 방지).
- 코드: `ButtonsContextDto`/`NodeOutputContextDto` 상속 base 의 `conversationThread?: ConversationThread`(`| null` 미사용, `@ApiPropertyOptional`) vs 형제 `currentNode`/`result`/`error` 는 `nullable: true` + `?: T | null` — §5.4 규칙과 line-level 일치.
- `interaction.service.ts` 실제 조립부: `conversationThread` 는 `...(conversationThread ? { conversationThread } : {})` 로 값 있을 때만 키 부여(present-when-available), `result`/`error` 는 조건 분기 결과가 `null` — 두 표현이 실제로 코드에 그대로 반영됨. `WaitingContextBase` 타입 명시 annotate(object spread 의 literal widening 문제)로 TS 컴파일도 안전(`tsc --noEmit` 무오류).
- **위젯 소비자 검증(요구사항 (2)의 핵심 항목)** — 직접 코드 확인:
  - `codebase/channel-web-chat/src/widget/use-widget.ts:229` `status.status === "waiting_for_input" && status.context` 가드 후 `parseWaitingForInput` 호출.
  - `codebase/channel-web-chat/src/lib/eia-events.ts` `parseWaitingForInput` 은 `ev.conversationThread` 를 그대로 pass-through(`conversationThread: ev.conversationThread`) — `undefined`/`null` 모두 통과.
  - `codebase/channel-web-chat/src/lib/conversation.ts` `threadToMessages(thread: ConversationThread | undefined)` 의 `if (!thread?.turns?.length) return [];` — optional chaining 이 `undefined` 와 `null` 을 **둘 다** short-circuit 하므로 SSE 표면(present-when-available)과 REST 표면(동일)이 같은 코드로 안전하게 처리됨을 실제로 확인.
  - `interaction.service.spec.ts` 신규 테스트(`durable thread 부재 시 conversationThread 키 자체를 생략한다`)가 서비스 레이어에서 `Object.keys(ctx)).not.toContain('conversationThread')` 를 단언해 키 생략을 고정.
  - 결론: 런타임 결함 없음(plan draft 의 "소비 안전성 확인 완료" 서술과 코드가 일치). `channel-web-chat` vitest(`eia-events`/`conversation`/`use-widget*`) 39/39 통과.

## Spec fidelity (line-level)

`spec/5-system/14-external-interaction-api.md` §5.3 JSON 예시·§R17, `spec/5-system/2-api-convention.md` §5.4, `spec/conventions/swagger.md` §1-4 및 Rationale 3항목을 코드와 대조한 결과 전부 일치:
- `oneOf` variant 구조·필드명(`interactionType`/`waitingNodeId`/`buttonConfig`/`nodeOutput`/`conversationThread`) 이 spec 예시와 코드 조립부가 정확히 대응.
- `seq` 는 spec/코드 모두 항상 `0`(`SSE_SEQ_PLACEHOLDER`).
- `discriminator` 생략 근거가 spec Rationale·코드 주석·테스트 3곳에서 동일 문구로 반복(코드-스펙 drift 없음).
- `spec/conventions/execution-context.md` 의 `ExecutionContext` 런타임 개념과의 명명 충돌 회피(`ButtonsContextDto`/`NodeOutputContextDto`, `ExecutionContext*` 접두 미사용) — consistency-check W4 지적이 실제 구현에 반영됨을 확인(`grep` 결과 충돌 0건).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "축 분리 주의" cross-ref 가 추가돼, 기존 `[x]` 항목(런타임 실값)과 본 draft(스키마 표현/부재 규칙)가 서로 다른 축임을 명확화 — plan 정합성 양호.

CRITICAL 급 불일치 없음. spec 이 약속하는데 구현이 안 된 표면, 또는 구현했는데 spec 미문서화된 표면 모두 발견되지 않음.

## 발견사항

- **[INFO]** `git diff origin/main..HEAD` 로 비교 시 `spec/7-channel-web-chat/1-widget-app.md` 의 `### R7` 절 삭제, `spec/conventions/conversation-thread.md` 3개 문단 삭제, `plan/in-progress/spec-draft-pr874-deferred-docs.md` 파일 삭제, `review/consistency/2026/07/10/22_27_01/**` 삭제가 나타난다.
  - 위치: diff 전체 요약(`git diff --stat origin/main..HEAD`)
  - 상세: 확인 결과 이는 **이 PR(두 커밋 `a02db4f9a`/`0302bd7ea`)의 실제 변경이 아니다.** `git show <commit> --stat` 로 두 커밋 각각을 직접 확인하면 어느 쪽도 `1-widget-app.md`/`conversation-thread.md`/`spec-draft-pr874-deferred-docs.md`/`22_27_01/**` 를 건드리지 않는다. 원인은 이 작업 브랜치가 `cc3dafa8c` 에서 분기된 뒤, **동시에 별도 PR #899(`52f46f95f`, "PR #874 defer 문서 보강")가 `origin/main` 에 먼저 머지**돼 그 내용이 이 브랜치엔 없기 때문 — 즉 `origin/main..HEAD` 스냅샷 diff 가 "이 브랜치에 없는 origin/main 의 것"을 삭제처럼 보여주는 stale-base 아티팩트다(`git merge-base --is-ancestor origin/main HEAD` = false 로 실증).
  - 제안: 코드 수정 불요(이 PR 범위 밖). 다만 이 브랜치를 main 에 머지하기 전에 `origin/main` 기준으로 rebase/merge 를 한 번 거쳐 실제 3-way 병합 결과가 R7/conversation-thread.md 보강분을 보존하는지 확인할 것 — 특히 `spec/conventions/conversation-thread.md` 의 `code:` frontmatter 목록(§899 가 `interaction.service.ts` 를 추가함)과 본 PR 의 관련 변경이 충돌하지 않는지 병합 시점에 재확인 권장.
- **[INFO]** `codebase/backend/src/modules/external-interaction/dto/__debug.spec.ts` 라는 untracked 디버그용 테스트 파일이 워크트리에 남아 있다(git status untracked, 이번 diff 대상 아님).
  - 위치: `codebase/backend/src/modules/external-interaction/dto/__debug.spec.ts`
  - 상세: `responses.dto.spec.ts` 개발 중 실 OpenAPI 문서를 `console.log` 로 덤프하기 위해 만든 것으로 보이는 스크래치 파일. git 추적 대상이 아니라 커밋에는 안 들어가지만, 정리 안 하면 다음 세션에서 혼동 소지.
  - 제안: 커밋 전 삭제 권장(차단 사유 아님).
- **[INFO]** `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` 체크리스트가 "테스트: `responses.dto.spec.ts` 신규 14건" 이라 적었으나 실제 재실행 결과는 15건(`it.each` 2곳이 각 2 variant 생성, 소스 라인 13개 → 실행 15개).
  - 위치: plan 체크리스트 "- [x] 테스트: ..." 항목
  - 상세: 사소한 카운트 오차. 기능/커버리지에 영향 없음(오히려 실제보다 과소 표기).
  - 제안: 필요 시 15건으로 정정(비차단).

## 요약

두 API 계약 갭 모두 요구사항대로 해소됐다. `ExecutionStatusDto.context` 는 `Record<string,unknown>|null` + `additionalProperties` 뭉개짐에서 `ButtonsContextDto`/`NodeOutputContextDto` 의 판별자 없는 닫힌 `oneOf` 로 스키마화됐고, `discriminator` 의도적 생략은 실제 fallthrough 버그를 방지하기 위한 근거 있는 설계로 spec Rationale·코드 주석·회귀 테스트 3곳에 일관되게 문서화돼 있다. 부재 표현 규칙은 `api-convention.md` §5.4 로 신설돼 `null`(기본)과 키 생략(wire parity 등 근거 있을 때)의 선택 기준·DTO 선언 대응을 명문화했고, 코드(`conversationThread?: T` vs `result/error?: T|null`)가 이를 정확히 반영한다. 요구사항이 명시한 "위젯 소비자가 두 표현을 안전하게 처리하는지" 검증도 `use-widget.ts`/`eia-events.ts`/`conversation.ts` 를 직접 추적해 optional chaining 이 `null`·`undefined` 를 동일하게 short-circuit 함을 확인했다(런타임 wire 무변경이므로 별도 코드 수정 불요, 실제로 없음). Swagger 스키마 회귀 테스트가 실제 OpenAPI 문서 생성을 통해 dangling `$ref`·뭉개짐·nullable 누락을 잡도록 설계돼 있고 재실행 결과 전부 통과(backend 220/220, frontend 39/39), `tsc --noEmit` 도 관련 모듈에서 무오류다. spec 본문(EIA §5.3 예시 JSON, §R17, api-convention §5.4, swagger §1-4/Rationale)과 코드가 line-level 로 일치하며 CRITICAL 급 불일치는 발견되지 않았다. 유일한 특이사항은 코드 결함이 아니라 diff 해석 시 주의할 브랜치 분기점 이후 `origin/main` 의 무관한 동시 병합(PR #899)으로 인한 stale-base diff 아티팩트다.

## 위험도

NONE
