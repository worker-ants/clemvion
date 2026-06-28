# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** i18n/RoleGate mock 블록이 두 신규 테스트 파일에 완전 동일하게 중복
  - 위치: `codebase/frontend/src/app/(main)/agent-memory/components/__tests__/memory-list-panel.test.tsx` L4-18, `scope-list-panel.test.tsx` L4-18
  - 상세: `vi.mock("@/lib/i18n", ...)` 내부의 딕셔너리 순회 + 파라미터 치환 로직(약 14줄)과 `vi.mock("@/components/auth/role-gate", ...)` 블록이 두 파일에 한 글자도 다르지 않게 복사되어 있다. 세 번째 패널 테스트 파일이 추가될 때 동일 패턴이 다시 복사될 가능성이 높고, mock 로직 변경 시 모든 파일을 수동으로 동시 수정해야 한다.
  - 제안: `__tests__/test-helpers.ts` (또는 Vitest `setupFiles`)에 공통 mock을 추출한다. Vitest 의 `vi.mock` 은 파일 최상단 hoisting 제약이 있으므로 헬퍼 함수를 export 하고 각 파일에서 import 후 `vi.mock` 팩토리에서 호출하는 방식을 사용한다.

- **[WARNING]** `'X-Deleted-Count'` 헤더 이름이 magic string으로 산재
  - 위치: `codebase/backend/src/main.ts` L122 (`exposedHeaders: ['X-Deleted-Count']`), `web-chat-cors.ts` JSDoc, 추정 `agent-memory.controller.ts`, 프론트엔드 `agent-memories.ts`
  - 상세: `'X-Deleted-Count'` 가 여러 파일에 문자열 리터럴로 중복 등장한다. 헤더 이름 변경 시 grep 으로 수동 교체해야 하며, 타입 시스템이 오탈자를 잡지 못한다. CORS 노출 설정(main.ts)과 헤더 세팅(controller)/읽기(frontend api) 의 이름이 일치해야 기능이 동작하므로 불일치 시 런타임에야 발견된다.
  - 제안: 백엔드 공유 상수(`export const AGENT_MEMORY_DELETED_COUNT_HEADER = 'X-Deleted-Count'`)를 선언하고 main.ts/controller 양쪽에서 참조한다. 프론트엔드도 동일 패턴 적용.

- **[INFO]** 테스트 설명에 내부 리뷰 추적 ID 포함 (`W10:`)
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.spec.ts` L173 `'W10: 비-튜플(flat array)...'`
  - 상세: `W10` 은 코드 리뷰 내부 추적 번호다. 테스트 목적 자체는 설명 본문이 잘 전달하지만, 추적 ID 는 코드가 아닌 커밋 메시지에 두는 것이 더 적절하다. CI 실패 로그에서 `W10:` 이 표시될 때 맥락을 모르는 개발자가 의미를 파악하기 어렵다.
  - 제안: `'비-튜플(flat array) DELETE 결과도 rows 길이로 affected 산출 (방어 분기)'` 처럼 리뷰 ID 를 제거한다.

- **[INFO]** `baseProps` 함수 시그니처 포맷 불일치
  - 위치: `scope-list-panel.test.tsx` L461 (한 줄) vs `memory-list-panel.test.tsx` L318-320 (두 줄)
  - 상세: 두 파일이 같은 디렉터리에 동시 신설되었으나 `baseProps` 매개변수 줄 바꿈 스타일이 서로 다르다. 사소하지만 동일 패턴의 파일이므로 일관성이 기대된다.
  - 제안: 프로젝트 prettier `printWidth` 기준으로 통일.

- **[INFO]** `exposedHeaders` 필드의 JSDoc 이 `CorsOptionsLike` 에만 추가되고 사용처(main.ts)에는 인라인 주석으로 중복 설명
  - 위치: `codebase/backend/src/common/cors/web-chat-cors.ts` L62-66, `codebase/backend/src/main.ts` L120-122
  - 상세: 인터페이스 JSDoc 이 완비되어 있어 사용처의 인라인 주석은 다소 중복이다. 현재 상태로도 가독성에 문제는 없으나, 주석이 두 곳 중 한 곳만 갱신되는 drift 가 발생할 수 있다.
  - 제안: main.ts 인라인 주석을 "// see CorsOptionsLike.exposedHeaders JSDoc" 한 줄로 단순화하거나 현행 유지 — 현 규모에서는 수용 가능.

## 요약

이번 변경에서 새로 도입된 유지보수성 문제는 범위가 좁다. `web-chat-cors.ts` 의 `exposedHeaders` 필드 추가와 logger dead code 제거는 명확하고 깔끔하며 인터페이스 계약을 올바르게 확장한다. 가장 주목할 부분은 두 신규 테스트 파일에 i18n/RoleGate mock 블록이 완전 동일하게 복사된 점으로, 패널 테스트가 추가될수록 중복이 계속 확산될 구조다. `'X-Deleted-Count'` magic string 도 현재 영향 범위는 작지만 공유 상수로 중앙화하는 것이 바람직하다. 이전 리뷰(23_02_30)에서 이미 이월된 W5(SQL 파라미터 슬롯), W7(패널 JSX 중복) 은 이번 변경이 새로 추가한 것이 아니므로 재차 기술하지 않는다. 전반적으로 신규 위험은 낮고 코드 의도 전달은 양호하다.

## 위험도

LOW
