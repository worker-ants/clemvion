# 부작용(Side Effect) 리뷰

## 검토 범위 및 방법

- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `extractLinks()` 재구현(줄 단위 → 마스킹 전문 매칭), `buildMaskedDoc`/`lineForOffset` 헬퍼 추가.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 신규 회귀 테스트 다수.
- `plan/in-progress/harness-review-gate-followups.md` — 해소 서술 추가(위험 예시 문구를 펜스로 감쌈).
- `review/code/2026/08/29/14_36_39/{RESOLUTION,SUMMARY,_retry_state.json,meta.json,*.md}` — 직전 리뷰 라운드(14_36_39)의 산출물 신규 커밋.

뮤테이션 없이 정적 분석만 수행했다. 저장소를 직접 고치지 않았으므로 원복 절차는 불필요했고, `git status --short` 로 확인한 결과 이 세션의 산출물 디렉터리(`review/code/2026/08/29/15_01_34/`) 외 변경은 없다. 실제 스코프 판정을 위해 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `collectGovernanceMarkdown`/`collectSpecMarkdown`/`findBrokenPlanLinks` 스코프 정의를 직접 열어 확인했고, `.raw`/`extractLinks`/`findBroken*` 소비처를 `grep -rl`로 전수 확인했다(둘 다 저장소 읽기 전용 조회).

## 발견사항

- **[WARNING]** 이 PR 이 "고쳤다"고 서술하는 바로 그 함정(마스킹이 인라인 코드를 지워 예시 문구를 진짜 링크로 만드는 패턴)이, 같은 커밋이 새로 추가하는 리뷰 산출물 2개 파일에 **펜스 없이 그대로 3회 재현**되어 있다.
  - 위치: `review/code/2026/08/29/14_36_39/RESOLUTION.md:19` (`` `` [a]`code`(b) `` ``), `review/code/2026/08/29/14_36_39/SUMMARY.md:10` (표 셀 안에 동일 문구), `review/code/2026/08/29/14_36_39/requirement.md:18` (동일 문구 재인용). 세 곳 모두 3중 백틱 펜스가 아니라 **이중 백틱 인라인 코드**로만 감싸져 있다.
  - 상세: `extractLinks` 의 마스킹은 정규식 `` /`[^`]*`/g `` 로 백틱 쌍을 제거한다. 이 문자열(`` `` [a]`code`(b) `` ``)에 그 정규식을 적용하면 선두 이중 백틱이 빈 코드스팬으로, `` `code` `` 가 코드스팬으로 각각 지워지고 `[a](b)` 링크가 새로 생긴다 — 바로 이 PR 이 `plan/in-progress/harness-review-gate-followups.md` 에서 겪은 것과 동일한 메커니즘이다. 다만 실제로 확인한 결과, 네 개 공개 스캔 진입점(`findBrokenLinks`→`spec/**`, `findBrokenGovernanceLinks`→루트 비재귀 `*.md`+`.claude/**`, `findBrokenSpecLinksInSources`→코드 소스 중 타깃이 `spec/**.md`인 것만, `findBrokenPlanLinks`→`plan/in-progress/*.md` 최상위 한정)는 전부 `review/**` 를 스캔 대상에서 제외한다(`collectGovernanceMarkdown` 의 루트는 `recurse:false`라 `review/`가 재귀되지 않고, 나머지 세 경로는 애초에 다른 디렉터리만 본다). 그래서 **현재는 침묵 위험이 실현되지 않는다** — 직접 스코프 정의를 읽어 확인했다.
  - 다만 이 PR 의 postmortem 자체가 "문서에 쓴 예시가 스캐너에게는 데이터다"라고 결론 내렸는데, 같은 커밋이 그 정확한 트리거 문자열을 인용하면서 두 곳 더 늘렸다. 지금은 디렉터리 스코프 배제에만 의존해 안전한 상태이고, 이 저장소는 과거에도 "성능/스코프 좁힘이 가드를 조용히 멈추게 한다" 류의 사각지대가 반복 재발한 이력이 있다(같은 plan 문서 §서두 참고) — `review/**` 가 향후 어떤 링크 가드에라도 편입되는 순간(예: 리뷰 산출물 상호 참조 무결성 점검 추가) 이 세 인스턴스가 동시에 RED 를 만든다.
  - 제안: 즉시 조치는 불요(현재 스코프 배제로 안전 확인됨). 다만 이런 예시 문구를 인용할 때는 향후에도 3중 백틱 펜스로 감싸는 관례를 문서화하거나, `review/**` 를 스캔 스코프에서 제외한다는 불변식 자체를 `collectGovernanceMarkdown` 주석 옆에 "이 배제가 깨지면 아래 파일들이 위험하다" 식으로 교차 참조해 두면 다음 스코프 변경 시 이 사각지대가 재조사 없이 드러난다.

- **[INFO]** `extractLinks()` 반환 계약이 넓어짐(시그니처 불변, 의미는 확장) — 직전 라운드(`review/code/2026/08/29/14_36_39/side_effect.md`)에서 이미 동일하게 지적·검증된 사항이며, 이번 라운드에서 코드가 추가로 바뀌지 않았으므로 재확인만 했다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`export function extractLinks`, 시그니처 `(absPath: string): MdLink[]` 그대로).
  - 상세: `MdLink.line`(및 이를 그대로 옮기는 `LinkViolation.line`)의 의미가 "그 줄"에서 "링크가 시작한 줄"로, `raw`가 "단일행"에서 "개행을 포함할 수 있는 원문"으로 바뀌었다. `grep -rn "\.raw\b"` 로 저장소 전체를 확인한 결과 `MdLink.raw`를 소비하는 외부 호출부는 없고(`registry.test.ts`의 `.raw`는 무관한 다른 타입), `.line`을 소비하는 두 가드(`plan-frontmatter.test.ts:113`, `spec-link-integrity.test.ts:44`)는 `source:line -> target` 형태로만 출력해 "시작 줄" 의미와 자연히 호환된다. 실질적 파급은 없다.
  - 제안: 조치 불요(이미 documentation 리뷰가 인터페이스 주석 보강을 별도로 권고했고, 본 PR 도 필드 옆 주석을 추가했다).

- **[INFO]** 모듈 스코프 공유 가변 정규식(`LINK_RE`, `g` 플래그)이 계속 유지된다 — 신규 위험 아님.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`const LINK_RE = ...`, 사용 직전 `LINK_RE.lastIndex = 0` 로 매번 리셋).
  - 상세: 이 패턴은 diff 이전부터 존재했다(예전엔 줄마다 리셋, 지금은 파일 전체에 대해 1회 리셋). 동기·순차 호출 패턴에서는 상태 누수가 없다.
  - 제안: 조치 불요. 향후 병렬/재진입 호출로 확장될 때만 재검토.

- **[INFO]** 신규 테스트 fixture 의 파일시스템 부작용은 저장소 밖(OS 임시 디렉터리)에 완전히 격리됨.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` 의 신규 `describe("extractLinks — 링크 텍스트가 줄을 넘어도 본다", ...)` 및 `describe("멀티라인 링크의 깨진 타깃도 잡힌다", ...)` 블록 — 각각 `fs.mkdtempSync(path.join(os.tmpdir(), ...))`로 생성, `afterAll`에서 `fs.rmSync(root, { recursive: true, force: true })`로 정리.
  - 상세: 두 블록 모두 서로 다른 prefix(`extract-links-ml-`, `ml-broken-`)로 고유 임시 경로를 받으므로 다른 describe 블록의 fixture와 충돌하지 않는다. 저장소 트리에 대한 쓰기·삭제는 없다.
  - 제안: 없음(양호).

- **[INFO]** `review/code/2026/08/29/{14_36_39,15_01_34}/**` 신규 파일 생성(SUMMARY/RESOLUTION/meta.json/`_retry_state.json`/각 리뷰어 `.md`) 은 프로젝트 관례(코드 리뷰 산출물은 `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`에 저장)에 정확히 부합하며, `git log -- "review/code/**/_retry_state.json"` 로 확인한 결과 이런 형태의 커밋은 이 저장소에서 이미 반복적으로 발생해 온 표준 패턴이다(예: 직전 커밋 `cf613bf89`). `_retry_state.json`에 로컬 절대경로(`/Users/gehrig/...`)가 그대로 박히는 것도 기존 관례와 동일해 이번 diff 가 새로 만든 문제는 아니다.
  - 제안: 조치 불요.

