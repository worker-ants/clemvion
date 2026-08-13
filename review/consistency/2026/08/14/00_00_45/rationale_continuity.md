# Rationale 연속성 검토 결과

### 발견사항

- **[CRITICAL] Target diff 부재 — 검토 대상이 이 워크트리에 존재하지 않는다 (worktree/브랜치 불일치)**
  - target 위치: `spec/5-system/**` 전체 (프롬프트가 지목한 `--impl-done` diff-base `origin/main`)
  - 과거 결정 출처: 해당 없음 — 비교할 diff 자체가 없어 Rationale 연속성 판정을 내릴 표면이 없다.
  - 상세:
    - 실측: 현재 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 `git status` → 브랜치는 `claude/raw-query-audit-followups` (clean, review 산출물 untracked 만 존재). `git diff origin/main --stat -- spec/` → **출력 0줄**. `git rev-parse HEAD origin/main` → `e214a654a` vs `598dca9ab`(HEAD 가 origin/main 대비 10 commit 선행하지만 그 10개는 전부 `auth-oauth`/`execution-engine`/`knowledge-base`/`update-returning-rows`/plan 문서로, `spec/` 를 전혀 건드리지 않는다).
    - `spec/5-system/14-external-interaction-api.md` 는 이미 §R8(`Idempotency-Key 와 submit_form 검증 실패의 관계`, "캐시 키 스코프" 문단 포함)을 담고 있으나 이 내용은 **origin/main 에도 동일하게 존재**한다(`git show origin/main:spec/5-system/14-external-interaction-api.md` 로 확인 — 워킹트리와 완전 동일).
    - `plan/in-progress/spec-draft-eia-r8-alignment.md` (status: in-progress, `worktree: eia-spec-r8-alignment-fff754` — **현재 워크트리 이름과 다름**)는 `spec/data-flow/15-external-interaction.md` 의 idempotency 캐시 서술("2xx 캐시/4xx 제외" → "2xx·409·410 캐시/400 VALIDATION_ERROR 만 제외")을 §R8 SoT 에 맞춰 정정하는 작업을 아직 "진행 중"으로 기록하고 있다. 그러나 `git show origin/main:spec/data-flow/15-external-interaction.md` 를 직접 열어 확인한 결과, plan 이 제안하는 정정 문구(`2xx·409·410 응답을 ... 24h 캐시 (400 VALIDATION_ERROR 제외)`, "캐시 키 스코프" 각주 포함)가 **origin/main 에 이미 그대로 반영되어 있다**(§2.2 Redis/BullMQ 표 L260 등). 즉 이 plan 이 기술하는 변경은 이미 다른 세션에서 병합 완료됐고, plan 자체가 stale 이다.
    - `git worktree list` 로 확인한 결과 `eia-spec-r8-alignment-fff754` 라는 별도 워크트리가 실제로 존재하며 브랜치 `claude/eia-spec-r8-alignment-fff754` 를 체크아웃 중이다. 즉 orchestrator 가 이번 `--impl-done` rationale_continuity 호출을 준비한 시점과, 이 sub-agent 가 실제로 실행되는 시점 사이에 **`eia-r8-cache-scope-4ae434` 워크트리가 다른 작업(`raw-query-audit-followups`)으로 재사용**됐거나, 애초에 orchestrator 가 잘못된 워크트리 경로로 이 호출을 조립한 것으로 보인다.
    - sandbox 정책상 이 세션은 `git -C <다른 워크트리>` / `cd <다른 워크트리> && git ...` 를 모두 거부한다(worktree 격리) — 따라서 `eia-spec-r8-alignment-fff754` 쪽에서 실제로 무엇이 커밋/미커밋 상태인지 git 수준으로는 교차 검증할 수 없었다. `Read` 툴로는 그쪽 파일을 열람할 수 있었고, 그 내용이 origin/main 과 일치함은 확인했다(=별도 미병합 diff 는 못 찾음).
  - 제안:
    1. 이 리뷰의 "발견 없음"을 **spec/5-system 변경이 Rationale 과 정합한다**는 뜻으로 해석하지 말 것 — 애초에 검토할 diff 가 없었다.
    2. Orchestrator/호출자는 `prompt_file`/`output_file` 경로가 가리키는 워크트리(`eia-r8-cache-scope-4ae434`)가 실제로 EIA r8 cache-scope 작업의 워크트리가 맞는지 재확인해야 한다. 현재 이 이름의 워크트리는 무관한 브랜치(`claude/raw-query-audit-followups`)를 체크아웃 중이다.
    3. `plan/in-progress/spec-draft-eia-r8-alignment.md` 는 기술한 변경이 이미 `origin/main` 에 반영돼 있으므로, 담당자가 실제 델타(있다면)를 재산정한 뒤 `plan/complete/` 로 이동하거나 폐기해야 한다(메모리 교훈: "델타 0 이면 PR 올리지 말고 폐기").

### 요약

이번 호출의 `target 문서` (`spec/5-system/`, diff-base `origin/main`)는 실행 시점의 워크트리 상태에서 **origin/main 과 완전히 동일**했다 — `git diff origin/main --stat -- spec/` 가 0줄을 반환했고, HEAD 가 origin/main 대비 앞선 10개 커밋은 전부 `spec/` 외 영역(백엔드 auth/engine/kb 코드, plan 문서)이다. 따라서 기존 spec Rationale 대비 target 의 "기각된 대안 재도입/원칙 위반/무근거 번복/invariant 우회" 여부를 판정할 실제 diff 표면이 없었다. 부수적으로 `spec/5-system/14-external-interaction-api.md` §R8 과 `spec/data-flow/15-external-interaction.md` 의 idempotency 캐시 스코프 서술은 (a) 서로 정합하고 (b) 이 작업을 다루는 `plan/in-progress/spec-draft-eia-r8-alignment.md` 가 제안한 정정 내용과 이미 일치한다 — 즉 그 plan 이 묘사하는 작업은 이미 완료·병합된 상태로 보인다. 근본 원인은 콘텐츠 결함이 아니라 **워크트리 라우팅 불일치**(prompt/output 경로가 가리키는 `eia-r8-cache-scope-4ae434` 워크트리가 현재 무관한 브랜치를 체크아웃 중)로 판단된다. 이 상태에서의 "CRITICAL/WARNING 0건"을 실제 spec 변경의 정합성 보증으로 취급해서는 안 된다.

### 위험도
HIGH
