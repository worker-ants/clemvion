# 요구사항(Requirement) 코드 리뷰

## 발견사항

### 파일 1: integration-oauth.service.cafe24.spec.ts

- **[WARNING]** `buildFakeCafe24Integration` 팩토리에서 `mallId=null` + `credentialsMallId` 미지정 케이스의 폴백 값이 의도와 불일치할 수 있음
  - 위치: `buildFakeCafe24Integration` 함수, 62-64행 (`credentialsMallId` 연산)
  - 상세: `overrides.mallId === null` 로 명시하면 `mallId` 변수는 `null` 이 된다. 이후 `credentialsMallId = overrides.credentialsMallId ?? mallId ?? 'priv-shop'` 에서 `overrides.credentialsMallId` 가 `undefined` 이고 `mallId` 가 `null` 이면 `null ?? 'priv-shop'` 이 아니라 `null` 을 반환한다 (`??` 는 `null`도 건너뛴다). 따라서 `credentials.mall_id` 가 `null` 로 설정돼 legacy row 의 `credentials.mall_id` 가 실제 mall_id 문자열이어야 한다는 비즈니스 규칙(V045 이전 row 는 plain `mall_id` 컬럼이 없지만 `credentials.mall_id` 는 항상 유효한 문자열)을 위반한다.
  - 제안: `credentialsMallId = overrides.credentialsMallId ?? (mallId ?? 'priv-shop')` 처럼 괄호를 추가하거나, `mallId` 가 `null` 인 경우 `credentialsMallId` 기본값 분기를 별도로 처리한다. 혹은 legacy 케이스를 호출하는 모든 테스트에서 `credentialsMallId` 를 명시 override 하도록 강제한다.

- **[WARNING]** `buildFakeCafe24Integration` 의 `name` 기본값이 `credentialsMallId` 기반으로 생성되나 일부 테스트에서 `name` override 없이 기대값과 불일치할 위험
  - 위치: `buildFakeCafe24Integration` 반환 객체, 77행 (`name: overrides.name ?? \`${credentialsMallId} (Cafe24)\``)
  - 상세: 기존 인라인 mock 에서 `name: 'priv-shop (Cafe24 Private)'` 처럼 `(Cafe24 Private)` suffix 를 가진 테스트(line 680 precheck 'returns conflict=true' case)는 팩토리 기본값인 `priv-shop (Cafe24)` 와 다르다. 해당 테스트에서는 `name` override 를 명시하고 있어 실제 실패는 없으나, 기본 suffix 가 `(Cafe24)` 임을 문서화하지 않으면 미래 테스트 추가 시 오해를 유발할 수 있다.
  - 제안: 팩토리 JSDoc 에 기본 `name` 형식(`${mallId} (Cafe24)`)을 명시하거나, `appType` 에 따라 suffix 를 `(Cafe24 Private)` / `(Cafe24 Public)` 으로 분기하는 방식을 고려한다.

- **[INFO]** `buildFakeCafe24Integration` 에서 `workspaceId` 필드가 생략됨
  - 위치: `buildFakeCafe24Integration` 반환 객체 (75-86행)
  - 상세: 기존 인라인 mock 중 일부(`workspaceId: 'ws-1'`)는 `workspaceId` 를 포함했으나 팩토리에서 이 필드를 제거했다. 현재 서비스 로직이 repo 쿼리 결과 내 `workspaceId` 를 직접 참조하지 않는 한 문제없지만, 향후 서비스 로직이 반환된 row 의 `workspaceId` 를 비교하는 로직이 추가될 경우 팩토리가 부적절한 mock 을 제공하게 된다.
  - 제안: `workspaceId` 옵션을 팩토리 override 에 추가하거나, 제거가 의도적임을 JSDoc 에 명시한다.

- **[INFO]** `status: 'initializing'` 케이스 테스트(line 292-306)에서 `buildFakeCafe24Integration`이 `status: 'initializing'` 을 그대로 전달하지 못하는 구조적 문제 없음 — 확인 완료
  - 위치: line 295-303
  - 상세: `buildFakeCafe24Integration({ ..., status: 'initializing' })` 는 `overrides.status` 를 그대로 사용하므로 정상. 단, TypeScript 타입 상 `status` 가 `string` 으로 열려있어 오타도 컴파일 오류 없이 통과한다.
  - 제안: `status` 타입을 `'connected' | 'pending_install' | 'error' | 'expired' | 'initializing' | string` 처럼 known values를 유니언으로 명시해 자동완성 힌트를 제공한다.

