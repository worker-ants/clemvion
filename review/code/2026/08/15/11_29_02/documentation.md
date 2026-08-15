# 문서화(Documentation) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (6차 라운드, `11_29_02`)

## 방법론 노트

이 PR 은 이미 5회의 ai-review 라운드(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`→`11_09_44`)와
4회의 consistency-check 라운드를 거쳤다. 각 라운드의 `documentation.md` 를 전부 직접 열어
(`Read`) 무엇이 지적·조치됐는지 재구성했고, 조치 완료로 기록된 항목은 실제 소스에서
**재확인만**(중복 보고 안 함) 했다:

- W(`09_58_24`) `types.ts`/`chat-channel-adapter.md` nullable 미반영·CHANGELOG 누락 → 현재
  `durationMs?: number | null` + CHANGELOG 항목 존재, 해소 확인.
- W(`10_18_38`) `GREATEST(0,…)` stale 주석·plan 4 vs 5 수치 불일치 → 둘 다 현재 소스에서 정정
  확인(`grep -rn "GREATEST(0"` 결과 프로덕션 코드 0건, plan 은 "4곳"으로 통일).
- W(`10_34_51`) §6.5 blockquote 가 무관 disclaimer 를 흡수 → 현재 독립 문단으로 분리 확인.
- W(`11_09_44`) `emitCancellationEvent` JSDoc "생략한다" 오기술 / §6.5 대기-시간 캐비엇이
  `EXECUTION_QUEUE_WAIT_TIMEOUT` 하나만 명명 → 둘 다 정정 확인(호출부 JSDoc 갱신, §6.5 캐비엇이
  이제 park 취소·위젯 idle 회수까지 3곳 모두 명명).

직전 라운드(`11_09_44`) RESOLUTION 이 적용된 마지막 커밋(`2c9b490fd`, CRITICAL int4 JS 클램프
추가)의 diff 를 `git show` 로 별도 확인해, **이번 라운드에서 처음 리뷰되는 변경분**에 집중했다.
그 결과 신규 결함 1건(WARNING)을 발견했다 — 바로 그 커밋이 만든 것이다.

## 발견사항

- **[WARNING] `resolveTerminalDurationMs` 의 JSDoc 이 그 함수가 아니라 `PG_INT4_MAX` 상수
  뒤로 밀려, 표준 JSDoc 도구(IDE hover·TypeDoc)에서 함수 쪽 문서가 사라진다**
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:1-36` (`Read` 로 실제 파일을
    직접 열어 확인 — 이 파일은 신규 파일이라 프롬프트 diff 게이트 번호와 실제 줄 번호가
    1:1 로 일치한다)
  - 상세: 1~27행은 "왜 헬퍼인가"(16 emit 경로, 값 출처 갈림)·"`startedAt` 을 낙관하지
    않는다"(이 브랜치가 실제로 겪은 회귀 — 조건 밖으로 옮긴 계산이 throw 해 종결 emit 자체가
    사라졌던 사건)·`@returns 밀리초. 알 수 없으면 null — undefined 는 안 된다` 는 정확히
    `resolveTerminalDurationMs()` 자신을 설명하는 내용이다(`@returns` 태그가 그 증거).
    그런데 27행 `*/` 바로 다음(28행)에 **또 다른 JSDoc 블록**(`PG_INT4_MAX` 설명, 29~33행)이
    시작되고, 그 블록이 34행 `export const PG_INT4_MAX = 2147483647;` 앞에 온다. 함수
    선언(`export function resolveTerminalDurationMs(...)`)은 그 뒤 36행에 나오는데, 바로 앞
    줄(35행)은 빈 줄이고 그 앞(34행)은 **코드**(`export const PG_INT4_MAX = ...;`)다 — 즉
    함수 바로 위에는 주석이 **하나도 없다**.

    `git log -p` 로 origin/main 대비 확인한 결과, 이 배치는 최신 커밋
    `2c9b490fd`("고쳤다고 선언한 결함이 절반 경로에 남아 있었다 — JS 클램프 누락")가
    `PG_INT4_MAX` 를 새로 추출하며 그 JSDoc 을 **1~27행과 원래 함수 선언 사이**에 끼워 넣어
    생긴 것이다(`git show 2c9b490fd -- .../terminal-duration.ts` 로 diff 확인). 이 커밋
    이전에는 1~27행 블록이 함수 바로 위에 붙어 있어 정상이었다.

    TS 언어 서버/VSCode hover·TypeDoc 류 도구는 선언 바로 앞에 **연속으로 붙은 마지막 주석
    블록**만 그 선언의 문서로 채택한다. 그 결과:
    - `PG_INT4_MAX` 를 hover 하면 29~33행("duration_ms 컬럼의 최댓값…")만 보인다 — 의도대로.
    - `resolveTerminalDurationMs` 를 hover 하면 **아무 JSDoc 도 뜨지 않는다** — 1~27행은 그
      사이에 다른 주석 블록이 끼어 있어 함수의 leading comment 로 인식되지 않는다.

    이 파일은 이 세션의 6개 리뷰 라운드가 반복해서 "이 저장소 평균을 웃도는 최고 수준
    JSDoc" 으로 지목한 바로 그 파일이고, 사라진 내용(16 경로 열거·과거 회귀 재현 경로·
    `null` vs `undefined` 선택 근거)이 바로 그 칭찬의 근거였다. 파일을 위에서 아래로
    통독하면(이 리뷰처럼) 내용은 여전히 읽히지만, IDE 에서 `resolveTerminalDurationMs` 호출부
    위에 마우스를 올려 계약을 확인하려는 다음 편집자에게는 그 문서가 보이지 않는다 — 정확히
    이 함수가 "값을 모르면 `null`, `undefined` 를 쓰면 안 되는 이유" 라는, 이 PR 전체가
    반복해서 강조해 온 불변식을 담고 있는 자리라서 더 아프다.
  - 제안: 28~33행(`PG_INT4_MAX` JSDoc)을 34행 `export const PG_INT4_MAX` 바로 위로 유지하되,
    1~27행 블록을 그 **뒤**(36행 함수 선언 바로 위)로 옮긴다. 즉 파일 순서를
    `PG_INT4_MAX` JSDoc + 선언 → `resolveTerminalDurationMs` JSDoc + 함수 선언 으로 재배치하면
    두 JSDoc 이 각각 자신이 설명하는 대상 바로 위에 다시 붙는다. 코드 로직은 전혀 바뀌지
    않는 순수 주석 이동이다.

