# Testing Review — M-8 2단계 trigger-detail-drawer 카드 파일 분리 + hooks

## 발견사항

### **[INFO]** 신규 파일에 대한 전용 단위 테스트 없음 (허용 가능)
- 위치: `cards/` 5파일, `hooks/use-card-edit-toggle.ts`, `hooks/use-trigger.ts`
- 상세: 신규 생성된 7개 파일(`overview-card.tsx`, `schedule-config-card.tsx`, `webhook-config-card.tsx`, `external-interaction-card.tsx`, `chat-channel-card.tsx`, `use-card-edit-toggle.ts`, `use-trigger.ts`) 에 대한 독립 테스트 파일이 존재하지 않는다. 그러나 이 변경은 동작 보존(behavior-preserving) 리팩터링으로, 기존 `trigger-detail-drawer.test.tsx` 가 5 suites / 54 tests 를 통해 public surface 를 통한 통합 커버를 유지하고 있다. 커밋 메시지도 "기존 트리거 테스트 무수정 통과" 를 명시한다.
- 제안: 현 단계에서 차단 사유는 아니다. 다만 향후 카드 단위 로직이 복잡해질 경우(예: `parseLanguageHints`, `initialChatChannelEditValues` 순수 함수) 카드별 단위 테스트를 별도로 추가하면 회귀 감지 정밀도가 높아진다.

