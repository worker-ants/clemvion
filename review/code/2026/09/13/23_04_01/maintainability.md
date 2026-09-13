# 유지보수성(Maintainability) 리뷰 — error-code-emission-axis

## 범위

이 변경 세트는 문서(`CHANGELOG.md`, `PROJECT.md`, `logic.mdx`/`logic.en.mdx`), 테스트 전용
정적 스캐너(`guide-identifier-scan.ts`) + 그 테스트(`guide-identifier-existence.test.ts`),
plan/review 산출물로 구성된다. 실질적으로 "코드" 로서 리뷰할 대상은 스캐너와 테스트 두 파일이며,
아래 발견사항은 그 둘에 집중한다. 이미 8라운드에 걸쳐 검토된 코드라 뻔한 결함은 대부분 걷혔고,
남은 것은 설계/가독성 수준의 관찰이다.

## 발견사항

- **[WARNING]** `collectMatches` 의 `(regex, group)` 짝이 타입으로 강제되지 않는다 — 그룹 번호가 틀려도 조용히 `undefined` 를 모은다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:309-319`(`collectMatches` 정의), 호출부 `:401`(`QUOTED_LITERAL`, group 2) · `:413`(`MESSAGE_PREFIX`, group 1) · `:455`(`CATALOG_CODE`, group 1)
  - 상세: `collectMatches(texts, rx, group)` 는 `group` 을 평범한 `number` 로 받는다. 어떤 정규식이 몇 번째 캡처 그룹에 토큰을 두는지는 순전히 호출부의 관례로만 지켜진다 — 타입 시스템이 `rx` 와 `group` 의 짝을 검증하지 않는다. `RegExpMatchArray` 인덱싱은 범위를 검사하지 않으므로, 향후 넷째 축이 추가되거나 기존 정규식의 캡처 그룹 순서가 바뀌는데 호출부의 `group` 인자를 함께 고치지 않으면 `m[group]` 이 `undefined` 가 되고 `Set<string>` 에 `undefined` 가 조용히 섞여 들어간다 — 컴파일도, 대부분의 런타임 경로도 이를 잡지 못한다. 이 저장소가 스스로 이름 붙인 "fail-open 미탐지" 결함 클래스와 정확히 같은 모양이다(이 파일 상단 정규식 감사 표가 다루는 것과 동일한 위험 방향).
  - 제안: `(regex, group)` 을 분리된 두 인자 대신 `{ rx: QUOTED_LITERAL, group: 2 }` 처럼 정규식 정의와 그룹 번호를 한 상수로 묶어 두면, 정규식을 고칠 때 그룹 번호도 같은 자리에서 함께 보인다. 최소한 각 정규식 선언 옆에 그룹 번호를 JSDoc 이 아니라 이름 있는 상수(`QUOTED_LITERAL_TOKEN_GROUP = 2` 등)로 박아 두는 것만으로도 어긋남을 grep 으로 잡을 수 있다.

- **[WARNING]** `guide-identifier-scan.ts` 상단 주석이 152줄에 달하는 리뷰-라운드 서사로, 소스와 히스토리 문서(CHANGELOG/RESOLUTION)의 경계가 흐려진다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-152`(첫 `export` 이전 전체), 이번 diff 로 새로 추가된 서사 블록은 `:12-20`("라운드 7 의 그 교체가...") · `:70-72`("2026-09-13 에 한 칸 좁혔다") · `:88-99`("그 예고를 닫은 것이 이 배치인데...")
  - 상세: 실제 코드(`export type CitationAxis`)는 153번째 줄에서야 시작한다. 파일 전체 624줄 중 상당 부분이 "라운드 N 에 무엇을 어떻게 고쳤는가" 를 서술하는 회고문이고, 그 서사가 `CHANGELOG.md`(파일 1)·`review/code/2026/09/13/*/RESOLUTION.md`(파일 20·34·45) 에 이미 거의 같은 내용으로 존재한다(예: `MAX_ITERATIONS_EXCEEDED` 가 카탈로그가 아니라 소비자-인용 때문에 통과한다는 반증 서사가 scan.ts 주석(`:426-441`)·CHANGELOG.md·RESOLUTION.md 세 곳에 각각 다른 표현으로 중복). 설계 근거(왜 이 술어인가, 무엇을 보장하지 않는가)는 소스에 남기는 것이 이 저장소의 확립된 관례이고 그 자체는 타당하지만, "몇 라운드째 누가 무엇을 어떻게 틀렸다" 는 리뷰 진행 서사까지 소스 파일에 계속 누적되면 (a) 새로 이 파일을 읽는 사람이 현재 계약을 파악하기 전에 8라운드의 수정 이력을 먼저 통과해야 하고 (b) 같은 이야기가 여러 파일에 흩어져 다음 정정 때 일부만 갱신되고 나머지가 낡을 위험(이미 이 저장소가 "예고를 쓴 파일에 정정을 안 적으면" 문제로 자인한 패턴, `:88-99` 자신이 그 사례)이 생긴다.
  - 제안: "지금 이 함수/상수가 왜 이런 모양인가" 를 설명하는 최소 근거만 남기고, "라운드 N 리뷰어가 무엇을 지적했고 무엇으로 고쳤는가" 류의 세션 서사는 `RESOLUTION.md`(이미 이 저장소의 정식 SoT)로 옮기는 절단선을 정하면 파일이 커질 때마다 같은 논쟁을 반복하지 않는다. 최소한 새로 추가하는 서사 블록(`:12-20`, `:88-99`)만이라도 CHANGELOG/RESOLUTION 인용 링크 한 줄로 축약할 수 있는지 검토할 만하다.

- **[INFO]** DRY 개선 확인 — `SOURCE_ROOTS`/`skipBuildDirs`/`collectMatches`/`staleGuideEntries` 추출은 실제로 중복을 줄였다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55-57`(`SOURCE_ROOTS`/`skipBuildDirs`), `:108-113`(`staleGuideEntries` 공유), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:309-319`(`collectMatches` 공유)
  - 상세: 이전에 두 곳에서 손으로 반복되던 `walkTree(root, [...], { skipDir: ... })` 호출과 `.filter((e) => !cited.has(e.token))` 판정이 각각 상수·헬퍼로 합쳐졌다. 이번 diff 가 실제로 중복을 줄이는 방향으로 움직였음을 확인했다(결함이 아니라 긍정 관찰).
  - 제안: 조치 불필요.

## 요약

핵심 로직(`collectMatches`/`isMessagePrefixOnly`/`computeNonEmittedOffenders`/`parseWhereRefs`/`resolveSourceLines`/`staleGuideEntries`)은 각각 함수 길이가 짧고 단일 책임을 지키며, 진리표·경계값 대조군까지 갖춰 개별 함수 단위의 복잡도·가독성은 양호하다. 다만 (1) 정규식과 캡처 그룹 인덱스의 짝을 타입이 아니라 호출자 관례로만 지키는 `collectMatches` 설계는 향후 축 추가 시 조용한 미탐지를 만들 수 있는 결합이고, (2) 소스 파일 자체가 8라운드에 걸친 리뷰 서사를 계속 흡수하면서 실제 계약 설명과 리뷰 회고가 뒤섞여 파일의 "지금 무엇을 보장하는가" 를 파악하는 진입 비용이 커지고 있으며, 같은 서사가 CHANGELOG·RESOLUTION 과 중복돼 향후 정정이 한쪽만 반영될 위험이 있다. 둘 다 즉각적인 버그는 아니며 지금 당장 조치가 필수적이지는 않지만, 다음 축 추가 이전에 검토할 가치가 있다.

## 위험도

LOW
