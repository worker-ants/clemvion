# 의존성(Dependency) 리뷰

## 발견사항

### 새 의존성 추가 없음 — 기존 스택 완전 재사용

- **[INFO]** 이번 변경(파일 1~16)에서 `backend/package.json` 및 `frontend/package.json`에 새 외부 패키지를 추가하지 않았다.
  - 위치: `backend/package.json`, `frontend/package.json`
  - 상세: 모든 기능이 기존 의존성만으로 구현됨. Backend의 throttle 기능은 이미 설치된 `@nestjs/throttler ^6.5.0`을 활용, DTO 검증은 `class-validator ^0.15.1` 및 `class-transformer ^0.5.1`을 재사용, 아이콘 추가(`AlertTriangle`)는 이미 의존하는 `lucide-react ^1.7.0`에서 추가 임포트만 수행.
  - 제안: 현 상태 유지. 별도 패키지 없이 기존 스택만으로 구현된 것은 번들 크기 관점에서 바람직하다.

---

### `lucide-react` 아이콘 추가 임포트

- **[INFO]** `frontend/src/app/(main)/integrations/new/page.tsx` 에서 `AlertTriangle`이 `lucide-react`의 임포트 목록에 추가되었다.
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` (diff +6~+10)
  - 상세: `lucide-react ^1.7.0`은 이미 프로젝트 의존성에 포함되어 있으며, 아이콘 라이브러리는 tree-shaking을 지원한다. 개별 named import(`AlertTriangle`) 방식이므로 사용하지 않는 아이콘이 번들에 포함되지 않는다.
  - 제안: 문제 없음. 현재 방식이 번들 크기 최소화 측면에서 올바르다.

---

### `@nestjs/throttler` 활용 방식 점검

- **[INFO]** `integrations.controller.ts`의 신규 엔드포인트 `@Get('cafe24/precheck')`에 `@Throttle({ default: { limit: 60, ttl: 60_000 } })` 데코레이터가 적용되었다.
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` (diff +596)
  - 상세: `@nestjs/throttler ^6.5.0`은 이미 `backend/package.json` 의존성에 존재한다. 신규 패키지 도입 없이 기존 throttler 모듈을 재사용한다.
  - 제안: 현 상태 유지. 단, `ThrottlerModule`이 전역 또는 해당 모듈에 설정되어 있는지 확인이 필요하지만, 이는 기존 코드에서 이미 처리된 사항으로 본 변경 범위 밖이다.

---

### `pg` 클라이언트 직접 사용 (e2e 테스트)

- **[INFO]** `backend/test/integration-cafe24-precheck.e2e-spec.ts` 에서 `import { Client } from 'pg'`를 직접 사용하여 DB에 row를 직접 INSERT 한다.
  - 위치: `backend/test/integration-cafe24-precheck.e2e-spec.ts` (diff +767)
  - 상세: `pg ^8.20.0`은 이미 `backend/package.json` 의존성에 존재하며, e2e 테스트에서의 직접 DB 조작은 기존 패턴과 일치한다(`createDbClient` 헬퍼 재사용). 신규 의존성 도입이 아니다.
  - 제안: 문제 없음.

---

### 내부 모듈 의존 관계 — `IntegrationOAuthService` 메서드 추가

- **[INFO]** `IntegrationOAuthService`에 `precheckCafe24Mall` public 메서드와 `findAllCafe24RowsForMall`, `findConnectedCafe24MallIntegration` private 헬퍼가 추가되어, 컨트롤러(`IntegrationsController`)에서 직접 `oauthService.precheckCafe24Mall()`을 호출한다.
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (diff +496~+541), `backend/src/modules/integrations/integrations.controller.ts` (diff +616)
  - 상세: 기존 컨트롤러가 이미 `oauthService`를 주입받고 있으므로 모듈 레벨 의존성 변화는 없다. 다만 precheck 기능이 OAuth 서비스 내에 위치하는 것이 의미상 적절한지 검토 여지가 있다 — precheck은 read-only 조회 성격으로 `IntegrationsService`가 더 자연스러운 위치일 수 있으나, 내부 `findAllCafe24RowsForMall` 헬퍼를 공유하기 위해 `IntegrationOAuthService`에 배치한 것은 코드 중복 제거 측면에서 합리적이다.
  - 제안: 현 구조 수용 가능. 추후 precheck 로직이 확장될 경우 별도 서비스로 분리를 고려할 수 있다.

