# 유지보수성(Maintainability) 코드 리뷰

## 사전 확인

이 diff는 이미 7라운드의 `/ai-review`(14_41_14 → 15_03_06 → 15_24_12 → 16_04_15 →
16_28_47 → 16_56_29 → 17_?? 이전 라운드들)를 거쳤고, 그 라운드들에서 이미 architecture·
maintainability 축이 "한 파일에 3축+허용목록+정규식 5개 누적"을 INFO로 지적·기록·유예한
이력이 있다(`review/code/2026/09/13/15_03_06/RESOLUTION.md` INFO#3·5·6). 아래 발견사항은
그 결정을 재-flag하지 않고, 그것과 **구별되는 새 각도**만 적는다.

## 발견사항

- **[WARNING]** 소스 파일의 72%가 "리뷰 회차 서사"이고, 정작 현재 계약(정규식이 무엇을
  매치하는가)은 그 사이에 파묻혀 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-120`(파일
    상단 배경 설명 블록, 코드 정의 이전) 및 `:135-221`(각 정규식 JSDoc 안에 라운드 5·6·7의
    "첫 판 → 지금" 대조표가 재차 포함).
  - 상세: `wc`로 직접 세어 확인 — `guide-identifier-scan.ts` 360줄 중 260줄(72%)이 `//`
    또는 `*`로 시작하는 주석 줄이다(자매 `guide-sanitized-message-parity.test.ts`는 73줄
    전체 중 주석 비중이 훨씬 낮다). 문제는 "주석이 많다" 자체가 아니라 **그 대부분이
    현재 동작의 설명이 아니라 리뷰 이력의 연대기**라는 점이다 — "첫 판은 이랬는데 라운드 N
    reviewer가 지적해서 지금은 이렇다"는 서사가 `FIELD_TABLE_NAME`(:135-151),
    `CODE_FIELD`(:157-187), `BACKTICK_SPAN`(:190-221) 세 정의 각각에 반복된다. 다음
    사람이 "이 정규식이 지금 무엇을 매치하는가"를 알려면 그 이력을 다 읽어야 한다 — 정작
    필요한 정보(현재 패턴, 현재 경계 규칙)는 각 블록의 마지막 한두 줄뿐이다. 뮤테이션
    근거를 남기는 것 자체는 이 프로젝트의 확립된 관례(근거는 반증 가능해야 한다)이지만,
    그 근거의 **적절한 위치**는 소스 파일이 아니라 plan/리뷰 산출물(이미 `plan/in-progress/
    guide-identifier-existence.md`, `review/code/**/RESOLUTION.md`에 같은 내용이 있다)이다
    — 지금은 같은 서사가 최소 두 곳(소스 JSDoc + RESOLUTION.md)에 중복 존재한다.
  - 제안: 각 정규식 JSDoc을 "현재 계약 한두 문장 + 왜 이 형태인가 한 문장 + 자세한 이력은
    `plan/in-progress/guide-identifier-existence.md` 참조" 수준으로 압축하고, 라운드별
    대조표·"첫 판 vs 지금" 서술은 plan 문서 쪽에만 남긴다. 코드는 "지금 무엇을 보장하는가"를
    빠르게 읽을 수 있어야 하고, "왜 그렇게 됐는가"의 전체 서사는 별도 문서가 더 적합하다.

- **[WARNING]** 소스 코드 주석이 특정 리뷰 세션 타임스탬프 경로(`review/code/2026/09/13/
  HH_MM_SS/...`)를 근거로 15회 인용하는데, 그 경로들은 이 프로젝트 자신의 규약상
  SoT가 아니며 수명주기가 보장되지 않는다.
  - 위치: `guide-identifier-scan.ts:85,148,167,172,204,327` (6곳) ·
    `guide-identifier-existence.test.ts:100,133,160,234,249,260,324,422,495` (9곳).
  - 상세: CLAUDE.md/MEMORY 자체가 "`review/**`는 SoT 아님"이라고 명시한다 — 즉 이
    폴더들은 필요시 정리·이관될 수 있는 산출물이지, 영구 참조 대상으로 설계되지 않았다.
    그런데 애플리케이션 소스 파일(테스트 코드 포함)이 15곳에서 그 경로를
    `근거 문헌`처럼 인용하고 있다. 자매 파일 `guide-sanitized-message-parity.test.ts`도
    이 패턴을 1회 쓰긴 하지만(:10), 이 두 파일은 그것을 15회로 밀도 있게 확장했다 —
    정도의 차이가 질적 차이가 됐다. 훗날 그 리뷰 폴더들이 `plan/complete/archive/`나
    다른 곳으로 이관·정리되면, 소스에 박힌 이 경로들은 검증 불가능한 죽은 링크가 된다
    (Git 이력에는 남지만 "현재 파일 시스템에서 찾아가 확인"이 불가능해진다는 뜻).
  - 제안: 근거를 남기고 싶다면 이관 위험이 없는 앵커(PR 번호·이슈 번호·`git log` 커밋
    SHA)를 쓰거나, 이미 파일 자신이 채택한 방식(:87-89에서 "PR 번호는 push 전 미확정이라
    쓰지 않는다"는 결정을 스스로 기록해 뒀다)을 리뷰 세션 경로에도 일관 적용해, 최소한
    plan 문서 하나로 인용을 모으고 소스 주석에서는 그 plan 문서만 가리키는 것을 고려할 것.

- **[INFO]** (재확인, 조치 불요) 파일 하나가 3개 인용 축(`field-table`/`code-field`/
  `backtick`) + 허용목록 + 5개 정규식의 설계 근거를 전부 떠안고 있다는 지적은 라운드 2
  RESOLUTION(`review/code/2026/09/13/15_03_06/RESOLUTION.md` INFO#3)이 이미 "형제 가드들과
  같은 관례"로 판단해 분리를 유예했다. 새 근거 없이 재-flag하지 않는다.

- **[INFO]** 네이밍·구조 일관성은 양호하다.
  - 위치: `guide-identifier-scan.ts` 전체, `guide-identifier-existence.test.ts` 전체.
  - 상세: `scanXxx`/`collectXxx` 동사 접두, `-scan.ts`(로직)와 `.test.ts`(테스트) 파일
    분리, `UPPER_SNAKE`/`FIELD_TABLE_NAME`/`CODE_FIELD`/`BACKTICK_SPAN`/`BACKTICK_INNER`
    같은 정규식 상수의 SCREAMING_SNAKE 네이밍, `readIfPresent` 같은 작은 헬퍼의 의도
    명확한 이름 등이 자매 파일(`impl-anchor-parse.ts`, `tree-walk.ts`) 및 다른 가드
    테스트들과 패턴이 일치한다. `EXTERNAL_VOCABULARY_CAP = 5`처럼 매직넘버를 명명 상수로
    뽑은 것도 좋다.

## 요약

핵심 로직(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`, 총 3개
export 함수, 약 100줄)은 함수 길이·중첩·네이밍·매직넘버 어느 축으로 봐도 문제가 없고,
기존 가드 파일들과 스타일이 일관된다. 다만 그 로직을 감싸는 주석 볼륨이 파일의 72%를
차지하며 그 대부분이 "지금 무엇을 하는가"가 아니라 "라운드 5/6/7에서 무엇이 어떻게 바뀌었나"
라는 연대기다 — 근거를 남기는 습관 자체는 이 프로젝트가 이미 검증한 좋은 관례이지만, 그
서사의 보관 장소가 소스 파일이어야 할 필요는 없고(같은 내용이 `plan/in-progress/
guide-identifier-existence.md`와 RESOLUTION.md에도 이미 있어 최소 이중화돼 있다),
리뷰 세션 폴더 경로를 근거 앵커로 15회 인용하는 것은 그 폴더 자체가 이 프로젝트 규약상
비영속 산출물이라는 점과 어긋난다. 둘 다 정정하지 않아도 오늘 당장 정합성이 깨지지는
않지만, 이 파일이 다음에 또 재작성될 때(이미 한 번 전체가 삭제+재작성됐다) "어디까지가
지금 계약이고 어디부터가 역사인가"를 가르는 비용을 계속 다음 사람에게 전가한다.

## 위험도

LOW
