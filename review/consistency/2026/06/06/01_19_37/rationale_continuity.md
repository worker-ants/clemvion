# Rationale 연속성 검토 — `spec/5-system` (--impl-prep)

> 모드: 구현 착수 전 검토 (--impl-prep). 대상 worktree: `exec-park-durable-resume`.
> 착수 대상 = Phase B 잔여(**PR-B2**: 멀티턴 AI turn-단위 park + `pendingContinuations`/`firstSegmentBarriers` 일가 제거 B3). Phase A(A1~A3)·PR-B1(form/button)은 이미 main 랜딩(commit `7ec999d7` 등).
> 검토 baseline = 현행 worktree HEAD (Phase B 모델이 이미 spec 본문·§Rationale 에 반영된 상태).

## 판정: BLOCK = NO

기각된 대안의 재도입·합의 원칙의 무근거 번복·invariant 우회는 **발견되지 않음**. 본 plan 이 번복하는 과거 결정들(WARN #6 미영속, "신규 DB 컬럼 없음", per-conversation frozen-config)은 모두 §Rationale / conversation-thread §8.4 에 **새 근거와 함께 명시적으로 기록**돼 있어 "무근거 번복" 에 해당하지 않는다. 다만 한 건의 **부분 전파 누락(Warning)** 이 있어 PR-B2 착수 전/중 정합화를 권고한다.

---

## 점검 결과 (관점별)

### 1. 기각된 대안의 재도입 — 해당 없음
PR-B2 가 제거하는 in-memory fast-path(`pendingContinuations` worker-side resolve)는 과거 §Rationale "Durable Continuation" 의 **"Sticky fast-path 제거 — 항상 publish 원칙 보존"**(L1217-1219) 및 **"옛 '키 없음 즉시 throw 폐기' 원칙의 확장"**(L1221-1223)과 **같은 방향**이다. §Rationale "park 즉시 해제"(L1252)가 이를 "publisher-side 제거의 worker-side 대칭 완성"으로 명시한다 — 과거 기각 대안의 재도입이 아니라 기존 원칙의 일관된 연장. ✅

### 2. 합의된 원칙 위반 — 해당 없음
- **"모든 진입점은 항상 BullMQ enqueue"**(§7.4 L828): PR-B2 의 turn-park + slow-path 일원화가 이 원칙을 **강화**한다(worker-side 마저 enqueue 경로로). 위반 없음. ✅
- **bounded 메모리 목표**: D4(turn-단위 park)는 "대화 전체 = 단일 waiting + 코루틴 누적 수용" 대안을 §Rationale L1254 에서 명시 기각하며 목표와 정합. ✅
- **불변식**(동일 turn 이중 실행 0 / continuation 유실 0 / 멱등): §Rationale L1256 에 보존 의무 + dockerized e2e 회귀 명시. ✅

### 3. 결정의 무근거 번복 — 해당 없음 (모두 근거 동반)
다음 3개 과거 결정이 번복되나 **각각 새 Rationale 가 함께 작성**돼 있어 본 관점의 위배 아님:
- **WARN #6 "_resumeState 미영속(보안)"** → §Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존(옛 WARN #6 번복)"(L1162-1176)에 번복 근거(credential-strip 부분집합·평문 영속·암호화 기각 사유) 명시. ✅
- **"신규 DB 컬럼 없음"**(§6.2 옛 L725) → execution-engine §6.2 + conversation-thread §8.4(L337-347)에 "원칙 번복이 아니라 적용 범위 분리(durable in-flight resume vs 실행 이력 재구성)"로 명시. ✅
- **per-conversation frozen-config** → D3(fresh-config-per-turn). §Rationale L1255 + §6.2 L672 에 번복 근거·trade-off(replay reproducibility turn 단위 약화 수용) 기록. ✅ (단 전파 누락은 아래 W1 참조)

### 4. 암묵적 가정/invariant 충돌 — 1건 (Warning, 부분 전파)

---

## Warnings

### W1 (Warning) — D3 "fresh-config-per-turn" 번복이 §6.3 Replay 표·§13 §14.3 에 미전파 (continuity gap)

**현상**: Phase B D3 결정은 "멀티턴 resume 의 `rawConfig` frozen 범위를 **한 turn 처리 범위로 한정**(park 중 워크플로 편집은 다음 turn 부터 반영)" 으로 과거의 *per-conversation frozen*(대화 전체=첫 turn 정의 고정)을 대체한다. 이 번복은 다음 2곳에 기록·반영됐다:
- `spec/5-system/4-execution-engine.md` §6.2 L672 ("frozen snapshot 은 *한 turn 처리 범위* 로 한정 … per-conversation frozen 동작을 대체")
- 같은 문서 §Rationale L1255 (D3 근거)

그러나 동일 문서 §6.3 Replay Policy 표의 **Multi-turn resume 행**은 여전히 무자격으로
> "같은 실행의 다음 turn 진행 — `state.rawConfig` frozen snapshot 사용"

라고만 적혀 있고, **`spec/5-system/13-replay-rerun.md §14.3`**(L446)도
> "Multi-turn resume 은 … (`state.rawConfig` frozen snapshot 사용)"

로 per-conversation 뉘앙스를 그대로 유지한다. `state.rawConfig` 문구 자체는 D3 후에도 한 turn 내에서는 유효하나, **D3 가 "frozen 범위 = 1 turn" 으로 의미를 축소**했음을 두 곳이 반영하지 않아, 독자가 §6.3/§13 만 읽으면 "대화 전체 frozen"(번복된 옛 모델)로 오인할 수 있다.

**왜 PR-B2 관련**: D3 의 fresh-per-turn 은 **PR-B2(turn-단위 park + 매 turn rehydration→`buildRetryReentryState` 가 `node.config` fresh 재유도)에서 비로소 런타임에 실현**된다(PR-B1 form/button 은 멀티턴 무관). 즉 PR-B2 가 §6.3/§13 의 서술을 실제로 무효화하는 변경이므로, 착수와 동반해 두 앵커를 정합화하는 것이 SoT 일관성에 부합한다.

**권고(planner 영역)**: PR-B2 구현 PR 의 spec 동기 갱신에 다음을 포함 —
- §6.3 표 Multi-turn resume 행에 "frozen 범위 = 한 turn(D3 fresh-per-turn) — §6.2/§Rationale" cross-ref 추가.
- §13 §14.3 에 D3 한 줄 단서(park 중 편집은 다음 turn 반영) + §6.2 링크 추가.
- (developer 는 spec write 불가 — 구현 중 위 갱신 필요 시 project-planner 위임. plan §"Spec 변경" 항목에 §6.3/§13 미열거 → planner 작업 목록 보강 권고.)

> 등급 사유: Critical 아님 — 핵심 결정(§Rationale L1255·§6.2 L672)에는 근거가 기록돼 있어 "무근거 번복" 이 아니고, 구현을 차단할 모순도 아니다. 다만 같은 결정이 가리키는 파생 표 2곳이 옛 모델 문구를 유지해 reader-level drift 위험이 있어 Warning.

### W2 (Warning, minor) — plan §"Spec 변경" 목록과 실제 영향 앵커의 불일치

plan(`exec-park-durable-resume.md`) §"Spec 변경" 은 §4.x·§7.4·§7.5·§6.2·§Rationale 갱신은 열거하나 **§6.3 표 / §13-replay-rerun §14.3** 의 D3 정합화는 누락. W1 의 근본 원인(영향 앵커 미식별). PR-B2 착수 전 plan 의 spec-갱신 체크리스트에 두 앵커를 추가하면 W1 이 자연 해소된다.

---

## 비위배 확인 (참고)

- §1.3 / AI Agent §705-707 의 `_resumeState` in-memory + `_resumeCheckpoint` DB 영속 이원 모델은 PR-B2 turn-park 와 정합 — turn-park 가 매 turn checkpoint 영속을 전제하며 이는 A2a/A2b 에서 이미 구현·spec 반영. ✅
- §7.5 rehydration 단일 경로 서술(L876, L829)은 이미 "Phase B: 코루틴 해제로 in-process resolver 부재" 를 최종 상태로 적시. PR-B2 가 멀티턴 AI 까지 이 최종 상태로 수렴시키며, 과도기(L1257)도 §Rationale 에 명시돼 있어 "spec 이 미래 상태를 단정" 하는 drift 도 의도적으로 관리됨. ✅
- conversation-thread §8.4·§4(L213-218), 1-data-model §2.13(컬럼) 의 durable park 영속 약속과 정합. ✅

---

## 요약
- BLOCK: **NO** (Critical 0)
- Warning: **2** (W1 D3 번복 미전파 §6.3/§13 — continuity gap; W2 plan spec-갱신 목록 누락)
- 과거 §Rationale 의 기각 대안 재도입·원칙 위반·invariant 우회: **없음**. 번복 3건은 모두 새 근거 동반.
