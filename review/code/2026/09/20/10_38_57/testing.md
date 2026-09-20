# 테스트(Testing) 리뷰 — SSRF 가드 소비자 넷의 catch 판정 분기 (머지 후 3라운드)

## 검증 방법

- 실제 대상 5개 spec 스위트를 병합된 코드 그대로 실행: `database-connection-tester.spec.ts` ·
  `http-connection-tester.spec.ts` · `database-query.handler.spec.ts` · `http-redirect.spec.ts` ·
  `http-request.handler.spec.ts` — `Test Suites: 5 passed / Tests: 210 passed` (GREEN 재현).
- 1·2라운드 RESOLUTION 이 "고침" 이라 표시한 항목을 실제 소스에서 직접 대조: W2(타임아웃 신호를 preflight
  뒤로), W5(스파이 `try`/`finally` 복구), W4(DB 핸들러 `const detail` 중복 제거), W2-2라운드(홉 검사 가드
  고장의 `toLogError` 마스킹) — 전부 코드에 반영된 것을 확인.
- 뮤테이션 3건(저장소 밖 `mktemp` 대신 `cp` 로 원본을 scratch 에 백업 → 수정 → 대상 스펙만 실행 → `cp` 로
  원복 → `git status --short` 로 clean 확인, 매 건 개별 Bash 호출로 분리):
  1. `http-request.handler.ts:560` `const message = toLogError(err).message;` → `err instanceof Error ? err.message : String(err);` 로 되돌림(2라운드 W2 되돌리기) — **`http-request.handler.spec.ts` 75/75 전부 그대로 PASS (생존)**.
  2. `database-query.handler.ts` `if (!(err instanceof SsrfBlockedError))` → `if (true)` — 대상 스펙 RED(기대대로 죽음).
  3. `http-redirect.ts` `outboundBlockReason` 의 `if (err instanceof SsrfBlockedError) return err.message; throw err;` → 무조건 `return err.message`(구버전 동작) — `http-redirect.spec.ts` RED(기대대로 죽음).
  - 원복 확인: 세 건 모두 `cp` 직후 `git status --short` 무출력.

## 발견사항

- **[WARNING]** 2라운드 W2 수정("리다이렉트 홉 가드 고장도 마스킹")이 회귀 테스트 없이 병합됐고, 실측상 어떤 기존 테스트도 이 변경을 판별하지 못한다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:560` (`const message = toLogError(err).message;`), 대비되는 커버리지 공백은 `codebase/backend/src/nodes/integration/http-request/http-redirect.spec.ts:47-55`(`it('판정 아닌 오류는 사유로 삼키지 않고 그대로 던진다', ...)`) — 이 테스트는 `outboundBlockReason` 을 **직접** 호출할 뿐, `followRedirectsSafely` 루프(2번째 이후 홉)를 거쳐 이 예외가 `http-request.handler.ts` 의 전송 `catch` 로 떨어지는 경로는 어떤 spec 파일에도 없다(`grep -rn "followRedirectsSafely" --include="*.spec.ts"` 0건).
  - 상세: 커밋 `fff0d14bf` 는 이 줄을 `err.message` 원문에서 `toLogError(err).message`(= `sanitizeMessage` 경유)로 바꿔 "홉 검사 중 가드가 낸 판정 아닌 오류의 원문이 그대로 노출되던 것"을 고쳤다고 주장한다(RESOLUTION W2). 그런데 그 커밋의 diff stat 은 `http-request.handler.ts` 를 포함해 5개 파일을 바꾸면서 spec 파일은 `http-connection-tester.spec.ts`(별개 항목 W5) 하나만 건드렸다 — 이 특정 마스킹 동작에 대한 신규/기존 테스트가 전혀 추가되지 않았다. 위 뮤테이션 1건이 이를 실증한다: 마스킹을 되돌려도(= 마스킹 이전 상태로 복원) `http-request.handler.spec.ts` 의 75개 테스트가 **전부 그대로 통과**한다. 기존 `'logs HTTP transport failure with HTTP_TRANSPORT_FAILED'` 테스트(같은 catch 를 지나는 유일한 테스트, `http-request.handler.spec.ts:1295` 부근, 이번 diff 밖 기존 코드)는 `error.code` 만 단언하고 `message` 값은 검사하지 않아 이 변경을 판별할 수 없다. 더 근본적으로, `sanitizeMessage` 는 자격증명 패턴(`password=`·`Bearer …`·32자+ opaque 문자열)만 치환하고 오늘 가드가 실제로 낼 수 있는 유일한 비판정 오류(`TypeError: hostname.toLowerCase is not a function`)에는 그 패턴이 없다 — 즉 지금 이 코드 경로에 대해 "마스킹 전/후 출력이 다르다"를 관측 가능하게 만드는 입력 자체가 현재 트리거 목록에 없어서, 나중에 이 지점에 테스트를 추가하더라도 자격증명류 문구를 담은 인위적 오류를 주입해야만 판별력이 생긴다.
  - 제안: `http-redirect.spec.ts` 또는 `http-request.handler.spec.ts` 에 "두 번째 이상 홉에서 가드가 판정 아닌 오류(가급적 시크릿 패턴을 포함한 메시지)를 던지면 `HTTP_TRANSPORT_FAILED` 의 `message` 가 마스킹된 값이다"를 직접 단언하는 케이스 1건을 추가. `followRedirectsSafely` 를 302 응답 뒤 두 번째 `outboundBlockReason` 호출에서 실패시키는 구조로 구성 가능(1라운드 testing.md 가 이미 이 지점을 INFO 로 짚었으나 2라운드에서 바로 그 지점에 미검증 동작 변경이 들어왔으므로 WARNING 으로 격상해 재기재).

- **[INFO]** 위 갭과 같은 결의 이웃 — `http-connection-tester.ts` 의 홉-검사 가드 고장 경로도 여전히 미검증(기존 추적 항목, 신규 아님)
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` 의 `catch (err)` 블록(약 139-151행, `message: clampMessage(describeFailure(err))`), 신규 테스트는 `codebase/backend/src/modules/integrations/http-connection-tester.spec.ts:273-286`(`it('가드가 판정 아닌 오류를 던지면 HTTP_BLOCKED 가 아니라 HTTP_CONNECT_FAILED — 던지지 않는다', ...)`) 하나뿐이고 이는 **첫** preflight(`mockedUrlGuard`)만 실패시킨다.
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이미 "`http-connection-tester.ts` 의 `describeFailure`→`clampMessage` 경로 — 이 PR 이 만든 자리가 아니라 그대로 뒀다"로 등재했으므로 새 결함은 아니다. 다만 이 파일 역시 preflight 와 홉 검사가 **같은 `try` 블록**을 공유해(파일 4 diff 참고) 첫 preflight 테스트 하나로는 홉-단계 실패가 같은 코드를 타는지 실측하지 못한다 — 재확인 차원에서 기재.
  - 제안: 조치 불요(이미 트래커에 등재). 위 WARNING 항목의 테스트를 추가할 때 같이 커버하면 이 INFO 도 함께 해소된다.

