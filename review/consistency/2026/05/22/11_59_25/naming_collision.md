# 신규 식별자 충돌 검토 — spec-draft-triggers-edit-delete

검토 대상: `plan/in-progress/spec-draft-triggers-edit-delete.md`
검토일: 2026-05-22

---

## 발견사항

### 1. [CRITICAL] `POST /api/triggers/:id/auth/rotate-secret` 경로가 기존 RPC 패턴과 충돌

- **target 신규 식별자**: `POST /api/triggers/:id/auth/rotate-secret` (Change 4, plan B §1 Rationale R-2)
- **기존 사용처**:
  - `spec/5-system/2-api-convention.md §2.2` — 허용된 RPC-style 예시: `/api/triggers/:id/notification/rotate-secret`, `/api/triggers/:id/interaction/revoke-token`, `/api/triggers/:id/chat-channel/rotate-bot-token`
  - `spec/5-system/14-external-interaction-api.md §3.1 EIA-NX-12` — 이미 `POST /api/triggers/:id/notification/rotate-secret` 를 HMAC signing secret rotation endpoint 로 정의
  - `codebase/backend/src/modules/triggers/triggers.controller.ts:165` — `@Post(':id/notification/rotate-secret')` 이미 구현됨
- **상세**: draft 의 Rationale R-2 및 `§2.3.1 hmacSecret` 행은 `POST /api/triggers/:id/auth/rotate-secret` 경로를 새 endpoint 로 제안한다. 그런데 기존 spec 과 구현에는 **Webhook 트리거 인바운드 인증 (authType=hmac) 의 secret 을 rotate 하는 endpoint 가 없다** — 현재 구현된 `notification/rotate-secret` 는 *outbound notification* 서명 키(EIA `wsk_*`) 를 교체하는 것이므로 자원이 전혀 다르다. 문제는 경로 sub-channel 이름 `auth` 가 기존 RPC 패턴의 `notification` / `interaction` / `chat-channel` 과 다른 새 채널인데, spec/convention 어디에도 사전 정의되어 있지 않다. 또한 `/auth/` 는 `codebase/backend/src/modules/auth/` 모듈 경로와 시각적으로 혼동 가능하다.
- **제안**: 채널명을 `webhook-auth` 로 변경해 `POST /api/triggers/:id/webhook-auth/rotate-secret` 를 사용한다. 또는 기존 `notification/rotate-secret` 와 동등한 수준에서 `POST /api/triggers/:id/inbound-auth/rotate-secret` 와 같이 명명한다. `spec/5-system/2-api-convention.md §2.2` 의 RPC 예시 목록에도 신규 경로를 추가해야 한다. draft 는 v1.1 후속으로 미루고 있으므로 현재 spec PR 에서는 경로명을 확정하거나 TBD 로 명시해 후속 spec PR 에서 결정한다고 표시하는 것도 가능하다.

---

### 2. [WARNING] `triggers.deleted` / `triggers.deleteFailed` i18n 키가 기존 키와 의미 중복

- **target 신규 식별자**: `triggers.deleted`, `triggers.deleteFailed` (plan A §3 i18n 신규 키 목록)
- **기존 사용처**: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts:24-25` — `deleted: "트리거를 삭제했어요"`, `deleteFailed: "트리거 삭제에 실패했어요"` 이미 존재
- **상세**: plan A 에서 신규 키로 열거한 `triggers.deleted` 와 `triggers.deleteFailed` 는 기존 딕셔너리에 이미 정의되어 있다. 동명 키가 새로운 의미를 가지거나 중복 정의되면 컴파일 에러 또는 조용한 덮어쓰기가 발생할 수 있다.
- **제안**: plan A 의 i18n 신규 키 목록에서 `triggers.deleted` / `triggers.deleteFailed` 를 "기존 키 재사용" 으로 표시하고 신규 항목에서 제거한다. 단, 기존 `deleteConfirm: "이 트리거를 삭제할까요?"` 는 plan A 의 새 다이얼로그 UX(이름 타이핑 confirm 포함) 와 달리 단순 confirm 텍스트여서 의미상 구분이 필요하다면 별도 키를 사용하되 이름을 다르게 지정해야 한다.

---

### 3. [WARNING] `triggers.delete.confirm.*` i18n 키와 기존 `triggers.deleteConfirm` 키 혼동 가능

- **target 신규 식별자**: `triggers.delete.confirm.webhook`, `triggers.delete.confirm.schedule`, `triggers.delete.confirm.manual`, `triggers.delete.title`, `triggers.delete.button`, `triggers.delete.typeNameToConfirm`, `triggers.delete.cascadeWarning` (plan A §3 i18n)
- **기존 사용처**: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts:26` — `deleteConfirm: "이 트리거를 삭제할까요?"` (단순 1개 키)
- **상세**: 기존에 `deleteConfirm` (camelCase flat) 이 있는 상태에서 `delete.confirm.*` (nested dot-path) 가 추가되면 `triggers.delete` 를 중간 object 으로 인식하는 타입 시스템에서 `triggers.deleteConfirm` 과 `triggers.delete.confirm.*` 가 같은 계층에 공존해 혼동을 유발한다. 의미도 유사하지만 다르다(단순 yes/no vs type-별 상세 텍스트).
- **제안**: 기존 `deleteConfirm` 키를 deprecate(사용처 없으면 제거, 있으면 마이그레이션)하고 `triggers.delete.confirm.*` 계층으로 통합한다. 아니면 기존 키를 `triggers.deleteSimpleConfirm` 으로 명확히 구분하고 신규 계층을 `triggers.delete.confirm.*` 로 유지한다.

