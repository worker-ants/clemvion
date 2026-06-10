# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker 모두 Critical 0건. naming_collision 에서 WARNING 1건(resumed 3중 동명 혼재), plan_coherence 에서 INFO 다수(spec 이미 반영됨, stale worktree 정리 권장). 차단 사유 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `resumed` 식별자 3중 동명 혼재 — ack boolean(의미 재정의됨) / NodeHandlerOutput status enum / WS·SSE 이벤트명이 같은 이름으로 공존, 의미 각각 다름 | `spec/5-system/6-websocket-protocol.md` §4.2 line 245 | `spec/5-system/4-execution-engine.md` line 88·101; `spec/5-system/6-websocket-protocol.md` line 169·778; `spec/5-system/14-external-interaction-api.md` line 348·361·805 | §4.2 표 `resumed` 필드 설명에 "(이름이 같은 `execution.resumed` 이벤트 및 NodeHandlerOutput status `"resumed"` 와 별개)" 한 줄 cross-reference 추가. 필드 이름 자체 변경은 wire 호환성 파괴로 비권장 |

> **반영 완료**: WARNING #1 은 §4.2 표 `resumed` 행에 "이 ack boolean `resumed` 는 이름이 같은 `execution.resumed` 이벤트(§4.1)·NodeExecution status enum `\"resumed\"` 와 별개다" cross-ref 를 추가해 해소. INFO #11(event 표기) 은 touched 범위의 `EXECUTION_CANCELLED` → `execution.cancelled` 통일로 해소.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `execution.resumed` 이벤트명 vs ack `resumed` boolean — 별개 도메인, 충돌 없음. §4.2 NOTE(line 234)가 이미 구분 명시 | `spec/5-system/6-websocket-protocol.md` §4.2 | 현행 유지 |
| 2 | cross_spec | `NodeExecution.status = "resumed"` 내부 enum vs ack boolean — 별개, 충돌 없음 | `spec/conventions/node-output.md` line 27·171·246 | 현행 유지 |
| 3 | cross_spec | EIA / Chat Channel `RESUME_*` 경로 — telegram.md, chat-channel-adapter.md 모두 target 변경과 일치 | `spec/4-nodes/7-trigger/providers/telegram.md` line 188; `spec/conventions/chat-channel-adapter.md` line 133·342 | 현행 유지 |
| 4 | rationale_continuity | target plan 두 변경 모두 spec 본문·## Rationale 에 착지 완료. 번복 사유(always-enqueue invariant, 대안 B 기각) 명시 | `spec/5-system/6-websocket-protocol.md ## Rationale`; `spec/5-system/4-execution-engine.md ## Rationale` | plan 을 `plan/complete/` 로 이동 가능 |
| 5 | convention_compliance | `## 검증·후속` 의 "프론트 가드 확인" 항목이 서술형 — 체크박스로 변환하면 완료 추적 명확 | `plan/in-progress/spec-update-ws-resumed-ack.md` §검증·후속 | `- [ ]` 형식으로 변환 권장(규약 위반은 아님) |
| 6 | convention_compliance | `spec_impact` 가 본문 blockquote 로 메모됨 — in-progress 단계엔 의무 없으나 완료 이동 시 frontmatter 추가 필요 | `plan/in-progress/spec-update-ws-resumed-ack.md` line 7–9 | Gate C(complete 이동) 시 blockquote 제거 후 frontmatter `spec_impact:` 실제 추가 |
| 7 | plan_coherence | 두 spec 변경 모두 PR #516(`79f1d849`)으로 이미 반영됨 — target plan 실행 시 실제 diff 없을 가능성 높음 | `plan/in-progress/spec-update-ws-resumed-ack.md` §변경안 전체 | 실행 전 잔여 갭 확인 후 갭 없으면 `plan/complete/` 이동 |
| 8 | plan_coherence | 프론트엔드 가드 확인 결과(ack `resumed:true` 상태 전이 사용 여부) 아직 기록 없음 | `plan/in-progress/spec-update-ws-resumed-ack.md` §검증·후속 | 확인 수행 후 결과 기록. 문제 없으면 종결, 문제 있으면 developer 항목 신설 |
| 9 | plan_coherence | `refactor/06-concurrency.md` C-2 승인 시 동일 §7.5 인접 문장 수정 예정 — 직접 충돌 아님, 타이밍 인지 필요 | `spec/5-system/4-execution-engine.md` §7.5 | C-2 실행 시 target plan 반영 line 967 과 중복 없는지 확인 |
| 10 | plan_coherence | `spec-sync-websocket-protocol-gaps.md`, `spec-sync-execution-engine-gaps.md` — worktree `spec-sync-audit` stale(branch 부재), in-progress 잔류 중 | `plan/in-progress/spec-sync-*.md` | stale worktree 정리(`integration-expiry-fixes-1d7c7d` 포함) |
| 11 | naming_collision | `EXECUTION_CANCELLED`(UPPER_SNAKE_CASE) vs 실제 wire 이벤트명 `execution.cancelled`(소문자 dot-notation) 표기 혼재 | `spec/5-system/4-execution-engine.md` §7.5 line 967; §Rationale line 1397 | Rationale 및 본문 참조에서 `` `execution.cancelled` `` 소문자 backtick으로 통일 |

