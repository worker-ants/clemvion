# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 전문 확보(재시도 필요 항목 없음).

## 전체 위험도
**MEDIUM** — 이번 diff(코드 JSDoc 정정 + plan won't-do 종결 + project-planner 위임)는 절차·근거 모두 정확하지만, 그 근거가 된 SoT 문서(`spec/conventions/node-cancellation.md` §1/§6)가 아직 코드와 어긋난 채 남아 있어 "과도기적 spec-code 불일치"가 라이브 상태로 존재한다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance (3중 확인) | `node-cancellation.md` 가 chat-channel 을 여전히 "노드"로 분류(§1 나열 + §6 "미구현(Planned)" 행) — 이번 diff 로 코드 JSDoc 이 반대로 정정된 사실과 어긋난 채 SoT 만 뒤처짐 | `spec/conventions/node-cancellation.md:24, 137` | `spec/1-data-model.md:230`(Trigger.type — chat-channel 은 `webhook`의 config 변형) · `spec/5-system/15-chat-channel.md` CCH-AD-05(outbound listener, 노드 아님) · `codebase/backend/src/nodes/core/node-handler.interface.ts`(이번 diff 로 이미 정정 완료) | `project-planner` 가 §1 나열에서 chat-channel 삭제(코드 JSDoc과 동일하게 HTTP/DB/AI/Email/Cafe24/MakeShop) + §6 표 행 삭제 또는 "노드 아님 — outbound listener, cascade 대상 아님"으로 성격 변경. `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #5"가 이미 이 처분을 명시 위임했으므로 다음 spec 갱신 PR 에서 반드시 반영 |
| 2 | convention_compliance | `error.code: 'AbortError'` 가 `error-codes.md` 의 `UPPER_SNAKE_CASE` 명명 규약 위반이며 §3 historical-artifact 예외 레지스트리에도 미등록 (선재 이슈, 이번 diff 신규 아님) | `spec/conventions/node-cancellation.md` §5.1, `spec/5-system/6-websocket-protocol.md` §4.1 | `spec/conventions/error-codes.md` §1/§3 | developer 가 이미 `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #4-(1)"에 위임 완료 — project-planner 가 (a) 예외 레지스트리 등재 또는 (b) `NODE_CANCELLED` 류 교체 중 택일 |
| 3 | convention_compliance | plan frontmatter `worktree:` 필드가 실제 작업 worktree 와 불일치 (squash-merge 완료된 구 worktree `node-cancel-signal-b4d1` 를 여전히 가리킴) | `plan/in-progress/node-cancellation-residual-signal-propagation.md` frontmatter | 실제 세션 worktree `node-cancel-chat-9f3e` (및 plan-lifecycle §4 연결 판정 기준) | `worktree: node-cancel-chat-9f3e` 로 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | chat-channel 노드 미존재 결론은 신규 발견이 아니라 `plan/complete/parallel-p2-followups-done.md:14`(2026-05-30/06-01)에 이미 확정된 결론의 재확인 — 모순 아님, 오히려 spec staleness 를 뒤늦게 바로잡는 그림 | `plan/complete/parallel-p2-followups-done.md:14` | `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #5"에 이 근거를 인용해 "왜 오류가 오래 남았는지"까지 Rationale 에 남기면 향후 유사 staleness 재발 방지에 도움 |
| 2 | rationale_continuity | `spec/4-nodes/1-logic/10-parallel.md:244` ("DB/AI/Email/chat-channel 은 후속 PR")도 같은 chat-channel=노드 오분류를 반복하나 `spec_impact` 목록에 없음 (단, "본 PR 기준" 시점 한정 수식이라 반드시 고쳐야 하는 건 아님) | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` frontmatter `spec_impact:` | planner 위임 처리 시 이 라인도 함께 검토(그대로 두거나 "당시 기준" 각주 추가) |
| 3 | plan_coherence | `spec-update-node-cancellation-shutdown-classification.md` Overview 문구가 chat-channel 을 여전히 "signal 전파로 진행 가능" 항목처럼 나열해 이번 addendum #5(won't-do 종결)와 내부적으로 살짝 어긋남 | 같은 파일 Overview(17~20행) vs "추가 위임 #5"(192~211행) | Overview 괄호 나열에서 chat-channel 삭제하거나 "(won't-do, addendum #5 참조)" 각주 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `node-cancellation.md`가 chat-channel을 노드로 분류해 `1-data-model.md`/`15-chat-channel.md`와 모순 (기존 모순이나 이번 diff로 도드라짐) |
| rationale_continuity | LOW | 결론은 과거(`parallel-p2-followups-done.md`) 결정과 완전 정합, 위임도 정상 프로세스 — 남는 건 반영 전 과도기적 불일치뿐 |
| convention_compliance | LOW | developer의 위임 처리는 규약 준수 모범 사례. 다만 SoT 미반영 + AbortError 명명 미등록 + worktree frontmatter 불일치 3건은 선재 backlog |
| plan_coherence | LOW | 권한 경계·위임 절차 정확 준수. Overview 문구만 addendum과 내부 동기화 필요 |
| naming_collision | NONE | 신규 식별자 도입 없음. 인용 식별자 전부 기존 spec에 이미 등록됨 |

## 권장 조치사항
1. (BLOCK 해소 우선 항목 없음 — Critical 0건) `project-planner`가 `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #5"를 처리할 때 `spec/conventions/node-cancellation.md` §1 나열에서 chat-channel 삭제 + §6 표 행을 "노드 아님(outbound listener)"으로 정정.
2. 같은 위임 처리 시 "추가 위임 #4-(1)"의 `error.code: 'AbortError'` 명명 규약 처분(예외 등재 vs `NODE_CANCELLED` 교체)도 함께 결정.
3. `plan/in-progress/node-cancellation-residual-signal-propagation.md` frontmatter `worktree`를 `node-cancel-chat-9f3e`로 갱신 (developer가 즉시 처리 가능, spec 권한 불요).
4. `spec-update-node-cancellation-shutdown-classification.md` Overview 문구를 addendum #5(chat-channel won't-do)와 동기화하고, `spec/4-nodes/1-logic/10-parallel.md:244`도 함께 점검.