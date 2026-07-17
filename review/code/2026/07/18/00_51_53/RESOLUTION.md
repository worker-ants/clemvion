# RESOLUTION — 00_51_53

리뷰어 8명(forced 7 + concurrency) 완료. 신규 CRITICAL 1건(3인 독립 재현) 실측 재현 후 재설계.
WARNING 전부 처리 또는 근거 있는 이월. 남은 미해결 Critical/Warning 없음.

## 처리 커밋

| 커밋 | 내용 |
| --- | --- |
| `cffee0d28` | CRITICAL — 되감기 방어 boot 축 → `sessionEstablished()` 재설계(no-op 재전송 고착 해소) |
| `<doc>` | 비-코드 WARNING 정합(CHANGELOG 항목3 재작성 · plan 진행기록 · §후속-2 교정) |

## CRITICAL — `start()` no-op 재전송 고착 (requirement·testing·side_effect 3인)

**재설계로 처리.** 세 리뷰어가 각자 실제 코드 A/B 로 재현(fix 되돌리면 정상 동작). 나도 고착 재현
테스트(`webhook in-flight 중 아무것도 복원 못 하는 재전송이 start() 를 스피너에 고착시키지 않는다`)로
재확인 후 재설계.

- **왜 국소 수정으로 안 됐나**: "persist 후 boot 캡처" 같은 국소 수정도 또 다른 interleaving 구멍이
  남는다(재전송의 `beginBootAttempt` 는 persist 전, 복원은 persist 후 → 같은 boot 값). boot 축 자체가
  "재전송이 세션을 실제로 넘겨받았나" 의 불완전한 proxy 라, proxy 를 고치는 국소 수정은 계속 구멍을 낸다.
- **근본 해결**: WAITING 게이트를 `sessionEstablished()`(스트림 열림)로 교체. boot 인자 제거. 이건
  이 클래스에서 `pendingResetRef` 때 "폐기 로직 통째 제거" 와 같은 "진짜 불변식으로 단순화" 다.
- **반대 구멍 점검**(재설계): 종료 확정 분기는 가드 안 탐(world 사실) / replay_unavailable 은
  opt-in 으로 통과(자기 재동기화) / 정상 경로는 스트림 미열림이라 dispatch / 이중 스트림은 openStream
  이 seed 반환 직후 동기 실행이라 원천 차단. mutation 양방향으로 고정(아래).

## WARNING

- **테스트 주석이 되돌려진 C1 메커니즘 서술**(documentation) → **fix**(직전 라운드 `a2cd6ebb7` 에서 이미 정정).
- **plan "일어난 적 없는 단계" + 깨진 `§후속-2`**(documentation) → **fix**. 실제 2단계로 정정, 참조 교정.
- **CHANGELOG start() fix 누락**(documentation) → **fix**. 항목 3 을 최종 메커니즘으로 재작성.
- **`beginBootAttempt` JSDoc 카운트 stale**(maintainability) → **부분 fix (정정)**. 이 라운드에 나는
  `beginBootAttempt` 의 **말미 괄호주**(start() world 축 서술)만 재작성하고, "비대칭 가드 누락 3번"
  카운트 문단(`use-widget.ts:259`)은 **실제로 안 건드렸다** — 위 "전면 재작성" 서술은 과장이었다
  (후속 01_44_21 maintainability 가 audit-trail 로 지적). 그 카운트는 다음 라운드(01_44_21)에서 정정했다.
- **`useEiaSession` 산문 매몰**(maintainability) → **fix**. 별도 plan 분리.
- **esCount 첫-실패-지점**(testing) → **이월(INFO)**. 단언 자체는 mutation 으로 유의미 확인. 진단 편의
  개선(assertion 순서)은 저가치라 미적용.
- **`apiBase` 축 분리**(security 배경) → **이월**. 선행 결함. 재설계가 악화시키지 않음.

## 검증 (재설계 후, 최종 코드 `cffee0d28` + 문서 커밋)

- tsc: **통과**
- vitest(channel-web-chat): **392 passed**(22 파일) — 고착 재현 테스트 +1
- JSDoc 11심볼 전수 부착(`ts.getJSDocCommentsAndTags()`)
- mutation 양방향:
  - 게이트(`sessionEstablished`) 제거 → **되감기 2건 정확히 실패**(applyConfig `대체된 시도의 지연
    getStatus...` + start `start() 의 지연 seed...`)
  - opt-in(`allowWhileStreaming`) 제거(항상 게이트) → **replay 재동기화 테스트 실패**
- plan-frontmatter 가드: 105 passed
- lint/unit/build/e2e: 아래 [검증 갱신]

## [검증 갱신] — TEST WORKFLOW (재설계 후)

- lint: **PASS** (59s)
- unit: **PASS** (62s) — backend 8225 · frontend **5576 passed**(280파일) · channel-web-chat **392 passed**(22파일)
- build: **PASS** (135s)
- e2e: **통과** (305s) — 로그 확인: backend jest `Tests: 256 passed` + playwright `Running 51 tests` → **`51 passed (1.4m)`**.

## 다음 라운드 (필수)

이 라운드가 CRITICAL 을 냈고 재설계로 코드가 다시 바뀌었다. 재설계(`cffee0d28`)는 **재설계 이전
코드를 리뷰한 이 산출물로 커버되지 않는다** → 재설계를 대상으로 한 **새 `/ai-review` 라운드**가
push 전 필수다(코드 게이트 재무장). 그 라운드가 clean 이면 종결.
</content>
