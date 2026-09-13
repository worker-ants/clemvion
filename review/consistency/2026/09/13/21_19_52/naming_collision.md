# 신규 식별자 충돌 검토 — naming_collision

## 조사 방법 메모

- `--impl-done` 프롬프트 번들의 scope(`spec/conventions/`) 델타는 0개 파일 — 이 브랜치는
  spec 을 바꾸지 않았다(정상, 코드 전용 배치). 실제 구현 diff(`origin/main...HEAD`)는 4개
  파일이며 프롬프트 예산에 잘려 있어, 지시대로 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
  절대경로로 직접 읽어 diff 전문을 확인했다.
- HEAD(`2931d921f`, "라운드 5")는 이전 검토 라운드(`review/consistency/2026/09/13/20_57_15`,
  naming_collision NONE)**이후** 추가된 커밋이다. 이번 세션은 그 라운드가 이미 다룬 항목을
  재확인하는 대신, **라운드 5 가 새로 추가한 diff**(`computeNonEmittedOffenders` 신설 + 개명
  이력 자기모순 정정)에 초점을 맞춰 독립 재검증했다.
- 검증 명령: `grep -rn "\b<식별자>\b" codebase --include="*.ts" --include="*.tsx"` (대상 파일
  자신 포함 전체) — 모든 신규 식별자에 대해 결과를 직접 확인했다(아래 인벤토리 전부 0건 외
  충돌).

## 신규 식별자 인벤토리 (HEAD 기준 누적)

| 종류 | 이름 | 위치 |
|---|---|---|
| exported const | `GUIDE_NON_EMITTED_VOCABULARY` | `guide-identifier-scan.ts` |
| exported function | `collectQuotedLiterals` · `collectMessagePrefixes` · `collectCatalogCodes` · `isMessagePrefixOnly` · `computeNonEmittedOffenders`(라운드 5 신규) | `guide-identifier-scan.ts` |
| module-private | `collectMatches` · `QUOTED_LITERAL` · `MESSAGE_PREFIX` · `CATALOG_CODE` | `guide-identifier-scan.ts` |
| test-local | `staleGuideEntries` · `parseWhereRefs` · `NON_EMITTED_VOCABULARY_CAP` · `sets`(block-scoped 변수, 라운드 5) | `guide-identifier-existence.test.ts` |
| 등록 항목(문자열, "신규 식별자"는 아님) | `MAKESHOP_UNRESOLVED_PATH_PARAM` · `CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT` | `GUIDE_NON_EMITTED_VOCABULARY` 목록 항목 — 기존 소스·spec 6곳이 이미 같은 의미로 써 온 문자열 |

요구사항 ID · 엔티티/DTO · API endpoint · webhook/queue/SSE 이벤트명 · ENV 변수 · config key ·
spec 파일 경로는 이번 diff 에서 **신규 도입되지 않았다** — 순수 harness(테스트 스캐너) 확장 +
가이드 문장 정정 + plan 서술이다.

## 발견사항

### 라운드 5 신규 — `computeNonEmittedOffenders` 충돌 없음

- **[INFO]** 없음(액션 불필요) — 검증 결과 기록용
  - target 신규 식별자: `computeNonEmittedOffenders` (`guide-identifier-scan.ts`, export function)
  - 기존 사용처: 없음 — `codebase/` 전체에서 이 diff 가 도입한 정의 1건 외 0건
  - 상세: 라운드 5 가 리뷰어 지적(offender 판정이 베이스라인·대조군 사이에서 중복 구현되어
    뮤테이션에 취약)에 대응해 판정 로직을 이 함수로 정본화했다. 이름이 `computeNon*` 패턴으로
    이 저장소의 다른 `compute*` 헬퍼(예: 실행 엔진 쪽 `computeXxx` 류)와 접두만 겹치는지도
    확인했으나 동일 스코프 충돌은 없다.
  - 제안: 없음.

### 이미 발생했고 이미 해소된 충돌 (참고용, 액션 불필요)

