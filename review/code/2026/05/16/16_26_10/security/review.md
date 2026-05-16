# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** 테스트 mock 에 평문 시크릿 유사 문자열 존재
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `buildFakeCafe24Integration` 함수 (추가된 라인 전체, 특히 `clientSecret` 파라미터)
  - 상세: `buildFakeCafe24Integration`은 `clientSecret` override를 허용하며 `credentials.client_secret`으로 매핑한다. 현재 기본값으로 실제 시크릿이 주입되지 않고, 테스트 파일이므로 프로덕션 코드 경로는 아니다. 그러나 `overrides.clientSecret !== undefined`일 때 해당 값이 credentials 객체에 평문으로 포함되며, 향후 실제 시크릿 값을 인자로 넘기는 테스트가 추가될 경우 git 이력에 남을 위험이 있다. 현재 diff에서는 실제 비밀값이 하드코딩되지 않아 즉각적 위협은 없음.
  - 제안: `clientSecret` 파라미터는 테스트 내에서도 항상 `'test-secret'`, `'fake-secret'` 등 명시적 더미 값만 사용하도록 주석 또는 타입 문서에 명기한다. 실제 시크릿이 절대 이 파라미터로 유입되지 않도록 코드 리뷰 가이드라인 보강.

- **[INFO]** `installToken` 필드가 mock 객체에 기본값 `undefined`(null)로 노출
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `buildFakeCafe24Integration` 반환 객체의 `installToken`, `installTokenIssuedAt` 필드
  - 상세: `installToken: overrides.installToken`으로 override가 없으면 `undefined`가 할당된다. 이는 테스트 파일이므로 직접 보안 위협은 없으나, 실제 서비스 코드에서 install token의 null 처리 분기가 mock과 다르게 동작할 경우 인증 우회 관련 테스트 커버리지에 공백이 생길 수 있다.
  - 제안: `installToken` 기본값을 `null`로 명시(TypeScript에서 `undefined`와 `null`은 런타임 동작이 다를 수 있음)하여, 실제 코드의 null 처리 로직과 테스트 mock이 일치하도록 보장.

- **[INFO]** Swagger `description` 에 내부 구현 세부사항 노출
  - 위치: `integrations.controller.ts` — `@ApiOperation` description 필드 (변경된 라인)
  - 상세: 변경된 description에 `ParseUUIDPipe`, route 순서에 관한 내부 구현 상세("`:id` 로 소비돼 `ParseUUIDPipe` 가 400 을 일으킨다"), spec 내부 참조 경로(`spec/2-navigation/4-integration.md §9.2 Rationale`) 등이 공개 API 문서(Swagger)에 포함된다. 이 정보는 공격자에게 내부 라우팅 구조, 파이프 구성, 에러 트리거 방법 등에 대한 단서를 제공할 수 있다.
  - 제안: 공개 API description에는 사용자 관점의 기능 설명만 포함하고, 구현 세부사항(파이프명, 에러 조건, 내부 spec 경로)은 코드 주석으로 이동. 예: `"현재 워크스페이스에 같은 mall_id의 cafe24 통합이 이미 있는지 사전 확인합니다. ..."` 이후의 `Route order note` 블록을 `@ApiOperation` 외부 주석으로 분리.

- **[INFO]** 트랜잭션 미적용 주석의 보안 관련 설명 (정보 참고)
  - 위치: `integrations.service.ts` — 추가된 주석 블록 (라인 394~403)
  - 상세: 트랜잭션을 의도적으로 생략한 근거를 상세히 주석으로 명시하였다. 특히 "V045 UNIQUE race loser 가 토큰을 재사용해도 보안상 위험 — 의도적으로 재사용 차단 (race-loser 는 OAuth 재실행 필요)" 설명은 race condition 처리 의도를 명확히 한다. 이는 보안 관점에서 긍정적인 문서화이며, preview_token의 원자적 소비(`DELETE…RETURNING`)가 실제 서비스 코드에서 올바르게 구현되어 있다면 TOCTOU(Time-of-check/Time-of-use) 취약점을 적절히 방어한다.
  - 제안: audit_log 기록 실패 시 integration row가 저장된 채로 audit 없이 남을 수 있는 케이스(저장 성공 + audit 실패)에 대한 운영 모니터링(alert) 또는 보상 로직 존재 여부를 별도 확인 권장. 이 시나리오는 보안보다 데이터 정합성 이슈이지만 audit log 누락은 보안 감사에 영향.

- **[INFO]** 메타데이터 파일들에서 다수 API 엔드포인트 일괄 삭제
  - 위치: `application.ts`, `collection.ts`, `community.ts`, `design.ts`, `mileage.ts`, `notification.ts` 등
  - 상세: Phase 8x 라벨이 붙은 다수 Cafe24 API 엔드포인트 메타데이터가 일괄 삭제되었다. 삭제된 항목들은 `appstore/orders`, `appstore/payments`, `databridge/logs`, `themes/{theme_no}/pages`, `urgentinquiry` 등 민감한 데이터에 접근하는 엔드포인트를 포함한다. 보안 관점에서 메타데이터 삭제 자체는 공격 노출면 축소 효과가 있으나, 삭제 이유가 명확히 문서화되지 않으면 나중에 불완전 구현 상태로 재추가될 위험이 있다.
  - 제안: 삭제된 엔드포인트가 향후 재추가될 경우, 특히 `theme_pages` (HTML/CSS 직접 접근), `urgentinquiry` 등은 입력 검증과 권한 범위 확인을 재검토해야 함을 spec 또는 TODO 주석에 명기.

## 요약

이번 변경은 주로 테스트 코드 리팩터링(mock factory 함수 도입), 미완성 API 메타데이터 일괄 삭제, Swagger 문서 문자열 정리, 그리고 트랜잭션 미적용 근거 주석 추가로 구성된다. 전체적으로 하드코딩된 실제 시크릿, SQL 인젝션, XSS, 커맨드 인젝션 등의 즉각적인 고위험 취약점은 발견되지 않았다. 주목할 점은 Swagger description에 내부 구현 세부사항(파이프명, 라우팅 오동작 조건, 내부 spec 경로)이 포함된 것으로, 공개 API 문서를 통해 공격자에게 불필요한 정보를 제공할 수 있다. 테스트 mock의 `clientSecret` 파라미터는 현재 더미 값만 사용하지만 실제 시크릿 유입 방지를 위한 명시적 가이드라인이 권장된다. 전반적으로 보안 위험도는 낮은 수준이다.

## 위험도

LOW
