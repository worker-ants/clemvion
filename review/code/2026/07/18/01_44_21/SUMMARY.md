# 코드 리뷰 SUMMARY — webchat-boot-single-flight (01_44_21)

`sessionEstablished()` 재설계(`cffee0d28`)에 대한 검증 라운드.

- **범위**: `git merge-base origin/main HEAD`(=`29aa918a6`)`..HEAD` — 53파일. scope 가 3-dot=2-dot 대조로 오염 0 확인.
- **실행 리뷰어**: 8명 (forced 7 + concurrency). `agents_forced` 전원 커버.
- **위험도**: **MEDIUM** — 이중 EventSource 생성(5인 관측, severity 조정 MEDIUM), 처리 완료.

## 핵심 검증 — 재설계는 원래 3개 결함을 다 고친다 (concurrency·requirement)

- **no-op 재전송 고착(00_51_53 CRITICAL) 해소** 확인.
- **되감기 2건(23_58_23 start · 18_39_11 applyConfig) 여전히 차단** — mutation: sessionEstablished 게이트
  제거 → 정확히 2건만 실패. 오히려 세 호출부가 하나의 무조건 기본 가드를 공유해 **비대칭 자체가
  설계적으로 사라졌다**(requirement).
- replay_unavailable opt-in / 종료 확정 게이트 우회 / spec 정합 — 전부 확인.

## 이중 EventSource 생성 (5인 관측 — severity 조정)

| 리뷰어 | 판정 | 요지 |
| --- | --- | --- |
| testing | HIGH | `esCount=2` 로 "원천 차단" 불변식 반증 |
| side_effect | CRITICAL | boot축 코드는 `esCount=1`, 재설계가 도입한 회귀 |
| concurrency | **MEDIUM** | 실재하나 `openStream=closeStream→set` 이라 **단일 스트림으로 수렴**, 창 매우 좁음(1 microtask). fix(openStream 직전 게이트) 직접 적용해 394/394 확인 |
| requirement | LOW/INFO | 낭비성 close→reopen, idempotent, 무해 |

**조정: MEDIUM.** 근본은 `await seedWaitingFromStatus` 와 호출부 `openStream` 사이의 **microtask 경계** —
겹친 두 seed 가 같은 flush 에서 resolve 하면 둘 다 seed 시점엔 스트림 미열림을 보고 통과한 뒤 각자
`openStream` 을 부른다. 내 초기 JSDoc "seed 반환 직후 동기 실행이라 원천 차단" 은 그 경계를 간과한
오판(11번째 거울상). 다만 openStream 이 closeStream→set 이라 **최종 상태는 단일 스트림**(둘째가 열 때
첫째 닫힘) — correctness 버그가 아니라 낭비성 생성. 그래도 불변식이 거짓이라 fix.

**fix**(`77805bd32`): `start()`·`applyConfig` 의 `openStream` **직전**에 `if (sessionEstablished()) return;` —
seed 게이트(표면 되감기)와 짝을 이루는 스트림 게이트(이중 생성). checkpoint 2(isAttemptStale, boot 축)는
applyConfig-vs-applyConfig 만 잡고 start() 겹침은 못 잡으므로 필요. mutation: 게이트 제거 → double-stream
테스트만 실패.

## Warning (전부 처리 — 문서/주석)

| 리뷰어 | 발견 | 처리 |
| --- | --- | --- |
| documentation | 18_39_11 C2 테스트 주석 2곳이 seed 게이트를 아직 "boot 축/checkpoint 2" 로 서술 | ✅ sessionEstablished 로 정정 |
| maintainability | `beginBootAttempt` JSDoc "비대칭 3번" 카운트 stale + 00_51_53 RESOLUTION 의 "해소" 거짓 주장 | ✅ 카운트 정정(4번째=start), 00_51_53 RESOLUTION audit-trail 정정 |
| scope | payload 에 재설계 코드 diff 누락(크기 제한) | ⏸ 알려진 payload 한계 — 리뷰어들이 git show 로 보완, 코드 이슈 아님 |

## 검증 (fix 후)

tsc 통과 · **393 passed**(22 파일, double-stream 재현 +1). JSDoc 전수 부착.
mutation: 게이트 제거 → double-stream 테스트만 실패. 전체 스택은 RESOLUTION 참조.

**주의**: 이 라운드가 MEDIUM(이중 스트림)을 냈고 fix 로 코드가 다시 바뀌었다. openStream 게이트 fix
(`77805bd32`)는 **다음 라운드에서 검증**한다 — 단, concurrency 가 이번에 그 fix 를 직접 적용해 394/394
무회귀를 이미 확인했다.
</content>
