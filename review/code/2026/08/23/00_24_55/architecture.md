### 발견사항

- **[WARNING]** `@Body()` 인라인 타입과 `ExecuteWorkflowDto` 가 같은 형태를 손으로 두 번 선언 — 파생 관계를 강제하는 컴파일-타임/테스트 장치가 없다.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:39` (`parameterValues?: Record<string, unknown>;`), `:58` (`input?: Record<string, unknown>;`) ↔ `codebase/backend/src/modules/workflows/workflows.controller.ts:281-285` (`@Body() body?: { input?: ...; parameterValues?: ...; }`)
  - 상세: 이 PR 의 전체 설계 의도는 "DTO 는 문서 전용, `@Body()` 는 인라인 타입 유지"이고 그 이유는 docstring 에 충분히 설명돼 있다(파이프 진입 방지). 다만 그 결과로 **같은 요청 본문 형태가 두 곳에 각각 손으로 선언**된다 — `ExecuteWorkflowDto` 의 필드 목록과 인라인 타입의 필드 목록이 지금은 일치하지만, 이를 강제하는 장치는 없다. 다음 사람이 인라인 타입에 필드를 하나 추가(혹은 삭제)하면서 `ExecuteWorkflowDto` 갱신을 잊어도 컴파일도, 신설된 캐너리 테스트(`workflows-execute-body.spec.ts`)도 잡지 못한다 — 그 테스트는 "필드 A/B 가 존재하고 마커 문구를 포함하는가"만 보지, "DTO 필드 집합과 실제 `@Body()` 가 받는 필드 집합이 일치하는가"는 보지 않는다. 이 PR 이 막으려는 문제(문서-런타임 계약 drift)와 같은 종류의 리스크가 반대 방향(런타임이 문서보다 넓어짐)으로 열려 있다.
  - 제안: 인라인 타입을 손으로 재선언하는 대신 `Pick<ExecuteWorkflowDto, 'parameterValues' | 'input'>` 처럼 **타입만 참조**하는 방식을 검토한다. TypeScript 의 `emitDecoratorMetadata` 는 클래스를 직접 참조하는 타입 위치에서만 그 클래스를 런타임 값으로 내보내고, `Pick<>` 같은 매핑 타입은 `Object` 로 폴백되므로 — 지금 이 PR 이 지키려는 "metatype 이 `Object` 라 파이프가 skip 된다"는 성질을 깨지 않으면서 두 선언을 하나의 SoT 로 합칠 수 있다(도입 전 `design:paramtypes` 로 실측 확인 권장).

- **[INFO]** `ExecuteWorkflowDto` 라는 이름이 "검증되는 요청 DTO" 라는 일반적 기대를 유도한다 — 실제로는 class-validator 데코레이터가 전혀 없는 문서 전용 클래스.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:30` (`export class ExecuteWorkflowDto`)
  - 상세: 저장소 컨벤션상 `*.dto.ts` / `*Dto` 이름은 통상 `@Body()` 파라미터 타입 및 validation pipe 대상을 의미한다. 이 클래스는 의도적으로 그 관례를 어기며, docstring + 두 캐너리 테스트로 오용(파라미터 타입으로 승격)을 막아 뒀다. 이미 이전 리뷰 라운드(`00_07_27` INFO#3)에서 이름 접미사 추가 여부가 논의됐고 "테스트가 강제한다"는 이유로 보류가 결정된 사안이라 재차단할 사안은 아니지만, 아키텍처 관점에서는 **이름이 구조를 통해 오용을 막지 못하고 테스트가 유일한 방어선**이라는 점은 기록해 둘 가치가 있다 — 테스트 파일이 삭제되거나 스킵되면 방어가 사라진다.
  - 제안: 현 결정(캐너리 테스트로 방어)을 유지하되, 이 클래스가 유일한 인스턴스가 아니게 될 경우(문서 전용 DTO 패턴이 반복될 경우) 공통 명명 규약(`*SchemaOnlyDto` 등) 또는 린트 규칙으로 격상하는 것을 고려.

### 요약

변경 범위는 프레젠테이션(OpenAPI 문서화) 레이어에 한정되어 있고 비즈니스/데이터 레이어에는 손을 대지 않아 레이어 책임 분리가 잘 유지된다. `ExecuteWorkflowDto` 는 단일 책임(스키마 메타데이터 보유)만 지니며 순환 의존성이나 모듈 경계 침범은 없다. 다만 "DTO 는 문서 전용, `@Body()` 는 인라인 타입 유지"라는 설계 선택의 대가로 동일한 요청 본문 형태가 두 곳에 중복 선언되며, 이 중복을 강제로 동기화하는 컴파일-타임 장치가 없다는 점이 유일한 구조적 약점이다(테스트는 필드 존재/문구만 보고 형태 일치는 보지 않는다). `Pick<>` 기반 타입 참조로 SoT 를 하나로 합치는 안을 제안한다. 클래스 명명이 일반 관례(검증되는 DTO)와 어긋나는 점은 이미 캐너리 테스트로 충분히 방어되고 있어 낮은 위험으로 판단한다.

### 위험도
LOW
