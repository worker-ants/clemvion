## 발견사항

### [WARNING] `integrations/page.tsx` 주의 배너에서 단수/복수 처리 누락
- **위치**: `integrations/page.tsx` — attentionCount 배너 렌더링 부분
- **상세**: 원본 코드는 `integration{attentionCount > 1 ? "s" : ""} need attention`으로 단/복수를 구분했으나, 변경 후는 항상 `t("integrations.attentionPrefix")`("integrations need attention")를 사용한다. EN 번역 기준 `attentionCount === 1`일 때 "**1** integrations need attention"으로 문법 오류 발생. `attentionSingle` 키가 번역 사전에 존재함에도 사용되지 않음.
- **제안**: 
  ```tsx
  {attentionCount === 1
    ? t("integrations.attentionSingle")
    : t("integrations.attentionPrefix")}
  ```

---

### [WARNING] `date.ts`와 `execution-status.ts`의 `formatDuration` 동작 불일치
- **위치**: `date.ts:formatDuration` vs `execution-status.ts:formatDuration`
- **상세**: 두 함수가 공존하며 초(seconds) 단위 처리 방식이 다름.
  - `date.ts`: `Math.floor` → `2500ms` = `"2s"` (정수)
  - `execution-status.ts`: `toFixed(1)` → `2500ms` = `"2.5s"` (소수점)
  
  대시보드(date.ts 사용)와 실행 목록(execution-status.ts 사용)에서 동일한 2.5초 실행 시간이 다르게 표시됨. 사용자 혼란 유발 가능.
- **제안**: 하나의 `formatDuration` 구현으로 통일하거나, 사용 목적에 따라 명확히 구분되는 네이밍을 사용할 것.

---

### [WARNING] `date.ts` 및 `execution-status.ts`에 `"use client"` 추가로 서버 컴포넌트 사용 제한
- **위치**: `date.ts:1`, `execution-status.ts:1`
- **상세**: 두 유틸리티 파일에 `"use client"` 지시자가 추가되어 Next.js Server Component에서 더 이상 임포트 불가. `useLocaleStore.getState()` 호출 때문에 불가피하나, 이전에 이 유틸리티들을 사용하던 서버 컴포넌트가 있다면 빌드 오류 발생.
- **제안**: 서버 컴포넌트용 locale-agnostic 버전과 클라이언트용 버전을 분리하거나, `locale` 파라미터를 항상 명시적으로 전달하도록 API를 강제하여 스토어 의존성을 제거하는 방안 검토.

---

### [INFO] `ForgotPasswordFormInner` `key={locale}` 패턴 — 폼 상태 초기화
- **위치**: `forgot-password-form.tsx:109-111`
- **상세**: `key={locale}` 로 언어 변경 시 컴포넌트를 강제 재마운트함. Zod 스키마 재생성을 위한 유효한 접근이지만, 사용자가 언어를 전환할 때 이미 입력한 이메일 주소가 초기화됨.
- **제안**: 언어 변경 시 검증 메시지만 갱신하도록 `schema`를 `useMemo`로 격리하되, `form.trigger()`로 메시지를 재검증하는 방식도 고려.

---

### [INFO] `execution-status.ts::formatDuration` — 59.999초 엣지 케이스
- **위치**: `execution-status.ts:formatDuration`
- **상세**: `59999ms`의 경우 `59.999.toFixed(1)` = `"60.0"` → `Number("60.0") = 60` → `translate("time.seconds", { value: 60 })` = `"60s"`. 직전 버전(`"60.0s"`)보다 낫지만, `"1m 0s"` 대신 `"60s"`가 표시되는 경계 케이스는 여전히 존재.
- **제안**: 필요시 `if (Math.round(ms / 1000) >= 60)` 조건으로 보정 가능.

---

### [INFO] 테스트에서 `useLocaleStore.setState({ locale: "en" })` 일관성
- **위치**: 다수의 `__tests__/*.test.tsx`
- **상세**: 모든 테스트 파일의 `beforeEach`에 locale을 `"en"`으로 초기화하는 코드가 일관되게 추가됨. DEFAULT_LOCALE이 `"ko"`이므로 테스트 격리를 위해 필요하며 올바른 처리.

---

## 요약

변경사항은 하드코딩된 문자열을 번역 키로 교체하는 대규모 i18n 작업으로, 전반적으로 패턴이 일관되고 번역 키 타입 안전성도 확보되었다. 다만 **영어 단수/복수 미처리**(integrations attention 배너), **두 `formatDuration` 구현 간 동작 불일치**(대시보드 vs 실행 목록), **`"use client"` 추가로 인한 서버 컴포넌트 제약**이 실사용에서 노출될 수 있는 결함으로 식별된다.

## 위험도

**MEDIUM**