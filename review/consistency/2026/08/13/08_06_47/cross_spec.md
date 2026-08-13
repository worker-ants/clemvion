### 발견사항

- **[CRITICAL]** 미커밋 spec 편집이 존재하지 않는 `spec/conventions/redis-keys.md` 를 참조해 `spec-link-integrity` 게이트가 즉시 깨진다
  - target 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` "`data-flow/15` 의 '전 경로 fail-open (warn)' 이 실제보다 한 칸 넓다" 항목의 "완료 (2026-08-13, planner 턴 `eia-failopen-wording`)" 서술(대상 자리로 `14-external-interaction-api.md §R8 Rationale` · `data-flow/15 §4 외부 의존 표` · 같은 문서 `§Rationale` 를 명시). 실체는 현재 워크트리의 **미커밋** diff — `spec/data-flow/15-external-interaction.md:308`(§4 외부 의존 표) 와 같은 문서 `§Rationale "Fail-open 정책의 일관 표기"`.
  - 충돌 대상: `spec/conventions/redis-keys.md` — 이 브랜치(`claude/eia-failopen-wording`)에는 **존재하지 않는 파일**. 동일 백로그 뿌리("EIA 계열 Redis 키가 실행 엔진 §9.1/§9.2 키 레지스트리에 없다", target 문서 line 724)를 다루는 **별도의 미머지 오픈 PR #1160**(`claude/eia-redis-key-registry`, 2026-08-12 오픈, `git merge-base --is-ancestor` 로 현재 HEAD 의 조상 아님 확인)이 그 파일을 신설하는 커밋(`a561e107e`)을 이미 갖고 있다.
  - 상세: `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` 로 직접 재현 — `1 broken in-repo spec link(s): 1 dead path` (`[DEAD] spec/data-flow/15-external-interaction.md:308 -> ../conventions/redis-keys.md`). 두 병렬 세션이 같은 EIA fail-open 영역을 동시에 편집한 결과다 — 한쪽(현재 브랜치)은 신설될 규약 문서를 앞당겨 참조했고, 다른 쪽(PR #1160)은 실제로 그 문서를 만들고 있으나 아직 머지되지 않았다. 이 상태로 커밋·push 하면 frontend unit 게이트가 즉시 RED 가 된다.
  - 제안: PR #1160 이 먼저 머지된 뒤 현재 브랜치를 그 위로 rebase 하거나, 머지 전까지는 `[`conventions/redis-keys.md`](../conventions/redis-keys.md)` 링크를 잠정 제거(또는 실제 참조 대상이 없는 상태이므로 문장 자체를 "규약 문서 미정, `4-execution-engine.md §9.1` 참조" 정도로 임시 완화)하고 커밋한다. 어느 쪽이든 이 파일을 그대로 커밋해서는 안 된다.

- **[WARNING]** target 문서가 "미해결"로 남긴 backlog 3건이 이미 병렬 세션의 오픈 PR 로 진행 중 — 이 target 파일 자체도 동시 편집 대상
  - target 위치: 체크리스트 미해결(`[ ]`) 항목 — "`CCH-SE-02` 의 update dedup 이 미배선"(line 712) · "EIA 계열 Redis 키가 실행 엔진 §9.1/§9.2 키 레지스트리에 없다"(line 724) · "`readKey`/`hashBody` 경계값 테스트 부재"(line 703).
  - 충돌 대상: 오픈 PR `#1161`(`claude/cch-se02-dedup`, "spec 이 필수로 약속한 update dedup 이 통째로 미구현이었다 (CCH-SE-02)") · `#1160`(`claude/eia-redis-key-registry`) · `#1159`(`claude/eia-idem-key-boundary`, "readKey/hashBody 경계 + statusCode 범위").
  - 상세: `gh pr diff 1161 --name-only` 로 확인한 결과 그 PR 은 **바로 이 target 파일**(`plan/in-progress/backend-lint-gate-broken-on-main.md`)도 수정한다. 즉 같은 plan 파일이 두 세션에서 동시에 편집되고 있어, 먼저 push 하는 쪽이 다른 쪽을 stale 하게 만들거나 머지 충돌을 일으킨다. `#1160` 은 위 CRITICAL 항목의 원인이기도 하다.
  - 제안: push 직전 `git log origin/main` + 위 세 PR 상태를 재확인하라(메모리 `feedback_parallel_session_backlog_collision` 절차). 델타가 0(이미 해결됨)이면 target 문서의 해당 backlog 항목을 그대로 두지 말고 해당 PR 을 가리키는 서술로 정리하거나 제거한다.

