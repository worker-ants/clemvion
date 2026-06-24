# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: use-web-chat.test.ts

- **[INFO]** 테스트 케이스 설명문이 검증 근거를 포함해 가독성 우수
  - 위치: 라인 325 (`it("PATCH 실패 시 mutation 이 reject 된다 — onError 없어도 서버 미변경이므로 stale 아님"`)
  - 상세: 테스트 이름에 "왜 이렇게 동작해야 하는가"를 인라인으로 설명해, 나중에 읽는 사람이 별도 문서를 찾지 않아도 의도를 파악할 수 있다. 좋은 패턴.
  - 제안: 유지.

- **[INFO]** `useUpdateWebChatAppearance` reject 테스트(라인 221~236)와 신규 `useUpdateWebChatMeta` reject 테스트(라인 325~334)가 구조적으로 동일하나, 각 describe 블록 내에 위치해 중복이 아닌 독립 검증으로 볼 수 있음
  - 위치: 라인 221~236, 325~334
  - 상세: 두 테스트 모두 `patchMock.mockRejectedValue(new Error(...))` → `mutateAsync` → `rejects.toThrow` 패턴. 에러 메시지만 다름("server error" vs "fail"). 미묘한 불일치가 있으나, 각 훅의 독립 계약 검증 목적이므로 허용 가능 범위.
  - 제안: 장기적으로 공유 헬퍼(`expectMutationRejects`)를 추출하면 패턴 통일에 도움되나, 현 규모에서는 선택 사항.

- **[INFO]** `wrapper` 팩토리 함수(라인 106~109)가 파일 상단에 한 번 정의되어 여러 테스트에서 재사용됨 — 일부 테스트(invalidate 검증)에서는 별도 `customWrapper`를 인라인으로 정의. 패턴 혼재이나 이유(qc spy 필요)가 명확하므로 이해 가능.
  - 위치: 라인 106~109, 라인 190~196, 라인 299~304
  - 상세: `customWrapper` 정의 방식이 두 describe 블록에서 동일 패턴으로 반복됨. 일관성 있게 반복되므로 혼란을 주지는 않음.
  - 제안: 유지.

---

### 파일 2: use-web-chat.ts

- **[INFO]** `useUpdateWebChatMeta` JSDoc에 `onError` 미처리 근거가 명시됨(라인 379~382) — 유지보수 시 "실수로 빠진 거 아닌가?" 오해를 방지하는 방어적 문서화. 좋은 패턴.
  - 위치: 라인 379~382
  - 상세: 설계 의도를 명시하지 않으면 미래 기여자가 onError 핸들러를 추가하거나 되돌릴 가능성이 있음. 인라인 근거 명시로 해당 위험 제거.
  - 제안: 유지.

- **[INFO]** `useUpdateWebChatAppearance`(라인 558~562)와 `useUpdateWebChatMeta`(라인 594~598) 두 훅의 `onSuccess` 블록이 동일한 `Promise.all([invalidateQueries(...), invalidateQueries(...)])` 패턴을 반복
  - 위치: 라인 558~562, 594~598
  - 상세: 두 곳 모두 `WEB_CHAT_INSTANCES_KEY`와 `TRIGGERS_KEY`를 함께 무효화한다. 향후 키 구조 변경 시 두 곳을 동시에 수정해야 한다.
  - 제안: 공유 헬퍼 `invalidateWebChatCaches(queryClient)` 를 추출하면 단일 수정 지점을 확보할 수 있다. 현재 2곳이므로 즉각 강제 사항은 아니나, `useCreateWebChat`(라인 517~520)까지 포함하면 동일 패턴이 3곳에 존재 — 추출을 권장한다.

- **[INFO]** `MAX_LIST_LIMIT = 100`(라인 434)은 상수로 추출되어 매직 넘버 사용 없음. `staleTime: 60_000`(라인 481)도 숫자 분리자 사용으로 가독성 양호.
  - 위치: 라인 434, 481
  - 상세: 문제 없음.

- **[INFO]** `useWebChatInstances`의 `useMemo` 내부 map(라인 459~469)과 `useWorkflowOptions`의 list.map(라인 484)은 각각 단일 책임을 가지며, 중첩 깊이도 3단계 이내로 적절.
  - 위치: 라인 459~469, 484
  - 상세: 문제 없음.

---

### 파일 3: web-chat-rename-dialog.tsx

- **[INFO]** `Inner` → `WebChatRenameDialogInner` 리네이밍으로 파일 경계 없이 컴포넌트 이름만으로 소속을 알 수 있게 됨 — 네이밍 일관성 향상
  - 위치: 라인 700
  - 상세: `TriggerDeleteDialog.DialogInner` 패턴과 일관성 확보. 단, `DialogInner` 네이밍 패턴(`TriggerDeleteDialog`)과 `WebChatRenameDialogInner` 패턴 사이에 미묘한 차이(Prefix vs Suffix 스타일) 존재.
  - 제안: 장기적으로 내부 컴포넌트 네이밍 컨벤션을 통일(모두 `XXXInner` 또는 모두 `XXX.Inner`)하는 것이 일관성 측면에서 유리하나, 현재 변경 범위 내에서는 문제 없음.

- **[INFO]** `key={...}` 계산부 주석(라인 696) 추가로 `open` 포함 이유가 명확해짐 — React 리마운트 패턴은 비직관적이므로 주석이 적절한 수준의 설명을 제공
  - 위치: 라인 696~697
  - 상세: 문제 없음.

- **[INFO]** `submit` 함수(라인 709~718)는 guard clause 패턴(`if (disabled) return`)을 사용해 조기 반환. 중첩 없이 명확. 함수 길이도 적절(10줄 이내).
  - 위치: 라인 709~718
  - 상세: 문제 없음.

---

### 파일 4 & 5: web-chat.en.mdx / web-chat.mdx

- **[INFO]** `§6 인스턴스 관리` 절이 KO/EN 문서에 대칭적으로 추가됨 — 두 파일의 구조·항목 순서·Callout 위치가 일치해 향후 동기화 유지가 쉬움
  - 위치: web-chat.en.mdx 라인 807~859, web-chat.mdx 라인 1092~1144
  - 상세: 문제 없음.

- **[INFO]** `<ImplAnchor>` 블록이 `§6` 에 3개 새로 추가됨 — 기존 절과 동일 패턴을 따름. 문서-코드 연결 추적성 유지.
  - 위치: web-chat.en.mdx 라인 809~828, web-chat.mdx 라인 1094~1113
  - 상세: 문제 없음.

---

## 요약

이번 변경은 기존 패턴을 충실히 따른 점진적 개선 커밋이다. `useUpdateWebChatMeta`의 JSDoc `onError` 미처리 근거 명시, `WebChatRenameDialogInner` 리네이밍, `key` 주석 추가 등 모두 "나중에 읽는 사람이 의도를 오해하지 않도록" 하는 방향의 수정이며, 유지보수성 측면에서 긍정적이다. 주요 개선 여지는 세 곳에서 반복되는 `onSuccess invalidate` 패턴을 헬퍼 함수로 추출하는 것인데, 현재 규모에서는 즉각 강제할 수준은 아니나 향후 키 종류가 늘어날 경우 리팩터링 대상이다. 전반적으로 코드 가독성·네이밍·함수 길이·중첩 깊이 모두 양호하다.

## 위험도

NONE
