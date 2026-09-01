# 테스트(Testing) 리뷰 — audit-record-factory (2026-09-01 15:49:24)

이 diff 는 이미 3라운드 리뷰(`14_31_12` → `15_10_38` → `15_25_56`)를 거쳐 W1~W4 가 수정된
상태다. 이번 라운드에서는 실제 소스(`Read`)와 뮤테이션 프로브로 재검증했다. 뮤테이션은
저장소 파일을 직접 고친 뒤 `cp` 로 원복했다 — 상세는 `## 뮤테이션 검증` 참고. 원복 후
`git status --short` 로 확인했고, 이 세션이 만든 `review/code/2026/09/01/15_49_24/` 외의
잔여물은 없다.

## 발견사항

- **[INFO]** `clampLabel` 공유 리팩터의 절반(`recordExecutionError` 쪽)이 경계값으로
  고정되지 않았다 — 뮤테이션으로 GREEN 생존 확인.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` (`recordExecutionError`, 게이트 132-134), `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` (게이트 54-60)
  - 상세: 이번 diff 는 매직넘버 `64` 를 `PROMETHEUS_LABEL_MAX_LEN` + `clampLabel()` 로 공유시켰고, 그 근거를 "값 자체가 계약이라 한쪽만 바뀌면 두 메트릭의 방어 강도가 조용히 갈린다"(`business-metrics.service.ts:51-53`)고 명시했다. 그런데 실제로 `recordExecutionError` 를 겨눈 테스트(게이트 54-60)는 `'NODE_TIMEOUT'`(11자)만 넣어 클램핑 여부를 전혀 단언하지 않는다. 경계 단언은 `recordAuditWriteFailed` 쪽(65자 → `toHaveLength(64)`)에만 있다.
    직접 뮤테이션으로 확인했다 — `recordExecutionError` 본문을 `errorCode: clampLabel(errorCode)` → `errorCode: errorCode`(클램핑 제거, `clampLabel` 함수 자체는 그대로 둔 채 이 호출부만 우회)로 바꾸고 `business-metrics.service.spec.ts` 를 돌리니 **11/11 GREEN** — 그 함수가 명시적으로 경계로 삼은 결함 클래스("한쪽만 방어 강도가 갈린다")가 정확히 이 형태로 재현됐는데 잡히지 않는다. `recordAuditWriteFailed` 자체가 정상 동작하는 한(공유 함수는 검증됨) 실무 위험은 낮지만, "리팩터의 존재 이유"가 곧 커버리지 공백이 된 사례라 INFO 로 남긴다.
  - 제안: `recordExecutionError` 에도 형제 테스트(65자 입력 → `toHaveLength(64)`)를 추가해 두 호출부가 대칭적으로 고정되게 할 것. 또는 `clampLabel` 자체에 대한 독립 단위 테스트를 두고 두 `record*` 테스트는 "clampLabel 을 호출했다" 수준으로 낮추는 방법도 가능.

- **[INFO]** `AuditHelperSite.line` 단언이 약하다(`toBeGreaterThan(0)`만).
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding.spec.ts:772` (`expect(site.line).toBeGreaterThan(0)`)
  - 상세: `findAuditHelpers` 가 `sf.getLineAndCharacterOfPosition(...).line + 1` 로 1-based 줄 번호를 계산하는데, 이 값이 오프바이원(예: `+1` 누락)이어도 여전히 양수라 이 단언을 통과한다. `BOUND_SOURCE` fixture 는 backtick 템플릿 리터럴이라 `recordAudit` 선언이 항상 3번째 줄(`class A {` 다음)에 오므로, `expect(site.line).toBe(3)` 처럼 정확한 값을 고정할 수 있었다. 실사용에서 `line` 은 "사람이 바로 열 수 있게"(인터페이스 주석)가 목적이라, 오프바이원이면 진단 시 매번 한 줄씩 밀려 보이는 사용성 저하로 이어진다. 심각도는 낮다 — 가드의 핵심 판정(바인딩 여부)과는 무관하다.
  - 제안: fixture 의 알려진 줄 번호로 `toBe(N)` 단언 강화.

## 우수 사례 (참고)

- `audit-logs.spec.ts` 의 `record — 삼킨 실패의 관측` 스위트는 뮤테이션으로 재검증해도 견고했다. `this.metrics?.recordAuditWriteFailed(entry.resourceType)` 성공 직후 조기 `return` 을 넣어 `logger.warn` 호출을 건너뛰게 만드는 뮤턴트를 직접 주입해 실행한 결과, "로그에 무엇이 유실됐는지 적는다" 테스트가 정확히 RED 로 반응했다(`metrics` 를 던지지 않는 스텁으로 구성해 둔 것이 이 조기-return 류 회귀를 정확히 잡아낸다). RESOLUTION.md 가 주장한 뮤테이션 X5 axis(관측 호출의 try 제거) 결과도 재실행 없이 코드 검토만으로 타당해 보였다.
- `recordAuditWriteFailed`·`recordAudit` 관련 세 신규 스위트(`audit-logs.spec.ts`, `business-metrics.service.spec.ts`, `audit-action-binding.spec.ts`) 모두 "이 구현 자체를 어떤 테스트도 실행하지 않는다"(mock 대체로 인한 vacuous 위험)를 헤더 주석에 명시하고 실제로 실구현을 태우는 테스트를 별도로 갖춰, 형제 `recordRedisFailOpen` 이 남긴 교훈을 실제로 재사용했다.
- `audit-action-binding.spec.ts` 는 `sites.length >= 5`·`AUDIT_HELPER_NAMES.size > 0` 두 "전제" 테스트로 "0건 검사인데 통과처럼 보이는" 함정을 스스로 차단한다. `MODULES_DIR` 실측(`grep -rn "private recordAudit"`)으로 현재 정확히 5곳임을 확인했고, `>=` 비교라 6번째 리소스가 추가돼도 깨지지 않는다(forward-compatible).
- fixture 파일(`audit-action-binding-fixture.ts`)이 형태 커버리지(맨 union·프로퍼티 부재·positional·lookalike 타입·화살표 필드)를 라이브 소스가 아닌 불변 파일에 분리해 자기반증 테스트 함정을 피한 설계는 테스트 용이성 관점에서 모범적이다.
- 타입 전용 변경(`auth-configs.service.ts` 의 `AuditAction` → `AuditActionFor<...>`)은 런타임 회귀 위험이 없고, 기존 `auth-configs.service.spec.ts`(create/update/regenerate/remove/reveal 5곳의 `AUDIT_ACTIONS.AUTH_CONFIG_*` 단언)가 그대로 유효함을 확인했다 — 실측: `grep`으로 5개 호출부 전부 여전히 올바른 액션 상수를 쓰고 있음을 대조.

## 검증

- `Read` 로 `audit-logs.service.ts`/`.spec.ts`, `business-metrics.service.ts`/`.spec.ts`, `auth-configs.service.ts`, `audit-action.const.ts`, 가드 3파일 전문을 직접 열람.
- `grep -rn "private recordAudit"` 로 라이브 스캔 대상이 정확히 5곳임을 실측.
- 뮤테이션 2건을 저장소 파일에 직접 적용 후 `npx jest` 로 실행, 결과 확인 후 `cp` 로 원복(`git checkout`/`restore` 미사용):
  1. `audit-logs.service.ts` — 관측 호출 성공 직후 조기 `return` 삽입 → **RED 1**(예측대로, 기존 테스트가 이 클래스의 회귀를 잡음. 보고 대상 아님, 우수 사례로 기록)
  2. `business-metrics.service.ts` — `recordExecutionError` 의 `clampLabel` 호출을 우회 → **GREEN**(예측과 달리 생존 — 위 INFO 로 보고)
- 두 뮤테이션 모두 `diff <scratch-backup> <repo-file>` 로 원복을 확인했고, 최종 `git status --short` 로 저장소에 이 세션이 만든 `review/code/2026/09/01/15_49_24/` 외의 잔여물이 없음을 확인.

## 요약

핵심 신규/변경 로직(`AuditLogsService.record` 의 관측 추가, `BusinessMetricsService.recordAuditWriteFailed`, `auth-configs.service.ts` 의 리소스-바인딩 타입 좁힘, `audit-action-binding` AST 가드)은 전 라운드에 걸쳐 이미 촘촘한 뮤테이션 검증(예측/실측 병기)을 거쳤고, 이번 라운드에서 직접 재수행한 두 뮤테이션 프로브 중 하나(`record()` 의 관측-후-조기반환)는 기존 테스트가 정확히 잡아냈다. 다만 `clampLabel` 공유 리팩터가 스스로 명시한 "한쪽만 바뀌면 방어 강도가 조용히 갈린다"는 근거는 `recordExecutionError` 쪽에서 실제로 검증되지 않고 있음을 뮤테이션으로 확인했다(GREEN 생존) — Critical/Warning 급은 아니고 두 발견 모두 INFO 수준(런타임 위험 낮음, 진단 편의성 저하 수준)이라 이대로 병합해도 무방하나, 후속 커밋에서 가볍게 닫을 만하다.

## 위험도

LOW
