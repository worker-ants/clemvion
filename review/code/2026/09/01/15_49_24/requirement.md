# 요구사항(Requirement) 리뷰 — audit-record-factory (2026-09-01 15:49:24, 누적 4라운드)

## 검토 방법

이 프롬프트는 `origin/main...HEAD` 누적 diff(58 파일)로, 실질 코드 변경(파일 1~9)에 더해
3라운드에 걸친 자체 리뷰·consistency-check 산출물(`review/**`)과 그 결과로 갱신된 spec
3파일(`_product-overview.md`, `data-flow/1-audit.md`, `data-flow/9-observability.md`),
plan 문서(`spec-sync-auth-gaps.md`, `plan/complete/spec-draft-audit-write-failed-metric.md`)를
포함한다. 저장소를 뮤테이션하지 않고 `Read`/`Grep`/`Bash`(읽기 전용)로 현재 소스 상태를
직접 열어 대조했다. 검증한 것:

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`,
  `auth-configs.service.ts`, `metrics/business-metrics.service.ts`,
  `audit-action.const.ts`, `repo-guards/__tests__/audit-action-binding-*.ts` 전체 파일을
  직접 읽어 diff 와 대조
- `jest audit-logs.spec.ts business-metrics.service.spec.ts audit-action-binding.spec.ts`
  실행 → **3 suites / 35 tests 전부 통과**
- `tsc --noEmit -p tsconfig.build.json` → **0 에러**
- `resourceType` "실측 12종" 주장을 `grep -rn "resourceType:"` 전수로 재검산 → **정확히
  12종**(`user`·`trigger`·`workflow`·`schedule`·`member`·`workspace_invitation`·
  `workspace`·`alert_rule`·`integration`·`model_config`·`auth_config`·`execution`) 확인
- `recordAudit` helper 5곳(`workflows`·`triggers`·`schedules`·`model-config`·`auth-configs`)
  전수 확인 → **전부** `AuditActionFor<typeof X_RESOURCE_TYPE>` 사용, 맨 `AuditAction` 잔존 없음
- `plan/complete/spec-draft-audit-write-failed-metric.md` frontmatter → `status: applied`,
  `completed: 2026-09-01` 확인(2라운드 WARNING "in-progress 잔류" 해소 확인)
- `git status --short` → 이번 세션 산출물(`review/code/2026/09/01/15_49_24/`) 외 잔여 없음

이전 3라운드(`14_31_12`→`15_10_38`→`15_25_56`)가 Critical 0 · Warning 5+3+2(전부 코드 fix 또는
같은 커밋의 planner 턴으로 해소)를 이미 처리했고, 이번 라운드에서 그 해소 상태가 현재
소스와 실제로 일치하는지를 실측 재검증하는 데 집중했다.

## 발견사항

- **[INFO]** `AuditLogsService.record()` JSDoc 이 이번 PR 이 추가한 관측 동작(카운터 증가,
  로그 4필드 확장)을 언급하지 않는다 — 3라운드 연속 이월된 기지 항목, 재발 아님
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75`
    (`* Record an audit event. Failures are swallowed — audit logging must never break the
    primary action.`)
  - 상세: 직접 `Read` 로 확인 — 현재도 "삼킨다"는 절반만 서술한다. 1~3라운드 리뷰가 동일
    지점을 INFO 로 이미 등재했고 `RESOLUTION.md` 가 "우선순위 판단으로 유예" 라고 명시적으로
    구분해 적어 두었다(3라운드에서 "문서화됐다고 조치 안 한 것"이 아니라는 점을 스스로
    정정했음을 확인). 기능 결함 아님.
  - 제안: 다음에 이 메서드를 건드릴 계기가 있으면 한 줄 추가(이미 제안된 문구 존재). 즉시
    조치 불요.

- **[INFO]** `findUnboundHelpers` 의 판정이 `AuditActionFor<` 접두 문자열만 보고 제네릭 인자
  (어느 리소스에 묶였는지)는 비교하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:152-157`
    (`findUnboundHelpers` — `startsWith(\`${BOUND_TYPE_NAME}<\`)`)
  - 상세: 예컨대 `TriggersService.recordAudit` 의 `action` 이 실수로
    `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`(다른 리소스)로 복붙돼도 이 가드는
    통과시킨다. 다만 컴파일러의 `_NoCrossDomain` 가드(`audit-action.const.ts:139-141`)가
    "좁혀지는가"는 빌드 시 검증하고, 실제 오귀속은 각 서비스의 `resourceType: X_RESOURCE_TYPE`
    고정 필드가 `recordAudit` 호출부 자체에서 별도로 방어한다 — 이 가드는 "맨 union" 클래스
    (이번 PR 이 실측으로 발견한 구멍)를 정확히 잡는 것이 목표였고 그 목표는 fixture
    5종(맨 union·프로퍼티 부재·positional·lookalike 타입·화살표 필드 맨 union) 전부에서
    검증됐다. 3라운드 RESOLUTION 이 "문서화가 아니라 우선순위 판단" 이라고 스스로 구분해
    명시한 항목과 동일 성격.
  - 제안: 조치 불요(3라운드 연속 같은 판단, 근거 타당). 원한다면 각 서비스 파일에서
    `resourceType` 상수를 함께 추출해 제네릭 인자 일치까지 검사하는 확장을 후속 항목으로.

