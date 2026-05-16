# Rationale 연속성 Review

검토 대상: `plan/in-progress/spec-draft-cafe24-request-envelope.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-16

---

### 발견사항

- **[INFO]** `cafe24-api-metadata.md` 절 번호 +1 이동 시 named anchor 단절 위험
  - target 위치: Draft #1 — 새 §4 삽입으로 기존 §4(신규 endpoint 추가 절차)가 §5로, §5(MCP Bridge 매핑)가 §6으로, §6(allowlist)이 §7로 이동.
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md §8.1` 및 `§8.3` — 각각 `[Cafe24 API Metadata 컨벤션 §5](../../conventions/cafe24-api-metadata.md#5-mcp-bridge-와의-매핑)`, `[Spec Cafe24 API 메타데이터 §6](../../conventions/cafe24-api-metadata.md#6-allowlist-와의-관계)` 로 named anchor 참조.
  - 상세: Draft #1은 §4-§7 절 번호를 일괄 +1 이동한다고 선언한다. Markdown 의 named anchor는 heading 텍스트에서 파생되므로 `#5-mcp-bridge-와의-매핑` → `#6-mcp-bridge-와의-매핑`, `#6-allowlist-와의-관계` → `#7-allowlist-와의-관계` 로 변경된다. 그러나 `4-cafe24.md §8.1`/`§8.3` 의 cross-reference 는 옛 anchor 번호를 그대로 유지하게 되어 링크가 끊어진다. Draft 의 CHANGELOG 항목(`§4–§7 의 절 번호 일괄 +1 이동`)은 이 cross-reference 갱신 필요성을 명시하지 않는다.
  - 제안: Draft #2(4-cafe24.md 변경안)에 `§8.1`의 `#5-mcp-bridge-와의-매핑` → `#6-mcp-bridge-와의-매핑`, `§8.3`의 `#6-allowlist-와의-관계` → `#7-allowlist-와의-관계` 로의 anchor 갱신을 명시적으로 포함하거나, CHANGELOG에 "cross-reference 갱신" 항목을 추가한다.

- **[INFO]** §4.2 이중 래핑 guard(`throw`) 의 Rationale 미기재
  - target 위치: Draft #2 — §4.2 "Request body envelope (POST/PUT 전용)" 마지막 항목: "호출자가 이미 `{request: ...}` 형태로 pre-wrap 한 body 를 넘기면 wrapper 가 즉시 throw 하여 이중 래핑을 차단한다 (개발 단계 가드)."
  - 과거 결정 출처: `4-cafe24.md §9` — 이전 Rationale 항목들은 "기각된 대안 (A)" 형태로 후보와 이유를 병기. §9.10 신설 Rationale은 A vs B 배치 결정만 설명.
  - 상세: 이중 래핑 throw guard는 §9.10 Rationale에서 다루지 않는다. 이는 새로운 API 계약(caller 는 flat body 만 허용, pre-wrap 금지)을 설정하는 invariant 이므로 — "호출자가 이미 `{request: ...}` 형태로 body 를 넘기는" 케이스가 정당한 케이스인지, 개발 단계 가드로만 사용하는지, 언제 throw 를 제거할 수 있는지 등의 근거가 없다.
  - 제안: §9.10 또는 §4.2에 "(개발 단계 가드) — 미래 caller 가 pre-wrap 을 의도적으로 보낼 케이스는 없는가, 있다면 어떤 조건인가" 를 한 줄 Rationale로 추가한다. 예: "현재 코드베이스에서 wrapper 의 caller(`buildRequestParts`, `Cafe24McpToolProvider.execute`) 는 모두 flat body 를 넘기는 구조이므로 pre-wrap 은 반드시 오류다; 이 전제가 깨지면 guard 제거 또는 조건 완화를 검토한다."

- **[INFO]** step 8/9 에서 envelope 설명이 중복 언급됨 — 단일 진실 원칙과 경미한 거리
  - target 위치: Draft #2 § 2-1 — step 8에 "POST/PUT 의 경우 body 는 wrapper 가 Cafe24 `request` envelope 으로 wrap 한 뒤 직렬화 (§4.2 참고)", step 9에 "POST/PUT 본문 `request` envelope wrap (§4.2)"가 동시에 언급됨.
  - 과거 결정 출처: `spec/conventions/cafe24-api-metadata.md §4 (신규)` 가 단일 진실로 지정되고, `4-cafe24.md §4.2` 는 "노드 실행 로직에서 envelope 의 책임이 wrapper 에 있다는 사실만 명시" 로 역할이 한정됨.
  - 상세: §4.2 를 가리키는 참조가 step 8("body 분배 단계에서 §4.2 참고")과 step 9("fetch 직전 §4.2 wrap")에 이중으로 존재한다. 정보가 모순되지는 않지만, "어느 시점에 envelope 이 적용되는가"를 읽는 사람이 step 8과 9 중 어디에 근거해야 하는지 불분명할 수 있다. §9.10은 "(B) `executeWithRateLimit` 의 wire 직렬화 단계 — JSON.stringify 직전"이라고 명시하므로 실제 시점은 step 9이다.
  - 제안: step 8의 "POST/PUT 의 경우 body 는 wrapper 가 Cafe24 `request` envelope 으로 wrap 한 뒤 직렬화 (§4.2 참고)" 표현을 "body 분배 결과는 §4.2 에서 설명하는 규약에 따라 wrapper 에 전달된다"처럼 단순 위임 표현으로 정리해 시점을 step 9에 단일화한다.

---

### 요약

target draft 는 Cafe24 POST/PUT request envelope 규약을 spec 본문에 명문화하는 작업으로, 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 항목은 발견되지 않았다. §9.10 은 배치 결정(handler vs wrapper)을 A/B 형태로 올바르게 기록하며, "envelope" 용어 충돌(노드 출력 envelope vs Cafe24 wire-format envelope) 을 두 draft 모두에서 명시적으로 구분하고 있어 CONVENTIONS Principle 7 과의 혼동 위험도 낮다. 다만 ① §4 절 번호 +1 이동으로 인한 `4-cafe24.md` 내 named anchor 단절, ② 이중 래핑 throw guard 에 대한 Rationale 미기재, ③ step 8/9 에서의 envelope 언급 중복이라는 세 가지 정합 보완 사항이 있으며, 모두 INFO 등급이다.

### 위험도

LOW
