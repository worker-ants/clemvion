# 부작용(Side Effect) Review

## 발견사항

### 파일 1: auth-config-response.dto.ts

- **[INFO]** `@ApiProperty` 데코레이터에 `type: Number` / `type: String` 추가 및 JSDoc 주석 추가
  - 위치: `AuthConfigUsagePeriodCountsDto` (last24h, last7d, last30d), `AuthConfigUsageCallDto.sourceIp`
  - 상세: 런타임 동작에 영향 없음. `type` 힌트는 Swagger/OpenAPI 스키마 생성에만 사용된다. `description` 텍스트가 영어 → 한국어로 변경되었으나 이는 OpenAPI 문서 출력에만 반영되고, 직렬화·응답 구조·클라이언트 코드에는 부작용 없음. 클래스 프로퍼티(last24h, last7d, last30d, sourceIp)의 타입 선언은 변경되지 않았다.
  - 제안: 없음. 의도된 개선이며 부작용 없음.

---

### 파일 2: spec/1-data-model.md

- **[INFO]** `Execution` 인덱스 테이블에 신규 행 추가 (`idx_execution_trigger_started`, V096)
  - 위치: `§3` 인덱스 테이블 — `Execution` 행
  - 상세: spec 문서 변경으로 코드 런타임 부작용 없음. 기존 인덱스 행(NodeExecution 관련)은 그대로 유지된다. `partial` 인덱스(`WHERE trigger_id IS NOT NULL`)를 통해 schedule/manual(trigger_id=NULL) 행을 제외하므로 인덱스 크기 및 write amplification 영향이 제한적이라고 명시되어 있다.
  - 제안: 없음. spec 기록 변경으로 부작용 없음.

---

### 파일 3: spec/5-system/12-webhook.md

- **[WARNING]** `ExecutionEngineService.execute()` 3번째 인자(옵션 객체)에 `sourceIp`와 `responseCode` 필드 추가를 명세
  - 위치: §7 처리 흐름 step 7e (Chat Channel 분기) 및 step 8b (기존 경로)
  - 상세: spec 변경이지만 실제 구현에서는 `ExecutionEngineService.execute()`의 3번째 파라미터 타입(옵션 객체)에 `sourceIp?: string | null`과 `responseCode?: string | null`이 추가되어야 한다. 이 변경이 기존 호출자에게 미치는 영향을 확인해야 한다:
    1. 기존 `execute()` 호출 시 3번째 인자를 전달하지 않거나 `{ triggerId }` 만 전달하는 호출자(수동 실행, schedule 실행, 서브워크플로우 호출 등)는 `sourceIp`/`responseCode` 없이 호출하게 된다. spec이 "비-HTTP 트리거는 NULL"로 허용하므로 이는 의도된 동작이나, 기존 호출 코드가 새 필드를 모르는 상태라면 `source_ip`/`response_code` 컬럼이 NULL로 저장된다.
    2. `sourceIp`와 `responseCode`가 옵션(nullable)으로 정의된다면 기존 호출자의 시그니처 호환성은 유지된다.
    3. 만약 구현에서 이 인자들이 필수로 처리된다면 기존 호출자는 컴파일 에러 또는 런타임 오류가 발생한다.
  - 제안: 구현 시 `sourceIp?: string | null`과 `responseCode?: string | null`을 optional로 선언해 기존 호출자 호환성을 보장할 것. schedule/manual 트리거, 서브워크플로우 호출 경로의 `execute()` 호출에는 이 필드를 생략하거나 명시적으로 `undefined`/`null`로 전달하도록 통일.

- **[INFO]** Chat Channel 분기(step 7e)에 `sourceIp`·`responseCode: '202'` 추가
  - 위치: §7 step 7e
  - 상세: `extractClientIp`를 이미 인증 IP whitelist 검증에서 사용하므로 동일 값 재사용이며 추가 외부 호출 없음. `responseCode: '202'`는 하드코딩 리터럴로 실제 HTTP 응답 코드와 일치한다.
  - 제안: 없음. 기존 값 재사용이므로 부작용 없음.

---

## 요약

이번 변경은 주로 Swagger 메타데이터 보강(파일 1), spec 인덱스 기록 추가(파일 2), webhook 처리 흐름 명세 업데이트(파일 3)로 구성된다. 파일 1·2는 런타임 부작용이 전혀 없다. 파일 3은 spec 문서 변경이지만 실제 구현에서 `ExecutionEngineService.execute()`의 옵션 객체 타입 확장이 수반되며, 이때 `sourceIp`·`responseCode`가 optional(nullable)로 선언되어야 기존 schedule/manual/서브워크플로우 호출자에 대한 하위 호환성이 유지된다. spec 자체는 "비-HTTP 트리거는 NULL"을 허용하므로 의도와 일관되나, 구현 시 optional 처리를 누락하면 기존 호출 경로에서 컴파일 또는 런타임 오류가 발생할 수 있다.

## 위험도

LOW
