# Rationale 연속성 검토 — CCH-SE-02 dedup (spec/5-system/15-chat-channel.md 외)

## 검토 대상 diff 요약
- `spec/5-system/15-chat-channel.md`: CCH-SE-02 문면을 "EIA `Idempotency-Key` 어댑터 자동 발급"에서 "전용 `ChatChannelDedupService` (Redis `SET NX EX 30`)"로 교체 + CCH-NF-03 본문에 게이트 순서(dedup → rate-limit) 갱신 + 신규 `### R-CC-20` Rationale 항목 추가.
- `spec/4-nodes/7-trigger/providers/telegram.md`: "미구현 (Planned)" → "구현됨 (2026-08-13)"로 갱신, 옛 서술("dead field")이 정확했음을 명시하는 후속 note 추가.
- `spec/data-flow/14-chat-channel.md`: Redis 키 표에 `cc:dedup:{triggerId}:{idempotencyKey}` / `cc:rl:{triggerId}:{conversationKey}` 행 추가.

## 발견사항

- **[INFO]** R-CC-20 내부 교차링크가 실제 앵커와 불일치
  - target 위치: `spec/5-system/15-chat-channel.md` `### R-CC-20` 마지막 항목 — `provider 는 webhook 이 2xx 를 못 받으면 같은 update 를 재전송한다([R-CC-12 (b)](#r-cc-12-telegram-safe-2xx))`
  - 과거 결정 출처: 같은 문서 `### R-CC-12. Inbound HTTP Contract — \`202 Accepted\` 고정 + \`401\` (auth) / \`404\` (endpointPath) 예외`
  - 상세: 링크 텍스트가 가리키는 슬러그 `#r-cc-12-telegram-safe-2xx` 는 실제 R-CC-12 헤딩에서 생성되는 앵커(`#r-cc-12-inbound-http-contract-...`)와 일치하지 않는다. 내용상 인용은 정확(§(b) 텔레그램 2xx 재전송 근거)하지만 앵커가 깨져 있어 렌더러에 따라 클릭 시 항목으로 이동하지 않을 수 있다. Rationale 연속성 자체(결정의 내용)를 훼손하지는 않으나 근거 문서로의 추적성을 약화시킨다.
  - 제안: 앵커를 실제 헤딩 슬러그로 정정 (`#r-cc-12-inbound-http-contract-202-accepted-고정--401-auth--404-endpointpath-예외`).

이 외에는 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, 암묵적 invariant 우회 사례를 발견하지 못했다. 근거:

1. **결정 번복이지만 새 Rationale 동반** — CCH-SE-02 는 "EIA `Idempotency-Key` 자동 발급" 문면에서 "전용 `ChatChannelDedupService`" 로 바뀌었지만, 이는 신설 `### R-CC-20` 이 배경·구조적 이유·채택·게이트 위치·fail-open·필요성까지 명시적으로 설명한다. `git log -S CCH-SE-02` 로 원문(commit `534158722`, PR #258)을 확인한 결과 R-CC-20 의 "배경" 서술(원문이 EIA HTTP 인터셉터 재사용으로 읽혔다는 주장)은 실제 이력과 일치한다 — 지어낸 역사가 아니다.
2. **합의 원칙(EIA-AU-08 in-process trusted caller) 과 정합** — chat-channel 이 EIA HTTP 표면(및 그 `IdempotencyInterceptor`)을 우회해 `InteractionService` 를 in-process 직접 호출하는 것은 이미 CCH-AD-06 / EIA-AU-08 이 명시적으로 정당화한 기존 결정이다. R-CC-20 은 이 기존 예외를 재확인하는 것이지, 새로 만든 것이 아니다.
3. **fail-open 정책과 정합** — `spec/data-flow/15-external-interaction.md` Rationale "Fail-open 정책의 일관 표기" 는 idempotency·blacklist·jti 추적·notification enqueue 모두 Redis/DB 미가용 시 fail-open 이라고 못박아 놓았다. 신규 `ChatChannelDedupService` 도 "Redis 미가용/에러 시 통과(+warn)" 로 동일 원칙을 따른다.
4. **기존 Redis 락 패턴 재사용** — `SET NX EX 30` 패턴은 이미 같은 spec 문서 §4.3 의 `chat-channel-lock:{triggerId}:{conversationKey}:formsubmit` (form 제출 중복 방지)에 쓰인 패턴과 동일하다 — 새 프리미티브를 발명하지 않고 기존 컨벤션을 재사용했다.
5. **게이트 순서 변경이 관련 Rationale(R-CC-19)과 상충하지 않음** — CCH-NF-03 본문이 "CCH-SE-02 dedup 게이트를 통과한 뒤" 로 갱신되어 dedup → rate-limit 순서가 R-CC-19 (skip vs replay 큐 트레이드오프)의 논지와 모순 없이 정합된다. R-CC-20 자체도 "재도착은 새 트래픽이 아니므로 쿼터를 소비하면 안 된다" 는 근거로 순서를 정당화한다.
6. **CHANGELOG 서술과 spec Rationale 이 동일 근거를 공유** — `CHANGELOG.md` 의 신규 항목이 R-CC-20 과 동일한 배경·해소 방식을 서술해 spec 문서와 변경 이력 간 괴리가 없다.
7. **telegram.md 의 소급 note** — "종전 이 자리는 '읽는 곳 0건' 이라 적었다 — 정확한 서술이었다" 는 과거 서술을 폄훼하지 않고 오히려 그 서술이 갭의 증거였음을 인정하는 방식으로, 과거 문서와의 연속성을 존중한다.

## 요약
이번 diff 는 CCH-SE-02 요구사항 문면을 "구현 불가능한 전제(EIA HTTP 인터셉터 재사용)"에서 "실제로 배선된 전용 dedup 서비스"로 정정한 것으로, 결정 번복에 반드시 필요한 새 Rationale(R-CC-20)을 동반했고 그 배경 서술은 실제 커밋 이력과 일치한다. 기존에 합의된 EIA-AU-08 in-process trusted caller 예외, 모듈 전반의 fail-open 정책, 기존 `SET NX EX 30` Redis 락 패턴, CCH-NF-03/R-CC-19 의 게이트 순서 논리 어느 것과도 충돌하지 않는다. 유일한 흠은 R-CC-20 내부의 R-CC-12 교차링크 앵커 오탈(INFO) 뿐이다.

## 위험도
LOW
