# 부작용(Side Effect) 리뷰 — 슬러그 라우팅 round-3 fix (2026-07-09 08:39)

대상 커밋: `865e6b939` — rerun-modal 재실행 성공 네비게이션 slug 부착 (W1 real bug fix) +
테스트 보강(W5/W6) + RESOLUTION 문서 갱신.

## 발견사항

- **[INFO]** `router.push` 대상 경로 변경 — 호출자 영향 확인 완료
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:968-977` (`handleSubmit` 내 `onSuccess` 미지정 분기)
  - 상세: `onSuccess` 콜백이 없을 때 실행되는 기본 네비게이션이 `/workflows/:workflowId/executions/:newId` (bare) 에서 `buildWorkspaceHref(slug, ...)` 로 변경됨 — 사실상 공개 동작(default navigation destination) 변경. `ReRunModal` 의 실제 소비처 2곳(`app/(main)/w/[slug]/workflows/[id]/executions/[executionId]/page.tsx`, `components/editor/run-results/run-results-drawer.tsx`)을 직접 확인했고 둘 다 `onSuccess` 를 넘기지 않아 새 동작의 영향을 받는다. 다만 (a) 이 파일 내 "원본 실행 ID 새 탭 링크"가 이미 동일한 `buildWorkspaceHref(slug, ...)` 패턴을 쓰고 있어(변경 전부터 존재) 이번 변경은 기존 패턴과의 불일치를 없애는 정합화이고, (b) `buildWorkspaceHref` 는 slug 가 없으면 bare path 로 폴백하며 그 bare path 는 `(main)/[...rest]` catch-all 이 활성 slug 로 흡수하도록 설계돼 있어(JSDoc 명시) 최종 도달 URL 은 이전과 동일하고 리다이렉트 홉만 줄어드는 구조. `run-results-drawer.tsx` 는 slug 세그먼트가 없는 `(editor)/workflows/[id]` 라우트에서도 쓰이지만 `useWorkspaceSlug()` 가 store 폴백을 제공하므로 즉시 slug 해소가 가능. 실질적 회귀 위험은 낮음.
  - 제안: 조치 불요(의도된 버그 수정, 커밋 메시지에 "real bug" 로 명시). 향후 `ReRunModalProps.onSuccess` 를 사용하는 신규 소비처가 생기면 이 기본 네비게이션 변경 사실을 인지할 것.

- **[INFO]** `ReRunModalProps` 시그니처 자체는 불변
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:47-73`(interface)
  - 상세: 필드 추가/제거/타입 변경 없음 — `onSuccess` JSDoc 문구만 slug 경로 언급으로 갱신. 호출자 코드 수정 불필요.

- **[INFO]** 테스트의 zustand persist 스토어 리셋 — 격리 목적의 통제된 부작용
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:110`(`useWorkspaceStore.getState().reset()` in `beforeEach`), `codebase/frontend/src/lib/stores/__tests__/workspace-store.test.ts` 신규 `describe` 블록의 `beforeEach`
  - 상세: `workspace-store.ts` 는 `persist` 미들웨어로 `currentWorkspaceId` 를 localStorage 에 영속화한다. 테스트에서 `reset()`/`setState()` 호출은 jsdom `localStorage` 에도 쓰기 부작용을 일으키지만, 이는 기존 스토어 설계(변경 없음)이고 테스트 간 상태 누수를 막기 위한 의도된 조치(주석에도 "케이스 간 누수 방지" 명시)라 문제 없음.
  - 제안: 조치 불요.

- **[INFO]** RESOLUTION.md 2개 파일(과거 라운드 문서 정정 + 신규 라운드 문서) 이 코드 fix 와 동일 커밋에 포함
  - 위치: `review/code/2026/07/08/18_24_41/RESOLUTION.md`, `review/code/2026/07/09/08_18_37/RESOLUTION.md`(신규)
  - 상세: 둘 다 프로젝트 컨벤션상 `developer`/리뷰 파이프라인이 쓰기 허용된 `review/**` 경로. 런타임 부작용 없는 문서 변경(리뷰어 커버리지 서술 정정 + 조치 이력 기록)으로, 예상치 못한 파일시스템 부작용에 해당하지 않음.
  - 제안: 조치 불요.

- **[INFO]** 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 배선 변경 없음
  - 상세: `handleSubmit` 의 `executionsApi.reRun` 호출, `onSuccess`/`router.push` 분기 구조, `onClose()` 호출 순서 모두 기존과 동일 — 오직 `router.push` 인자 문자열 조립 로직만 `buildWorkspaceHref` 로 대체됨. 새 전역 상태, 새 module-level 변수, 새 환경변수 읽기/쓰기, 새 외부 API 호출 없음.

## 요약

핵심 변경은 `rerun-modal.tsx` 의 성공 네비게이션 경로에 이미 프로젝트 전역에서 확립된 `buildWorkspaceHref(slug, ...)` 패턴을 적용한 1줄 버그 수정이며, `ReRunModalProps` 공개 시그니처는 그대로다. 기본 네비게이션 목적지가 bare path → slug-prefixed path 로 바뀌어 두 실제 소비처(실행 상세 페이지·에디터 결과 drawer) 모두 영향을 받지만, catch-all 리다이렉트 설계상 최종 도달 URL은 동일하고 이번 변경은 여분의 리다이렉트 홉을 제거하는 정합화에 가깝다(같은 파일의 기존 "새 탭 링크"가 이미 같은 패턴을 쓰고 있었음을 직접 확인). 테스트 3개 파일의 변경은 스토어 리셋·it.each 분리·신규 케이스 추가로 전부 검증/격리 목적이며 프로덕션 부작용이 없다. RESOLUTION.md 갱신도 컨벤션에 부합하는 문서 전용 변경이다. 전역 변수, 환경 변수, 네트워크 호출, 이벤트/콜백 배선에 대한 의도치 않은 변경은 발견되지 않았다.

## 위험도

NONE
