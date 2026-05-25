# Code Review SUMMARY

## 전체 위험도
**HIGH** (raw) — 다음 CRITICAL 들 중 1건만 실제. Resolution 후 **LOW**.

## Critical 발견사항 (3건)

| # | Reviewer 발견 | 실제 검증 | 조치 |
|---|---|---|---|
| C1 | spec 미존재 ID (`CCH-AD-07` / `CCH-MP-06` / `R-CCA-7` / `§1.3`) 인용 | **false positive** — spec PR commit `8cb53a1e` 가 이미 4 spec 파일에 모두 추가. reviewer 가 stale view 또는 main HEAD 만 봄 | 무시 |
| C2 | `renderNode` 시그니처 spec 불일치 | **false positive** — `chat-channel-adapter.md §1` line 43 / §1.1 line 82 / §3 line 269 모두 갱신됨 | 무시 |
| C3 | Discord/Slack 신규 코드 경로 테스트 전무 | **real** | discord/slack renderer.spec.ts 에 7건 추가 (CCH-MP-06 + CCH-MP-01 보강) |

## WARNING (실제 처리)

| # | 발견 | 조치 |
|---|---|---|
| W1 | `toEiaEvent` `execution.ai_message` case 가 payload 의 `presentations` 필드를 추출하지 않음 — CCH-MP-01 보강 기능 미동작 | **dispatcher 갱신** — `presentations: Array.isArray(...) ? ... : undefined` 추출 + 단위 테스트 3건 추가 |
| W4 | 3 provider adapter 의 `renderNode` 시그니처가 여전히 `EiaEvent` 단일 타입 | telegram/discord/slack adapter.ts 의 renderNode 시그니처를 `EiaEvent | ChatChannelInternalEvent` union 으로 갱신 |
| W10 | Telegram renderer switch 에 `default:` 케이스 없음 | `default: return []` 추가 — Discord/Slack 와 일관 |

## WARNING (보류 — 후속 PR 후보)

| # | 발견 | 사유 |
|---|---|---|
| W2 | 3 provider renderer 의 `renderPresentationByType` / `renderAiMessage` / `renderPresentationPayload` 함수 복제 (DRY 위반) | tech-debt — `chat-channel/shared/presentation-renderer.ts` 추출은 별 refactor PR 후보. 본 PR 의 핵심 회귀 fix scope 와 무관 |
| W3 | 함수명 `toEiaEvent` 가 반환 union 과 의미 불일치 | tech-debt — rename `toChatChannelEvent` 는 cross-file 영향 큼. 별 PR |
| W11 | Discord/Slack renderer 의 helper 함수에 JSDoc 누락 (Telegram 에는 있음) | tech-debt — 본 PR 의 commit message 와 spec 본문이 이미 정책 명시. JSDoc parity 는 별 PR |
| W12 | `ChatChannelInternalEvent` 가 `EiaEventBase` extends — EIA base 결합 | tech-debt — 별 base type 분리는 별 PR |
| W13 | sub-filter null 과 에러성 null 동일 warn 로그 경로 | tech-debt — 별 PR (운영 환경에서 warn 볼륨 측정 후 결정) |

## INFO (참고)

| # | 발견 | 사유 |
|---|---|---|
| I1 | AI 생성 텍스트 (`output.rendered`) escape — v1 안전, v2 SSR 시 주의 | v2 SSR plan (`chat-channel-visual-ssr-png`) 에서 처리 |
| I2 | Discord `@everyone`/Slack mrkdwn 인젝션 — v1 낮음, v2 주의 | tech-debt — 별 PR |
| I3 | `_retry_state.json` 절대 경로 commit | harness tool 측 개선 — 별 PR |
| 기타 | I4/I5/I6/I7/I8/I9/I10 | 모두 LOW — 본 PR 무관 |

## Reviewer 위험도

| Reviewer | Risk |
|---|---|
| requirement | HIGH → **LOW** (해소 후) |
| testing | HIGH → **LOW** (Discord/Slack 테스트 추가) |
| architecture | MEDIUM |
| maintainability | MEDIUM |
| side_effect | LOW |
| security | LOW |
| documentation | LOW |
| scope | NONE |
| api_contract | NONE |

Skipped (router): performance, dependency, database, concurrency, user_guide_sync.

## 조치 결과

- **CRITICAL C3 + WARNING W1/W4/W10** 모두 본 PR 안에서 해소.
- C1/C2 는 reviewer false positive — spec 본문에 실제로 모든 ID 존재 (PR #328 spec commit).
- WARNING W2/W3/W11/W12/W13 은 tech-debt — 본 PR scope 밖, 별 refactor PR 후보.

## 결정

**머지 허용** — 핵심 회귀 ①+② fix 완성. tech-debt 항목은 별도 plan 으로 추적.
