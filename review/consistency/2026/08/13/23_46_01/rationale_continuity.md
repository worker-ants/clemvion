# Rationale 연속성 검토 결과

## 발견사항

- **[WARNING]** 검토 대상 부재 — 지정 worktree 가 이미 병합된 다른 작업 브랜치로 교체되어 있다
  - target 위치: `spec/5-system/` (diff-base `origin/main`, mode `--impl-done`), 세션 디렉토리 `review/consistency/2026/08/13/23_46_01/`
  - 과거 결정 출처: `plan/complete/spec-draft-eia-idempotency-key-scope.md` (frontmatter `worktree: eia-r8-cache-scope-4ae434`, `status: complete`, 완료일 2026-08-12)
  - 상세:
    1. 본 checker 의 CWD(`/Volumes/.../worktrees/eia-r8-cache-scope-4ae434`)는 프롬프트가 SoT 로 지목한 바로 그 경로이지만, 실측 결과 `git branch --show-current` = `claude/raw-query-audit-followups` 이고 `git merge-base origin/main HEAD` = `origin/main` 의 tip(`598dca9ab`) 자체다. 즉 이 worktree 는 "EIA r8 cache scope" 와 무관한 9개 커밋(`raw-query-audit-followups` 작업)으로 완전히 교체돼 있다.
    2. `git diff origin/main...HEAD -- spec/5-system/` = **0 라인**. 이 세션이 검토해야 할 target 문서 변경분이 현재 worktree 에 전혀 존재하지 않는다.
    3. 근본 원인은 "변경분 소실"이 아니라 **이미 완료·병합**이다 — `plan/complete/spec-draft-eia-idempotency-key-scope.md` 가 바로 이 worktree slug(`eia-r8-cache-scope-4ae434`)로 등록된 spec draft plan이며 `status: complete` 다. spec 은 PR #1156, 구현은 후속 developer 턴(`eia-idem-key-scope-impl`)에서 이미 착지했고, `origin/main` 히스토리에서 직접 확인된다 — `a80599700`(§R8 캐시 대상 닫힌 목록 반영), `1e74f26a6`(fail-open 복원), `8a2d13031`(캐시 키에 execution 축 추가), `f59e2343d`(엔트리 손상 시 fail-open), `4b1f899b7`(경계값 뮤테이션 테스트), `6b76a1dfe`(fail-open 메트릭). `spec/5-system/14-external-interaction-api.md` §R8 "캐시 키 스코프" 문단도 이미 이 내용을 담아 병합된 상태로 현재 파일에 존재한다(`interaction:idempotency:<executionId>:<route>:<key>`).
    4. 이는 MEMORY 의 "병렬 세션이 먼저 머지" 패턴과 동형이다 — worktree 디렉토리가 재사용되며 다른 세션(`raw-query-audit-followups`)이 같은 경로를 다른 브랜치로 체크아웃해, 이 review 세션이 산출한 프롬프트 번들(23:46 시점)과 실제 파일시스템 상태 사이에 시차 오염이 생겼다.
  - 제안: 이 라운드는 실질적으로 검토할 delta 가 없으므로 **BLOCK 판정에 사용하지 말고 폐기**한다. orchestrator 는 (a) `git log origin/main -- spec/5-system/14-external-interaction-api.md` 로 §R8 관련 커밋이 이미 병합됐음을 재확인하고, (b) `plan/complete/spec-draft-eia-idempotency-key-scope.md` 의 `status: complete` 를 근거로 이 review 세션 자체를 stale 폐기하거나, worktree 를 올바른 브랜치로 복구한 뒤 재실행할 것. 병렬 세션이 공유 worktree 디렉토리를 다른 브랜치로 체크아웃하지 않도록 review 세션 시작 시 `git branch --show-current` 를 프롬프트 생성 시점과 실행 시점 양쪽에서 검증하는 가드를 권고.

- **[INFO]** 참고 — 이미 병합된 §R8 콘텐츠 자체는 Rationale 연속성 위반 없음 (best-effort 확인)
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R8 "캐시 키 스코프" (현재 파일 L1143-1154)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §9.2`("executionId 가 이미 전역 유일 UUID" 근거로 `exec:seq:<executionId>` 전역 Redis 키를 둔 선례), `plan/complete/spec-draft-eia-idempotency-key-scope.md ## Rationale`
  - 상세: 위 delta 부재로 diff 기반 검토는 불가능했으나, 병합된 최종 콘텐츠를 직접 읽어 대조한 결과 — (a) "토큰(jti) 이 아니라 execution 으로 스코프" 결정은 `4-execution-engine.md §9.2` 의 기존 선례(`exec:seq:<executionId>`)를 명시적으로 인용해 정합시켰고, (b) 검토 중 고려했다가 기각한 `bg:<executionId>:<backgroundRunId>`(in-memory 전용, Redis 패턴 무관) 를 선례로 오인용하지 않도록 plan Rationale 이 스스로 정정해 뒀으며, (c) route 축(`interact`/`cancel`) 추가는 "자매 호출부 누락으로 방어가 한 칸 좁아지는" 저장소의 반복된 실패 패턴을 명시적으로 인용해 예방하는 방향이라 기존 프로젝트 교훈과 정합한다. 기각된 대안의 무근거 재도입이나 invariant 우회는 발견되지 않았다.
  - 제안: 조치 불요 (참고용).

## 요약

이번 rationale_continuity 검토는 실질적으로 수행할 수 없었다 — 지정된 target(`spec/5-system/`, diff-base `origin/main`, worktree `eia-r8-cache-scope-4ae434`)의 실제 변경분이 현재 worktree 에 전혀 없다. 원인은 코드 결함이 아니라 **이 작업(EIA §R8 idempotency 캐시 키 스코프)이 이미 2026-08-12 spec draft(PR #1156) + 후속 구현 턴으로 완료·병합됐고**, 이후 같은 worktree 디렉토리가 다른 세션(`raw-query-audit-followups`)에 의해 재사용되어 무관한 브랜치로 체크아웃된 상태이기 때문이다. `git diff origin/main...HEAD -- spec/5-system/` 는 0 라인이며, `git merge-base origin/main HEAD` 는 `origin/main` 의 tip 그 자체다. 병합된 §R8 콘텐츠를 best-effort 로 직접 대조한 결과 Rationale 위반은 발견되지 않았으나, 이는 diff 기반 검토가 아니라 참고용 확인에 불과하다. 이 리뷰 라운드는 delta 0 이므로 BLOCK 판정 근거로 쓰지 말고 폐기하거나 worktree 를 정정 후 재실행해야 한다.

## 위험도

LOW — 실제 코드/spec 콘텐츠에서 확인된 Rationale 위반은 없으나(따라서 NONE 에 가까움), review 인프라 자체의 worktree 재사용 충돌로 이번 검토가 유효한 delta 를 보지 못했다는 프로세스 리스크가 있어 NONE 이 아닌 LOW 로 보고한다. orchestrator 의 재확인이 필요하다.
