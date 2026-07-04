# Plan 정합성 검토 — impl-done (spec/5-system/, diff-base origin/main)

## 검토 범위

- Target: `spec/5-system/4-execution-engine.md`(+`1-data-model.md §2.13`·`3-error-handling.md`·`conventions/error-codes.md`·`data-flow/3-execution.md`) — PR4(BullMQ stalled 자동 재배달) 구현 완료 반영.
- orchestrator payload 에 번들된 target 발췌(`1-auth.md`, `10-graph-rag.md`)는 이번 PR 의 실제 변경 파일과 무관 — payload 생성 스코프가 이번 diff(`spec/5-system/4-execution-engine.md` 등)와 어긋나 있어, 실제 diff(`git diff origin/main...HEAD`)와 `plan/in-progress/exec-intake-queue-impl.md`·`exec-park-durable-resume.md`·`spec-draft-c3-context-drift.md`·`execution-engine-residual-gaps.md` 를 직접 조회해 검토를 보완했다.
- 직전 회차 `review/consistency/2026/07/04/12_40_41/plan_coherence.md`(대상: `spec-update-execution-engine-pr4.md` draft, `--spec` 게이트) 는 이미 BLOCK:NO 로 통과했고, 그 draft 내용이 그대로 `spec/5-system/4-execution-engine.md` 에 반영된 것을 diff 로 확인했다 — draft↔실제 반영 간 불일치 없음.

## 발견사항

