# Plan 정합성 검토 — orphan pending backstop

## Payload 스코프 보정

`_prompts/plan_coherence.md` 의 "Target 문서" 블록에는 `spec/5-system/1-auth.md` 전문(1900줄 이상)만 실려 있고 "orphan" 문자열이 단 한 곳도 등장하지 않는다 — orchestrator 의 스코프 오기(mis-scope)로 판단된다. 실제 구현 대상은 지시문에 명시된 대로 `plan/in-progress/exec-intake-followups.md` 의 "orphan pending backstop" 항목(이제 `[x]`)과 그 설계 plan `plan/in-progress/orphan-pending-backstop.md` 이며, spec 영향 영역은 plan frontmatter `spec_impact: spec/5-system/4-execution-engine.md` 다. 이하 검토는 두 plan 문서, `spec/5-system/4-execution-engine.md` §7.1/§7.4/§8, 관련 in-progress plan(`execution-engine-residual-gaps.md`·`exec-park-durable-resume.md`·`spec-update-execution-engine-pr4.md`), 그리고 git 커밋 이력(`d55d3f59d`, `2014421e5`)을 직접 읽어 수행했다.

동일 target 에 대한 **impl-prep 단계 plan_coherence 검토가 이미 한 차례 수행**되었다(`review/consistency/2026/07/04/21_50_44/plan_coherence.md`, BLOCK: NO, 위험도 NONE). 본 검토는 그 뒤 구현이 완료된 시점(impl-done)의 재확인이다.

## 발견사항

- **[INFO] 미해결 결정 우회 없음 — cancel-only 회수 설계는 §8 기존 정책의 직접 확장**
  - target 위치: `plan/in-progress/orphan-pending-backstop.md` "설계 결정" 1~3, 커밋 `2014421e5`
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` "orphan pending backstop" 항목; spec §8(`4-execution-engine.md:1088`) "job 자체가 소실된 orphan `pending` 회수는 `recoverStuckExecutions`(§7.4) 부팅 backstop 이 담당한다 — 구현 완료(2026-07-04)"
  - 상세: `exec-intake-followups.md` 는 이 항목을 "낮은 확률 엣지, best-effort" 로만 남겨뒀고 구체적 회수 방식(cancel vs re-enqueue)을 명시적으로 유보하지 않았다. orphan-pending-backstop 의 결정("이미 queue-wait timeout 을 초과한 pending 만 대상, 기존 `markQueueWaitTimeout` 재사용, RUNNING 은 미부활")은 §8 의 기존 wait-timeout cancel 정책을 orphan 케이스로 그대로 확장한 것이며, 다른 in-progress plan 이 남긴 "결정 필요" 항목과 충돌하지 않는다.
  - 제안: 없음 — 정합 확인 기록.

- **[INFO] 선행 plan 미해소 없음 — PR3/PR4 전제 모두 완료 상태에서 착수됨**
  - target 위치: `plan/in-progress/orphan-pending-backstop.md` 결정 3("같은 lock·트리거 재사용")
  - 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md`(G1/G2, BLOCKED, grace-shutdown 관련·무관), `plan/in-progress/spec-update-execution-engine-pr4.md`(PR4 spec flip, 완료 반영됨)
  - 상세: orphan-pending-backstop 이 재사용하는 `recoverStuckExecutions` 부팅 backstop·boot+테스트훅 트리거·분산 lock 은 PR3(§7.5 case B re-drive)·PR4(BullMQ stalled 재배달) 로 이미 완료된 기반이다. `execution-engine-residual-gaps.md` 의 G1/G2 는 WS graceful-shutdown gate·errorPolicy continue 분기로 orphan pending 회수와 무관한 별도 트랙(BLOCKED, 사용자 판단 대기)이라 본 target 의 사전조건이 아니다.
  - 제안: 없음.

- **[INFO] exec-intake-followups.md 체크박스 정합 — 완료 반영됨**
  - target 위치: `plan/in-progress/exec-intake-followups.md` L21
  - 관련 plan: `plan/in-progress/orphan-pending-backstop.md` 체크리스트
  - 상세: 이전(impl-prep) 검토 시점엔 미체크였던 "orphan pending backstop" 항목이 이제 `[x]` 완료로 전환되어 있고, 요약도 구현 내용(recoverStuckExecutions 확장, early-return 제거, TDD 3+e2e 2, impl-prep 5/5, ai-review 9-reviewer)을 정확히 반영한다. 다만 `orphan-pending-backstop.md` 자체의 체크리스트는 "ai-review + impl-done consistency"까지만 `[x]`이고 마지막 "PR" 항목은 아직 `[ ]` — 두 문서 간 모순이 아니라 정상적인 진행 중 상태(PR 생성 전)다.
  - 제안: 없음 — PR 생성 후 `orphan-pending-backstop.md` 마지막 체크박스만 전환하면 된다.

- **[INFO] 인접 plan(exec-park-durable-resume.md) 의 stale "umbrella 잔여" 문구 — 기존에 이미 지적됨, 이번 작업과 무관**
  - target 위치: (참고) `plan/in-progress/exec-park-durable-resume.md` L273
  - 관련 plan: 동일 파일 L208 "PR3 종료(2026-07-04)"
  - 상세: L273 은 "PR3 rehydration 일반화(ai_agent → 일반 노드)"를 여전히 미해결 umbrella 항목으로 나열하지만, L208 과 spec §7.2 는 이미 이 일반화가 완료됐다고 기록한다. 이전 impl-prep 검토(`21_50_44/plan_coherence.md`)에서 이미 INFO 로 지적된 pre-existing 불일치이며, orphan-pending-backstop 작업은 이 stale 항목을 전제로 삼지 않으므로 본 target 의 정합성에는 영향이 없다.
  - 제안: `exec-park-durable-resume.md` L273 정리는 별도 plan hygiene 작업(본 target 의 선행조건 아님).

## 요약

Target(orphan pending backstop, 완료·커밋 `2014421e5`/`d55d3f59d`)은 `exec-intake-followups.md` 가 명시적으로 남긴 미결 항목을 §8 SoT 문구("재큐 대신 cancelled 로 마감") 및 §7.1/§7.4 Recovery 의 기존 lock·트리거 모델과 합치하는 방식으로 설계·구현했다. 새로운 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락은 발견되지 않았다. `exec-intake-followups.md` 체크박스는 이미 완료로 갱신돼 있고, 유일한 잔여 사항은 `orphan-pending-backstop.md` 자체의 "PR" 체크박스(진행 중, 정상)와 무관한 인접 plan 의 pre-existing stale 문구(별도 hygiene)뿐이다. payload 는 auth spec 으로 스코프 오기됐으나 지시문의 우회 경로(plan 직접 읽기)로 완전히 검토를 마쳤다.

## 위험도
NONE

BLOCK: NO
