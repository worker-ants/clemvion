# 코드 리뷰 — 요구사항 충족 관점 (fresh review, fix commit 반영 후)

- 대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` 2단계 컬럼 projection
- diff base: `origin/main` (`git diff origin/main...HEAD`)
- fix 커밋: `f2764f3a9 refactor(external-interaction): ai-review Warning 4건 반영 — projection 상수화 + 인가 경계 테스트`
- 관련 spec: `spec/5-system/14-external-interaction-api.md` §5.3/§R17, `spec/conventions/conversation-thread.md` §4/§5.3/§8.4, `spec/7-channel-web-chat/1-widget-app.md` §3.1
- 선행 리뷰: `review/code/2026/07/10/22_47_32/`(Critical 0/Warning 4, 전량 fix) + `RESOLUTION.md`

## 중점 검토 1 — fix 로 바뀐 JSDoc/주석 서술의 정확성

**결론: 정확함.** 직접 SoT 코드를 대조 확인했다.

- `spec/conventions/conversation-thread.md` §4 (영속화 표) + §1.3(`nextSeq`) 이 참조하는 storage cap 은
  `STORAGE_MAX_TURNS` — 실제 값은 `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts:68`
  에 `export const STORAGE_MAX_TURNS = 500;` 로 정의, `appendInternal`(같은 파일 :234-240)이 `thread.turns.length > STORAGE_MAX_TURNS`
  일 때 오래된 turn 을 `splice` 로 drop — **turn 개수 상한 500** 이 맞다.
- `MAX_TURN_TEXT_CHARS = 4000` 은 `codebase/backend/src/shared/conversation-thread/thread-renderer.ts:106` 에 정의되고,
  적용 지점은 같은 파일 `applyCap()`(:243-249) — `nodes/ai/shared/conversation-context-injection.ts:162` 와
  `nodes/ai/ai-agent/ai-memory-manager.ts:266` 두 곳에서만 호출된다. 둘 다 **LLM 컨텍스트 주입(§5.3 injection cap) 경로**이며,
  storage/append 경로(`ConversationThreadService.appendInternal`)에서는 전혀 호출되지 않는다(grep 으로 호출부 전수 확인,
  `appendInternal` 안에 `MAX_TURN_TEXT_CHARS`/`applyCap` 참조 0건).
- `appendInternal`(`conversation-thread.service.ts:201-241`) 은 `text: args.text` 를 그대로 push 할 뿐 truncate 로직이
  전혀 없다 — turn 텍스트 길이에 storage-time 상한이 없다는 주석 서술과 일치.

따라서 fix 후 주석("turn 이 최대 500개(§4 storage cap)이고 turn 텍스트는 저장 시점에 truncate 되지 않으므로(4000자 cap 은
LLM 주입 시점 §5.3 전용) 행이 수 MB 까지 자란다", `interaction.service.ts:266-267`)은 spec·구현과 line-level 로 정확히 일치한다.
직전 리뷰의 INFO(500turn×4000자 합성 근사치 부정확)가 올바르게 해소됐다.

## 중점 검토 2 — §5.3 응답 계약 9개 필드

`getStatus()` 반환 객체(`interaction.service.ts:365-393`)를 spec §5.3 JSON 블록(`14-external-interaction-api.md:446-465`)과
line-level 대조:

| 필드 | spec | 구현 소스 |
|---|---|---|
| `id` | O | 1단계 projection `execution.id` |
| `workflowId` | O | 1단계 `execution.workflowId` |
| `status` | O | 1단계 `execution.status` |
| `currentNode` | O(waiting 한정) | 2단계 `nodeExec`(대기 NodeExecution) |
| `context` | O(waiting 한정) | 2단계 `nodeExec.outputData` + `threadRow.conversationThread` |
| `result` | O(completed 한정) | 1단계 `execution.outputData` (`deepRedactSecrets`) |
| `error` | O(failed 한정) | 1단계 `execution.outputData` (`deepRedactSecrets`) |
| `seq` | O(항상 0 placeholder) | `SSE_SEQ_PLACEHOLDER` 상수 |
| `updatedAt` | O | 1단계 `finishedAt ?? startedAt ?? new Date()` |

9개 필드 전부 채워지며, `updatedAt` 의 두 소스 컬럼(`startedAt`/`finishedAt`)이 `STATUS_PROJECTION_COLUMNS`(:66-73)에
명시적으로 포함돼 있어 "누락 시 `new Date()` 로 침묵 회귀" 리스크가 실제 프로젝션 목록 대조로 차단됨을 확인.
회귀 테스트(`interaction.service.spec.ts` `'updatedAt — finishedAt 우선, 없으면 startedAt 의 실값 (fallback 침묵 회귀 가드)'`)도
실값 문자열 비교로 존재.

## 중점 검토 3 — "durable thread 없으면 `conversationThread` 키 생략" 계약

`interaction.service.ts:312-347`:
```
const conversationThread = threadRow?.conversationThread
  ? redactThreadForPublic(threadRow.conversationThread)
  : undefined;
