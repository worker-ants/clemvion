# 정식 규약 준수 검토 — `spec/5-system/`

## 검토 방법

`spec/5-system/**.md` (17개 spec 파일 + `_product-overview.md`) 를 `spec/conventions/**.md` 전체와
대조했다. 특히 다음 정식 규약을 중점 검토:

- `spec-impl-evidence.md` (frontmatter 스키마·`id`/`status`/`code`/`pending_plans`)
- `error-codes.md` (명명·rename 안정성·historical-artifact 예외 레지스트리)
- `audit-actions.md` (`<resource>.<verb>` 구조·시제 3분류)
- `swagger.md` (DTO/decorator 패턴, 닫힌 union vs 열린 map, discriminator 원칙)
- `secret-store.md` (`secret://<scope>/<resourceId>/<name>` URI scheme)
- `execution-context.md` (`variables.__*` 예약 네임스페이스, `_`-prefix 엔진 필드)
- `interaction-type-registry.md` (`WaitingInteractionType` 4↔3값 매핑, `ConversationTurnSource` 5↔7값)
- `conversation-thread.md` (자료구조 SoT)
- `chat-channel-adapter.md` (어댑터 인터페이스 계약)
- `migrations.md` (`V<번호>__<snake_case>.sql` 명명)
- `node-output.md` / `node-cancellation.md` / `rag-evaluation.md` (관련 절만 발췌 대조)

## 발견사항

이번 검토에서는 **CRITICAL·WARNING 등급 위반을 발견하지 못했다.** target 은 각 규약을 인용하며
자기 책임 경계를 명시하는 방식으로 매우 촘촘하게 정합돼 있고 (예: 에러 코드는 전부
`UPPER_SNAKE_CASE`이며 예외는 `error-codes.md §3` 레지스트리에 정확히 등재된 것만, 감사
액션은 `audit-actions.md` 의 시제 3분류를 정확히 따름, `secret://triggers/{id}/{bot-token,inbound-signing,notification-signing}` 은 scheme 규칙과 1:1), 각 조항에 "본 문서는 재선언하지 않는다 /
SoT 는 X" 식으로 중복 정의를 피하고 있다.

- **[INFO] 개별 파일 `## Overview` 섹션 존재 여부가 파일마다 다르다**
  - target 위치: `spec/5-system/2-api-convention.md`, `5-expression-language.md`,
    `6-websocket-protocol.md`, `11-mcp-client.md`, `7-llm-client.md`, `16-system-status-api.md`
    (Overview 섹션 없음) vs `1-auth.md`, `3-error-handling.md`, `4-execution-engine.md`,
    `8-embedding-pipeline.md`, `9-rag-search.md`, `10-graph-rag.md`,
    `14-external-interaction-api.md`, `15-chat-channel.md`, `17-agent-memory.md`,
    `12-webhook.md`, `13-replay-rerun.md` (`## Overview (제품 정의)` 섹션 있음)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" —
    `## Overview (제품 정의)` / 본문 / `## Rationale`. 이 영역은 이미 `_product-overview.md`
    (line 9527) 를 보유한다.
  - 상세: 엄밀히는 위반이 아니다 — CLAUDE.md 정보 저장 위치 표는 "`_product-overview.md`
    **또는** 진입 문서의 `## Overview`" 를 택일로 허용하고, 이 영역은 두 계층을 병행한다
    (`_product-overview.md` = 영역 전체 비기능 요구사항 PRD, 개별 `## Overview (제품 정의)` =
    그 서브시스템 고유의 제품 가치 서술). Overview 가 없는 6개 파일은 공통적으로 "순수 기술
    프로토콜/컨벤션" 성격(API 설계 규칙, 표현식 문법, WS 프로토콜, MCP client 프로토콜, LLM
    client 아키텍처, 큐 관측 API)이라 별도 제품-가치 서술이 필요 없다는 설명도 가능하다.
    다만 규약 문구만으로는 "3섹션 권장"이 파일 단위인지 영역 단위인지 완전히 결정되지
    않으므로, 리뷰어 판단으로는 CRITICAL/WARNING 아닌 **관찰 사항**으로만 기록한다.
  - 제안: 의도된 설계라면 그대로 두되, 다음에 `project-planner` 가 이 영역을 다시 다룰 때
    "기술 프로토콜형 문서는 개별 Overview 생략, 제품 가치가 있는 서브시스템은 유지"라는
    구분 기준을 SKILL.md 나 `_product-overview.md` 자체에 한 줄 남겨두면 향후 재판단 비용이
    줄어든다. Spec 자체를 지금 수정할 필요는 없다.

