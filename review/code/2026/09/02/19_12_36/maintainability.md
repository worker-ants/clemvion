# 유지보수성(Maintainability) 리뷰 — `auth.token_expired` 소켓 수명 종속 (4라운드)

## 검토 방법 및 범위

이번 diff 는 `review/code/2026/09/02/{17_38_12,18_18_53,18_45_43}/**`·`review/consistency/**`
산출물(프로세스 로그, 애플리케이션 코드 아님)을 대량 포함한다 — 앞선 세 라운드가 동일 근거로
제외했고 이번 라운드도 그 판단을 유지한다. 실제 코드 대상은 `websocket-events.types.{ts,spec.ts}`·
`websocket.gateway.{ts,spec.ts}`·`ws-client.ts`·`ws-client.test.ts`·문서 2건(`password-and-sessions.*`)이다.

3라운드(`18_45_43`) 이후 실질 diff는 `e5b683d75`(`fix(ws): 리뷰 3R`) 하나뿐이고, 백엔드
(`websocket.gateway.ts`)는 이번 커밋에서 건드리지 않았다(`git show e5b683d75 --stat` 로 확인 —
변경 파일은 `ws-client.ts`·`ws-client.test.ts`·리뷰 아티팩트뿐). 따라서 이번 라운드는 (1) 3R
커밋이 실제로 무엇을 고쳤는지 소스 대조로 검증하고, (2) 4라운드 연속 이월된 INFO 3건을 재확인하는
데 집중했다.

## 발견사항

- **[WARNING]** 3R 커밋 메시지가 "정리했다"고 주장한 이중 빈 줄이 실제로는 그대로 남아 있다 — 4라운드 연속 지적 + 최초로 등장한 "고쳤다"는 명시적 오기재
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:131-132` (`§6.1 예외). 이 두 경로가 없으면 사용자는 조용히 연결을 잃는다.` 줄과 `// 정상 경로 — 통지 창(60초) 안에 갈아탄다.` 줄 사이)
  - 상세: 커밋 `e5b683d75`(`fix(ws): 리뷰 3R`)의 메시지는 "세 번 지적된 이중 빈 줄도 정리했다"고
    명시한다. 그런데 현재 파일을 직접 열어 확인하면 (`grep -n "^$"`) 131·132번 줄이 여전히
    연속 빈 줄이다. `git blame -L 124,136`으로 대조하면 131번 줄은 `a9316a0a64`(1R), 132번
    줄은 `b019d7de33`(최초 구현) 소유로, **3R 커밋(`e5b683d75`)이 이 구간을 전혀 건드리지
    않았다** — `git show e5b683d75 -- ws-client.ts`의 diff 헝크에 이 줄들이 컨텍스트로만
    등장하고 `+`/`-` 표시가 없다. 즉 "정리했다"는 서술과 실제 diff 가 어긋난다. 이 지적은
    17_38_12(INFO, 최초 발견) → 18_18_53(INFO, "2R 이후에도 미정리") → 18_45_43(INFO, "이월·
    이미 2회 명시적 보류") → 3R 커밋 메시지("정리했다")를 거쳐 이번(4R) 재확인에서 **여전히
    미정리**임이 드러난 것으로, 단순 서식 흠결(가독성/일관성, 관점 1·8)보다 "고쳤다"는 기록이
    실측과 어긋난다는 점이 더 무겁다 — 다음 사람이 커밋 로그를 믿고 이 항목을 닫힌 것으로
    간주하면, 실제로는 아무도 다시 보지 않는 잔여물로 영구히 남는다.
  - 제안: 빈 줄 하나를 제거해 다른 이벤트 핸들러 사이 간격(빈 줄 1개)과 통일한다. 사소하므로
    병합을 막을 사유는 아니지만, 다음 커밋에서 "정리했다"고 다시 쓰기 전에 `git diff`로 실제
    변경 여부를 확인할 것 — 이번처럼 컨텍스트 줄과 실제 diff 를 혼동하면 같은 오기재가 반복된다.

- **[INFO]** (이월·4라운드째 동일 판단) `expiryTimers`/`armExpiryTimers` 타이머 페어 타입이 여전히 optional — 실제 불변식(항상 쌍으로 존재)이 타입에 드러나지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153`(`expiryTimers` 필드), `:192`(`armExpiryTimers` 내 `timers` 지역 변수)
  - 상세: 이번 라운드에 백엔드 파일은 변경되지 않았으므로 상태는 3R 리뷰 시점과 동일함을
    재확인했다. `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }` 가 두 자리에 리터럴
    중복되고, `handleDisconnect`(`:287-289`)의 `if (timers.notice) …`/`if (timers.cutoff) …`
    는 여전히 항상 참인 방어적 optional-check 다. 1R부터 3회 "취향 범위"로 명시 보류됐고
    새 근거가 없어 이번에도 판단을 바꾸지 않는다.
  - 제안: 변화 없음 — `type ExpiryTimerPair = { notice: NodeJS.Timeout; cutoff: NodeJS.Timeout };` non-optional 화는 여전히 선택 사항.

- **[INFO]** (이월·4라운드째 동일 판단) wire 메시지 문자열이 파일의 기존 "wire 상수 승격" 관례를 따르지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:195` (`message: 'Access token expires soon — refresh and reconnect.'`)
  - 상세: `MSG_NOT_AUTHENTICATED`/`MSG_NOT_AUTHORIZED_EXECUTION` 관례와 달리 인라인 리터럴로
    남아 있음을 재확인. 2R 이후 "취향 범위"로 보류된 상태 그대로.
  - 제안: 변화 없음.