### **[INFO]** `parseLanguageHints` 순수 함수 — 단위 테스트 미존재
- 위치: `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 115-141줄
- 상세: `parseLanguageHints` 는 빈 문자열 → `undefined`, 잘못된 JSON → `LanguageHintsParseError`, non-object(배열/null/스칼라) → `LanguageHintsParseError`, 유효한 `Record<string,string>` → 변환 반환의 4가지 경로를 가진 순수 함수다. 현재 통합 테스트가 "잘못된 JSON 케이스" 하나만(`{ not valid json` 입력) 를 통합 경로로 커버한다. 나머지 경로(빈 입력, 배열 입력, null 입력, 값이 non-string인 경우)는 테스트 갭이다.
- 제안: `parseLanguageHints` 를 파일 내에서 export 하거나, 별도 유틸 파일로 추출한 뒤 단위 테스트를 추가하면 회귀 방지력이 높아진다.

### **[INFO]** `useCardEditToggle` hook — 독립 단위 테스트 미존재
- 위치: `codebase/frontend/src/components/triggers/hooks/use-card-edit-toggle.ts`
- 상세: 로직이 매우 단순(15줄)하고 `renderHook` 으로 쉽게 커버 가능하다. `cancelEdit(onReset)` 에서 onReset이 호출된 뒤 `editing = false` 가 되는 순서, `onReset` 이 undefined 일 때 오류 없이 진행되는지, `startEdit` 후 `editing = true` 확인 등 3가지 경로가 있다. 현재는 통합 테스트가 간접적으로 커버하지만 hook 자체의 독립 테스트는 없다.
- 제안: `renderHook` 기반 3-case 단위 테스트를 `hooks/__tests__/use-card-edit-toggle.test.ts` 에 추가하면 hook 계약이 명확히 문서화된다. 필수는 아니지만 hook 재사용(4카드 공유) 범위를 감안하면 가치 있다.

### **[INFO]** `useTrigger` hook — `triggerId = null` 인데 `queryFn` 호출 시 타입 강제 캐스팅
- 위치: `codebase/frontend/src/components/triggers/hooks/use-trigger.ts` 4줄
- 상세: `queryFn: () => triggersApi.getById(triggerId as string)` 에서 `triggerId` 가 `null` 일 때 `enabled: !!triggerId` 가 false 이므로 실제로는 호출되지 않는다. 하지만 이 조합(enabled 가드 + null 캐스팅)에 대한 명시적 테스트가 없어 `enabled` 조건 제거 시 조용히 깨질 수 있다. 기존 `trigger-detail-drawer.test.tsx` 의 "triggerId=null 이면 API 를 호출하지 않는다" 케이스가 통합 수준에서 이 동작을 커버하고 있어 현재 위험도는 낮다.
- 제안: hook 단위 테스트 추가 시 `triggerId=null + open=true` → API 미호출 케이스를 명시 포함할 것.

### **[INFO]** `ExternalInteractionCard.handleRotateSecret` / `handleRevokeToken` — `window.confirm` 의존으로 테스트 격리 어려움
- 위치: `codebase/frontend/src/components/triggers/cards/external-interaction-card.tsx` 850-872줄
- 상세: `handleRotateSecret` 과 `handleRevokeToken` 양쪽이 `window.confirm(...)` 을 직접 호출한다. 통합 테스트 환경(jsdom)에서 `window.confirm` 은 기본적으로 `false` 를 반환하므로, 이 경로를 테스트하려면 `vi.spyOn(window, 'confirm').mockReturnValue(true)` 를 개별 테스트마다 설정해야 한다. 현재 테스트에는 rotate/revoke 경로 커버가 없다. 이 패턴은 동일 파일 `trigger-detail-drawer.test.tsx` 의 EIA 저장 성공/실패 케이스와 대칭적으로 누락된 케이스다.
- 제안: rotate 성공/실패, revoke 성공/실패(per_trigger 전략 전제) 4 케이스를 `trigger-detail-drawer.test.tsx` 에 추가하거나, 향후 카드별 테스트 파일에서 커버. 단기적으로 `window.confirm` mock 스피 패턴을 테스트 헬퍼로 추상화하면 재사용성이 높아진다.

### **[INFO]** `ChatChannelCard` RotateBotToken 경로 테스트 미존재
- 위치: `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 447-459줄
- 상세: `rotateMutation` 성공/실패, `RotateBotTokenModal` 열림/닫힘, 확인 버튼 비활성화(빈 입력) 동작에 대한 테스트가 없다. 기존 테스트는 ChatChannelCard 에 대해 languageHints JSON 파싱 오류 1케이스만 커버한다.
- 제안: rotate 성공 → toast + 모달 닫힘 + onSaved 호출, rotate 실패 → error toast 유지, 빈 토큰으로 확인 버튼 비활성화 3케이스 추가를 권장. 필수 차단 사유는 아니다.

### **[INFO]** `OverviewCard` `saveDisabled` 경계값 로직 테스트 미존재
- 위치: `codebase/frontend/src/components/triggers/cards/overview-card.tsx` 1211-1214줄
- 상세: `saveDisabled` 는 (1) 뮤테이션 pending, (2) 이름 공백/빈 값, (3) 이름 미변경 세 조건의 OR 다. 현재 테스트는 이 중 어느 경계값도 명시적으로 검증하지 않는다(편집 모드 진입 자체 테스트만 있음).
- 제안: 빈 이름 입력 시 Save 버튼 비활성화, 원본 이름 재입력 시 Save 버튼 비활성화 케이스를 추가하면 명세가 강화된다.

## 요약

이번 변경은 1,537줄 god-component 를 5 카드 + 2 hooks 로 행동 보존(behavior-preserving) 추출한 순수 리팩터링이다. 기존 `trigger-detail-drawer.test.tsx` (5 suites / 54 tests) 가 public surface 를 통해 주요 경로를 커버하며 무수정 통과하고 있어 회귀 위험은 낮다. 그러나 분리된 신규 파일 7개(`cards/` 5개 + `hooks/` 2개)에 대한 전용 테스트 파일이 없으므로, 카드별 로직(특히 `parseLanguageHints` 순수 함수, `useCardEditToggle` hook, rotate/revoke 비동기 경로)이 장기적으로 통합 테스트만으로 커버되는 구조가 된다. `window.confirm` 에 의존하는 EIA rotate/revoke 경로와 ChatChannel RotateBotToken 경로는 현재 전혀 테스트되지 않으며, 이 두 경로는 향후 우선 보완이 권장된다. 전반적으로 behavior-preserving 리팩터링의 특성상 차단 사유는 없으나, 추출된 카드/hook 단위의 독립 테스트를 후속 작업으로 계획하는 것이 적절하다.

## 위험도

LOW

STATUS: SUCCESS
