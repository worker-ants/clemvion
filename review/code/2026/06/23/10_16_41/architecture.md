# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] god-component 분해 성공 — SRP 획득
- 위치: `trigger-detail-drawer.tsx` (1,537줄 → 65줄)
- 상세: 단일 파일에 혼재했던 5개 카드 컴포넌트, 2개 커스텀 훅, 데이터 fetch 로직이 `cards/` + `hooks/` 레이어로 분리됐다. 각 카드가 단일 도메인(overview/schedule/webhook/eia/chat-channel)만 담당하는 SRP 적합 구조가 됐다.
- 제안: 현행 유지.

### [INFO] 레이어 책임 분리 양호 — 데이터/뷰 경계 명확
- 위치: `hooks/use-trigger.ts`, `hooks/use-card-edit-toggle.ts`
- 상세: `useTrigger`가 데이터 레이어(query + invalidate)를, `useCardEditToggle`이 UI 상태 레이어(edit toggle)를 담당하며 두 훅이 서로 의존하지 않는다. Drawer는 카드 조립과 라우팅만 보유해 프레젠테이션/비즈니스/데이터 3레이어 경계가 뚜렷하다.
- 제안: 현행 유지.

### [WARNING] `ChatChannelCard` 내 비즈니스 로직 과밀 — 부분적 SRP 위반
- 위치: `cards/chat-channel-card.tsx` (615줄)
- 상세: 단일 파일에 `ChatChannelCard`(메인 카드) + `ChatChannelEditForm`(편집 폼) + `RotateBotTokenModal`(모달) + `parseLanguageHints`(파싱 유틸) + `initialChatChannelEditValues`(초기화 유틸) + `DEFAULT_RATE_LIMIT_PER_MINUTE`(상수)가 공존한다. `RotateBotTokenModal`은 사용자 인터랙션과 자체 로컬 상태(`value`)를 가지며 독립 컴포넌트로서 파일 분리의 자연 경계가 존재한다. 다른 4개 카드(overview: 162줄, schedule: 65줄, webhook: 284줄, eia: 384줄)와 비교해 chat-channel이 2~9배 크다. 현재는 모두 module-private이라 외부 결합도 문제는 없으나, 내부 응집도 면에서 파일 크기가 단일 책임을 넘어선다.
- 제안: `RotateBotTokenModal`을 `cards/rotate-bot-token-modal.tsx`(또는 `cards/chat-channel/`)로 분리하고, `parseLanguageHints`/`initialChatChannelEditValues`를 `lib/utils/chat-channel.ts`로 이동하는 것을 후속 리팩토링으로 계획할 것. 이번 PR 범위(behavior-preserving)에서 강제할 필요는 없다.

### [WARNING] `ExternalInteractionCard` 내 `window.confirm` 직접 호출 — 테스트 불가 패턴
- 위치: `cards/external-interaction-card.tsx:851, 864`
- 상세: `handleRotateSecret`과 `handleRevokeToken`이 `window.confirm()`을 직접 호출한다. 이는 프레젠테이션 레이어에서 브라우저 전역을 직접 사용하는 안티패턴으로, 단위 테스트 시 JSDOM에서 `window.confirm`을 모킹해야 하거나 테스트가 불가하다. `WebhookConfigCard`의 `handleSaveClick`도 동일 패턴(`window.confirm`)을 사용한다(`webhook-config-card.tsx:1559`). confirm 대화상자 대신 inline 확인 UI(컴포넌트 내부 confirm 상태) 또는 `useConfirm` 추상 훅으로 분리해야 한다.
- 제안: `useConfirm` 훅 또는 confirm dialog 컴포넌트를 도입해 브라우저 전역 의존성을 주입 가능한 형태로 역전시킨다. 이번 behavior-preserving PR에서는 defer 가능하나 테스트 커버리지 확장 전 반드시 처리해야 한다.

