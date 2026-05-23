---
worktree: trigger-list-chat-channel-ui-d0c4a3
started: 2026-05-23
owner: developer
---

# Plan — Trigger List 의 Chat Channel UI 구현 (spec PR #281 결정 1·2 구체화)

## 배경

`spec-telegram-chat-channel-ui-polish` (PR #281, 머지 완료) 가 텔레그램 chat channel 의 4 P1 결정을 spec 에 확정. 본 plan 은 그 중 **결정 1 (UI 가시성)** 과 **결정 2 (botToken single-path)** 의 프론트엔드 UI 를 구현한다. 결정 3 (`visualNode` enum) 은 backend 어댑터 보조 + 가이드 정정으로 흡수되어 별도 UI 작업 거의 없음 (`uiMapping.visualNode` edit row 만). 결정 4 (Inbound HTTP Contract) 는 backend 응답 형식이라 UI 작업 없음.

선행 PR:
- #281 (`docs(spec): chat-channel — 4 P1 결정`) — 머지 완료
- #282 (`docs(user-guide): telegram — spec PR #281 반영`) — review 대기

본 plan 머지 후 PR #282 가이드의 "현재 GUI 폼 없음" callout 은 제거 + GUI 단계 안내로 격상.

## SoT 참조

- [Spec Trigger List §2.1 / §2.3 / §2.3.1 / §3 / Rationale R-8](https://github.com/worker-ants/clemvion/blob/main/spec/2-navigation/2-trigger-list.md)
- [Spec Chat Channel §4.1 / §5.4 / §5.4.1 / §5.4.2 / §5.5](https://github.com/worker-ants/clemvion/blob/main/spec/5-system/15-chat-channel.md)
- [Convention Chat Channel Adapter §2.3](https://github.com/worker-ants/clemvion/blob/main/spec/conventions/chat-channel-adapter.md)

## 구현 범위 / PR 분할

큰 작업이므로 4 PR 로 분할. 각 PR 은 독립 review·머지 가능하지만 의존성은 A → B → C → D 순.

### PR A — backend supporting changes (`feat(backend/chat-channel): UI 지원 layer`)

| 항목 | 파일 | 상세 |
|---|---|---|
| `hasBotToken` derived 필드 응답에 포함 | `codebase/backend/src/modules/triggers/triggers.service.ts` + DTO | `GET /api/triggers/:id` 응답의 `config.chatChannel` 에 `hasBotToken: botTokenRef != null` 추가. `botTokenRef` / `secretTokenRef` 는 응답에서 strip |
| PATCH body 의 `config.chatChannel.botTokenRef` 차단 | `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` 또는 service | 400 `VALIDATION_ERROR` (`details.field='botTokenRef'`). class-validator decorator 또는 service 단 검증 |
| `visualNode` read-time normalize (`text_only` → `text`) | `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` 또는 dispatcher | 어댑터 입력 단계에서 `config.chatChannel.uiMapping.visualNode === 'text_only'` 면 `'text'` 로 변환 후 로직 진입. spec convention §2.3 의 normalize 정책 적용 |
| `chat_channel_last_error` → API 응답 `chatChannelLastError` mapping 확인 | response transformer 또는 entity → DTO | 이미 camelCase 변환되는지 확인. 누락 시 추가 |
| 테스트 | `codebase/backend/test/integration/` | PATCH 차단 케이스 / `hasBotToken` 응답 / `text_only` normalize 유닛 |

**예상 크기**: ~150 LOC, 3-5 시간

### PR B — frontend read-only UI (`feat(frontend/triggers): Chat Channel 카드 + 행 표시`)

| 항목 | 파일 | 상세 |
|---|---|---|
| 트리거 목록 행에 provider 칩 + `chatChannelHealth` 배지 | `codebase/frontend/src/app/(main)/triggers/page.tsx` (행 컴포넌트) | webhook 트리거 중 `config.chatChannel` 있는 행에만. `notificationHealth` 배지와 같은 영역 (WH-MG-09) |
| Drawer 의 별도 "Chat Channel" 카드 (read 모드) | `trigger-detail-drawer.tsx` 또는 새 컴포넌트 `chat-channel-card.tsx` | provider · `botIdentity.username` · `hasBotToken` (true → "•••• \<last4 미노출\>" placeholder, 응답에 last4 가 없으므로 mask 만 표시) · uiMapping · rateLimitPerMinute · languageHints · health 그룹. read-only |
| i18n dict (KO/EN) | `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` | `triggers.chatChannel.*` 키 신설 — provider / botToken / botIdentity / uiMapping / formMode / visualNode / buttonLayout / rateLimitPerMinute / languageHints / health 등 |
| health badge 컴포넌트 재사용 | 기존 `notification-health-badge.tsx` 확장 또는 별 컴포넌트 | enum 동일 (`unknown` / `healthy` / `degraded`) 이라 같은 컴포넌트 사용 가능 — Rationale R-8 의 "동일 영역·동일 형식" 정합 |
| 테스트 | `codebase/frontend/src/__tests__/` | snapshot · 행 표시 조건 (chatChannel 없는 트리거는 칩 미표시) |

**예상 크기**: ~400 LOC (i18n 포함), 6-8 시간

### PR C — frontend editing UI + rotate flow (`feat(frontend/triggers): Chat Channel 편집·rotate`)

| 항목 | 파일 | 상세 |
|---|---|---|
| Chat Channel 카드의 edit 토글 + 매트릭스 9 row 의 편집 가능 필드 | `chat-channel-card.tsx` 편집 모드 | `uiMapping.formMode` / `uiMapping.visualNode` (3-enum dropdown) / `uiMapping.buttonLayout` / `rateLimitPerMinute` / `languageHints` (5 키 input). 권한: editor 이상 |
| Bot Token 재발급 액션 | 같은 카드 안 별 컴포넌트 또는 modal | 사용자 클릭 → 신규 token 입력 textarea (validation: `^\d{6,}:[A-Za-z0-9_-]{30,}$`) → 제출 → `POST /api/triggers/:id/chat-channel/rotate-bot-token` 호출 → 응답 시 health 갱신 |
| 새 트리거 생성 dialog 에 Chat Channel 섹션 (optional) | `triggers/page.tsx` 생성 dialog | provider dropdown · botToken textarea · uiMapping defaults · languageHints defaults. webhook trigger 생성 시 활성화 |
| PATCH 차단 에러 표면화 | error toast | 만약 사용자가 우회로 botTokenRef 변경 시도 시 400 응답을 명확히 표시 (현실적으로는 UI 가 그 경로를 노출하지 않으므로 발생 안 함) |
| 테스트 | playwright e2e 또는 unit | rotate flow / validation / edit 토글 |

**예상 크기**: ~500 LOC, 8-10 시간

### PR D — 가이드 callout 제거 + e2e (`docs+e2e: telegram-guide GUI 단계 격상`)

| 항목 | 파일 | 상세 |
|---|---|---|
| 가이드의 GUI 부재 callout 제거 + GUI 단계 안내로 교체 | `telegram.mdx` / `telegram.en.mdx` / `triggers.mdx` / `triggers.en.mdx` | PR #282 가 추가한 callout 4개 제거 → "트리거 화면에서 Chat Channel 카드 클릭" 흐름 안내 + screenshot |
| e2e 시나리오 추가 | `codebase/frontend/e2e/` | "1. 트리거 생성 → 2. Chat Channel 섹션에서 token 입력 → 3. 생성 후 health=healthy 확인 → 4. rotate 흐름 → 5. 삭제" |
| screenshot 자동 캡처 (가능 시) | e2e 안에서 | docs 의 image asset 으로 export |

**예상 크기**: ~150 LOC + 4-6 screenshot

## 선행 의무

본 plan 의 PR A 착수 직전 `/consistency-check --impl-prep spec/5-system/15-chat-channel.md` 의무 호출 (developer skill §4 의 의무 호출). spec/2-navigation/ 도 같이 scope 에 포함하면 trigger-list 의 매트릭스도 같이 검토됨.

## 의식적 boundary

- backend 의 chat-channel adapter 자체 (Phase 1/2 완성) 는 본 plan 범위 밖. 본 plan 은 UI 노출 layer 만.
- `visualNode` 의 v2 SSR PNG 구현 (`chat-channel-visual-ssr-png` plan) 은 본 plan 범위 밖. UI 는 enum 선택지만 노출.
- `secret-store` 인프라 결정 (`chat-channel-secret-store-infra` plan) 은 본 plan 범위 밖. 현재 secret store 동작에 의존.

## 리스크

| 리스크 | 완화 |
|---|---|
| backend 의 `hasBotToken` derived 필드 transformer 가 다른 응답 형식과 충돌 | PR A 의 unit test 로 기존 응답 shape 유지 검증 |
| Bot token textarea 가 다른 secret 입력 UI (hmacSecret, bearerToken) 와 동일 패턴이어야 함 | 기존 패턴 reuse — `MaskedSecretInput` 같은 공통 컴포넌트 신설 검토 |
| i18n dict 추가 시 KO/EN parity 깨질 위험 | dict 변경은 KO/EN 한 commit 으로 묶음 |
| spec PR #281 의 `chat_channel_last_error` ↔ API `chatChannelLastError` mapping 이 backend 에 이미 있는지 확인 필요 | PR A 의 첫 task 로 확인 |

## 완료 기준

- 4 PR 모두 머지
- e2e 시나리오 통과
- 가이드의 "현재 GUI 폼 없음" callout 제거 완료
- spec PR #281 의 결정 1·2 가 모두 UI 로 실현
