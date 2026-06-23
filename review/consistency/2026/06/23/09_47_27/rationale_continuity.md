# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation)
검토 대상 구현 브랜치: claude/refactor-m8-trigger-drawer
검토 기준 Rationale: spec/2-navigation/2-trigger-list.md, spec/0-overview.md, spec/1-data-model.md, spec/3-workflow-editor/*.md

---

## 발견사항

### 발견사항 없음 (NONE)

본 구현 변경(M-8 2단계 — trigger cards `triggersApi` 추출)은 `spec/2-navigation` 의 기존 Rationale 결정과 충돌하는 항목이 없다.

구체적으로 확인한 항목:

1. **R-4 단일 PATCH 경로 준수**: `triggersApi.update(id, body)` 가 `PATCH /triggers/:id` 단일 경로를 래핑한다. 별도 `/toggle` 서브경로를 추가하거나 R-4 가 기각한 이원화 안을 재도입하지 않았다.

2. **R-6/R-7 상세 drawer vs 호출 이력 Dialog 분리 준수**: `trigger-detail-drawer.tsx` 에서 `GET /triggers/:id/history` 호출이 제거된 채로 유지되고 있다. 호출 이력은 여전히 `trigger-history-dialog.tsx` 단독 경로이며 drawer 에 병합하지 않았다. R-6 "가벼운 modal 전용" 의도가 보존된다.

3. **R-16 `isActive` drawer read-only 배지 유지**: drawer UI 에서 `isActive` 토글 컨트롤을 추가하지 않았다. 토글은 여전히 §2.1 ⋮ 행 액션 단일 경로(toggleMutation → `triggersApi.update`)로만 동작한다.

4. **R-14 inline 인증 필드 제거 유지**: `CreateTriggerBody` · `TriggerUpdateBody` 에 `authType`/`hmacHeader`/`hmacSecret`/`bearerToken` inline 필드를 재도입하지 않았다. `authConfigId` binding 단일 경로가 유지된다.

5. **R-CC-10 bot token rotate 단일 경로 유지**: `triggersApi.rotateBotToken` 이 `POST /triggers/:id/chat-channel/rotate-bot-token` 전용 경로를 쓴다. `TriggerUpdateBody` 에는 `chatChannel.botTokenRef` 키가 없어 PATCH 를 통한 직접 변경 경로가 열리지 않는다.

6. **R-15 무인증 webhook 경고 유지**: `TriggerListItem.authConfigId` 필드가 그대로 존재해 `null` 판정(경고 표시) 로직이 page.tsx 에서 계속 동작한다.

7. **R-13 호출 이력 drill-down Link 유지**: `trigger-history-dialog.tsx` 의 `triggersApi.getHistory` 로의 마이그레이션이 `TriggerHistoryEntry` 인터페이스를 유지하고 `workflowId` prop 기반 drill-down Link 패턴을 건드리지 않는다.

8. **R-1 workflowId v1 read-only 유지**: `TriggerUpdateBody` 에 `workflowId` 변경 키가 없다.

---

## 요약

M-8 2단계 구현(trigger API 카탈로그 `triggersApi` 추출 + 컴포넌트 직접 `apiClient` 호출 마이그레이션)은 `spec/2-navigation/2-trigger-list.md` 의 모든 Rationale 결정과 완전히 정합된다. 기각된 대안(toggle 이원화, inline 인증 필드, drawer 내 호출 이력 통합, PATCH 를 통한 botTokenRef 직접 변경)을 재도입하지 않았으며, 합의된 설계 원칙(단일 PATCH 경로, 상세/이력 분리 Dialog, botToken rotate 단일 경로)을 그대로 보존한다. 변경은 순수한 리팩터링(중복 인라인 인터페이스 제거, API 호출 표면 중앙화)이고 동작 의미는 변하지 않았다.

---

## 위험도

NONE
