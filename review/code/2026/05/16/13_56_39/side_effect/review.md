# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 1: `backend/src/modules/integrations/dto/integration.dto.ts`

- **[INFO]** `INTEGRATION_STATUSES` 배열에 `'attention'` 추가 — 공개 상수 변경
  - 위치: `INTEGRATION_STATUSES` 배열 및 파생 타입 `IntegrationStatusFilter`
  - 상세: `as const` 배열이므로 타입 `IntegrationStatusFilter`는 자동으로 `'attention'`을 포함하도록 확장된다. 이 타입을 직접 사용하는 모든 코드(validation pipe, switch/if-else 체인, 테스트 픽스처 등)는 새 값이 합법적으로 통과되는 부작용을 받는다. `@IsIn(INTEGRATION_STATUSES)` 데코레이터가 붙은 DTO 필드는 이제 `'attention'`을 허용하게 되어, 이전에 400 오류를 냈던 요청이 서비스 레이어까지 도달한다.
  - 제안: 이 변경은 의도된 것이며 서비스 레이어에도 동일 분기가 추가되었으므로 문제없다. 다만 `IntegrationStatusFilter`를 `switch` 완전 분기(exhaustive check)로 사용하는 코드가 있다면 컴파일 경고를 확인해야 한다.

- **[INFO]** Swagger `description` 및 `example` 변경 — 공개 API 문서 변경
  - 위치: `ListIntegrationsQueryDto.status` 필드 `@ApiPropertyOptional`
  - 상세: `example: 'connected'`에서 `example: 'attention'`으로 변경되었다. Swagger UI 또는 코드 생성 도구(openapi-generator 등)가 이 예시를 참고해 클라이언트 코드를 생성하는 환경에서는 기본 예시값이 바뀌는 부작용이 있다. 기능적 파괴는 없으나 자동 생성 문서가 달라진다.
  - 제안: 허용 가능한 변경이다. 코드 생성 도구를 사용 중이라면 재생성 후 영향을 검토한다.

---

### 파일 3: `backend/src/modules/integrations/integrations.service.ts`

- **[WARNING]** `attention` 분기의 SQL 인라인 리터럴 — 타임존/DB 함수 부작용 위험
  - 위치: `integrations.service.ts` 신규 `else if (status === 'attention')` 분기
  - 상세: `NOW()`와 `INTERVAL '7 days'`는 DB 서버 타임존에 의존한다. 앱 서버와 DB 서버의 타임존이 다른 배포 환경에서 `expiring` 경계(7일 이내)가 의도와 다르게 계산될 수 있다. 또한 `token_expires_at > NOW()` 조건은 이미 만료된 `connected` 행(토큰이 지났지만 상태가 아직 `connected`로 남아 있는 경우)을 제외하는데, 이는 의도된 설계이지만 `expired` 상태가 아닌 행이 attention에서 누락될 수 있는 엣지 케이스다.
  - 제안: DB 타임존이 UTC로 고정되어 있고 앱도 UTC를 사용한다면 현재 구현은 안전하다. 그렇지 않다면 `NOW() AT TIME ZONE 'UTC'`를 명시하거나 앱 레이어에서 절대 타임스탬프로 변환해 바인딩 파라미터로 전달하는 방식을 고려한다.

- **[INFO]** 기존 `expiring` 분기는 변경 없음 — 호환성 유지 확인
  - 위치: `status === 'expiring'` 분기 (변경 전 코드)
  - 상세: 이번 diff에는 `expiring` 분기 변경이 없다. 기존 `?status=expiring` URL은 동일하게 동작한다. 부작용 없음.

---

### 파일 6: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`

- **[INFO]** `computeAttentionBreakdown` 신규 함수 및 `AttentionBreakdown` 인터페이스 추가 — 공개 API 확장
  - 위치: `status-badge.tsx` 내 신규 export
  - 상세: 신규 함수와 인터페이스가 모듈 공개 API에 추가된다. 기존 export(`computeStatus`, `isReauthorizeDisabled`, `needsAttention`, `StatusBadge`)는 변경되지 않으므로 기존 호출자에게 파괴적 변경은 없다. 순수 추가이므로 의도치 않은 상태 변경이나 전역 변수 도입은 없다.
  - 제안: 이상 없음.

