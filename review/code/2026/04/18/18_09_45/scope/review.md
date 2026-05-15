## 발견사항

### [WARNING] 중요 주석 삭제 (다수 파일)
- **위치**: `accept-invitation-content.tsx` +36줄, `restore-confirm-dialog.tsx` +29줄, `canvas-empty-state.tsx` +35줄, `forgot-password-form.tsx` +56줄, `profile/security/page.tsx` +44줄
- **상세**: i18n 변환과 무관한 설명·보안 주석이 함께 삭제됨
  - `accept-invitation-content.tsx`: 워크스페이스 목록 갱신 및 컨텍스트 전환 이유 설명 삭제
  - `restore-confirm-dialog.tsx`: `window.location.reload()` 이유("인메모리 에디터 상태 무효화") 삭제
  - `canvas-empty-state.tsx`: fade-in/out 처리 방식, `visible=false` 접근성 처리, 표시 기준 설명 전체 JSDoc 삭제
  - `forgot-password-form.tsx`: 이메일 열거 방지를 위해 에러를 노출하지 않는다는 **보안 의도 설명** 삭제
  - `profile/security/page.tsx`: `twoFactorEnabled` 필드 존재 가정 및 대안 설명 삭제
- **제안**: 기능 동작에 영향 없는 i18n 작업에서 문서 주석·보안 주석은 유지해야 함. 특히 `forgot-password-form.tsx`의 보안 주석은 복원 필요

---

### [WARNING] `formatDuration` 출력 형식 변경 (행동 변경)
- **위치**: `execution-status.ts` 새 `formatDuration`, `execution-status.test.ts`
- **상세**: 1000ms 이상 구간에서 소수점 출력이 사라짐
  - 기존: `1000ms → "1.0s"`, `2500ms → "2.5s"`, `59999ms → "60.0s"`
  - 변경: `1000ms → "1s"`, `2500ms → "2.5s"`, `59999ms` 테스트 케이스 삭제
  - `execution-list-page.test.tsx`의 `"1.0s" → "1s"` 변경이 이 행동 변경을 확인
- **제안**: i18n 작업에서 포맷 출력 정밀도까지 변경하는 것은 범위 초과. 소수점 처리를 번역 템플릿과 분리하여 기존 형식을 유지하거나, 의도적 변경이라면 별도 PR로 분리

---

### [WARNING] `"use client"` 디렉티브 추가 (유틸리티 파일 범위 축소)
- **위치**: `date.ts` 1줄, `execution-status.ts` 1줄
- **상세**: 두 유틸리티 모듈에 `"use client"`가 추가되어 서버 컴포넌트(RSC)에서 임포트 불가
  - `date.ts`는 i18n 전에는 서버·클라이언트 공통 유틸이었으나 이제 클라이언트 전용으로 격하
  - `useLocaleStore.getState()`는 클라이언트 스토어 호출이므로 서버에서 동작하지 않음
- **제안**: 순수 변환 함수(`locale` 파라미터 버전)는 별도 서버-안전 파일로 분리하거나, 스토어 의존성을 제거하고 항상 명시적 `locale` 파라미터를 요구하는 방식으로 설계

---

### [WARNING] `ForgotPasswordForm` 구조 변경 (리팩토링)
- **위치**: `forgot-password-form.tsx` 전체
- **상세**: `ForgotPasswordForm` → `ForgotPasswordFormInner` + `ForgotPasswordFormInner key={locale}` 래퍼로 분리. zod 스키마를 컴포넌트 내부로 이동하여 `useMemo`로 감쌈. i18n 작업의 맥락에서 필요한 변경이지만 컴포넌트 구조 자체가 변경됨.
- **제안**: 이 구조 변경은 로케일 변경 시 form validation 메시지를 재계산하기 위한 것으로 i18n 목적과 연관은 있으나, 단순 문자열 교체 범위를 벗어남. 의도와 이유를 주석으로 명시 권장 (삭제된 주석과 대비됨)

---

### [INFO] `formatDuration` 함수 이동 (리팩토링)
- **위치**: `dashboard/page.tsx` 89줄 (로컬 함수 삭제), `date.ts` (함수 추가)
- **상세**: 대시보드에 로컬로 정의되어 있던 `formatDuration`이 `date.ts`의 공유 유틸로 이동. i18n 지원을 위한 이동이지만 리팩토링에 해당
- **제안**: 허용 가능한 수준. 다만 `execution-status.ts`에도 동일한 함수가 존재하므로 이 두 함수의 동작이 일치하는지 확인 필요

---

### [INFO] 테스트 단언 변경 (행동 변경 반영)
- **위치**: `execution-list-page.test.tsx` 101, 105, 139줄
- **상세**:
  - `findByText("Test Workflow")` → `findByText(/Test Workflow/)` (정규식): 새 복합 문자열 헤더(`{name} — Executions` 구조 제거)에 대응
  - `getByText("1.0s")` → `getByText("1s")`: `formatDuration` 행동 변경 반영
  - `findByText("Completed")` → `findAllByText("Completed")`: 다중 렌더링 대응
- **제안**: 첫 번째와 세 번째는 i18n 변경에 따른 자연스러운 적응. 두 번째(`"1.0s" → "1s"`)는 [WARNING] 항목과 연결된 행동 변경임

---

### [INFO] `formatDate`의 `"date"` 포맷 분기 제거
- **위치**: `date.ts` 65줄 근처
- **상세**: 기존 `format === "date"` 분기가 삭제되었으나 기본 분기가 동일한 옵션(`year, month, day`)을 사용하므로 기능적으로 동일. 소규모 정리
- **제안**: 기능 동일하므로 허용 가능. 의도하지 않은 변경이라면 복원 여부 검토

---

## 요약

변경의 핵심 의도인 i18n 문자열 교체는 전반적으로 일관성 있게 적용되어 있으나, 작업 과정에서 세 가지 범위 이탈이 발생했다: (1) 보안 의도 주석 포함 다수 설명 주석 삭제 — 특히 forgot-password의 이메일 열거 방지 주석은 복원이 필요하다; (2) `formatDuration`의 초 단위 표시가 `"1.0s"` → `"1s"`로 변경되는 행동 변경이 i18n 작업에 混入되었으며 이는 의도적 변경이라 하더라도 별도 추적이 필요하다; (3) 유틸리티 파일에 `"use client"` 추가로 서버 컴포넌트에서의 사용 가능성이 차단되어 아키텍처 제약이 생겼다.

## 위험도

**MEDIUM**