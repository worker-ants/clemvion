# 요구사항(Requirement) 충족 리뷰 — patch-omit-undefined

## 발견사항

- **[CRITICAL]** `PATCH /workflows/:id` 에 `settings: null`(객체 자체가 null)을 보내면 500 으로 회귀한다 — 고치기 전에는 성공하던 입력
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:255-259` (`if (settings !== undefined) { workflow.settings = { ...(workflow.settings ?? {}), ...omitUndefined(settings) }; }`)
  - 상세: `UpdateWorkflowDto.settings` 는 `@IsOptional() @IsObject() @ValidateNested() @Type(() => WorkflowSettingsDto)` 로 선언돼 있다. class-validator 의 `@IsOptional()` 은 값이 `null` 이어도 검증을 건너뛰므로 `{ "settings": null }` 은 **400 없이 통과**하고, class-transformer 는 `null` 을 `WorkflowSettingsDto` 인스턴스로 승격시키지 않아 `dto.settings === null` 로 남는다. 서비스 코드의 `settings !== undefined` 가드는 `null` 을 걸러내지 못해(둘은 다른 값이다) `omitUndefined(settings)` 가 호출되고, 그 구현은 `Object.entries(obj)` 를 그대로 쓰므로 `Object.entries(null)` 이 `TypeError: Cannot convert undefined or null to object` 를 던진다. 이 예외는 잡히지 않고 전역 `GlobalExceptionFilter`(`@Catch()`) 까지 올라가 `500 INTERNAL_ERROR` 로 응답한다.
    변경 전 코드는 `workflow.settings = { ...(workflow.settings ?? {}), ...settings }` 였고, 객체 리터럴 스프레드 `{...null}` 은 예외 없이 빈 객체로 처리되므로 **같은 입력이 이전에는 조용히 no-op 으로 성공**했다. 즉 이 PR 이 명시적으로 고치려는 바로 그 지점(`settings` 병합)에 새 회귀를 넣었다.
    실측(레포 파일은 건드리지 않고 `/private/tmp/.../scratchpad` 에서 실제 `UpdateWorkflowDto`/`omitUndefined` 를 `ts-node --transpile-only` 로 그대로 import 해 재현, 종료 후 `git status --short` 로 트리 무결 확인함):
    ```
    dto.settings: null === null: true
    validation errors count: 0 []
    settings !== undefined: true
    THREW: Cannot convert undefined or null to object
    ```
  - 이 PR 의 다른 세 호출부(`auth-configs.service.ts` 의 `omitUndefined(rest)` · `configPatch` 는 `if (configPatch && typeof configPatch === 'object')` 로 이미 null-가드, `nodes.service.ts` 의 `omitUndefined(dto)` 는 `dto` 자체가 body 전체라 null 이 될 수 없음, `workflows.service.ts` 의 `omitUndefined(rest)` 도 rest 구조분해라 항상 객체)는 이 문제가 없다 — **`settings` 필드 하나만** 클라이언트가 필드 전체를 명시적으로 `null` 로 보낼 수 있는 유일한 자리라 이 결함에 노출된다. `folderId`·`containerId`·`toolOwnerId` 등 같은 API 표면의 다른 nullable 필드들이 이미 명시적 `null` 전송을 정상 케이스로 지원하는 제품이라(§folderId 주석 "루트로 이동 시 null"), 클라이언트가 `settings: null` 을 시도하는 것은 비현실적 입력이 아니다.
  - 이 PR 의 뮤턴트 표(P1~P4·T1·N1)·e2e 케이스 B(`{ settings: {} }`)·단위 테스트("빈 settings 는 저장된 설정 키를 지우지 않는다", `new WorkflowSettingsDto()` 인스턴스)는 전부 **빈 객체** 입력만 다루고 **`settings` 자체가 null** 인 케이스는 다루지 않아 이 회귀를 잡지 못한다.
  - 제안: `omitUndefined` 헬퍼 자체를 `obj == null ? {} : ...` 로 null-safe 하게 만들거나(다른 세 호출부에는 영향 없음), 호출부에서 `if (settings != null)`(`!==` 대신 `!= null` 로 null 도 함께 배제)로 가드. 후자를 택하면 `settings: null` 의 의미(무시 vs 400 vs 전체 초기화)를 결정해야 한다 — 현재 DTO 선언(`@IsOptional`)상 400 은 나지 않으므로 최소한 "무시"(기존 값 유지) 로 맞추는 것이 이 PR 이 표방하는 "생략 시 불변" 원칙과 가장 가깝다. 회귀 테스트로 `PATCH { settings: null }` 케이스를 e2e/단위에 추가할 것.

- **[INFO]** e2e 케이스 C 가 `toolOwnerId` 를 라운드트립 검증하지만 결코 non-null 값으로 설정하지 않아 그 필드만 실질적으로 검증되지 않는다
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts` (케이스 C, `keys` 배열에 `'toolOwnerId'` 포함 — `child` 생성 바디에는 `toolOwnerId` 를 보내지 않음)
  - 상세: `description`·`containerId` 는 `expect(stored.description).toBe('memo')` / `expect(stored.containerId).toEqual(expect.any(String))` 로 "픽스처가 실제로 값을 갖고 있는지"를 먼저 확인한다(파일 docblock 이 이 순서 자체를 판정의 일부라고 명시). 그러나 `toolOwnerId` 는 그런 사전 단언이 없고 생성 시에도 채워지지 않으므로, PATCH 전후 값이 계속 `null`(또는 `undefined`)로 남아 "덮어써짐" 여부를 실제로 가르지 못한다 — 이 필드에 한해서는 결함이 재발해도 이 e2e 가 통과할 수 있다.
  - 제안: `child` 생성 바디에 `toolOwnerId`(다른 노드 UUID)를 채우고, `containerId`/`description` 처럼 사전 단언을 추가.

