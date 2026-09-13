# Plan 정합성 검토 — `spec/conventions/` (impl-prep, error-code-emission-axis)

## 검토 범위와 방법

target 은 `spec/conventions/` 전체 번들이나, 실제로 착수 예정인 작업(`plan/in-progress/error-code-emission-axis.md`)은
`spec_impact: none` — 코드베이스 harness 파일(`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 등
테스트 3파일)만 건드리는 순수 harness 작업이다. 저장소 전체를 grep 한 결과 `spec/conventions/**` 어디에도
`GUIDE_EXTERNAL_VOCABULARY`·`guide-identifier-scan`·`guide-identifier-existence` 를 참조하는 문서가 없다 —
이 가드 자체가 spec 문서로 소유되지 않는 순수 harness 산출물이므로, target 번들(`error-codes.md`·
`node-output.md` 등)과 이번 작업 사이에 직접적인 문서 SoT 충돌은 없다. 따라서 검토는 target 번들이 실제로
참조하는 도메인(에러 코드 명명, cafe24/makeshop 카탈로그)과 `plan/in-progress/error-code-emission-axis.md` +
그 출처 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)의 미해결 결정·후속 항목이 충돌하는지에
초점을 맞췄다.

## 발견사항

- **[INFO]** `guide-identifier-scan.ts` 의 `lastIndex` 리셋 중복 — 이번 작업이 정확히 그 "다섯 번째" 시나리오다
  - target 위치: (해당 없음 — `spec/conventions/**` 에는 이 가드를 소유하는 문서가 없다. 참고용 코드
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:258,263,274,277,296,300,338,345,353`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`guide-identifier-scan.ts` 의
    `lastIndex` 리셋 보일러플레이트가 4곳에 복제됐다" (developer 등재, `/ai-review` `16_04_15` maintainability
    WARNING#2) — "**리셋 누락**" 위험을 지적하며 "**새 축을 더할 때 다섯 번째를 빠뜨릴 표면이 계속 늘어난다**" 라고
    명시적으로 경고한다.
  - 상세: `error-code-emission-axis.md` §B 는 "따옴표 경계만으로 3종이 정확히 갈린다" 는 새 술어(방출 축)를
    `guide-identifier-scan.ts` 에 추가하는 것을 전제한다. 이는 그 파일에 함수(또는 정규식 스캔 루프)를 새로 여는
    작업이며, 위 WARNING 이 정확히 우려한 "새 축 추가" 시나리오다. `error-code-emission-axis.md` 의 체크리스트에는
    이 상호작용에 대한 언급이 전혀 없다 — `lastIndex` 리셋을 공유 헬퍼로 옮기는 리팩터를 지금 하라는 뜻이 아니라
    (그 항목 자체가 "폴더 공용 유틸로 올리는 것은 이 가드 하나의 범위를 넘어 별 배치" 라고 스스로 defer 했다),
    이번 구현이 그 WARNING 이 예견한 다섯 번째(혹은 그 이상) 복제 지점을 만든다는 사실이 어느 쪽 plan 에도
    교차 기록돼 있지 않다는 점이다. 뮤테이션 테스트("리셋을 지우면 RED 인가")를 새 함수에도 적용하지 않으면
    이 저장소가 반복해서 겪은 "g 플래그 정규식의 두 번째 호출부터 매치 누락" 결함 클래스를 재현할 위험이 있다.
  - 제안: `error-code-emission-axis.md` 체크리스트의 "뮤테이션 — 술어를 지우면 RED 인가" 항목 범위에
    "새로 추가하는 스캔 함수의 `lastIndex` 리셋 누락 뮤턴트" 를 명시적으로 포함시키거나, 최소한 완료 시점에
    `spec-draft-nullable-notation-followups.md` 쪽 WARNING 항목의 "4곳" 이라는 숫자가 갱신 대상이 됐음을
    한 줄 교차 기록한다 (해당 파일은 다른 worktree 소유이므로 직접 편집이 아니라 merge 단계에서 반영).

## 확인했으나 충돌이 아닌 것 (기록)

- **cafe24/makeshop `*_UNRESOLVED_PATH_PARAM` 카탈로그 등재 결정 (planner, 미해결)** — 같은 트래커 파일의
  "`4-cafe24.md §6`·`5-makeshop.md §6` ... 카탈로그가 `*_UNRESOLVED_PATH_PARAM` 을 누락한다" 항목은 (A)/(B)
  선택을 "`CAFE24_UNRESOLVED_PATH_PARAM` 도 같은 형태" 항목과 **한 턴에** 처리하라고 명시하지만, 두 항목 모두
  `error-code-emission-axis.md` 의 스코프(가이드 `.mdx` 문장 정정) 밖이다 — 대상 파일이 다르다
  (`content/docs/**/*.mdx` vs `spec/4-nodes/4-integration/{4-cafe24,5-makeshop}.md`). 실측 결과 두 spec 파일
  어디에도 아직 `UNRESOLVED_PATH_PARAM` 행이 없어 선점 충돌도 없다. 일방적 결정 우회가 아니다.
- **`MAKESHOP_UNRESOLVED_PATH_PARAM` 가이드 문장 정정 방식 (A vs B)** — `error-code-emission-axis.md` §D 는
  "(A) 문장을 고친다, 동작은 안 바꾼다" 를 택하며 (B)(엔진 코드 방출 변경)를 "별 배치" 로 명시적으로 미룬다.
  이는 `#1330` 이 같은 갈림에서 이미 택한 선례와 동형이고, 위 카탈로그 등재 결정(별도 문서·별도 트랙)을
  선점하거나 봉쇄하지 않는다.
- **가이드 가드 양방향화(코드→가이드 역방향) 항목** — 별개 미착수 백로그이며 이번 작업과 축이 달라
  (존재 vs 방출) 선행 조건 관계가 아니다. 다만 향후 그 항목을 구현할 때 "존재하지만 방출되지 않는" 토큰을
  역방향 검사에서 오탐으로 넣지 않도록 이번 작업의 방출 축 구분을 재사용하는 것이 자연스럽다 — 지금 당장
  반영이 필요한 결함은 아니다.
- **중복 작업 여부** — `guide-identifier-*` 관련 트래커 항목·용어는 `error-code-emission-axis.md` 와
  `spec-draft-nullable-notation-followups.md` 두 파일에만 등장하며, 후자는 전자가 닫으려는 항목의 출처
  트래커일 뿐 별개 작업을 새로 벌이는 것이 아니다.

## 요약

`plan/in-progress/error-code-emission-axis.md` 는 스코프를 가이드 `.mdx` 문장 정정 + harness 가드(방출 축)로
좁게 유지하며, 인접한 두 개의 미해결 항목(카탈로그 등재 결정, 양방향 가드)을 올바르게 자기 범위 밖으로
남겨 두어 미해결 결정을 우회하거나 선점하지 않는다. `spec/conventions/` 어느 문서도 이 harness 축을 소유하지
않아 spec 레벨 충돌도 없다(`spec_impact: none` 과 정합). 유일한 갭은 이번 작업이 같은 파일
(`guide-identifier-scan.ts`)에 새 스캔 축을 추가함으로써 이미 등재된 "lastIndex 리셋 4곳 중복" WARNING 이
예견한 "다섯 번째 복제" 시나리오를 실현하는데도 이 사실이 어느 plan 체크리스트에도 교차 기록돼 있지 않다는
점이다 — INFO 수준의 추적 메모로 충분하다.

## 위험도

LOW
