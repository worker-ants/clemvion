# Testing Review

## 발견사항

### useCopyToClipboard 훅 테스트 (파일 3, 4)

- **[INFO]** `navigator.clipboard` 미지원 환경 테스트 누락
  - 위치: `codebase/frontend/src/lib/hooks/__tests__/use-copy-to-clipboard.test.tsx`
  - 상세: `navigator.clipboard` 자체가 `undefined`인 환경(구형 브라우저, 비 HTTPS 컨텍스트)에 대한 테스트가 없다. 훅 구현은 `navigator.clipboard.writeText`에 직접 접근하므로, clipboard API가 없으면 TypeError가 발생해 `catch` 블록도 통과하지 못할 수 있다. 현재 `try/catch`로 감싸져 있으므로 `TypeError`는 잡히지만, `Object.assign(navigator, { clipboard: { writeText } })` 방식의 mock이 불변 프로퍼티를 override하는 방식이어서 환경에 따라 동작이 달라질 수 있다.
  - 제안: `navigator.clipboard`가 `undefined`인 경우 `false`를 반환하고 error toast를 표시하는 테스트 케이스를 추가한다.

- **[INFO]** `beforeEach`가 `describe` 블록 바깥에 배치됨
  - 위치: `use-copy-to-clipboard.test.tsx` 라인 30-35
  - 상세: `beforeEach`가 `describe` 블록 외부에 선언되어 있다. 현재 파일에는 단일 `describe`만 존재하므로 동작에는 문제 없지만, 향후 다른 `describe` 블록이 추가될 경우 의도치 않은 공유 setup이 될 수 있어 테스트 격리 원칙에 어긋난다.
  - 제안: `beforeEach`를 `describe("useCopyToClipboard", ...)` 블록 내부로 이동한다.

### TriggerDetailDrawer 테스트 (파일 1)

- **[INFO]** `viewer` 역할에서 편집 버튼 미노출 검증 테스트 누락
  - 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-detail-drawer.test.tsx`
  - 상세: `setRole("editor")`가 `beforeEach`에서 항상 설정되어 `viewer` 역할에서 Edit 버튼이 노출되지 않아야 함을 검증하는 테스트가 없다. `useHasRole("editor")`에 의존하는 UI 분기(OverviewCard, WebhookConfigCard, ExternalInteractionCard의 편집 버튼)가 존재하므로, 권한 없는 역할에서의 렌더 결과도 커버되어야 한다.
  - 제안: `setRole("viewer")`로 설정한 후 Edit 버튼이 없음을 검증하는 테스트 케이스를 추가한다.

- **[INFO]** `manual` 타입 트리거에 대한 렌더 테스트 누락
  - 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-detail-drawer.test.tsx`
  - 상세: `TriggerDetail.type`은 `"webhook" | "schedule" | "manual"` 세 값을 가지지만 테스트는 `webhook`과 `schedule`만 커버한다. `manual` 타입은 어떤 카드도 렌더하지 않으므로, 이에 대한 명시적 테스트가 없으면 향후 `manual` 타입에 카드가 추가될 때 회귀를 잡기 어렵다.
  - 제안: `type: "manual"` 트리거를 mock하여 카드가 하나도 렌더되지 않음을 확인하는 테스트 케이스를 추가한다.

- **[INFO]** `ExternalInteractionCard` 저장 성공/실패 경로 테스트 누락
  - 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-detail-drawer.test.tsx`
  - 상세: 이번 변경의 핵심인 `ExternalInteractionCard.handleSave` → `useMutation` 교체(W3)에 대해, 저장 성공 시 편집 모드 종료와 `onSaved` 호출, 실패 시 에러 toast 노출을 검증하는 테스트가 신설 파일에 포함되지 않았다. 편집 모드 진입 및 저장 인터랙션 자체가 테스트되지 않는다.
  - 제안: EIA 카드의 Edit 버튼 클릭 → 저장 버튼 클릭 → API 성공/실패 각각을 검증하는 시나리오 테스트를 추가한다.

- **[INFO]** `open=false → open=true` 전환 후 쿼리 재실행 검증 누락
  - 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-detail-drawer.test.tsx`
  - 상세: Case 1의 `open=false` 테스트는 초기 렌더에서 API가 호출되지 않음만 확인한다. Drawer를 닫은 후 다시 열 때 쿼리가 재실행되는지 검증하는 테스트가 없다. `enabled: !!triggerId && open` 조건의 동적 전환이 실제 UX에서 중요하다.
  - 제안: 동일 `QueryClient` 인스턴스에서 `open`을 `false → true`로 업데이트했을 때 API가 다시 호출되는지 확인하는 테스트를 추가하는 것을 권장한다(optional).

