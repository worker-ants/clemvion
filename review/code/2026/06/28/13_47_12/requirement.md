# 요구사항(Requirement) 리뷰 결과

## 대상 파일

`codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx`  
변경 유형: flaky 수정 (단일 버튼 선택 → 다중 버튼 중 첫 번째 선택)

---

## 발견사항

### 1. **[INFO]** `openAddDialog` — findAllByRole + `[0]` 선택의 의도 일치 확인

- 위치: `openAddDialog()` 함수 (diff 기준 43–48행)
- 상세: 변경 의도는 "헤더 버튼(항상 존재) vs EmptyState 버튼(목록 resolve 후 조건부 존재)"으로 두 버튼이 동시에 DOM 에 존재할 수 있는 타이밍 레이스를 제거하는 것이다. `page.tsx` 를 확인하면:
  - 헤더: `line 758–763` — `<RoleGate minRole="editor"><Button>` 안의 Add Schedule 버튼 (항상 렌더)
  - EmptyState: `line 960–973` — `schedules.length === 0 && !isLoading && !isError` 조건부 렌더
  - 두 버튼 모두 `t("schedules.addSchedule")` → i18n 키 `"Add Schedule"` 을 사용하므로 `findAllByRole("button", { name: /add schedule/i })` 에 동시에 매칭 가능하다는 주석의 전제는 정확하다.
  - `addBtns[0]` — React 렌더 순서상 헤더 버튼이 DOM 에서 항상 먼저 나타나므로 (헤더는 JSX 위쪽, EmptyState 는 아래쪽) 첫 번째 매칭이 헤더 버튼임은 보장된다.
- 제안: 현재 구현 문제없음. 다만 명시적 `getAllByRole` 인덱싱 대신 `findByRole` 에 `selector` 를 추가하거나 `data-testid` 를 부여하면 더 견고하지만, 이는 선택 사항이며 요구사항 충족 측면에서 결함이 아니다.

### 2. **[INFO]** 테스트 커버리지 — RBAC viewer 쪽 `queryByTitle` 사용 (변경 미포함 영역)

- 위치: `schedules-page.test.tsx` line 443–444 (Viewer 케이스)
- 상세: 이번 diff 와 무관하나, viewer 케이스에서 `queryByTitle(/^edit$/i)` / `queryByTitle(/^delete$/i)` 를 사용하는 반면, `page.tsx` 는 `aria-label` 만 사용하고 `title` attribute 는 없다. 이는 기존부터 존재하는 테스트 로직 결함이지만, 결과적으로 두 쿼리가 `null` 을 반환(title 없으므로)하여 `toBeNull()` 이 통과하는 false-positive 상태다.
- 제안: `queryByTitle` → `queryByRole("button", { name: /^edit$/i })` 로 교정해야 실제 RBAC 차단을 검증할 수 있다. 이번 변경 범위 밖이므로 WARNING 이 아닌 INFO 로 분류하나, 후속 개선 대상이다.

### 3. **[INFO]** spec fidelity — spec §2.2.1 표 "빈 cron에서 시각 탭 진입" 동작 검증 테스트 존재

- 위치: `it("Visual 탭으로 전환만 해도 기본 cron(0 9 * * *)이 즉시 emit …")` (line 252–259)
- 상세: spec §2.2.1 세 번째 행 "빈 cron 에서 시각 탭 진입 → 디폴트 시각 state(daily 09:00) 의 cron 을 즉시 적용" 이 테스트로 커버된다. 기본값 `0 9 * * *` 는 spec 명시값과 일치한다 (`page.tsx` `DEFAULT_VISUAL_STATE` → `buildCronFromVisual` 결과 = `0 9 * * *`).

### 4. **[INFO]** spec fidelity — 표현 불가 cron 안내 메시지 텍스트

- 위치: 테스트 line 336–337, 337–338: `getByText(/cannot be represented in the visual editor/i)`
- 상세: spec §2.2.1 "표현 불가 cron … 시각 탭에서 안내 메시지를 표시" 와 일치. i18n 키 `expressionNotRepresentable` 의 영문 값(`"This expression cannot be represented in the visual editor. Changing any visual control will overwrite the expression."`) 도 패턴에 부합.

### 5. **[INFO]** 기존 코드 영역: `deleteMessage` 텍스트가 spec §3 "연결된 트리거도 함께 삭제됩니다" 안내 포함 여부 미검증

- 위치: `page.tsx` line 928 `{t("schedules.deleteMessage")}`
- 상세: spec §3 "확인 다이얼로그에 '연결된 트리거도 함께 삭제됩니다' 안내" 라고 명시하나 테스트에서 해당 문구 검증이 없다. 이번 diff 와 무관하므로 INFO.

---

## 요약

이번 변경은 `openAddDialog` 헬퍼 함수에서 `findByRole`(단수) 대신 `findAllByRole` + `[0]`(첫 번째 버튼)을 사용하도록 수정한 것으로, flaky 원인(EmptyState resolve 타이밍에 따라 동일 접근성 이름 버튼이 2개 매칭되어 `findByRole` throw 발생)을 정확히 식별하고 올바르게 수정하였다. 주석이 상황을 명확히 설명하며, `page.tsx` 렌더 구조와 일치한다. spec §2.2.1 의 시각 편집기 양방향 변환·표현 불가 cron 안내 등 핵심 비즈니스 요구사항 케이스도 모두 기존 테스트에서 커버되고 있다. 기능 완전성·비즈니스 로직·spec fidelity 측면에서 결함이 없다. 발견된 기존 코드의 `queryByTitle` false-positive 는 이번 변경 외 별도 개선 사항으로 요구사항 위배 수준이 아니다.

## 위험도

LOW
