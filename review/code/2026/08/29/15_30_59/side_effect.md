# 부작용(Side Effect) 리뷰

## 검토 범위 및 방법

- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `extractLinks()` 재구현(줄 단위 매칭 → 마스킹된 전문 매칭), `buildMaskedDoc`/`lineForOffset` 헬퍼 신설.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 멀티라인 링크 회귀 테스트 다수 추가.
- `plan/in-progress/harness-review-gate-followups.md` — 해소 서술·체크박스 갱신.
- `review/code/2026/08/29/{14_36_39,15_01_34}/**` — 이전 두 리뷰 라운드(1·2회차)의 산출물이 신규 커밋으로 포함됨 (RESOLUTION/SUMMARY/meta.json/_retry_state.json/각 리뷰어 `.md`).

저장소를 직접 고치지 않고 정적 분석 + 읽기 전용 검증만 수행했다. `git status --short` 로 시작·종료 시점 모두 확인 — 이 세션 산출물 디렉터리(`review/code/2026/08/29/15_30_59/`, orchestrator 가 미리 만든 것) 외 변경 없음. 아래 근거는 전부 저장소를 읽기만 하는 명령으로 얻었다:

- `grep -rn "extractLinks|MdLink|LinkViolation|\.raw\b"` 로 소비처 전수 확인.
- `pnpm exec vitest run src/lib/docs/__tests__/{plan-frontmatter,spec-links,spec-link-integrity}.test.ts` → **194 passed** (repo 상태 그대로, 뮤테이션 없음) — 직전 라운드가 고쳤다고 주장하는 Critical(plan 예시 문구가 자기 자신이 고치는 가드를 깨뜨림)이 실제로 해소돼 있음을 직접 재확인.
- `git ls-files review/code/2026/08/29/{14_36_39,15_01_34}/` 로 실제 커밋 대상 파일 목록을 확인(둘 다 `_prompts/**` 는 tracked 아님 — 이 리뷰의 범위 밖).

## 발견사항

