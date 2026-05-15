## 발견사항

### [CRITICAL] 프론트엔드-백엔드 필드명 불일치
- **위치**: `frontend/src/components/triggers/trigger-detail-drawer.tsx` (`TriggerHistoryEntry.triggeredAt`) vs `backend/src/modules/triggers/triggers.service.ts` (`getHistory` 응답의 `startedAt`)
- **상세**: 백엔드 `getHistory`는 `{ id, status, startedAt, durationMs }`를 반환하지만, 프론트엔드 인터페이스는 `triggeredAt`으로 정의. `entry.triggeredAt`은 항상 `undefined`가 됨
- **제안**: `TriggerHistoryEntry.triggeredAt` → `startedAt`으로 수정하거나, 백엔드 응답 필드를 `triggeredAt`으로 변경

---

### [WARNING] 백엔드 지원 없는 프론트엔드 `scope` 필터 추가
- **위치**: `frontend/src/app/(main)/integrations/page.tsx` (`scopeFilter` state, `SCOPE_OPTIONS`, `filteredIntegrations`)
- **상세**: `Integration` 인터페이스에 `scope?: "personal" | "organization"` 필드가 추가되고 필터 UI도 구현되었으나, `integrations.service.ts`에는 대응되는 변경 없음. 백엔드 API가 scope를 반환하지 않으므로 필터가 항상 `"all"` 로 동작
- **제안**: 백엔드 지원이 준비될 때까지 scope 필터 UI 제거하거나, 백엔드에도 scope 필드 추가

---

### [WARNING] `layout.tsx` `"use client"` 추가로 SSR 비용 발생
- **위치**: `frontend/src/app/(main)/layout.tsx` L1
- **상세**: 루트 레이아웃을 클라이언트 컴포넌트로 변경하면 하위 트리 전체가 클라이언트 번들에 포함될 위험이 있음. 변경 이유가 반응형 CSS 적용이라면 `"use client"` 없이 Tailwind 클래스만으로 해결 가능
- **제안**: CSS 변경(`pl-0 min-[1280px]:pl-16`) 은 유지하되, `"use client"` 제거 검토. Sidebar가 이미 `"use client"`이므로 레이아웃에는 불필요할 수 있음

---

### [WARNING] `reauthorize` 서비스에 OAuth 설정 하드코딩
- **위치**: `backend/src/modules/integrations/integrations.service.ts` (`oauthConfigs` 객체)
- **상세**: Slack, Google, GitHub의 OAuth URL과 scope를 서비스 코드 내에 직접 정의. 변경 시 코드 수정 필요하고, 서비스 타입이 추가될 때마다 코드 변경이 필요한 구조
- **제안**: 별도 설정 파일(`oauth-config.ts`) 또는 환경 설정으로 분리 검토 (현재 범위 내 Quick Fix: 최소한 상수로 분리)

---

### [WARNING] `triggers/page.tsx` `active` 쿼리 파라미터 지원 여부 불명확
- **위치**: `frontend/src/app/(main)/triggers/page.tsx` (`statusFilter` → `params.active`)
- **상세**: 프론트엔드에서 `active=true/false` 파라미터를 전송하지만, `triggers.controller.ts` diff에는 해당 쿼리 파라미터 처리가 보이지 않음. 기존 API가 이를 처리하는지 확인 필요
- **제안**: `TriggersController.findAll()`의 쿼리 파라미터 수신 코드 확인 및 없으면 추가

---

### [INFO] `cron-parser` v5 API 사용 방식 확인 필요
- **위치**: `backend/src/modules/schedules/schedules.service.ts:L140` (`interval.next().toISOString()`)
- **상세**: `cron-parser` v5에서 `next()`의 반환 타입이 v4(`moment`-like) 대비 변경됨. `toISOString()`이 없을 경우 런타임 에러 발생. `?? new Date().toISOString()` 폴백이 있으나 silent failure 가능
- **제안**: v5 반환 타입 확인 후 적절한 변환 코드 추가 (예: `next().toDate().toISOString()`)

---

### [INFO] `statistics.service.ts` PostgreSQL 전용 문법
- **위치**: `backend/src/modules/statistics/statistics.service.ts` (`getNodeStats` - `::int`, `::float`, `::numeric`, `FILTER (WHERE ...)`)
- **상세**: PostgreSQL 전용 type cast와 aggregate filter 문법 사용. 다른 DB 사용 시 동작하지 않음. 프로젝트가 PostgreSQL을 표준으로 사용한다면 INFO 수준
- **제안**: 프로젝트 DB 표준 확인 후, 문서화 또는 추상화 여부 결정

---

### [INFO] `TriggerHistoryEntry.triggeredAt` 불일치로 인한 부수 영향
- **위치**: `frontend/src/components/triggers/trigger-detail-drawer.tsx` L40, L167
- **상세**: `history.length === 0` 체크를 통과하더라도 `entry.triggeredAt`이 `undefined`이므로 `new Date(undefined)` → `Invalid Date`가 표시됨
- **제안**: CRITICAL 항목 수정 시 함께 처리

---

## 요약

전반적으로 이번 변경은 Dashboard 통계 개선, 인증 설정 사용량 조회, 트리거 히스토리, 스케줄 미리보기, 통계 노드 분석/내보내기, 워크플로 가져오기/내보내기 등 여러 기능을 일괄 추가하는 대규모 Feature Set으로, 변경들 간의 내적 일관성은 있습니다. 그러나 **프론트엔드-백엔드 간 `triggeredAt`/`startedAt` 필드명 불일치**는 런타임 버그를 유발하며, **백엔드 미구현 상태의 `scope` 필터 UI** 추가는 의도된 범위를 초과한 미완성 기능입니다. `layout.tsx`에 `"use client"` 추가는 반응형 레이아웃 적용이 목적이나 SSR 이점 손실 위험을 검토해야 합니다.

## 위험도

**MEDIUM** (CRITICAL 1건 - 런타임 데이터 불일치, WARNING 3건 - 미구현 기능 및 구조적 우려)