# 신규 식별자 충돌 검토 — naming_collision

## 검토 전제 확인 (선행 조사)

리뷰 실행 전, `meta.json` 이 명시한 대상(`target_path=spec/5-system/`, `diff-base=origin/main`, mode=impl-done)에 대해 실제 diff 가 존재하는지 워킹트리에서 직접 확인했다.

- `pwd` = `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434` (프롬프트가 지정한 SoT 워킹트리와 일치)
- 그러나 이 워킹트리의 실제 `git branch --show-current` = `claude/raw-query-audit-followups` (디렉터리명 `eia-r8-cache-scope-4ae434` 와 브랜치 목적이 불일치)
- `git merge-base origin/main HEAD` == `git rev-parse origin/main` → 이 브랜치는 origin/main 에서 정확히 10 커밋 fast-forward 상태
- `git diff origin/main...HEAD --name-only`, `git diff origin/main..HEAD --name-only` 양쪽 모두 `spec/` 경로 매치 **0건**. `spec/5-system/` 대상 `--stat` 도 공백.
- 10 커밋의 실제 내용(`update-returning-rows`, `auth-oauth.service`, `execution-engine.service`, `knowledge-base.service`, plan `retry-turn-terminal-guard`/`update-returning-tuple-shape`)은 EIA/캐시 스코프와 무관 — UPDATE 반환 튜플 형태 버그, OAuth 로그인 실패 수정 등 별개 작업.

즉 **이번 검토 세션이 겨냥한 target(`spec/5-system/`, EIA §R8 캐시 키 스코프)에 대해 diff-base(`origin/main`) 대비 신규·변경 내용이 이 워킹트리에 전혀 없다.**

### 원인 추정: 델타 0 (병렬 세션이 이미 머지)

`git log --all --oneline --grep` 로 확인한 결과, "EIA §R8 캐시 키 스코프" 관련 작업은 이미 별도 세션에서 완료되어 `origin/main` 에 머지되어 있다:

- `72db62a7b` docs(spec): 멱등 캐시 키가 전 execution 공유였는데 spec 은 "동일 키" 라고만 적었다 (#1156)
- `a80599700` fix(eia): §R8 이 열거한 409·410 이 멱등 캐시에서 빠져 있었다 (#1155)
- `8a2d13031` fix(eia): 멱등 캐시 키가 헤더 값 하나뿐이라 남의 응답이 재생될 수 있었다 (#1157)
- `f59e2343d` fix(eia): 캐시 엔트리 안쪽이 깨지면 요청이 500 이 됐다 (#1158)
- `ba3dbd676` docs(spec): data-flow 가 §R8 을 인용하면서 정반대로 요약 (#1154)
- `0855000f2`, `1e9f3f238`, `9a4d3e32b` (#1160, #1162, #1166) 등 후속 EIA 정합화 커밋

이 커밋들 모두 `git log origin/main --oneline -- spec/5-system/14-external-interaction-api.md` 로 조회 시 이미 `origin/main` 이력에 포함되어 있음을 확인했다. 즉 `spec/5-system/14-external-interaction-api.md` 의 §R8(EIA-IN-11, EIA-RL-02 등)은 diff-base 시점(`origin/main`)에 이미 존재하는 **기존** 내용이지, 이번 워킹트리가 새로 도입하는 **target** 콘텐츠가 아니다.

현재 이 워킹트리는 (아마도 재사용되어) 완전히 다른 작업(`raw-query-audit-followups` 계열: UPDATE returning tuple shape, OAuth 로그인, retry-turn-terminal-guard)을 진행 중이며, `spec/5-system/` 를 전혀 건드리지 않는다.

## 발견사항

- **[WARNING]** 검토 세션 target 과 워킹트리 실제 상태 불일치 (델타 0)
  - target 신규 식별자: (해당 없음 — target 으로 지정된 `spec/5-system/` 에 diff-base 대비 신규 diff 가 0건)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md` 의 EIA-IN-11 / EIA-RL-02 / §R8 캐시 키 스코프 내용은 이미 `origin/main` (커밋 `72db62a7b` #1156 등)에 병합되어 있음
  - 상세: 이번 `naming_collision` 세션은 "eia-r8-cache-scope" 작업이 아직 `origin/main` 대비 diff 로 남아 있다는 전제로 호출되었으나, 실제로는 그 작업이 이미 다른 세션에서 완료·병합되었고 이 워킹트리(`eia-r8-cache-scope-4ae434`)는 현재 무관한 다른 브랜치(`claude/raw-query-audit-followups`)로 재사용되고 있다. 따라서 "target 이 새로 도입하는 식별자"라는 리뷰 전제 자체가 이 워킹트리에서는 성립하지 않는다.
  - 제안: orchestrator 는 이 세션을 폐기하거나(델타 0), 실제로 검토해야 할 target 워킹트리/브랜치를 재확인해야 한다. 프로젝트 메모리 규약(`feedback_parallel_session_backlog_collision.md`): "델타 0 이면 PR 올리지 말고 폐기". 신규 식별자 충돌 관점에서는 이 세션이 보고할 CRITICAL/충돌이 없다 — 애초에 신규 식별자가 도입되지 않았기 때문.

이 워킹트리의 실제 diff(UPDATE returning-rows 헬퍼, auth-oauth 서비스, execution-engine/knowledge-base 서비스, plan 문서 3건)에 대해서도 신규 식별자 충돌 관점을 적용했으나, 이들은 `spec/5-system/` 범위 밖이고 새 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var·spec 파일 경로를 도입하지 않는다(기존 함수 `update-returning-rows.ts` 는 새 유틸이지만 기존 `assert-row-array.ts` 네이밍 컨벤션과 일관되고 이름 충돌 없음). 따라서 이 축에서도 보고할 CRITICAL/WARNING 은 없다.

## 요약

이번 세션의 target(`spec/5-system/`, diff-base=`origin/main`)에 대해 실제로는 diff 가 0건이다 — EIA §R8 "캐시 키 스코프" 작업은 이미 별도 세션(#1154~#1158, #1160, #1162, #1166)에서 완료되어 `origin/main` 에 병합되었고, 이 워킹트리는 현재 무관한 다른 작업(`raw-query-audit-followups`)의 10개 커밋만 담고 있다. 따라서 "target 이 새로 도입하는 식별자"가 존재하지 않으므로 신규 식별자 충돌 관점에서 보고할 CRITICAL 은 없다. 유일한 유의미 발견은 프로세스 층위의 것으로, 이 리뷰 세션 자체가 델타 0 상태에서 호출되었다는 점이며 orchestrator 재확인이 필요하다.

## 위험도

NONE