---

### 4. [WARNING] `WebhookConfigCard` 컴포넌트 이름이 기존 구현과 충돌

- **target 신규 식별자**: `WebhookConfigCard` (plan B §2 Frontend)
- **기존 사용처**: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx:150, 253` — `WebhookConfigCard` 함수가 이미 정의되고 사용 중
- **상세**: plan B 는 `WebhookConfigCard` 를 "추출(OverviewCard 와 함께 read ↔ edit 토글 추가)" 대상으로 기술하고 있다. 기존 구현에 같은 이름의 함수가 이미 존재하므로 plan B 를 수행하면 동일 파일 내에서 충돌하거나 rename 없이 기존 함수를 수정하게 된다. 실제로 신규 컴포넌트가 아니라 기존 컴포넌트에 edit 모드를 추가하는 작업이라면 "신규 컴포넌트" 라는 plan 표현이 혼동을 유발한다.
- **제안**: plan B 에서 `WebhookConfigCard` 를 "기존 컴포넌트 확장 (edit 모드 추가)" 으로 명시한다. `TriggerDeleteDialog` 는 기존 코드베이스에 없는 신규 컴포넌트이므로 별도 파일로 생성함을 명기한다.

---

### 5. [INFO] `§2.3.1` 섹션 번호가 `spec/3-workflow-editor/1-node-common.md` 와 같은 번호를 사용

- **target 신규 식별자**: `### 2.3.1 필드 권한 매트릭스` (Change 3, `spec/2-navigation/2-trigger-list.md` 내 신설 섹션)
- **기존 사용처**: `spec/3-workflow-editor/1-node-common.md:132` — `### 2.3.1 필드 도움말 (FieldHelp)` 이 동일 섹션 번호를 사용
- **상세**: 다른 문서에서 동일 섹션 번호 `2.3.1` 을 사용하는 것은 문서 내에서 고유하므로 기술적 충돌은 없다. 다만 cross-link 시 앵커 `#231-필드-권한-매트릭스` 가 의미 없이 유사한 번호 체계로 여러 문서에 산재하면 혼동 가능성이 있다.
- **제안**: 현재 numbering 컨벤션상 문서별 독립 섹션 번호 사용은 허용되므로 변경 불필요. 단, cross-doc 링크 시 파일명을 항상 명시하는 기존 관행을 유지한다.

---

### 6. [INFO] `triggers.detail.*` i18n 키 네임스페이스와 `triggers.externalInteraction.*` 중첩 구조 일관성

- **target 신규 식별자**: `triggers.detail.editName`, `triggers.detail.cancel`, `triggers.detail.save`, `triggers.detail.saving` (plan B §3 i18n)
- **기존 사용처**: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `triggers.externalInteraction.edit`, `triggers.externalInteraction.cancel`, `triggers.externalInteraction.save`, `triggers.externalInteraction.saving` 가 이미 EIA 카드의 동등 기능에 사용 중
- **상세**: EIA 카드의 edit/cancel/save/saving 은 `triggers.externalInteraction.*` 네임스페이스에 있고, plan B 에서 새로 추가하는 Overview/Webhook 카드의 동등 키는 `triggers.detail.*` 네임스페이스를 사용한다. 두 네임스페이스가 같은 drawer 내 같은 UX 패턴을 서로 다른 경로로 정의하게 된다.
- **제안**: 의도적으로 카드별 독립 네임스페이스를 원한다면 현행 유지. 공유 UX 키를 하나로 통합하고 싶다면 `triggers.card.edit`, `triggers.card.save` 와 같은 공통 네임스페이스를 정의하고 두 카드 모두 참조하도록 plan B 에 명시한다.

---

## 요약

target draft 가 도입하는 식별자 중 실질적 충돌이 있는 항목은 2가지다. 첫째, `POST /api/triggers/:id/auth/rotate-secret` 는 기존 RPC 채널 패턴(`notification/`, `interaction/`, `chat-channel/`)에 없는 `auth/` 채널을 신설하면서 spec/convention 에 사전 등록되지 않은 경로를 사용한다 — v1.1 후속 endpoint 이므로 즉각적인 구현 충돌은 없으나 spec 내에서 경로 확정이 필요하다. 둘째, plan A 의 i18n 신규 키 목록에 이미 존재하는 `triggers.deleted` / `triggers.deleteFailed` 가 포함되어 있고, 기존 `triggers.deleteConfirm` 과 의미 유사한 `triggers.delete.confirm.*` 계층이 병존해 딕셔너리 타입 일관성을 깨뜨린다. 나머지 항목(WebhookConfigCard 이름, 섹션 번호, i18n 네임스페이스 분산)은 WARNING/INFO 수준으로 명확화가 권장된다.

## 위험도

MEDIUM
