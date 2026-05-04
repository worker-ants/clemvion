## 발견사항

### [WARNING] MCP 에러 코드 문자열 상수 미정의
- **위치**: `mcp-tool-provider.ts:354,370`, `integrations.service.ts:511`
- **상세**: `'MCP_AUTH_FAILED'`, `'MCP_CALL_FAILED'`, `'MCP_TOOL_ERROR'` 문자열 리터럴이 두 파일에 분산되어 있고 중앙 상수 정의 없이 사용됨. 한쪽에서 오타 발생 시 `logUsage` → `status flip` 체인이 조용히 깨짐.
- **제안**: 공유 상수 파일(`mcp-error-codes.ts` 등)에 `export const MCP_AUTH_FAILED = 'MCP_AUTH_FAILED'`로 추출하거나, provider와 service가 모두 import 가능한 위치에 enum/const object로 정의.

---

### [WARNING] 인증 실패 판별 정규식 인라인 매직 패턴
- **위치**: `mcp-tool-provider.ts` (catch 블록 내)
- **상세**: `/\b40[13]\b|unauthori[sz]ed|forbidden/i`가 코드 흐름 중간에 인라인으로 삽입됨. 패턴의 의미나 커버리지가 직관적이지 않고, 검색·수정·테스트 대상으로 파악하기 어려움.
- **제안**: 파일 상단 상수 영역에 명명된 상수로 분리.
```ts
const AUTH_FAILURE_RE = /\b40[13]\b|unauthori[sz]ed|forbidden/i;
```

---

### [WARNING] `nodeExecutionId`/`workflowId` 커플링 미반영
- **위치**: `agent-tool-provider.interface.ts:68-72`, `mcp-tool-provider.ts:logUsage`
- **상세**: 두 필드는 항상 쌍으로 이동하지만(`nodeExecutionId 와 한 묶음으로 흐름을 따라간다`) 인터페이스 상 분리된 optional 필드로 선언됨. 그 결과 `!ctx.nodeExecutionId || !ctx.workflowId` 복합 null 체크가 여러 곳에 반복되고, 하나만 전달하는 실수를 타입 시스템이 방지하지 못함.
- **제안**: 묶음 의미를 타입으로 표현하면 nil 체크가 한 곳으로 집약되고 인터페이스 의도가 명확해짐.
```ts
usageCtx?: { nodeExecutionId: string; workflowId: string };
```

---

### [INFO] 이중 에러 삼킴 패턴 인지 부담
- **위치**: `mcp-tool-provider.ts:logUsage`, `integrations.service.ts:logUsage`
- **상세**: service 레이어가 이미 내부 try-catch로 삼키고, provider 래퍼도 다시 try-catch로 감쌈. 주석이 의도를 설명하고 있으나, 예외가 실제로 전파될 수 있는 경로가 존재하는지 판단하기 위해 두 레이어를 모두 읽어야 함.
- **제안**: 현 설계 유지 시 래퍼 주석에 "service 내부 catch 외의 예외(= 코드 버그)만 도달" 조건을 명시. 또는 service가 이미 충분히 방어적이라면 provider 레이어의 이중 wrapping 제거 검토.

---

### [INFO] 테스트 내 공유 mock 객체 변이
- **위치**: `mcp-tool-provider.review.spec.ts:IntegrationUsageLog hooks > beforeEach`
- **상세**: `Object.assign(integrations, { logUsage })`가 상위 `beforeEach`에서 생성된 공유 객체를 직접 변이시킴. 현재는 각 `describe` 레벨 `beforeEach`가 재생성하므로 격리 문제가 없으나, 후속 테스트 추가 시 숨겨진 의존성 발생 가능.
- **제안**: `{ ...integrations, logUsage }`로 스프레드해 새 객체를 생성하거나, 해당 describe 스코프에서 독립적인 mock을 별도 선언.

---

### [INFO] 테스트에서 불필요한 기본값 명시
- **위치**: `integrations.service.spec.ts:700,714`
- **상세**: `makeIntegration({ status: 'connected', statusReason: null })`는 `makeIntegration()`의 기본값과 동일. 명시적 오버라이드가 가독성을 높인다는 의도로 보이나, 기본값 변경 시 테스트 의도가 흐려질 수 있음.

---

## 요약

이번 변경의 핵심인 `IntegrationUsageLog` 연동과 `MCP_AUTH_FAILED` 상태 전환 로직은 구조적으로 명확하고 기존 패턴을 잘 따른다. 가장 실질적인 유지보수 리스크는 **MCP 에러 코드 문자열의 분산** — 두 파일에 걸친 리터럴 불일치가 타입 검사 없이 숨겨진 버그로 이어질 수 있는 지점이다. `nodeExecutionId`/`workflowId` 커플링을 타입으로 명시하면 인터페이스 의도가 자기 문서화되고 반복 null 체크도 제거된다. 나머지 사항은 저위험 구조적 개선이다.

## 위험도
**LOW**