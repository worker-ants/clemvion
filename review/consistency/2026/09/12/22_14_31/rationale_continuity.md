# Rationale 연속성 검토 — spec/5-system (impl-done)

## 조사 범위와 방법

`spec/5-system/` 자체의 diff 는 0파일이라 "target 문서" 갱신은 없다. 대신 이번 배치
(`trigger-uuid-and-guide-codes`)가 건드린 코드(`triggers.controller.ts` `rotateBotToken`,
`auth.controller.ts` `switchWorkspace`, MDX 가이드 4곳, `backend-labels.ts`(.test) 주석,
`mcp-servers*.mdx`)가 spec/5-system 의 `## Rationale` 이 기록한 결정·invariant 와 충돌하는지를
검사했다. 절대경로 워킹트리에서 `git diff origin/main...HEAD` 를 직접 읽고, 아래 문서의
`## Rationale` 절 및 인접 SoT 표를 원문으로 대조했다:

- `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md` (번들 전문)
- `spec/5-system/15-chat-channel.md` §5.4/§5.4.1/§5.4.1.2, `## Rationale`(R-CC-10·18·21·23 등) — 직접 Read
- `spec/5-system/3-error-handling.md` §1.3·§1.12, `## Rationale` — 직접 Read
- `spec/data-flow/12-workspace.md` "UUID 검증 강도 비대칭 (2026-08-09)" — 직접 Read
- `spec/conventions/error-codes.md` §2·§5(rename 정책), `spec/conventions/swagger.md` §5-4·Rationale — 직접 Read
- `plan/in-progress/trigger-uuid-and-guide-error-codes.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff (등재 근거 확인용)

## 발견사항

- **[INFO]** `rotate-bot-token` 의 신규 400 분기가 `15-chat-channel.md §5.4`/`3-error-handling.md §1.12` SoT 표에 아직 없다
  - target 위치: `spec/5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약` 의 실패 응답 표, `spec/5-system/3-error-handling.md#112-chat-channel-bot-token-회전-에러-코드-도메인-spec-참조` 카탈로그 echo
  - 과거 결정 출처: `2-api-convention.md §5.3` 의 *"등재되지 않은 코드는 소비자가 존재를 알 방법이 없다"*(카탈로그 등재 의무), 그리고 §5.4 표 자체의 기존 관례 — 같은 400 이라도 사유(`WORKSPACE_ID_REQUIRED` 부재 vs `VALIDATION_ERROR` 형식파손)가 다르면 별도 행으로 분리해 온 패턴
  - 상세: `triggers.controller.ts rotateBotToken` 에 `ParseUUIDPipe` 를 붙이면서 `:id` 가 UUID 형식이 아닐 때 `400 VALIDATION_ERROR` 를 내는 새 관측 가능 분기가 생겼다. 컨트롤러의 `@ApiBadRequestResponse` 설명과 `CHANGELOG.md`(Unreleased 항목)에는 반영됐지만, §5.4/§1.12 의 canonical 표에는 아직 행이 없다. 다만 이것이 "무근거 번복"은 아니다 — `VALIDATION_ERROR` 는 §1.3 에 이미 등록된 400 기본 코드를 재사용하는 것이라 §5.3 의 "신규 코드 등재 의무" 문언을 문자 그대로 위반하지는 않는다(같은 논리를 §5.4.1.2 가 *"top-level code 는 기존 VALIDATION_ERROR 재사용이라 §1 카탈로그 신규 등재는 필요 없다"* 로 이미 명시).
  - 처리 확인: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 **planner 항목**으로 명시 등재돼 있고(*"자기-반증형 소정정 조건 1 미충족 — 내가 쓴 문장이 아니다"*), `/ai-review` 라운드 2·4(SD1/SD2)가 이미 같은 지적을 했으며 developer 도 중복 등재하지 않고 확인만 했다. 즉 **은폐되거나 방치된 drift 가 아니라 절차대로 planner 턴에 넘겨진 상태**다.
  - 제안: 다음 `project-planner` 턴에서 §5.4 표에 `400 | VALIDATION_ERROR | :id 가 UUID 형식이 아님 (ParseUUIDPipe)` 행을 추가할 때, `swagger.md §5-4` 체크리스트의 런타임 축 누락(아래 두 번째 항목)도 같은 턴에 함께 닫는 편이 일관적이다 — 두 갭이 같은 실측(`param-uuid-pipe` 가드)에서 나왔다.

