# 문서화(Documentation) 리뷰 결과

대상: 워크스페이스 슬러그 라우팅 phase 2 — 에디터 slug화 (28개 변경 파일: e2e, layout/gate, editor 라우트 이동, href 헬퍼, guard 테스트, spec 6종, plan)

## 발견사항

- **[WARNING]** CHANGELOG.md 에 phase 2 항목 미추가
  - 위치: `CHANGELOG.md` (변경 파일 목록에 없음), 비교 대상 `codebase/frontend`/`spec/**` 변경 다수
  - 상세: 직전 커밋 `be7eba803 feat(navigation): 워크스페이스 슬러그 URL 라우팅 phase 1 (/w/[slug]/...) (#865)` 는 CHANGELOG.md 에 "Unreleased — 워크스페이스 슬러그 URL 라우팅 phase 1" 항목을 추가했다(에디터는 phase 1 에서 slug 밖이라고 명시하는 문장 포함). 최근 병합된 기능 커밋들(#856, #846, #845, #843 등)도 예외 없이 같은 패턴으로 CHANGELOG.md 를 갱신해왔다. 이번 phase 2 는 같은 기능의 직접적인 후속(에디터를 slug 편입)이며 라우트 구조·링크 헬퍼·spec 서술을 여럿 바꾸는 사용자 가시적 변경인데도 CHANGELOG.md 항목이 빠졌다. 이 저장소는 명시적 규약 문서(SKILL.md/PROJECT.md)에는 CHANGELOG 의무가 적혀 있지 않지만, 동일 기능의 직전 phase 가 세운 강한 실증 관행을 이번 PR 만 건너뛰면 히스토리상 phase 1 은 기록되고 phase 2 는 누락되는 비일관성이 생긴다.
  - 제안: phase 1 항목과 대칭되는 새 "Unreleased" 섹션(또는 phase 1 항목 갱신)을 추가해 "에디터 캔버스도 `/w/<slug>/workflows/<id>` 로 편입, `buildEditorHref` 헬퍼 도입, 구 bare 경로는 catch-all 흡수" 를 요약. SoT 로 `spec/2-navigation/9-user-profile.md §3` 재인용.

- **[INFO]** e2e 스위트 상단 docstring 이 신규 에디터 시나리오를 명시적으로 나열하지 않음
  - 위치: `codebase/frontend/e2e/workspaces/slug-routing.spec.ts:85-94` (파일 상단 block comment, 이번 diff 로 수정되지 않음)
  - 상세: 이번 PR 이 "bare editor path (/workflows/<id>) is absorbed into the slug" 와 "editor deep-link (/w/<slug>/workflows/<id>) resolves under the slug gate" 2개 테스트를 새로 추가했다. 각 테스트 자체에는 인라인 주석이 있어 개별 이해에는 문제없지만, 파일 최상단 docstring 은 여전히 "deep-link / redirect 흡수(구 무-slug 경로·알림 딥링크·루트) / 사이드바 네비게이션" 3버킷만 나열해 에디터 케이스가 어느 버킷에 속하는지 독자가 유추해야 한다. phase 1 도입 당시 통합 딥링크(`/integrations/<id>`) 사례를 별도로 언급하지 않고도 버킷에 포섭시킨 선례가 있어 치명적이지는 않다.
  - 제안: 상단 docstring 에 "에디터 canvas 흡수·deep-link(phase 2)" 한 줄을 추가해 파일 전체 커버리지를 스캔만으로 파악 가능하게 한다.

- **[INFO]** `usage-node-list.tsx` 의 `variant` JSDoc 이 실제 href 형태(slug 포함)를 반영하지 않음
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/usage-node-list.tsx:849-853` (컴포넌트 docstring, 이번 diff 로 수정되지 않음)
  - 상세: docstring 은 `variant="tab"` 이 "워크플로우 이름을 `/workflows/<id>` 링크로 렌더" 한다고 적는데, 실제 코드는 이번 PR 에서 `href={buildEditorHref(slug, w.workflowId)}` 로 바뀌어 `/w/<slug>/workflows/<id>` 를 렌더한다. 링크 대상 개념(캔버스로 이동)은 여전히 맞지만 slug 프리픽스가 붙는다는 사실이 comment 에 반영되지 않아 완전히 최신은 아니다.
  - 제안: "`/workflows/<id>` 링크(현재는 `buildEditorHref` 로 slug 프리픽스 포함)" 정도로 한 문구만 보강.

- **[INFO]** `WorkflowEditorLoader` 컴포넌트에 독스트링 부재 (pre-existing, 이번 PR 로 이동만 됨)
  - 위치: `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx:16` (export function 선언부)
  - 상세: 워크플로우/노드/엣지 3개 API 를 병렬 로드하고 stale edge 정리·에러/로딩 상태를 관리하는 공개 컴포넌트인데 파일 어디에도 목적을 설명하는 JSDoc 이 없다. `git log` 확인 결과 이동 전 원본 파일에도 없었던 기존 결함이라 이번 PR 의 회귀는 아니며, 내부의 까다로운 로직(`dropStaleEdges` 사유)에는 이미 인라인 주석이 있어 우선순위는 낮다.
  - 제안: 별도 후속 작업으로 컴포넌트 상단에 책임(3-요청 병합 로드, stale edge 자동정리, 실패 시 에러 뷰)을 요약하는 JSDoc 추가 권장(본 PR 의 필수 항목은 아님).

## 요약

이번 PR 은 문서화 관점에서 전반적으로 높은 완성도를 보인다 — 신규 공용 컴포넌트(`WorkspaceSlugGate`)·신규 헬퍼(`buildEditorHref`)·신규 guard 테스트 모두 배경(왜 필요한지)·판정 로직·예외 케이스까지 포함한 상세 JSDoc/블록 주석을 갖추고 있고, `auth-provider.tsx`·`editor-toolbar.tsx`·`no-raw-execution-href.test.ts` 등 기존 주석도 phase 2 로 바뀐 사실에 맞춰 정확히 갱신됐으며, spec 6개 문서(§2-navigation 5종 + data-flow/12-workspace)도 "에디터=slug 밖" 서술을 전부 찾아 "에디터도 slug 편입" 으로 일관되게 flip 했다(오래된 주석·spec 불일치 없음). 유일하게 눈에 띄는 공정상 갭은 동일 기능의 직전 phase(#865)가 세운 CHANGELOG.md 갱신 관행을 이번 phase 가 따르지 않은 점이며, 나머지는 기존에 존재하던 사소한 완성도 이슈(e2e 상단 docstring 미세 보강, 1개 컴포넌트 doc 부재)로 병합을 막을 사안은 아니다.

## 위험도

LOW
