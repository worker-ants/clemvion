# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 `Unreleased` 신규 항목이 이후 라운드(2·3차)의 실질 하드닝을 반영하지 않고, 테스트 개수 서술이 지금은 **사실과 다르다**.
  - 위치: `CHANGELOG.md:3-23` (섹션 헤더 `## Unreleased — raw UPDATE/DELETE … RETURNING 회귀 가드를 큐레이션에서 발견형으로 확장했다`, 특히 `:21` "`hasRawUpdateReturning`/`countRawUpdateReturning` 전용 단위 테스트를 신설해 판정 축(양성 6·음성 5)을 합성 문자열로 직접 고정했다")
  - 상세: 이 항목은 커밋 `dd273828f`(1라운드 fix)로 작성된 뒤 한 번도 갱신되지 않았다. 그런데 그 뒤 같은 가드가 두 라운드 더 하드닝됐다:
    1. **음성 테스트 개수가 실제로 5가 아니라 7이다.** `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` 의 `describe('음성 — 대상이 아닌 형태는 뭉개지 않는다', ...)` 를 직접 세어보면 `it.each` 항목이 7개다(`INSERT … RETURNING`·`INSERT … ON CONFLICT DO UPDATE … RETURNING`·`RETURNING` 없는 UPDATE·주석 안 SQL·QueryBuilder·**`.query(sqlVar)` 변수 SQL**(신규)·**2단계 이상 중첩 제네릭**(신규) — 뒤 2개는 커밋 `030e9a825` 로 3라운드에서 추가됐다). CHANGELOG 는 여전히 "음성 5" 라고 말한다 — 지금 시점 코드와 어긋나는 구체적 수치다.
    2. **`ALLOWED` 허용목록이 "파일 단위 전면 면제"에서 "지점 개수 상한"으로 바뀐 것이 통째로 빠져 있다.** 커밋 `a2ab29e2c` 전에는 `ALLOWED` 가 (파일, 사유) 2-tuple 이라 그 파일에 raw 지점이 새로 생겨도 무조건 통과했다 — CHANGELOG 가 자랑하는 "파일 단위 존재-only 판정이 아니다" 라는 문장이 실은 **허용목록 경로에는 적용되지 않았던** 결함이다. 지금은 (파일, 사유, 그 사유가 검토한 지점 수) 3-tuple 로 바뀌어 허용목록도 개수 상한을 받는데, CHANGELOG 본문은 이 변화를 전혀 언급하지 않는다.
    3. **판정 로직이 `it` 본문 인라인에서 `findUnguarded()` 순수 함수로 추출되고, 그 자체가 합성 입력 6건으로 직접 테스트된 것**(`update-returning-rows.spec.ts` 의 `describe('findUnguarded — 합성 입력으로 판정 로직 자체를 고정한다', ...)`)도 CHANGELOG 에 없다. `review/code/2026/08/30/13_15_58/RESOLUTION.md` 의 "핵심 실패는 검증이 fix 보다 한 칸 얕다" 절이 이 변화를 이 PR 전체의 핵심 교훈으로 명시할 만큼 실질적인데, 사용자 대면 변경 이력에는 남지 않았다.
  - 제안: `CHANGELOG.md` 의 해당 항목을 최신 코드로 재대조해 갱신할 것 — 최소한 (a) 음성 테스트 개수를 7로 정정하고, (b) 허용목록이 이제 파일 단위가 아니라 지점 개수 단위로 면제된다는 문장을 추가한다. 이 저장소는 "릴리스 일괄 작성"이 아니라 "수정 시점 즉시 작성" 관행을 스스로 확립해 왔고(직전 라운드 documentation 리뷰가 CHANGELOG 부재를 WARNING 으로 잡아 관철시킨 바로 그 관행), 같은 PR 안에서 그 관행이 두 라운드째 어긋나고 있다.

