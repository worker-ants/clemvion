# Plan 정합성 검토 — spec-update-execution-engine-pr4.md

## 검토 범위

- Target: `plan/in-progress/spec-update-execution-engine-pr4.md` (spec draft, `--spec` 게이트용)
- 대상 spec: `spec/5-system/4-execution-engine.md` §4/§7.1/§7.2/§7.5/§8/§9.2/§9.3/§Rationale, `1-data-model.md §2.13`
- 직접 관련 plan (payload 에 누락돼 있어 filesystem 에서 직접 조회): `plan/in-progress/exec-intake-queue-impl.md`, `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/execution-engine-residual-gaps.md`, `plan/in-progress/spec-draft-crash-running-redrive.md`, `plan/in-progress/spec-draft-c2-atomic-claim.md`, `plan/in-progress/spec-draft-c3-context-drift.md`
- payload 에 포함된 plan 6건(ai-agent-tool-connection-rewrite / ai-context-memory-followup-v2 / cafe24-backlog-residual / chat-channel-discord-gateway / chat-channel-slack-socket-mode / chat-channel-visual-ssr-png)은 execution-engine 도메인과 무관 — 충돌 없음.

> 주의: orchestrator 가 작성한 payload 에는 execution-engine 도메인의 핵심 plan 6건이 전혀 포함돼 있지 않았다(누락). 이번 검토는 실제 `plan/in-progress/` 디렉터리를 직접 조회해 보완했다. 향후 이 target 계열(exec-* / spec-draft-c*) 검토 시 payload 생성 로직이 관련 plan 을 빠뜨리지 않는지 점검 권장.

## 발견사항

- **[INFO]** E7 편집 항목의 대상 파일 표기 누락
  - target 위치: target draft "### E7. §2.13 WORKER_HEARTBEAT_TIMEOUT" — 파일 미명시
  - 관련 plan: 없음 (target 자체의 정밀도 문제)
  - 상세: `4-execution-engine.md` 에는 `§2.13` 섹션이 존재하지 않는다. 실제 "§2.13 동기화" 문구가 가리키는 대상은 `spec/1-data-model.md §2.13 Execution` 의 `error.code` 열거(L469) — 여기 이미 `WORKER_HEARTBEAT_TIMEOUT ... PR4 예약 ... PR3(2026-07-04)부터 ... 이 코드는 PR3 기간 미발동` 문구가 존재하며 target 이 의도하는 "PR4 예약 → PR4 구현" flip 대상과 정확히 일치한다. 파일 경로 미명시로 실제 적용 시 실수 여지가 있다.
  - 제안: target 의 E7 제목을 "§2.13 WORKER_HEARTBEAT_TIMEOUT (`spec/1-data-model.md §2.13 Execution` error.code 열거)" 로 명시. 반영 자체(내용)는 문제 없음 — plan 정합성 관점에서는 CRITICAL/WARNING 아님, 기록 차원의 INFO.

- **[INFO]** `exec-intake-queue-impl.md` PR4 체크박스는 target 반영 후 갱신 필요 (누락 아님, 확인된 후속 절차)
  - target 위치: target 전체(§7.1/§7.2/§9.2/§9.3/Rationale flip)
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` "## 증분 PR 계획" PR4 행(`[~] PR4 — stalled-job 일원화 + 관측성`, 현재 진행 중 `[~]` 표기)
  - 상세: 코드 구현은 이미 로컬 HEAD 커밋(`dbc541602 feat(06-concurrency): PR4 BullMQ stalled 자동 재배달 …`)에 랜딩돼 있고, target draft 는 그 뒤를 잇는 spec 문서화 단계다. target 반영(BLOCK:NO) 후 `exec-intake-queue-impl.md` PR4 체크박스를 `[x]` 로, `execution-engine-residual-gaps.md` G2 관계 문구(현재 "PR3 의 크래시 RUNNING re-drive + rehydration 으로 부분 해소")를 필요 시 갱신해야 한다. target 문서 자체에는 이 plan-hygiene 후속 조치가 명시돼 있지 않다.
  - 제안: target 또는 별도 developer 세션에서 반영 완료 후 `exec-intake-queue-impl.md` PR4 체크박스 + `execution-engine-residual-gaps.md` 관련 문구를 동기화. 절차적 후속이라 차단 사유는 아님.

- **[INFO]** F3(PR2b 시퀀싱) 재확인 필요성 — 충돌 아님, 확인차 기록
  - target 위치: target 은 §8(동시성 cap, PR2b 대상)에 손대지 않음
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` "F3 (PR2b 순서)" — "PR4 의 3-way switch 가 `runExecutionFromQueue` 에 먼저 랜딩 → PR2b admission gate 는 PENDING arm 에 slot … PR4 선행 권장."
  - 상세: target 이 문서화하는 PR4 코드 변경(`runExecutionFromQueue` 의 RUNNING 분기 재구동, native stalled 채택)은 이미 PR2b 착수 전에 선행 랜딩되는 순서로 계획돼 있었고, target draft 는 이 순서를 그대로 따른다(§8 cap 로직 자체는 미변경). PR2b 는 여전히 별도 브랜치(`impl-concurrency-cap-pr2b`, 미착수)에 있으므로 target 이 그 설계를 무효화하지 않는다.
  - 제안: 조치 불요. 참고용 기록.