## 시그니처/인터페이스/전역변수/환경변수/네트워크/이벤트 관점 요약

- 시그니처 변경: 없음. `extractLinks`, `findBrokenLinks`, `findBrokenGovernanceLinks`, `findBrokenSpecLinksInSources`, `findBrokenPlanLinks` 모두 매개변수·반환 타입 동일.
- 새 전역 변수: 없음. `LINK_RE`/`FENCE_RE`는 기존에도 모듈 스코프 상수였고 리터럴만 바뀌었다. 신규 `MaskedDoc` 인터페이스·`buildMaskedDoc`/`lineForOffset` 헬퍼는 순수 함수이며 상태를 갖지 않는다.
- 파일시스템: 테스트는 OS 임시 디렉터리에만 쓴다. `review/**` 신규 파일은 관례에 부합하는 의도된 산출물이다.
- 환경 변수 읽기/쓰기: 없음.
- 네트워크 호출: 없음.
- 이벤트/콜백: 없음(순수 동기 함수).
- `plan/in-progress/harness-review-gate-followups.md` 변경은 체크박스·서술 텍스트뿐이며, 직전 라운드가 지적한 Critical(예시 문구가 자기 자신이 고치는 가드를 깨뜨림)은 3중 백틱 펜스로 감싸 해소됐음을 직접 스코프 코드를 읽어 확인했다.

## 요약

핵심 코드 변경(`extractLinks` 재구현)은 시그니처·전역 상태·파일시스템/네트워크/환경변수 접근 패턴에 새로운 부작용을 만들지 않으며, 직전 라운드가 지적한 Critical(plan 문서의 예시 문구가 자기 자신이 고치는 `findBrokenPlanLinks` 가드를 깨뜨림)도 펜스 처리로 해소되었음을 스코프 코드 직접 확인으로 검증했다. 다만 같은 커밋이 새로 커밋하는 리뷰 산출물 파일(`RESOLUTION.md`/`SUMMARY.md`/`requirement.md`) 안에 동일한 위험 트리거 문자열이 펜스 없이 3곳 더 인용되어 있다 — 현재는 `review/**`가 모든 링크 가드의 스캔 스코프 밖이라 안전하지만, 이는 우연한 배제에 의존하는 잠재 결함이며 이 PR 의 교훈("문서 예시가 스캐너에겐 데이터다")과 정면으로 부딪힌다. 즉시 차단할 사안은 아니나 WARNING 으로 기록한다.

## 위험도

LOW
