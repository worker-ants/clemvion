### 발견사항

---

**[WARNING]** `canvas-empty-state.tsx`에서 비자명 접근성 구현 설명 제거

- **위치**: `src/components/editor/canvas/canvas-empty-state.tsx` — 제거된 docstring
- **상세**: `visible=false` 상태에서 `opacity-0 + pointer-events-none + aria-hidden` 조합을 사용하는 이유(DOM 유지 + 접근성 제외), `isWorkflowEmpty` 표시 기준이 docstring으로 명시되어 있었으나 삭제됨. 이 동작은 단순히 코드만으로는 추론하기 어려운 non-obvious한 설계 결정임.
- **제안**: 컴포넌트 상단에 짧은 한 줄 주석으로 핵심 WHY만 유지: `// DOM 유지하되 aria-hidden+pointer-events-none으로 접근성/상호작용에서 제외`

---

**[WARNING]** `integration-selector.tsx`에서 timing 관련 주석 제거

- **위치**: `src/components/editor/settings-panel/node-configs/integration-selector.tsx` — `hasSavedButMissing` 로직 위
- **상세**: `"Only flag 'missing' once the list has actually loaded — otherwise the option flashes during initial fetch"` 주석 삭제. 이 조건부 로직의 이유(초기 fetch 중 깜빡임 방지)는 코드만으로는 파악하기 어려운 UX 버그 방지 목적.
- **제안**: `// 로드 완료 전에는 missing 표시 금지 — fetch 중 값이 있을 때 깜빡임 방지` 한 줄 복원

---

**[WARNING]** README에 `TFunction` 타입 및 docs 관련 신규 컴포넌트 미문서화

- **위치**: `frontend/README.md` — i18n Architecture 섹션
- **상세**: `reset-password-form.tsx`, `integration-selector.tsx` 등에서 `TFunction` 타입이 export되어 사용되나 README에 언급 없음. 또한 `DocHeader`, `DocBodyNotice` 컴포넌트와 `@/lib/docs/locale` 유틸리티가 docs 페이지에 도입되었으나 Architecture 다이어그램 및 설명에서 누락됨.
- **제안**: Architecture 섹션에 다음 추가:
  ```
  src/components/docs/doc-header.tsx   # locale-aware 문서 제목 렌더링
  src/components/docs/doc-body-notice.tsx  # 영문 세션 시 번역 안내 배너
  src/lib/docs/locale.ts               # frontmatter locale 선택 유틸
  ```
  그리고 "Call `useT()`..." 항목 아래 `TFunction` 타입 export 언급 추가.

---

**[INFO]** `security/page.tsx`에서 `twoFactorEnabled` 필드 가정 주석 제거

- **위치**: `src/app/(main)/profile/security/page.tsx`
- **상세**: `// user 객체에 twoFactorEnabled 필드가 있다고 가정 (백엔드가 노출 시)` 주석 삭제. 타입 캐스팅(`user as { twoFactorEnabled?: boolean }`)이 왜 필요한지 맥락이 사라짐.
- **제안**: 타입 캐스팅 라인 위에 한 줄: `// twoFactorEnabled는 백엔드 /users/me 응답에 포함 시 동작` 유지 권장

---

**[INFO]** `accept-invitation-content.tsx`에서 워크스페이스 새로고침 목적 주석 제거

- **위치**: `src/app/(main)/invitations/accept/accept-invitation-content.tsx`
- **상세**: `// Refresh the workspace list and switch to the newly-joined one so / // the user lands inside the right context immediately.` 제거됨. `list()` + `switchWorkspace()` 연속 호출의 의도를 설명하던 주석.
- **제안**: 해당 로직이 충분히 명확하다면 유지 불필요. 단, `switchWorkspace(result.workspaceId)` 직전에 한 줄 `// 합류한 워크스페이스로 즉시 전환` 추가 고려

---

**[INFO]** README에 `LocaleSync` 마운트 위치 미명시

- **위치**: `frontend/README.md` — Architecture 섹션
- **상세**: `locale-sync.tsx`가 언급되나 실제로 앱 트리 어디(Provider, layout 등)에 마운트되는지 설명 없음. 처음 구조를 파악하는 개발자가 찾기 어려울 수 있음.
- **제안**: `<LocaleSync />` 설명에 "앱 루트 레이아웃(또는 AuthProvider)에 마운트" 한 줄 추가

---

### 요약

이번 변경은 프론트엔드 전체에 걸쳐 하드코딩된 문자열을 i18n 시스템으로 마이그레이션한 대규모 작업으로, `README.md`에 추가된 i18n 아키텍처 문서는 구조·가이드·테스트 설정 패턴을 잘 설명하고 있다. 다만 리팩터링 과정에서 `canvas-empty-state.tsx`의 접근성 구현 의도, `integration-selector.tsx`의 timing 관련 버그 방지 로직 등 non-obvious한 WHY를 설명하던 주석들이 일부 삭제되어 향후 유지보수 시 맥락 파악이 어려울 수 있다. README에는 신규 도입된 `TFunction` 타입, `DocHeader`/`DocBodyNotice` 컴포넌트, `@/lib/docs/locale` 유틸리티에 대한 문서가 보완되면 완성도가 높아진다.

### 위험도
**LOW**