- **[INFO]** `computeAttentionBreakdown`의 `mostUrgentId` 결정 로직 — 상태 독립성 확인
  - 위치: `computeAttentionBreakdown` 함수 본문, `mostUrgent` 변수
  - 상세: 함수가 내부 지역 변수만 사용하며 모듈 수준 상태나 전역 변수를 변경하지 않는다. 순수 함수로 구현되어 있어 부작용 없음. `Date.now()`를 직접 호출하지 않고 `needsAttention()`에 위임하는 구조이므로 일관성 유지 측면도 적절하다.

---

### 파일 7: `frontend/src/app/(main)/integrations/page.tsx`

- **[WARNING]** `needsAttention` import 제거 — 기존 직접 참조자 영향 확인 필요
  - 위치: import 변경 (`needsAttention` 제거, `computeAttentionBreakdown`, `AttentionBreakdown` 추가)
  - 상세: `page.tsx`에서 `needsAttention`의 직접 사용이 제거되고 `computeAttentionBreakdown`으로 대체되었다. `needsAttention`은 여전히 `status-badge.tsx`에서 export되므로 다른 모듈이 참조 중이면 영향 없다. 그러나 `page.tsx` 내에서 `needsAttention`을 의존하던 로직(이전 `attentionCount` 계산)이 제거되면서 `attention.total`로 대체된다. `computeAttentionBreakdown`이 내부적으로 `needsAttention`을 재사용하므로 로직 단일 진실(SoT) 원칙은 유지되나, 두 함수의 결과가 항상 일치함을 보장하는 테스트가 `status-badge.test.tsx`에 있는지 확인이 필요하다(테스트 파일 5에 존재함 — 문제없음).

- **[WARNING]** `router.push('/integrations/${attention.mostUrgentId}')` — 단일 행 jump 시 URL 상태와 필터 상태의 비동기 부작용
  - 위치: `page.tsx` `onActivate` 콜백, `router.push` 호출
  - 상세: `attention.total === 1`일 때 `router.push`로 detail 페이지로 직접 이동한다. 이때 현재 URL의 `?status=...` 파라미터는 변경되지 않은 채 남는다. 사용자가 detail 페이지에서 뒤로 가기를 하면 이전 URL(필터가 없거나 다른 필터가 있는 상태)로 돌아온다. 이 동작 자체는 의도된 것이나(`router.push`가 history에 남으므로 뒤로 가기 기능), attention 단일 행이 다수 행으로 바뀐 순간 배너가 `push` 대신 `updateParam("status", "attention")`을 사용해야 하는 분기가 올바르게 처리되는지 주의해야 한다. 렌더링 주기 내에서 `attention` memo 값이 오래된 클로저를 참조하는 상황은 없으나, 빠른 연속 클릭 시 `push`와 `replace`가 섞일 가능성은 존재한다.
  - 제안: 단일/다수 분기를 컴포넌트 렌더 시점에 스냅샷하므로 실용적 위험은 낮다. 다만 `attention.mostUrgentId`가 null인 경우(`total === 1`이지만 `mostUrgentId === null`인 경우는 `computeAttentionBreakdown` 구현상 발생하지 않음)를 guard할 필요는 없다 — 현 구현에서는 `total === 1`이면 반드시 `mostUrgentId`가 non-null이므로 안전하다.

- **[INFO]** `STATUS_FILTERS` 배열에 `'attention'` 항목 추가 — UI 상태 변경
  - 위치: `STATUS_FILTERS` 상수
  - 상세: 모듈 수준 상수(런타임 불변)에 새 항목이 추가된다. React 렌더링 함수 외부에 선언되어 있어 리렌더를 유발하지 않는다. 부작용 없음.

---

### 파일 8: `frontend/src/lib/api/integrations.ts`

