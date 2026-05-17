### 발견사항

- **[INFO]** `§8.4 "자동 복구 없음"` 원칙 번복이 새 Rationale 와 함께 기술되어 있으나 §8.4 변경 후 본문의 적용 범위 제한 표현이 충분히 명시적이지 않을 수 있음
  - target 위치: 변경 2 — `spec/5-system/11-mcp-client.md §8.4` 변경 후 본문, "본 정책의 적용 범위는 **외부 MCP 서버** 한정이다"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md ## Rationale` — `call()` 의 401 자동 회복 (2026-05-17) 내 "§8.4 (MCP Client) 의 '운영 가시성 해친다' 우려에 대한 반박" 항
  - 상세: 기존 §8.4 는 "자동 복구 정책을 도입하면 만료된 토큰이 일시 회복되는 race-of-clock 시나리오에서 status 가 깜빡일 수 있어 운영 가시성을 해친다" 고 명시하며 자동 복구를 일반적으로 금지했다. target 변경 2 는 "외부 MCP 서버 한정" 이라는 적용 범위 제한을 §8.4 본문에 추가하고, Internal Bridge/refresh_token 보유 provider 의 401 자동 회복을 §6.1 에 위임한다. 이 번복에 대한 Rationale 는 변경 4(`## Rationale` 신규 절)에 상세히 기재되어 있어 형식 요건은 충족한다. 다만 §8.4 변경 후 본문 자체에서 "왜 외부 MCP 한정인가"를 직접 설명하지 않고 §6.1 링크에 위임하므로, §8.4 를 독립적으로 읽는 독자는 번복 이유를 원문에서 바로 파악하기 어렵다. §8.4 본문 안에도 "(Rationale는 §10.5 Rationale 또는 §6.1 Rationale 참고)" 식의 cross-reference 한 줄을 추가하면 완성도가 높아진다.
  - 제안: 변경 2의 §8.4 "Internal Bridge 예외" 단락 끝에 "본 정책 분기 근거는 [Spec 통합 §10.5 Rationale `call()` 의 401 자동 회복](…#callrationale) 참고." 한 줄을 추가해 번복의 근거를 §8.4 본문 자체에서도 추적 가능하게 한다.

- **[INFO]** 기각된 대안 (C) "즉시 격하 유지하고 사용자가 재인증" 이 옛 §6.1 의 합의 정책과 동일한데, target 에서 이를 "기각된 옛 정책" 이라고 표기하는 방식이 직관적이나 §8.4 의 **현재 유효 정책**(외부 MCP용)과 혼동 여지 있음
  - target 위치: 변경 4 — `## Rationale` 신규 절 "기각 대안 (C)" 항
  - 과거 결정 출처: `spec/2-navigation/4-integration.md ## Rationale` — `call()` 의 401 자동 회복 (2026-05-17) 섹션 내 "기각 대안 (C)" 및 §8.4 Rationale
  - 상세: 기각 대안 (C) 는 "(기각된 옛 정책)" 으로 표기되어 있어, 외부 MCP 서버에는 여전히 이 정책이 적용된다는 사실이 가려질 수 있다. §8.4 는 외부 MCP 에 대해서는 여전히 "즉시 격하 + 사용자 재인증" 을 유지하므로, (C) 가 "전면 기각"이 아니라 "Cafe24 Internal Bridge 경로 한정 기각"임을 표현에서 분명히 해야 오해가 없다.
  - 제안: "(C) 의 기각 범위는 Cafe24(`call()` 경로) 한정. 외부 MCP 서버(§8.4)는 여전히 (C) 가 유효." 식의 범위 한정 문구를 해당 기각 대안 항에 추가.

- **[INFO]** `proactive ensureFreshToken` 위치 기술이 §10.5 "첫 번째 bullet" 이라고만 되어 있어, 변경 3에서 새 bullet 이 삽입된 후의 참조 순서가 달라질 수 있음
  - target 위치: 변경 4 — 신규 Rationale 절 "문제" 단락 "proactive `ensureFreshToken` (§10.5 첫 bullet)"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §10.5 토큰 자동 갱신` 본문
  - 상세: 변경 3에서 §10.5 에 "401 자동 회복 (`call()` 경로)" 새 bullet 이 기존 첫 번째 bullet 직후에 삽입된다. 변경 후에는 proactive 경로가 여전히 첫 번째이고 새 bullet 이 두 번째이므로 큰 문제는 아니나, 변경 4의 Rationale 본문이 "§10.5 첫 bullet" 이라고 참조하는 것이 변경 후에도 정확하게 유지되는지 확인이 필요하다. 현 삽입 위치("기존 첫 번째 bullet 직후에 새 bullet 추가")를 감안하면 proactive 경로가 첫 번째, 새 401 회복 경로가 두 번째로 유지되어 참조가 정합하다. 문제 없음 — 주의 확인 차원의 INFO.
  - 제안: 별도 수정 불필요. 다만 §10.5 변경 반영 시 bullet 순서를 재검토해 "첫 번째 bullet" 표현의 정확성을 재확인 권장.

---

### 요약

target 문서(spec-draft-cafe24-call-401-retry.md)는 기존 `spec/2-navigation/4-integration.md ## Rationale` 및 `spec/5-system/11-mcp-client.md §8.4` 에서 합의된 "자동 복구 없음" 원칙을 번복하는 내용을 담고 있으나, 번복의 근거를 변경 4 의 신규 Rationale 절에서 상세히 기술하고 있다. 기각된 대안 3개(A: proactive window 확대, B: 다회 retry, C: 즉시 격하 유지)와 §8.4 의 "운영 가시성 해친다" 우려에 대한 반박도 명시적으로 작성되어, "결정의 무근거 번복" 이나 "기각된 대안의 재도입" 에 해당하지 않는다. §8.4 의 적용 범위를 "외부 MCP 서버 한정"으로 좁혀 cafe24 Internal Bridge 를 예외로 두는 설계는 기존 invariant(외부 MCP 서버에서 race-of-clock 방지)를 우회하는 것이 아니라 적용 대상을 정밀하게 제한하는 방식으로, Rationale 연속성 관점에서 합리적인 범위 확정이다. 소규모 명시성 보완(§8.4 본문 내 cross-reference, 기각 대안 (C) 의 범위 한정 표기) 만이 권장 사항이며, CRITICAL 또는 WARNING 수준의 Rationale 연속성 위반은 없다.

### 위험도

LOW
