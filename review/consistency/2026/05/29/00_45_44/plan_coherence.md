# Plan 정합성 검토 — `spec-draft-ai-error-output-fields.md`

검토 모드: `--spec`
Target plan: `plan/in-progress/spec-draft-ai-error-output-fields.md`
worktree: `spec-update-ai-error-output-fields-594d0a`
검토일: 2026-05-29

---

## 발견사항

### [INFO] Backlog 체크박스의 `retryable: false` 와 target 의 `retryable: true` 차이 — 의도적 교정

- **target 위치**: `spec-draft-ai-error-output-fields.md §C-1 text-classifier §5.3`, `## Rationale`
- **관련 plan**: `plan/in-progress/spec-update-ai-error-output-fields.md` (원본 backlog) 의 보강 항목 첫 번째 체크박스: `"retryable": false` 추가
- **상세**: backlog plan 이 text-classifier `§5.3` 예시에 `retryable: false` 를 쓰도록 명시했으나, target draft plan 은 `retryable: true` 로 교정했다. target 의 Rationale 에 근거가 명시되어 있다 — 예시의 error code 는 `LLM_CALL_FAILED` 이고 message 는 "OpenAI API timeout after 5020ms" (network timeout), `spec/conventions/node-output.md §3.2.1` + `ai-agent §10` 의 분류 규칙상 network timeout 은 `retryable: true`. backlog 메모의 `false` 가 잘못됨을 target 이 발견해 교정한 것이다.
- **판단**: 미해결 결정 우회가 아니라 정합성 교정. backlog 의 `false` 는 명시적 결정이 아니라 초안 기재였고, target 이 §3.2.1 규칙에 의해 바로잡은 것이다. `§3.2.1` 은 PR #289 (`68306a29`) 에서 이미 main 에 반영된 기준이므로 교정 근거가 확립되어 있다.
- **제안**: backlog plan (`spec-update-ai-error-output-fields.md`) 의 해당 체크박스 문구를 `"retryable": true` 로 정정하거나, target draft plan 의 Rationale 로 대체 확인.

---

### [INFO] `spec-ai-error-output-c2c13d` worktree — stale skip

- **target 위치**: target plan frontmatter `worktree: spec-update-ai-error-output-fields-594d0a`
- **관련 plan**: 동일 spec 파일 (`2-text-classifier.md`, `3-information-extractor.md`) 을 작업 대상으로 하는 이전 worktree `spec-ai-error-output-c2c13d`
- **상세**: Step 1 (`git merge-base --is-ancestor`) 결과 STALE. branch `claude/spec-ai-error-output-c2c13d` 의 HEAD 가 `origin/main` 의 ancestor 임이 확인됨 — 해당 worktree 의 작업이 이미 main 에 포함됨. 해당 worktree 의 `spec-update-ai-error-output-fields.md` 는 `status: in-progress` 로 변경되어 있고 체크박스 3건이 `[x]` 완료 표시이나, main 의 `2-text-classifier.md` 를 확인한 결과 `retryable` 필드와 `"status": "ended"` 가 여전히 누락 → 해당 worktree 의 변경이 main 에 반영된 것이 아닌, worktree 자체의 local 체크박스만 완료 처리된 상태로 stale 됨을 의미. PR 이 없어(Step 2 empty) 실제로 머지된 것은 아니며 plan 상태만 업데이트된 채 방치된 stale worktree.
- **제안**: `./cleanup-worktree-all.sh --yes --force` 실행으로 해당 worktree 정리 권장.

---

### [INFO] `spec-update-ai-error-output-fields-594d0a` (target) worktree branch 도 Step 1 STALE 신호 — 작업 미커밋 상태

- **target 위치**: target plan frontmatter `worktree: spec-update-ai-error-output-fields-594d0a`
- **상세**: `git merge-base --is-ancestor claude/spec-update-ai-error-output-fields-594d0a origin/main` 가 STALE 을 반환 — branch 에 신규 commit 이 없음. 이는 현재 worktree 에서 작업은 시작됐으나 아직 commit 이 없는 정상적인 초기 상태. spec draft plan 이 `status: draft` 인 점과 일치. 위험 없음.

---

### [WARNING] `node-output-redesign/text-classifier.md` 의 미결 spec 개선안과의 잠재 중복 — 스코프 겹침 확인 필요

- **target 위치**: target plan §C-1 (text-classifier §5.3 `retryable` 추가), §C-2 (`status: 'ended'` 추가)
- **관련 plan**: `plan/in-progress/node-output-redesign/text-classifier.md` §"종합 개선안 (2026-05-16)" 의 미완료 (spec) 체크박스들: (1) §5.3 `output.originalInput` top-level 처리 정책 결정, (2) `meta.llmCalls` 위치 통일
- **상세**: node-output-redesign 의 text-classifier spec 개선안에는 §5.3 에 대한 미결 `(spec)` 항목이 남아 있다. target plan 은 §5.3 에 `retryable` + `status: 'ended'` 를 추가하는데, 이 두 필드 추가 자체는 node-output-redesign 의 체크박스 항목과 직접 겹치지 않는다 (node-output-redesign 의 `(spec)` 항목은 `originalInput` 위치 정책과 `meta.llmCalls` 위치 통일). 단, 동일 §5.3 섹션을 두 plan 이 서로 다른 시점에 편집할 경우 향후 병합 충돌 가능성이 있다.
- **제안**: target plan 의 변경이 먼저 main 에 반영되면 node-output-redesign plan 이 §5.3 을 편집할 때 target plan 의 추가 내용을 기반으로 편집해야 함을 node-output-redesign plan 에 메모로 추가 권장. 실질적 CRITICAL 수준은 아님 — 동일 필드 수정이 아니므로 병렬 진행 가능.

