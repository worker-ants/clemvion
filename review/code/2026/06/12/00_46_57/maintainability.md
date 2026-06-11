# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: audit-logs.spec.ts

- **[INFO]** `makeService` 팩토리 함수 사용으로 테스트 셋업 중복을 로컬에서 제거
  - 위치: 51-56번 줄 (신규 describe 블록)
  - 상세: `makeService` 헬퍼는 작은 범위에서만 쓰이므로 describe 내부에 위치 — 적절한 캡슐화
  - 제안: 없음 (현재 구조 적합)

- **[INFO]** `entry` 상수를 두 개의 it-block이 공유
  - 위치: 58-65번 줄
  - 상세: describe 블록 상단에 const로 선언되어 두 테스트가 공유. 변이 없으므로 문제 없음
  - 제안: 없음

### 파일 2: audit-log-response.dto.ts

- **[INFO]** `@ApiProperty.description` 문자열 연결 방식
  - 위치: 244-253번 줄 (신규 diff)
  - 상세: 긴 description을 `+` 연산자로 이어 붙임. 기능상 문제 없으나, 동일 파일 내 다른 프로퍼티가 단일 짧은 문자열만 사용하는 것과 비교하면 스타일 불일치가 있다. template literal로 쓰거나 줄바꿈 없이 긴 문자열 하나로 작성하는 편이 코드베이스 내 일관성 면에서 더 통일적이다.
  - 제안: 단일 template literal `` `...` `` 사용 또는 긴 단일 문자열 — 기능 영향 없음, 우선순위 낮음

### 파일 3: auth-configs.controller.spec.ts

- **[INFO]** `as never` 타입 캐스팅 다수 사용
  - 위치: 373, 374, 377, 383, 385, 387, 389, 394, 399, 404줄
  - 상세: NestJS 의존성 주입 테스트에서 목 객체를 `as never`로 캐스팅하는 패턴은 기존 파일 전체에서 일관되게 사용 중이므로 신규 추가분도 일관성에 부합함
  - 제안: 없음 (기존 패턴 준수)

- **[INFO]** 테스트 픽스처 상수(`WS`, `USER`, `IP`, `req`)를 describe 최상위에 선언
  - 위치: 352-355번 줄
  - 상세: 대문자 상수로 명확히 구분되어 가독성 양호

### 파일 4: auth-configs.service.spec.ts

- **[WARNING]** 로컬 `userId` 상수 제거 후 `USER` 상수로 일원화 — 긍정적 변경이나 부작용 가능성 확인 필요
  - 위치: 601-614번 줄 diff
  - 상세: `const userId = 'user-1'` 로컬 변수를 제거하고 모듈 레벨 `const USER = 'user-1'`로 교체함. 두 값이 동일하므로 동작 변경 없음. 단, 로컬 변수가 해당 describe에서만 의미 있는 범위를 가졌던 경우 모듈 레벨 상수로 상향함으로써 범위(scope) 신호가 약해진다. 다만 `USER`가 이미 전체 파일에서 일관 사용 중이므로 수용 가능
  - 제안: 현재 패턴 유지 — 실제 문제 없음

- **[INFO]** 하드코딩된 문자열 `'auth_config.create'` 등을 `AUDIT_ACTIONS.*`으로 교체
  - 위치: 변경 diff 전체 (180, 198, 223, 243, 263번 줄)
  - 상세: 매직 문자열 제거라는 유지보수성 관점에서 명확히 긍정적인 변경. 향후 상수 값이 변경되어도 테스트가 자동 추적됨

### 파일 5: auth-configs.service.ts

- **[INFO]** `USAGE_RECENT_CALLS_LIMIT = 20` 상수 추출
  - 위치: 1534-1535번 줄
  - 상세: 기존 `.limit(20)` 매직 넘버를 의미 있는 상수로 교체. 주석도 `findAll`의 기본 페이지 크기와 동일함을 명시 — 두 값이 우연히 동일한 게 아님을 문서화함
  - 제안: 없음 (좋은 변경)

