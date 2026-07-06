# 정식 규약 준수 Check — `spec/data-flow/` (--impl-done)

검토 대상: `spec/data-flow/**` (payload 에 본문 전체 포함된 문서: `0-overview.md`, `1-audit.md`,
`10-triggers.md`, `11-workflow.md`, `12-workspace.md`, `13-agent-memory.md`[일부 truncated]).
비교 대상 정식 규약: `spec/conventions/**` (payload 에는 `audit-actions.md` · `cafe24-api-catalog/*` 만
발췌되어 있었으나, 본 검토에서는 target 이 실제로 참조·의존하는 규약 — `error-codes.md` ·
`secret-store.md` · `migrations.md` — 을 저장소에서 직접 절대경로로 추가 확인했다. 코드 사실 확인은
모두 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/gracious-darwin-6b9739`)
기준.

## 발견사항

- **[INFO]** `0-overview.md` 만 `## Overview (제품 정의)` 라벨을 쓰고 나머지 도메인 문서는 `## Overview`
  - target 위치: `spec/data-flow/0-overview.md:7` vs. `1-audit.md:7`, `10-triggers.md:7`,
    `11-workflow.md:7`, `12-workspace.md:7`, `13-agent-memory.md:7` 등 폴더 내 전 도메인 문서
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 직접적인 금지 조항은
    없으나 동일 폴더 내 섹션 표기 일관성 관례
  - 상세: `spec/data-flow/0-overview.md` 는 폴더 전체의 진입 인덱스(cross-cutting 기술 인덱스, PRD
    아님)이고 나머지 15개 문서는 5요소(§3.1 System role 등)를 따르는 도메인 spec 이라는 점에서 역할이
    다르므로 라벨이 다른 것 자체는 근거가 있다. 다만 "(제품 정의)" 라는 부제는 이 폴더의 문서들이
    `spec/<영역>/_product-overview.md` 류의 제품 요구사항 문서가 아니라 순수 기술 데이터 흐름
    문서라는 성격과 약간 어긋나 보일 수 있다 — `4-nodes/0-overview.md` 는 동일한 인덱스 역할이지만
    `## 1. 노드 아키텍처` 로 시작하고 "Overview" 라벨 자체를 쓰지 않는 등, 기존 저장소에 확립된
    "기술 인덱스 문서의 헤더 표기" 에 유일하게 정해진 패턴은 없다.
  - 제안: 정정이 필요할 정도의 위반은 아니다. 통일하려면 `## Overview` 로 맞추거나, 반대로 이 표기가
    "본 폴더는 인덱스이자 제품 관점 설명을 겸한다"는 의도된 차별화라면 그대로 두고 규약에 각주로
    남겨도 된다.

- **[WARNING]** BullMQ 큐 카탈로그(§4) "17개" 표와 코드 `MONITORED_QUEUES`(16개) 의 SoT 선언이
  현재 코드와 어긋난 채로 "동기화됨"을 전제
  - target 위치: `spec/data-flow/0-overview.md` §1.2 핵심 사실 표("현재 등록된 큐 (17개)") 및 §4 표,
    특히 "코드 측 큐 모니터링 레지스트리 ... `MONITORED_QUEUES` 는 본 표를 SoT 로 삼는다 — 큐
    추가/삭제 시 본 카탈로그를 먼저 갱신하고 그 레지스트리를 동기화한다" 문구
  - 위반 규약: 문서 자체가 선언한 catalog↔registry 동기화 의무 (자기 규약). 직접적으로는
    `spec/conventions/*` 파일 위반은 아니지만, 이 문서가 스스로 SoT 관계를 명문화한 만큼 실제
    코드와의 정합성 확인이 필요한 대목이다.
  - 상세: 워킹트리에서 직접 확인한 결과 —
    `codebase/backend/src/modules/system-status/system-status.constants.ts` 의 `MONITORED_QUEUES` 배열은
    16개 항목만 갖고 있으며 (`execution-run, background-execution, execution-continuation,
    document-embedding, graph-extraction, notification-webhook, cafe24-token-refresh,
    makeshop-token-refresh, schedule-execution, login-history-pruner,
    workspace-invitations-pruner, notification-secret-rotator, terminal-revoke-reconcile,
    chat-channel-token-rotator, integration-expiry-scanner, alerts-evaluator`), target 의 §4 표에 있는
    `agent-memory-extraction` 큐가 **빠져 있다**. `codebase/backend/test/system-status.e2e-spec.ts` 의
    `EXPECTED_QUEUE_NAMES` 역시 동일하게 16개이며 `agent-memory-extraction` 을 포함하지 않는다.
    반면 `agent-memory-extraction` 큐 자체는 실제로 존재한다
    (`codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts` 의
    `AGENT_MEMORY_EXTRACTION_QUEUE = 'agent-memory-extraction'`, `agent-memory.module.ts` 에 등록).
    즉 이 큐는 **BullMQ 상에는 존재하지만 system-status 모니터링 화면에는 노출되지 않는** 상태이며,
    target 문서는 이 갭을 언급하지 않고 "본 표를 SoT 로 삼아 동기화되어 있다"는 어조로 서술한다.
    (`spec/data-flow` 는 impl-done 검토라 코드 미구현을 주장하는 것이 아니라 — 반대로 코드에 있는
    것이 spec 의 "동기화 완료" 서술과 어긋난다는 방향의 지적이다.)
  - 제안: (a) §4 카탈로그 하단 각주 또는 §1.2 표에 "`agent-memory-extraction` 은 아직
    `MONITORED_QUEUES`/시스템 상태 화면에 미등재 — 알려진 갭" 이라고 명시하거나, (b) 실제로
    `system-status.constants.ts` 의 `MONITORED_QUEUES`/`EXPECTED_QUEUE_NAMES` 에 `agent-memory-extraction`
    을 추가해 코드를 문서와 일치시킨다. 둘 중 하나로 실제 상태와 문서 서술을 일치시켜야 한다.

- **[INFO]** 에러 코드 표기 관련 — 재확인 결과 위반 없음 (참고 기록)
  - target 위치: `spec/data-flow/12-workspace.md` §1.2·§1.8·§1.9 의 `already_a_member`,
    `workspace_type_mismatch`, `invitation_already_pending`, `invitation_already_accepted`,
    `invitation_email_mismatch` 등 lowercase 코드
  - 위반 규약: `spec/conventions/error-codes.md` §1 "UPPER_SNAKE_CASE 표기" 원칙과 표면적으로 배치되는
    것처럼 보였으나, §3 "Historical-artifact 예외 레지스트리" 에 정확히 이 코드들이 개별 등재되어
    있고, target 문서도 "다른 모듈·케이스 컨벤션, 의도적 분리" 라고 §Rationale·본문에서 스스로
    명시하고 있어 실제로는 정합. 오탐 방지 차원에서 기록만 남긴다.
  - 제안: 없음 (현행 유지).

- **[INFO]** `AUDIT_ACTIONS` union·`audit-actions.md` §3 레지스트리와 `1-audit.md` §1.1 표 — 재확인
  결과 완전 일치
  - target 위치: `spec/data-flow/1-audit.md` §1.1 표 (writer/action/resource_type 목록)
  - 상세: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 의 `AUDIT_ACTIONS` 17개 항목과
    target 표의 action 문자열(`integration.created` 외 16개)이 1:1 로 일치하며, dot-prefix 필수·언더스코어
    토큰 구분자(`audit-actions.md` §1) 규약도 전부 준수한다. `workspace.transfer_ownership` 를 도메인
    고유 동사(§2.3)로, `auth_config.*` 를 현재형(§2.2)으로, 나머지를 과거분사(§2.1)로 분류한 것도
    conventions 레지스트리(§3)와 정확히 일치.
  - 제안: 없음.

- **[INFO]** `secret://` URI scheme 사용 — 재확인 결과 완전 준수
  - target 위치: `spec/data-flow/0-overview.md` §1.2 "Secret 저장" 행, `14-chat-channel.md`
    (payload 미포함이나 워킹트리에서 직접 확인)
  - 상세: `secret://triggers/{id}/bot-token`, `.../bot-token.v2`, `.../inbound-signing`,
    `.../notification-signing` 등 target 전반의 ref 표기가 `secret-store.md` §1 URI Scheme
    (`secret://<scope>/<resourceId>/<name>`, kebab-case name, `.v2` grace 접미사)과 정확히 일치.
  - 제안: 없음.

- **[INFO]** 문서 구조 3섹션(Overview/본문/Rationale) 준수 — 전 도메인 문서 확인 결과 위반 없음
  - target 위치: `spec/data-flow/*.md` 전체 (0-overview, 1-audit, 10-triggers, 11-workflow,
    12-workspace, 13-agent-memory 및 payload 밖의 2~9, 14, 15 포함, 워킹트리에서 직접 확인)
  - 상세: 16개 파일 모두 `## Overview` → 본문(`## 1.` 부터 번호 섹션) → `## Rationale` 구조를 지키고,
    파일명도 `0-overview.md` + `<번호>-<domain>.md` 넘버링 컨벤션을 일관되게 따른다.
  - 제안: 없음.

## 요약

`spec/data-flow/` 전체를 대상으로 명명 규약·출력 포맷(에러 코드·secret ref)·문서 구조 3섹션·API 문서
규약 5개 관점에서 검토한 결과, **직접적인 CRITICAL 위반은 발견되지 않았다.** 에러 코드 lowercase
표기·`AUDIT_ACTIONS` naming·`secret://` URI scheme 은 모두 `spec/conventions/error-codes.md`,
`audit-actions.md`, `secret-store.md` 의 명시적 규약(및 historical-artifact 예외 레지스트리)과 정확히
일치했다. 문서 구조(Overview/본문/Rationale, `0-` prefix 넘버링)도 폴더 전체에서 일관되다. 다만
`0-overview.md` §4 의 BullMQ 큐 카탈로그가 "코드 레지스트리(`MONITORED_QUEUES`)와 동기화되어 있다"고
선언한 것과 달리, 실제 코드에는 `agent-memory-extraction` 큐가 그 모니터링 레지스트리에 빠져 있는
드리프트가 있어 WARNING 으로 기록한다 — spec 자체가 정한 SoT 동기화 의무를 문서가 스스로 어기고 있는
사례이며, 카탈로그 갱신 또는 코드 레지스트리 갱신 중 하나로 조속히 맞출 필요가 있다. 그 외 사소한
헤더 라벨 차이(`## Overview (제품 정의)`)는 정보성 제안 수준이다.

## 위험도

LOW
