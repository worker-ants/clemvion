# 테스트(Testing) 코드 리뷰

## 검증 방법

프롬프트에 실린 unified diff 를 확인하고, 핵심 테스트 파일
(`codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`)과
실행 코드(`executions.service.ts`)는 저장소 원본을 직접 `Read` 로 열어 대조했다.
추가로 실측을 수행했다:

- `npx jest src/modules/executions/executions-rerun.service.spec.ts` — 20 passed (무수정, GREEN).
- `npx jest src/modules/workflows/workflows.controller.spec.ts src/modules/workflows/workflows.service.spec.ts` — 118 passed (자매 테스트 회귀 없음).
- **독립 뮤테이션 검증**: `executions.service.ts:510` 의 `code: 'INVALID_TRIGGER_PARAMETERS'` 를
  `code: 'INVALID_INPUT'` 로 되돌리고 재실행 → **2 failed** (`executions-rerun.service.spec.ts` 의
  330행 테스트와 403행 회귀 테스트 둘 다 RED). `cp` 백업으로 원복 후 `git diff --stat` 로 바이트
  동일 확인, 재실행 시 다시 20 passed. `RESOLUTION.md`(`17_06_14` W5)가 문서화한 실측과 동일한
  결론을 독립적으로 재현했다.

이 diff 는 직전 라운드(`17_06_14`)의 테스트 리뷰 WARNING #5(제목만 코드값을 주장하고 본문은
`toBeInstanceOf` 만 확인 — 값이 되돌아가도 GREEN)를 실제로 고친 결과물이다.

## 발견사항

- **[INFO]** (긍정 관찰) 코드 값 회귀를 잡는 캐너리가 실제로 유효함을 독립 뮤테이션으로 확인
  - 위치: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts:352-361`
    (`const err = await service.reRun(...).catch(...)` 이하 `expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'INVALID_TRIGGER_PARAMETERS' })`)
  - 상세: 이전 라운드 WARNING 이 지적한 "제목-본문 불일치"(제목은 `INVALID_TRIGGER_PARAMETERS` 를
    주장하지만 본문은 `toBeInstanceOf(BadRequestException)` 만 봄, vacuous)가 이번 diff 에서
    `toMatchObject({ code: ... })` 로 정확히 고쳐졌다. 위에서 직접 재현한 대로, 발행부 리터럴을
    되돌리면 이 테스트가 실제로 RED 가 된다 — "고쳤다"는 주장이 형식적 GREEN 이 아니라 실제
    방어력으로 뒷받침된다. 관용구도 같은 파일의 자매 회귀 테스트(403행)와 통일되어 있어 파일
    내 일관성도 좋다.
  - 제안: 없음(조치 불요, 긍정 확인).

- **[INFO]** 신규 테스트가 `details[]` 항목까지는 단언하지 않음 — 단, 다른 파일에서 커버됨
  - 위치: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts:330-362`
    (`throws INVALID_TRIGGER_PARAMETERS when inputOverride fails trigger schema validation`)
  - 상세: 이 시나리오(필수 파라미터 누락)는 `details[]` 에 `MISSING_REQUIRED_FIELD` 류 필드별
    코드가 실려야 하는데, 이 테스트는 최상위 `code` 만 확인하고 `details` 는 보지 않는다. 같은
    파일의 자매 회귀 테스트(403행, 마스킹 시나리오)는 `details` 배열까지 `toEqual` 로 단언하는
    반면 이 테스트는 그 패턴을 따르지 않아 파일 내 스타일이 갈린다. 다만 `MISSING_REQUIRED_FIELD`
    /`toTriggerParameterErrorDetails` 자체는 `resolve-trigger-parameters.spec.ts` ·
    `workflows.controller.spec.ts` 에서 이미 직접 커버되므로 **실질적 커버리지 갭은 아니다**
    (CHANGELOG 가 명시한 "details[] 항목 코드는 변화 없다"는 주장도 그 두 파일의 기존 테스트로
    뒷받침된다). 이번 diff 범위(top-level `code` rename)에서는 불필요한 확장이라 생략이 합리적인
    선택으로 보인다.
  - 제안: 조치 불요. 굳이 강화하려면 353행 이후 `details` 를
    `[{ field: 'orderId', code: 'MISSING_REQUIRED_FIELD', message: expect.any(String) }]` 형태로
    한 줄 추가하는 정도(선택 사항).

