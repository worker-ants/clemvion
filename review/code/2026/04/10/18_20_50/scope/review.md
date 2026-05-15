### 발견사항

- **[WARNING]** 응답 래핑 레이어 불일치
  - 위치: `llm.service.ts:66-78`, `integrations.service.ts:87-93` vs `executions.controller.ts:46`
  - 상세: `{ data: ... }` 래핑이 Service 레이어(`llm.service`, `integrations.service`)와 Controller 레이어(`executions.controller`)에 혼재되어 적용됨. 일반적으로 응답 형식 변환은 Controller 또는 Interceptor 레이어에서 일관되게 처리해야 함. Service가 `{ data: ... }` 형태를 반환하면 Controller에서 다시 한 번 래핑될 위험이 있음
  - 제안: 래핑 위치를 Controller 레이어로 통일하거나, Global Response Interceptor 도입을 고려

- **[WARNING]** 동일 파일 내 부분 적용으로 인한 불일치
  - 위치: `integrations.service.ts:87` (`testConnection`) vs `integrations.service.ts:99` (`reauthorize`)
  - 상세: 같은 서비스 파일에서 `testConnection`만 `{ data: ... }` 래핑을 적용하고, `reauthorize`는 `{ authUrl: string; state: string }`를 그대로 반환하여 동일 서비스 내 응답 형식이 불일치함
  - 제안: 동일 서비스 내 모든 메서드에 일관된 응답 형식 적용, 또는 래핑을 Controller로 이동

- **[WARNING]** Controller 내 부분 적용
  - 위치: `executions.controller.ts` — `continueExecution` vs `stop`, `findOne`, `findByWorkflow`
  - 상세: `continueExecution`만 `{ data: ... }` 형태로 변경되고 동일 컨트롤러의 나머지 엔드포인트는 변경되지 않아 같은 컨트롤러 내 응답 형식이 혼재됨
  - 제안: 컨트롤러 전체에 일관된 응답 형식 적용 필요

- **[INFO]** 프론트엔드 이중 처리 방어 코드
  - 위치: `frontend/src/lib/api/llm-configs.ts:68`
  - 상세: `data?.data ?? data` 패턴은 구 형식과 신 형식 모두를 처리하는 하위 호환 shim. 마이그레이션이 완료되면 제거되어야 할 임시 코드지만, 현재 변경이 부분 적용된 상태이므로 방어적으로 유효함. 완전한 마이그레이션 후 정리 필요
  - 제안: 모든 엔드포인트 마이그레이션 완료 후 `data?.data ?? data` → `data.data`로 단순화

- **[INFO]** 테스트 코드는 구현 변경과 정확히 동기화됨
  - 위치: `llm.service.spec.ts`
  - 상세: 테스트 설명 문구와 기대값이 구현 변경과 일치하여 적절히 갱신됨. 별도 문제 없음

---

### 요약

이번 변경의 핵심 의도는 API 응답을 `{ data: ... }` 형태로 표준화하는 것으로, 의도 자체는 명확합니다. 그러나 변경이 **전체 적용이 아닌 부분 적용**으로 이루어졌고, 래핑 위치가 Service/Controller 레이어 간에 일관되지 않아 동일 파일/컨트롤러 내에서도 응답 형식이 혼재하는 문제가 발생하였습니다. 프론트엔드의 이중 처리 코드(`data?.data ?? data`)는 이 불완전한 마이그레이션의 증거입니다. 단기적으로는 동작하지만, 장기적으로 유지보수성 저하와 버그 원인이 될 수 있습니다.

---

### 위험도

**MEDIUM**