- **[WARNING]** (기존 항목, 현재 spec 상태로 재확인 — 여전히 미해결) `spec/5-system/15-chat-channel.md` CCH-SE-02 가 서술하는 dedup 메커니즘이 `spec/5-system/14-external-interaction-api.md` EIA-AU-08 의 in-process 우회 아키텍처와 어긋난다
  - target 위치: line 712-723 backlog 항목.
  - 충돌 대상: `spec/5-system/15-chat-channel.md:88`(CCH-SE-02: "인터랙션 명령 처리는 EIA `Idempotency-Key` 를 어댑터가 자동 발급") vs `spec/5-system/14-external-interaction-api.md` §3.3 EIA-AU-08/§3.3.1(in-process trusted caller 는 HTTP 표면·`InteractionGuard`·`IdempotencyInterceptor` 를 아예 거치지 않음).
  - 상세: CCH-SE-02 문구는 EIA 의 `Idempotency-Key` 메커니즘(HTTP 헤더 기반, `IdempotencyInterceptor` 소재)이 chat-channel 의 in-process 호출 경로에도 적용된다고 암시하지만, EIA-AU-08 은 그 경로가 HTTP 표면 자체를 우회한다고 명시한다 — 즉 CCH-SE-02 가 그리는 메커니즘은 현재 아키텍처로는 문자 그대로 구현될 수 없고 **별도의 in-process dedup** 이 필요하다(target 문서의 자체 진단과 동일 결론). `spec/5-system/15-chat-channel.md` 는 이번 review 예산에서 본문이 절단돼 최신 서술을 프롬프트로는 확인하지 못했으나, 리포에서 직접 grep 한 결과 L88 문구는 그대로다.
  - 제안: 오픈 PR `#1161`(`chat-channel-dedup.service.ts` 신설)이 이 gap 을 다루는 것으로 보인다 — 병합 시 CCH-SE-02 문구가 "HTTP 인터셉터 재사용"이 아니라 "in-process 전용 dedup 서비스"로 SoT 가 갱신됐는지 planner 확인이 필요하다.

- **[INFO]** `execution-engine.md §9.1` "모든 Redis 키" 전칭 명제 문제는 target 문서가 적어 둔 것보다 범위가 크다는 사실이 PR #1160 에서 이미 실측됨
  - target 위치: line 724-732 ("키 하나만 §9.2 에 끼워 넣으면 목록이 더 이상해지므로…").
  - 충돌 대상: PR #1160 커밋 메시지(`a561e107e`) — 코드에서 추출한 13계열 Redis 키 중 `workspaceId` 세그먼트를 가진 키가 0개, `§9.2` phantom 키 2건(`core:{wsId}:rate:{userId}`·`ws:{wsId}:session:{connId}` — 실제로는 in-memory) 발견.
  - 상세: target 문서의 원래 서술("EIA 계열을 묶어 등재하거나 §9.1 의 '모든' 을 실제 범위로 좁히는 편")은 방향은 맞았으나 실제 착수해 보니 §9.1 규칙 자체가 전체 키 목록과 어긋나 있었다 — 정보로서만 남긴다(별도 조치 불필요, PR #1160 이 이미 처리 중).
  - 제안: 이 항목을 착수 재개할 필요는 없다 — PR #1160 병합 여부만 추적.

### 요약

target 자체가 정의하는 새 데이터 모델·API·요구사항 ID·상태 전이·RBAC 는 이번 라운드에 확인 가능한 범위(EIA `R8`/`EIA-IN-11`/`EIA-RL-02` 캐시 키 스코프, fail-open 축 분리)에서 `spec/5-system/14-external-interaction-api.md` 와 `spec/data-flow/15-external-interaction.md` 사이에 완전히 정합했다. 하지만 이번 라운드가 만든 **미커밋** spec 편집이 존재하지 않는 `spec/conventions/redis-keys.md` 를 참조해 `spec-link-integrity` 프론트엔드 게이트를 실측으로 깨뜨리고 있으며(재현 확인), 그 원인은 같은 EIA 영역을 동시에 건드리는 **병렬 미머지 오픈 PR 3건**(`#1159`·`#1160`·`#1161`)과의 충돌이다 — 그중 `#1161` 은 이 target plan 파일 자체를 함께 수정하고 있어 머지 순서 조율 없이 이대로 push 하면 문서·게이트 양쪽에서 충돌이 확정적이다. 나머지(chat-channel CCH-SE-02 아키텍처 불일치)는 이미 알려진 미해결 항목으로, 재확인 결과 여전히 유효하나 새로 발견된 것은 아니다.

### 위험도
HIGH
