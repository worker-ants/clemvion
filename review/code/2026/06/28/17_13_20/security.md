# 보안(Security) 리뷰 결과

리뷰 대상: autoRefresh attention 필터 구현 (integrations.service.ts, integrations.service.spec.ts, status-badge.tsx, status-badge.test.tsx)
diff-base: origin/main

---

## 발견사항

### [INFO] SQL 파라미터 바인딩 — `NOT IN (:...autoRefreshServiceTypes)` 패턴 적절
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `excludeAutoRefresh` 헬퍼 및 `attention` 분기 인라인 조건
- 상세: `autoRefreshServiceTypes` 배열이 TypeORM의 명명된 파라미터 바인딩(`:...autoRefreshServiceTypes`)을 통해 SQL에 전달된다. 런타임에 동적으로 생성되는 문자열이 SQL 프래그먼트에 직접 삽입되지 않고 파라미터로 전달되므로 SQL 인젝션 위험이 없다. `EXPIRING_SOON_INTERVAL`은 코드 내에 하드코딩된 SQL 리터럴(`"INTERVAL '7 days'"`)이지만, 이 값은 사용자 입력과 무관한 상수이며 변경 diff 범위에 포함되지 않는다.
- 제안: 없음.

### [INFO] `autoRefreshServiceTypes` 소스 신뢰성 — SERVICE_REGISTRY 정적 소스
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L116–L118 (추정), `SERVICE_REGISTRY` import
- 상세: `SERVICE_REGISTRY`는 코드 상수이며 사용자 입력·외부 데이터가 아니다. `.filter(s => s.supportsTokenAutoRefresh === true).map(s => s.type)`로 추출된 값은 컴파일 타임에 정적으로 결정된 문자열들(e.g., `'cafe24'`, `'google'`, `'makeshop'`)이다. 이 값들이 파라미터 바인딩을 통해 SQL에 전달되므로 인젝션 면역 구조다.
- 제안: 없음.

### [INFO] 빈 배열 가드 — `NOT IN ()` 구문 오류 방어
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `excludeAutoRefresh` 헬퍼 내 `if (autoRefreshServiceTypes.length > 0)` 조건 및 `attention` 분기의 삼항 연산자
- 상세: `autoRefreshServiceTypes`가 빈 배열일 경우 `NOT IN ()` 구문을 생성하지 않도록 양쪽 경로 모두에서 가드한다. 빈 `IN ()` 구문은 일부 DB 엔진에서 문법 오류 또는 예측 불가한 동작을 유발할 수 있으므로 이 방어 처리는 올바르다. 보안 관점에서도 빈 배열이 통과할 경우 `attention` 조건이 의도보다 넓어질 위험을 차단한다.
- 제안: 없음.

### [INFO] 프론트엔드 `needsAttention` — 클라이언트 사이드 필터링
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `needsAttention` 함수
- 상세: `!integration.autoRefresh` 가드가 추가됐다. 프론트엔드 필터는 UX 표시 목적이며 접근 통제 계층이 아니다. 백엔드 `findAll` 쿼리가 동일한 `NOT IN` 조건으로 데이터 반환을 제어하므로 프론트엔드 우회가 서버 측 데이터 노출로 이어지지 않는다. 인가 결정이 서버에서 이루어지는 올바른 설계다.
- 제안: 없음.

### [INFO] `autoRefresh` 필드 신뢰 모델 — DTO 파생 필드
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `integration.autoRefresh` 참조
- 상세: `autoRefresh`는 `IntegrationDto`의 파생 필드(`supportsTokenAutoRefresh`)로, 서버가 service registry 기반으로 계산해 내려보내는 값이다. 클라이언트가 이 값을 조작해도 백엔드 쿼리의 `NOT IN` 조건은 registry 기반으로 독립 계산되므로 클라이언트 측 조작이 서버 동작에 영향을 주지 않는다.
- 제안: 없음.

---

## 요약

이번 변경은 `integrations.service.ts`의 `expiring`/`attention` 필터 쿼리에서 자동 갱신 통합을 제외하는 기능과, 프론트엔드 `needsAttention` 술어의 `autoRefresh` 가드 추가로 구성된다. 보안 관점에서 주요 위험 요소인 SQL 인젝션은 TypeORM 명명된 파라미터 바인딩을 통해 완전히 차단됐고, 파라미터 소스가 사용자 입력이 아닌 정적 service registry임을 고려하면 공격 면이 존재하지 않는다. 빈 배열 가드가 `excludeAutoRefresh` 헬퍼와 `attention` 인라인 조건 양쪽 모두에 일관되게 적용돼 있으며, 프론트엔드 필터는 UX 전용이고 인가 결정은 서버에서 독립 수행된다. 하드코딩된 시크릿, 인증/인가 우회, 민감 정보 노출 등 다른 보안 취약점은 발견되지 않았다. 변경셋 전체 위험도는 NONE이다.

## 위험도

NONE
