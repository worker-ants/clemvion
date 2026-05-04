### 발견사항

- **[WARNING]** `findById` (상세 엔드포인트)에 `triggerSource` / `triggerLabel` 누락
  - 위치: `executions.service.ts` `findById()` 메서드
  - 상세: `findByWorkflow`는 `ExecutionDto`로 매핑되어 두 필드를 반환하지만, `findById`는 여전히 raw `Execution` 엔티티를 그대로 반환한다. `ExecutionDetailDto extends ExecutionDto`이므로 Swagger 스키마는 상세 응답에도 이 필드들이 있다고 선언하게 되지만, 실제 응답에는 포함되지 않는다. **문서(Swagger)와 실제 응답 간 계약 불일치**다.
  - 제안: `findById`에도 `toExecutionDto()` 또는 동등한 매핑을 적용하거나, 컨트롤러에서 `ExecutionDetailDto`를 응답 타입으로 쓰지 않도록 명시적으로 분리해야 한다.

- **[WARNING]** 백엔드 필수 필드 vs 프론트엔드 선택 필드 타입 불일치
  - 위치: `backend/dto/execution-response.dto.ts` (line `triggerSource: ExecutionTriggerSource`) vs `frontend/src/lib/api/executions.ts` (`triggerSource?: ExecutionTriggerSource`)
  - 상세: 백엔드는 `@ApiProperty`(필수)로 선언해 항상 반환을 보장하지만, 프론트엔드 타입은 `?`(optional)로 정의되어 있다. `page.tsx`에서 `execution.triggerSource ?? "unknown"` 방어 코드를 추가한 것은 이 불일치를 의식한 것으로 보이나, 타입 자체가 계약을 잘못 표현하고 있다.
  - 제안: 백엔드 보장에 맞게 `triggerSource: ExecutionTriggerSource`(필수)로 변경하거나, 후방 호환을 위해 의도적으로 optional로 유지한다면 백엔드 DTO도 `@ApiPropertyOptional`로 맞춰야 한다.

- **[INFO]** 하위 호환성 — 추가 전용 변경
  - 위치: `ExecutionDto` (두 신규 필드), 프론트엔드 `ExecutionData`
  - 상세: `triggerSource`와 `triggerLabel`은 기존 응답 필드를 변경하지 않고 추가만 한다. 기존 클라이언트는 두 필드를 무시하면 되므로 breaking change에 해당하지 않는다.

- **[INFO]** `triggerLabel`에 이메일 주소 노출 가능성
  - 위치: `execution-trigger.ts` — `executor?.name ?? executor?.email ?? null`
  - 상세: 실행자 이름이 없을 경우 이메일이 `triggerLabel`로 노출된다. 실행 목록은 같은 워크스페이스 구성원에게 보이므로 큰 위험은 아니지만, 설계 의도로 명시되어 있지 않다.
  - 제안: 이메일 폴백 노출이 의도된 동작이라면 DTO 주석이나 스펙 문서에 명시하는 것이 좋다.

- **[INFO]** API 버전 관리 없음
  - 위치: 전체
  - 상세: 이번 변경은 additive이므로 버전 없이 진행 가능하나, 향후 필드 제거·변경이 발생하면 버전 전략 부재가 문제가 된다. 현재 단계에서는 허용 가능하다.

---

### 요약

이번 변경은 실행 목록 API에 `triggerSource`·`triggerLabel` 필드를 추가하는 additive 변경으로, 기존 클라이언트를 깨뜨리지 않으며 전체적인 구현 품질(배치 로딩, 민감 컬럼 선택적 노출 방지, 우선순위 분류 로직)이 양호하다. 다만 목록 엔드포인트(`findByWorkflow`)와 상세 엔드포인트(`findById`) 사이에 응답 스키마 불일치가 존재한다 — `ExecutionDetailDto`는 `ExecutionDto`를 상속하므로 Swagger는 상세 응답에도 두 필드가 있다고 선언하지만 실제로는 반환되지 않는다. 이 계약 불일치가 이번 변경의 가장 중요한 수정 포인트다.

### 위험도

**LOW**