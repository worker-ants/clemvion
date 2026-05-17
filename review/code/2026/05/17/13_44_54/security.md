# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `autoRefresh` 필드는 순수 UI 힌트용 derived 필드로, 서버 측 접근 제어나 토큰 갱신 로직에 영향을 주지 않음
  - 위치: `backend/src/modules/integrations/integrations.service.ts` L1036–1041, `service-registry.ts` L840
  - 상세: `autoRefresh` 값은 `service-registry`의 정적 정의에서 lookup하여 매 응답마다 계산되며 DB에 저장되지 않는다. 이 설계는 클라이언트가 이 값을 신뢰해 실제 토큰 갱신 여부를 판단해서는 안 된다는 전제를 암묵적으로 내포한다. 현재 코드에서 이 값은 UI 표기(라벨, 색상 분기)에만 사용되므로 보안상 직접적인 위해가 없다.
  - 제안: API 문서(Swagger) 주석에 "이 필드는 UI 힌트 전용이며 서버 측 갱신 동작을 보장하지 않는다"는 명시적 경고를 추가하면 미래의 소비자가 오남용할 가능성을 낮출 수 있다.

- **[INFO]** `needsAttention()` 함수가 `autoRefresh` 플래그를 고려하지 않아 백엔드 EXPIRING_SOON_INTERVAL 쿼리와 의미가 불일치함
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L2664–2668, commit 메시지 "본 PR 범위 밖 (후속 PR)" 항목
  - 상세: `computeStatus`에서는 `expiresSoon && !autoRefresh` 조건으로 autoRefresh 통합을 attention 술어에서 제외하지만, `needsAttention()`은 `isExpiringSoon(tokenExpiresAt)` 만으로 판단하여 autoRefresh=true인 통합도 여전히 "attention" 목록에 포함된다. 이는 현재로선 UI 오표시 문제이지만, 서버 측 `?status=attention` 필터와 클라이언트 측 배지 계산이 달라지면 데이터 노출 범위 기대가 어긋날 수 있다. 보안 관점에서 직접적 취약점은 아니나, 상태 불일치는 접근 제어 판단 오류의 전조가 될 수 있다.
  - 제안: 후속 PR에서 `needsAttention()` 내부도 `!integration.autoRefresh` 가드를 추가하고, 백엔드 EXPIRING_SOON_INTERVAL 쿼리에도 동일 조건을 반영하여 클라이언트·서버 간 일관성을 보장한다.

- **[INFO]** `credentials` 필드가 `Record<string, unknown>` 타입으로 응답 DTO에 포함되어 마스킹 여부를 스키마 수준에서 강제할 수 없음
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L142
  - 상세: 이번 PR의 변경 사항은 아니지만, `credentials` 필드 자체가 이미 응답에 포함되어 있고 마스킹은 `maskCredentials()` 함수에 의존한다. `secret: true` 필드가 서비스 레지스트리에 누락되면 실제 토큰 값이 응답에 포함될 수 있다. 이번 변경(autoRefresh 추가)으로 새로운 비밀 필드가 노출되지는 않는다.
  - 제안: `secret: true` 필드 목록을 별도 상수로 분리하여 누락 방지 및 감사(audit)를 용이하게 하는 것이 권장된다. 이 또한 이번 PR 범위 밖이다.

- **[INFO]** `humanizeUntil()` 함수에서 `new Date(at).getTime()`이 유효하지 않은 날짜 문자열에 대해 `NaN`을 반환할 수 있으나 방어 처리됨
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L2649–2662
  - 상세: `!Number.isFinite(ms)` 검사로 NaN 케이스를 명시적으로 처리하여 빈 문자열을 반환한다. UI에서는 이 빈 문자열을 truthy check로 가드하므로 XSS 등의 직접적인 위험은 없다. 단, `tokenExpiresAt`이 임의 문자열인 경우 렌더링에 빈 값이 나올 뿐 별도 에러 없이 처리된다.
  - 제안: 현행 방어 코드는 적절하다. 추가 조치 불필요.

- **[INFO]** `InfoRow` 컴포넌트의 `tooltip` prop이 사용자 제공 문자열이 아닌 서버 응답 기반 포맷된 날짜 문자열로 채워짐
  - 위치: `frontend/src/app/(main)/integrations/[id]/page.tsx` L1662–1666
  - 상세: `tooltip` 값은 `formatDate(integration.tokenExpiresAt, "datetime")`의 결과로, 사용자가 직접 입력하는 값이 아니라 서버 응답의 datetime 문자열을 포맷한 것이다. React의 JSX 렌더링은 기본적으로 XSS를 방어하므로 이 경로를 통한 스크립트 인젝션 위험은 없다.
  - 제안: 현행 구현은 안전하다. 추가 조치 불필요.

- **[INFO]** 서비스 레지스트리 `findService()` 함수에 대한 입력 검증은 호출자에 위임됨
  - 위치: `backend/src/modules/integrations/services/service-registry.ts` L1468–1470
  - 상세: `findService(entity.serviceType)`는 DB에서 읽어온 `serviceType` 문자열을 그대로 받아 배열 검색을 수행한다. 미등록 타입은 `undefined`를 반환하고, `autoRefresh` 계산 시 `?.supportsTokenAutoRefresh === true` 옵셔널 체이닝으로 안전하게 `false`로 귀결된다. DB 컬럼 값이 악의적으로 조작된 경우에도 레지스트리 배열 순회만 일어나며 인젝션 위험은 없다.
  - 제안: 현행 구현은 안전하다. 추가 조치 불필요.

## 요약

이번 PR은 UI 힌트 전용 derived 필드(`autoRefresh: boolean`)를 백엔드 서비스 레지스트리 기반으로 계산해 응답 DTO에 추가하고, 프론트엔드 상태 배지 로직을 갱신한 변경이다. 보안 관점에서 새로운 공격 벡터를 도입하지 않으며 하드코딩된 시크릿, SQL 인젝션, XSS, 인증 우회 등 OWASP Top 10 범주의 취약점은 발견되지 않았다. 기존 credentials 마스킹 메커니즘(`maskCredentials`, `secret: true`)은 그대로 유지되고 `autoRefresh` 필드 자체는 민감 정보를 포함하지 않는다. 단, `needsAttention()` 함수가 `autoRefresh`를 고려하지 않아 클라이언트 측 attention 집계와 서버 필터 간 경미한 의미 불일치가 잔존하는데, 이는 이미 plan에 후속 PR로 명시된 사항으로 현 시점 보안 위험도에는 영향을 주지 않는다.

## 위험도

LOW
