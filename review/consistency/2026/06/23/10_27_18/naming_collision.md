# 신규 식별자 충돌 검토 — M-8 2단계 (trigger card 파일 분리, --impl-done)

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation)
대상: M-8 2단계 — `trigger-detail-drawer.tsx` 카드 파일 분리 + hooks 추출

---

## 발견사항

### [INFO] 이전 impl-prep WARNING 3건 전부 구현에서 해소됨

impl-prep 시점(`review/consistency/2026/06/23/09_47_27/naming_collision.md`)에는 아래 세 잠재 충돌이 WARNING/INFO 로 지적됐다.

1. **`OverviewCard` 이중 정의 (WARNING)**: 신규 `cards/overview-card.tsx` 가 `OverviewCard` 를 export 하고 기존 `trigger-detail-drawer.tsx` 도 동일 이름 private 함수를 유지할 것을 우려했다.
   - **impl-done 확인**: `trigger-detail-drawer.tsx` 는 현재 65줄 thin wrapper 로 축소됐으며, `OverviewCard` private 정의가 제거됐다. drawer 는 `import { OverviewCard } from "./cards/overview-card"` 로 단일 진실 참조. 충돌 해소됨.

2. **`TYPE_BADGE_STYLES` 중복 (INFO)**: 두 파일이 같은 이름 상수를 정의할 것을 우려했다.
   - **impl-done 확인**: `trigger-detail-drawer.tsx` 에 해당 상수가 없음(grep 결과 0건). `cards/overview-card.tsx` 에만 module-private 로 존재. 충돌 해소됨.

3. **query key `["trigger-detail"]` 이중 관리 (INFO)**: drawer 와 `use-trigger.ts` 양쪽이 같은 캐시 키를 관리할 것을 우려했다.
   - **impl-done 확인**: drawer 는 `useTrigger(triggerId, open)` 를 import 해 사용하며, inline `useQuery`/`invalidateQueries` 를 직접 호출하지 않는다. `["trigger-detail"]` 는 `hooks/use-trigger.ts` 단일 진실. 충돌 해소됨.

---

### [INFO] 신규 exported 식별자 — 기존 코드베이스에 동명 식별자 없음

M-8 2단계가 새로 module export 로 승격한 식별자 목록과 기존 충돌 여부:

| 신규 식별자 | 파일 | 기존 동명 충돌 |
|---|---|---|
| `OverviewCard` | `cards/overview-card.tsx` | 없음 (기존 drawer 내 private 정의는 제거됨) |
| `ScheduleConfigurationCard` | `cards/schedule-config-card.tsx` | 없음 |
| `WebhookConfigCard` | `cards/webhook-config-card.tsx` | 없음 |
| `ExternalInteractionCard` | `cards/external-interaction-card.tsx` | 없음 |
| `ChatChannelCard` | `cards/chat-channel-card.tsx` | 없음 |
| `useTrigger` | `hooks/use-trigger.ts` | 없음 (다른 도메인 hook 과 이름 비겹침) |
| `useCardEditToggle` | `hooks/use-card-edit-toggle.ts` | 없음 |

모든 신규 exported 식별자가 `components/triggers/` 서브트리 안에서만 소비되며(`trigger-detail-drawer.tsx` 단독 import), 외부 도메인에 동명 식별자가 없음을 확인.

---

### [INFO] module-private 식별자 — 이전 god-component 내부 이름 그대로 파일 이동, 충돌 없음

`ChatChannelEditValues`, `ChatChannelEditForm`, `RotateBotTokenModal`, `LanguageHintsParseError`, `DEFAULT_RATE_LIMIT_PER_MINUTE`, `initialChatChannelEditValues` 는 이전 `trigger-detail-drawer.tsx` 의 private 심볼이었으며 `cards/chat-channel-card.tsx` 로 이동됐다. export 되지 않으므로 외부 식별자 공간에 영향 없음.

---

### [INFO] query key `["triggers"]` — 기존 용례와 일치

`use-trigger.ts` 의 `invalidate()` 는 `["triggers"]` 를 함께 invalidate 한다. 이 키는 기존 `triggers/page.tsx`(2곳)·`trigger-delete-dialog.tsx`(2곳)에서도 동일하게 사용 중이며 의미가 일치(트리거 목록 캐시). 충돌 없음.

---

### [INFO] 요구사항 ID — 신규 ID 없음, 기존 ID 재사용만

M-8 2단계는 순수 파일 분리 리팩토링이다. 새 요구사항 ID, 새 API endpoint, 새 SSE/Webhook 이벤트명, 새 ENV var, 새 spec 파일 경로 도입이 없다. spec/ 변경 0건.

---

## 요약

M-8 2단계 구현 완료(`trigger-detail-drawer.tsx` 1,537→65줄, `cards/` 5파일·`hooks/` 2파일 분리) 상태에서 신규 식별자 충돌을 전수 점검했다. impl-prep 에서 지적된 WARNING(`OverviewCard` 이중 정의)·INFO 2건(상수 중복, query key 이중 관리)은 모두 구현에서 해소됐음을 확인. 신규 exported 컴포넌트·hook 7종은 `components/triggers/` 서브트리 안에서만 소비되며 기존 코드베이스에 동명 충돌이 없다. API endpoint, 이벤트명, ENV var, spec 파일 경로 변경은 없으며, 요구사항 ID 신규 부여도 없다.

## 위험도

NONE
