# Cross-Spec 일관성 검토 — `trigger-uuid-and-guide-codes` (impl-done, scope=spec/5-system/)

## 검토 방법 메모

이 세션의 `spec/5-system` 델타는 0개 파일이다(코드 전용 PR). `_prompts/cross_spec.md` 는
컨텍스트 예산으로 diff 본문·다수 spec 파일이 절단돼 있어, 워킹트리를 절대경로로 직접 읽고
`git diff origin/main...HEAD` 를 재실행해 실제 변경분(14파일/760줄 — `auth.controller.ts` ·
`triggers.controller.ts` · 신규 `repo-guards/__tests__/param-uuid-pipe*` · `backend-labels.ts`(+test)
· `content/docs/**` 4개 mdx · `CHANGELOG.md` · plan 2개)을 확인한 뒤, 관련 `spec/**` 문서
(`1-data-model.md` §2.8 Trigger · `5-system/1-auth.md` §5 · `5-system/15-chat-channel.md` §5.4/§5.4.1
· `conventions/swagger.md` §5-4 · `data-flow/10-triggers.md` · `2-navigation/2-trigger-list.md` ·
`5-system/11-mcp-client.md` · `conventions/i18n-userguide.md`)를 교차 대조했다.

## 발견사항

- **[WARNING]** `rotate-bot-token` 의 신규 `400 VALIDATION_ERROR` 분기가 `15-chat-channel.md §5.4`
  응답 계약 표에 없음 — 이미 추적됨, 신규 충돌 아님
  - target 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken`
    (`@Param('id', ParseUUIDPipe)` 신규 부착, diff 확인)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4 "실패 응답" 표 (369~379행) — `:id` 가
    UUID 형식이 아닌 경우의 `400 VALIDATION_ERROR` 행이 없다. 이 표는 CCH-SE-04 가 낼 수 있는
    `error.code` 전체를 나열하는 canonical 문서로 자기 자신이 선언한다.
  - 상세: 구현이 이제 실제로 이 코드 경로를 낼 수 있게 됐는데(`param-uuid-pipe` 가드 M9 뮤테이션이
    RED 로 이를 확인) spec 표는 그 분기를 모른다. 같은 성격으로 `spec/conventions/swagger.md §5-4`
    체크리스트도 "`@ApiParam({format:'uuid'})` 문서 축"만 요구하고 `ParseUUIDPipe` 런타임 축은
    문서 전체에 0건이다(실측) — 반면 저장소 실측은 id-형 `@Param` 136/136 이 이미 파이프를
    갖고, 이번 PR 이 마지막 1건(`rotateBotToken`)을 채워 그 관례를 완성했다. 즉 **가드(코드)가
    규약(spec/conventions)보다 넓게 물고 있는 상태**다.
  - 처분/근거: 두 항목 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (3217~3239행)에 planner 소유 항목으로 이미 등재돼 있고, developer 가 왜 직접 고치지
    않았는지(자기-반증형 소정정 조건 1 미충족 — 그 표·체크리스트 문장을 developer 자신이
    쓰지 않았다) 근거까지 적혀 있다. 두 차례 `/ai-review`(`20_01_18` requirement/documentation,
    `20_26_58` requirement) 가 각각 독립적으로 같은 갭을 SPEC-DRIFT 로 지적했고 둘 다 같은
    처분(planner 등재)으로 수렴했다. **새로 발견한 충돌이 아니라 이미 알려지고 추적 중인
    항목이며, 확인 결과 delta 도 처분도 정확하다** — merge-coordinator 는 이 두 항목이
    `spec/5-system/15-chat-channel.md` §5.4 표 1행 추가 + `spec/conventions/swagger.md` §5-4
    체크리스트 1행 추가로 별도 planner 턴에서 닫혀야 함을 인지하면 된다.

- **[INFO]** `TRIGGER_NOT_FOUND` 귀속 정정이 `data-flow/10-triggers.md` 와 정합
  - target 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (`ERROR_KO`) ·
    `lib/i18n/__tests__/backend-labels.test.ts` 주석
  - 대조 대상: `spec/data-flow/10-triggers.md:74` (`Hk-->>Ext: 404 TRIGGER_NOT_FOUND` — 인입
    webhook 경로), `spec/5-system/15-chat-channel.md §5.4`/`2-navigation/2-trigger-list.md`
    (트리거 REST API 404 는 `RESOURCE_NOT_FOUND`)
  - 상세: `TRIGGER_NOT_FOUND` 가 `spec/**` 전체에서 유일하게 등장하는 자리는
    `data-flow/10-triggers.md` 의 webhook 인입 흐름이며, chat-channel API 404 는 별도로
    `RESOURCE_NOT_FOUND` 로 이미 일관되게 문서화돼 있다(`15-chat-channel.md:371`,
    `2-trigger-list.md:246`). 이번 PR 의 주석 귀속 정정(코드 주석·문서 4곳)은 이 기존 spec
    분리를 정확히 반영한 것이고 새로운 모순을 만들지 않는다.

- **[INFO]** `switchWorkspace` `@ApiParam format:'uuid'` 추가는 spec 본문 변경 불요
  - target 위치: `codebase/backend/src/modules/auth/auth.controller.ts` `switchWorkspace`
  - 대조 대상: `spec/5-system/1-auth.md` §5 API 엔드포인트 표 (554행) — `POST
    /api/auth/workspaces/:id/switch` 항목이 이미 "`:id` 는 `ParseUUIDPipe`" 라고 서술
  - 상세: 이번 diff 는 OpenAPI 문서 생성용 데코레이터 필드(`format:'uuid'`) 한 줄만 추가했고
    런타임 파이프는 원래부터 있었다(spec 도 이미 그렇게 적어 뒀다). spec 본문이 서술하는
    계약은 바뀌지 않았으므로 동기화 불필요 — 위 §5.4/swagger.md 케이스와 달리 이쪽은 애초에
    갭이 없었다.

- **[INFO]** `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 문서 오타 수정이
  `5-system/11-mcp-client.md` 정본 표기와 일치
  - target 위치: `content/docs/06-integrations-and-config/mcp-servers{,.en}.mdx`
  - 대조 대상: `spec/5-system/11-mcp-client.md` (131·138·174·585행), `spec/5-system/1-auth.md`
    (298·779행), `spec/conventions/secret-store.md` (438행) — 전부 `MCP_ALLOW_INSECURE_URL` 로
    일관
  - 상세: 오타 수정 방향이 spec 정본과 일치. 충돌 아님.

- **[INFO]** 신규 `repo-guards/__tests__/param-uuid-pipe{-guard.ts,.spec.ts}` 는 기존 계층
  책임 구조를 따름
  - target 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` ·
    `param-uuid-pipe.spec.ts` · `fixtures/param-uuid-pipe/sample.controller.ts`
  - 대조 대상: 같은 디렉터리의 기존 가드 쌍(`swagger-dto-contract-guard.ts` +
    `swagger-dto-contract.spec.ts`, `endpoint-path-conflict-wrap-guard.ts` + `.spec.ts` 등)
  - 상세: `-guard.ts`(순수 판정 함수) + `.spec.ts`(전수 단언) + `fixtures/` 분리 패턴이 기존
    컨벤션과 동일. "정적 가드 vs AST 파서" 선택도 AST 기반(`@Param`/`@ApiParam` 데코레이터
    파싱)이라 코드베이스가 이미 채택한 "TS 소스는 정밀 파서" 원칙과 부합. 계층 책임 충돌 없음.

- 데이터 모델(`spec/1-data-model.md §2.8 Trigger` — `id: UUID PK`) · RBAC(§3.2) · 상태 전이
  · 요구사항 ID 부여 관점에서는 이번 diff 와 모순되는 다른 영역 서술을 찾지 못했다.

## 요약

이번 PR 은 `spec/5-system/**` 을 직접 수정하지 않는 코드 전용 변경(트리거 UUID 경로 파라미터
가드 부착 + 가이드 문서 오귀속 식별자 정정)이며, `data-flow/10-triggers.md`·`2-trigger-list.md`·
`11-mcp-client.md`·`1-auth.md §5` 등 관련 영역과 교차 대조한 결과 새로 발생한 모순은 없다.
유일하게 의미 있는 항목은 `15-chat-channel.md §5.4` 실패 응답 표와 `conventions/swagger.md §5-4`
체크리스트가 이번에 신설된 `400 VALIDATION_ERROR`(비-UUID `:id`) 분기·`ParseUUIDPipe` 런타임
관례를 아직 반영하지 못한 API-계약 문서 지연(lag)인데, 이는 developer 가 자기-반증형 소정정
조건을 충족하지 못해 직접 고칠 권한이 없는 자리라는 것을 스스로 인지하고
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 근거·처분 제안과 함께 명시적으로
등재해 두었다(실측으로 확인됨). 즉 "몰랐던 충돌" 이 아니라 "알고 있고 다음 planner 턴을
기다리는 지연"이므로 이 PR 자체를 막을 이유는 아니지만, 그 두 스펙 문서가 코드 관례보다
좁게 좁혀진 채로 남아있다는 사실은 통합 단계에서 놓치지 않아야 한다.

## 위험도

LOW
