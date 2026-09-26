# 정식 규약 준수 검토 — forbidden-desc-codes (`--impl-prep`)

## 검토 범위

프롬프트가 번들한 target(`spec/conventions/swagger.md`·`spec/data-flow/12-workspace.md`·`spec/5-system/1-auth.md`,
`spec/5-system/3-error-handling.md` 는 예산 초과로 생략)에 더해, 이 작업의 실제 산출물인
`plan/in-progress/forbidden-desc-codes.md`(구현 plan)과 `plan/in-progress/spec-draft-swagger-forbidden-codes.md`
(project-planner 가 적용할 §5-4 spec draft)를 직접 Read 해 대조했다 — 번들에 빠져 있었으나 "여기 없다는 사실을
없다는 근거로 삼지 말라"는 프롬프트 지시에 따라 판정에 필요해 직접 열었다(하단 발견사항 참고).

## 발견사항

- **[CRITICAL] 현재 `swagger.md` §5-4 문구가 이미 배포된 가드 동작·SoT 와 어긋난다**
  - target 위치: `spec/conventions/swagger.md` §5-4 (새 엔드포인트 체크리스트) — "`@Roles()` 가 있으면 설명에
    … 요구 역할과 코드를 명시하고, `@Roles()` 없이 워크스페이스만 받으면 … `NOT_A_MEMBER` 로 통일한다" 문장
  - 위반 규약: 같은 문서가 인용하는 SoT [`spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류
    코드"](spec/data-flow/12-workspace.md) — "**비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER` 다**"(채택안 (나))
  - 상세: 현재 §5-4 문구대로 새 엔드포인트를 작성하면 `@Roles('editor')` 라우트는 `EDITOR_REQUIRED` 코드만
    광고하고 `NOT_A_MEMBER`(실제로 비멤버가 받는 코드)를 빠뜨린다. 이는 가정에 그치는 문제가 아니다 —
    `plan/in-progress/forbidden-desc-codes.md` 의 2026-09-26 reflection 실측이 이미 **157곳 중 129곳**이 이
    문구를 그대로 따라 코드 일부를 빠뜨린 상태임을 확인했다. OpenAPI 로 클라이언트를 생성하는 소비자는 실제로
    올 수 있는 403 코드를 알 방법이 없다 — "출력 포맷 규약(에러 코드)이 정식 규약을 따르는가" 축의 직접 위반이며,
    지금 이 문서를 그대로 참고해 새 엔드포인트를 추가하는 개발자도 같은 결함을 재생산한다.
  - 제안: 이미 준비된 `plan/in-progress/spec-draft-swagger-forbidden-codes.md` "변경 (2)"·"변경 (3)"을
    project-planner `--spec` 턴으로 반영해 §5-4 문구를 "가드가 낼 수 있는 거부 코드를 전부 싣는다(`NOT_A_MEMBER`
    + 요구 중 가장 낮은 역할 코드)"로 정정한 뒤 구현에 착수한다 — plan 자신의 체크리스트도 "spec draft `--spec`·
    반영"을 "`--impl-prep`"보다 먼저 두고 있으므로, 이 순서를 지키면 이 CRITICAL 은 다음 커밋에서 해소된다.
    draft 내용 자체는 12-workspace.md·error-codes.md·ROLE_REQUIRED/NOT_A_MEMBER 상수와 대조해 정확함을
    확인했다(아래 요약 참고) — 반영 여부만 남았다.

- **[WARNING] §3 길이 규약이 응답 데코레이터(`@ApiForbiddenResponse`) 설명을 분류하지 않는다**
  - target 위치: `spec/conventions/swagger.md` §3 "길이 — 강제되는 것과 지향하는 것을 가른다" 표
  - 위반 규약: 같은 문서 §3 자체 — 표가 "엔드포인트 `summary`"·"엔드포인트 `description`"·"DTO `description`"
    세 갈래만 분류하고, 응답 레벨 데코레이터(`@ApiOkResponse`/`@ApiForbiddenResponse` 등)의 `description` 은
    범주가 없다
  - 상세: 이번 draft 가 신설하는 헬퍼(`FORBIDDEN_NOT_A_MEMBER` + `forbiddenForRole(role)`)는 최대 두 코드
    문장을 이어 붙인 `@ApiForbiddenResponse({ description })` 을 129곳(+기존 28곳)에 채운다. `workspaces.
    controller.ts` 의 기존 `FORBIDDEN_OWNER_ROUTE` 류는 이미 콤마로 세 번째 절까지 붙는 사례(예: 소유자 이전
    라우트)가 있어 "몇 자까지"가 §3 어느 행에도 속하지 않는 채로 계속 늘어난다. 강제 대상이 아니므로 CRITICAL
    은 아니지만, 문서 구조상 빈 칸으로 남아 있다는 점은 §3 신설 당시("강제되는 것과 지향하는 것을 가른다")의
    취지와 어긋난다.
  - 제안: 이번 draft 범위 밖이라도 좋으니, §3 표에 "응답 데코레이터 `description`" 행을 추가하거나(성격:
    지향/무제한) 최소한 "위 표는 `@ApiOperation`·DTO 필드에 한정하며 `@ApiXxxResponse` 는 별도"라는 각주를
    남기는 후속 spec-draft 를 트래커에 등재할 것을 권한다.

