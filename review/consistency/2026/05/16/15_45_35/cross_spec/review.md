# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-draft-cafe24-request-envelope.md`
검토 일시: 2026-05-16

---

## 발견사항

### 1. [INFO] `fieldLocation` vs `location` 용어 불일치

- **target 위치**: Draft §2-1, step 8 보강 문장 — "메타데이터의 `fieldLocation` (path / query / body) 에 따라 분배"
- **충돌 대상**: `spec/conventions/cafe24-api-metadata.md` §2 `Cafe24OperationMetadata` 인터페이스 — 필드명은 `location` (`location: 'path' | 'query' | 'body'`). `fieldLocation` 이라는 필드명은 인터페이스에 존재하지 않음
- **상세**: 현행 `spec/4-nodes/4-integration/4-cafe24.md` §4 step 8 의 본문("메타데이터의 `fieldLocation`")은 이미 기존 spec 에 존재하는 표현이고, draft 는 해당 문구를 그대로 유지하는 변경을 제안한다. 그러나 메타데이터 인터페이스의 실제 키 이름은 `location`(각 필드 객체의 프로퍼티)이다. `fieldLocation` 은 가독성을 위해 비공식적으로 쓴 것으로 보이지만, 독자가 인터페이스와 직접 대조할 때 혼동 가능성이 있다.
- **제안**: draft 적용 시 step 8 문구를 "메타데이터의 `fields[*].location` (path / query / body) 에 따라 분배" 로 수정하거나, 또는 기존 표현을 그대로 유지하더라도 `cafe24-api-metadata.md` §2 인터페이스 설명에 "`location` 프로퍼티 (노드 문서에서는 `fieldLocation` 으로도 기술)" 라는 주석을 추가하여 동기화한다.

---

### 2. [INFO] "envelope" 용어 충돌 — 대응책은 있으나 기존 문서 일부에서 동기화 필요

- **target 위치**: Draft "용어 정리" 섹션 + §4 (cafe24-api-metadata.md 삽입안) 및 §4.2 (4-cafe24.md 삽입안)의 모든 용어 주의 callout
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md:33` — "모든 Integration 노드의 출력은 CONVENTIONS Principle 7 / §3 의 nested envelope 을 따른다"; `spec/conventions/node-output.md` (Principle 7 기술)
- **상세**: draft 는 두 "envelope" 의 의미 충돌을 인식하고 "Cafe24 request envelope" / "POST/PUT request envelope" 한정 표기를 사용하도록 명시했다. 단독 "envelope" 표기 사용 금지 방침은 신규 절에는 잘 반영되어 있다. 그러나 draft 가 수정 대상으로 명시하지 않은 `0-common.md:33` 의 "nested envelope" 표현은 여전히 단독으로 쓰이고 있다. 독자가 `0-common.md` 를 읽을 때 어느 "envelope" 인지 구분해야 한다.
- **제안**: `0-common.md:33` 의 "nested envelope" 를 "노드 출력 envelope(`{config, output, meta, port}`)" 으로 명시적 표기로 갱신하면 cross-spec 충돌 위험이 완전히 해소된다. draft 적용 이후 별도 follow-up으로 처리 가능한 수준이다.

---

### 3. [INFO] draft §4.2 의 `{}` body 케이스 설명과 §4 (cafe24-api-metadata.md) 의 동일 케이스 설명 간 표현 차이

- **target 위치**: Draft §4.2 (4-cafe24.md 삽입안) 표 마지막 행 — "`{}` 또는 body 미지정 → body 미전송 (Content-Type 도 부여 안 함)"
- **충돌 대상**: Draft §4 (cafe24-api-metadata.md 삽입안) — `{}` 케이스에 대한 명시적 언급 없음
- **상세**: `cafe24-api-metadata.md` 에 삽입되는 §4 본문은 3개의 케이스(shop_no+payload, shop_no 없음, degenerate)만 열거하고, "body 가 완전히 비어있을 때 body 미전송" 케이스를 다루지 않는다. 반면 `4-cafe24.md` 의 §4.2 표에는 4번째 행으로 "`{}` 또는 body 미지정 → body 미전송"이 포함된다. 두 절이 같은 규약의 단일 진실을 나누어 정의하므로 cafe24-api-metadata.md §4 가 단일 진실(SoT) 역할을 한다고 명시됐음에도 4-cafe24.md §4.2 가 추가 케이스를 보유하는 구조가 된다.
- **제안**: `cafe24-api-metadata.md` §4 에도 "`{}` 또는 body 미지정일 때 body 미전송 (Content-Type 미부여)" 케이스를 추가하거나, 또는 4-cafe24.md §4.2 의 표 설명에 "상세 케이스 전부는 단일 진실 `cafe24-api-metadata.md §4` 참고" 참조를 강화한다. 현재는 INFO 수준이지만 향후 두 절이 독립적으로 편집될 경우 drift 위험이 있다.

---

### 4. [INFO] §4 (cafe24-api-metadata.md) 절 번호 재배치와 §8 (옛 §7) CHANGELOG 참조 방식

- **target 위치**: Draft §4 삽입에 따른 기존 §4~§7 → §5~§8 번호 이동. CHANGELOG 항목의 "§7 (옛 §6, allowlist)" 표현
- **충돌 대상**: `spec/conventions/cafe24-api-metadata.md` §6 allowlist 절 (현행 문서) + 다른 spec 에서 해당 절을 참조하는 링크가 있다면 해당 문서
- **상세**: 현재 `cafe24-api-metadata.md` 는 §1~§7 구조다. draft 가 새 §4 를 삽입하면 §4~§7 이 §5~§8 로 번호 이동한다. `4-cafe24.md` 의 본문 내에서 `cafe24-api-metadata.md` 를 참조하는 링크는 섹션 앵커 방식(`#4-wire-format-규약--postput-request-envelope`)으로만 기술되어 있고, 번호가 바뀌는 기존 §4~§7 의 앵커가 다른 문서에서 참조되고 있는지 현행 spec 전수 확인이 필요하다. 현 prompt 에 포함된 코퍼스 범위 내에서는 해당 번호 앵커를 직접 참조하는 다른 spec 문서를 발견하지 못했으나, `cafe24-api-catalog/_overview.md` 등 미포함 문서에 절 번호 직접 참조가 있을 수 있다.
- **제안**: draft 적용 전 `spec/conventions/cafe24-api-metadata.md` 절 번호 앵커(`#4-`, `#5-`, `#6-`, `#7-`)를 다른 spec/plan 문서에서 참조하는 링크가 있는지 `grep -r` 로 확인한 뒤, 있으면 번호 이동에 맞춰 함께 갱신한다.

