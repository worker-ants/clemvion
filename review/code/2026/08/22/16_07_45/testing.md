# 테스트(Testing) 리뷰 — backend-redact-depth-boundary

## 범위

diff 14개 파일 중 실제 테스트 코드는 `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 1개뿐이다.
나머지(`plan/complete/*.md`, `plan/in-progress/*.md`, `review/consistency/**`)는 plan 문서·리뷰
산출물이라 테스트 관점 리뷰 대상이 아니다(내용은 확인했으며 테스트 관련 서술이 실측과 부합함을
아래에서 교차검증했다).

## 검증 방법

프롬프트에 포함된 `MAX_REDACT_DEPTH` 값·경계 로직을 직접 확인하기 위해
`codebase/backend/src/shared/utils/sanitize-error-message.ts` 를 전문 읽고, 새 테스트 8종을 실제로
`jest` 로 실행했다(76/76 GREEN). 이어서 plan 문서가 주장하는 "뮤테이션 판별력"을 독립적으로
재현하기 위해 소스에 뮤턴트 2종을 직접 주입해 대조했다(스크래치패드에 원본 백업 후 실행,
`git status --porcelain` 로 매 단계 원복 확인, 최종적으로 `git checkout --` 로 클린 상태 보장):

1. `depth >= MAX_REDACT_DEPTH` → `depth > MAX_REDACT_DEPTH` (경계 연산자 뮤턴트): `[경계]` 스위트 8개
   중 **5개 RED** (문자열 잎 회귀 포함 트리 형태 불일치).
2. depth 검사를 문자열 검사보다 **앞으로** 옮기는 순서-역전 뮤턴트: `[경계]` 스위트 8개 중
   **3개 RED**(배열/객체/혼합 서브트리가 실제로는 살아남아야 할 자리에서 마스킹됨).

두 뮤턴트 모두 새 테스트가 즉시 잡아냈다 — plan 문서(`masked-marker-shared-package.md:205-207`)의
"경계 7종 + 뮤테이션 9종, 생존 0/9" 주장과 일치하는 방향의 독립 증거다.

## 발견사항

- **[INFO]** 스택오버플로 회귀 테스트가 5,000-깊이 트리를 두 번 생성·순회한다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:377` (`it('[회귀] 매우 깊은 입력에서도...')`)
  - 상세: `run` 클로저 내부에서 `nestObj(5000, ...)` 을 호출하므로, `expect(run).not.toThrow()` 와
    `expect(run()).toEqual(...)` 가 각각 독립적으로 5,000-레벨 트리를 새로 만들고 순회한다. 실질
    비용은 낮다(`deepRedactCore` 가 `MAX_REDACT_DEPTH`(10)에서 즉시 서브트리를 치환하므로 실제
    재귀 깊이는 10에 그친다 — `nestObj` 자체는 for 루프라 스택 위험 없음). 결함은 아니고 테스트
    스위트 전체 실행 시간에도 영향이 없다(측정: 76개 전체 0.18~0.2s).
  - 제안: 필요하면 `const tree = nestObj(5000, 'Bearer sk-DEEP-END'); const run = () => deepRedactSecrets(tree);` 로
    트리 생성을 1회로 줄여 의도(재실행 시 동일 입력에 대한 두 단언)를 더 명확히 표현할 수 있다. 우선순위 낮음.

- **[INFO]** 세 번째 깊이 상한(`MAX_SANITIZE_DEPTH`, `websocket.service.ts`)에는 대응하는 경계
  테스트가 이번 diff에 없다
  - 위치: 해당 파일은 diff 밖 — `plan/complete/masked-marker-shared-package.md:79-93` 에서 "건드리지
    않는다"고 명시적으로 범위를 좁힌 결정임을 확인
  - 상세: 리뷰 대상 diff 는 `deepRedactSecrets`(egress 값-마스킹) 하나의 상한만 경계 고정한다.
    WS 상한(`> N`, 마커 위치가 한 칸 다름)은 별개 불변식이라는 근거가 문서에 있고, 이번 PR 목적과도
    무관하므로 갭이 아니라 의도된 스코프다. 코멘트로만 남긴다 — 향후 WS sanitizer 를 손댈 때 같은
    패턴(경계 상수 import + 순서/연산자 뮤턴트 대조)을 적용할 근거가 여기 있다는 정도.

- **[INFO]** `deepRedactCore` 는 비공개(un-exported) 함수이고 새 테스트는 공개 API
  (`deepRedactSecrets`)로만 경계를 검증한다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:259` (`deepRedactCore`) /
    테스트는 `sanitize-error-message.spec.ts:301-382`
  - 상세: 이는 결함이 아니라 바람직한 선택이다 — 내부 구현 함수를 직접 노출/테스트하지 않고 공개
    진입점을 통해 관측 가능한 동작(치환 위치·순서 불변식)만 단언한다. 위에서 확인했듯 판별력도
    충분하다. 참고로만 기재.

## 평가

새로 추가된 `깊이 상한 경계 (MAX_REDACT_DEPTH)` 스위트(8개 `it`)는 이전의 vacuous 한
`not.toThrow()` 단일 테스트를 대체하며, (1) 정확한 경계(`MAX_REDACT_DEPTH` / `-1`), (2) 객체·배열·
혼합 세 가지 재귀 진입 경로, (3) 문자열-검사 우선순위(값 vs 깊이 판정 순서), (4) JSON 문자열 잎을
통한 세 번째 재귀 진입점(`depth+1` 파싱 보정), (5) 실측 기반 스택오버플로 회귀(5,000, 상한 없는
구현이 실제로 터지는 크기)까지 커버한다. 리터럴을 박지 않고 `MAX_REDACT_DEPTH` 를 import 해 SoT
변경에 자동으로 追従하도록 설계되어 테스트 용이성도 좋다. Mock 은 필요 없는 순수 함수라 사용하지
않았고 적절하다. 테스트 간 상태 공유(WeakMap 캐시)는 각 테스트가 매번 새 객체를 생성하므로 격리에
문제가 없다. 각 `it` 제목과 JSDoc 주석이 "무엇을 왜" 검사하는지, 어떤 뮤테이션에 RED 가 되는지까지
명시해 가독성이 매우 높다. 직접 뮤턴트 2종을 주입해 재현 검증한 결과 문서의 판별력 주장과 일치했다.
발견된 이슈는 전부 INFO 수준(사소한 비효율/스코프 확인)이며 차단 사유가 없다.

## 위험도

NONE
