# Plan 정합성 검토 — trigger-config-lost-update (impl-done, scope=spec/5-system/)

## 검토 방법 메모

`_prompts/plan_coherence.md` 번들은 예산 절단으로 diff 본문과 `plan/in-progress/**` 65개
파일 전체(대상 plan `trigger-config-lost-update.md` 자신 포함)가 생략되어 있었다. 판정을
위해 워킹트리 절대경로로 직접 열었다:

- `plan/in-progress/trigger-config-lost-update.md` (692줄, 14라운드 리뷰 처분 전체)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (관련 트래커 항목)
- `spec/5-system/15-chat-channel.md` frontmatter(`code:`/`pending_plans:`) 및 R-CC-22 본문
- `plan/in-progress/*.md` 전수 grep (redis-keys/advisory-lock/chat-channel 교차 참조)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 존재 확인

## 발견사항

- **[WARNING]** R-CC-22 가 막으려던 "새 파일이 `code:` glob 밖" 패턴의 **4번째 재발** — 후속(spec glob 갱신)이 durable 트래커에 미등재
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` (R-CC-22, 876행) — `chat-channel-*.ts` · `dto/**/chat-channel-*.dto.ts` · `trigger-callback-url*.ts` 3개 좁은 glob
  - 관련 plan: `plan/in-progress/trigger-config-lost-update.md` §D "`--impl-prep`·`/ai-review` 등재 항목 (planner 범위 — 이 브랜치에서 고치지 않는다)" 표 1행
  - 상세: 이 PR 이 신설한 `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(+`.spec.ts`)를 R-CC-22 의 세 glob 어느 것과도 직접 매칭해 봤다 — `chat-channel-*.ts`(접두 불일치) · `dto/**/chat-channel-*.dto.ts`(경로 불일치) · `trigger-callback-url*.ts`(접두 불일치) 전부 불일치를 확인했다. `spec/2-navigation/2-trigger-list.md`·`5-system/12-webhook.md`·`5-system/14-external-interaction-api.md` 등 `modules/triggers/` 를 언급하는 다른 spec 도 명시 파일 나열뿐이라 마찬가지로 안 걸린다. R-CC-22 본문이 스스로 "세 번 연속(#1317·#1319·#1320) 누락됐다" 고 적은 그 클래스가 이번이 **네 번째**다 — plan 자신도 이를 인지하고 있다("그 문서의 R-CC-22 가 … 놓쳤다 며 glob 으로 바꾼 바로 그 결함의 네 번째 재발이다"). 그런데 이 인지된 후속(glob 확장 또는 `trigger-config-lock.ts` 를 명시 추가)이 (a) `spec/5-system/15-chat-channel.md` 의 `pending_plans:`(현재 `chat-channel-discord-gateway.md`·`chat-channel-slack-socket-mode.md`·`chat-channel-visual-ssr-png.md` 3건뿐, 이 plan 미포함)에도, (b) 다른 어떤 `plan/in-progress/*.md` 에도 등재되어 있지 않다(전수 grep 결과 0건). `trigger-config-lost-update.md` 자신의 체크리스트는 이 항목을 "planner 범위"로 명시적으로 위임했을 뿐 실제 위임 대상(등재 문서)을 만들지 않았고, 이 plan 은 마지막 체크리스트 항목(`/ai-review`)만 통과하면 `plan/complete/` 로 이동 예정이다(`plan-lifecycle.md` §1: "모든 작업·체크리스트·후속 항목까지 끝난 plan" 만 이동 — 완료 이력 문서에 후속 표를 남기는 것 자체는 이 저장소의 통상 관행이나, spec 쪽 반영 지점(`pending_plans:`)이 비어 있으면 이 항목을 찾을 실마리가 spec 에는 없다).
  - 제안: `spec/5-system/15-chat-channel.md` 의 `pending_plans:` 에 이 plan(또는 그 `plan/complete/` 이동 후 경로)을 추가하거나, R-CC-22 glob 을 `trigger-config-lock.ts` 를 포함하도록 확장하는 후속을 project-planner 턴으로 별도 등재할 것. 최소한 `spec-draft-nullable-notation-followups.md` 의 해당 항목(아래 참조)에 이 잔여 gap 을 명시적으로 옮겨 적을 것.

