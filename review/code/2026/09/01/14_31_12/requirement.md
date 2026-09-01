# 요구사항(Requirement) 리뷰

## 검증 방법

저장소 트리는 건드리지 않았다 (읽기 전용 `Read`/`Grep`/`tsc --noEmit`/`jest` 만 수행). `git status --short` 로
확인한 결과 리뷰 산출물 디렉터리(`review/code/2026/09/01/14_31_12/`) 외에 변경 없음.

- `npx tsc -p tsconfig.build.json --noEmit` — 0 에러 (프로덕션 빌드 대상: `audit-logs.service.ts`,
  `auth-configs.service.ts`, `business-metrics.service.ts` 포함, `src/repo-guards/**` 는 제외 대상).
- `npx tsc -p tsconfig.json --noEmit` — 이 diff 가 건드린 파일(`audit-logs.service*`, `business-metrics.service*`,
  `audit-action-binding*`)에는 0 에러. 다른 무관 파일(carousel/table/chart 노드 spec, ai-agent 등)에 다수의
  사전 존재 에러가 있으나 diff 범위 밖이라 본 리뷰와 무관.
- `npx jest audit-logs.spec.ts audit-action-binding.spec.ts business-metrics.service.spec.ts` — 3 suites,
  28 tests 전부 통과.
- `npx jest auth-configs.service.spec.ts` — 46 tests 전부 통과 (recordAudit 타입 변경 후에도 회귀 없음).
- `resourceType` 실측 12종(전수 grep: workflow/user/trigger/schedule/member/workspace_invitation/workspace/
  alert_rule/integration/model_config/auth_config/execution) — `business-metrics.service.ts` 주석의
  "실측 12종" 서술과 정확히 일치.

## 발견사항

