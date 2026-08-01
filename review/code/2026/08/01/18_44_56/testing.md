STATUS=success testing review complete — 0 WARNING, 1 INFO, 0 CRITICAL
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — audit-logging (8차, `c4eddd918` 조치분 검증)

## 컨텍스트

이번 라운드의 실제 diff(`git diff a952d6616..HEAD`)는 7차 리뷰(`review/code/2026/08/01/13_46_48`)의
architecture WARNING(`action` 타입이 34개 전체 union — 도메인 미한정)과 testing WARNING
(`WorkflowsService.duplicate`/`importWorkflow` 에 커밋-후-순서/롤백-미기록 회귀 테스트 부재)에 대한
조치분이다. 6개 파일 리뷰 대상 중 실질 변경은:

1. `audit-action.const.ts` — `AuditActionFor<P>` template-literal `Extract` 타입 신설.
2. `model-config.service.ts`/`schedules.service.ts`/`triggers.service.ts`/`workflows.service.ts` —
   각 `recordAudit` 의 `action` 파라미터 타입을 `AuditActionFor<'<resource>'>` 로 좁힘 (import 문 +
   타입 애너테이션 1줄씩, 런타임 로직 변경 없음).
3. `workflows.service.spec.ts` — `duplicate`/`importWorkflow` 에 순서·롤백 테스트 3건 추가.

아래는 이 델타에 대한 실측 결과다.

## 검증 내역 (실측)

- `npx jest src/modules/workflows/workflows.service.spec.ts` → 90/90 통과.
- `npx jest .../model-config.service.spec.ts .../schedules.service.spec.ts .../triggers.service.spec.ts`
  → 144 통과 + 1 skip (타입 파라미터만 바뀌고 런타임 로직 무변경이므로 회귀 없음, 예상대로).
- **뮤턴트 검증** — 신규 3개 테스트가 실제로 방어하는지 소스를 직접 mutate 해 확인(주장을 액면으로
  받지 않음, 확인 후 원복·`git status` clean 확인):
  - `duplicate` 의 `recordAudit` 호출을 트랜잭션 콜백 안(`return savedCopy` 직전)으로 이동 →
    `'트랜잭션이 실패하면 duplicate 는 감사를 남기지 않는다'` RED (`expect(...).not.toHaveBeenCalled()`
    실패, 1회 호출 관측).
  - `importWorkflow` 의 `recordAudit` 호출을 트랜잭션 콜백 안으로 이동 → 순서 테스트
    (`['tx-start','tx-commit','audit']` 기대 vs `['tx-start','audit','tx-commit']` 관측)와 롤백
    테스트 **둘 다** RED.
  - 원복 후 90/90 재통과, `git status` 로 소스 트리 clean 확인.
- **타입 제약 검증** — `AuditActionFor<'workflow'>` 에 `AUDIT_ACTIONS.TRIGGER_DELETED` 대입을
  `@ts-expect-error` 로 감싼 스크래치 파일을 `src/` 안에 두고 `tsc --noEmit -p tsconfig.json` 실행 →
  해당 줄에 대해 diagnostic 이 없음(= 기대한 타입 에러가 실제로 발생) 확인, 스크래치 파일 삭제·
  `git status` clean 재확인. 7차 리뷰 SUMMARY 의 "교차-도메인 대입 3종 전부 tsc RED" 주장이 유효함을
  독립적으로 재현.
  - 참고: `nest build`(`tsconfig.build.json`, `**/*spec.ts` 제외)가 PROJECT.md 기준 필수 게이트라
    프로덕션 코드에서의 오용은 CI 빌드 실패로 실제 차단된다. (`tsc --noEmit -p tsconfig.json` 를
    스펙 파일까지 포함해 전체 실행하면 이 PR 과 무관한 `carousel`/`chart`/`table` 프리젠테이션 노드
    spec 파일들의 기존 타입 에러 319건이 나오는데, 전부 diff 밖 파일이라 이번 리뷰 범위 밖으로 판단.)

## 발견사항