- **[INFO] 이번 `--impl-prep` 번들이 실제 변경 대상 문서(spec draft)를 포함하지 않았다**
  - target 위치: 프롬프트 "Target 문서" 절 — `spec/conventions/swagger.md`·`spec/data-flow/12-workspace.md`·
    `spec/5-system/1-auth.md`(+ 예산 초과로 생략된 `3-error-handling.md`)만 번들, `plan/in-progress/
    spec-draft-swagger-forbidden-codes.md` 는 미포함
  - 위반 규약: 없음(스코프 구성의 하드 룰 위반은 아님) — 다만 `spec-impl-evidence.md` 의 `code:`/`related_specs`
    수집 로직이 `spec/**` 만 훑고 `plan/**` 의 draft 파일은 대상이 아니므로 구조적으로 빠질 수밖에 없다
  - 상세: 이번 리뷰의 실질 산출물(§5-4 wording 변경)은 아직 `plan/in-progress/` 에만 있고 `spec/` 에는 반영
    전이라, "swagger.md 를 대상으로 --impl-prep 을 돈다"는 스코프 구성이 정작 검토해야 할 새 문구를 못 실었다.
  - 제안: 이런 "spec draft 선행 → planner 반영 → impl-prep" 순서를 따르는 작업은 prep-scope 구성 시
    `plan/in-progress/spec-draft-*.md` 도 같은 worktree 기준으로 함께 번들하는 편이 이 checker 의 판정 정확도를
    높인다(하드 요구는 아니므로 INFO).

## 준수 확인 (검증했으나 위반 아님 — 참고용)

아래는 검토 중 대조했고 **위반이 아님을 확인**한 항목들이다 — 후속 세션이 같은 것을 재검사하지 않도록 남긴다.

- 신설 가드 파일명 `forbidden-response-codes{-guard.ts,.spec.ts}` — 저장소 관례(`http-status-advertised-guard.ts`
  + `.spec.ts`, `param-uuid-pipe-guard.ts` + `.spec.ts`, `dto-class-name-collision-guard.ts` + `.spec.ts`)와
  정확히 일치.
- frontmatter `code:` 신규 항목 삽입 위치("`http-status-advertised` 두 줄 아래")가 실제 파일 마지막 두 줄과
  일치 — 잘못된 좌표 지시 없음.
- draft 가 인용하는 앵커(`#가드-거부의-오류-코드-2026-09-25`, `#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08`)
  가 `12-workspace.md` 실제 헤딩과 일치 — 링크 무결성 위반 없음.
- 헬퍼가 재사용하는 코드(`NOT_A_MEMBER`·`EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED`)는 모두
  `common/constants/workspace-roles.ts` 기존 상수 — `error-codes.md` 의 신규 코드 명명 절차를 우회하지 않음
  (새 코드를 만들지 않고 기존 코드를 문서·설명에 노출할 뿐).
- integrations 의 기존 `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 상수가 `NOT_A_MEMBER` 코드를 빠뜨리고 있음을 별도
  실측으로 재확인했다 — plan 표의 "4건" 집계와 일치, plan 자체가 이미 정확히 진단했다.
- `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 의 frontmatter(`worktree`/`started`/`owner`)와
  developer plan(`forbidden-desc-codes.md`)이 **같은 worktree 를 공유하는 두 개의 in-progress plan** 구조는
  선례(`eia-r8-cache-scope-4ae434` 워크트리의 `eia-terminal-payload.md` + `spec-draft-eia-62-waiting-payload.md`
  + `spec-draft-eia-notification-payload-contract.md`)와 동형 — 위반 아님.

## 요약

이번 작업의 핵심 산출물(`plan/in-progress/spec-draft-swagger-forbidden-codes.md`)이 제안하는 §5-4 재작성
내용 자체는 12-workspace.md SoT·기존 코드 상수·저장소 명명 관례와 대조해 정확하고 일관되게 설계돼 있다.
다만 그 draft 는 아직 `spec/conventions/swagger.md` 에 반영되지 않았고, **현재 merge 된 target 문서는 실측으로
확인된 129곳의 불일치를 낳은 바로 그 잘못된 문구를 그대로 담고 있다** — 이것이 유일한 CRITICAL 이며, 해법은
이미 draft 로 준비돼 있으므로 project-planner `--spec` 반영을 `--impl-prep` 진행보다 먼저 완결하면 해소된다.
그 외에는 §3 길이 규약의 사각지대(WARNING, 이번 draft 범위 밖) 와 리뷰 스코프 구성에 대한 절차적 관찰(INFO)
뿐이다.

## 위험도

HIGH — CRITICAL 항목 1건이 이미 배포된 spec 문서(swagger.md §5-4)의 활성 오류이지만, 원인 진단과 수정 draft
가 모두 준비돼 있어 즉시 반영 가능하다. project-planner `--spec` 반영 없이 그대로 developer 구현을 진행하면
새 엔드포인트가 계속 같은 결함을 재생산할 수 있으므로 그 순서를 지키는 것이 조건이다.
