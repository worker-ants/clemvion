# Rationale 연속성 검토 — EIA client `context` 타입 정밀화 (`eia-client-context-types-33e771`)

- 검토 모드: `--impl-done`, diff-base `1682777fe..HEAD` (4 commits)
- 검증 대상: shipped code (working tree) vs `spec/5-system/14-external-interaction-api.md §Rationale R17`, `spec/conventions/swagger.md §Rationale`(`discriminator` 는 판별자가 sound 할 때만), `spec/5-system/2-api-convention.md §Rationale`(`conversationThread` null 미정규화)
- Diff 확인 방법: `git -C <worktree> log --oneline 1682777fe..HEAD` / `git -C <worktree> diff 1682777fe..HEAD --stat` / `git -C <worktree> diff 1682777fe..HEAD -- <file>` 로 실측(payload 발췌가 아닌 실제 diff 직접 조회).

## 발견사항

없음 — CRITICAL/WARNING 급 Rationale 연속성 위반 발견되지 않음. 아래는 검증 관점별 확인 내역이다(전부 정합, 위반 없음이므로 "발견사항"이 아니라 확인 근거로 기록).

### (a) discriminator 재도입 여부 — 미재도입, 원칙 준수 확인
- 과거 결정 출처: `spec/conventions/swagger.md` `### discriminator 는 판별자가 sound 할 때만 (§1-4)` — "`interactionType` 은 언뜻 판별자로 보이지만... `discriminator: { propertyName: 'interactionType' }` 을 선언하면... 런타임 `undefined` 가 된다. 따라서 `oneOf` 만 선언하고 판별은 **키 존재**(`'buttonConfig' in context`)로 남긴다." / `spec/5-system/14-external-interaction-api.md` §5.3 (line 480) "**`context` 는 판별자 없는 닫힌 2-variant union 이다.**"
- 코드 확인: `codebase/channel-web-chat/src/lib/eia-types.ts`(`WaitingContext = ButtonsContext | NodeOutputContext`, discriminator property 없음), `codebase/packages/sdk/src/client.ts` 동형. 두 파일 모두 JSDoc 에 "판별자가 아니다"를 그대로 재기술하고, `eia-events.test.ts`/`client.spec.ts` 에 `interactionType='buttons'`인데 `nodeOutput` variant 로 fallthrough 되는 컴파일 테스트("union 은 키 존재로 분기 — interactionType 은 판별자가 아님(회귀 가드)")를 신설해 정확히 과거 기각 이유를 재현·고정했다.
- 판정: 기각된 대안(discriminator) 미재도입. 오히려 Rationale 을 클라이언트 타입 레벨로 정확히 이식.

### (b) `conversationThread` null 정규화 여부 — 미정규화, 원칙 준수 확인
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17 "**부재 표현이 형제 필드와 다른 이유**" — `conversationThread` 는 값이 없으면 키를 생략(`| null` 아님), 형제 `currentNode`/`result`/`error` 는 `null`. / `spec/5-system/2-api-convention.md` `### 왜 conversationThread 를 null 로 정규화하지 않는가 (§5.4)`.
- 코드 확인: `eia-types.ts` `conversationThread?: ConversationThread`(optional, `| null` 미부여), `client.ts` `conversationThread?: Record<string, unknown>`(동형). 신규 테스트가 "conversationThread 는 present-when-available — 부재 시 키 생략(`| null` 아님)"을 명시로 검증(`'conversationThread' in ctx === false`, `parseWaitingForInput(ctx).conversationThread` === `undefined`).
- 판정: R17/api-convention §5.4 의 wire parity 원칙(REST `context` = SSE wire 동일 형식) 그대로 유지. 위반 없음.

### (c) ConversationThreadDto-equivalent 과잉 타입화 여부 — 미도입
- 위젯(`eia-types.ts`)은 diff 이전부터 이미 존재하던 `ConversationThread` 인터페이스(`git show 1682777fe:codebase/channel-web-chat/src/lib/eia-types.ts` line 58 에서 확인, 본 PR 신설 아님)를 재사용한다. 신규 nested DTO 스키마를 도입하지 않았다.
- SDK(`client.ts`)는 `conversationThread?: Record<string, unknown>` 로 **열어 둔 채** 유지한다.
- 이는 `plan/in-progress/eia-context-schema-followups.md` 의 미조치 항목(비고) — "`getStatus` 의 `buildWaitingContext()` 헬퍼 추출... 다음 관련 변경 시 후보" 및 swagger.md §1-4 "열린/동적 map" 예외(conversationThread 는 형태 고정이지만 SoT 이중화 회피로 열어 둠, followups 항목 3)와 정합된다 — 클라이언트가 새 고정 스키마 DTO 로 conversationThread 를 재정의하지 않은 것은 이 예외를 우회 없이 존중한 것.
- 판정: 위반 없음.

