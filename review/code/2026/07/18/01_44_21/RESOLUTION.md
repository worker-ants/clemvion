# RESOLUTION — 01_44_21

리뷰어 8명 완료. 이중 EventSource 생성(MEDIUM, 5인 관측) 재현 후 fix. WARNING 전부 처리.
남은 미해결 Critical/Warning 없음.

## 처리 커밋

| 커밋 | 내용 |
| --- | --- |
| `77805bd32` | 이중 EventSource — seed 게이트의 짝(openStream 직전 게이트) 추가 + JSDoc 오판 정정 |
| `0020f9106` | 재설계 후 stale 해진 boot 축 주석 정리(테스트 2곳 + 카운트) |

## 이중 EventSource 생성 (MEDIUM)

**fix.** testing·side_effect·concurrency 3인이 재현(concurrency 가 내 제안 fix 를 직접 적용해 394/394
확인). 나도 double-stream 재현 테스트(`두 복원 seed 가 같은 flush 에서 resolve 해도 EventSource 는 하나만
생성된다`)로 재확인 — 현재 코드 esCount=2, fix 후 1.

- **근본**: `await seedWaitingFromStatus` 와 호출부 `openStream` 사이 microtask 경계. 겹친 두 seed 가 같은
  flush 에서 resolve → 둘 다 seed 시점 스트림 미열림 통과 → 각자 openStream. 내 초기 JSDoc "동기 실행이라
  원천 차단" 오판(11번째 거울상).
- **severity 조정**: openStream=closeStream→set 이라 단일 스트림으로 수렴(concurrency MEDIUM, requirement
  harmless). correctness 아닌 낭비성 생성. 그래도 불변식 거짓이라 fix.
- **fix**: openStream 직전 `if (sessionEstablished()) return;`(seed 게이트의 짝). 반대 구멍 점검 —
  고착(아무도 안 열면 통과)·되감기(seed 가 stale 반환)·정상(단일 boot) 전부 무영향. mutation 으로 고정.

## WARNING

- **테스트 주석 stale**(documentation) → **fix**. 18_39_11 C2 테스트 2곳을 sessionEstablished 로 정정
  (checkpoint 1 config 적용·isAttemptStale·종료 확정 서술은 여전히 정확해 미변경).
- **`beginBootAttempt` 카운트 stale + 거짓 주장**(maintainability) → **fix**. 카운트를 "3번" → 4번째
  (start 무방비)로 정정 + 재설계가 비대칭을 구조적으로 없앴음 명시. `00_51_53/RESOLUTION.md` 의 "전면
  재작성으로 해소" 거짓 주장도 정정(실제론 그 문단을 안 건드렸음).
- **payload 코드 diff 누락**(scope) → **이월(알려진 한계)**. 리뷰어들이 git show 로 보완, 코드 이슈 아님.

## 검증 (fix 후, 최종 코드 `0020f9106`)

- tsc: **통과**
- vitest(channel-web-chat): **393 passed**(22 파일) — double-stream 재현 +1
- JSDoc 전수 부착
- mutation: openStream 게이트 2곳 제거 → double-stream 테스트만 실패(esCount=2)
- lint/unit/build/e2e: 아래 [검증 갱신]

## [검증 갱신] — TEST WORKFLOW (fix 후)

- lint: **PASS** (59s)
- unit: **PASS** (63s) — backend 8225 · frontend **5576 passed**(280파일) · channel-web-chat **393 passed**(22파일)
- build: **PASS** (137s)
- e2e: **통과** (310s) — 로그 확인: backend jest `256 passed` + playwright `Running 51 tests` → **`51 passed (1.4m)`**.

## 다음 라운드

이 라운드가 MEDIUM 을 냈고 fix 로 코드가 바뀌었다 → openStream 게이트 fix 를 대상으로 한 새 라운드가
push 전 필요(코드 게이트 재무장). 단 concurrency 가 이번에 그 fix 를 직접 적용해 394/394 를 확인했으므로
수렴 라운드가 될 것으로 본다. 이 자리의 결함 등급이 CRITICAL→CRITICAL→MEDIUM 으로 하강 중이고,
불변식이 이제 구조적으로 완결됐다(seed 게이트=표면 / openStream 게이트=스트림 / 종료=world).
</content>
