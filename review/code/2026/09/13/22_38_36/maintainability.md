# 유지보수성(Maintainability) 리뷰 — error-code-emission-axis

## 범위 요약

이번 변경 세트의 실질 로직은 두 파일에 집중된다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 정규식 3종 + 공용 수집기 `collectMatches` + `GUIDE_NON_EMITTED_VOCABULARY` + 판정 함수 `isMessagePrefixOnly`/`computeNonEmittedOffenders`)와 `guide-identifier-existence.test.ts`(그 축을 소비하는 단언·대조군, `parseWhereRefs`/`resolveSourceLines`/`staleGuideEntries` 헬퍼). 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 산문 정정·plan·리뷰 산출물이라 유지보수성 평가 대상이 아니다.

이 PR 은 이미 다수의 `/ai-review` 라운드(19_23_22 → 19_51_33 → 20_13_13 → … → 22_06_10 → 22_38_36)를 거쳤고, 그 과정에서 근접 중복 제거(`collectMatches` 공용화), 판정 로직의 스캐너 이전(`isMessagePrefixOnly`/`computeNonEmittedOffenders`), 이름 충돌 해소(`staleEntries`→`staleGuideEntries`), 소스 루트 정의 이원화 제거(`SOURCE_ROOTS`/`skipBuildDirs` 추출) 등 유지보수성 관련 지적이 이미 다수 처리된 상태다(`review/code/2026/09/13/19_51_33/RESOLUTION.md`, `.../20_13_13/RESOLUTION.md` 참조). 아래는 그 이후에도 남아 있는 항목이다.

## 발견사항

- **[WARNING]** 함수 본문 대비 JSDoc 서술(리뷰 라운드 서사)의 비중이 과도해 핵심 로직 파악을 방해한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `collectCatalogCodes` (JSDoc: 415~452행, 함수 본문: 453~455행)
  - 상세: 2줄짜리 함수(`return collectMatches(specTexts, CATALOG_CODE, 1);`)에 37줄짜리 JSDoc 이 붙어 있고, 그 내용은 "처음엔 X 라고 적었다 → **틀렸다** → 재확인하니 Y" 형태의 라운드별 자기수정 서사(라운드 1 반증, `/ai-review review/code/2026/09/13/19_23_22` 인용, 표 두 개)를 포함한다. `isMessagePrefixOnly`(457~473행, 본문 3줄에 JSDoc 17줄)·`GUIDE_NON_EMITTED_VOCABULARY`(337~359행, 선언 자체보다 주석이 훨씬 길다)도 같은 패턴이다. 파일 전체로 보면 622줄 중 439줄(약 71%)이 주석이고, 그중 17곳이 `review/code/2026/09/13/HH_MM_SS` 형태의 타임스탬프 리뷰 세션 경로를 직접 인용한다(자매 파일 `guide-identifier-existence.test.ts` 는 23곳). 코드 자체의 "지금 이 함수가 무엇을 하는가"를 이해하려면 여러 라운드에 걸친 반증·재반증 서사를 먼저 읽어야 해, 이 배치의 리뷰 이력을 모르는 다음 유지보수자에게는 진입장벽이 된다. 이 저장소는 설계 근거·기각된 대안을 코드에 남기는 관례가 있어(CLAUDE.md/MEMORY 다수 언급) 완전히 새로운 패턴은 아니지만, 이 파일은 그 관례가 "왜 이렇게 설계했는가"를 넘어 "몇 번째 라운드에서 누가 무엇을 지적했는가"까지 본문에 축적하는 수준으로 밀도가 높다.
  - 제안: 라운드별 반증·재반증 서사는 CHANGELOG/RESOLUTION.md(이미 이 PR 이 그렇게 하고 있다)에 두고, 소스 코드 주석은 "현재 유효한 설계 근거 + 그 근거를 뒷받침하는 최소 인용"만 남기는 방향으로 다음 정리 라운드에서 압축을 고려할 수 있다. 다만 이는 이 PR 의 진행 방식(라운드마다 실측·반증을 코드에 고정)과 상충하므로 즉시 강제할 사안은 아니며, 병합 후 별도 정리 항목으로 남기는 정도가 적절하다.

