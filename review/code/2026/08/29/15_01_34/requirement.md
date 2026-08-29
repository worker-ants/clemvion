# 요구사항(Requirement) 리뷰 결과

## 사전 확인 (검증용 뮤테이션 없이 수행)

- `pnpm exec vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts src/lib/docs/__tests__/spec-links.test.ts` →
  **174 passed** (repo 상태 그대로, 뮤테이션 없이 read-only 확인). 이번 diff 가 고쳤다고 주장하는
  이전 라운드(`14_36_39`)의 Critical(#1 — `plan/in-progress/harness-review-gate-followups.md` 에 쓴
  예시 `` `[a]`code`(b)` `` 가 인라인코드 마스킹 후 `[a](b)` 진짜 링크가 되어 `plan-frontmatter.test.ts`
  를 RED 로 만들던 문제)이 실제로 해소됐음을 직접 확인했다 — 현재 diff 의 해당 예시는 트리플
  백틱 펜스로 감싸져 있고(`plan/in-progress/harness-review-gate-followups.md`, "1. 인라인 코드는
  **지운다**…" 항목 아래), `FENCE_RE` 는 들여쓴 펜스(`^(\s*)(```|~~~)`)도 인식하므로 스캔 대상에서
  제외된다.
- `RESOLUTION.md` 의 "신규 9건" 주장도 diff 의 `it(...)` 블록을 직접 세어 일치함을 확인했다(멀티라인
  8건 + 통합경로 1건 = 9건).
- 저장소 트리는 건드리지 않았다 — 검증용 재현은 저장소 밖 scratch
  (`/private/tmp/.../scratchpad/sim.js`)에서 `extractLinks` 알고리즘을 그대로 옮겨 실행하고,
  실제 `mdast-util-from-markdown`(같은 파일이 heading slug 계산에 쓰는 바로 그 CommonMark 파서)과
  대조했다. `git status --short` 로 저장소가 깨끗함을 재확인.

## 발견사항

- **[WARNING]** `extractLinks` 의 신규 마스킹 매칭이 **문단 경계(빈 줄)를 건너뛰는 링크를 실제
  CommonMark 와 반대로 링크로 오판**할 수 있다 — 코드펜스 축은 막았지만 "빈 줄(문단 분리)" 축은
  막지 않았다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:79`(`LINK_RE` 의
    `[^\]]*` 가 개행을 무제한 포함), `:148`-`169`(`buildMaskedDoc` — 펜스가 아닌 빈 줄은 그대로
    빈 문자열이 되어 `[^\]]*` 매칭을 막지 못함). 회귀 테스트 공백은
    `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:274`-`368`
    (`describe("extractLinks — 링크 텍스트가 줄을 넘어도 본다")` — 목적지가 줄을 넘는 경우, 펜스를
    사이에 둔 경우만 "링크가 아니어야 한다" 쪽을 고정했고, **빈 줄(문단 경계)을 사이에 둔 경우는
    아예 케이스가 없다**).
  - 상세: 이 함수 바로 위 JSDoc 은 "아래는 **양방향**으로 고정한다 — 넓히는 방향만 잠그면 '전부
    링크로 본다'는 반대 오류가 통과하므로, 목적지가 줄을 넘는 경우와 코드펜스를 사이에 둔 경우는
    링크가 **아니어야** 한다는 것도 함께 단언한다" 고 명시적으로 "역방향 안전성"을 설계 목표로
    선언한다. 그런데 CommonMark 는 **빈 줄 하나만으로도 문단이 갈리고, 링크의 인라인 파싱은 문단을
    넘지 못한다** — 이 저장소가 실제로 쓰는 `mdast-util-from-markdown` 으로 직접 확인했다
    (scratch 재현, `node -e "require('mdast-util-from-markdown').fromMarkdown('[text\n\nsome other
    para](url)\n')"`): `[text` 와 `some other para](url)` 은 **서로 다른 두 `paragraph` 노드**로
    파싱되고 link 노드는 전혀 생기지 않는다. 반면 이번 diff 의 `buildMaskedDoc`/`LINK_RE` 조합을
    그대로(코드 한 글자도 바꾸지 않고) scratch 에서 재현하면 같은 입력에 대해
    `[{ line: 1, raw: "[text\n\nsome other para](url)", target: "url" }]` 를 반환한다 — **실제로는
    링크가 아닌 두 문단을 링크로 오판**한다. 두 번째 케이스(`[open bracket without close on this
    para\n\nSecond para](target.md) rest`)로도 동일하게 재현된다 — 앞 문단의 짝없는 `[` 가 몇 문단
    뒤의 아무 `](...)` 와 결합해 가짜 링크를 만든다.
  - 왜 문제인가: 이 스캐너는 `findBrokenLinks`/`findBrokenSpecLinksInSources`/`findBrokenPlanLinks`
    3개 build-차단 가드(`spec/conventions/spec-impl-evidence.md` §4.2, `spec-link-integrity.test.ts`
    등)의 핵심 판정 함수다. 이 결함은 **존재하지 않는 링크에 대해 DEAD/ANCHOR 위반을 만들어낼 수
    있다** — 원래 이 PR 이 고치려던 방향(멀티라인 링크를 놓쳐 침묵 통과)의 **정반대** 실패 모드이자,
    이 폴더가 반복해 데인 계열("성능/단순화가 가드를 조용히 멈추게 한다")의 거울상("정밀화가 가드를
    거짓으로 시끄럽게 만든다")이다. 문서에 `[` 를 각주·시그마 표기 등으로 쓰고 훨씬 뒤 문단에
    `](` 패턴이 우연히 나타나면(이 저장소는 한국어 기술문서·수식·마크다운 참조가 많다), 무관한 PR
    이 이 가드 때문에 build 가 막힐 수 있다. 라이브 트리 현재 스캔이 GREEN 인 것은 "지금은 이
    패턴이 없다"는 것이지 "이 경로가 안전하다"는 뜻이 아니다.
  - 제안: 문단 경계(연속된 빈 줄, 즉 원본 기준 `line.trim() === ""`)를 만나면 코드펜스와 동일하게
    "]" 센티널로 마스킹하거나(다만 정상적인 **같은 문단 내** 소프트 줄바꿈 링크는 깨지지 않게
    구분 필요 — CommonMark 의 "빈 줄 = 문단 경계" 규칙만 정확히 반영), 또는 아예 `fromMarkdown`
    AST 순회로 전환해 `link` 노드만 신뢰하는 방향을 검토한다(이 파일이 heading slug 에는 이미
    이 방식을 쓰고 있다 — "손으로 짠 정규식이 edge case 에서 실제 렌더러와 벌어진다"는 이유로).
    최소한 회귀 테스트에 "빈 줄로 분리된 문단은 링크가 아니다" 케이스를 추가해 이 축을 고정해야
    한다.

- **[INFO]** 위 결함은 현재 라이브 트리(`spec/**`, 거버넌스, `plan/in-progress/**`, codebase 소스)
  에서는 관측되지 않는다 — plan 문서의 뮤테이션 표가 보고한 "전수 GREEN" 과 이번 리뷰의 read-only
  테스트 실행(174 passed) 이 이를 뒷받침한다. 즉시 build 를 막는 상태는 아니므로 CRITICAL 이 아닌
  WARNING 으로 분류했다 — 다만 향후 임의의 무관한 문서 편집이 이 축을 건드리면 조용히 재발할 수
  있는 latent 결함이다.

- **[SPEC-FIDELITY, 정보성]** `spec/conventions/spec-impl-evidence.md` §4.2 는 이 3개 가드가
  "in-repo `[..](path)` 타깃 존재 + `#anchor` heading slug 대조"만 요구하고, `extractLinks` 내부의
  링크 **탐지** 알고리즘(줄 단위 vs 마스킹된 전문)에 대해서는 아무 것도 규정하지 않는다. 따라서 위
  발견사항은 spec 본문과의 직접적인 불일치(CRITICAL 대상)는 아니며, 코드 자신의 JSDoc·테스트가
  선언한 "CommonMark 파서 기준 실측"·"양방향 고정" 이라는 **자체 목표**에 못 미치는 기능
  완전성/엣지케이스 갭이다. spec 문서 자체의 수정은 필요 없다(§4.2 서술은 여전히 유효).

- **[확인, 조치 불요]** 이전 라운드(`14_36_39`) Critical #1(plan 예시 문구 자기지시 링크)은 실제로
  해소됐다(위 "사전 확인" 참조). `RESOLUTION.md` 가 나열한 Warning #2/#3/#5/#6(함수 분리, 펜스 분기
  중복 제거, 인터페이스 필드 주석, plan 상단 "셋→둘" 동기화)도 diff 에서 실제 반영을 확인했다 —
  `buildMaskedDoc`/`lineForOffset` 분리, `isFenceBoundary || inFence` 병합, `MdLink`/`LinkViolation`
  필드 주석, plan 상단 "둘" 서술 모두 diff 에 존재한다.

## 요약

핵심 결함(멀티라인 링크가 통째로 스캔에서 빠지던 문제)의 수정 자체는 정확하고, 이전 라운드에서
스스로 만든 Critical(plan 예시 문구의 자기지시 링크)도 펜스로 올바르게 봉합했다 — 실측(174 tests
GREEN)으로 확인했다. 다만 새 구현이 "역방향(전부 링크로 오판)까지 잠갔다"고 스스로 선언한 것과
달리, **빈 줄(문단 경계)을 사이에 둔 텍스트는 여전히 링크로 오판될 수 있다** — 실제 CommonMark
파서(`mdast-util-from-markdown`, 같은 파일이 heading slug 계산에 쓰는 그 파서)와 대조해 직접
재현했다. 라이브 트리에는 아직 이 패턴이 없어 즉시 build 를 막지는 않지만, 이 가드가 build-차단
게이트라는 점에서 향후 무관한 문서 편집이 우연히 이 축을 건드리면 조용히 재발할 latent 결함이다.

## 위험도

MEDIUM
