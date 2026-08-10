# 문서화(Documentation) 코드 리뷰

## 검토 범위·방법

prompt_file 에 배정된 27개 파일 중 26개는 `review/consistency/**` 산출물(과거 라운드의
consistency-check 리포트 markdown/json, 순수 기록물)이고 나머지 1개가 실제 spec 문서
(`spec/conventions/spec-impl-evidence.md`)다. prompt 에 배정된 파일 목록만으로는 이번
PR 의 핵심 실코드 변경(`plan-scan.ts` 신설, `spec-links.ts`/`plan-frontmatter.test.ts` 확장,
`plan-lifecycle.md`/`PROJECT.md` 갱신, 신규 plan 3건)이 전혀 보이지 않아 — 문서화 리뷰의
본 관점(독스트링·주석 정확성)을 제대로 적용할 수 없었다. 워킹트리 절대경로에서
`git diff origin/main...HEAD`로 직접 실제 diff 를 재구성해 다음을 추가로 검토했다:
`plan-scan.ts`(신규 264줄), `spec-links.ts`(+45), `plan-frontmatter.test.ts`(대규모 재작성),
`plan-lifecycle.md`(+22), `PROJECT.md`(+2/-1), 신규 plan 3건
(`docs-guard-walker-dedup.md`, `harness-env-value-subpattern-dedup.md` diff,
`harness-review-gate-followups.md` diff). 아울러 배정된 26개 리뷰 산출물 자체의 markdown
링크 무결성도 스캔했다(`spec-link-integrity.test.ts` 가드는 `review/**` 를 검증 대상으로
보지 않으므로 build 가 못 잡는 영역).

## 발견사항