## 확인된 정합 사항 (충돌 없음 — 근거 기록)

- **Q2(세그먼트-start 영속 defer)의 표현이 `spec-draft-c3-context-drift.md`(같은 날 2026-07-04 작성, PR3/C-3 완료 후 draft)와 정합**한다. C-3 draft 및 `plan/complete/refactor/06-concurrency.md` C-3 는 "옛 06-concurrency C-3 plan 의 'PR3 에서 자연 해소' 주장은 stale — PR3(#795)는 세그먼트-start 를 영속하지 않는다" 로 이미 정정 완료했고, "세그먼트-start 영속은 **미확정 후속 candidate**(PR4 stalled 재배달과 함께 검토)" 로 표기했다. target 의 "Q2 defer … under-count 는 후속 candidate 로 남긴다" 는 이 이미 정정된 프레이밍과 완전히 일치한다 — 표면상 "PR4 와 함께 검토" vs "PR4 는 하지 않는다"로 혼동될 수 있으나, 실제로는 C-3 draft 시점(사용자 결정 이전)의 잠정 후보 나열이었고 이후 사용자가 PR4 자체에서도 defer 하기로 확정한 것으로 시계열이 맞다.
- target 의 편집 대상 라인 번호(E1: L379, E2: §7.1 L812-829, E6: §9.2 L1117/§9.3 L1136, `1-data-model.md §2.13`)를 실제 파일과 대조 확인 — 인용 텍스트가 현재 spec 본문과 정확히 일치한다. stale 인용 없음.
- G2(`execution-engine-residual-gaps.md`)의 "errorPolicy='continue' defer" 결정은 target 이 건드리지 않으며, `exec-park-durable-resume.md` "## PR3 …" 섹션의 Q2 defer 결정과도 일치 — target 이 이 미해결 결정을 우회하거나 새로 판정하려는 시도 없음.
- `recoverStuckExecutions` "은퇴 아님 · backstop 상시 유지" 결정은 `exec-intake-queue-impl.md` "PR4 스코핑 확정" 항목 5(F1)·`spec-draft-crash-running-redrive.md` Δ5 의 기각 대안 (a)/(b) 논증과 동일 근거로 일관됨.
- target 이 assumption 으로 삼는 "PR3 완료(2026-07-04)" 는 `exec-park-durable-resume.md` "## PR3 — 크래시 RUNNING 세그먼트 멱등 재개" 섹션에서 실제로 완료·머지대기(PR #795, 이미 로컬 HEAD 반영) 상태로 확인됨 — 선행 조건 충족.

## 요약

target(`spec-update-execution-engine-pr4.md`)은 PR4(BullMQ stalled 자동 재배달) 코드 구현이 이미 랜딩된 뒤 그 사실을 spec 에 반영하는 후행 문서화 draft다. 소스가 되는 `exec-intake-queue-impl.md`(PR4 스코핑 확정 섹션)·`exec-park-durable-resume.md`(PR3 완료 근거)·`spec-draft-crash-running-redrive.md`(PR3 spec draft, 이미 BLOCK:NO 적용됨)와 문구·결정 사항(Q1/Q2, F1 recoverStuckExecutions backstop, 네이티브 stalled 채택)이 전부 정확히 일치한다. `execution-engine-residual-gaps.md` G2 의 defer 결정도 우회하지 않는다. 유일한 미해소 항목은 절차적 plan-hygiene(반영 후 `exec-intake-queue-impl.md` PR4 체크박스·G2 관계 문구 갱신)과 E7 의 대상 파일 표기 누락으로, 둘 다 차단 사유가 되는 CRITICAL/WARNING 이 아니라 기록성 INFO다. orchestrator payload 자체가 관련 plan 6건을 누락했다는 프로세스 이슈는 별도로 지적한다.

## 위험도
NONE
