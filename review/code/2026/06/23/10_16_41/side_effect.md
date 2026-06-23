# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `window.confirm` 직접 호출 — 테스트 가능성 제한
- 위치: `external-interaction-card.tsx` L851(`handleRotateSecret`), L863(`handleRevokeToken`); `webhook-config-card.tsx` L1559(`handleSaveClick`)
- 상세: 세 핸들러가 `window.confirm()`을 호출한다. 이는 브라우저 전역 객체에 직접 의존하는 부작용이다. 기능 자체는 의도된 동작이며 기존 코드에서 동일하게 사용되던 패턴이지만, jsdom 환경에서 항상 `false`를 반환하므로 이 경로를 커버하는 유닛 테스트 작성이 불가능하다.
- 제안: 현재 행동 변경 없음(behavior-preserving 리팩터 범위). 후속 단계에서 confirm 콜백을 prop으로 주입 가능한 구조로 교체 권장.

### [INFO] `useTrigger` hook — `invalidate` 함수가 매 렌더마다 재생성
- 위치: `hooks/use-trigger.ts` L1887–L1890
- 상세: `invalidate` 함수가 `useQuery` 호출 본체 안에서 매 렌더 시 새 참조로 생성된다. 현재 소비처(`TriggerDetailDrawer`)가 이를 `onSaved` prop으로 카드에 전달하므로, trigger 데이터가 변경될 때마다 카드의 `onSaved` prop 참조가 바뀐다. React 입장에서 카드가 불필요하게 re-render될 수 있다. 기존 inline 구현도 동일한 구조여서 새로운 부작용은 아니다.
- 제안: `useCallback`으로 감싸면 참조 안정성 확보 가능. 현재 단계에서는 behavior-preserving 이므로 비차단.

### [INFO] `ChatChannelCard` edit 취소 시 `saveMutation.reset()` 호출
- 위치: `chat-channel-card.tsx` L461–L467(`handleCancel`)
- 상세: `cancelEdit` 콜백 안에서 `saveMutation.reset()`을 명시적으로 호출한다. 이는 TanStack Query 내부 캐시 상태(`isPending`, `isError`, `error`)를 부작용으로 초기화한다. 의도된 동작이며(주석에도 명시), 다른 카드들도 동일 패턴을 권장하나 `WebhookConfigCard.handleCancel`에는 `updateMutation.reset()` 호출이 없다. 일관성 부재로 webhook 카드에서 cancel 후 이전 오류 상태가 잔류할 수 있다.
- 제안: `WebhookConfigCard.handleCancel`에도 `updateMutation.reset()` 추가 권장.

### [INFO] `RotateBotTokenModal` — `value` state가 모달 닫힘 후에도 잔류
- 위치: `chat-channel-card.tsx` L280–L339(`RotateBotTokenModal`)
- 상세: 모달 컴포넌트가 `rotateOpen` 조건으로 조건부 렌더링(`{rotateOpen ? <RotateBotTokenModal .../> : null}`)된다. React에서 조건부 렌더링이 `false`로 전환되면 컴포넌트가 언마운트되어 내부 `value` state가 소거된다. 이는 의도된 동작이다. 단, `onClose` 핸들러에서 `rotateMutation.reset()` 호출은 있으나 `setRotateOpen(false)` 직전에 수행하므로 순서가 명확하다. 문제 없음.
- 제안: 없음(확인용 INFO).

### [INFO] `useCardEditToggle` — `setEditing` 직접 노출
- 위치: `hooks/use-card-edit-toggle.ts` L1818–L1828
- 상세: 훅이 `editing`, `setEditing`, `startEdit`, `cancelEdit`을 모두 노출한다. `setEditing`을 직접 노출하면 `cancelEdit`의 `onReset` 콜백을 우회하여 입력 버퍼를 리셋하지 않고 편집 상태만 종료할 수 있다. 실제 소비처인 `OverviewCard`와 `ChatChannelCard`의 `onSuccess` 핸들러 안에서 `setEditing(false)`를 직접 호출하고 있는데, 이 경로는 저장 성공 후 정상 종료이므로 리셋이 불필요하다. 의도적 설계이나, 향후 유지보수 시 `cancelEdit` 대신 `setEditing(false)`를 실수로 사용할 수 있다.
- 제안: 저장 성공 경로 전용 `commitEdit()` API 추가 고려(후속 단계).

---

## 요약

이번 변경은 `trigger-detail-drawer.tsx`(1,537줄)의 god-component를 5개 카드 파일과 2개 훅으로 behavior-preserving 분리한 순수 구조 리팩터다. 전역 변수 신규 도입 없음. 공개 API(`TriggerDetailDrawer`, dialogs)의 시그니처·props 무변. 네트워크 호출 경로·인증 게이트(`useHasRole`)·QueryClient invalidate 키 모두 동일하게 보존되어 있다. `window.confirm` 호출 3건은 기존 동작을 그대로 이전한 것이며 신규 부작용이 아니다. `WebhookConfigCard.handleCancel`에서 `updateMutation.reset()` 누락은 오류 상태 잔류를 일으킬 수 있는 경미한 일관성 결함이나, 렌더 사이클을 넘어 오류 배지가 노출되는 UX 문제로 제한되어 데이터 무결성에는 영향이 없다. 전체적으로 의도치 않은 부작용은 없다.

## 위험도

LOW
