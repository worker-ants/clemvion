# 부작용(Side Effect) 코드 리뷰 — error-code-emission-axis (라운드 8, `22_06_10`)

## 검토 범위·방법

이 배치는 `origin/main` 대비 8개 feat/fix 커밋(`65256a109`→`a397ccc55`→`a4b98eda8`→
`5778885ce`→`57288e47f`→`2931d921f`→`eb53aba1c`→`53d29a6f4`)의 누적분이다. 실질 코드는
여전히 두 파일뿐이다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
(발행 축 수집기 3종·`collectMatches`·`isMessagePrefixOnly`·`computeNonEmittedOffenders`·
`GUIDE_NON_EMITTED_VOCABULARY`)와 `guide-identifier-existence.test.ts`(그 축의 단언·대조군·
`resolveSourceLines`/`parseWhereRefs`/`staleGuideEntries` 헬퍼). 나머지(`CHANGELOG.md`·
`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서·plan·리뷰 산출물이라 실행
경로가 없다. 이전 7라운드의 side_effect 리뷰(`19_23_22`→`21_41_23`)가 이미 매 라운드
NONE 으로 판정했고, 그 판정이 겨눈 로직(수집기 3종의 순수성, `matchAll` 의 `lastIndex`
회피, `isMessagePrefixOnly`/`computeNonEmittedOffenders` export 승격, `parseWhereRefs`/
`staleGuideEntries`/`resolveSourceLines` 헬퍼)은 이번 라운드 사이에 바뀌지 않았다.

이번 라운드는 **라운드 7 fix(`53d29a6f4`)가 새로 들여온 증분만** 독립적으로 재검증했다 —
`git show 53d29a6f4 -- codebase/ plan/ CHANGELOG.md PROJECT.md`로 실제 코드 diff를 직접
추출해 대조했다. 증분은 다음과 같다:

1. `guide-identifier-existence.test.ts`에 `describe("resolveSourceLines — 유일성 가드", …)`
   신규 3건(`[0건]`/`[2건 이상]`/`[1건]`) — 기존 헬퍼 `resolveSourceLines`를 겨눈 **판별
   fixture 추가**. 함수 본체(모듈 스코프 `sourceLinesCache` 포함)는 변경 없음.
2. `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`·`PROJECT.md`의 SoT 인용
   문구를 `spec/conventions/user-guide-evidence.md §2`(착지하지 않는 문서)에서
   `error-codes.md` + `3-error-handling.md §1`(착지하는 SoT)로 **주석/문서 텍스트만** 정정.
3. `plan/in-progress/{error-code-emission-axis,spec-draft-nullable-notation-followups}.md`
   갱신 — 줄 인용 오탈자(`:8016`→`:8017`) 정정, 라운드 7 기록, `complete/` 봉인 대비 역참조.

## 발견사항

새로 지적할 CRITICAL/WARNING은 찾지 못했다.

- **[INFO]** (확인, 새 위험 아님) 모듈 스코프 `sourceLinesCache`가 파일 전체 수명 동안
  살아있는 가변 상태이지만, 이번 라운드가 추가한 3건의 테스트를 포함해 이 캐시를 무효화할
  경로가 여전히 없다 — 안전함을 재확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:87`
    (`const sourceLinesCache = new Map<string, string[] | null>();`, 라운드 6 도입) ·
    `:562-583` (`describe("resolveSourceLines — 유일성 가드", …)`, 이번 라운드 신규)
  - 상세: 새 `[1건]` 테스트(`:580-583`)가 `resolveSourceLines("execution-engine.service.ts")`를
    호출하는데, 이 basename은 이미 파일 상단의 `` `where` `` 검증 테스트(:264-300, 라운드 6이
    캐시로 리팩터)에서 먼저 조회돼 캐시에 적재된다. 두 호출 지점이 **같은 키를 공유**하지만
    소스 트리는 테스트 실행 도중 변경되지 않으므로(이 파일도 인접 헬퍼 파일도
    `writeFileSync`/`unlinkSync`류 인-프로세스 뮤테이션을 하지 않음 — `grep` 으로 확인) 값이
    갈릴 여지가 없다. 캐시는 파일 스코프 지역 변수라 다른 테스트 파일로 누수되지도 않는다.
    **잠재적으로만 유의할 점**: 이 저장소의 리뷰 관례 자체가 "저장소 파일을 `cp`로 백업 후
    직접 고쳐 뮤테이션 검증"을 반복해 왔는데(RESOLUTION.md 이력 전반), 만약 향후 누군가 **이
    테스트 파일 안에서** `execution-engine.service.ts`를 인-프로세스로 수정한 뒤 같은 프로세스
    안에서 `resolveSourceLines`를 재호출하는 형태의 대조군을 추가하면 캐시가 옛 내용을 조용히
    반환한다 — 오늘 코드에는 그런 호출부가 없어 결함이 아니라 **다음 확장 시의 주의사항**이다.
  - 제안: 조치 불요(오늘 시점 무해 확인). 향후 이 헬퍼를 인-프로세스 소스 뮤테이션 테스트에
    재사용할 계획이 생기면 `sourceLinesCache.delete(key)` 또는 캐시 우회 파라미터를 함께 추가할
    것 — 기록만 남긴다.

- **[INFO]** SoT 인용 정정(`PROJECT.md`·스캐너 헤더·테스트 JSDoc)은 주석/문서 텍스트만
  바뀌었고 실행 코드·인터페이스에 영향 없음 — 확인
  - 위치: `PROJECT.md:300`, `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-11`,
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:37-38`
  - 상세: 세 곳 모두 `spec/conventions/user-guide-evidence.md §2`(그 문서에 이 가드가 없음,
    실측 `grep -c guide-identifier spec/conventions/user-guide-evidence.md` → 0)를
    `spec/conventions/error-codes.md` + `spec/5-system/3-error-handling.md §1`로 바꾼
    **인용 문구 정정**이다. `export`/함수 시그니처/판정 로직 어디에도 코드 변경이 없다 —
    부작용 관점에서 논할 실행 경로 변화가 없다.
  - 제안: 조치 불요.

- **[INFO]** `plan/**` 갱신은 트래킹 문서 갱신뿐 — 파일시스템 부작용 관점에서 정상 워크플로
  산출물
  - 위치: `plan/in-progress/error-code-emission-axis.md`(§K 라운드 7 절 추가, 체크리스트
    표 갱신), `plan/in-progress/spec-draft-nullable-notation-followups.md`(줄 인용
    `:8016`→`:8017` 정정 2곳, §1.4 항목에 역참조 문단 추가)
  - 상세: 둘 다 이 저장소의 정착된 관례(진행 중 작업 추적·리뷰 라운드 기록)를 따르는 문서
    편집이고, 코드 실행 경로나 CI/빌드 산출물에 영향을 주는 파일시스템 부작용이 아니다.
  - 제안: 조치 불요.

## 참고 (다른 관점이 이미 등재 — 부작용 관점 재조치 불요)

- 라운드 7의 CRITICAL/WARNING(BACKTICK 축 미탐지, `FIELD_TABLE_NAME` 키 순서 fail-open,
  `resolveSourceLines` 유일성 가드 판별력 부재, SoT 착지 오류)은 각각 requirement/testing/
  convention_compliance 관점의 사안이며, 이 라운드에서 실제 코드로 반영된 수정(BACKTICK 2단
  스캔, `FIELD_TABLE_NAME` lookahead 확장, `resolveSourceLines` 3건 판별 fixture, SoT 문구
  정정)이 새로운 전역 상태·시그니처 파괴·파일시스템 부작용을 만들지 않았음을 위에서 확인했다.

## 요약

라운드 7 fix가 새로 들여온 것(판별 fixture 3건, SoT 인용 문구 정정, plan 문서 갱신)은 모두
실행 코드의 부작용 표면을 넓히지 않는다. 유일하게 짚을 만한 지점은 라운드 6에서 도입된
모듈 스코프 `sourceLinesCache`가 이번 라운드의 신규 테스트와 키를 공유한다는 점인데, 오늘
시점에는 인-프로세스 소스 뮤테이션 호출부가 전혀 없어 안전하고, 향후 이 헬퍼를 뮤테이션
검증에 재사용할 때만 유의하면 되는 잠재 사항으로 기록해 둔다. 라운드 1~7이 이미 NONE으로
판정한 나머지 코드(수집기 3종·`collectMatches`·`isMessagePrefixOnly`·
`computeNonEmittedOffenders`·`parseWhereRefs`·`staleGuideEntries`·`matchAll`의 `lastIndex`
회피)는 이번 라운드에서 로직 변경이 없어 판정을 유지한다. 점검 관점 8가지(의도치 않은 상태
변경/전역 변수/파일시스템 부작용/시그니처 변경/인터페이스 변경/환경 변수/네트워크 호출/
이벤트·콜백) 중 어느 것도 CRITICAL/WARNING급 결함으로 이어지지 않았다.

## 위험도

NONE
