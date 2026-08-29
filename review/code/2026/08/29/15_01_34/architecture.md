# 아키텍처(Architecture) 리뷰 결과

## 검토 범위 메모

리뷰 대상 15개 파일 중 파일 4~15(`review/code/2026/08/29/14_36_39/*`)는 **직전 리뷰 라운드의 산출물이 그대로 신규 커밋된 것**(RESOLUTION.md, SUMMARY.md, 각 reviewer 리포트, `_retry_state.json`, `meta.json`)이며 아키텍처 관점에서 평가할 구조가 없다(코드 컴포넌트가 아니라 기록 데이터). 실질적 아키텍처 검토는 파일 1(`spec-links.test.ts`), 파일 2(`spec-links.ts`), 파일 3(`plan/in-progress/harness-review-gate-followups.md`)에 대해 수행했다. 순환 의존성 확인을 위해 `plan-scan.ts`/`tree-walk.ts` import 그래프도 직접 열어 대조했다 — `tree-walk.ts`(리프) ← `plan-scan.ts` ← `spec-links.ts` 로 단방향 DAG 이고 순환은 없다. 외부 소비처도 `grep` 로 재확인했고 이 모듈 밖에서 `spec-links`를 import 하는 곳은 없다(plan 문서의 "외부 소비처 0건" 주장과 일치).

## 발견사항

