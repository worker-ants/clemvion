# 아키텍처(Architecture) 리뷰 — patch-omit-undefined

## 발견사항

- **[WARNING]** 응답 형태(shape) 를 강제하는 구조적 경계가 없다 — `NodesService.update()` 의 `workflow` 필드 제거가 서비스 계층의 수동 destructuring 으로만 처리됨
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:58`(`Promise<Omit<Node, 'workflow'>>`), `:80-83`(`const { workflow: _workflow, ...response } = saved;`) / `codebase/backend/src/common/interceptors/transform.interceptor.ts:19-31`
  - 상세: 이 PR 이 고친 결함(IDOR 검사용으로 함께 읽은 `workflow` 관계가 응답에 통째로 실림)의 근본 원인은 "서비스가 반환하는 객체가 곧 HTTP 응답 바디가 된다"는 이 코드베이스의 구조다. `TransformInterceptor` 는 `{ data }` 로 감쌀 뿐 필드를 선별하지 않고(`transform.interceptor.ts:24-29`), `@ApiOkWrappedResponse(NodeDto, …)` 는 Swagger 문서화 데코레이터일 뿐 런타임 직렬화를 강제하지 않는다(`ClassSerializerInterceptor`·`excludeExtraneousValues` 류가 이 코드베이스에 없음을 확인). 즉 "응답에 어떤 필드가 실리는가"는 프레임워크 레벨의 화이트리스트가 아니라 각 서비스 메서드가 반환 직전 수동으로 맞추는 관례에 의존한다. 같은 결함 클래스(로드용으로 조인한 관계·컬럼이 그대로 새 나가는 것)가 이미 폴더·트리거에서 있었고(이번엔 `undefined` 필드 관련), 이번엔 `nodes` 의 `workflow` 관계로 재발했다 — 프레임워크가 못 잡고 e2e 계약 대조(`assertMatchesContract`)가 뒤늦게 잡는 구조다. 이번 수정 자체(구조분해로 필드 제외)는 국소적으로 맞지만, 다음에 다른 서비스가 내부 검증용으로 relation 을 eager-load 하고 그대로 반환하면 같은 유형의 결함이 또 재발할 수 있는 여지가 구조적으로 남아 있다.
  - 제안: 지금 당장 구조를 바꿀 필요는 없다(이 PR 의 축이 아님). 다만 "서비스가 반환하는 엔티티 = 응답 바디"라는 이 구조적 특성 자체를 별도 항목으로 인지해 두면, 향후 유사한 relation-eager-load 패턴에서 같은 결함이 반복되는 것을 설계 단계에서 막을 수 있다(예: 응답 전용 매퍼 함수 도입 또는 `class-transformer` 화이트리스트 직렬화).

- **[INFO]** `omitUndefined` 의 PATCH 불변식(undefined 값 필드는 병합에서 제외)이 단일 강제 지점 없이 호출부마다의 관례로 유지됨 — 이미 plan 이 인지·결정한 트레이드오프
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts`(전체) 를 `codebase/backend/src/modules/workflows/workflows.service.ts:247`, `codebase/backend/src/modules/nodes/nodes.service.ts:78`, `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:245`, `folders.service.ts`, `triggers.service.ts` 5곳이 각자 호출
  - 상세: `Object.assign(entity, dto)` 형태로 PATCH 병합을 하는 새 서비스 메서드가 추가될 때 `omitUndefined` 를 빠뜨려도 컴파일·린트가 잡지 못한다 — 계약은 JSDoc·인접 주석("이유는 `omitUndefined` JSDoc")과 각 호출부 pinning 테스트로만 유지된다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이미 이 지점을 검토해 "가드는 두지 않았다 — 남은 `Object.assign(` 4곳이 전부 다른 형태고 결함은 타입 문제라 정규식으로 못 가른다"는 근거를 명시적으로 남겼으므로, 이 리뷰에서 가드 신설을 재요구하지는 않는다.
  - 제안: 조치 불요(이미 검토·결정됨). 참고로만 남김 — 같은 지적이 반복되지 않도록.

