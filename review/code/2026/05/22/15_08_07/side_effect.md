# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] React Query 캐시 키 `"trigger-history"` 제거 — 기존 캐시 무해
- 위치: `trigger-detail-drawer.tsx` — 제거된 `useQuery` (`queryKey: ["trigger-history", triggerId]`)
- 상세: `["trigger-history", triggerId]` 캐시 키를 사용하는 쿼리가 drawer에서 제거되었다. 동일 키를 사용하는 다른 컴포넌트(호출 이력 Dialog)가 존재하면 캐시가 공유되지만, 이 변경은 쓰기(write)가 아닌 구독(read) 제거이므로 다른 구독자에게 영향을 미치지 않는다. 단, drawer 닫힘 시 history 쿼리의 `enabled: !!triggerId && open` 가드가 사라지므로 별도 Dialog가 이 캐시를 독립적으로 관리하게 된다.
- 제안: 이슈 없음. `invalidateAfterSave`는 `["trigger-detail", ...]`과 `["triggers"]`만 무효화하므로 `["trigger-history"]` 캐시는 영향받지 않는다. 의도한 동작.

### [INFO] `TriggerHistoryEntry` 인터페이스 삭제 — 파일 로컬 타입, 외부 노출 없음
- 위치: `trigger-detail-drawer.tsx` lines 98–102 (삭제)
- 상세: `TriggerHistoryEntry`는 파일 내부 전용 인터페이스(export 없음)이므로 다른 모듈에서 import하는 경우가 없다. 삭제로 인한 타입 충격 없음.
- 제안: 이슈 없음.

### [INFO] i18n 딕셔너리에 신규 키 15개 추가 — 기존 키 변경 없음
- 위치: `en/triggers.ts`·`ko/triggers.ts` — `triggers.detail.*` 11개, `triggers.externalInteraction.*` 4개 추가
- 상세: 기존 키는 전혀 수정되지 않고 새 키만 삽입되었다. 딕셔너리 파일은 module-level const export이므로 추가 키는 기존 소비자에게 불가시적이며 트리 셰이킹에도 영향을 주지 않는다.
- 제안: 이슈 없음. KO/EN parity 확인 완료(15개 키 양쪽 동수 추가).

### [INFO] `useT()` 훅 호출 위치 변경 — `TriggerDetailDrawer` 컴포넌트 최상단으로 이동
- 위치: `trigger-detail-drawer.tsx` line 111 (`const t = useT();` 신규 추가)
- 상세: 이전 코드에서 `TriggerDetailDrawer` 함수 본체에 `useT()` 호출이 없었으나 이번에 추가되었다. 서브컴포넌트(`OverviewCard`, `WebhookConfigCard` 등)는 이미 각자 `useT()`를 호출하고 있었다. React Hook 규칙(조건/반복 외부 최상단 호출)이 준수되었다.
- 제안: 이슈 없음.

### [INFO] `spec/2-navigation/2-trigger-list.md` 필드 권한 매트릭스에 `Recent Calls` 행 잔존
- 위치: `spec/2-navigation/2-trigger-list.md` line 2570 (`| Recent Calls | (목록) | read-only | ...`)
- 상세: §2.3.1 필드 권한 매트릭스 표에 `Recent Calls` 행이 여전히 남아 있다. §2.3 섹션 표와 R-6/R-7 Rationale에서는 호출 이력이 drawer에 포함되지 않음을 명시했으나, 매트릭스 행 자체는 삭제되지 않았다. 이는 코드 부작용이 아닌 spec 불일치이지만, 향후 참조 혼란의 소지가 있다.
- 제안: 해당 행(`| Recent Calls | (목록) | read-only | ...`)을 매트릭스에서 제거하거나 "drawer 제거, Dialog로 분리" 주석을 추가할 것을 권장한다.

### [INFO] `navigator.clipboard.writeText` 호출 — 의도된 클립보드 부작용
- 위치: `WebhookConfigCard.copyText()`, `ExternalInteractionCard.copyText()`
- 상세: 변경 전후 모두 존재하던 로직이다. i18n 키 교체만 이루어졌으며, clipboard 쓰기 동작 자체는 변경되지 않았다.
- 제안: 이슈 없음.

### [INFO] `window.confirm()` 호출 — 변경 전후 동일 동작
- 위치: `WebhookConfigCard.handleSaveClick()`, `ExternalInteractionCard.handleRotateSecret()`, `ExternalInteractionCard.handleRevokeToken()`
- 상세: 이들 `window.confirm()` 호출은 이번 PR에서 도입된 것이 아니라 기존에 존재하던 코드다. 변경이 없으므로 추가 부작용 없음.
- 제안: 이슈 없음.

---

## 요약

이번 변경은 (1) drawer의 `useQuery<TriggerHistoryEntry[]>` history 쿼리 및 관련 블록 제거, (2) 하드코딩 영문 라벨을 `t()` 호출로 교체, (3) i18n 딕셔너리 KO/EN 각 15개 키 추가로 구성된다. 제거된 `useQuery`는 파일 로컬 캐시 키(`["trigger-history"]`)를 읽기 전용으로 구독한 것으로, 삭제가 외부 캐시 상태를 변경하지 않는다. i18n 키는 기존 키를 수정하지 않고 순수 추가(additive)이므로 기존 소비자에게 충돌이 없다. 함수·메서드 시그니처, 공개 export, 환경 변수, 네트워크 호출(의도 외), 이벤트/콜백 바인딩 모두 변경 없다. 유일한 주의 사항은 `spec/2-navigation/2-trigger-list.md` §2.3.1 권한 매트릭스의 `Recent Calls` 행이 잔존한 spec 불일치이나, 이는 런타임 부작용이 아닌 문서 정합성 이슈다.

## 위험도

NONE
