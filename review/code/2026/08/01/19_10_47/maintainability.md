# 유지보수성(Maintainability) 리뷰

## 리뷰 스코프 참고

이 audit-logging 브랜치는 이미 8차례 리뷰·조치를 거친 성숙한 코드베이스다. 직전 유지보수성
리뷰(`review/code/2026/08/01/18_44_56/maintainability.md`)는 `c4eddd918`(7차 리뷰 조치) 시점의
코드를 검토했고, 그 결과를 이번 라운드(`19_10_47`, 현재 HEAD)와 비교하면 실제 델타는
`git log a952d6616..HEAD -- codebase/` 기준 커밋 2개뿐이다:

- `8f4bcc378` — `AuditActionFor<'model_config'>` 등 4개 서비스의 하드코딩 리터럴을
  `AuditActionFor<typeof MODEL_CONFIG_RESOURCE_TYPE>` 형태로 로컬 상수에 결속
- `b77c62bbd` — `audit-action.const.ts` 에 `_NoCrossDomain` 빌드 가드 타입 신설 +
  `model-config.service.ts` `create()` 에 누락됐던 "커밋 뒤 기록" 근거 주석 보충

나머지 로직(각 서비스의 CRUD·`recordAudit` 헬퍼 본체·트랜잭션 순서 등)은 이전 라운드들에서
이미 검토·조치됐으므로 재론하지 않는다.

### 직전 WARNING 해소 확인

18_44_56 라운드가 지적한 WARNING — "`recordAudit` 의 `AuditActionFor<'...'>` 리터럴과 같은
파일의 `*_RESOURCE_TYPE` 상수가 같은 문자열을 두 곳에 따로 하드코딩" — 은 `8f4bcc378` 로 4개
파일 모두 해소됐다. 현재 상태를 직접 확인했다:

- `codebase/backend/src/modules/model-config/model-config.service.ts:245` — `AuditActionFor<typeof MODEL_CONFIG_RESOURCE_TYPE>`
- `codebase/backend/src/modules/schedules/schedules.service.ts:147` — `AuditActionFor<typeof SCHEDULE_RESOURCE_TYPE>`
- `codebase/backend/src/modules/triggers/triggers.service.ts:215` — `AuditActionFor<typeof TRIGGER_RESOURCE_TYPE>`
- `codebase/backend/src/modules/workflows/workflows.service.ts:180` — `AuditActionFor<typeof WORKFLOW_RESOURCE_TYPE>`

4곳 모두 리터럴 재선언 없이 로컬 `*_RESOURCE_TYPE` 상수에서 타입이 파생되므로, 상수 값이
바뀌면 `AuditActionFor` 도 자동으로 같이 좁혀진다. 리터럴 오탐 소지가 사라졌다.

### 발견사항

이번 델타(2개 커밋)에서 새로 발견된 Critical/Warning 급 문제는 없다. 참고용 INFO만 기록한다.

- **[INFO]** `recordAudit` private 헬퍼가 이제 5개 서비스(`auth-configs`(기존) +
  `model-config`/`schedules`/`triggers`/`workflows`(신규))에서 거의 동일한 형태로 반복된다
  — named-params 래퍼, `AuditActionFor<typeof *_RESOURCE_TYPE>` 필드, `auditLogsService.record()`
  위임까지 구조가 동일하고 `details`/`kind`/`type` 등 리소스별 부가 필드만 다르다.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:242`,
    `codebase/backend/src/modules/schedules/schedules.service.ts:144`,
    `codebase/backend/src/modules/triggers/triggers.service.ts:212`,
    `codebase/backend/src/modules/workflows/workflows.service.ts:177`
    (및 기존 `auth-configs.service.ts:78`)
  - 상세: 이는 이번 라운드에서 새로 만든 중복이 아니라 `auth-configs` 의 기존 컨벤션(W-1 근거)을
    의도적으로 그대로 답습한 것이고, "positional 인자 순서 스왑 방지"라는 명확한 이유가 각 헬퍼의
    JSDoc 에 반복 문서화돼 있어 실질적 위험은 낮다. 다만 리소스가 5개로 늘어난 지금, 향후 6번째
    리소스(예: `folder`, `integration` CRUD 확장 등)가 추가되면 반복이 더 늘어난다.
  - 제안: 액션 강제(즉시 조치 대상 아님) — 공용 베이스(예: `AuditRecorder<P>` 제네릭 클래스나
    `resourceType`/`extraDetails` 를 인자로 받는 팩토리 함수)로 추출할 수 있는지는 이 도메인이
    한두 개 더 늘어날 때 재평가할 만하다. 현재는 `AuditActionFor` 제네릭이 이미 컴파일 타임
    안전성을 제공하므로 긴급하지 않다.

- **[INFO]** `_NoCrossDomain` 빌드 가드(`codebase/backend/src/modules/audit-logs/audit-action.const.ts:121-124`)는
  `'trigger.created' extends AuditActionFor<'workflow'>` 한 쌍만 고정 검사한다. `AuditActionFor<P>`
  자체가 `P` 에 대해 완전히 일반적인 조건부 타입이라 한 쌍 검증으로도 4개 리소스 전체의 좁힘
  로직을 구조적으로 커버하지만, 처음 읽는 사람 입장에서 "왜 하필 trigger/workflow 조합인가"가
  코드만으로는 드러나지 않는다. 다행히 바로 위 JSDoc(`:108-119`)이 의도(넓어짐 회귀 방지, spec
  exclude 로 인한 소스 파일 배치 이유)를 상세히 설명해 실질적 가독성 문제는 없다. 조치 불요.

### 긍정적 변경 (참고)

- `AuditActionFor<typeof *_RESOURCE_TYPE>` 결속으로 "리소스 타입 상수"와 "감사 액션 prefix
  제약"이 단일 소스에서 파생되게 됐다 — 타입 시스템이 실제로 두 값의 정합을 강제하는 상태로
  개선됐다(이전 라운드 WARNING의 정확한 해소).
- `_NoCrossDomain` 가드는 "좁아지는 방향"만 보장하던 기존 `AuditActionFor` 사용을 "넓어지는
  회귀"까지 컴파일 타임에 잡도록 보완했고, `tsconfig.build.json` exclude 를 피해 spec 이 아닌
  소스 파일에 배치한 것도 근거가 명확하다(장식적 검증이 되지 않도록 하는 실질적 선택).
- `model-config.service.ts` `create()` 의 "커밋 뒤 기록" 주석 보충으로, 4개 서비스 모두 동일한
  트랜잭션-이후-기록 근거 주석 스타일을 갖추게 돼 문서 일관성이 개선됐다.

## 요약

이번 라운드의 실질 변경분(직전 유지보수성 리뷰 이후 커밋 2개)은 전량 이전 리뷰에서 지적된
사항의 해소(WARNING 1건 조치, INFO 1건 조치)와 이를 뒷받침하는 컴파일타임 가드 신설로,
새로운 유지보수성 결함을 도입하지 않았다. 5개 서비스에 걸친 `recordAudit` 보일러플레이트
반복은 의도된 기존 컨벤션의 연장이라 지금 시점에 조치가 필요한 수준은 아니며, 참고용 INFO로만
남긴다. 전반적으로 이 기능은 여러 리뷰 라운드를 거치며 명명·타입 안전성·주석 일관성이 수렴된
상태다.

## 위험도

NONE
