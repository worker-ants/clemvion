# 코드 리뷰 SUMMARY — webchat-boot-single-flight (00_51_53)

직전(`23_58_23`)의 `start()` boot 스냅샷 fix(`7cfbf2557`)에 대한 후속 검증 라운드.

- **범위**: `git merge-base origin/main HEAD`(=`29aa918a6`)`..HEAD` — 41파일. scope·requirement 가
  3-dot=2-dot 대조로 오염 0 확인.
- **실행 리뷰어**: 8명 (forced 7 + concurrency). `agents_forced` 전원 커버.
- **위험도**: **CRITICAL** — 신규 CRITICAL 1건(3인 독립 재현), 처리 완료.

## Critical (신규) — 내 직전 fix 가 만든 반대 구멍

| 리뷰어 | 발견 | 재현 | 처리 |
| --- | --- | --- | --- |
| **requirement · testing · side_effect** (3인 독립) | `7cfbf2557` 의 start() boot 스냅샷이 **아무것도 복원 못 하는 no-op 재전송**을 "내가 대체됐다" 로 오판 — webhook in-flight(persist 전) 창에 재전송이 끼면 start() 가 WAITING·openStream 을 둘 다 스킵해 **스피너에 영구 고착**(esCount=0) | ✅ 3인 모두 실제 코드 A/B(fix 되돌리면 정상) | ✅ boot 축 → `sessionEstablished()` 재설계(`cffee0d28`) |

세 리뷰어가 **각자 독립**으로 재현. 도달 조건이 원 되감기 결함보다 **더 넓다** — 재전송이 아무것도
못 찾는(가장 흔한) 경우에 발생하고, persist 전 창이 persist 후 창보다 먼저 열린다.

**이 클래스의 10번째 거울상.** boot 세대 비교는 "더 최신 재전송이 이 세션을 **실제로 넘겨받았나**" 의
proxy 였고 두 번 깨졌다(18_39_11: 함수 경계에서 안 닿음 / 00_51_53: no-op 재전송). 진짜 불변식은
**`sessionEstablished()`("스트림이 이미 열렸나")** — 열린 순간부터 SSE 가 표면의 단일 진실이니 지연
seed 는 스킵, 안 열렸으면(no-op 재전송 포함) 이 seed 가 그린다. `replay_unavailable` 폴백만
`allowWhileStreaming` opt-in(자기 스트림 재동기화). (`pendingResetRef` 때 "폐기 로직 통째 제거" 와
같은 "진짜 불변식으로 단순화".)

## Warning (전부 처리)

| 리뷰어 | 발견 | 처리 |
| --- | --- | --- |
| documentation | 테스트 주석이 되돌려진 C1 메커니즘 서술(18_39_11 RESOLUTION 이 "fix" 표시했으나 CHANGELOG 만 고침) | ✅ 실제 동작으로 재작성(직전 라운드 `a2cd6ebb7`) |
| documentation | plan 서술 "일어난 적 없는 단계"(§106→§3 39건) + 깨진 `§후속-2` 자기참조 | ✅ 실제 2단계로 정정, 참조 교정 |
| documentation | CHANGELOG 가 start() 되감기 fix(가장 심각한 고착) 누락 | ✅ 최종 메커니즘으로 항목 3 재작성 |
| maintainability | `beginBootAttempt` JSDoc 거울상 카운트 stale | ✅ 재설계에서 JSDoc 전면 재작성(카운트 서술 제거) |
| maintainability | `useEiaSession` 이월 산문 매몰 위험 | ✅ 별도 plan `webchat-usewidget-extraction.md` 분리 |
| testing | esCount 단언이 특정 mutation 의 "첫 실패 지점" 아님 | ⏸ INFO — 진단 편의 이슈, 단언 자체는 유의미(mutation 으로 확인) |
| security·scope·concurrency | 각각 LOW/NONE, 차단 사유 없음 | — |

## 검증된 것 (그러나 재설계로 대체)

- **concurrency(NONE)** 는 `7cfbf2557`(boot 스냅샷)을 "유효, 반대 구멍 없음" 으로 판정했으나 —
  BLOCKED·`!apiBase` 두 파생만 실측하고 **"허용되고 config 재적용되지만 복원할 게 없는"** 세 번째
  조합(= 이 CRITICAL)은 시험하지 않았다(requirement 가 지적). 그 조합이 정확히 고착을 낸다.
  concurrency 의 반대-구멍 분석(종료 확정 무영향 등)은 재설계(sessionEstablished)에서도 유효하다.

## 검증 (재설계 후)

tsc 통과 · **392 passed**(22 파일, 고착 재현 테스트 +1).
mutation 양방향: 게이트 제거 → 되감기 2건 실패(applyConfig+start) / opt-in 제거 → replay 재동기화 실패.
전체 스택(lint/unit/build/e2e)은 RESOLUTION 참조.

**주의**: 이 라운드가 CRITICAL 을 냈고 재설계로 코드가 다시 바뀌었으므로, 이 산출물은 **재설계 이전
코드**에 대한 리뷰다. 재설계(`cffee0d28`)는 **다음 라운드에서 검증**한다.
</content>
