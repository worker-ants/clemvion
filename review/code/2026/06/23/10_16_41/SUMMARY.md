# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `uiMapping.formMode` 하드코딩(`"multi_step"`)으로 기존에 다른 formMode를 설정한 트리거가 저장 시 의도치 않게 교체될 수 있음. 나머지는 모두 defer 가능한 WARNING/INFO 수준이며, behavior-preserving 리팩터링으로서 전반적 구조 품질은 유의미하게 개선됨.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT | `uiMapping.formMode` 편집 UI 누락 — spec §2.3.1이 edit 필드로 명시하나 `ChatChannelEditForm`에 selector 없음. PATCH body에 `"multi_step"` 하드코딩으로 기존 `native_modal`/`auto` 설정 트리거 저장 시 덮어씌워짐 | `chat-channel-card.tsx` `saveMutation.mutationFn` L416 | `formMode` selector 추가(`auto/native_modal/multi_step`) + `initialChatChannelEditValues`가 `chatChannel?.uiMapping?.formMode ?? "auto"` 읽도록 수정. 또는 의도적 defer라면 plan에 명시 + spec §2.3.1 갱신을 planner에 위임 |
| 2 | REQUIREMENT | `RotateBotTokenModal` botToken 형식 검증(regex) 누락 — spec §2.3.1 및 Chat Channel §5.4가 클라이언트 측 `^\d{6,}:[A-Za-z0-9_-]{30,}$` 검증 명시. 현재는 빈 값 체크만 수행 | `chat-channel-card.tsx` `RotateBotTokenModal` L329 | `disabled` 조건에 `!BOT_TOKEN_REGEX.test(value.trim())` 추가 |
| 3 | REQUIREMENT | `OverviewCard.name` — `maxLength={255}` vs spec 1~120자 불일치. 백엔드가 최종 차단하지만 클라이언트 spec 불일치 | `overview-card.tsx` L1266 | `maxLength={120}`으로 수정 |
| 4 | REQUIREMENT | `ExternalInteractionCard` notification URL clear 불가 — `urlValue` 비어있으면 PATCH body에 `notification` 키 자체를 누락시켜 기존 URL을 삭제할 수 없음 | `external-interaction-card.tsx` `saveMutation.mutationFn` L802–810 | URL 비우기 의도라면 `patchBody.notification = null` 경로 추가 또는 spec EIA §4 확인 필요 |
| 5 | ARCHITECTURE | `window.confirm()` 직접 호출 — rotate/revoke/webhook-save 3곳에서 브라우저 전역 호출. 테스트 불가 안티패턴이며 clickjacking 이론적 우회 가능성(단, `useHasRole` 게이트로 실질 위험 낮음) | `external-interaction-card.tsx` L851/L863; `webhook-config-card.tsx` L1559 | `useConfirm` 훅 또는 Modal 컴포넌트 도입. behavior-preserving 범위상 후속 PR로 defer 가능 |
| 6 | ARCHITECTURE | `ChatChannelCard` 내 비즈니스 로직 과밀(615줄) — `RotateBotTokenModal` + `parseLanguageHints` + `initialChatChannelEditValues` + 상수가 한 파일. 다른 카드(65~384줄) 대비 2~9배 | `cards/chat-channel-card.tsx` | `RotateBotTokenModal`을 별도 파일로 분리, 유틸 함수를 `lib/utils/chat-channel.ts`로 이동 — 후속 PR 계획 |
| 7 | MAINTAINABILITY | 카드 헤더 편집/저장/취소 버튼 JSX 블록(약 15~20줄) 3개 파일에 구조적 반복 — `chat-channel-card.tsx`, `external-interaction-card.tsx`, `webhook-config-card.tsx` | 각 카드 `CardHeader` 내부 | M-8 후속 PR에서 `CardEditHeader` 컴포넌트 또는 `useCardHeader` 패턴으로 추출 |
| 8 | SIDE_EFFECT | `WebhookConfigCard.handleCancel`에 `updateMutation.reset()` 누락 — 저장 실패 후 취소 시 오류 상태가 잔류해 오류 배지가 다음 열기에 표시될 수 있음. `ChatChannelCard.handleCancel`은 `saveMutation.reset()` 호출하고 있어 일관성 결여 | `webhook-config-card.tsx` `handleCancel` | `handleCancel` 내에 `updateMutation.reset()` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `languageLocale` 편집 기능 구현됨 — spec `2-trigger-list.md §2.3.1` 필드 매트릭스에 `languageLocale` 행 없음. 코드 결정은 합리적, spec 갱신 필요 | `chat-channel-card.tsx` `ChatChannelEditForm` L229–253 | 코드 유지. spec `§2.3.1`에 `languageLocale | edit | "ko"/"en"` 행 추가를 planner에 요청 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` spec §2.3/§2.3.1은 Auth Config 카드를 별도 행으로 기술하나 구현은 `WebhookConfigCard` 내 병합. plan에 "5카드 behavior-preserving 유지" 명시된 의도적 결정 | `webhook-config-card.tsx`; spec `2-trigger-list.md §2.3` | 코드 유지. spec §2.3 드로어 테이블에 "authConfigId는 Webhook Configuration 카드에 병합됨" 주석 추가를 planner에 요청 |
| 3 | SECURITY | `window.confirm()` 보안 게이트 — rotate/revoke 비가역 작업에 사용. clickjacking 이론적 우회 가능하나 `useHasRole("editor")` UI 게이트로 실질 위험 낮음 | `external-interaction-card.tsx` L851/L863 | 커스텀 Modal 컴포넌트로 교체 권장(WARNING #5와 동일 이슈) |
| 4 | ARCHITECTURE | `onSaved` 콜백 계약이 카드마다 inline 선언 — `{ trigger: TriggerDetail; onSaved: () => void }` 공통 패턴 미추출 | 모든 편집 가능 카드 | `cards/_types.ts`에 `interface EditableCardProps` 선언 고려(낮은 우선순위) |
| 5 | ARCHITECTURE | `useTrigger.invalidate` 매 렌더마다 새 참조 생성 — 카드가 `React.memo` 미사용이라 현재 실질 성능 문제 없음 | `hooks/use-trigger.ts` L7–10 | `useCallback([queryClient, triggerId])` 메모이제이션. memo 도입 시 함께 처리 |
| 6 | ARCHITECTURE | `cards/` 폴더에 `index.ts` 배럴 없음 — 카드 수 증가 시 import 경로 관리 번거로울 수 있음 | `codebase/frontend/src/components/triggers/cards/` | `cards/index.ts` 배럴 추가 고려(옵션) |
| 7 | MAINTAINABILITY | `ChatChannelCard` 내 `providerLabel`/`visualNodeLabel`/`formModeLabel` 3헬퍼가 컴포넌트 body 안에 정의됨 — props/state 비의존이므로 모듈 스코프 이동 가능 | `chat-channel-card.tsx` L385–402 | 모듈 스코프 순수함수로 이동 |
| 8 | MAINTAINABILITY | `getCurlExample` 함수가 `WebhookConfigCard` 컴포넌트 body 안에 정의됨 — auth 타입별 분기 4개 존재, 단위 테스트 불가 | `webhook-config-card.tsx` L1582–1616 | `getCurlExample(url: string, authType: string | undefined): string` 모듈 스코프 추출 |
| 9 | MAINTAINABILITY | `OverviewCard`에서 `useCardEditToggle.startEdit`을 destructure 하지 않고 동명 로컬 함수 선언으로 shadowing | `overview-card.tsx` L1206–1209 | destructure 시 `startEdit` 제외하고 로컬 함수만 사용하도록 명확화 |
| 10 | MAINTAINABILITY | 매직 넘버 `min={1}`, `max={600}` 인라인 선언 — `DEFAULT_RATE_LIMIT_PER_MINUTE`는 상수화됐으나 상·하한은 미처리 | `chat-channel-card.tsx` L219–220 | `const RATE_LIMIT_MIN = 1; const RATE_LIMIT_MAX = 600;` 모듈 상단 추가 |
| 11 | MAINTAINABILITY | `ExternalInteractionCard` rotate/revoke가 `async try/catch` 패턴인데 `saveMutation`은 `useMutation` 패턴 — 이유 주석 없어 비일관성처럼 보임 | `external-interaction-card.tsx` L850–872 | 인라인 주석 추가: `// rotate/revoke는 결과 secret을 직접 캡처해야 해서 useMutation 대신 async 직접 호출` |
| 12 | TESTING | `parseLanguageHints` 순수 함수 — 4가지 경로 중 통합 테스트가 1가지만 커버 | `chat-channel-card.tsx` L115–141 | 파일 export 또는 유틸 추출 후 단위 테스트 추가(빈 입력, 배열 입력, null 입력, 값 non-string) |
| 13 | TESTING | `useCardEditToggle` 독립 단위 테스트 없음 — 4개 카드 공유 훅이지만 통합 테스트만 간접 커버 | `hooks/use-card-edit-toggle.ts` | `renderHook` 기반 3-case 단위 테스트 추가 권장 |
| 14 | TESTING | EIA rotate/revoke 경로, ChatChannel RotateBotToken 경로 테스트 미존재 — `window.confirm` 의존으로 jsdom에서 mock 필요 | `external-interaction-card.tsx` L850–872; `chat-channel-card.tsx` L447–459 | `vi.spyOn(window, 'confirm').mockReturnValue(true)` 패턴으로 테스트 추가 권장 |
| 15 | TESTING | `OverviewCard.saveDisabled` 경계값 로직 테스트 없음 — 빈 이름/원본 이름 재입력 시 Save 버튼 비활성화 미검증 | `overview-card.tsx` L1211–1214 | 경계값 케이스 2개 추가 권장 |
| 16 | DOCUMENTATION | `useTrigger`/`useCardEditToggle` 훅 레벨 JSDoc 없음 — `open` 파라미터의 enabled 조건, `invalidate`의 이중 캐시 무효화 동작 비자명 | `hooks/use-trigger.ts`, `hooks/use-card-edit-toggle.ts` | 함수 상단 한 줄 JSDoc 추가 |
| 17 | DOCUMENTATION | `WebhookConfigCard`/`OverviewCard`/`ScheduleConfigurationCard` 공개 export에 JSDoc 없음 | 각 카드 export 선언부 | 함수 상단 책임 경계 설명 JSDoc 한 줄 추가 |
| 18 | DOCUMENTATION | `ExternalInteractionCard` JSDoc 블록이 `NOTIFICATION_EVENT_CHOICES` 상수 위에 위치해 컴포넌트 문서인지 상수 문서인지 모호 | `external-interaction-card.tsx` L743–755 | JSDoc을 `export function ExternalInteractionCard` 바로 위로 이동 |
| 19 | SECURITY | `rotateResult`/`revokeResult`를 React state 메모리에 보유 — `SecretRevealBox` 60초 자동 소거 설계 의도 있으나 실제 구현 확인 권장 | `external-interaction-card.tsx` L796–797 | `SecretRevealBox.onDismiss` 60s 자동 소거 동작 구현 여부 확인 |
| 20 | SCOPE | plan "후속(별건)" 항목(M-8 외)이 메모 수준으로 등록됨 — 코드 구현 없으나 향후 범위 불명확성 씨앗 가능성 | `plan/in-progress/refactor/02-architecture.md` | 별도 plan 항목으로 분리 또는 현행 메모 유지(현재는 명확히 "별건" 표기로 허용) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `window.confirm` 보안 게이트 패턴(이론적 우회, 실질 위험 낮음). 에러 처리에서 서버 메시지 미노출 패턴 올바르게 적용됨 |
| architecture | LOW | god-component 분해 성공(1,537줄→65줄 thin wrapper). `ChatChannelCard` 615줄 과밀, `window.confirm` 테스트 불가 패턴 |
| requirement | MEDIUM | `formMode` 하드코딩(실 데이터 덮어쓰기 위험), botToken regex 검증 누락, `maxLength` 불일치, notification URL clear 불가 |
| scope | NONE | 변경 범위가 커밋/plan 목표에 충실히 제한됨. 범위 위반 없음 |
| side_effect | LOW | `WebhookConfigCard.handleCancel` mutation.reset() 누락으로 오류 상태 잔류 가능. 신규 부작용 없음 |
| maintainability | LOW | 카드 헤더 버튼 JSX 3개 파일 반복, 헬퍼 함수 컴포넌트 body 내 정의 등 후속 정리 대상 다수 |
| testing | LOW | 기존 54개 테스트 무수정 통과. rotate/revoke/RotateBotToken 경로 테스트 미존재, 신규 파일 7개 전용 단위 테스트 없음 |
| documentation | LOW | 훅 및 카드 export 함수 JSDoc 부재. 동작 영향 없는 INFO 수준 |
| user_guide_sync | NONE | i18n 신규 키 없음, user guide 동반 갱신 불필요 |

