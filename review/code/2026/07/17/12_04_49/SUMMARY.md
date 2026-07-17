# Code Review 통합 보고서

*검토 범위: `892151313..HEAD` — 직전 라운드 `11_38_14` W1 의 fix(1줄 프로덕션 + 회귀 테스트 1건). 델타 성격에 맞춰 2개 reviewer 실행 — 상세는 하단 "라우터 결정".*

## 전체 위험도

**MEDIUM** — 프로덕션 fix 의 **의도한 효과 자체는 두 reviewer 가 독립 mutation 으로 검증**했다(testing: fix 제거 시 41건 중 신규 테스트 1건만 실패, 실패 지점도 예고대로). 그러나 side_effect 가 **그 fix 가 만든 정반대 방향 결함**을 실측 재현했다 — "진입 시 일괄 폐기"가 겹친 부팅에서 **정당한 리셋을 삼킨다**. 활성 결함이나 원인이 명확하고 fix 는 국소적이라 CRITICAL 로 올리지 않는다. testing 의 WARNING 2건은 프로덕션이 아니라 **회귀 테스트 자체의 견고성**(거짓 음성·전역 상태 누수)에 관한 것으로, 하나는 실제 거짓 음성이라 실질적이다.

**워크트리 위생**: 2인 모두 격리 worktree 에서 mutation 을 수행하고 제거했다. 오염 재발 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 — side_effect, **실측 재현** | **`11_38_14` fix 의 정반대 결함**: `applyConfig` **진입 시** `pendingResetRef` 일괄 폐기가, 겹친 부팅에서 **정당한 리셋을 침묵 소거**한다. 경로: boot#1 이 `await isEmbedAllowed` 로 suspend → 그 사이 host `resetSession` → 플래그 set(정상, 지연 이행 설계) → **boot#1 이 아직 unresolved 인 동안 boot#2 도착**(재마운트 없는 `wc:boot` 재전송, `2-sdk.md:106` 이 명문 지원) → boot#2 의 진입-시 폐기가 그 플래그를 즉시 되돌림 → boot#1 resolve 시 소비할 게 없어 `loadSession` 으로 **구 세션 복원** → host 가 요청한 "새 대화" 완전 소실. **왜 이 fix 가 원인인가**: 폐기가 없었다면 boot#1 이 정상 소비해 `newChat()` 을 실행하고, 그 `teardownSession` 의 world-gen bump 가 boot#2 를 자연스럽게 stale 화했을 것 — **"먼저 소비한 쪽이 나머지를 무효화"하는 자기치유 구조**가 있었는데 fix 가 그걸 깨뜨렸다. 근본 전제는 `applyConfig` 에 single-flight 가드가 없다는 것(`host-bridge.ts` 가 `bootCb` 를 in-flight 여부 무관하게 호출). | `use-widget.ts` — `applyConfig` 진입-시 폐기 · 소비 지점 · `teardownSession` 부팅-전 분기; `host-bridge.ts` `wc:boot` 핸들러 | 폐기 기준을 "진입~소비 시간 구간"이 아니라 **"생존한 시도"** 로 바꿀 것. **→ 조치됨**(RESOLUTION §W1): 진입-시 폐기를 되돌리고 **BLOCKED 분기에서만** 폐기 — 자기치유 구조를 보존하면서 `11_38_14` W1 도 함께 닫힌다. 양방향 회귀 테스트로 고정. |
| 2 | 테스트 — testing, **adversarial probe 로 실증** | 신규 회귀 테스트가 **2차 부팅의 전제를 고정하지 않아 거짓 음성** 여지. 2차 boot 의 embed-config 응답을 1차와 동일한 차단 설정으로 바꾸는 probe → 테스트가 그대로 green. 1차 전제(`blocked` 도달)는 `expect` 로 고정됐지만 2차("정상 허용됨")는 안 돼 있어, 2차가 무관한 이유로 실패해도 "아무 일도 안 일어나서" 통과한다. | `use-widget-eager-start.test.ts` 신규 테스트 | 2차 boot 후 `expect(phase).toBe("streaming")` 추가. **→ 조치됨**. |
| 3 | 테스트 — testing, **관측으로 실증** | `document.referrer` 오버라이드 복원이 **테스트 본문 끝**에 있어 assertion 실패 시 실행되지 않고 **다음 테스트로 누수**된다(고의 실패 + 더미 테스트로 관측). 같은 코드베이스의 `widget-app.test.tsx` 가 이미 `afterEach` 로 이 정확한 문제를 해결하는 컨벤션을 갖고 있고, **이 파일 자신의 전역 `afterEach` 주석**(`06_53_03` W4)도 같은 원칙을 명문화하고 있어 대비된다. 오늘 파급은 제한적(이 조합을 쓰는 테스트가 신규 1건뿐)이나 구조적 취약. | `use-widget-eager-start.test.ts` 신규 테스트 · 대조: `widget-app.test.tsx` | 복원을 전역 `afterEach` 로 이동. **→ 조치됨**. |

## 참고 (INFO)

| # | 발견사항 |
| --- | --- |
| 1 | (side_effect) 겹친 부팅이 `configRef`/`clientRef` 를 서로 덮어쓰며 구 세션을 중복 복원하는 경로는 무해 — `openStream`/`scheduleRefresh` 가 각각 close-then-open / clear-then-reschedule 이라 idempotent. |
| 2 | (testing) `isStale` 추출의 검출력 보존을 재확인(항상 `false` mutation → **7건 실패 / 365 passed**), `11_38_14` RESOLUTION 주장과 일치. |
| 3 | (side_effect) `applyConfig` 에 single-flight/supersede 가드가 없는 것은 이 fix 와 독립한 **구조적 갭**이다 — spec `2-sdk.md:106` 이 "마지막 `wc:boot` 의 config 를 적용"이라 정하는데 현재는 두 부팅이 경합하면 완료 순서가 승자를 정한다. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | MEDIUM | WARNING#1 — fix 의 정반대 결함을 3원 mutation 대조로 실측 재현. 원인 진단("자기치유 구조를 깼다")까지 제시. INFO 로 single-flight 부재를 구조적 갭으로 기록. |
| testing | LOW | 프로덕션 fix 의 정확성을 독립 mutation 으로 확인(CRITICAL 0). 회귀 테스트의 거짓 음성(WARNING#2)·전역 상태 누수(WARNING#3)를 각각 adversarial probe 와 관측으로 실증. |

## 라우터 결정

- router 미실행. 델타가 **1줄 프로덕션 변경 + 그 회귀 테스트**라, 직전 라운드에서 이 결함을 발견·재현한 두 관점(`side_effect`=플래그 수명, `testing`=회귀 검출력)을 main 이 선별 실행했다.
  - **실행(2명)**: `side_effect`, `testing`
  - **미실행(12명)**: 직전 두 라운드(`09_36_01` 8인 · `11_38_14` 3인)가 이 코드의 직전 상태를 검토했고 이번 델타는 그 지적에 대한 1줄 fix 라 판단.
  - **한계 명시**: router 의 의미 기반 판단이 아니라 main 의 수동 선별이다. 미실행이 "그 관점에서 깨끗함"을 뜻하지 않는다. 다만 이번 라운드의 두 발견 모두 실행된 2인에게서 나왔고, 그중 하나는 **fix 자신이 만든 결함**이라 선별 관점은 적중했다.
