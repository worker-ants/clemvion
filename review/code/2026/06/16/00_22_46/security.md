# 보안(Security) 코드 리뷰

리뷰 대상: `authentication/page.tsx` God Component 분리 리팩토링
변경 유형: 순수 구조 리팩토링 (동작·API·i18n 불변)
리뷰 일시: 2026-06-16

---

## 발견사항

### 1. [INFO] `generatedKey` 평문 비밀값 — 렌더링 경로 유지(회귀 없음)

- 위치: `auth-config-create-form.tsx` 라인 83, `use-auth-config-form.ts` 라인 238
- 상세: 발급 직후 평문 비밀값(`generatedKey`)을 `<code>` 요소에 렌더링하는 로직은 리팩토링 전후 동일하다. 이번 변경으로 `generatedKey` 가 `useAuthConfigForm` 훅의 `useState` 로 중앙화됐으며, `AuthConfigCreateForm` 이 prop 으로 받아 표시한다. 신규 노출 경로는 없다.
- 제안: 현행 "1회 표시 후 다이얼로그 닫기 시 `setGeneratedKey(null)` 로 클리어" 패턴은 적절하다. 추가 보완이 필요하다면, `revealedSecret` 에 이미 적용된 30초 자동 hide 타이머(`window.setTimeout`)를 `generatedKey` 에도 동일하게 적용하는 것을 권장한다(현재 미적용).

---

### 2. [INFO] `password` 필드 — `type="password"` 및 `autoComplete="new-password"` 유지(회귀 없음)

- 위치: `auth-config-form-fields.tsx` 라인 514
- 상세: basic_auth 비밀번호 입력 필드는 `type="password"` 와 `autoComplete="new-password"` 를 올바르게 유지한다. 리팩토링 이전 `page.tsx` 와 동일하며, 브라우저 자동완성 관리자가 기존 자격증명 자동 채움을 시도하지 않도록 `new-password` 를 사용하는 것이 적절하다.
- 제안: 없음. 현행 처리가 올바르다.

---

### 3. [INFO] `openCreate()` 에서 폼 초기화 미수행 — 잔여 상태 오염 가능성(방어적 개선 권장)

- 위치: `use-auth-config-form.ts` 라인 254-256
- 상세: `openCreate()` 는 `setMode("create")` 만 수행하고 필드 초기화를 하지 않는다. 이는 `close()` 가 반드시 먼저 호출된다는 가정(다이얼로그 닫을 때마다 초기화)에 의존한다. 훅 주석에도 "다이얼로그를 닫을 때마다 폼이 초기화되므로 `openCreate` 는 별도 초기화 없이 모드만 전환"이라고 명시돼 있다. 현재 UX 흐름에서는 안전하지만, 향후 `close()` 를 거치지 않고 직접 `openCreate()` 를 호출하는 경로가 추가되면 이전 편집 내용(`editTargetId`, `name`, `type` 등)이 생성 폼에 잔류할 수 있다.
- 보안 관점: `editTargetId` 가 잔류한 상태로 `createMutation` 이 실행되더라도, `updateMutation` 에서만 `form.editTargetId` 를 URL 경로에 사용하므로 `createMutation` 페이로드에는 직접 영향이 없다. 실질 보안 위협보다는 UX 데이터 오염에 가깝다.
- 제안: `openCreate()` 내부에서도 필드 초기화를 명시적으로 수행하거나, 내부적으로 `close()` 로직 후 `setMode("create")` 로 구현하는 방어적 설계를 권장한다.

---

### 4. [INFO] `pickPlaintextSecret` 이동 — 기능 동일, 신규 취약점 없음

- 위치: `auth-config-types.ts` 라인 799-805
- 상세: `config.key ?? config.token ?? config.secret ?? config.password` 순으로 첫 번째 문자열을 반환하는 함수가 `page.tsx` 에서 `auth-config-types.ts` 로 이동됐다. 로직 변경 없음. 서버 응답에 두 개 이상의 비밀 필드가 동시에 존재할 경우 첫 번째 것만 표시되지만, 이는 기존과 동일한 동작이며 현재 서버 응답 스키마(type당 단일 비밀 필드)에서 문제가 되지 않는다.
- 제안: 평문 비밀 필드 전체 `config` 객체를 React state 에 저장하지 않고 `pickPlaintextSecret` 로 추출한 단일 문자열만 저장하는 현행 패턴이 이미 적절하다.

---

### 5. [INFO] `showPassword` prop — 편집 모드 비밀값 입력 차단 확인(회귀 없음)

