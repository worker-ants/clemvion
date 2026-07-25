# Plan 정합성 Check — plan_coherence

target: `spec/conventions/` (impl-done, diff-base=`origin/main`), 실질 diff = `spec/conventions/node-cancellation.md` §1·§6 + `spec/4-nodes/1-logic/10-parallel.md` §244 + `codebase/backend/src/nodes/core/node-handler.interface.ts` JSDoc.

본 라운드는 특히 다음을 검증했다: "위임 원본 plan 2건(`node-cancellation-residual-signal-propagation.md`, `spec-update-node-cancellation-shutdown-classification.md`)의 '이행 완료' 갱신이 실제 상태와 일치하는가."

## 검증 절차 요약

1. `git diff origin/main HEAD` 로 실제 변경 파일 전량 확인 (spec 2건 + JSDoc 1건 + plan 3건 + review 산출물).
2. plan 이 주장하는 각 항목을 HEAD 워킹트리에서 직접 재확인:
   - `node-cancellation.md` §1 "목적" 나열에서 `chat-channel` 제거 — 확인.
   - §6 범례에 `N/A` 신설 (123행) — 확인.
   - §6 표 `chat-channel` 행 → 취소선 + `N/A` + 근거(§2.8 트리거·CCH-AD-05) — 확인.
   - §6 표 MakeShop/Cafe24 행 → `✓` (근거: client §4 cascade + handler §5.1 재throw) — 확인.
   - `10-parallel.md:244` 의 "HTTP 노드만" stale 서술 정정 — 확인.
   - `node-handler.interface.ts` JSDoc 의 chat-channel 오분류 제거 + Cafe24/MakeShop 추가 — 확인.
3. 인용된 테스트가 실재하는지 라인 번호까지 확인: `cafe24.handler.spec.ts:750`, `makeshop.handler.spec.ts:577` 모두 정확히 `rethrows AbortError so the ENGINE can classify the node as cancelled` — 확인 (`git -C` 불필요, 워킹트리 실측).
4. 인용된 spec 앵커 실재 확인: `1-data-model.md §2.8 Trigger`(223행), `5-system/15-chat-channel.md` CCH-AD-05(58행, `execution.cancelled` 포함)·Rationale R1(513행) — 확인.
5. `plan/complete/spec-draft-node-cancellation-chat-channel-correction.md` (신설, 128줄)이 위 모든 편집의 근거 문서이며, 자신의 "집행 결과" 절에 직전 라운드(`review/consistency/2026/07/26/02_52_18`) WARNING 1·2 해소 내역을 명시 — 실제 diff 와 1:1 대응.
6. 두 위임 원본 plan 의 "이행 완료" 표기가 가리키는 실제 spec 편집이 diff 에 존재하는지, 그리고 **아직 미해결인 결정**(SIGTERM/workflow-timeout 최종 상태 `cancelled` vs `failed` 택일)이 이번 커밋에서 우회되지 않았는지 확인:
   - `spec-update-node-cancellation-shutdown-classification.md` 의 "이행 완료"는 오직 "추가 위임(§6 두 행 갱신)"과 "추가 위임 #5(chat-channel 범주 오류)" **두 절**에만 붙어 있고, 본 문서의 핵심 "결정이 필요하다 (택일)" 절(§(a)/(b))은 체크박스 미변경·손대지 않음.
   - `git diff origin/main HEAD -- spec/5-system/4-execution-engine.md spec/1-data-model.md spec/data-flow/3-execution.md codebase/backend/src/modules/executions/shutdown-state.service.ts` → 변경 없음. 즉 (a)/(b) 결정과 무관한 spec_impact 파일들은 실제로 손대지 않았다 — 미해결 결정을 우회한 흔적 없음.
   - `node-cancellation.md` frontmatter `pending_plans: [node-cancellation-residual-signal-propagation.md]` 그대로 유지, `status: partial` 그대로 — `spec-status-lifecycle` 가드 (b)/(c) 와 정합 (해당 plan 이 여전히 BLOCKED 항목·IE resume 항목을 열어 두고 있어 `plan/complete/` 로 안 갔으므로 `implemented` 로 오승격되지 않음).

결론: **두 plan 의 "이행 완료" 포인터는 실제 상태와 정확히 일치한다.** 과대 주장(실제로 안 한 일을 했다고 기재)도, 과소 반영(실제로 한 일을 pending 으로 잘못 남김)도 없었다. 직전 라운드가 지적한 WARNING(§6 범례 미정의, 위임 포인터 미갱신)이 정확히 이번 diff 로 해소됐다.

## 발견사항

