# Rationale 연속성 검토 — `cafe24-call-401-retry-after-spec`

검토 모드: `--impl-prep` (구현 착수 전)
대상 scope: `cafe24-call-401-retry-after-spec`

---

### 발견사항

- **[WARNING]** MCP Client §8.4 "운영 가시성" 원칙에 대한 예외 선언 — 변경 근거는 충분하나, §8.4 본문의 invariant 표현이 부분적으로 잔류
  - target 위치: `spec/5-system/11-mcp-client.md §8.4` 마지막 문단 ("단일 실패로 status 가 전환되는 점은 … 의도적")
  - 과거 결정 출처: `spec/5-system/11-mcp-client.md §8.4` Rationale ("자동 복구 정책을 도입하면 만료된 토큰이 일시 회복되는 race-of-clock 시나리오에서 status 가 깜빡일 수 있어 운영 가시성을 해친다")
  - 상세: §8.4 본문 마지막 문장 "단일 실패로 status 가 전환되는 점은 OAuth integration 의 기존 정책과 동일하며 의도적 — 임계값(예: 3회 연속) 도입은 … 별도로 결정"은 외부 MCP 서버 한정 원칙으로 작성되어 있다. 새 Internal Bridge 예외 단락(line 69, §8.4 끝 단락)이 추가됐지만, 해당 마지막 문장이 "외부 MCP 서버 한정" 임을 명시하지 않아 — Internal Bridge 에 대해 "단일 실패로 격하하지 않는다"는 새 정책과 병존 시 어느 쪽이 Internal Bridge 에 적용되는지 읽는 사람이 헷갈릴 수 있다. 새 Rationale("§8.4 의 '운영 가시성 해친다' 우려에 대한 반박")은 충분히 상세히 작성됐으나, §8.4 본문 자체의 마지막 문장에 "(외부 MCP 서버 한정)" 범위 주석이 없다.
  - 제안: §8.4 본문 마지막 문장 앞에 "*(외부 MCP 서버 한정)*" 또는 같은 내용의 괄호 주석 한 줄을 추가해 Internal Bridge 예외와의 scope 경계를 본문 자체에서 명확히 표기한다. 이는 Rationale 의 내용 번복이 아니라 기존 §8.4 원칙의 적용 범위를 본문에서 명시하는 보완이다.

- **[INFO]** 기각 대안 (C) "즉시 격하 유지" — 외부 MCP와 내부 Cafe24의 정책 분기가 명확히 문서화됨
  - target 위치: `spec/2-navigation/4-integration.md` Rationale "call() 의 401 자동 회복 (2026-05-17)" 기각 대안 (C)
  - 과거 결정 출처: 옛 `executeWithRateLimit()` 의 401 즉시 격하 동작 (코드 수준 기존 동작, 명시적 Rationale 항목은 없었음)
  - 상세: 기각 대안 (C) 가 "Cafe24 call() 경로 한정 기각이며, 외부 MCP 서버에서는 (C)가 여전히 유효한 채택안"으로 명시적으로 경계를 그어 두었다. 과거 정책("즉시 격하")이 공식 Rationale 항목으로 채택된 적이 없었으므로 CRITICAL 이 아니며, 새 Rationale 이 이를 올바르게 번복 + 범위 한정으로 처리했다.
  - 제안: 현행 문서화로 충분. 추가 조치 불필요.

- **[INFO]** "재시도 1회 상한" invariant — 기각 대안 (B) 가 명확히 유지됨
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md §6.1` + `spec/2-navigation/4-integration.md §10.5`
  - 과거 결정 출처: 해당 Rationale "기각 대안 (B) 여러 번 재시도"
  - 상세: "재시도는 정확히 1회 (무한 retry 차단)", "429 rate limit 재시도와 별개 카운터"가 §6.1 과 §10.5 양쪽에 명시됐고, Rationale 에서도 (B) 가 기각된 이유(alert 폭탄 + Cafe24 /oauth/token 자체 rate limit) 가 상세히 서술됐다. invariant 유지 완료.
  - 제안: 이미 적절히 처리됨.

- **[INFO]** BullMQ `cafe24-token-refresh` 큐 jobId dedup invariant — 401 재시도 경로에서도 유지
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md §6.1` step 1 ("refreshViaQueue — jobId = integrationId 로 클러스터 전체 직렬화")
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소 (2026-05-16)" — "기각된 대안: In-memory mutex 유지만 (옛 single-pod 한계 그대로)"
  - 상세: 401 재시도 경로가 `refreshViaQueue` 를 거쳐 기존 BullMQ dedup 보호를 받으므로, 과거 결정(in-memory mutex 단독 폐기)을 번복하지 않는다. `plan/in-progress/cafe24-call-401-retry.md` 의 구현 명세도 이를 명시("refreshQueue 있으면 refreshViaQueue('proactive'), 없으면 refreshAccessToken 직접 호출(테스트 환경 fallback)").
  - 제안: 이미 적절히 처리됨.

- **[INFO]** "DB Enum 비확장" 원칙 — 새 상태 추가 없음
  - target 위치: 관련 spec 전체 (새 status 추가 없음)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Attention 가상 필터값 — … DB 엔티티 비확장" 원칙
  - 상세: 401 자동 회복은 DB Enum(`connected`/`expired`/`error`/`pending_install`)을 확장하지 않는다. 자가 회복 성공 시 status 가 `connected` 그대로 유지되어 추가 상태 전이가 없다. invariant 유지 완료.
  - 제안: 이미 적절히 처리됨.

---

### 요약

이번 spec 변경(`cafe24-call-401-retry-after-spec`)은 기존 Rationale 에서 명시적으로 기각된 대안을 무근거로 재도입하거나 합의된 불변 원칙을 직접 위반한 사례는 없다. 가장 큰 관심 지점은 MCP Client §8.4 의 "자동 복구는 운영 가시성을 해친다" 원칙에 대한 예외 선언이나, 이는 새 Rationale 항목("§8.4 '운영 가시성 해친다' 우려에 대한 반박")과 §8.4 본문의 Internal Bridge 예외 단락으로 충분히 근거가 서술됐다. 다만 §8.4 본문의 기존 마지막 문장("단일 실패로 status 가 전환되는 점은 의도적")이 외부 MCP 서버 한정임을 본문 내에서 명시하지 않아, 예외 도입 이후에도 scope 경계가 본문에서 다소 불명확하게 잔류한다 — WARNING 등급의 가벼운 표기 보완이 필요하다. 기각 대안(B 여러번 재시도, C 즉시 격하 전역 유지)의 처리와 BullMQ dedup 유지, DB Enum 비확장 원칙은 모두 정확히 준수됐다. `pingConnection()` 의 기존 동일 패턴과의 정책 통일로 설계 일관성도 강화됐다.

### 위험도

LOW
