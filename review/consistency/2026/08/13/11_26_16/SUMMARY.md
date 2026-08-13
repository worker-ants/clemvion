# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 CRITICAL 없음.

## 전체 위험도
**LOW** — target(`spec/5-system/`, 실질 변경은 CCH-SE-02 chat-channel inbound update dedup 구현 1건)은 EIA in-process trusted caller 전제·기존 rate-limit 처리 순서·Redis 키 네임스페이스·모듈 계층·Rationale 연속성·명명 규약을 모두 위반 없이 준수. WARNING 1건(plan 체크리스트 stale)과 INFO 다수(전부 문서 표기/순서 수준)만 발견.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `spec-draft-redis-key-registry.md` 체크리스트 9개 중 8개가 실제로는 완료됐는데(코드/spec 실측 확인) 문서상 전항목 `[ ]` 미체크로 남아 이 diff 가 딛고 선 산출물(`redis-keys.md`, §9.1)을 "미확정 draft" 로 오판할 위험 | `spec/conventions/redis-keys.md`, `spec/5-system/4-execution-engine.md` §9.1 | `plan/in-progress/spec-draft-redis-key-registry.md` `## 체크리스트` | 완료된 8개 항목을 `[x]` 로 갱신하고, 미완료인 "webhook 빈 포인터" 항목만 미체크로 남길 것. 이번 PR 자체를 막을 사안은 아님 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity, convention_compliance, naming_collision (중복 지적) | 신규 Rationale `R-CC-20` 이 기존 최종 항목 `R-CC-19` 보다 문서상 앞에 삽입되어 번호(20>19)와 등장 순서가 어긋남 | `spec/5-system/15-chat-channel.md` | `R-CC-20` 절을 `R-CC-19` 뒤로 이동해 순서·번호 일치. 비차단 |
| 2 | cross_spec | slack/discord provider spec 은 dedup 문장이 원래 있었지만 telegram.md 처럼 "구현 완료" 상태 주석·SoT 백링크가 없어 3개 provider 문서 간 서술 비대칭 (기능적 모순 아님) | `spec/4-nodes/7-trigger/providers/slack.md:301`, `discord.md:324` | 이미 plan 에 planner 인계로 등재됨 — 재등재 불요 |
| 3 | convention_compliance | Redis 키 placeholder 이름이 문서마다 다름: `15-chat-channel.md`/`redis-keys.md` 는 `<updateId>`, `data-flow/14-chat-channel.md` 는 `{idempotencyKey}` — 실제 코드 파라미터명은 `idempotencyKey` | `spec/5-system/15-chat-channel.md` CCH-SE-02, `spec/conventions/redis-keys.md` §3 | `<updateId>` 를 `<idempotencyKey>` 로 통일해 코드·data-flow 문서와 정렬 |
| 4 | plan_coherence | "planner 결정 필요" 게이팅 항목을 developer 턴이 자체 결정·spec 직접 수정한 절차 이탈이 반복됐으나 plan 에 정직하게 기록돼 있어 새로 escalate 할 근거 없음 | `spec/5-system/15-chat-channel.md`, `providers/telegram.md` | 추가 조치 불요 |
| 5 | plan_coherence | 잔여 chat-channel 후속 2건이 이미 plan 에 정확히 등재돼 있음 | `plan/in-progress/backend-lint-gate-broken-on-main.md` | 추가 조치 불요 |
| 6 | plan_coherence | `15-chat-channel.md` frontmatter `pending_plans` 가 이미 `complete/` 로 이동된 plan 을 계속 가리킴 (선재 상태) | 해당 frontmatter | 다음 planner 편집 시 하우스키핑 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | EIA-AU-08/§R8/rate-limit 순서/Redis 네임스페이스/모듈 계층 전부 정합. slack/discord 문서 비대칭만 INFO |
| rationale_continuity | LOW | 기각된 대안 재도입·확립 원칙 위반·무근거 번복 없음. R-CC-20 삽입 위치만 INFO |
| convention_compliance | LOW | 명명/Redis 키 형태/frontmatter evidence/Rationale prefix 전부 준수. placeholder 이름 불일치·R-CC-20 순서만 INFO |
| plan_coherence | LOW (WARNING 1건) | diff 자체는 plan 의 미해결 항목을 정합하게 해소. 인접 선행 plan 체크리스트가 실제 완료 상태를 반영 못 함 |
| naming_collision | NONE | 신규 식별자 전부 전역 유일, 충돌 없음 |

## 권장 조치사항
1. `spec-draft-redis-key-registry.md` 체크리스트 완료 8개를 `[x]` 로 갱신.
2. `R-CC-20` 절을 `R-CC-19` 뒤로 이동.
3. `<updateId>` placeholder 를 `<idempotencyKey>` 로 통일.
4. (급하지 않음) 다음 planner 턴에서 slack/discord 에도 SoT 백링크 추가.

---

## 이 라운드 처분 (main Claude)

**INFO 1·3 반영, WARNING 1 은 의도적 무조치(근거 아래).**

**INFO 3 (placeholder 통일)** — `redis-keys.md`(내가 이번에 추가한 행)와 `15-chat-channel.md`
두 곳의 `<updateId>` 를 `<idempotencyKey>` 로 바꿨다. **문서가 코드를 따르는 방향**이 맞다 —
`ChannelUpdate.idempotencyKey` 가 실제 파라미터명이고, `updateId` 는 그 값의 출처(provider
update_id)를 가리키는 개념어다. 셋 중 둘이 개념어를 쓰고 하나가 실명을 쓰면, 코드를 찾는
사람이 grep 할 문자열이 갈린다.

**INFO 1 (R-CC-20 배치)** — 3개 checker 가 중복 지적했고 **이 PR 이 만든 배치**라 이 PR 에서
되돌린다. 절을 `R-CC-19` 뒤로 옮겼다. 섹션 이동은 앵커를 깨뜨릴 수 있어(이 브랜치에서 방금
겪은 결함 클래스) `spec-link-integrity` 로 재검증했다 — **13/13**.

**WARNING 1 (redis-key-registry 체크리스트 stale) — 무조치.**

이 항목은 **이미 고쳤다. 단, 다른 브랜치에서다** — [#1163](https://github.com/worker-ants/clemvion/pull/1163)
이 draft 를 `plan/complete/` 로 옮기고 8개를 체크했다. 그런데 **#1163 은 아직 OPEN 이다**
(`gh pr view 1163` → `state=OPEN`, `mergedAt=null`, 이 턴에 재확인).

그러므로 "이미 해소됐다" 고 쓰면 이 세션에서 두 번 저지른 거짓 처분("#1160 이 해소했다" 고
적었는데 그 PR 이 열려 있었다)을 세 번째로 반복하는 것이다. 정확한 서술은 **"#1163 이 병합되면
해소된다"** 다.

여기서 또 고치지 않는 이유는 **두 PR 이 같은 파일의 같은 줄을 고쳐 충돌하기 때문**이다.
먼저 병합되는 쪽이 해소하고 나중 쪽은 rebase 에서 그 결과를 받는다. 병합 순서 의존이 있고,
그 사실 자체가 기록할 값어치가 있다.

**INFO 2·4·5·6 무조치** — 전부 이미 plan 에 등재돼 추적 중이거나(2·5) 재확인만 필요한
항목(4)이거나 선재 하우스키핑(6)이다.