- **[INFO] `spec/5-system/` 에 영역 전용 `0-overview.md` 가 없다**
  - target 위치: 디렉토리 전체 (`_product-overview.md` 만 존재)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` 명명 컨벤션 — `spec/<영역>/0-overview.md`
    ("기술 아키텍처 개요")
  - 상세: `spec/4-nodes/0-overview.md` 는 `spec-impl-evidence.md §1` 이 명시적 예로 드는 반면,
    `5-system` 은 대신 루트 `spec/0-overview.md` 를 "Spec 아키텍처 개요"로 반복 인용한다
    (17개 파일 모두 동일 링크). 이 패턴은 이미 확립되어 전 파일에 일관 적용돼 있어 target
    자체의 새 위반이 아니라 기존 설계이며, `0-overview.md` 명명 컨벤션도 "권장" 수준이라
    CRITICAL/WARNING 대상은 아니다.
  - 제안: 조치 불요. 참고용 기록.

## 확인된 양호 사례 (준수 근거로 명시)

- **frontmatter**: 검토한 17개 파일 모두 `id`(kebab-case, basename 기반) · `status`(5값 enum
  내) · `code:`(status ∈ {partial, implemented} 인 파일은 예외 없이 ≥1 glob 보유) ·
  `pending_plans:`(status=partial 인 파일 — `1-auth`, `4-execution-engine`,
  `6-websocket-protocol`, `9-rag-search`, `14-external-interaction-api`,
  `15-chat-channel` — 전부 실경로를 보유) 를 스키마대로 충족한다.
- **id 충돌 회피 선례 그대로 적용**: `17-agent-memory.md` 의 `id: agent-memory` 는
  `spec-impl-evidence.md §2.1` 이 드는 예시와 정확히 일치.
- **에러 코드**: 신규/기존 코드 전부 `UPPER_SNAKE_CASE`이고, 예외(초대 흐름 lowercase,
  `AbortError`, `WORKER_HEARTBEAT_TIMEOUT` 등)는 전부 `error-codes.md §3` 레지스트리에
  1:1 대응하며 근거까지 상호 링크됨. Retired 코드(`LLM_CONFIG_NOT_FOUND`→
  `MODEL_CONFIG_DEFAULT_MISSING`, `WORKSPACE_REQUIRED`→`WORKSPACE_ID_REQUIRED`)도 신 코드만
  사용 중.
- **감사 액션**: `<resource>.<verb>` + 언더스코어 토큰 구분자 + verb 시제 3분류가 카탈로그
  전 행에서 일관.
- **Swagger/DTO 원칙**: `context` 필드의 판별자 없는 `oneOf`(discriminator 미사용) 처리가
  `swagger.md` Rationale 의 sound-discriminator 원칙과 정확히 일치하며, `ConversationThreadDto`
  를 별도로 만들지 않고 open object + 설명 포인터로 두는 것도 `swagger.md`/`conversation-thread.md`
  책임 분리 논리와 합치.
- **secret store**: `secret://triggers/{triggerId}/{bot-token,inbound-signing,notification-signing}`
  (+ `.v2` rotation suffix) 가 URI scheme 규칙(`scope`/`resourceId`/`name` 모두 kebab-case)과
  정확히 일치.
- **migrations**: 인용된 `V025__graph_rag.sql`, `V026__graph_extraction_status_nullable_index.sql`,
  `V067__execution_re_run_chain.sql`, `V068__execution_dry_run.sql` 등 전부
  `V<번호>__<snake_case>.sql` 명명 규칙 준수.
- **interaction-type-registry**: `WaitingInteractionType` 내부 4값 ↔ EIA 외부 3값 매핑,
  `ConversationTurnSource` backend 5값 ↔ frontend 7값(`system_error`/`rag` 합성) 구분이
  두 target 문서(`14-external-interaction-api.md`, `15-chat-channel.md`)에서 정확히 일관되게
  서술됨.

## 요약

`spec/5-system/` 은 `spec/conventions/**` 의 명명·출력 포맷·API 문서·frontmatter 규약을
CRITICAL/WARNING 수준 위반 없이 준수하고 있다. 이미 여러 차례의 consistency-check·ai-review
라운드를 거친 것으로 보이는 흔적(각 조항이 SoT/책임 경계를 명시하고, 과거 오류를 Rationale 에
기록하는 패턴)이 문서 전반에 뚜렷하며, 에러 코드·감사 액션·secret ref·마이그레이션 파일명·
frontmatter 스키마 등 규약이 명시적으로 검증 가능한 항목은 표본 전수 대조에서 모두 합치했다.
유일하게 남는 것은 "## Overview 섹션의 파일별 유무"와 "영역 전용 0-overview.md 부재"라는 두
건의 INFO 성격 관찰뿐이며, 둘 다 CLAUDE.md/SKILL.md 문구상 택일 가능한 범위 안에 있어 규약
위반으로 단정하기 어렵다.

## 위험도

LOW
