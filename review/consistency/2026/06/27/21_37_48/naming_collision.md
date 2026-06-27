# 신규 식별자 충돌 검토 — EIA-NF-06 / EIA-NF-07

대상: `plan/in-progress/spec-draft-eia-seq-nfr.md` (→ `spec/5-system/14-external-interaction-api.md` §3.5)

## 발견사항

### 신규 식별자 인벤토리 (충돌 없음)
target 이 도입하는 새 식별자는 요구사항 ID 2개 뿐이다: `EIA-NF-06`, `EIA-NF-07`. 새로운 엔티티/타입명·API endpoint·이벤트명·환경변수·설정키·파일 경로는 도입하지 않는다 (코드/테스트 변경 없음, 기존 §3.5 표에 2행 추가 + §R7 말미 1문장).

- **[NONE] 요구사항 ID — 충돌 없음 (연속 채번)**
  - target 신규 식별자: `EIA-NF-06`, `EIA-NF-07`
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:150-154` 에 `EIA-NF-01`~`EIA-NF-05` 존재. `spec/` 트리 전체 및 `plan/` 전체에서 `EIA-NF-06`/`EIA-NF-07` 의 기존 사용처는 target 자신뿐 (grep 0건).
  - 상세: §3.5 표가 EIA-NF-05 까지 연속 채번돼 있고 06/07 은 빈 다음 슬롯이다. 의미 중복 없음.
  - 제안: 없음. 채번 정상.

- **[NONE] 참조 식별자 (`ExecutionSeqAllocator`, `exec:seq:<id>`, §R7, `EXECUTION_SEQ_TTL_SECONDS`) — 신규 아님, 기존 정의와 일치**
  - target 이 본문에서 인용하는 `ExecutionSeqAllocator.next()`, Redis `INCR exec:seq:<id>`, §R7 은 모두 기존 spec 의 정의를 그대로 참조한다 (`spec/5-system/6-websocket-protocol.md:106`, `spec/5-system/4-execution-engine.md:1093`, `spec/data-flow/15-external-interaction.md:133`, §R7 = `14-external-interaction-api.md:973`). 새 식별자를 만드는 것이 아니라 기존 계약을 NFR 로 인용하는 것이라 충돌 대상이 아니다.

- **[INFO] EIA-NF-06 본문의 §5.6 cross-reference 가 의미 불일치 (충돌은 아님)**
  - target 신규 식별자: `EIA-NF-06` 행 — "Redis `INCR` 의 원자성으로 보장 **(§5.6·§R7)**"
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:498` `### 5.6 동시성 / Lock (EIA-NF-05)` — 내용은 inbound interact 명령의 직렬화(`409 STATE_MISMATCH`, Idempotency-Key)이며 seq counter 의 INCR 원자성과 무관.
  - 상세: 신규 ID 충돌은 아니다. 다만 EIA-NF-06 이 근거 섹션으로 §5.6 을 가리키는데, §5.6 은 "명령 동시성 lock"(EIA-NF-05 소관)이라 의미가 다르다. seq 단조 유일성의 실제 근거는 §R7(및 §6-websocket-protocol §Rationale 의 Redis-only INCR 정책)이다. §5.6 인용은 독자를 엉뚱한 섹션으로 보낸다.
  - 제안: EIA-NF-06 행의 근거 참조를 `(§R7)` 단독, 또는 §R7 + §6-websocket-protocol(`ExecutionSeqAllocator` 정의처)로 정정. §5.6 은 제거 권장. (naming 관점 밖의 cross-ref 정확도 항목이므로 INFO — 상세 정합은 cross-ref/consistency 렌즈에서 재확인 권장.)

## 요약
신규 식별자 충돌 관점에서 target 은 깨끗하다. 도입하는 새 식별자는 요구사항 ID `EIA-NF-06`/`EIA-NF-07` 둘 뿐이며, 기존 §3.5 표의 EIA-NF-01~05 연속 채번의 다음 빈 슬롯으로 spec/·plan/ 어디에도 기존 사용처가 없다 (grep 0건). 새 엔티티·DTO·endpoint·이벤트·ENV·설정키·파일 경로는 도입하지 않고, 본문이 인용하는 `ExecutionSeqAllocator`/`exec:seq:<id>`/§R7 은 모두 기존 정의를 정확히 참조한다. 유일한 비충돌성 INFO 는 EIA-NF-06 본문이 근거로 §5.6(실제로는 명령-lock 섹션)을 가리키는 cross-reference 의미 불일치인데, 이는 식별자 충돌이 아니라 참조 정확도 사안이다.

## 위험도
NONE