---

### 파일 2: integration-oauth.service.ts

- **[INFO]** 변경 사항이 타입 선언 포맷 정리만으로 기능적 변화 없음 — 요구사항 관점에서 이슈 없음
  - 위치: 345-347행 (`Cafe24PrecheckStatus` 타입 선언 한 줄로 합침)
  - 상세: 두 줄짜리 타입 선언을 한 줄로 합친 순수 포맷 변경이며 기능·타입 의미 모두 동일하다.
  - 제안: 없음.

---

### 파일 3: integrations.controller.ts

- **[WARNING]** Swagger `description` 에 라우트 순서 제약(`Route order note`)을 삽입했으나 이 정보가 런타임 안전망으로 작동하지 않음
  - 위치: `@ApiOperation` description 필드, line 371
  - 상세: Swagger 문서 description 은 사람이 읽는 문서일 뿐이며, 실제 라우트 순서 보장은 NestJS 코드 구조에 달려있다. description 에 경고를 넣는 것은 발견 가능성이 낮다. 코드 내 기존 주석(line 590-595)이 더 적합한 위치이며 이미 존재한다.
  - 제안: Swagger description 의 `Route order note` 절을 제거하고 코드 주석으로만 관리하거나, 별도 integration test 로 라우트 충돌을 검증한다(예: `GET /integrations/cafe24/precheck` 가 `ParseUUIDPipe` 오류 없이 200 응답하는 e2e 케이스 추가).

- **[INFO]** `cafe24Precheck` 핸들러가 `@Roles` 데코레이터 없이 선언되어 있음 — 요구사항에서 인증 사용자면 충분한지 확인 필요
  - 위치: line 596-617 (`cafe24Precheck` 메서드)
  - 상세: `@Roles('editor')` 없이 인증(`@ApiBearerAuth`)만 요구하는 구조다. precheck 는 read-only 조회이므로 viewer 권한이면 충분하고 의도적 설계일 수 있으나, 다른 읽기 엔드포인트(`findOne`, `listUsages`, `activity`)도 동일하게 `@Roles` 미부착이므로 일관성은 있다.
  - 제안: spec §9.2 에서 precheck 접근 권한 요구사항을 명시적으로 확인하고 코드 주석에 의도를 기록한다.

- **[INFO]** `mallId` 유효성 검증 규칙(`^[a-z0-9-]{3,50}$`)이 Swagger BadRequest 설명에는 명시됐으나 실제 `Cafe24PrecheckQueryDto` 유효성 검사 로직은 이 diff 범위 외
  - 위치: line 608 (`@ApiBadRequestResponse` description)
  - 상세: Swagger 설명에 정규식 패턴이 명시되어 있으나 실제 DTO 검증이 해당 패턴과 일치하는지 이 diff 에서는 확인 불가. 불일치 시 Swagger 가 거짓 안내가 된다.
  - 제안: `Cafe24PrecheckQueryDto.mallId` 에 `@Matches(/^[a-z0-9-]{3,50}$/)` 가 적용되어 있는지 확인하고, 없다면 추가한다.

---

## 요약

이번 변경의 핵심은 spec 파일에 산재하던 인라인 mock 객체를 `buildFakeCafe24Integration` 팩토리 함수로 통합한 테스트 리팩토링과, precheck 엔드포인트의 라우트 순서 회귀 안전망 주석 보강이다. 기능 완전성과 비즈니스 로직(mall_id 중복 감지, app_type 무관 409, legacy row 처리) 측면에서는 전반적으로 올바르게 반영되어 있다. 다만 `credentialsMallId` 기본값 연산에서 `null` 과 `??` 연산자 조합이 legacy 케이스에서 의도치 않게 `null` 을 전파할 수 있고, Swagger description 에 런타임과 무관한 라우트 제약을 삽입하는 방식은 실질적 안전망이 되지 않는다. 나머지 발견사항은 가독성·미래 유지보수성 관점의 낮은 위험도 사안이다.

## 위험도

LOW
