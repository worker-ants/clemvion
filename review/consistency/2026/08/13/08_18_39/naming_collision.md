STATUS=success reviewer=naming_collision

### 발견사항

- **[INFO]** `.github/actions/pnpm-workspace/` composite action 디렉터리명이 루트 `pnpm-workspace.yaml`(pnpm 자체 워크스페이스 매니페스트)과 이름을 공유
  - target 신규 식별자: `.github/actions/pnpm-workspace/action.yml` (target §후속 "셋업 보일러플레이트 추출" 항목이 신설, 이미 머지됨)
  - 기존 사용처: 저장소 루트 `pnpm-workspace.yaml` (pnpm 표준 워크스페이스 정의 파일, 완전히 다른 목적)
  - 상세: 둘은 확장자·경로·용도가 모두 달라(하나는 pnpm CLI 가 강제하는 표준 파일명, 다른 하나는 GitHub composite action 디렉터리) 실제 충돌은 없다. 다만 "pnpm-workspace" 라는 동일 문자열이 두 곳에 존재해 `grep -r pnpm-workspace` 같은 탐색 시 두 결과가 섞여 나온다.
  - 제안: 실질 위험이 낮아 이름 변경까지는 불필요. 필요하면 action 디렉터리명을 `pnpm-setup` 등으로 구분해도 되나 우선순위는 낮음.

- **[INFO]** 동일 개발 라인에 대해 두 개의 유사 worktree/turn 식별자(`eia-r8-cache-scope` vs `eia-r8-cache-scope-4ae434`)가 target 본문에 병기됨
  - target 신규 식별자: `developer 턴 \`eia-r8-cache-scope-4ae434\`` (§idempotency 캐시 키 스코프 항목의 "완료" 서술, 현재 worktree)
  - 기존 사용처: 같은 target 문서 내 다른 절(§idempotency 캐시 제외 조건, line ~753)의 `developer 턴 \`eia-r8-cache-scope\`` — 스코프 없는 1차 시도(실패, `16_29_45` CRITICAL 로 롤백)와 이름이 해시 접미사 하나만 다름
  - 상세: 실제 충돌은 아님 — 본문이 "1차 시도는 실패, 재시도는 `-4ae434`" 로 순서를 명시하고 있고, 이 저장소가 실패한 시도를 새 worktree(해시 접미사)로 재시작하는 기존 관행과 일치한다(`plan/complete/spec-draft-eia-idempotency-key-scope.md` frontmatter 의 `worktree: eia-r8-cache-scope-4ae434` 도 동일 접미사로 정합). 다만 두 식별자가 접미사 8자만 다르고 문서 여러 곳에 흩어져 등장해, 훑어 읽을 때 "같은 시도의 두 기록"으로 오독할 여지가 약간 있다.
  - 제안: 조치 불요(이미 각 절에서 성공/실패를 명시). 향후 유사 재시도 기록 시 "1차(실패)" / "재시도" 같은 짧은 라벨을 접미사 옆에 병기하면 재독 비용이 더 낮아진다.

- **[INFO]** EIA 계열 Redis 키가 같은 기능 영역 안에서 서로 다른 네임스페이스 접두사(`interaction:idempotency:` vs `iext:blacklist:`)를 씀
  - target 신규 식별자: `interaction:idempotency:${executionId}:${route}:${rawKey}` (본 target 이 이번 turn 에서 3-세그먼트로 재설계, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:21` / `spec/data-flow/15-external-interaction.md:258` 와 정합 확인됨 — 충돌 없음)
  - 기존 사용처: 같은 EIA 도메인의 형제 키 `iext:blacklist:<jti>` (`spec/data-flow/15-external-interaction.md:88, 257`)
  - 상세: 두 접두사(`interaction:` / `iext:`)가 충돌하지는 않지만, 같은 기능(External Interaction API)의 형제 Redis 키 그룹이 서로 다른 줄임 규칙을 쓴다는 점에서 명명 일관성이 약하다. target 문서 자신도 이를 별개 항목(§"EIA 계열 Redis 키가 실행 엔진 §9.1/§9.2 키 레지스트리에 없다", `19_56_51` convention_compliance INFO 4)으로 이미 인지·기록해 두었다.
  - 제안: 이미 target 이 planner 인계로 남겨 둔 상태(§9.1 "모든 Redis 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}`" 범위를 좁히거나 EIA 계열을 묶어 §9.2 에 등재)이므로 추가 조치 불요 — 본 리뷰는 그 인계가 접두사 불일치 축도 함께 다룰 필요가 있음을 보강 확인.

새로 도입되는 타입/함수명(`HttpResponseLike`, `IdempotencyEntry`, `isIdempotencyEntry()`), 요구사항 ID 사용(`EIA-RL-02`, `EIA-IN-11` — 기존 ID를 그대로 재참조, 신규 발급 아님), CI 파일 경로(`backend-checks.yml`, `_changed-paths.yml`, `.github/actions/pnpm-workspace/action.yml`, `.claude/tests/test_pnpm_workspace_action.py`), e2e 테스트 라벨(`IDEM-1`~`IDEM-5`)을 실제 저장소(`codebase/backend/src`, `spec/**`, `.github/**`)에 대해 개별 grep 대조한 결과 모두 고유하며 기존 사용처와 의미 충돌이 없었다. 신규 API endpoint·webhook/queue/SSE 이벤트명·환경변수는 target 문서에서 새로 도입되지 않았다(기존 `/interact`·`/cancel`·`Idempotency-Key` 헤더 재사용).

### 요약
target 은 spec 을 새로 도입하는 문서가 아니라 backend lint 게이트 복구 + 부수적으로 완료된 EIA R8 캐시 스코프 작업을 기록한 실행 로그성 plan 문서다. 문서가 언급하는 신규 식별자(타입명·함수명·Redis 키 포맷·CI 워크플로/액션 경로·e2e 테스트 라벨)를 실제 코드베이스·spec 전수와 대조한 결과 CRITICAL/WARNING 급 충돌은 발견되지 않았다. Redis 키 재설계(`interaction:idempotency:<executionId>:<route>:<key>`)는 코드와 `spec/5-system/14-external-interaction-api.md`·`spec/data-flow/15-external-interaction.md` 사이에 이미 정합돼 있고, `EIA-RL-02`/`EIA-IN-11` 은 기존 ID 를 그대로 재참조할 뿐 신규 충돌 발급이 아니다. 발견된 것은 모두 INFO 수준(파일명 유사·worktree 식별자 접미사·같은 도메인 내 Redis 접두사 불일치)이며 그중 마지막 것은 target 문서 스스로 이미 별도 항목으로 인지해 인계해 둔 사안이다.

### 위험도
NONE