---

## 발견 없는 에이전트

- **user_guide_sync**: 매트릭스 18개 trigger 전수 확인, 동반 갱신 필요 항목 없음
- **scope**: 범위 위반 없음 — 모든 변경이 커밋/plan 명시 목표(god-component 파일 분리 + hooks 추출) 내로 제한됨

---

## 권장 조치사항

1. **(즉시 수정 권장)** `chat-channel-card.tsx` `saveMutation.mutationFn`의 `formMode: "multi_step"` 하드코딩 제거 — `editValues.formMode`를 사용하도록 수정하거나, 의도적 defer라면 plan에 명시하고 spec §2.3.1을 planner에 위임 (WARNING #1)
2. **(즉시 수정 권장)** `overview-card.tsx` `maxLength={255}` → `maxLength={120}` 수정 (spec §2.3.1 1~120자 일치, WARNING #3)
3. **(즉시 수정 권장)** `chat-channel-card.tsx` `RotateBotTokenModal` — `BOT_TOKEN_REGEX` 검증 추가 (WARNING #2)
4. **(즉시 수정 권장)** `webhook-config-card.tsx` `handleCancel`에 `updateMutation.reset()` 추가 — 오류 상태 잔류 방지 (WARNING #8)
5. **(즉시 수정 권장)** `external-interaction-card.tsx` notification URL clear 경로 처리 — 빈 URL 저장 시 `patchBody.notification = null` 또는 spec EIA §4 확인 (WARNING #4)
6. **(후속 PR 계획)** `window.confirm`을 `useConfirm` 훅 또는 Modal 컴포넌트로 교체 (WARNING #5, #7 — behavior-preserving 범위 감안 defer 가능)
7. **(후속 PR 계획)** `ChatChannelCard` 파일 분리 — `RotateBotTokenModal` 별도 파일, 유틸 함수 `lib/utils/` 이동 (WARNING #6)
8. **(후속 추가 권장)** EIA rotate/revoke 및 ChatChannel RotateBotToken 테스트 커버리지 추가 (INFO #14)
9. **(spec 갱신 위임)** `languageLocale` 편집 기능 — spec `2-trigger-list.md §2.3.1` 매트릭스 갱신 planner 위임 (SPEC-DRIFT #1)
10. **(spec 갱신 위임)** Auth Config 카드 통합 결정 — spec §2.3 드로어 테이블에 현행 구현 주석 추가 planner 위임 (SPEC-DRIFT #2)

---

## 라우터 결정

라우터 선별 실행 (`routing_status=done`).

- **실행** (9명): security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync
- **강제 포함(router_safety)** (7명): documentation, maintainability, requirement, scope, security, side_effect, testing

**제외** (5명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | behavior-preserving 리팩터링으로 성능 회귀 위험 낮음 |
| dependency | 신규 외부 의존성 추가 없음 |
| database | 백엔드 DB 변경 없음 (프론트엔드 컴포넌트 파일 분리) |
| concurrency | 동시성 이슈 해당 없는 UI 컴포넌트 리팩터링 |
| api_contract | 백엔드 API 계약 변경 없는 프론트엔드 내부 구조 변경 |