---

### `TranslationKey` 타입 내부 의존성 추가

- **[INFO]** `frontend/src/app/(main)/integrations/new/page.tsx`에서 `@/lib/i18n`으로부터 `TranslationKey` 타입을 추가로 임포트한다.
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` (diff +1245)
  - 상세: 내부 모듈 타입 임포트이므로 외부 의존성 변화 없음. `conflictDescKey: TranslationKey | null` 타입 안전성을 확보하기 위한 적절한 사용이다.
  - 제안: 문제 없음.

---

### `Cafe24PrecheckResult` 타입 추가 및 위치

- **[INFO]** `frontend/src/lib/api/integrations.ts` 파일 하단에 `export interface Cafe24PrecheckResult`가 추가되었다.
  - 위치: `frontend/src/lib/api/integrations.ts` (diff +1552~+1557)
  - 상세: 타입 정의가 API 클라이언트 파일(`integrations.ts`) 내에 위치한다. `page.tsx`와 `__tests__/cafe24-precheck.test.tsx` 모두 이 인터페이스를 임포트하며, 단일 진실 원칙을 유지하고 있다. 외부 타입 라이브러리 추가 없이 자체 정의하는 방식은 적절하다.
  - 제안: 현 상태 유지.

---

### 버전 고정 방식 점검 — 캐럿(^) 사용

- **[WARNING]** 프로젝트 전반에 걸쳐 `^` (캐럿) 형태의 범위 버전이 사용된다. 이번 변경은 신규 패키지를 추가하지 않으므로 직접적 위험은 없으나, 기존 주요 의존성들이 고정되지 않은 상태임을 확인했다.
  - 위치: `backend/package.json`, `frontend/package.json` 전반
  - 상세: `@nestjs/throttler ^6.5.0`, `class-validator ^0.15.1`, `lucide-react ^1.7.0` 등 이번 변경에서 활용하는 모든 패키지가 `^` 범위를 사용한다. `package-lock.json`(또는 `npm ci`)을 통해 실제 설치 버전이 고정되는 구조이나, `^`는 마이너/패치 자동 업그레이드를 허용하므로 잠재적 비결정성이 있다.
  - 제안: CI 환경에서 `npm ci`를 사용해 `package-lock.json` 기반으로 설치하는지 확인한다. 신규 취약점 발생 시를 대비해 `npm audit`를 CI 파이프라인에 포함시키는 것을 권장한다. (이번 변경의 직접적 문제는 아님)

---

## 요약

이번 변경(Cafe24 mall_id 사전 중복 감지 UX — backend precheck 엔드포인트 + frontend inline 배너)은 외부 패키지를 전혀 추가하지 않았다. `@nestjs/throttler`, `class-validator`, `lucide-react`, `pg` 등 이번 구현에 활용된 모든 패키지는 이미 `package.json`에 존재하는 기존 의존성이다. 내부 모듈 의존 관계도 기존 `IntegrationOAuthService` 주입 경로를 그대로 활용하여 새로운 모듈 간 결합을 최소화했다. `Cafe24PrecheckResult` 인터페이스를 API 클라이언트 파일 내에 단일 정의하고 양쪽 소비자가 임포트하는 구조는 단일 진실 원칙에 부합한다. 의존성 관점에서 전체적으로 안전한 변경이며, 프로젝트 번들 크기나 빌드 시간에 유의미한 영향을 주지 않는다.

## 위험도

NONE
