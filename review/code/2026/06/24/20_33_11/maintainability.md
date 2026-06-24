# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: `codebase/frontend/src/app/(main)/web-chat/page.tsx`

- **[INFO]** `WebChatDetail` 컴포넌트가 여러 책임을 가지고 있음
  - 위치: `WebChatDetail` 함수 전체 (약 130줄의 JSX + 로직)
  - 상세: 헤더(이름·배지·버튼), 온보딩 배너, 외형 편집, 설치 스니펫, 미리보기, 그리고 세 개의 다이얼로그(rename/history/delete)를 한 함수에서 관리한다. 각 다이얼로그 상태(renameOpen, historyOpen, deleteTarget)와 mutation(updateMeta, updateAppearance)도 함께 존재한다. 현재 규모에서는 관리 가능하지만, 추가 기능이 붙을 경우 분리 비용이 커진다.
  - 제안: 급하게 분리할 수준은 아니나, 헤더 툴바 영역(`<div className="flex flex-wrap ...">`)을 `WebChatDetailHeader` 컴포넌트로 추출하면 다이얼로그 상태를 함께 캡슐화할 수 있다.

- **[INFO]** `deleteTarget` 초기화 패턴이 인라인 객체 리터럴로 길어짐
  - 위치: `page.tsx` line ~260 (`setDeleteTarget({ id: ..., name: ..., type: "webhook", ... })`)
  - 상세: `TriggerDeleteTarget` 객체 구성이 JSX 속성 인라인에 작성되어 있어 읽기 불편하다. 동일 패턴이 확장되면 더 읽기 어려워진다.
  - 제안: `const deleteTarget = buildDeleteTarget(instance)` 같은 헬퍼 함수로 추출하거나, 최소한 `onClick` 핸들러를 별도 변수로 분리한다.

- **[INFO]** `type: "webhook"` 하드코딩
  - 위치: `page.tsx` `setDeleteTarget` 호출부
  - 상세: `TriggerDeleteTarget`에 `type: "webhook"`을 하드코딩한다. 이 파일이 웹채팅 전용임을 고려하면 명시성이 있으나, 의미를 설명하는 상수나 주석이 없다.
  - 제안: 파일 상단에 `const WEBCHAT_TRIGGER_TYPE = "webhook" as const` 상수를 두거나, 인라인 주석(`// 웹채팅은 항상 webhook 타입 trigger`)을 추가해 의도를 명시한다.

---

### 파일 3: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx`

- **[INFO]** `onDeleted?.()` 호출 순서: `invalidateQueries` → `onDeleted` → `toast` → `onClose`
  - 위치: `onSuccess` 콜백 내부
  - 상세: `onDeleted`가 `toast.success` 앞에 호출되므로, 콜백 내부에서 동기 에러가 발생하면 toast가 노출되지 않는다. 실제로는 `onDeleted`가 단순 캐시 무효화만 하므로 문제는 없지만, 순서에 대한 명시적 근거가 없다.
  - 제안: 현재 동작상 문제없으므로 INFO 수준. 필요하다면 짧은 주석(`// onDeleted: 호출자 후처리(캐시·선택 리셋) — toast/onClose 전에 실행`)으로 의도를 기록한다.

- **[INFO]** `isAxiosLikeStatus` 함수의 타입 캐스팅이 any-like 패턴
  - 위치: `trigger-delete-dialog.tsx` `isAxiosLikeStatus`
  - 상세: `(err as { response?: { status?: number } })` 형태는 이미 명시적이어서 충분하다. 다만 이 패턴이 여러 파일에서 중복될 경우 유틸 모듈로 이동을 고려할 수 있다.
  - 제안: 현재 1개소 사용이므로 이전 불필요. 다른 에러 핸들러에서도 동일 패턴이 등장하면 `@/lib/api/errors.ts` 등에 공유한다.

---

### 파일 6: `codebase/frontend/src/components/web-chat/use-web-chat.ts`

- **[INFO]** `useUpdateWebChatAppearance`와 `useUpdateWebChatMeta`의 `onSuccess` 패턴이 동일하게 중복
  - 위치: `use-web-chat.ts` `useUpdateWebChatAppearance.onSuccess` / `useUpdateWebChatMeta.onSuccess`
  - 상세: 두 훅 모두 `Promise.all([queryClient.invalidateQueries(WEB_CHAT_INSTANCES_KEY), queryClient.invalidateQueries(TRIGGERS_KEY)])` 동일 패턴을 반복한다. `useCreateWebChat`도 동일 패턴.
  - 제안: `const invalidateWebChatCaches = (qc: QueryClient) => Promise.all([...])` 같은 모듈 수준 헬퍼로 추출하면 세 곳의 무효화 로직이 단일 출처가 된다.

- **[WARNING]** `useMutation<unknown, unknown, ...>` 제네릭 — 에러 타입 `unknown`
  - 위치: `useUpdateWebChatMeta`, `useUpdateWebChatAppearance`, `useCreateWebChat`
  - 상세: 에러 타입을 `unknown`으로 지정해 mutation 호출자가 에러를 처리할 때 타입 정보가 없다. 기존 코드와 일관성은 있으나, 에러 handling이 `catch {}` 블록에 의존한다.
  - 제안: 단기적으로는 현 패턴 유지. 중기적으로 프로젝트 전체의 에러 타입 전략을 통일할 때 개선한다.

