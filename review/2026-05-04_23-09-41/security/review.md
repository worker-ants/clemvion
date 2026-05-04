### 발견사항

---

**[WARNING] 사용자 이메일(PII)이 `triggerLabel`로 API 응답에 노출됨**
- 위치: `execution-trigger.ts:36`, `executions.service.ts` `addSelect(['executor.id', 'executor.name', 'executor.email'])`
- 상세: `executor.name`이 null인 경우 `executor.email`이 폴백으로 `triggerLabel`에 그대로 포함되어 응답됩니다. 실행 목록 API를 열람할 수 있는 모든 사용자가 해당 워크플로우를 수동 실행한 사람의 이메일 주소를 확인할 수 있게 됩니다. 역할 기반 접근 제어가 없는 공유 워크플로우에서는 의도치 않은 PII 유출입니다.
- 제안: 이메일을 `triggerLabel`에 직접 포함하지 않도록 수정. 이름이 없을 경우 이메일 대신 `executedBy` UUID 또는 별도의 마스킹 처리(`a***@x.com`)를 사용하거나, `triggerLabel` 대신 `executorId`만 반환하고 프론트엔드에서 이름 조회 권한을 별도로 통제하는 방식을 권장합니다.

---

**[WARNING] `loadParentWorkflowNames` 쿼리에 워크스페이스 범위 필터 없음**
- 위치: `executions.service.ts:130–145`
- 상세: `parentExecutionId IN (...)` 쿼리가 워크스페이스/테넌트 필터 없이 실행됩니다. 현재 구조상 `parentExecutionId`는 같은 워크스페이스 내에서만 생성되지만, 만약 데이터 무결성 제약이 DB 레벨에서 충분히 보장되지 않는다면 타 테넌트 실행의 `workflow.name`이 응답에 포함되는 크로스 테넌트 정보 유출이 발생할 수 있습니다.
- 제안: `executionRepository.find` 쿼리에 `workspaceId` 조건을 추가하거나, `Execution` 엔티티에서 워크스페이스 스코프 필터를 공통화하는 방식을 권장합니다.

---

**[WARNING] `findByWorkflow` 서비스 레이어에 소유권 검증 없음 (IDOR 잠재적 위험)**
- 위치: `executions.service.ts:49–83` `findByWorkflow` 메서드
- 상세: 서비스 계층에서 `workflowId`가 현재 호출자의 워크스페이스·권한 범위에 속하는지 검증하지 않습니다. 컨트롤러 레이어에서 인가를 처리한다면 문제없으나, 서비스를 직접 호출하는 다른 경로가 추가될 경우 IDOR(Insecure Direct Object Reference) 취약점이 됩니다.
- 제안: 서비스 레이어에 `userId` 또는 `workspaceId` 매개변수를 추가하고, 쿼리에 명시적 소유권 필터를 포함하거나, 컨트롤러 레이어의 가드에서 처리됨을 코드 주석으로 명확히 표시할 것을 권장합니다.

---

**[INFO] `ExecutionDto.triggerLabel`에 최대 길이 제약 없음**
- 위치: `execution-response.dto.ts:35–37`
- 상세: `triggerLabel`은 트리거명·사용자명·워크플로우명을 그대로 담습니다. DB에서 오는 값이므로 직접적 인젝션 위험은 낮으나, `@MaxLength()` 제약이 없어 응답 크기가 비정상적으로 커질 수 있습니다.
- 제안: `class-validator`의 `@IsOptional() @MaxLength(255)` 데코레이터 추가를 고려하세요.

---

**[INFO] 프론트엔드에서 `TRIGGER_ICON[source]`가 undefined가 될 수 있는 런타임 경로 존재**
- 위치: `page.tsx:303`
- 상세: `triggerSource`가 백엔드에서 새 값(예: 미래 추가 타입)으로 내려오면 `TRIGGER_ICON[source]`가 `undefined`가 되어 렌더 오류 발생. 보안 이슈는 아니지만 방어적 처리 미흡.
- 제안: `const Icon = TRIGGER_ICON[source] ?? HelpCircle;` 형태의 폴백을 추가하세요.

---

### 요약

이번 변경은 SQL 인젝션(파라미터화 쿼리 사용), 정렬 컬럼 인젝션(허용 목록 사용), XSS(React의 자동 이스케이핑), 민감 필드 노출(`addSelect`를 통한 명시적 컬럼 제한) 등 핵심 보안 사항을 잘 고려한 구현입니다. 다만, `executor.email`이 `triggerLabel`로 API 응답에 직접 포함되는 PII 노출 문제가 가장 주요한 위험이며, 이를 우선 해결해야 합니다. 추가로, `loadParentWorkflowNames`의 테넌트 범위 미검증과 서비스 레이어의 소유권 검증 부재도 향후 기능 확장 시 취약 경로가 될 수 있습니다.

### 위험도

**MEDIUM** — `executor.email` PII 노출이 실제 운영 환경에서 의도치 않은 사용자 정보 유출로 이어질 수 있습니다.