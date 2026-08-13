# 정식 규약 준수 검토 — convention_compliance

## ⚠️ 사전 확인 — 이 리뷰의 대상 diff 는 사실상 비어 있다 (stale worktree)

검토를 시작하기 전에 `git diff origin/main...HEAD -- spec/5-system` 을 이 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 직접
실행했다. **결과는 0줄**이다. 이 워크트리의 실제 브랜치는 `eia-r8-cache-scope-4ae434` 가 아니라
`claude/raw-query-audit-followups`(origin/main 대비 17 commit ahead, 변경 파일은 전부
`codebase/backend` 의 test-utils/auth-oauth/execution-engine/knowledge-base 쪽이며
`spec/**` 변경은 0건)다.

`git log --all`로 추적한 결과, 이 워크트리 이름이 가리키는 실제 작업(EIA §R8 idempotency 캐시
scope — `interaction:idempotency:<executionId>:<route>:<key>`, 400 만 제외한 닫힌 캐시 목록,
fail-open 하드닝)은 **이미 `origin/main` 에 전부 머지됐다** (`#1153`~`#1167`,
`a80599700`·`f59e2343d`·`8a2d13031`·`1e74f26a6`·`6b76a1dfe`·`9a4d3e32b`·`6570ca3bb` 등
`git merge-base --is-ancestor` 로 확인). 관련 plan
(`plan/in-progress/spec-draft-eia-r8-alignment.md`)도 체크리스트 전항목 `[x]`이고, "developer 턴
(`eia-r8-cache-scope`)이 코드 수정과 같은 커밋에서 캐빗 문장을 지웠다"는 사후 기록까지 남아 있어
구현 완료 사실과 일치한다.

