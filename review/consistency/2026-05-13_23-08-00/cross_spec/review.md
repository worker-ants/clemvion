### 발견사항

---

**[CRITICAL-1]** `oauth/begin` body의 `mode` 파라미터 누락

- **위치**: draft §2 `POST /api/integrations/oauth/begin` body 예시, draft §3.2 Cafe24 OAuth 흐름
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.2` (oauth/begin API 계약) + `§10.2` (callback handler)
- **내용**: 현재 `4-integration.md §9.2`의 `oauth/begin` body 스키마는 `mode: 'new' | 'reauthorize' | 'request-scopes'`를 **필수** 파라미터로 정의하고 있으며, §10.2 callback handler는 이 `mode` 값으로 분기(새 Integration 생성 vs credentials 교체 vs scopes 확장)를 결정한다. draft의 Cafe24 begin body(`{ service: 'cafe24', mall_id, app_type, scopes[], client_id?, client_secret? }`)에서 `mode`가 생략되어 있어, Cafe24 OAuth callback이 어느 분기로 진입할지 결정 불가 → 기존 OAuth callback 처리 계약과 직접 충돌.
- **조치**: draft의 Cafe24 `oauth/begin` body 예시에 `mode: 'new' | 'reauthorize'` 추가. `§9.2` 표에 Cafe24 provider 행 추가 시 mode 필드 포함 명시.

---

**[CRITICAL-2]** `spec/4-nodes/4-integration/0-common.md` scope note 갱신 누락

- **위치**: draft §4 (0-common.md 갱신 목록)
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md` lines 7–11 (scope note), 도입부 노드 문서 링크 목록, §5 캔버스 요약 표
- **내용**: `0-common.md` scope note는 현재 "워크플로 캔버스에 직접 배치되는 Integration 노드(HTTP Request, Database Query, Send Email)의 공통 규약"이라 명시하고, "Integration 엔티티(`service_type='mcp'`)는 워크플로 노드로 노출되지 않고 … AI Agent 노드 내부의 `mcpServers` 설정에서만 활용"이라 서술한다. draft §4는 §7 출력 구조 색인만 갱신하고 이 scope note를 갱신하지 않았다. Cafe24 노드가 추가되면 (a) 노드 목록("HTTP Request, Database Query, Send Email")에 `Cafe24` 미포함, (b) "mcp만 비-캔버스 노드"라는 서술이 Cafe24를 정확히 설명하지 못하는 상태가 되어 scope note 자체가 거짓이 됨.
- **조치**: draft §4 갱신 범위에 아래 3항목 추가 필수: ① scope note의 노드 목록 (`+ Cafe24`) 갱신, ② Cafe24가 캔버스 노드이며 `service_type='cafe24'`임을 scope note에 명시, ③ 도입부 노드 문서 링크 목록에 `[Cafe24](./4-cafe24.md)` 추가.

---

**[WARNING-1]** `0-common.md §5` 캔버스 요약 표 Cafe24 행 누락

- **위치**: draft §4 (0-common.md 갱신 목록)
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §5` 캔버스 요약 표
- **내용**: §5 캔버스 요약 표는 현재 HTTP Request / Database Query / Send Email 3행만 존재한다. draft §5 신규 파일(`4-cafe24.md §7`)이 캔버스 요약을 정의하나, 0-common.md §5 표에 Cafe24 행이 추가되지 않으면 통합 색인이 불완전해진다.
- **조치**: draft §4에서 0-common.md §5에 Cafe24 행 추가 (`{resource} · {operation}` 포맷 또는 draft §5에서 결정된 포맷으로).

---

**[WARNING-2]** `11-mcp-client.md §1` transport scope 서술 부정확

- **위치**: draft §6 (11-mcp-client.md 갱신 목록)
- **충돌 대상**: `spec/5-system/11-mcp-client.md §1` ("Streamable HTTP (SSE) **단일** transport — stdio·websocket 미지원")
- **내용**: draft §6은 `Cafe24McpBridge`라는 in-process (Internal Bridge) transport를 새 transport type으로 도입하나, §1의 "Streamable HTTP (SSE) **단일** transport" 서술을 갱신하지 않는다. Internal Bridge 도입 후 이 문장은 거짓이 된다.
- **조치**: draft §6 갱신 범위에 §1 scope 서술 수정 추가 — "Streamable HTTP (SSE) transport + Internal Bridge (in-process) transport 지원" 또는 §2에 §2.3 Internal Bridge 절 추가 시 §1을 그에 맞게 수정.

---

**[WARNING-3]** `4-integration.md §14.1` usage 기록 표에 cafe24 행 누락

- **위치**: draft §2 (4-integration.md 갱신 목록)
- **충돌 대상**: `spec/2-navigation/4-integration.md §14.1` (핸들러별 usage 기록 표)
- **내용**: §14.1 표는 `send_email`, `database_query`, `http_request` 3 핸들러의 usage 기록 정책을 정의한다. draft §2가 Cafe24 핸들러를 추가하면서 이 표에 `cafe24` 행이 없으면 usage 로깅 정책이 불명확해진다.
- **조치**: draft §2 갱신 범위에 §14.1 표 Cafe24 행 추가.

---

**[WARNING-4]** `4-integration.md §10.1` callback `:provider` 목록에 `cafe24` 누락

- **위치**: draft §2 (4-integration.md 갱신 목록)
- **충돌 대상**: `spec/2-navigation/4-integration.md §10.1` (callback endpoint `:provider` 값 목록 — 현재 `google`, `github`)
- **내용**: draft §2는 Cafe24 OAuth를 추가하지만 §10.1의 `:provider` 허용값 목록에 `cafe24`가 추가되지 않으면 callback route가 정의되지 않은 상태가 된다.
- **조치**: draft §2 갱신 범위에 §10.1 `:provider` 목록에 `cafe24` 추가.

---

**[WARNING-5]** `4-integration.md §9.2` oauth/begin API 표 Cafe24 body 확장 미반영

- **위치**: draft §2 (4-integration.md 갱신 목록)
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.2` (oauth/begin 요청 body 스키마 표)
- **내용**: Cafe24 OAuth는 `mall_id`, `app_type`, `client_id?`, `client_secret?`를 추가로 요구하는데, 이는 기존 스키마에 없는 Cafe24 전용 필드다. §9.2 표에 이 확장이 반영되지 않으면 API 계약 문서와 구현 간 불일치가 발생한다. (CRITICAL-1과 연관: `mode` 누락 + 이 필드들 누락은 같은 표 갱신 이슈)
- **조치**: draft §2 갱신 범위에 §9.2 Cafe24 body 확장 명시 (조건부 필드 포함).