- **[WARNING] [SPEC-DRIFT]** 신규 메트릭 `clemvion.audit.write_failed` 가 NF-OB-07 메트릭 카탈로그와
  `data-flow` 두 문서에 반영되지 않았다.
  - 위치: `spec/5-system/_product-overview.md:75` (NF-OB-07 요약 행 — "워크플로 실행·큐·LLM·노드 지연·Redis
    fail-open 강등" 목록에 감사 실패가 없음), `spec/5-system/_product-overview.md:79-87` (카탈로그 표 —
    `clemvion.redis.fail_open` 행까지만 있고 새 메트릭 행이 없음), `spec/data-flow/9-observability.md:202-206`
    (동일 카탈로그를 미러하는 불릿 목록에도 누락), `spec/data-flow/1-audit.md:21-23` ("두 record 모두
    실패를 삼킨다... 실패는 로그로만 남는다" — 이제 audit_log 쪽은 로그 + 카운터 두 경로가 됐는데 문구는
    여전히 "로그로만"이라고 단언).
  - 상세: 코드는 옳다 — `BusinessMetricsService.recordAuditWriteFailed`(business-metrics.service.ts:168-172)
    는 선례 `recordRedisFailOpen` 과 동일한 결함 클래스("경고 로그뿐이라 비율·추세로 알람을 걸 수 없다")를
    메꾸는 의도적·정당한 추가이고, plan(`plan/in-progress/spec-sync-auth-gaps.md:99-118`)에도 근거가 충분히
    기록돼 있다. 문제는 spec 쪽이다 — `spec/data-flow/9-observability.md` 의 Rationale
    ("`clemvion.redis.fail_open` 의 component 를...")이 스스로 못 박은 규칙("새 소비자를 배선할 때 유니온과
    NF-OB-07 카탈로그 표를 **동시에** 넓히는 것이 규칙")을 이번엔 지키지 않았다 — 라벨 값이 아니라 메트릭
    자체가 새로 생겼는데도 카탈로그 표·요약 문구·`1-audit.md` 의 swallow 서술 셋 다 정정되지 않았다.
  - 제안: 코드는 유지. `project-planner` 턴으로 (a) `spec/5-system/_product-overview.md` NF-OB-07 카탈로그
    표에 `clemvion.audit.write_failed | Counter | resource_type | ...` 행 추가 + §5 요약 행 문구에 "감사 로그
    적재 실패" 추가, (b) `spec/data-flow/9-observability.md:202-206` 불릿에 동일 메트릭 추가, (c)
    `spec/data-flow/1-audit.md:21-23` 을 "audit_log 실패는 로그 + `clemvion.audit.write_failed` 카운터,
    login_history 실패는 로그만" 으로 세분화.

- **[WARNING]** 신규 `BusinessMetricsService.recordAuditWriteFailed` 의 실제 구현이 어떤 테스트로도
  실행되지 않는다 — 같은 파일이 스스로 명시한 테스트 관례를 이번 메서드만 어겼다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:168-172`
    (`recordAuditWriteFailed` 구현) / `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts`
    (해당 메서드에 대한 직접 단위 테스트 부재 — 파일 끝까지 186줄 중 `recordAuditWriteFailed`/
    `auditWriteFailed`/`clemvion.audit.write_failed` 어느 것도 등장하지 않음, grep 확인).
  - 상세: `business-metrics.service.spec.ts:62-66` 의 주석이 정확히 이 위험을 설명한다 — "인터셉터 쪽
    테스트는 이 메서드를 `jest.fn()` 스텁으로 대체하므로, **이 구현 자체는 어느 테스트도 실행하지
    않았다** — 카운터 이름 오탈자·라벨 키 뒤바뀜·`add` 누락이 전부 조용히 통과한다. **형제 `record*`
    메서드가 모두 여기 테스트를 갖는 이유와 같다**." 실제로 `audit-logs.spec.ts` 의 신규 테스트들은
    `metrics = { recordAuditWriteFailed: jest.fn() }` 로 스텁을 쓴다(파일 2 diff L161·204) — 즉
    `AuditLogsService` 가 그 메서드를 **호출한다**는 것만 검증되고, `BusinessMetricsService` 안에서
    카운터 이름이 `clemvion.audit.write_failed` 로 맞는지, 라벨 키가 `resource_type` 인지,
    `.substring(0, 64)` 클램핑이 실제로 동작하는지는 0건 검증이다. `recordExecutionError`·
    `recordRedisFailOpen` 은 각각 클램핑/타입 캐너리까지 포함한 직접 테스트를 갖고 있어 이번 메서드만
    예외가 됐다.
  - 제안: `business-metrics.service.spec.ts` 에 `recordExecutionError`/`recordRedisFailOpen` 과 같은 패턴의
    직접 테스트 추가 — `service.recordAuditWriteFailed('auth_config')` 호출 후
    `mock.counters['clemvion.audit.write_failed'].add` 가 `(1, { resource_type: 'auth_config' })` 로
    호출됐는지, 64자 초과 입력이 잘리는지(클램핑) 단언.

- **[INFO]** `AuditActionFor` 사용처 개수를 밝힌 주석이 이번 PR 로 stale 해졌다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`AuditActionFor` 바로 위
    `_NoCrossDomain` 가드 주석, "서비스 4곳이 이 타입을 쓰지만…").
  - 상세: 이 PR 로 `auth-configs.service.ts` 도 `AuditActionFor` 를 쓰게 되어 실제로는 5곳(triggers/
    workflows/schedules/model-config/auth-configs, 전수 grep 확인)이 됐다. diff 대상 파일은 아니지만
    이번 변경이 직접 유발한 staleness라 인접 사실 오류로 남긴다.
  - 제안: 다음에 `audit-action.const.ts` 를 건드릴 때 "4곳" → "5곳" 정정 (developer 자기-반증형 소정정
    조건에 해당할 수 있으나 우선순위 낮음, 지금 단독 수정할 이유는 없음).

- **[INFO]** `audit-action-binding-guard.ts` 는 `ts.isMethodDeclaration` 형태만 인식해, `recordAudit` 를
  화살표 함수 프로퍼티(`private recordAudit = (params) => {...}`)로 선언하는 미래 서비스는 **탐지 자체가
  안 돼** "helper 를 찾았다" 카운트에도 안 잡히고 unbound 검사도 통과하지 못한 채 조용히 통과한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:78-96` (`findAuditHelpers`
    의 `visit` — `ts.isMethodDeclaration` 조건 하나로만 판정).
  - 상세: 현재 5개 서비스는 전부 `private recordAudit(params: {...})` 메서드 문법이라(전수 grep 확인)
    오탐/누락이 없다. 다만 plan(`plan/in-progress/spec-sync-auth-gaps.md:81-85`)과 가드 헤더 주석이
    "가드는 앞으로 생길 서비스도 잡는다" 를 설계 근거로 내세우는데, fixture 6종(`BOUND_SOURCE`/
    `BARE_UNION_SOURCE`/`NO_ACTION_SOURCE`/`POSITIONAL_SOURCE`/`LOOKALIKE_TYPE_SOURCE`/
    `UNRELATED_METHOD_SOURCE`) 중 화살표 함수 프로퍼티 형태를 다루는 것이 없어, "미래 서비스도 잡는다"
    는 주장에 이 한 축의 사각지대가 남는다. CRITICAL 은 아니다 — 현재 상태를 깨는 결함이 아니라
    구조적 커버리지 갭이다.
  - 제안: 우선순위 낮음. 향후 이 가드를 확장할 때 `ts.isPropertyDeclaration` + 화살표 함수 이니셜라이저
    케이스를 fixture 로 추가하는 것을 고려.

## 요약

핵심 프로덕션 변경(`AuditLogsService.record` 의 관측 가능한 실패 처리 강화, `BusinessMetricsService.
recordAuditWriteFailed` 신설, `auth-configs.service.ts` 의 `recordAudit` action 타입을 `AuditActionFor` 로
좁혀 리소스-바인딩 구멍을 닫은 것, 그리고 그 구멍의 회귀를 막는 정적 가드 신설)은 의도한 기능을 정확히
구현하며 실측(tsc 0 에러, jest 전수 통과, resourceType 12종 일치, tsc 프로브 재현)으로 뒷받침된다. `@Optional()`
주입·에러 메시지 필드 4종·카운터 호출 조건(실패 시에만) 은 모두 신규 테스트로 각각 개별 단언되어 있고
vacuous 하지 않다. 다만 두 가지 갭이 있다: (1) 신규 메트릭이 자신이 따른다고 주장하는 선례
(`clemvion.redis.fail_open`)가 spec 에 못 박은 "카탈로그 표를 동시에 넓힌다" 규칙을 어겨, NF-OB-07 카탈로그
표·`data-flow/9-observability.md`·`data-flow/1-audit.md` 세 곳이 낡았다(SPEC-DRIFT, 코드는 옳고 spec 반영만
누락) — project-planner 턴 필요. (2) `BusinessMetricsService.recordAuditWriteFailed` 자체 구현이 그 파일의
다른 모든 형제 메서드와 달리 직접 단위 테스트가 없어, 카운터 이름·라벨 키·클램핑 로직에 대한 회귀 방지가
없다(같은 파일의 주석이 스스로 이 위험을 설명하고 있어 근거가 명확하다). 둘 다 코드 되돌리기가 아니라
각각 spec 갱신·테스트 추가로 닫아야 한다.

## 위험도

MEDIUM