즉 본 프롬프트(`_prompts/convention_compliance.md`)에 번들된 `spec/5-system/1-auth.md`·
`3-error-handling.md` 전문은 **이번 작업의 diff 가 아니라 그냥 현재 committed 상태의 스냅샷**이고,
정작 이 태스크의 실제 target 이었을 `spec/5-system/14-external-interaction-api.md` 와
`<git diff origin/main...HEAD -- code_areas>` 자체는 컨텍스트 예산 초과로 프롬프트에서 생략됐다.
프롬프트 지시("생략됐다고 '내용 없음' 으로 결론짓지 말고 직접 Read 하라")에 따라 워크트리에서
절대경로로 직접 읽어 아래 발견사항을 냈다 — 다만 이 리뷰 세션 자체가 이미 병합된 작업을 다시
검토하는 **델타 0 재실행**일 가능성이 높다는 점을 orchestrator 가 먼저 알아야 한다
(project memory: "백로그 착수 전 병렬 세션 머지 확인" · "stale 워크트리 이름이 consistency 대상을
오염시킨다" 와 동일 패턴).

아래 발견사항은 이 사실을 전제로, **현재(이미 머지된) 문서 상태**를 대상으로 한 best-effort
정식 규약 준수 점검이다.

---

## 발견사항

- **[WARNING]** 리뷰 대상 diff 가 비어 있음 — 이 세션은 이미 머지된 작업을 재검토하고 있다
  - target 위치: 워크트리 전체 (`git diff origin/main...HEAD`)
  - 위반 규약: 해당 없음 (정식 규약 위반이 아니라 리뷰 프로세스 무결성 문제)
  - 상세: `spec/5-system/`·`spec/data-flow/` 에 대한 `origin/main` 대비 diff 가 0줄이다. `eia-r8-cache-scope` 브랜치가 의도했던 EIA §R8 캐시 scope 작업은 `#1153`~`#1167` 로 이미 `origin/main` 에 머지됐고, 이 워크트리는 그 사이 `claude/raw-query-audit-followups` 로 재사용됐다(같은 경로, 다른 브랜치). 프롬프트에 번들된 `1-auth.md`/`3-error-handling.md` 전문은 이번 작업의 변경분이 아니라 현재 상태 스냅샷이며, 정작 R8 캐시 scope 의 실제 target 인 `14-external-interaction-api.md` 와 코드 diff 는 예산 초과로 프롬프트에서 빠졌다.
  - 제안: orchestrator 는 이 SUMMARY 를 근거로 PR 을 올리지 말고, 필요하면 `git status`/`git log`로 워크트리-브랜치 정합을 재확인한 뒤 세션을 폐기하거나 올바른 브랜치로 재초기화할 것. (project memory "델타 0 이면 PR 올리지 말고 폐기" 참고.)

- **[WARNING]** `data-flow/15-external-interaction.md` §4 "외부 의존" 표의 Redis 키 캐빗이 `conventions/redis-keys.md` 신설(§1160) 이후로 stale 하다
  - target 위치: `spec/data-flow/15-external-interaction.md` §4 외부 의존, Redis 행 (약 line 310) — `"키 **형태**는 [실행 엔진 §9.1](../5-system/4-execution-engine.md#91-키-패턴) 참고 — 다만 EIA 계열 키는 그 표에 아직 미등재다(별도 항목)"`
  - 위반 규약: `spec/conventions/redis-keys.md` §5 "새 키를 도입하면 등재한다" 및 그 SoT 성격 (§1 키 형태 규칙, §3 전역 인벤토리 포인터)
  - 상세: 이 캐빗은 두 가지 점에서 이제 사실과 어긋난다. (1) `4-execution-engine.md §9.1` 은 `#1160`(`0855000f2`, 2026-08-13)에서 자체 표를 없애고 "Redis 키 형태 규칙과 저장소 전역 인벤토리의 SoT 는 `conventions/redis-keys.md`" 라고 리다이렉트만 하도록 재작성됐다 — 더 이상 "그 표" 자체가 §9.1 에 없다. (2) "EIA 계열 키는 아직 미등재" 라는 주장은 이제 거짓이다 — 바로 그 `#1160` 커밋이 `spec/conventions/redis-keys.md §3` 전역 인벤토리에 `iext:blacklist:<jti>` · `interaction:idempotency:<executionId>:<route>:<key>` · `eia:rl:*` 를 이미 등재했다(확인: `redis-keys.md` line 59-60). 즉 이 캐빗은 §R8 캐시-scope 작업(이번 태스크가 정확히 다루는 그 키)이 규약에 정식 등재됐다는 사실을 독자에게 숨기고, 존재하지 않는 "미등재 갭"을 계속 안내한다.
  - 제안: 해당 문장을 `"키 **형태**·전역 인벤토리는 [conventions/redis-keys.md](../conventions/redis-keys.md) 참고"` 로 정정하고 "아직 미등재다(별도 항목)" 구절은 삭제한다. `plan/complete/spec-draft-eia-idempotency-key-scope.md` 가 남긴 "EIA Redis 키의 §9.1 미등재" 후속 항목은 `#1160` 이 일반 인벤토리 등재로 해소했으나, `data-flow/15` §4 안의 이 자기-참조 캐빗 문장 자체는 그 PR 의 diff(§2.2 상단 포인터 추가만)에 포함되지 않아 갱신이 누락된 것으로 보인다. 참고로 이 위치는 엄밀히는 `spec/5-system/` 이 아니라 `spec/data-flow/` 라 이번 리뷰의 선언된 target 경로 밖이지만, `14-external-interaction-api.md §R8`·`conventions/redis-keys.md` 와 동일 기능(이번 태스크의 idempotency 캐시 키)을 다루는 직접 인접 문서라 함께 보고한다.

- **[INFO]** `2-api-convention.md §6` HTTP 상태 코드 표에 `410 Gone` 행이 없음 (기존 갭, 이번 diff 무관)
  - target 위치: `spec/5-system/2-api-convention.md §6` (line 197-213)
  - 위반 규약: 없음 — 명시적 규약 위반이라기보다 표 완결성 관점의 제안
  - 상세: `410 Gone` 은 EIA(`14-external-interaction-api.md` §R8·§5.1·§5.5)와 webhook(`2-api-convention.md §11.3` "비활성 410 Gone")에서 이미 반복적으로 쓰이지만 §6 의 cross-cutting HTTP 상태 코드 표에는 200/201/204/400/401/403/404/409/413/422/429/500/503 만 있고 410 이 빠져 있다. `git blame` 상 이 갭은 webhook 쪽 410 사용(이번 태스크 이전)부터 있던 것으로, 이번 EIA §R8 변경이 새로 만든 문제는 아니다.
  - 제안: 우선순위 낮음. 후속 spec-sync 시 §6 표에 `410 | Gone | 리소스가 영구 소멸/종료됨 (execution terminal, webhook 비활성 등)` 행 추가를 고려.

## 요약

이번 convention_compliance 검토의 가장 중요한 결론은 규약 위반이 아니라 **리뷰 대상 자체의 무효성**이다 — `eia-r8-cache-scope` 워크트리의 실제 git 상태는 이미 다른 작업(`claude/raw-query-audit-followups`)으로 넘어가 있고, 이 태스크가 겨냥했던 EIA §R8 idempotency 캐시 scope 작업은 `origin/main` 에 이미 완전히 머지돼 있어 `origin/main...HEAD` diff 가 `spec/5-system/`·`spec/data-flow/` 양쪽 모두 0줄이다. 그 전제 위에서, 실제 머지된 §R8 관련 문서(`14-external-interaction-api.md §R8`, `data-flow/15 §2.2`, `conventions/redis-keys.md`)를 직접 열어 확인한 결과 새 idempotency 캐시 키(`interaction:idempotency:<executionId>:<route>:<key>`)는 `redis-keys.md §5` 등재 의무를 지켰고 에러 코드(`VALIDATION_ERROR` 등)도 `error-codes.md` 의 UPPER_SNAKE_CASE·의미 기반 명명 원칙을 따르는 등 CRITICAL 급 위반은 없다. 다만 `data-flow/15-external-interaction.md §4` 에 `#1160`(redis-keys.md 신설) 이후 갱신되지 않은 stale 캐빗 문장이 하나 남아 있어 WARNING 으로 보고한다.

## 위험도

LOW — 실제 문서 내용에서 CRITICAL 급 정식 규약 위반은 발견되지 않았으나, (1) 리뷰 세션 자체가 이미 머지된 작업을 대상으로 한 무효 재실행일 가능성이 높다는 프로세스 경고와 (2) 인접 문서의 stale 포인터 캐빗 1건이 있어 NONE 대신 LOW 로 표기한다.
