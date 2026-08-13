# 문서화(Documentation) 리뷰 결과

## 검토 방법

이 diff(`origin/main...HEAD`)는 `update-returning-tuple-shape` 결함 수정(backend 코드 10개
파일)과, 그 작업 과정에서 이미 6차례(`20_36_35`/`22_45_24`/`23_07_11`/`23_27_48`/`23_46_00`/
`00_00_44` + consistency 6라운드) 진행된 `/ai-review`·`/consistency-check` 세션 산출물의
누적 커밋으로 구성된다. 직전 다섯 문서화 라운드가 CRITICAL 1건·WARNING 다수를 찾아 전부
조치했고, 직전 라운드(`00_00_44`)가 그 조치들의 실제 반영을 재확인한 바 있으므로, 이번
라운드는 (a) 핵심 소스 5개 파일(`update-returning-rows.ts`/`.spec.ts`,
`execution-engine.service.ts`, `knowledge-base.service.ts`, `auth-oauth.service.ts`,
신설 e2e `auth-oauth-callback.e2e-spec.ts`)을 `Read`/`Grep`으로 직접 열어 기존 조치가
유지되는지 재확인하고, (b) 이 PR 이 반증한 사실이 **PR 범위 밖의 기존 문서**(특히
`CHANGELOG.md`)에 미치는 소급 영향까지 점검하는 데 집중했다.