### (d) 런타임 wire 무변경 여부 — 확인됨
- `git diff 1682777fe..HEAD --stat` 실측: 변경된 실제 런타임 로직 파일은 `use-widget.ts`(6줄, `status.context as WaitingForInputEvent` 캐스트 제거만 — `parseWaitingForInput(ev: WaitingForInputEvent)` 시그니처·`eia-events.ts`(파싱 구현) 자체는 diff 에 없음, 즉 미변경) 뿐이다. 캐스트 제거는 `WaitingContext` 가 `WaitingForInputEvent` 에 구조적으로 assignable 하기 때문에 가능해진 순수 컴파일타임 변화다.
- backend `external-interaction` 모듈의 응답 DTO 파일(`responses.dto.ts` 등, `WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto` 정의처)은 diffstat 에 전혀 등장하지 않는다 — 즉 서버측 스키마·직렬화는 무변경. backend 쪽 변경은 `chat-channel/types.ts`·`terminal-revoke-reconciler.types.ts`·`chat-channel-config.dto.ts` 의 JSDoc 상대링크 경로 오타 수정뿐(런타임 무관).
- 판정: 런타임 wire 무변경 확인.

### 승인 범위(sanctioned follow-up) 일치 여부 — 일치, deferred 항목 미유입 확인
- `plan/in-progress/eia-context-schema-followups.md` 상단 진행 노트(2026-07-11): "아래 항목 중 **클라이언트 `context` 타입 정밀화**(위젯 + SDK)와 **spec 링크 가드 backend 확장**을 이번 PR 에서 처리한다. 나머지 2건(DTO 디렉토리 정규화 · swagger §1-4 본문 보강)은 범위 밖." → 커밋 로그와 diffstat 이 이를 정확히 반영: `964e887af feat(web-chat,sdk): EIA getStatus context 를 클라이언트에서도 닫힌 union 으로 정밀화`(항목 2) + `428134b64 test(docs): spec-link-integrity 가드를 codebase 소스로 확장 + 깨진 링크 14곳 정정`(항목 4, `spec-links.ts`/`spec-link-integrity.test.ts`/`spec-impl-evidence.md` 가드 문서 갱신).
- deferred 항목("비고" 절, 원 PR #904 의도적 미조치)인 (i) `additionalProperties: false` 부여, (ii) `getStatus` 의 `buildWaitingContext()` 헬퍼 추출 — 둘 다 diffstat 에 해당 backend 파일 변경이 없어 이번 PR 에도 유입되지 않았음을 확인.
- followups 항목 1("DTO 위치 정규화")·항목 3("swagger §1-4 본문 보강")도 마찬가지로 diff 에 미반영(체크박스 미해제 상태 유지) — 범위 이탈 없음.

## 요약

Rationale 연속성 관점에서 위반 없음. `swagger.md §discriminator 는 판별자가 sound 할 때만`과 EIA `§R17`/`api-convention §5.4`(conversationThread null 미정규화) 두 핵심 결정을 클라이언트 타입(`WaitingContext`/`ButtonsContext`/`NodeOutputContext`)이 정확히 재현했고, 신설 컴파일타임 테스트(negative `@ts-expect-error` 포함)가 과거 기각된 대안(discriminator 판별, null 정규화)의 재도입을 회귀 가드로 고정했다. `conversationThread` 는 신규 DTO-급 타입 없이 기존 `ConversationThread`(위젯)/열린 `Record`(SDK)를 재사용해 swagger.md §1-4 의 "열린 map 예외" 를 우회하지 않는다. `git diff 1682777fe..HEAD` 실측상 backend 런타임 스키마·`eia-events.ts` 파싱 로직 변경이 전무해 wire 무변경도 확인된다. 범위도 `eia-context-schema-followups.md` 가 명시적으로 승인한 항목 2(client context 정밀화)+4(spec-link 가드 backend 확장)에 정확히 국한되며, 의도적으로 defer 된 `additionalProperties:false`·`buildWaitingContext()` 헬퍼는 유입되지 않았다.

## 위험도

NONE
