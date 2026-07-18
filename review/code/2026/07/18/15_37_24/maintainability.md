# 유지보수성(Maintainability) 리뷰

## 검토 범위 요약

`origin/main` 대비 diff 는 두 겹이다.

1. **실행 코드/테스트** (3파일, 141줄): `output-shape.test.ts`(mutation 고립 테스트 총 7건 신규 — OR-체인 3건 + AND-guard 4건), `output-shape.ts`(JSDoc "no known producer" 근거 보강, 로직 무변경), `hydration-coverage.test.ts`(주석 정정, 검증 로직 무변경).
2. **리뷰 세션 산출물** (20파일): `review/code/2026/07/17/20_06_14/**`, `review/code/2026/07/18/10_40_03/**` — SUMMARY/RESOLUTION/개별 리뷰어 리포트/`meta.json`/`_retry_state.json`. 애플리케이션 코드가 아니라 프로젝트 컨벤션(코드 리뷰 산출물 `review/code/**` 보존)에 따른 로그이므로 함수 길이·중첩·순환 복잡도 축은 해당 없음. 두 세션 모두 직전 라운드에서 이미 검토됐고 후속 라운드가 "직전과 diff 동일 / WARNING 이행 확인"으로 재확인한 이력이 있어 본 라운드에서 새로 문제 삼지 않는다.

이하 발견사항은 (1)에서 **이전 두 라운드(20_06_14, 10_40_03)가 아직 못 본, 이번 HEAD 커밋(`730a87cf0`)에서 신규 추가된 AND-guard 4건 테스트**에 집중한다.

## 발견사항

- **[WARNING]** 신규 AND-guard 테스트 중 2곳이, 같은 커밋의 그룹 헤더 주석이 명시한 "변수명 대신 필드명으로 서술" 원칙을 스스로 어김
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` — `it("rejects a whitelisted endReason without result.messages ...")`, `it("rejects waiting_for_input status alone without output.messages ...")` (파일 내 마지막 4개 테스트 중 3·4번째)
  - 상세: 이 4개 테스트 바로 위 그룹 헤더 주석은 "주석은 소스 변수명이 아니라 **페이로드 필드의 존재/부재**로 서술해, 내부 변수명이 바뀌어도 stale 해지지 않게 한다"고 명시적으로 원칙을 세운다. 그런데 실제로는 4개 중 2개가 그 원칙을 어기고 `output-shape.ts` 의 내부 지역 변수명을 주석 첫 줄에 그대로 인용한다 — `// \`looksLikeConversationEnd\` 의 \`result.messages 존재\` AND-guard 음성 케이스` 및 `// \`isCanonicalWaiting\` 의 \`output.messages 존재\` AND-guard 음성 케이스`. (나머지 2개, 첫 번째 "bare top-level conversationConfig" 테스트와 두 번째 "output.interactionType ... messages 배열" 테스트는 실제로 필드명만 사용해 원칙을 지킨다.) 이는 정확히 직전 두 라운드에서 INFO 로 지적되고 `RESOLUTION.md` 가 "다음에 이 분기를 편집할 때 함께 정리"로 defer 했던 바로 그 패턴(테스트 주석의 소스 변수명 결합)을, 그 패턴을 피하겠다고 선언한 신규 커밋 자신이 부분적으로 재도입한 것이다. 테스트 자체(fixture 형태 기반 동작)는 변수명 리네이밍에 안전하므로 기능적 위험은 없지만, `looksLikeConversationEnd`/`isCanonicalWaiting` 이 향후 리팩터링으로 개명되면 이 두 주석만 조용히 stale 해진다 — 이번 diff 가 스스로 방지하겠다고 밝힌 바로 그 위험이다.
  - 제안: 두 주석의 첫 줄을 "`output.result.endReason` 화이트리스트 매치 + `result.messages` 부재" / "`status === 'waiting_for_input'` + `output.messages` 부재" 처럼 필드 존재/부재 서술로 바꾸고, 변수명은 필요하다면 "(내부적으로 `looksLikeConversationEnd`)" 식 괄호 각주로만 남길 것.

