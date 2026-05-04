## 발견사항

---

### [CRITICAL] `findById` (실행 상세) 엔드포인트에 triggerSource/triggerLabel 미반영
- **위치**: `executions.service.ts:findById` 메서드 (변경 미포함)
- **상세**: `ExecutionDetailDto`는 `ExecutionDto`를 상속하므로 Swagger 스펙상 `triggerSource`(required)와 `triggerLabel`이 포함돼야 하지만, `findById`는 여전히 raw `Execution` 엔티티를 반환하고 `toExecutionDto` / `loadParentWorkflowNames` 변환을 거치지 않는다. 컨트롤러가 엔티티를 그대로 직렬화하면 실행 상세 응답에서 두 필드가 누락된다.
- **제안**: `findById`에도 `toExecutionDto` 변환 로직을 적용하거나, `ExecutionDetailDto` 매핑 시 trigger 정보를 함께 로드하도록 변경. 또는 현재 상세 뷰가 trigger 컬럼 요구사항 범위 밖임을 스펙에 명시.

---

### [WARNING] 프론트엔드 타입 계약 불일치 — `triggerSource` optional vs 백엔드 required
- **위치**: `frontend/src/lib/api/executions.ts:48` — `triggerSource?: ExecutionTriggerSource`
- **상세**: 백엔드 DTO는 `@ApiProperty`(required)로 `triggerSource`를 선언하지만, 프론트엔드 타입은 `?`(optional)로 정의한다. TypeScript 컴파일러가 `triggerSource`가 없는 경우를 허용하므로, API 계약 변경 시 빌드 오류 없이 런타임 버그가 발생할 수 있다.
- **제안**: `triggerSource: ExecutionTriggerSource`로 변경. 페이지 컴포넌트의 `?? "unknown"` fallback은 그대로 두되, 타입 레벨에서는 서버 보장을 신뢰.

---

### [WARNING] `executor.name`과 `executor.email` 모두 null인 수동 실행 — 미검증 엣지 케이스
- **위치**: `execution-trigger.ts:37-39`, `execution-trigger.spec.ts`
- **상세**: `executor: { name: null, email: null }` 케이스에서 `label`은 `null`이 된다. 이 경우 `{ source: 'manual', label: null }`을 반환하므로 UI에는 "수동 실행" 소스만 표시되고 보조 라벨이 없다. 테스트는 `executor: null`(relation 미로드) 케이스만 검증하고, 실제 relation이 로드됐지만 두 필드 모두 비어 있는 케이스는 다루지 않는다.
- **제안**: `execution-trigger.spec.ts`에 `executor: { name: null, email: null }` 케이스 추가.

---

### [WARNING] `Trigger.name`이 빈 문자열(`""`)인 경우 null이 아닌 빈 문자열로 전달
- **위치**: `execution-trigger.ts:42,46` — `execution.trigger.name ?? null`
- **상세**: `??` 연산자는 `null`/`undefined`만 처리하므로 `trigger.name === ""`이면 빈 문자열이 `triggerLabel`로 전달된다. 프론트엔드는 `execution.triggerLabel ?` (falsy 체크)로 처리해 화면에서는 숨겨지지만, API 응답에는 빈 문자열이 그대로 포함된다.
- **제안**: `execution.trigger.name || null`로 변경하여 빈 문자열도 null로 정규화.

---

### [INFO] 미지원 트리거 타입에 대한 silent fallback — 신규 타입 추가 시 탐지 어려움
- **위치**: `execution-trigger.ts:41-47`
- **상세**: `schedule`과 `webhook` 외 트리거 타입(예: 향후 `api` 추가 등)은 `triggerId`와 `trigger` 관계가 모두 로드돼도 `unknown`으로 처리된다. 로그나 경고 없이 조용히 fallback되어 신규 타입 도입 시 문제 파악이 늦어질 수 있다.
- **제안**: 인지된 엣지케이스임을 주석으로 명시하거나, 알 수 없는 타입에 대해 서버 측 로그를 남기는 것 검토.

---

### [INFO] `EXECUTION_TRIGGER_SOURCES` 배열이 타입과 수동으로 동기화
- **위치**: `execution-response.dto.ts:4-9`
- **상세**: `ExecutionTriggerSource` 타입과 `EXECUTION_TRIGGER_SOURCES` 배열이 분리돼 있어 타입에 새 값 추가 시 배열 업데이트를 빠뜨릴 수 있다.
- **제안**: 타입 대신 `as const` 배열에서 타입을 파생: `export type ExecutionTriggerSource = typeof EXECUTION_TRIGGER_SOURCES[number]`.

---

## 요약

핵심 비즈니스 로직(트리거 출처 분류)과 우선순위 규칙(`subworkflow > manual > schedule > webhook > unknown`)은 코드와 테스트 모두 충실하게 구현되어 있고, N+1 방지 배치 쿼리도 적절히 적용됐다. 다만 요구사항 완전성 관점에서 중요한 공백이 하나 존재한다: `findByWorkflow` 목록은 새 필드를 반환하지만 `findById` 상세 엔드포인트는 원본 엔티티를 그대로 반환하여 `ExecutionDetailDto` 스펙과 불일치한다. 이 외에 프론트엔드 타입 계약 불일치(optional vs required), 빈 문자열 triggerLabel 정규화 누락, 미검증 엣지 케이스가 일부 있으나 런타임 장애 수준은 아니다.

## 위험도

**MEDIUM** — 목록 뷰 기능은 정상이나 상세 뷰에서 신규 필드 누락 가능성이 있고, 프론트엔드 타입 mismatch로 향후 변경 시 버그 탐지가 어려워질 수 있다.