## 확인된 양호 사항 (참고)

- 핵심 판정 분기 넷(HTTP 노드 preflight · `outboundBlockReason` · DB 핸들러 preflight · DB 연결 테스터) 은 뮤테이션으로 직접 재확인했다 — `database-query.handler.ts` 의 `instanceof SsrfBlockedError` 조건과 `http-redirect.ts` 의 `outboundBlockReason` 분기를 각각 되돌리자 대응 스펙이 정확히 RED, 원복 후 clean.
- Mock 격리: `database-connection-tester.spec.ts`(`beforeEach` 에서 `mockedGuard.mockResolvedValue(undefined)` 매번 재설정) · `database-query.handler.spec.ts`(`mockRejectedValueOnce` 로 1회성 주입, 기본 구현이 `jest.requireActual` 실물이라 다음 테스트로 새지 않음) · `http-connection-tester.spec.ts`(`jest.clearAllMocks()` + `timeoutSpy` 는 2라운드 이후 `try`/`finally` 로 복구) 모두 실제 코드를 열어 확인했고 문제 없음.
- `SsrfBlockedError` 생성자의 실제 메시지 포맷(`SSRF_BLOCKED: ${detail}`, `http-safety.ts:49`)이 `http-redirect.spec.ts` 의 문자열 단언과 정확히 일치.
- 신규 테스트들의 assertion 은 `code`·`message` 내용과 부수효과(`connectMock`/`fetchMock`/`timeoutSpy` 미호출, `logUsage` 인자)까지 구체적으로 검증해 대부분 vacuous 위험이 낮다 — 단 위 WARNING 이 지적하는 한 지점(홉-레벨 마스킹)만 예외.

## 요약

핵심 판정 분기(가드의 「차단」 vs 「고장」을 가르는 `instanceof SsrfBlockedError`) 넷은 뮤테이션으로 재확인해도 전부 견고하다 — 여기까지는 세 라운드에 걸쳐 반복 검증됐고 이번에도 그대로 유지된다. 다만 2라운드가 "이 PR 이 만든 비대칭"이라며 새로 고친 홉-레벨 마스킹(`http-request.handler.ts:560` `toLogError(err).message`)은 어떤 스펙 파일도 실행하지 않는 경로다 — 되돌려도 관련 스위트 75건이 전부 그대로 통과한다는 것을 직접 뮤테이션으로 확인했다. 이 코드 변경 자체는 방향이 맞지만(전송 오류 문구에 URL 자격증명이 섞일 수 있으므로 마스킹이 안전 쪽), "왜 필요한지"를 설명하는 근거(홉 검사 가드 고장)를 검증하는 테스트가 하나도 없다는 점에서 회귀 안전망 없이 병합됐다. 1라운드 testing.md 가 INFO 로 남겼던 같은 지점에 2라운드가 바로 그 미검증 동작 변경을 넣었으므로 WARNING 으로 격상해 재기재한다. 나머지는 이미 트래커에 등재된 기존 갭(INFO, `http-connection-tester.ts` 의 병렬 경로)뿐이다.

## 위험도

MEDIUM