- **[INFO]** 테스트 파일이 지속적으로 커지는 추세 (현재 744줄, `it`/`describe` 44개)
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts`
  - 상세: 이번 커밋까지 3회 연속(#968 본작업 → 20_06_14 이월 3건 → 이번 AND-guard 4건) 같은 "인라인 fixture + 상세 한국어 주석" 패턴으로 단일 파일에 테스트를 계속 추가해왔다. 각 테스트가 무엇을 검증하는지는 여전히 명확하지만, `isConversationOutput` 하나만으로도 이제 10개 이상의 개별 분기/가드 케이스가 이 파일에 누적됐다. 현재로선 가독성 문제가 되는 수준은 아니나, 이 함수의 OR/AND 분기가 더 늘어날 경우 `describe.each`/`it.each` 테이블 구동 방식으로 전환하면 반복되는 boilerplate(공통 `expect(isConversationOutput(raw)).toBe(...)` 골격)를 줄이고 분기 목록을 한눈에 볼 수 있다.
  - 제안: 당장 조치 불필요. 분기가 더 늘어나는 다음 이월 작업에서 테이블 구동 리팩터링을 고려.

- **[INFO]** 프로덕션 함수 `isConversationOutput` 자체는 이번 diff 로 변경되지 않았으나, 10개 이상의 파생 boolean(`hasResultMessages`, `hasLegacyMessages`, `outputInteractionType`, `outputInteraction`, `metaInteractionType`, `metaInteraction`, `hasConvConfig`, `endReason`, `looksLikeConversationEnd`, `isCanonicalWaiting`)을 계산한 뒤 4항 OR 로 결합하는 구조라 순환 복잡도가 이미 높은 편
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:150-209`
  - 상세: 이번 PR 의 diff 는 이 함수의 JSDoc 만 확장했을 뿐 로직은 한 글자도 바꾸지 않았으므로 새로 도입된 문제는 아니다. 다만 이번 PR 이 "이 함수의 모든 분기를 mutation 관점에서 개별 고정"하는 작업인 만큼, 향후 새 분기가 추가될 때마다 이 패턴(파생 변수 나열 + 최종 OR/AND 결합)이 계속 확장되면 함수 하나의 인지 부하가 커진다는 점은 유지보수성 관점에서 참고할 가치가 있다.
  - 제안: 당장 조치 불필요(리팩터링은 diff 밖). 함수 JSDoc 이 "이 목록은 권위 있고 경계가 아니다(authoritative, not bounding)"라고 이미 경고해두었으므로, 분기가 더 늘면 discriminated union 재설계(이미 `RESOLUTION.md` §보류 항목 3 에 별건으로 추적 중)를 검토할 시점을 앞당길 근거로 삼을 것.

- **[INFO]** 리뷰 세션 산출물 커밋(`review/code/2026/07/17/20_06_14/**`, `review/code/2026/07/18/10_40_03/**`)에 있는 `_retry_state.json` 두 건 모두 `routing_status: "pending"` 스냅샷으로 영구 고정됨
  - 위치: `review/code/2026/07/17/20_06_14/_retry_state.json`, `review/code/2026/07/18/10_40_03/_retry_state.json`
  - 상세: 직전 라운드(10_40_03 maintainability.md) 가 이미 동일 관찰을 INFO 로 기록했고 "harness 상태 파일이라 PR 범위 밖"으로 결론냈다. 이번 라운드에서 두 번째 세션의 `_retry_state.json` 도 같은 패턴(세션 시작 시점 스냅샷만 기록, 종료 후 미갱신)을 반복하는 것을 확인했을 뿐, 새로운 문제는 아니다.
  - 제안: 없음(차단 사유 아님, 이미 기록된 관찰의 재확인).

## 요약

이번 diff 의 실질 코드 변경은 여전히 로직 0줄이며(테스트 추가 + JSDoc/주석 정정만), 직전 두 라운드가 남긴 WARNING(하드코딩 라인 번호 drift)은 함수명 기반 참조로 정확히 이행된 상태가 유지되고 있다. 새로 검토할 실체는 HEAD 커밋에서 추가된 AND-guard mutation 고립 테스트 4건인데, 그중 2건이 "테스트 주석은 변수명이 아니라 필드 존재/부재로 서술한다"는 같은 커밋 자신의 명시적 원칙을 어기고 `looksLikeConversationEnd`/`isCanonicalWaiting` 이라는 내부 변수명을 그대로 주석에 노출한다 — 기능적 위험은 없지만 향후 리팩터링 시 조용한 문서 drift 위험을 재도입한다는 점에서 WARNING 으로 표시한다. 그 외에는 테스트 파일 누적 크기·`isConversationOutput` 의 기존 복잡도·리뷰 산출물의 `_retry_state.json` 스냅샷 특성 등 참고용 INFO 3건뿐이며, 모두 차단 사유가 아니다.

## 위험도

LOW