### [INFO] `onSaved` 콜백 계약 — 암묵적 인터페이스 공유
- 위치: 모든 5개 카드 컴포넌트
- 상세: 모든 카드가 `{ trigger: TriggerDetail; onSaved: () => void }` 형태의 props 계약을 공유한다. 이 계약이 타입으로 명시되지 않고 각 카드마다 inline 선언된다. 인터페이스 분리(ISP) 측면에서 `ScheduleConfigurationCard`는 `onSaved`가 없어(read-only) 카드별 인터페이스가 이미 분리돼 있으나, 공통 패턴을 `CardProps` 타입으로 추출하면 향후 추가 카드 작성 시 계약 드리프트를 방지할 수 있다.
- 제안: `cards/_types.ts`에 `interface EditableCardProps { trigger: TriggerDetail; onSaved: () => void; }`를 선언하고 편집 가능 카드들이 이를 implement하도록 한다. 낮은 우선순위.

### [INFO] `useTrigger`의 `invalidate`가 함수 참조로 매 렌더 재생성
- 위치: `hooks/use-trigger.ts:7-10`
- 상세: `invalidate` 함수가 훅 본체에 인라인 정의되어 렌더마다 새 참조를 생성한다. Drawer가 이를 `onSaved={invalidate}` 형태로 카드 props에 전달하므로, 카드가 React.memo로 감싸지면 매 렌더마다 불필요한 리렌더를 유발할 수 있다. 현재는 memo 미사용이라 실질 문제 없으나, 추후 성능 최적화 시 `useCallback` 처리가 필요하다.
- 제안: `const invalidate = useCallback(() => { ... }, [queryClient, triggerId])` 패턴으로 메모이제이션. 현재는 INFO 수준.

### [INFO] 모듈 경계 명확 — `cards/` 폴더의 index 배럴 미존재
- 위치: `codebase/frontend/src/components/triggers/cards/`
- 상세: 5개 카드가 개별 파일로 분리됐으나 `index.ts` 배럴 없이 `trigger-detail-drawer.tsx`에서 각각 직접 import된다. 현 규모에서는 문제 없으나, 카드 수가 증가하거나 다른 컴포넌트에서 카드를 재사용할 경우 import 경로 관리가 번거로워진다.
- 제안: `cards/index.ts` 배럴을 추가해 단일 진입점을 제공하는 것을 고려. 옵션 수준.

### [INFO] `TYPE_BADGE_STYLES` 상수 — cards 내부에서만 사용됨에도 잠재 중복 가능성
- 위치: `cards/overview-card.tsx:1174`
- 상세: consistency-check W-2/I-9 에서 이미 지적됐으나, 현재 구현에서 `trigger-detail-drawer.tsx`의 `TYPE_BADGE_STYLES` 정의가 삭제됐으므로 중복은 해소됐다(diff 확인 기준). `overview-card.tsx`가 단일 소스가 됐으므로 현재는 문제없다. 다른 컴포넌트에서 동일 스타일 맵이 필요해지면 `cards/_shared.ts`로 추출한다.
- 제안: 현행 유지. 재사용 필요 시 `_shared.ts` 추출.

### [INFO] 순환 의존성 없음
- 위치: 전체 변경 범위
- 상세: `cards/*.tsx` → `hooks/use-card-edit-toggle.ts`, `hooks/use-trigger.ts` → `lib/api/triggers.ts` 방향 단방향 의존성만 존재. `trigger-detail-drawer.tsx` → `cards/*` → `hooks/*` → `lib/api/*` 단방향 계층이 유지된다. 순환 참조 없음.

---

## 요약

이번 리팩토링은 1,537줄 god-component를 5 카드 + 2 훅 + 65줄 thin wrapper로 분해해 SRP와 레이어 책임 분리를 성공적으로 달성했다. `useTrigger`(데이터) / `useCardEditToggle`(UI 상태) 훅 분리와 `cards/` 폴더 구성이 모듈 경계를 명확히 했으며, behavior-preserving 제약 하에서 이루어진 추출이라 기존 테스트가 무수정 통과한 점도 아키텍처 안전성을 뒷받침한다. 남은 주요 아키텍처 관심사는 `ChatChannelCard`(615줄)의 내부 과밀과 `window.confirm` 직접 호출로 인한 테스트 어려움 두 가지이며, 전자는 후속 PR에서 분리 가능하고 후자는 테스트 커버리지 확장 전 처리가 필요하다. 전체적으로 아키텍처 품질이 유의미하게 개선됐다.

## 위험도

LOW