...
const base = {
  interactionType,
  waitingNodeId: nodeExec.nodeId,
  ...(conversationThread ? { conversationThread } : {}),
};
```
- `threadRow` 자체가 null(2단계 재조회 사이 row 소멸)이거나 `threadRow.conversationThread` 가 null(park 이력 없음/배포
  이전 row) 인 두 케이스 모두 `undefined` 로 수렴 → 스프레드가 키 자체를 생략(값 `null` 이 아님). spec §5.3 문구
  ("durable thread 가 없는 경우...`context.conversationThread` **키를 생략**한다(형제 필드의 `null` 관례와 달리 키 부재)")와
  정확히 일치. 테스트(`'2단계 재조회가 null(조회 간 row 소멸)이면 conversationThread 키 미동봉'`, `.not.toHaveProperty('conversationThread')`)로 고정.
- 부수 확인: `nodeExec?.node` 가 falsy(대기 NodeExecution 을 못 찾음)면 `conversationThread` 를 이미 재조회했더라도
  `base`/`context` 조립 자체가 스킵돼(:315 `if (nodeExec?.node) {`) `context` 전체가 `null` 로 남는다. 이는 diff 이전부터의
  기존 동작(이 if 분기 조건 자체는 변경되지 않음)이며 테스트(`'waiting + 대기 nodeExec 없음 — thread 가 있어도
  context/currentNode 는 null'`)로 고정돼 있다. spec §5.3 은 waiting 이되 대기 노드가 없는 엣지케이스를 명문화하지
  않으므로 회색지대(INFO) — 계약 위반은 아니다.

## 중점 검토 4 — `1-widget-app.md §3.1` 재동기화 계약과 waiting-only fetch

`spec/7-channel-web-chat/1-widget-app.md:89` (페이지 새로고침/이동 행):
> "`GET /:id`(**`waiting_for_input` 상태면** durable `conversationThread` 동봉 — 그 경우 5분 SSE buffer 무관·서버
> 재시작 무관하게 전체 히스토리 복원, [EIA §5.3·§R17])"

명시적으로 **waiting_for_input 상태 한정**을 계약으로 걸어두고 있어, 본 diff 의 `if (execution.status ===
ExecutionStatus.WAITING_FOR_INPUT)` 안에서만 2단계 thread fetch 를 수행하는 것과 완전히 합치한다. 이 if 조건 자체는
diff 전후 동일(값은 그대로, 조회 시점만 지연)이므로 스코프 축소가 아니라 최적화다. `§3.1` 의 5분 SSE 버퍼 만료 폴백
서술(line 95-98)도 동일하게 waiting 시나리오를 전제하므로 영향 없음.

## 중점 검토 5 — 남은 TODO/미완/의도-구현 괴리

