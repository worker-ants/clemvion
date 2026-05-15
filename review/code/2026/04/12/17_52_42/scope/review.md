### 발견사항

---

**[WARNING]** 인테그레이션 구현과 무관한 포맷팅 전용 변경 — 7개 파일
- 위치:
  - `execution-engine.service.ts:756` — `new Set(...)` 줄바꿈
  - `hooks.controller.ts:25` — `@Req()` 데코레이터 줄바꿈
  - `hooks.module.ts:9` — `imports` 배열 한 줄로 압축
  - `hooks.service.ts:97,128` — 삼항 연산자 줄바꿈
  - `schedule-runner.service.ts:19,89` — 클래스 선언 및 메서드 호출 줄바꿈
  - `schedules.module.ts:10` — import 줄바꿈
  - `schedules.service.ts:136` — 삼항 연산자 줄바꿈
- 상세: 위 7개 파일은 기능 변경이 전혀 없고 오직 코드 포맷팅(줄바꿈/줄 합치기)만 수정됨. Prettier/ESLint 자동 포맷이 의도치 않게 적용된 것으로 보임.
- 제안: 포맷팅 전용 커밋을 별도로 분리하거나, 현 PR에서 해당 변경을 되돌려 리뷰 노이즈 제거 및 diff 가독성 확보.

---

**[WARNING]** OAuth 토큰 교환이 스텁으로 구현됨
- 위치: `integration-oauth.service.ts:159-172` (`syntheticCredentials`, `syntheticExpiresAt`)
- 상세: 실제 provider token endpoint 호출 없이 `stub-` 접두어 토큰을 생성. 코드 내 주석으로 "Phase C"로 표시하여 의도적 미완성임을 표명. 그러나 스펙의 OAuth 흐름(`§10`)에서 실제 토큰 교환은 핵심 기능이며, 현 상태로 사용자에게 노출될 경우 연결이 실제로 작동하지 않음.
- 제안: 스텁 구현임을 API 응답 또는 별도 플래그로 명시하거나, 최소한 TODO 이슈로 트래킹 필요. 스펙 범위 내 구현이라면 명확히 단계 구분 필요.

---

**[INFO]** SQL 마이그레이션과 TypeORM 엔티티 간 인덱스 정의 불일치
- 위치:
  - `V008__integration_usage_log_and_metadata.sql:47` — `ON integration_usage_log (integration_id, at DESC)`
  - `integration-usage-log.entity.ts:18` — `@Index('idx_integration_usage_log_integration_at', ['integrationId', 'at'])`
- 상세: SQL은 `at DESC` 내림차순 인덱스를 정의하지만 TypeORM 엔티티는 정렬 방향 없이 선언. 마이그레이션이 소스 오브 트루스이므로 실제 동작에는 영향 없으나, 향후 TypeORM 마이그레이션 자동 생성 시 불필요한 diff 발생 가능.
- 제안: TypeORM `@Index`에 `{ descending: true }` 옵션을 추가하거나 마이그레이션에서 DESC 제거하여 일치시킴.

---

**[INFO]** `ActivityQueryDto`의 숫자 파라미터를 문자열로 수신 후 컨트롤러에서 수동 변환
- 위치: `dto/integration.dto.ts:ActivityQueryDto`, `integrations.controller.ts:121-128`
- 상세: `limit`, `days`를 `@IsString()`으로 선언하고 컨트롤러에서 `Number()` 변환 후 `isFinite` 검사. class-validator의 `@Type(() => Number)` + `@IsInt()` 패턴이 더 관용적이나, 기능에는 영향 없음.
- 제안: 현재 구현 방식도 동작하므로 필수 수정은 아님. 일관성 차원에서 다른 DTO와 맞추는 것 권장.

---

**[INFO]** `frontend/src/app/(main)/integrations/new/page.tsx` — `service.scopes`에 대한 null 안전성
- 위치: `new/page.tsx:77` — `service.scopes.filter(...)`
- 상세: 프론트엔드 `ServiceDefinition` 타입에서 `scopes: ScopeOption[]` (필수)로 선언되어 있으나, 백엔드 `ServiceDefinition` 인터페이스에서는 `scopes?: ScopeOption[]` (선택). API 응답에서 `scopes`가 누락된 서비스에 대해 런타임 오류 가능성 있음.
- 제안: `service.scopes?.filter(...)` 또는 백엔드/프론트엔드 타입 일치화.

---

### 요약

이번 변경은 `spec/2-navigation/4-integration.md` 기반의 인테그레이션 모듈 전체 구현(OAuth, 만료 스캐너, 사용 로그, 신규 UI 플로우)으로, 핵심 변경 범위는 의도와 일치함. 다만 **`execution-engine`, `hooks`, `schedules` 모듈 내 7개 파일에 기능과 무관한 포맷팅 전용 변경이 혼입**되어 diff 가독성을 저해하고 있으며, 이는 범위를 벗어난 노이즈임. 또한 OAuth 토큰 교환이 스텁으로 처리된 점은 스펙 완성도 관점에서 추적이 필요함.

### 위험도

**LOW**