---

### [WARNING] `multiturn-error-preserve.md` Phase C 와의 잠재 후속 누락 — text-classifier/information-extractor 의 retryable 예시 추가 작업이 plan 에 미등재

- **target 위치**: target plan §C-1 전체
- **관련 plan**: `plan/in-progress/multiturn-error-preserve.md` §C (Retryable error 분기) 및 영향 spec 표
- **상세**: `multiturn-error-preserve.md` 의 영향 spec 표에는 `spec/conventions/node-output.md Principle 3.2`, `spec/4-nodes/3-ai/1-ai-agent.md §7.9·§10`, `spec/4-nodes/3-ai/0-common.md §5` 가 열거되어 있다. 그러나 `spec/4-nodes/3-ai/2-text-classifier.md` 와 `spec/4-nodes/3-ai/3-information-extractor.md` 는 영향 spec 표에 없다. PR #289 에서도 이 두 파일에는 error code 이름 정정만 이루어지고 `retryable` 필드 추가는 빠진 채 머지됐다. 현재 target plan 이 이 누락을 별도 작업으로 채우고 있으나, `multiturn-error-preserve.md` 의 영향 spec 표에 "text-classifier §5.3 / information-extractor §5.3 — retryable 추가는 후속 plan (`spec-draft-ai-error-output-fields`) 에서 처리" 와 같은 cross-reference 가 없다.
- **제안**: `multiturn-error-preserve.md` 의 영향 spec 표에 text-classifier / information-extractor 의 §5.3 `retryable` 보강이 별도 plan (`spec-draft-ai-error-output-fields`) 에서 다뤄짐을 추적 메모로 추가. 또는 target plan 완료 후 backlog plan (`spec-update-ai-error-output-fields.md`) 를 `plan/complete/` 로 이동 시 `multiturn-error-preserve.md` 의 해당 after-note 에 완료 링크 기재.

---

### [INFO] W-1 deferral (`config.schema` → `config.outputSchema`) — 결정 근거 충분

- **target 위치**: target plan §W-1 (deferred)
- **관련 plan**: `plan/in-progress/spec-update-ai-error-output-fields.md` 의 `(선택)` 항목
- **상세**: backlog 에서 "(선택)" 으로 표시된 Warning W-1 을 target draft plan 이 deferral 근거와 함께 명시적으로 scope 외 처리. 이유는 (1) Critical 2건과 무관, (2) `config.schema` 가 doc 전반 ~15곳에 걸쳐 있어 일괄 rename 은 별도 작업. 이는 적절한 scope 관리이며 미해결 결정 우회가 아니다.
- **제안**: W-1 은 `plan/in-progress/spec-update-ai-error-output-fields.md` 의 `(선택)` 항목으로 이미 추적 중이므로 별도 follow-up backlog 는 현재로서는 불필요. 만약 rename 결정이 내려지면 node-output-redesign 의 information-extractor `(spec)` 체크박스와 묶어 처리하는 편이 효율적임을 추적 메모로 남길 것.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `spec-ai-error-output-c2c13d` (branch `claude/spec-ai-error-output-c2c13d`) — Step 1 STALE (`git merge-base --is-ancestor` exit 0). Step 2 PR 조회: empty (PR 없음). stale 판정: Step 1 단독 확정.

- `spec-update-ai-error-output-fields-594d0a` (branch `claude/spec-update-ai-error-output-fields-594d0a`) — Step 1 STALE 신호 (branch 에 신규 commit 없음 — main 과 동일 HEAD). 단, 이 worktree 는 target plan 의 현재 작업 worktree 이며 작업 미커밋 상태의 정상 초기 상태임 — worktree 충돌 대상 아님, STALE skip 이 아닌 현재 작업 worktree 로 처리.

`spec-ai-error-output-c2c13d` 가 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan (`spec-draft-ai-error-output-fields.md`) 은 `plan/in-progress/spec-update-ai-error-output-fields.md` (backlog) 에서 위임된 Critical 2건 (C-1 `retryable` 누락, C-2 `status: "ended"` 누락) 을 처리하는 spec draft 로, plan 정합성 관점에서 전체적으로 양호하다. backlog 대비 `retryable` 값 교정 (`false` → `true`) 은 `spec/conventions/node-output.md §3.2.1` (PR #289 에서 이미 main 에 반영) 의 분류 규칙에 따른 내부 정합성 교정이며 미해결 결정 우회가 아니다. W-1 deferral 도 근거가 명시되어 있다. 주의할 점은 두 가지다: (1) `node-output-redesign/text-classifier.md` 가 같은 §5.3 섹션에 미결 `(spec)` 항목을 갖고 있어 향후 병합 편집 시 순서 조율이 필요하고 (WARNING), (2) `multiturn-error-preserve.md` 영향 spec 표에 text-classifier / information-extractor §5.3 보강 작업이 별도 plan 으로 분리됐음을 cross-reference 하는 추적 메모가 없어 plan 간 완료 상태 추적이 불완전하다 (WARNING). worktree 충돌 후보 2건 중 stale 1건 (`spec-ai-error-output-c2c13d`) skip, target 자신의 worktree (`spec-update-ai-error-output-fields-594d0a`) 는 미커밋 초기 상태로 충돌 없음.

---

## 위험도

LOW
