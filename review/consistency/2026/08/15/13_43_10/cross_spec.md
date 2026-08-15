# Cross-Spec 일관성 검토 — spec/5-system/ (--impl-prep, EIA DB↔wire invariant)

검토 대상 plan: `plan/in-progress/eia-db-wire-invariant.md` (spec_impact:
`spec/5-system/14-external-interaction-api.md`). 실제 착수 전 spec 상태를
`spec/5-system/14-external-interaction-api.md` 직접 열람(prompt 번들이 해당 파일을
컨텍스트 예산 초과로 생략했음 — 아래 INFO 참조) + `spec/conventions/node-cancellation.md`
+ `spec/5-system/4-execution-engine.md` + 하류 소비 spec(`15-chat-channel.md`,
`conventions/chat-channel-adapter.md`, `data-flow/15-external-interaction.md`,
`7-channel-web-chat/**`) 대조로 진행.

## 발견사항

- **[WARNING]** `node-cancellation.md` 의 §2.4 매트릭스·Rationale 이 `finalizeCancelledExecution` 의 guard 범위를 실제보다 완결된 것처럼 서술 — 이 plan 이 고치려는 결함(item①)과 다른 문서 두 곳의 서술이 어긋난다
  - target 위치: `plan/in-progress/eia-db-wire-invariant.md` §① (`finalizeCancelledExecution` 이 guarded UPDATE 결과를 안 읽고 무조건 `EXECUTION_CANCELLED` emit)
  - 충돌 대상: `spec/conventions/node-cancellation.md` L197 매트릭스 행("§2.4 park↔resume 짝 전이 terminal 가드" — `finalizeFailedExecution`·`failFirstSegmentSetup`·`executeSync` timeout 은 "mutation 6/6 검증" 으로 명시하면서 **`finalizeCancelledExecution` 은 이 검증 목록에서 빠져 있음**) + 같은 문서 L208-209 Rationale("`finalizeCancelledExecution` — … guarded UPDATE 가 **이미 terminal 인 행을 걸러낸다**" — 무조건적 서술, emit 단계가 그 결과를 소비하지 않는다는 한계는 언급 없음)
  - 상세: node-cancellation.md 를 단독으로 읽으면 "`finalizeCancelledExecution` 의 guarded UPDATE 가 이미 terminal 인 행을 걸러낸다" 라는 문장 때문에 이 경로도 형제 `finalizeFailedExecution` 과 대칭으로 완전히 가드된 것처럼 보인다. 그러나 실제로는 **DB 쓰기만 조건부(guarded)이고, 그 반환값(`false`=no-op)을 emit 결정에 쓰지 않는다** — 이 plan 이 "진짜 결함" 으로 특정한 지점이다. 결과적으로 DB 는 FAILED 인데 wire 는 CANCELLED 를 실어 나르는, 값(durationMs) 불일치보다 심한 **status 자체의 불일치**가 발생한다. 게다가 `15-chat-channel.md`(L60, L183, L686)·`conventions/chat-channel-adapter.md`(L576)·`data-flow/15-external-interaction.md`(L175) 는 모두 같은 단일 sink(`WebsocketService.executionEvents$`)에 대해 "EIA-RL-04(TX commit 후 발송) 정합" 을 근거로 신뢰성을 주장하는데, 그 문구가 실제로 담보하는 것은 **발송 순서**(commit 후에만 emit)뿐이며 **발송 내용이 그 트랜잭션이 실제로 커밋한 값과 같다는 보장은 아니다** — item① 은 정확히 이 간극을 파고든다. EIA §6.5 자신도 "이 문서의 관행대로 **알려진 갭은 invariant 옆에 적는다**" 는 원칙을 명시하고 실제로 retry-turn CANCELLED 재진입(item②)을 "알려진 예외 1건"으로 등재했지만, item①(status 자체가 틀리는 더 심한 케이스)은 §6.5 에도 어디에도 등재돼 있지 않다 — node-cancellation.md 의 애매한 문장이 그 결함을 "이미 처리됨"으로 착각하게 만드는 자리다.
  - 제안: item① 구현 완료 시 (a) `node-cancellation.md` L197 매트릭스에 `finalizeCancelledExecution` 을 명시적으로 추가하고 mutation 검증 결과를 적을 것, (b) L208-209 Rationale 문장을 "guarded UPDATE 가 이미 terminal 인 행을 걸러낸다(쓰기 차단) — **단 emit 은 이 결과를 소비하지 않아 wire 가 stale 상태를 실어 보낼 수 있었다(2026-08-XX 해소)**" 식으로, EIA §6.5 의 "(2026-08-15 해소)" 캐비엇과 같은 패턴으로 정정할 것. 구현 전(impl-prep) 단계이므로 지금 당장 spec 을 고칠 필요는 없으나, plan 체크리스트의 "spec §5.3·§6.5 동기" 항목에 `node-cancellation.md` L197/L208-209 갱신도 포함시킬 것을 권장.

