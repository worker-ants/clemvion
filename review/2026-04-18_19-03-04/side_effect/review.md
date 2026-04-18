---

## 발견사항

### [WARNING] `STATUS_LABEL` 상수 제거 → `getStatusLabel()` 함수로 교체
- **위치**: `execution-status.ts`
- **상세**: `STATUS_LABEL` export가 완전히 제거되고 `getStatusLabel(status, locale?)` 함수로 대체됨. 테스트에서는 import를 업데이트했으나, 현재 diff 범위 외의 다른 소비 코드가 없음을 확인 (grep 결과 `STATUS_LABEL` 직접 사용 없음). 안전하나 향후 명시적 export 문서화 권장.
- **제안**: 문제 없음. 단, `execution-status.ts` public API 변경이므로 CHANGELOG 기록 권장.

---

### [WARNING] `"use client"` 추가 → `date.ts`, `execution-status.ts`가 Server Component에서 사용 불가
- **위치**: `date.ts:1`, `execution-status.ts:1`
- **상세**: 두 파일 모두 `useLocaleStore` (Zustand, 클라이언트 전용)를 import하면서 `"use client"` 지시문이 추가됨. 이로 인해 이 파일들을 import하는 모든 Server Component는 빌드 에러가 발생함. 현재 호출자(`dashboard/page.tsx`, `executions/page.tsx` 등)가 Server Component인지 Client Component인지에 따라 실제 영향이 달라짐.
- **제안**: 해당 페이지들이 Server Component라면 `"use client"` 경계를 올바르게 분리해야 함. 각 페이지가 이미 `"use client"`인지 확인 필요.

---

### [WARNING] `formatDuration(59999)` 경계값 동작 변경 (`execution-status.ts`)
- **위치**: `execution-status.ts`, `formatDuration` 함수
- **상세**: 기존 `formatDuration(59999)` → `"60.0s"` 였으나, 이제 내부 로직이 `seconds = 59.999 → toFixed(1) = "60.0" → Number = 60`이 되어 `60 < 60`이 false가 되므로 minutes 분기로 넘어가 `"1m 0s"`가 반환됨. 기존 테스트 케이스 `expect(formatDuration(59999)).toBe("60.0s")`가 제거되었고 이 동작은 실제로 더 자연스럽지만, 기존 UI에서 60초 부근 표시가 변경됨.
- **제안**: 동작 변경이 의도적이면 OK. 아니라면 `Math.floor`를 사용하여 `59999ms → 59s`로 처리하도록 수정.

---

### [WARNING] `date.ts`와 `execution-status.ts`에 동명 `formatDuration` 함수 존재, 동작 불일치
- **위치**: `date.ts:39`, `execution-status.ts:48`
- **상세**: 두 파일 모두 `formatDuration`을 export하지만 동작이 다름:
  - `date.ts`: `Math.floor`로 정수 초 처리 (`1500ms → "1s"`)
  - `execution-status.ts`: `toFixed(1)` + `Number()` 처리 (`1500ms → "1.5s"`)
  - `execution-status.ts` 버전만 `null` 입력을 처리함 (`null → "—"`)
- **제안**: 개발자 혼란 방지를 위해 한 구현으로 통합하거나, 각 함수의 목적이 다름을 명확히 문서화.

---

### [INFO] locale 없이 호출되는 기존 코드들 (`timeAgo`, `formatDate`, `formatDuration`)
- **위치**: `dashboard/page.tsx`, `executions/page.tsx`, `result-timeline.tsx`, `result-detail.tsx` 등 다수
- **상세**: locale 인수 없이 호출하면 `useLocaleStore.getState().locale`을 fallback으로 사용함. 이는 의도된 동작이며 기능적으로는 정상이나, React 렌더 사이클 밖에서 호출 시 locale 변경에 반응하지 않음 (비반응적 읽기).
- **제안**: 문제 없음. Zustand의 `getState()` 패턴은 클라이언트 유틸리티에서 표준적으로 사용됨.

---

### [INFO] `navItems` 구조 변경 (`label` → `labelKey`)
- **위치**: `sidebar.tsx`
- **상세**: module-level 상수가 변경되었으나 `sidebar.tsx` 내부에서만 사용됨. 외부 노출 없음.

---

### [INFO] `LocaleSync` 컴포넌트가 React 트리에 추가됨
- **위치**: `providers.tsx`
- **상세**: 모든 페이지의 Provider 트리에 `<LocaleSync />`가 마운트됨. 사용자 프로필로부터 locale을 동기화하는 의도된 side effect이며, 설계 범위 내 동작.

---

## 요약

이번 변경의 핵심 위험은 **`"use client"` 추가로 인한 Server Component 호환성 손실**과 **`execution-status.ts`의 `formatDuration` 60초 경계값 동작 변경**이다. `STATUS_LABEL` → `getStatusLabel()` 교체는 이미 모든 소비 코드가 업데이트되어 실질적 파손이 없으며, locale 미전달 호출은 store fallback으로 안전하게 처리된다. 나머지 변경들(선택적 파라미터 추가, 인터페이스 확장)은 모두 하위 호환적이다.

## 위험도

**MEDIUM** — `"use client"` 지시문이 기존에 서버 컨텍스트에서 사용되던 유틸리티에 추가된 점과 `formatDuration` 동작 변경이 프로덕션 UI에 영향을 줄 수 있으나, 두 이슈 모두 영향 범위가 제한적이고 수정이 용이함.