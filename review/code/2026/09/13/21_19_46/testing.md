# 테스트(Testing) 코드 리뷰 — error-code-emission-axis (누적 6라운드 시점)

## 검토 범위·방법

이 배치는 `origin/main`(`afaef5bef`) 대비 120개 파일이 바뀌지만, 테스트 관점의 실질 대상은
여전히 두 파일뿐이다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
(발행 축 수집기·`isMessagePrefixOnly`·`computeNonEmittedOffenders`·`GUIDE_NON_EMITTED_VOCABULARY`)
와 `guide-identifier-existence.test.ts`(같은 축의 단언 전체 + 진리표/경계 대조군). 나머지는
문서(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`)·`plan/**`·이전 5라운드
`/ai-review`·`--impl-done` 세션 산출물(`review/**`)이라 테스트 관점의 코드 대상이 아니다.

이 축은 이미 5라운드의 `/ai-review`(19_23_22→19_51_33→20_13_13→20_34_32→20_57_13)를 거치며
매 라운드 testing 리뷰어가 발견한 갭이 진리표·판별 fixture·뮤테이션으로 채워졌다. 이번
세션이 보는 것은 **라운드 5 fix 커밋(`2931d921f`)이 새로 들여온 것** — `computeNonEmittedOffenders`
정본 추출 + 그것을 겨눈 합성 진리표 5건 + `[한계]` 테스트의 재작성 — 이며, `git show
2931d921f -- <두 파일>`로 diff를 직접 추출해 그 위에서 검토했다. 두 파일 나머지 부분은
라운드 1~4가 이미 검토했고 이번 라운드 사이에 변경되지 않았다.

### 독립 재현 (저장소 뮤테이션, 완료 후 `cp`로 원복·`git status --short`로 확인)

- `guide-identifier-existence.test.ts` 단독 실행 → **76 passed (76)**. RESOLUTION.md
  (`20_57_13`, 커밋 메시지)이 주장한 "71 → 76"과 일치한다.
- **신규 뮤테이션 시도**: `computeNonEmittedOffenders`의 `return [...new Set(citedTokens)]`를
  `return [...citedTokens]`로 바꿔(중복 제거 제거) 재실행 → **76 passed (76), 전부 GREEN —
  생존**. 원본을 즉시 `cp`로 복원했고 `git diff --stat`로 해당 파일이 커밋 상태와 바이트
  단위로 동일함을 확인했다(잔여는 이 리뷰 세션 자신의 출력 디렉터리뿐).

## 발견사항

- **[INFO]** `computeNonEmittedOffenders`의 중복 제거(`new Set`)를 겨눈 판별 fixture가
  없다 — 뮤테이션으로 생존을 직접 확인했다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:480`
    (`computeNonEmittedOffenders` 정의부, `return [...new Set(citedTokens)]`), 신규
    진리표 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:539-581`
    (`describe("computeNonEmittedOffenders — 네 항이 각각 무는가")`)
  - 상세: 라운드 5 fix가 이 함수를 정본으로 추출하며 "네 항이 각각 무는가"를 겨눈 합성
    진리표 5건(접두-전용/카탈로그/등록/리터럴/빈 배열)을 붙였는데, 다섯 케이스 전부
    입력 배열에 토큰을 **한 번씩만** 담는다(`[T]` 또는 `[]`). `[...new Set(citedTokens)]`를
    `[...citedTokens]`로 바꿔 중복 제거 자체를 지우는 뮤테이션을 걸어 실측했더니 76/76이
    그대로 GREEN이었다 — 이 저장소가 반복해 이름 붙인 *"GREEN은 증거가 아니다"*의 이번
    판본이자, 바로 그 함수를 추출한 이유("헬퍼 테스트 ≠ 호출부 테스트")가 겨눈 것과
    같은 종류의 갭이 함수 자신의 새 로직 한 줄에 남아 있다.
  - 영향 평가(등급을 CRITICAL/WARNING이 아니라 INFO로 두는 근거): 실제 호출부(베이스라인 ·
    `[한계]` 뮤턴트-저항 테스트)는 결과 배열의 **존재 여부**(`toEqual([])`) 또는
    `.includes()` 멤버십만 검사하므로, 중복 원소가 남아도 오늘의 판정(참/거짓)이 뒤집히지
    않는다. 다만 이 배열이 실제로 사람이 읽는 실패 메시지로 쓰이는 경로(`missing`
    배열 등 이 파일의 다른 자리)와 같은 패턴이라, 언젠가 `computeNonEmittedOffenders`가
    실패 메시지 생성에 그대로 쓰이면 실제 인용 위치가 여럿인 등록 토큰(예:
    `CONTAINER_MISSING_EMIT`은 `logic.mdx`·`logic.en.mdx` 두 곳에서 인용된다)이 진단에
    중복 표기될 수 있다 — 거짓 판정이 아니라 진단 품질 저하다.
  - 제안: `[T, T]` 처럼 같은 토큰을 두 번 담은 입력에 `toEqual([T])`(중복 없는 단일
    원소)를 단언하는 케이스 하나를 진리표에 추가하면 이 자리가 닫힌다. 급하지 않음 —
    현재 호출부 어디도 이 결함으로 거짓 PASS를 내지 않는다.

## 확인 후 문제 없음 — 회귀 없음

- 라운드 5 fix의 나머지 부분(`[한계]` 테스트를 `computeNonEmittedOffenders`의 두 호출
  차집합으로 재작성)은 `registered`를 두 호출 모두 빈 집합으로 맞춰, 실제 등록 3종이
  두 결과 집합에 동형으로 나타나 `rescuedByCatalog` 계산을 오염시키지 않는다 — 직접
  추적해 확인했다. 바로 아래 `[대조군]` 테스트(합성 카탈로그로 실제 구제 사례 재현)와
  짝을 이뤄, "0건"이 *"오늘 해당 없음"*인지 *"필터가 죽음"*인지를 가른다는 이 세션의
  기존 규율이 그대로 지켜졌다.
- `staleGuideEntries` JSDoc 자기모순(첫 판 이름을 옛 이름 자리에서도 바꿔버린 결함,
  라운드 5 RESOLUTION WARNING#2) 수정을 재확인 — `guide-identifier-existence.test.ts:67`
  "첫 판은 `staleEntries` 였는데"로 정확히 고쳐져 있다.
- 라운드 1~4가 이미 검증한 진리표(`isMessagePrefixOnly`)·판별 대조군(`parseWhereRefs`·
  `staleGuideEntries`·발행 축 수집기 3종·`collectSourceTokens`·`collectEnvDeclarations`)은
  이번 라운드 사이 로직 변경이 없어 회귀가 없다.

## 이미 등재·유예된 항목 (재발 아님, 참고용 재확인만)

- `where` 필드 검증의 `hits.length !== 1` 분기(파일 0건·2건 이상)를 겨눈 합성 fixture는
  여전히 없다(`guide-identifier-existence.test.ts:263` 부근). 라운드 3 testing이 처음
  지적했고 같은 라운드 RESOLUTION이 "순수 함수 분리 시 함께"로 명시적으로 유예했다 —
  이번 라운드에서도 그 결정은 바뀌지 않았고 새로 지적하지 않는다.

## 요약

라운드 5 fix가 새로 들여온 실질 코드(`computeNonEmittedOffenders` 정본 + 합성 진리표 5건)를
`git show`로 직접 추출해 검토하고, 76/76 GREEN을 재현했다. 독자적으로 건 뮤테이션(정본의
중복 제거 로직 삭제)이 생존해, 신규 진리표가 "네 항" 각각의 포함/배제는 겨눴지만 정본이
입력을 `new Set`으로 중복 제거하는 동작 자체는 겨누지 않았음을 확인했다 — 다만 이 갭은
오늘의 어떤 호출부도 존재/멤버십 판정만 쓰므로 거짓 PASS로 이어지지 않아 INFO로 등급을
낮춘다. 그 외 라운드 5 fix의 나머지 부분(카탈로그 뮤턴트 재현, 이름 자기모순 수정)은 실측
재현으로 이상이 없음을 확인했고, 라운드 1~4가 검증한 나머지 진리표·대조군은 이번 라운드
사이 변경이 없어 회귀가 없다. 새로 보고할 CRITICAL/WARNING은 없다.

## 위험도

NONE