---

### 5. [INFO] MCP Bridge 호출 경로의 envelope 적용 범위 — `Cafe24McpBridge.callTool` 에 대한 명시 부족

- **target 위치**: Draft §4.2 (4-cafe24.md 삽입안) — "호출자(노드 핸들러·MCP Bridge)는 flat 한 body 객체를 그대로 넘기면 된다"
- **충돌 대상**: `spec/conventions/cafe24-api-metadata.md` §5 "MCP Bridge 와의 매핑" — "`Cafe24McpBridge.callTool(name, args)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임"
- **상세**: `cafe24-api-metadata.md` §5 는 MCP Bridge 와 노드가 "같은 호출 경로를 공유"한다고 기술하고 있다. draft §4.2 는 "호출자(노드 핸들러·MCP Bridge)" 가 모두 flat body 를 넘기면 wrapper 가 envelope 처리한다고 기술한다. 이는 일치하는 방향이지만, `spec/5-system/11-mcp-client.md` 의 Internal Bridge 절에는 envelope 적용에 대한 언급이 없다. draft 가 "영향 받지 않는 문서" 로 분류한 `spec/5-system/11-mcp-client.md` 는 현행 spec 에서 Bridge 의 `callTool` 이 `Cafe24ApiClient` 를 경유한다는 점만 기술하므로, 실제로는 envelope 규약 변경의 직접 영향권 안에 있다. 그러나 내부 호출 경로 자체가 변경된 것이 아니라 `Cafe24ApiClient` 내부에서 일괄 처리되므로 MCP spec 의 외부 계약은 변경되지 않는다.
- **제안**: `spec/5-system/11-mcp-client.md` §2.3 Internal Bridge 또는 §8.3 `IntegrationUsageLog` 참조 맥락에 "Cafe24 POST/PUT 본문 envelope 는 `Cafe24ApiClient` 가 일괄 처리하므로 Bridge 호출자는 flat body 를 사용" 한 줄 주석을 추가하면 이후 독자의 혼동을 방지할 수 있다. 의무적 수준은 아니며 follow-up 권장.

---

## 요약

target draft 는 Cafe24 Admin API POST/PUT 본문의 `request` envelope 규약을 `spec/conventions/cafe24-api-metadata.md` 와 `spec/4-nodes/4-integration/4-cafe24.md` 에 명문화하는 변경이다. Cross-spec 관점에서 **기존 spec 과의 직접 모순(CRITICAL)은 발견되지 않았다**. draft 가 자체적으로 "envelope" 이중 의미 충돌을 인식하고 한정 표기 전략("Cafe24 request envelope")을 채택한 것은 적절하다. 다만 `fieldLocation` 용어(인터페이스 실제 키 `location` 과 불일치), `0-common.md` 의 단독 "envelope" 표현 동기화 미완, `cafe24-api-metadata.md` §4 의 `{}` body 케이스 미포함, 절 번호 이동에 따른 앵커 참조 확인 필요, MCP Client spec 의 envelope 적용 범위 언급 부재 등 5건의 **INFO 수준** 항목이 확인됐다. 이 항목들은 현재 상태에서 운영 불가를 일으키지 않으나, draft 적용 이후 spec 간 표현 drift 를 낮추기 위해 병행 또는 후속 처리를 권장한다.

## 위험도

LOW