- **[INFO]** 신규 `AuditActionFor<P>` 타입 제약 자체에 대한 커밋된 회귀 테스트가 없다 — 검증이
  1회성 수작업(`tsc` 실행 후 결과 확인, SUMMARY 문서에만 기록)으로 끝나 있다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`AuditActionFor` 타입
    정의부, `export type AuditActionFor<P extends string> = Extract<...>` 선언 직후)
  - 상세: `nest build` 가 프로덕션 코드 오용은 실제로 막아주므로(위 실측으로 확인) 즉시 위험한 갭은
    아니다. 다만 이 타입 제약이 존재한다는 사실과 "왜 필요한가"(resourceType/action prefix 불일치
    방지)를 코드베이스 안에서 실행 가능한 형태로 증명하는 것은 주석뿐이다 — 향후 누군가
    `AuditActionFor<P>` 정의를 `AuditAction`(전체 union)으로 되돌리거나 `Extract` 대신
    `${P}${string}`(dot 누락) 같은 미세한 오타로 완화해도, 어떤 테스트도 실행 시점에 이를 알려주지
    않는다(빌드가 통과하는 조용한 퇴행). 이 프로젝트가 이미 다른 타입 불변식에는
    `typescript-toolchain.test.ts` 류의 실행형 가드를 두는 선례가 있다(PROJECT.md 참조).
  - 제안: 각 서비스의 `*.service.spec.ts` 어딘가에 아래와 같은 컴파일-타임 전용 가드(런타임
    비용 0, `it()` 블록 없이 파일 최상단 type-only 구문으로 충분)를 1곳(예: `audit-action.const.ts`
    옆에 `audit-action.const.type-test.ts` 또는 기존 `workflows.service.spec.ts` 상단)에 추가:
    `// @ts-expect-error cross-domain action must be rejected` +
    `const _t: AuditActionFor<'workflow'> = AUDIT_ACTIONS.TRIGGER_DELETED;`. 선택적 — 현재도
    `nest build` 게이트가 실질적 방어선이므로 필수 조치는 아니다.

## 회귀 확인

- 7차 리뷰 testing WARNING(`duplicate`/`importWorkflow` 순서·롤백 테스트 부재)은 **완전히 해소**
  — 3건 모두 추가됐고 실제로 대상 뮤턴트(감사 기록을 트랜잭션 콜백 안으로 이동)를 개별적으로
  포착함을 직접 재현했다.
- 7차 리뷰의 나머지 INFO 2건(`SchedulesService.update` 의 `isActive=false` 분기 순서 테스트 부재,
  `ModelConfigService` 비-트랜잭션 경로 저장-실패-시-미기록 테스트 부재)은 이번 델타에 포함되지
  않았다 — 직전 라운드에서 "선택적·낮은 우선순위" 로 명시적으로 분류된 항목이라 재조치 누락이
  아니라 의도된 defer 로 판단, 재플래그하지 않는다.
- `AuditActionFor` 타입 축소는 4개 서비스의 `recordAudit` 시그니처만 바꾸고 런타임 분기·호출 인자를
  건드리지 않아, 기존 리터럴 값 단언 테스트(`expect(auditLogs.record).toHaveBeenCalledWith({action:
  'schedule.created', ...})` 류) 144건 전부가 무수정으로 계속 유효함을 확인했다(위 jest 실행 결과).

## 요약

이번 라운드의 실제 변경 폭은 작다 — 타입 좁히기(런타임 무영향) + `duplicate`/`importWorkflow` 순서·
롤백 테스트 3건. 3개 신규 테스트는 직접 소스를 mutate 해 개별적으로 RED 가 됨을 재현했고(vacuous
아님), 타입 제약도 `@ts-expect-error` 스크래치 검증으로 실제 작동을 재확인했다. 유일한 잔여 갭은
새 타입 제약 자체를 지키는 실행형 회귀 테스트가 코드베이스에 없다는 점인데, `nest build` 가 이미
실질적 방어선 역할을 하고 있어 낮은 우선순위의 INFO 로 그친다. 4개 모듈(workflow/trigger/schedule/
model_config) 전반의 감사 로깅 테스트 커버리지는 7차에 걸친 누적 조치로 이미 매우 성숙한 상태다.

## 위험도
NONE
