# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-decide-webchat-execution-residuals.md` (spec draft 검토, `--spec`)
비교 대상 Rationale: `spec/5-system/4-execution-engine.md`, `spec/5-system/14-external-interaction-api.md`,
`spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/3-auth-session.md`

> 참고: 호출 payload(`_prompts/rationale_continuity.md`)에 첨부된 "관련 Rationale 발췌" 번들은 크기 상한으로
> `spec/2-navigation/*` 대까지만 담기고 정작 대상과 직접 관련된 `spec/5-system/*`·`spec/7-channel-web-chat/*` 의
> Rationale 은 누락돼 있었다(`... (truncated due to size limit) ...`). 이번 검토는 그 누락을 보완하기 위해 위
> 4개 spec 파일을 worktree 에서 직접 Read 하여 실제 최신 `## Rationale` 본문과 대조했다.

## 발견사항

- **[CRITICAL]** B-2 backstop 메커니즘이 execution-engine 이 명시적으로 기각한 "신규 주기 스캐너" 대안을 재도입
  - target 위치: `plan/in-progress/spec-decide-webchat-execution-residuals.md` §"(B) 설계" > "B-2 (backstop)" > **메커니즘(참고, developer 결정)** 단락 (108~110행: *"주기적 scheduled job(cron/BullMQ repeatable) — 부팅 1회 `recoverStuckExecutions`(§7.4, boot-only)와 **별개**(idle 는 운영 중 상시 발생)"*), 동일 취지가 "구현 위임 메모" 2번(219행: *"서버(backend EIA): 주기 scheduled job 으로 … 회수"*)에도 반복
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale`
    - "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2/§7.5, PR3, 2026-07-04)" 항목의 **기각 대안** (1352행): *"(b) recovery loop 주기적 스캔 추가 — 부팅 트리거로 재시작 resume 은 성립하고 운영 중 크래시는 PR4 stalled 가 본령이라 범위 밖."*
    - "orphan pending backstop — recoverStuckExecutions 재사용 + PENDING cancel (2026-07-04)" 항목 (1597행): *"같은 함수·트리거 재사용(별도 스캐너·주기 tick 없음): `recoverStuckExecutions`(§7.4, `onApplicationBootstrap` 1회 + 전역 lock)에 pending 스캔을 더한다. §7.1/§7.4 가 **반복 확정한** 'heartbeat → stalled-job 일원화, 신규 주기 스캐너 미도입' 원칙 유지 — orphan pending 도 boot-only best-effort(낮은 확률 엣지)."*
  - 상세: execution-engine 은 "실행 상태가 stale 해졌을 때 이를 회수한다"는 동일 문제 클래스(크래시 복구·orphan-pending 회수)에서 **두 번** 별도 주기 스캐너 도입을 검토했고, **두 번 다 기각**하고 대신 (i) BullMQ 네이티브 stalled-job 검출(런타임 중 job 이 실존하는 경우), (ii) 부팅 1회 `recoverStuckExecutions` backstop(그마저 없는 경우, "낮은 확률 엣지" 로 정밀도를 낮춰 수용)로 수렴시켰다. 이는 1회성 코드 스타일 선택이 아니라 "§7.1/§7.4 가 반복 확정한" 문구로 스스로 명명한 **엔진 전역 아키텍처 원칙**이다. target 의 B-2 는 구조적으로 완전히 같은 문제(대기 execution 이 DB 상 stale 해졌는지 판정 + 회수)를 다루면서, 정확히 그 기각된 대안(신규 주기 스캐너)을 다시 채택한다. "idle 은 운영 중 상시 발생" 이라는 정당화는 두 항목 중 어느 것도 인용·반박하지 않는다 — 특히 orphan-pending 배경 문단이 이미 "cap timeout 은 언제든 발생할 수 있는 운영 중 이벤트"라는 동일 성격의 사례에서 boot-only 를 채택했음을 감안하면, "운영 중 상시 발생" 자체는 이 principle 을 우회할 근거가 되지 못한다(park 상태(`waiting_for_input`)는 애초에 BullMQ job 이 없어(430행 "park 상태: 큐 엔트리 없음") stalled-job 검출이 원리적으로 적용 불가하다는 점은 boot-only 만으로 충분한지에 대한 **진짜** 기술적 논쟁거리이지만, target 은 이 논쟁을 하지 않고 그냥 원칙을 우회한다).
  - 제안: 아래 중 하나를 명시적으로 선택하고 Rationale 을 쓴다.
    1. **원칙 준수**: B-2 도 boot-only backstop(`recoverStuckExecutions` 확장 또는 그 패턴 재사용)으로 설계하고, "장기 미재시작 self-host 배포에서 회수가 지연될 수 있음"을 수용 가능한 trade-off 로 명시.
    2. **원칙의 의도적 예외**: 신규 주기 job 이 불가피하다면 그 이유(= park 상태엔애초에 BullMQ job 자체가 없어 §7.1 의 "heartbeat→stalled-job 일원화" 전제가 성립하지 않는다는 구조적 차이)를 R-B2 에 명시하고, `4-execution-engine.md` 의 "신규 주기 스캐너 미도입" 원칙 Rationale 항목 자체에도 "단, job 이 존재하지 않는 park 상태의 client-abandonment 회수는 예외"라는 1줄을 **함께** 갱신해 향후 재대조 시 재충돌하지 않게 한다.
    현재 상태(참고/developer 결정으로 남겨둔 채 원칙 언급 없음)로 developer 세션에 넘기면, developer 는 이 principle 의 존재를 모른 채 구현할 공산이 크고, 이후 `/ai-review`·`/consistency-check` 에서 뒤늦게 재발견되어 재작업 비용이 커진다.

- **[WARNING]** §7.4 무기한 보존 invariant 의 "workflow 정의 timeout" carve-out 을 "channel 정의 timeout" 으로 조용히 확장
  - target 위치: `plan/in-progress/spec-decide-webchat-execution-residuals.md` §"불변식과의 관계" 항목 1 (121~127행), §"변경안" (3) (192~193행: *"불변식 본문은 무변경 — carve-out 이 이미 허용됨을 명시"*)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` 930행: *"`status='waiting_for_input'` 은 무기한 보존 — 사용자 입력은 며칠 후 도착할 수도 있고, **노드별 `formConfig.timeout` 등 워크플로우 정의된 별도 timeout** 이 적용된다."*
  - 상세: 원문의 carve-out 은 "**워크플로우 정의**(노드 config 로 사용자가 설정) timeout" 으로 스코프가 명확히 좁다 — 워크플로우 작성자가 그 노드에 명시적으로 건 시간 제한이라는 뜻이다. target 의 B-2 는 이와 성격이 다른 **엔진/채널 레벨 정책**(워크플로우 정의와 무관하게 `auth_config_id IS NULL` 이라는 트리거 속성만으로 전 워크플로우에 일괄 적용)이다. target 의 R-B2/"불변식과의 관계" 는 논증 자체는 설득력 있지만(토큰 영구 만료 = provably un-continuable, "genuinely waiting" 을 죽이지 않음), §7.4 원문이 이미 이 케이스를 "허용하고 있었다"고 서술하는 것은 사실과 다른 소급 해석이다 — carve-out 의 적용 **범위를 새로 넓히는** 결정이지, 기존 문구가 이미 포괄하던 것이 아니다. "불변식 본문은 무변경" 방침(변경안 (3))도 이 미스매치를 그대로 남긴다 — 이후 §7.4 만 읽는 독자는 "워크플로우 정의" 라는 문구를 보고 B-2 backstop 의 존재를 유추할 수 없다.
  - 제안: §7.4 edit 시 "정합 note" 를 단순 cross-ref 1줄이 아니라, "무기한 보존의 carve-out 은 **워크플로우 정의 timeout** 뿐 아니라 **채널이 판정하는 provably un-continuable 상태**(§B-2, EIA 참조)도 포함한다"는 취지로 **원문 문구 자체를 소폭 확장**할 것을 권장. 최소한 R-B2 안에 "이는 §7.4 원문이 이미 허용한 것이 아니라 carve-out 차원을 워크플로우 정의에서 채널 정의로 **확장하는 신규 결정**"이라고 명시적으로 인정하는 한 문장을 추가.

