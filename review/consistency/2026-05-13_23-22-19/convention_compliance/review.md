현재 파일 상태를 확인했습니다. 이제 전체 분석을 완료하겠습니다.

---

## Convention Compliance Check — 결과

**검토 대상**: `plan/in-progress/spec-draft-cafe24-integration.md` (v2)  
**검토 모드**: `--spec` (spec write 직전 정식 규약 준수 점검)

---

### 발견사항

---

- **[WARNING]** `spec/conventions/node-output.md` Principle 3.3 갱신 범위 누락
  - **target 위치**: spec draft 의 변경 범위 목록 (§1~§10). `spec/conventions/node-output.md` 에 대한 변경안이 없음.
  - **위반 규약**: `spec/conventions/node-output.md` Principle 3.3 — "반드시 `error` 포트를 갖는 노드: `http_request`, `database_query`, `send_email`, `ai_agent`, `information_extractor`, `text_classifier`, `code`, `workflow`"
  - **상세**: `cafe24` 는 `error` / `success` 두 포트를 갖는 Integration 노드로, Principle 3.3 의 의무 목록에 추가돼야 한다. 현재 spec draft 는 `§5 신규 파일` 의 §3.2 에서 `error` 포트를 정의하고 §9.5 에서 "Principle 3 준수" 를 선언하나, 정작 Principle 3.3 의 목록 자체를 갱신하는 변경안이 draft 에 포함되지 않았다. Convention 목록과 구현 spec 사이의 정합이 깨진 채로 write 되면, 이후 이 목록을 참조하는 consistency-checker 나 코드 리뷰어가 `cafe24` 를 "에러 포트 없는 노드" 로 오판할 수 있다.
  - **제안**: 신규 §11 (변경 — `spec/conventions/node-output.md`) 을 draft 에 추가하여 Principle 3.3 목록에 `` `cafe24` `` 를 삽입한다:
    ```
    반드시 `error` 포트를 갖는 노드: `http_request`, `database_query`, `send_email`,
    `cafe24`, `ai_agent`, `information_extractor`, `text_classifier`, `code`, `workflow`
    ```

---

- **[WARNING]** `spec/conventions/cafe24-api-metadata.md` §5 — `callTool` name 파라미터 경계 미명시
  - **target 위치**: 신규 파일 §5 "MCP Bridge 와의 매핑", `Cafe24McpBridge.callTool(name, args)` 서술
  - **위반 규약**: `spec/conventions/node-output.md` Principle 11 (출력 예시 문서화 규칙의 정신: "워크플로우 작성자가 … 예측 가능하도록") + `4-cafe24.md` §8.1 와의 내부 정합성
  - **상세**: convention 파일 §5 의 `listTools()` 는 `name: op.id` (예: `'product_list'`) 를 반환한다. 반면 `4-cafe24.md` §8.1 의 도구 이름 매핑 표는 MCP 측 이름을 `mcp_<int8자>__product_list` 로 표기한다. 두 표현이 다른 레이어를 가리키는 것이지만, convention 파일은 이 경계를 명시하지 않는다. `callTool(name, args)` 의 `name` 이 bare `product_list` 인지 prefixed `mcp_<sid>__product_list` 인지 구현자가 convention만 보고 판단할 수 없어 실수 유발 가능성이 있다. (`enabledTools` 배열도 bare name 을 사용한다고 `4-cafe24.md` §8.3 이 명시하나, convention 파일은 이를 참조하지 않는다.)
  - **제안**: `cafe24-api-metadata.md` §5 의 `operationToMcpTool` 주석과 `callTool` 서술에 다음 한 줄을 추가한다:
    ```ts
    name: op.id,  // bare name ('product_list'). MCP Client 레이어가 'mcp_<sid>__' prefix 를 붙임
    ```
    그리고 `callTool(name, args)` 설명에: "`name` 은 MCP Client 가 prefix 를 strip 한 bare id (`product_list` 등). AI Agent `enabledTools` 배열과 동일 형식."

---

- **[INFO]** `4-cafe24.md` §5 케이스 헤딩 형식 — Principle 11 권장형 소폭 이탈
  - **target 위치**: `4-cafe24.md` §5 의 `### 5.1 Case: 2xx 성공 (port \`success\`)`, `### 5.3 Case: ...`, `### 5.8 Pre-flight throw`
  - **위반 규약**: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리 … `### Case: <케이스 이름>`"
  - **상세**: 권장 형식은 `### Case: <이름>` 이나, draft 는 `### 5.1 Case: ...` 처럼 섹션 번호를 앞에 붙였다. `0-common.md` 를 비롯한 기존 Integration 노드 spec 과 일치하는지 확인이 필요하다. 기존 spec 파일들이 같은 번호 prefix 를 쓴다면 문제없으나, 그렇지 않으면 노드 spec 간 헤딩 스타일 불일치가 발생한다.
  - **제안**: 기존 `1-http-request.md`, `2-database-query.md`, `3-send-email.md` 의 §5 케이스 헤딩 형식을 확인 후 일치시킨다. 기존 노드들이 섹션 번호 없이 `### Case: ...` 를 쓴다면 draft 에서도 동일하게 수정한다. (기존이 이미 `### 5.1 Case:` 형식이라면 무시)

---

- **[INFO]** `cafe24-api-metadata.md` §5 MCP prefix 레이어 경계 주석 권장 (WARNING #2 의 보완)
  - **target 위치**: `cafe24-api-metadata.md` §5 섹션 전체 도입부
  - **상세**: §5 진입부에 "본 함수들이 반환하는 name 은 bare tool id 이며, MCP Client (`Spec MCP Client §5.2`) 가 `mcp_<sid>__` prefix 를 붙여 LLM 에 노출한다" 는 한 문장 아키텍처 경계 메모가 있으면 WARNING #2 의 혼동을 근본에서 차단한다.

---

### 요약

spec draft v2 는 `node-output.md` Principle 0·1.1·2·3·5·7·8·11 을 전반적으로 충실하게 준수한다. 출력 구조(5필드 invariant, `output.response` HTTP 관용 네이밍, `output.error.{code, message, details}` 표준 envelope, `config` echo + credentials echo 금지) 가 모두 올바르게 구현됐고, 에러 코드는 UPPER_SNAKE_CASE 를 따르며, `## Overview / 본문 / Rationale` 3섹션 구성도 완비됐다. 핵심 gap 은 두 가지: ① **`spec/conventions/node-output.md` Principle 3.3 의 의무 에러 포트 노드 목록** 에 `cafe24` 추가가 draft 범위에서 누락된 것 (단일 규약 변경이므로 draft 에 §11 로 추가 권장), ② **`cafe24-api-metadata.md` §5** 에서 `callTool` name 파라미터가 bare name 임을 명시하지 않아 구현자 혼동 소지.

### 위험도

**LOW** — CRITICAL 위배 없음. 두 WARNING 모두 spec write 후 구현 단계에서 오류로 이어질 수 있는 사항이나, spec 자체의 내적 정합성을 깨지는 않는다. draft 를 write 하기 전 두 WARNING 을 반영하도록 권장한다.