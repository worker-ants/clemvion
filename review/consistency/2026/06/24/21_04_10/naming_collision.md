# 신규 식별자 충돌 Check — 결과

검토 대상: `spec/7-channel-web-chat/5-admin-console.md` (구현 완료 후 검토, scope: 코드 diff origin/main...HEAD)

---

## 발견사항

### 발견 없음 — 충돌 사항 없음

아래 항목을 순서대로 점검했으며 충돌이 발견되지 않았다.

#### 1. 요구사항 ID 충돌

diff 및 spec 에서 신규 부여된 요구사항 ID: 없음.
기존 `R-4`(`trigger-list.md §R-4`)는 `PATCH /api/triggers/:id` 단일 경로 결정을 가리키는 trigger-list 자체 rationale 이고,
`5-admin-console.md §2.1` 에서 "R-4 단일 PATCH 경로" 라고 참조할 때는 동일 결정을 참조하는 것이지 새 ID 를 부여하는 것이 아니다. 충돌 없음.

`NAV-WC-01..06` 은 기존 정의된 것이고 diff 에서 신규 ID 를 부여하지 않는다.

#### 2. 엔티티/타입명 충돌

| 신규 식별자 | 위치 | 기존 동명 사용처 | 판정 |
|---|---|---|---|
| `UpdateWebChatMetaInput` | `use-web-chat.ts:177` | 없음 | 충돌 없음 |
| `useUpdateWebChatMeta` | `use-web-chat.ts:195` | 없음 (기존엔 `useUpdateWebChatAppearance` 만 존재) | 충돌 없음 |
| `WebChatRenameDialog` | `web-chat-rename-dialog.tsx:33` | 없음 | 충돌 없음 |
| `WebChatRenameDialogInner` | `web-chat-rename-dialog.tsx:38` | 없음 | 충돌 없음 |
| `lastTriggeredAt?: string` (WebChatInstance 필드 추가) | `use-web-chat.ts:25` | `AlertRule.lastTriggeredAt: string \| null` (alerts.ts:15), `TriggerListItem.lastTriggeredAt?: string` (trigger.ts:53), backend entity `Alert.lastTriggeredAt: Date \| null` | 이름이 동일하지만 모두 "마지막 호출/발동 시각" 이라는 동일 의미의 필드로 서로 다른 엔티티·인터페이스에 독립 선언된 것. 타입 간 혼용 위험 없음. |
| `needsOnboarding` | `web-chat/page.tsx:225` (컴포넌트 로컬 변수) | 없음 | 충돌 없음 |
| `toggleActive` | `web-chat/page.tsx:209` (컴포넌트 로컬 함수) | `workflows/page.tsx` 의 `toggleActiveMutation` | 이름이 비슷하나 다른 파일의 로컬 식별자이며 노출 범위 없음. 충돌 없음. |
| `deleteTarget` (타입 `TriggerDeleteTarget`) | `web-chat/page.tsx:179` | `triggers/page.tsx:162`, `knowledge-bases`, `schedules`, `authentication` 등 다수 페이지 — 모두 로컬 `useState` 변수 | 각 컴포넌트 로컬 변수. 파일 간 노출 없음. 충돌 없음. |

#### 3. API endpoint 충돌

diff 가 새로 추가하는 endpoint 없음. `PATCH /api/triggers/:id { name }`, `PATCH /api/triggers/:id { isActive }` 는 기존 trigger-list spec R-4 에서 이미 정의된 경로를 재사용한다. `DELETE /api/triggers/:id`, `GET /api/triggers/:id/history` 도 기존 정의. 신규 endpoint 없음.

#### 4. 이벤트/메시지명 충돌

diff 에 webhook·queue·SSE 이벤트 이름 신규 정의 없음.

#### 5. 환경변수·설정키 충돌

diff 에 신규 ENV var, config key 없음.

#### 6. 파일 경로 충돌

신규 파일 2개:
- `/codebase/frontend/src/components/web-chat/web-chat-rename-dialog.tsx` — 기존 명명 컨벤션(`<영역>-<동사>-dialog.tsx`) 준수. 기존에 동명 파일 없음.
- `/codebase/frontend/src/components/web-chat/__tests__/web-chat-rename-dialog.test.tsx` — 테스트 파일. 기존에 동명 없음.

충돌 없음.

#### 7. i18n 키 충돌

신규 i18n 키 섹션:
- `webChat.list.inactive` — `common.inactive` 와 값이 동일("Inactive")하지만 독립 네임스페이스. 중복이지만 충돌(다른 의미의 재사용)은 아님.
- `webChat.manage.active` / `webChat.manage.inactive` — `common.active` / `common.inactive` 와 값 동일. 동일 이유.
- `webChat.manage.*` — 기존 dict에 `manage` 섹션 없음. 충돌 없음.
- `webChat.onboarding.*` — 기존 dict에 `onboarding` 섹션 없음. 충돌 없음.

#### 8. React Query 캐시 키 충돌

`WEB_CHAT_INSTANCES_KEY = ["web-chat-instances"]` — 기존에는 `use-web-chat.ts` 내부에서만 사용하던 것을 `export` 로 변경해 `web-chat/page.tsx` 에서도 직접 참조. 이미 동일 값으로 선언된 키를 export 만 추가한 것이므로 충돌 없음.

`TRIGGERS_KEY = ["triggers"]` — `use-web-chat.ts` 내부 private 상수. `triggers/page.tsx` 에서 `["triggers"]` 리터럴을 직접 사용하는 것과 값이 동일해 동일 캐시 버킷을 사용한다 — 이것은 의도된 동작(동일 자원의 두 surface). 상수명·값 모두 충돌 아님.

---

## 요약

이번 diff 가 도입한 신규 식별자(`useUpdateWebChatMeta`, `UpdateWebChatMetaInput`, `WebChatRenameDialog`, `lastTriggeredAt` WebChatInstance 필드, `WEB_CHAT_INSTANCES_KEY` export, 신규 i18n 섹션 `manage`·`onboarding`)는 모두 신규 추가이거나 기존 동명 사용처가 있더라도 의미가 동일하거나 독립 네임스페이스에 있다. 기존 식별자와 다른 의미로 충돌하는 사례는 발견되지 않았다.

---

## 위험도

NONE