- `interaction.service.ts` / `interaction.service.spec.ts` 전체에 TODO/FIXME/HACK/XXX 문자열 0건 (grep 확인).
- `plan/in-progress/eia-getstatus-column-projection.md` 체크리스트: 9a(REVIEW WORKFLOW) 완료 기록, 9b(`--impl-done`
  consistency-check)·9c(fresh ai-review) 만 미체크 — **본 fresh review 가 9c 에 해당**하므로 정상 진행 상태이며 미완성
  기능 방치가 아님.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 line-number 인용이 `interaction.service.ts:247-296`
  → `:276-351` 로 갱신됐고, 실제 currentNode/context 조립 블록(:286-364)과 대략 일치(참고용 line 인용이라 line-level
  엄밀함은 spec 본문 요구사항이 아님, INFO).

## 추가 관찰 (요구사항 범위 밖, 참고 기록)

- **[INFO] Jest 로컬 재실행 중 간헐적 flaky 관측** — `interaction.service.spec.ts` 를 `--clearCache` 직후 반복 실행하면
  드물게(수십 회 중 2~3회) 서로 다른 3개 테스트가 예측 불가하게 실패하는 현상을 직접 관측했다(예: 1단계 select 목록에
  존재하지 않는 `'triggerId'` 가 섞여 나옴, waiting+nodeExec 없음 케이스에서 `context` 가 null 이 아닌 thread 를 반환).
  `--no-cache` 로 강제하면 8/8 전부 clean, cache-warm 상태로 반복하면 다시 15~20회 연속 clean — **ts-jest 디스크
  트랜스폼 캐시 워밍 레이스로 추정**(소스 로직 자체의 결정론적 결함이라면 매회 재현돼야 하는데 그렇지 않음). 이 저장소는
  다수의 git worktree 를 병행 사용 중이라(`git worktree list` 11개) 캐시/haste 관련 레이스가 낯설지 않은 환경. 개발자의
  공식 TEST WORKFLOW 기록(`RESOLUTION.md`)도 unit 43/43 PASS 로 보고돼 있어, 이 diff 의 비즈니스 로직 결함으로 보지
  않는다. CI/타 세션에서 유사 flaky 재발 시 `jest --clearCache` 직후의 캐시 레이스를 의심할 근거로 남긴다(코드 fix
  대상 아님, requirement 충족 판정에 영향 없음).

## 요약

fix 커밋은 직전 리뷰 INFO(thread 크기 상한 주석의 근거 수치 오류)를 정확하게 정정했다 — `STORAGE_MAX_TURNS=500`(append/storage
cap)과 `MAX_TURN_TEXT_CHARS=4000`(LLM 주입 cap, `applyCap` 경유)가 서로 다른 시점의 별개 cap 이며 append 시점 truncation이
없다는 서술이 소스 코드와 정확히 일치함을 직접 확인했다. §5.3 의 9개 응답 필드는 1단계/2단계 projection 으로 빠짐없이
재구성되고, "durable thread 없으면 키 생략" 계약(null 값이 아닌 키 부재)도 두 소멸 경로(row 자체 없음/컬럼 null) 모두에서
정확히 지켜진다. 위젯 §3.1 은 애초에 `GET /:id` 의 durable thread 동봉을 `waiting_for_input` 상태로 명시적으로 한정하고
있어 본 2단계 fetch 최적화와 완전히 합치하며 스코프 축소가 아니다. TODO/FIXME 등 미완 흔적은 없고, 함수 JSDoc·주석과
실제 구현 사이의 괴리도 발견되지 않았다. 리뷰 과정에서 로컬 Jest 재실행 시 캐시-워밍 레이스로 추정되는 간헐적 flaky
현상을 관측했으나 `--no-cache` 로는 재현되지 않고 개발자의 공식 TEST WORKFLOW 기록도 clean 이라 이 diff 의 결함으로
판단하지 않는다(INFO 로만 기록). Critical/Warning 급 요구사항 미충족은 없다.

## 위험도

NONE

---

STATUS: OK
