# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 파일 2: cors-origins.spec.ts

- **[WARNING]** 테스트 격리 중 `process.env` 직접 교체 패턴의 잠재적 누락
  - 위치: `afterAll(() => { process.env = originalEnv; })` (파일 2, 전체 컨텍스트)
  - 상세: `beforeEach`에서 `delete process.env.CORS_ORIGINS` 등 개별 키를 지우는 방식과 `afterAll`에서 객체 전체를 교체하는 방식이 혼용되어 있다. `afterAll`은 모든 테스트가 끝난 후 한 번만 실행되므로, 테스트 도중 한 테스트가 실패하거나 예외가 발생해도 `process.env` 오염이 다음 테스트에 영향을 줄 수 있다. 또한 `process.env = originalEnv`는 Node.js 환경에서 실제 환경 변수 객체를 교체하지 않고 로컬 참조만 교체할 수 있어 일부 런타임에서 부작용이 완전히 해소되지 않는다.
  - 제안: `afterEach`에서도 `delete` 또는 값 복원을 수행하거나, `jest.replaceProperty(process, 'env', ...)` 혹은 `process.env`의 스냅샷 기반 복원 유틸을 사용해 테스트 간 환경 변수 오염을 방지한다.

- **[INFO]** `process.env` 직접 쓰기에 의한 환경 변수 부작용 (코드 변경과 무관, 기존 패턴)
  - 위치: 파일 2 전체, 각 테스트 케이스 내 `process.env.CORS_ORIGINS = ...`, `process.env.FRONTEND_URL = ...`, `process.env.NODE_ENV = ...`
  - 상세: 이번 diff 자체는 긴 문자열의 줄바꿈 포맷 변경만이며 환경 변수 쓰기 로직은 변경되지 않았다. 환경 변수 부작용은 기존부터 존재하던 패턴으로 diff 범위 내에서 신규로 도입된 것은 아니다.
  - 제안: 현황 유지 가능. 단, 테스트 격리 강화를 위해 `afterEach` 복원 패턴 도입을 권장한다.

---

### 파일 7: integrations.service.spec.ts

- **[INFO]** `registerEntityTester` 호출이 테스트 간 공유 상태를 변경할 수 있음
  - 위치: 파일 7, 새로 추가된 `it('rejects pending_install integration ...')` 블록 내 `service.registerEntityTester('cafe24', probe)`
  - 상세: `service.registerEntityTester`는 `IntegrationsService` 인스턴스의 `entityTesters` Map에 `'cafe24'` 키를 등록한다. `beforeEach`에서 `service`가 재생성된다면 문제없으나, 만약 `service`가 `describe` 블록 수준의 공유 인스턴스라면 이 테스트 이후 `'cafe24'` 키가 남아 이후 테스트에 영향을 줄 수 있다. 기존 파일 전체 컨텍스트가 제공되지 않아 `beforeEach` 재생성 여부를 diff만으로는 확인할 수 없다.
  - 제안: `service`가 `beforeEach`에서 매번 재생성됨을 확인하거나, 각 테스트 후 `entityTesters`를 정리하는 `afterEach` 훅을 추가한다.

---

### 파일 8: integrations.service.ts

- **[INFO]** 신규 조기 반환 분기 추가 — 기존 로직 실행 순서 변경
  - 위치: 파일 8, `testConnection` 메서드 내 `if (entity.status === 'pending_install')` 블록 (라인 +864~+875)
  - 상세: `pending_install` 상태인 경우 `entityTester` 및 `dispatchTest` 경로 진입 전에 조기 반환된다. 이는 의도된 동작이며 `entityTester`의 외부 API 호출(네트워크 부작용)을 원천 차단하는 효과가 있다. 기존에 `pending_install` 상태인 integration에 대해 `entityTester`가 등록되어 있었다면, 이전까지는 실제 외부 프로브가 실행되었을 수 있다. 이번 변경으로 그 경로가 차단되어 네트워크 부작용이 제거된다 — 이는 긍정적 변경이다.
  - 제안: 현황 유지. `pending_install` 상태에서 외부 프로브가 억제됨을 문서(스펙/JSDoc)에 명시하면 향후 유지보수성이 높아진다.

