# 요구사항(Requirement) 충족 리뷰 — canary-readme-recheck-test

## 검토 범위

- `codebase/backend/README.md` — 워크스페이스 reflection 캐너리 절 정정 (`#1399` 이후 반영)
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `transferOwnership` 트랜잭션 안 재검사 분기 unit 테스트 신규 추가
- `plan/in-progress/canary-readme-recheck-test.md`, `review/consistency/2026/09/25/20_01_21/*` — 작업 plan 및 선행 `--impl-prep` consistency-check 산출물(프로세스 문서)

실제 구현 대조를 위해 `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`, `workspace.decorator.ts`, `codebase/backend/src/modules/workspaces/workspaces.service.ts`(`transferOwnership`, `throwOwnerTransferRequired`, `getMemberRole`), `codebase/backend/src/common/constants/workspace-roles.ts`(`ROLE_REQUIRED`), `spec/data-flow/12-workspace.md` §Rationale, `CHANGELOG.md` 상단 판정 기준을 직접 Read 했다. 저장소 파일은 뮤테이션하지 않았다(`git status --short` 로 조회 전용 확인).

## 발견사항

### README.md — spec/구현 fidelity: 정합 확인 (문제 없음, 참고 기록)

diff 각 줄을 실제 구현과 1:1 대조했다.

- "`@WorkspaceId()`(헤더 · 토큰 컨텍스트)와 `@WorkspaceParam(...)`(경로로 받는 워크스페이스) — 를 합쳐 하나도 인식하지 못하면 부팅을 거부합니다" ↔ `workspace-reflection-canary.ts:149` `if (total === 0) throw new WorkspaceIdReflectionBrokenError();` (`total` 은 `requestContext`/`pathParam` 중 하나라도 소비하면 1회만 카운트 — README의 "합쳐" 표현과 일치)
- "판별이 깨지면 `@Roles()` 없는 워크스페이스 라우트는 멤버십 검증을 조용히 건너뛰고, 경로 워크스페이스 라우트는 역할 요구가 경로가 아니라 헤더 · 토큰의 워크스페이스로 판정됩니다" ↔ `WorkspaceIdReflectionBrokenError` 생성자 메시지(동 파일 66-78행)와 문구 수준으로 일치
- "인식한 라우트 수가 두 판별 따로 부팅 로그에 남습니다 — `@WorkspaceId() 소비 라우트 N건 인식 · @WorkspaceParam() 소비 라우트 M건 인식`" ↔ 동 파일 152-155행 `logger.log(...)` 포맷 문자열과 정확히 일치
- "캐너리는 합계 0건만 잡으므로" ↔ `total === 0` (부분집합이 아닌 합산 판정) 일치
- "먼저 볼 곳: `handlerConsumesWorkspaceId` · `workspaceParamNamesOf`(둘은 같은 조회 골격을 공유합니다)" ↔ `workspace.decorator.ts` 의 `routeArgEntriesMatching` 공통 헬퍼(64-80행)를 두 판별 함수(95-107행, 149-160행)가 공유하는 구조와 일치

결론: README 변경은 코드와 line-level 로 정합한다. CRITICAL/WARNING 없음.

### workspaces.service.spec.ts — 신규 재검사 분기 테스트: 구현·spec 과 정합

- 신규 테스트가 대상으로 하는 분기는 `workspaces.service.ts:731-762` — 트랜잭션 밖 무락 `getMemberRole` 선행 판정(731-733행) 후, 트랜잭션 안에서 동일 요청자를 `pessimistic_write` 락으로 재조회(756-759행)해 다시 `role !== 'owner'` 를 검사(760-762행)하는 구조와 정확히 대응한다.
- mock 구현(`opts.lock ? 'admin' : 'owner'`)은 실제 호출 시퀀스(선행 무락 1회 → 트랜잭션 재검사 락 1회, 이후 대상 멤버 조회 전에 throw)와 맞아떨어져, 테스트가 실제로 재검사 분기를 통과하도록 뮤테이션 포인트를 정확히 짚는다.
- 기대값(`code: 'OWNER_REQUIRED'`, `message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.'`)은 `throwOwnerTransferRequired()`(`workspaces.service.ts:939-944`, `ROLE_REQUIRED.owner.code === 'OWNER_REQUIRED'` from `workspace-roles.ts:63`)와 정확히 일치.
- `memberRepo.save`/`workspaceRepo.save` 미호출 단언은 구현상 이 분기가 대상 멤버 조회·역할 갱신에 도달하기 전에 throw 하므로 타당하다.
- spec 근거: `spec/data-flow/12-workspace.md:392` "트랜잭션 안에서 락을 잡고 재검사하는 자리(`leaveWorkspace` · `transferOwnership`)는 그 재검사를 남기고, 앞에 무락 인가 선행을 둔다" — 신규 테스트가 고정하려는 동작과 정확히 일치하며, 이 spec 문장이 이미 존재함에도 그 재검사 분기를 지키는 테스트가 없었다는 plan 의 자체 진단(리뷰 INFO 8)도 타당하다.
- 동작 변경 없음(`workspaces.service.ts` 는 이번 diff에 포함되지 않음, `spec_impact: none`)과 실제로 부합 — 커버리지 추가일 뿐 로직 변경이 아니다.

