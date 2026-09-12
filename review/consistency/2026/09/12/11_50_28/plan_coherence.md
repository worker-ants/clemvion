# Plan 정합성 검토 — `spec-draft-setup-error-classification.md`

## 발견사항

- **[WARNING]** 개발자 후속 항목이 인접 백로그 항목(같은 테스트 파일 대상)을 누락
  - target 위치: `plan/in-progress/spec-draft-setup-error-classification.md` §"구현 위임 (이 턴 밖 — developer 후속)" 항목 4 ("캐너리를 뒤집는다 — `chat-channel-input-rules.spec.ts` 의 *"discord verify_key → 502"* 테스트가 이 변경으로 RED 가 되는 것이 의도다")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2792-2802` "`chat-channel-input-rules.spec.ts` 잔여 보강 5건" (developer, 2026-09-11 등재) 의 (d) "`translateSetupChannelError` 의 non-Error 입력 분기 + `details.reason` **값** 단언" · (e) "provider별 label 문구 미단언"
  - 상세: 두 항목이 정확히 같은 함수(`translateSetupChannelError`)·같은 테스트 파일(`chat-channel-input-rules.spec.ts`)을 대상으로 한다. target 의 캐너리 뒤집기(판별 로직을 접두 우선으로 재작성)가 실행되면 그 파일의 관련 테스트 블록이 상당 부분 재작성되는데, target 의 "구현 위임" 목록은 이 기존 백로그 (d)·(e) 를 인지·언급하지 않는다. developer 가 두 작업을 별도 시점에 수행하면 같은 테스트 블록을 두 번 건드리거나, 캐너리 뒤집기 커밋이 (d)·(e) 를 알지 못한 채 통과시켜 백로그 항목이 그 사이 조용히 stale 해질 위험이 있다(이 저장소가 "인접 서술 미동반 갱신" 클래스를 반복 학습한 이력 — `spec-draft-nullable-notation-followups.md` 자체에도 같은 클래스의 사례가 여러 건 있다).
  - 제안: target 의 "구현 위임" 항목 4 (또는 새 항목)에 "`spec-draft-nullable-notation-followups.md`의 §5(d)·(e) 를 같은 커밋에서 함께 처리하거나, 처리하지 않는다면 그 항목이 캐너리 뒤집기 이후에도 유효한지 재확인할 것"을 명시적으로 적어 둘 것. 최소한 `plan/complete/` 이동 전 체크리스트에 이 교차 참조를 남기면 developer 가 놓치지 않는다.

- **[INFO]** 트래커 항목 재기술 대상 plan 이 소유 worktree 를 잃은 상태 — 처리는 타당하나 근거 기록 필요
  - target 위치: `plan/in-progress/spec-draft-setup-error-classification.md` §체크리스트 "트래커 항목을 **developer → planner 완료 + developer 후속**으로 재기술"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2766-2775` (frontmatter `worktree: plan-in-progress-items-b0c80b`, `owner: planner`)
  - 상세: target 이 재기술하려는 정확한 항목을 실측으로 확인했다 — 2766행 "`translateSetupChannelError` 가 discord verify_key 불일치를 502 로 떨어뜨린다"(developer, 2026-09-11 등재)이며, 그 항목의 "의도는 400" 주장은 target 의 §"왜 이 턴인가" 가 스스로 반증한 바로 그 문장이다. 다만 이 항목이 실려 있는 plan 파일의 frontmatter `worktree` 는 `plan-in-progress-items-b0c80b` 인데, `git worktree list` 실측상 그 worktree 는 현재 존재하지 않는다 — 즉 그 파일을 "소유" 하는 세션이 없다. 이 저장소는 과거 유사 상황(`auth-guard-reflection-hardening.md` — 다른 worktree 소유 plan 을 인접 PR 에서 대신 이동시킨 사례)에서 plan_coherence checker 가 "권한 밖" 으로 지적했고, 그때는 "그 worktree 의 작업이 이미 끝났다"는 근거를 명시적으로 남기고 오버라이드했다. 이번 건도 같은 패턴이라 처리 자체는 타당해 보이지만, 실행 시점에 동일한 근거(해당 worktree 부재 실측)를 target 문서 또는 커밋 메시지에 남겨 두지 않으면 다음 라운드의 plan_coherence checker 가 같은 "권한 밖" 지적을 반복할 수 있다.
  - 제안: 트래커 항목을 실제로 재기술할 때 "`plan-in-progress-items-b0c80b` worktree 부재(실측) → 본 세션이 대신 처리" 한 줄을 그 옆에 남길 것.

## 요약

target 이 미해결 결정을 우회하거나 다른 plan 의 선행 조건을 무시하는 CRITICAL 은 발견되지 않았다 — API 계약(HTTP 코드) 변경이라는 이유로 자기-반증형 소정정 대신 planner 턴으로 정확히 라우팅했고, `R-CC-23`/`R-CCA-9` 번호는 실측(각각 현재 최대 `R-CC-22`·`R-CCA-8`)과 일치하며 다른 in-progress plan 과의 번호 충돌도 없다. `spec/5-system/15-chat-channel.md` §5.4 와 `spec/conventions/chat-channel-adapter.md` §1.1 의 "편집 대상 원문" 인용은 현재 worktree HEAD(`c7699bdf0`)와 정확히 일치해 스테일하지 않다. target 이 대체하려는 developer 트래커 항목(`spec-draft-nullable-notation-followups.md:2766`)도 정확히 식별했고 그 처방 후보(a)/(b) 논의와 target 의 최종 결정(접두 선언 방식)이 상충하지 않는다. 다만 같은 트래커 문서의 인접 백로그 항목(같은 테스트 파일·같은 함수를 대상으로 하는 잔여 보강 5건 중 (d)·(e))에 대한 교차 참조가 target 의 "구현 위임" 절에 빠져 있어 developer 단계에서 중복·누락 위험이 있고(WARNING), 트래커 항목 재기술 대상 plan 의 소유 worktree 가 이미 사라진 상태라 처리 자체는 정당하지만 그 근거를 기록해 두는 편이 향후 재지적을 막는다(INFO).

## 위험도

LOW