## 3R 신규 diff 검토 — 의도대로 해소됨

- **cross-generation race 가드**(`ws-client.ts:68,74`) — `const mySocket = socket` 스냅샷 +
  `socket !== mySocket` 비교 두 장치를 각각의 역할(새 소켓 보호 / 옛 소켓 부활 차단)이 분명하게
  드러나는 주석과 함께 추가했다. 로직은 단일 조기 반환(`if (!newToken || !mySocket || socket
  !== mySocket) return;`)으로 단순하며 중첩을 늘리지 않았다.
- **들여쓰기 정정** — 18_45_43 라운드가 WARNING으로 지적한 "`try/catch` 가 `const run = (async
  () => {` 의 형제처럼 보이는" 문제를 직접 재확인했다. 현재 `try`(72번 줄 상당)는 `run` 대비
  한 단 더 들여써져 있고 `catch`/닫는 `}`/`})();` 도 실제 중첩과 일치한다 — **실제로 고쳐졌다**
  (앞선 이중 빈 줄 건과 달리 이 WARNING 은 diff 로 검증 가능했고 정확히 반영됨).
  `codebase/frontend/src/lib/websocket/ws-client.ts:70-90`.
- **promise 반환** — 세 핸들러(`connect_error`·`auth.token_expired`·`disconnect`)가 `void`
  대신 `return refreshAndReconnect(...)` 로 바뀌어, 테스트가 실제 작업 완료를 `await` 할 수
  있게 됐다. socket.io 콜백은 반환값을 무시하므로 런타임 동작 변화 없이 테스트 신뢰도만
  높인 변경.
- **신규 테스트 2건**(`ws-client.test.ts` "가드는 완료 후 초기화된다" · "옛 세대의 재발급은 새
  소켓을 건드리지 않는다")은 각각 단일 관심사에 집중하고, 기존 `handlerFor` 헬퍼·주석 톤을
  일관되게 따른다.

## 요약

4라운드 누적 검토 결과, 핵심 유지보수성 이슈(1R 중복 로직, 3R 들여쓰기 오독)는 실제로 해소됐음을
소스 대조로 확인했다. 다만 이번 라운드에서 새로 발견한 것은 코드 자체의 결함이 아니라 **"고쳤다"는
기록이 실제 diff 와 어긋난 사례**다 — 3R 커밋 메시지가 "세 번 지적된 이중 빈 줄도 정리했다"고
썼지만, 해당 줄은 이 커밋의 diff 헝크에 전혀 등장하지 않고 현재도 그대로 남아 있다. 항목 자체는
동작에 영향 없는 순수 서식 문제이지만, 4라운드 연속 같은 지적이 반복되고 그 중 한 번은 "고쳤다"는
잘못된 기록까지 남겼다는 점에서 WARNING 으로 올린다. 그 외 이월 INFO 2건(타이머 타입 optional·
wire 메시지 미상수화)은 이전 라운드들이 이미 "취향 범위"로 판단했고 이번 라운드에서 판단을 바꿀
근거가 없어 그대로 유지한다. 함수 길이·중첩 깊이·순환 복잡도·네이밍·매직 넘버·코드베이스 스타일
일관성은 4라운드 내내 양호한 상태를 유지하고 있다.

## 위험도

LOW
