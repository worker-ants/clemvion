# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 변경셋(`git diff --stat origin/main...HEAD`)은 애플리케이션 소스 코드(`.ts` 서비스/컨트롤러/데코레이터 로직)를 전혀 수정하지 않는다. 실제 변경은 다음 세 종류뿐이다.

1. `codebase/backend/README.md` — 워크스페이스 reflection 캐너리 절의 문서 정정(운영자 문서, 동작 변경 없음)
2. `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `transferOwnership()` 의 기존 TOCTOU 방어(무락 인가 선행 → 트랜잭션 안 락 재검사) 분기를 고정하는 신규 unit 테스트 1건 추가
3. `plan/in-progress/canary-readme-recheck-test.md`, `review/consistency/2026/09/25/20_01_21/*` — plan·consistency-check 산출물(순수 메타 문서)

## 발견사항

### 파일 1 — `codebase/backend/README.md`
- **[INFO]** 문서 정정 내용이 실제 구현과 일치함을 확인
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (`assertWorkspaceIdReflectionWorks`, `countWorkspaceConsumingRoutes`) — README 자체는 문서 파일이라 게이트 인용 대상 아님
  - 상세: README 신규 문구가 주장하는 "`@WorkspaceId()`(헤더·토큰)와 `@WorkspaceParam(...)`(경로) 두 판별의 **합계**가 0일 때만 부팅 거부", "두 개수를 각각 부팅 로그에 남김(`@WorkspaceId() 소비 라우트 N건 인식 · @WorkspaceParam() 소비 라우트 M건 인식`)" 을 실제 소스로 대조했다. `assertWorkspaceIdReflectionWorks` 는 `total === 0` 일 때만 `WorkspaceIdReflectionBrokenError` 를 던지고, `logger.log` 문구도 README 와 글자 그대로 일치한다. 부분 파손(한쪽 판별만 깨진 경우)은 이 단언이 못 잡는다는 한계도 README·소스 주석 양쪽에 동일하게 명시돼 있다. 이 fail-closed 캐너리는 `RolesGuard` 의 멤버십 검증 대상 판별이 깨졌을 때 cross-tenant 접근이 조용히 열리는 것을 막는 보안 통제이며, 이번 diff 는 그 통제의 **동작을 바꾸지 않고 문서만 실제 구현을 정확히 반영**하도록 고쳤다. 보안 관점에서 리스크 없음, 오히려 문서-구현 drift 를 줄여 운영자가 "부분 파손 신호(개수 급락)를 봐야 한다"는 사실을 놓치지 않게 한다.
  - 제안: 없음(개선 정정).

### 파일 2 — `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
- **[INFO]** 신규 테스트가 실제로 존재하는 TOCTOU 방어를 검증함(테스트가 결함을 은폐하지 않는지 실측)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `transferOwnership()` 함수 (트랜잭션 내부 `requesterMembership.role !== 'owner'` 재검사 분기)
  - 상세: 테스트가 고정하는 시나리오는 "무락 인가 선행에서는 owner 로 통과했지만, 그 사이 다른 이양으로 강등되어 트랜잭션 안 `pessimistic_write` 락 재조회 시점에는 owner 가 아닌" 동시성 경합이다. 실제 서비스 코드를 직접 확인한 결과, `transferOwnership()` 은 (1) 트랜잭션 밖 무락 선행 검사, (2) 트랜잭션 안에서 워크스페이스·요청자 멤버십 모두 `lock: { mode: 'pessimistic_write' }` 로 재조회 후 `requesterMembership.role !== 'owner'` 를 다시 검사 — 두 단계 모두 실제로 구현돼 있다. 이 방어가 없으면 소유권을 이미 잃은 요청자가 두 번째 이양을 완료할 수 있는 권한 상승/인가 우회(레이스 컨디션) 취약점이 생긴다. 신규 테스트는 `memberRepo.findOne` 을 `opts.lock` 유무로 분기시켜 선행에는 `owner`, 재검사에는 `admin` 을 반환하도록 만들고, 결과가 `OWNER_REQUIRED` 로 거부되며 `memberRepo.save`/`workspaceRepo.save` 가 호출되지 않았음을 단언한다 — 우회 경로가 아니라 방어 경로를 고정하는 회귀 테스트로, 보안 커버리지를 강화하는 방향이다.
  - 제안: 없음. (부가: 이 테스트가 mock 레벨 unit 테스트이므로 실제 DB 트랜잭션 격리 수준에서의 경합은 e2e/integration 계층에서 별도로 검증돼야 하나, 이는 이번 diff 범위 밖이며 plan 상 기존 서비스 로직도 변경되지 않았으므로 새로운 리스크는 아니다.)
- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 상세: 테스트 fixture 의 `requesterId = 'user-owner'`, `newOwnerMemberId = 'mem-new-owner'` 등은 모두 목(mock) 식별자 문자열이며 실제 자격증명이 아니다.

### 파일 3~9 — `plan/in-progress/canary-readme-recheck-test.md`, `review/consistency/2026/09/25/20_01_21/*`
- **[INFO]** 보안 관련 소견 없음
  - 상세: plan 문서와 consistency-check 산출물(SUMMARY·convention_compliance·cross_spec·naming_collision·plan_coherence·rationale_continuity)은 프로세스/거버넌스 메타데이터이며 실행 코드나 설정값을 포함하지 않는다. 하드코딩된 시크릿, 인증/인가 로직, 인젝션 표면이 존재하지 않는다.

## 요약

이번 변경셋은 애플리케이션 코드를 전혀 건드리지 않는 문서 정정(README) + 기존 인가 로직(트랜잭션 내 owner 재검사)을 고정하는 신규 unit 테스트 + plan/consistency-check 메타 산출물로 구성된다. README 정정 내용은 실제 `workspace-reflection-canary.ts` 구현과 대조 확인했고 정확하다. 신규 테스트는 `transferOwnership()` 에 이미 존재하는 TOCTOU(동시 강등) 방어 분기를 검증하는 것으로, 실제 서비스 코드에서 해당 방어(트랜잭션 안 `pessimistic_write` 락 + 역할 재검사)가 구현돼 있음을 직접 확인했다. 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 암호화 결함, 에러 메시지 정보 노출, 의존성 취약점 등 어떤 항목에서도 발견사항이 없다. 저장소 뮤테이션은 수행하지 않았다(읽기 전용 확인만 수행, `git status --short` 로 워킹트리 무변경 확인 불필요 — 어떤 파일도 쓰거나 고치지 않음).

## 위험도

NONE