TODO/FIXME/HACK/XXX 등 미완성 마커는 diff 전체(`git show 6aeb57a1a`)에서 검출되지 않음.

### CHANGELOG 무항목 판정 — 근거 확인됨

plan 체크리스트의 "CHANGELOG 항목 없음" 판정은 `CHANGELOG.md` 상단 명시 기준("항목을 내지 않는다 — … 한 기능의 동작을 고정하는 테스트 추가(가드가 아닌 커버리지) · … 문서 · spec · plan · 리뷰 산출물만의 변경")과 문구까지 정확히 일치한다. 근거 없는 자체 판정이 아니라 governance 문서 인용이 정확하다.

### [INFO] plan 파일 diff 스냅샷이 현재 저장소 상태보다 오래됨(하니스 갭, 코드 결함 아님)

- 위치: `plan/in-progress/canary-readme-recheck-test.md` 체크리스트 "TEST WORKFLOW" 항목
- 상세: 본 리뷰 프롬프트에 실린 파일 3(`plan/in-progress/canary-readme-recheck-test.md`)의 unified diff 는 `- [ ] TEST WORKFLOW — lint · unit · build · e2e` 로 미체크 상태를 보여주나, 실제로 디스크에 있는 현재 파일과 `git log`(`c7dd3ef1d docs(plan): TEST WORKFLOW 통과 — e2e 71 스위트 · 391건`)을 확인한 결과 이미 `- [x] TEST WORKFLOW — lint · unit(backend 10059) · build · e2e(71 스위트 · 391건 PASS)` 로 갱신되어 있다. 리뷰 입력(diff 번들)이 최신 커밋보다 앞선 스냅샷을 기준으로 생성된 것으로 보인다.
- 이는 developer 작업의 결함이 아니라 리뷰 하니스의 diff-base 시점 문제로 판단된다(과거 memory 항목 "리뷰 diff base: stale 로컬 main"과 유사한 형태이나 이번엔 plan-only 파일이라 실질적 영향은 없음 — 코드 스코프(`codebase/**`) freshness 는 저촉되지 않는다).
- 제안: 코드 수정 불필요. 리뷰 종결 판정에는 영향 없음(해당 항목은 plan 문서일 뿐 제품 코드가 아니며, 실제 파일은 이미 최신 상태).

## 요약

이번 작업은 스코프가 명확히 좁혀진(`spec_impact: none`) README 문서 정정 1건과 unit 테스트 1건 추가다. README 정정은 `workspace-reflection-canary.ts`/`workspace.decorator.ts` 실제 구현과 문장 단위로 대조했을 때 완전히 정합하며, 신규 테스트는 `transferOwnership`의 트랜잭션 안 재검사 분기(무락 선행 owner 통과 → 락 재검사 시 강등 발견 → `OWNER_REQUIRED`, 멤버 미변경)를 실제 서비스 코드 흐름·에러 코드·메시지까지 정확히 고정하며 `spec/data-flow/12-workspace.md` §Rationale 이 이미 명문화한 동작과 일치한다. CHANGELOG 무항목 판정도 저장소 자체 기준과 부합한다. TODO/FIXME 등 미완성 마커 없음, 모든 에러 경로에서 적절한 예외/코드가 반환되며 반환값 누락 없음. 유일한 관찰 사항은 plan 파일 diff 스냅샷이 최신 커밋보다 뒤처진 하니스 상의 시점 문제로, 실제 코드 결함이 아니다.

## 위험도

NONE
