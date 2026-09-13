# 유지보수성(Maintainability) 코드 리뷰 — error-code-emission-axis (누적 5라운드 fix 반영분)

## 검토 범위 및 방법

이 세션은 `error-code-emission-axis` 배치의 **누적 diff**(`65256a109` feat → `a397ccc55`
→ `a4b98eda8` → `5778885ce` → `57288e47f` → `2931d921f`, 총 6커밋)를 대상으로 한다.
프롬프트가 핵심 TS 파일 2개(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)의
diff 를 크기 제한으로 생략했으므로, `Read` 로 두 파일 **전문**을 직접 열어 현재 상태(HEAD
`2931d921f`, `git status --short` 확인)를 검토했고, `git show 2931d921f -- <두 파일>` 로
**이번 라운드(라운드 5, `2931d921f`)가 새로 들여온 diff** 만 별도로 추출해 대조했다.
저장소 파일은 건드리지 않았다(읽기 전용 조사만 수행, 뮤테이션 없음).

이전 네 라운드(`19_23_22`→`20_34_32`)의 maintainability 리뷰가 이미 CRITICAL/WARNING 을
전부 해소로 판정했고, 이번 라운드는 그 뒤에 추가된 **라운드 5 커밋(`2931d921f`)만** 새로
검토한다.

## 라운드 5 diff 검토 — `computeNonEmittedOffenders` 정본 추출

### 배경과 조치 내용

