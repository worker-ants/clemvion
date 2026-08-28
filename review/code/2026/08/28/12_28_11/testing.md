# 테스트(Testing) 리뷰 — eslint 9→10 상향 (2회차, 11_45_02 RESOLUTION 반영분)

## 사전 확인 사항

이번 라운드는 직전 리뷰(`review/code/2026/08/28/11_45_02/testing.md`)의 WARNING 2건에 대한
`RESOLUTION.md` 조치(`9bcbb7fa5`, `3a540aa81`)를 포함한다. 아래는 그 조치가 실제로 회귀
안전망을 닫았는지 코드를 직접 열어(`Read`) 재검증한 결과다.

## 발견사항

- **[WARNING]** `text-chunker.spec.ts` 의 신규 force-split 테스트가 "force-split 뒤 캐리오버 없음"
  이라는 자신이 주장하는 불변식을 실제로는 검증하지 못한다 — `overlapBuffer` 값이 해당 테스트
  실행 경로에서 **한 번도 소비(read)되지 않는다**.
  - 위치: `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.spec.ts` 게이트
    92~127줄(신규 `describe('chunkText force-split branch …')`), 대응 원본
    `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts` 게이트 67~81줄
    (force-split 분기, `overlapBuffer = ''` 대입).
  - 상세: 제거된 줄 `overlapBuffer = getOverlapText(currentChunk, chunkOverlap);` 이 죽은 코드였던
    이유는 바로 다음 줄 `overlapBuffer = '';` 가 **무조건** 그 값을 덮어쓰기 때문이다. 이 대입이
    의미를 가지려면 force-split 분기 **이후에 일반 `pushChunk` 로 청크가 하나 더 만들어져야**
    한다(그 청크가 `overlapBuffer` 를 접두어로 소비하므로). 그런데 새 테스트의 fixture
    (`shortSentence` + 공백 + `longSentence`)는 문단이 하나뿐이고, `longSentence` 가 마지막
    "문장"이라 force-split 뒤에 문장 루프가 곧바로 끝난다 — `currentChunk` 는 `''` 로 남고
    `chunkText` 끝의 `if (currentChunk.trim())` 도 진입하지 않으므로, `overlapBuffer` 는 이 실행
    경로에서 **써지기만 하고 한 번도 읽히지 않는다**. 즉 이 테스트는 "force-split 분기에
    진입한다" 와 "force-split 조각이 이전 텍스트를 포함하지 않는다"(둘 다 `forceSplitAndPush` 의
    내부 로직만으로 자명하게 성립 — `overlapBuffer` 와 무관)는 검증하지만, 커밋 메시지·주석·
    `RESOLUTION.md`(`#2`)가 "닫았다"고 주장하는 바로 그 지점(향후 누군가 `overlapBuffer = '';`
    를 지우거나 조건부로 바꿔 force-split **뒤에 이어지는 일반 청크**에 옛 컨텍스트가 새는 회귀)
    은 여전히 무방비다. `git log -S`/뮤테이션으로 직접 확인: `overlapBuffer = '';` 를 주석
    처리해도(즉 옛 `getOverlapText` 값이 살아있다고 가정해도) 이 신규 테스트는 여전히 GREEN 이다
    — 어떤 단언도 `overlapBuffer` 가 실제로 반영된 청크를 보지 않기 때문이다.
  - 제안: fixture 뒤에 force-split 대상 문장 하나를 더 추가해(예: `longSentence` 뒤에 다시
    짧은 일반 문장을 이어 붙여) force-split 종료 후 일반 `pushChunk` 로 청크가 하나 더 생기게
    만들고, 그 청크의 `content` 가 `getOverlapText(강제분할 이전 문맥, chunkOverlap)` 를 접두어로
    포함하지 **않음**을(즉 빈 오버랩) 단언한다. 이렇게 해야 `overlapBuffer = '';` 가 실제로
    유효한 문장으로 고정된다.

- **[INFO]** (직전 라운드 이월, 조치 불요 확인 유지) `expression-resolver.service.ts` /
  `code.handler.ts` 에 새로 생긴 "원본 에러가 `cause` 로 보존된다" 계약을 잠그는 테스트가
  여전히 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`
    게이트 316~318줄, `codebase/backend/src/nodes/data/code/code.handler.ts` 게이트 454줄.
    `expression-resolver.service.spec.ts`/`code.handler.spec.ts` 를 `grep -n cause` 로 재확인한
    결과 여전히 0건 — 이번 라운드의 `RESOLUTION.md` 조치 대상(#1~#5)에도 포함되지 않았다.
  - 상세: 두 파일 모두 메시지 정규식만 단언하므로, 향후 `{ cause: err }` 가 실수로 삭제돼도
    어떤 테스트도 실패하지 않는다. Critical/Warning 은 아니다 — 이 계약은 디버깅 편의성이지
    보안·정확성 불변식이 아니며(보안 쪽은 오히려 `secret-resolver.service.ts` 처럼 *cause 를
    붙이지 않는* 게 계약인 반대 사례), 정적 검사(`preserve-caught-error` 룰 자체)가 "삭제하면
    다시 lint 가 잡는다"는 최소한의 안전망을 이미 제공한다.
  - 제안: 필수는 아니나, 두 곳에 `expect((thrown as Error).cause).toBe(originalError)` 한 줄씩
    추가하면 정적 검사와 별개의 런타임 계약 고정이 된다.

- **[INFO]** (직전 라운드 이월, 미조치) frontend/`channel-web-chat` 의 "eslint 9 잔류 — 상류
  peer 가 아직 10 을 지원하지 않음" 상태에는 backend `eslint-unicorn-peer.spec.ts` 와 대칭되는
  자동 회귀 가드가 없다.
  - 위치: `codebase/frontend/eslint.config.mjs` 게이트 1~21줄(신규 헤더 주석, "해제 조건: 위
    셋의 peer 에 `^10` 이 들어오는 것"). 대조: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`.
  - 상세: 지금은 `eslint-plugin-react`/`eslint-plugin-jsx-a11y`/`eslint-plugin-import` 의
    registry 실측을 사람이 다시 해야만 이 조건이 풀렸는지 알 수 있다. `--strict-peer-dependencies`
    가 사후에(다른 사람이 실수로 올렸을 때) 잡아주긴 하지만, "해제 조건이 충족됐는지" 를
    능동적으로 알려주는 가드는 없다.
  - 제안: 필수는 아니며, 이번 PR 스코프도 아니다(둘 다 devDependency 상향 실패를 사후에
    `--strict-peer-dependencies` 가 막아주는 동일한 안전망 아래 있다). 관측용 가벼운 스크립트를
    고려할 수 있다는 점만 기록.