- **[WARNING]** 이 PR 이 스스로 "고쳤다" 고 서술하는 바로 그 함정(인라인 코드 마스킹이 예시 문구를 진짜 링크로 만드는 패턴)이, 같은 diff 로 커밋되는 이전 라운드 리뷰 산출물 안에 펜스 없이 **여전히 여러 곳 남아 있다.**
  - 위치: `review/code/2026/08/29/14_36_39/RESOLUTION.md:19` (`` `` [a]`code`(b) `` ``, 4-space 들여쓰기 코드블록 — 3중 백틱 펜스 아님), `review/code/2026/08/29/14_36_39/SUMMARY.md:10` (표 셀 안에 동일 문구), `review/code/2026/08/29/14_36_39/requirement.md:18`·`:68` (동일 문구 재인용), `review/code/2026/08/29/15_01_34/requirement.md` 상단(3~9행 부근, 단일 백틱 변형으로 재인용).
  - 상세: `extractLinks` 의 마스킹은 정규식 `` /`[^`]*`/g `` 로 백틱 쌍 사이를 통째로 지운다. 위 문자열들에 이 정규식을 적용하면 이중/단일 백틱 스팬이 순서대로 지워지고 `[a](b)` 형태의 새 링크가 남는다 — 바로 이 PR 이 `plan/in-progress/harness-review-gate-followups.md` 에서 두 번 겪은 것과 동일한 메커니즘이다(라운드 1 Critical, 라운드 2 Warning #4). **다만 실제로 확인한 결과 현재는 안전하다** — 네 개 공개 스캔 진입점(`findBrokenLinks`→`spec/**`, `findBrokenGovernanceLinks`→루트 비재귀 `*.md`+`.claude/**`, `findBrokenSpecLinksInSources`→코드 소스 중 타깃이 `spec/**.md`인 것만, `findBrokenPlanLinks`→`plan/in-progress/*.md` 최상위 한정)는 전부 `review/**` 를 스캔 대상에서 제외한다. `collectGovernanceMarkdown` 의 루트 수집이 `recurse: false` 라 `review/` 하위로 내려가지 않고, 나머지 세 진입점은 애초에 다른 디렉터리 트리만 본다.
  - 이 항목은 라운드 2(`15_01_34/side_effect.md`)에서 이미 WARNING/LOW 로 보고됐고, 라운드 2 의 `RESOLUTION.md` Warning #4 는 "plan 문서에 회피법을 관례로 기록" 하는 것으로 대응을 마쳤다 — 즉 **과거 라운드의 이미 커밋된 산출물 자체는 고치지 않기로(정적 아카이브로 남기기로) 이미 결정**돼 있다. 새로 발견된 사실은 아니지만, 이번 라운드에서도 여전히 미해소 상태이고 인스턴스 수가 3곳(라운드1) → 라운드2 자체 산출물에도 재현(4곳 이상)으로 늘어난 채 함께 커밋되므로, 다음 사람이 `review/**` 를 어떤 링크 가드 스코프에라도 편입시키는 순간 이 여러 인스턴스가 동시에 RED 를 낸다는 사실을 다시 한 번 명시해 둔다.
  - 제안: 즉시 차단 사유 아님(현재 스코프 배제로 안전 확인, 과거 라운드가 이미 "역사적 기록은 보존" 으로 판단). 다만 `collectGovernanceMarkdown` 근처 주석에 "이 배제가 깨지면 `review/**` 안의 과거 리뷰 산출물이 위험하다" 는 교차 참조를 한 줄 남겨 두면, 향후 스코프 확장 시 이 사각지대가 재조사 없이 바로 드러난다(라운드 2 제안과 동일, 아직 미반영).

- **[INFO]** `extractLinks()` 의 반환 계약이 넓어짐(시그니처 불변, 의미는 확장) — 라운드 1·2 에서 이미 지적·검증된 사항이며 이번 라운드에서 코드가 추가로 바뀌지 않아 재확인만 했다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`export function extractLinks(absPath: string): MdLink[]`, 시그니처 동일).
  - 상세: `MdLink.line`/`LinkViolation.line` 의 의미가 "그 줄"에서 "링크가 시작한 줄"로, `raw` 가 "단일행"에서 "개행 포함 가능"으로 바뀌었다. `grep -rn "\.raw\b"` 전수 확인 결과 `MdLink.raw` 를 소비하는 외부 호출부는 없고(`registry.test.ts` 의 `.raw` 는 무관한 다른 타입), `.line` 을 소비하는 두 가드(`plan-frontmatter.test.ts`, `spec-link-integrity.test.ts`)는 `source:line -> target` 형태 출력에만 쓰여 "시작 줄" 의미와 자연히 호환된다.
  - 제안: 조치 불요 — documentation 리뷰가 인터페이스 필드 주석 보강을 이미 별도로 다루고 있고, 이번 diff 도 필드 옆 주석(`// 링크가 **시작한** 줄...`)을 추가했다.

- **[INFO]** 모듈 스코프 공유 가변 정규식(`LINK_RE`, `g` 플래그)이 계속 유지된다 — 신규 위험 아님.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`const LINK_RE = /\[([^\]]*)\]\(([^)\n]+)\)/g;`, 사용 직전 `LINK_RE.lastIndex = 0` 로 매번 리셋).
  - 상세: 이 패턴은 diff 이전부터 존재했다(예전엔 줄마다 리셋, 지금은 파일 전체 마스킹 텍스트에 대해 1회 리셋). 현재의 동기·순차 호출 패턴(`findBrokenLinksInFiles` 의 파일별 for-loop)에서는 재진입/병렬 접근이 없어 상태 누수가 없다.
  - 제안: 조치 불요. 향후 `extractLinks` 가 병렬/재진입 호출로 확장될 때만 재검토.

- **[INFO]** 신규 테스트 fixture 의 파일시스템 부작용은 저장소 밖(OS 임시 디렉터리)에 완전히 격리됨.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` 의 신규 `describe("extractLinks — 링크 텍스트가 줄을 넘어도 본다", ...)`, `describe("멀티라인 링크의 깨진 타깃도 잡힌다", ...)` 블록 — 각각 `fs.mkdtempSync(path.join(os.tmpdir(), "extract-links-ml-"))` / `"ml-broken-"` 로 생성, `afterAll` 에서 `fs.rmSync(root, { recursive: true, force: true })` 로 정리.
  - 상세: 서로 다른 prefix 로 고유 임시 경로를 받아 다른 describe 블록 fixture 와 충돌하지 않는다. 저장소 트리에 대한 쓰기·삭제는 없다.
  - 제안: 없음(양호).

- **[INFO]** `review/code/2026/08/29/{14_36_39,15_01_34}/**` 신규 파일 생성(SUMMARY/RESOLUTION/meta.json/`_retry_state.json`/각 리뷰어 `.md`)은 프로젝트 관례(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)에 부합한다. `_retry_state.json` 에 로컬 절대경로(`/Users/gehrig/...`)가 그대로 박혀 있으나, `git log --oneline -- 'review/code/**/_retry_state.json'` 로 확인한 결과 이 저장소가 이미 반복해 온 표준 패턴이며 이번 diff 가 새로 만든 문제가 아니다.
  - 제안: 조치 불요.

