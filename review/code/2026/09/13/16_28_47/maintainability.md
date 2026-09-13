# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 범위

`git diff --stat origin/main...HEAD -- codebase/` 기준 실질 코드 변경은 아래 5개 TS 파일뿐이다 (`CHANGELOG.md`/`PROJECT.md`/`plan/**`/`review/**` 는 문서·산출물이라 유지보수성 관점 코드 검토 대상이 아님):

- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규, 367줄)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규, 244줄)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (주석 2줄 수정)

이 PR 은 이미 `review/code/2026/09/13/14_41_14`, `15_03_06` 등 여러 라운드를 거쳤고, 그 라운드들이 지적한 유지보수성 항목(파일당 3축 누적·정규식 boilerplate 반복·설계 근거 중복·과거 결함 재현 코드 복제 등)은 전부 **"이 폴더 형제 가드들과 같은 기존 관례이며 이번 diff 의 신규 결함이 아니다"** 로 처분·기록되어 있음을 `RESOLUTION.md` 두 건과 삭제된 `guide-error-code-scan.ts`(전임 파일) 원문 대조로 확인했다. 아래는 그 처분과 별개로 현재 코드 상태를 직접 다시 훑어 확인한 잔여 관찰이다.

## 발견사항

- **[INFO]** `collectEnvDeclarations` 내부에 정규식 매칭 루프가 두 번(거의 동일한 형태로) 반복된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:222-244` (`envLine`/`envExampleTexts` 루프: 227-234줄, `composeLine`/`composeTexts` 루프: 235-242줄)
  - 상세: 두 루프 모두 `new RegExp(...)` → `lastIndex = 0` → `while ((m = rx.exec(text)) !== null) tokens.add(m[1])` 골격이 동일하고 정규식과 순회 대상만 다르다. 같은 파일 위쪽 `scanIdentifierCitations`(165-179줄)는 이미 `push(axis, rx)` 클로저로 이 반복을 한 번 추출해 재사용하는데, `collectEnvDeclarations`는 그 패턴을 적용하지 않아 파일 내에서 일관성이 갈린다. 다만 전임 파일(`guide-error-code-scan.ts`)도 같은 골격을 함수마다 인라인했고, 직전 리뷰 라운드가 "정규식 boilerplate 반복"을 이미 인지하고 "형제 가드 관례, 이번 diff 신규 결함 아님, 축 4개 초과 시 분리"로 유예했으므로 새로 등재할 결함은 아니다.
  - 제안: `collectMatches(texts: readonly string[], rx: RegExp): Set<string>` 같은 5줄짜리 공용 헬퍼로 추출하면 `collectSourceTokens`·`collectEnvDeclarations` 두 곳 모두에서 15줄가량이 6줄로 준다. 급하지 않음 — 다음에 축이 하나 더 붙을 때(허용목록 상한 근접 시점과 같은 타이밍) 함께 정리 권장.

- **[INFO]** 과거(삭제된) 축의 정규식이 테스트 안에 문자열 그대로 손으로 재복제되어 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:187` (`const FIELD_TABLE_NAME = /\{\s*name:\s*"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/;`)
  - 상세: 이 지역 변수는 `guide-identifier-scan.ts` 의 (비-export) `FIELD_TABLE_NAME`/`UPPER_SNAKE` 패턴을 문자 그대로 손으로 다시 타이핑한 것이다("`#1330` 의 문맥-게이팅 축이었다면 놓쳤다"를 재현하는 회귀 테스트 목적). 두 정의를 잇는 것은 git 이력뿐이라 `guide-identifier-scan.ts` 의 `UPPER_SNAKE` 정의가 바뀌어도 이 사본은 조용히 낡는다. 다만 이 역시 직전 라운드 RESOLUTION(`15_03_06` INFO#6 계열)이 "선택 사항이라 미적용"으로 이미 검토·유예한 항목과 같은 클래스다.
  - 제안: 급하지 않음. 이름을 `LEGACY_FIELD_TABLE_NAME` 처럼 구분해 두면, 같은 이름(`FIELD_TABLE_NAME`)이 두 파일에서 "지금 쓰는 축"과 "과거에 쓰던 축"을 각각 가리키는 데서 오는 순간적 혼동(둘 다 같은 것을 가리킨다고 오해하기 쉬움)을 줄일 수 있다.

- **[INFO]** vacuity-floor 단언에 쓰인 임계값 다수가 이름 없는 리터럴이다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:75-77`(`50`/`500`/`800`), `:89`(`5`), `:115-117`(`10`/`0`/`100`), `:134-135`(`2`/`20`)
  - 상세: `EXTERNAL_VOCABULARY_CAP`(16줄) 하나만 이름 있는 상수로 승격됐고 나머지 임계값은 인라인 매직 넘버다. 각 줄에 `// 실측 92` 류 주석이 붙어 있어 "왜 이 숫자인가"는 읽을 수 있지만, 값 자체는 여전히 흩어져 있다.
  - 제안: 상수화 압박이 크진 않다 — 이 값들은 "실측치보다 여유 있게 낮춘 회귀 감지선"이라 파일마다 문맥이 다르고 한곳에 모아도 재사용되지 않는다. 다만 값이 늘어나면(축이 하나 더 생기면) `MIN_MDX_FILES`/`MIN_SOURCE_TOKENS` 식 이름 상수로 모으는 편이 향후 리뷰 부담을 줄인다.

## 요약

실질 코드 변경은 `guide-identifier-scan.ts`(244줄)·`guide-identifier-existence.test.ts`(367줄) 두 신규 파일과 자매 파일 주석 2줄뿐이며, 함수 단위는 짧고(가장 긴 `collectEnvDeclarations`도 23줄) 중첩 깊이도 얕다(최대 2단 반복문). 순환 복잡도가 우려될 만한 분기 누적은 없다. 네이밍(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`/`GUIDE_EXTERNAL_VOCABULARY`)은 목적을 명확히 드러내고, 이 디렉터리의 다른 가드 파일들(`impl-anchor-parse.ts` 등)과 `X-scan.ts`/`X-existence.test.ts` 분리 패턴이 일관된다. 코드 대비 서술형 주석(특히 `guide-identifier-scan.ts` 상단 94줄)의 비중이 매우 높아 첫 인상의 가독성 부담은 있지만, 이는 전임 파일(`guide-error-code-scan.ts`)에서 이미 확립된 이 특정 가드 계열의 관례이며 신규 결함이 아니다. 남은 지적은 전부 이전 두 라운드가 이미 인지·유예한 클래스(정규식 boilerplate 반복, 과거 축의 손-복제, 흩어진 매직 넘버)의 재확인이라 INFO 수준을 넘지 않는다. CRITICAL·WARNING 대상 없음.

## 위험도

NONE
