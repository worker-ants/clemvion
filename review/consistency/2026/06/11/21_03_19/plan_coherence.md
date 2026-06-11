# Plan 정합성 검토 — spec/4-nodes/5-data/2-code.md (code-node-isolated-vm 워크트리)

검토 모드: --spec (spec draft)
Target: `spec/4-nodes/5-data/2-code.md` (code-node-isolated-vm 워크트리 버전)

---

## 발견사항

### [INFO] refactor/04-security.md C-2 체크박스가 아직 "결정 대기" 상태
- **target 위치**: `## Rationale` 섹션 — `### 격리 방식 isolated-vm 전환 — 위협 모델과 결정 (2026-06-11)`
- **관련 plan**: `plan/in-progress/refactor/04-security.md` §C-2 (`- [ ] 결정 대기 (사용자)`)
- **상세**: target spec Rationale 에 "사용자 결정(2026-06-11)으로 isolated-vm 전환한다"고 명시되어 있으나, `refactor/04-security.md` 의 C-2 체크박스는 여전히 `- [ ] 결정 대기 (사용자)` 상태다. 결정이 실제로 이루어졌으나 백로그 plan 에 반영되지 않아 추적 불일치가 생겼다. M-2 항목("C-2 에 흡수")도 동일하게 미갱신 상태다.
- **제안**: target spec 이 main 에 머지된 후(또는 현 worktree PR 머지 시), `refactor/04-security.md` C-2 와 M-2 의 체크박스를 `- [x]` 로 갱신하고 worktree 링크(`code-node-isolated-vm`) 및 결정 날짜(2026-06-11)를 메모로 추가한다.

### [INFO] refactor/04-security.md C-2 "spec 선행 필수" 조건 — target 이 이미 이행
- **target 위치**: `§7.1 격리 방식` 표, `§Rationale` 위협 모델 섹션
- **관련 plan**: `plan/in-progress/refactor/04-security.md` C-2 권장안 — "어느 쪽이든 §7.1 위협 모델 경계(SaaS vs self-host) 명시는 선행 필수"
- **상세**: 백로그가 `isolated-vm` 전환 전 선행 조건으로 요구했던 §7.1 위협 모델 경계(다중 워크스페이스 SaaS vs self-host 명시)가 target spec §Rationale 에 상세히 기록되어 있다. 선행 조건이 충족된 상태이므로 구현 착수 차단 요인이 없다. 별도 알림이 불필요하지만, 백로그 선행 조건 항목도 동시에 체크해야 한다.
- **제안**: 현재 대응 불필요 (정합). 머지 후 C-2 갱신 시 "spec 선행 조건 충족" 메모 포함 권장.

### [INFO] node-output-redesign/code.md 구현 분석 일부가 target 변경 후 stale 됨
- **target 위치**: `§7.1 격리 방식`, `§7.3 허용/차단 API` 표 (차단 방식 설명이 isolated-vm 기준으로 교체)
- **관련 plan**: `plan/in-progress/node-output-redesign/code.md` §8 "sandbox 안전성 gap 발견" 섹션 (gap (c) 명시 셰도잉 누락 분석, `node:vm` 기준 작성)
- **상세**: `node-output-redesign/code.md` §8의 gap (c) 분석("vm context 가 host globals 를 노출하지 않아 우연한 통과")이 `node:vm` 구현을 전제로 작성됐다. target spec 이 `isolated-vm` 으로 전환하면 이 분석의 기술적 전제(vm context 격리 방식)가 달라진다. 단, `node-output-redesign/code.md` 는 output 구조 개선 관점의 분석 문서이고 이미 완료된 항목들([x] 처리)이 대부분이므로 실질 작업 차단 요인은 없다.
- **제안**: `node-output-redesign/code.md` 는 이력 분석 문서 성격이므로 별도 갱신 의무는 낮다. 단, 해당 plan 이 "in-progress" 상태를 유지하는 한 독자 혼동 방지를 위해 gap (c) 옆에 "isolated-vm 전환 후 무효화됨 (2026-06-11 결정)" 주석 1줄 추가를 권장한다.

### [INFO] spec-draft-conventions-code-data 플랜의 worktree가 MERGED 상태 — spec 정합 확인
- **target 위치**: `§Rationale` — config.code raw echo 결정, output root 직접 배치 결정
- **관련 plan**: `plan/in-progress/spec-draft-conventions-code-data.md` (worktree `conventions-code-data-9b32d5`)
- **상세**: `spec-draft-conventions-code-data.md` 가 수행한 Principle 7/8.2 정합화(config.code "항상 echo" + output root 배치)가 이미 PR MERGED 상태로 main 에 반영됐다. target spec 의 Rationale §config.code raw echo 및 §output root 직접 배치 섹션은 이 작업의 결과물을 정확히 인용·유지하고 있어 정합하다.
- **제안**: 해당 plan 파일 자체를 `plan/complete/` 로 이동 (별도 cleanup 작업 — plan-lifecycle 규칙).

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토 결과:

1. `conventions-code-data-9b32d5` (branch `claude/conventions-code-data-9b32d5`) — Step 1: ACTIVE (merge-base ancestor 아님), Step 2: PR MERGED. **stale** — `spec/4-nodes/5-data/2-code.md` 를 수정했으나 이미 main 에 머지됨. target spec 이 해당 변경을 포함한 상태이므로 충돌 없음.

2. `claude/prod-fail-closed-guards` (worktree `prod-fail-closed-guards`) — Step 1: ACTIVE (merge-base ancestor 아님), Step 2: PR MERGED. **stale** — `spec/4-nodes/5-data/2-code.md` 에 변경 없음(diff 결과 0줄). 충돌 없음.

활성 worktree 중 `spec/4-nodes/5-data/2-code.md` 를 동시 수정하는 다른 worktree: **없음**. code-node-isolated-vm 이 해당 파일을 단독 수정 중이다.

stale worktree 가 활성 체크아웃으로 남아있는 경우, `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target `spec/4-nodes/5-data/2-code.md`(code-node-isolated-vm 워크트리)는 `plan/in-progress/refactor/04-security.md` C-2·M-2 의 "결정 대기" 항목에 대해 사용자 결정(2026-06-11)을 spec 에 반영한 것으로, **이는 결정 우회가 아니라 결정 이행**이다. 백로그 plan 의 C-2 권장안("isolated-vm 전환, spec §7.1 위협 모델 명시 선행 필수")이 target spec Rationale 에 완전히 이행되어 있고, 다른 active worktree 와의 동시 수정 충돌도 없다. 발견된 항목은 모두 INFO 등급 — 백로그 체크박스 동기화 누락, node-output-redesign 분석 문서의 stale 기술, MERGED plan 의 complete 이동 대기 등이며 작업 진행을 차단하지 않는다. worktree 충돌 후보 2건(conventions-code-data, prod-fail-closed-guards) 은 각각 Step 2 에서 PR MERGED 로 stale 판정되어 skip 됐다.

---

## 위험도

NONE
