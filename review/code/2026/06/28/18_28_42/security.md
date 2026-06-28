# 보안(Security) 리뷰 결과

리뷰 대상: autoRefresh attention 술어 구현 (4개 코드 파일 + 2개 mdx 문서 파일 + review 산출물)
diff-base: origin/main

---

## 발견사항

### [INFO] 파라미터 바인딩 방식 — SQL 인젝션 방어 확인 (양호)
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `autoRefreshServiceTypes` NOT IN 절
- 상세: `SERVICE_REGISTRY`에서 동적으로 조회한 `autoRefreshServiceTypes` 목록이 TypeORM `andWhere(AUTO_REFRESH_NOT_IN, autoRefreshParams)` 파라미터 바인딩 (`:...autoRefreshServiceTypes`)으로 전달된다. 값이 DB/외부 입력이 아니라 컴파일 타임에 고정된 registry 상수에서 파생되므로 인젝션 여지가 없다. attention 분기 인라인 경로(`autoRefreshExclusion` 문자열 보간)도 `EXPIRING_SOON_INTERVAL`과 동일하게 고정 fragment + 파라미터 분리 구조를 유지하며, 사용자 입력이 직접 SQL 문자열에 삽입되는 경로가 없다.
- 제안: 없음.

### [INFO] 프론트엔드 입력 검증 — `autoRefresh` 필드 타입 신뢰
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` `needsAttention()`, `computeStatus()`
- 상세: `!integration.autoRefresh` 가드는 `IntegrationDto.autoRefresh`가 `boolean` 타입으로 선언된 것을 신뢰한다. 런타임에 서버 응답이 `null`/`undefined`를 반환할 경우 `!integration.autoRefresh === true`로 평가되어 만료 임박 표시가 발동할 수 있으나, 이는 false positive(불필요한 attention 표시)이지 보안 취약점이 아니다. DTO 타입 선언이 런타임 보장 역할도 하는지(변환 파이프라인에서 검증) 확인이 권장되나 현재 변경 범위에서는 신규 위험이 없다.
- 제안: 없음 (기존 DTO 유효성 검증 체계 범위).

### [INFO] 하드코딩된 service type 리터럴 부재 확인 (양호)
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` 전체 attention/expiring 분기
- 상세: 이번 변경의 설계 의도 중 하나인 "SQL service_type 리터럴 하드코딩 금지"가 실제로 구현됐다. `SERVICE_REGISTRY` 동적 조회 방식은 신규 provider 추가 시 registry 한 곳만 갱신하면 되는 구조로, 하드코딩된 값이 DB 쿼리에 직접 삽입되는 경로가 존재하지 않는다. 테스트 파일(`integrations.service.spec.ts`)에서 `cafe24`, `google`, `makeshop` 리터럴이 검증 고정값으로 사용되지만, 이는 테스트 어설션이지 프로덕션 쿼리 경로가 아니다.
- 제안: 없음.

### [INFO] mdx 문서 정보 노출 범위 적절
- 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx`, `integration-management.mdx`
- 상세: 사용자 노출 문서에 추가된 내용(`Cafe24, MakeShop, Google`이 자동 갱신 대상임을 명시, `integration_action_required` 알림 발송 조건 설명)은 사용자 가이드 수준의 정보로 내부 구현 세부(쿼리 로직, registry 구조, 인프라 설정 등)를 노출하지 않는다.
- 제안: 없음.

---

## 요약

이번 변경은 autoRefresh 통합을 attention/expiring 필터에서 제외하는 backend 쿼리 로직 수정, frontend `needsAttention()` 가드 구현, 관련 테스트 및 문서 업데이트로 구성된다. 보안 관점에서 주목할 만한 취약점은 발견되지 않았다. SQL 인젝션 방어는 TypeORM 파라미터 바인딩(`:...autoRefreshServiceTypes`)으로 올바르게 처리되었고, attention 분기 인라인 경로도 동일한 보호 방식을 사용한다. 사용자 입력이 쿼리에 직접 삽입되는 경로가 없으며, 하드코딩된 시크릿·API 키·비밀번호가 없고, 인증/인가 로직 변경도 포함되지 않는다. 에러 메시지 노출, 안전하지 않은 암호화 알고리즘, 알려진 취약점 라이브러리 도입 등 OWASP Top 10 해당 항목도 이번 diff 범위에서 식별되지 않는다.

## 위험도

NONE
