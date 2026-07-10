# 부작용(Side Effect) 리뷰 — `interaction.service.ts` `getStatus()` 리베이스 병합 검증

## 스코프 정정

`_prompts/side_effect.md` payload 의 "변경된 코드" 목록(파일 1~6)은 실제로는 `review/consistency/**`
산출물 3건 + `spec/**` 문서 3건뿐이며 `codebase/backend/.../interaction.service.ts` 자체의 diff 는
포함돼 있지 않다. 그러나 orchestrator 지시(ONE job)가 명시적으로 이 파일의 `getStatus()` 실제 병합
결과 검증을 요구하므로, payload 목록과 무관하게 대상 파일을 직접 Read 하고 관련 커밋들의 diff/git
show 로 병합 전후를 대조했다. 아래는 그 결과다.

## 조사 방법

1. `codebase/backend/src/modules/external-interaction/interaction.service.ts` 전문 Read (현재 작업 트리).
2. `git log --oneline -- .../interaction.service.ts` 로 관련 커밋 순서 확인: `49c2185d1`(PR #903, 2단계
   projection) → `525beca8e`(본 브랜치, `getStatus context` 닫힌 oneOf 화) → `ee271026e`(ai-review
   Warning 5건 반영, 이 파일에는 타입명 rename 1줄만).
3. `git show origin/main:.../interaction.service.ts` 로 "PR #903 만 적용된" 상태(즉 병합 전 베이스)를
   복원해 `525beca8e`의 diff hunk 와 대조.
4. `git show 525beca8e -- .../interaction.service.ts` / `git show ee271026e -- ...` 로 실제 diff 재생.
5. `npx jest interaction.service.spec.ts dto/responses.dto.spec.ts` (60 tests, 전부 PASS) + scoped
   `tsc --noEmit` (해당 파일 에러 0) 로 실측 검증.

## 발견사항

