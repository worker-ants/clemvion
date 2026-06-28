# 성능(Performance) 리뷰

## 발견사항

### 파일 1: http-exception.filter.ts
- **[INFO]** 매직 문자열 → named 상수(`UNKNOWN_ERROR_MESSAGE`, `UNHANDLED_ERROR_MESSAGE`) 추출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` (신규 상수 선언부)
  - 상세: `static readonly` 상수는 클래스 레벨에서 한 번만 할당되며, 이전의 인라인 문자열 리터럴과 메모리·런타임 비용 차이가 없다. 성능 관점 이슈 없음.
  - 제안: 해당 없음.

### 파일 2: hooks.service.ts
- **[INFO]** 로컬 `extractClientIp` 래퍼 제거 → 호출부 직접 호출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` L202, L257 (diff 기준)
  - 상세: 단순 위임 래퍼(`extractClientIp`) 제거로 함수 호출 스택 1단계가 줄었다. 영향은 나노초 수준으로 실질적 차이는 없다. 더 중요한 것은 `extractClientIpFromHeaders` 자체가 O(1) 헤더 조회(문자열 비교·`.split(',')[0]` 파싱)로 이미 상수 시간 연산임을 확인할 수 있다. 성능 관점 이슈 없음.
  - 제안: 해당 없음.

- **[INFO]** `handleChatChannelWebhook` 메서드 초반부에서 `clientIp` 조기 추출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` L257 (diff 기준 두 번째 호출부)
  - 상세: `clientIp`가 메서드 초반에 추출되지만 실제 사용은 특정 분기(`executionEngineService.execute`)에서만 이루어진다. early-return 경로에서는 IP 파싱이 무용 연산이 된다. 그러나 `extractClientIpFromHeaders`가 단순 헤더 문자열 파싱(O(1))이므로 실제 비용은 무시할 수 있는 수준이다. 고빈도 핫패스에서 주의할 패턴이긴 하나 현재 비용 프로파일에서는 문제 없음.
  - 제안: 성능 임계점 진단 시 사용 직전으로 이동을 검토할 수 있으나 현재는 개선 우선순위 없음.

### 파일 3: public-webhook-throttle.guard.ts
- **[INFO]** 인라인 익명 타입 → named interface(`PublicWebhookReqShape`) 추출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (신규 interface 선언부)
  - 상세: TypeScript 인터페이스는 컴파일 타임에만 존재하며 런타임 오버헤드가 없다. 성능 관점 이슈 없음.
  - 제안: 해당 없음.

### 파일 4: client-ip.spec.ts / public-webhook-throttle.guard.spec.ts / http-exception.filter.spec.ts (테스트 파일)
- **[INFO]** `beforeEach` 스냅샷(`{ ...process.env }`) + `afterEach` 복원 패턴
  - 위치: `client-ip.spec.ts` 각 describe 블록 beforeEach, `public-webhook-throttle.guard.spec.ts` beforeEach
  - 상세: `{ ...process.env }`는 `process.env` 객체 전체를 얕은 복사한다. `process.env`에 수십~수백 개의 환경 변수가 있을 경우 테스트 케이스마다 소규모 객체 할당이 발생한다. 일반적인 Node.js 테스트 환경에서 이 비용은 무시 가능하며, 격리 정확성 향상이 가져오는 이점이 훨씬 크다. `jest.restoreAllMocks()`도 `afterEach`에서 한 번 호출되어 spy 누적 없이 정리되므로 테스트 실행 전체에서 메모리 누수 위험이 감소했다.
  - 제안: 해당 없음. 현 패턴이 이전 `try/finally` + 수동 복원보다 오히려 예외 경로에서의 누수 리스크를 제거한다.

---

## 요약

이번 변경셋은 코드 정리(로컬 래퍼 제거, 상수화, 인터페이스 추출)와 테스트 격리 강화가 주 내용으로, 런타임 동작을 보존하는 리팩터링이다. 성능 관점에서 신규 도입된 연산은 없으며, 제거된 래퍼 함수로 인해 호출 스택이 1단계 감소하는 미미한 개선이 있다. `handleChatChannelWebhook` 초반부의 `clientIp` 조기 추출이 early-return 경로에서 무용 연산을 발생시키나, `extractClientIpFromHeaders`가 O(1) 헤더 파싱임을 감안하면 실측 부담이 없다. 테스트 파일의 `{ ...process.env }` 얕은 복사는 per-test 소규모 할당이지만 격리 정확성 이점이 비용을 압도한다. 전반적으로 성능 관점에서 우려할 변경사항이 없는 안전한 정리 작업이다.

## 위험도

NONE
