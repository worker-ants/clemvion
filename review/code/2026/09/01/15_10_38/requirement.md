# 요구사항(Requirement) 리뷰

## 검증 방법

저장소를 뮤테이션하지 않고 대상 파일을 `Read`/`Grep`으로 확인했다. 추가로 다음을 **직접 재실행**해
diff 서술을 실측 검증했다(전부 GREEN/무결과, 종료 후 `git status --short` 확인 결과 리뷰 산출물
디렉터리 외 변경 없음):

```
npx jest src/modules/audit-logs/audit-logs.spec.ts \
         src/modules/metrics/business-metrics.service.spec.ts \
         src/repo-guards/__tests__/audit-action-binding.spec.ts \
         src/modules/auth-configs/auth-configs.service.spec.ts
→ Test Suites: 4 passed, 4 total / Tests: 77 passed, 77 total

npx tsc -p tsconfig.build.json --noEmit
→ 0 에러

grep -rln "private recordAudit(" codebase/backend/src/modules (spec 제외)
→ triggers / workflows / schedules / model-config / auth-configs 정확히 5곳 (plan·가드의 "5개 helper" 주장과 일치)

resourceType 리터럴 전수(grep) = alert_rule/auth_config/execution/integration/member/
model_config/schedule/trigger/user/workflow/workspace/workspace_invitation = 정확히 12종
(spec 카탈로그 "실측 12종" 서술과 일치)
```

이 라운드(15:10:38)는 1라운드(14:31:12) 리뷰의 WARNING 5건(W1~W4 + SD1)에 대한 fix 커밋과, SD1의
planner 턴 산출물(spec draft → consistency-check → 실제 `spec/` 3파일 반영)까지 포함한 최종
changeset이다. 아래는 1라운드 발견사항이 실제로 해소됐는지의 실측 재확인과, 이번에 새로 추가된
코드 자체에 대한 독립 점검이다.

## 발견사항

- **[INFO] (재확인 — 해소됨)** 1라운드 WARNING "`recordAuditWriteFailed` 구현이 어떤 테스트로도
  실행되지 않는다"는 이번 라운드에서 해소를 확인했다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:73-88` (신규 2건),
    `codebase/backend/src/modules/metrics/business-metrics.service.ts:180-182` (`recordAuditWriteFailed`)
  - 상세: 직접 호출-단언 테스트 2건이 추가됐다 — (1) `service.recordAuditWriteFailed('auth_config')` →
    `mock.counters['clemvion.audit.write_failed'].add` 가 `(1, {resource_type:'auth_config'})` 로
    호출됐는지, (2) 65자 입력이 정확히 64자로 잘리는지(경계값 65 사용 — 64를 넣으면 자르든 안 자르든
    같은 값이라 분기를 못 가르는 fixture가 됐을 텐데, 65로 정확히 경계를 가른다). 두 테스트 모두
    직접 실행해 GREEN 확인했고, `clampLabel`을 제거하는 뮤테이션을 상상해도 두 번째 테스트가 RED로
    바뀌는 구조다(경계값 선택이 유효).
  - 제안: 없음 — 조치 완료.

- **[INFO] (재확인 — 해소됨)** 1라운드 WARNING "swallow 계약 내부의 무보호 metrics 호출이 새 실패
  경로가 될 수 있다"는 해소를 확인했다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:108-112` (실제 파일
    라인 — `try { this.metrics?.recordAuditWriteFailed(entry.resourceType); } catch { ... }`)
  - 상세: `metrics?.recordAuditWriteFailed(...)` 호출이 자체 `try`/`catch`로 한 번 더 감싸졌다.
    회귀 테스트("metrics 호출이 던져도 삼킨다")가 `recordAuditWriteFailed: jest.fn(() => { throw ... })`
    로 실제로 예외를 던지게 만들고 `service.record(entry)`가 여전히 `resolves.toBeUndefined()`임을
    단언한다 — 직접 실행해 GREEN 확인. 이 축을 되돌리는 뮤테이션(안쪽 try 제거)은 이 테스트를
    RED로 만든다.
  - 제안: 없음 — 조치 완료.

