### 발견사항

---

**[WARNING]** Zod 스키마가 컴포넌트 렌더 함수 내부에서 매 렌더마다 재생성됨
- 위치: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` (각 컴포넌트 상단)
- 상세: `z.object()`가 컴포넌트 본문 내에 정의되어 매 렌더마다 새 스키마 인스턴스가 생성됨. `react-hook-form`의 `useForm({ resolver: zodResolver(schema) })`는 최초 마운트 시 resolver를 캡처하므로 이후 렌더에서 생성된 새 스키마는 무시되지만, 불필요한 객체 생성이 매 렌더마다 발생함. 또한 로케일이 변경되어도 이미 등록된 `useForm`의 resolver는 갱신되지 않아 **언어 전환 시 검증 메시지가 이전 언어로 표시될 수 있음**.
- 제안:
```typescript
const createLoginSchema = (t: TFunction) => z.object({ ... });
// 컴포넌트 내부:
const loginSchema = useMemo(() => createLoginSchema(t), [t]);
const form = useForm({ resolver: zodResolver(loginSchema) });
```

---

**[WARNING]** `STATUS_FILTERS`의 "all" 항목이 잘못된 번역 키를 참조함
- 위치: `integrations/page.tsx`, `STATUS_FILTERS` 배열 첫 번째 항목
- 상세: status 필터의 "all"이 `"integrations.scopeAll"` 키를 사용하고 있음. 이는 scope 필터의 "All"과 동일한 키로, 의도적이라면 문제없지만 `"integrations.statusAll"` 같은 별도 키를 써야 의미론적으로 분리됨. 현재는 우연히 같은 텍스트여서 동작하지만 향후 번역이 달라질 경우 silent bug가 됨.
- 제안: `{ value: "all", labelKey: "integrations.statusAll" }` 로 분리하고 딕셔너리에 `statusAll` 키 추가.

---

**[WARNING]** `Section` 컴포넌트에 전달된 `t` 파라미터가 실제로 사용되지 않음
- 위치: `integrations/page.tsx:368–390`, `void t;`
- 상세: `t: TFunction`을 props로 받지만 `void t;` 로 억제만 하고 실제 사용처가 없음. `IntegrationCard` 컴포넌트 내부에서 별도로 번역이 필요한 경우 이 `t`를 드릴다운해야 할 계획이었을 가능성이 있으나, 현재 구현에서는 데드 코드.
- 제안: `t` prop을 제거하거나, `IntegrationCard` 내부에서 직접 `useT()`를 호출하여 제거.

---

**[INFO]** `formatDate` 호출 시 로케일 파라미터 미전달 (실행 이력 페이지)
- 위치: `workflows/[id]/executions/page.tsx`, `workflows/[id]/executions/[executionId]/page.tsx` (총 3군데)
- 상세: `formatDate(execution.startedAt, "datetime")` 형태로 호출 시 `locale` 파라미터를 생략함. `currentLocale()`이 Zustand 스토어를 읽으므로 런타임 동작은 올바르나, 테스트에서는 명시적으로 locale을 넘기는 패턴과 불일치함.
- 제안: `formatDate(execution.startedAt, "datetime", locale)` 형태로 맞추거나 현재 방식을 문서화.

---

**[INFO]** `t`를 `useEffect` 의존성 배열에 추가하는 것의 영향
- 위치: `verify-email-content.tsx:57`, `accept-invitation-content.tsx:60`
- 상세: `t`가 `useCallback`으로 memoized되어 로케일이 바뀔 때만 참조가 교체됨. 로케일 변경 시 `useEffect`가 재실행되어 인증/초대 수락 API가 재호출될 수 있음. 이 페이지들은 이미 완료 상태(`status === "success"`)를 확인하지 않고 재실행되는 구조.
- 제안: `status` 상태가 이미 `"success"`나 `"error"`인 경우 early return으로 API 재호출을 방지하거나, `t`를 effect 내부에서 직접 `translate()` 호출로 대체하여 의존성 제거.

---

**[INFO]** `date.ts`의 `"date"` 포맷 처리가 암묵적으로 default branch에 위임됨
- 위치: `date.ts:58–70`
- 상세: 기존 코드에는 `format === "date"` 명시 분기가 있었지만 새 코드에서는 제거됨. 현재는 default 분기로 처리되어 동작은 동일하나 가독성이 떨어짐. 테스트로 커버되어 있으므로 동작상 문제는 없음.

---

### 요약

i18n 작업은 전반적으로 완성도가 높고 한국어·영어 딕셔너리가 누락 없이 일치하며, `TranslationKey` 타입 안전성, Zustand 기반 locale 스토어, `LocaleSync` 컴포넌트를 통한 초기화 체계가 잘 갖춰져 있다. 그러나 Zod 스키마를 렌더 함수 내부에 정의하는 패턴이 언어 전환 시 검증 메시지가 갱신되지 않는 실질적 버그를 유발할 수 있으며, `STATUS_FILTERS`의 잘못된 키 참조와 `Section`의 미사용 `t` prop이 보수성 관점에서 정리가 필요하다.

### 위험도

**MEDIUM**