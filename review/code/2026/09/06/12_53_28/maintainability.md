# 유지보수성(Maintainability) 리뷰

## 검토 범위 메모

`origin/main...HEAD` 는 6개 커밋 누적분이다(`96d3856a9`~`4529812c6`). 앞의 4개 커밋은 이미
4차례의 `/ai-review` + fix 라운드(`10_13_22`→`12_28_02`)를 거쳐 이 리뷰어가 지적할 만한 항목
(래칫 숫자 매직값 제거, `CREATOR_PROJECTION` 단일화, `unwrap` 관측 불가 분기 제거, eager 축
검출력 0건 문제 등)이 이미 처분돼 있다. 실질적으로 **새로 리뷰 대상인 코드**는 마지막 커밋
`4529812c6`(`dto-jsdoc-citation-guard.ts`/`.spec.ts`/fixture 신설 + `user-entity-exposure-guard.ts`
소폭 보강)이므로 이 파일들과, 그 파일이 의존하는 `user-entity-exposure-guard.ts`·
`workflow-versions.service.ts` 의 최종 상태를 직접 열어 확인했다. 저장소에 뮤테이션은
가하지 않았다(`git status --short` 로 확인 — 세션 산출물 디렉터리 2개만 untracked, 코드
변경 없음).

## 발견사항

- **[INFO]** `findCitation` 이 노드당 **첫 매치 하나만** 돌려준다 — 같은 JSDoc 안에 서로 다른
  두 인용이 있으면 하나만 보고된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` —
    `findCitation` 함수(`CITATION_PATTERNS` 를 순서대로 `exec` 하고 첫 매치에서 `return`)
  - 상세: 위반 여부 판정(있음/없음) 자체는 이 설계로도 정확하다 — 한 노드에 인용이 하나라도
    있으면 `push` 가 그 owner 를 결과에 넣으므로 이름-기반 존재 검사는 새지 않는다. 다만
    같은 클래스/필드 JSDoc 에 예컨대 전체 경로 인용과 bare 시각 인용이 **둘 다** 섞여
    있으면(예: 과거 인용을 새 인용으로 갈아 끼우다가 지우는 것을 깜빡한 경우) `citation` 필드에는
    먼저 매치된 패턴 하나의 텍스트만 남고, 실패 메시지나 `EXPECTED_DTO_JSDOC_CITATIONS` 동결
    목록을 읽는 사람은 "지워야 할 인용이 하나뿐" 이라고 오해할 수 있다. 실제로 나머지 인용은
    그 필드를 손보고 재실행해도 여전히 위반으로 남아 다시 걸리므로 궁극적으로는 잡히지만,
    한 번에 전부 보여주지 않는다는 점에서 진단 정보가 불완전하다.
  - 제안: `findCitation` 을 `findAllCitations` 로 바꿔 매치된 전체 목록(또는 최소 개수)을
    `citation` 필드에 담거나, 필요 없다면 현재 설계가 "존재만 판정하면 충분하다"는 의도적
    선택임을 함수 JSDoc에 한 줄 명시해 다음 사람이 "버그인가 의도인가"를 다시 조사하지 않게
    한다.

- **[INFO]** 신규 가드 3파일(`dto-jsdoc-citation-guard.ts` 계열)의 함수별 JSDoc 이 리뷰
  라운드 타임스탬프를 반복 인용하며 상당히 길다 — 저장소 관례이므로 결함은 아니지만 가독성
  트레이드오프를 기록해 둔다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` 파일 헤더
    (1~5행) 및 `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts` 파일
    헤더(11~49행, `review/code/...`·`review/consistency/...` 인용 4회)
  - 상세: `spec/conventions/review-citations.md` 가 정한 관례(코드 주석에 리뷰 인용을 남겨
    "왜 이 자리가 이렇게 생겼는지"를 추적 가능하게 한다)를 그대로 따른 것이고, 형제 가드
    파일들(`swagger-dto-contract-guard.ts` 등)도 같은 밀도로 쓴다 — 그 자체는 이 저장소의
    일관된 스타일이라 새 결함이 아니다. 다만 이 세 파일에 한정해 보면, spec 파일 헤더
    (`dto-jsdoc-citation.spec.ts:11-49`)가 이미 "왜 이 가드인가"의 전체 서사(3회 위반 표 포함)를
    담고 있는데, 가드 파일(`dto-jsdoc-citation-guard.ts`) 쪽 JSDoc 도 같은 서사를 요약
    반복한다("소비처는 형제 파일... 배경·근거는 그 파일 헤더에 있다"고 1~3행에서 이미
    명시했음에도 그 아래 개별 함수 JSDoc 에 배경이 다시 등장). 처음 읽는 사람이 로직을 훑을 때
    서사와 구현이 섞여 어디까지가 "지금 이 함수의 계약"이고 어디부터가 "과거 회고"인지 구분하는
    데 약간의 인지 비용이 든다.
  - 제안: 조치 불요(관례 범위 안). 다음에 이 파일을 다시 열 때, 함수 docstring은 "무엇을·왜
    이 형태로 하는가"의 계약만 남기고 다회차 회고성 서술은 spec 헤더 쪽으로 더 몰아주면
    함수 하나를 훑는 데 필요한 줄 수가 줄어든다.

## 요약

리뷰 대상 diff 는 이미 4라운드의 `/ai-review`(코드)·`/consistency-check` 를 거치며 매직 넘버
제거(래칫 개수 대신 배열 전체 비교), 보안 경계 상수 단일화(`CREATOR_PROJECTION`), 관측 불가능한
분기 삭제(`unwrap` 의 괄호/구식 캐스트), 검출력 0건 함정 제거(eager 축 대조군 fixture) 등
유지보수성에 직결되는 지적을 스스로 찾아 고쳐 온 상태다. 이번 라운드에서 실질적으로 새로
검토할 코드는 마지막 커밋의 `dto-jsdoc-citation-guard.ts`/`.spec.ts`/fixture 인데, 순수 로직과
소비 spec 을 분리하는 기존 형제 가드(`swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts`)
와 동일한 구조를 따르고, 함수마다 책임이 하나이며(파일 판정/JSDoc 추출/패턴 매칭/트리 순회가
각각 분리), 중첩 깊이·순환 복잡도 모두 낮다. 네이밍(`isResponseDtoFile`, `findDtoJsDocCitations`,
`jsDocText`)도 역할을 정확히 드러낸다. 찾아낸 두 건은 모두 INFO 등급으로, 하나는 진단 메시지의
완전성(기능적 위반 검출력에는 영향 없음), 다른 하나는 이미 저장소 전체가 채택한 리뷰-인용
관례의 밀도에 대한 관찰이라 조치 불요에 가깝다. 새로운 Critical/Warning 급 유지보수성 결함은
발견하지 못했다.

## 위험도

LOW
