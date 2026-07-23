# 테스트(Testing) 리뷰 — output-shape.ts / output-shape.test.ts / plan (4차 라운드)

## 컨텍스트

`git log`로 확인한 결과 `output-shape.ts`/`output-shape.test.ts` 는 커밋 `232825784`(2차 라운드
반영) 이후 **한 글자도 변경되지 않았다** — 이후 커밋 `628134a5a`(plan `in-progress/` →
`complete/` 이관)와 `b400e0848`(RESOLUTION 문서 기록)은 둘 다 `codebase/`, plan 본문 무관이다.
즉 이번 라운드는 1~3차에서 이미 Critical 0 / Warning 0 으로 수렴한 것과 **동일한 코드 상태**를
다시 보는 것이다. 아래는 과거 라운드 서술을 그대로 베끼지 않고, 직접 재현한 검증 결과다.

## 독립 재현 검증

- `pnpm exec vitest run .../__tests__/output-shape.test.ts` → **42 passed** (plan 문서 주장과 일치).
- mutation 1건을 직접 재현: `output-shape.ts:202-204` 의
  `(result?.endReason as string | undefined) ?? (output.endReason as string | undefined)` 좌우
  피연산자를 바꿔치기(우선순위 역전) 후 재실행 → `tsc --noEmit` clean, vitest **41 passed / 1
  failed**, 실패한 테스트는 정확히 `"prefers result.endReason over output.endReason when both
  are present"` 1건뿐이었다. plan 문서 `output-shape-comment-followups.md` §측정 1c 의 뮤턴트
  라벨 **I** 서술과 정확히 일치 — 원복 후 `git diff` 잔여 0줄도 확인. plan 문서의 방대한 mutation
  실측 서사(R1/R2/R3/H/I/A~G 12건)가 최소 표본에서 조작·과장 없이 사실임을 재확인했다.
- `CONVERSATION_END_REASONS` 를 소스(`output-shape.ts:12`)와 테스트(`output-shape.test.ts:2`)
  양쪽이 동일하게 `@workflow/ai-end-reason` 패키지에서 import 하는지 grep 으로 대조 — "베낀
  목록 아님" 이라는 테스트 주석 주장이 실제 코드와 일치함을 확인.

## 발견사항