## 요약

target 은 대체로 Rationale 연속성을 잘 지킨다 — (a) widget-app.md §3.1 "새 대화는 명시 종료를 보내지 않는다"는 기존 서술을 뒤집으면서 R-B1 이라는 새 Rationale 을 명시적으로 작성했고, (b) `spec-draft-pr874-deferred-docs.md` 가 이미 확정한 "R7 은 신규 결정이 아닌 산문 승격" 경계를 존중해 새 결정(coalesce/cancel)을 R7 이 아닌 신규 R9 로 분리했으며, (c) R-A2 의 webhook Idempotency-Key 기각은 EIA-IN-11(별개 표면인 `/interact` 의 Idempotency-Key)과 충돌하지 않는 정확한 스코핑이다. 다만 B-2 backstop 의 구현 메커니즘으로 제시된 "신규 주기 scheduled job" 은 `4-execution-engine.md` Rationale 이 두 차례(§7.1/§7.4 크래시 복구, orphan-pending 회수) 명시적으로 검토·기각한 "recovery loop 주기적 스캔 추가" 대안을 근거 논쟁 없이 재도입하는 것으로 읽힌다 — 원칙을 우회할 만한 구조적 차이(park 상태엔 BullMQ job 자체가 없음)가 실제로 존재하긴 하지만 target 문서가 그 논증을 하지 않는다. 이 한 건이 이번 검토의 핵심 리스크이며, 나머지는 §7.4 carve-out 문구 확장에 대한 소급 서술 정정 정도의 경미한 보완 사항이다.

## 위험도
HIGH
