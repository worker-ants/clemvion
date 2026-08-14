# RESOLUTION — `14_30_35` (+ consistency `14_30_36`)

ai-review **CRITICAL 1 / WARNING 7**, consistency **BLOCK: YES (CRITICAL 2)**.
두 게이트가 **독립적으로 같은 CRITICAL** 에 수렴했다. 전부 조치.

## CRITICAL — 같은 함수 안에서 출구를 하나만 막았다 (세 번째 재발)

`getStatus` 의 `nodeOutput`(waiting)만 strip 을 받고 형제 출구인 terminal
`result`/`error` 는 `deepRedactSecrets` 단독이었다.

리뷰어들의 판단이 갈렸다 — architecture/requirement 는 *"`toEngineFlatShape` 가 `.meta` 를
드롭하니 구조적으로 안전"* 이라 낮춰 잡았고, testing 은 **직접 실행해 재현**했다.
consistency 도 CRITICAL 로 독립 판정했다.

**실행으로 갈랐다.** `outputData.meta.turnDebug[].llmCalls[].requestPayload` 를 담아
`getStatus` 를 태우니 `result` 와 `error` **양쪽 다** 마커가 그대로 실렸다. "구조적으로
안전" 은 이 계층의 보장이 아니라 **문서화되지 않은 상류 전제**다 — 전제가 참이든 아니든
같은 함수 안에서 방어가 비대칭이면 다음 사람이 그 구조를 바꾸는 순간 조용히 열린다.

### 처방 — 출구를 각자 조립하지 못하게 만든다

세 출구를 한 헬퍼 `redactAndStrip` 으로 묶었다. **이게 핵심이다** — 이 결함이 세 라운드에
걸쳐 반복된 이유가 "출구가 각자 조립돼 한 번에 하나씩만 고쳐진다" 였다.

뮤테이션으로 확인: 헬퍼에서 strip 을 빼면 **3건 전부 RED**(waiting 1 + terminal 2).

## W1 (성능) — 버릴 데이터에 비싼 연산을 선지불했다

**조치 완료.** `deepRedactSecrets`(정규식 다중 패스 + JSON 파싱)를 먼저 돌리고 그 결과에서
`llmCalls` 서브트리를 통째로 버리고 있었다. 순서를 뒤집었다.

"순서 무관" 은 내 주장이므로 **대조 테스트로 고정**했다. 그 테스트가 곧바로 내 다른 실수를
잡았다 — 마스킹 토큰을 `[REDACTED]` 로 단언했는데 `deepRedactSecrets` 는 `***` 를 쓴다
(`[REDACTED]` 는 WS 쪽 sanitizer). 두 sanitizer 의 토큰이 다르다는 걸 몰랐다.

## W3 (아키텍처) — 계약 문구가 거짓이었다

**조치 완료.** JSDoc 이 *"호출부는 자매와 같은 값·**같은 경계 연산자**를 쓴다"* 고 적었는데,
REST 호출부의 자매 `deepRedactSecrets` 는 `>=` 다 — **계약이 지켜지지 않는 채 문서만 그렇게
말하고 있었다.**

실제 성질로 다시 썼다: 연산자는 이 함수가 `>` 로 **고정**하고, 자매가 `>=` 로 한 단계 먼저
멈추더라도 그 경계에서 서브트리를 non-object 로 collapse 하므로 도달해도 볼 것이 없다.
안전의 근거는 "연산자가 같다" 가 아니라 **"자매가 그 깊이에서 이미 객체를 없앤다"** 다.

## W2 (문서) — 공유 유틸로 옮기며 실측 근거가 유실됐다

**조치 완료.** 직전 라운드가 실측까지 남긴 "왜 두 pass 를 합치지 않는가"(0.0112→0.0314ms,
2.80배)와 순환 참조 근거가 이관되지 않았다. 하필 그 시점에 **두 번째 호출자(REST)가 같은
트레이드오프를 지게 됐는데** 문서가 비어 있었다. 새 파일 JSDoc 으로 옮겼다.

## W4 (아키텍처/테스트) — 승격한 유틸에 자기 spec 이 없었다

**조치 완료.** 회귀 보증이 소비처 한 곳의 describe 블록에만 얹혀 있었다 — 자매
`sanitize-error-message.ts` 는 자기 spec 을 갖는데 어긋났다.

`strip-external-only-fields.spec.ts` 신설(10건): 참조 동일성·비변형·깊이 경계·`__proto__`
안전(객체/배열 양쪽)·**다원소 배열 부분 clone**(직전 라운드 유예 항목)·순서 동일성.

## W5 (문서) — CHANGELOG 가 fanout 만 기록

**조치 완료.** 제목에 REST 를 넣고 절을 추가했다. 세 출구가 모두 열려 있었다는 사실과,
"출구를 각자 조립하면 한 번에 하나씩만 고쳐진다" 는 재발 원인을 적었다.

## W6 (테스트/문서) — **네 번째 재발**

**조치 완료.** 내가 추가한 테스트 JSDoc 이 (a) `stripDeep` 을 옛 파일로 가리키고
(같은 커밋이 옮겼는데) (b) 고쳐진 동작을 현재형으로 서술했다.

리뷰어가 *"개별 수정보다 프로세스 문제로 재발 중"* 이라 짚었고 맞다. 원인은 일정하다 —
**조사하며 JSDoc 을 쓰면 그 시점 상태는 옛 상태**이고, 코드를 고친 뒤 다시 읽지 않는다.
이번 라운드부터 커밋 직전에 이번 diff 가 건드린 JSDoc 을 훑는 것을 절차로 넣는다.

## W7 (SPEC-DRIFT) — planner 인계 등재

§R17 이 `getStatus` 를 "secret-shape 만 치환" 으로 서술해 실제 방어보다 좁다. 코드가 spec 을
앞질렀다. draft 의 (7)번에 **세 출구 전부 적용** 사실과 함께 등재했다.

## consistency `14_30_36` 추가 조치

- **형제 plan 반증 각주** — 커밋 `34e32e62f` 가 *"이 작업의 일부로 포함한다"* 고 약속해
  놓고 **파일을 안 고쳤다**(0줄). 이번에 실제로 달았다. 커밋 메시지의 약속이 사실보다
  앞선 것이라 특히 나쁘다
- §R17·WS §4.4 확장을 planner 항목에 명시

## 검증

- 누출 프로브 3건(waiting·result·error) RED → 수정 후 GREEN, 뮤테이션으로 판별력 확인
- 신규 유틸 spec 10건, 그중 순서 동일성 테스트가 내 토큰 오단언을 잡음
- 전체 백엔드 **423 suites / 8650 passed** · lint(`--max-warnings 0`) · ratchet 199/38

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| ai INFO 1·2·3 (응답 shape 변경·시그니처 승격·비변형) | 의도된 변경이고 문서·테스트로 고정됨 |
| ai INFO 4 (스코프) | 이번 델타는 직전 CRITICAL 처방 + 그 후속 |
| consistency INFO 1·3 (CHANGELOG 세부) | W5 로 해소 |
| consistency INFO 2 (spec frontmatter `code:` 에 신규 유틸 미등재) | glob 커버리지로 CI 위반 아님. planner 턴에서 §R17 갱신과 함께 |
| REST 경로 depth sweep 테스트 | fanout 쪽 sweep 이 유틸 계약을 덮고, 신규 유틸 spec 이 `maxDepth` 경계를 직접 본다. 소비처마다 sweep 을 복제하는 것은 중복 |