- 위치: `auth-config-edit-dialog.tsx` 라인 278, `auth-config-form-fields.tsx` 라인 507
- 상세: 편집 다이얼로그는 `showPassword={false}` 를 명시적으로 전달하므로 basic_auth 비밀번호 입력 필드가 렌더링되지 않는다. 이전 `dialogMode === "edit"` 조건 분기와 동일한 보안 동작이 명시적 prop 으로 대체됐다. 암묵적 조건 분기 대비 명시적 prop 방식이 오용 가능성이 낮다.
- 제안: 없음.

---

### 6. [INFO] `typeDisabled` — UI 제어만, 서버측 검증은 별도 확인 필요(기존 설계, 이번 범위 외)

- 위치: `auth-config-edit-dialog.tsx` 라인 277, `auth-config-form-fields.tsx` 라인 431
- 상세: `disabled={typeDisabled}` 는 HTML `select` 를 비활성화하지만, 브라우저 DevTools 또는 직접 API 호출로 `type` 필드를 변조하면 서버까지 도달할 수 있다. 이는 리팩토링 이전부터 동일한 UI-only 방어 구조다. 서버측 PATCH 엔드포인트가 `type` 필드를 DTO 에서 제외하거나 불변으로 처리하는지 별도 확인을 권장한다.
- 제안: 백엔드 `update-auth-config.dto.ts` 에서 `type` 필드가 허용 목록에서 제외되거나 무시되는지 확인한다. 이번 리팩토링 범위 밖이지만 기존 취약점으로 기록한다.

---

### 7. [INFO] 하드코딩된 시크릿 — 없음

- 위치: 전체 변경 파일
- 상세: API 키, 토큰, 비밀번호, 인증서 등 하드코딩된 시크릿은 존재하지 않는다. 플레이스홀더 문자열(`"X-Hub-Signature-256"`, `"X-API-Key"`, `"10.0.0.0/8\n203.0.113.42"`)은 UI 표시용 예시값이며 실제 인증에 사용되지 않는다.

---

### 8. [INFO] XSS — React 자동 이스케이프 적용, `dangerouslySetInnerHTML` 없음

- 위치: 전체 변경 파일
- 상세: 서버 응답 데이터(`config.name`, `call.triggerName`, `call.sourceIp`, `call.responseCode`, `generatedKey`, `revealedSecret`)는 JSX 텍스트 노드로 렌더링되며, React 의 자동 이스케이프가 적용된다. `dangerouslySetInnerHTML` 사용 없음. 신규 XSS 경로 없음.

---

### 9. [INFO] 인증/인가 — `useHasRole("admin")` 가드 유지(회귀 없음)

- 위치: `page.tsx` (전체 파일 컨텍스트 라인 1495, 1914, 1925)
- 상세: Reveal 버튼과 Edit 버튼에 `{isAdmin && (...)}` 조건이 유지된다. `form.openEdit(config)` 호출이 `isAdmin` 가드 내부에 위치하므로 편집 다이얼로그 진입 경로의 프론트엔드 가드는 보존됐다. 백엔드가 `@Roles('admin')` 으로 2차 강제함을 주석이 명시하고 있다.

---

## 요약

이번 변경은 `authentication/page.tsx` 의 폼 관련 상태(`useState` 11개)와 다이얼로그 분기 로직을 `useAuthConfigForm` 훅, `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`, `auth-config-types.ts` 로 추출한 순수 구조 리팩토링이다. 보안 관점에서 평문 비밀값 표시·전송·검증 경로에 신규 취약점이나 행동 회귀는 발견되지 않는다. 기존 `dialogMode === "edit"` 암묵적 분기로 제어하던 `showPassword`/`typeDisabled` 가 명시적 prop 으로 대체되어 오용 가능성이 오히려 낮아졌다. 주목할 만한 관찰 두 가지: (1) `generatedKey` 에는 `revealedSecret` 에 이미 적용된 30초 자동 hide 타이머가 없으며(기존과 동일, 권장 개선 대상), (2) 편집 폼의 `typeDisabled` 는 UI-only 제어이므로 백엔드 PATCH DTO 에서 `type` 불변을 보장하는지 별도 확인이 필요하다(기존 설계 문제, 이번 리팩토링 범위 외). 두 사항 모두 이번 변경에서 신규로 도입된 것이 아니며, Critical 또는 Warning 수준의 보안 결함은 없다.

---

## 위험도

LOW