- **[INFO]** `resource_type` 라벨이 닫힌 유니온이 아니라 64자 클램핑으로만 방어 — spec 이
  그 사실을 명시적으로 인지·정당화
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:180-182`
    (`recordAuditWriteFailed(resourceType: string)`), 대응 spec
    `spec/5-system/_product-overview.md:81,91`, `spec/data-flow/9-observability.md:274-279`
  - 상세: 소스(`AuditLogsService.record()`)의 `resourceType: string` 이 열린 타입이라
    컴파일러가 닫힘을 증명하지 못한다는 사실을, JSDoc·spec 카탈로그·Rationale 세 곳이 일관되게
    "왜 유니온이 아니라 클램핑인가" 로 명시하고 있다. 실측 12종 주장도 `grep` 전수로 재검산해
    정확함을 확인했다(위 검토 방법 참고). 설계 트레이드오프로서 결함이 아니다.
  - 제안: 없음. `record()` 시그니처가 닫힌 유니온으로 좁혀지면 그때 이쪽도 좁히는 것이
    코드·spec 양쪽에 이미 명시돼 있다.

## Spec Fidelity 확인 (양호)

- `spec/5-system/_product-overview.md` NF-OB-07 카탈로그 표(`:91`)의 메트릭명·라벨·설명이
  `business-metrics.service.ts:106-110,180-182` 구현과 line-level 로 일치 — 카운터 이름
  (`clemvion.audit.write_failed`), 라벨 키(`resource_type`), 클램핑 방식(64자) 전부 확인.
- `spec/data-flow/1-audit.md:21-38` 이 서술하는 "두 `record` 는 삼키는 것은 같지만 관측 방식이
  다르다"(`audit-logs.service.ts` = warn+카운터, `login-history.service.ts` = error only) 는
  실제 코드(`audit-logs.service.ts:109-119`)와 정확히 일치. `login-history.service.ts` 는 이번
  diff 범위 밖이며 spec 도 그 사실을 정확히 반영(카운터 없음).
  - `login_history` 후속 항목은 `plan/in-progress/spec-sync-auth-gaps.md:129-137` 에
    미결 하위 체크박스로 명시 연결돼 있음을 확인 — consistency-check WARNING #2(연결 누락)가
    실제로 해소된 상태.
- `spec/data-flow/9-observability.md:204-205,274-279` 의 인프라 메트릭 나열·클램핑 예외 원칙이
  코드와 일치. consistency-check WARNING #1(원칙 예외가 출처 문서에 없던 문제)도 실제로
  `9-observability.md` Rationale 자리(`:274`)에 반영된 것을 확인.
- `AuthConfigsService.recordAudit` 의 `action: AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`
  (`auth-configs.service.ts:86`)는 plan(`spec-sync-auth-gaps.md:52-77`)이 서술하는 실측 결함
  ("맨 union 이라 `trigger.created` 를 `auth_config` 로 기록해도 tsc 0 에러") 및 그 처방과
  정확히 일치. `_NoCrossDomain` 컴파일 가드(`audit-action.const.ts:139-141`)가 `tsc --noEmit`
  으로 실제 검증됨(0 에러)도 확인했다.

## 이전 라운드 WARNING 해소 재검증 (전부 확인됨)

| WARNING | 상태 | 실측 근거 |
|---|---|---|
| 1R W1: `recordAuditWriteFailed` 구현이 어느 테스트도 실행 안 함 | 해소 | `business-metrics.service.spec.ts:68-83` 직접 테스트 2건 존재, jest 실행 통과 |
| 1R W2: catch 블록 내 metrics 호출 무방비 | 해소 | `audit-logs.service.ts:109-113` 이중 try/catch, `audit-logs.spec.ts:202-221` 뮤테이션성 테스트로 확인 |
| 1R W3: 클램핑 상수 `64` 중복 | 해소 | `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel()` 공유(`business-metrics.service.ts:55-59,133,181`) |
| 1R W4: CHANGELOG 누락 | 해소 | `CHANGELOG.md:3-41` |
| 1R SD1: spec 카탈로그 미등재 | 해소 | 3파일 line-level 일치 확인(위 Spec Fidelity) |
| 2R W1: draft 가 `in-progress/` 잔류 | 해소 | `plan/complete/spec-draft-audit-write-failed-metric.md` `status: applied` |
| 2R W2/W3: JSDoc/주석 삽입 지점 오귀속 | 해소 | 클래스 JSDoc·`recordRedisFailOpen` 주석 모두 원 위치 복구 확인 |
| 3R W1: `@Optional` 테스트가 DI 를 안 탐 | 해소 | `audit-logs.spec.ts:223-237` `Test.createTestingModule` 로 재작성 확인 |
| 3R W2: 화살표 함수 필드 미탐지(거짓 근거) | 해소 | `audit-action-binding-guard.ts:105-125` `PropertyDeclaration`+화살표 분기 존재, fixture 5종 전부 GREEN |

## 요약

핵심 변경(감사 적재 실패 관측성 신설, `auth-configs` 액션 타입 바인딩 결함 수정, AST 기반
정적 가드 신설)은 의도한 기능을 완전히 구현했고, 3라운드에 걸친 자체 리뷰 사이클에서 지적된
Critical 0 · 누적 Warning 10건이 전부 코드/문서에 실제로 반영돼 있음을 소스 직접 대조와 테스트
실행(3 suites/35 tests 통과, tsc 0 에러)으로 재검증했다. spec 3문서(`_product-overview.md`,
`1-audit.md`, `9-observability.md`)는 구현과 line-level 로 일치하며, `resourceType` "실측 12종"
· `recordAudit` 5개 helper 전수 바인딩 등 문서의 정량적 주장도 실측 재검산으로 정확함을
확인했다. 잔여 발견사항은 전부 INFO — 3라운드 연속 "문서화가 아니라 명시적 우선순위 판단으로
유예" 로 판정된 항목(가드의 제네릭 인자 미비교, JSDoc 절반 서술)이며 기능적 결함이나 spec
불일치가 아니다. 새로 발견된 Critical/Warning 급 결함은 없다.

## 위험도

NONE
