# ai-review SUMMARY — `12_22_23` (forced 7 전원 실행)

대상: `claude/trigger-rotation-audit` vs `origin/main` (commit `8b2ae7164` 시점).

> 이 SUMMARY 는 **뒤늦게 기록한다**. 라운드 직후 발견사항을 바로 fix 하고 다음 라운드
> (`12_37_14`)로 넘어가면서 SUMMARY 를 안 썼다 — 리포트 7개만 남은 세션 디렉터리는 게이트가
> "빈 세션" 으로 조용히 지나갈 수 있는 형태다. 아래 집계는 리포트 7개의 `## 위험도` 절을 그대로
> 읽어 재구성했고, 처분 결과는 `12_37_14` 가 독립 재현으로 확인해 준 것이다.

## 집계

| reviewer | 위험도 |
|---|---|
| **testing** | **CRITICAL** |
| documentation | MEDIUM |
| security | LOW |
| requirement | LOW |
| side_effect | LOW |
| maintainability | LOW |
| scope | NONE |

## Critical (1건) — 셋 중 하나에만 회귀를 걸었다

**testing** — `rotateBotToken` 의 감사 회귀가 **0건**. 감사 호출을 통째로 지우는 뮤턴트와
조기 발화 뮤턴트가 **둘 다 81건 전부 GREEN**(리뷰어 실측). `requirement` WARNING · `security`
INFO 도 같은 자리를 독립 지적해 **3명 수렴**.

→ 6단계 mock 이 갖춰진 describe 에 성공/실패 회귀 2건 추가. 두 뮤턴트 모두 RED 전환을
`12_37_14` testing 이 repo 밖 scratch 사본에서 재현 확인.

## Warning

| # | reviewer | 내용 | 처분 |
|---|---|---|---|
| W1 | documentation | 근거 문장 "응답에 새 자격증명을 1회 평문 반환" 이 `chat_channel_bot_token_rotated` 에는 **거짓** (새 토큰이 호출자 입력) — 3곳 | 3곳 전부 정정 (`12_37_14` requirement 가 잔존 0건 확인) |
| W2 | documentation | 2026-08-01 동일 성격 선례가 있는데 CHANGELOG 누락 | 항목 추가 |
| W3 | side_effect | `AuditLogsService.record()` 가 DB 오류를 `logger.warn` 으로 삼켜 "회전 200 · 감사 행만 빔" 을 아무도 관측 못 한다 | **이 PR 의 회귀가 아니라 17개 producer 전체의 기존 설계** → `plan/` 별도 트랙 등재 |

## 반증된 내 전제

`recordAudit` 가 던져 회전을 500 으로 만들까 걱정했는데, `record()` 가 삼키므로 성립하지
않는다(side_effect 실측). 진짜 갭은 **반대 부호** — 200 인데 감사 행이 조용히 없는 쪽이고,
그게 W3 이다.

## RISK: CRITICAL
## CRITICAL_COUNT: 1
## WARNING_COUNT: 3
