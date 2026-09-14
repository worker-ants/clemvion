# 요구사항(Requirement) 리뷰 — trigger-canary-hardening (라운드 3 대상)

## 검토 방법

`plan/in-progress/trigger-canary-hardening.md` 가 선언한 4개 항목(① 트리거 비밀 컬럼 3중 사본
repo-guard, ② `TriggerDto.workflow`(schedule) 양성 커버리지, ③ 캐너리 두 파일 주석 정리, ④ e2e
teardown 근거 정정)을 기준으로 실제 코드(파일 1~6)를 직접 `Read`/`Grep`/`npx jest` 로 대조했다.
나머지 파일(7~27+)은 이전 라운드(`11_27_40`·`11_52_13`)의 리뷰·컨시스턴시 산출물과 plan 트래커
갱신이라, 그 안에 적힌 "고쳤다"는 주장이 현재 코드에 실제로 반영됐는지를 실측으로 재검증했다
(문서만 읽고 신뢰하지 않음).

## 발견사항

- **[INFO]** `trigger-secret-columns-guard.ts`/`trigger-secret-columns.spec.ts` 는 기능적으로
  완전하다 — 직접 실행으로 확인.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`,
    `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`
  - 상세: `npx jest src/repo-guards/__tests__/trigger-secret-columns.spec.ts` 를 직접 실행해
    **10/10 GREEN** 확인(plan 의 "가드 스위트 9→10" 주장과 일치 — 라운드 2 에서 `existsSync`
    방어 분기용 메시지-매칭 테스트가 추가돼 9→10 이 됨). 라운드 1 WARNING(vacuous 삼항식)·
    라운드 2 WARNING(방어 분기가 영속 테스트로 묶이지 않음) 둘 다 현재 소스에서 실제로
    수정된 형태로 존재함을 직접 `Read` 로 확인했다(`if (value === null) throw`,
    `expect(...).toThrow(/옮겨졌거나 이름이 바뀌었다/)`). 라운드 2 maintainability INFO(불필요한
    중첩 템플릿 리터럴 `${'…'}`)도 현재 소스엔 남아 있지 않다 — 이미 정리됨.
  - 정본·사본 3곳(`triggers.service.ts:104-107`, `schedule-trigger-ref.ts:24-27`,
    `trigger-workflow-ref.ts:45-48`)의 상수명·값·순서가 실제로 일치함을 직접 `grep` 으로 대조.
  - 반환값 계약(`null` = 못 읽음, `[]` = 빈 목록)이 10개 테스트 케이스(선언 없음·빈 배열·
    문자열 아닌 원소·파일 부재)로 각각 개별 검증되어 "모든 경로에서 적절한 값을 반환하는지"
    기준을 충족한다.

- **[INFO]** `expectTriggerWorkflowRef` 신규 호출 3곳(`schedule-trigger.e2e-spec.ts` C-2·G·H)이
  헬퍼 계약과 실제로 부합함을 헬퍼 소스로 대조.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (게이트 270~280, 388~396,
    424~433) / `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` (`expectTriggerWorkflowRef`)
  - 상세: 헬퍼 JSDoc 이 "목록(`findAll` join)·단건·수정(`findById` 로 시작)은 채운다, 생성만
    `false`" 라고 명시하는데, 이번에 단언이 추가된 세 케이스(목록 조회, PATCH `isActive:false`,
    PATCH `isActive:true`)가 정확히 그 계약이 보장하는 경로에만 `present: true` 로 걸려 있다 —
    계약과 테스트 케이스 선택이 어긋나지 않는다. `expectedWorkflowId` 를 함께 넘겨 shape 뿐
    아니라 identity 까지 고정하는 것도 헬퍼 JSDoc 이 요구하는 사용법과 일치한다. 자체
    `npx jest src/shared/testing/trigger-workflow-ref.spec.ts` 실행으로 헬퍼 self-spec
    **12/12 GREEN** 도 확인(plan 의 "self-spec 12/12" 주장과 일치).

- **[SPEC-DRIFT]** `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 가 §3
  `TriggerDto.workflow` 계약의 새 시행 파일(`schedule-trigger.e2e-spec.ts`)을 아직 등재하지
  않았다 — 단, 이미 정확히 식별되어 planner 트래커에 등재돼 있어 **조치 불요**로 판단.
  - 위치: `spec/2-navigation/2-trigger-list.md:6-27` (frontmatter `code:` 리스트, 현재
    `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 와
    `shared/testing/trigger-workflow-ref*.ts` 만 등재)
  - 상세: 코드(`schedule-trigger.e2e-spec.ts`)는 §3 註가 이미 서술한 `TriggerDto.workflow`
    계약을 schedule 타입 표면에 대해 **처음** 시행하는 것이라 코드 자체는 spec 위반이
    아니다(오히려 §3 註가 요구하는 보장을 넓힌다) — 다만 spec 문서의 추적성 메타데이터
    (`code:`)가 이 새 시행 파일을 아직 반영하지 못해 doc-sync 관점에서 어긋난다. 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(`- [ ] "2-trigger-list.md" 의
    code: 가 §3 계약의 시행 파일 하나를 놓친다`, planner 소유로 등재, 2026-09-14)에 정확히
    같은 항목으로 등재돼 있음을 확인했다. `spec/` 편집은 developer 권한 밖이라는 프로젝트
    경계를 정확히 지킨 처리이며, 라운드 1·2 리뷰(requirement WARNING#1)에서도 이미 지적·
    등재 완료됐다.
  - 제안: 코드 수정 불필요. spec 반영은 `project-planner` 가 `2-trigger-list.md` frontmatter
    `code:` 에 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 한 줄을 추가하는 것으로 처리
    (이미 트래커에 대기 중).

- **[INFO]** `spec/conventions/secret-store.md` 문서 자체 내부 불일치(§R4 `delete()` vs §2.1
  근방 `remove()`) — 이번 PR 이 만든 결함이 아니라 이번 PR 의 새 주석이 §R4 를 처음 명시
  인용하면서 가시화된 기존 spec 오기. 이미 planner 항목으로 등재돼 조치 불요.
  - 위치: `spec/conventions/secret-store.md:428`(§R4, `TriggersService.delete()`) vs
    `spec/conventions/secret-store.md:390`(`TriggersService.remove()`) — 실제 코드는
    `codebase/backend/src/modules/triggers/triggers.service.ts:842`의 `remove()` 가 유일하게
    존재하는 메서드임을 확인(`delete()` 라는 이름의 메서드는 없음).
  - 상세: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 의 개정된 JSDoc(게이트
    164~167)이 "`remove()` → `deleteByPrefix` 는 R4 대로 동작한다"고 정확한 메서드명을
    쓰고 있어 코드 쪽 서술은 옳다. 문제는 spec 문서 자체의 §R4 본문이다.
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미
    "`secret-store.md §R4` 가 `TriggersService.delete()` 라 쓰는데 실제는 `remove()`" 항목으로
    등재돼 있음을 확인했다.
  - 제안: 코드 수정 불필요. spec 반영은 planner 가 §R4 의 `delete()` → `remove()` 한 단어
    정정.

- **[INFO]** plan 문서의 정량적 주장("9자리", "총 매치 줄 13" 등)을 재실측 — 일치.
  - 위치: `plan/in-progress/trigger-canary-hardening.md:172-179`
  - 상세: `grep -n '가드 [0-9]' codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`
    를 직접 실행해 총 매치 13줄(`## 가드` 케이스 헤딩 3 · `// ── 가드` 구획 주석 7 · 산문 언급
    3)을 확인했고, plan 이 재실측해 적은 표(라운드 1 documentation INFO#4 가 지적한 뒤 정정된
    값)와 정확히 일치한다. "9자리" 라는 종전 오기를 스스로 반증하고 근거와 함께 정정한 것도
    실측으로 확인됨.

