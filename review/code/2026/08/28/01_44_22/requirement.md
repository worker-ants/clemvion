STATUS=success requirement review complete — 1 WARNING, 0 CRITICAL
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — `system_error` 배너 라이브 WS 경로 복구

## 발견사항

- **[WARNING]** 새로 추가된 캐너리 테스트 설명 주석이 **같은 커밋 안의 CT-S9/S10 정정을 반영하지 않아 자기모순**이다
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2186`
  - 상세: "[캐너리] 문자열 error + 래퍼 output 조합에서 배너가 뜬다" 테스트 바로 위 JSDoc 이 *"위 CT-S9/S10 은 `error` 를 **객체**로 보내므로 `direct` 분기로 통과한다. 즉 그 케이스들만으로는 이 회귀를 못 잡는다"* 라고 적고 있다. 그러나 같은 diff 에서 CT-S9(2013행: `error: "Anthropic API returned 429 (Too Many Requests)"`)와 CT-S10(2055행: `error: "401 unauthorized"`)은 이미 **문자열**로 정정됐고, `extractNodeErrorPayload` 의 `direct` 분기 자체가 `use-execution-events.ts` 에서 완전히 **삭제**됐다(RESOLUTION.md W4 확인, `grep -n "direct\b"` 결과 이 주석 한 줄만 남음). 즉 이 설명은 이 PR 이전(fixture 정정 전) 상태를 서술하는데, 정작 그 정정도 같은 PR 이 하고 있어 파일 안에서 위·아래가 서로 다른 사실을 주장한다.
  - 제안: 주석을 *"CT-S9/S10 도 이제 문자열 `error`+래퍼 `output` 조합을 쓰지만, 프로덕션과 달리 `nodeExecutionId`/`details` 등 CT 고유 필드 검증에 집중해 이 조합 자체가 회귀를 가릴 위험까지는 문지 않는다"* 류로 갱신하거나, 이미 CT-S9/S10 이 production shape 을 쓰므로 이 캐너리가 여전히 필요한 이유(예: retry 배지 없이 최소 조합만으로 배너 발생을 독립 검증)를 정확히 재서술한다. 이 프로젝트가 최근 이틀 연속 "한 겹 얕은 주석"류 결함을 반복 지적받은 이력(RESOLUTION.md 자체가 인용하는 `19_36_17` W1)을 감안하면, 이 잔여 stale 서술도 같은 클래스로 다음 사람을 오도할 수 있다.

## 점검 요약 (문제 없음 확인 항목)

- **핵심 결함 수정 검증**: `extractNodeErrorPayload(rawOutput)` 이 `rawOutput.output.error` (래퍼 한 겹 통과)를 읽도록 수정됐고, `handleNodeFailed`/`handleNodeCompleted` 양쪽 호출부 모두 `payload.output` 을 전달하도록 수정됨 — `codebase/frontend/src/lib/websocket/use-execution-events.ts:89-91,813,909`. `pnpm vitest run` 로 해당 스위트 87/87 통과, `tsc --noEmit` 클린 확인(직접 실행).
- **spec 일치 (line-level)**: `spec/5-system/6-websocket-protocol.md` §4.1-a(239-262행)의 "`error` 는 문자열이다", "구조화 객체는 `output.output.error`", "`output` 은 error-port 종결·AI turn 종결 2곳만 동봉, pre-flight throw·container 실패 2곳은 키 자체 없음" 서술이 코드 주석·구현과 정확히 일치. `spec/conventions/node-output.md` Principle 0(20-47행)의 "wire `output`/`nodeOutput` 은 래퍼 전체, 도메인 값은 한 겹 아래"도 `asRecord` 이중 언랩과 일치. spec 자체가 2026-08-24 이미 정정된 상태이고 코드가 그 정정을 뒤늦게 따라잡는 구도 — **SPEC-DRIFT 아님**(spec 이 권위, 코드가 틀렸다가 지금 고쳐짐).
- **엣지 케이스**: `asRecord`(object 이되 배열 아님, null 배제)와 이중 `asRecord` 체이닝이 `rawOutput` 이 `undefined`/`null`/문자열/배열인 모든 경우 `null` 로 안전 수렴 — 새 캐너리("`output` 미동봉 경로…")로 실증.
- **관련 파일(비-diff) 교차 확인**: `lib/conversation/conversation-utils.ts` 의 `parseHistoryMessages` 는 이미 같은 래퍼 depth 를 올바르게 언랩하고 있어(644-651행) 이번 수정과 일관 — 별도 결함 없음.
- **회귀 방지 리팩터(`wrapNodeHandlerOutput`)**: fixture 5곳이 단일 빌더를 통과하도록 리팩터됐고 RESOLUTION.md 의 뮤테이션 실측(M3: 래퍼 벗김 → 4 failed)이 빌더가 실제 단일 지점임을 뒷받침.
- **TODO/FIXME/HACK/XXX**: 변경 파일 내 없음.
- **`direct` 분기 삭제의 파급 확인**: `extractNodeErrorPayload` 는 export 되지 않고 호출부 2곳(813, 909행)만 존재 — 시그니처 변경에 따른 dangling 호출부 없음.

## 요약

라이브 WS 경로에서 `system_error` 재시도 배너가 한 번도 뜨지 않던 CRITICAL 결함(정정 전 spec 문구를 코드가 그대로 믿고 있던 것)을 정정된 spec §4.1-a·node-output.md Principle 0 에 맞춰 정확히 고쳤다. 헬퍼 시그니처 축소(`rawError` 파라미터 제거), 두 호출부(`handleNodeFailed`/`handleNodeCompleted`) 동반 수정, fixture 를 production shape(문자열 `error` + 래퍼 `output`)으로 정정, 신규 캐너리 2건(배너 발생·`output` 미동봉 시 미발생) 모두 spec 본문과 line-level 로 일치하며 87/87 테스트·`tsc` 클린으로 확인했다. 유일한 흠은 새로 추가된 한 캐너리 테스트 설명 주석이 같은 diff 안에서 이미 정정된 CT-S9/S10 fixture 상태(및 삭제된 `direct` 분기)를 여전히 옛 상태로 서술하는 자기모순 — 기능에는 영향 없으나 이 프로젝트가 반복 지적받아 온 "한 겹 얕은 서술" 클래스와 같은 성격이라 정정을 권한다.

## 위험도
LOW
