# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `UnsearchableBanner` 컴포넌트의 props 인터페이스 이름이 `Props` → `UnsearchableBannerProps` 로 변경됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-banner-refactor-76a800/codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`
  - 상세: 인터페이스 이름은 파일 로컬(export 없음)이므로 외부 호출자에 영향 없음. 실제 export 된 함수 시그니처(`reembedStatus`, `onReembed`, `pending`)는 동일하며 공개 API 변경 없음.
  - 제안: 해당 없음 (의도적이고 안전한 내부 리팩터링).

- **[INFO]** `reembedStatus` prop 타입이 인라인 리터럴 유니온 `"idle" | "in_progress"` 에서 `KnowledgeBaseData["reembedStatus"]` 파생 타입으로 변경됨
  - 위치: `unsearchable-banner.tsx` line 11, 15
  - 상세: `KnowledgeBaseData.reembedStatus` 는 `"idle" | "in_progress"` 로 정의되어 있으므로(`/Volumes/project/private/clemvion/.claude/worktrees/kb-banner-refactor-76a800/codebase/frontend/src/lib/api/knowledge-bases.ts` line 30) 런타임 타입 집합은 동일. 호출부(`page.tsx`)는 `kb.reembedStatus`를 그대로 전달하고 있어 변경 전후 모두 동일한 값이 흐름. 컴파일 타임 결합이 추가된 것이 유일한 변화이며 이는 의도적 개선.
  - 제안: 해당 없음.

- **[INFO]** 모듈 레벨 상수 `STATE_CONFIG` 가 새로 도입됨
  - 위치: `unsearchable-banner.tsx` line 38–56
  - 상세: `const STATE_CONFIG` 는 모듈 로드 시 단 한 번 초기화되는 순수 읽기 전용 객체. 렌더링 중 변경되지 않으며 컴포넌트 외부 공유 상태에 영향을 주지 않음. 전역 네임스페이스에 노출되지 않음(모듈 스코프, 비 export).
  - 제안: 해당 없음.

- **[INFO]** `page.tsx` 의 JSX 주석만 변경됨 (코드 동작 변경 없음)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-banner-refactor-76a800/codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` line 36–38
  - 상세: 배너가 `kb.reembedStatus`(REST+WS 기반)를, 아래 진행 박스가 `embeddingStats.reembedStatus`(폴링 기반)를 각각 사용한다는 설계 의도를 주석으로 명시. 런타임 로직·상태·이벤트 흐름에 변경 없음.
  - 제안: 해당 없음.

- **[INFO]** 테스트에서 단일 `it` 케이스가 `it.each(["admin", "owner"] as const)` 로 교체됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-banner-refactor-76a800/codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx` line 87–88
  - 상세: 각 파라미터화된 케이스는 `beforeEach` 의 `cleanup()` + `useWorkspaceStore.getState().reset()` 을 거쳐 독립적으로 실행됨. `it.each` 는 내부적으로 각 항목을 별도 테스트로 등록하므로 상태 누출 없음. `admin` 케이스는 기존 동작과 동일하고 `owner` 케이스가 추가된 순수 확장.
  - 제안: 해당 없음.

## 요약

이번 변경은 `UnsearchableBanner` 컴포넌트의 내부 구현을 `STATE_CONFIG` 룩업 테이블로 리팩터링하고, props 타입을 도메인 타입(`KnowledgeBaseData`)에서 파생시키며, 테스트 커버리지를 `owner` 역할까지 확장한 것이다. 공개 export 함수 시그니처·렌더 결과·이벤트 흐름이 모두 유지되며, 새로 추가된 `STATE_CONFIG` 상수는 모듈 스코프의 불변 객체로 전역 상태에 영향을 주지 않는다. `page.tsx` 변경은 주석 추가뿐으로 런타임 동작에 아무런 영향이 없다. 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE
