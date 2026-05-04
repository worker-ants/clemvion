## 발견사항

### **[WARNING]** `findById` 메서드에 워크스페이스 수준 격리 없음
- **위치**: `executions.service.ts` — `findById(id: string)`
- **상세**: 메서드가 execution ID만으로 조회하며 워크스페이스 필터링이 없음. 코드 주석(`워크스페이스 권한 검증은 컨트롤러의 가드/미들웨어에서 수행한다`)이 컨트롤러 레이어에 의존하고 있어, 가드가 누락되거나 우회될 경우 타 워크스페이스의 실행 데이터에 접근 가능한 IDOR(Insecure Direct Object Reference) 위험
- **제안**: `findById`에도 `workspaceId` 파라미터를 추가하고, `innerJoin('e.workflow', 'w').where('e.id = :id AND w.workspace_id = :workspaceId')` 형태로 서비스 레이어에서 격리 보장. Defense in depth 원칙 적용

---

### **[WARNING]** `executedBy` 필드 노출 (PII 잠재적 유출)
- **위치**: `executions.service.ts` — `toExecutionDto()` L237
- **상세**: `executedBy: execution.executedBy ?? null`이 API 응답에 포함됨. `executedBy`가 이메일 주소를 저장하는 경우 PII 외부 노출. `executor.name`은 이미 `triggerLabel`로 제공되고 있어 `executedBy` 필드의 별도 노출 필요성 재검토 필요
- **제안**: `executedBy` 컬럼이 이메일인지 UUID인지 확인 후, 이메일이라면 해당 필드를 API 응답에서 제거하거나 마스킹 처리

---

### **[INFO]** 이메일 비노출 검증 테스트의 신뢰도 제한
- **위치**: `dashboard.service.spec.ts` — L83 `expect(JSON.stringify(result)).not.toMatch(/@/)`
- **상세**: `@` 기호 존재 여부만으로 이메일 비노출을 검증하는 방식은 불완전. (1) `@`가 없는 사내 계정명은 탐지 불가. (2) 워크플로우 이름 자체에 `@`가 포함될 경우 false positive. (3) 이메일 외 다른 PII(사용자 ID 등)는 검증 안 됨
- **제안**: 실제 User 엔티티의 `email`, `passwordHash` 등 민감 필드가 직렬화 결과에 포함되지 않음을 명시적으로 단언하는 방식으로 개선

---

### **[INFO]** `triggerLabel` HTML `title` 속성 신뢰 경계
- **위치**: `trigger-cell.tsx` — L48 `title={label}`
- **상세**: `triggerLabel`에는 사용자가 설정 가능한 executor 이름, 트리거 이름, 워크플로우 이름이 포함됨. React JSX는 자동 이스케이핑하므로 현재 코드에서 XSS는 발생하지 않음. 단, 향후 `dangerouslySetInnerHTML` 등 사용 시 위험성이 있으므로 신뢰 경계 문서화 권장
- **제안**: 현재 구현은 안전. 코드 레벨 주석으로 신뢰 경계 명시

---

### **[INFO]** `IN (:...ids)` 절 크기 미제한
- **위치**: `load-parent-workflow-names.ts` — L28 `.where('pe.id IN (:...ids)', { ids: parentIds })`
- **상세**: 현재 호출처(대시보드 10건, 페이지 20건)에서는 실질적 위험이 없으나, 이 유틸리티가 제한 없는 목록과 함께 호출될 경우 대형 IN 절 생성 가능
- **제안**: 함수 시그니처 또는 문서에 입력 크기 전제조건 명시

---

## 요약

전반적인 보안 설계는 양호하다. TypeORM 파라미터화 쿼리로 SQL 인젝션을 방지하고 있으며, selective JOIN으로 `passwordHash` 등 민감 필드를 명시적으로 차단하는 패턴은 올바른 접근이다. React의 자동 이스케이핑으로 XSS도 방어된다. 주요 우려사항은 `findById`의 서비스 레이어 IDOR — 현재는 컨트롤러 가드에만 의존하고 있어, 가드 설정 실수 한 번이 타 워크스페이스 데이터 노출로 이어질 수 있다. `executedBy` 필드가 이메일을 저장하는지 여부에 따라 PII 노출 여부가 결정되므로 즉시 확인이 필요하다.

## 위험도

**LOW ~ MEDIUM** — 현재 구현 자체의 버그보다 아키텍처 패턴(가드 의존)이 주요 리스크. `executedBy` 필드 성격 확인 전까지 MEDIUM 유지.