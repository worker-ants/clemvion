STATUS=success convention_compliance review complete (target=spec/5-system/, mode=--impl-prep)
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

## 검토 범위와 제약

전달된 번들은 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 파일만
전문이 포함되고, 나머지 15개 파일(`4-execution-engine.md` 등)은 컨텍스트 예산 초과로 절단되어
헤더만 있었다. `spec/conventions/**` 도 `egress-masking.md`·`audit-actions.md` 만 전문이었고
나머지는 절단됨. 절단된 문서는 필요 시 저장소에서 직접 `Read`/`grep` 해 실체를 확인했다
(`node-output.md`·`error-codes.md`·`swagger.md`·`4-cafe24.md`·`5-makeshop.md`·
`handler-output.adapter.ts`·`plan/in-progress/masking-expression-egress-split.md` 등).
전문이 없는 나머지 12개 파일(`5-expression-language.md`·`6-websocket-protocol.md`·
`8-embedding-pipeline.md`·`9-rag-search.md`·`10-graph-rag.md`·`11-mcp-client.md`·
`12-webhook.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·`17-agent-memory.md`·
`_product-overview.md`·`7-llm-client.md`·`16-system-status-api.md`)는 본 pass 에서 전수 검토하지
못했다 — 부재를 "문제 없음" 의 근거로 삼지 않는다.

전문이 확보된 세 파일은 매우 높은 밀도로 `spec/conventions/**` 를 인용하고, Rationale 섹션에
과거 발견된 규약 이탈(예: §1 카탈로그 완결성 pass, §2.3 정합화, 초대 lowercase 코드 등재)을
스스로 기록하고 있다. 인용된 조항(§1-3/§2-5/§6 of swagger.md, §1/§2/§3 of error-codes.md,
§3.2 of node-output.md)을 실제 파일과 대조한 결과 **문면·행 번호까지 정확히 일치**했다 — 즉
이 세 파일 자체는 매우 낮은 위반율을 보인다. 발견된 이슈는 아래 두 건이며, 둘 다 카탈로그
완결성(completeness) 계열이다.

---

## 발견사항

### [WARNING] Cafe24/Makeshop 노드 에러 카탈로그가 `3-error-handling.md` 에서 통째로 빠짐

- **target 위치**: `spec/5-system/3-error-handling.md` §1.4 "워크플로우 실행 에러"(노드 수준
  런타임 에러 표) 및 §3.2 "Route to Error Port 상세" 의 "에러 포트 보유 노드 (기본)" 목록
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.3 (`반드시 error 포트를 갖는 노드`
  레지스트리) · `spec/conventions/error-codes.md` §1 이 스스로 선언하는 "제품 전체 에러 코드
  카탈로그 SoT" 원칙(이 원칙에 따라 `3-error-handling.md` 자신의 Rationale 이 2FA/WebAuthn·
  KB/Graph RAG 도메인 누락을 찾아 등재한 전례가 있음)
- **상세**:
  - `node-output.md` Principle 3.3 은 "반드시 `error` 포트를 갖는 노드: `http_request`,
    `database_query`, `send_email`, **`cafe24`**, `ai_agent`, `information_extractor`,
    `text_classifier`, `code`, `workflow`" 라고 명시한다(`cafe24` 노드 스펙 도입 커밋
    `4d6dff858` 시점부터 존재 — 최근 변경 아님, 오래된 drift).
  - 그런데 `3-error-handling.md` §3.2 "에러 포트 보유 노드 (기본)" 은
    `http_request`, `database_query`, `send_email`, `code`, `ai_agent`, `text_classifier`,
    `information_extractor`, `workflow` **8개만** 나열하고 `cafe24` 가 빠져 있다. 바로 다음 줄에
    "`transform`, `if_else`, `switch` 등은 pre-flight 검증만 수행 → throw (런타임 에러 포트
    없음)" 이라고 여집합까지 명시해 이 목록이 완결적임을 암시하는데, 실제로는 완결적이지 않다.
  - §1.4 "노드 수준 런타임 에러" 표도 "정식 목록은 `codebase/backend/src/nodes/core/error-codes.ts`
    의 `ErrorCode` enum" 이라 적지만, 실측하면 `CAFE24_MISSING_FIELDS`/`CAFE24_UNKNOWN_OPERATION`/
    `CAFE24_INVALID_MALL_ID`·`MAKESHOP_MISSING_FIELDS`/`MAKESHOP_UNKNOWN_OPERATION` 등은 그
    중앙 enum 이 아니라 각 노드 모듈 로컬 상수(`cafe24/metadata/constraint-validator.ts` 의
    `CAFE24_MISSING_FIELDS_CODE` 등)로 정의돼 있어 그 "정식 목록" 서술 자체가 카탈로그의 일부를
    누락한 채로 완전성을 주장하는 셈이다. `spec/4-nodes/4-integration/4-cafe24.md`
    (`output.error.code = 'CAFE24_MISSING_FIELDS'` 등)·`5-makeshop.md` 는 이 코드들을 이미
    "CONVENTIONS Principle 3.2 표준 envelope" 준수로 명시 참조하고 있어, 도메인 spec 쪽은 이미
    구현·문서화가 끝났는데 cross-cutting 카탈로그(§1.4/§3.2)만 따라가지 못한 상태다.
  - 이 문서 자신의 Rationale 이 "§1 카탈로그 완결성 — 2FA/WebAuthn(§1.2.1)·KB/Graph RAG(§1.8)
    도메인 등재" 라는 항목으로 정확히 같은 유형의 결함(카탈로그 SoT 라 주장하면서 도메인
    누락)을 스스로 찾아 고친 전례가 있다 — cafe24/makeshop 도 같은 패턴의 잔여 갭으로 보인다.
- **제안**: §1.4 에 "Cafe24/Makeshop" 카테고리 행을 추가하고(§1.5~§1.9 가 이미 쓰는 "도메인
  spec 참조 — 정의 SoT 는 도메인 spec, 본 절은 공용 카탈로그 가시성 등재" 패턴을 그대로
  적용), §3.2 "에러 포트 보유 노드" 목록에 `cafe24`(그리고 `makeshop`)를 추가한다. 이는 spec
  본문 서술 정정이라 `project-planner` 턴에서 처리한다 — CLAUDE.md 상 "제품 정의·요구사항·API
  계약" 카테고리라 developer 의 자기반증형 소정정 예외 대상이 아니다. 다만 `node-output.md`
  자체도 `makeshop` 을 Principle 3.3 목록에 아직 올리지 않았으므로(같은 갭이 convention 쪽에도
  있음), 두 문서를 함께 갱신하는 편이 재발을 막는다.

### [INFO] `handler-output.adapter.ts` 의 config 마스킹 제거 계획과 인접 spec 의 안전성 서술 — 범위 밖이나 인접 위험

- **target 위치**: 엄밀히는 `spec/5-system/` 범위 밖(`spec/2-navigation/14-execution-history.md`
  §R-5 근방)이라 본 checker 의 채점 대상은 아니지만, **같은 코드 경계**(`handler-output.adapter.ts`
  의 `maskSensitiveFields`)를 `spec/5-system/3-error-handling.md` §3.2 예시("config": { /* 해석된
  노드 config echo (credentials 제외) */ })가 인용하고 있어 인접 위험으로 남긴다.
