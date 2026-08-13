# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**LOW** — CRITICAL/WARNING 급 spec-code 모순 없음. plan_coherence 가 WARNING 1건(신규 Redis 키가 기존 정리 backlog 스코프 밖) 제기, 나머지는 전부 INFO.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 신규 Redis 키 `cc:dedup:{triggerId}:{idempotencyKey}` 가 `4-execution-engine.md §9.1` 키 레지스트리 정리 backlog 의 스코프 서술("EIA 계열"만 명시)에 들지 않아, 향후 `#1160`(현재 OPEN) 병합 후 그 backlog 처리 시 chat-channel 계열 키(`chat-channel:*`/`chat-channel-lock:*`/`cc:rl:*`/`cc:dedup:*`)가 누락될 위험 | `spec/data-flow/14-chat-channel.md` §2.2, `spec/5-system/15-chat-channel.md` R-CC-20 | `plan/in-progress/backend-lint-gate-broken-on-main.md` L727-735 (스코프 서술) | plan L727-735 스코프에 chat-channel 계열 키 명시 추가, 또는 `data-flow/14-chat-channel.md` §2.2 표 하단에 §9.1 비정합 각주 1줄 추가. 이번 PR 을 막을 사안 아님(기존 `cc:rl:*` 관례 연장, fail-open 동일 정책) — 후속 planner 턴에서 놓치지 않도록 권고 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec + rationale_continuity (중복 지적) | `R-CC-20` 본문 내 `[R-CC-12 (b)](#r-cc-12-telegram-safe-2xx)` 앵커가 실제 R-CC-12 헤딩 슬러그와 불일치(깨진 링크). 인용 내용 자체는 정확 | `spec/5-system/15-chat-channel.md:718` (R-CC-20), 대상 헤딩 `### R-CC-12. Inbound HTTP Contract — ...` | 앵커를 실제 슬러그로 정정 |
| 2 | cross_spec | 신규 dedup 게이트는 telegram/slack/discord 전 provider 공통 경로에 적용되는데 slack.md/discord.md 는 telegram.md 와 달리 구현 완료 상태 주석이 갱신되지 않아 provider 문서 간 서술 비대칭 발생 | `spec/4-nodes/7-trigger/providers/telegram.md:235` (갱신됨) vs `slack.md:301`, `discord.md:324` (미갱신) | slack.md/discord.md 에도 `ChatChannelDedupService` 참조 + 구현 완료 주석 추가 (project-planner 소관) |
| 3 | convention_compliance | 신규 `R-CC-20` 이 `R-CC-19` 보다 앞자리에 삽입되어(R-CC-18 → R-CC-20 → R-CC-19) 파일 내 유일하게 번호-등장순서 역행 발생 (명시적 convention 위반은 아니고 지금까지의 오름차순 append 관례 이탈) | `spec/5-system/15-chat-channel.md` L706-720 | `R-CC-20` 섹션을 `R-CC-19` 뒤로 이동시켜 등장순서와 번호 일치 (선호), 또는 조치 불요 |
| 4 | convention_compliance | `구현됨` 상태 주석의 날짜 표기가 같은 목록 안에서 비일관 (`L235` 는 날짜 있음, 인접 `L233` 은 없음) | `spec/4-nodes/7-trigger/providers/telegram.md` L233, L235 | 사소 — 통일하려면 L233 도 날짜 소급 또는 L235 날짜 제거 |
| 5 | plan_coherence | plan 이 "planner 결정 필요" 로 등재한 CCH-SE-02 항목을 developer 턴이 직접 결정·spec 3개 파일 수정(spec read-only 규칙 이탈) — 단, 직전 라운드가 이미 WARNING 으로 지적했고 plan 파일에 "⚠️ 절차 이탈 기록" 문단(RESOLUTION 포인터 포함)이 이미 반영되어 자체 시정 완료 상태 | `spec/5-system/15-chat-channel.md` CCH-SE-02 행, `providers/telegram.md` L232-236 / `plan/in-progress/backend-lint-gate-broken-on-main.md` L679-726 | 추가 조치 불요 — 기록 재확인만 |
| 6 | plan_coherence | `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 가 이미 `plan/complete/` 로 이동한 plan 을 여전히 `in-progress/` 경로로 참조 (이번 diff 이전부터의 선재 상태, 본 PR 무관) | `spec/5-system/15-chat-channel.md` frontmatter L23 | 다음 편집 시 하우스키핑으로 제거 |
| 7 | plan_coherence | `plan/in-progress/spec-draft-eia-r8-alignment.md` 체크리스트 전항목 완료 — lifecycle 이동 대상 (본 target 과 직접 충돌은 없음) | 해당 plan frontmatter `status: in-progress` | `plan-lifecycle.md` 절차대로 `plan/complete/` 로 이동 (별도 후속 커밋 가능) |
| 8 | naming_collision | 신규 `cc:dedup:*` 키가 기존 `cc:` 약어 접두사 계열(`cc:rl:*`) 은 따르지만, 같은 문서 내 `chat-channel:*`/`chat-channel-lock:*` verbose 접두사 계열과는 스타일이 다름 — 문자열 자체는 겹치지 않아 실제 충돌 없음, 이번 diff 가 새로 만든 불일치도 아님(선례 `cc:rl:*` 계승) | `spec/data-flow/14-chat-channel.md:196` | 조치 불요 (스타일 통일은 별도 정리 PR 사안) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | CRITICAL/WARNING 0건. EIA-AU-08 in-process 우회 전제·Redis 키 네임스페이스·요구사항 ID·게이트 순서·모듈 계층 모두 검증 완료(충돌 없음). INFO 2건(provider 문서 비대칭, 앵커 링크) |
| rationale_continuity | LOW | CRITICAL/WARNING 0건. CCH-SE-02 문면 번복은 신규 R-CC-20 이 실제 커밋 이력(`534158722`)과 일치하는 배경으로 정당화, EIA-AU-08·fail-open 정책·기존 Redis 락 패턴·R-CC-19 순서 논리 모두와 정합. INFO 1건(앵커 링크, cross_spec 과 중복) |
| convention_compliance | LOW | CRITICAL/WARNING 0건. 명명·Redis 키 패턴·DI 배선·frontmatter·Rationale 배치 모두 형제 서비스/기존 구조 규약 정밀 미러링. INFO 2건(Rationale 번호 순서, 날짜 표기) |
| plan_coherence | LOW | CRITICAL 0건, WARNING 1건(신규 Redis 키가 §9.1 정리 backlog 스코프 밖 — 후속 누락 위험, 병합 차단 사안 아님). INFO 3건(절차 이탈 이미 자체시정·stale pending_plans·lifecycle 이동 대상 plan) |
| naming_collision | NONE | 신규 식별자(`ChatChannelDedupService`/`makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC`/DI 토큰/`cc:dedup:*`/`R-CC-20`) 전수 검색 결과 기존 사용처와 충돌 0건. INFO 1건(Redis 키 표기 스타일 공존, 충돌 아님) |

## 권장 조치사항
1. (선택, 비차단) `plan/in-progress/backend-lint-gate-broken-on-main.md` L727-735 의 §9.1 키 레지스트리 정리 backlog 스코프 서술에 chat-channel 계열 Redis 키(`chat-channel:*`/`chat-channel-lock:*`/`cc:rl:*`/`cc:dedup:*`)를 명시 추가 — 다음 planner 턴(`#1160` 병합 후)이 누락하지 않도록.
2. (선택) `spec/5-system/15-chat-channel.md` R-CC-20 의 R-CC-12 앵커 링크 정정.
3. (선택) `spec/4-nodes/7-trigger/providers/slack.md`, `discord.md` 에도 telegram.md 와 동일한 구현 완료 상태 주석 추가.
4. (선택, 하우스키핑) `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 정리, `plan/in-progress/spec-draft-eia-r8-alignment.md` → `plan/complete/` 이동.

이번 PR(CCH-SE-02 chat-channel update dedup 구현)은 병합 차단 사유가 없다.

---

## 이 라운드 처분 (main Claude)

- **WARNING #1 → 반영.** backlog 항목 제목을 "EIA·chat-channel 계열" 로 넓히고, 실측 4종
  (`chat-channel:<triggerId>` · `chat-channel-lock:<triggerId>` · `cc:rl:*` · `cc:dedup:*`)과
  측정 명령을 본문에 박았다. 이 지적의 값어치는 **항목 제목이 집행 범위를 결정한다**는 것이다 —
  "EIA 계열" 이라고만 적힌 backlog 를 집행하는 planner 는 chat-channel 을 쳐다볼 이유가 없다.
- **INFO #1·#2 → planner 인계 기록.** 둘 다 `spec/` 이라 developer 권한 밖이다. 같은 backlog
  항목에 "함께 볼 planner 항목" 으로 붙여 뒀다 — 이번 세션에서 spec read-only 규약을 어긴 것을
  기록해 놓고 같은 턴에 또 어기지 않기 위해서다.
- **INFO #3~#8 → 무조치.** 선재 상태이거나(#6·#8) 별도 정리 PR 사안(#3·#4·#7)이고, #5 는 이미
  자체 시정된 항목의 재확인이다.
