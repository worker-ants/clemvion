# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `AgentMemoryService` 공개 메서드 4개 제거 — exported 서비스 인터페이스 파괴
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` (diff -201줄)
- 상세: `listScopes`, `listMemories`, `deleteMemory`, `clearScope` 메서드가 `AgentMemoryService`에서 제거됐다. `AgentMemoryService`는 `AgentMemoryModule`의 `exports` 배열에 남아 있어 다른 모듈이 주입받을 수 있다. 이번 변경 범위 내에서는 컨트롤러만 이 메서드들을 호출하고 있으며 컨트롤러는 이미 `AgentMemoryAdminService`로 교체됐다. 그러나 `AgentMemoryService`를 import해 admin 메서드를 직접 호출하는 코드가 다른 모듈에 잠재적으로 존재한다면 런타임 오류가 발생한다. diff 범위 내 직접 증거는 없으나, export된 서비스의 메서드 제거는 인터페이스 파괴(breaking change)다.
- 제안: `AgentMemoryService`를 import하는 다른 모듈(`execution-engine`, `ai-agent handler` 등)이 삭제된 메서드를 호출하지 않는지 전수 확인 후 병합. 현재 소비자가 없음을 확인했다면 INFO로 강등 가능.

### [WARNING] `clearScope` 컨트롤러 메서드 파라미터 추가 — NestJS DI 외부 호출자 영향
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` 라인 963 (`clearScope` 시그니처)
- 상세: `clearScope(workspaceId, query)` → `clearScope(workspaceId, query, res: Response)` 로 파라미터가 추가됐다. NestJS HTTP 라우터는 데코레이터 기반으로 파라미터를 해소하므로 HTTP 클라이언트 영향은 없다. 그러나 컨트롤러 메서드를 **직접 TypeScript 코드로 호출**하는 테스트나 다른 클래스가 있다면 컴파일 오류가 발생한다. `agent-memory.controller.spec.ts`는 이미 `res` 인수를 추가해 정합적으로 업데이트됐다. 추가적인 호출자가 없는지 확인 필요.
- 제안: 프로젝트 전체에서 `controller.clearScope(` 패턴으로 검색해 누락된 호출 지점을 확인한다.

### [INFO] `agentMemoriesApi.clearScope` 반환 타입 변경 (`void` → `number`) — 프론트엔드 API 인터페이스
- 위치: `codebase/frontend/src/lib/api/agent-memories.ts` (clearScope 함수)
- 상세: 반환 타입이 `Promise<void>`에서 `Promise<number>`로 변경됐다. JavaScript 런타임에서는 기존 호출자가 반환값을 무시하면 문제없지만, TypeScript 타입 수준에서 `clearScope`를 `Promise<void>` 타입 변수에 할당하거나 그렇게 타입 단언한 코드가 있다면 컴파일 오류가 생긴다. `page.tsx`의 `useMutation`은 이미 `deleted` 인자를 받도록 업데이트됐다. 다른 소비자가 없는지 확인 필요.
- 제안: 변경 자체는 의도적이며 안전하다. 필요 시 리뷰 전 `grep -r "clearScope"` 로 추가 호출 지점 확인.

### [INFO] `clearScopeMutation.onSuccess` 토스트 동작 변경 — 0건 삭제 시 UX 행동 변경
- 위치: `codebase/frontend/src/app/(main)/agent-memory/page.tsx` (clearScopeMutation.onSuccess)
- 상세: 기존에는 삭제 건수에 무관하게 `toast.success`를 호출했다. 변경 후 `deleted === 0`이면 `toast.info`(중립)를 호출한다. 이는 의도된 UX 개선이나, 0건 삭제를 성공으로 간주하던 프론트엔드 통합 테스트나 E2E 테스트가 있다면 토스트 메시지 어설션이 실패할 수 있다.
- 제안: 관련 E2E/통합 테스트를 확인해 `clearScope.success` 메시지를 기대하는 케이스가 없는지 점검.

### [INFO] 새 응답 헤더 `X-Deleted-Count` 추가 — 외부 API 소비자 영향
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` (clearScope 라인 982)
- 상세: `DELETE /agent-memories?scopeKey=` 응답에 `X-Deleted-Count` 헤더가 새로 추가됐다. 기존 클라이언트가 이 헤더를 모르더라도 무시하면 그만이므로 하위 호환성은 유지된다. CORS 정책에서 `Access-Control-Expose-Headers`에 `X-Deleted-Count`가 포함돼 있지 않으면 브라우저 클라이언트가 이 헤더를 읽지 못할 수 있다.
- 제안: 백엔드 CORS 설정에서 `exposedHeaders`에 `X-Deleted-Count`를 추가했는지 확인한다.

### [INFO] 모듈 레벨 상수 중복 도입 — `memory-list-panel.tsx`에 `KIND_OPTIONS`, `KIND_META` 새 전역 상수
- 위치: `codebase/frontend/src/app/(main)/agent-memory/components/memory-list-panel.tsx` (라인 244–263)
- 상세: `KIND_OPTIONS`, `KIND_META`, `FALLBACK_KIND_CLASS` 상수가 `page.tsx`에서 제거되고 `memory-list-panel.tsx` 모듈 스코프에서 재선언됐다. 불변 상수이므로 상태 변경 위험은 없다. 그러나 `KIND_OPTIONS`는 이 파일에서만 `export`되어 있어, `page.tsx`나 다른 컴포넌트가 필요할 때 명시적으로 이 모듈에서 import해야 한다.
- 제안: 문제없음. 다만 향후 kind 추가 시 `memory-list-panel.tsx`의 상수만 수정하면 되므로 일관성이 개선됐다.

### [INFO] `agent-memory.module.ts` exports 에 `AgentMemoryAdminService` 미포함
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.module.ts`
- 상세: `AgentMemoryAdminService`가 `providers`에 추가됐지만 `exports`에는 없다. 현재 컨트롤러만 사용하므로 의도적이며 올바른 캡슐화다. 미래에 다른 모듈이 admin 서비스를 필요로 한다면 `exports` 추가가 필요하다.
- 제안: 현재 설계 의도에 부합. 변경 불필요.

---

## 요약

이번 변경은 `AgentMemoryService`에서 admin read/delete 책임을 `AgentMemoryAdminService`로 분리(SRP)하고, `clearScope` 응답에 `X-Deleted-Count` 헤더를 추가해 0건 삭제 시 중립 토스트 UX를 구현한다. 핵심 부작용 위험은 두 가지다: (1) `AgentMemoryService`는 모듈에서 여전히 export되어 있으므로 삭제된 4개 메서드(`listScopes`/`listMemories`/`deleteMemory`/`clearScope`)를 외부 모듈이 사용하고 있었다면 런타임에서 깨진다 — 이번 diff 범위에서 컨트롤러 외 소비자가 보이지 않으나 검증이 필요하다. (2) `clearScope` 컨트롤러 메서드의 세 번째 파라미터(`res`) 추가는 HTTP 클라이언트에는 무영향이나 테스트 spec에서 이미 올바르게 반영됐다. CORS `exposedHeaders` 설정과 `AgentMemoryService` 외부 소비자 부재를 확인하면 나머지 변경사항은 부작용 위험이 낮다.

---

## 위험도

MEDIUM
