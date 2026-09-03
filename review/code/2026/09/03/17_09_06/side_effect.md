# 부작용(Side Effect) 리뷰

## 검토 범위

리뷰 대상은 (1) 9개 TypeORM 엔티티 파일의 `nullable: true` 컬럼 TS 타입을 `| null` 로 넓히고 일부
`@Column({ type: ... })` 를 명시한 변경, (2) 그 여파로 시그니처를 넓힌
`shared/utils/redact-stored-error.ts`/`.spec.ts`, (3) 추적 plan 문서, (4) 직전 리뷰 라운드
(`16_45_35`)의 산출물이 `review/code/**` 관례에 따라 신규 파일로 커밋된 것. 실제 로직(함수 본문)이
바뀐 곳은 `redact-stored-error.ts` 뿐이고 그마저 타입 시그니처만 넓어졌다 — 아래는 이 렌즈로만
따로 확인한 내용이다.

## 발견사항

- **[INFO]** TypeORM `design:type` 리플렉션 boot-time 부작용 — 이 diff 가 정확히 회피하고 있음을 독립 검증
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (가드, 이 diff 밖) / `codebase/backend/src/modules/executions/entities/execution.entity.ts:35-36,83-84,90-91` (`triggerId`/`executedBy`/`parentExecutionId`, FK 예외 적용 대상)
  - 상세: `string`→`string | null` 로 넓히면 TS 의 `design:type` 메타데이터가 `String` 대신 `Object` 를 방출해 TypeORM 이 부팅 시 `DataTypeNotSupportedError` 로 죽는 실제 부작용 클래스다(가드 주석: "2026-09-03 에 실제로 그렇게 깨뜨렸다. lint·unit·build·`tsc` 가 전부 통과했고 오직 e2e 만 잡았다" — 즉 정적 검사로 원리적으로 못 잡는 런타임 부작용). 이번 diff 는 해당되는 7개 필드(`durationMs`×2, `resourceType`, `endpointPath`, `avatarUrl`, `oauthProvider`, `oauthProviderId`)에 `type: 'varchar'`/`'int'` 를 명시해 회피했고, `triggerId`/`executedBy`/`parentExecutionId` 3개는 같은 파일의 `@JoinColumn` 이 같은 컬럼명을 참조하는 "실측된 예외"(가드 주석 §98-107, `parentNodeExecutionId` 선례로 실측)에 해당해 `type:` 없이도 안전하다. 직접 재실행해 독립 검증했다: `npx jest nullable-type-lie-cast.spec.ts` → **12/12 PASS**, `npx tsc --noEmit` 전체 실행 → 비-`.spec.ts` 소스 에러 **0건**(`.spec.ts` 198건은 기존 ratchet 베이스라인과 정확히 일치, 이 diff 의 신규 회귀 아님).
  - 제안: 조치 불요 — 회피 메커니즘이 가드로 상시 검증되고 있음을 확인. 향후 새 nullable 컬럼을 넓힐 때도 이 가드가 계속 잡아 줄 것.

