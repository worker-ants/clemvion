# 신규 식별자 충돌 검토 결과

## 발견사항

충돌에 해당하는 발견 사항이 없습니다.

### 검토 결과 상세

#### 1. 요구사항 ID 충돌

변경 범위 내에서 새로 부여된 정식 요구사항 ID 는 없다. 코드 주석의 `M-1` 레이블은 `/Volumes/project/private/clemvion/plan/in-progress/refactor/03-maintainability.md` §M-1 의 계획 항목(`handleInstall` vs `handleMakeshopInstall` 중복 제거)을 지칭하는 인라인 참조로, 기존 `03-maintainability.md M-1` 항목과 **동일한** 항목을 가리킨다. `M-1` 레이블은 `06-concurrency.md`, `04-security.md`, `05-database.md` 등 다른 refactor plan 파일에서도 자체 `M-1` 항목을 독립 사용하는 관행이 있으나, 이는 각 파일 내부의 숫자 인덱스이고 plan 파일 간 ID 체계가 충돌하는 것은 기존 구조가 허용하는 범위다. 본 변경이 새 요구사항 ID 를 **부여**하거나 spec 에 등록하는 것은 아니다.

#### 2. 엔티티/타입명 충돌

신규 도입 식별자 네 개는 모두 `IntegrationOAuthService` 클래스의 `private` 메서드다:

- `assertInstallTimestampFresh` — 타임스탬프 ±5분 윈도우 검증
- `assertInstallNonceNotReplayed` — nonce replay 캐시 검증
- `buildIntegrationDetailRedirectUrl` — post-install redirect URL 조립
- `persistReauthorizeState` — OAuthState 행 생성·저장

`origin/main` 코드베이스 전체(`codebase/`, `spec/`) 에서 이 네 이름은 발견되지 않는다. 다른 서비스나 모듈에서 동명 함수/메서드를 정의한 사례도 없다. `IntegrationInstallConfig` 인터페이스(plan 문서에서 권장 방안으로 거론된)는 실제 구현에 도입되지 않았으므로 충돌 없다.

#### 3. API endpoint 충돌

변경은 순수한 내부 리팩터링(private 헬퍼 추출)이며 새 endpoint 가 추가되지 않는다. 기존 엔드포인트 `GET /api/3rd-party/cafe24/install/:installToken` · `GET /api/3rd-party/makeshop/install/:installToken` 의 경로·HTTP 메서드·응답 계약은 변경 없다.

#### 4. 이벤트/메시지명 충돌

SSE·WebSocket·BullMQ 큐·webhook 이벤트 이름에 영향을 주는 변경이 없다.

#### 5. 환경변수·설정키 충돌

신규 환경변수나 설정 키가 도입되지 않는다.

#### 6. 파일 경로 충돌

신규 파일이 추가되지 않는다. 변경 파일은 기존의 세 파일(`integration-oauth.service.ts`, `integration-oauth.service.cafe24.spec.ts`, `integration-oauth.service.makeshop.spec.ts`)에만 국한된다.

---

## 요약

본 변경(03 M-1 — install 보일러플레이트 4종 private 헬퍼 추출)은 신규로 도입된 식별자가 모두 `IntegrationOAuthService` 클래스 내부의 `private` 메서드로 캡슐화되며, `origin/main` 전체 코드베이스·spec·plan 어디에서도 동명 식별자가 다른 의미로 사용된 사례가 없다. 에러 코드(`CAFE24_INSTALL_REPLAY`, `MAKESHOP_INSTALL_REPLAY`)는 기존과 동일한 이름을 유지하고 의미도 보존된다. API 계약·이벤트·파일 경로·환경변수 변화 없음. 식별자 충돌 위험 없음.

## 위험도

NONE
