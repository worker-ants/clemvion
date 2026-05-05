## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `slide-drawer.tsx`: "Close" 하드코딩 — i18n 불일치**
- 위치: `slide-drawer.tsx:70`
- 상세: `aria-label="Close"`가 영문 하드코딩. 같은 목적의 레이블이 `authentication/page.tsx`, `llm-configs/page.tsx`, `triggers/page.tsx`에서는 `t("common.close")`로 i18n 처리됨. 패턴 불일치.
- 제안: `useT()`가 이미 컴포넌트 내에 없으므로 추가 후 `t("common.close")` 사용.

---

**[WARNING] `mcp-server-selector.tsx`: `aria-label="Remove"` 하드코딩**
- 위치: `mcp-server-selector.tsx:124`
- 상세: 파일 전체에서 i18n을 사용하지 않고 있어 i18n 미적용 파일이지만, 같은 프로젝트의 삭제 버튼들(`common.delete`)과 레이블 패턴이 다름. 추후 다국어 지원 시 누락될 위험.
- 제안: 단기적으로는 `dict/en.ts`의 `common.remove` 키 추가 후 `t()` 사용 또는 서버 이름을 포함한 `aria-label`(`Remove {integration.name}`)로 구체화.

---

**[WARNING] `register-form.tsx`: `terms-error` 오류 요소에 `aria-describedby` 누락**
- 위치: `register-form.tsx:256`
- 상세: `name-error`, `email-error`, `password-error`는 input에 `aria-describedby`로 연결되어 있지만, `terms-error`는 체크박스 input과 연결되지 않음. 패턴이 불일치하여 유지보수 시 혼란 야기.
- 제안:
  ```tsx
  <input
    type="checkbox"
    aria-describedby={errors.termsAccepted ? "terms-error" : undefined}
    {...register("termsAccepted")}
  />
  ```

---

**[WARNING] `smoke.spec.ts`: axe 태그 배열 3회 반복 — 매직 리터럴**
- 위치: `smoke.spec.ts:20`, `47`, `71`
- 상세: `["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]`가 동일하게 3회 복사. 하나를 변경할 때 나머지를 놓치기 쉬움.
- 제안:
  ```ts
  const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;
  // 사용: .withTags(WCAG_TAGS)
  ```

---

**[WARNING] `smoke.spec.ts`: "assertion 없음" 테스트가 영구적으로 남을 위험**
- 위치: `smoke.spec.ts:41–58`
- 상세: `test("axe scan: 전체 위반 보고 (assertion 없음)")` — 주석으로 "Step F에서 끌어내릴 예정"이라 되어 있으나, 완료 기준이 코드 외부(step 진행 여부)에만 존재. 이 테스트가 assert 없이 영구 잔류할 경우 테스트 스위트가 오염됨.
- 제안: 테스트 이름을 `test.skip`으로 전환하거나, TODO 주석에 관련 이슈/스텝 번호를 명시해 추적 가능하게 함.

---

**[INFO] `playwright.config.ts`: `retries: 0` 인라인 주석 — 설정 파일에 TODO성 주석**
- 위치: `playwright.config.ts:16`
- 상세: `// 로컬 디버깅 우선. CI 도입 시 1~2 로 올림.` 은 결정 사항이 코드에 문서화되어 있어 현재는 양호. 다만 CI 도입 후 제거되지 않으면 낡은 주석이 됨.
- 제안: 현재는 허용. CI 셋업 시 `process.env.CI ? 2 : 0`으로 변경하고 주석 제거.

---

**[INFO] `card.tsx`: `CardTitle` 타입 변경이 암묵적 `ref` 타입 변경을 동반**
- 위치: `card.tsx:26`
- 상세: 기존 `HTMLParagraphElement`에서 `HTMLHeadingElement`로 변경. 외부에서 `ref`를 전달하는 소비자가 있다면 타입 에러 발생. 현재 프로젝트 내 사용처가 많지 않을 것으로 보이나 검증 필요.
- 제안: 변경 자체는 정확함. 프로젝트 전체에서 `CardTitle`에 `ref`를 전달하는 코드가 없는지 확인.

---

**[INFO] `schedules/page.tsx`: `title`과 `aria-label` 동시 사용**
- 위치: `schedules/page.tsx:1067, 1077`
- 상세: `title={t("schedules.editTooltip")}` + `aria-label={t("schedules.editTooltip")`가 동일 값으로 중복. `aria-label`이 존재하면 `title`은 SR에서 무시되므로 동일 문자열 중복.
- 제안: `title` 유지(툴팁 목적)하거나 `aria-label`만 사용. 현재 동일 값이므로 기능 상 문제는 없으나 중복 유지 비용이 있음.

---

### 요약

이번 변경은 WCAG 2.1 AA 준수를 위한 접근성 개선 작업으로, 변경의 방향성과 구조는 전반적으로 적절하다. 주요 패턴(i18n `t()` 사용, `aria-hidden="true"` on 장식 아이콘, `aria-invalid`/`aria-describedby` 조합)이 대부분의 파일에 일관되게 적용되었다. 다만 `slide-drawer.tsx`와 `mcp-server-selector.tsx`의 하드코딩 `aria-label`이 기존 i18n 패턴에서 벗어나 있고, `smoke.spec.ts`의 axe 태그 배열 중복과 assertion 없는 테스트의 영구 잔류 위험이 향후 유지보수 부채로 이어질 수 있다. `register-form.tsx`의 `terms-error` 연결 누락은 기존 패턴과 불일치하는 유일한 접근성 버그에 해당한다.

### 위험도

**LOW**