- **[WARNING]** `webhookTitle.parentElement!` non-null assertion — 취약한 DOM 접근
  - 위치: `trigger-detail-drawer.test.tsx` 라인 494
  - 상세: `webhookTitle.parentElement!`로 CardHeader를 가정하지만, DOM 구조가 변경되면(예: CardTitle을 감싸는 wrapper가 추가되면) `within(webhookHeader).getByRole("button", { name: "Edit" })`이 버튼을 찾지 못해 테스트가 깨진다. 구현 상세에 결합된 취약한 셀렉터이며 향후 컴포넌트 구조 변경 시 false negative를 유발할 수 있다.
  - 제안: Edit 버튼에 `data-testid="webhook-edit-btn"` 같은 명시적 test ID를 부여하거나 `aria-label`을 통해 더 안정적으로 접근하는 방식을 사용한다.

### trigger-detail-drawer.tsx 구현의 테스트 용이성 (파일 2)

- **[INFO]** `ChatChannelCard`는 수동 `saving` 상태 관리 유지 — 테스트 패리티 없음
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `ChatChannelCard` 컴포넌트
  - 상세: 이번 변경에서 `ExternalInteractionCard`는 `useMutation`으로 교체되었지만, `ChatChannelCard`는 여전히 수동 `saving` state와 try/catch 패턴을 유지한다. 이 컴포넌트의 저장 로직에 대한 단위 테스트도 존재하지 않는다. 일관성 없는 패턴은 테스트 일관성에도 영향을 준다.
  - 제안: `ChatChannelCard`도 `useMutation`으로 리팩토링하여 패턴을 통일하고 해당 저장 경로에 대한 테스트를 추가한다(별도 PR 가능).

- **[INFO]** `window.confirm` 직접 호출 — 테스트 환경에서 mock 필요
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `WebhookConfigCard.handleSaveClick`, `ExternalInteractionCard.handleRotateSecret`, `ExternalInteractionCard.handleRevokeToken`
  - 상세: `window.confirm`을 직접 호출하는 코드가 여러 곳에 있다. 테스트 환경에서 `window.confirm`은 기본적으로 `false`를 반환하거나 JSDOM에서 구현되지 않을 수 있다. 현재 신설 테스트 파일에는 이 경로에 대한 테스트가 없으며, 향후 이 경로를 테스트하려면 `vi.spyOn(window, 'confirm')`이 필요하다.
  - 제안: confirm 로직을 테스트하는 케이스 추가 시 `vi.spyOn(window, 'confirm').mockReturnValue(true/false)`를 활용하도록 가이드한다.

## 요약

이번 변경은 `useCopyToClipboard` 훅과 `TriggerDetailDrawer` 단위 테스트를 신설하여 테스트 커버리지를 의미 있게 확충했다. 훅 테스트는 성공/실패/참조 안정성의 핵심 경로를 정확히 커버하고, 드로어 테스트는 조건부 렌더링, notFound, Recent Calls 회귀 가드, AuthConfig 표시, 활성 배지 등 주요 UI 분기를 잘 검증한다. 다만 `viewer` 역할 분기, `manual` 타입 트리거, `ExternalInteractionCard` 저장 인터랙션에 대한 테스트 공백이 있고, DOM 접근 방식 일부가 구현 상세에 결합되어 취약하다. `ChatChannelCard`의 저장 로직은 테스트되지 않고 구식 패턴을 유지하고 있어 향후 관리 부담이 될 수 있다. 전반적으로 테스트 신설이 이전 대비 명확한 개선이며, 발견된 사항들은 대부분 INFO 수준의 보완 사항이다.

## 위험도

LOW
