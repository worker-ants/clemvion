## 발견사항

### **[INFO]** BullMQ 큐 의존성 추가 (IntegrationsModule)
- **위치**: `backend/src/modules/integrations/integrations.module.ts`
- **상세**: `BullModule.registerQueue({ name: INTEGRATION_EXPIRY_QUEUE })` 추가. `@nestjs/bullmq`는 이미 schedules 모듈에서 사용 중이므로 신규 패키지가 아님.
- **제안**: 이상 없음. 기존 패턴과 일관됨.

---

### **[WARNING]** WorkspacesModule 전체 임포트 — 과도한 모듈 의존
- **위치**: `backend/src/modules/integrations/integrations.module.ts`
- **상세**: `WorkspacesModule`을 임포트하고 `getMemberRole`만 사용함. 모듈 전체를 가져오면 WorkspacesModule이 export하는 모든 프로바이더에 간접 의존하게 되어, 향후 WorkspacesModule 변경이 IntegrationsModule에 영향을 줄 수 있음.
- **제안**: 현재 아키텍처에서는 수용 가능하나, `getMemberRole`을 직접 Repository 쿼리로 대체하거나 Workspaces 인터페이스를 좁혀 Export하는 방향 고려.

---

### **[WARNING]** Node 엔티티 직접 임포트 — 모듈 경계 위반
- **위치**: `backend/src/modules/integrations/integrations.module.ts` — `Node` 엔티티 직접 참조
- **상세**: `Node`는 `nodes` 모듈 소유 엔티티인데, `IntegrationsModule`이 TypeORM 피처로 직접 등록함. 이는 `NodesModule` 없이 Node 레포지토리를 직접 가져오는 것으로, 엔티티 소유권이 모호해지고 양쪽 모듈이 같은 테이블을 관리할 수 있는 위험이 생김.
- **제안**: `NodesModule`이 Node 관련 쿼리를 캡슐화한 서비스를 export하도록 하거나, native query/view를 통해 접근하는 방식 검토. 최소한 주석으로 의도를 명시할 것.

---

### **[WARNING]** Notification 엔티티 직접 임포트 — 모듈 경계 위반
- **위치**: `backend/src/modules/integrations/integrations.module.ts` — `Notification` 엔티티 직접 참조
- **상세**: 위 Node와 동일한 문제. `NotificationsModule` 없이 Notification 레포지토리를 직접 등록함. 알림 생성 로직이 IntegrationsModule 내에 분산되어 알림 정책 변경 시 여러 모듈을 수정해야 함.
- **제안**: `NotificationsModule`에서 `NotificationsService`를 export하고 IntegrationsModule이 이를 사용하도록 리팩터링 권장 (WARNING 수준).

---

### **[WARNING]** WorkspaceMember 엔티티 직접 임포트
- **위치**: `backend/src/modules/integrations/integrations.module.ts`
- **상세**: 위 두 항목과 동일 패턴. WorkspacesModule이 이미 import되어 있음에도 엔티티를 추가로 직접 등록. WorkspacesModule이 이미 WorkspaceMember 레포지토리를 등록한다면 중복 등록 가능성 있음.
- **제안**: WorkspacesModule의 export 목록을 확인하고, 이미 export된다면 직접 등록 제거.

---

### **[INFO]** `listOf: 'expiring'` 상태 필터 — 프론트/백 불일치 가능성
- **위치**: `frontend/src/lib/api/integrations.ts` — `ListStatusFilter`, `backend/.../dto/integration.dto.ts` — `INTEGRATION_STATUSES`
- **상세**: 프론트엔드와 DTO 모두 `'expiring'`을 필터 값으로 정의하나, `Integration.status` 컬럼은 `'connected' | 'expired' | 'error'`만 가짐. `expiring`은 DB 컬럼 값이 아닌 파생 상태이므로 서비스 레이어에서 별도 처리가 필요함. 누락되면 필터가 항상 빈 결과를 반환함.
- **제안**: `integrations.service.ts`의 `findAll`에서 `status=expiring`을 `tokenExpiresAt <= now+7d AND status='connected'` 조건으로 변환하는지 확인 필요.

---

### **[INFO]** `purgeExpired` 화재 후 망각(fire-and-forget) 패턴
- **위치**: `integration-oauth.service.ts:purgeExpired`
- **상세**: `begin()` 호출 시 `await this.purgeExpired()`가 내부적으로 오류를 삼키고 로그만 남김. 이는 의도된 방어적 설계이나, 외부 라이브러리 없이 순수 TypeORM으로 구현되어 의존성 추가 없음.
- **제안**: 이상 없음. 현재 방식 적절.

---

### **[INFO]** OAuth 토큰 교환 미구현 (stub)
- **위치**: `integration-oauth.service.ts` — `syntheticCredentials`
- **상세**: 실제 OAuth provider token endpoint 호출 없이 stub 자격증명을 생성. 추후 실제 HTTP 호출 시 `axios` 또는 `fetch` 의존성이 추가될 수 있음. 현재는 외부 의존성 없음.
- **제안**: 실제 구현 시 `node-fetch`, `axios`(이미 사용 중인지 확인) 또는 Node.js 내장 `fetch`(v18+) 사용 여부 사전 결정 권장.

---

### **[INFO]** 프론트엔드 `@tanstack/react-query` 사용 패턴 변경
- **위치**: `frontend/src/app/(main)/integrations/page.tsx`
- **상세**: `useQueryClient` + `useMutation` 조합에서 URL 파라미터 기반 필터링으로 전환. 기존 `useMutation`으로 처리하던 CRUD를 제거하고 상세 페이지로 위임. 신규 외부 의존성 없음.
- **제안**: 이상 없음.

---

### **[INFO]** `renderCallbackHtml` — 인라인 HTML 생성 유틸리티
- **위치**: `integrations.controller.ts:229~277`
- **상세**: XSS 방지를 위해 `JSON.stringify(...).replace(/</g, '\\u003c')`를 사용. 외부 템플릿 엔진 의존성 없이 안전하게 구현됨.
- **제안**: 이상 없음. 단, `window.location.origin`을 `targetOrigin`으로 사용하는 `postMessage` 패턴은 보안상 올바름.

---

## 요약

이번 변경에서 추가된 외부 패키지는 없으며, `@nestjs/bullmq`·`typeorm`·`@tanstack/react-query` 등 기존 의존성만 활용됩니다. 주요 위험은 외부 패키지가 아닌 **내부 모듈 경계** 문제입니다. `IntegrationsModule`이 `Node`, `Notification`, `WorkspaceMember` 엔티티를 소유 모듈을 우회하여 직접 등록함으로써 모듈 소유권이 분산되고, 추후 해당 엔티티 변경 시 IntegrationsModule에도 수정이 전파될 위험이 있습니다. `expiring` 상태 필터의 프론트-백 계층 처리도 구현 완결성을 확인해야 합니다.

## 위험도

**MEDIUM**