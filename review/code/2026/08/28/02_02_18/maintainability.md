# 유지보수성(Maintainability) 리뷰 — `system-error-banner` (02_02_18)

## 스코프 메모

이 diff 는 이미 두 차례 `/ai-review` (`01_26_11`, `01_44_22`) 를 거치며 유지보수성 관점의
발견사항이 전량 반영·해소됐거나 명시적으로(사유 기록과 함께) 유예된 상태다. `codebase/frontend/src/lib/websocket/use-execution-events.ts`,
`__tests__/use-execution-events.test.ts`, `CHANGELOG.md`, `plan/in-progress/system-error-banner-live-ws.md` 를
직접 `Read` 로 열어 현재 파일 상태와 diff 를 대조했다. `review/code/2026/08/28/01_26_11/*`,
`01_44_22/*` (RESOLUTION.md·SUMMARY.md·meta.json·`_retry_state.json`·개별 reviewer 산출물)는
harness 가 생성한 리뷰 프로세스 산출물(prose 리포트 + 상태 JSON)이라 가독성/네이밍/함수
길이 등 코드 품질 지표 적용 대상이 아니므로 이번 리뷰에서는 제외한다.

## 발견사항

### 이미 식별·유예된 항목 (신규 아님 — 재확인만)

다음 세 항목은 `01_26_11`/`01_44_22` RESOLUTION.md 에서 이미 지적되고, 근거와 함께
의도적으로 유예된 상태다. 현재 코드에서도 동일하게 존재함을 확인했으나 **새 발견사항이
아니며**, 유예 사유가 여전히 타당하다고 판단한다.

- **[INFO]** `handleNodeCompleted`/`handleNodeFailed` 의 errorPayload 추출→`retryable`/`retryAfterSec`
  계산→`addConversationMessage` 블록이 거의 동일하게 ~20줄 중복
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:807-835`(`handleNodeCompleted`) vs `:904-931`(`handleNodeFailed`)
  - 상세: diff 이전부터 존재하던 중복이며, 이번 PR 은 두 호출부의 `extractNodeErrorPayload` 인자만 교정했다. `01_44_22` RESOLUTION #3 에서 추출을 검토했으나 두 핸들러가 `duration`/`status` 처리 등 **다른 차이**를 갖고 있어 무리한 추출이 오히려 그 차이를 흐릴 수 있다는 이유로 범위 밖 판정, 리뷰어도 동의했다.
  - 제안: 현 판정 유지. 이 블록을 다시 건드릴 일이 생기면(예: 세 번째 호출부 추가) 그때 `extractSystemErrorItemArgs(errorPayload, payload)` 류 헬퍼로 추출 재검토.

- **[INFO]** `extractNodeErrorPayload` 본문의 `asRecord(asRecord(domain)?.error)` 이중 언래핑 밀도
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:89-90`
  - 상세: 7줄짜리 함수치고 JSDoc(26줄, `:58-83`)이 훨씬 길다. `01_44_22` RESOLUTION #4·#6 에서 동일 지적이 있었고, "중간 이름을 더 주면 `domain` 변수가 하나 늘어 오히려 읽기 부담이 커진다" + "이 결함이 문서 문구(spec §4.1)에서 비롯됐으므로 포스트모템을 함수 바로 위에 두는 값이 크다"는 사유로 유예, 리뷰어 동의 기록됨.
  - 제안: 현 판정 유지.

- **[INFO]** `handleNodeFailed` 의 인라인 payload 타입이 `error?: string | {code,message,details}` 로 객체 형태를 여전히 허용
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:855-861`
  - 상세: `extractNodeErrorPayload` JSDoc(`:77-79`)은 "객체 `error` 를 받던 분기는 지웠다 — 남겨 두면 다음 사람이 '객체로 보내면 되겠네'로 읽는다"고 명시하는데, 같은 파일의 이 타입 선언은 여전히 객체 형태를 허용해 미묘한 긴장이 있다. 다만 이는 `errorMessage`(status 텍스트) 계산만을 위한 방어적 타이핑이고, `01_44_22` RESOLUTION #5 가 "공유 `NodeHandlerOutput` 타입 부재가 근본 원인이고 이 결함과 직교한 별건"으로 유예한 항목과 같은 뿌리다.
  - 제안: 현 판정 유지. 공유 타입 도입 시(별도 작업) 함께 정리.

### 신규 발견사항

없음. `handleNodeCompleted`/`handleNodeFailed` 호출부 교정, `asRecord` 헬퍼 도입, `wrapNodeHandlerOutput`
테스트 빌더(8개 호출부 전수 통과 확인), 신규 가드/캐너리 테스트 4건 모두 네이밍이 목적을
명확히 드러내고(`asRecord`, `wrapNodeHandlerOutput`, `[가드]`/`[캐너리]` 접두 테스트명), 함수
길이·중첩 깊이·순환 복잡도 모두 이 파일의 기존 핸들러 패턴과 일관된 범위 안에 있다.
`CHANGELOG.md`·plan 문서의 서술도 기존 항목들과 스타일이 일관된다.

## 요약

이번 라운드(02_02_18)의 diff 는 이전 두 리뷰 라운드에서 발견된 유지보수성 이슈(JSDoc-함수
분리, fixture 5곳 손복제, `direct` 커버리지 0 방어)가 모두 반영된 사후 상태다. `asRecord` 헬퍼로
중첩 접근을 읽을 만하게 낮췄고, `wrapNodeHandlerOutput` 빌더가 "fixture 가 production shape 을
못 따라가 결함을 가렸다"는 근본 원인을 재생산하지 않도록 단일 지점화했으며(뮤테이션 M3 로
검증됨), 신규 가드/캐너리 테스트는 이름만으로 의도가 드러난다. 남은 항목(핸들러 간 ~20줄
중복, 이중 언래핑 밀도, payload 타입의 객체-형태 잔존)은 전부 사유와 함께 두 차례
공식적으로 유예된 것으로, 재차 WARNING 으로 격상할 근거가 새로 생기지 않았다. 전체적으로
가독성·네이밍·복잡도·일관성 기준에서 이 diff 는 양호하다.

## 위험도
NONE