- **상세**: 이 worktree 의 진행 중 plan(`plan/in-progress/masking-expression-egress-split.md`)은
  `handler-output.adapter.ts` 의 `maskSensitiveFields(config)` 를 제거해 표현식이 raw config 를
  읽게 하려 한다. 계획 문서 자신의 표는 "DB: 원문 보존 — EIA §R17 의 egress-only 원칙" 이라 적어
  이것이 **현재도 그런 것처럼** 서술하지만, 실측(`handler-output.adapter.ts` 코드 주석: "boundary
  에서 자동 마스킹 — DB 저장 / WS emit / 표현식 echo 모두 안전")과 `spec/2-navigation/
  14-execution-history.md:469`("config echo 는 엔진 boundary(`handler-output.adapter.ts` 의
  `maskSensitiveFields`)에서 DB·WS·REST 모든 경로에 보편 마스킹되어 내려오므로... 안전성은
  **서버 boundary masking parity** 에 의존한다")는 **현재 DB 에는 이미 마스킹된 값이 저장되고
  있음**을 명시한다 — "DB 원문 보존" 은 이 변경이 **적용된 이후**에나 참이 되는 서술이다. 어댑터
  마스킹을 제거하면 (a) DB 저장값이 사상 처음으로 raw 크리덴셜을 담게 되고, (b) 그 안전성은
  전적으로 WS/REST egress 층의 정규식 기반 마스킹(`CREDENTIAL_KEY_PATTERN`)이 어댑터의 키-이름
  목록(`DEFAULT_SENSITIVE_KEYS`)을 **완전히 포함**하느냐에 좌우된다. plan 은 이 포함관계를
  캐너리로 검증할 것을 명시하고 있어 안전장치 설계 자체는 타당하나, 체크리스트에
  `spec/2-navigation/14-execution-history.md` §R-5(viewer 역할 노출의 안전성 근거 문단) 갱신이
  빠져 있다 — 이 항목이 "서버 boundary masking parity" 를 명시적으로 `handler-output.adapter.ts`
  라고 지목하는 유일한 안전성 서술이므로, 변경 후 이 문단이 stale 로 남으면 다음 사람이 잘못된
  안전 근거를 신뢰하게 된다.
- **제안**: 본 checker 의 검토 대상은 아니므로 강제하지 않되, 해당 plan 실행 시
  `(planner 턴) egress-masking.md 에 반영` 체크리스트 항목의 범위에
  `spec/2-navigation/14-execution-history.md` §R-5 안전성 문단도 포함시킬 것을 권고한다.

---

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 파일은 명명 규약·출력
포맷 규약·문서 구조 규약·API 문서 규약 전반에서 `spec/conventions/**` 를 매우 정밀하게 따르고
있다 — 인용된 조항을 실제 convention 파일과 대조한 결과 문면이 정확히 일치했고(swagger.md
§1-3/§2-5/§6, error-codes.md §1/§2/§3, audit-actions.md §1~§3, egress-masking.md 전체), DTO
클래스명(`PaginatedResponseDto`/`SessionListDto`/`WebAuthnCredentialListDto`)·에러 코드
enum 값(`HTTP_BLOCKED`/`CODE_MEMORY_LIMIT`/`WORKFLOW_FORBIDDEN_WORKSPACE`)도 코드베이스와
일치했다. 유일한 실질 결함은 `cafe24`(및 파생 `makeshop`) 노드의 에러 포트·에러 코드가
`node-output.md` Principle 3.3 의 레지스트리에는 있으나 `3-error-handling.md` 의 cross-cutting
카탈로그(§1.4·§3.2)에서는 빠진 카탈로그 완결성 갭이며, 이는 이 문서 자신의 Rationale 이 이미
같은 유형의 결함을 2회(2FA/WebAuthn, KB/Graph RAG) 찾아 고친 전례와 동일한 패턴이다. 그 외
15개 파일은 컨텍스트 예산으로 절단돼 이번 pass 에서 전수 검토하지 못했다.

## 위험도

LOW
