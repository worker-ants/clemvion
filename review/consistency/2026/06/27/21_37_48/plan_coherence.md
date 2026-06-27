# Plan 정합성 검토 — spec-draft-eia-seq-nfr.md (EIA-NF-06 / EIA-NF-07)

## 발견사항

### [WARNING] 선행 plan(load-verify)이 main 기준 미완료 — target 은 "검증 완료"를 단정
- target 위치: 배경 단락 ("이미 구현·검증 완료다", "PR #730 의 실-Redis e2e 가 이 기준들을 경험적으로 입증") + Rationale 보강 ("실-Redis 2-instance e2e 로 경험 검증되었다")
- 관련 plan: `plan/in-progress/eia-distributed-seq-load-verify.md` — 작업 단위 4개(`backend-e2e-2` 추가 / 2-instance 동시 emit 하니스 / 1000 events/s 단조 측정 / single-instance latency 마이크로벤치)가 **현재 worktree·main 기준 전부 `[ ]` 미체크**이며 `plan/in-progress/` 에 잔존.
- 상세: target 은 NF-06(부하 하 monotonic)·NF-07(latency 회귀 예산)을 "이미 구현·검증된 계약의 문서화"로 전제한다. 그러나 그 경험 검증을 담당하는 load-verify plan 은 본 worktree 가 보는 repo 상태(main HEAD = #731)에서는 아직 in-progress 이고, 그 첫 작업인 `docker-compose.e2e.yml` 의 `backend-e2e-2` 2번째 인스턴스도 실제로 존재하지 않는다(파일에 `backend-e2e` 단일 서비스뿐). 즉 NF-06 의 "멀티 인스턴스 동시 emit" 경험 입증의 사전 조건이 main 기준 미해소.
  - 다만 해당 작업은 별도 branch `claude/eia-seq-load-verify-6f5ebc` 에서 완료되어 plan 이 complete 로 옮겨진 커밋(`f8946c576` 등)이 존재한다 — 단 **그 branch 가 main 에 미병합**이라 본 worktree 에는 반영돼 있지 않다. (branch 간 동시작업 직렬화 자체는 본 검토 대상이 아니므로 등급은 CRITICAL 이 아닌 WARNING.)
- 제안: 두 plan 의 병합 순서를 직렬화한다 — load-verify branch 를 먼저 main 에 병합(plan 이 complete 로 이동, e2e 하니스 반영)한 뒤 본 spec draft 를 진행하거나, 본 draft frontmatter 의 출처 표기를 실제 상태와 일치시킨다(아래 INFO 참조). spec 본문의 "검증 완료" 단정은 그 선행 병합이 main 에 들어온 뒤라야 정합.

### [INFO] target frontmatter 의 출처 경로가 실제 위치와 불일치
- target 위치: frontmatter 직후 "출처" 줄 — `plan/complete/eia-distributed-seq-load-verify.md`
- 관련 plan: 동 plan 의 실제 위치는 `plan/in-progress/eia-distributed-seq-load-verify.md` (main 기준). `plan/complete/` 에는 존재하지 않음.
- 상세: 출처를 `complete/` 로 가리켰으나 main 기준 해당 파일은 `in-progress/` 에 있다. (complete 사본은 미병합 branch 에만 존재.) 위 WARNING 과 동일 근원 — target 이 "이미 완료된 과거 작업"으로 가정하는 경로가 실제로는 아직 진행 중.
- 제안: 선행 병합 후라면 경로가 자동 정합되므로 INFO. 병합 전 본 draft 를 먼저 쓸 경우 출처 표기를 `in-progress/...` 로 정정하거나 "병합 대기 중" 단서를 추가.

### [INFO] 인용한 관측 수치가 load-verify 최종 측정값과 미세 불일치
- target 위치: 배경("≈67k events/s, single-instance latency median ~0.07ms") + Rationale 보강(동일 수치)
- 관련 plan: `eia-distributed-seq-load-verify` 완료본(branch `claude/eia-seq-load-verify-6f5ebc`)의 최종 측정 — throughput **≈62,928 events/s** (1000 발급/15.9ms), single-instance next() latency **median 0.083ms** (avg 0.094, p95 0.185).
- 상세: target 의 "≈67k / ~0.07ms" 는 실제 기록값(≈63k / 0.083ms)과 어긋난다. 두 값 모두 기준(1000/s·<5ms) 대비 큰 여유라 결론(NFR 충족)에는 영향 없으나, spec Rationale 에 박제되는 경험 수치이므로 SoT(load-verify 완료본) 값으로 맞추는 편이 추적상 안전하다.
- 제안: spec 에 인용할 수치를 load-verify 완료본의 측정값(≈63k events/s, median 0.083ms)으로 정정하거나, 라운딩이 의도라면 "약 6만 events/s 이상" 식으로 보수적 표현.

### [INFO] 미해결 결정·후속 충돌 없음 (확인 결과)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는 §5.2/§5.3(replay_unavailable emit, getStatus 의 `seq:0` placeholder)만 다루고 §3.5 NFR 표나 §R7 seq counter 계약을 건드리지 않아 NF-06/07 추가와 충돌 없음.
- `plan/in-progress/ai-agent-tool-connection-rewrite.md` 의 EIA cross-ref(§3 step §5.2 SSE `tool_call` payload `name` namespace)는 §3.5 와 무관 — 충돌 없음.
- NF-07 의 "회귀 예산 < 5ms vs in-memory baseline" 프레이밍은 부모 plan `plan/complete/eia-distributed-seq-counter.md` 수용 기준 #3 과 정확히 일치 — 신규 목표 상향 아님(필수 등급 타당). NF-06 의 "불변식형 NF" 분류도 기존 EIA-NF-05 계열과 정합. spec 본문 §3.5 표(현재 NF-01~05)·§R7 cross-ref(§5.6·§R7) 모두 실재 — 좌표 유효.

## 요약
spec draft 자체는 부모 plan 의 수용 기준·기존 NFR 분류 컨벤션과 충실히 정합하며, 미해결 결정을 일방 우회하거나 다른 in-progress plan 과 충돌하지 않는다. 다만 draft 가 NF-06/07 을 "이미 검증 완료"로 단정하는 근거인 `eia-distributed-seq-load-verify` plan 이 본 worktree·main 기준으로는 아직 `in-progress`(작업 4건 미체크, `backend-e2e-2` 미존재)다 — 검증 완료 상태는 별도 미병합 branch 에만 존재한다. 따라서 본 draft 의 병합 정합성은 load-verify branch 의 선행 병합에 의존하며, 그 전에는 출처 경로(complete vs in-progress)와 인용 수치(67k vs 실측 63k)가 실제와 어긋난다.

## 위험도
LOW