- **[WARNING]** `plan/in-progress/update-returning-tuple-shape.md` 의 "완료" 배너가 1라운드 상태만 서술하고, 이후 두 라운드의 하드닝을 반영하지 않는다 — 배너 자체가 이 체크리스트 항목의 완료 근거로 제시하는 뮤테이션 표가 지금은 불완전하다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:313-348` (`> **완료 (2026-08-30, \`raw-update-guard-scope\`) — 래퍼가 아니라 발견형 가드로.**` 배너 전체, 특히 `:333-337` 의 3행짜리 뮤테이션 예측/실측 표)
  - 상세: 이 배너는 체크박스 `- [x]` (`:304`)의 완료 근거로 붙어 있고, 뮤테이션 표는 "목록 밖 파일에 헬퍼 없는 raw UPDATE 신설" · "스캐너가 항상 false" · "죽은 allowlist 항목 추가" 세 가지만 싣는다. 이는 1라운드(`RESOLUTION.md` `12_41_15`)에서 검증한 것과 정확히 일치한다. 그런데 2·3라운드가 바로 이 항목이 서술하는 "발견형 가드" 자신에게서 새 결함 두 겹을 더 찾아 고쳤다 — 허용목록의 파일 단위 전면 면제(2라운드 W1, `a2ab29e2c`)와 판정 로직 자체가 테스트되지 않는 구조(2라운드 W2, 같은 커밋), 그리고 스캐너의 두 blind spot 미고정(3라운드 W3, `030e9a825`). `review/code/2026/08/30/13_15_58/RESOLUTION.md` 의 "이 PR 이 세 라운드 돈 이유" 절이 이 사실을 스스로 정확히 기록하고 있는데, 그 기록이 plan 본문에는 소급 반영되지 않았다. 지금 이 배너만 읽는 사람은 허용목록이 여전히 파일 단위로 전면 면제된다고 오해할 수 있다 — 실제로는 그 오해가 바로 2라운드가 잡은 결함의 재현이다.
  - 제안: 배너 하단에 "후속 하드닝 (2라운드/3라운드)" 짧은 문단을 추가해 `ALLOWED` 3-tuple 화·`findUnguarded` 추출·blind spot 캐너리 2건을 요약하거나, `review/code/2026/08/30/13_15_58/RESOLUTION.md` 로 링크를 남길 것. `CHANGELOG.md` 항목을 갱신한다면 같은 문구를 재사용할 수 있어 비용이 크지 않다.

- **[INFO]** 위 두 항목은 근본 원인이 같다 — 두 문서 모두 **같은 세션의 1라운드 시점에 "완료" 서술을 확정**한 뒤, 그 직후 같은 가드가 2·3라운드에서 자신의 결함 클래스를 재귀적으로 드러내며 계속 바뀌었다. `review/code/2026/08/30/13_15_58/RESOLUTION.md`·`review/code/2026/08/30/12_41_15/RESOLUTION.md` 등 `review/` 산출물에는 전체 이력이 정확하게 남아 있으나(직접 대조해 지어낸 서술 없음을 확인함), `review/` 는 이 저장소의 정보 저장 규약상 "코드 리뷰 산출물"이지 `CHANGELOG.md`/plan 완료 배너가 대표하는 "제품 변경 이력"·"작업 완료 기록"의 SoT 를 대신하지 못한다.

- **[INFO]** 핵심 신규 코드(`countRawUpdateReturning`/`hasRawUpdateReturning`/`findUnguarded` JSDoc, `kb-stats.helper.ts`·`kb-stats.helper.spec.ts` 인라인 주석)는 코드와 직접 대조한 결과 서술이 정확하고, "왜 필요한가"·"판정 축"·"이 축이 안 보는 것"을 이 저장소의 확립된 관례대로 충실히 남긴다 — 새로운 결함 없음. `review/code/2026/08/30/12_41_15/documentation.md`·`review/code/2026/08/30/13_15_58/documentation.md` 가 이미 같은 결론(문제 없음)에 독립 도달했고, 이번 재확인도 그 판정을 뒤집지 않는다. `spec/conventions/node-cancellation.md` `pending_plans:` 미등재는 기존 3개 채널이 이미 포착·추적 중이라 중복 기재하지 않는다.

## 요약

핵심 코드(`source-scan.ts`·`update-returning-rows.spec.ts`·`kb-stats.helper.ts`)의 JSDoc/인라인 주석은 여전히 이 저장소의 높은 문서화 관례를 유지하지만, 두 "완료 서술" 문서 — `CHANGELOG.md` 의 Unreleased 항목과 `plan/in-progress/update-returning-tuple-shape.md` 의 완료 배너 — 는 1라운드 시점에 작성된 뒤 갱신되지 않아 2·3라운드의 실질 하드닝(허용목록 파일 단위 전면 면제 → 개수 상한, 판정 로직의 순수 함수 추출과 전용 테스트, blind spot 캐너리 2건 추가)을 반영하지 못한다. 특히 `CHANGELOG.md` 의 "양성 6·음성 5" 는 지금 소스 대조 결과 음성이 실제로는 7개라 **사실과 다른 수치**를 담고 있다. 두 문서 모두 조치 대상은 명확하고 국소적이다(신규 문단 하나씩).

## 위험도

MEDIUM
