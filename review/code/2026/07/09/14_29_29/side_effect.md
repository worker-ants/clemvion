# 부작용(Side Effect) 리뷰 결과

## 검토 대상 개요
5개 파일 모두 ai-review R2 조치 커밋(buildEditorHref 콜사이트 slug 회귀 테스트 + 주석/plan 정정). 순수 프로덕션 로직 변경은 없음:
- 파일 1~3: 테스트 파일에 신규 `it`/`describe` 블록 추가 (assertion 추가, 프로덕션 코드 미변경)
- 파일 4: `sidebar.tsx` 주석 텍스트 1줄 정정 (동작 변경 없음)
- 파일 5: `plan/in-progress/spec-sync-user-profile-gaps.md` 체크리스트 문구 정정 (문서)

### 발견사항

- **[INFO]** 신규 테스트가 공유 Zustand 전역 스토어(`useWorkspaceStore`)를 `setState` 로 직접 변조
  - 위치: `dashboard-page.test.tsx` 신규 `describe("... phase 2)")`의 `beforeEach`, `execution-list-page.test.tsx` 신규 `it(...)`, `workflows-page.test.tsx` 신규 `it(...)` 각각의 `useWorkspaceStore.setState(...)` 호출
  - 상세: 이 스토어는 모듈 스코프 싱글턴이라 한 테스트의 `setState` 가 같은 파일 내 이후 테스트에 잔존할 수 있는 부작용 채널이다. 다만 세 파일 모두 기존 관례(`beforeEach`에서 `workspaces: []`/`vi.clearAllMocks()` 로 리셋)를 그대로 따르고 있고, 새로 추가된 테스트는 각 파일의 `describe` 블록 내 마지막 위치에 배치되어 있어 같은 파일의 이후 테스트로 상태가 누수되는 경로는 없다(파일 자체가 vitest 워커 단위로 격리되어 파일 간 누수도 없음). 실질적 회귀 위험은 낮음 — 기존 테스트 스타일과 100% 일치하는 패턴.
  - 제안: 조치 불요. 현행 유지로 충분(기존 테스트들도 동일 패턴).

- **[INFO]** `sidebar.tsx` 변경은 주석(comment)만 — 런타임 부작용 없음
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx:442`
  - 상세: `// slug 라우트에선 ... editor 등 slug 밖에선 ...` → `// slug 라우트에선 ... slug 밖 라우트(docs 등)에선 ...` 텍스트만 교체. `isActive` 계산 로직·`buildWorkspaceHref` 호출·렌더링 트리 등 실행 경로는 diff 전후 바이트 단위로 동일. 부작용 없음.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-sync-user-profile-gaps.md` 체크리스트 문구 정정 — 코드/API 영향 없음
  - 위치: `plan/in-progress/spec-sync-user-profile-gaps.md:25`
  - 상세: editor 의 slug 편입 상태를 "phase 1 slug 밖(후속)" → "phase 2 에서 slug 편입 완료" 로 정정. 순수 추적 문서 갱신이며 상태 변경(전역/공유 상태, 파일시스템, 네트워크, API 등) 없음.
  - 제안: 조치 불요.

- **[NONE]** 시그니처/인터페이스 변경 없음
  - 상세: 5개 파일 어디에도 함수/메서드 시그니처, export, 공개 API 표면 변경이 없다. `buildEditorHref`, `buildWorkspaceHref` 등 실제 헬퍼 함수 본체는 이번 diff 범위에 포함되지 않았고(테스트만 콜사이트 동작을 재확인), 호출자 영향은 없음.

- **[NONE]** 환경 변수·네트워크 호출·이벤트/콜백 변경 없음
  - 상세: 테스트에서 `vi.fn()` 기반 mock (`getSummary`, `getRecentWorkflows`, `getRecentExecutions`, `mockPush`, `createMock`)만 사용하며 실제 네트워크 호출·환경 변수 접근이 없다. `fireEvent.click` 은 각 테스트가 그리는 로컬 DOM 이벤트로 프로덕션 이벤트 배선 자체는 변경되지 않았다(단지 기존 클릭 핸들러가 slug-aware href 로 push 하는지 확인하는 assertion 추가).

## 요약
이번 diff 는 이전 리뷰(review/code/2026/07/09/14_06_57)에서 지적된 buildEditorHref 콜사이트의 slug 회귀 커버리지 공백을 메우는 테스트 3건 추가와, 그에 연동된 주석 1줄·plan 체크리스트 문구 1줄 정정으로 구성된다. 프로덕션 코드 로직·시그니처·공개 인터페이스·전역 상태 관리 방식·환경 변수·네트워크·이벤트 배선 어느 것도 변경되지 않았으며, 신규 테스트가 사용하는 `useWorkspaceStore.setState` 패턴도 기존 관례를 그대로 따르고 있어 테스트 간 상태 누수 위험도 실질적으로 없다. 부작용 관점에서 지적할 CRITICAL/WARNING 항목은 없다.

## 위험도
NONE
