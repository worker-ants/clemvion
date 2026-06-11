# Plan 정합성 검토 결과

target: `plan/in-progress/spec-update-ws-resumed-ack.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-10

---

## 발견사항

### [INFO] M-1 출처 계승 — plan-level 위임 정합 확인
- target 위치: 전문(preamble) "출처: `plan/in-progress/refactor/06-concurrency.md` M-1 (✅ 2026-06-10 사용자 승인 — 권고안 A 확정)"
- 관련 plan: `plan/in-progress/refactor/06-concurrency.md` §M-1 (⏭️ planner 선행 표기)
- 상세: `refactor/06-concurrency.md` M-1 은 ⏭️ planner 트랙으로 분리를 명시하고, target plan 이 그 분리된 항목이다. 출처·결정 경위·권고안 A 확정이 양쪽에 일관되게 기록돼 있어 위임 계보가 정상이다. 충돌 없음.
- 제안: 조치 불요.

### [INFO] `refactor/06-concurrency.md` C-1 — `queued` 계약에 의존하는 미착수 항목
- target 위치: §변경안 1 — `queued` 필드 기존 설명과의 인접
- 관련 plan: `plan/in-progress/refactor/06-concurrency.md` §C-1 (`cancelWaitingExecution` fire-and-forget, 미착수)
- 상세: C-1 은 WS §4.2 의 `queued: false` 계약 정신을 논거로 삼는다. target 은 **`resumed`** 필드 정의만 변경하고 `queued` 정의 자체는 건드리지 않으므로 C-1 의 논거·권고안에 영향이 없다. 다만 target 이 §4.2 에 "always-enqueue 모델 해설 노트"를 추가할 때 `queued` 서술과의 중복·모순이 없는지 편집 시 확인 권장.
- 제안: target 편집자가 새 노트 문구를 기존 `queued` 단락(line 232)과 대조해 일관성 검토. 별도 plan 수정 불요.

### [INFO] `spec-sync-websocket-protocol-gaps.md` — 동일 spec 파일 추적 중
- target 위치: spec_impact `spec/5-system/6-websocket-protocol.md`
- 관련 plan: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` (worktree: spec-sync-audit — 실제 worktree 디렉토리/브랜치 없음, 미착수 상태)
- 상세: `spec-sync-websocket-protocol-gaps.md` 는 동일 spec 파일의 **미구현 surface**(in-band 토큰 갱신 핸들러·rate-limit·에러 코드 등)를 추적하는 별도 plan 이다. target 이 수정하는 §4.2 `resumed`/`queued` 행·해설 노트 영역과 직접 겹치는 항목은 없다(해당 plan 의 미구현 항목은 §4.5 `auth.token_expired`, §1.3 in-band refresh, §7.1 rate-limit 등 별개 섹션). `spec-sync-audit` 브랜치·worktree 는 git 및 파일시스템 어디에도 존재하지 않아 실질 경합 없음. 상태 정직화(worktree sentinel 제거 또는 미착수 표기)를 권장하나 차단 이슈 아님.
- 제안: 양 plan 편집자 없는 한 조치 불요. 단 `spec-sync-websocket-protocol-gaps.md` frontmatter 의 `worktree: spec-sync-audit` 는 미착수 sentinel 로 교체 권장.

### [INFO] `spec-sync-execution-engine-gaps.md` + `execution-engine-residual-gaps.md` — 동일 spec 파일 추적 중
- target 위치: spec_impact `spec/5-system/4-execution-engine.md`
- 관련 plan: `plan/in-progress/spec-sync-execution-engine-gaps.md` (worktree: spec-sync-audit, 미착수) / `plan/in-progress/execution-engine-residual-gaps.md` (worktree: spec-frontmatter-status-migration-027c17, 실제 미존재 — 완료 이관 누락 의심)
- 상세: `spec-sync-execution-engine-gaps.md` 는 §4/§7.1/§8 aspirational surface 를 추적하며 모두 resolved(2026-06-04 spec 재정의·구현)로 표기됐다. target 이 수정하는 §7.5 서술은 해당 plan 의 미구현 항목이 아니며 `exec-park-durable-resume` spec flip 으로 이미 §7.4/§7.5 가 갱신됐다. `execution-engine-residual-gaps.md` (G1/G2 BLOCKED, G3 완료)의 추적 영역(§11 graceful-shutdown, §7.5 rehydration 범위)과도 target 의 §7.5 "RESUME_* 는 비동기 이벤트" 정정이 충돌하지 않는다.
- 제안: 조치 불요.

### [INFO] `exec-park-durable-resume.md` — §7.5 선행 spec 개정 확인
- target 위치: §변경안 2 "엔진 §7.5(line 967) §7.5.1 과 일치"
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` (spec flip 완료 기록 포함)
- 상세: `exec-park-durable-resume` plan 은 "spec flip 완료" 메모에서 `4-execution-engine §7.5(step2+diagram)` 및 `websocket-protocol §4.2` 를 수정했다고 기록한다. 해당 spec flip 이 §7.5.1 서술과 §7.5 의 "셋 모두 ack 에 `resumed: false`" 모순을 이미 정정했는지 확인이 필요하다. 현재 spec 본문 line 241 이 여전히 `resumed | boolean | 재개 성공 여부` 로 남아있는 것으로 보아 `exec-park-durable-resume` spec flip 은 §4.x/§6.2/§7.4 등 다른 영역을 갱신한 것이고 §7.5 의 해당 모순 문장·§4.2 `resumed` 정의는 target plan 의 몫으로 남겨진 상태다. 이중 편집 위험은 없으며, target plan 의 착수 조건이 충족돼 있다.
- 제안: 조치 불요. 단 target 편집자는 `exec-park-durable-resume` spec flip 커밋(5dc6444f·7c6d0f2c·35524fe4)에서 §7.5 관련 변경 범위를 확인하고, 그 편집과 target 의 §7.5 정정이 충돌하지 않는지 spec 파일 열람 후 착수 권장.

### [INFO] `refactor/06-concurrency.md` M-6 — 프론트엔드 `use-execution-events.ts` 가드 확인
- target 위치: §검증·후속 "프론트 가드 확인(읽기)"
- 관련 plan: `plan/in-progress/refactor/06-concurrency.md` §M-6 (`use-execution-events.ts` 중복 등록, 미착수)
- 상세: target 은 `use-execution-events.ts` 가 `resumed:true` 를 상태 전이 근거로 쓰지 않는지 읽기-확인을 요구한다. M-6 은 동일 파일의 handler 중복 등록 이슈를 독립 추적 중이다. 두 항목은 같은 파일의 다른 관심사이므로 직접 충돌은 없다. 단 target 이 "프론트 가드 확인 후 위반이 있으면 별도 developer 항목 신설"로 끝나는 조건부 후속을 열어두고 있어, 그 신설 항목이 M-6 과 동일 파일·동일 hook 을 건드릴 경우 새 plan 에서 M-6 cross-link 를 포함할 필요가 있다.
- 제안: target 의 프론트 확인 결과 신규 항목 신설 시 M-6 cross-link 포함 권장. 현 시점 plan 갱신 불요.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보로 식별된 항목:

- `integration-expiry-fixes-1d7c7d` (branch `claude/integration-expiry-fixes-1d7c7d`) — Step 1 ancestor 검사: exit 0(STALE). target 의 spec_impact 파일(`spec/5-system/6-websocket-protocol.md`, `spec/5-system/4-execution-engine.md`)을 포함하지 않음(git diff main...branch 확인). 충돌 후보에서 제외.

활성으로 남아있는 이유가 없는 worktree. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan `spec-update-ws-resumed-ack.md` 는 `refactor/06-concurrency.md` M-1 의 사용자 승인된 planner 위임을 정확히 계승하며, `spec/5-system/6-websocket-protocol.md` §4.2 의 `resumed` 정의와 `spec/5-system/4-execution-engine.md` §7.5 의 내부 모순 2건만을 spec-only 정정 대상으로 한정한다. 미해결 결정과의 충돌 없음. 두 spec 파일을 동시에 손대는 활성 worktree 없음(health-probe-status·unified-model-mgmt 양쪽 모두 해당 파일 무변경 확인). 선행 `exec-park-durable-resume` spec flip 과의 이중 편집 가능성도 실제 spec 본문 확인으로 배제됐다. 후속 항목(프론트 가드 확인 결과에 따른 조건부 developer plan 신설)은 target plan 자체에 이미 명기돼 있어 누락 없음. 발견사항은 전원 INFO 수준이며 차단·수정 필요 항목 없음. worktree 충돌 후보 1건(`integration-expiry-fixes-1d7c7d`) Step 1 에서 stale 판정·skip.

---

## 위험도

NONE
