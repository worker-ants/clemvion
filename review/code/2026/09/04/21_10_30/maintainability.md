# 유지보수성(Maintainability) 리뷰

## 리뷰 범위와 방법

`git diff --stat origin/main...HEAD` 로 확인한 실질 코드/문서 변경은 다음 6개다(그 외
46개 파일은 `19_43_18`·`20_16_17`·`20_39_25` 코드 리뷰와 `20_05_42` consistency-check 산출물이
이번에 신규 커밋되며 diff 에 딸려 온 것으로, 이번 changeset 이 새로 만든 "코드" 가 아니라
과거 라운드의 기록이다):

- `CHANGELOG.md` — 신규 Unreleased 섹션 1건
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold`
  타입 정정
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `findNumericAsNumber`
  술어 + 헬퍼
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의 저장소
  전수 테스트 + 대조군
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 e2e
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신

**이 5개 코드/e2e 파일은 직전 라운드(`20_39_25`) 이후 커밋 이력이 없다** (`git log --oneline -3` →
`9ba0991c8`(`20_39_25` 산출물 docs 커밋)이 최신, 그 사이 `codebase/**` 변경 0). 즉 이번 라운드가
리뷰할 "새 코드"는 없고, `20_39_25` 시점의 코드 상태를 소스를 직접 열어 독립적으로 재검증하는
것이 이번 리뷰의 실질이다. 저장소는 읽기만 했다(`git status --short` 뮤테이션 없음, 신규
`review/code/.../21_10_30/` 세션 산출물 제외).

## 과거 WARNING 재확인 (회귀 없음)

`20_39_25` `maintainability.md` 가 지적한 WARNING("`readStringOption` 이 `readBooleanOption` 을
옵션 값 추출 한 분기만 빼고 그대로 복제")은 소스 대조 결과 실제로 닫혀 있다 —
`swagger-dto-contract-guard.ts:69`-`85` 에 제네릭 `readOption<T>(call, key, sf, pick)` 가 있고,
`readBooleanOption`(`:88`-`98`)·`readStringOption`(`:101`-`109`) 둘 다 `pick` 콜백만 다른 3~4줄
래퍼로 축소돼 있다. 회귀 없음.

## 발견사항

- **[INFO]** `numeric` 축 대조군 테스트가 `withFiles(...)` 호출 보일러플레이트를 8곳에서
  반복한다 — `20_39_25` 라운드에서 이미 발견·의도적으로 미조치(INFO)된 항목의 재확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:323`-`470`
    (`describe('[대조군] 술어가 실제로 무는가', ...)` 내부 `it`/`it.each` 8곳 — `327`, `342`,
    `362`(`it.each` 4형태), `400`(`it.each` 2형태), `424`, `443`, `457`)
  - 상세: 같은 파일 상단의 presence·null 축 대조군은 `judge()`/`axes()` 헬퍼(`:51`-`62`)로
    픽스처를 판정 결과 한 줄로 압축하는데, `numeric` 축은 매번
    `withFiles({ 'entities/probe.entity.ts': …, 'dto/responses/probe-response.dto.ts': … },
    (paths) => { expect(findNumericAsNumber(Object.values(paths)))… })` 형태를 그대로 반복한다.
    `20_39_25` `RESOLUTION.md` 가 "INFO#1 — 미조치, 동작·검출력에 영향 없음(순수 가독성)" 으로
    이미 판정해 둔 상태이며, 이번 재확인에서도 그 판정을 뒤집을 근거(예: 새로운 축 추가로
    복제가 더 늘었다거나)는 없다 — 그대로 캐리오버.
  - 제안: 조치 불요(기존 판정 유지). 다음에 이 파일에 세 번째 판정 패턴이 추가될 때
    `judgeNumeric(entitySource, dtoSource) => withFiles({...}, (paths) =>
    findNumericAsNumber(Object.values(paths)))` 로컬 헬퍼로 묶는 것을 함께 고려.

- **[INFO]** `alert-rule-response.dto.ts` 가 도입한 "내부 서사는 plain `//` 주석, 소비자용
  설명은 JSDoc" 분리 패턴이 저장소 어디에도 컨벤션으로 문서화돼 있지 않다
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:20`-`27`
  - 상세: `nest-cli.json` 의 `@nestjs/swagger` 플러그인은 `introspectComments: true` 로 JSDoc 을
    공개 OpenAPI `description` 에 그대로 싣는다(`spec/conventions/swagger.md:17` 에 이미
    명시된 사실). 이 필드는 그 문제(내부 서사가 공개 문서로 새는 것, `20_05_42` W1)를 겪은 뒤
    plain `//` 주석(`:20`-`23`, 정정 경위·근거 링크)과 JSDoc(`:24`-`27`, "지금 무엇을 지켜야
    하는가"만)을 분리해 고쳤다 — 좋은 해법이지만, 같은 문제를 겪었던 자매 커밋
    (`workspace-response.dto.ts` 의 `invitedBy`, `d8b7cb93e`)은 이 분리 없이 JSDoc 하나에
    담았고(`codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105`-`110`,
    다만 그쪽은 서사가 아니라 사실 서술이라 우연히 문제가 없다), `spec/conventions/swagger.md`
    §1) DTO 패턴에도 "JSDoc 에는 무엇을 넣고 무엇을 넣지 말아야 하는가" 가이드가 없다. 다음
    사람이 비슷한 정정을 하면서 서사를 JSDoc 에 그대로 적어(바로 이번에 고친 실수를) 반복할
    여지가 있다 — 가이드가 코드 한 곳에만, 그것도 암묵적으로 존재한다.
  - 제안: `spec/conventions/swagger.md` §1-1 에 "JSDoc 은 소비자가 지금 알아야 할 사실만 담고,
    정정 경위·발견 과정 같은 서사는 plain `//` 주석이나 CHANGELOG 로 분리한다" 한 문단을
    추가하는 것을 고려. plan 문서에 이미 등재된 "numeric 불변식 성문화" planner 항목(§`20_05_42`
    W2)과 같은 편집 세션에 묶으면 비용이 적다 — 다만 `spec/` 쓰기이므로 developer 권한 밖,
    planner 트랙.

## 요약

이번 diff 의 실질 코드(`AlertRuleDto.threshold` 타입 정정 + `findNumericAsNumber` 가드 축 +
저장소 전수 테스트 + e2e)는 직전 두 라운드(`20_16_17`·`20_39_25`)의 WARNING 을 전부 흡수한
상태이며, 이번 라운드는 그 사이 `codebase/**` 변경이 없어(최신 커밋이 `20_39_25` 산출물
docs 커밋) 소스를 직접 재대조하는 형태로 진행했다. `readStringOption`/`readBooleanOption`
중복 제거(`readOption<T>` 제네릭화)는 실제로 반영돼 있어 회귀가 없음을 확인했다. 새로
발견한 것은 둘 다 INFO 수준이다 — (1) `numeric` 축 대조군 테스트의 `withFiles` 보일러플레이트
반복은 이미 알려져 의도적으로 미조치된 항목의 재확인(캐리오버)이고, (2) 이번 diff 가 도입한
"서사는 plain 주석, 설명은 JSDoc" 분리 패턴이 컨벤션 문서에 아직 성문화되지 않아 다음
DTO 작성자가 같은 실수(서사를 JSDoc 에 적어 공개 문서로 새게 하는 것)를 반복할 여지가
남아 있다는 것이다. 둘 다 기능 결함이 아니고 즉각 조치를 요구하지 않는다.

## 위험도

LOW
