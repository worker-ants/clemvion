# 유지보수성(Maintainability) 리뷰

## 리뷰 스코프 참고

본 리뷰 페이로드는 6개 파일 전체를 "전체 파일 컨텍스트"로 제공했으나, 이 audit-logging 브랜치는 이미 7차례 리뷰·조치를 거친 성숙한 코드베이스다. 직전 리뷰 라운드(`review/code/2026/08/01/13_46_48/`) 이후 실제로 바뀐 부분은 `git diff a952d6616..HEAD -- codebase/`로 확인한 아래 델타뿐이다:

- `audit-action.const.ts`: `AuditActionFor<P>` 제네릭 타입 신설
- `model-config.service.ts` / `schedules.service.ts` / `triggers.service.ts` / `workflows.service.ts`: `recordAudit`의 `action` 파라미터 타입을 `(typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]` → `AuditActionFor<'...'>`로 축소
- `workflows.service.spec.ts`: `duplicate`/`importWorkflow`에 트랜잭션 순서·롤백 대칭 테스트 3건 추가

기존에 이미 검토된 코드(각 서비스의 나머지 로직)는 재론하지 않고, 이번 델타에서 새로 발견된 사항만 아래에 적는다.

### 발견사항

- **[WARNING]** `recordAudit`의 `AuditActionFor<'...'>` 리터럴과 같은 파일의 `*_RESOURCE_TYPE` 상수가 같은 문자열을 두 곳에 따로 하드코딩 — 타입 연결 없이 수동 동기화에 의존
  - 위치:
    - `codebase/backend/src/modules/model-config/model-config.service.ts:31`(`const MODEL_CONFIG_RESOURCE_TYPE = 'model_config';`) ↔ `:245`(`action: AuditActionFor<'model_config'>;`)
    - `codebase/backend/src/modules/schedules/schedules.service.ts:26` ↔ `:147`
    - `codebase/backend/src/modules/triggers/triggers.service.ts:64` ↔ `:215`
    - `codebase/backend/src/modules/workflows/workflows.service.ts:62` ↔ `:180`
  - 상세: 이번 라운드의 취지 자체가 "정합성이 주석으로만 보장되던 것을 타입으로 옮긴다"(`audit-action.const.ts` 신규 JSDoc, 7차 리뷰 architecture 근거)인데, 정작 `recordAudit`의 `AuditActionFor<'model_config'>`와 `resourceType: MODEL_CONFIG_RESOURCE_TYPE`은 여전히 같은 리터럴(`'model_config'`)을 두 군데에 각각 타이핑한 채 컴파일러 차원의 연결이 없다. `MODEL_CONFIG_RESOURCE_TYPE`을 `'model-config'`처럼 오타로 바꾸거나 리소스 타입 어휘를 변경해도, `AuditActionFor<'model_config'>` 쪽은 그대로 컴파일이 통과해 `resourceType`과 action prefix 가 조용히 어긋날 수 있다(4개 파일 모두 동일 패턴).
  - 제안: `AuditActionFor<typeof MODEL_CONFIG_RESOURCE_TYPE>`처럼 제네릭 인자를 로컬 `*_RESOURCE_TYPE` 상수의 `typeof`로 유도하면, 리터럴 재선언 없이 두 값이 항상 같은 소스에서 파생된다(`const` 선언은 리터럴 타입으로 추론되므로 타입 오류 없이 그대로 동작). 4개 서비스 모두 동일하게 적용 가능.

- **[INFO]** `workflows.service.spec.ts`에 "트랜잭션 순서 추적 mock + `finally` 복원" 보일러플레이트가 3회(± 기존 1회 포함 4회) 반복
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` — 이번 diff로 추가된 `트랜잭션이 실패하면 duplicate 는 감사를 남기지 않는다`(766행), `importWorkflow 도 트랜잭션 **커밋 뒤**에 기록한다`(960행), `트랜잭션이 실패하면 importWorkflow 는 감사를 남기지 않는다`(988행). 기존 `create` 짝(844/876행)과 동일 패턴.
  - 상세: `origTx` 백업 → `mockDataSource.transaction` 오버라이드(순서 배열 push) → `try/finally`로 원복하는 15~20줄짜리 골격이 이제 4곳(create/duplicate/importWorkflow 각 order·rollback 쌍)에서 사실상 복붙됐다. 서비스 메서드별 트랜잭션 호출 시그니처가 미묘하게 달라(`create`는 `(cb)`, `duplicate`/`importWorkflow`는 `('REPEATABLE READ' 또는 콜백, cb?)`) 완전 동일하진 않지만, "순서 추적 + 원복" 골격 자체는 파라미터화 가능한 수준으로 동일하다.
  - 제안: `mockOrderedTransaction(mockDataSource, order, { supportsIsolationArg })` / `mockFailingTransaction(mockDataSource, error)` 같은 로컬 테스트 헬퍼로 추출하면 향후 5번째 CRUD 메서드(예: 신규 서비스)에 같은 대칭 테스트를 추가할 때 반복이 더 늘지 않는다. 다만 이 프로젝트는 뮤테이션 커버리지 관점에서 테스트 본문의 명시성을 의도적으로 우선하는 선례가 있어(코드 리뷰 안내상 각 사이트별 명시적 fixture 선호), Critical/Warning 급은 아니고 정보성으로만 남긴다.

### 긍정적 변경 (참고)

- `AuditActionFor<P extends string> = Extract<AuditAction, \`${P}.${string}\`>` 도입은 4개 서비스 파일에서 반복되던 장황한 `(typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]` 인덱스 타입 표현을 하나의 재사용 가능한 제네릭으로 대체해 가독성·DRY 모두 개선했다. 각 `recordAudit`의 타입 시그니처가 "이 서비스는 자기 리소스 prefix action만 받는다"는 의도를 자체 문서화하게 된 것도 유지보수성 측면에서 유효한 개선.
- import 정리(`AUDIT_ACTIONS, AuditActionFor`)와 스타일이 4개 파일 모두 동일한 형태로 일관되게 적용됨.

## 요약

이번 델타는 범위가 작고 대부분 긍정적인 리팩터링(제네릭 타입으로 중복 제거)과 테스트 보강으로 구성돼 있어 유지보수성 관점에서 심각한 문제는 없다. 다만 새로 도입한 `AuditActionFor<'...'>` 프리픽스 리터럴이 같은 파일의 `*_RESOURCE_TYPE` 상수와 문자열로만 묶여 있어(타입 연결 부재), 이번 라운드가 스스로 표방한 "주석 대신 타입으로 정합성 보장" 원칙을 한 단계 더 밀어붙이지 못한 지점이 4개 파일에 반복 존재한다(WARNING). 신규 테스트 3건은 순서·롤백 대칭을 꼼꼼히 검증하지만 보일러플레이트 복붙이 누적되고 있어(INFO), 향후 대상이 늘어나면 헬퍼 추출을 고려할 만하다.

## 위험도

LOW
