# Requirement Review — spec/conventions/node-cancellation.md

## 검토 범위
`spec/conventions/node-cancellation.md` §1(목적 나열)·§6(구현 현황 표) 갱신. 실질 변경:
1. §1 대상 노드 나열에서 `chat-channel` 제거.
2. §6 범례에 `N/A = 범주 오류로 대상에서 철회` 신설 + 갱신일 2026-07-26.
3. §6 `chat-channel 노드 signal 전파` 행을 `—`(미구현)에서 `~~취소선~~`/`N/A`(범주 오류로 철회) 로 재기재.
4. §6 `MakeShop`/`Cafe24` 노드 signal 전파 행을 `—`(미구현)에서 `✓`(구현됨) 로 승격.

본 문서 자체가 spec 이므로, "요구사항 충족" 검증은 이 spec 이 서술하는 코드 상태 주장이 실제 코드베이스와 line-level 로 일치하는지에 집중했다.

## 검증 절차 및 근거
- `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:833-889` — `executeWithRetry` 내부에 §4 cascade 패턴(`already-aborted` 즉시 abort 분기 포함, `finally` 에서 listener 해제, timeout-abort 와 upstream-abort 구분해 `recordNetworkFailure` 오호출 방지) 확인. `cafe24-api.client.ts:1204-1262` 도 동일 구조.
- `makeshop.handler.ts:240-261`, `cafe24.handler.ts:253-272`(+파일 하단 outer catch) — `context.abortSignal` 을 client 로 전달하고, client 가 rethrow 한 `AbortError` 를 handler 의 inner/outer catch 양쪽에서 재throw(§5.1) 하여 엔진 `isAbortError` 분류 경로가 살아있음을 확인. 두 handler 모두 API 호출 지점이 단 1곳(`apiClient.call`)이라 우회 경로 없음.
- 단위 테스트 실존·명칭 확인: `makeshop-api.client.spec.ts` `describe('abortSignal cascade (node-cancellation §4)')`(already-aborted 분기 포함), `it('rethrows AbortError and does NOT count a network failure when the execution was cancelled', ...)`; `makeshop.handler.spec.ts:577` `it('rethrows AbortError so the ENGINE can classify the node as cancelled', ...)`. `cafe24-api.client.spec.ts`·`cafe24.handler.spec.ts:750` 대칭 확인. spec 표가 인용한 테스트 파일명·요약이 실제와 일치.
- `rawPing()`(`cafe24-api.client.ts:467-499`, MakeShop 대칭)은 signal 미배선 상태지만, 이는 연결-테스트 경로로 노드 실행 컨텍스트가 없어 spec §6 표/추적 plan 이 대상에서 명시적으로 제외한 부분과 일치 — 누락이 아니라 의도된 범위.
- chat-channel 재분류 근거 교차검증: `spec/1-data-model.md` §2.8 Trigger `type` 필드 정의("chat-channel 은 별도 type 이 아니라 webhook 트리거의 config.chatChannel 변형") 일치. `spec/5-system/15-chat-channel.md` CCH-AD-05(어댑터가 `executionEvents$` 구독, `execution.cancelled` 포함 5종 outbound 이벤트 발송) 및 Rationale R1("새 트리거 유형 신설하지 않음") 과 일치. `codebase/backend/src/nodes/core/node-handler.interface.ts:239-244` JSDoc 도 같은 근거로 이미 정정되어 있어 spec-코드 간 서술이 정합.
- `plan/in-progress/node-cancellation-residual-signal-propagation.md` — chat-channel/MakeShop/Cafe24 3개 체크리스트 항목이 `[x]` 로 닫혀 있고, 본 spec 갱신을 "이행 완료"로 되짚는 진행 기록이 있어 spec ↔ plan 양방향 포인터가 일치. 잔여 미해결 항목(workflow-timeout 노드 abort BLOCKED, IE multi-turn resume, 선형 경로 기전 규명) 이 남아 있어 frontmatter `status: partial` + 비어있지 않은 `pending_plans` 유지가 옳다 (spec-status-lifecycle 가드 (b)/(c) 와 정합).
- 선행 `consistency-check --spec`(`review/consistency/2026/07/26/02_52_18`, BLOCK: NO)에서 지적된 WARNING 2건(§6 범례에 `N/A` 미정의, 위임 plan 포인터 미갱신)이 본 diff 에서 실제로 해소됐음을 재확인(범례 123행에 `N/A` 정의 추가, plan 파일에 "이행 완료" 갱신 존재).

## 발견사항

