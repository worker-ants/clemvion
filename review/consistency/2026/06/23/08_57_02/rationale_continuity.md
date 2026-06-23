## 발견사항

- **[INFO]** `triggersApi.getHistory` 포함은 R-7 의 경계 유지 확인 필요
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` `getHistory` 함수
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-7` — "detail drawer 에는 Recent Calls 카드를 두지 않는다. `GET /api/triggers/:id/history` 를 drawer 가 호출하지 않아 drawer 오픈 시 round-trip 1회 감소."
  - 상세: `triggersApi.getHistory` 가 새로 정의된 `triggers.ts` API 카탈로그에 포함됐다. 함수 자체는 spec에 정의된 `GET /triggers/:id/history` 엔드포인트와 일치하며, 실제로 `trigger-history-dialog.tsx` (별도 Dialog) 에서만 호출되고 `trigger-detail-drawer.tsx` 는 이 함수를 전혀 호출하지 않는다. R-7 의 핵심 invariant("drawer 가 history 를 호출하지 않는다")는 유지되고 있다.
  - 제안: API 카탈로그에 `getHistory` 가 있더라도 R-7 경계를 유지하는 현 구조는 올바르다. 추가 조치 불필요.

- **[INFO]** `rotateNotificationSecret` 경로 — spec EIA §7.1 과 일치
  - target 위치: `triggers.ts` L181–189 `rotateNotificationSecret`
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md §3` API 표 — `POST /api/triggers/:id/notification/rotate-secret`
  - 상세: 구현 경로 `/triggers/${id}/notification/rotate-secret` 이 spec 경로와 정확히 일치한다. R-7 에서 언급한 "rotate 전용 엔드포인트" 패턴도 준수. 위반 없음.
  - 제안: 해당 없음.

- **[INFO]** `rotateBotToken` — spec R-CC-10 single-path 정책 준수
  - target 위치: `triggers.ts` L200–205 `rotateBotToken`, `trigger-detail-drawer.tsx` L1309
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md §3` + `spec/5-system/15-chat-channel.md R-CC-10` — "bot token 변경은 반드시 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 만 사용 (24h grace). PATCH body 의 `botTokenRef` 변경은 차단."
  - 상세: `triggersApi.rotateBotToken` 이 `POST /triggers/${id}/chat-channel/rotate-bot-token` 를 호출한다. `TriggerUpdateBody` 에 `botTokenRef` 키를 두지 않아 PATCH 경로로의 우회 채널도 닫혀 있다. R-CC-10 single-path invariant 완전 준수.
  - 제안: 해당 없음.

- **[INFO]** R-4 단일 PATCH 경로 준수
  - target 위치: `triggers.ts` `triggersApi.update`, `page.tsx`·`trigger-detail-drawer.tsx` 전체 `PATCH` 호출부
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-4` — "`isActive` 편집 경로는 `PATCH /api/triggers/:id` body 단일 경로 (`/toggle` 미채택)"
  - 상세: 모든 편집(name, isActive, endpointPath, authConfigId, notification, interaction, chatChannel)이 `triggersApi.update(id, body)` 단일 함수로 통일됐다. `/toggle` 별도 엔드포인트를 만들지 않은 R-4 결정이 API 카탈로그 수준에서도 그대로 유지된다.
  - 제안: 해당 없음.

- **[INFO]** inline 인증 필드(`config.authType`·`hmacSecret` 등) 완전 제거 — R-14 준수
  - target 위치: `triggers.ts` `TriggerUpdateBody` 인터페이스
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md §3` PATCH 설명 — "인증 관련 inline 키(`config.authType`/`hmacHeader`/`hmacSecret`/`bearerToken`)는 제거됨 — 인증은 `authConfigId` binding 으로만 (R-14)"
  - 상세: `TriggerUpdateBody` 는 `authConfigId`, `notification`, `interaction`, `chatChannel` 만 허용하고 과거 inline 인증 필드를 노출하지 않는다. R-14 에서 폐기된 경로는 타입 레벨에서도 재도입되지 않았다.
  - 제안: 해당 없음.

## 요약

M-8 1단계는 `lib/api/triggers.ts` API 카탈로그 추출 및 `triggers/page.tsx`·`trigger-detail-drawer.tsx`·`trigger-history-dialog.tsx`·`trigger-delete-dialog.tsx` 의 직접 `apiClient` 호출을 집중화한 순수 리팩토링이다. spec/2-navigation 의 Rationale (R-4 단일 PATCH, R-6/R-7 history 별도 Dialog, R-CC-10 bot token single-path, R-14 inline 인증 폐기) 이 모두 API 카탈로그 타입 및 함수 구조 수준에서 그대로 유지되고 있다. 기각된 대안(toggle 전용 엔드포인트, drawer 내 history 카드, PATCH 를 통한 botTokenRef 변경)이 신규 코드에서 재도입된 흔적이 없다. Rationale 연속성 관점에서 위반·번복·원칙 충돌은 발견되지 않았다.

## 위험도

NONE
