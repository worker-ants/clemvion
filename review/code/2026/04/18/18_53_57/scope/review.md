### 발견사항

- **[WARNING]** `formatDuration` 함수 추출 및 동작 변경
  - 위치: `frontend/src/app/(main)/dashboard/page.tsx` (88~96번 줄 제거), `execution-list-page.test.tsx` (106번 줄)
  - 상세: `dashboard/page.tsx`에 로컬로 정의되어 있던 `formatDuration`이 제거되고 `@/lib/utils/date`에서 import됩니다. 이 변경의 사이드이펙트로 `execution-list-page.test.tsx`의 기대값이 `"1.0s"` → `"1s"`로 변경되었습니다. 이는 i18n 목적과 직접 관련이 없는 동작 변경이 포함된 리팩토링입니다.
  - 제안: `formatDuration` 추출은 별도 PR로 분리하거나, 적어도 변경 이유와 동작 차이를 명시해야 합니다.

- **[INFO]** `STATUS_LABEL` → `getStatusLabel()` 구조 변경
  - 위치: `frontend/src/app/(main)/workflows/[id]/executions/page.tsx`
  - 상세: 정적 객체 `STATUS_LABEL` import를 함수 `getStatusLabel()` import로 교체했습니다. 함수 내부 구현을 보지 않고도 locale 연동이 목적임을 짐작할 수 있으므로 i18n 범위 내로 판단하나, 호출 인터페이스 변경이 포함된 점은 언급할 가치가 있습니다.

- **[INFO]** 다수 파일에서 무관한 주석 삭제
  - 위치: `accept-invitation-content.tsx` ("Refresh the workspace list..."), `integration-selector.tsx` ("Only flag 'missing'..."), `canvas-empty-state.tsx` (6줄 JSDoc), `security/page.tsx` ("user 객체에 twoFactorEnabled...")
  - 상세: 순수 i18n 치환 작업과 무관한 설명 주석들이 함께 삭제되었습니다. 코드 품질 향상 의도로 보이나, 변경 범위를 넓힙니다.
  - 제안: 주석 정리는 i18n PR과 분리하거나 CLAUDE.md 지침("no comments")에 따른 의도적 정리임을 명시하세요.

- **[INFO]** `docs/[...slug]/page.tsx`에 `generateMetadata`용 주석 추가
  - 위치: 31번 줄
  - 상세: i18n 동작을 설명하는 주석이 추가되었습니다. 내용은 유효하나, 기존 코드에는 없던 주석이 추가된 점에서 범위 확장입니다.

### 요약

전체적으로 변경사항은 i18n 마이그레이션 범위에 잘 부합합니다. auth form의 Inner/Outer 컴포넌트 분리는 `key={locale}` 리마운트 패턴을 통해 Zod 유효성 메시지를 locale에 맞게 갱신하기 위한 필수 조치이므로 범위 내 정당한 변경입니다. 다만 `formatDuration` 함수 추출이 동작 변경(`"1.0s"` → `"1s"`)을 동반하며 별도 리팩토링으로 분리되지 않은 점, 그리고 여러 파일에 걸친 무관한 주석 삭제가 이 PR의 변경 범위를 다소 확장시키고 있습니다.

### 위험도

**LOW**