- **[INFO] (재확인 — 해소됨)** 1라운드 WARNING "라벨 클램핑 상한 64가 두 곳에 매직넘버로 중복"은
  해소를 확인했다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:66-71`
    (`PROMETHEUS_LABEL_MAX_LEN`/`clampLabel`), `:133` (`recordExecutionError`가 `clampLabel` 재사용),
    `:181` (`recordAuditWriteFailed`가 동일 함수 재사용)
  - 상세: 상수+헬퍼 함수로 추출되어 두 메서드가 공유한다. `recordExecutionError`의 기존 리터럴
    `errorCode.substring(0, 64)`도 `clampLabel(errorCode)`로 교체돼 실제로 한 곳만 고치면 두 메트릭이
    같이 바뀌는 구조가 됐다.
  - 제안: 없음 — 조치 완료.

- **[INFO] (재확인 — 해소됨)** 1라운드 WARNING "CHANGELOG.md에 이번 변경 서술이 없다"는 해소를
  확인했다.
  - 위치: `CHANGELOG.md:3-42` (신규 "Unreleased — 감사 액션 바인딩 구멍 + 삼킨 적재 실패를 알람 걸
    수 있게" 절)
  - 상세: `recordAudit` 팩토리 won't-do 결정, 판별 프로브(tsc 0-에러 vs TS2322), `clemvion.audit.write_failed`
    도입 근거를 선례 `clemvion.redis.fail_open`과 명시적으로 연결해 서술한다.
  - 제안: 없음 — 조치 완료.

- **[INFO] (재확인 — 해소됨, SPEC-DRIFT → spec 갱신 완료)** 1라운드 `[SPEC-DRIFT]` WARNING
  "`clemvion.audit.write_failed`가 NF-OB-07 카탈로그·`data-flow` 서술에 반영되지 않았다"는 이번
  라운드에서 실제 spec 3파일 갱신으로 해소됐다.
  - 위치: `spec/5-system/_product-overview.md:75`(요약행), `:81-91`(라벨을 닫는 방법 서술 + 카탈로그
    신규 행), `spec/data-flow/9-observability.md:204-205`(블록쿼트 나열), `:274-278`(Rationale에
    "이 원칙은 코드 유니온이 있는 라벨에 적용된다" 예외 조항 신설), `spec/data-flow/1-audit.md:21-38`
    (두 `record`의 관측 방식을 분리 서술)
  - 상세: 코드(`recordAuditWriteFailed`, `record()`의 카운터+로그 필드 4종, `resourceType` 클램핑)와
    spec 서술이 line-level로 정확히 일치한다 — 메트릭명·라벨명·클램핑 상한(64)·로그 필드
    (action/resourceType/resourceId/workspaceId)·swallow-then-observe 순서 전부 대조 확인.
    추가로, 이번 라운드의 consistency-check(`review/consistency/2026/09/01/15_00_54/rationale_continuity.md`)가
    지적한 "`resource_type` open-string+클램핑이 `9-observability.md` Rationale의 '닫힌 집합
    유지·string 미채택' 원칙과 문면상 어긋나는데 그 출처 문서 자체는 갱신 대상에 없다"는 WARNING도,
    실제 적용된 diff에는 그 문서 Rationale에 "이 원칙은 코드 유니온이 있는 라벨에 적용된다 … 소스
    시그니처가 이미 `string`인 라벨은 … 클램핑해 방어한다" 블록쿼트가 추가돼 있어(`9-observability.md:274-278`)
    반영됐다. 같은 consistency-check의 `plan_coherence.md` WARNING("`login_history` 후속 항목 등재
    약속이 실제 plan 갱신으로 이어지지 않는다")도 `plan/in-progress/spec-sync-auth-gaps.md:129-136`에
    "`login_history` 축 — 미결" 하위 체크박스(재개 신호 포함)로 실측 확인됐다.
  - 제안: 없음 — spec-code 갭·consistency-check가 지적한 두 WARNING 모두 이 changeset 안에서
    해소된 것으로 확인.

- **[INFO] (변경 없음 — carried over, 저우선순위)** `audit-action.const.ts`의 `_NoCrossDomain` 가드
  주석 "서비스 4곳이 이 타입을 쓰지만…"이 이번 PR로 실제 5곳(auth-configs 추가)이 됐는데 아직 정정
  안 됨.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`_NoCrossDomain` 바로
    위 주석 — 이번 diff에 포함된 파일 아님)
  - 상세: 1라운드 requirement.md가 이미 INFO로 등재하고 "지금 단독 수정할 이유는 없음"으로 판정한
    항목이며, 이번 diff는 이 파일을 건드리지 않아 여전히 stale하다. 기능적 결함은 아니다(가드
    로직 자체는 `Set`이라 개수에 의존하지 않는다).
  - 제안: 다음에 `audit-action.const.ts`를 건드릴 때 "4곳"→"5곳" 정정. 우선순위는 낮게 유지해도
    된다는 1라운드 판단에 동의.

- **[INFO] (변경 없음 — carried over, 저우선순위)** `AuditLogsService.record()`의 JSDoc이 이번에
  추가된 관측 동작(카운터 증가, 로그 필드 확장)을 언급하지 않는다 — 여전히 "Failures are swallowed"
  절반만 서술.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75`
  - 상세: 1라운드 documentation.md가 이미 INFO로 지적했고 이번 라운드에도 미수정. spec
    (`data-flow/1-audit.md`)·plan·catch 블록 인라인 주석에는 상세히 서술돼 있어 실질적 정보
    누락은 아니다.
  - 제안: 우선순위 낮음. JSDoc에 한 줄만 추가해도 충분(`@link BusinessMetricsService.recordAuditWriteFailed` 등).

## 요약

이번 changeset의 핵심 —(1) `AuditLogsService.record()`의 swallow 계약에 관측 가능성(카운터+상세
로그, 관측 자체도 이중 삼킴)을 추가, (2) `auth-configs.service.ts`의 `recordAudit` action 타입을
`AuditActionFor<...>`로 좁혀 리소스-바인딩 구멍을 닫음, (3) 그 바인딩을 전수 강제하는 AST 가드
신설, (4) NF-OB-07 카탈로그·`data-flow` 2문서에 신규 메트릭을 spec 반영 — 은 실측(jest 77건
GREEN, tsc 0에러, resourceType 12종 grep 일치, 5개 helper 전수 확인)으로 뒷받침되며 의도한 기능을
정확히 구현한다. 1라운드가 지적한 WARNING 5건(카운터 무테스트, metrics 호출 무보호, 클램핑 상수
중복, CHANGELOG 누락, spec 카탈로그 미반영)은 전부 코드/문서 diff와 재실행한 테스트로 해소가
확인됐고, 그 과정에서 열린 consistency-check(spec draft 라운드)의 WARNING 2건(닫힌 집합 원칙과
open-string 라벨의 긴장, `login_history` 후속 등재 누락) 역시 실제 적용된 diff에 반영돼 있다.
남은 항목은 이번 diff 범위 밖의 저우선순위 INFO 2건(주석 "4곳"→"5곳" stale화, JSDoc 절반 서술)뿐이며
둘 다 1라운드에서 이미 같은 판정(저우선순위, 즉시 조치 불요)을 받은 항목이다. 요구사항 충족·spec
line-level 정합 관점에서 차단 사유가 없다.

## 위험도

NONE