- **[INFO]** §6 표 127행의 `ExecutionContext.abortSignal?: AbortSignal` 신규 필드 근거 인용이 stale — `node-handler.interface.ts:193` 를 가리키지만 실제 필드는 `node-handler.interface.ts:246` (`abortSignal?: AbortSignal;`). 193행은 `conversationThread` JSDoc 끝부분(무관한 다른 필드)이다.
  - 위치: `spec/conventions/node-cancellation.md:127`
  - 상세: 이 행은 금번 diff 의 변경 대상이 아니고(변경된 3개 hunk 밖의 기존 행), JSDoc 안에 필드가 다수 삽입되면서 줄 번호가 밀린 것으로 보인다. 같은 §6 표 안에서 금번 diff 가 다른 인용(파일명·테스트명)의 정확성을 새로 확립한 것과 대비되어, 표 전체의 신뢰도를 낮추는 잔여 결함이다.
  - 제안: `node-handler.interface.ts:246` 로 정정하거나(라인 인용 유지 시 흔들리기 쉬우므로), 라인 번호 대신 필드명/JSDoc 앵커만 인용하는 방식으로 바꾸는 것을 고려. spec 직접 수정은 `project-planner` 소관.

- **[INFO]** frontmatter `code:` 목록에 MakeShop/Cafe24 client·handler 파일이 미등재 — §6 표에서 이번에 `✓` 로 승격된 핵심 근거 파일(`makeshop-api.client.ts`, `makeshop.handler.ts`, `cafe24-api.client.ts`, `cafe24.handler.ts`)이 정작 spec frontmatter `code:` 글로브에는 없다.
  - 위치: `spec/conventions/node-cancellation.md:4-11` (frontmatter, 이번 diff 로 변경되지 않은 기존 블록)
  - 상세: `spec-code-paths.test.ts` 가드는 글로브가 ≥1 매치만 요구해 통과하며(`spec-impl-evidence.md` R-1 글로브 정책), 이 갭이 build 를 차단하지는 않는다. 이미 동일 지적이 선행 consistency-check INFO#2 로 기록돼 "선택 사항"으로 분류됐다 — 신규 결함 아님, 중복 확인 차원.
  - 제안: (선택) `code:` 에 `codebase/backend/src/nodes/integration/makeshop/**`, `codebase/backend/src/nodes/integration/cafe24/**` 추가해 R-6 "spec 이 약속한 구현 surface" 취지에 더 가깝게. 필수 아님.

- **[INFO]** §6 MakeShop 행의 테스트명 인용이 부분 발췌 — 실제 테스트 제목은 `'rethrows AbortError so the ENGINE can classify the node as cancelled'` 인데 spec 은 `"rethrows AbortError so the ENGINE can classify"` 까지만 인용(말줄임 표시 없음).
  - 위치: `spec/conventions/node-cancellation.md:138`
  - 상세: 의미 왜곡은 없으나 line-level 정확성 기준으로는 정확한 인용이 아니다. Cafe24 행(139행)은 별도 인용 없이 "MakeShop 과 동일 구조"로만 서술해 이 문제가 없다.
  - 제안: 전체 문구 인용 또는 "..." 로 절단 표시. 낮은 우선순위.

CRITICAL/WARNING 급 결함은 발견되지 않았다. §1 목적 나열 수정, §6 범례 신설, chat-channel N/A 재분류, MakeShop/Cafe24 ✓ 승격 — 4개 실질 변경 모두 실제 코드(`makeshop-api.client.ts`/`cafe24-api.client.ts`/양 handler/단위테스트 8건)와 교차 참조 spec 문서(`1-data-model.md` §2.8, `5-system/15-chat-channel.md` CCH-AD-05·R1, `node-handler.interface.ts` JSDoc, `4-nodes/1-logic/10-parallel.md`)에 대해 line-level 로 정확했다. TODO/FIXME 류 미완성 표식 없음. 반환값·에러 시나리오·엣지케이스는 코드 레벨(makeshop/cafe24 client·handler)에서 already-aborted 분기·timeout-abort vs upstream-abort 구분·성공 경로 listener 해제까지 확인되며 spec 서술과 일치한다. frontmatter `status: partial` + `pending_plans` 유지는 plan 잔여 항목(workflow-timeout 노드 abort 등)과 정합해 spec-status-lifecycle 가드 위반 없음.

## 요약
이번 diff 는 `node-cancellation.md` §1/§6 을 실제 코드 병합(MakeShop·Cafe24 §4 cascade + §5.1 AbortError 재throw, 커밋 `e83da5052`)과 착수 전 프로브가 반증한 chat-channel 범주 오류에 소급 정합시키는 순수 문서 교정이다. 변경된 모든 주장(코드 위치·테스트 파일명·타 spec 문서 인용)을 직접 코드베이스와 대조 검증한 결과 실질적 불일치는 없었다. 다만 이번 diff 범위 밖의 기존 표 행(§6 127행 `node-handler.interface.ts:193` 줄 번호 인용)이 stale 상태로 남아 있어 표 전체의 line-level 신뢰도를 소폭 낮추며, `code:` frontmatter 미등재·테스트명 부분 인용은 선택적 개선 사항이다. 셋 다 기능/빌드를 막지 않는 INFO 급이다.

## 위험도
LOW
