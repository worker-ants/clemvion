# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(재시도 필요 항목 없음), CRITICAL 발견 0건. 다만 rationale_continuity 가 낸 WARNING 1건은 이 fix 가 표적으로 삼은 결함 자체가 재발할 수 있다는 지적이라 구현 착수 전 §A 체크리스트 보강을 강력 권고한다.

## 전체 위험도
**MEDIUM** — rationale_continuity 가 지적한 `chatChannel.inboundSigningRef` presence 재계산 누락 위험이 이번 fix 의 핵심 목적(lost-update 재발 방지)과 직결되어 다른 LOW/NONE 항목보다 가중치를 둔다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 발견이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | §B "config 를 락 안에서 다시 읽어 이번 결과를 머지" recipe 가 top-level `config` 재읽기만 명시하는데, 실제 결함은 `chatChannel` 서브키(whole-key-replace) 안의 `inboundSigningRef` presence 게이트(`inboundSigningRefSurvives = providerIssuedStored \|\| Boolean(preservedInboundSigningRef)`)에 있다. recipe 를 문자 그대로 적용하면 이 fix 가 닫으려는 정확히 그 fail-open 이 재발할 수 있다 | `plan/in-progress/trigger-config-lost-update.md` §B, §A 체크리스트 | `spec/5-system/15-chat-channel.md` R-CC-21 ("trigger.config 에서 읽으면 안 된다, 병합 전에 캡처해 넘긴다") + `chat-channel-binder.service.ts:92-95,167-186,185-186,226-229` | §A 체크리스트에 "재읽은 `chatChannel.inboundSigningRef`(또는 presence)로 `inboundSigningRefSurvives` 를 락 안에서 재계산" 명시. `rotateBotToken`(3번 쓰기 지점, `triggers.service.ts:1064-1088`)도 동일 패턴이라 같은 재조율 필요 |
| 2 | naming_collision | 신규 advisory lock key `trigger-config:<id>` 가 `{도메인}:{식별자}` 형태로 Redis 키 명명 컨벤션과 겉모양이 같지만 실체는 Postgres `pg_advisory_xact_lock(hashtext(...))` 입력 문자열(Redis 비경유) — `redis-keys.md` §4 "인접 네임스페이스" 절이 정확히 이런 혼동을 막기 위한 절인데 자매 사례(`exec-cap:<workspaceId>`)조차 미등재라 갭을 그대로 상속 | plan §B (lock key 설계) | `spec/conventions/redis-keys.md` §3 인벤토리 형태 / §4 인접 네임스페이스 절 | 구현 시 `redis-keys.md` §4 표에 `exec-cap:<workspaceId>` + 신규 `trigger-config:<id>` 를 "Postgres advisory-lock hashtext 입력 (Redis 아님)" 한 줄로 등재. 최소한 코드 주석에 "이 문자열은 Redis 키가 아니다" 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | PG advisory lock 키 네임스페이스 전역 인벤토리 문서 부재 (Redis 는 `redis-keys.md` 가 있는데 advisory lock 은 없음) | `spec/5-system/4-execution-engine.md` §8/§Rationale | 이번 수정 자체는 spec 권한 밖. 후속 planner 턴에서 대칭 절 신설 검토 근거로 기록 |
| 2 | cross_spec | `inboundSigning` PATCH 회전 정책의 기존 spec 내부 자기모순(표 서술 vs 2026-09-10 각주)이 이번 수정 범위(`inboundSigningRef`, `setupChatChannel` 경로)와 겹침 — 사실이면 telegram 한정이 아니라 전 provider 노출 | `spec/5-system/15-chat-channel.md` §5.4.1.1 line 447,450 | e2e 재현(§C)을 slack/discord 채널로도 1건 커버해 파급 범위 함께 검증 (권고, 강제 아님) |
| 3 | rationale_continuity | Cafe24 advisory lock 기각 사례(`4-integration.md` "외부 HTTP 를 트랜잭션 안에 묶어야 함")와 본 plan 설계(외부 호출을 락 밖에 분리)는 실질 충돌 아니나, 나란히 대조하지 않으면 "이 저장소는 advisory lock 을 이미 기각했다"는 오해 가능 | plan §B | plan 본문에 "cafe24 사례는 외부 호출을 락 안에 두는 설계였기 때문에 기각됐고, 본 설계는 그 축을 분리했다" 한 문장 추가 (선택) |
| 4 | rationale_continuity | `SecretResolver.rotate` 빈 값 가드를 범위 밖으로 미룬 것은 R-CC-21 "별도로 검토" 방향과 정합 (번복 아님) | plan 「하지 않는 것」 | 조치 불요, 기록 목적 |
| 5 | convention_compliance | 번들 예산 절단으로 `spec/5-system/` 15개 파일·`spec/conventions/` 대부분(특히 카탈로그 하위 트리)이 미검증 — 가장 밀접한 `15-chat-channel.md`·`chat-channel-adapter.md` 는 직접 Read 로 보완했으나 나머지는 미확인 | 오케스트레이터 `_prompts/convention_compliance.md` 번들링 | plan 이 명시 인용하는 spec/convention 파일을 예산 절단 최후순위로 미루거나 별도 청크 강제 포함 검토 (하네스 개선 항목) |
| 6 | plan_coherence | 본 plan 이 위임받아 해소하는 원 트래커 항목이 `spec-draft-nullable-notation-followups.md:2278` 에 아직 `[ ]` 로 열려 있음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2278-2293` | 본 plan 종결 커밋에서 원 트래커 항목도 `[x]` + "창이 셋이었다" 각주로 동시 갱신 (이미 plan 에 계획됨 — 누락 방지 재확인) |
| 7 | plan_coherence | `4-integration.md` 의 "advisory lock + 외부 HTTP" 반대 선례를 본 plan 이 인용하지 않음 (실질 충돌은 아님, plan_coherence 관점 중복) | `spec/2-navigation/4-integration.md:1443-1446` | PR 설명 또는 plan §B 에 대조 한 줄 (WARNING #1과 별개로 plan_coherence 축에서도 동일 권고 — 중복 제거 시 하나로 통합) |
| 8 | naming_collision | `pg_advisory_xact_lock(hashtext(...))` 전역 32비트 키 공간을 `exec-cap:*` / `trigger-config:*` 두 계열이 접두어만 다르게 공유 — 정확성 버그는 아니나 우연 충돌 시 원인 추적 어려움 | `execution-engine.service.ts:2974` vs plan §B 신규 키 | 급하지 않음. 여유 있으면 `pg_advisory_xact_lock(key1, key2)` 2-int 오버로드로 class-id/instance-id 분리. 채택 안 하면 "계열 2개 기준 수용" 을 커밋 메시지에 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | advisory lock 선례·botTokenRef/inboundSigningRef 비대칭·서비스 호출 방향·API 계약·데이터 모델 대조 전부 정합. INFO 2건(advisory lock 문서 부재, 기존 spec 내부 회전정책 모순) |
| rationale_continuity | MEDIUM | WARNING: recipe 가 top-level 만 다뤄 `chatChannel` 서브키 presence 게이트 재조율 누락 시 표적 결함 재발 가능 |
| convention_compliance | LOW | 검증 가능했던 범위(주요 파일 직접 Read)에서 위반 없음. 번들 절단으로 커버리지 한계 |
| plan_coherence | LOW | 원 트래커 위임 정합, 선행조건 충족 확인됨. 절차 위생(트래커 동시 갱신, 선례 대조) 권고만 |
| naming_collision | LOW | WARNING: lock key 가 Redis 키 모양이지만 아님(문서 미등재). INFO: 전역 lock ID 공간 공유 |

## 권장 조치사항
1. (최우선, WARNING #1 해소) §A 체크리스트에 "락 안에서 재읽은 `chatChannel.inboundSigningRef` presence 로 `inboundSigningRefSurvives` 재계산" 명시 — `rotateBotToken` 3번 쓰기 지점 포함.
2. (WARNING #2 해소) `redis-keys.md` §4 에 `trigger-config:<id>` + 기존 `exec-cap:<workspaceId>` 를 "Postgres advisory-lock 입력, Redis 아님"으로 등재하거나 코드 주석으로 명시.
3. plan §B 에 Cafe24 advisory lock 기각 선례와의 대조 한 줄 추가 (재논쟁 예방, 선택).
4. 본 plan 종결 시 `spec-draft-nullable-notation-followups.md:2278` 원 트래커 항목을 같은 커밋/세션에서 `[x]` 처리.
5. (선택) e2e 재현을 slack/discord provider 로도 1건 확장해 기존 spec 내부 회전정책 모순의 실제 파급 범위 검증.
