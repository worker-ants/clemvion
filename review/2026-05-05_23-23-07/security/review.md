## 보안 코드 리뷰

### 발견사항

- **[INFO]** `buildCronFromVisual` 에서 `VisualState` 값 범위 검증 없음
  - 위치: `cron-to-visual.ts:131-155` (`buildCronFromVisual`)
  - 상세: `minute`, `hour`, `dayOfMonth` 값을 직접 템플릿 리터럴에 삽입하지만 범위 검증이 없음. `parseCronToVisualOrNull`은 검증 후 반환하지만, 외부 코드가 직접 `VisualState`를 구성해서 넘기면 범위 초과 값이 cron 문자열에 삽입될 수 있음 (예: `minute: 999` → `"999 9 * * *"`). UI의 `<select>` 드롭다운이 범위를 강제하므로 현재 공격 경로는 없으나, 유틸이 퍼블릭 API로 노출될 경우 방어 부재.
  - 제안: 노출 범위가 확대될 경우 `buildCronFromVisual` 내부에 `Math.min/max` 클램핑 또는 assert 추가.

- **[INFO]** 클라이언트 전용 RBAC — 기존 패턴이지만 이번 변경으로 확인
  - 위치: `page.tsx` — `<RoleGate minRole="editor">` 래퍼
  - 상세: `RoleGate`는 UI 렌더링만 제어하며, `createMutation`/`updateMutation`/`deleteMutation` API 호출 자체를 막지 않음. 브라우저 콘솔에서 직접 fetch를 실행하면 RBAC 우회 가능. 이번에 추가된 변경사항이 만든 문제는 아님.
  - 제안: 백엔드 API 레이어에서 역할 기반 인가를 반드시 검증해야 함 (신규 도입 아님, 기존 패턴).

- **[INFO]** `formTimezone` 입력값 검증 없음
  - 위치: `page.tsx` — `setFormTimezone(e.target.value)` 및 API 전송 부분
  - 상세: 타임존 문자열을 자유 텍스트로 입력받아 API로 전송함. IANA 타임존 패턴 검증 없이 임의 문자열이 전달됨. 이번 변경에서 도입된 것은 아니지만 코드 내 존재.
  - 제안: IANA 타임존 화이트리스트 or 정규식(`/^[A-Za-z_\/+\-]+$/`) 검증 추가.

- **[INFO]** `parseCronToVisualOrNull`이 매 render마다 호출됨
  - 위치: `page.tsx:863-866` — `cronCannotRepresent` prop 계산
  - 상세: Visual 탭이 활성화된 상태에서 부모 컴포넌트가 re-render될 때마다 `parseCronToVisualOrNull(formCron)`이 재실행됨. 이 함수 자체는 순수 함수이고 ReDoS 위험 없는 단순 정규식(`/^\d+$/`, `/\s+/`)을 사용하므로 성능/보안 영향은 없음.

### 긍정적 관찰

- `parseCronToVisualOrNull`: `null`/`undefined` 타입 방어, 빈 문자열, 필드 수 불일치, 범위 초과, step/range 표현식 전부 `null` 반환 — 입력 검증이 철저하게 구현됨.
- 모든 동적 cron 문자열 렌더링(`<code>`, `<p>`)이 React JSX를 통해 이루어져 XSS 자동 이스케이프 적용됨.
- `getNextRuns`, `getRunDaysInMonth`에서 외부 라이브러리(`CronExpressionParser`) 호출을 try-catch로 감싸 예외 전파 방지.
- `selectedDays` 정수 배열에 `Set` 중복 제거 + 정렬 적용 — 외부 입력 정규화가 일관됨.

---

### 요약

이번 변경은 cron ↔ 시각 편집기 양방향 동기화를 위한 순수 프론트엔드 유틸리티 추가 및 상태 lift 리팩토링으로, 보안 관점에서 신규 도입된 취약점은 없다. `parseCronToVisualOrNull`은 정규식 기반 화이트리스트 파싱으로 ReDoS 및 인젝션에 안전하며, 모든 렌더링은 React의 기본 이스케이프를 통해 XSS로부터 보호된다. 지적한 INFO 항목들은 모두 기존 코드베이스에 존재하던 패턴이거나 내부 상태에만 영향을 주는 경미한 사항이다.

### 위험도

**LOW**