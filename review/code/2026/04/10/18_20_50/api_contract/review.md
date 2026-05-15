### 발견사항

- **[WARNING]** 응답 형식 불일치 — `testConnection` 엔드포인트만 `{ data: { ... } }` 래핑 적용, 다른 엔드포인트는 미적용
  - 위치: `llm.service.ts:78,83`, `integrations.service.ts:91`, `executions.controller.ts:51`
  - 상세: 세 엔드포인트에 `{ data: { ... } }` 래핑이 추가되었으나, 동일 컨트롤러의 `findOne`, `findByWorkflow`, `stop`, `reauthorize` 등 나머지 엔드포인트는 기존 형식 유지. 프로젝트 전체의 응답 봉투(envelope) 정책이 일관되게 적용되지 않음.
  - 제안: 공통 인터셉터(`TransformInterceptor`)를 도입하여 모든 응답에 일관된 래핑 정책 적용. 또는 현재 변경을 되돌리고 전체 API에 동시에 적용 계획 수립.

- **[WARNING]** 프론트엔드 방어 코드의 취약성
  - 위치: `frontend/src/lib/api/llm-configs.ts:68`
  - 상세: `data?.data ?? data` 패턴은 응답이 이중 래핑(`{ data: { data: { ... } } }`)이거나 구조가 다를 경우 잘못된 값을 반환. 또한 `integrations`의 `testConnection`에 대응하는 프론트엔드 API 클라이언트 코드에는 동일 방어 코드가 없어 불일치 발생 가능.
  - 제안: 응답 구조를 서버에서 고정한 뒤 프론트엔드는 단일 경로만 사용하도록 정리. `apiClient` 인터셉터 레벨에서 언래핑 처리 권장.

- **[WARNING]** Breaking Change — 기존 클라이언트 영향
  - 위치: 전체 diff
  - 상세: `{ success: true }` → `{ data: { success: true } }` 변경은 이 API를 사용하는 다른 클라이언트(모바일, 외부 연동 등)에 대한 breaking change. 현재 프론트엔드는 방어 코드로 대응했으나, API 버전 관리 없이 직접 변경함.
  - 제안: API 버전(`/v2/`) 분리 또는 변경 배포 전 모든 소비자 코드 확인 및 마이그레이션.

- **[INFO]** `integrations.service.ts`의 `reauthorize` 메서드 응답 형식 미변경
  - 위치: `integrations.service.ts:97~140`
  - 상세: 같은 서비스 내 `testConnection`만 래핑되고 `reauthorize`는 `{ authUrl, state }` 그대로 반환. 정책 적용 범위 불명확.
  - 제안: 래핑 정책 적용 대상을 명시적으로 정의하고 일관성 있게 적용.

- **[INFO]** `executions.controller.ts`의 `continueExecution` — async 미사용
  - 위치: `executions.controller.ts:43`
  - 상세: `continueExecution`은 `async`가 아니고 `executionEngineService.continueExecution()`의 Promise를 await하지 않음. 응답 형식 변경과 무관하지만 fire-and-forget 패턴이 의도적인지 확인 필요.

---

### 요약

이번 변경은 일부 엔드포인트(`testConnection`, `continueExecution`)의 응답을 `{ data: { ... } }` 구조로 래핑하는 것이 목적으로 보이나, 동일 서비스/컨트롤러의 다른 엔드포인트에는 적용되지 않아 **API 응답 형식의 일관성이 무너졌다**. 프론트엔드는 `data?.data ?? data` 방어 코드로 임시 대응했지만 이는 근본 해결이 아니며, API 버전 관리 없이 응답 스키마를 변경한 것은 잠재적 breaking change다. 전체 API에 일관된 응답 봉투 정책(공통 인터셉터 등)을 적용하거나, 현재 변경을 롤백하고 전략을 재수립할 것을 권장한다.

### 위험도
**MEDIUM**