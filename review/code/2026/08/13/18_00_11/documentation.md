# 문서화(Documentation) Review

## 발견사항

- **[INFO]** 이번 diff(`17_15_21` WARNING 1 조치 — 하드닝을 자매 3곳에 확대)가 3개 함수에 동일한
  `Array.isArray` fail-closed 가드 + `throw` 를 새로 추가했지만, "throw 도 계약의 일부다" 를
  top-level docstring 에 명시하는 후속 조치는 그중 `admitExecutionOrDefer` 한 곳(직전 라운드
  INFO#9)에만 적용됐고 나머지 세 함수에는 확대되지 않았다.
  - 위치:
    - `codebase/backend/src/modules/executions/executions.service.ts` — `computeChainDepth`
      함수 docstring (diff 게이트 밖, 함수 선언 바로 위 JSDoc — "chain 깊이 = ... C-2 — 직렬
      SELECT walk...". `private async computeChainDepth` 선언은 파일 303행). 가드 자체(이번
      diff 추가분, 파일 6 게이트 `319-329`)는 인라인 주석이 상세하지만 함수 상단 JSDoc 은
      throw 가능성을 언급하지 않는다.
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
      `lockNonTerminalExecutionRow` 함수 docstring 의 `@returns` 절 (가드는 이번 diff 게이트
      `8199-8211`, docstring 자체는 diff 밖 — "`true` 면 ... 잠금을 획득했다(커밋까지 유지).
      `false` 는 ...").
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
      `updateExecutionStatus` 함수 docstring 의 `@returns` 절 ("Execution 상태 전이의 단일
      choke point. `@returns` `true` 면 전이가 DB 에 반영됨. `false` 는 ..." — 가드는 이번
      diff 게이트 `8515-8530`, docstring 자체는 diff 밖).
  - 상세: 세 가드 지점 각각의 **인라인** 주석(가드 바로 위 3~6줄)은 왜 이 throw 가 필요한지를
    함수별로 정확히 설명한다 — 이 부분은 매우 훌륭하다(아래 "확인된 양호 사항" 참고). 하지만
    함수를 처음 호출하려는 개발자가 시그니처와 top-level docstring 만 보고 판단할 때
    (`computeChainDepth(): Promise<number>`, `lockNonTerminalExecutionRow(): Promise<boolean>`,
    `updateExecutionStatus(): Promise<boolean>`), 세 함수 모두 "항상 선언된 타입의 값으로
    resolve 된다" 로 오독하기 쉽다 — 실제로는 "또는 throw" 라는 갈래가 이번 diff 로 이름 있는
    의도적 계약이 됐다. 이는 바로 이전 라운드에서 `admitExecutionOrDefer` 에 대해 정확히
    지적되고 고쳐진 것과 같은 종류의 갭이 세 함수로 확대된 것이다 — **코드 하드닝은 자매
    3곳에 동등하게 적용했지만, 그 계약을 문서화하는 작업은 admission 자리 1곳에만
    적용됐다.**
  - 제안: 세 함수의 top-level docstring(`@returns` 절 또는 본문 끝)에 한 줄씩 추가한다. 예—
    `computeChainDepth`: "재귀 CTE 결과가 배열이 아니면(드라이버 shape 이상) throw 한다 —
    depth 1 로 fallback 하면 RR-PL-05 제한이 무력화되므로 fail-open 대신 실패시킨다."
    `lockNonTerminalExecutionRow`/`updateExecutionStatus`: "SELECT/UPDATE 결과가 배열이
    아니면(드라이버 shape 이상) throw 한다 — [트랜잭션을 롤백한다 / 종결 이벤트의 조용한
    유실을 막기 위해서다]."

- **[INFO]** `review/code/2026/08/13/17_15_21/documentation.md` 의 "확인된 양호 사항" 이
  CHANGELOG 미등재 판단을 재사용하면서, 그 판단의 근거("행동 변화 없이 진단 메시지만
  개선됨")가 `computeChainDepth` 가드에는 그대로 적용되지 않는다는 점을 구분하지 않는다.
  - 위치: `review/code/2026/08/13/17_15_21/documentation.md` "확인된 양호 사항" 절 마지막
    항목(게이트 `69-74`, "CHANGELOG.md 미등재는 이전 라운드가 ... 판단은 종전과 동일(둘 다
    예외)로 판단하며 유예한 결정이며...").
  - 상세: 이 문구는 원래 `14_01_46` 라운드가 **admission 가드 하나**(이미 `rows.length` 접근
    시 `TypeError` 로 fail-closed 이던 자리)에 대해 내린 판단이다 — "TypeError → Error, 둘 다
    예외, 행동 변화 없음" 이 정확하다. `17_15_21` 라운드는 같은 판단을 diff 전체(자매 3곳 확대
    포함)에 재적용했는데, 같은 세션의 `RESOLUTION.md` 자체가 표로 명시하듯
    `computeChainDepth` 는 나머지 둘과 달리 "**fail-open — 정확성 결함. 셋 중 유일**" 이다 —
    가드가 없으면 예외가 아니라 **`depth 1` 을 반환해 `reRun` 을 정상 진행시킨다**
    (`spec/5-system/13-replay-rerun.md` RR-PL-05 의 32-depth 체인 제한 우회). 즉 이 한 자리는
    "진단 메시지만 개선" 이 아니라 실제 판정(성공/실패)이 바뀌는 자리다. 실제 도달 조건은
    pg 드라이버가 배열 아닌 값을 돌려주는 극히 드문 케이스라 CHANGELOG 등재가 필수라고
    단정하지는 않지만(이 저장소는 유사한 fail-open→fail-closed 정정을 `CHANGELOG.md` 에
    등재해 온 선례가 있다 — 예: "멱등 캐시 fail-open 을 알람 걸 수 있게 만든다", "캐시
    엔트리 안쪽이 깨지면 요청이 500 이 됐다"), 세 자리를 동질로 묶은 문구는 다음 사람이
    `computeChainDepth` 의 특수성을 놓치게 만든다(같은 `RESOLUTION.md` 가 WARNING 1 처분에서
    스스로 경고한 바로 그 패턴 — "전부 같은 위험이라고 적으면 다음 사람이 특수성을 못 본다").
  - 제안: 필수 아님. 다음에 이 CHANGELOG 판단을 재확인/재사용할 때는 `computeChainDepth` 를
    별도로 판정하거나(별도 짧은 CHANGELOG 항목 고려), 최소한 "세 자리 중 하나는 판정이
    바뀌는 자리지만 도달 조건이 드물어 유예한다" 로 근거를 한 단계 더 좁혀 남긴다.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 이 이번 diff로 파일 끝에
  trailing newline 없이 종료된다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (diff 마지막 줄
    `\ No newline at end of file`).
  - 상세: 순수 서식 문제. 파일 앞부분의 다른 완료 메모들은 정상 개행으로 끝난다.
  - 제안: 선택 사항 — 파일 끝에 개행 1개 추가.

## 확인된 양호 사항 (참고)

- 세 가드 지점(`computeChainDepth`, `lockNonTerminalExecutionRow`, `updateExecutionStatus`)의
  **인라인** 주석은 각각 "가드가 없으면 실제로 무슨 일이 벌어지는가"를 서로 다른 결론으로
  정확히 구분해 설명한다 — fail-open(정확성 결함) vs 이미 fail-closed(진단용) 두 갈래를
  섞지 않는다. 실제 코드(`Array.isArray` 분기·에러 메시지)와 대조해 정확함을 확인했다.
  이는 이 저장소가 반복 지적해 온 "여러 지점을 동질로 묶어 특수성을 지운다" 실패를 코드
  주석 레벨에서는 정확히 피한 사례다.
- `runExecutionFromQueue` 의 admission 호출부 주석(파일 3 게이트 `3674-3679`)이 새 `throw`
  경로에서 routing context 를 release 하는 이유(`17_15_21` WARNING 2)를 정확히 설명하고,
  실제 코드(`try { admission = await ... } catch { release; throw err; }`, 게이트
  `3680-3685`)와 일치한다.
- `executions-rerun.service.spec.ts` 신규 `it` 블록(파일 4)의 JSDoc 은 "`?? 1` 로 depth 1 이
  되어 RR-PL-05 가 조용히 우회된다"는 주장을 실제 `computeChainDepth` 로직·호출부 비교
  (`depth >= RERUN_CHAIN_DEPTH_LIMIT`)와 대조해 정확함을 확인했다. "가드를 지우면 실제로
  성공한다"는 검증 문구도 vacuous pass 방지를 위한 좋은 설명이다.
- `execution-engine.service.spec.ts` 신규 테스트들(파일 2)의 JSDoc 은 세 자매 지점의 위험
  분류표를 코드 주석과 동일하게 재현하며, `admitStub` 헬퍼 확장부 주석("종전엔 resolve
  3값만 지원해 throw arm 이 어떤 테스트도 안 거쳤다")도 실제 이전 갭과 일치한다.
- 공개 API·REST 엔드포인트 변경 없음 — API 문서·README 갱신 불필요. 신규 env
  변수·설정 옵션 없음 — 설정 문서 갱신 불필요.
- 이전 두 라운드(`14_01_46`, `17_15_21`)가 지적한 WARNING 급 문서화 결함
  (`'deferred'` 서술 stale)은 설계를 `throw` 로 되돌리며 원인 자체가 사라져 이미 해소됐고,
  이번 diff 로 재발하지 않았다.

## 요약

이번 diff 는 직전 라운드(`17_15_21`)의 WARNING 1(하드닝을 자매 3곳에 확대)·WARNING
2(admission throw 시 routing context release)를 실제로 반영한 코드와, 그 각각을 정확히
겨냥한 신규 회귀 테스트로 구성된다. 새로 추가된 **인라인** 주석은 세 가드 지점의 위험
성격(fail-open 정확성 결함 vs 이미 fail-closed 진단 강화)을 정확히 구분해 설명하고 있어
지역적 문서화 품질은 높다. 다만 하드닝을 3곳에 균등하게 확대한 것과 달리, 그 계약을
top-level 함수 docstring 에 반영하는 작업(직전 라운드가 `admitExecutionOrDefer` 에 대해
정확히 수행했던 것)은 나머지 세 함수로 확대되지 않아 동일 패턴의 소규모 문서 갭이
남아 있다. 부가적으로, 리뷰 이력 문서(`17_15_21/documentation.md`) 자체의 CHANGELOG 판단이
세 가드를 동질로 묶어 `computeChainDepth`(유일하게 판정이 바뀌는 자리)의 특수성을 흐리고
있다는 점도 참고로 남긴다. 둘 다 기능적 위험은 낮은 INFO 수준이며, README·API 문서·설정
문서·예제 코드는 이번 diff 범위에서 해당 사항 없다.

## 위험도

LOW
