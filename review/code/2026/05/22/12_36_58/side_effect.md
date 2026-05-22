# 부작용(Side Effect) 리뷰 결과

검토 대상 커밋: `b3820314` — `feat(triggers): row ⋮ dropdown + type-specific delete confirmation (Plan A)`
검토 일시: 2026-05-22

---

## 발견사항

### [WARNING] `TriggerDeleteDialog` 내 `queryClient.invalidateQueries` — 별도 컴포넌트에서 전역 캐시 부작용
- 위치: `/codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` 라인 66, 73
- 상세: `TriggerDeleteDialog` 는 자신만의 `useQueryClient()` 훅을 호출해 `queryKey: ["triggers"]` 전체를 invalidate 한다. 이 컴포넌트가 `page.tsx` 이외의 다른 화면에서 재사용될 경우, 해당 화면이 `["triggers", ...]` 쿼리를 사용하지 않더라도 같은 이름의 쿼리가 다른 컴포넌트에 있다면 의도하지 않은 refetch 가 발생한다. 현재는 `page.tsx` 단독 사용이라 문제가 없으나, 컴포넌트 자체가 글로벌 쿼리 상태에 쓰기 작업을 수행하는 점은 재사용 위험 요소다.
- 제안: `onClose` 콜백과 별도로 `onDeleted?: () => void` prop 을 통해 캐시 무효화 책임을 호출자(page.tsx)에 위임하거나, 현재 패턴을 JSDoc 으로 명시하여 재사용 시 주의를 안내한다.

### [WARNING] `getWebhookUrl` — `window.location.origin` 직접 참조 및 포트 하드코딩
- 위치: `/codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 220–224
- 상세: 이 함수는 기존 코드에도 존재하며 이번 변경에서 새로 추가된 것은 아니다. 그러나 이번 PR 에서 삭제 다이얼로그로 전달되는 `webhookUrl` 을 생성하는 데 처음으로 이 함수가 적극적으로 사용된다. `window.location.origin.replace(/:\d+$/, ":3011")` 패턴은 클라이언트 환경에서 포트를 `:3011` 로 강제 교체하는 부작용이 있다. 프로덕션 배포 시 기본 포트(443/80)를 사용하는 경우 의도하지 않게 `:3011` 로 변경된 URL 이 삭제 확인 모달에 노출된다.
- 제안: 이 패턴이 개발 환경 편의를 위한 것이라면, 환경 변수(`NEXT_PUBLIC_WEBHOOK_BASE_URL`) 를 도입해 프로덕션에서는 올바른 URL 이 사용되도록 분리해야 한다.

### [INFO] `deleteTarget` 상태 — 공유 상태가 아닌 컴포넌트 로컬이나 동시 다중 다이얼로그 방지
- 위치: `/codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 88–90
- 상세: `deleteTarget` 은 `useState` 로 선언된 컴포넌트 로컬 상태이므로 전역 부작용은 없다. 다만 `TriggerDeleteDialog` 의 `key={props.trigger?.id ?? "__none__"}` 패턴으로 trigger 변경 시 내부 `confirmText` 상태가 자동 초기화되는 설계는 의도적이며, side effect 관점에서 올바른 패턴이다.

### [INFO] `useHasRole("editor")` — 새로운 훅 Import
- 위치: `/codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 30, 91
- 상세: 기존 `RoleGate` 컴포넌트 외에 `useHasRole` 훅을 추가로 import 하고 있다. 이 훅은 이미 `role-gate.tsx` 에 export 되어 있어 (라인 40 확인) 신규 전역 상태 도입은 아니다. 훅은 읽기 전용으로 `WorkspaceStore` 를 구독하므로 의도치 않은 상태 변경은 없다.

### [INFO] i18n 키 `triggers.deleteConfirm` 제거 — 다른 도메인의 동명 키와 혼동 불필요
- 위치: `/codebase/frontend/src/lib/i18n/dict/en/triggers.ts` 라인 29, `/codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` 라인 27
- 상세: `triggers.deleteConfirm` 는 제거되었고 `triggers.*` 네임스페이스 안에서만 유효한 키였다. `schedules.deleteConfirm`, `workspace.deleteConfirm`, `integrations.deleteConfirm` 등 다른 도메인의 동명 키는 별도 네임스페이스에 있어 영향 없음. 제거 전 실제 사용처가 0건임을 커밋 메시지에서 확인 완료.

### [INFO] `package-lock.json` — backend 의 `chokidar` 의존성 추가 및 `uglify-js` `dev` 플래그
- 위치: `/codebase/backend/package-lock.json` 라인 79–104, 154
- 상세: `@nestjs-modules/mailer` 하위에 `chokidar` 3.6.0 의 hoisted 중복 항목이 추가되었다. 이는 `peer: true, optional: true` 플래그가 있으므로 설치 여부가 환경에 따라 결정된다. `uglify-js` 에 `"dev": true` 플래그가 추가된 것은 devDependency 분류 정확화로, 런타임 번들 크기에 영향을 주지 않는다. 두 변경 모두 lock 파일 자동 업데이트이며 의도치 않은 런타임 부작용은 없다.

### [INFO] `viewDetails` 와 `viewHistory` 메뉴 항목이 동일 동작 실행
- 위치: `/codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 503–511
- 상세: `viewDetails` 와 `viewHistory` 두 항목 모두 `setSelectedTriggerId(trigger.id)` 를 호출하여 동일하게 `TriggerDetailDrawer` 를 열고 있다. 스펙 커밋 메시지에서 "v1 은 anchor 스크롤 미구현" 으로 명시했으나, 이 때문에 두 메뉴 항목의 실제 동작이 동일해 UX 혼동이 발생할 수 있다. 부작용보다는 기능 미완성 항목이나, 잠재적으로 사용자가 다른 동작을 기대할 수 있다.

---

## 요약

이번 변경은 기존 토글 버튼 인라인 액션을 DropdownMenu 로 교체하고, 신규 삭제 확인 다이얼로그를 도입하는 순수 프론트엔드 UI 작업이다. 전역 변수 도입, 환경 변수 쓰기, 예상치 못한 네트워크 호출, 파일시스템 부작용은 없다. 가장 주목할 부작용 위험은 두 가지다: (1) `TriggerDeleteDialog` 가 독자적으로 `queryClient.invalidateQueries(["triggers"])` 를 호출하여 캐시 무효화 책임이 컴포넌트 내부로 들어간 점 — 현재는 단일 사용처라 무해하나 재사용 시 의도치 않은 refetch 를 유발할 수 있다. (2) `getWebhookUrl` 의 `window.location.origin.replace(/:\d+$/, ":3011")` 포트 하드코딩 — 이번 PR 에서 삭제 모달 본문에 처음으로 이 URL 이 사용자에게 표시되는 경로로 노출되므로, 프로덕션 환경에서 잘못된 URL 이 노출될 위험이 증가했다. 기존 코드에 이미 존재하던 패턴이나 노출 범위가 확대된 점에서 주목이 필요하다.

---

## 위험도

LOW
