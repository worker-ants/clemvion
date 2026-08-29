# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 모두 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**LOW** — `spec/5-system/` (특히 EIA §R8 Idempotency-Key 캐시 스코프) 는 인접 spec·conventions·plan 전 축에서 정합했고, 이번 turn 의 실제 변경(`idempotency.interceptor.ts` 의 `resolveCacheHit()` 추출)도 순수 구조 리팩터로 spec 표면에 새 식별자를 노출하지 않았다. Critical/Warning 없음, INFO 4건만 존재.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 발견 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `idempotencyKey`/`Idempotency-Key` 용어가 EIA(전체 응답 캐시, execution·route 스코프)와 chat-channel(`cc:dedup:{triggerId}:{idempotencyKey}`, 30초 재도착 억제 마커)에서 스키마·TTL·목적이 전혀 다른 두 메커니즘에 재사용됨. 각각 `redis-keys.md` 인벤토리에 별도 SoT 로 이미 분리 등재되어 있어 데이터 모델 충돌은 아니나 나란히 읽는 개발자가 혼동할 여지 | `spec/5-system/14-external-interaction-api.md` §R8 vs `spec/data-flow/14-chat-channel.md` §2.2 | 필수 아님. 여유 있으면 `spec/conventions/redis-keys.md` 인벤토리 표에 "동명이의 — 스키마·TTL 상이" 각주 추가 |
| 2 | convention_compliance / naming_collision / rationale_continuity / plan_coherence (공통) | 번들 컨텍스트 예산 초과로 `spec/5-system/` 15개 파일 중 12개(`4-execution-engine.md` 전문·`6-websocket-protocol.md`·`12-webhook.md`·`13-replay-rerun.md` 등)가 절단됨. 이번 회차는 절단분 중 EIA(§14) 와 그 직접 인용 대상만 저장소에서 직접 `Read` 로 보완했고, 그 밖 영역(RAG·MCP·chat-channel 상세, node 카탈로그, WS 프로토콜 등)의 규약·Rationale·plan 정합은 이번 회차에서 실측하지 못함 | 프롬프트 상단 "생략된 파일" 목록 | 조치 불요(orchestrator 예산 정책). 향후 EIA 외 `5-system/*` 영역(실행 엔진 seq, WS 프로토콜 등)에 손대는 작업이면 그 시점에 별도 재검증 필요 |
| 3 | plan_coherence | `resolveCacheHit()` 추출은 `plan/in-progress/backend-lint-gate-broken-on-main.md` L806 "6번째(→실측 7개) 분기 발생 시 재검토" 조건부 유예 항목을 정확히 이행한 것 — 미해결 결정 우회 없음. 다만 이번 turn 완료 후 plan 체크박스가 아직 닫히지 않음 | `plan/in-progress/backend-lint-gate-broken-on-main.md` L806-809 | 이번 turn 완료 시 해당 체크박스를 `[x]` 로 닫고 커밋 SHA·라운드 식별자를 그 항목 아래에 기록. 새 plan 파일 생성/중복 기록 금지 |
| 4 | convention_compliance (+ rationale_continuity 관찰) | 코드 diff(`idempotency.interceptor.ts`) 의 `resolveCacheHit()` 호출부에서 `redisKey`/`bodyHash` 필드가 뒤바뀐 것으로 보이는 지점을 두 checker 가 각각 관찰함(convention_compliance: "로직 결함으로 보이는 지점" 명시 / rationale_continuity: 두 차례 열람 사이 해당 파일의 diff 해시가 바뀌어 동시 편집 중임을 관찰). spec/regulation 범위 밖이라 두 checker 모두 등급을 매기지 않았음 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`resolveCacheHit()` 호출부) | **아래 §INFO #4 정정 참조 — 결함이 아니라 구현자가 주입했다 되돌린 뮤턴트다. 후속 조치 불요.** |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 캐시 키 형식·대상 정책·에러 코드·응답 봉투·인증 경계·상태 코드 매핑 전 축 일치. `idempotencyKey` 동명이의 INFO 1건 |
| rationale_continuity | NONE | EIA 캐시 스코프 결정의 근거·기각 대안·선례 인용이 완료 plan 과 현재 spec 에 정확히 보존됨. `1-auth.md`/`3-error-handling.md` Rationale 도 번복 없음 |
| convention_compliance | NONE | 명명·출력 포맷·문서 구조·API 문서·금지 항목 5관점 모두 규약 위반 없음. 코드 필드 스왑 의심 지점은 범위 밖으로 별도 언급만 |
| plan_coherence | NONE | 이번 diff 는 선행 plan 이 조건부 승인해 둔 리팩터를 정확히 이행. 다른 EIA 계열 plan 과 충돌 없음. plan 체크박스 마감만 남음 |
| naming_collision | NONE | 신규 식별자(`CacheLookup`, `resolveCacheHit`) 모두 단일 파일 private 스코프, 신규 endpoint·이벤트·ENV var·spec 경로 없음 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical/Warning 없음)
2. ~~`code-review-agents`(`/ai-review`) 단계에서 `idempotency.interceptor.ts` 의 `resolveCacheHit()` 호출부 `redisKey`/`bodyHash` 필드 순서를 반드시 확인~~ → **아래 §INFO #4 정정으로 철회.** 실제 로직 버그가 아니다.
3. 이번 turn 완료 후 `plan/in-progress/backend-lint-gate-broken-on-main.md` L806 체크박스를 `[x]` 로 닫고 완료 근거(커밋 SHA) 기록 (INFO #3). — **이행함.**
4. 여유가 되면 `spec/conventions/redis-keys.md` 인벤토리에 `idempotencyKey` 동명이의 각주 추가 (INFO #1, 필수 아님). — spec 쓰기라 `project-planner` 영역. 이번 PR 범위 밖으로 두고 조치하지 않는다.

---

## ⚠️ INFO #4 정정 (구현자, 리포트 수령 후) — 그 "필드 스왑" 은 뮤턴트다

**INFO #4 는 코드 결함이 아니다.** 두 checker 가 본 것은 구현자가 **17:24~17:26 사이 의도적으로
주입했다 되돌린 뮤테이션 테스트용 뮤턴트**다 — `CacheLookup` 의 `redisKey` ↔ `bodyHash` 를 서로
바꿔 넣어 "위치 인자였다면 타입이 못 잡는다" 는 docstring 근거를 검증한 것이고, **spec 테스트
13건이 죽는 것**을 확인한 뒤 즉시 원복했다(그 실측 때문에 해당 docstring 근거는 오히려
"타입 안전이 아니라 가독성" 으로 다시 쓰였다).

**현재 트리는 원복돼 있다** — 호출부는 `{ redisKey, bodyHash, context, next }` 이고 순서 왜곡이
없다. 따라서 `/ai-review` 트랙에 넘길 후속 항목이 아니다.

**이 라운드의 판정이 그럼에도 유효한 이유**: (a) 두 checker 모두 이 관찰에 등급을 매기지
않았고 위험도를 NONE 으로 냈다, (b) 필드 스왑은 명명·출력 포맷·문서 구조·API 문서·금지 항목
다섯 관점 중 **어느 것도 가릴 수 없는** 성질이라 다른 발견을 masking 하지 않는다, (c) spec
대조 축(캐시 키 형식·대상 정책·에러 코드·응답 봉투·인증 경계)은 코드가 아니라 spec 본문을
읽어 판정했으므로 코드 상태와 무관하다.

**교훈 — 워크트리를 읽는 에이전트가 도는 중에 그 워크트리를 뮤테이션하지 말 것.**
`rationale_continuity` 는 두 차례 열람 사이 **diff 해시가 바뀐 것**까지 관찰했다. 즉 오염은
한 checker 에 그치지 않고 라운드 전체의 신뢰도를 깎는다. 뮤테이션은 리뷰/체커 실행과 시간대를
겹치지 않게 배치하고, 부득이 겹쳤다면 이번처럼 리포트에 정정을 남긴다.