- **[INFO]** `staleEntries` → `staleGuideEntries` 개명 이력 — 코드는 정상, 라운드 5 가 plan
  서술의 자기모순만 정정
  - target 신규 식별자: `staleGuideEntries` (`guide-identifier-existence.test.ts`)
  - 기존 사용처: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:129`
    의 `export function staleEntries(internal: string[], knownNames: string[])`
  - 상세: 라운드 3 에서 이 헬퍼를 처음 `staleEntries` 로 명명해 기존 export 된 동명 함수(시그니처
    상이)와 충돌했고, 라운드 4(`20_34_48` naming_collision WARNING#5)가 지적해 개명했다. 다만
    개명 JSDoc 자체가 "첫 판은 `staleGuideEntries` 였는데"라고 **자기모순**으로 적혀 있었다
    (라운드 4 의 파일 전체 `replace` 가 이력 서술 문장의 옛 이름까지 바꿔버린 부수 효과).
    **라운드 5 가 이 문장만 `staleEntries`로 정정**했다. 코드 식별자 자체는 라운드 4 이후 계속
    올바른 상태였고, 이번 정정은 문서 정확성 문제이지 새로운 충돌이 아니다.
  - 검증: HEAD 기준 `staleGuideEntries` / `staleEntries` 를 전체 grep — 전자는 대상 테스트
    파일에만, 후자는 `internal-package-registration-guard.ts`(+ 그 테스트)에만 있다. 코드상
    충돌 없음.
  - 제안: 없음 — 이미 해소됨.

### 신규 항목 전수 재검증 — 충돌 없음

`GUIDE_NON_EMITTED_VOCABULARY` · `collectQuotedLiterals` · `collectMessagePrefixes` ·
`collectCatalogCodes` · `isMessagePrefixOnly` · `computeNonEmittedOffenders` ·
`collectMatches` · `parseWhereRefs` · `staleGuideEntries` · `QUOTED_LITERAL` ·
`MESSAGE_PREFIX` · `CATALOG_CODE` · `NON_EMITTED_VOCABULARY_CAP` — 총 13개를 `codebase/`
전체(`*.ts`/`*.tsx`)에 전수 grep 했다. **전부 대상 두 파일 내에서만 발견되고, 다른 모듈에
동명 식별자는 0건이다.**

- **[INFO]** `MESSAGE_PREFIX`(module-private regex 상수, `guide-identifier-scan.ts`)와
  `WC_MESSAGE_PREFIX`(`codebase/packages/web-chat-sdk/src/types.ts`, postMessage 프로토콜
  접두 `"wc:"`)는 이름이 근접하지만 접두어(`WC_`)가 다르고 export 되지 않으며, 서로 다른
  패키지·의미(정규식 vs 프로토콜 상수)라 실제 충돌은 아니다.
  - 제안: 없음(액션 불필요).

### `GUIDE_NON_EMITTED_VOCABULARY` 등록 3종의 의미 충돌 여부

`MAKESHOP_UNRESOLVED_PATH_PARAM` · `CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT`는
이번 diff 가 새로 만든 이름이 아니라, 기존 `makeshop.handler.ts:436`,
`execution-engine.service.ts:7121/7125/7130`이 이미 발행하던 메시지 접두이자 기존 spec
6곳(`0-common.md`·`3-loop.md`·`7-map.md`·`9-foreach.md`·`2-edge.md`·`4-execution-engine.md`)과
유저 가이드가 이미 같은 의미로 인용해 온 문자열이다. 이번 배치는 그 기존 문자열을 harness
예외 목록에 **등록**했을 뿐이며, 같은 이름이 다른 의미로 쓰이는 곳은 없다. 충돌 없음.

### `GUIDE_EXTERNAL_VOCABULARY` ↔ `GUIDE_NON_EMITTED_VOCABULARY` — 의도된 거울상, 충돌 아님

두 목록은 제약이 정반대(전자 "기준집합에 없을 것" / 후자 "기준집합에 있을 것")이며 plan·JSDoc
양쪽이 이를 명시적으로 설계 근거로 남기고 있다. 이름이 접두(`GUIDE_`)를 공유하는 것은 의도된
네이밍 패턴(거울상 목록 쌍)이지 충돌이 아니다.

## 요약

라운드 5(HEAD `2931d921f`)가 새로 추가한 `computeNonEmittedOffenders`를 포함해, 이 배치가
누적으로 도입한 13개 신규 식별자(exported const/function·module-private 상수·test-local
헬퍼)를 `codebase/` 전체에 전수 grep 해 다른 모듈과의 동명 충돌이 없음을 직접 확인했다.
유일하게 실재했던 충돌(`staleEntries` vs `internal-package-registration-guard.ts`의 동명
export)은 라운드 4에서 이미 개명·재검증됐고, 라운드 5는 그 개명을 서술하던 JSDoc의 자기모순
문구만 정정했다(코드 식별자 자체는 변경 없음). `GUIDE_NON_EMITTED_VOCABULARY`에 새로 등록된
3개 토큰은 이 저장소가 이미 다른 의미 없이 써 온 기존 문자열을 그대로 등록한 것이라 의미
충돌이 없다. 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV 변수·spec 파일 경로 축에서는
신규 도입 자체가 없다(`spec/conventions/` 델타 0, 순수 harness 확장). 신규 식별자 충돌 관점에서
이번 배치를 막을 사유가 없다.

## 위험도

NONE
