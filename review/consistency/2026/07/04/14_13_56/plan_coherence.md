# Plan 정합성 검토 — spec-draft-concurrency-cap-pr2b.md

## 검토 대상
- target: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md` (worktree `impl-concurrency-cap-pr2b-0f2616`)
- 대조 plan: `plan/in-progress/exec-intake-queue-impl.md` §PR2b 항목 (2026-06-05 결정 + 2026-06-06 재검토)
- 대조 spec 현재 상태: `spec/5-system/4-execution-engine.md §8` (worktree 내 실물, origin/main 과 merge-base 일치 확인 — rebase 완료 상태)

## 발견사항

### INFO — 스코프 축소(Q-scope 재결정)는 명시적으로 반영, 커밋 요구사항 drop 없음
- target 위치: `spec-draft-concurrency-cap-pr2b.md` "배경·스코프" 단락, "제외(후속)" 줄
- 관련 plan: `exec-intake-queue-impl.md` line 46 "**결정(2026-06-05)**: … Q-scope=**전체 한 PR**(cap + queue-wait 5분 cancel + TOCTOU + priority 3-tier + INFO 4건)"
- 상세: 2026-06-05 원결정은 "전체 한 PR" 이었으나, 사용자가 2026-07-04 재결정으로 spec PR 분리 + 스코프를 cap+5분 cancel 로 한정하고 priority 3-tier(triggerType threading)를 독립 후속으로 뺐다. draft 는 이 재결정을 "배경·스코프" 절에 명시적으로 기록했고("사용자 결정(2026-07-04): spec PR 분리 + 스코프 = cap + 5분 cancel 먼저"), "제외(후속)" 줄에 priority 3-tier 와 "단일 Execution 최대 노드 수(500) enforcement"(원래도 §8 표에 있었으나 PR2b 스코프 밖이던 항목, spec §8:1077 "500 | 시스템 설정" 확인)까지 정확히 열거했다. TOCTOU 는 draft §8 변경안에 "TOCTOU 방지" 원자적 admission gate 서술로 여전히 포함돼 있어 drop 아님. INFO 4건(`resolveExecutionRunWorkerConcurrency`→`execution-limits.ts` 통합 등, `exec-intake-queue-impl.md` line 56 "(곁들임 PR2b) INFO 묶음")은 코드 리팩터 항목이라 spec draft 범위 밖이며 developer PR 로 자연 이관 — 이는 정상(스코프 재정의가 spec 문서 항목만 다루므로).
- 제안: 없음(정합). 단 exec-intake-queue-impl.md §PR2b 체크리스트 항목(line 46)의 "Q-scope=전체 한 PR" 문구가 이번 재결정으로 **superseded** 됐음을 plan 본문에 한 줄 추가해두면(예: "2026-07-04 재결정으로 스코프 분할, 아래 참조") 향후 읽는 사람의 혼선을 막을 수 있음. draft 의 "side-effect 점검" 절이 "exec-intake plan: PR2b 항목을 spec-정의 완료 + 구현 후속으로 갱신" 을 스스로 후속 작업으로 명시해뒀으므로 이는 이미 계획된 조치 — 실행 여부만 후속 커밋에서 확인 필요.

### WARNING — plan 의 "V092 이후" 마이그레이션 번호 메모가 stale, draft 의 V104 재계산이 올바름
- target 위치: `spec-draft-concurrency-cap-pr2b.md` "배경·스코프"·"planner 결정 3."·"1-data-model.md §2.13" — `queued_at` 컬럼을 V104 로 명시
- 관련 plan: `exec-intake-queue-impl.md` line 51 "본 PR2b 의 `queued_at` 은 **V092 이후**로 재부여한다 … 착수 시 max 버전 재확인"
- 상세: 이 메모는 2026-06-06 시점 기준(당시 main max = V091, `unified-model-management` PR1 이후)으로 작성됐다. 현재 worktree 의 `codebase/backend/migrations/` 실물 확인 결과 max 는 **V103**(`V103__trigger_endpoint_path_uuid_validate.sql`)이며, 그 사이 PR2a(V083)·exec-park 계열(V087 등)·model-config 계열(V088~V094)·기타(V095~V103, execution 관련 V095/V096/V098 포함)가 모두 main 에 흡수됐다. draft 가 채택한 **V104** 는 plan 이 지시한 "착수 시 max 버전 재확인" 절차를 정확히 따른 결과이며 충돌 없음(다른 in-progress plan 중 V104 를 점유하는 항목 없음 — `exec-park-durable-resume.md` 는 "max 버전 참고 = V103"으로만 언급, 신규 마이그레이션 불요). 즉 draft 자체는 문제 없으나, **plan 문서의 "V092 이후" 문구가 이제 오래돼 다음에 이 plan 을 읽는 사람이 V092 부근을 시도하다 실제로는 V104까지 이미 점유된 걸 뒤늦게 발견할 위험**이 있다.
- 제안: `exec-intake-queue-impl.md` line 51 의 "V092 이후" 를 이번 PR2b 착수 시점 값(V104, 또는 "spec draft 확정 시 재확인된 V104")으로 갱신하거나, 최소한 "(2026-06-06 시점 기준, 착수 시 재확인 필수)" 를 강조하는 각주를 추가 권장. CRITICAL 은 아님 — draft 자체가 이미 올바른 최신값을 채택했고 실제 구현 PR 착수 시 `check-migration-versions.py` 로 재검증하게 돼 있어 실제 충돌로 이어질 가능성은 낮다.

### INFO — spec §8 현재 상태와 draft 전제의 정합 확인
- target 위치: `spec-draft-concurrency-cap-pr2b.md` "변경안 §8" 절
- 관련 plan: 없음(spec 자체 확인)
- 상세: worktree 내 `spec/5-system/4-execution-engine.md §8` 실물을 확인한 결과, cap 표·"제한 초과 시 동작" 모두 draft 가 전제한 대로 여전히 "Planned(PR2b)" 빈칸 상태이고, 다른 동시 작업이 §8 을 이미 변경하지 않았음을 확인했다. `exec-park-durable-resume.md` 에 남아있던 과거 경고("impl-concurrency-cap-pr2b 가 Phase B 이전 모델로 spec 을 덮어쓸 위험", W4/C1)는 이 worktree 가 이미 origin/main(PR3/PR4 포함, merge-base 일치)로 rebase 된 상태라 **더 이상 유효하지 않은 stale 경고**로 확인됨.
- 제안: 없음(정보성 확인 완료, 조치 불요).

## 요약
draft 는 2026-07-04 재결정(spec PR 분리 + 스코프를 cap+5분 cancel 로 한정, priority 3-tier 는 독립 후속 분리)을 정확히 반영했고, 원래 exec-intake-queue-impl.md 의 "Q-scope=전체 한 PR" 결정과 대조해도 요구사항을 몰래 누락한 곳은 없다 — TOCTOU 방지 서술은 유지되고, priority 3-tier·500-노드 cap 은 "제외(후속)"으로 명시적으로 분리됐다. queued_at 마이그레이션 번호는 plan 이 stale 하게 "V092 이후"로 적어뒀지만 draft 는 실제 저장소 상태(max V103)를 반영해 올바르게 V104 로 재계산했으며 이는 plan 자신이 지시한 "착수 시 max 버전 재확인" 절차의 정상 결과다. 유일한 조치 필요 사항은 plan 문서 쪽의 stale 메모(V092 이후) 갱신으로, 향후 혼선 방지를 위한 WARNING 성격의 정정이며 draft 자체나 구현 안전성을 저해하지 않는다.

## 위험도
LOW

BLOCK: NO
- WARNING: `exec-intake-queue-impl.md` line 51 의 "queued_at 은 V092 이후" 메모가 stale(현재 max V103, draft 는 올바르게 V104 채택) — plan 문서 갱신 권장, draft 자체는 정합.
- INFO: 스코프 재결정(2026-07-04)이 draft 에 정확히 반영됨, priority 3-tier·500-노드 cap 제외가 명시적이라 요구사항 silent drop 없음. exec-intake plan 쪽 "Q-scope=전체 한 PR" 문구에 superseded 각주 추가 권장(draft 자체의 "side-effect 점검"에 이미 후속 작업으로 계획돼 있음).
- INFO: spec §8 현재 상태가 draft 전제와 정합 확인, exec-park-durable-resume.md 의 과거 W4/C1 경고는 이 worktree 의 rebase 완료로 더 이상 유효하지 않음(stale, 조치 불요).

STATUS: SUCCESS
