# 정식 규약 준수 검토 — spec/5-system/

## 사전 확인

- `git diff origin/main...HEAD -- spec/` 는 **빈 결과**다 — 이 PR(HEAD `76203ad63`, 관련 plan
  `update-returning-tuple-shape.md`)은 `spec/` 을 1바이트도 바꾸지 않았다.
  `plan/in-progress/update-returning-tuple-shape.md` frontmatter `spec_impact: none` 는 실측과
  일치한다(허위 `none` 아님 — CLAUDE.md/plan-lifecycle 가 우려하는 "본문은 spec 정정을
  요구하는데 frontmatter 만 none" 패턴이 **아니다**. 오히려 본문이 "developer 는 spec 쓰기
  권한이 없어 planner 위임" 이라고 스스로 명시하고 있다).
- 실제 코드 변경은 `execution-engine.service.ts` / `knowledge-base.service.ts` /
  `auth-oauth.service.ts` / 신규 `common/utils/update-returning-rows.ts` — 전부 TypeORM
  `UPDATE...RETURNING` 반환 shape(`[rows, rowCount]` 튜플)을 잘못 다루던 버그의 수정이다.
  Controller/DTO/Swagger 데코레이터 변경은 0건 — API 표면·출력 포맷·명명에 신규 노출이 없다.
- 따라서 본 검토는 "이 diff 가 새로 어긴 규약" 이 아니라 **target 범위(spec/5-system/) 의
  현재 상태**를 규약 대비 점검하는 standing-audit 성격이다. `spec/5-system/4-execution-engine.md`
  §1.1(admission·짝 전이)·§8(동시 실행 제한·admission gate)·§9(Redis 키)를 diff 인접 섹션으로
  집중 확인했다 — `spec/conventions/node-cancellation.md`·`spec/conventions/redis-keys.md` 교차
  참조가 정확하고, 에러 코드(`EXECUTION_TIME_LIMIT_EXCEEDED`, `EXECUTION_QUEUE_WAIT_TIMEOUT`)는
  `UPPER_SNAKE_CASE` 로 `spec/conventions/error-codes.md` 표기 규약과 일치한다. 이 범위에서
  CRITICAL 은 없다.

## 발견사항

- **[WARNING] 3번째 재발한 결함 클래스에 대응하는 정식 규약이 없다**
  - target 위치: (규약 부재 — 특정 spec/5-system 섹션 아님) `spec/conventions/` 전체
  - 위반 규약: 특정 항목 위반이 아니라 **항목 부재**. 가장 근접한 기존 규약은
    `spec/conventions/node-cancellation.md` §2.4(DB 관측 가드) — `updateExecutionStatus` 의
    반환값 해석이 그 가드의 핵심 전제인데, 그 "무엇을 반환하는가" 를 규약화한 문서가 없다.
  - 상세: `plan/in-progress/update-returning-tuple-shape.md` 가 직접 실측한 바 — TypeORM
    `EntityManager.query()` 는 `UPDATE`/`DELETE ... RETURNING` 에 한해 `[rows, rowCount]`
    튜플을 돌려주는데(INSERT 는 행 배열 그대로), 이 저장소에서 **동일 오해가 최소 3계열
    독립 발생**했다: `execution-engine`(admission gate·`updateExecutionStatus`),
    `knowledge-base`(재추출/재임베딩 CAS 락·재큐), `auth-oauth`(소셜 로그인 state 소비 — 상시
    실패). 이번 PR 이전에도 `agent-memory-admin`(`deletedRowCount`)·`stuck-document-recovery`
    (구조분해)에서 같은 클래스가 이미 한 번씩 터졌었다(plan 본문 §"이 저장소는 이미 이 결함을
    세 번 겪었고"). `spec/conventions/` 어디에도 "raw `UPDATE`/`DELETE ... RETURNING` 소비는
    `updateReturningRows` 경유" 를 요구하는 금지/필수 항목이 없어, 이 checker 의 관점
    5("금지 항목")가 겨냥하는 반복 결함 클래스가 규약 레벨에서 방어되지 않는다.
  - 제안: target(spec/5-system/) 수정이 아니라 **규약 신설**이 맞는 방향 — 이미
    `update-returning-tuple-shape.md` 본문이 이를 project-planner 위임 항목으로 명시 등재했다
    ("같은 결함이 세 번 개별 발생했는데 invariant 가 spec/conventions/ 에 없다"). 본 검토는 그
    위임의 독립 확인이다. 신설한다면 위치는 신규 `spec/conventions/typeorm-query-result-shape.md`
    또는 기존 규약(예: `node-cancellation.md` §2.4 인접) 에 짧은 절 추가 중 택1.

- **[INFO] spec/5-system/ 18개 문서 중 6개가 명시적 `## Overview` 섹션이 없다**
  - target 위치: `spec/5-system/2-api-convention.md`, `5-expression-language.md`,
    `6-websocket-protocol.md`, `7-llm-client.md`, `11-mcp-client.md`, `16-system-status-api.md`
    (전부 제목(`# Spec: ...`) → `> 관련 문서` → 바로 `## 1. ...` 로 진입, `## Overview` 헤딩 없음)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 (각 SKILL.md
    참고 지시) — 검토 관점 3("문서 구조 규약")이 겨냥하는 항목. 단 CLAUDE.md 표현 자체가
    "권장"이라 강제(CRITICAL) 대상은 아니다.
  - 상세: 대조군으로 `4-execution-engine.md`·`3-error-handling.md`·`14-external-interaction-api.md`·
    `10-graph-rag.md` 등 12개 문서는 명시적 `## Overview` 섹션(불릿 요약 포함)을 갖는다. 6개
    문서는 그 섹션 없이 바로 세부 조항(`## 1. 기본 원칙` 등)으로 진입해, 동일 폴더 안에서
    구조 컨벤션이 갈린다. 이번 PR 은 이 6개 파일 중 어느 것도 건드리지 않았으므로 **이 PR 이
    만든 신규 위반이 아니라 pre-existing 상태**다.
  - 제안: 이 PR 의 blocking 사유는 아님(diff 밖, 코드 전용 PR). 다음에 이 6개 문서 중 하나를
    실제로 편집하는 spec PR 이 있을 때 `## Overview` 절 보강을 함께 고려할 것 — project-planner
    범위, 새 plan 등재까지는 불필요한 낮은 우선순위.

- **[INFO] API 문서 규약(`spec/conventions/swagger.md`) — 이번 diff 대상 외**
  - target 위치: 해당 없음
  - 위반 규약: 해당 없음(관점 4 점검 결과 기록용)
  - 상세: 이번 diff 는 `execution-engine.service.ts`/`knowledge-base.service.ts`/
    `auth-oauth.service.ts`(모두 Service, Controller/DTO 아님) + 신규 유틸리티 1개뿐이다.
    `@Api*` 데코레이터·DTO 변경 0건 — swagger.md 데코레이터/DTO 명명 패턴 점검 대상 표면이
    이 diff 에 존재하지 않는다.
  - 제안: 없음(정보성 기록).

## 요약

이번 PR 은 `spec/` 을 전혀 건드리지 않는 순수 백엔드 버그 수정(TypeORM `UPDATE/DELETE ...
RETURNING` 이 `[rows, rowCount]` 튜플임을 행 배열로 오인하던 결함, 3계열 재발)이며
`spec_impact: none` 선언은 실측과 일치한다. Target 범위 `spec/5-system/` 중 diff 와 직접
인접한 `4-execution-engine.md` §1.1/§8/§9 는 `spec/conventions/node-cancellation.md`·
`redis-keys.md`·`error-codes.md` 와 정합하며 CRITICAL 위반은 발견되지 않았다. 유일하게 실질적인
발견은 WARNING 1건 — 동일 결함 클래스가 규약 레벨 금지 항목 없이 세 번째 재발했다는 점으로,
이는 이미 developer 의 plan(`update-returning-tuple-shape.md`)이 project-planner 위임으로
스스로 등재해 둔 항목의 독립 확인이며 target 문서 수정이 아니라 규약 신설 방향이 맞다. 그 외
문서 구조(`## Overview` 결여 6개 파일)·API 문서 규약(표면 없음)은 정보성 INFO 로만 기록한다.

## 위험도
LOW
