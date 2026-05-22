# 보안(Security) 리뷰 결과

## 발견사항

### 1. 민감 정보 응답 노출 (응답 마스킹 미구현)

- **[WARNING]** `hmacSecret` / `bearerToken` 응답 마스킹 미적용
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 반환값 / TriggerDto 전체
  - 상세: `WebhookConfigCard` 에서 사용자가 새 hmacSecret / bearerToken 을 저장하면 백엔드 PATCH 응답에 `config` JSONB 전체가 포함되어 hmacSecret·bearerToken 평문이 클라이언트에 반환된다. 커밋 메시지 자체도 "hmacSecret / bearerToken 응답 마스킹 (`…last4`) — 후속 plan 으로 분리"라고 명시하여 현재 미해결 상태임을 인정하고 있다.
  - 제안: 별도 plan 이 분리된 사실을 인지하되, 현 PR 범위 내에서 TriggerDto 에 `@Exclude()` 또는 getter 재정의로 응답 시 hmacSecret·bearerToken 을 `null` 또는 `***last4` 로 변환해야 한다. 이 항목은 완료되기 전 프로덕션 배포 차단 요건으로 다루어야 한다.

---

### 2. 프론트엔드 RBAC 가드 — 클라이언트 전용 보호

- **[WARNING]** `useHasRole("editor")` 는 렌더 조건 차단에 불과, API 호출 자체를 막지 않음
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `OverviewCard`, `WebhookConfigCard`
  - 상세: 프론트엔드 RBAC(`useHasRole`)는 UI 버튼 표시 여부만 제어한다. 공격자가 네트워크 탭에서 직접 `PATCH /api/triggers/:id` 를 호출하면 서버 측 권한 검사가 없는 한 수정이 허용된다. 이번 변경 코드 범위에서 `TriggersService.update` 또는 컨트롤러 레이어의 역할 가드(`@Roles(...)` 등) 존재 여부를 확인할 수 없다.
  - 제안: `triggers.controller.ts` (변경 범위 외)에 NestJS `@UseGuards(RolesGuard)` + `@Roles('editor')` 데코레이터가 적용되어 있는지 확인하고, 없다면 추가하여 서버 측 RBAC 를 보장해야 한다.

---

### 3. 에러 메시지에 내부 상세 정보 노출

- **[WARNING]** `ExternalInteractionCard.handleSave` 오류 메시지에 서버 에러 상세 포함
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `handleSave()` (line ~2594)
  - 상세: `toast.error(\`${t("...")}: ${err instanceof Error ? err.message : String(err)}\`)` 패턴이 서버에서 반환된 에러 메시지를 그대로 UI toast 에 노출한다. 서버 에러가 내부 스택 정보·쿼리 구조·파일 경로 등을 포함할 경우 사용자에게 노출된다. 동일 패턴이 `handleRotateSecret`, `handleRevokeToken` 에도 적용된다.
  - 제안: 에러 메시지는 서버 응답의 `response.data.message` (이미 정제된 도메인 에러)만 추출하거나, 범용 "저장에 실패했어요" 문구만 표시한다. 새로 추가된 `OverviewCard.updateMutation.onError` 및 `WebhookConfigCard.updateMutation.onError` 는 에러 메시지를 노출하지 않는 올바른 패턴을 사용하고 있어 `ExternalInteractionCard` 와 일관성이 없다.

---

### 4. 엔드포인트 경로 입력 검증 — 경로 탐색 / 인젝션 가능성

- **[WARNING]** `endpointPath` 프론트엔드 입력에 서버 측 형식 검증 부재
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` / `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `WebhookConfigCard` 폼
  - 상세: 프론트엔드는 `maxLength={255}` 외에 형식 제약이 없다. 서버 코드(변경 범위 내)에서 `endpointPath` 에 대한 패턴 검증(`/^[a-zA-Z0-9_\-\/]+$/` 등)이 확인되지 않는다. `../` 시퀀스나 특수 문자가 포함된 경로가 저장·반환되면 `getWebhookUrl` 에서 `${base}/api/hooks/${endpointPath}` 로 URL 을 직접 조합하는 프론트엔드 경로와 함께 활용될 수 있다. 실제 URL 라우팅은 백엔드 라우터가 처리하지만, DB에 저장된 비정상 경로가 다른 컨텍스트(로그, 알림 등)에서 인젝션 표면이 될 수 있다.
  - 제안: `UpdateTriggerDto.endpointPath` 에 `@Matches(/^[a-zA-Z0-9_\-\/]+$/)` 또는 동등한 class-validator 데코레이터를 추가하여 허용 문자를 제한한다.