- **[INFO]** 정규식 캡처 그룹 인덱스가 호출부에 매직 넘버로 하드코딩돼 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:400` (`collectMatches(fileTexts, QUOTED_LITERAL, 2)`) vs `:412`(`collectMessagePrefixes` → group `1`) vs `:454`(`collectCatalogCodes` → group `1`)
  - 상세: `collectMatches(texts, rx, group)`(308~317행)는 세 번째 인자로 캡처 그룹 번호를 받는데, 이 번호는 각 정규식(`QUOTED_LITERAL`=287행, `MESSAGE_PREFIX`=290행, `CATALOG_CODE`=293행)의 내부 그룹 순서에 암묵적으로 결속돼 있다. 예컨대 `QUOTED_LITERAL` 은 그룹 1(여는 따옴표)·그룹 2(토큰) 순이라 `2` 를 넘기는데, 나중에 누군가 이 정규식에 그룹을 하나 더 추가하거나 순서를 바꾸면 컴파일 타임에 잡히지 않고 조용히 잘못된 그룹을 수집한다. `collectQuotedLiterals` 호출부(399행)에는 "그룹 1 은 여는 따옴표, 토큰은 그룹 2" 라는 주석이 있어 위험이 문서화돼 있으나, 다른 두 호출부에는 그런 주석이 없다.
  - 제안: 정규식을 named capture group(`(?<token>...)`)으로 바꾸고 `collectMatches` 가 `m.groups.token` 을 읽도록 하면 인덱스-순서 결속을 없앨 수 있다. 다만 위험 자체가 낮고(정규식 3개 모두 이 파일 안에 있고 변경 시 곧바로 옆의 테스트가 깨진다) 이미 하나는 주석으로 방어돼 있어 시급도는 낮다.

- **[INFO]** 목록 타입 형태(`{token, ...}[]`)가 `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` 두 곳에 인라인으로 각각 선언돼 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:327~330`(`GUIDE_EXTERNAL_VOCABULARY` 타입) vs `:360~364`(`GUIDE_NON_EMITTED_VOCABULARY` 타입)
  - 상세: 두 상수 모두 `readonly { token: string; ...; why: string }[]` 형태의 인라인 객체 타입을 각자 선언한다. 필드 구성이 달라(`system` vs `where`) 완전한 중복은 아니지만 `token`/`why` 필드와 "상한 상수 + 인용 여부 강제 + 기준집합 조건" 이라는 검증 패턴 자체가 거울상으로 반복된다. 이미 RESOLUTION.md(`review/code/2026/09/13/19_23_22`)의 INFO 처분에서 "두 목록의 타입 미공유 — 세 번째 목록이 생길 때" 로 의도적으로 유예된 항목이라, 새로운 지적이 아니라 기존 유예 결정을 재확인하는 수준이다.
  - 제안: 조치 불필요 — 이미 처분된 항목(rule-of-three 유예)과 동일 사안이므로 재작업 불필요.

## 요약

이 배치는 이미 9라운드에 걸친 `/ai-review`·`--impl-done` 을 통과하며 근접 중복 제거, 판정 로직 소유권 정리, 이름 충돌 해소, 소스 루트 이원화 제거 등 굵직한 유지보수성 지적을 스스로 반증·수정해 온 이력이 있고, 함수 단위는 대체로 짧고 단일 책임(수집·판정·파싱을 각각 별 함수로 분리)을 지키며 네이밍도 기존 관례(`collectXxx`/`isXxx`/`UPPER_SNAKE` 상수)와 일관적이다. 남은 실질적 우려는 하나뿐이다 — 소스 코드 주석이 라운드별 반증 서사를 상세히 담아 파일의 71%가 주석이고, 일부 함수는 본문의 10배가 넘는 JSDoc 을 갖고 있어 이 PR 의 리뷰 이력을 모르는 다음 사람에게는 "지금 무엇을 하는 코드인가"를 찾기까지의 진입장벽이 높다. 이는 이 프로젝트의 설계-근거 문서화 관례와 궤를 같이하지만 밀도가 특히 높은 사례이며, 즉시 차단할 결함이라기보다 후속 정리 항목으로 적합하다. 정규식 그룹 인덱스 매직 넘버와 타입 미공유는 이미 낮은 위험으로 문서화·유예돼 있어 추가 조치가 급하지 않다.

## 위험도

LOW