- **[WARNING]** `exec-park-durable-resume.md` 의 PR4 forward-reference 가 PR4 완료 후에도 갱신되지 않음
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 "PR3 → PR4 관계" 문단 + Rationale "PR4 — BullMQ stalled 자동 재배달" (신규 섹션, diff L119-129) — "PR4(2026-07-04)는 자동 재배달을 도입하되 `recoverStuckExecutions` 을 은퇴시키지 않고 backstop 으로 유지" 로 확정.
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` L188 "BullMQ stalled 자동 재배달(maxStalledCount>0)·recoverStuckExecutions 완전 대체·spec §7.1/§7.2 Planned→구현 flip 은 **PR4(별도)로 유지**" — 이 문장은 PR3 스코핑 확정(2026-07-03) 시점의 forward-reference 로, "PR4 가 recoverStuckExecutions 를 완전 대체한다" 는 뉘앙스를 담고 있다. 실제 PR4 결과(F1 결정: "은퇴 아님·backstop 병존")와 어긋난다.
  - 상세: 이 PR(`exec-intake-pr4-stalled`)은 `exec-intake-queue-impl.md` 의 PR4 체크박스만 갱신했고(`[ ]`→`[~]`+스코핑 확정 섹션 추가), `exec-park-durable-resume.md` 는 건드리지 않았다(`git diff origin/main...HEAD --stat` 에 해당 파일 없음). 그 결과 "PR3 스코핑 확정" 절의 PR4 forward-reference 가 지금 시점 기준 부정확한 요약("완전 대체")으로 고정 잔류한다. 코드/spec 정합에는 영향 없음 — 순수 plan 문서 간 서술 불일치(plan-hygiene)다. `execution-engine-residual-gaps.md` G2 절은 이미 "완료 2026-07-04" 로 정확히 갱신돼 있어 대조된다.
  - 제안: `exec-park-durable-resume.md` L188 에 "PR4 완료(2026-07-04) — 완전 대체가 아니라 부팅 backstop 병존으로 확정, 상세는 `exec-intake-queue-impl.md` PR4 절/spec §7.1 Rationale 참조" 각주를 추가. 코드 변경 불요, plan 문서만 후속 커밋으로 동기화 가능(차단 사유 아님).

- **[WARNING]** `spec-draft-c3-context-drift.md` 의 "PR4 candidate" 서술이 PR4 의 Q2 defer 확정 이후로 갱신되지 않음
  - target 위치: `spec/5-system/4-execution-engine.md` §8 under-count Rationale (diff L133-147) — "PR4(2026-07-04)는 사용자 결정(Q2 defer)으로 migration-free 로 진행해 세그먼트-start 를 영속하지 않았다 — under-count 는 PR4 로도 해소되지 않으며 **후속 candidate**로 남는다" 로 이미 정확히 반영됨(diff 확인).
  - 관련 plan: `plan/in-progress/spec-draft-c3-context-drift.md` L35 "세그먼트-start 영속은 **PR4** 이연(PR3 미해소, 2026-07-04 정정)" · L49 "spec Rationale·코드 주석은 세그먼트-start 영속을 'PR4 stalled 재배달과 함께 검토할 후속 candidate' 로 표기 … plan hygiene 으로 06-concurrency C-3 + exec-intake PR4 candidate note 를 함께 갱신한다(plan_coherence WARNING 해소)" — 이 문서 자체가 "PR4 시점에 재검토" 를 전제로 쓰였는데, 지금 PR4 가 실제로 완료되면서 "PR4 에서 검토"가 아니라 "PR4 이후 후속 candidate" 로 시제가 넘어갔다.
  - 상세: `spec-draft-c3-context-drift.md` 는 이 사실을 스스로 예고했었지만("plan hygiene 으로 … 갱신한다") 이번 PR 은 그 plan hygiene 액션 자체를 수행하지 않았다(diff --stat 에 해당 파일 없음). Critical 은 아니다 — target spec 이 이미 정확한 최종 상태(under-count 미해소, 후속 candidate)를 기술하고 있고, 이 plan 문서는 오래된 예고문일 뿐 결정을 오도하지 않는다.
  - 제안: `spec-draft-c3-context-drift.md` L35/L49 에 "PR4(2026-07-04) 완료 — Q2 defer 로 확정, 세그먼트-start 영속은 여전히 미확정 후속" 한 줄 갱신. 06-concurrency C-3(이미 `plan/complete/refactor/06-concurrency.md` 로 이관·종료됨 — 사용자 메모리 확인)의 후속 언급도 현재는 무효 참조이므로 정리 권장.

## 확인된 정합 사항 (충돌 없음 — 근거 기록)

- **`exec-intake-queue-impl.md` PR4 스코핑 확정 절**(diff L58-75)이 실제 코드 diff(`execution-run.queue.ts` `maxStalledCount:1`, `execution-run.processor.ts` `stalledInterval`/`onFailed`, `executions.controller.ts` 신규 엔드포인트, `execution-run-dlq-monitor.*`)와 1:1 대응 — 서술과 구현 사이 괴리 없음.
- **F1(`recoverStuckExecutions` backstop 유지) 결정**이 `execution-engine-residual-gaps.md` G2 절의 "완료 2026-07-04" 표기, `exec-intake-queue-impl.md` PR4 스코핑의 F1 항목과 삼각 정합 — 어느 문서도 "은퇴" 로 서술하지 않는다.
- **Q2(세그먼트-start 영속 defer)** 가 target spec §8 Rationale·§Rationale 말미(diff L133-147)에서 "PR4 로도 해소되지 않으며 후속 candidate 로 남긴다" 로 명확히 종결 서술됨 — 미해결 결정을 target 이 일방적으로 판정하지 않고, defer 자체를 그대로 존중해 기록했다.
- **`spec-draft-crash-running-redrive.md`(PR3 draft, 이미 BLOCK:NO 적용됨)와의 시계열** — PR3(“부팅 backstop”)이 먼저 확정되고 PR4(“운영 중 stalled”)가 그 위에 얹히는 순서가 target·`exec-intake-queue-impl.md`·`exec-park-durable-resume.md` 세 문서에서 일관됨. 순서 위반 없음.
- **선행 조건 충족 확인**: target 이 전제하는 "PR3 완료(2026-07-04)" 는 `exec-park-durable-resume.md` "## PR3 — 크래시 RUNNING 세그먼트 멱등 재개" §"구현 시퀀싱" 이 PR #795 머지대기까지 완료로 기록 — 실제 로컬 HEAD 에도 반영돼 있음(`git log` 확인). 선행 plan 미해소 없음.
- payload 에 번들된 plan 6건(ai-agent-tool-connection-rewrite / ai-context-memory-followup-v2 / cafe24-backlog-residual / chat-channel-discord-gateway / chat-channel-slack-socket-mode / chat-channel-visual-ssr-png)은 execution-engine 도메인과 무관 — 충돌 없음.

## 프로세스 이슈 (기록)

- 이번 회차 orchestrator payload 의 target 발췌가 `spec/5-system/1-auth.md`·`10-graph-rag.md` 로, 실제 diff 파일(`spec/5-system/4-execution-engine.md` 등)과 일치하지 않았다. 12:40 회차에서도 동일하게 "관련 plan 누락" 프로세스 이슈가 지적된 바 있어(반복), payload 생성 로직이 이 target 계열(exec-* 도메인)에서 스코프를 놓치는 경향이 있어 보인다. 이번 검토는 실제 워크트리 diff 와 filesystem 을 직접 조회해 보완했다.

## 요약

target(`spec/5-system/4-execution-engine.md` 등, PR4 BullMQ stalled 자동 재배달)은 이미 BLOCK:NO 로 통과한 `spec-update-execution-engine-pr4.md` draft 의 내용을 정확히 그대로 반영했고, `exec-intake-queue-impl.md` PR4 스코핑·F1(backstop 유지)·Q2(defer) 결정과 완전히 일치한다 — 미해결 결정을 우회하거나 선행 조건을 무시하는 CRITICAL 은 없다. 다만 이번 PR 이 건드리지 않은 두 인접 plan 문서(`exec-park-durable-resume.md`, `spec-draft-c3-context-drift.md`)에 "PR4 는 아직 미래(완전 대체/검토 예정)" 라는 낡은 forward-reference 가 남아 있어, PR4 가 실제로 완료된 지금 시점에서는 사실과 어긋난 서술이 됐다 — 둘 다 plan-hygiene 성격의 WARNING 으로, spec-코드 정합 자체를 훼손하지 않으므로 차단 사유는 아니다.

## 위험도
LOW