---

### 파일 14: cafe24-mcp-tool-provider.ts

- **[INFO]** import에서 `McpServerSummary` 타입 제거
  - 위치: 파일 14, `import { McpSkipReason, pushMcpServerSummary } from './mcp-diagnostics.js'` (타입 `McpServerSummary` 제거)
  - 상세: `McpServerSummary`가 import 목록에서 제거되었다. 이 타입이 해당 파일 내에서 로컬 타입 선언 없이도 사용되고 있다면 컴파일 오류가 발생하지만, diff 범위 내 코드 변경에서는 해당 타입의 직접 사용이 삭제되었음을 확인할 수 있다(파일 13의 spec 파일에서 `import('./mcp-diagnostics').McpServerSummary`로 동적 임포트 사용). 따라서 타입 제거 자체는 올바른 정리다. 다만 해당 타입이 파일 내 다른 위치에서 사용되고 있는지 확인이 필요하다.
  - 제안: 컴파일 결과를 검증해 `McpServerSummary` 미사용 여부를 확인한다.

---

### 파일 18: catalog-sync.spec.ts

- **[INFO]** `resolveRepoRoot` 폴백 경로 — 파일시스템 경로 도출 로직 포맷 정리
  - 위치: 파일 18, `join(__dirname, '..', '..', '..', '..', '..', '..', '..')`
  - 상세: 이번 변경은 `join()` 인자들을 한 줄로 합친 포맷 변경이다. 함수 로직·경로 깊이(7단계)는 변경되지 않았으며, 파일시스템 부작용도 없다. `resolveRepoRoot`가 `git rev-parse` 실패 시 이 폴백으로 경로를 계산하므로 실행 환경에 따라 잘못된 루트를 반환할 수 있다는 기존 위험은 여전히 남아 있으나, 이는 diff 범위 외 사항이다.
  - 제안: 현황 유지.

---

### 전체 파일 공통 (파일 1, 3~6, 9~13, 15~17, 19~27)

- **[INFO]** 순수 코드 포맷 변경 — 부작용 없음
  - 위치: 전 파일 diff
  - 상세: 대부분의 변경은 Prettier/ESLint 기준의 줄 길이 초과 해소를 위한 줄바꿈·들여쓰기 정리, 따옴표 스타일 통일(`'` ↔ `"`)에 해당한다. 함수 시그니처, 공개 API, 이벤트 발행 로직, 전역 변수, 파일시스템 접근, 환경 변수 읽기/쓰기 어느 것도 변경되지 않았다. 실행 동작에 영향을 주는 코드 변경은 파일 7(신규 테스트 케이스 추가)과 파일 8(`pending_install` 조기 반환 분기 신규 추가) 두 곳에 한정된다.
  - 제안: 현황 유지.

---

## 요약

이번 변경셋은 대부분 코드 포매터(Prettier) 적용으로 인한 줄바꿈·따옴표 통일이며 실질적인 로직 변경은 두 곳에 국한된다. 파일 8(`integrations.service.ts`)에서 `pending_install` 상태의 integration에 대한 외부 API 프로브를 조기 차단하는 분기가 추가되었는데, 이는 의도된 것으로 오히려 기존의 불필요한 네트워크 부작용을 제거하는 긍정적 변경이다. 파일 2(`cors-origins.spec.ts`)에서는 기존부터 존재하던 `process.env` 직접 쓰기 패턴이 유지되고 있으며, `afterAll`에서만 복원하는 구조가 테스트 격리 측면에서 잠재적 위험을 내포한다. 파일 7의 신규 테스트에서 `registerEntityTester` 호출이 공유 상태를 변경할 수 있으나 `beforeEach` 재생성이 보장된다면 무해하다. 전반적으로 부작용 관점에서 CRITICAL 또는 HIGH 수준의 문제는 발견되지 않았다.

## 위험도

LOW
