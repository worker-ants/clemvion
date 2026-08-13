# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** 신규 회귀 테스트 파일의 근거 주석이 실제로 그 이슈를 지적하지 않은 리뷰 세션을
  인용한다 — "ai-review" 로 표기됐지만 실은 코드 리뷰가 아닌 consistency-check 세션이고,
  그 세션의 실제 발견 내용도 인용문과 다르다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:33`
    (`* (ai-review \`14_18_42\` → \`17_15_21\` 연속 지적).`)
  - 상세: 이 JSDoc 은 "가드를 한 곳에만 적용하고 자매를 안 세는 것" 이라는 결함 패턴을
    "ai-review `14_18_42` → `17_15_21` 연속 지적" — 즉 두 세션이 연달아 지적한 것으로 서술한다.
    그런데 실제로 확인하면:
    1. `14_18_42` 는 `review/code/` 가 아니라 `review/consistency/2026/08/13/14_18_42/` 에 있는
       **consistency-check** 세션이다 — 이 저장소의 명명 규약상 "ai-review" 는 `review/code/`
       (code-review-agents, `/ai-review`)를 가리키고, consistency-check 는 별도 워크플로다.
    2. 그 세션의 실제 산출물(`review/consistency/2026/08/13/14_18_42/SUMMARY.md`,
       `convention_compliance.md`, `rationale_continuity.md`)을 전수 확인했지만, "가드를 한
       곳에만 적용" 류의 sibling-coverage 지적은 **없다**. `14_18_42` 가 다룬 `Array.isArray`
       관련 내용은 (a) 에러 메시지 스타일 비일관성(INFO, convention_compliance) (b)
       defer→throw 자기 교정이 spec Rationale 과 정합한다는 확인(rationale_continuity)뿐이다.
    3. "가드를 자매 3곳에 안 폈다" 는 실제로는 `review/code/2026/08/13/17_15_21/requirement.md`
       WARNING 1 **단독** 지적이다 — 커밋 메시지(`b3782f562`: "ai-review 17_15_21 WARNING
       1·2")도 이를 그대로 확인해 준다. `14_18_42` 를 "연속 지적" 의 한 축으로 끼워 넣을
       근거가 없다.
    이 테스트 파일 자체의 목적(파일 34-42행)이 "왜 이 회귀 가드가 필요한가"를 미래의 독자에게
    설명하고 근거 세션으로 추적하게 하는 것인데, 그 추적 링크가 잘못된 세션을 가리켜 목적을
    해친다 — `14_18_42` 를 열어 보는 독자는 이 코멘트가 설명하는 "sibling 누락" 이야기를 찾지
    못하고 무관한 EIA notification payload drift 이야기를 보게 된다. 같은 커밋이 같은 날 새로
    만든 `assert-row-array.ts` 의 JSDoc(`ai-review \`17_15_21\` 실측`, 단일·정확한 인용)과
    바로 비교되는 자리라 더 눈에 띈다.
  - 제안: `(ai-review \`14_18_42\` → \`17_15_21\` 연속 지적)` 을 `(ai-review \`17_15_21\`
    지적)` 으로 정정한다. "반복된 실패 클래스" 라는 일반적 맥락을 유지하고 싶다면 별개 회차인
    `14_01_46`(side_effect WARNING 1, "방어를 한 칸 좁게 잡음" 같은 실패 계열이지만 대상은
    트랜잭션 레이어 경계이지 sibling 커버리지가 아님)을 인용하려 했을 가능성도 있어 보이나,
    그 경우도 정확한 세션 ID·정확한 지적 내용으로 다시 확인 후 적어야 한다.

## 확인된 양호 사항 (참고)

- `assert-row-array.ts` JSDoc 은 왜 `.query()` 반환 타입 단언이 런타임 검증이 아닌지, 실제로
  관측된 두 가지 실패 방향(fail-closed 접힘 vs fail-open 접힘)을 `17_15_21` 실측과 정확히
  일치하게 서술한다 — 인용 세션도 정확하다(`RESOLUTION.md` 표와 대조 확인).
- `assert-row-array.spec.ts` 의 "자매 지점 전수" 회귀 테스트 JSDoc 은 정적 grep 의 한계
  (advisory-lock 호출이 `const ... = await ...query` 패턴에 안 걸리는 이유, import 행이
  `assertRowArray(` 패턴에 안 걸리는 이유)를 정확히 설명하며, 실제 정규식·소스와 대조해도
  일치한다.
- `execution-engine.service.ts`/`executions.service.ts` 의 3개 호출부는 인라인 가드를
  `assertRowArray()` 호출로 리팩터하면서도, 각 지점이 왜 위험한지(`admission` 트랜잭션 롤백,
  `lockNonTerminalExecutionRow` 진단용 fail-closed, `updateExecutionStatus` 종결 이벤트 유실,
  `computeChainDepth` RR-PL-05 우회)를 구분해 설명하는 지점별 인라인 주석은 리팩터 전후로
  내용 손실 없이 보존됐다 — 헬퍼가 갖는 공통 에러 문구(`typeof=...`)와 호출부가 주는
  `detail`(지점별 사유) 간 소유 분리가 실제 코드와 일치한다.
- top-level 함수 docstring 을 세 지점(`computeChainDepth`/`lockNonTerminalExecutionRow`/
  `updateExecutionStatus`) 모두로 확장하지 않은 것(직전 라운드 `18_00_11` documentation INFO
  #1)은 이번 커밋 메시지가 "소유 분리 — 공통 계약은 `assertRowArray` docstring, 지점별 차이는
  호출부 주석" 이라는 근거로 명시적으로 재확인했다 — 새로운 결함이 아니라 의식적 설계 결정의
  연장이다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 두 완료 메모(`snapshotCache` 항목,
  admission 가드 항목) 각각의 서식·배치 문제(빈 줄 2연속, `## Rationale` 섹션 뒤로 밀려난 배치)는
  이번 라운드가 새로 만든 것이 아니라 `4fcc1b43a`(14:01 커밋, `14_01_46` 리뷰 대상)에서 이미
  존재했고, `review/code/2026/08/13/14_01_46/documentation.md` INFO(#3)가 이미 지적했으며
  `RESOLUTION.md` 가 "무조치 — 서식" 으로 명시적으로 처분한 항목이다. 이번 라운드의 실질 diff
  (`30112b7d4`)는 이 파일을 건드리지 않아 재지적 대상이 아니다.
- CHANGELOG 미등재 판단(특히 `computeChainDepth` 가 fail-open→fail-closed 로 판정이 바뀌는
  유일한 지점이라는 비대칭)도 이미 `18_00_11` documentation 라운드가 INFO 로 지적했고
  같은 라운드 `RESOLUTION.md` INFO #12 가 "지적이 맞다" 며 문서(리뷰 기록)상에서 구분해 적는
  것으로 처분을 마쳤다 — 이번 라운드에서 새로 발생한 갭이 아니다.
- 이번 diff(신규 파일 2개 + 기존 파일 2곳 리팩터)는 공개 API·REST 엔드포인트·환경변수·설정
  옵션을 추가하지 않아 README·API 문서·설정 문서 갱신 필요성은 없다.

## 요약

이번 라운드(`18_19_33`)의 실질 신규 diff 는 커밋 `30112b7d4` 하나로, 기존 4곳의 인라인
`Array.isArray` 가드를 공용 `assertRowArray()` 헬퍼로 추출하고 "가드 호출 수 == 소비형
`.query()` 호출 수" 를 고정하는 구조적 회귀 테스트를 추가한다. 리팩터 자체의 지역적 문서화
품질은 높다 — 지점별 위험 설명이 인라인 주석에 그대로 보존됐고, 헬퍼 JSDoc 은 위험 클래스와
실측 결과를 정확한 세션 인용과 함께 서술한다. 다만 새로 추가된 회귀 테스트 파일의 JSDoc 이
근거로 인용하는 리뷰 이력 중 하나(`14_18_42`)가 실제로는 무관한 consistency-check 세션이고
해당 지적을 담고 있지 않아, 향후 이 코멘트를 따라가 근거를 확인하려는 독자를 잘못된 곳으로
보낸다 — 이것이 유일한 실질 WARNING 이다. 그 외 이 diff 범위에서 재론할 만한 문서화 갭
(top-level docstring 미확장, plan 문서 서식, CHANGELOG 등재 여부)은 모두 직전 두 라운드
(`17_15_21`, `18_00_11`)가 이미 검토·처분을 완료한 항목이며 이번 diff 가 그 상태를 바꾸지
않았다. README·API 문서·설정 문서·예제 코드는 이번 diff 범위에서 해당 사항 없음.

## 위험도

LOW
