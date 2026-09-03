# 부작용(Side Effect) 리뷰

## 대상

`nullable: true` DB 컬럼인데 TS 타입이 non-null 이던 9개 엔티티 파일(30 필드: column 24 · relation 6)을
`| null` 로 넓히고, 그 과정에서 `@Column` 에 명시 `type:` 이 없던 자리(누락 시 `design:type` 이
`Object` 로 방출돼 부팅 실패)에 `type:` 을 보강한 배치 2. 부수로 `shared/utils/redact-stored-error.ts`
의 `maskIfPresent` 시그니처·`redactNodeExecutionRowForResponse` 제네릭 제약을 넓히고, docstring 의
반증된 전제를 취소선 정정. `plan/in-progress/entity-nullable-column-type-mismatch.md` 는 진행 기록.

## 검증 절차 (저장소 무변경 — 읽기·`tsc`·`jest` 실행만, 파일 mutation 없음)

- `git diff --stat HEAD~1 -- codebase/backend` 로 diff 범위가 프롬프트의 11개 파일과 정확히 일치함을 확인.
- `codebase/backend/src/app.module.ts:112`, `src/scripts/encrypt-auth-config.ts:53`,
  `src/modules/knowledge-base/eval/eval-cli.module.ts:49` 전수 `synchronize: false` 확인 — 이 타입 변경이
  배포 시 TypeORM 자동 DDL(스키마 drift)을 유발할 경로가 없음.
- `npx tsc --noEmit -p tsconfig.json` 전체 실행 — 변경된 9개 엔티티 파일·`redact-stored-error.ts` 관련
  신규 에러 **0건** (기존 에러는 전부 이 diff 와 무관한 다른 모듈: `ai-turn-executor.spec.ts`,
  `cafe24-mcp-tool-provider.spec.ts`, `carousel/*.spec.ts` 등 — 정규식으로 대상 파일명 grep, 매치 0).
- `npx jest src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` — 12/12 통과 (`findUntypedNullableColumns`
  / `countNullAsUnknownAsCasts` 가드가 이 diff 산출물에 대해 위반 0건으로 판정).
- `redactNodeExecutionRowForResponse`/`redactStoredFieldsForResponse` 호출부 3곳(`explore-tools.service.ts`,
  `executions.service.ts`, `background-runs/background-runs.service.ts`) 확인 — 제네릭 제약 완화(narrower →
  wider)라 기존 호출자와 호환.
- 작업 후 `git status --short` — 저장소에 리뷰로 인한 잔여 변경 없음(신규 review 산출물 디렉터리 외 없음).

## 발견사항