- **[INFO]** impl-prep 번들이 실제 target 파일(`14-external-interaction-api.md`) 자체를 컨텍스트 예산 초과로 생략함
  - target 위치: `_prompts/cross_spec.md` L1931-1935 (`spec/5-system/14-external-interaction-api.md` 본문 106,550자 — "본문 생략됨" 처리)
  - 충돌 대상: 없음 (도구/orchestrator 이슈, spec 내용 자체의 충돌 아님)
  - 상세: `--impl-prep` 모드가 `spec/5-system/` 디렉토리 전체를 번들링하면서 15개 파일(정작 plan 의 `spec_impact` 가 가리키는 `14-external-interaction-api.md` 포함)이 예산 초과로 통째로 빠졌다. "여기 없다는 사실을 없다는 근거로 삼지 말라"는 프롬프트 지시에 따라 본 리뷰는 `Read` 로 해당 파일을 직접 열어 진행했으나, 이 메커니즘 자체가 반복되면 (특히 `--impl-prep` 이 항상 정작 바뀌는 대상 파일을 예산에서 밀어내는 경향이라면) 향후 검토자가 이 지시를 놓치고 "생략됨" 을 문자 그대로 받아들여 target 을 아예 못 보는 회귀가 재발할 수 있다.
  - 제안: cross-spec 대상 지정 시 `spec_impact` 로 명시된 파일은 예산 절단 대상에서 제외(우선 보존)하는 orchestrator 개선을 고려. (기존 메모리에 기록된 "consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다" 와 같은 계열의 결함.)

- 나머지 두 항목(②: retry-turn CANCELLED 재진입 `RETURNING` 추가, ③: REST `GET /api/external/executions/:id` 에 `durationMs` 추가)은 다른 spec 영역과 충돌 없음을 확인:
  - item②: `node-cancellation.md` 의 기존 Rationale("취소 시각 보존 메커니즘" — retry-turn 경로는 이미 SQL `COALESCE` 로 먼저 커밋된 값을 보존하도록 설계돼 있음, §"왜 취소 시각 보존 메커니즘이 두 가지인가")과 완전히 정합 — `RETURNING` 추가는 이미 존재하는 DB 쪽 보장을 wire 로 마저 반영하는 것뿐, 새 규칙 도입 아님.
  - item③: `spec/1-data-model.md`(`duration_ms` 필드, 채널 제약 없음), `spec/7-channel-web-chat/**`(3-auth-session.md·1-widget-app.md·5-admin-console.md — 모두 `getStatus`/§5.3 소비처지만 필드 목록을 자체적으로 재정의하지 않고 EIA §5.3 을 가리키기만 함), `spec/data-flow/15-external-interaction.md` 어디에도 §5.3 응답 필드 집합을 별도로 못박아 두지 않아 additive 필드 추가가 다른 문서와 충돌하지 않는다.

## 요약

이번 plan 의 실제 spec 영향 범위(`14-external-interaction-api.md`)는 다른 영역과 데이터 모델·API 계약·RBAC·요구사항 ID 축에서 직접 충돌하지 않는다. 유일한 실질 이슈는 `spec/conventions/node-cancellation.md` 의 §2.4 매트릭스·Rationale 이 `finalizeCancelledExecution` 의 guard 완결성을 실제보다 넓게(cross-spec 하류 3개 문서의 "EIA-RL-04 정합" 주장까지 포함해) 서술하고 있어, plan 이 고치는 진짜 결함(item①)이 이 문서만 보면 이미 처리된 것처럼 읽힌다는 점이다 — 코드 수정과 함께 이 서술도 정정해야 "spec 이 구현보다 넓은 보장을 문서화" 하는 패턴이 재발하지 않는다. 그 외에는 impl-prep 착수를 막을 만한 CRITICAL 충돌이 없다.

## 위험도
LOW
