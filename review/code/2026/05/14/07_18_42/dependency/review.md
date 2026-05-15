### 발견사항

---

**[INFO] 새 외부 npm 의존성 없음**
- 위치: 변경된 모든 파일
- 상세: 6개 소스 파일 모두 기존 의존성(`@tanstack/react-query`, `lucide-react`, `@/components/ui/*`)만 사용하며, 신규 외부 패키지가 전혀 추가되지 않았습니다. 번들 크기 증가·라이선스 충돌·취약점 도입 위험 없음.
- 제안: 없음

---

**[WARNING] `mcp-capable-service-types.ts` — 프론트/백엔드 상수 수동 이중 관리**
- 위치: `frontend/src/lib/integrations/mcp-capable-service-types.ts:1-12`
- 상세: 파일 자체 JSDoc에 "백엔드 twin과 반드시 함께 수정해야 한다"고 명시되어 있습니다. `["mcp", "cafe24"]` 배열이 `backend/src/modules/integrations/services/mcp-capable-service-types.ts`와 독립적으로 정의되어, 새 Internal Bridge 서비스 타입 추가 시 두 파일을 동시에 수정해야 합니다. 한쪽만 수정하면 프론트의 `McpServerSelector`가 해당 서비스 타입을 필터링하지 못하는 조용한 버그가 발생합니다.
- 제안: 단기적으로는 현행 유지(파일 주석이 의도를 명시함). 후속 PR에서 `GET /api/integrations/services` 엔드포인트로 목록을 동적으로 수신해 중복을 제거하는 방향이 권장됩니다.

---

**[INFO] `override-registry.ts` — 내부 모듈 의존 패턴 일관성 유지**
- 위치: `override-registry.ts:28`, `override-registry.ts:77`
- 상세: `Cafe24Config`를 `./integration-configs`에서 import하고 `OVERRIDE_REGISTRY`에 `cafe24` 키로 등록하는 방식은 기존 `HttpRequestConfig`, `DatabaseQueryConfig`, `SendEmailConfig`와 동일한 패턴입니다. 내부 의존 방향이 일관적입니다.
- 제안: 없음

---

**[INFO] `mcp-server-selector.tsx` — React Query 캐시 키 변경**
- 위치: `mcp-server-selector.tsx:65`
- 상세: `queryKey: ["integrations", "mcp"]` → `["integrations", "mcp-capable"]` 변경으로 기존 캐시가 무효화됩니다. 이 키를 `invalidateQueries`로 참조하는 다른 코드가 있으면 무효화가 더 이상 동작하지 않습니다. 현재 이 컴포넌트가 해당 키의 유일한 소비자인 것으로 확인되어 실질적 영향은 없습니다.
- 제안: 코드베이스에서 `["integrations", "mcp"]` 키를 참조하는 `invalidateQueries` / `setQueryData` 호출이 있는지 grep으로 한 번 더 확인 후 확정하는 것이 안전합니다.

---

**[INFO] `integrations.ts` — 타입 전용 확장, 런타임 의존 변화 없음**
- 위치: `integrations.ts:171-178`
- 상세: `oauthBegin` 함수의 매개변수 타입에 `mallId?`, `appType?`, `clientId?`, `clientSecret?` 옵셔널 필드가 추가되었습니다. 모두 `?` 이므로 기존 google/github OAuth 호출자에게 breaking change가 없습니다. 런타임 의존성 변화도 없습니다.
- 제안: 없음

---

### 요약

이번 변경은 외부 npm 의존성을 전혀 추가하지 않아 라이선스·취약점·번들 크기 관점에서 깨끗합니다. 내부 모듈 의존 측면에서도 `override-registry.ts`의 `Cafe24Config` 추가와 `mcp-server-selector.tsx`의 새 import 모두 기존 패턴을 그대로 따릅니다. 유일한 구조적 우려는 `mcp-capable-service-types.ts`의 프론트-백엔드 상수 이중 관리로, 파일 자체가 이를 인지하고 명시하고 있으나 미래 통합 추가 시 누락 위험이 있습니다. React Query 캐시 키 변경은 현재 단일 소비자이므로 영향이 없으나 확인이 권장됩니다.

### 위험도

**LOW**