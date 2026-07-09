<!-- main 이 journal(wf_7f9e5923-759)에서 복원 — subagent write 격리. -->

### 발견사항

- **[WARNING]** 신규 에디터 layout 테스트가 기존 `(main)` layout 테스트를 통째로 복제
  - 위치: `codebase/frontend/src/app/(editor)/w/[slug]/__tests__/layout.test.tsx` (신규) vs `codebase/frontend/src/app/(main)/w/[slug]/__tests__/layout.test.tsx` (기존, 이번 diff엔 없음)
  - 상세: 두 파일이 `next/navigation`/`use-workspaces`/`workspace-store` mock 보일러플레이트, `renderLayout()` 헬퍼, "정합 시 렌더"·"불일치 시 게이트+reconcile"·"무효 slug redirect" 3개 테스트 케이스를 이름만 살짝 바꿔(`child`→`canvas`) 거의 그대로 반복한다. 이번 리팩터로 게이트 로직 자체는 `WorkspaceSlugGate` 한 곳으로 추출됐지만, 그 로직을 직접 검증하는 단위 테스트는 없고 대신 두 개의 얇은 소비 레이아웃이 각각 동일한 시나리오를 재검증한다. 향후 게이트 동작이 바뀌면 N개 소비처마다 같은 테스트를 동기화해야 하는 부담이 생긴다(공용 컴포넌트를 만든 취지와 배치).
  - 제안: `lib/workspace/__tests__/workspace-slug-gate.test.tsx` 를 신설해 게이트 시나리오(정합/불일치 reconcile/무효 slug redirect/로딩)를 한 번만 검증하고, `(main)`·`(editor)` 각 layout 테스트는 "게이트를 실제로 배선하는지"만 확인하는 얇은 smoke test로 축소.

- **[WARNING]** 소스 스캔 guard 테스트 간 `collectSourceFiles` 함수 중복
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-editor-href.test.ts:34-43`(신규) vs `no-raw-execution-href.test.ts`(기존, 동일 함수 보유)
  - 상세: 디렉터리 재귀 스캔(`__tests__`/`node_modules` 제외, `.ts(x)` 필터, `.test.` 제외) 로직이 두 guard 테스트 파일에 글자 그대로 복제돼 있다. 신규 파일을 추가하며 기존 guard 의 스캐너를 재사용하지 않고 그대로 복붙했다.
  - 제안: `collectSourceFiles`(+ 공통 `SRC` 앵커 sanity 체크)를 `lib/workspace/__tests__/scan-source-files.ts` 같은 공유 헬퍼로 추출해 두 guard 가 import 하도록.

- **[INFO]** 두 guard 테스트의 예외 처리 스타일 불일치
  - 위치: `no-raw-editor-href.test.ts:33-38`(`isExempt()` 함수로 3개 예외 경로 추상화) vs `no-raw-execution-href.test.ts`(`f !== HELPER` 인라인 단일 조건)
  - 상세: 주석에서 두 guard 가 "대칭으로 강제"한다고 명시하는데, 실제 구현 스타일(추상화 함수 유무)은 다르다. 예외가 1개→3개로 늘며 자연히 생긴 차이지만, 나중에 execution guard 에도 예외가 늘면 동일 패턴을 다시 따라갈지 애매해진다.
  - 제안: 두 guard 가 공유 스캐너를 쓰게 되면(위 WARNING) `isExempt` 형태로 일관 정리하는 게 자연스러움.

- **[INFO]** `editor-loader.tsx` 는 순수 경로 이동(git mv)이며 내용 변경 없음 — 사전 확인 결과 이번 커밋이 도입한 문제는 아님
  - 위치: `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx`
  - 상세: `load()` 함수가 fetch·응답 언래핑(`(x.data.data ?? x.data) as unknown as Record<string, unknown>` 3중 캐스트)·노드/엣지 변환·stale-edge 정리·에러 처리까지 한 함수에서 처리해 책임이 여러 개이고, `n.type as string`/`n.positionX as number` 같은 방어적 캐스트가 많아 타입 안전성이 약하다. 이번 phase 2 diff 는 경로만 옮긴 것으로 확인(`git show`로 내용 동일 확인) — 이번 변경이 유발한 문제는 아니다.
  - 제안: 당장 이 PR 범위는 아니지만, 이후 별도 리팩터에서 `parseWorkflowListResponse`/`buildFlowNodes`/`buildFlowEdges` 등으로 분리하면 가독성·테스트 용이성이 개선됨(참고용, blocking 아님).

- **[INFO]** 동일 설명 문구(가드 취지·phase 2 배경)가 4곳에 거의 그대로 반복
  - 위치: `href.ts`(`buildExecutionHref`/`buildEditorHref` JSDoc), `no-raw-editor-href.test.ts`, `no-raw-execution-href.test.ts`
  - 상세: "리터럴 산재 → broken-link 회귀 반복(PR #865 등) → guard 테스트로 강제" 라는 동일 서사가 함수/테스트 파일마다 문장까지 유사하게 반복된다. 문서화가 풍부한 건 이 코드베이스의 기존 관례와 일치하지만, 향후 예외 목록이나 근거가 바뀌면 4곳을 동기화해야 하는 부담이 있다.
  - 제안: 필수 조치는 아님. 다만 "왜"의 단일 진실은 `href.ts` 주석에 두고 각 guard 테스트에서는 짧게 참조만 하는 방식도 고려 가능.

### 긍정적 포인트 (참고)
`WorkspaceSlugGate` 추출은 `(main)`과 `(editor)`에 중복돼 있던 slug 해소·reconcile·무효-slug redirect·게이트 로직(~45줄)을 단일 컴포넌트로 통합한 좋은 리팩터다. `buildEditorHref`는 기존 `buildExecutionHref`/`buildWorkspaceHref`와 동일한 얇은 래퍼 패턴·네이밍 컨벤션을 그대로 따르며 7개 이상 소비처에서 일관되게 재사용된다(템플릿 리터럴 중복 대신). Guard 테스트들이 regex self-test(true/false positive 표)를 갖춰 guard 무력화를 방지하는 점도 방어적으로 잘 설계됐다.

### 요약
이번 변경은 대체로 유지보수성 측면에서 견고하다 — 공용 게이트 컴포넌트 추출과 href 헬퍼 재사용을 통해 이전에 산재했던 중복을 오히려 줄였다. 다만 새로 추가된 두 항목(에디터 layout 테스트, 신규 guard 테스트)이 기존 유사 코드를 추상화 없이 그대로 복제하는 패턴을 보여, 공용 컴포넌트/헬퍼를 만든 리팩터 취지와 다소 배치되는 테스트 중복이 생겼다. 이는 즉각적인 버그 위험은 아니지만 향후 동일 로직을 여러 곳에서 동기화해야 하는 부담을 키운다.

### 위험도
LOW