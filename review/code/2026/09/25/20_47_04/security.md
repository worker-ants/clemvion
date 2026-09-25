# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 변경셋은 애플리케이션 실행 코드(`.ts` 서비스/컨트롤러/데코레이터 로직) 자체를 수정하지 않는다. 실제 diff 는 다음으로 구성된다.

1. `codebase/backend/README.md` — 워크스페이스 reflection 캐너리 절의 문서 정정(운영자 문서, 동작 변경 없음). `@WorkspaceId()`(헤더·토큰)와 `@WorkspaceParam(...)`(경로 파라미터) 두 판별의 합계 0 을 fail-closed 조건으로 명시하고, 부팅 로그가 두 개수를 따로 남긴다는 사실을 반영.
2. `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `transferOwnership()` 의 기존 트랜잭션 내 owner 재검사(TOCTOU 방어) 분기를 고정하는 신규 `it.each` unit 테스트 2건(강등 · 멤버십 소멸) 추가. 프로덕션 로직 변경 없음.
3. `plan/in-progress/canary-readme-recheck-test.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 항목 2건 추가) — 순수 plan 메타 문서.
4. `review/code/2026/09/25/20_20_00/*`, `review/consistency/2026/09/25/20_01_21/*` — 이전 라운드의 리뷰/consistency-check 산출물이 신규 파일로 커밋되는 것. 프로세스 메타데이터이며 실행 코드나 설정값을 포함하지 않는다.

## 발견사항

### 파일 1 — `codebase/backend/README.md`
- **[INFO]** 문서 정정 내용이 실제 구현과 일치함(직접 대조 확인)
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` — `assertWorkspaceIdReflectionWorks`(149행 `if (total === 0) throw`, 152~155행 `logger.log` 문구), `countWorkspaceConsumingRoutes`(98~124행). README 자체는 문서라 게이트 인용 대상 아님.
  - 상세: README 신규 문구("두 판별의 **합계**가 0일 때만 부팅 거부", "두 개수를 각각 로그에 남김 — `@WorkspaceId() 소비 라우트 N건 인식 · @WorkspaceParam() 소비 라우트 M건 인식`")를 소스와 글자 단위로 대조했다. `assertWorkspaceIdReflectionWorks` 는 `requestContext`/`pathParam`/`total` 세 값을 계산하고 `total === 0` 일 때만 `WorkspaceIdReflectionBrokenError` 를 던지며, 로그 문자열도 README 표현과 그대로 일치한다. `WorkspaceIdReflectionBrokenError` 메시지도 "경로 워크스페이스 라우트의 역할 요구가 헤더·토큰의 워크스페이스로 판정됩니다(cross-tenant)"를 명시해 README 불릿(`@WorkspaceParam(...)` 판별이 깨지면 경로가 아니라 헤더·토큰 워크스페이스로 판정)과 부합한다. 이 fail-closed 캐너리는 `RolesGuard` 의 멤버십 검증 대상 판별이 깨졌을 때 cross-tenant 접근이 조용히 열리는 것을 막는 보안 통제이며, 이번 diff 는 통제의 **동작을 바꾸지 않고 문서만 구현에 맞춰** 정정했다.
  - 제안: 없음(개선 정정).

### 파일 2 — `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
- **[INFO]** 신규 테스트가 실제로 존재하는 인가 재검사(TOCTOU 방어)를 검증함 — 결함을 은폐하지 않는지 프로덕션 코드로 직접 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `transferOwnership()`(약 723~808행), 특히 756~762행의 트랜잭션 내 `requesterMembership` 재조회(`lock: { mode: 'pessimistic_write' }`) 및 `!requesterMembership || requesterMembership.role !== 'owner'` 재검사.
  - 상세: 시나리오는 "무락 인가 선행(731~733행)에서는 owner 로 통과했으나, 트랜잭션 내부에서 락을 잡고 다시 조회하니 이미 강등됐거나(role !== 'owner') 멤버십 자체가 사라진(!requesterMembership)" 동시 강등 경합이다. 이 재검사가 없으면 소유권을 이미 잃은 요청자가 이양을 완료할 수 있는 인가 우회(레이스 컨디션)가 발생한다. 실제 서비스 코드를 읽어 두 단계(무락 선행 + 락 재검사)가 모두 구현돼 있음을 확인했고, 신규 테스트는 `memberRepo.findOne` 을 `opts.lock` 유무로 분기시켜 선행에는 `owner`, 재검사에는 `admin`/`null` 두 상태를 각각 넣어 `OWNER_REQUIRED` 로 거부되고 `memberRepo.save`/`workspaceRepo.save` 가 호출되지 않음을 단언한다. 우회 경로가 아니라 방어 경로를 고정하는 회귀 테스트이며, plan 체크리스트에 기록된 뮤테이션 테스트(재검사가 역할을 안 보게 하면 RED)로 분기가 실제로 실행됨도 별도로 확인된 상태다(테스트 자체 회귀 여부는 이번 리뷰 범위 밖).
  - 제안: 없음. (부가 정보: mock 레벨 unit 테스트이므로 실제 DB 격리수준에서의 동시성은 별도 e2e/integration 검증 대상이나, 서비스 로직 자체가 이번 diff 로 변경되지 않았으므로 새로운 리스크는 아니다.)
- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 상세: 신규 테스트의 `requesterId`, `newOwnerMemberId`, `mem-owner` 등은 모두 mock 식별자 문자열이며 실제 자격증명이 아니다.

### 파일 3~4 — `plan/in-progress/canary-readme-recheck-test.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
- **[INFO]** 보안 관련 소견 없음
  - 상세: plan 추적 문서로 실행 코드·설정값·자격증명을 포함하지 않는다. 하드코딩 시크릿, 인젝션 표면, 인증/인가 로직 변경이 없다.

### 파일 5~26 — `review/code/2026/09/25/20_20_00/*`, `review/consistency/2026/09/25/20_01_21/*`
- **[INFO]** 보안 관련 소견 없음
  - 상세: 이전 라운드 `/ai-review`·`consistency-check` 산출물이 신규 파일로 커밋되는 것뿐이며, 순수 markdown 리포트다. 전체 diff 텍스트를 대상으로 `password|secret|api[_-]?key|token|bearer|private[_-]?key|BEGIN ... PRIVATE KEY|AKIA...` 패턴과 JWT-형(`eyJ...`)·`sk-...` 형 문자열을 grep 했으나, 실제 시크릿 값이 아니라 환경변수 이름(`JWT_SECRET`, `ENCRYPTION_KEY` 등)·spec 파일 경로·설계 논의 문구만 확인됐다. 하드코딩된 시크릿 없음.

## 저장소 뮤테이션 여부

리뷰 과정에서 저장소 파일을 읽기만 했으며(`Read`/`Bash cat`/`grep`), 어떤 파일도 쓰거나 고치지 않았다. `git status --short` 로 확인한 결과 세션 시작 시점부터 있던 `review/code/2026/09/25/20_47_04/`(본 세션 출력 디렉터리) 외에 변경 없음.

## 요약

이번 변경셋은 애플리케이션 실행 코드를 전혀 수정하지 않는다 — README 문서 정정, 기존 인가 로직(트랜잭션 내 owner 재검사)을 고정하는 신규 unit 테스트, plan 추적 문서, 그리고 이전 라운드 리뷰 산출물의 커밋으로만 구성된다. README 정정 내용은 `workspace-reflection-canary.ts` 실제 구현(카운팅 로직·에러 메시지·로그 문구)과 한 줄씩 대조해 정확함을 확인했고, 신규 테스트는 `transferOwnership()` 에 이미 구현된 TOCTOU 방어(무락 선행 인가 + 트랜잭션 내 `pessimistic_write` 락 재검사)가 실제로 존재하며 우회 경로가 아니라 방어 경로를 검증하고 있음을 서비스 코드 직접 열람으로 확인했다. 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 암호화 결함, 에러 메시지 정보 노출, 의존성 취약점 등 어떤 항목에서도 발견사항이 없으며, 오히려 fail-closed 보안 통제의 문서-구현 drift 를 줄이고 그 인가 재검사 분기에 대한 테스트 커버리지를 강화하는 방향의 변경이다.

## 위험도

NONE