- **[INFO]** `redactNodeExecutionRowForResponse` 제네릭 제약이 실제로 넓히지 않은 `inputData` 까지 `| null` 로 선언
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:178` (제약 `inputData: Record<string, unknown> | null`) vs `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts:69-70` (`inputData: Record<string, unknown>` — `nullable: true` 자체가 없어 이번 diff 의 대상이 아니었음, `RESOLUTION.md` W1 도 동일하게 확인)
  - 상세: 이 diff 는 `NodeExecution.outputData`/`error` 2개만 `nullable: true` → `| null` 로 넓혔는데(엔티티 자체는 그대로), 제네릭 제약의 `inputData` 필드도 함께 `| null` 로 넓어져 있다. 구조적 타이핑상 비-null `Record<string, unknown>` 은 `Record<string, unknown> | null` 에 대입 가능하므로 유일한 실제 호출부(`executions.service.ts:709`, `ne: NodeExecution`)는 그대로 컴파일·동작하고, `maskIfPresent` 내부 로직(`value == null ? value : mask(value) ?? value`)도 바뀌지 않아 런타임 동작에 영향은 없다. 다만 export 된 함수의 타입 계약이 실제로 어떤 엔티티도 요구하지 않는 폭(`inputData: null` 허용)을 갖게 돼, 나중에 이 제약만 보고 "`inputData` 도 null 이 될 수 있다"고 오독할 여지가 남는다.
  - 제안: 기능적 결함은 아니므로 즉시 조치 불요. 정밀화하려면 제약에서 `inputData` 를 `Record<string, unknown>`(non-null)로 되돌려 실제 엔티티 계약과 1:1 일치시킬 수 있다.

- **[INFO]** 엔티티 필드 폭넓은 `| null` 타입 확장은 컴파일 타임 정합화이며 런타임 부작용 없음
  - 위치: 리뷰 대상 엔티티 9개 파일 전체(`execution.entity.ts`·`knowledge-base.entity.ts`·`node-execution.entity.ts`·`node.entity.ts`·`notification.entity.ts`·`schedule.entity.ts`·`trigger.entity.ts`·`user.entity.ts`·`workflow.entity.ts`)
  - 상세: 이미 DB 컬럼이 `nullable: true` 였으므로 TypeORM 은 이전부터 해당 컬럼에 런타임 `null`/`undefined` 를 반환할 수 있었다 — 이번 diff 는 TS 타입이 그 사실을 뒤늦게 인정하는 것뿐이라 하류 소비 코드의 **실제 null 도달 가능성 자체는 diff 이전과 이후가 동일**하다(신규 위험 생성 아님, 기존 잠재 위험의 가시화). `tsc --noEmit` 재실행으로 비-`.spec.ts` 소스에서 새 컴파일 에러 0건을 직접 확인해, 이 넓힘이 기존 호출부의 암묵적 계약을 깨지 않았음을 검증했다.
  - 제안: 조치 불요.

- **[INFO]** 이전 리뷰 라운드(`16_45_35`) 산출물이 신규 파일로 diff 에 포함됨(`RESOLUTION.md`·`SUMMARY.md`·`_retry_state.json`·11개 per-agent 리포트)
  - 위치: `review/code/2026/09/03/16_45_35/*` (파일 13~25)
  - 상세: `CLAUDE.md` 의 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 저장 관례와 일치하고, `git ls-files`로 확인한 다수의 선행 세션(`14_44_15`·`15_17_01`·`15_36_03`·`16_00_45` 등)도 동일하게 `_retry_state.json`(워크트리 절대경로 포함)을 커밋해 온 기존 패턴이라 이번 diff 가 새로 도입한 부작용이 아니다.
  - 제안: 조치 불요.

## 요약

핵심 부작용 표면은 TypeORM 엔티티 nullable 타입을 실제 DB 상태에 맞추는 기계적 확장과, 그로 인한 `redact-stored-error.ts` 시그니처 확장 두 가지다. 이 클래스의 변경이 과거 실제로 부팅 실패(`DataTypeNotSupportedError`)를 낸 전례가 있으나, 이번 diff 는 그 회피 규칙(명시적 `type:` 추가 또는 검증된 FK-relation 예외)을 정확히 따르고 있음을 가드 테스트(12/12)와 전체 `tsc --noEmit`(비-spec 소스 오류 0건, `.spec.ts` 198건은 기존 ratchet 과 일치) 재실행으로 독립 검증했다. 함수 본문 로직 변경은 없고 타입 시그니처만 넓어졌으며, 유일한 실제 호출부와도 호환된다. 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 변경은 없다. `redactNodeExecutionRowForResponse` 제네릭 제약이 실제로 넓히지 않은 `inputData` 까지 `| null` 로 표기한 사소한 정밀도 불일치가 있으나 기능적 영향은 없다. 리뷰 산출물 신규 파일 추가는 프로젝트 기존 관례와 일치한다.

## 위험도
LOW