## 검증한 사항 (문제 없음)

- 신규 repo-guard 스위트 10/10 GREEN, 헬퍼 self-spec 12/12 GREEN — 직접 실행 확인(문서 주장을
  신뢰하지 않고 재현).
- `readStringArrayConst`/`readAllTriggerSecretColumnLists` 반환값 계약(`null` vs `[]`)이 모든
  분기(선언 없음·파일 없음·문자열 아닌 원소·정상값)에서 명시적으로 다른 값을 반환하며 테스트로
  개별 고정됨 — "모든 경로에서 적절한 값을 반환하는지" 기준 충족.
- 정본·사본 3곳의 비밀 컬럼 목록이 실제로 일치함(값·순서)을 직접 소스 대조로 확인.
- `expectTriggerWorkflowRef` 3개 신규 호출 지점이 헬퍼 JSDoc 이 규정하는 "이 경로는 채운다"
  계약과 정확히 일치하는 케이스에만 배치됨.
- TODO/FIXME/HACK/XXX 주석 없음(diff 전체 grep 결과 0건).
- 저장소 뮤테이션 없음 — 세션 종료 시 `git status --short` 로 확인(내가 실행한 `npx jest` 는
  파일을 쓰지 않았고, 남은 untracked 항목 2건은 세션 시작 전부터 있던 이번 라운드 자신의
  리뷰/컨시스턴시 산출물 디렉터리다).

## 요약

핵심 코드 변경 6개 파일은 계획서가 선언한 4개 항목 각각에 정확히 대응하며, 라운드 1·2 에서
지적된 CRITICAL 은 없었고 두 WARNING(vacuous 삼항식, 방어 분기 미영속화)은 현재 소스에서 실제로
수정된 상태임을 코드 열람과 테스트 실행(10/10, 12/12 GREEN)으로 직접 재확인했다. 신규 가드의
반환값 계약·엣지 케이스(빈 배열/못 읽음/파일 부재/비문자열 원소)가 각각 개별 테스트로 고정돼
있고, 신규 e2e 단언 3곳도 헬퍼가 문서화한 계약과 정확히 일치하는 경로에만 배치됐다. 남은
spec-fidelity 관점 항목 둘(`2-trigger-list.md` `code:` 등재 누락, `secret-store.md §R4` 의
`delete()`/`remove()` 오기)은 모두 코드가 틀린 것이 아니라 spec 메타데이터/본문이 뒤처진
것이며, 이미 정확한 내용으로 planner 소유 트래커에 등재돼 있어 이번 라운드에서 추가 조치가
필요 없다. 새로운 CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE
