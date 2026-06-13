# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
검토 대상 변경 파일:
- `spec/5-system/15-chat-channel.md`
- `spec/data-flow/14-chat-channel.md`

---

## 발견사항

### [WARNING] CCH-NF-03 "chat 단위 큐 적재" 정책 번복 — R9 가 이를 간접 승인한 상태였음
- **target 위치**: `spec/5-system/15-chat-channel.md` §3.6 CCH-NF-03 + R-CC-19
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` (origin/main) `## Rationale` §R9 · §CCH-NF-03 본문
- **상세**:

  원 CCH-NF-03 (origin/main) 은 rate-limit 초과분에 대해 **"어댑터의 chat 단위 큐에 적재"** 를 명시했다:
  > "초과분은 어댑터의 chat 단위 큐에 적재, 폭주 시 가장 오래된 update 부터 폐기하지 않고 `chat_channel_health=degraded` 표시"

  더불어 §R9 (origin/main) 도 이 큐 방식을 **다른 케이스(execution running)과 구별되는 선택지**로 명시했다:
  > "CCH-NF-03 의 rate-limit **큐 정책**은 다른 트리거 조건(`분당 60건 초과 시 적재`)으로, 본 케이스와 정책 방향이 다른 것은 정당하다"

  즉 R9 Rationale 에서 "rate-limit 케이스는 큐 적재를 쓴다" 는 전제로 두 케이스를 분리하는 논거가 성립했다.

  target 의 새 CCH-NF-03 은 이를 **skip + degraded** 로 전면 교체했고, 기존 R9 텍스트도 다음과 같이 수정했다:
  > "CCH-NF-03 의 rate-limit 정책은 다른 트리거 조건(`분당 한도 초과`)으로 ... 두 케이스 모두 v1 은 큐 적재·재발사 없이 처리하나 이는 각자 독립 근거에 따른 결정이다"

  신규 R-CC-19 도 추가해 skip 채택 이유(200ms 제약, replay 버퍼의 추가 메커니즘 비용, fail-open Redis 정책)를 상세히 기술했다.

  **평가**: 번복 자체는 의도적이고 R-CC-19 라는 새 Rationale 이 함께 작성됐다. 그러나 원 CCH-NF-03 이 `## Rationale` 섹션이 아닌 요구사항 표(spec 본문)에 기술된 Planned 항목이었고, R9 는 "큐 적재가 맞다"고 확정한 Rationale 이 아니라 "lifecycle 케이스와 rate-limit 케이스를 다른 조건으로 분리한 Rationale" 임을 감안하면, 이번 변경은 **미구현(Planned) 상태의 설계 방향을 구현 전에 수정한 것**으로 볼 수 있다. 그럼에도 R9 의 "rate-limit **큐 정책**" 문구가 과거 합의 사항처럼 읽힐 수 있는 모호성이 있었으므로, R9 텍스트 수정 + R-CC-19 신설로 연속성 갱신이 완료됐다.

  **남은 모호성**: R9 수정 후 "두 케이스 모두 큐 없이 처리" 라고 기술하면서, R9 의 원래 논거("큐 적재와 달리 즉시 무시가 더 낫다")가 *lifecycle 케이스*에만 적용된 것인지 *rate-limit 케이스*까지 포함하는 것인지 독해 시 여전히 혼동 가능하다. R-CC-19 를 cross-link 해두었으므로 치명적이지는 않으나, R9 수정 문장이 "rate-limit 케이스의 독립 근거는 R-CC-19 참조" 만으로 끝나 R9 본문 논거 자체가 lifecycle 전용인지 불명확하다.

- **제안**: R9 첫 단락에 "(본 R9 의 큐잉 vs 즉시 안내 논거는 lifecycle 케이스 전용이며 rate-limit 케이스는 R-CC-19 에서 별도 정의된다)" 한 문장을 명시적으로 추가해 독자 혼동을 차단할 것을 권장한다. 현 상태에서 번복의 의도·근거는 충분히 표현됐으나 두 Rationale 의 경계가 명확히 선을 그어지면 더욱 견고해진다.

---

### [INFO] `spec/data-flow/14-chat-channel.md` — "구현 갭" 주석의 갱신은 Rationale 연속성 문제 없음
- **target 위치**: `spec/data-flow/14-chat-channel.md` §1.1
- **과거 결정 출처**: 해당 없음 (data-flow 는 Rationale 섹션 없음)
- **상세**: 기존 "inbound rate limit 구현 갭" 주석이 "구현 완료" 주석으로 교체되었다. 구현 상태 변경에 따른 자연스러운 업데이트이며 Rationale 연속성 위반 사항 없다.
- **제안**: 없음.

---

### [INFO] `spec/5-system/` 나머지 파일 (1-auth, 10-graph-rag, 11-mcp-client 등) — 이번 diff 에 포함되지 않음
- **target 위치**: 해당 없음 (diff 에서 변경 없음)
- **과거 결정 출처**: 해당 없음
- **상세**: 검토 범위(`spec/5-system/`)의 나머지 파일들은 `origin/main` 대비 변경이 없으며 prompt 에 포함된 내용은 context 제공 목적이다. Rationale 연속성 이슈 없음.
- **제안**: 없음.

---

## 요약

이번 변경의 핵심은 CCH-NF-03 의 rate-limit 초과분 처리 방식을 "chat 단위 큐 적재 → 재발사(Planned)" 에서 "처리 생략(skip) + degraded" 로 전환한 것이다. 원 스펙 본문과 R9 가 큐 방식을 암묵적으로 합의 사항처럼 기술하고 있었으므로 이는 기술적으로는 Rationale 번복에 해당한다. 그러나 target 은 새 R-CC-19 를 신설해 skip 채택의 독립 근거(200ms 응답 시한, replay 버퍼 복잡도, fail-open Redis 정책)를 명시하고 R9 텍스트도 수정해 연속성 갱신 의무를 이행했다. 남은 것은 R9 본문이 lifecycle 전용 논거임을 더 명확히 선언해 두 Rationale 의 경계를 독자가 혼동하지 않도록 하는 소폭의 보완이며, 이는 CRITICAL 수준의 위반이 아닌 WARNING 수준의 정합 보완 사안이다.

## 위험도

LOW
