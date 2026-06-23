# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: chat-channel-card.tsx

- **[INFO]** 컴포넌트 내부 함수 정의 위치 불일치 — `providerLabel`, `visualNodeLabel`, `formModeLabel` 세 헬퍼가 `ChatChannelCard` 컴포넌트 body 안에 함수 선언으로 정의됨. 매 렌더마다 재생성되며, 파일 최상단의 `initialChatChannelEditValues`·`parseLanguageHints` 는 모듈 스코프에 있어 일관성이 없음.
  - 위치: `chat-channel-card.tsx` L385–402
  - 상세: 세 헬퍼는 컴포넌트 state/props 에 의존하지 않으므로 모듈 스코프 순수함수로 이동 가능. 현재는 같은 파일 내 동급 헬퍼들과 배치 방식이 다름.
  - 제안: 모듈 스코프로 이동하거나, 세 함수를 `useCallback` 없이 컴포넌트 외부에 추출.

- **[INFO]** 매직 넘버 `min={1}`, `max={600}` — Input 제약값이 JSX 인라인으로만 존재하며 상수 이름 없음.
  - 위치: `chat-channel-card.tsx` L219–220 (`ChatChannelEditForm`)
  - 상세: `DEFAULT_RATE_LIMIT_PER_MINUTE = 60` 은 상수화됐으나 상·하한값은 처리 없음. 백엔드 스펙 변경 시 한 곳만 수정하면 되도록 명시적 이름이 있으면 좋음.
  - 제안: `const RATE_LIMIT_MIN = 1; const RATE_LIMIT_MAX = 600;` 을 모듈 상단에 추가.

- **[INFO]** `RotateBotTokenModal` 이 파일 내 private 컴포넌트로 존재하나, 동일 파일의 `ChatChannelEditForm` 과 달리 자체 `useState` 를 갖는 실질적인 Dialog 컴포넌트임. 향후 디자인 시스템 Dialog 로 교체 시 추적이 어려울 수 있음.
  - 위치: `chat-channel-card.tsx` L280–339
  - 상세: 기능적 문제는 없으나, 프로젝트의 다른 모달이 `@/components/ui/dialog`를 쓰는 패턴과 달리 `fixed inset-0` raw div 로 구현됨. 일관성 관점의 INFO.
  - 제안: 향후 dialog 리팩 시 교체 후보로 플랜에 메모. 현재 상태는 기능 동일하므로 즉시 변경 불필요.

- **[INFO]** `botIdentity` 분기 블록이 `<> ... </> : <> ... </>` 형태로 동일한 `dt`(`botIdentity`)를 두 번 렌더링함. 빈 경우에도 레이블을 표시한다는 의도이나, 불필요한 코드 중복.
  - 위치: `chat-channel-card.tsx` L546–569
  - 상세: `dt` 는 양 분기에서 동일. `dd` 만 조건 분기하면 코드 5~6줄 절약.
  - 제안: `<dt>` 를 조건 밖으로 추출, `<dd>` 만 삼항 처리.

---

### 파일 2: external-interaction-card.tsx

- **[WARNING]** `ExternalInteractionCard` 컴포넌트가 두 가지 독립적인 관심사(Notification + Interaction)를 하나의 컴포넌트/edit 폼 안에서 관리하며 edit state 변수가 4개(`urlValue`, `eventsValue`, `interactionEnabled`, `strategy`)임. 이 파일은 파일 분리 이전 god-component 패턴의 잔재 단면을 유지하고 있음.
  - 위치: `external-interaction-card.tsx` L784–793 (state 선언부)
  - 상세: M-8 리팩의 목표인 단일 책임에서 ExternalInteraction 카드만 여전히 복수 도메인(Webhook 알림 + 외부 상호작용 토큰)을 담당함. 이번 PR 범위(behavior-preserving)에서는 의도된 상태이나, 향후 분리 시 이 파일이 우선 대상.
  - 제안: 현재는 허용. 후속 이슈로 `NotificationCard`/`InteractionCard` 분리 계획 기록 권장.

- **[INFO]** `handleRotateSecret`/`handleRevokeToken` 이 `async function` 으로 직접 에러를 catch 하는 패턴인데, 같은 파일의 `saveMutation`은 `useMutation` 패턴을 사용해 에러 처리 방식이 비일관적임.
  - 위치: `external-interaction-card.tsx` L850–872
  - 상세: rotate/revoke 는 1회성 결과(secret/token) 수신 후 상태에 저장해야 해서 `mutationFn` 반환값이 필요하므로 `try/catch async` 패턴을 선택한 것으로 보임. 의도적인 선택이나, 코드 읽는 사람이 왜 일관성이 없는지 주석 없이는 파악하기 어려움.
  - 제안: 짧은 인라인 주석 추가: `// rotate/revoke 는 결과 secret 을 직접 캡처해야 해서 useMutation 대신 async 직접 호출`.

---

### 파일 3: overview-card.tsx

- **[INFO]** `startEdit` 함수가 `useCardEditToggle` 의 `startEdit` 을 쓰지 않고 로컬 재정의됨 (`setNameValue(trigger.name); setEditing(true)`). 이는 hook의 `startEdit` 이 추가 초기화 없이 단순 `setEditing(true)` 만 하기 때문인데, 사용처에서 hook 반환 `startEdit` 을 무시하고 동명 로컬 함수를 선언해 잠재적 혼선.
  - 위치: `overview-card.tsx` L1206–1209
  - 상세: `useCardEditToggle`에서 `startEdit` 을 destructure 하지 않고, 로컬에서 `setEditing` 을 직접 호출하는 방식이 더 명확했을 것. 현재는 hook의 `startEdit` 이 shadowing 됨.
  - 제안: `useCardEditToggle` destructure 시 `startEdit` 을 제외(`const { editing, setEditing, cancelEdit } = useCardEditToggle();`)하고, 로컬 `startEdit` 함수가 유일한 정의임을 명확히 함.

