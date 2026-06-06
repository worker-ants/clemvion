# 보안(Security) 코드 리뷰

## 발견사항

### [INFO] resume_call_stack JSONB 컬럼 — API DTO 노출 여부 확인 필요
- 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` L138-139; `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
- 상세: `Execution.resumeCallStack` 필드는 내부 실행 체인 위상 정보(`workflowId`, `invokerNodeId`, `recursionDepth`)를 담는다. `execution-response.dto.ts`(`ExecutionDto`/`ExecutionDetailDto`)는 whitelist 매핑 방식으로 생성되어 있어 `resumeCallStack` 이 DTO 에 직접 정의되지 않으면 API 응답에 포함되지 않는다. 코드 확인 결과 DTO 에 해당 필드가 없어 노출은 없는 것으로 보인다. 단, NestJS 의 Serialization Interceptor 미적용이나 직접 entity 반환 경로가 있다면 내부 노드 구조(`invokerNodeId`)가 노출될 수 있으므로 향후 response 매핑 경로 전체에 대한 확인이 필요하다.
- 제안: entity 를 직접 직렬화하는 경로가 없음을 `@Exclude()` 데코레이터 또는 `classTransformer`/`plainToClass` 변환으로 보증. 현재는 whitelist DTO 로 보호되고 있다는 주석이 entity 코드(L88-90)에 이미 명시되어 있어 INFO 수준.

### [INFO] resume_call_stack 내 workflowId / invokerNodeId 역직렬화 시 검증 부재 가능성
- 위치: `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`; 관련 rehydration 경로(`execution-engine.service.ts` `resumeFromCheckpoint`)
- 상세: `ResumeCallStack` 타입은 TypeScript 인터페이스 수준의 정의만 제공한다. DB 에서 읽어온 JSONB raw 값을 `ResumeCallStack` 로 단순 캐스팅할 경우, 손상되거나 의도적으로 변조된 데이터(`frames` 배열 내 임의의 `workflowId`, `invokerNodeId`)를 그대로 사용해 rehydration 시 타 워크플로우로 잘못 재진입하거나 내부 오류를 유발할 수 있다. 이미 `recursionDepth` 에 대해서는 `MAX_RECURSION_DEPTH = 10` 가드가 존재하지만, DB 에서 읽은 `frames[i].recursionDepth` 가 실제로 이 가드를 통과하는지, `workflowId`/`invokerNodeId` 가 실행 소유자의 워크스페이스에 속하는 유효한 리소스인지 검증하는 로직이 rehydration 경로에 명시적으로 없다. 단, `workflowId` 로 DB 조회 시 권한 없는 데이터는 `WorkflowNotFoundError` 로 차단되므로 실질 권한 우회 위험은 낮다.
- 제안: rehydration 경로에서 `resumeCallStack` 를 파싱할 때 런타임 스키마 검증(Zod 또는 class-validator)을 적용해 `version` 값 범위, `frames` 배열 최대 길이(`MAX_RECURSION_DEPTH` 이하), 각 필드 타입(string/number)을 명시적으로 검사할 것을 권장한다. 현재 단일 DB 쓰기 경로에서만 생성되므로 실질 위험은 낮으나, 방어적 검증이 유지보수 안전성을 높인다.