---

**[WARNING-6]** `1-ai-agent.md §2` 설정 UI 라벨 갱신 미정의

- **위치**: draft §7 (1-ai-agent.md 갱신 목록)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §2` 설정 UI — "Add MCP Server" 버튼 라벨
- **내용**: draft §7은 AI Agent의 `mcpServers` 필드가 `service_type='mcp'` 뿐만 아니라 `service_type='cafe24'`(Internal Bridge)도 포함하도록 확장하나, §2 설정 UI의 "Add MCP Server" 라벨 및 드롭다운 필터 정책(어떤 service_type을 표시하는가)이 갱신되지 않는다. 사용자 관점에서 cafe24 Integration이 "MCP Server" 라벨 UI에서 선택 가능한지 불명확.
- **조치**: draft §7 갱신 범위에 §2 설정 UI 라벨/필터 정책 명시 (예: "Add MCP/Cafe24 Server" 또는 "Add AI Tool Provider" 등) 또는 McpServerRef 정의에서 허용 service_type을 명시.

---

**[WARNING-7]** AI Agent 캔버스 요약 `{N} MCP` Cafe24 포함 카운트 정책 불명확

- **위치**: draft §9 (0-common.md AI 공통 갱신 목록)
- **충돌 대상**: `spec/4-nodes/3-ai/0-common.md §8` 캔버스 요약 — `· {N} MCP` 규칙
- **내용**: 현재 `{N} MCP`는 `service_type='mcp'` 서버 수를 표시한다. Cafe24 Internal Bridge가 `mcpServers`에 포함된다면 이 카운트에 합산되는지, 별도 표기(`{N} Cafe24`?)인지 정책이 없다.
- **조치**: draft §9 갱신 범위에 캔버스 요약 카운트 정책 명시.

---

**[INFO-1]** `0-common.md` 도입부 노드 문서 링크 목록 미갱신

- **위치**: draft §4
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md` lines 7–9 (링크 목록)
- **내용**: 현재 `- [HTTP Request](./1-http-request.md)`, `- [Database Query](./2-database-query.md)`, `- [Send Email](./3-send-email.md)` 3항목. `[Cafe24](./4-cafe24.md)` 추가 필요. (CRITICAL-2와 같은 표적이나 별개 항목)

---

**[INFO-2]** `spec/0-overview.md §6.3` 로드맵 Cafe24 미언급

- **위치**: draft 전반 (어느 §에도 0-overview.md 갱신 없음)
- **충돌 대상**: `spec/0-overview.md §6.3` (로드맵/In Progress 목록)
- **내용**: 새 Integration 카테고리 노드 및 service_type 추가는 시스템 수준 변경이므로 0-overview.md 로드맵 또는 Integration 항목에 Cafe24를 언급하는 것이 관례상 적절하다. 필수 갱신은 아니나 일관성 유지 관점에서 권장.

---

**[INFO-3]** `4-cafe24.md §4` 실행 로직의 비공식 anchor 참조

- **위치**: draft §5 (신규 파일 `4-cafe24.md §4` 실행 로직 item 11)
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md`
- **내용**: draft §5 item 11이 "0-common.md §4.1.6 Usage 로깅"을 참조하나, 현재 0-common.md의 §4.1(공통 계약) 표는 6개 행이 번호 없이 나열되어 있고 "§4.1.6"이라는 공식 anchor가 존재하지 않는다. 링크가 끊어질 수 있음.
- **조치**: draft §5에서 "§4.1 Usage 로깅 단계" 또는 "§4.1 표의 6번째 행(Usage 로깅)"으로 참조 방식 조정 권장.

---

### 요약

Cafe24 Admin API Integration spec draft는 구조적으로 잘 정의되어 있으나, 기존 OAuth 계약과의 인터페이스 지점에서 CRITICAL 수준 불일치 2건이 발견되었다. `oauth/begin`의 `mode` 파라미터 누락은 기존 callback handler의 분기 로직과 직접 충돌하여 구현 시 런타임 오류를 유발하며, `0-common.md` scope note 미갱신은 Cafe24 노드 추가 직후 Integration 노드 공통 규약 문서 자체를 거짓으로 만든다. 두 항목 모두 spec write 전에 draft에서 수정되어야 한다. WARNING 7건은 `4-integration.md`·`11-mcp-client.md`·AI Agent 관련 문서의 파생적 갱신 누락으로, 독립적으로 수정 가능하지만 함께 반영하지 않으면 해당 문서들이 불완전해진다. INFO 3건은 관례적 일관성 항목으로 즉각 차단 사유는 아니다.

### 위험도

**CRITICAL** — spec write 차단. CRITICAL-1(`mode` 파라미터 누락)·CRITICAL-2(`0-common.md` scope note 미갱신) 해소 후 재검토 필요.