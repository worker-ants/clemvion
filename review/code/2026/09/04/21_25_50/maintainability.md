# 유지보수성(Maintainability) 리뷰

## 리뷰 범위와 방법

`git diff --stat origin/main...HEAD` 로 실제 diff 를 재확인했다(65개 파일, 저장소는 읽기만
했고 뮤테이션 없음 — `git status --short` 로 최종 확인). 실질 애플리케이션/가드/테스트 코드
변경은 다음 6개뿐이고, 나머지 59개는 `review/code/2026/09/04/{19_43_18,20_16_17,20_39_25,
21_10_30}/**` · `review/consistency/2026/09/04/20_05_42/**` — 앞선 리뷰·consistency-check
라운드가 신규 파일로 커밋된 산출물이라 함수·클래스 구조가 없다:

- `CHANGELOG.md` — `AlertRuleDto.threshold` 정정 Unreleased 섹션
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold` 타입 정정
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `findNumericAsNumber`/`scanNumericExposure` 축 + 헬퍼
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 축의 저장소 전수 테스트 + 대조군 + `readOption` 캐너리
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 e2e
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신

이 changeset 은 이미 코드 리뷰 4라운드(`19_43_18`→`20_16_17`→`20_39_25`→`21_10_30`)를 거쳤다.
앞선 라운드들이 지적한 WARNING — 정규식 회귀(`20_16_17` W1), 경로 미정규화(`20_16_17` W2),
`<Entity>Dto` 이름 관례 한계 미고정(`20_16_17` W3), `readStringOption`↔`readBooleanOption`
중복(`20_39_25` W1) — 은 소스 대조 결과 전부 실제로 닫혀 있음을 재확인했다(AST 전환·
`toPosixPath`·`readOption<T>` 제네릭화·`[알려진 한계]` 대조군 전부 현재 소스에 존재). 아래는
그 위에서 이번 라운드가 추가로 찾은 자리다.

## 발견사항

- **[INFO]** `numeric` 축 대조군의 두 `it.each` 블록이 **콜백 본문이 완전히 동일**해 하나로 합칠 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:392`-`422`
    (정규식 위음성 4형태 `it.each`)와 `:430`-`452`(포지셔널 `@Column` 인자 2형태 `it.each`)
  - 상세: 두 블록은 데이터 배열(라벨+엔티티 소스)만 다르고, 콜백 본문
    (`withFiles({ 'entities/probe.entity.ts': entitySource, 'dto/responses/probe-response.dto.ts': 'export class ProbeDto {\n  amount: number;\n}\n' }, (paths) => { expect(findNumericAsNumber(...)).toEqual([{ dto: 'ProbeDto', field: 'amount', entity: 'Probe' }]); })`)
    은 글자 하나 다르지 않다. `20_39_25`/`21_10_30` 라운드가 이미 "`numeric` 축 대조군 8곳이
    `withFiles` 보일러플레이트를 반복한다"를 INFO(미조치, 순수 가독성)로 판정해 두었는데, 이
    두 블록은 그중에서도 **테스트 목적(무엇을 검증하는지)까지 동일**해 별도 `describe`/
    `it.each` 로 나눌 이유가 약하다 — 나뉜 이유는 각 블록 바로 위 JSDoc 이 서로 다른 리뷰
    라운드(`20_16_17` W1 vs `20_39_25` W1)의 근거를 설명하기 때문으로 보인다.
  - 제안: 두 `it.each` 의 데이터 배열을 하나로 합치고(6개 케이스), JSDoc 은 "정규식 위음성
    4형태 + 포지셔널 인자 위음성 2형태, 둘 다 같은 이유(numeric 컬럼을 놓치면 가드가
    무력화된다)로 고정한다"는 한 문단으로 합쳐도 두 근거(`20_16_17`/`20_39_25`) 인용은
    보존할 수 있다. 기존 INFO 판정(조치 불요)과 같은 급으로 유지— 새 라운드를 강제할
    정도는 아니다.

- **[INFO]** 앞선 세 라운드가 남긴 미조치 INFO 2건은 이번 라운드에도 회귀 없이 그대로다(carry-over, 재확인만)
  - `numeric` 축 대조군 8곳의 `withFiles` 보일러플레이트 반복 — `20_39_25`/`21_10_30` INFO,
    이번에도 동일 상태(`swagger-dto-contract.spec.ts:353`-`500`).
  - `AlertRuleDto.threshold` JSDoc 이 같은 파일의 다른 필드 대비 길고, `@ApiProperty({ type:
    String })` 명시가 다른 `string` 필드와 스타일이 다른 상태 — `19_43_18`/`20_39_25` INFO,
    `alert-rule-response.dto.ts:20`-`36` 여전히 동일.
  - `alert-rule-response.dto.ts` 가 도입한 "내부 서사는 plain `//`, 소비자용 설명은 JSDoc"
    분리 패턴이 `spec/conventions/swagger.md` 에 아직 성문화되지 않은 것 — `21_10_30` INFO,
    변경 없음(성문화는 planner 트랙, plan 파일에 이미 등재됨: `spec-draft-nullable-notation-
    followups.md` 의 `spec/conventions/swagger.md 에 numeric 불변식 성문화` 항목).
  - 이 셋 모두 이번 diff 로 새로 생기거나 악화된 것이 아니므로 조치를 요구하지 않는다.

- **[INFO]** `alerts-threshold-wire-type.e2e-spec.ts` 는 이번 라운드가 처음 단독으로 살펴보는
  파일이며, 함수 길이·중첩·네이밍 모두 양호해 지적 사항 없음
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` 전체(97줄)
  - 상세: `headers()` 헬퍼로 인증 보일러플레이트를 뽑았고, POST→GET→PATCH 단일 시나리오를
    한 `it` 블록(`:63`-`96`, 약 34줄)에 담되 각 단계에 "왜 이 확인이 필요한가"(예: "GET 은
    DB 를 다시 읽는다 — POST/PATCH 응답은 저장 직후의 in-memory 엔티티" `:76`-`78`) 주석을
    붙여 순차 시나리오 테스트치고 읽기 어렵지 않다. `60_000` 타임아웃이 `beforeAll`·`it`
    두 곳에 반복되지만 이 저장소 e2e 스위트의 기존 관례(다른 `*.e2e-spec.ts` 파일들도 동일
    패턴)와 일치해 이 파일만의 이탈이 아니다.

## 요약

이번 diff 의 실질 코드(`AlertRuleDto.threshold` 타입 정정 + `numeric` 노출 가드 축 + 저장소
전수 테스트 + `readOption` 순회 캐너리 + e2e)는 4라운드에 걸친 코드 리뷰를 거치며 정규식
회귀·경로 미정규화·`<Entity>Dto` 이름 관례 한계·`readBooleanOption`/`readStringOption` 중복
등 실질 WARNING 을 모두 흡수했음을 소스 대조로 재확인했다. 이번 라운드에서 새로 찾은 것은
INFO 하나뿐이다 — `numeric` 축 대조군의 두 `it.each` 블록이 콜백 본문까지 완전히 동일해
하나로 합칠 수 있다는 것으로, 이미 알려진 "`withFiles` 보일러플레이트 반복" INFO 를 조금 더
구체화한 것이지 새로운 리스크 클래스는 아니다. 나머지는 앞선 라운드가 이미 판정해 둔 미조치
INFO 의 회귀 없는 재확인이다. 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 관점에서 구조적
문제는 없다.

## 위험도

LOW