- **[INFO]** 신규 fixture 3건(격리 조건 서술 포함)은 실제로 서로 다른 mutation 클래스를 각각
  단독으로 잡는다 — 양성 확인
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts`
    (`rejects result.messages when the endReason key is absent entirely`,
    `detects a terminal whose endReason sits at output.endReason, not result.endReason`,
    `prefers result.endReason over output.endReason when both are present`)
  - 상세: 세 테스트는 `result?.endReason ?? output.endReason` 표현식의 (a) 키 부재 시 의미,
    (b) fallback 단(우항)의 존재, (c) 두 단의 우선순위를 각각 단독으로 고립시킨다. 위 "독립
    재현 검증"에서 (c)를 직접 재현해 사실임을 확인했고, plan 문서가 (a)·(b)에 대해서도 동일한
    형식(뮤턴트 라벨 R1/R2/H)의 재현 가능한 근거를 남겨 뒀다. Mock 없이 순수 in-memory 객체
    리터럴만 사용해 실제 함수 동작과의 괴리가 없다.
  - 제안: 없음 (기록용 확인).

- **[INFO]** JSDoc↔테스트 주석 "근거는 한 곳에만" 원칙이 최종본에서 실제로 지켜짐
  - 위치: 신규 테스트 3건의 주석
  - 상세: 1·2차 라운드에서 지적됐던 "mutation 실측 수치(tsc 에러 위치·N/N green)를 테스트 주석에
    인라인으로 중복 기록" 문제가 최종 diff에는 남아 있지 않다 — 세 주석 모두 구체 수치 없이
    `plan 문서 output-shape-comment-followups.md §mutation 실측` / `§측정 1b` / `§측정 1c` 로만
    위임한다. 포인터가 폴더 경로가 아니라 **파일명 기준**이라 이미 실제로 일어난
    `in-progress/` → `complete/` 이관에도 깨지지 않음을 확인(`plan/complete/output-shape-comment-
    followups.md` 로 이동한 뒤에도 파일명 자체는 동일).
  - 제안: 없음.

- **[INFO]** 테스트 격리 — 공유 상태·mock·lifecycle hook 전혀 없음
  - 위치: `output-shape.test.ts` 전체
  - 상세: `grep -n "beforeEach|afterEach|vi.mock|vi.spyOn|let "` 결과 0건. 모든 테스트가
    자신만의 `raw` 객체 리터럴을 선언하고 순수 함수 `isConversationOutput`/`unwrapNodeOutput`
    를 호출해 `toBe`로 단언한다. 실행 순서·병렬 실행 여부에 무관하게 결정적이다.
  - 제안: 없음.

- **[INFO]** 사전 존재 커버리지 갭 3건 — 이번 diff 범위 밖, plan 후속 이월로 문서화됨(비차단)
  - 위치: `output-shape.ts` 최상위 가드
    (`if (!outputData || typeof outputData !== "object" || Array.isArray(outputData)) return
    false;`), 그리고 `endReason` fallback 표현식
  - 상세: `isConversationOutput(null)` / `isConversationOutput([])` / 원시값 입력을 직접 고정하는
    테스트가 없다(grep 결과 0건). `result.endReason: null`(explicit null, key-present)을 단독
    고립하는 fixture 도 없다 — 다만 현재 `??` 는 `null`/`undefined` 를 동일 취급하므로 이 경우는
    "키 부재" fixture 와 **런타임 동작이 구별되지 않아** 실질 위험은 낮다(`!==undefined` 류
    리팩터로 바뀔 때만 갈라짐, backend producer 도 null 미생산). `Array.isArray` 의
    truthy-but-not-array 변형(예: array-like 객체)도 미고립. 세 항목 모두
    `plan/complete/output-shape-comment-followups.md` "## 후속 이월" 섹션에 근거와 함께 명시적으로
    기록돼 있어 조용히 잊힐 위험은 낮다.
  - 제안: 다음에 이 파일을 편집할 기회에 (1) 최상위 타입가드 직접 테스트 3종(`null`/배열/원시값)
    추가, (2) `Array.isArray` 변형 고립 fixture 를 함께 넣는 것을 권장. 병합 차단 사유는 아님.

- **[INFO]** `it.each` 미전환 판단(NO-GO)의 근거가 실측 기반이라 재현 가능
  - 위치: `plan/complete/output-shape-comment-followups.md` "4. `it.each` 테이블 구동 전환 —
    NO-GO"
  - 상세: 라인 분해표(fixture/고립 근거 주석/`it()` 보일러플레이트 비중)로 "순감 4% 미만"을
    정량화했다. 이 저장소의 관례(그럴듯한 대안을 지어내면 안 되고 실측이 있어야 함)에 부합하는
    드문 사례 — 코드 결함은 아니고 테스트 스타일 결정의 근거 품질에 대한 긍정적 관찰.
  - 제안: 없음.

## 요약

이번 라운드에서 실제 검토 대상 코드(`output-shape.ts`, `output-shape.test.ts`)는 2차 라운드 반영
커밋(`232825784`) 이후 변경이 없어, 1~3차에서 이미 Critical 0 / Warning 0 로 수렴한 것과 동일한
코드다. 직접 mutation 1건(`??` 좌우 교환)을 재현해 plan 문서(`output-shape-comment-followups.md`)
의 방대한 실측 서사가 사실임을 확인했고, 42개 테스트가 순수 함수·mock 없음·공유 상태 없음으로
완전히 격리돼 있으며, 이전 라운드에서 지적된 "근거 이중 기록" 문제도 최종본에서는 해소됐음을
확인했다. 남은 갭(최상위 타입가드 직접 테스트, `null` 명시값 고립, `Array.isArray` 변형)은 모두
이번 diff 범위 밖의 사전 존재 갭으로 plan 문서에 근거와 함께 명시적으로 이월돼 있어 병합을 막을
사유가 아니다. 신규 결함·회귀 없음.

## 위험도
LOW
