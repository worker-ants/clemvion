이제 충분한 정보를 수집했습니다. 테스팅 관점의 코드 리뷰를 작성하겠습니다.

---

## Testing Code Review

### 발견사항

---

**[WARNING] `formatDate` / `timeAgo` — 스토어 로케일 폴백(no-locale-arg) 테스트 누락**
- 위치: `src/lib/utils/__tests__/date.test.ts`
- 상세: `formatDuration`은 스토어 로케일을 사용하는 경우를 테스트하지만(line 84-87), `formatDate`와 `timeAgo`는 동일한 `currentLocale()` 호출을 사용함에도 해당 케이스 테스트가 없음. 세 함수 모두 `locale` 파라미터 생략 시 동일한 코드 경로를 사용하므로 일관된 커버리지가 필요.
- 제안:
  ```ts
  it("formatDate uses locale from store when no locale is passed", () => {
    useLocaleStore.setState({ locale: "ko" });
    const result = formatDate("2026-01-15T12:00:00Z", "date");
    expect(result).toContain("2026");
    expect(result).toMatch(/1월|Jan/); // ko → 1월
  });
  ```

---

**[WARNING] `formatDate` — 잘못된 날짜 입력 엣지 케이스 미검증**
- 위치: `src/lib/utils/__tests__/date.test.ts`
- 상세: `new Date("invalid")` → `Invalid Date`가 되면 `toLocaleDateString()` 등이 `"Invalid Date"` 문자열을 반환함. AGENTS.md 규약에 따라 모든 datetime 표기는 이 함수를 거쳐야 하므로, API가 비정상 값을 반환하는 경우 무결성이 보장되어야 함. 현재 해당 케이스는 전혀 테스트되지 않음.
- 제안: 빈 문자열, `null`로 캐스팅된 입력, `"not-a-date"` 등에 대한 동작을 명시적으로 문서화하거나 테스트로 고정할 것.

---

**[WARNING] `filterRootVariablesByScope` — 완전한 테스트 없음**
- 위치: `src/components/editor/expression/expression-constants.ts`
- 상세: `filterRootVariablesByScope`는 `$loop`, `$item`, `$itemIndex`가 컨테이너 밖에서 노출되지 않도록 제어하는 핵심 로직임. 이 PR의 주요 목적(범위 기반 변수 가시성)과 직결됨에도 테스트 파일이 존재하지 않음.
- 제안:
  ```ts
  // expression-constants.test.ts
  it("hides loop-scoped variables when hasLoop is false", () => {
    const result = filterRootVariablesByScope(ROOT_VARIABLES, { hasLoop: false, hasItem: false });
    expect(result.find(v => v.label === "$loop")).toBeUndefined();
    expect(result.find(v => v.label === "$now")).toBeDefined();
  });
  ```

---

**[WARNING] `$today` 제거 회귀 테스트 누락**
- 위치: `src/components/editor/expression/expression-constants.ts`
- 상세: 이 PR의 핵심 목적은 `$today`를 제거하는 것임. `ROOT_VARIABLES`에 `$today`가 없다는 것을 명시적으로 검증하는 회귀 테스트가 없음. 누군가 실수로 재추가해도 CI가 잡지 못함.
- 제안:
  ```ts
  it("does not expose $today", () => {
    expect(ROOT_VARIABLES.find(v => v.label === "$today")).toBeUndefined();
    expect(BUILT_IN_PICKER_VARIABLES.find(v => v.label === "$today")).toBeUndefined();
  });
  ```

---

**[WARNING] `isSafeUrl` — 보안 관련 함수임에도 테스트 없음**
- 위치: `src/components/editor/run-results/button-bar.tsx:33-39`
- 상세: URL이 `http:`/`https:`인지 검사해 XSS를 방지하는 함수임. `javascript:`, `data:`, 상대 경로 등 여러 공격 벡터를 막아야 하지만 테스트가 전혀 없음. 유틸 파일로 분리 후 단위 테스트를 추가하거나 최소한 same-file 테스트가 필요.
- 제안: `javascript:alert(1)`, `data:text/html,<h1>test</h1>`, `//evil.com`, 유효한 `https://...` 케이스를 모두 검증.