직전 리뷰(`review/code/2026/09/13/20_57_13` testing WARNING#1)가 뮤테이션으로 실증한
결함이다 — 베이스라인 단언(`existence.test.ts` 발행 축)이 `.filter(...)` 4개를 손으로
이어 붙였고, `[한계]`/`[대조군]` 테스트는 **그것과 분리된 병렬 구현**이었다. 그래서 실제
offender 체인에서 카탈로그 필터 한 줄을 지워도 71/71 GREEN 이 유지됐다 — 전형적인
"헬퍼 테스트 ≠ 호출부 테스트" 결함이다.

조치는 `guide-identifier-scan.ts` 에 `computeNonEmittedOffenders(citedTokens, sets)` 를
새 export 로 추가해 판정 체인(인용 ∧ 접두-전용 ∧ ¬카탈로그 ∧ ¬등록)을 한 곳에 모으고,
베이스라인 테스트(`existence.test.ts:206`)와 "[한계] 카탈로그 탈출구" 테스트
(`:346-357`)가 **같은 함수**를 서로 다른 `sets` 조합으로 호출하도록 바꿨다. 이 리팩터
자체는 다음 이유로 유지보수성 관점에서 **명백히 개선**이다:

- 판정 로직의 SoT 가 하나로 좁혀졌다(`guide-identifier-scan.ts:471-487`) — 이 파일이
  이미 지켜 온 "스캐너가 판정 로직을 소유한다" 관례(`isMessagePrefixOnly` 승격과 동일한
  패턴)를 그대로 따른다.
- JSDoc(`:455-469`)이 정확히 *"무엇이 문제였고 왜 이 함수가 필요한가"* 를 실측 수치와
  함께 적어 두어, 다음 사람이 왜 두 호출부가 같은 함수를 부르는지 추적할 수 있다.
- 새 describe 블록(`existence.test.ts:539-580`, "네 항이 각각 무는가")이 네 항 각각을
  가르는 값을 합성 입력으로 고정했다 — 이 파일이 신규 함수마다 지켜 온 "두 판정이 갈리는
  값을 고정한다" 규율과 형태가 일치한다.

### 커밋 메시지의 자기 검증이 정직하다 — 재확인

주목할 점: 이 커밋은 *"정본 추출만으로는 카탈로그 필터 뮤턴트가 여전히 생존했다"* 는
사실을 숨기지 않고 원인(실코퍼스에서 그 필터가 오늘 한 번도 발화하지 않는 데이터
문제)까지 적었다. `computeNonEmittedOffenders — 네 항이 각각 무는가` describe 의 헤더
주석(`:540-546`)이 같은 설명을 코드 옆에도 남겨, "정본으로 합쳤으니 끝" 이라는 성급한
결론을 다음 사람이 반복하지 않도록 막는다 — 유지보수성 관점에서 바람직한 형태다.

### `[한계]` 테스트의 두 번 호출 diff 로직 — 확인 후 문제 없음

```ts
const withCatalog = computeNonEmittedOffenders(citations.map((c) => c.token), {
  ...sets, registered: new Set<string>(),
});
const withoutCatalog = computeNonEmittedOffenders(citations.map((c) => c.token), {
  ...sets, catalogCodes: new Set<string>(), registered: new Set<string>(),
});
const rescuedByCatalog = withoutCatalog.filter((t) => !withCatalog.includes(t));
```

같은 정본 함수를 `catalogCodes` 유무만 바꿔 두 번 불러 그 차집합을 "카탈로그가 구제한
토큰"으로 정의하는 방식이다. 손 계산 대신 판정 함수 자신의 출력 차이로 구하므로 정본과
불일치할 수 없다는 점에서 이전(직접 `.filter` 체인을 손으로 다시 쓰던 방식)보다 개선됐다.
다만 최초 읽었을 때 "왜 두 번 부르는가"를 바로 파악하기는 쉽지 않은 코드다 — 다행히
바로 위 주석(`:344-345`)이 "정본으로 센다 — 카탈로그를 비운 집합으로 한 번 더 돌려, 그
차이가 곧 «탈출구가 구한 토큰»이다"라고 정확히 설명해 두어, 결함으로 보기보다는 합리적인
트레이드오프로 판단했다.

## 발견사항

- **[INFO]** 새 describe 블록의 로컬 상수 `T`가 한 글자 이름이다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:547`
    (`const T = "SYNTH_TOKEN";`, `describe("computeNonEmittedOffenders — 네 항이 각각 무는가", …)` 안)
  - 상세: `T`라는 한 글자 식별자는 그 자체로는 의미를 안 나타낸다. 다만 같은 파일의
    `isMessagePrefixOnly — 진리표 대조군`(`:605-628`)이 이미 `P`(판정 함수 팩토리)라는
    한 글자 이름을 같은 스타일(합성 진리표 fixture)로 쓰고 있어, 이 파일이 truth-table
    스타일 테스트에서 반복해 온 국지적 관례에 해당한다. 스코프가 describe 블록 안으로
    좁고, 바로 위 주석과 변수 선언이 붙어 있어 실제 추적 비용은 낮다.
  - 제안: 조치 불필요 — 급하면 `TOKEN`처럼 두세 글자로 늘리는 정도. 우선순위 낮음.

- **[INFO]** `computeNonEmittedOffenders`가 4개 불(boolean) 축을 단일 `sets` 객체
  파라미터로 받는데, 이번 라운드에서 세 가지 다른 조합(`sets` 그대로 / `registered`만
  비움 / `registered`+`catalogCodes` 비움)으로 호출하는 자리가 생겨 호출부마다 스프레드
  오버라이드를 읽어야 한다
  - 위치: `guide-identifier-scan.ts:471-478`(시그니처),
    `guide-identifier-existence.test.ts:206`(그대로), `:346-353`(두 가지 오버라이드)
  - 상세: 지금은 호출부가 3곳뿐이고 각 오버라이드 옆에 그 의도를 설명하는 주석이 있어
    당장 추적이 어렵지 않다. 다만 앞으로 다섯 번째 축이 추가되면(이 파일 JSDoc이 이미
    "축 추가 시 `classifyToken()` 수렴 검토"를 이월 항목으로 적어 뒀다) 오버라이드
    조합이 조합폭발 형태로 늘어날 수 있는 지점이다.
  - 제안: 지금 당장 조치할 필요는 없음 — 이미 이 파일의 라운드 4 이월 목록(INFO#3,
    "3-채널 판정 체인")이 같은 방향의 리팩터를 "축 추가 시" 조건부로 예정해 뒀다. 새로
    등재할 항목이 아니라 기존 이월 항목의 연장선으로 본다.

- **[INFO, 재확인 — 새 결함 아님]** 이번 라운드가 고친 JSDoc 자기모순
  (`staleGuideEntries` 개명 이력 문장이 옛 이름 자리까지 치환돼 "첫 판은
  `staleGuideEntries` 였는데"로 자기 자신을 가리키던 문제)이 실제로 해소됐는지
  직접 대조했다 — `existence.test.ts:67`이 지금은 "첫 판은 `staleEntries` 였는데"로
  올바르게 옛 이름을 가리킨다. 라운드 4의 파일 전체 `replace`가 "이 식별자를 가리키는
  자리"가 아니라 "이 문자열이 나오는 자리"를 술어로 잡아 발생한 결함이었고, 이번 수정은
  그 자리 하나만 정확히 고쳤다(인접 서술을 건드리지 않음). 새로운 결함 없음.

## 라운드 1~4에서 이월된 항목 (재확인, 변화 없음)

`review/code/2026/09/13/20_34_32/maintainability.md`가 정리한 이월분을 이번 라운드
diff와 대조했고, 라운드 5가 그 항목들의 코드 자리를 옮기지 않았음을 확인했다(이번
diff는 `computeNonEmittedOffenders` 신설과 plan 문서 갱신에 국한된다) — 조치 여부
판단도 동일하게 유지한다:

- capture-group 인덱스가 정규식 정의와 100줄 이상 분리된 숫자 리터럴로 지정됨
  (`guide-identifier-scan.ts:260`·`373`, `:263`·`385`, `:266`·`427`) — named capture
  group 전환은 다음 기회로 유예.
- vacuity 하한 리터럴이 이름 없는 매직 넘버(`existence.test.ts:144`〈`>50`〉·`:158`
  〈`>5`〉·`:211-213`〈`>200`/`>3`/`>50`〉 등)로 여러 곳에 흩어져 있음 — 5라운드 연속
  이월, 낮은 우선순위.
- `matchAll`(신규 3정규식) vs 수동 `lastIndex`(기존 4곳) 관용구 공존 — 파일 상단
  주석(`:242-251`)이 명시적으로 유예를 선언한 의도적 상태, 변화 없음.
- `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` 이름이 한 토큰만 다르고
  제약이 정반대 — JSDoc 대조표(`:315-318`)로 완화됨, 변화 없음.
- 파일 서두 주석(`guide-identifier-scan.ts:1-124`, 약 124줄)이 코드 선언보다 먼저 오는
  장문의 반증 이력 — "지우지 말 것"이 명시된 이 저장소의 원칙적 관례(라운드 1~4가 반복
  확인)이고, 이번 라운드가 그 절 하나(`MAKESHOP_UNRESOLVED_PATH_PARAM` 한계 절)의
  본문을 늘리지도 줄이지도 않았다.

## 요약

라운드 5(`2931d921f`)는 직전 리뷰가 뮤테이션으로 실증한 "병렬 구현이 정본과 갈라져
카탈로그 필터 뮤턴트를 못 잡는다"는 실질 결함을 `computeNonEmittedOffenders` 단일
정본 함수로 해소했고, 그 정본 통합만으로는 부족했던 부분(실코퍼스 데이터가 그 필터를
발화시키지 않는 문제)까지 합성 진리표 5건으로 별도로 막았다 — 이 세션이 반복해 온
"헬퍼 테스트 ≠ 호출부 테스트" 결함 클래스가 이번엔 제안을 그대로 적용한 뒤에도 재발
여부를 뮤테이션으로 재검증하는 형태로 닫혔다. 부수적으로 라운드 4의 파일 전체 치환이
남긴 JSDoc 자기모순도 그 문장 하나에 국한해 정확히 고쳤다. 새로 발견한 것은 INFO 2건
(합성 fixture 로컬 변수명 한 글자, `sets` 오버라이드 조합이 향후 축 추가 시 늘어날 수
있는 지점)뿐이며 둘 다 조치를 강제할 정도는 아니다. 라운드 1~4에서 이월된 항목들은
이번 diff가 그 코드 자리를 건드리지 않아 판단에 변화가 없다. 새로운 CRITICAL/WARNING
은 없다.

## 위험도

LOW
