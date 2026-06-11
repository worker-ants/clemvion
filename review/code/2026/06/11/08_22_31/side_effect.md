# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `UnsearchableBanner` — 순수 presentational 컴포넌트, 내부 상태 없음
- 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`
- 상세: 컴포넌트가 외부에서 props(`reembedStatus`, `onReembed`, `pending`)를 모두 주입받고, 내부에서 어떤 상태도 생성·변경하지 않는다. `useT()` 훅은 locale 읽기 전용이며 쓰기가 없다. 부작용 없음.
- 제안: 해당 없음.

### [INFO] `[id]/page.tsx` — `setShowKbReEmbedConfirm` 재사용, 추가 상태 변경 없음
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 567–574
- 상세: `onReembed={() => setShowKbReEmbedConfirm(true)}` 는 이미 페이지 상단 헤더 버튼(라인 571)에서도 동일하게 사용 중인 기존 상태 세터다. 새 상태를 도입하지 않고 기존 확인 모달 흐름을 재사용하므로 예상 외 상태 변경이 없다.
- 제안: 해당 없음.

### [INFO] i18n 딕셔너리 — 키 추가만, 삭제·이름 변경 없음
- 위치: `codebase/frontend/src/lib/i18n/dict/en/knowledgeBases.ts`, `codebase/frontend/src/lib/i18n/dict/ko/knowledgeBases.ts`
- 상세: `reembedNow`, `unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc` 3개 키를 순수 추가하며, 기존 키의 값·위치·이름을 변경하지 않는다. 타입시스템(`Dict["knowledgeBases"]`)이 en 기준 키 목록을 강제하므로 신규 키 누락 시 빌드 에러로 잡힌다.
- 제안: 해당 없음.

### [INFO] 테스트에서 Zustand 전역 스토어 직접 조작
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx` 라인 8–14, 24–26
- 상세: `useWorkspaceStore.setState()`와 `useLocaleStore.setState()`를 직접 호출해 전역 상태를 테스트마다 세팅한다. `beforeEach`에서 `useWorkspaceStore.getState().reset()`을 호출해 매 테스트 전 정리하고 있어 테스트 간 오염 위험은 낮다. 단, `setRole()` 헬퍼 함수가 `beforeEach` 정리 이후(각 `it` 블록 안)에 호출되므로 `reset()` 먼저, `setState()` 나중의 순서가 보장되어 정상이다.
- 제안: 해당 없음 (기존 테스트 패턴과 일치).

### [INFO] `reembedStatus` 출처 이중화 — `kb.reembedStatus` vs `embeddingStats.reembedStatus`
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 572 vs 618
- 상세: 배너에는 `kb.reembedStatus`(GET /knowledge-bases/:id 응답)를, embedding 진행 박스에는 `embeddingStats.reembedStatus`(GET /knowledge-bases/:id/embedding-stats 응답)를 사용한다. 두 필드는 동일한 백엔드 레코드에서 유래하지만 별도 폴링 경로로 도착한다. 재임베딩 시작 직후 `kb` 캐시가 갱신되기 전에 `embeddingStats`가 먼저 `in_progress`로 전환되면 배너와 진행 박스 상태가 일시적으로 불일치할 수 있다. 단, 두 쿼리 모두 `kbReEmbedMutation.onSuccess`에서 `invalidateQueries`로 연동 갱신되므로 불일치 창은 매우 짧고 기능 정확성에는 영향 없다.
- 제안: 현재 구조 유지 가능. 단일화가 필요하다면 배너에도 `embeddingStats?.reembedStatus`를 사용하되 null-fallback(`?? "idle"`)을 적용하면 된다.

---

## 요약

이번 변경은 frontend-only presentational 컴포넌트(`UnsearchableBanner`) 신규 추가와 기존 페이지에서의 조건부 렌더링 삽입으로 구성된다. 컴포넌트는 내부 상태를 일절 관리하지 않고, CTA 콜백은 이미 존재하는 `setShowKbReEmbedConfirm` 세터를 재사용한다. i18n 키는 순수 추가이며 기존 키를 건드리지 않는다. 테스트의 전역 스토어 직접 조작은 프로젝트 기존 패턴과 동일하고 `beforeEach` 정리로 격리된다. 의도치 않은 상태 변경, 전역 변수 도입, 파일시스템 부작용, 시그니처 변경, 네트워크 추가 호출, 환경 변수 관련 부작용은 모두 없다. `kb.reembedStatus`와 `embeddingStats.reembedStatus` 이중 출처 간 일시적 불일치 가능성만 INFO 수준으로 기록한다.

## 위험도

NONE
