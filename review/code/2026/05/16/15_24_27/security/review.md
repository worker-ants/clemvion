# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** ConflictException 응답에 `integrationId` 필드 노출
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` — public-flow begin pre-check 블록 (diff +378~+383)
  - 상세: `throw new ConflictException({ code: ..., message: ..., integrationId: existingConnected.id })` 로 응답 바디에 충돌 대상 통합의 내부 UUID가 포함된다. 이 정보는 precheck endpoint의 `existingIntegrationId` 반환과 설계 의도상 중복이며, 409 오류 응답을 통해 인증된 사용자에게 노출된다. 같은 워크스페이스 내 사용자이므로 해당 ID를 볼 권한이 있다고 볼 수 있으나, 에러 응답 body에 포함되는 것이 의도된 API 계약인지 명시적으로 문서화되어 있지 않다. `precheckCafe24Mall` 응답과 달리 이 경로는 response DTO로 감싸지지 않아 shape 보장이 없다.
  - 제안: 409 응답의 `integrationId` 필드 노출을 의도적 설계로 Swagger 문서에 명시하거나, 노출이 불필요하다면 제거하여 에러 응답의 surface를 최소화한다.

- **[INFO]** precheck endpoint의 `existingName` 필드가 워크스페이스 내 타 사용자의 통합 이름을 노출
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` — `precheckCafe24Mall` 메서드 (diff +496~+541), `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `Cafe24PrecheckResultDto` (diff +91~+115)
  - 상세: `existingName` 필드는 동일 워크스페이스 내 다른 멤버가 등록한 통합의 display name을 반환한다. 통합 이름이 민감 정보를 포함할 수 있는 경우(예: 고객사명, 내부 프로젝트명 등) 인증된 동일 워크스페이스 멤버라면 접근할 수 있어 문제는 아니나, `member` 역할에게 타인의 통합 이름 노출이 인가 정책상 허용되는지 별도 검토가 필요하다. e2e 테스트(diff line 874~881)에서는 response shape에 credentials 등이 없음을 검증하나 `existingName` 접근 권한 자체는 검증하지 않는다.
  - 제안: 통합 목록 조회(`GET /api/integrations`) 와 동일한 인가 필터(워크스페이스 멤버십 확인)가 `findAllCafe24RowsForMall`에도 적용되는지 확인한다. 이미 `workspaceId` 파라미터로 격리되어 있다면 현재 구현은 적절하나, 서비스 레이어에서 `workspaceId`가 `@WorkspaceId()` 데코레이터를 통해 검증된 JWT claim으로부터만 획득되는지 컨트롤러 레벨에서 재확인할 것을 권장한다.

- **[INFO]** e2e 테스트에서 direct DB INSERT 시 `credentials` 컬럼을 빈 JSONB(`'{}'::jsonb`)로 삽입
  - 위치: `backend/test/integration-cafe24-precheck.e2e-spec.ts` — `insertCafe24Row` 함수 (diff +832~+839)
  - 상세: 테스트 코드 내 주석에서 "encryptedJsonTransformer를 우회"한다고 명시하고 있다. precheck endpoint가 `credentials`를 읽지 않으므로 기능 테스트 목적상 문제가 없으나, 동일한 `insertCafe24Row` 헬퍼가 다른 테스트 케이스로 재사용 확장될 경우 암호화 transformer를 우회한 row가 프로덕션 코드 경로로 흘러들어 예상치 못한 복호화 오류나 민감 정보 평문 노출이 발생할 수 있다. 테스트 격리가 충분한지(`afterAll` db.end()만 있고 row 정리 없음) 확인 필요하다.
  - 제안: `insertCafe24Row` 헬퍼에 "credentials는 의도적으로 평문/빈 값 — precheck 전용 테스트 only" 주석을 보강하고, 함수 이름이나 파일 범위를 precheck 테스트로 제한한다. e2e 테스트 간 데이터 격리를 위해 `afterAll`에서 삽입된 row를 삭제하는 정리 로직 추가를 검토한다.

- **[INFO]** 프론트엔드 에러 toast에 백엔드 `message` 필드 내용이 그대로 노출
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `formatErrorToast` 함수 (diff +1305~+1320)
  - 상세: `backendCode === 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED'`인 경우 `${primary} (${backendMessage})`로 백엔드의 영문 에러 메시지가 괄호 안에 사용자에게 노출된다. 현재 `message` 필드 값은 `'A Cafe24 integration for mall_id "..."  already exists...'`처럼 `mall_id` 값을 포함하며, 이는 사용자가 직접 입력한 값이므로 XSS 위험은 없다. 그러나 일반적으로 백엔드 내부 에러 메시지를 UI에 직접 노출하는 패턴은 의도치 않은 내부 정보(예: DB 테이블명, 스택 트레이스 등)가 섞여들 경우 민감 정보 노출로 이어질 수 있다.
  - 제안: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 케이스에서 `backendMessage`를 괄호 내 보조 정보로 노출하는 것이 의도된 UX라면 이를 spec에 명시하고, 백엔드에서 이 code에 대응하는 message 필드가 항상 안전한 내용만 포함하도록 서버 측에서도 보장할 것을 권장한다. 장기적으로는 에러 코드 기반으로 프론트엔드가 직접 메시지를 결정하는 패턴이 더 안전하다.

## 요약

이번 변경은 Cafe24 mall_id 중복 감지 UX 보강을 위한 precheck endpoint 추가 및 begin 단계 사전 가드 구현이다. 보안 관점에서 전반적으로 양호하게 설계되었다: 입력 검증(DTO 레벨 정규식 + `@Matches`)이 백엔드와 프론트엔드에서 일치하게 적용되어 있고, precheck 응답에서 자격 증명·토큰·timestamps를 의도적으로 제외하며, 인증 요건(`@WorkspaceId()` + JWT)이 유지되고, throttle(분당 60회)이 brute-force enumeration을 차단하고, cross-workspace 격리가 e2e 테스트로 검증된다. OWASP 관점의 주요 취약점(인젝션, 하드코딩 시크릿, 인증 우회, 안전하지 않은 암호화 등)은 발견되지 않았다. 발견된 항목은 모두 INFO 등급으로, 개선이 권장되나 즉각적인 보안 위협으로는 분류되지 않는다.

## 위험도

LOW
