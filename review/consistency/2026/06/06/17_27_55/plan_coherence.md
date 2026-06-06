# Plan 정합성 검토 결과

**검토 모드**: 구현 완료 후 (`--impl-done`, scope=`spec/5-system/14-external-interaction-api.md`)
**Target 워크트리**: `exec-park-b2a-followup-9fdefc` (branch `claude/exec-park-b2a-followup-9fdefc`)
**변경 파일**: `spec/5-system/14-external-interaction-api.md` (§8.3, §10.1), `spec/5-system/7-llm-client.md` (§7.1 신설), `spec/data-flow/3-execution.md` (park/rehydration 시퀀스 `resume_call_stack` 추가), `codebase/backend/test/execution-park-resume.e2e-spec.ts`

---

## 발견사항

- **[WARNING]** `impl-exec-concurrency-cap` active worktree 가 `spec/data-flow/3-execution.md` 동일 라인을 Phase B 이전 모델로 덮어쓸 위험
  - target 위치: `spec/data-flow/3-execution.md` L48-50 (park durable commit note) 및 L108-119 (rehydration alt 블록)
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` §PR2b 착수조건 — "exec-park-pr-b2 머지 후 origin/main rebase 선행 필수"
  - 상세: target 은 L50 park note 에 `resume_call_stack` V087 추가 + "full B3 완료" 서술, L108-119 에 단일 rehydration 경로로 표기한다. 반면 `impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`, merge-base `722edf7a` = PR #469 직후, Phase B 이전)는 같은 L48-50 에서 "continuation-queue … 폼/버튼은 즉시 해제, 멀티턴 AI 는 PR-B2 전 in-memory 잠정" 서술로, L108-119 를 `pendingContinuations` 로컬 hit(fast-path)·miss(slow-path) 분기로 표기한다. target PR 이 먼저 머지되면 impl-exec-concurrency-cap 이 rebase 없이 push 시 Phase B 완료 서술이 **덮어써진다**. `exec-intake-queue-impl.md` 에 rebase 필수가 명시됐으므로 plan 인식은 있으나 실행은 아직이다.
  - 제안: target 은 현재 정상 진행 가능. 단, target PR 머지 완료 직후 `exec-intake-queue-impl.md` PR2b 착수 담당자에게 "origin/main rebase 수행 후 `spec/data-flow/3-execution.md` 충돌 수동 해소" 를 리마인드할 것. 해당 worktree 가 아직 No PR 상태(`gh pr list` 결과 빈 배열)이므로 push 전 rebase 가 강제된다. plan 의 착수조건 표기가 이를 이미 커버하고 있어 추가 plan 갱신 불요.

- **[INFO]** `spec-fix-eia-token-error-codes.md` §2(SCOPE_MISMATCH) 미결 결정과 target §② 의 §8.3 수정이 인근 영역에 있으나, target plan 이 "§8.3 secret 출처 명확화에 한정, scope 검증·revoke 신뢰성은 해당 plan 위임"을 명시 경계로 기재하고 있어 충돌 없음
  - target 위치: `plan/in-progress/exec-park-b2a-followup.md` §② 범위 경계 항목
  - 관련 plan: `plan/in-progress/spec-fix-eia-token-error-codes.md` §2, §3
  - 상세: target 의 §8.3 변경은 `iext_*`/`itk_*` secret 출처 이원화 설명이며, `spec-fix-eia-token-error-codes.md` 가 다루는 §5.1 TOKEN_REVOKED 에러표·SCOPE_MISMATCH status 코드·§3.4/§9.3 terminal revoke 신뢰성과 겹치지 않는다. "jti 가 Redis blacklist 로 revoke" 는 §8.3 의 설명적 cross-reference 이지 §3.4/§9.3 정책을 결정하는 변경이 아니다.
  - 제안: 추가 조치 불요. 단, `spec-fix-eia-token-error-codes.md` §2 결정(SCOPE_MISMATCH → 401/TOKEN_SCOPE_MISMATCH 통일)이 향후 §8.3 서술에 영향을 줄 수 있으므로 해당 plan 처리 시 §8.3 참조 여부 재확인 권장.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` §3의 EIA cross-ref(SSE `execution.tool_call_started/completed` payload `name` 필드 namespace 재검토)는 target 이 건드리는 §8.3·§10.1 과 별개의 §5.2 항목이라 충돌 없음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §8.3 및 §10.1 Swagger scheme 설명
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 Spec 작성 "(EIA cross-ref) §5.2 tool_* 접두사 확정 후 SSE payload namespace 동기화"
  - 상세: 해당 cross-ref 는 `ai-agent-tool-connection-rewrite` 의 도구 이름 규칙(tool_* 접두사 부활 여부)이 결정된 후에야 연동되는 후속 항목이다. target 은 §5.2 를 수정하지 않는다.
  - 제안: 추가 조치 불요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석 결과, 아래 3개 worktree 는 §worktree stale 판정 Step 2(GitHub PR state)에서 stale 확정:

- `harden-review-hooks-cb1c84` (branch `claude/harden-review-hooks-cb1c84`) — Step 2 PR #493 `MERGED`. `spec/5-system/14-external-interaction-api.md` 수정 보유하나 무효. skip.
- `plan-complete-p6-043804` (branch `claude/plan-complete-p6-043804`) — Step 2 PR #495 `MERGED`. `spec/5-system/14-external-interaction-api.md` 수정 보유하나 무효. skip.
- `rag-dynamic-cut-12fac1` (branch `claude/rag-dynamic-cut-12fac1`) — Step 2 PR #500 `MERGED`. `spec/5-system/7-llm-client.md` 및 `spec/data-flow/3-execution.md` 수정 보유하나 무효. skip.

이 3개 worktree 는 모두 PR 머지 후 미정리 상태다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

worktree 충돌 후보 중 active 로 처리한 것:

- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1 non-ancestor (ACTIVE), Step 2 PR 없음(빈 배열) → Step 3 fallback active. `spec/data-flow/3-execution.md` 동일 섹션 수정 중 (WARNING 발견사항 참조). stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.

---

## 요약

target(`exec-park-b2a-followup-9fdefc`)의 `spec/5-system/14-external-interaction-api.md` §8.3 secret 출처 명확화·`spec/5-system/7-llm-client.md` §7.1 LLM_STUB_MODE 문서화·`spec/data-flow/3-execution.md` `resume_call_stack` doc-sync·e2e ENCRYPTION_KEY 교정은, 현재 active plan 및 worktree 와의 정합성 관점에서 전체적으로 안전하다. `spec-fix-eia-token-error-codes.md` 의 미결 결정 영역은 target 이 명시적으로 위임·배제하고 있어 우회 없음. 유일한 주의 사항은 `impl-exec-concurrency-cap` active worktree 가 `spec/data-flow/3-execution.md` 의 동일 라인을 Phase B 이전 모델로 기술하고 있어 향후 rebase 없이 push 시 덮어쓰기 위험이 있다는 점이며, 이는 `exec-intake-queue-impl.md` 착수조건에 이미 명기된 사항이다. worktree 충돌 후보 7건 중 stale 3건(PR MERGED) skip, active 1건 WARNING 분석.

---

## 위험도

LOW
