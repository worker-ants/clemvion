### 발견사항

---

**[WARNING] diff 모달 닫힘 시 theme store가 원복되지 않음**
- 위치: `profile-preferences-card.tsx` — `ConfirmDiffDialog`의 `onClose` 핸들러
- 상세: spec §2.0은 "취소 / 모달 닫힘 시 항상 원복된다"고 명시한다. 현재 구현에서 diff 모달의 [취소] 버튼(즉 `onClose`)은 `setShowDiff(false)`만 실행하므로, 사용자는 edit 모드로 되돌아가되 theme store에는 라이브 프리뷰 값이 그대로 남아 있다. 카드의 [취소] 버튼(`handleCancel`)은 store를 원복하지만, 모달 dismiss 경로는 원복하지 않는다.
- 제안:
  ```tsx
  onClose={() => {
    setShowDiff(false);
    setThemeStore(user.theme); // 모달 닫힘 시에도 라이브 프리뷰 원복
  }}
  ```

---

**[WARNING] API 오류 경로가 테스트되지 않음**
- 위치: `change-password.test.tsx`, `profile-info-card.test.tsx`, `profile-preferences-card.test.tsx` — 전체 파일
- 상세: 세 테스트 파일 모두 API 호출 실패(네트워크 오류, 4xx/5xx) 시나리오가 없다. 구현에는 `toast.error(axiosMessage(...))` 경로가 있지만, 잘못된 현재 비밀번호(401), 이름 중복 등의 서버 오류가 올바르게 표시되는지 전혀 검증되지 않는다.
- 제안: 각 테스트에 `apiClient.post/patch.mockRejectedValueOnce(...)` 케이스를 추가하고 `toast.error`가 호출되었는지, 폼이 리셋되지 않는지 확인한다.

---

**[WARNING] `locale` 변경 후 확정 시 locale store 호출이 테스트에 없음**
- 위치: `profile-preferences-card.test.tsx`
- 상세: `setLocaleStoreMock`이 정의되어 있지만, locale 변경 → diff 모달 → 확정 흐름에서 `setLocaleStore`가 실제로 호출되는지 검증하는 테스트가 없다. spec §2.0은 언어·테마 모두 환경설정 변경에 포함한다.
- 제안: locale를 "ko"→"en"으로 변경하고 확정까지 진행하는 케이스를 추가해 `setLocaleStoreMock`이 "en"으로 호출됨을 검증한다.

---

**[INFO] `confirmPassword` 빈 값 시 오해를 유발하는 i18n 키**
- 위치: `change-password/page.tsx:48`
- 상세: `confirmPassword: z.string().min(1, t("profile.enterNewPassword"))` — 확인 비밀번호가 비어있을 때 "새 비밀번호를 입력해 주세요" 메시지가 표시되어 어느 필드의 오류인지 모호하다. 첫 번째 필드와 구분이 되지 않는다.
- 제안: `t("profile.enterConfirmPassword")` 전용 키를 추가하거나, 기존 `t("profile.confirmPassword")`(레이블용)을 활용한다.

---

**[INFO] `patch.theme/locale` 존재 확인이 truthiness 방식**
- 위치: `profile-preferences-card.tsx:73–74`
- 상세: `if (patch.theme) setThemeStore(patch.theme)` — "light"·"dark"·"ko"·"en"은 모두 truthy이므로 실제 버그는 없지만, 의도는 `!== undefined` 검사다.
- 제안: `if (patch.theme !== undefined)` 로 명시한다.

---

**[INFO] `name` dirty 판정이 trim 기준이나 API 전송 값은 raw 값**
- 위치: `profile-info-card.tsx:52`, `mutation.mutateAsync`
- 상세: `dirty = (name).trim() !== (user.name).trim()` 이므로 "John" → "  John  " 처럼 공백만 추가하면 dirty=false로 판단해 diff 모달이 뜨지 않는다. 반대로 공백 없이 trim 된 이름을 서버에 보내지 않고 raw 값을 전송한다.
- 제안: dirty 판정 전에 `name.trim()`을 상태로 정규화하거나, PATCH 페이로드에 `{ name: name.trim() }`을 전달한다.

---

**[INFO] 비밀번호 최대 길이(100자) 유효성 테스트 부재**
- 위치: `change-password.test.tsx`
- 상세: `z.string().max(100, ...)` 규칙이 구현에 있지만 테스트에서 검증되지 않는다.

---

### 요약

핵심 구현(readonly 기본값, 카드별 편집 토글, diff 모달, 비밀번호 전용 sub-route, 라이브 프리뷰 temp-state 격리)은 spec §2와 plan의 결정 정책을 충실히 따르고 있다. 단 spec이 명시한 "모달 닫힘 시 theme store 항상 원복" 조건이 diff 모달의 dismiss 경로에서 누락되어 있어 카드 [취소]와 모달 닫기 사이의 동작이 불일치한다. 또한 세 컴포넌트 모두 API 오류 경로와 locale 확정 경로가 테스트되지 않아, 오류 UX 및 locale 저장 동작에 대한 신뢰도가 낮다.

### 위험도

**MEDIUM**