- **[INFO]** chat-channel N/A 결론은 완전히 새로운 발견이 아니라 이미 한 번 확정됐던 결론의 재발견
  - target 위치: `spec/conventions/node-cancellation.md:137` (§6 chat-channel 행), `plan/in-progress/node-cancellation-residual-signal-propagation.md:33-45` ("착수 전 프로브에서 전제가 반증됐다")
  - 관련 plan: `plan/complete/node-cancellation-infrastructure.md:17,84` — "**재검증 (2026-06-20)**: ... §6.2 chat-channel 은 워크플로우 노드 부재로 **N/A** 처리" / "`[x]` ~~chat-channel 노드 ... signal 전파~~ — **N/A**: chat-channel 은 워크플로우 노드가 아니라 message-channel adapter"
  - 상세: `node-cancellation-infrastructure.md` 가 2026-06-20 무렵 이미 "chat-channel 은 노드가 아니라 N/A" 로 결론짓고 완료 이동했는데도, 그 뒤 어느 시점에 `spec/conventions/node-cancellation.md` §6 표는 `— 미구현 (Planned)` 으로 재기재돼 있었다(스프레드시트성 문서라 완료 plan 의 결론이 spec 표로 역-미러링되지 않은 채 남은 것으로 보임). 이번 라운드의 "착수 전 프로브" 는 결과적으로 6주 전 이미 답이 나와 있던 결론을 처음부터 재발견한 셈이다. 이번 정정 자체는 옳고 두 결론이 완전히 일치하므로 **모순은 아니다** — 다만 완료 plan 의 확정 결론이 spec 표와 동기화되지 않아 재작업이 발생했다는 공정 낭비 패턴을 기록해 둔다.
  - 제안: 실효성 있는 조치 불요(이미 정정 완료). 향후 유사 사례 방지를 위해 "완료 plan 의 N/A/won't-do 결론은 관련 spec 표에도 즉시 반영" 관행을 팀 규약(`plan-lifecycle.md`)에 명문화할지는 선택.

- **[INFO]** `frontmatter.code:` 미확장은 기존 정책과 정합
  - target 위치: `spec/conventions/node-cancellation.md` frontmatter `code:` (Cafe24/MakeShop client·handler 파일 미등재)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:97-98`, `plan/complete/spec-draft-node-cancellation-chat-channel-correction.md:95-96` ("현재 `http-request`·`database-query` handler 만 등재된 기존 방침을 이번 초안에서 바꾸지 않는다")
  - 상세: §6 표가 MakeShop/Cafe24 를 `✓` 로 승격했지만 frontmatter `code:` 목록에는 두 client/handler 가 추가되지 않았다. `spec-impl-evidence.md` 가 "code: 는 최소 1개 매치만 요구"하는 완화된 정책이라 가드 위반은 아니며, 이 판단은 직전 라운드(02_52_18) 에서 이미 INFO 로 다뤄지고 "선택 사항, 결론 불변"으로 명시 보류됐다.
  - 제안: 조치 불요 (기존 라운드에서 이미 의도적 보류로 확정).

- **[INFO]** 잔여 미해결 결정은 이번 diff 범위 밖에서 정확히 보존됨 (긍정 확인)
  - target 위치: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:38-48` (§결정이 필요하다 (택일))
  - 관련 plan: 동일 문서
  - 상세: (a) `failed` 계약 유지 vs (b) `cancelled` 로 재정의 — 두 옵션 모두 체크박스 미변경. `execution-engine.md`/`1-data-model.md`/`data-flow/3-execution.md`/`shutdown-state.service.ts` 어느 것도 diff 에 없다. 이는 이번 라운드가 우려했던 "미해결 결정 우회"가 **일어나지 않았음**을 뒷받침하는 긍정적 증거다.
  - 제안: 없음 (문제 아님, 기록용).

## 요약

이번 커밋(`babaf0030`)이 두 위임 원본 plan(`node-cancellation-residual-signal-propagation.md`, `spec-update-node-cancellation-shutdown-classification.md`)에 남긴 "2026-07-26 이행 완료" 표기는 실제 워킹트리 상태(spec 편집 3파일, 인용된 테스트 라인, 인용된 spec 앵커)와 전량 일치하며 과장·누락이 없다. 두 plan 모두 "제품 결정이 필요한 항목"(SIGTERM/workflow-timeout 최종 상태 (a)/(b) 택일)과 "제품 결정이 필요 없는 사실 정정"(chat-channel 범주 오류, commerce 2행 staleness)을 명확히 분리했고, 이번 커밋은 후자만 집행했다 — 전자에 해당하는 spec 파일·서비스 코드는 diff 에 전혀 없어 미해결 결정을 일방적으로 우회한 흔적이 없다. `node-cancellation.md` frontmatter 의 `status: partial`/`pending_plans` 도 여전히 열려 있는 항목(workflow-timeout BLOCKED, IE multi-turn resume)과 정합해 조기 승격 위험이 없다. 유일한 특이사항은 이번에 "재발견"한 chat-channel N/A 결론이 사실 6주 전 `node-cancellation-infrastructure.md` 완료 시점에 이미 확정돼 있었다는 점인데, 두 결론이 서로 모순되지 않고 오히려 상호 보강하므로 위험이 아니라 향후 spec-표/완료-plan 동기화 관행을 다듬을 여지로만 기록한다.

## 위험도
NONE