## 시그니처/인터페이스/전역변수/환경변수/네트워크/이벤트 관점 요약

- 시그니처 변경: 없음. `extractLinks`, `findBrokenLinks`, `findBrokenGovernanceLinks`, `findBrokenSpecLinksInSources`, `findBrokenPlanLinks` 모두 매개변수·반환 타입 동일.
- 새 전역 변수: 없음. `LINK_RE`/`FENCE_RE` 는 기존에도 모듈 스코프 상수였고 `LINK_RE` 리터럴만 바뀌었다. 신규 `MaskedDoc` 인터페이스·`buildMaskedDoc`/`lineForOffset` 헬퍼는 순수 함수이며 자체 상태를 갖지 않는다.
- 파일시스템: 테스트는 OS 임시 디렉터리에만 쓴다. `review/**` 신규 파일은 관례에 부합하는 의도된 산출물.
- 환경 변수 읽기/쓰기: 없음.
- 네트워크 호출: 없음.
- 이벤트/콜백: 없음 (순수 동기 함수, 콜백 등록·해제 없음).
- `plan/in-progress/harness-review-gate-followups.md` 변경은 체크박스·서술 텍스트뿐이며, 코드 실행에 영향 없음. 직전 라운드가 지적한 Critical(예시 문구가 자기 자신이 고치는 가드를 깨뜨림)은 3중 백틱 펜스로 감싸 해소됐음을 `vitest run` 실측(194 passed)으로 재확인했다.

## 요약

핵심 코드 변경(`extractLinks` 재구현)은 함수 시그니처·전역 상태 도입·파일시스템/네트워크/환경변수 접근 패턴에 새로운 부작용을 만들지 않으며, 반환 계약이 넓어진 것(멀티라인 링크 포착)은 의도된 변경으로 plan 문서에 뮤테이션 근거가 남아 있고 외부 소비처 grep 으로도 실질 파급이 없음을 확인했다. `plan-frontmatter`/`spec-links`/`spec-link-integrity` 세 스위트를 직접 재실행해 194건 모두 GREEN 임을 검증했고, 이는 이 PR 이 두 차례(라운드1 Critical, 라운드2 Warning) 자기 자신이 만든 트리거 문자열에 스스로 걸렸던 결함이 현재는 해소돼 있음을 뒷받침한다. 다만 그 두 사고의 원인이 됐던 정확한 트리거 문자열(``[a]`code`(b)`` 계열)이 같은 커밋으로 함께 들어가는 과거 리뷰 산출물(`14_36_39/RESOLUTION.md`·`SUMMARY.md`·`requirement.md`, `15_01_34/requirement.md`) 안에는 펜스 없이 그대로 남아 있다 — 현재는 `review/**` 가 모든 링크 스캔 스코프 밖이라는, 문서화되지 않은 암묵적 배제에 의존해 안전할 뿐이다. 이 사실은 라운드 2 에서 이미 보고됐고 "역사적 기록은 보존, 즉시 조치 불요" 로 이미 처분됐으므로 새로 차단할 사유는 아니지만, 다음 스코프 변경 시 재조사 없이 드러나도록 교차 참조 주석을 남기는 안은 여전히 미반영이라 다시 한번 WARNING 으로 carry-forward 한다. 저장소를 오염시키는 뮤테이션 없이 읽기 전용 검증(grep 전수 확인 + 테스트 재실행)만 수행했으며 `git status --short` 로 시작·종료 시점 모두 저장소가 깨끗함을 확인했다.

## 위험도

LOW