- **[WARNING]** 같은 파일 안에 **정밀 CommonMark AST 파서**와 **부분 재구현 정규식 스캐너**가 나란히 존재하고, 이번 diff 는 후자를 계속 패치하는 방향으로 갔다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:51`~`71`(`headingSlugs` — `fromMarkdown` AST 사용) 대비 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:148`~`203`(`buildMaskedDoc`/`lineForOffset`/`extractLinks` — 정규식+수작업 마스킹)
  - 상세: 이 파일은 이미 `mdast-util-from-markdown` (CommonMark 정본 파서)을 하드 의존성으로 갖고 있고, 헤딩 슬러그 계산(`headingSlugs`, `slugify`)은 "in-app docs viewer 가 쓰는 바로 그 렌더러 파이프라인"(파일 자체 주석, `:24`-`:29`)을 그대로 위임해 정확성을 보장한다. 반면 링크 **추출**(`extractLinks`)은 여전히 손으로 짠 펜스 정규식(`FENCE_RE`)·인라인 코드 제거 정규식(`` /`[^`]*`/g ``)·줄 단위 마스킹·오프셋→줄 이진 탐색(`buildMaskedDoc`/`lineForOffset`)으로 CommonMark 의 일부만 재구현하고 있다. mdast 는 `link`/`linkReference` 노드에 `url`과 `position.start.line`을 그대로 제공하므로, 트리를 순회(`collectHeadings`와 대칭적인 `collectLinks`)해 노드를 모으는 것만으로 이 문제 전체(펜스 회피·인라인 코드 회피·멀티라인 텍스트·줄 번호 계산)가 파서 차원에서 해결된다.
    이 불일치가 추상적 우려로 그치지 않는다는 증거가 이번 diff 자체에 있다: 이 PR 이 고치는 결함(`text.split(/\r?\n/)` 뒤 줄 단위 매칭이라 멀티라인 링크를 통째로 놓침)과, `RESOLUTION.md`(Critical #1, `review/code/2026/08/29/14_36_39/RESOLUTION.md:15`-`34`)가 기록한 **같은 PR 안에서 벌어진 2차 사고**(plan 문서에 적은 예시 문구가 마스킹 정규식에 의해 의도치 않게 진짜 링크로 재구성돼 빌드를 깼다)가 **동일한 계열의 취약점**이다 — 손으로 짠 부분 파서가 CommonMark 의 엣지케이스를 놓치는 패턴이 한 PR 안에서 두 번 재발했다. `cannotContainLink` 사전 필터(`:103`)로 스캔 대상이 이미 크게 줄어든 상태(codebase 소스 기준 11.9%, spec/governance/plan 은 필터 이득이 없거나 적음)이므로, 그 필터를 통과한 부분집합에 한해 AST 파싱 비용을 지불하는 전환이 실현 가능해 보인다.
  - 제안: 최소한 "왜 링크 추출만 AST 대신 정규식 마스킹을 유지하는가"에 대한 근거(성능 실측 또는 다른 제약)를 이 함수의 JSDoc 에 명시한다. 여력이 있다면 `headingSlugs`와 동일한 패턴(`collectHeadings`처럼 mdast 트리를 순회해 `link` 노드를 모으는 `collectLinks`)으로 `extractLinks`를 재작성해, 이 파일이 반복해 데인 "손으로 짠 부분 파서가 멀티라인·펜스·인라인코드 조합을 놓친다"는 결함 계열 자체를 구조적으로 제거하는 방안을 백로그에 남긴다.

- **[INFO]** `MaskedDoc`이 `startOf`/`srcLineOf` 두 개의 암묵적으로 동기화된 병렬 배열을 필드로 갖는다 — 인터페이스로 묶여 이름은 생겼지만(직전 라운드 INFO #16 대비 개선), 내부적으로는 여전히 인덱스 정합을 수작업으로 유지해야 한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:132`-`139`(`MaskedDoc` 선언), `:162`-`167`(`startOf` 생성 루프)
  - 상세: 직전 리뷰 라운드가 이미 지적했고(`review/code/2026/08/29/14_36_39/SUMMARY.md` INFO #16) `RESOLUTION.md`가 "함수 분리로 완화됨"이라 판단해 별도 조치 없이 종결한 항목과 동일한 사안이다. 새로 발견된 문제는 아니며, 함수 분리(`buildMaskedDoc`)로 캡슐화 경계는 명확해졌으므로 현 상태를 인정할 수 있는 절충으로 보인다.
  - 제안: 조치 불요(직전 라운드 판정 유지). 다만 이 두 배열에 원소를 push 하는 지점이 앞으로도 항상 `buildMaskedDoc` 내부 한 루프(`:153`-`160`)로 국한된다는 불변식이 깨지지 않도록, 향후 편집 시 유의.

- **[INFO]** (긍정적 관찰) 이번 diff 는 직전 라운드의 SRP WARNING(#2·#3)에 정확히 대응해 `extractLinks`를 사전필터 → `buildMaskedDoc`(마스킹+줄지도 생성) → 정규식 매칭+`lineForOffset`(이진 탐색 디코드) 세 단계로 분리했고, 펜스 경계/내부 분기 중복도 `isFenceBoundary || inFence` 한 줄로 병합했다(`:158`). `LinkScanOptions`(`checkSelfAnchors`/`targetFilter`) 를 통한 개방-폐쇄 원칙 준수(신규 진입점 `findBrokenGovernanceLinks`/`findBrokenPlanLinks`/`findBrokenSpecLinksInSources` 가 `findBrokenLinksInFiles` 를 재사용, `:267`-`471`)도 이번 diff 로 훼손되지 않았다. 모듈 간 순환 의존성 없음(위 검증 참조).

## 요약

핵심 버그 수정(`extractLinks`가 멀티라인 링크 텍스트를 놓치던 침묵 실패)은 정확하고, 직전 리뷰의 SRP 지적에 성실히 대응해 `buildMaskedDoc`/`lineForOffset`로 책임을 분리한 점은 아키텍처 품질을 개선했다. 다만 이 파일이 헤딩 슬러그 계산에는 이미 확보한 CommonMark 정본 파서(`mdast-util-from-markdown`)를 쓰면서, 링크 추출은 여전히 손으로 짠 부분 재구현(정규식 마스킹 + 수작업 줄 지도)에 의존하는 추상화 수준의 불일치가 남아 있다. 이 불일치는 추상적 우려가 아니라, 이번 PR 자체 안에서 같은 계열의 2차 사고(plan 예시 문구가 마스킹 규칙에 의해 의도치 않은 링크로 재구성돼 빌드를 깬 사건, RESOLUTION.md 기록)로 실증됐다 — 근본 설계를 정본 파서 기반으로 전환하면 이 결함 계열 자체가 구조적으로 사라질 여지가 있다. 나머지(순환 의존성, OCP, 모듈 경계)는 건전하다.

## 위험도
LOW
