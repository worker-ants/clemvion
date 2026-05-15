분석이 완료되었습니다.

---

## Rationale Continuity Check 결과

### 발견사항

---

- **[WARNING]** `process-level mutex` 설명이 다중 인스턴스 아키텍처 invariant와 충돌

  - **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §4.1 Rate Limit 처리 상세, §8.4 Rate Limit 공유
  - **과거 결정 출처**: `spec/1-data-model.md ## Rationale` → "V035 → V036 (ExecutionNodeLog)" 항목 — "다중 backend 인스턴스가 동시에 `array_append()`로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다." → append-only 테이블로 교체. 이 결정은 백엔드가 **멀티 인스턴스**로 운용됨을 기존 Rationale에서 명시적으로 전제하고 있음.
  - **상세**: draft §4.1은 "process-level (Integration ID별 in-memory mutex) → 한 노드가 sleep 중이면 동일 Integration의 다른 호출도 자동 대기"라고 서술한다. 그러나 프로세스 경계를 넘는 조율이 없으므로, 두 인스턴스가 동시에 동일 Integration으로 호출하면 양쪽 모두 429를 받고 각자 재시도한다 — "Integration 단위 leaky bucket 공유"는 단일 프로세스 범위에서만 유효하다. §8.4의 동일 서술도 같은 오해를 야기한다.
  - **제안**: 두 위치에서 설명 범위를 "동일 프로세스 인스턴스 내" 로 한정("같은 인스턴스 내 동일 Integration 호출 직렬화")하거나, 분산 환경의 leaky-bucket 보장이 필요하다면 Redis 기반 공유 카운터 등 교차-인스턴스 조율 방안을 Rationale에 명기해야 한다. 현행 retry-with-sleep 로직 자체는 멀티 인스턴스에서도 결과적으로 안전하므로, 표현 수정만으로 충분할 수 있다.

---

- **[INFO]** `IMcpClient` 인터페이스의 spec 상 정의 위치 미참조

  - **target 위치**: `spec/5-system/11-mcp-client.md` §2.3 Internal Bridge, `spec/4-nodes/4-integration/4-cafe24.md` §8 및 Rationale §9.2
  - **과거 결정 출처**: 기존 `spec/5-system/11-mcp-client.md` 본문 — MCP Client spec은 `IMcpClient`라는 인터페이스명을 사용하지 않고, 구체적인 client SDK 호출 패턴을 기술함.
  - **상세**: draft는 `IMcpClient` 인터페이스를 Internal Bridge의 핵심 계약으로 여러 군데서 참조하지만, 이 인터페이스가 어느 spec 또는 코드 경로에서 formal하게 정의되는지 단 한 곳도 명시하지 않는다. spec 연독자가 해당 계약의 내용(`listTools`, `callTool` 시그니처 등)을 찾아갈 진입점이 없다.
  - **제안**: `spec/5-system/11-mcp-client.md` §2.3 또는 별도 섹션에 `IMcpClient` 인터페이스의 최소 시그니처(`listTools`, `callTool`, `connect`/`close` no-op 등)를 한 줄 표로 정의하거나, backend 코드 경로(`backend/src/...`)를 source-of-truth로 명시.

---

- **[INFO]** `mall_id` 입력값 검증 규칙 미명시 — SSRF 방어 위임 내용 미완성

  - **target 위치**: `spec/5-system/11-mcp-client.md` §2.3 "SSRF 검증: 미적용 — … base URL의 안전성 검증은 Integration의 `service_type`별 로직(예: Cafe24의 `mall_id` 유효성)이 담당"
  - **과거 결정 출처**: `spec/5-system/11-mcp-client.md` §3.2 SSRF 방어 원칙 — "외부 HTTP fetch가 있는 경우 엄격한 호스트 블록리스트 + HTTPS 강제"라는 정책이 기존 Rationale의 핵심 패턴임.
  - **상세**: §3.2의 SSRF 정책을 Internal Bridge에 미적용한다고 선언하면서, 대신 `mall_id` 유효성 검증에 위임한다고 했다. 그러나 `mall_id`의 허용 문자셋·최대 길이·형식(예: alphanumeric only, no dots/slashes) 등 구체적 validation 규칙이 spec 어디에도 없다. Cafe24 노드 핸들러가 실제로 `https://{mall_id}.cafe24api.com/...` URL을 구성해 외부 호출하므로, `mall_id`에 경로 traversal 문자나 @ 등이 포함될 경우 의도치 않은 엔드포인트 호출이 가능하다.
  - **제안**: `spec/2-navigation/4-integration.md §5.8 Cafe24` credentials JSONB 스키마 표의 `mall_id` 행에 validation rule을 추가 (예: "소문자 영숫자 및 하이픈, 3~50자, `https://{mall_id}.cafe24api.com` 형식 강제"). `spec/4-nodes/4-integration/4-cafe24.md` §5.8 pre-flight throw 표에도 `mall_id` 형식 검증 실패 케이스를 추가.

---

### 요약

target draft(v2)는 기존 spec의 `## Rationale` 섹션에서 **명시적으로 기각된 대안을 재도입하거나 합의된 invariant를 직접 위반하는 결정이 없다**. Internal Bridge transport 신설, `cafe24` service_type 추가, 5필드 output 구조 준수, Integration.status 자동 전환 정책 등 모든 핵심 설계 원칙은 기존 Rationale과 연속적이다. 단, `process-level mutex`가 다중 인스턴스 백엔드를 전제한 기존 아키텍처 결정과 표현 수준에서 충돌하며(WARNING), `IMcpClient` 인터페이스 정의 위치와 `mall_id` SSRF 위임의 구체성 부재가 추후 구현 시 혼선을 야기할 수 있다(INFO × 2).

### 위험도

**LOW** — CRITICAL 없음. WARNING 1건은 표현 수정으로 해소 가능하며 설계 구조 변경은 불필요. INFO 2건은 spec 보완 사항.