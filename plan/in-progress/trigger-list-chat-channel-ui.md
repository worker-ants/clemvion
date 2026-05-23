---
worktree: trigger-list-chat-channel-ui-d0c4a3
started: 2026-05-23
owner: developer
---

# Plan — Trigger List 의 Chat Channel UI 구현 (단일 PR 통합)

## 배경

`spec-telegram-chat-channel-ui-polish` (PR #281, 머지 완료) 가 텔레그램 chat channel 4 P1 결정을 spec 에 확정. 본 plan 은 그 중 **결정 1 (UI 가시성)** 과 **결정 2 (botToken single-path)** 의 프론트엔드 UI + 보조 backend 변경을 **단일 PR** 로 구현한다.

**원래 계획은 4 PR 분할이었으나** (PR A backend / PR B frontend read / PR C frontend edit / PR D e2e+guide), 사용자 결정으로 단일 PR 통합 채택. 한 사용자 흐름 (텔레그램 봇 등록 → 트리거 카드 표시 → 편집 → token rotate → 가이드의 GUI 단계 안내) 을 한 PR 에서 완성하는 게 reviewer 의 컨텍스트 부담은 크지만 review 의 의미 단위 (= "텔레그램을 GUI 로 쓸 수 있게 만든다") 와 정합.

선행 PR:
- #281 (`docs(spec): chat-channel — 4 P1 결정`) — 머지 완료
- #282 (`docs(user-guide): telegram — spec PR #281 반영`) — 머지 완료

## SoT 참조

- [Spec Trigger List §2.1 / §2.3 / §2.3.1 / §3 / Rationale R-8](../../spec/2-navigation/2-trigger-list.md)
- [Spec Chat Channel §4.1 / §5.4 / §5.4.1 / §5.4.2 / §5.5](../../spec/5-system/15-chat-channel.md)
- [Convention Chat Channel Adapter §2.3](../../spec/conventions/chat-channel-adapter.md)

## 작업 분할 (한 PR 안의 commit 단위)

### Commit 1 — backend supporting changes

| 항목 | 파일 | 상세 |
|---|---|---|
| `hasBotToken` derived 필드 응답에 포함 | `codebase/backend/src/modules/triggers/triggers.service.ts` + DTO | `GET /api/triggers/:id` 응답의 `config.chatChannel` 에 `hasBotToken: botTokenRef != null`. `botTokenRef` / `secretTokenRef` 는 응답에서 strip |
| PATCH body 의 `config.chatChannel.botTokenRef` 차단 | `update-trigger.dto.ts` 또는 service | 400 `VALIDATION_ERROR` (`details.field='botTokenRef'`) |
| `visualNode` read-time normalize (`text_only` → `text`) | telegram.adapter.ts 또는 chat-channel-dispatcher | 어댑터 입력 단계에서 변환 |
| `chatChannelHealth` / `chatChannelLastError` / `chatChannelSetupAt` / `chatChannelRotatedAt` 응답 mapping 확인 | response transformer | 누락 시 추가 |
| 테스트 | integration | PATCH 차단 / `hasBotToken` / normalize 케이스 |

### Commit 2 — frontend read-only UI

| 항목 | 파일 | 상세 |
|---|---|---|
| 행 칩 + health 배지 | `triggers/page.tsx` (행 컴포넌트) | webhook + chatChannel 트리거에만. notification 배지와 같은 영역 |
| Drawer Chat Channel 카드 (read 모드) | 새 컴포넌트 `chat-channel-card.tsx` | provider · username · hasBotToken mask · uiMapping · rateLimit · languageHints · health 그룹 |
| i18n dict (KO/EN) | `lib/i18n/dict/{ko,en}/triggers.ts` | `triggers.chatChannel.*` 키 신설 |
| health badge 컴포넌트 재사용 또는 신설 | 공통 컴포넌트 | enum 동일이라 가능하면 기존 reuse |

### Commit 3 — frontend editing + rotate flow

| 항목 | 파일 | 상세 |
|---|---|---|
| Chat Channel 카드 편집 모드 | `chat-channel-card.tsx` | uiMapping 3개 / rateLimit / languageHints (5 키). editor 이상 권한 |
| Bot Token 재발급 액션 | modal 또는 inline | textarea + validation → rotate API 호출 → 응답 health 갱신 |
| 트리거 생성 dialog Chat Channel 섹션 | `triggers/page.tsx` 생성 dialog | provider dropdown · botToken textarea · uiMapping defaults |

### Commit 4 — e2e + 가이드 callout 제거

| 항목 | 파일 | 상세 |
|---|---|---|
| 가이드 callout 제거 + GUI 단계 안내 | `telegram.mdx` (KO/EN) + `triggers.mdx` (KO/EN) | PR #282 가 추가한 GUI 부재 callout 4건 제거 → GUI 단계 안내로 교체 |
| e2e 시나리오 | playwright e2e | "트리거 생성 → token 입력 → health=healthy → rotate → 삭제" |

## 선행 의무

본 plan 의 commit 1 (backend) 착수 직전 `/consistency-check --impl-prep` 의무 호출. scope: spec/5-system/15-chat-channel.md + spec/2-navigation/2-trigger-list.md.

## 의식적 boundary

- backend chat-channel adapter 자체 (Phase 1/2 완성) 변경 없음. 본 plan 은 UI 노출 layer + 필수 보조 변경만.
- `visualNode` v2 SSR PNG 구현 (`chat-channel-visual-ssr-png` plan) 별 plan. 본 plan 은 enum 선택지만 노출.
- `secret-store` 인프라 결정 (`chat-channel-secret-store-infra` plan) 별 plan.

## 리스크 / 완화

| 리스크 | 완화 |
|---|---|
| 단일 PR 의 review 부담 | commit 단위 분리 + PR 본문에 각 commit 의 review 가이드 명시 |
| backend `hasBotToken` mapping 이 이미 있는지 확인 필요 | commit 1 의 첫 task 로 확인 |
| Bot token textarea 가 기존 secret 입력 (hmacSecret, bearerToken) 과 일관 패턴 | 기존 패턴 reuse 우선 |
| KO/EN i18n parity 깨질 위험 | dict 변경은 KO/EN 한 commit 으로 묶음 |
| e2e 가 실제 텔레그램 API 호출을 mock 처리해야 함 | 테스트에서 telegram client mock |

## 완료 기준

- PR #283 머지
- e2e 시나리오 통과
- 가이드의 GUI 부재 callout 제거 + GUI 단계 안내 완료
- spec PR #281 의 결정 1·2 가 모두 UI 로 실현
