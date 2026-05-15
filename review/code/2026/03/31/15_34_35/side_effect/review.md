## 발견사항

### **[WARNING]** `reauthorize` 엔드포인트 - OAuth state 토큰 미저장
- **위치**: `integrations.service.ts` - `reauthorize()` 메서드
- **상세**: CSRF 방지용 `state` 토큰을 생성하지만 Redis나 DB에 저장하지 않음. 콜백 시 검증 불가로 CSRF 공격에 취약.
- **제안**: 생성한 state를 Redis에 TTL과 함께 저장하고 OAuth 콜백에서 검증.

### **[WARNING]** `reauthorize` - 비-OAuth 통합에 대해 즉시 상태를 `connected`로 변경
- **위치**: `integrations.service.ts` L56-60
- **상세**: 비-OAuth 통합의 경우 실제 검증 없이 `status = 'connected'`로 변경. `expired`/`error` 상태의 통합이 아무 인증 없이 복구됨.
- **제안**: 비-OAuth 통합의 재인증 로직 명확화 또는 별도 처리.

### **[WARNING]** `layout.tsx` - `"use client"` 추가로 서버 컴포넌트 경계 변경
- **위치**: `frontend/src/app/(main)/layout.tsx`
- **상세**: 레이아웃 파일에 `"use client"` 추가 시 해당 레이아웃 아래의 모든 서버 컴포넌트가 클라이언트 번들에 포함됨. Next.js의 서버/클라이언트 분리 원칙 위반으로 번들 크기 증가.
- **제안**: 반응형 사이드바 상태가 필요하다면 별도 클라이언트 래퍼 컴포넌트로 분리.

### **[WARNING]** `SlideDrawer` - `document.body.style.overflow` 전역 DOM 상태 변경
- **위치**: `slide-drawer.tsx` L21-29
- **상세**: 여러 `SlideDrawer` 인스턴스가 동시에 열리거나 순차적으로 닫힐 경우, 먼저 닫힌 drawer가 `overflow: ""`로 복원하여 아직 열린 drawer의 스크롤 잠금 해제.
- **제안**: 열린 drawer 수를 카운팅하거나 `aria-hidden` 패턴 또는 Portal + inert 속성 사용.

### **[WARNING]** `statistics.controller.ts` - `@Res()` 사용으로 NestJS 인터셉터 비활성화
- **위치**: `statistics.controller.ts` - `exportData()` 메서드
- **상세**: `@Res()` 데코레이터 사용 시 NestJS의 response 인터셉터(로깅, 변환, 예외 필터 일부)가 자동으로 비활성화됨.
- **제안**: `@Res({ passthrough: true })`를 사용하여 인터셉터 동작 유지.

### **[WARNING]** `cron-parser` v5 - BullMQ 내장 버전과 충돌 가능
- **위치**: `backend/package-lock.json`
- **상세**: BullMQ가 내부적으로 `cron-parser@4.9.0`을 사용하는데, 프로젝트는 `^5.5.0`을 직접 의존. 두 버전이 공존(`node_modules/bullmq/node_modules/cron-parser`)하며 API가 다름(`CronExpression` vs `CronExpressionParser`). `schedules.service.ts`에서 v5 API(`CronExpressionParser.parse`) 사용은 올바르나, 향후 혼용 위험.
- **제안**: 버전 정책 주석 추가 또는 BullMQ 업그레이드 검토.

### **[INFO]** `workflows.service.ts` - `exportWorkflow` TODO 제거 및 노드/엣지 노출
- **위치**: `workflows.service.ts` L158-195
- **상세**: 기존 `// TODO: Include nodes and edges` 주석 제거 후 실제 구현. `containerId`, `toolOwnerId` 등 내부 참조가 export 결과에 포함됨. Import 시 인덱스 기반 매핑으로 변환하므로 `toolOwnerId`(UUID)는 import 시 재연결 불가.
- **제안**: `toolOwnerId` export 필요성 검토 및 import DTO에서의 처리 명확화.

### **[INFO]** `auth-configs.service.ts` - `getUsage`에서 `trigger_id` 컬럼명 직접 사용
- **위치**: `auth-configs.service.ts` L131, L140
- **상세**: `e.trigger_id`를 QueryBuilder에서 직접 사용. TypeORM 엔티티 컬럼 명명이 변경될 경우 런타임 오류 발생.
- **제안**: `e.triggerId`(TypeORM camelCase 자동 변환) 또는 관계(`e.trigger.id`) 사용 검토.

### **[INFO]** `workflows/page.tsx` - `handleExport` 내 DOM 직접 조작
- **위치**: `workflows/page.tsx` - `handleExport()` 함수
- **상세**: `document.createElement('a')`, `document.body.appendChild/removeChild` 직접 사용. SSR 환경에서 `document`가 없으면 오류. 현재 `"use client"` 컴포넌트이므로 문제없으나 유지보수 주의.
- **제안**: 코드 자체는 동작하나, 유틸 함수로 분리 권장.

### **[INFO]** `dashboard.service.ts` - `fourteenDaysAgo`와 `sevenDaysAgo` 시간차 미세 불일치
- **위치**: `dashboard.service.ts` L56-58
- **상세**: 두 Date 객체가 서로 다른 순간에 생성되어 실행 시간에 따라 7일 경계가 미세하게 불일치할 수 있음 (수 밀리초 차이).
- **제안**: `sevenDaysAgo`를 먼저 생성한 뒤 `fourteenDaysAgo = new Date(sevenDaysAgo); fourteenDaysAgo.setDate(...-7)` 방식으로 파생.

---

## 요약

전반적으로 기능 확장을 위한 변경사항들이며 구조적으로는 안정적이다. 주요 부작용 위험은 두 가지로 집약된다: (1) OAuth `state` 토큰을 서버에 저장하지 않아 CSRF 방어가 불완전하고, (2) `layout.tsx`에 `"use client"` 추가로 Next.js 서버/클라이언트 렌더링 경계가 의도치 않게 확장되어 번들 크기에 영향을 미친다. `SlideDrawer`의 `document.body.style.overflow` 전역 DOM 조작도 다중 인스턴스 상황에서 상태 간섭을 일으킬 수 있다. 나머지 변경들은 명확한 의도 내에서 이루어졌으며 인터페이스 확장(신규 엔드포인트 추가)은 기존 API와 하위 호환성을 유지한다.

## 위험도

**MEDIUM**