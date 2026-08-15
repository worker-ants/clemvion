STATUS=success

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (7차 라운드, `11_44_10`)

## 방법론 노트

이 PR 은 이미 6회의 ai-review 라운드(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`→`11_09_44`→
`11_29_02`)를 거쳤고, 그 각각의 `documentation.md`/RESOLUTION 을 `Read`로 직접 열어 무엇이
지적·조치됐는지 재구성했다. 직전 라운드(`11_29_02`) 이후의 마지막 커밋(`f5c609aa8`)을
`git show`로 별도 확인해 **이번에 처음 리뷰되는 변경분**에 집중했고, 이미 여러 라운드가
"조치 완료"로 닫은 항목은 실제 소스에서 재확인만 하고 중복 보고하지 않았다. 프롬프트에서
diff 가 생략된 파일(`terminal-duration.ts`, `terminal-duration.spec.ts`,
`spec-sync-external-interaction-api-gaps.md`, `eia-terminal-payload.md` 등)은 `Read`로 직접
열어 대조했다.

그 결과, 6라운드가 놓친 **신규 결함 1건(WARNING)** 과 **신규 확인 1건(WARNING)** 을 찾았다 —
둘 다 "같은 사실을 두 곳에 적었는데 한쪽만 고쳤다"는, 이 세션이 코드 레벨(자매 함수 미적용)
에서 반복해 온 패턴이 **주석/plan 레벨**에서 재현된 것이다.

## 발견사항

- **[WARNING]** `terminal-duration.ts` 자신의 아키텍처 설명이 방금 정정된 숫자와 다시 어긋난다
  — `emitCancellationEvent` 호출부를 "4곳"이라 적었는데 실측은 5곳
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:20`
    (`* - \`emitCancellationEvent\` 호출부 4곳은 계산도 영속도 하지 않는다`)
  - 상세: 바로 이 PR 의 마지막 커밋(`f5c609aa8`, `11_29_02` W4 조치)이
    `execution-engine.service.ts:1107`의 JSDoc(`emitCancellationEvent`의 `durationMs` 파라미터
    설명)을 "호출부 4곳"→"호출부 **5곳**"으로 정정했다(`git show f5c609aa8` 로 diff 직접
    확인 — 커밋 메시지: *"W4 — 직전 라운드에서 JSDoc 을 정정하며 '호출부 4곳' 이라 썼는데
    실측은 5곳이다. 정정하는 문장에서 또 잘못 셌다."*). 실제로 `grep -n
    "emitCancellationEvent("` 로 정의부(`:1101`)를 제외한 호출부를 세면 `:1077`, `:1210`,
    `:2860`, `:2909`, `:4886` **5곳**이다(`markQueueWaitTimeout`·`markExecutionCancelled`·
    `cancelParkedExecution`·`markWebChatIdleTimeout`·`driveCallStackResume` 각 1곳).
    그런데 **같은 사실을 설명하는 `terminal-duration.ts` 자신의 "왜 헬퍼인가" 절**(16 경로를
    세 갈래로 나누는 목록)은 아직 "4곳"에 머물러 있다 — `f5c609aa8` 는 정정을
    `execution-engine.service.ts` 쪽 JSDoc 에만 적용하고, 같은 사실을 서술하는 이 파일의
    문장은 건드리지 않았다. 두 자리가 같은 숫자를 다르게 말하는, 이 PR 이미 두 차례
    지적당한 "자매 문서 미적용" 패턴의 세 번째 재발이며, 하필 이 파일은 6라운드 내내 "이
    저장소에서 가장 잘 문서화된 파일"로 지목돼 온 자리라 신뢰도 손상이 더 크다.
  - 제안: `- \`emitCancellationEvent\` 호출부 4곳은` → `5곳은` 한 단어 정정. 비용은 거의
    0이지만, 다음 사람이 이 파일의 아키텍처 설명만 보고 "cancel 경로는 4갈래"로 잘못 이해한
    채 새 취소 경로를 추가하면 또 하나가 계산·영속 갈래 분류에서 누락될 수 있다.

- **[WARNING]** 완료 표시(`[x]`)된 plan 항목의 본문이 절반만 취소선 처리돼, "완료"와
  "미완료 상태 서술"이 같은 불릿 안에서 충돌한다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:22-30`
    (`- [x] **\`durationMs\` emit** — **완료 (2026-08-15, ...)**.` 불릿 전체)
  - 상세: 이 항목은 `[x]`로 체크되고 첫 문장이 "**완료**"라고 명시한다. 그런데 바로 이어지는
    본문(:24-27)은 `git log -p`로 대조한 결과 이 항목이 아직 미착수 상태였을 때 쓰인 원래
    문구가 **그대로 남아** 있다 — 유일하게 취소선(`~~...~~`)이 걸린 부분은 괄호 시작
    `(§6 도입부 필드 집합 표의 Planned 2행,` 하나뿐이고, 바로 다음 문장 *"2026-08-13 등재)
    — 데이터는 emit **직전에 이미 존재**하는데 payload 에 넣지 않는다"*, *"전부 `{ status }`
    만 싣는다"* 는 취소선 없이 현재형 그대로다. 그리고 :28-30 은 *"spec 이 없는 필드를
    약속하던 상태를 정리하며... 문서 쪽을 실제에 맞췄고, 이 항목은 그 반대 방향(구현을
    문서에 맞추기)의 잔여분이다. **구현되면** 필드 집합 표의 '미구현 (Planned)' 를
    '구현됨' 으로 **flip 한다**"* 라는 미래형으로 끝난다 — 그런데 이 flip 은 이미
    `0dce2a83f`("durationMs Planned 해제")에서 완료됐다(§6 표는 실제로 "구현됨"으로 바뀌어
    있음, `spec-draft-eia-notification-payload-contract.md:108` 도 동일하게 이미
    "구현됨"). 체크박스만 보지 않고 본문을 읽는 다음 편집자는 "아직 payload 에 안
    실린다"·"아직 flip 전이다"로 오독할 소지가 있다.
  - 이 저장소 자신의 컨벤션(`10_18_38` documentation 라운드가 확인한 "Planned 캐비엇을
    삭제하지 않고 취소선+'(해소)'로 보존")과 비교하면, spec 문서(`14-external-interaction-api.md`)
    쪽은 그 컨벤션을 온전히 따랐지만(§6.5 blockquote 는 전체가 "(해소)" 로 마감됨), 이 plan
    파일의 이 불릿만 취소선이 괄호 시작 3어절에서 멈춰 나머지가 표류한 상태다.
  - 제안: :25-27 의 잔여 원문도 취소선 처리하거나 "(해소 — 아래 재판정 참조)" 식으로 닫고,
    :28-30 의 "구현되면 flip 한다"를 "flip 했다(§6 표 참조)"로 과거형 정정. 순수 문서 정정,
    런타임 영향 없음.

## 그 외 확인 결과 (기존에 이미 알려진 비차단 잔여 — 재확인만, 신규 조치 요구 아님)

- **[INFO]** `plan/in-progress/eia-terminal-payload.md:275`(`## 차단 해제 조건`)이 이미 풀린
  BLOCK 상태를 여전히 현재형으로 서술 — `09_00_27` consistency, `10_52_08`·`11_09_44`·
  `11_29_02` documentation 네 라운드가 각각 지적하고 매번 "급하지 않음(비차단)"으로 처분한
  항목이다. 이번 라운드까지도 정정되지 않았다. 재차단 사유 아님 — 5번째 재확인 기록.
- **[INFO]** `types.ts` 의 `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 앞 5줄
  설명 주석 3중 복제(`:392-396`,`:415-419`,`:433-437`) — `10_18_38` maintainability,
  `10_34_51`·`10_52_08`·`11_09_44`·`11_29_02` documentation 라운드가 반복 확인한 drift
  표면. 이번 라운드도 세 곳 모두 동일 문구 유지를 재확인(실제 drift 없음). 강제 조치 아님.
- **[INFO]** `chat-channel.dispatcher.spec.ts:372`의 "CHANGELOG 가 breaking 으로 고지한
  계약"이라는 주석 문구가 CHANGELOG 본문의 "제거·변경 아님" 서술과 표현상 어긋난다
  (`10_52_08` 라운드가 이미 지적, 비차단 처분 유지 — 필드 추가는 좁은 의미에서
  breaking(수신자가 null 방어 필요)이라는 CHANGELOG 자신의 명시와 모순은 아님).

## 그 외 확인 결과 (문제 없음)

- **CHANGELOG**: `f5c609aa8`(W2)가 "취소 UPDATE 실패"로 좁았던 영향 범위 서술을 "JS·SQL
  두 경로 모두... 취소뿐 아니라 정상 완료도 대상"으로 정확히 확장했음을 확인. REST
  비대칭 고지도 유지.
- **JSDoc 배치**: `11_29_02` WARNING(orphan JSDoc — `PG_INT4_MAX` 삽입으로
  `resolveTerminalDurationMs` 문서가 함수에서 분리)이 `f5c609aa8`(W3)로 재배치돼 해소됐음을
  `Read`로 직접 확인(`terminal-duration.ts:1-36` 순서: `PG_INT4_MAX` JSDoc+선언 →
  `resolveTerminalDurationMs` JSDoc+함수 선언).
- **테스트 제목 정확도**: `11_09_44` W5(`"NaN/Infinity"` 제목인데 NaN 만 실행)가
  `terminal-duration.spec.ts:81-92`에서 `it.each([['NaN',...],['Infinity',...]])`로 실제
  분리 실행되게 정정됐음을 확인.
- **mock-실경로 정합**: `11_29_02` W5(`markWebChatIdleTimeout` emit 단언이 `expect.any(Number)`
  라 mock 미배선을 못 잡았을 것)가 `f5c609aa8`에서 mock 에 `duration_ms` 실값을 채우고
  정확 매칭으로 고정됐음을 `execution-engine.service.spec.ts` diff 로 확인.
- **README/설정 문서**: 신규 환경변수·CLI 플래그·설정 옵션 없음 — README 갱신 불필요
  (7개 라운드 동일 결론).
- **예제 코드**: EIA §6.3/§6.4 JSON 예제에 `"durationMs": 4242`가 정확히 반영되고 파싱
  가능함(여러 라운드가 `json.loads`/CommonMark 렌더로 검증) — 이번 라운드는 재변경 없음을
  확인.

## 요약

7라운드째, 이 PR 의 문서화 수준은 여전히 이 저장소 평균을 크게 웃돈다 — CHANGELOG·spec·
plan 트래커·JSDoc 이 촘촘히 상호 인용되며 수렴해 왔다. 다만 마지막 두 커밋
(`2c9b490fd`→`f5c609aa8`)이 "같은 숫자를 두 곳에 적어 놓고 한쪽만 고친다"는, 이 PR 이 코드
방어(int4 클램프)와 정규식 스코프에서 이미 두 차례 겪은 실수의 세 번째 변주를 주석
레벨에서 만들었다 — `emitCancellationEvent` 호출부 개수가 `execution-engine.service.ts` 의
JSDoc(방금 5로 정정됨)과 그 사실을 설명하는 `terminal-duration.ts` 자신의 "왜 헬퍼인가"
절(여전히 4) 사이에서 갈린다. 두 번째 발견은 `spec-sync-external-interaction-api-gaps.md` 의
`durationMs emit` 항목이 `[x]`로 체크됐음에도 본문 절반이 미완료 상태를 현재형·미래형으로
서술해 남아 있는 것으로, 이 저장소 자신의 "취소선+(해소) 보존" 컨벤션을 절반만 따른
결과다. 둘 다 런타임 동작에 영향 없는 순수 문서 결함이고 수정 비용은 낮지만, 전자는 다음
편집자가 취소 경로 개수를 오인할 실질적 위험이 있어 WARNING 으로 판정한다. 그 외 잔여
발견은 전부 과거 라운드가 이미 실측·처분(대부분 명시적 비차단 결정)한 INFO 항목의
재확인이며, CRITICAL 은 없다.

## 위험도

LOW
