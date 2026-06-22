# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation, diff-base=origin/main)

변경 파일 (origin/main 대비):
- `codebase/frontend/src/app/(main)/triggers/page.tsx`
- `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`
- `codebase/frontend/src/lib/api/triggers.ts`

---

## 발견사항

발견된 CRITICAL / WARNING 등급 항목 없음.

---

### 확인된 정합 항목 (INFO 수준 기록)

**[INFO] R-4 (isActive PATCH 단일 경로) — 정합 확인**
- target 위치: `page.tsx` line 246-257, `triggers.ts` `update()` 함수
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-4`
- 상세: `triggersApi.update(id, { isActive })` 를 통한 단일 PATCH 경로를 사용. 기각된 대안인 `/toggle` 서브경로 신설 없음.
- 상태: 정합.

**[INFO] R-6/R-7 (Recent Calls 별도 Dialog, drawer 미포함) — 정합 확인**
- target 위치: `trigger-detail-drawer.tsx` line 102-106
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-6, R-7`
- 상세: drawer 컴포넌트에 "Recent Calls 카드는 [Spec §2.1 + Rationale R-7] 에 따라 본 drawer 에서 제거됨" 주석이 명시되어 있고, 코드에도 Recent Calls 카드가 없음. 호출 이력은 별도 `TriggerHistoryDialog` 로만 노출 (page.tsx import 확인).
- 상태: 정합.

**[INFO] R-14 (inline 인증 필드 제거, authConfigId 단일 경로) — 정합 확인**
- target 위치: `trigger-detail-drawer.tsx` line 341-358, `triggers.ts` `TriggerUpdateBody` 타입
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-14`
- 상세: `authType` / `hmacSecret` / `bearerToken` 인라인 필드 없음. `authConfigId` binding 만 사용. JSDoc 에 "인증은 authConfigId binding 으로만 (inline 인증 필드 폐지)" 명시.
- 상태: 정합.

**[INFO] R-16 (drawer 내 isActive read-only Badge, 토글은 행 ⋮ 메뉴 단일 경로) — 정합 확인**
- target 위치: `trigger-detail-drawer.tsx` line 233-244 (Badge 표시), `page.tsx` line 784-794 (⋮ 메뉴 토글)
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-16`
- 상세: drawer OverviewCard 에서 `isActive` 는 `<Badge>` 읽기 전용 표시만 하고 편집 토글 없음. 활성/비활성 전환은 `page.tsx` ⋮ 드롭다운의 `toggleMutation` 으로만 제공.
- 상태: 정합.

**[INFO] R-8 (Chat Channel 별도 카드 분리) — 정합 확인**
- target 위치: `trigger-detail-drawer.tsx` line 92-95 (`<ChatChannelCard>` 독립 렌더)
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-8`
- 상세: `config.chatChannel` 설정이 Webhook Configuration 카드와 분리된 독립 `<ChatChannelCard>` 컴포넌트로 렌더됨.
- 상태: 정합.

**[INFO] R-CC-10 (bot token 변경 single-path rotate API 전용) — 정합 확인**
- target 위치: `triggers.ts` `rotateBotToken()` 함수, JSDoc 주석
- 과거 결정 출처: `spec/5-system/15-chat-channel.md R-CC-10` (trigger-list.md §3 에서 참조)
- 상세: `triggersApi.rotateBotToken()` 이 `POST /triggers/:id/chat-channel/rotate-bot-token` 만 호출. `TriggerUpdateBody` 에 `botTokenRef` 키가 없음. JSDoc 에 "금지 키(`chatChannel.botTokenRef`…) 는 backend 가 400 으로 거부" 명시.
- 상태: 정합.

**[INFO] R-2 (v1.1 auth rotate-secret 서브경로 미채택) — 정합 확인**
- target 위치: `triggers.ts` 전체 API 카탈로그
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-2` 및 §3 참고 footnote ("과거 v1.1 예약 행 … 폐기됐다")
- 상세: `POST /api/triggers/:id/auth/rotate-secret` 는 `triggers.ts` 에 구현되지 않음. EIA outbound용 `rotateNotificationSecret` 은 별도 endpoint(`notification/rotate-secret`) 로 분리되어 있어 혼동 없음.
- 상태: 정합.

---

## 요약

`spec/2-navigation/2-trigger-list.md` Rationale 의 주요 결정 (R-2, R-4, R-6, R-7, R-8, R-12, R-13, R-14, R-15, R-16, R-CC-10) 에 대해 이번 변경(M-8 1단계 — `triggers.ts` API 레이어 추출 + `trigger-detail-drawer.tsx` 리팩터링)이 기각된 대안을 재도입하거나 합의된 원칙을 위반하는 사례는 발견되지 않았다. 기각된 `/toggle` 서브경로, inline 인증 필드, Recent Calls in drawer, drawer 내 isActive 편집 토글 등 모두 spec Rationale 을 준수한다. `page.tsx` 에 `apiClient` 직접 호출이 일부 잔류하나 (`/workflows` 조회), 이는 "m-2 workflows 트랙에서 이전 예정" 으로 파일 내 주석에 명시된 의도적 예외로 spec Rationale 위반이 아니다.

## 위험도

NONE
