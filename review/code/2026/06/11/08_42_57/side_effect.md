# 부작용(Side Effect) 리뷰

## 발견사항

부작용 관점의 주요 점검 결과를 항목별로 기술한다.

### [INFO] `useWorkspaceStore.setState` 직접 호출 — 테스트 전용 공유 상태 변이
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-reembed-banner-impl-31d0c8/codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx` — `setRole` 헬퍼 및 `beforeEach`
- 상세: `useWorkspaceStore.setState(...)` 와 `useLocaleStore.setState(...)` 는 Zustand 스토어를 직접 변이한다. 이는 테스트 격리 목적의 표준 Zustand 패턴이지만, `beforeEach` 에서 `reset()` 을 먼저 호출하고 `setRole` 을 나중에 호출하는 순서가 테스트마다 일관되게 지켜지지 않으면(describe 블록 밖 `setRole` 은 `beforeEach` 이후에 호출됨 — 현재 구조 정상) 상태가 다음 테스트로 누출될 수 있다. 현재 구조는 `beforeEach` → `setRole` 순서를 각 `it` 내부에서 명시적으로 배치하므로 누출 위험은 없다.
- 제안: 현행 유지. `afterEach(() => cleanup())` 을 `beforeEach` 와 병행하면 DOM 누출도 이중으로 차단되나 필수 수준은 아님.

### [INFO] `onReembed` 콜백 — 호출자 상태 전이의 간접 부작용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-reembed-banner-impl-31d0c8/codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` — `onClick={onReembed}`
- 상세: `UnsearchableBanner` 컴포넌트는 `onReembed` prop 을 클릭 이벤트에 직접 연결한다. 컴포넌트 자체는 아무 상태도 소유하지 않으며 콜백 실행의 부작용(ConfirmModal 열기 → `POST /re-embed` 호출)은 전적으로 호출부(`page.tsx`)의 책임이다. 이 설계는 presentational 컴포넌트의 올바른 관심사 분리다.
- 제안: 현행 유지.

### [INFO] i18n 딕셔너리 전역 객체에 새 키 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-reembed-banner-impl-31d0c8/codebase/frontend/src/lib/i18n/dict/en/knowledgeBases.ts`, `/Volumes/project/private/clemvion/.claude/worktrees/kb-reembed-banner-impl-31d0c8/codebase/frontend/src/lib/i18n/dict/ko/knowledgeBases.ts`
- 상세: `reembedNow`, `unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc` 세 키가 기존 딕셔너리 객체에 추가된다. 추가만 이루어지며 기존 키 변경이 없고, `Dict["knowledgeBases"]` 타입 인터페이스를 확장하는 방식이라 기존 소비자에게 영향을 주지 않는다. en 파일은 `as const` 가 없고 ko 파일은 `as const` 가 있다 — 이는 기존 파일 스타일 차이로 이번 변경 도입이 아니다.
- 제안: 현행 유지.

### [INFO] `page.tsx` 렌더 트리 조건부 삽입 — 기존 레이아웃에 미치는 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-reembed-banner-impl-31d0c8/codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` — 배너 블록(diff +9줄)
- 상세: `kb && kb.embeddingDimension == null` 조건이 false 인 경우(정상 KB) 기존 렌더 트리와 완전히 동일하다. true 인 경우에만 배너 `div` 가 삽입되며 이는 의도된 신규 UI다. 기존 상태(`showKbReEmbedConfirm`, `kbReEmbedMutation`)를 재사용할 뿐 새 전역/공유 상태를 도입하지 않는다. 삽입 위치(진행 박스 위)가 다른 조건부 블록의 레이아웃 흐름을 바꾸지 않는다.
- 제안: 현행 유지.

### [INFO] `setShowKbReEmbedConfirm(true)` — 기존 Modal 상태 변이 재사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-reembed-banner-impl-31d0c8/codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` — `onReembed={() => setShowKbReEmbedConfirm(true)}`
- 상세: 배너의 CTA 가 기존 `showKbReEmbedConfirm` 상태를 `true` 로 설정해 기존 ConfirmModal 흐름을 재사용한다. 이는 신규 상태 변이가 아닌 기존 로직의 진입점 추가다. 동일 상태를 다른 진입점(설정 저장 후 `modelChangedNeedsReembed` 배너 등)에서도 사용 중이라면 충돌 가능성이 있으나, `showKbReEmbedConfirm` 는 단순 boolean toggle 이므로 중복 진입 시에도 Modal 이 두 번 열리지 않고 이미 열려 있는 상태로 유지된다. 의도치 않은 부작용 없음.
- 제안: 현행 유지.

---

## 요약

이번 변경은 순수 presentational 컴포넌트(`UnsearchableBanner`) 신설 + 기존 페이지에 조건부 렌더 삽입 + i18n 키 추가로 구성된다. 컴포넌트 자체는 내부 상태를 소유하지 않으며, 전역/공유 상태 변이 없이 props 콜백(`onReembed`)을 통해 호출부의 기존 상태 전이(`setShowKbReEmbedConfirm`)를 재사용한다. 신규 전역 변수, 환경 변수 읽기/쓰기, 파일시스템 부작용, 네트워크 직접 호출이 전혀 없고, 기존 함수/메서드 시그니처 변경도 없다. i18n 딕셔너리에 키를 추가만 하여 기존 소비자에 영향이 없다. 테스트 코드의 Zustand 스토어 직접 변이는 표준 테스트 격리 패턴이며 `beforeEach` reset 순서가 올바르게 유지된다. 의도치 않은 부작용이 발견되지 않았다.

## 위험도

NONE