- **[INFO]** `ListStatusFilter` 타입에 `'attention'` 추가 — 클라이언트 공개 API 타입 변경
  - 위치: `ListStatusFilter` 유니온 타입
  - 상세: TypeScript 컴파일 타임 타입 확장이다. 이 타입을 사용하는 호출자는 `'attention'` 값을 이제 합법적으로 전달할 수 있다. 기존 exhaustive check(`switch` 등)가 있다면 컴파일 경고가 발생할 수 있다. 기존 `'expiring'`처럼 이미 가상 필터값이 존재하는 패턴이므로 일관성 있는 변경이다.
  - 제안: 이 타입을 소비하는 다른 모듈에서 exhaustive 체크를 수행 중이라면 갱신이 필요하다.

---

### 파일 9/10: `frontend/src/lib/i18n/dict/en/integrations.ts`, `ko/integrations.ts`

- **[WARNING]** `attentionSingle` 키 삭제 — i18n 키 파괴적 제거
  - 위치: 두 파일 모두에서 `attentionSingle` 키 삭제
  - 상세: `attentionSingle`이 코드베이스의 다른 위치(이번 diff에 포함되지 않은 파일)에서 여전히 참조되고 있다면 런타임 i18n 키 미스(missing key fallback) 또는 TypeScript 컴파일 오류가 발생한다. 이번 diff에서 `page.tsx`의 구 배너 코드가 교체되었으므로 `page.tsx` 내 참조는 사라졌다. 그러나 TypeScript i18n dict 타입 시스템이 키 존재를 강제하는 경우 컴파일 시 감지되므로, 빌드 통과 여부가 최종 안전망이다.
  - 제안: `attentionPrefix`, `attentionSuffix`, `attentionSingle` 세 키가 이번 diff에서 제거되며, 대응하는 사용처도 `page.tsx`에서 함께 제거되었다. 전체 코드베이스에서 이 세 키의 다른 참조가 없는지 빌드 및 grep으로 확인한다.

- **[INFO]** `attentionBreakdownExpired/Expiring/Error`는 별도 키 — i18n 구조 변경
  - 위치: 두 파일의 신규 키 추가
  - 상세: 기존 단일 `attentionBreakdown` 포맷 스트링 대신 세 개의 개별 키(`attentionBreakdownExpired`, `attentionBreakdownExpiring`, `attentionBreakdownError`)로 분리되었다. plan 노트(파일 11)에는 `attentionBreakdown` 단일 키가 언급되지만 실제 구현은 3개로 분리했다. 이는 plan과 구현의 미세한 불일치지만 기능적 문제는 없으며 렌더링 결과는 동일하다.

---

### 파일 11: `plan/in-progress/integration-attention-filter.md`

- **[INFO]** plan 파일 신규 생성 — 파일시스템 부작용 (의도된 것)
  - 위치: `plan/in-progress/integration-attention-filter.md`
  - 상세: 작업 추적 목적으로 plan 파일이 생성된다. 프로젝트 컨벤션에 따른 의도된 파일시스템 변경이다. 체크리스트 항목 중 일부(`[ ]` 미완)가 남아 있으므로 `in-progress/`에 위치하는 것이 올바르다.
  - 제안: 이상 없음. 작업 완료 후 `git mv`로 `complete/`로 이동할 것.

---

## 요약

이번 변경은 `INTEGRATION_STATUSES`와 `ListStatusFilter`에 `'attention'` 가상 필터값을 추가하고, 백엔드 서비스에 해당 분기를 삽입하며, 프론트엔드 배너를 `AttentionBanner` 컴포넌트로 교체하고 i18n 키를 재구성하는 것이다. 부작용 관점에서 주목할 지점은 두 가지다: (1) 백엔드의 인라인 SQL `NOW()` 및 `INTERVAL '7 days'`가 DB 타임존에 의존하므로 배포 환경 타임존 설정 확인이 필요하고, (2) `attentionSingle` 등 제거된 i18n 키가 diff에 포함되지 않은 다른 파일에서 참조되지 않는지 빌드 검증이 필수적이다. 그 외 전역 변수 도입, 예상치 못한 네트워크 호출, 의도치 않은 이벤트 발생, 파일시스템 부작용은 발견되지 않았다. `computeAttentionBreakdown`은 순수 함수로 모듈 공유 상태를 변경하지 않는다. 기존 함수 시그니처는 모두 유지되며, 신규 export만 추가되는 방식이라 기존 호출자에 대한 파괴적 영향은 없다.

## 위험도

LOW
