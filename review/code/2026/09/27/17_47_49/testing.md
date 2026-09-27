# 테스트(Testing) 리뷰 — patch-null-validation

## 발견사항

- **[WARNING]** `PATCH /api/model-configs/:id` 는 이 PR 이 `UpdateModelConfigDto` 의 4개 필드(`provider`·`name`·`defaultModel`·`defaultParams`)를 `@IsOptional()` → `@IsOptionalNonNull()` 로 바꾸는데, **유효한(non-null) 값으로 이 라우트를 PATCH 하는 e2e/통합 테스트가 저장소 어디에도 없다.**
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:91-99`(픽스처 생성) · `:219-238`(모델 설정 케이스 4건) — 이 신규 파일이 이 라우트를 건드리는 유일한 e2e 인데, 4건 전부 `{ field: null }` → 400 만 검증한다. `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:44`(`UpdateModelConfigDto` 표 행)도 null·키생략만 본다.
  - 상세: `grep -rl "model-configs/\${" codebase/backend/test/*.e2e-spec.ts` 결과 이 신규 파일 하나뿐이었다. `model-config.controller.spec.ts:196-216` 의 `update` 테스트는 서비스를 mock 하고 `controller.update()` 를 직접 호출해 실제 NestJS validation pipe(class-validator)를 타지 않는다 — 즉 `UpdateModelConfigDto` 가 **정상 값으로 실제로 통과하는지**를 검증하는 자동화 테스트가 unit·e2e 어디에도 없다. 다른 12개 라우트(폴더·워크플로·노드·트리거·알림·테스트데이터셋·인증설정·통합·지식베이스·워크스페이스 설정·users/me·어시스턴트 세션)는 각각 별도 e2e 파일(`folder-crud`·`workflow-crud`·`alerts-threshold-wire-type`·`schedule-trigger`·`knowledge-base`·`integration-credentials` 등)이 유효 값 PATCH 를 이미 커버하고 있어 이번 데코레이터 교체의 회귀 안전망 역할을 하지만, model-configs 만 그 안전망이 비어 있다. 이 PR 자체가 도입한 결함은 아니지만(사전부터 있던 갭), 정확히 이 PR 이 그 DTO 의 검증기를 건드리는 시점이라 회귀를 잡을 장치가 없는 상태로 남는다.
  - 제안: `patch-null-rejection.e2e-spec.ts` 에 (또는 별도 파일에) `{ name, defaultModel, defaultParams }` 등 유효 값으로 PATCH 해 200 을 확인하는 케이스 하나를 추가해, `IsOptionalNonNull` 이 정상 경로를 깨지 않음을 실측으로 고정한다.

- **[INFO]** 다중 필드가 동시에 `null` 인 요청은 어느 계층에서도 테스트되지 않는다 — unit·e2e 모두 한 번에 한 필드만 `null` 로 보낸다(`patch-null-rejection.spec.ts` 의 `constraintsFor` 는 매번 `{ [field]: null }` 단일 키, e2e `cases` 도 동일 패턴).
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:70-79`(`constraintsFor`), `codebase/backend/test/patch-null-rejection.e2e-spec.ts:246-260`(`it.each(cases)`)
  - 상세: class-validator 는 프로퍼티별로 독립 검증하므로 이론적 위험은 낮지만, `details[]` 배열이 **여러 필드가 동시에 null 일 때도 전부 담기는지**(예: 워크플로 `{ name: null, isActive: null, tags: null }` 한 번에)는 실측되지 않았다. `GlobalExceptionFilter`/`CustomValidationPipe` 가 `class-validator` 에러 배열을 그대로 `details[]` 로 매핑한다면 문제 없겠지만, 그 매핑 로직 자체는 이 PR 의 변경 범위 밖이라 이번 테스트 스위트로는 검증되지 않는다.
  - 제안: 우선순위 낮음. 매핑 계층이 이미 다른 다중-필드 400 시나리오(예: 여러 `@MaxLength` 위반)에서 검증돼 있다면 생략 가능.

- **[INFO — 강점]** `patch-null-rejection.spec.ts:82-84` 의 `expect(CASES).toHaveLength(43)` 전제 테스트는 "열거 축이 전수를 결정한다" 류의 실수(표가 조용히 줄어드는 것)를 막는 좋은 가드다. 새 NOT NULL 필드가 추가돼도 이 표에 자동으로 들어오지 않는다는 한계는 파일 주석(`patch-null-rejection.spec.ts:28-30`)에 스스로 명시돼 있어 투명하다.

- **[INFO]** `optional-non-null.spec.ts:44-46` 가 거부 메시지 문자열(`'name must not be null — omit the field to keep the current value'`)을 정확히 일치로 단언한다. 데코레이터가 메시지 템플릿(`$property`)을 한 곳에서만 정의하는 작은 유틸이라 지금은 무해하지만, 문구를 i18n 하거나 톤을 바꾸는 후속 작업이 있으면 이 테스트가 가장 먼저 깨질 자리라는 점만 표시해 둔다 — 조치 불필요, 참고용.

- **[관찰 — 회귀 처리 우수]** `codebase/backend/src/modules/users/dto/update-me.dto.spec.ts:34-41` — 종전 결함(저장 500)을 고정하던 테스트(`theme=null 은 optional 통과`)를 발견해 기대값 자체를 반전시키고, 왜 바뀌었는지 인접 주석에 원인(NOT NULL 컬럼)과 근거 파일(e2e)을 남겼다. 프로젝트 관례(결함을 고정하던 테스트를 조용히 삭제하지 않고 이유와 함께 반전)를 정확히 따른다. 다른 15개 DTO 에 대해서도 `null` 을 `toHaveLength(0)` 으로 단언하던 기존 spec 이 있었는지 확인했으나(`node-dto-validation.spec.ts`·`workflow-dto-validation.spec.ts`·`update-workspace-settings.dto.spec.ts` 등 grep), 전부 이 PR 이 건드리지 않는 nullable 필드(`description`·`folderId`·`containerId`·`settings` 등)에 대한 것이라 충돌·stale 회귀는 없었다.

- **[관찰 — 설계 적절]** `optional-non-null.spec.ts` 는 프로덕션 DTO 를 재사용하지 않고 전용 `Probe` 클래스로 데코레이터 자체의 일반 동작(키 생략 통과·null 거부·값 통과·복합 에러 조합)을 검증하고, `patch-null-rejection.spec.ts` 는 43개 실제 DTO 필드가 "그 데코레이터를 실제로 달고 있는가" 만 표로 확인한다 — 책임 분리가 깔끔해 각 레이어가 무엇을 보장하는지 명확하다. 두 테스트 모두 mock 없이 `class-validator`/`class-transformer` 를 실물 그대로 사용해 실제 런타임 동작과의 괴리가 없다.

- **[관찰 — 뮤테이션 검증]** plan(`plan/in-progress/patch-null-validation.md` §뮤턴트)에 기록된 M1~M4 는 데코레이터가 다시 느슨해지는 경우(M1)·메시지만 사라지는 경우(M2)·개별 필드 하나만 되돌아가는 경우(M3·M4)를 각각 겨냥해 KILLED 를 실측했다 — "실측 없는 뮤턴트 주장" 이 아니라 죽인 테스트명까지 표에 남겨 재현 가능하다. e2e(`patch-null-rejection.e2e-spec.ts`)도 고치기 전 코드로 먼저 돌려 RED(500 31·409 1·200 1)를 기록한 뒤 고쳐서 GREEN 으로 전환하는 순서를 지켰다 — vacuous test 위험(전제 미확인)을 스스로 배제했다.

- **[관찰 — 테스트 격리]** e2e 파일의 `beforeAll` 은 `uniqueEmail`/`uniqueName` 으로 격리된 계정·워크스페이스·리소스를 생성하고, 이후 `it.each` 케이스들은 모두 400 거부만 확인해 실제 상태 변경이 일어나지 않으므로 케이스 간 순서 의존이 없다. `maxWorkers: 1`(`test/jest-e2e.json`)과 결합해 안전하다.

## 요약

핵심 로직(`IsOptionalNonNull` 데코레이터)과 43필드 전수는 단위·e2e·뮤테이션 세 layer 로 두텁게 검증됐고, 결함을 고정하던 기존 테스트(`update-me.dto.spec.ts`)도 올바르게 반전시켰다. mock 사용이 없고 실제 검증기·실제 HTTP 요청을 쓰는 점, "표가 43개인가" 를 스스로 재확인하는 전제 테스트, 고치기 전/후 실측을 남긴 점 모두 이 프로젝트가 요구하는 수준을 충족한다. 다만 이 PR 이 검증기를 바꾼 13개 라우트 중 `model-configs` 하나만은 정상(non-null) 값으로 PATCH 하는 테스트가 unit·e2e 어디에도 없어 — 이 PR 로 인한 회귀든 향후 회귀든 — 그 라우트의 happy path 가 깨져도 잡아낼 안전망이 없다. 그 외에는 새로 발견된 중대한 커버리지 갭이나 취약한 mock 은 없었다.

## 위험도

LOW