- **[INFO]** `NotArray<T>` 타입 가드는 실제 호출부 어디에도 배열을 넘기지 않는 이론적 방어 — 근거는 JSDoc·단위테스트로 문서화되어 수용 가능
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:6`(`type NotArray<T> = T extends readonly unknown[] ? never : unknown;`), `:21-23`(함수 시그니처 `obj: T & NotArray<T>`)
  - 상세: 조건부 타입을 이용해 배열 인자를 컴파일 타임에 차단하는 다소 정교한 타입 레벨 장치다. `NotArray` 는 모듈 밖으로 export 되지 않아 캡슐화는 잘 되어 있고(공개 API 표면은 `omitUndefined` 함수 하나), 5개 실제 호출부(`folders`·`triggers`·`workflows`(rest/settings)·`nodes`·`auth-configs`) 모두 일반 객체(DTO 파생 `rest` 또는 `Partial<Entity>`)만 넘겨 이 가드가 실제로 걸릴 케이스는 없다. 즉 현재 없는 오용을 막기 위한 선제적 타입 복잡도 추가지만, JSDoc(`:1-5`)이 왜 필요한지(구현이 배열을 인덱스 키 객체로 무너뜨림)를 명확히 설명하고 `omit-undefined.spec.ts` 에 `@ts-expect-error` 캐너리까지 둬서 근거·유지보수성 모두 확보했다.
  - 제안: 조치 불요 — 현재 수준의 문서화·테스트 커버리지면 이 타입 복잡도는 정당화된다.

- **[INFO]** `settings` 하위 값의 명시적 `null`(예: `{ maxConcurrentExecutions: null }`)에는 top-level 필드와 다른 tri-state 규약이 적용됨 — 계층마다 규약 적용 범위가 다름
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:257-262`
  - 상세: top-level DTO 필드는 "명시적 `null` = 값을 지운다"(§5.4 tri-state) 는 이번 PR 의 신규 테스트(`명시적 null 은 로드한 값을 지운다`)로 고정됐다. 그런데 `settings` 객체 내부의 개별 키에 `null` 을 보내는 경우(`omitUndefined(settings)` 는 `undefined` 만 걸러내고 `null` 은 그대로 스프레드에 포함시킨다)는 같은 tri-state 의미가 적용되는지, 아니면 애초에 `WorkflowSettingsDto.maxConcurrentExecutions`(non-nullable `number` 타입, `@IsOptional()`)가 `null` 입력을 허용하는지 여부와 무관하게 이 PR 의 신규 테스트 두 건(빈 `settings: {}`, `settings: null` 전체)에는 포함되지 않는 경계다. 아키텍처 관점에서는 "PATCH 시 필드 생략=불변, 명시 null=삭제"라는 하나의 규약이 top-level 엔티티 필드와 JSONB 내부 값 객체 필드에 서로 다른 강도로 적용되고 있다는 추상화 불일치를 보여준다.
  - 제안: 이 PR 의 축을 벗어나는 세부 동작(값 레벨 검증)이므로 이 리뷰에서 차단 사유로 보지는 않는다. 다만 `WorkflowSettingsDto` 확장 시(신규 nullable 설정 키 추가) 이 경계가 명시적으로 설계돼야 함을 남겨 둔다.

## 요약

이번 diff 는 기존 `omitUndefined` 공용 헬퍼를 워크플로·노드·인증설정 세 서비스로 일관되게 확장한 국소적 버그 수정으로, 순환 의존성 없이(`common/utils` → 각 feature 모듈의 단방향 참조) 기존 관례(주석 스타일, pinning 테스트, JSDoc)를 그대로 따랐다. 병합 정책(단순 필드는 `Object.assign`, `settings` 는 JSONB 병합)의 구분은 엔티티의 실제 구조 차이를 반영한 정당한 설계이며, 5개 호출부를 하나의 `patchEntity` 헬퍼로 더 묶지 않은 결정도 각 서비스가 갖는 부가 로직(비밀값 보호, 락, IDOR 검사)이 서로 달라 타당하다. 유일하게 남는 구조적 관찰점은 `NodesService.update()` 가 고친 결함의 근본 원인 — 이 코드베이스에 응답 DTO 를 강제하는 직렬화 계층(`ClassSerializerInterceptor` 등)이 없어 서비스가 반환하는 엔티티 형태가 곧 API 응답이 되는 구조 — 로, 이번엔 정확히 고쳤지만 같은 클래스의 결함이 구조적으로 재발할 여지가 남아 있다는 점이다. 이는 이 PR 의 범위를 넘는 기존 아키텍처 특성이라 차단 사유는 아니다. CRITICAL 급 SOLID·결합도·순환 의존성 위반은 발견되지 않았다.

## 위험도

LOW
