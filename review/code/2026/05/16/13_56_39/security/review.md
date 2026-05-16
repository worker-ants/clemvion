# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** 백엔드 SQL — 파라미터 바인딩 방식 혼용 (안전)
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `attention` 분기 (diff +143~+149)
  - 상세: `expiring`/`expired`/`error` 단일값 분기는 TypeORM 의 named parameter (`:s`) 를 사용하는 반면, 신규 `attention` 분기는 상수 리터럴을 SQL 문자열에 인라인(`'expired'`, `'error'`, `'connected'`)한다. 인라인된 값은 모두 코드에서 고정된 문자열 상수이며 사용자 입력이 절대 삽입되지 않는다. DTO 레이어에서 `@IsIn(INTEGRATION_STATUSES)` 가 `status` 파라미터를 allowlist로 검증하고, `attention` 분기 내부에서는 사용자 입력이 전혀 쿼리에 반영되지 않으므로 SQL 인젝션 위험은 없다.
  - 제안: 현재 코드는 안전하다. 다만 향후 이 패턴을 확장할 때 사용자 입력 값을 인라인하지 않도록 팀 내 규칙을 명문화하거나, 일관성 차원에서 TypeORM 의 `Brackets`/`orWhere` API + named parameter 방식으로 교체하면 코드 리뷰 부담이 줄어든다.

- **[INFO]** 프론트엔드 라우팅 — `mostUrgentId` 를 URL에 직접 삽입
  - 위치: `frontend/src/app/(main)/integrations/page.tsx` — `onActivate` 콜백 (diff +555~+558)
  - 상세: `attention.mostUrgentId` (서버에서 반환된 통합 ID) 를 `router.push(\`/integrations/${attention.mostUrgentId}\`)` 로 URL에 삽입한다. ID는 서버 응답 DTO의 필드이므로 공격자가 직접 제어하지 않는다. Next.js 의 `router.push`는 HTML 렌더링이 아니라 라우팅 호출이므로 XSS 가 발생하지 않는다. 단, 만약 서버가 ID 값에 `../` 같은 경로 탐색 문자를 허용하면 의도치 않은 경로로 이동할 수 있다.
  - 제안: 현재 위험 수준은 낮다. 서버 측 ID 생성이 UUID 또는 alphanumeric slug 등 형식을 강제하고 있다면 추가 조치가 불필요하다. 확인이 어렵다면 `router.push` 전에 ID가 alphanumeric + 하이픈 형식인지 간단한 정규식 검사를 추가하는 것을 권장한다.

- **[INFO]** DTO Swagger description 에 가상 필터값 구현 세부사항 노출
  - 위치: `backend/src/modules/integrations/dto/integration.dto.ts` — `@ApiPropertyOptional.description` (diff +55)
  - 상세: Swagger 문서에 "서버에서 합집합 WHERE 절로 변환된다" 라는 내부 구현 설명이 포함되어 있다. 이 정보는 공격자에게 쿼리 구조를 힌트로 줄 수 있다. 그러나 실질적인 취약점으로 이어지려면 SQL 인젝션 가능성이 선행되어야 하는데 현재는 그렇지 않다. 또한 Swagger 는 일반적으로 내부 개발자 도구 용도로 사용된다.
  - 제안: 외부에 노출되는 API 문서라면 description을 "가상 필터값 — 만료/오류 상태를 일괄 조회" 수준의 사용자 친화적 문구로 줄이는 것을 권장한다. 내부 전용이라면 현재 수준으로 충분하다.

- **[INFO]** 테스트 코드 내 SQL 단편 문자열 하드코딩
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts` — `status=attention` 관련 테스트 (diff +91~+96)
  - 상세: 테스트가 `qb.andWhere` 에 전달된 SQL 문자열을 직접 검사(`toContain("'expired'")` 등)한다. 이는 보안 취약점은 아니나, 내부 SQL 구조를 테스트에 고정하면 향후 ORM 방식 변경 시 테스트 유지 비용이 높아지고, 잘못된 SQL 형태임에도 테스트가 통과할 수 있는 표면을 만든다.
  - 제안: 보안 목적이 아닌 설계 개선 사항이다. 중장기적으로는 통합 테스트 또는 e2e 테스트에서 실제 쿼리 결과로 검증하는 방향이 더 견고하다.

## 요약

이번 변경은 "주의 필요(Attention)" 가상 필터값을 백엔드 DTO/서비스와 프론트엔드 배너/라우팅에 걸쳐 도입하는 기능 구현이다. 보안 관점에서 가장 중요한 지점인 SQL 구성부를 살펴보면, 신규 `attention` 분기는 사용자 입력을 쿼리에 직접 삽입하지 않고 고정 리터럴만 사용하며, 진입 전 DTO 레이어의 `@IsIn` allowlist 검증이 적용되어 SQL 인젝션 위험이 없다. 프론트엔드에서 서버 응답 ID를 URL에 직접 삽입하는 패턴은 Next.js 라우팅 특성상 XSS로 이어지지 않으나 ID 형식 보장이 명시적이면 더 안전하다. 하드코딩된 시크릿, 인증/인가 우회, 암호화 문제, 민감 정보 에러 노출은 발견되지 않았다. 발견된 4건은 모두 INFO 등급으로, 즉각적인 수정이 필요한 취약점은 없다.

## 위험도

LOW
