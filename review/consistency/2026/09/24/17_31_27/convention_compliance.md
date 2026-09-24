# 정식 규약 준수 검토 — `spec/5-system`

검토 모드: `--impl-prep` (scope=`spec/5-system`, 17개 spec 파일 + `_product-overview.md`).
대조 대상: `spec/conventions/**` (특히 `swagger.md`·`error-codes.md`·`redis-keys.md`·`audit-actions.md`),
`CLAUDE.md`·`project-planner/SKILL.md` 의 문서 구조·명명 컨벤션.

## 발견사항

- **[WARNING]** Agent Memory 관리 API 가 spec 전체에서 `/api` prefix 없이 표기됨
  - target 위치: `spec/5-system/17-agent-memory.md` §6 "메모리 관리 API" 표(120~123행)와 그 하단
    bullet(129·131·132·210·212행), `spec/5-system/_product-overview.md` §8 AGM-12/AGM-13 행(139~140행)
  - 위반 규약: `spec/5-system/2-api-convention.md` §2.1 "기본 패턴" — `{base_url}/api/{resource}` (본 문서는
    `spec/conventions/**` 는 아니지만, `swagger.md`·`error-codes.md` 가 명시적으로 API 봉투·URL 구조의
    SoT 로 역참조하는 사실상의 정식 규약이다)
  - 상세: 17-agent-memory.md 전 구간이 `GET /agent-memories`, `GET /agent-memories/scopes`,
    `DELETE /agent-memories/:id`, `DELETE /agent-memories?scopeKey=` 로만 표기하며 `/api` 세그먼트가
    단 한 곳도 없다(전수 grep 확인). 실제 컨트롤러는 `@Controller('agent-memories')`
    (`codebase/backend/src/modules/agent-memory/agent-memory.controller.ts:56`)이고 전역 prefix `api` 가
    적용되므로 실 wire 경로는 `/api/agent-memories`·`/api/agent-memories/scopes` 다. 같은 폴더의 다른
    16개 문서(`2-api-convention.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·`12-webhook.md` 등)는
    예외 없이 `/api/...` 로 표기하므로, 이 파일만 벗어난 국소 drift 다. §2.2 명명 규칙 표에 이런
    prefix 생략을 허용하는 예외 항목도 없다.
  - 제안: `17-agent-memory.md` §6 표와 관련 bullet, `_product-overview.md` AGM-12/AGM-13 행의 4개
    엔드포인트 표기에 `/api` 를 추가한다(`GET /api/agent-memories` 등). 문서 전용 drift 이므로
    스펙만 수정하면 되고 구현 변경은 불필요.

- **[WARNING]** 5-system 내 4개 문서가 `## Overview` 섹션 없이 바로 본문 소절로 시작
  - target 위치: `spec/5-system/5-expression-language.md`(첫 소절 `## 1. 개요`) ·
    `7-llm-client.md`(`## 1. 개요`) · `11-mcp-client.md`(`## 1. 개요`) ·
    `16-system-status-api.md`(Overview 자체 없이 문단 한 줄 후 바로 `## 1. 대상 큐 레지스트리`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" —
    `## Overview (제품 정의)` / 본문 / `## Rationale` 3섹션. `CLAUDE.md` 도 동일 컨벤션을 참조
  - 상세: 같은 폴더의 나머지 13개 파일(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·
    `4-execution-engine.md`·`6-websocket-protocol.md`·`8-embedding-pipeline.md`·`9-rag-search.md`·
    `10-graph-rag.md`·`12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·
    `15-chat-channel.md`·`17-agent-memory.md`)는 모두 `## Overview` 또는 `## Overview (제품 정의)`
    헤딩을 두는 반면, 이 4개만 `## 1. 개요` 또는 헤딩 없는 산문으로 바로 진입한다. "권장" 이라
    강제 사항은 아니나, 한 영역 폴더 안에서 17개 중 13개가 한 패턴을 쓰고 4개만 이탈하는 것은
    다음 작성자가 어느 쪽이 규범인지 헷갈리게 만든다.
  - 제안: 4개 파일의 도입부를 `## Overview (제품 정의)` 로 통일하거나(본문 내용은 유지, 헤딩만
    표준화), 이 네 파일의 성격(순수 기술 명세라 "제품 정의" 섹션이 불필요)이 의도된 예외라면
    그 사실을 SKILL.md 나 각 파일 상단에 한 줄로 밝혀 둔다.

- **[INFO]** `exec:run:seq:<executionId>` 가 "실제 사용 중인 키만" 표에 미사용 상태로 잔존
  - target 위치: `spec/5-system/4-execution-engine.md` §9.2 표 3번째 행(`exec:run:seq:<executionId>`,
    "PR1~PR4 미사용 — 미래 예약" 로 명시) + 바로 아래 "제거된 두 항목 (2026-08-13)" 콜아웃
  - 위반 규약: `spec/conventions/redis-keys.md` 자체보다는, 같은 §9.2 표가 스스로 선언한 원칙
    ("이 표가 '실제 사용 중인 키만' 이라 선언" — 2026-08-13 정정에서 미사용 항목 2개를 이 이유로
    제거)과의 자기모순
  - 상세: 2026-08-13 정정은 코드에 없는 두 키(`core:{wsId}:rate:{userId}` · `ws:{wsId}:session:{connId}`)를
    "표가 실제 사용 중인 키만 나열해야 한다" 는 이유로 제거했다. 그런데 같은 표에 남아 있는
    `exec:run:seq:<executionId>` 도 스스로 "PR1~PR4 미사용" 이라 명시한다 — 표의 선언 원칙과
    행 하나가 어긋난다. 괄호 caveat 로 미사용임을 명시해 오독 위험은 낮지만, 두 제거 항목과
    동일 논리를 적용하면 이 행도 표 밖(별도 "예약된 미래 키" 각주)으로 옮기는 편이 §9.2 "실제
    사용 중" 선언과 일치한다.
  - 제안: `exec:run:seq` 행을 §9.2 본표에서 빼고, "제거된 두 항목" 콜아웃과 나란히 "예약되었으나
    아직 미사용" 각주로 옮기거나, 표 선언문을 "실제 사용 중 + 명시적으로 예약된 키" 로 넓혀
    표기와 선언을 일치시킨다.

## 요약

`spec/5-system` 은 `spec/conventions/swagger.md`·`error-codes.md`·`redis-keys.md`·`audit-actions.md`
와의 상호 참조가 매우 촘촘하고(각 SoT 경계·Rationale·기각 대안까지 명시), 표본 검토한 핵심 영역
(응답 봉투 `{data}`/`{data,pagination}` 구조, `410`/`413` 등 상태 코드-코드 매핑, 에러 코드
`UPPER_SNAKE_CASE`+historical exception 레지스트리, 감사 액션 `<resource>.<verb>` 명명·시제 3분류,
Redis 키 2세그먼트 규칙)에서는 규약 위반이 발견되지 않았다 — 오히려 스스로 과거 위반을 찾아
정정한 이력(§9.1 워크스페이스 세그먼트 폐기, `410` 기본값 미도입 결정 등)이 기록돼 있다. 발견된
두 WARNING 은 모두 국소적 문서 drift 다: (1) `17-agent-memory.md` 가 전 구간에서 `/api` prefix 를
생략해 API 컨벤션 §2.1 기본 패턴과 어긋나고, (2) 4개 파일이 폴더 관례인 `## Overview` 헤딩 없이
시작한다. 둘 다 구현 코드나 wire 계약에 영향을 주지 않는 문서 표기 수준의 불일치이며, CRITICAL 로
격상할 만한 invariant 위반은 없었다.

## 위험도

LOW