---

**[INFO] `formatDate("time", ...)` 테스트가 TZ에 의존적**
- 위치: `src/lib/utils/__tests__/date.test.ts:129-135`
- 상세: 테스트가 `^\d{1,2}:\d{2}(\s?[AP]M)?$` 정규식으로 형식만 검증함. 코멘트에서 "the test runner's TZ is environment-dependent"라고 명시해 사실상 실질 값 검증을 포기함. 이는 잘못된 로케일 포맷(예: `ko-KR`에서 `시` 접미사 포함 여부)이나 12h/24h 전환 버그를 잡지 못함.
- 제안: `TZ=UTC` 환경변수를 vitest config에 고정하거나, `vi.setSystemTime` + `{ timeZone: "UTC" }` Intl 오버라이드로 결정론적 테스트 환경을 구성.

---

**[INFO] `summarizeToolResult` — export 되어 있으나 테스트 없음**
- 위치: `src/components/editor/run-results/conversation-inspector.tsx:217-245`
- 상세: `SUMMARY_STRING_MAX`, `SUMMARY_VALUE_MAX`와 함께 `export`되어 있어 테스트 대상임을 암시하지만, 실제 테스트 파일이 없음. Array, 빈 객체, 긴 문자열 truncation, 중첩 객체 요약 등 복잡한 로직을 포함하고 있음.
- 제안: `__tests__/conversation-inspector.test.ts` 파일에 `summarizeToolResult` 단위 테스트 추가.

---

**[INFO] `getWebhookUrl` — 포트 치환 정규식이 중복 구현됨, 테스트 없음**
- 위치: `src/components/triggers/trigger-detail-drawer.tsx:226-231`, `src/app/(main)/triggers/page.tsx:199-204`
- 상세: `window.location.origin.replace(/:\d+$/, ":3011")` 로직이 두 파일에 동일하게 존재. 유틸 함수로 분리가 필요하며, 포트 치환 정규식(`3000` → `3011`, 포트 없는 경우, `443`인 경우 등)에 대한 테스트도 없음.
- 제안: `src/lib/utils/webhook.ts`로 추출 후 단위 테스트 추가.

---

**[INFO] `getRunDaysInMonth` — 월 경계 cron 계산 로직에 테스트 없음**
- 위치: `src/app/(main)/schedules/page.tsx:98-125`
- 상세: cron 파싱 후 월 내 실행일을 계산하는 복잡한 로직. DST 전환, 2월 28/29일, 월말 `31 * * *` 표현식 등 엣지 케이스에서 미묘한 버그가 발생할 수 있으나 테스트가 없음.

---

**[INFO] 백엔드 표현식 테스트 파일 접근 불가**
- 위치: `backend/`, `packages/expression-engine/`
- 상세: `expression-resolver.service.spec.ts`, `expression.spec.ts`, `evaluator.ts`는 현재 working directory 범위 외부에 있어 내용을 확인할 수 없었음. 이 PR의 핵심 변경인 `$today` 제거가 표현식 엔진 레벨에서 올바르게 테스트되었는지 검증이 필요함.
- 제안: 리뷰어가 해당 파일들을 직접 확인해 `$today` 참조 시 에러/undefined 반환 여부, 기존 `$now` 동작 유지 여부를 확인할 것.

---

### 요약

`date.ts` / `date.test.ts`의 핵심 리팩토링은 주요 경로(`timeAgo`, `formatDuration`, `formatDate`)에 대한 단위 테스트가 잘 구성되어 있고, fake timer와 locale store 격리도 올바르게 처리됨. 그러나 세 가지 주요 갭이 존재한다: ① PR의 핵심 목적인 `$today` 제거를 회귀 테스트로 고정하지 않아 재도입 방지가 없고, ② 변수 범위 제어의 핵심인 `filterRootVariablesByScope` 함수에 테스트가 없으며, ③ 보안 관련 `isSafeUrl`이 테스트 없이 운영됨. UI 컴포넌트들은 모두 `formatDate` 규약을 잘 따르고 있으나, 컴포넌트 레벨 통합 테스트는 전무함.

### 위험도

**MEDIUM**