- **[INFO]** 병합은 "adjacent hunks" 가 아니라 애초에 **비중첩(non-overlapping) 텍스트 영역**이었다 — 진짜 병합 위험이 낮은 케이스
  - 위치: `interaction.service.ts` `getStatus()` L265-397
  - 상세: `origin/main`(PR #903 단독 상태)과 `525beca8e`(본 브랜치 rewrite) 를 diff 해 보면, PR #903 이 건드린 영역(1단계 `STATUS_PROJECTION_COLUMNS` 조회, `Promise.all([threadRow, nodeExec])`, `conversationThread` local const 계산 — L271-315)과 본 브랜치가 건드린 영역(`if (interactionType) { const base: WaitingContextBaseDto = ...; context = 삼항 ... }` — L343-365)은 완전히 분리된 코드 블록이다. 두 diff 가 겹치는 라인이 하나도 없어 git 이 실제 3-way 충돌 해소 로직 없이 순수 텍스트 병합만으로 정확한 결과를 낼 수 있는 구조였다. 즉 "adjacent hunks 자동병합" 이 리스크가 높은 이유(같은 라인 근방을 서로 다른 의도로 고침)가 여기서는 성립하지 않는다.
  - 제안: 조치 불필요. 참고 기록.

- **[INFO]** `(4)` 에서 우려한 "stage-1-would-have-vs-stage-2-absent" 시나리오는 애초에 존재하지 않는다
  - 위치: L67-74 (`STATUS_PROJECTION_COLUMNS`), L295-315 (2단계 `threadRow` 조회)
  - 상세: 1단계 `STATUS_PROJECTION_COLUMNS` 는 `conversationThread` 를 **의도적으로 제외**한 컬럼 목록이다(주석 L65 "`conversation_thread` 는 의도적으로 제외 — `waiting_for_input` 에서만 2단계로 읽는다"). 즉 `conversationThread` 값의 유일한 출처는 `waiting_for_input` 분기 안의 2단계 `threadRow` 쿼리뿐이며, "1단계였다면 값이 있었을 것" 이라는 별도 소스가 아예 없다 — 비교할 두 값이 원래 하나뿐이다. 따라서 "두 단계가 서로 다른 conversationThread 를 볼 수 있다" 는 race 는 설계상 불가능하고, `...(conversationThread ? {conversationThread} : {})` 키-생략 로직은 이 유일한 소스(threadRow) 하나만 소비한다.
  - 제안: 조치 불필요. 참고 기록.

## 항목별 결론

**(1) `conversationThread` local const 가 `base` 조립에 그대로 소비되는가 / 동일 변수·동일 마스킹인가**

Yes — 동일하다. L313-315:
```ts
const conversationThread = threadRow?.conversationThread
  ? redactThreadForPublic(threadRow.conversationThread)
  : undefined;
```
이 선언은 `if (execution.status === WAITING_FOR_INPUT)` 블록 최상단(L295 `Promise.all` 직후)에 위치하고, `if (nodeExec?.node)`(L316) → `if (interactionType)`(L343) 로 중첩된 안쪽 블록의 `base` 조립(L348-352)이 **클로저로 동일 변수를 그대로 참조**한다:
```ts
const base: WaitingContextBaseDto = {
  interactionType,
  waitingNodeId: nodeExec.nodeId,
  ...(conversationThread ? { conversationThread } : {}),
};
```
변수명·마스킹 helper(`redactThreadForPublic`) 모두 PR #903 이 도입한 것 그대로이며, 본 브랜치 커밋은 이 계산부를 전혀 건드리지 않았다(diff 확인 완료). `ee271026e` 도 이 블록에는 타입 annotate 이름(`WaitingContextBase`→`WaitingContextBaseDto`) 변경 외 손대지 않았다.

**(2) wire key 보존 여부**

Yes — 아래 키 셋이 `git show origin/main:...`(PR #903 단독) 대비 정확히 보존됐다:
- top-level: `id`/`workflowId`/`status`/`currentNode`/`context`/`result`/`error`/`seq`(`SSE_SEQ_PLACEHOLDER`=0)/`updatedAt` — 본 브랜치 diff 는 `return {...}` 블록(L368-396)을 전혀 건드리지 않았다(diff 확인).
- `context` 내부: `interactionType`/`waitingNodeId`/`conversationThread?`(있을 때만) + `buttonConfig`(buttons variant) 또는 `nodeOutput`(form/ai_conversation + buttonConfig 복원 실패한 buttons fallthrough) — 이 키 이름·구조는 `525beca8e` 전후로 문자 그대로 동일하다. 바뀐 것은 **타입 표현**(`WaitingContextBaseDto` 명시 annotate, `if/else if` → `if (interactionType) { ternary }`)뿐, 런타임 키 셋이나 값 계산 로직은 1바이트도 다르지 않다. `git show 525beca8e -- interaction.service.ts` diff 재확인: 로직적으로 동치인 리팩터(if/else-if 문 → `if` 가드 + 삼항)임을 직접 대조했다.
- `dto/responses.dto.ts` (`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`) 필드도 `interactionType`/`waitingNodeId`/`conversationThread?`(optional, `| null` 아님)/`buttonConfig`/`nodeOutput` 로 위 wire 키와 1:1 대응 — 타입-런타임 drift 없음.

**(3) redaction 순서 — 병합이 우회를 만들지 않았는가**

No bypass. 순서:
1. L313-315 `redactThreadForPublic(threadRow.conversationThread)` → `conversationThread` const.
2. L320 `deepRedactSecrets(nodeExec.outputData ?? {})` → `out` const (조립 이전, `if (nodeExec?.node)` 블록 최상단).
3. L348-364 `base`/`context` 조립 — 위 두 마스킹된 값(`conversationThread`, `out`)만 소비, 원본 unredacted 값에 대한 참조·재도입 경로 없음.
4. `result`/`error` (L376-389)도 별도로 `deepRedactSecrets(execution.outputData ...)` 를 거치며, 이 경로는 `context` 조립과 완전히 독립 — 병합이 손댄 블록 밖.

두 마스킹 호출 모두 조립보다 선행하는 순서가 PR #903 → 본 브랜치 커밋들을 거치며 그대로 유지됐다.

**(4) 2단계 `threadRow` 재조회와 키-생략 로직의 상호작용**

위 발견사항 참조 — 상호작용 문제 없음. 애초에 "1단계였다면 존재했을 값" 이라는 비교 대상 자체가 없다(1단계는 이 컬럼을 아예 select 하지 않음). 유일한 race 가능성은 1단계 조회와 2단계 재조회 사이에 실행이 진행되어 `threadRow` 가 사라지는 경우인데, 이는 코드 주석(L293-294)이 이미 "row 가 사라지면 아래 null 분기가 'durable thread 없음' graceful 경로로 흡수" 라고 명시하고 있고 실제로 `threadRow?.conversationThread` optional chaining 이 그 경로를 담당 — `undefined` 시 `base` 스프레드가 키를 아예 생략한다(present-when-available 계약과 정합).

## 실측 검증

- `npx jest src/modules/external-interaction/interaction.service.spec.ts src/modules/external-interaction/dto/responses.dto.spec.ts` → **2 suites / 60 tests 전부 PASS**.
- scoped `tsc --noEmit -p tsconfig.json` → 두 파일 관련 에러 **0건**.

## 요약

`interaction.service.ts` `getStatus()` 의 리베이스 병합은 의미론적으로 건전하다. PR #903(`49c2185d1`, 2단계 projection + `threadRow` 재조회 + `conversationThread` local const 계산)과 본 브랜치(`525beca8e`, closed-oneOf 타입화 리팩터)의 diff 는 실제로는 코드상 완전히 분리된 두 블록을 건드려 "adjacent hunks" 이지만 겹치는 라인이 없는 안전한 케이스였다. `conversationThread` 는 `threadRow`→`redactThreadForPublic` 로 계산된 동일 클로저 변수가 `base` 조립에 변경 없이 그대로 소비되고, `deepRedactSecrets`/`redactThreadForPublic` 마스킹은 조립 이전 순서를 그대로 유지하며 우회 경로가 생기지 않았다. wire key 셋(top-level 8개 + `context` 내부 3~4개)은 PR #903 단독 상태와 문자 그대로 동일 — 바뀐 것은 TS 타입 표현(명시 annotate, if/else-if→if+삼항)뿐 런타임 값 계산은 무변경이다. 2단계 재조회와 키-생략 로직 사이의 우려된 "stage-1-would-have" 불일치는 설계상 애초에 성립하지 않는(1단계가 그 컬럼을 아예 읽지 않는) 시나리오다. 실측(jest 60건 PASS, scoped tsc 에러 0)으로 이론적 분석을 재확인했다. 시그니처 변경(`getStatus(ctx)` 그대로), 전역 상태·ENV·네트워크·이벤트 콜백 관련 부작용은 이번 diff 범위에 없다.

## 위험도

NONE

STATUS: SUCCESS