- **[INFO]** `swagger.md §5-4` 체크리스트가 UUID 경로 파라미터의 "런타임 축"(`ParseUUIDPipe`)을 요구하지 않는다 — 실측 확인
  - target 위치: `spec/conventions/swagger.md#5-4-새-엔드포인트-체크리스트`
  - 과거 결정 출처: 없음(공백) — 단, `swagger.md` 자체의 `## Rationale`에 **동형 선례**가 있다: *"§5-4 확장 배경 — `@WorkspaceId()` 소비 라우트로 확대 (2026-08-08)"* — 구현이 바뀌어 체크리스트 전제가 깨졌을 때 "규약 문구까지 고쳐 문서-구현 동기화" 한 사례
  - 상세: `grep -n "ApiExcludeEndpoint\|ParseUUIDPipe" spec/conventions/swagger.md` 결과 `ParseUUIDPipe` 0건. §5-4 는 *"경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용"* 문서 축 한 줄만 요구한다. 이번 PR 은 저장소 실측(id-형 `@Param` 136/136 이 `ParseUUIDPipe` 보유, 이 PR 이 마지막 1건을 채움)을 근거로 이 축도 규약에 반영돼야 한다고 판단했고, **developer 자신이 그 문장을 쓴 것이 아니므로 자기-반증형 소정정 조건 1 미충족**이라 스스로 고치지 않고 planner 항목으로 등재했다 — 이는 CLAUDE.md 의 spec 소유 경계 규약을 올바르게 지킨 사례다.
  - 제안: planner 턴에서 §5-4 에 `@Param('<id>', ParseUUIDPipe)` 항목을 추가할 때, 2026-08-08 선례와 같은 문구("동작 변경이 아니라 문서-구현 동기화")로 갱신하면 Rationale 톤이 일관된다.

- **정합 확인(발견 아님)**: 이번 diff 는 기존 Rationale 을 위반하지 않고 오히려 **강화**한다
  - `spec/data-flow/12-workspace.md#x-workspace-id-헤더-vs-id-경로-파라미터--uuid-검증-강도-비대칭-2026-08-09` 는 *"워크스페이스 `:id` 경로 파라미터는 `ParseUUIDPipe` 로 엄격 검증한다"*는 invariant 를 이미 확정해 두었다. `triggers.controller.ts rotateBotToken` 은 형제 6개 엔드포인트와 달리 이 invariant 를 어기고 있던 **유일한 예외**였고, 본 PR 이 그 예외를 닫았다. 즉 이 diff 는 기각된 대안을 되살리거나 원칙을 무시하는 방향이 아니라, 이미 합의된 원칙 쪽으로 코드를 되돌리는 방향이다.
  - `error-codes.md §2`(rename=breaking 정책)·`§5`(Rename 이력 등급 A/B 실무)와 비교해도, 이번 500→400 변경은 "코드 값 rename"이 아니라 "미분류 실패 경로의 신규 분류"라 §5 의 등록 대상이 아니다. 다만 이 저장소가 이전에 **동일 엔드포인트**에서 겪은 `WORKSPACE_REQUIRED`→`WORKSPACE_ID_REQUIRED`(#566, 401→400) breaking 변경과 같은 처리 패턴(grep 근거로 소비자 영향 확인 + CHANGELOG 명시)을 그대로 따르고 있어 절차적으로 이 저장소의 기존 관행과 정합적이다.
  - 가이드 문서 4곳·`backend-labels.ts`(.test) 의 `TRIGGER_NOT_FOUND` 오귀속 정정은 `spec/data-flow/10-triggers.md:74` (hooks 인입 전용 404) 및 `triggers.controller.ts` 의 `@ApiNotFoundResponse`(`RESOURCE_NOT_FOUND`) 와 정확히 일치시키는 방향이며, 이 코드에 대한 어떤 spec Rationale 도 "이 문서 4곳에 `TRIGGER_NOT_FOUND` 를 남겨 두라"고 요구하지 않는다 — 기각된 대안 재도입이 아니다.

## 요약

`spec/5-system` 은 이번 PR 에서 직접 수정되지 않았고, 코드 diff(`ParseUUIDPipe`/`@ApiParam format` 추가, 가이드 오기 정정)도 이 영역의 `## Rationale` 이 기록한 결정 — 특히 `data-flow/12-workspace.md` 의 "UUID 검증 강도 비대칭" invariant — 을 위반하지 않고 오히려 그 invariant 를 지금까지 어기고 있던 유일한 예외(`rotateBotToken`)를 닫는 방향이다. 새로 생긴 관측 가능한 400 분기가 `15-chat-channel.md §5.4`/`3-error-handling.md §1.12` 의 canonical 실패-코드 표와 `swagger.md §5-4` 체크리스트에 아직 반영되지 않은 두 군데 갭이 있으나, 둘 다 이미 이전 `/ai-review` 라운드에서 지적됐고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 명시 등재돼 있어 — CLAUDE.md 의 developer/spec 소유 경계 규약(자기-반증형 소정정 조건 1 미충족 시 분리)을 올바르게 따른 결과다. 기각된 대안의 무단 재도입, 합의 원칙의 무시, 근거 없는 결정 번복, 암묵적 invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

LOW