---

### 파일 7: `codebase/frontend/src/components/web-chat/web-chat-rename-dialog.tsx`

- **[INFO]** wrapper 컴포넌트 이름 `Inner`가 지나치게 짧음
  - 위치: `web-chat-rename-dialog.tsx` `function Inner`
  - 상세: `TriggerDeleteDialog`도 내부 함수로 `DialogInner`를 사용하는데, 이 파일은 `Inner`만 사용한다. 일관성 차원에서 `RenameDialogInner` 또는 `WebChatRenameDialogInner`가 낫다.
  - 제안: `function Inner` → `function WebChatRenameDialogInner`로 변경해 `TriggerDeleteDialog`의 `DialogInner` 패턴과 일관성을 맞춘다.

- **[INFO]** `key={...instanceId:...open}` 리마운트 전략 — 문서화는 충분하나 open이 포함된 이유 불명확
  - 위치: `WebChatRenameDialog` 반환부 `key={...instanceId:${String(props.open)}}`
  - 상세: JSDoc에 `(instanceId, open)` 조합으로 리마운트한다고 설명되어 있다. `instanceId`만으로는 "같은 인스턴스를 닫았다 다시 열었을 때 초기화 안 됨" 문제가 있어 `open`을 포함시킨 의도는 타당하다. 다만 key에 boolean을 포함시키는 이 패턴은 익숙하지 않은 독자에게 낯설다.
  - 제안: key 계산 위치에 한 줄 주석 추가: `// open=false→true 전환 시에도 state 를 초기화하기 위해 open 을 key 에 포함`

---

### 파일 2/5: 테스트 파일

- **[INFO]** `trigger-delete-dialog.test.tsx`에서 새 onDeleted 테스트 3개가 모두 동일한 "이름 입력 → 클릭" 패턴을 반복
  - 위치: `trigger-delete-dialog.test.tsx` line ~742~780
  - 상세: `fireEvent.change(...)` + `fireEvent.click(...)` 시퀀스가 세 테스트에서 그대로 복붙된다. 기존 테스트들(성공/404/5xx 경로)과도 동일한 패턴이다. 테스트 헬퍼 함수가 없어 중복이 많다.
  - 제안: `async function confirmAndDelete(name = "order-webhook")` 헬퍼를 describe 블록 내에 추출하면 반복 감소. 단, 테스트 파일의 중복은 가독성·격리 트레이드오프가 있으므로 INFO 수준.

- **[INFO]** `web-chat-rename-dialog.test.tsx`의 `const h = vi.hoisted(...)` — 변수명 `h`가 불명확
  - 위치: `web-chat-rename-dialog.test.tsx` line 3
  - 상세: `h`는 "hoisted mock handle"의 축약인데, 파일 전반에서 `h.mutateAsync`, `h.isPending`으로 참조된다. 이미 관행적으로 쓰이는 패턴일 수 있으나, `mockHook` 또는 `metaMock`이 더 명시적이다.
  - 제안: `const h` → `const mockMeta` 또는 `const metaHook`으로 변경해 의미를 명확히 한다.

---

### 파일 8/9: i18n dict

- **[INFO]** `manage.renameTitle`과 `manage.rename`이 별도 키이나 EN 기준 동일 값("Rename")
  - 위치: `en/webChat.ts` `manage.rename: "Rename"` / `manage.renameTitle: "Rename"`
  - 상세: `rename`은 드롭다운 메뉴 항목, `renameTitle`은 다이얼로그 제목으로 각자 다른 UI 위치에서 사용된다. EN에서 동일 문자열이지만, KO에서 `rename: "이름 변경"` / `renameTitle: "이름 변경"`도 동일해서 코드베이스 증가 없이 재사용 여지가 있다. 그러나 UI 컨텍스트가 다르므로 분리 유지가 더 유연하다.
  - 제안: 현 상태 유지. i18n 키 중복은 UX 컨텍스트별 분리로 정당화된다.

---

## 요약

변경 전체는 유지보수성 관점에서 무난하다. 기존 `TriggerDeleteDialog`·`TriggerHistoryDialog` 재사용으로 중복 코드를 최소화했고, `onDeleted` prop 추가 설계는 JSDoc으로 책임 경계를 명확히 기술했다. `useUpdateWebChatMeta`는 `useUpdateWebChatAppearance`와 인터페이스가 유사하면서도 역할이 분리되어 있으며, 부분 PATCH 바디 구성 로직도 단순하다. 다만 세 개의 mutation 훅이 동일한 `onSuccess` 캐시 무효화 패턴을 반복하는 점, `WebChatDetail` 컴포넌트가 점차 커지고 있는 점, 내부 컴포넌트 네이밍의 일관성(Inner vs DialogInner) 등이 앞으로 유지보수 시 마찰이 될 수 있다. 현재 규모에서는 즉각 리팩터링이 필요한 수준은 아니며, 전체적으로 코드 품질은 양호하다.

## 위험도

LOW