- **[INFO]** e2e 레벨에 re-run 트리거 검증 실패 경로의 `error.code` 단언 없음 (선존 갭, 이 diff 가
  만든 것 아님)
  - 위치: `codebase/backend/test/re-run.e2e-spec.ts` (전체 — validation-failure 케이스 부재)
  - 상세: `grep -n "INVALID_TRIGGER_PARAMETERS\|400\|BadRequest" re-run.e2e-spec.ts` 로 확인한 결과
    이 e2e 스펙은 happy-path(B. inputOverride 성공 케이스)만 다루고, `inputOverride` 스키마 검증
    실패 → `400 + code + details[]` 를 직접 HTTP 레벨에서 확인하는 케이스가 없다. unit 레벨
    (`executions-rerun.service.spec.ts`)이 서비스 계층에서 커버하므로 릴리스를 막을 사안은
    아니며, 직전 라운드 SUMMARY 도 이미 INFO 로 등재해 둔 항목이다.
  - 제안: 필수 아님. 여유 시 `it('C. re-run inputOverride 스키마 검증 실패 → 400 INVALID_TRIGGER_PARAMETERS + details[]', ...)` 케이스 1개 추가 검토.

- **[INFO]** 회귀 테스트 유효성 — 자매 3곳(`workflows.controller.spec.ts` ×2, `workflows.service.spec.ts`)
  이미 값을 단언하고 있었다는 diff 주석의 주장을 실측 확인
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.spec.ts:150,246`,
    `codebase/backend/src/modules/workflows/workflows.service.spec.ts:1176`
  - 상세: `grep -n "INVALID_TRIGGER_PARAMETERS"` 로 세 곳 모두 이미 `expect(response.code).toBe(...)`
    /`code: 'INVALID_TRIGGER_PARAMETERS'` 형태로 값을 직접 단언하고 있음을 확인했다. 이번
    diff 가 이 세 파일을 건드리지 않은 것(execute/save 경로는 원래부터 값이 같았으므로)도
    일관된다 — 회귀 위험 없음.
  - 제안: 없음(조치 불요, 검증 완료).

## Mock/격리 평가

- `executions-rerun.service.spec.ts` 의 `beforeEach` 가 `getOneQueue`/`chainDepth`/각 mock 을
  매번 재초기화해 테스트 간 상태 누수가 없다. `makeQb()` 가 매 `createQueryBuilder()` 호출마다
  새 chainable mock 을 만드는 방식도 테스트별 독립성을 해치지 않는다.
- Mock 이 실제 TypeORM `QueryBuilder`/Repository 표면을 최소한으로 흉내내는 수준이라 과도한
  구현 결합은 없다. 이번 diff 는 이 mock 구조를 건드리지 않았다.

## 요약

이번 diff 의 테스트 관련 핵심은 직전 라운드에서 지적된 "제목은 코드값을 주장하지만 본문은
`toBeInstanceOf` 만 확인하는 vacuous 테스트"(`17_06_14` W5)를 `toMatchObject({ code: ... })` 로
실제로 고친 것이다. 직접 재현한 뮤테이션 실험(발행부 리터럴을 되돌리면 2개 테스트가 RED)으로
그 방어력이 형식적이 아니라 실제로 작동함을 확인했고, 자매 세 경로(`workflows.controller/service.spec.ts`)
도 이미 값을 단언하고 있어 회귀 없이 안전하게 통일됐다. 남은 항목은 전부 INFO 수준(e2e 검증
공백은 선존 갭, `details[]` 미단언은 다른 파일이 이미 커버) — 이번 diff 가 새로 만든 테스트
결함은 없다.

## 위험도

NONE