### [INFO] JSONB 컬럼 스키마 버전 관리 — CALL_STACK_SCHEMA_VERSION 상수 미구현 상태
- 위치: `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` L37 `version: number`; `execution-engine.service.ts` L284 `CHECKPOINT_SCHEMA_VERSION`
- 상세: `ResumeCallStack.version` 필드는 스키마 버전을 의미하나, 이를 발행하는 `CALL_STACK_SCHEMA_VERSION` 상수가 현재 diff 범위 내 코드(`execution-engine.service.ts`)에 정의되지 않았고, `resumeCallStack` 을 실제로 쓰거나 읽는 구현 코드도 diff 에 없다(entity/types/migration/spec 변경만). 즉 V087 마이그레이션으로 컬럼은 추가됐으나 이를 사용하는 park/rehydration 로직은 이번 PR 에 포함되지 않은 것으로 보인다. 버전 가드 없이 잘못된 `version` 값의 `resumeCallStack` 이 미래 코드에서 처리될 경우 `RESUME_INCOMPATIBLE_STATE` 에 준하는 안전 처리가 필요하다.
- 제안: park 시 `version: CALL_STACK_SCHEMA_VERSION` 으로 스탬프하고, rehydration 시 `version > CALL_STACK_SCHEMA_VERSION` 이면 안전 종결(CANCELLED/RESUME_INCOMPATIBLE_STATE)하는 가드를 `CHECKPOINT_SCHEMA_VERSION` 의 동일 패턴으로 구현할 것. 현재 컬럼만 추가된 상태이므로 구현 시 반드시 포함되어야 한다.

### [INFO] SQL 마이그레이션 — 인젝션 위험 없음, DDL only
- 위치: `codebase/backend/migrations/V087__execution_resume_call_stack.sql`
- 상세: 마이그레이션 파일은 `ALTER TABLE execution ADD COLUMN resume_call_stack JSONB NULL` 단일 DDL 과 `COMMENT ON COLUMN` 만 포함한다. 사용자 입력이 개입되지 않는 Flyway 정적 파일이므로 SQL 인젝션 위험 없음.
- 제안: 없음.

### [INFO] 하드코딩된 시크릿 — 미발견
- 위치: 전체 diff 범위
- 상세: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 발견되지 않았다. `CHECKPOINT_SCHEMA_VERSION = 1` 은 스키마 정수 상수로 시크릿이 아니다.
- 제안: 없음.

### [INFO] 에러 메시지 내 민감 정보 — sanitize 메커니즘 확인됨
- 위치: `execution-engine.service.ts` L5779, L5912, L5996, L6011, L6016
- 상세: 엔진 에러 처리는 `sanitizeLastErrorMessage` 를 통해 token/secret echo 를 차단하는 기존 메커니즘을 유지한다. 이번 변경이 새로운 에러 노출 경로를 추가하지 않는다.
- 제안: 없음.

### [INFO] 의존성 — 신규 외부 라이브러리 없음
- 위치: 전체 diff 범위
- 상세: 변경된 코드는 기존 내부 타입/서비스만 활용하며 알려진 취약점이 있는 외부 라이브러리를 새로 추가하지 않는다.
- 제안: 없음.

---

## 요약

이번 변경은 중첩 sub-workflow의 durable resume을 위한 `resume_call_stack` JSONB 컬럼 추가(마이그레이션 V087), 엔티티 매핑(`Execution.resumeCallStack`), 타입 정의(`ResumeCallStack`/`ResumeCallStackFrame`)로 구성된다. 인젝션·하드코딩 시크릿·인증 우회·암호화 취약점은 발견되지 않았으며, 에러 메시지 sanitize 도 기존 메커니즘이 유지된다. 주목할 지점은 두 가지다. 첫째, `resumeCallStack` 이 API DTO 에서 whitelist 제외됨이 주석으로 명시되어 있으나, 실제 response 직렬화 경로 전반을 커버하는지 확인이 필요하다(INFO). 둘째, `ResumeCallStack` 역직렬화 시 런타임 스키마 검증이 아직 구현되지 않았고(`CALL_STACK_SCHEMA_VERSION` 상수도 미정의), park/rehydration 구현 코드가 이번 diff 에 없다. 향후 구현 시 버전 가드와 frame 유효성 검증을 `_resumeCheckpoint` 와 동일 패턴으로 반드시 포함해야 한다(INFO). 보안 관점에서 차단 수준의 취약점은 없으며 전반적인 위험도는 낮다.

---

## 위험도

LOW

STATUS: DONE
