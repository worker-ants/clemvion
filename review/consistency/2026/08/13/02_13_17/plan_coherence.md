### 발견사항

- **[WARNING]** "후속 항목 등재" 체크리스트 항목이 비대칭인 세 도메인을 하나로 묶어, EIA 에서 이미 반증한 "빈 포인터" 위험을 webhook 에서 놓칠 수 있다
  - target 위치: `plan/in-progress/spec-draft-redis-key-registry.md` 체크리스트 "후속 항목 등재: webhook·chat-channel·cafe24 소유 문서의 규약 역참조(이번 범위 밖)"
  - 관련 plan: 없음(이 gap 을 추적하는 in-progress plan 부재 — `spec/5-system/12-webhook.md` frontmatter `status: implemented`, `pending_plans` 없음)
  - 상세: target 은 인벤토리 표에 `wh:rl:min:<ip>` · `wh:rl:hour:<ip>` (webhook rate limit)를 실측으로 등재하면서, "EIA rate-limit 3키는 어느 spec 에도 리터럴이 없다 — 포인터가 가리킬 곳이 비어 있으므로 §8.4 에 리터럴을 추가해야 한다"(W1)는 걸 스스로 찾아 이번 범위에 반영했다. 그런데 같은 검증을 나머지 세 도메인(webhook·chat-channel·cafe24)에는 하지 않고 "역참조" 하나로 뭉쳐 범위 밖으로 미뤘다. 실측하면 셋의 상태가 다르다 — `cc:rl:{triggerId}:{conversationKey}` 는 `spec/data-flow/14-chat-channel.md:91` 에, `cafe24:install:fail:{ip}`/`cafe24:install:nonce:...` 는 `spec/2-navigation/4-integration.md:1291-1292` 및 `spec/4-nodes/4-integration/4-cafe24.md:559/564/577` 에 **이미 리터럴로 존재**하지만, `wh:rl:min:<ip>`/`wh:rl:hour:<ip>` 는 `spec/5-system/12-webhook.md` 전체에 **0건**이다 — 그 문서 §6 은 "Redis fixed-window 카운터 (분당/시간당 누적 상한)" 라고만 서술하고 실제 key literal 은 코드(`public-webhook-quota.service.ts`)에만 있다. 즉 신설 인벤토리가 webhook 행에서 가리킬 자리가 지금 비어 있고, 이 결함 클래스를 이미 이 draft 가 "포인터가 가리킬 곳이 비어 있으면 포인터가 성립하지 않는다" 는 원칙으로 직접 겪었음에도 후속 항목 문구에는 그 구분이 없다.
  - 제안: target 의 후속 체크리스트 항목을 "chat-channel·cafe24 = 역참조만(리터럴 이미 존재)" 과 "webhook = EIA §8.4 와 동형 처리 필요(리터럴 부재 — 12-webhook.md 에 `wh:rl:min:<ip>`/`wh:rl:hour:<ip>` 먼저 추가)" 로 분리하거나, 이번 범위에 webhook 리터럴 한 줄 추가를 포함시킨다.

- **[INFO]** heading 보존 근거로 든 §9.2 인바운드 앵커 참조 건수가 실측과 다르다(3건이 아니라 5건, `6-websocket-protocol.md` 누락)
  - target 위치: `plan/in-progress/spec-draft-redis-key-registry.md` "Rationale — consistency `02_01_16` 노트" 표의 "INFO 2·7" 행 및 본문 "인바운드 실측: §9.1 1건 · §9.2 3건"
  - 관련 plan: 없음(target 자체의 재검증 기록)
  - 상세: `spec/` 전체에서 `4-execution-engine.md#92-용도별-키-정의-및-ttl` 앵커를 직접 grep 하면 `spec/5-system/14-external-interaction-api.md` 에서 3건(line 156·1051·1070, target 주장은 2건), `spec/data-flow/3-execution.md` 에서 1건(일치), 그리고 target 이 전혀 언급하지 않은 `spec/5-system/6-websocket-protocol.md:106` 에서 1건 — 총 5건이다. §9.1(`#91-키-패턴`) 은 `spec/conventions/execution-context.md:62` 1건으로 target 주장과 일치한다. 이 undercount 는 target 이 §9.2 를 **내용만** 고치고 heading 은 그대로 두므로 앵커 자체는 안 깨지지만, 이 draft 가 자랑스럽게 기록해 둔 "재검증 방법도 한 번 틀렸다"(wh:rl: 거짓 음성) 와 같은 클래스의 오차가 이번 재검증에도 남아 있다는 뜻이다.
  - 제안: 커밋 전 `grep -rn '4-execution-engine.md#92' spec/` 으로 재확인해 "§9.2 3건" 문구를 "5건(6-websocket-protocol.md 포함)" 으로 정정한다. 실질 위험은 없다(heading 불변) — 기록의 정확성 문제.

### 요약
target(`spec-draft-redis-key-registry.md`)은 원 백로그 항목(`backend-lint-gate-broken-on-main.md` 의 미해결 `[ ]` 줄)을 정확히 인수하고 종결 계획을 체크리스트에 명시했으며, 여전히 열려 있는 두 선행 plan — `cafe24-backlog-residual.md` A-3 follow-up(Layer 1 분산 throttle store)과 `spec-sync-external-interaction-api-gaps.md` §R10(분산 SSE/notification fan-out) — 을 각각 "언젠가 유사 키가 재도입된다"·"새 pub/sub 채널이 예고돼 있다" 는 근거로 정확히 교차 인용해, target 이 설계하는 "유지보수 원칙"(신규 키/채널 도입 시 등재)의 필요성을 스스로 뒷받침한다. 같은 worktree 계열의 선행 작업(`spec-draft-eia-r8-alignment.md`)이 건드린 `data-flow/15` §2.2 idempotency 행과 `5-system/14` §R8 은 이미 merge 되어 현재 상태와 정합하고, target 의 §2.2 변경(규약 역참조 한 줄)은 그 위에 addENDS 만 하므로 충돌이 없다. `4-execution-engine.md` 를 동시에 건드리는 다른 in-progress plan(`execution-engine-residual-gaps.md` G2, `ie-resume-turn-boundary-cancel.md` §1.1, `retry-turn-terminal-guard.md`)은 전부 §9 와 무관한 섹션을 다뤄 라인 충돌이 없다. 유일하게 남는 갭은 target 이 스스로 발견한 "빈 포인터" 결함 클래스(EIA rate-limit 3키)를 webhook 에는 동일 기준으로 적용하지 않고 뭉뚱그려 후속으로 미룬 것과, 재검증 수치 하나의 사소한 undercount다 — 둘 다 결정 충돌이나 선행 조건 미해소는 아니다.

### 위험도
LOW
