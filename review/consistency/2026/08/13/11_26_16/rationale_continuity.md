STATUS=success rationale_continuity 검토 완료 — CRITICAL 0 / WARNING 0 / INFO 1

===REPORT_MARKDOWN_BELOW===

# Rationale 연속성 검토 — spec/5-system/ (CCH-SE-02 dedup 도입)

## 검토 범위 확정

prompt 번들에서 `spec/5-system/14-external-interaction-api.md` 및 diff 본문이 컨텍스트 예산 초과로 절단되어 있어, `git diff origin/main...HEAD` 를 직접 실행해 실제 변경분을 확인했다. 이번 target 의 실질 spec 변경은 다음 4개 파일에 국한된다:

- `spec/5-system/15-chat-channel.md` — CCH-SE-02 요구사항 재서술 + 신규 `### R-CC-20` Rationale 추가
- `spec/4-nodes/7-trigger/providers/telegram.md` — "미구현 (Planned)" → "구현됨" 갱신 + 정정 각주
- `spec/conventions/redis-keys.md` — `cc:dedup:<triggerId>:<updateId>` 키 등재
- `spec/data-flow/14-chat-channel.md` — dedup Redis 키 data-flow 행 추가

대응 코드: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` (신규), `hooks.service.ts` (배선), `chat-channel.module.ts` (DI 등록).

## 발견사항

- **[INFO]** 신규 Rationale 항목 삽입 위치가 파일 끝이 아니라 기존 마지막 항목 앞
  - target 위치: `spec/5-system/15-chat-channel.md:710` (`### R-CC-20`)
  - 과거 결정 출처: 같은 문서의 `### R-CC-19`(`spec/5-system/15-chat-channel.md:720`, origin/main 기준 파일 최종 Rationale 항목)
  - 상세: `R-CC-20` 이 기존 최종 항목이던 `R-CC-19` 바로 앞에 삽입되어, 번호(20 > 19)와 문서상 등장 순서(20 이 19 보다 먼저)가 어긋난다. 내용 자체는 R-CC-19 와 상호 참조 관계가 없고 충돌도 없어 실질적 혼선은 없으나, "새 Rationale 은 이력 순으로 뒤에 붙는다"는 암묵적 관례에서 벗어난다. (참고: 이 문서에는 `R-K` 가 `R-CC-12`/`R-CC-13` 사이에 끼어있는 기존 전례가 있어 완전히 새로운 패턴은 아니다.)
  - 제안: `R-CC-20` 을 `R-CC-19` 뒤로 옮기거나(파일 끝에 append), 혹은 번호를 `R-CC-21`(다음 가용 번호)로 재부여해 순서·번호 정합을 맞출 것을 권장. 기능적으로 급하지 않음.

## 정합성 확인 (충돌 없음으로 판정한 근거)

1. **기각된 대안의 재도입 여부** — 없음. 신규 `R-CC-20` 은 "EIA `Idempotency-Key` 재사용" 이라는 이전 CCH-SE-02 원문의 함의를 폐기하고 전용 `ChatChannelDedupService` 를 채택하지만, 이 "EIA 재사용" 은 과거에 명시적으로 채택·기록된 결정이 아니라 요구사항 문면의 모호한 서술(dead field, 구현 0건)이었다. `git show origin/main:spec/5-system/15-chat-channel.md` 로 확인한 결과 CCH-SE-02 항목에는 전용 Rationale 이 없었다 — 즉 "번복"이 아니라 "미구현 요구사항의 최초 구체화"에 해당한다.
2. **합의된 원칙 위반 여부** — 없음. 신규 게이트는 기존 확립된 원칙들과 정합적으로 배선됐다:
   - `R-CC-12`(202 Accepted 고정 계약): dedup skip 도 동일하게 `202 { executionId: 'ignored' }` 를 반환 — 계약 유지.
   - `EIA-AU-08` / `§3.3.1`(in-process trusted caller 는 HTTP 표면·`IdempotencyInterceptor` 를 거치지 않음) — `R-CC-20` 의 "HTTP 인터셉터로 못 막는다" 서술과 정확히 일치 (`spec/5-system/14-external-interaction-api.md:76,96,98-106`).
   - `EIA §R8` "캐시 키 스코프"(HTTP `Idempotency-Key` 캐시는 `interactionId:route:key` 스코프이며 execution 단위) — chat-channel in-process 호출은 애초에 이 캐시 경로에 진입하지 않으므로 R8 과 모순 없음, 오히려 R8 자체가 그 경계를 뒷받침.
   - `R-CC-19`(rate-limit skip+degraded, fail-open 정책) 과 fail-open 정책이 동일 — 신규 dedup 서비스도 Redis 미가용 시 fail-open(+warn)으로 동일 계열의 관용구를 따름.
   - 코드 배선 순서(`parseUpdate` → dedup → rate-limit → `enrichInbound`)가 `spec/5-system/15-chat-channel.md` 의 CCH-NF-03 구현 서술("CCH-SE-02 dedup 게이트를 통과한 뒤")과 `hooks.service.ts:328-362` 실제 순서가 정확히 일치함을 코드에서 직접 확인.
3. **결정의 무근거 번복 여부** — 없음. CCH-SE-02 문면 변경 + `telegram.md` 의 "미구현→구현됨" 전환 모두 새 `R-CC-20` 이 동반되었고, `R-CC-20` 은 실제 이력(파서 3종이 채우기만 하고 read 처 0건이었던 dead field)에 근거한다 — 지어낸 대안이 아니라 `git log`/코드로 검증 가능한 과거 상태를 인용한다. `CHANGELOG.md` Unreleased 항목도 동일 서사로 정합.
4. **암묵적 가정 충돌 여부** — 없음. `conventions/chat-channel-adapter.md §1.1` 의 `sendMessage` "dedup 책임은 caller (EIA 의 seq + X-Clemvion-Delivery)" 는 **outbound** 메시지 중복 발송 방지이고, 금번 신규 `ChatChannelDedupService` 는 **inbound** update 재도착 억제로 방향이 다르다 — 두 dedup 개념이 이름만 유사할 뿐 서로 다른 자원(outbound seq 기반 vs inbound update_id 기반)이라 혼동·충돌 소지가 낮다.

## 요약

이번 target 변경(`CCH-SE-02` dedup 구현)은 Rationale 연속성 관점에서 위반 사항이 없다. 과거에 정식으로 채택된 대안을 재도입하지도, 확립된 원칙(202 고정 계약·in-process trusted caller 의 HTTP 인터셉터 우회·fail-open 관용구)을 어기지도 않았으며, 요구사항 문면의 모호성을 걷어내는 변경에 새 Rationale(`R-CC-20`)을 정확히 동반했고 그 근거는 실제 코드/이력으로 검증 가능하다. 유일한 지적 사항은 신규 Rationale 항목의 문서 내 삽입 위치(마지막 기존 항목보다 앞)가 번호·순서 정합에서 약간 어긋난다는 문서 위생 수준의 INFO 이며, 기능적 리스크는 없다.

## 위험도

LOW