- **[WARNING]** `spec-links.ts` 의 `findBrokenPlanLinks` 를 설명하는 대형 JSDoc 블록이
  엉뚱한 선언(`export { collectLivePlanMarkdown };`)에 붙어 있다 — 실제로 서술하는 대상
  함수 바로 위가 아니다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:269-304` (JSDoc 은
    269-301, 그 사이 302-303 줄 comment, 304 줄 `export { collectLivePlanMarkdown };`,
    306 줄이 실제 대상 `export function findBrokenPlanLinks`)
  - 상세: 269줄부터 시작하는 `/** Validate relative links in the *living* plans... */`
    블록은 내용 전부가 `findBrokenPlanLinks`(스코프·측정치·`checkSelfAnchors: false` 근거
    등)를 설명하는데, 그 블록 바로 다음 선언은 306줄의 `findBrokenPlanLinks` 가 아니라
    304줄의 `export { collectLivePlanMarkdown };`(re-export, 자기 자신의 1줄 line-comment
    를 따로 갖고 있음)다. 이 파일의 다른 모든 JSDoc(예: 256줄 → 263줄 `findBrokenLinks`,
    361줄 → 368줄 `findBrokenSpecLinksInSources`)은 예외 없이 "JSDoc 바로 다음 줄이 대상
    선언" 패턴을 지키는데 이 자리만 어긋난다. IDE hover·TypeDoc 류 도구는 다음 선언에
    JSDoc 을 귀속시키므로, `collectLivePlanMarkdown` re-export 를 hover 하면 자신과 무관한
    (`findBrokenPlanLinks`) 설명이 뜨고 정작 `findBrokenPlanLinks` 는 문서가 없는 것처럼
    보인다.
  - 제안: JSDoc 블록(269-301줄)을 `export function findBrokenPlanLinks` (현 306줄) 바로
    위로 옮기고, `export { collectLivePlanMarkdown };` 위의 2줄 line-comment(302-303줄,
    "plan 수집은 `plan-scan.ts` 소관이다…")는 그 자리에 그대로 남긴다.

- **[WARNING]** `review/consistency/**` SUMMARY.md 2건의 `harness-review-gate-followups.md`
  상대링크가 깨져 있다 — `../` 깊이가 실제 디렉터리 깊이보다 2단계 부족하다.
  - 위치: `review/consistency/2026/08/10/02_18_34/SUMMARY.md:45`,
    `review/consistency/2026/08/10/02_33_44/SUMMARY.md:40`
  - 상세: 두 파일 모두
    `[\`harness-review-gate-followups.md\`](../../../../plan/in-progress/harness-review-gate-followups.md)`
    형태로 링크한다. 파일 위치가 `review/consistency/2026/08/10/<세션>/SUMMARY.md` — repo
    루트 기준 6단계 깊이(`review`/`consistency`/`2026`/`08`/`10`/`<세션>`)이므로 루트로
    돌아가려면 `../` 가 6개 필요한데 4개만 썼다. 실제로 resolve 하면
    `review/consistency/plan/in-progress/harness-review-gate-followups.md` 가 되어 파일이
    없다(직접 확인: `os.path.normpath` 후 `os.path.exists` → False, 두 파일 동일 결함).
    `spec-link-integrity.test.ts` 는 `spec/**.md` 본문과 codebase 소스만 스캔해 `review/**`
    는 대상이 아니므로 build 가 잡지 못한다 — 사람이 GitHub PR 뷰나 로컬에서 링크를 눌러야
    발견된다. 두 SUMMARY 모두 이 링크의 목적이 "번들 예산 결함을 다음 사람이 후속 plan 에서
    찾도록" 안내하는 것인데, 링크가 죽어 있으면 그 목적을 정확히 못 이룬다.
  - 제안: `../../../../../../plan/in-progress/harness-review-gate-followups.md` (6단계)로
    정정. 같은 패턴이 향후 세션에서도 반복될 수 있으므로, SUMMARY 템플릿에 이런 back-link
    를 넣을 때 상대깊이를 자동 계산하거나 최소한 커밋 전 링크 존재를 눈으로 한 번 확인하는
    습관을 권장.

- **[INFO]** `harness-env-value-subpattern-dedup.md` 새 절의 blockquote 한 줄이 `>` 뒤
  공백이 빠져 형제 줄과 형식이 어긋난다.
  - 위치: `plan/in-progress/harness-env-value-subpattern-dedup.md:64`
  - 상세: 같은 blockquote 문단의 다른 모든 줄은 `> 텍스트`(공백 포함)인데 64번째 줄만
    `>두면 walker 중복을 찾는 사람이 발견하지 못한다…` 로 공백이 없다. CommonMark 상
    `>` 뒤 공백은 선택이라 렌더링 자체는 깨지지 않지만, 같은 문단 안에서 스타일이
    불일치한다.
  - 제안: `> 두면`으로 정정(사소, 게이트 비차단).

- **[INFO]** 본 라운드가 배정받은 prompt 에 실제 코드 변경(diff)이 빠져 있어(알려진 결함,
  이미 `plan/in-progress/harness-review-gate-followups.md` 에 등재됨) 이 documentation
  reviewer 도 워킹트리 직접 조회로 대체 판정했음을 기록해 둔다. 배정된 26개 리뷰 산출물
  자체는 문서화 관점에서 실질 결함 없음 — 시점 기록(point-in-time record)이라는 성격상
  이후 커밋에서 참조 대상이 삭제/이동돼도(예: `docs-guard-legacy-fixture-coverage.md` 가
  이 워크트리의 후속 커밋에서 fix 로 흡수돼 삭제됨) `plan-lifecycle.md §3` "인입 참조" 규칙에
  따라 정상이다(위 WARNING 의 링크 깊이 오류와는 별개 — 그건 대상이 이동한 게 아니라
  처음부터 `../` 개수가 틀렸다).

## 긍정적으로 확인된 점 (참고)

- `plan-scan.ts`(신규): 모든 export 함수·상수에 JSDoc/line-comment 가 있고, 설계 근거
  (`isIsoDate` 의 라운드트립 비교가 "일"만 보면 충분한 이유, `matter(raw, {})` 옵션 객체가
  캐시 오염을 막는 이유 등)를 실측 수치와 함께 남겨 코드만 읽어서는 알 수 없는 "왜"를
  잘 보존한다.
- `plan-frontmatter.test.ts` 헤더 주석은 "판정 로직은 전부 `plan-scan.ts`/`spec-links.ts`
  에 있고 이 파일은 호출부일 뿐" 이라고 명시해, 이번 리팩터로 옮겨진 책임 소재를 정확히
  안내한다. 회고 서사를 커밋 메시지·plan 산출물로 밀어내고 "현재 규칙만" 담겠다는 명시적
  원칙(같은 파일 주석)도 지키고 있다.
- `spec/conventions/spec-impl-evidence.md` §2.2·§4.2·`PROJECT.md:277`·
  `.claude/docs/plan-lifecycle.md §4/§5` 4개 문서 층의 서술이 새 가드 2종(status 종료값·
  살아있는 plan 링크)의 스코프·허용값·예외 규칙에 대해 서로 line-level 로 일치한다(선행
  6차 consistency/code-review 라운드가 이미 실측 확인했고, 본 리뷰도 재확인해 이견 없음).
- 날짜 오기(`2026-08-10` → `2026-08-09`, build 가드 도입일) 정정이 `spec-impl-evidence.md`·
  `plan-lifecycle.md`·`plan-frontmatter.test.ts` 세 SoT 에 걸쳐 값 수준으로 동기화됐다.

## 요약

핵심 신규 코드(`plan-scan.ts`, `spec-links.ts`, `plan-frontmatter.test.ts`)의 문서화 수준은
전반적으로 높다 — 설계 결정의 근거를 실측치와 함께 남기고, SoT 문서 4개 층(PROJECT.md·
spec-impl-evidence.md·plan-lifecycle.md·코드 주석)이 서로 정합하다. 다만 `spec-links.ts`
에서 JSDoc 블록이 의도한 대상이 아닌 인접 re-export 문에 구조적으로 잘못 붙어 있어 IDE
hover·문서 생성 도구를 오도할 소지가 있고(WARNING), 이번 PR 이 새로 만든 리뷰 산출물 중
2곳(`02_18_34`/`02_33_44` SUMMARY.md)의 back-link 상대경로가 깊이 계산 오류로 실제로
깨져 있다(WARNING, build 비차단이나 사용성 결함). 그 외 blockquote 공백 누락 1건은 INFO.
Critical 급 문서화 결함은 없음.

## 위험도

LOW