## 검증한 항목 (문제 없음)

- `secret-resolver.service.spec.ts` 게이트 199~231줄의 신규 복호화 실패 테스트는 견고하다 —
  `Buffer.alloc(12+4+16)`(전부 0) 으로 조립한 envelope 이 AES-256-GCM authTag 검증에서
  **결정적으로**(non-flaky) 실패함을 `secret-crypto.ts` 의 envelope 포맷(`IV(12B)‖ciphertext‖tag(16B)`)
  과 대조해 확인했다. `expect.assertions(3)` 로 catch 블록이 실제로 실행됐음을 강제해(try 가
  통과하면 0건 단언으로 테스트 자체가 실패) vacuous 하지 않다. 메시지(`'Secret decryption failed'`)
  뿐 아니라 `err.cause === undefined` 를 함께 단언해, 향후 누군가 `eslint-disable-next-line` 을
  지우고 `cause: err` 를 붙이는 회귀(보안 불변식 위반)를 실제로 잡는다.
- `eslint-unicorn-peer-guard.ts`/`eslint-unicorn-peer.spec.ts` 의 `parseGteFloor` 확장은
  discriminating fixture 설계가 좋다 — `>=10.4`→`[10,4,0]`, `>=9`→`[9,0,0]` 등 자릿수 생략
  케이스와, 진짜 무효 형태(`'>='`, `'>=x'`)를 함께 추가해 정규식이 과도하게 관대해지지
  않았음을 고정했다. `satisfiesFloor([10,9,1], …)=true` vs `satisfiesFloor([10,0,0], …)=false`
  짝 테스트도 "major 만 올리면 된다"는 오해를 차단하는 좋은 회귀 고정이다. `readInstalledPackageJson`
  으로의 전환(`req()` → 파일 경로 직접 읽기)도 `eslint-plugin-unicorn@73` 의 `exports` 맵 제약을
  실측 근거와 함께 문서화했고, 가드가 재는 대상(설치본 peer range)은 그대로 유지된다.
- `no-useless-assignment` 대응으로 8개 파일에서 `let x: T = <default>` → `let x: T` 로 바뀐
  지점들은 전부 catch 블록이 조기 `return`/`throw` 하는 구조라 실행 경로상 미할당 참조가
  불가능함을 직접 추적 확인했다 — 새 테스트가 없어도 회귀 위험은 낮다(TS strict
  definite-assignment 가 컴파일 타임에 이미 보증).
- `information-extractor.handler.ts` 의 `followUp` 지역화(루프 스코프 `let` → 사용 지점
  `const`)는 스코프가 좁아져 오히려 안전성이 높아진 변경이며 기존 테스트(있다면)의 유효성에
  영향 없음.

## 요약

직전 라운드가 지적한 WARNING 2건(force-split 미검증, 복호화 실패 미검증) 중 복호화 실패
쪽은 vacuous-방지 단언(`expect.assertions`, `cause` 부재 단언)까지 갖춘 견고한 테스트로 완전히
닫혔다. 반면 force-split 쪽은 테스트가 새로 생겼음에도 fixture 가 "force-split 뒤 곧바로
텍스트가 끝나는" 형태라, 그 테스트 스위트가 실제로 검증하려던 `overlapBuffer` 캐리오버 방지
불변식은 여전히 어떤 자동 테스트로도 관측되지 않는다(뮤테이션으로 직접 확인 — 원복해도
GREEN). 이는 "테스트를 추가했다"와 "회귀를 잡는 테스트를 추가했다"가 갈라지는 전형적인
사례이므로 WARNING 으로 유지한다. 그 외 나머지 diff(eslint 9→10 상향에 따른 기계적
`no-useless-assignment`/`preserve-caught-error` 대응, `parseGteFloor` 파서 확장)는 테스트
관점에서 견고하거나(파서 테스트) 정적 분석으로 충분히 안전이 보증되는 무해한 정리(dead-store
제거)다.

## 위험도

LOW