> **참고**: INFO #7 의 "#516 으로 이미 반영" 은 false positive — 2회차 checker 가 본 작업 적용 *후*의 spec(이미 정정됨)을 읽어 발생한 main-baseline FP 다. 실제 diff 존재 확인(`git diff --stat HEAD` 19 insertions/2 deletions). INFO #5·#6·#8 은 Gate C 완료 이동 + 체크박스 변환 + 프론트 가드 결과 기록으로 모두 반영. INFO #10(stale worktree 정리)·#9(C-2 타이밍)은 본 PR scope 외.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 변경 이미 반영, 관련 spec 전체 일관성 확인, 충돌 없음 |
| rationale_continuity | NONE | 두 ## Rationale 에 번복 사유 명시 완료, 기각 대안 재도입 없음 |
| convention_compliance | NONE | 필수 frontmatter 3필드 정상, 규약 위반 없음, 개선 제안만 |
| plan_coherence | LOW | spec 이미 반영됨(잔여 갭 확인 권장), stale worktree 2건, 프론트엔드 가드 확인 미기록 |
| naming_collision | LOW | resumed 3중 동명(WARNING) — 기존 혼재가 재정의로 부각. cross-reference 보강 권장 |

## 권장 조치사항
1. (WARNING 해소) `spec/5-system/6-websocket-protocol.md` §4.2 `resumed` 필드 설명에 `execution.resumed` 이벤트 및 NodeHandlerOutput status `"resumed"` 와 별개임을 명시하는 cross-reference 한 줄 추가. → **반영 완료**
2. (INFO — plan 완료) 프론트엔드 파일(`use-execution-events.ts`, `apply-execution-snapshot.ts` 등)에서 ack `resumed:true` 를 상태 전이 근거로 사용하는 곳이 없는지 확인 후 결과 기록. 없으면 `plan/in-progress/spec-update-ws-resumed-ack.md` 를 `plan/complete/` 로 이동(`spec_impact` frontmatter 추가 포함). → **반영 완료 (가드 통과, complete 이동)**
3. (INFO — 표기 정리) `spec/5-system/4-execution-engine.md` §7.5 및 ## Rationale 의 `EXECUTION_CANCELLED` 표기를 `` `execution.cancelled` `` 로 통일. → **반영 완료**
4. (INFO — stale 정리) `plan/in-progress/spec-sync-websocket-protocol-gaps.md`, `spec-sync-execution-engine-gaps.md` 완료 이동 및 stale worktree(`integration-expiry-fixes-1d7c7d`) 정리 검토. → 본 PR scope 외 (별도 정리 항목).