## 그 외 확인 결과 (기존에 이미 알려진 비차단 잔여 — 재열거만, 신규 조치 요구 아님)

- **[INFO]** `plan/in-progress/eia-terminal-payload.md:275`(`## 차단 해제 조건`)이 이미 풀린
  BLOCK 상태를 여전히 현재형으로 서술 — `09_00_27` consistency, `10_52_08`·`11_09_44`
  documentation 세 라운드가 각각 지적하고 매번 "급하지 않음(비차단)" 으로 처분한 항목이다.
  이번 라운드까지도 한 줄 캐비엇("(해소됨 — 아래 체크리스트 참조)")이 반영되지 않았다.
  재차단 사유 아님 — 4번째 재확인 기록.
- **[INFO]** `chat-channel.dispatcher.spec.ts:372`의 "CHANGELOG 가 breaking 으로 고지한
  계약" 이라는 주석 문구가 CHANGELOG 본문 자신의 "제거·변경 아님" 서술과 어긋난다
  (`10_52_08` 라운드가 이미 지적, 비차단 처분 유지).
- **[INFO]** `types.ts` 의 `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 앞 5줄
  설명 주석 3중 복제(`:392-396`,`:415-419`,`:433-437`) — `10_18_38` maintainability, `10_34_51`·
  `10_52_08`·`11_09_44` documentation 라운드가 반복 확인한 drift 표면. 지금까지 실제 drift 는
  없었다(세 곳 모두 동일 문구 유지 확인). 강제 조치 아님.
- **[INFO]** REST §5.3(`GET /api/external/executions/:id`) JSON 예제에 `durationMs` 부재를
  알리는 인라인 주석이 없다(`result.outputs` 등 다른 Planned 필드는 그 자리에서
  self-documenting 하는 이 문서의 관례와 다름) — `10_34_51` 라운드가 이미 지적, RESOLUTION
  이 "CHANGELOG + 트래커 등재로 처리 범위를 좁힌다" 고 명시적으로 결정한 사안이라 재차단
  사유 아님.

## 그 외 확인 결과 (문제 없음)

- **CHANGELOG**: 직전 항목의 예고를 정확히 이어받고, 필드 추가 성격(제거·변경 아님)·`null`
  방어 필요성·REST 비대칭을 명시적으로 고지. 5라운드에 걸쳐 검증된 상태 유지.
- **JSDoc 품질(위 WARNING 제외)**: `toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`/
  `TERMINAL_FINISHED_AT_PARAM` 은 각각 자신의 선언 바로 위에 정상 부착돼 있고 근거(pg 드라이버
  bigint→string, int4 클램프 필요성, saturate-대-fail 트레이드오프)가 상세하다.
- **타입-스펙 정합**: `types.ts`/`chat-channel-adapter.md` 인라인 union 모두
  `durationMs?: number | null` 로 일치, `dispatcher.ts` 캐스트 3곳도 동일 타입.
- **예제 코드**: EIA §6.3/§6.4 JSON 예제에 `"durationMs": 4242` 가 정확히 반영되고 실제로
  파싱 가능함(여러 라운드가 `json.loads`/CommonMark 렌더로 검증).
- **README/설정 문서**: 신규 환경변수·CLI 플래그·설정 옵션 없음 — README 갱신 불필요(6개
  라운드 동일 결론).
- **인라인 주석 정확성**: `execution-engine.service.ts`/`retry-turn.service.ts` 의
  `resolveTerminalDurationMs(...) ?? x.durationMs` 폴백 관용구 주석, `finalizeStalledExhausted`
  호출부의 SQL 클램프 설명 등은 현재 동작과 일치(과거 stale 주석은 모두 정정 확인됨).

## 요약

5라운드를 거치며 이 저장소 평균을 크게 웃도는 수준으로 수렴했던 문서화 상태에, 가장 최근
커밋(`2c9b490fd`, CRITICAL 클램프 누락 수정)이 새로운 결함 1건을 만들었다 — `terminal-duration.ts`
의 핵심 함수 `resolveTerminalDurationMs` 의 JSDoc(이 파일에서 가장 많이 칭찬받은 문서 블록)이
새로 추출된 `PG_INT4_MAX` 상수의 JSDoc 에 밀려 함수 선언에서 분리됐다 — `git show` 로 확인한
결과 이 커밋이 직접 만든 것이며, 5차례 리뷰 어디에서도 아직 지적되지 않은 신규 발견이다.
파일을 통독하면 내용은 여전히 읽히지만, IDE hover·TypeDoc 등 표준 JSDoc 도구는 함수 쪽에서
아무 문서도 보여주지 못한다 — 순수 주석 재배치로 해결되는 낮은 비용의 수정이지만, 하필
"`null` vs `undefined`" 라는 이 PR 전체의 핵심 계약을 담은 자리라 WARNING 으로 판정한다.
그 외 잔여 발견은 전부 과거 라운드가 이미 실측·처분(대부분 명시적 비차단 결정)한 INFO 항목의
재확인이며, CRITICAL 은 없다.

## 위험도

MEDIUM
