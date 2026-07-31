# 테스트(Testing) 리뷰 — workflows duplicate() 팔로우업 (3차 라운드)

## 검증 방법

프롬프트 diff 뿐 아니라 실제 코드베이스를 직접 `Read`/`grep`/`git show`/`jest` 로 재확인했다 (1·2차
라운드 결론을 그대로 인용하지 않고 독립 재검증):

- `codebase/backend/src/modules/workflows/workflows.service.spec.ts` 전체 — `duplicate` describe
  (387~763행) 안의 `it(` 을 직접 나열해 카운트, `beforeEach`·신규 테스트 2건 본문 재독.
- `codebase/backend/src/modules/workflows/workflows.service.ts` `duplicate()`(228~335행) 전문 재독 —
  `nodeRows.length > 0` / `edgeRows.length > 0` 가드 구조, `condition` 삼항(325행) 확인.
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` — `duplicate` describe 부재
  재확인(grep).
- `plan/in-progress/review-info-followups.md` 전체 재독 + `git show c7307e4a6 -- plan/...` 로 2차
  조치 커밋("docs(review): 2차 리뷰 조치")의 실제 diff hunk 확인.
- `npx jest workflows.service.spec.ts` 직접 실행 — 결과 80/80 GREEN (현재 시점 재확인).
- `grep -c "^\s*it("` 로 스펙 전체 테스트 수, `duplicate` describe 안 `it(` 수동 카운트로 문서 수치
  대조.
- Swagger description 배열+`join(' ')` 결과가 원본 237자 문자열과 byte-identical 인지 Node 스크립트로
  재검증(`===` → `true`).
- `grep -rn "nodeEntities\|edgeEntities" codebase/` 로 리네이밍 잔존 참조 재확인(0건).
- `git diff origin/main...HEAD --stat -- codebase/` 로 실제 변경 파일이 controller/service/spec 3개
  뿐인지 대조.

## 발견사항

- **[WARNING]** plan 문서의 mutation 실측 서술이 **같은 절 안에서 자기모순** — 2차 리뷰가 "정정
  완료"로 기록한 바로 그 문장이 실제로는 삭제되지 않고 그대로 남아 있다
  - 위치: `plan/in-progress/review-info-followups.md:60`(틀림: "`duplicate` describe 22건 기준(전체
    스펙 81건)") vs 바로 아래 `:62`(맞음: "스펙 전체 **80건**(`workflows.service.spec.ts`) 기준")
  - 상세: `git show c7307e4a6 -- plan/in-progress/review-info-followups.md` 로 2차 조치 커밋의 실제
    diff hunk 를 확인했다. 이 커밋은 60행("22건 기준(전체 스펙 81건)")을 `+`/`-` 없는 **컨텍스트
    줄로만 남겨두고**, 그 아래에 62행("스펙 전체 80건")을 새로 추가했을 뿐이다 — 즉 60행의 틀린
    수치는 한 번도 고쳐진 적이 없다. 직접 실측(`grep -c "^\s*it(" workflows.service.spec.ts` → 80,
    `duplicate` describe 안의 `it(` 수동 카운트 → 16)으로 60행("22건/81건")이 틀렸고 62행("80건")이
    맞다는 것을 재확인했다. 같은 문단 안에 서로 다른 숫자를 주장하는 두 문장이 나란히 남아, "mutation
    으로 non-vacuous 증명" 절이 제시하려는 근거 수치 자체를 어느 쪽으로 읽어야 할지 불명확하다.
    이 항목은 이미 **두 차례** 지적·정정된 바로 그 클래스의 오류다 — 1차 라운드가 "M2 3 failed →
    실제 2"를 잡았고, 2차 라운드가 그 정정문에서 새로 생긴 "duplicate describe 22건/전체 81건 →
    실제 16건/80건"을 잡아 `review/code/2026/07/31/18_37_11/RESOLUTION.md`(§INFO#2)와 plan
    체크리스트(117~119행)에 "정정 완료"로 기록했다. 그런데 이번엔 그 "정정"이 잘못된 문장을 지우지
    않고 옆에 맞는 문장만 추가하는 **불완전한 수정**이었다는 세 번째 변종으로 재발했다 — "정정했다"는
    기록 자체가 실제로는 부분적으로만 사실이다.
  - 제안: 60행을 62행 내용으로 교체하거나 두 문장을 하나로 병합하고, 남은 잘못된 절반을 삭제한다.
    1줄짜리 트리비얼한 수정이지만 RESOLUTION.md 가 이미 "해결됨"으로 보고한 항목이 실제로는 미완이므로
    plan 체크리스트의 "push + PR"(122행, 유일한 미체크 항목) 전에 반영을 권장한다.

## 확인된 항목 (독립 재검증 — 문제 없음)

- `edge.condition` 얕은 복사 수정(핵심 동작 변경, `workflows.service.ts:325`)은 값 동등성
  (`toEqual`)·참조 비동일성(`.not.toBe`)·**null 분기**(`toBeNull()`) 3축을 모두 단언하는 전용 테스트
  (`workflows.service.spec.ts:693-709`)로 뒷받침된다. 코드를 직접 읽어 삼항의 두 분기 모두 최소
  하나의 단언에 걸려 있음을 논리적으로 재확인했다 — 참조 복사를 제거하면 `.not.toBe`, null 분기를
  `undefined` 로 바꾸면 `toBeNull()` 이 각각 깨진다. vacuous 하지 않다.
- `edgeRows.length > 0` 가드 단독 검증 테스트(`:679-691`, "노드만 있고 엣지가 0건이면 Node insert 만
  호출한다")가 가드 변수 교체(swap) mutation 클래스를 잡는다는 2차 라운드의 결론을 코드 추적으로
  재확인했다 — 노드 5·엣지 0 조합에서만 `nodeRows.length>0`↔`edgeRows.length>0` 스왑이 관측되고,
  둘 다 0인 "빈 캔버스" 케이스는 두 변수 값이 우연히 같아 무증상이다.
- `npx jest workflows.service.spec.ts` 직접 실행 결과 **80/80 GREEN**(현재 시점), `duplicate`
  describe 안의 `it(` 을 직접 세면 **16건** — plan 문서의 §실측 검증(102행)·체크리스트(117~119행)
  수치와 일치(단, 위 WARNING 의 60행은 예외).
- `nodeEntities`/`edgeEntities` → `nodeRows`/`edgeRows` 리네이밍: `codebase/` 전역 재검색 결과 잔존
  참조 **0건**.
- Swagger `duplicate` description 배열+`join(' ')` 결과를 Node 스크립트로 직접 재현 — 원본 237자
  단일 문자열과 **byte-identical**(`true`) 확인.
- `workflows.controller.spec.ts` 는 여전히 `duplicate` 관련 describe 가 없음을 재확인했다. 이번
  diff 는 해당 엔드포인트의 Swagger `description` 만 변경했고 동작 변경이 없으므로(위
  byte-identical 확인) 이번 diff 가 새로 만든 갭이 아니고, 이미 1·2차 라운드가 근거와 함께 비차단으로
  기록한 기존 갭이다 — 3번째 확인이라 별도 신규 항목으로 다시 세우지 않는다.
- 신규 테스트 2건 모두 `beforeEach` 가 매 테스트 전 `mockTransactionManager.find`/`insert`/
  `update`/`save` 를 재설정하고, 필요 시 테스트 본문에서 자신의 `find` 를 재대입하는 기존 패턴을
  그대로 따른다 — 테스트 간 실행 순서 의존성 없음(격리 양호).
- `.only`/`.skip`/`xit`/`fit` 등 포커스·제외 지시자 잔존 없음(grep 확인).
- `git diff origin/main...HEAD --stat -- codebase/` 로 실제 변경이 controller/service/spec 3개
  파일뿐임을 재확인 — 숨겨진 추가 변경 없음.

## 요약

이번(3차) 라운드에서 실제 소스(`workflows.controller.ts`/`workflows.service.ts`/
`workflows.service.spec.ts`)와 테스트 실행 결과를 전부 직접 열어 독립 재검증한 결과, 핵심 동작 변경
(`edge.condition` 얕은 복사)과 신규 테스트 2건은 이미 앞선 두 라운드가 결론지은 대로 견고하고
non-vacuous 함을 재확인했다(80/80 GREEN, `duplicate` describe 16건, 리네이밍 전역 완결, Swagger
byte-identical, 신규 테스트 격리 양호). 다만 `plan/in-progress/review-info-followups.md:60` 에는 2차
리뷰가 "정정 완료"로 기록한 바로 그 수치 오류("22건 기준(전체 스펙 81건)")가 실제로는 지워지지 않고
62행의 올바른 문장("80건") 바로 위에 그대로 남아, 같은 문단이 서로 다른 숫자를 주장하는 자기모순
상태다 — `git show` 로 2차 조치 커밋의 diff 를 직접 확인해 그 문장이 해당 커밋에서 손대지지 않은
컨텍스트 줄이었음을 검증했다. 이 PR 은 같은 문서에서 같은 클래스의 수치 오류를 이미 두 차례 리뷰가
잡아 정정한 이력이 있는데, 이번엔 "정정했다"는 기록 자체가 불완전한 수정(틀린 문장을 안 지우고 맞는
문장만 옆에 추가)을 완료로 잘못 보고한 세 번째 변종이라 WARNING 으로 표기했다 — 프로덕션 코드·테스트
실행에는 영향이 없는 순수 문서 결함이고 1줄 수정으로 해소 가능하지만, 이 PR 의 성격 자체가 "근거를
남겨 종결한다"는 문서 신뢰성에 있으므로 push 전 반영을 권장한다.

## 위험도

LOW
