# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** CHANGELOG.md 에 슬러그 라우팅 기능 전체가 등재되지 않음
  - 위치: `CHANGELOG.md` (프로젝트 루트)
  - 상세: 이 저장소의 `CHANGELOG.md` 는 "Unreleased" 섹션 아래 기능 단위로 상세한 항목을 남기는 관행이 확립되어 있다 (예: 캔버스 미니맵/줌 슬라이더, Switch `switchValue` asterisk 1줄짜리 수정까지도 각각 항목화됨). 그런데 이번 diff 가 속한 워크스페이스 슬러그 URL 라우팅 기능은 `feat(navigation): 워크스페이스 슬러그 URL 라우팅 phase 1`(2a0326e3a) → `test(navigation): ...e2e`(40bb0dfcc) → 본 리뷰 대상 `refactor(navigation): ai-review Warning 4건 조치`(fa228b635) → `docs(spec): 슬러그 URL 라우팅 구현 반영`(a9eaab83e) 4개 커밋에 걸친, 사용자 메모리 기록상 "대형 FE 재구조화(28페이지·34링크)" 규모의 변경임에도 4개 커밋 어디에도 `CHANGELOG.md` 변경이 없다(`git log --oneline -- CHANGELOG.md`, `grep -n "슬러그" CHANGELOG.md` 모두 무매치로 확인). spec-sync 커밋(a9eaab83e)이 다른 spec flip 들과 함께 "구현 완료" 로 정정하는 시점에도 CHANGELOG 항목은 추가되지 않았다.
  - 제안: 원 구현 커밋 또는 spec-sync 커밋 시점에 "Unreleased — 워크스페이스 슬러그 URL 라우팅 (`/w/[slug]/...`)" 항목을 다른 기능들과 동일한 상세도로 추가할 것(URL-우선 reconcile, 무효 slug UX-only redirect, catch-all 흡수, backend 인가 모델 불변 등 핵심 계약 요약).

- **[WARNING]** 커밋된 `RESOLUTION.md` 내 존재하지 않는 절("§재검증")을 두 곳에서 참조
  - 위치: `review/code/2026/07/08/18_24_41/RESOLUTION.md:22`, `:30`
  - 상세: "fix 후 재수행 결과는 아래 §재검증 참조"(TEST 결과 섹션) 및 "fresh `/ai-review` 재수행으로 재검증(§재검증)"(보류·후속 항목 섹션) 두 문장이 "재검증" 이라는 이름의 하위 섹션을 가리키지만, 파일 전체에 그런 헤딩이 없다(실제 헤딩은 `## 조치 항목`/`## TEST 결과`/`## 보류·후속 항목` 3개뿐). git history 상으로도 이 파일은 이 커밋에서 최초 생성(`new file mode`)이므로 이후 추가·삭제된 것도 아니라, 애초에 작성 시점에 누락된 dangling anchor 다.
  - 제안: 실제 재검증이 이뤄진 이후 리뷰 세션(예: 현재 진행 중인 `review/code/2026/07/09/07_56_16/`)을 가리키는 구체적 경로로 교체하거나, 언급된 재검증 내용을 실제 섹션으로 추가.

- **[INFO]** `buildWorkspaceHref` 최상단 JSDoc 이 이번에 추가된 오픈리다이렉트 방어를 언급하지 않음
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:1-9`(함수 선언 위 블록 주석) vs `:11-13`(구현부 바로 위 인라인 주석)
  - 상세: protocol-relative(`//host`) 입력을 same-origin 절대경로로 정규화하는 보안 속성은 구현부 직전의 인라인 주석에만 설명되어 있다. 함수의 계약을 요약하는 최상단 JSDoc 블록(“slug 를 붙인 절대경로를 만든다”, “slug 없으면 bare path”)에는 이 보장이 반영되지 않아, hover 문서나 자동 생성 API 문서만 보는 소비자는 이 방어를 알기 어렵다.
  - 제안: 최상단 JSDoc 에 "protocol-relative(`//`) 입력은 same-origin 절대경로로 정규화됨" 한 줄 추가.

## 요약

이번 diff 는 이전 ai-review Warning 4건(테스트 커버리지 2건·DRY 리팩터·보안 정규화)에 대한 조치이며, 신규 추출된 `resolveFallbackWorkspace`(`resolve-fallback.ts`)와 기존 `buildWorkspaceHref`/`useWorkspaceSlug`/`useWorkspaces` 는 모두 JSDoc 이 목적·근거 spec 인용·다른 유사 훅과의 역할 구분을 명확히 기술하고 있어 코드 레벨 문서화 품질은 양호하다. 신규·수정 테스트 파일들의 인라인 주석(예: `beforeEach` store reset 이유)도 실제 동작과 정확히 일치한다. API 문서·설정 문서·예제 코드 관점에서는 이번 diff 가 순수 FE 라우팅/테스트 변경이라 해당 사항이 없다. 다만 (1) 이 refactor 가 속한 상위 기능인 워크스페이스 슬러그 라우팅 전체가 대형 변경임에도 `CHANGELOG.md` 에 전혀 반영되지 않았고, (2) 같은 커밋에서 새로 커밋된 `RESOLUTION.md` 가 존재하지 않는 절을 두 차례 참조하는 dangling anchor 를 남겼다는 점은 조치가 필요하다.

## 위험도

LOW
