### 발견사항

- **[INFO]** `ExecutionDto.triggerSource` JSDoc이 스펙 문서 경로를 참조하지만 `triggerLabel`은 설명이 미흡
  - 위치: `execution-response.dto.ts:31–40`
  - 상세: `triggerSource` 주석은 우선순위와 spec 경로를 모두 명시해 충분하나, `triggerLabel`의 "출처 보조 라벨" 설명이 각 source별 실제 값이 무엇인지 명확히 기술하지 않음. `(트리거명/실행자명/부모 워크플로명)` 열거 형식은 좋으나, null이 되는 조건(executor relation 미로드 등)이 빠져 있음
  - 제안: `triggerLabel`에 "executor relation이 로드되지 않은 경우 null" 조건을 한 줄 추가

- **[INFO]** `EXECUTION_TRIGGER_SOURCES` 배열의 목적 주석 부재
  - 위치: `execution-response.dto.ts:4–9`
  - 상세: 이 배열이 `@ApiProperty`의 `enum` 옵션에 쓰이는 이유(Swagger 문서화를 위한 런타임 배열)가 주석 없이 노출되어, 추후 타입만으로 대체하려는 개발자가 혼동할 수 있음
  - 제안: `// Swagger enum requires a runtime array; ExecutionTriggerSource is the source of truth` 한 줄 추가

- **[INFO]** `deriveExecutionTrigger` 함수 JSDoc에서 `parentWorkflowName` 파라미터 설명 누락
  - 위치: `execution-trigger.ts:28–31`
  - 상세: 함수 JSDoc이 `subworkflow` 라벨의 출처를 언급하지만, 두 번째 파라미터 `parentWorkflowName`에 대한 `@param` 태그가 없음. `DerivableExecution` 타입의 설명 주석은 TypeORM nullable 이슈를 잘 기술하고 있어 좋음
  - 제안: `@param parentWorkflowName 서브워크플로우 실행의 경우 호출자가 batch 조회로 전달하는 부모 workflow.name. 없으면 null.` 추가

- **[WARNING]** `loadParentWorkflowNames` JSDoc에서 N+1 방지 전략이 충분히 설명되어 있으나, 중첩 서브워크플로우(2단계 이상) 미지원 제한이 문서화되지 않음
  - 위치: `executions.service.ts:125–143`
  - 상세: 현재 구현은 `parentExecutionId`가 가리키는 부모 실행의 workflow.name만 가져오므로, 3단계 이상 중첩된 서브워크플로우에서 라벨이 의도한 대로 동작하지 않을 수 있음. 이 제한이 주석이나 스펙에 명시되지 않았음
  - 제안: JSDoc에 `@remarks 1단계 부모까지만 조회. 다단계 중첩 서브워크플로우의 최상위 워크플로명은 반환하지 않음.` 추가

- **[INFO]** `toExecutionDto` 프라이빗 메서드에 주석 부재
  - 위치: `executions.service.ts:145–175`
  - 상세: `loadParentWorkflowNames`는 JSDoc이 있지만 `toExecutionDto`와 `toIso`는 없음. 프라이빗 메서드이므로 필수는 아니나, `toIso`의 `Date | string` 유니온 처리 이유(TypeORM이 때로 문자열로 반환)는 비자명한 제약임
  - 제안: `toIso`에 `// TypeORM may return Date or pre-serialized string depending on driver` 한 줄 추가

- **[INFO]** 프론트엔드 `ExecutionData` 인터페이스에서 `triggerSource`와 `triggerLabel`이 optional(`?`)로 선언
  - 위치: `executions.ts:47–48`
  - 상세: 백엔드 `ExecutionDto.triggerSource`는 required이지만 프론트엔드 타입은 optional. 기술적으로 방어적 설계지만, 이 불일치에 대한 설명이 없어 다음 개발자가 실제 필드가 항상 존재하는지 판단하기 어려움
  - 제안: 인라인 주석으로 `// optional for backwards-compat with older API responses` 등 의도를 명시

- **[INFO]** i18n 사전에서 `unknown` 값이 `"—"` (em dash)인 이유가 불명확
  - 위치: `en.ts:1940`, `ko.ts:1933`
  - 상세: 다른 triggerSource는 설명적 문자열인데 `unknown`만 em dash. UI에서 텍스트 없이 아이콘만 표시하는 특별 처리가 있는 것처럼 보이나 주석이 없음. 실제로 프론트엔드에서 `t(TRIGGER_LABEL_KEY[source])`로 렌더링하므로 em dash가 그대로 노출됨
  - 제안: 주석으로 `// Rendered as icon-only row; dash acts as visual placeholder` 추가하거나 빈 문자열로 변경 시 그 의도를 명시

- **[INFO]** 테스트 파일(`executions.service.spec.ts`) 내 N+1 방지 검증 주석이 인라인에만 존재
  - 위치: `executions.service.spec.ts:136`
  - 상세: `// 부모 실행의 workflow.name 은 batch 1회만 조회 (N+1 방지)` 주석은 의도를 잘 설명하나, `it()` 설명 자체에도 "batch query" 언급이 있어 중복. 일관성 있는 한 곳에만 기술하는 편이 깔끔함

---

### 요약

전반적으로 문서화 수준은 **양호**하다. 핵심 판정 로직(`deriveExecutionTrigger`)에 우선순위 규칙과 스펙 참조 경로가 명시되어 있고, N+1 방지 목적의 batch 쿼리 설계도 JSDoc으로 기술되어 있다. 다만 `toIso`의 TypeORM 드라이버 의존성, 중첩 서브워크플로우의 1단계 한계, `unknown` em-dash 처리 의도, 프론트엔드 optional 선언의 배경 등 **비자명한 설계 결정**에 대한 주석이 누락되어 추후 유지보수 시 혼란의 여지가 있다.

### 위험도

**LOW**