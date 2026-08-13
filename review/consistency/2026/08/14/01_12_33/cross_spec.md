# Cross-Spec 일관성 검토 — spec/5-system/ (--impl-done)

## 발견사항

- **[CRITICAL]** 검토 전제 자체가 무효 — target 델타가 diff-base(`origin/main`) 대비 0
  - target 위치: 프롬프트 `## ⚠️ 현재 구현 코드의 기준` 절이 지목한 워킹트리 `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434` 전체
  - 충돌 대상: 없음 (spec 간 충돌이 아니라 검토 파이프라인 입력 자체의 문제)
  - 상세:
    1. 프롬프트 내 `<git diff origin/main...HEAD -- code_areas>` 섹션은 원래 47,877자였으나 컨텍스트 예산 초과로 **완전히 생략**되어 실제 코드 diff 를 한 줄도 볼 수 없었다. `spec/5-system/14-external-interaction-api.md`(브랜치명 `eia-r8-cache-scope` 이 가리키는 실제 target 문서로 추정)도 동일하게 본문이 생략되었다.
    2. 절대경로로 워킹트리를 직접 조사한 결과 (`git -C <워킹트리> status/log/diff`), 해당 워킹트리는 현재 브랜치 `claude/raw-query-audit-followups` 를 체크아웃하고 있다 — 디렉토리명(`eia-r8-cache-scope-4ae434`)과 실제 체크아웃 브랜치가 **불일치**한다. `git worktree list` 로 확인 시 동일 경로가 `[claude/raw-query-audit-followups]` 로 표시된다. 이는 병렬 세션이 같은 워크트리 디렉토리를 다른 브랜치로 재사용/뮤테이션했음을 시사한다(`feedback_reviewer_mutates_shared_worktree`, `feedback_session_worktree_deleted_hooks_break` 계열 알려진 실패 모드).
    3. `git diff origin/main HEAD --stat -- spec/` 와 `-- codebase/backend/src/modules/external-interaction/` 은 **둘 다 완전히 비어 있다** — 이 워킹트리의 현재 HEAD 에는 `spec/5-system/` 또는 EIA 코드 변경이 전혀 없다. HEAD 의 실제 diff(`--stat` 전체)는 OAuth/execution-engine/knowledge-base/`update-returning-rows` 관련 14개 커밋으로, "eia-r8-cache-scope" 와 무관하다.
    4. `spec/5-system/14-external-interaction-api.md` 를 절대경로로 직접 읽은 결과 §R8("Idempotency-Key 와 submit_form 검증 실패의 관계", "캐시 키 스코프")이 **이미 완성된 형태로 존재**하며 (line 1135~1152), `data-flow/15-external-interaction.md` 의 캐시 스코프 설명(`interaction:idempotency:<executionId>:<route>:<key>`, 400 제외, fail-open)과도 이미 정합돼 있다. `git log --all` 조회 결과 `a80599700 fix(eia): §R8 이 열거한 409·410 이 멱등 캐시에서 빠져 있었다 — 첫 수정은 dead code 였다 (#1155)` 커밋이 존재하며, `git merge-base --is-ancestor a80599700 origin/main` 이 **참(true)** 이다 — 즉 이 작업은 이미 `origin/main` 에 병합 완료된 상태다.
  - 제안: 이 결과는 "spec 충돌 없음(clean)" 이 아니라 **"검토할 delta 자체가 없거나, 검토 대상 워킹트리가 오염되어 신뢰할 수 없음"** 이다. orchestrator 는 (a) 이 워킹트리를 올바른 `eia-r8-cache-scope` 브랜치로 복구한 뒤 재실행하거나, (b) 이미 `origin/main` 에 병합된 작업이라면 이 리뷰 라운드를 **폐기**해야 한다 (사용자 메모리 규약: "델타 0 이면 PR 올리지 말고 폐기"). 이 보고서의 "충돌 없음" 판정을 "PR 이 안전하다" 로 해석해 그대로 진행하면 실제로는 아무 것도 검증하지 못한 채 통과시키는 결과가 된다.

- **[INFO]** 번들에 포함된 기존 spec 본문(1-auth.md 전문·3-error-handling.md 전문·1-data-model.md 발췌)에 한해 별도 spot-check 를 수행했으나 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점에서 새로운 모순은 발견하지 못했다. 다만 이는 위 CRITICAL 항목 때문에 "target 의 실제 변경분"을 전혀 보지 못한 상태에서의 확인이므로, 이 INFO 는 "변경 없음의 증거"가 아니라 "현재 원장(origin/main) 상태 자체는 내적으로 정합해 보인다"는 제한적 관찰에 불과하다. 참고로 EIA §R8 캐시 스코프(§1135~1152)와 `spec/data-flow/15-external-interaction.md`(§Redis 표, line 260) · `spec/5-system/3-error-handling.md` §1.6(409 `IDEMPOTENCY_KEY_CONFLICT`, 410 `EXECUTION_TERMINATED`) 3개 문서 간 캐시 대상(2xx·409·410, 400 제외)·키 스코프(`<executionId>:<route>:<key>`)·fail-open 정책은 모두 일치했다.

## 요약

이번 회차 cross-spec 검토는 실질적으로 수행 불가능했다. 프롬프트에 포함되어야 할 실제 코드 diff(47,877자)와 target 문서(`14-external-interaction-api.md`, 101,724자)가 컨텍스트 예산 초과로 모두 생략됐고, 대안으로 지목된 절대경로 워킹트리(`.claude/worktrees/eia-r8-cache-scope-4ae434`)를 직접 조사한 결과 그 디렉토리는 현재 무관한 브랜치(`claude/raw-query-audit-followups`, EIA 와 무관한 OAuth/execution-engine/KB 변경 14개 커밋)를 체크아웃하고 있어 브랜치명과 실제 내용이 어긋나는 것으로 확인됐다. `origin/main` 대비 `spec/` 및 EIA 코드 diff 는 완전히 0이며, 커밋 이력 조회로 "§R8 캐시 스코프" 작업(#1155)이 이미 `origin/main` 에 병합돼 있음을 확인했다 — 즉 이 리뷰가 겨냥하는 변경 자체가 이미 반영 완료됐거나, 최소한 이 워킹트리 인스턴스에서는 검증 불가능한 상태다. 번들에 남아있던 기존 spec 본문에서는 새로운 cross-spec 모순을 찾지 못했지만, 이는 target 델타를 보지 못한 상태의 제한적 결과다.

## 위험도
CRITICAL