---

### 5. Notification URL SSRF 보호 — 등록 시점 IP 검증 한계

- **[INFO]** `assertNotificationUrlSafe` 는 리터럴 IP 만 검사; DNS rebinding 에 취약
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `assertNotificationUrlSafe()` (line ~938)
  - 상세: 등록 시점에 호스트명이 공인 IP 로 resolve 되더라도 이후 DNS rebinding 으로 사설 IP 로 전환될 수 있다. 코드 주석에서 "발송 시점의 post-resolve 검증은 NotificationDispatcher 가 추가로 수행"이라고 명시하고 있어 설계적으로 인지된 사항이나, NotificationDispatcher 의 검증 구현이 누락되면 SSRF 가 발생할 수 있다.
  - 제안: NotificationDispatcher 에서 실제 TCP 연결 전 resolved IP 를 재검증하는 로직이 구현되어 있는지 별도 확인이 필요하다. 현재 커밋 범위 내에서는 이미 양쪽 검증을 의도하고 있어 구조는 적절하다.

---

### 6. `window.location.reload()` 보안 비관련 — 이미 수정됨 (참고)

- **[INFO]** `ExternalInteractionCard.handleSave` 에서 여전히 `window.location.reload()` 사용
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `handleSave()` (line ~2591)
  - 상세: 이번 PR 에서 `OverviewCard`·`WebhookConfigCard` 는 `queryClient.invalidateQueries` 패턴으로 올바르게 구현되었으나, `ExternalInteractionCard.handleSave` 는 이전 코드(`window.location.reload()`)를 그대로 유지한다. 보안 문제는 아니지만 성능 및 사용자 경험 측면에서 일관성이 없다.
  - 제안: 해당 함수도 `useMutation` + `onSaved` 패턴으로 리팩터링 권고 (보안 필수 아님).

---

### 7. Secret 평문 클라이언트 상태 보관

- **[INFO]** `rotateResult` / `revokeResult` 상태에 plain-text secret 보관
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `ExternalInteractionCard` 상태
  - 상세: 서버에서 발급된 신규 secret(`wsk_*`)·token(`itk_*`) 이 React state 에 보관되어 컴포넌트가 마운트된 동안 메모리에 상주한다. "1회만 표시" 정책은 UI 수준에서만 적용되며, React DevTools 등을 통해 state 를 조회할 수 있다. 브라우저 메모리에 민감 값이 상주하는 것은 일반적인 프론트엔드 패턴이나 최소화 노력이 필요하다.
  - 제안: 사용자가 복사 버튼을 누르거나 dismiss 하는 즉시 state 를 `null` 로 초기화하는 로직(현재 dismiss 버튼에만 구현됨)은 적절하다. 추가로 `useEffect` 타임아웃(예: 5분)으로 자동 만료를 고려한다.

---

### 8. 하드코딩된 시크릿 — 없음

- **[INFO]** 하드코딩된 API 키·비밀번호·토큰 없음
  - 위치: 전체 변경 범위
  - 상세: `randomBytes(32)` 기반의 `wsk_*` / `itk_*` 시크릿 생성은 암호학적으로 안전한 CSPRNG 를 사용한다. 테스트 파일의 `'wsk_old'` 는 mock 데이터로 프로덕션에 사용되지 않는다.

---

## 요약

이번 변경에서 가장 주목할 보안 이슈는 **`hmacSecret`·`bearerToken` 응답 마스킹 미구현(WARNING)**으로, 백엔드 PATCH 응답이 `config` JSONB 전체를 반환하여 민감 자격증명이 클라이언트에 노출될 수 있다. 이 항목은 커밋 메시지에도 "별 plan 으로 분리"로 명시되어 있으나, 프로덕션 배포 전 반드시 해결해야 하는 차단 사항이다. 프론트엔드 RBAC 가드가 서버 측 권한 검증으로 보완되어 있는지 컨트롤러 레이어 확인이 필요하며, `ExternalInteractionCard` 의 에러 메시지 노출 패턴은 새로 추가된 카드들의 올바른 패턴과 일관성이 없다. `endpointPath` 의 서버 측 형식 검증 추가를 권고한다. `randomBytes` 기반 시크릿 생성, SSRF 이중 검증 설계, write-only 입력 필드 처리(`blank = keep`) 등은 보안 관점에서 적절하게 구현되어 있다.

## 위험도

**MEDIUM**