---

### 파일 4: schedule-config-card.tsx

- **[INFO]** 파일 전체적으로 깔끔하고 단일 책임. 특이사항 없음.

---

### 파일 5: webhook-config-card.tsx

- **[INFO]** `getCurlExample` 함수가 컴포넌트 body 안에 정의됨. `url`, `linkedAuthConfig` 두 값에만 의존하며, 순수함수로 추출 가능.
  - 위치: `webhook-config-card.tsx` L1582–1616
  - 상세: 함수 자체가 길지 않고 테스트가 필요한 로직(auth 타입별 분기 4개)이나 현재는 컴포넌트 내 클로저에 갇혀 단위 테스트 불가.
  - 제안: `getCurlExample(url: string, authType: string | undefined): string` 형태로 모듈 스코프 순수함수로 추출.

- **[INFO]** `copyText` wrapper 함수가 컴포넌트 body 에 정의됨. `useCopyToClipboard` 결과의 부분 적용 패턴인데, 두 곳(url 복사, cURL 복사)에서 호출되어 중복 줄이는 역할을 잘 하고 있음. 문제 없음.

---

### 파일 6: use-card-edit-toggle.ts

- **[INFO]** 15줄의 단순 hook. 명확하고 단일 책임. 특이사항 없음.
  - `cancelEdit` 의 `onReset` 이 optional 이어서 `cancelEdit()` 호출 시 reset 없이 편집 취소만 됨 — 이 동작이 의도적인지 JSDoc 에 명시돼 있어 좋음.

---

### 파일 7: use-trigger.ts

- **[INFO]** `invalidate` 가 매 렌더마다 새로운 함수 참조를 반환함. 카드들이 `onSaved={invalidate}` 형태로 prop 으로 전달되므로, `useCallback` 없이는 불필요한 자식 리렌더를 유발할 수 있음. 현재 카드들이 `memo` 를 쓰지 않으면 실질적 영향 없음.
  - 위치: `use-trigger.ts` L1887–1890
  - 상세: 현재 카드들은 `React.memo` 없으므로 실제 성능 문제는 없음. 향후 memo 적용 시 함께 수정 필요.
  - 제안: `const invalidate = useCallback(() => { ... }, [queryClient, triggerId])` 로 메모이제이션. 또는 현재 상태 유지 후 memo 도입 시 함께 처리.

---

### 파일 8: trigger-detail-drawer.tsx (after)

- **[INFO]** 65줄 thin wrapper. 명확하고 의도 잘 드러남. 특이사항 없음.

---

### 공통 관찰 (cross-cutting)

- **[WARNING]** Card 헤더의 편집/저장/취소 버튼 패턴이 `chat-channel-card.tsx`, `external-interaction-card.tsx`, `webhook-config-card.tsx` 에서 구조적으로 동일하게 반복됨 (약 15–20줄 JSX 블록). `canEdit && !editing ? EditButton : editing ? SaveCancelButtons : null` 패턴.
  - 위치: 각 카드 파일의 `CardHeader` 내부
  - 상세: behavior-preserving 추출이므로 이번 PR 에서 통합하지 않은 것은 이해 가능. 그러나 향후 버튼 variant/size/disabled 로직 변경 시 3곳을 동시 수정해야 함.
  - 제안: M-8 후속 PR 에서 `CardEditHeader` 또는 `useCardHeader` 패턴으로 추출 고려. 현재 PR 에서는 변경 불필요(behavior-preserving 범위).

- **[INFO]** `text-[hsl(var(--muted-foreground))]`, `border-[hsl(var(--border))]`, `bg-[hsl(var(--muted))]` 등 CSS 변수 참조 문자열이 각 카드에 반복됨. 이는 기존 코드베이스의 Tailwind + CSS 변수 패턴과 일치하므로 일관성은 있음. 단, 동일 패턴이 이제 5개 파일로 퍼져 있음.
  - 제안: `codebase/frontend/src/components/triggers/cards/_shared.ts` 에 공용 className 상수 추출 고려(후속 정리 범위).

---

## 요약

이번 변경은 1,537줄 god-component 를 7개 파일(5 카드 + 2 hooks)로 분리한 behavior-preserving 리팩토링이다. 전체적으로 단일 책임 원칙이 잘 적용됐고, 공용 `useCardEditToggle` 추출과 `useTrigger` hook 분리는 명확한 유지보수성 개선이다. 주요 약점은 (1) 카드 헤더 편집 버튼 JSX 블록이 3개 파일에 구조적으로 반복되는 점, (2) `external-interaction-card` 가 여전히 Notification + Interaction 두 도메인을 하나의 컴포넌트에서 관리하는 점, (3) 일부 헬퍼 함수가 모듈 스코프가 아닌 컴포넌트 body 안에 정의돼 테스트 가능성과 일관성을 저하시키는 점이다. 이 중 (1)(2)는 이번 PR 의 behavior-preserving 범위를 감안하면 defer 타당, (3)은 간단한 후속 정리로 해소 가능하다.

## 위험도

LOW
