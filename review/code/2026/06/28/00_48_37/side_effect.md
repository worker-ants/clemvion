# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `defaultOptions.exposedHeaders` — 모든 web-chat CORS 응답에 전파
- 위치: `codebase/backend/src/main.ts` defaultOptions 팩토리
- 상세: `exposedHeaders: ['X-Deleted-Count']` 가 `defaultOptions` 에 추가됐다. 이 옵션은 web-chat CORS 미들웨어가 처리하는 **모든** cross-origin 응답에 `Access-Control-Expose-Headers: X-Deleted-Count` 를 포함시킨다 — `clearScope` 엔드포인트뿐 아니라 그 미들웨어 스코프 안의 다른 모든 경로도 포함된다. `X-Deleted-Count` 를 실제로 보내지 않는 엔드포인트에서도 이 헤더가 Expose 목록에 실리지만, 브라우저는 없는 헤더를 무시하므로 기능 문제는 없다.
- 추가 주의: `defaultOptions` 와 별도 경로별 CORS 옵션이 **병합(merge)** 되는지 **덮어쓰기(override)** 되는지는 diff 에 나타나지 않은 미들웨어 내부에 달려 있다. 실행 ID 기반 allowlist 검사가 별도 옵션을 반환할 경우 `exposedHeaders` 가 누락될 수 있다. e2e 218건이 green 으로 확인됐으므로 현재 통합 경로에서는 정상 동작 중이나, 추후 CORS 옵션 병합 로직 수정 시 이 점을 인지해야 한다.
- 제안: 현재 동작 유지. 미들웨어 옵션 병합 로직 변경 시 `exposedHeaders` 전파 여부를 함께 검증하는 테스트를 추가할 것을 권장한다.

### [INFO] `CorsOptionsLike` 인터페이스 확장 — 기존 구현체 무영향
- 위치: `codebase/backend/src/common/cors/web-chat-cors.ts` L66
- 상세: `exposedHeaders?: string[]` 가 optional 필드로 추가됐다. 기존에 `CorsOptionsLike` 를 구현하는 코드는 이 필드를 생략해도 컴파일·런타임 에러가 없으므로 breaking change 가 없다.
- 제안: 변경 불필요.

### [INFO] `AgentMemoryAdminService.logger` 제거 — 예상 외 상태 변경 없음
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts`
- 상세: `private readonly logger = new Logger(AgentMemoryAdminService.name)` 와 `Logger` import 가 제거됐다. NestJS `Logger` 는 생성 시 전역 로거 레지스트리에 자신을 등록하지 않으므로 이 제거로 인한 전역 상태 변경은 없다. 순수한 dead code 정리다.
- 제안: 변경 불필요.

### [INFO] 테스트 파일 신규 추가 — 파일시스템 외 부작용 없음
- 위치:
  - `codebase/frontend/src/app/(main)/agent-memory/components/__tests__/memory-list-panel.test.tsx` (신규)
  - `codebase/frontend/src/app/(main)/agent-memory/components/__tests__/scope-list-panel.test.tsx` (신규)
  - `codebase/frontend/src/lib/api/__tests__/agent-memories.test.ts` (확장)
  - `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.spec.ts` (확장)
- 상세: 모두 vi.mock / jest.fn 기반으로 격리 실행되며, 전역 상태·파일시스템·네트워크·환경 변수를 변경하지 않는다. `vi.mock('@/lib/i18n', ...)` 와 `vi.mock('@/components/auth/role-gate', ...)` 는 테스트 모듈 스코프에서만 유효하고 다른 테스트로 누출되지 않는다.
- 제안: 변경 불필요.

---

## 요약

이번 커밋은 이전 ai-review(23_02_30) 에서 식별된 W1(CORS exposedHeaders 누락) / W6(dead logger) / W8-W11(테스트 보강) 를 해소하는 후속 수정이다. 부작용 관점의 실질 위험은 없다. `defaultOptions.exposedHeaders` 추가는 web-chat CORS 스코프 전체에 헤더를 노출하는 범위가 의도보다 넓지만 브라우저 동작상 무해하고 e2e 218건으로 검증됐다. `CorsOptionsLike` 인터페이스 확장은 optional 추가이므로 기존 구현체에 영향이 없고, logger 제거는 전역 상태 무관한 dead code 정리이며, 신규 테스트는 격리된 mock 기반이라 런타임 부작용이 없다.

## 위험도

NONE