- **[INFO]** relation 필드를 `X | null` 로 넓혔으나 TypeORM 의 "join 되지 않은 관계 = `undefined`" 케이스는
  여전히 타입에 반영되지 않음
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:40`(`trigger`),
    `:88`(`executor`), `:95`(`parentExecution`); `codebase/backend/src/modules/nodes/entities/node.entity.ts:71`(`container`),
    `:78`(`toolOwner`); `codebase/backend/src/modules/workflows/entities/workflow.entity.ts:43`(`folder`)
  - 상세: `@ManyToOne(..., { nullable: true })` 관계는 FK 가 NULL 인 경우(join 됐을 때) `null` 이 오지만,
    쿼리가 그 관계를 아예 join 하지 않은 경우 TypeORM 은 속성 자체를 채우지 않아 런타임에 `undefined` 가
    관측될 수 있다. 이번 diff 는 `Trigger`(non-null, **더 부정확**)에서 `Trigger | null`(부분 개선)로
    바꿨을 뿐 `undefined` 경로는 여전히 타입 밖이다 — **이 diff 가 만든 회귀는 아니고 순수 개선**이지만,
    "타입이 이제 실제를 정확히 반영한다"는 인상을 줄 수 있어 완전하지 않다는 점을 기록한다.
  - 제안: 조치 불요(범위 밖 — plan 자체가 "relation 은 `| null` 관례로 확립됨"이라 결론 내렸고 이 배치의
    술어에 부합). 다만 이 6개 relation 을 역참조하는 소비 코드가 `=== null` 만 검사하고 `=== undefined`
    를 놓치는 자리가 있는지는 이 diff 밖의 별도 감사 대상.

- **[INFO]** 9개 엔티티 파일에 걸친 필드 타입 확장은 표면적으로 넓은 blast radius 지만, 실측으로 부작용
  경로가 전부 차단돼 있음을 확인
  - 위치: 리뷰 대상 파일 1~9 전체(`execution.entity.ts`, `knowledge-base.entity.ts`, `node-execution.entity.ts`,
    `node.entity.ts`, `notification.entity.ts`, `schedule.entity.ts`, `trigger.entity.ts`, `user.entity.ts`,
    `workflow.entity.ts`)
  - 상세: DB 는 이미 `nullable: true`(마이그레이션 변경 없음 — 이 diff 에 `.sql` 파일 없음), `synchronize: false`
    확인, `tsc` 신규 에러 0건, 회귀 가드(`nullable-type-lie-cast.spec.ts`) 통과. 즉 이 변경은 런타임 동작을
    바꾸지 않고 이미 존재하던 null 처리 코드(예: `User.validatePasswordHashFormat` 의 `=== null` 검사,
    `maskIfPresent` 의 `== null` 가드)에 타입을 뒤늦게 맞춘 것으로 확인됨.
  - 제안: 없음(정보성 확인).

- **[INFO]** `redact-stored-error.ts` 의 시그니처 변경은 방향성이 안전 쪽(수용 타입 확대)
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` 함수 `maskIfPresent`,
    `redactNodeExecutionRowForResponse` 제네릭 제약
  - 상세: `maskIfPresent` 는 파일-로컬(비-export) 헬퍼라 외부 호출자 영향 없음. `redactNodeExecutionRowForResponse`
    는 export 되지만 제네릭 제약이 `Record<string, unknown>` → `Record<string, unknown> | null` 로
    **완화**되어 기존에 그 제약을 만족하던(non-null) 호출자는 여전히 만족한다 — breaking 아님. 런타임 로직(`==
    null` 가드)은 변경 없음, 이미 이 값이 실제로 null/undefined 일 수 있음을 전제하고 있었다(docstring 취소선
    정정이 그 사실을 명시).
  - 제안: 없음(정보성 확인).

## 요약

이번 변경은 이미 DB 에서 nullable 이던 컬럼의 TS 타입을 뒤늦게 `| null` 로 맞추고, 그로 인해 필요해진
`@Column({ type: ... })` 명시를 보강한 순수 타입-정합화 작업이다. `synchronize: false`(app.module.ts:112 등
3곳 확인)로 배포 시 자동 스키마 변경 경로가 없고, `tsc` 전체 실행 결과 이 변경으로 인한 신규 컴파일 에러가
0건이며, 전용 회귀 가드(`nullable-type-lie-cast.spec.ts`, 12/12)도 통과해 "타입만 넓혔더니 부팅이 깨졌다"는
이 작업 자체의 배치 1 교훈(런타임 메타데이터 `Object` 이슈)이 배치 2에서는 재발하지 않았음을 실측으로 확인했다.
`redact-stored-error.ts` 의 함수 시그니처·제네릭 제약 변경은 전부 "허용 타입 확대" 방향이라 기존 호출자와
호환되고, 런타임 마스킹 로직 자체는 그대로다. 유일하게 남는 관찰은 relation 필드(`trigger`/`executor`/
`parentExecution`/`container`/`toolOwner`/`folder`)의 `| null` 타입이 TypeORM 의 "관계 미-join 시 `undefined`"
경로까지는 여전히 표현하지 못한다는 점인데, 이는 이 diff 가 만든 회귀가 아니라 기존보다 개선된 상태이고
plan 문서 자체가 relation 을 `| null` 관례로 확정한 배치 범위 안의 결정이다. 파일시스템 부작용, 전역 상태
변경, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