핵심 소스 5개 파일 재확인 결과는 이전 라운드와 동일 — stale 모순 주석 제거·`unknown` 애너테이션
통일·`detail` 인자 8곳 전부 채움(`knowledge-base.service.ts:346,544,578,729,751` 등)·
`EXPECTED` 2-tuple 주석 정정·`_label`/`value` 네이밍 통일이 전부 현재 소스에 유지돼 있다.
아래 발견사항은 이번 라운드에서 새로 확인한 항목이다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 기존(과거 PR) 항목이 이 PR 이 반증한 사실 위에 서술돼 있는데,
  plan 문서들이 받은 것과 같은 소급 정정이 빠졌다.
  - 위치: `CHANGELOG.md:279-283`, `CHANGELOG.md:321` (섹션 `## Unreleased — retry_last_turn
    재진입: 종결 경로 terminal 가드 + 원자 claim + 짝 전이 persist 수정`, 항목 1·7)
  - 상세: 이 두 항목은 `retry-turn.service.ts` 의 `finalizeGuarded`(→
    `driver.updateExecutionStatus(execution, target)`, `linkedNodeExec` 없이 호출 —
    `execution-engine.service.ts` 의 raw `UPDATE … RETURNING` "else 분기"를 탄다)가
    "guarded UPDATE 0행이면 저장·종결 이벤트 emit 을 모두 skip 한다"·"`affected` 가 0이면
    종결 이벤트 emit 을 skip 한다" 고 **이미 검증된 동작**처럼 서술한다. 그런데 이 PR 이
    수정한 결함이 정확히 이 경로다 — `updateExecutionStatus` 의 `updated.length > 0`(else
    분기)이 `1657c0435`(2026-06-14)부터 `8332d9a20`(2026-08-13, 이 PR)까지 TypeORM 의
    `[rows, rowCount]` 튜플 때문에 **항상 참**이었다. 즉 이 CHANGELOG 항목이 묘사하는
    "0행/`affected===0` 이면 skip" 분기는 그 항목이 커밋된 시점부터 이 PR 이 고치기 전까지
    **한 번도 실제로 타지 않았다.** 정확히 같은 결론이 `plan/in-progress/
    retry-turn-terminal-guard.md`(`⚠ 소급 정정 (2026-08-13)` 배너: *"이 방어는 코드로는
    옳고 프로덕션에서는 한 번도 발동하지 않았다"*)와 `plan/in-progress/
    ie-resume-turn-boundary-cancel.md`(같은 배너)에 이미 명시돼 있고, 그 두 plan 은 이번
    diff 에서 실제로 배너를 받았다. 그러나 이 사실을 **가장 넓게 읽히는** 문서인
    `CHANGELOG.md` 는 건드리지 않았다 — `plan/in-progress/update-returning-tuple-shape.md`
    §후속의 `[planner 위임]` 소급 각주 목록(spec 문서 5건)에도 `CHANGELOG.md` 는 포함돼
    있지 않다(파일 15, "추가 위임" 표 참조). "같은 결함을 그 자리만 고치고 전파 안 함"
    이라는 이 PR 자신이 진단한 패턴이 여기서도 반복된 형태다.
  - 참고: 같은 CHANGELOG 섹션의 항목 3(`:316`, park 짝 전이/`linkedNodeExec` 분기)은
    `lockNonTerminalExecutionRow`(SELECT `FOR UPDATE`)와 `manager.save()` 를 쓰지 raw
    `UPDATE … RETURNING` 을 쓰지 않으므로 **이 버그의 영향을 받지 않는다** — 소스
    (`execution-engine.service.ts:8433-8486`)로 직접 확인했다. 항목 5·6(`:318-319`,
    `finalizeFailedExecution`·`failFirstSegmentSetup`·`executeSync` timeout)은 전부
    `updateExecutionStatus` else 분기를 거치므로 항목 1·7 과 같은 영향권이다 — plan 의
    "영향 있음" 목록(파일 14, `update-returning-tuple-shape.md` §후속 [planner 위임]
    node-cancellation.md 행)과 정확히 일치한다.
  - 제안: `update-returning-tuple-shape.md` §후속의 소급 각주 스윕에 `CHANGELOG.md` 를
    여섯 번째 대상으로 추가하거나(가장 간단히는 해당 4개 bullet 옆에 각주 한 줄: "이 방어는
    `8332d9a20`(2026-08-13) 이전엔 driver shape 버그로 실효되지 않았다 —
    `update-returning-tuple-shape.md` 참조"), 이번 PR 자체의 Unreleased 항목(아래 참고)에
    "과거 항목에 대한 소급 주석" 문단을 포함한다.

- **[INFO]** 이번 결함 수정 자체의 `CHANGELOG.md` Unreleased 항목이 아직 없고, 그 유예
  근거("배포 영향 서술과 함께 써야 의미가 있어 릴리스 시점 판단으로 미뤘다")가 이 파일
  자신의 기존 관행과 어긋난다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md` §후속 `- [ ] CHANGELOG
    Unreleased 항목` (`20_36_35` WARNING 3 유예); `CHANGELOG.md`(이 diff 미포함)
  - 상세: `git log --oneline -3 -- CHANGELOG.md` 로 확인한 결과, 이 파일의 최근 두 항목
    (`6b76a1dfe`, `2a698f360`)은 각각 **해당 기능/수정과 같은 커밋에서** "사용자 영향"
    문단까지 포함해 즉시 작성됐다 — "릴리스 컷 시점에 몰아서 쓴다"는 배치(batch) 관행의
    증거는 이 파일 어디에도 없다. 오히려 plan 문서(파일 15)는 정확히 무엇을 적을지(소셜
    로그인 상시 실패·admission cap 미집행·KB CAS 락 미작동·재큐 `documentId: undefined`)를
    이미 다 알고 있다 — 즉 "필요한 정보가 없어서" 가 아니라 "판단을 릴리스 시점으로
    미룬다"는 근거인데, 그 근거 자체가 이 파일의 실측 관행과 다르다. 직전 라운드
    (`00_00_44` documentation)는 이 유예를 "근거와 함께 추적되고 있어 문제 없음"으로
    수용했으나, 그 판단은 `CHANGELOG.md` 의 커밋 이력(per-PR 작성 패턴)을 대조하지 않은
    채 plan 의 자체 서술만 신뢰한 것이다.
  - 제안: 필수 조치는 아니나(plan 에 등재돼 유실 위험은 낮음), 다음에 이 파일을 만질 때
    "릴리스 시점 판단" 대신 "이 PR 커밋 시점에 작성하지 않은 구체적 이유"를 다시 검토할
    것을 권한다. 위 CRITICAL 급 소급 정정(WARNING 항목)과 묶어 한 번에 작성하면 두 문제를
    동시에 해소한다.

- **[정보/확인]** 신규 e2e(`codebase/backend/test/auth-oauth-callback.e2e-spec.ts`)는
  문서화 품질이 높다 — 재확인.
  - 상세: 파일 최상단 JSDoc 이 "왜 이 파일이 필요한가"(mock 이 코드와 같은 오해를 공유할 수
    있다는 점)와 "무엇을 고정하나"(양방향 관측)를 명시하고, `seedState`/`callback` 헬퍼에도
    존재 이유 주석이 있다. `setGlobalPrefix('api')` 누락 시 전량 실패했던 실제 삽질까지
    인라인 주석으로 남겨(`// setGlobalPrefix('api') — 빠뜨리면 404 라 …`) 다음 사람이 같은
    실수를 반복하지 않도록 했다. 새로 추가된 파일이라 재검증 대상.

- **[정보/확인]** README·API 문서·설정 문서 갱신 대상 없음(재확인).
  - 상세: 이번 diff 는 신규 API 엔드포인트·DTO·환경변수·설정 옵션을 추가하지 않는 순수
    내부 버그 수정이다. `user_guide_sync` 리뷰(`20_36_35`)가 매트릭스 21행 전수 대조로
    이미 동일 결론을 냈고, `git diff --stat origin/main...HEAD -- codebase plan` 재확인
    결과도 컨트롤러·DTO·환경변수·`content/docs/` 변경이 없다.

- **[정보/확인]** 직전 라운드(`00_00_44`)가 남긴 INFO 2건은 그대로 남아 있음(재확인, 신규
  아님) — `knowledge-base.service.ts:727` 의 정의되지 않은 "①" 포워드 레퍼런스,
  `assert-row-array.ts` JSDoc 이 `updateReturningRows` 를 역참조하지 않는 것(3라운드 연속
  유예). 둘 다 기능 영향 없고 이미 "조치 불요/유예 유지"로 명시 판단된 항목이라 이번에도
  조치를 요구하지 않는다.

## 요약

핵심 신규 코드(`update-returning-rows.ts`/`.spec.ts`, 8개 소비 지점 주석, 신규 e2e)의
문서화 품질은 이전 라운드 평가대로 이 저장소 기준으로도 높고, 다섯 차례 documentation
리뷰가 찾은 CRITICAL·WARNING 은 모두 현재 소스에서 해소가 유지됨을 직접 재확인했다. 이번
라운드의 신규 발견은 PR 범위 밖의 문서에 있다 — `CHANGELOG.md` 의 기존 두 항목(`:279-283`,
`:321`)이 이 PR 이 반증한 "guarded UPDATE 0행 skip" 방어를 이미 검증된 동작처럼 서술하는데,
그 방어는 `1657c0435`~`8332d9a20` 사이 프로덕션에서 한 번도 발동하지 않았다. 같은 사실에
대해 plan 문서 3건(`retry-turn-terminal-guard.md`·`ie-resume-turn-boundary-cancel.md`·
`exec-intake-followups.md`)과 spec 소급 각주 5건은 이미 명시적으로 정정/등재됐지만,
가장 넓게 읽히는 `CHANGELOG.md` 는 그 스윕에서 빠졌다 — 이 PR 이 스스로 진단한 "처방이
그 자리에만 갇힌다"는 패턴의 재현이다. 기능적 결함이 아니라 문서 정확성 문제이며 이 PR 을
막을 근거는 아니지만, 다음 소급 정정 스윕에 포함할 가치가 있다.

## 위험도

LOW