## 확인 사항 (양성 확인 — 문제 없음)

- `omitUndefined` 헬퍼의 `NotArray<T>` 타입 제약이 실제로 배열 인자를 컴파일 타임에 거부하는지 `tsc --noEmit --strict --skipLibCheck` 로 직접 재현해 확인함(레포 밖 scratch 파일) — `@ts-expect-error` 가 정확히 소비되고 정상 호출은 통과. plan 의 뮤턴트 T1(제약 제거 시 TS2578) 주장과 일치.
- `nodes.service.ts` `update()` 의 `Omit<Node, 'workflow'>` 반환 + `const { workflow: _workflow, ...response } = saved;` — `NodeDto` 에 `workflow` 필드가 없음을 `node-response.dto.ts` 에서 직접 확인, 응답 인터셉터에 `ClassSerializerInterceptor`/`excludeExtraneousValues` 류의 자동 필드 스트립이 없어(코드베이스 전수 grep) 고치기 전에는 실제로 부모 워크플로 행 전체가 JSON 으로 나갔을 것이라는 plan 의 주장이 타당함을 확인. 호출부는 컨트롤러 1곳뿐이라 다른 소비처 영향 없음.
- `auth-configs.service.ts` 의 `configPatch`(nested `Record<string, unknown>`, `@Type()` 미사용) 는 클래스 인스턴스가 아니라 실제 전송된 키만 own-property 로 가지므로 `Object.entries(configPatch)` 에 `undefined` 오염이 없다 — `omitUndefined` 를 그 자리엔 적용하지 않은 것이 맞다.
- `workflows.service.ts`/`nodes.service.ts`/`auth-configs.service.ts` 세 `update()` 모두 `omitUndefined(rest 또는 dto)` 뒤 `Object.assign` 하는 패턴이 일관되고, DTO 인스턴스 전달 시나리오(신설 단위 테스트가 `Object.assign(new XxxDto(), {...})` 로 실제 요청 형태를 재현)와 맞아떨어짐.
- CHANGELOG.md 항목(워크플로/노드/인증설정 PATCH 응답 정정 + `settings: {}` DB 삭제 결함 + 노드 `workflow` 누출)이 실제 diff·plan 실측 표와 문구 수준에서 일치.
- `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(`swagger-dto-contract.spec.ts`) 에 `WorkflowDto.description/folderId`, `NodeDto.description/containerId/toolOwnerId`, `AuthConfigDto.ipWhitelist` 가 실제로 동결돼 있어, plan 이 "계약 대조만으로는 A·C·D 를 못 잡는다"며 e2e 에서 **값**을 단언하기로 한 설계 판단이 근거 있음을 확인.
- spec fidelity: 이 PR 이 건드리는 세 API(`PATCH /workflows/:id`, `/nodes/:id`, `/auth-configs/:id`)의 "생략=불변" tri-state 계약은 `spec/2-navigation/2-trigger-list.md` 에만 명시돼 있고 `1-workflow-list.md`/`6-config.md`/`3-workflow-editor/1-node-common.md` 에는 없다 — 이미 이번 세션의 `--impl-prep` consistency-check(`review/consistency/2026/09/27/13_11_33`, WARNING #2/#4)가 포착해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (6)(7)(8)에 반영·트래킹 중이므로 중복 지적하지 않음(회색지대, 코드 fix 를 막을 사유 아님).

## 요약

`omitUndefined` 헬퍼를 세 서비스(workflows/nodes/auth-configs)의 PATCH 병합에 적용해 "보내지 않은 필드가 응답에서 null/키-누락으로 나타나는" 결함과 "워크플로 `settings: {}` 가 저장된 키를 DB 에서 지우는" 결함을 고치려는 의도는 코드·테스트·CHANGELOG·plan 전체가 일관되게 뒷받침하며, 노드 PATCH 응답의 `workflow` 관계 누출 부수 수정도 근거가 명확하고 실측(계약 대조 실패 로그)으로 뒷받침된다. 다만 이 PR 이 직접 건드린 `workflows.service.ts` 의 `settings` 병합 분기에서 `omitUndefined` 를 null-비가드 상태로 호출해, 고치기 전에는 조용히 성공하던 `PATCH { settings: null }` 요청이 이제 처리되지 않은 `TypeError` 로 500 을 반환하는 새 회귀를 실측으로 확인했다(레포 밖에서 실제 DTO/헬퍼로 재현, 저장소는 무변경). 이 자리는 세 호출부 중 "필드 전체가 명시적으로 null 이 될 수 있는" 유일한 경우라 다른 두 호출부에는 해당하지 않는다. 이 CRITICAL 하나를 제외하면 기능 완전성·반환값·에러 경로·spec 정합은 양호하다.

## 위험도

HIGH
