# 정식 규약 준수 검토 — `spec/conventions/swagger.md`

## 검토 대상

`--impl-prep` scope 로 지정된 target 은 `spec/conventions/swagger.md` 전문(현재 `main`
merge 상태와 동일, diff 0 확인됨)이다. 이 문서 자체가 `spec/conventions/**` 소속 정식 규약이므로,
검토는 (a) 문서 내부 자기 일관성, (b) `spec/5-system/2-api-convention.md`·
`spec/data-flow/12-workspace.md`·`spec/conventions/error-codes.md` 등 인접 SoT 와의 정합,
(c) 실제 코드(`codebase/backend/src/common/swagger/**`, `repo-guards/__tests__/**`)와의
명명·범위 일치를 기준으로 수행했다.

## 발견사항

- **[WARNING] §2-4 "상태 코드 응답 규칙" 표가 문서 자신·실제 코드가 이미 쓰는 상태 코드를 누락**
  - target 위치: `spec/conventions/swagger.md` §2-4, 289~302행 (표 자체는 293~302행)
  - 위반 규약: 같은 문서의 §5-2 응답 DTO 규약(468행 `ApiOkWrappedResponse` 인벤토리 표)과
    §5-4 체크리스트(514행), 그리고 `spec/5-system/2-api-convention.md` §6 HTTP 상태 코드 표
    (338~355행)
  - 상세: §2-4 표는 `200/201/204/3xx/400/401/403/404/409/502` 만 나열한다. 그러나
    - **202 Accepted**: 같은 문서 §5-2 가 `ApiAcceptedWrappedResponse(Dto)` 를 "단일 객체 202
      Accepted" 헬퍼로 이미 등재하고 있고(470행), §5-4 체크리스트도 `ApiAccepted*` 를 "성공
      응답 데코레이터 전부" 에 명시적으로 포함한다(514행). 실제 코드에서도
      `workflows.controller.ts`·`interaction.controller.ts`·`schedules.controller.ts`·
      `graph.controller.ts`·`knowledge-base.controller.ts`·`hooks.controller.ts` 6개
      컨트롤러가 `ApiAcceptedResponse`/`ApiAcceptedWrappedResponse` 를 쓴다.
    - **410 Gone**: `spec/5-system/2-api-convention.md` §6 이 정식으로 등재한 상태 코드(비활성
      트리거·종료된 execution 명령·만료 초대)이고, 실제로 `interaction.controller.ts`·
      `invitations.controller.ts`·`workspaces.controller.ts` 가 `HttpStatus.GONE`/
      `ApiGoneResponse` 를 쓴다.
    - **429 Too Many Requests**: 마찬가지로 api-convention §6 에 있고, `llm-model-config`·
      `interaction`·`invitations`·`workspaces`·`third-party-oauth`·`integrations`·`hooks`
      7개 컨트롤러가 실제로 쓴다.
    이 표는 "새 엔드포인트 작성 시 참고표" 로 기능하는데(§4 작업 순서·§5-4 체크리스트가 참조),
    실제 시행 가드(`http-status-advertised-guard.ts`)는 표를 보지 않고 `@nestjs/swagger` 의
    모든 `Api*Response` export 를 reflection 으로 읽어 판정하므로(29·46~51행 주석) **가드
    자체는 완전**하다 — 다만 사람이 새 엔드포인트를 작성할 때 참고하는 이 표만 좁아, 202/410/429
    라우트를 작성하는 사람이 "표에 없으니 데코레이터가 필요 없다" 고 오독할 여지가 있다.
    가장 최근 커밋(`0186bea98`, 이번 세션이 §2-4 에 3xx 행을 추가한 바로 그 커밋)도 이 표를
    건드리면서 202/410/429 는 채우지 않았다.
  - 제안: §2-4 표에 `202 | @ApiAcceptedResponse` · `410 | @ApiGoneResponse` ·
    `429 | @ApiTooManyRequestsResponse` 행을 추가해 §5-2·§5-4·api-convention §6 과 커버리지를
    맞춘다. (가드 동작 자체는 변경 불필요 — 문서 표만 좁다.)

- **[INFO] `## Overview` 3섹션 구성 미준수 (기존 상태, 이번 변경과 무관)**
  - target 위치: `spec/conventions/swagger.md` 전체 — `# Swagger 문서화 일관된 패턴 가이드`
    직후 바로 `## 0)` 로 시작, `## Overview` 섹션 없음(529행 `## Rationale` 은 있음)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §단일 진실 원칙("각 spec 문서는
    3섹션 — Overview / 본문 / Rationale")
  - 상세: `git blame` 상 이 구조는 2026-04-14(`7d9529b9a8`) 부터이며 이번 PR 이 만든 갭이
    아니다. `spec/conventions/*.md` 25개 중 12개만 `## Overview` 를 갖고 있어(예:
    `error-codes.md`·`review-citations.md`·`spec-impl-evidence.md` 는 있음, `node-output.md`·
    `secret-store.md`·`conversation-thread.md` 등은 없음) 저장소 전체가 이 규칙을 일관되게
    지키지 않는 상태다 — swagger.md 만의 이탈이 아니다.
  - 제안: 이번 PR 스코프 밖이므로 차단 사유는 아니다. 별도 문서 위생 라운드에서 `spec/conventions/`
    전체를 훑어 Overview 유무를 일괄 정리할 때 함께 처리 권장.

## 교차 검증 — 위반 없음을 확인한 항목

- `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole(role)` 명명·위치(`common/swagger/forbidden-descriptions.ts`,
  `index.ts` 배럴 export)는 target §5-4 서술과 실제 코드가 정확히 일치.
- 참조 코드 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 는
  `error-codes.md`·`data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드" 와
  `UPPER_SNAKE_CASE` 표기·의미 모두 일치.
- frontmatter `code:` 의 모든 glob/파일 항목(`swagger-dto-contract*`, `dto-class-name-collision*`,
  `response-contract*`, `swagger-probe*`, `user-entity-exposure*`, `user-secret-absence*`,
  `param-uuid-pipe*`, `http-status-advertised*`, `forbidden-response-codes*` 및 각 fixture)이
  실제 파일에 매치 — `spec-impl-evidence.md` §2.1 `code:` 요건(≥1 매치) 충족.
- §5-1·§1-7 DTO 명명 규칙은 이번 커밋 3건이 DTO 파일을 건드리지 않아 재검증 불필요(스코프 밖).
- 문서 간 anchor 인용(`../data-flow/12-workspace.md#가드-거부의-오류-코드-2026-09-25` 등)은
  대상 heading 실존 확인.

## 요약

이번 세션(§5-4 403 설명 공용 헬퍼화 + §2-4 "성공 응답 하나 이상 광고" 강제)이 신설한 규약 텍스트와
코드(`forbidden-descriptions.ts`, 각 `repo-guards/__tests__/*-guard.ts`)는 명명·참조 코드·frontmatter
증거 모두 정합하며 CRITICAL 급 위반은 발견되지 않았다. 다만 이번 커밋이 직접 편집한 §2-4 표가
같은 문서·인접 SoT 가 이미 다루는 202/410/429 상태 코드를 누락해, 신규 엔드포인트 작성자가 참고할
"정식 규약" 표 자체의 커버리지가 좁다 — 시행 가드는 표에 의존하지 않아 실질적 구멍은 아니지만
문서 신뢰도 저하 소지가 있다(WARNING). `## Overview` 섹션 부재는 저장소 전반의 기존 관행이라
이번 변경 탓이 아니다(INFO).

## 위험도

LOW
