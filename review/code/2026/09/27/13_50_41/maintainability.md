# 유지보수성(Maintainability) 리뷰 — patch-omit-undefined

## 검토 범위

`omitUndefined` 헬퍼(`codebase/backend/src/common/utils/omit-undefined.ts`)를
`workflows.service.ts` · `nodes.service.ts` · `auth-configs.service.ts` 세 곳에 배선하고,
노드 PATCH 응답에서 `workflow` 관계를 떼는 수정. 단위 테스트 3건 추가, 신규 e2e
(`test/patch-partial-body.e2e-spec.ts`), 헬퍼 타입 제약(`NotArray<T>`) 추가, CHANGELOG·plan
문서 갱신을 포함한다. 뮤테이션 검증 없이 정적 리뷰만 수행했다(저장소 파일 수정 없음,
`git status --short` 로 확인할 변경 없음 — 처음부터 코드를 고치지 않았다).

## 발견사항

- **[INFO]** `omitUndefined` 호출 부위 "왜" 주석이 3개 서비스 파일에 거의 동일한 문장 패턴으로 반복된다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `update()` (`Object.assign(workflow, omitUndefined(rest));` 바로 위 두 줄) · `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` (`Object.assign(node, omitUndefined(dto));` 바로 위 두 줄) · `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `update()` (`Object.assign(config, omitUndefined(rest));` 바로 위 두 줄)
  - 상세: 세 곳 모두 "보내지 않은 필드는 뺀다(이유는 `omitUndefined` JSDoc). 빼지 않으면 응답에 `<필드들>`이 null 로 실리고/빠졌다 — `test/patch-partial-body.e2e-spec.ts` 가 고정한다." 형태를 문자 그대로 복붙해 필드명만 바꿨다. plan 문서(`plan/in-progress/patch-omit-undefined.md` §가드를 둘까)가 이미 "정규식/AST 가드는 두지 않고, 이 흩어진 주석 + e2e 값 단언이 대신한다"고 명시적으로 판단해 놓은 트레이드오프라 코드 결함은 아니지만, 넷째 호출부가 같은 형태로 생기면 이 주석도 또 한 번 복붙될 가능성이 높다.
  - 제안: 지금 범위에서 고칠 필요는 없다(plan 이 이미 대안을 검토·기각). 다만 다섯째 호출부가 추가되면 공용 JSDoc 을 가리키는 한 줄로 더 줄이는 것을 고려할 만하다.

- **[INFO]** `NotArray<T>` 타입 트릭이 비직관적이다 — 주석이 없으면 읽기 어렵다
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:1-2`(타입 선언), `:17-19`(사용부 `obj: T & NotArray<T>`)
  - 상세: `T extends readonly unknown[] ? never : unknown` 를 `T` 와 교차시켜 배열이 아니면 `T & unknown = T`(무변화), 배열이면 `T & never = never`(호출 자체를 타입 에러로 만듦)로 만드는 구성이다. 동작은 정확하고 파일 최상단 주석 한 줄과 스펙의 `@ts-expect-error` 캐너리(뮤턴트 T1)로 근거·회귀 모두 있지만, "왜 `unknown` 과 교차시키는가"를 처음 보는 사람은 바로 이해하기 어려운 패턴이다.
  - 제안: 현재 수준의 주석으로 충분해 보이나, 이 패턴이 다른 헬퍼로 확산될 경우 `type NotArray<T> = ...` 옆에 "교차는 no-op, 목적은 배열만 `never` 로 좁히는 것" 한 문장을 추가하면 다음 사람이 재설계 없이 더 빨리 읽는다.

- **[INFO]** 테스트 3곳에서 "DTO 인스턴스를 만들어 일부 필드만 채운다" 패턴이 거의 동일한 형태로 반복된다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts`(`Object.assign(new UpdateAuthConfigDto(), { name: 'renamed' })`) · `codebase/backend/src/modules/nodes/nodes.service.spec.ts`(`Object.assign(new UpdateNodeDto(), { label: 'API Call' })`) · `codebase/backend/src/modules/workflows/workflows.service.spec.ts`(`Object.assign(new UpdateWorkflowDto(), { name: 'Renamed' })`, `Object.assign(new UpdateWorkflowDto(), { settings: new WorkflowSettingsDto() })`)
  - 상세: 각 파일이 서로 다른 서비스·DTO 를 다루므로 공용 헬퍼로 추출해도 이득이 크지 않고(한 줄짜리 패턴), 세 파일 모두 그 줄 바로 위에 "왜 인스턴스로 넘기는가"(useDefineForClassFields) 주석을 반복해 붙여 의도는 분명하다. 결함은 아니고 규모도 작아 조치 불요 수준.
  - 제안: 조치 불요.

## 양호한 점 (참고)

- `nodes.service.ts` `update()` 의 반환 타입을 `Promise<Node>` → `Promise<Omit<Node, 'workflow'>>` 로 좁혀 컴파일 타임에 `workflow` 유출을 막은 것은 타입으로 불변식을 강제하는 좋은 패턴이다.
- 새 코드가 기존 컨벤션(`_type`/`_id`/`_ws`/`_workflow` 형태의 미사용 구조분해 변수 언더스코어 프리픽스, `omitUndefined` JSDoc 을 각주에서 참조)과 일관된다.
- `folders.service.spec.ts` 의 주석 수정(테스트 케이스 문자 «C · E» 인용 → 파일명)은 오히려 유지보수성을 개선한다 — e2e 케이스 알파벳이 바뀌어도 깨지지 않는다.
- 세 서비스의 `omitUndefined` 적용 방식(구조분해 후 나머지에 적용 vs DTO 전체에 바로 적용)이 도메인별로 다르지만, 각 도메인이 별도 처리 필드(`settings`, `config`)를 가지는지 여부에 따른 필연적 차이이며 불필요한 비일관성은 아니다.
- e2e `pick()` 헬퍼, `readChild()` 클로저 등은 이름과 JSDoc 이 목적을 명확히 드러내고 함수가 짧다.

## 요약

세 서비스에 걸친 변경은 작고 국소적이며, 각 호출부에 이유를 설명하는 주석과 그에 대응하는 단위·e2e 값 단언이 함께 붙어 있어 가독성·추적성이 좋다. `omit-undefined.ts` 의 `NotArray<T>` 트릭은 다소 비직관적이지만 문서화·타입 뮤턴트 회귀로 뒷받침된다. 세 서비스 파일에 걸친 주석·테스트 패턴의 소폭 반복이 있으나 plan 문서가 이미 "가드 대신 주석+테스트 관행"을 의도적으로 선택했다고 밝히고 있어 결함이 아니라 트레이드오프다. CRITICAL/WARNING 급 유지보수성 문제는 없다.

## 위험도

LOW
