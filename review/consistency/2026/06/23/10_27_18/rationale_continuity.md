# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation, diff-base=origin/main)
검토 대상 구현: M-8 2단계 — trigger-detail-drawer god-component 카드 파일 분리 + hooks
검토 기준 Rationale: spec/2-navigation/2-trigger-list.md (R-4 ~ R-16), spec/0-overview.md

---

## 발견사항

발견사항 없음. 아래 항목별 확인 결과를 기록한다.

### 확인 항목

1. **R-16 `isActive` drawer read-only 배지 준수** (`overview-card.tsx`)
   - `OverviewCard` 는 `isActive` 를 `<Badge variant={...}>` 로만 렌더한다. 토글 컨트롤이 없다.
   - R-16 "drawer 는 활성 상태를 배지로만 표시, 편집은 §2.1 ⋮ 행 액션 단일 경로" 와 정합.

2. **R-6/R-7 detail drawer ≠ 호출 이력 통합 준수** (`trigger-detail-drawer.tsx`)
   - 추출 후 `trigger-detail-drawer.tsx` 에 `useTrigger` 훅만 있고, `triggersApi.getHistory` 호출이 없다.
   - drawer 에 Recent Calls 카드를 재도입하지 않았다 (R-7 "Recent Calls 카드 제거" 유지).

3. **R-8 Chat Channel 별도 카드 준수** (`chat-channel-card.tsx`)
   - Chat Channel 설정이 `WebhookConfigCard` 에 흡수되지 않고 `ChatChannelCard` 독립 파일로 분리되었다.
   - R-8 "Webhook Configuration 과 Chat Channel 은 의미 차원이 달라 별도 카드로 분리" 와 정합.

4. **R-14 inline 인증 필드 미재도입 준수** (`webhook-config-card.tsx`, `overview-card.tsx`)
   - `authType`/`hmacHeader`/`hmacSecret`/`bearerToken` inline 필드가 어떤 카드에도 없다.
   - `authConfigId` binding 단일 경로가 유지된다.

5. **R-4 단일 PATCH 경로 준수** (각 카드의 `updateMutation`)
   - 모든 카드의 저장 경로는 `triggersApi.update(id, body)` → `PATCH /api/triggers/:id` 단일 경로.
   - `/toggle` 또는 기타 파생 서브경로를 재도입하지 않았다.

---

## 요약

M-8 2단계 완료 구현(trigger-detail-drawer god-component를 카드 파일 5개 + hooks 2개로 분리)은 `spec/2-navigation/2-trigger-list.md` 의 모든 Rationale 결정과 완전히 정합된다. 이번 변경은 순수한 구조적 리팩터링이며 — spec 파일 변경 0건, UI/API 동작 의미 변경 0건 — 기각된 대안(drawer 내 호출 이력 통합, inline 인증 필드 재도입, isActive 토글 재추가, Chat Channel Webhook 카드 흡수)을 재도입하지 않았고 합의된 설계 원칙을 그대로 보존한다.

---

## 위험도

NONE