- **[INFO]** `recordAudit` private 메서드 추출 — DRY 개선
  - 위치: 1565-1582번 줄
  - 상세: 5개 CRUD 경로(create/update/regenerate/remove/reveal)의 `auditLogsService.record` 호출을 단일 private 래퍼로 통합. `resourceType`을 고정하고 named params 객체를 사용함으로써 positional string 인자 스왑 오류를 컴파일러 레벨에서 차단 — 코드 내 주석에도 근거 명시됨. 이 리팩터는 중복 제거와 타입 안전성 둘 다 개선
  - 제안: 없음

- **[WARNING]** `import * as crypto` 와 `import { randomBytes } from 'crypto'` 중복 임포트
  - 위치: 1511-1512번 줄 (전체 파일 컨텍스트)
  - 상세: 이번 변경에서 추가된 것은 아니지만, `crypto` 모듈을 네임스페이스와 named import 두 방식으로 이중 import하고 있음. `randomBytes`는 `crypto.randomBytes`로 통일하거나, 반대로 모든 사용을 named import로 통일하면 더 일관적임
  - 제안: `import * as crypto from 'crypto'`만 유지하고 `randomBytes` 사용부를 `crypto.randomBytes`로 교체 — 또는 named import만 사용. 현재 변경 범위 밖이므로 별도 이슈로 추적

- **[INFO]** JSDoc 참조 경로 수정 (`audit-logs.service.spec` → `audit-logs.spec`)
  - 위치: 1415-1417번 줄
  - 상세: 파일명 변경에 맞춰 주석 내 참조 업데이트 — 문서 정확성 개선

### 파일 6: integrations.service.spec.ts

- **[INFO]** 하드코딩된 액션 문자열(`'integration.deleted'`, `'integration.rotated'` 등)을 `AUDIT_ACTIONS.*`으로 교체
  - 위치: diff 전체 (1150, 1162, 1173, 1182, 1191번 줄)
  - 상세: 파일 4와 동일한 패턴 — 매직 문자열 제거로 유지보수성 개선

- **[INFO]** 신규 테스트 블록 (`update`, `reauthorize` audit) 구조가 기존 describe 분리 패턴과 일치
  - 위치: 2103-2143번 줄
  - 상세: 구분선 주석(`// -----------------------------------------------------------------`)과 describe 명명 방식이 파일 내 기존 관습과 일관됨

### 파일 7: workspaces.service.spec.ts

- **[INFO]** 단일 문자열 교체 — 변경 범위 최소화
  - 위치: 717번 줄
  - 상세: `'workspace.transfer_ownership'` → `AUDIT_ACTIONS.WORKSPACE_TRANSFER_OWNERSHIP` 단일 교체. 간결하고 의도 명확

---

## 요약

이번 변경 세트의 핵심은 두 가지 유지보수성 개선이다. 첫째, 분산된 매직 문자열(`'auth_config.create'`, `'integration.deleted'` 등)을 `AUDIT_ACTIONS` 상수로 일원화하여, 향후 액션 식별자 변경 시 테스트가 자동으로 추적되고 오탈자로 인한 조용한 실패 위험을 제거했다. 둘째, `auth-configs.service.ts`의 `recordAudit` 추출이 DRY 원칙과 타입 안전성을 동시에 달성한다 — 5개 CRUD 경로의 반복 코드를 제거하고 named params 객체를 강제함으로써 컴파일러가 positional string 스왑을 잡을 수 있게 됐다. `USAGE_RECENT_CALLS_LIMIT` 상수 추출도 의도를 명확히 문서화한다. 전반적으로 기존 코드베이스 스타일(as never 캐스팅, 구분선 주석, describe 명명 관습)을 충실히 따르고 있어 일관성이 양호하다. 경미한 개선 여지는 `audit-log-response.dto.ts`의 긴 문자열 연결 방식과 `auth-configs.service.ts`의 이중 crypto import이나, 둘 다 이번 변경의 주요 초점과 무관하며 기능 영향 없다.

## 위험도

LOW
