# 문서화(Documentation) Review — EIA idempotency fixes

## 발견사항

- **[CRITICAL]** 작업 트리의 `idempotency.interceptor.ts` 현재 상태가 코드 자신의 주석·클래스 docstring 과 정반대다 — `catchError` 가 `switchMap` **뒤**에 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:96-99` (경고 주석), 실제 배치는 파일 128번째 줄 부근(`catchError`) — `Read` 로 직접 확인.
  - 상세: 리뷰 프롬프트에 실린 diff/전체 컨텍스트(그리고 이미 커밋된 `5d79dc123`)는 `catchError` 를 `from(this.redis.get(redisKey)).pipe(` 직후·`switchMap` **앞**에 둔다. 바로 그 자리의 주석이 이렇게 명시한다: "**위치 주의 — `switchMap` 앞이어야 한다.** 뒤에 두면 아래에서 캐시 충돌 시 던지는 `ConflictException`(정상 동작)까지 삼켜 멱등성 검출이 조용히 죽는다." 클래스 docstring 도 "조회 경로는 종전에 빠져 있어 Redis 장애가 곧 요청 실패였다" 며 이 fix 를 전제로 서술한다. 그런데 이 worktree 를 `git diff HEAD` 로 대조하면 **커밋되지 않은 unstaged 변경**이 존재하며, 그 변경이 정확히 `catchError` 를 `switchMap` **뒤**로 옮겨 놓았다 — 주석이 "이러면 깨진다" 고 경고하는 바로 그 배치다. 파일 mtime(14:30:31)이 이 리뷰 세션 시작(14:27:02) 이후·조회 시점(14:31:09) 직전이라, plan 문서가 서술한 "뮤테이션 실측: 뒤로 옮기면 4건 RED" 절차를 수행 중인 **동시 실행 프로세스(다른 sub-agent 의 뮤테이션 테스트 등)가 아직 원복하지 않은 상태**일 가능성이 높다(`codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`, `plan/in-progress/backend-lint-gate-broken-on-main.md`, `CHANGELOG.md` 는 `git diff HEAD` 상 clean — 이 파일 하나만 unstaged). 원인이 무엇이든, **지금 이 순간 코드와 그 코드의 주석·docstring 이 서로 모순**되고, 이 상태로 커밋/push 되면 409 충돌 검출(멱등성 핵심 보장)이 조용히 죽는 회귀가 실제로 발생한다.
  - 제안: push/merge 전 `git status`/`git diff HEAD -- codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 로 작업 트리가 clean 한지(= `catchError` 가 `switchMap` **앞**) 반드시 재확인할 것. 동시 세션이 공유 worktree 를 뮤테이션했을 가능성이 있으므로(프로젝트가 이미 학습한 실패 클래스) 이 세션 종료 전 재검증 필요.

- **[WARNING]** `CHANGELOG.md` 에 이번 fix 항목이 없다 — 이 저장소의 확립된 관례와 어긋난다
  - 위치: `CHANGELOG.md` (루트) — 신규 섹션 부재.
  - 상세: `CHANGELOG.md` 는 `## Unreleased — <제목>` 형식으로 거의 모든 유의미한 backend/frontend fix·feature 를 개별 섹션으로 기록해 왔다(45개 이상 항목 확인 — 예: "retry_last_turn 재진입: 종결 경로 terminal 가드 + 원자 claim + 짝 전이 persist 수정", "AI multi-turn resume turn 경계 cancel 가드…" 등, 유사 규모의 내부 동작-정정 fix 포함). 이번 변경은 "Redis 런타임 장애 시 external interaction API 가 500 을 뱉던" 가용성 결함을 고치는 것으로 — spec 이 명시한 fail-open 보장을 복구하는 사용자 관측 가능한 동작 변화(장애 시 500 → 정상 처리)다. 이미 커밋된 `5d79dc123` 은 `idempotency.interceptor.ts`/`.spec.ts`/plan 파일만 건드리고 `CHANGELOG.md` 는 손대지 않았다.
  - 제안: 다른 항목과 동일한 톤으로 `## Unreleased — Redis 런타임 장애 시 멱등성 캐시 조회 실패가 API 500 으로 번지던 결함 수정` 류의 섹션을 추가.

- **[INFO]** 모듈 최상단 docstring 이 신규 3번째 `describe` 블록을 나열하지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-14`
  - 상세: 파일 헤더 docstring 은 "아래 두 번째 describe 는 **캐시 히트 경로와 응답 형태 방어**…" 라고 두 번째 블록까지만 명시적으로 안내한다. 이번 diff 가 추가한 세 번째 `describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', …)` (spec.ts:349 부근)는 그 자체로 매우 상세한 지역 docstring(spec.ts:338-348)을 갖고 있어 실질적 정보 손실은 없지만, 파일 헤더의 "이 파일에 어떤 블록들이 있는가" 목록이 최신 상태를 반영하지 않는다.
  - 제안: 사소하므로 필수는 아니나, 헤더 docstring에 세 번째 describe 한 줄 추가하면 완전해진다.

## 문서화 우수 사례 (참고)

- `idempotency.interceptor.ts` 클래스 docstring(51-66행)은 "fail-open 이 세 경로 모두(생성자 null·조회 실패·적재 실패)에 걸린다" 고 정정했고, 실제 구현(생성자 null 체크·`catchError`·`cacheTapped` 의 `.catch()`)과 정확히 일치한다 — 과거 라운드에서 지적된 "문서한 보장이 구현보다 넓다" 결함이 정확히 좁혀졌다.
- `catchError` 바로 위 인라인 주석(92-99행)이 위치 제약("`switchMap` 앞이어야 한다")과 그 근거(ConflictException 이 삼켜져 멱등성 검출이 죽음)를 명시하고, `idempotency.interceptor.spec.ts` 의 캐너리 테스트(`fail-open 이 409 충돌까지 삼키지 않는다`)가 그 주장을 실행 가능한 테스트로 고정한다 — 코드-주석-테스트 삼각 정합의 모범 사례다(단, 위 CRITICAL 항목대로 지금 작업 트리 상태는 이 삼각을 깨고 있다).
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크리스트 갱신은 "확인해 보니 '둘 중 하나' 가 아니었다" 는 식으로 이전 인계 판단의 전제가 뒤집힌 경위까지 투명하게 남겼고, 뮤테이션 실측 수치(뒤로 옮기면 4건 RED)까지 근거로 첨부해 plan 라이프사이클 관례(체크박스=실제 상태)를 충실히 따른다.

## 요약

코드 자체의 문서화 품질(독스트링·인라인 주석·테스트 설명·plan 체크리스트 정정)은 이 저장소 평균을 상회할 정도로 꼼꼼하다 — 클래스 docstring 이 구현 범위와 정확히 일치하도록 좁혀졌고, 위험한 배치를 경고하는 주석 옆에 그 위험을 실측 검증하는 캐너리 테스트가 함께 있다. 다만 두 가지가 걸린다: (1) 작업 트리를 직접 열어보면 `idempotency.interceptor.ts` 가 커밋되지 않은 상태로 `catchError`/`switchMap` 순서를 뒤집어 두고 있어, 그 자리의 주석·docstring 이 지금 이 순간 실제 코드와 모순된다(동시 세션의 뮤테이션 테스트 잔재로 추정되나 push 전 재확인이 필수), (2) 유사 규모 fix 마다 항목을 남겨온 `CHANGELOG.md` 관례에서 이번 fix 만 누락됐다.

## 위험도
HIGH