- **[WARNING]** 나머지 4개 "planner 범위" 후속 항목도 같은 이유로 durable 하게 등재되지 않음
  - target 위치: `spec/5-system/15-chat-channel.md`(회전 정책 자기모순 · code glob) / `spec/conventions/redis-keys.md §4`(lock key 인벤토리 부재)
  - 관련 plan: `plan/in-progress/trigger-config-lost-update.md` §D 표 나머지 4행 — "advisory lock 키 인벤토리 문서 부재", "`exec-cap:*`·`trigger-config:*` 의 `redis-keys.md §4` 등재", "기존 spec 의 회전 정책 자기모순"(근거: `review/consistency/2026/09/14/17_10_16/cross_spec.md` INFO — `15-chat-channel.md §5.4.1.1` 표 서술 vs 바로 아래 2026-09-10 각주의 내부 모순), "전역 32비트 키 공간 공유"
  - 상세: `plan/in-progress/*.md` 전수(및 `spec-draft-nullable-notation-followups.md`)를 grep 했으나 `redis-keys.md §4`·`32비트 키 공간`·`회전정책 자기모순`·`exec-cap.*redis-keys` 어느 키워드도 이 plan 파일 밖에서 발견되지 않았다. `execution-engine-residual-gaps.md`(`exec-cap:*` 의 소유 모듈로 추정)에도 `exec-cap`·`redis-keys` 언급이 0건이다. 즉 "자매 사례도 함께 등재" 하겠다는 plan 의 의도가 실행되지 않은 채, 유일한 근거 문서(`trigger-config-lost-update.md`)가 `plan/complete/` 로 봉인될 참이다.
  - 제안: 위 항목과 동일 — project-planner 턴에서 별도 트래커(`spec-sync-*-gaps.md` 신설 또는 기존 `spec-draft-nullable-notation-followups.md` 확장)에 4건을 명시 이관.

- **[INFO]** `spec-draft-nullable-notation-followups.md` 가 아직 존재하지 않는 `plan/complete/` 경로를 선(先)참조
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2294-2295`
  - 관련 plan: `plan/in-progress/trigger-config-lost-update.md` 체크리스트 마지막 항목(`- [ ] /ai-review + --impl-done`, 687행, 아직 미체크)
  - 상세: 트래커 항목이 "✅ 2026-09-15 해소 — `plan/complete/trigger-config-lost-update.md`" 라 적어 이미 이동·완료된 것처럼 서술하지만, 실측(`ls plan/complete/trigger-config-lost-update.md` → 없음, `git status` → `plan/in-progress/trigger-config-lost-update.md` 만 존재)하면 파일은 아직 `in-progress/` 에 있고 대상 plan 의 체크리스트도 미완이다. 지금 이 검토(`--impl-done`)가 통과해야 비로소 체크·이동이 뒤따르는 정상 순서이므로, 이 자체가 결함은 아니되 **같은 커밋/세션에서 실제 `git mv` + 체크박스 갱신이 함께 일어나지 않으면** 두 문서가 서로 다른 상태를 주장하는 상태로 남는다(이 저장소가 기록한 "체크와 `complete/` 이동은 한 동작" 교훈과 정확히 같은 위험 형태).
  - 제안: 이번 라운드 결과가 BLOCK:NO 로 마무리되면, 같은 커밋에서 (1) `trigger-config-lost-update.md` 마지막 체크박스 `[x]` 처리, (2) `git mv plan/in-progress/trigger-config-lost-update.md plan/complete/`, (3) 위 두 WARNING 의 후속 이관을 함께 수행할 것.

## 요약

이 PR 은 코드 전용(spec/5-system 델타 0)이라 spec 문서 자체와의 직접 충돌은 없다. 다만 대상 plan(`trigger-config-lost-update.md`)이 스스로 인지·기록한 5개의 "planner 범위" 후속 항목 — 특히 R-CC-22 가 막으려던 클래스의 명시적 **4번째 재발**(`trigger-config-lock.ts` 가 `15-chat-channel.md` 의 `code:` glob 밖) — 이 이 plan 파일 밖 어디에도 durable 하게 등재되어 있지 않다(spec `pending_plans:` 미갱신, 다른 `plan/in-progress/*.md` 전수 grep 0건). 이 plan 이 `/ai-review` 통과 후 통상 절차대로 `plan/complete/` 로 봉인되면 이 5건은 사실상 유실 위험에 놓인다. 그 밖의 항목 — 락 레이어 결정, Cafe24 advisory-lock 기각 선례 대조, `EntityManager.query` 튜플 함정 자가진단 — 은 다른 in-progress plan 들과 충돌 없이 정합했다.

## 위험도

MEDIUM
