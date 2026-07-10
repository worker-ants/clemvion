# 문서화(Documentation) 코드 리뷰

대상: EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드 (`waiting-surface-guard.ts` 신설 +
`resolveWaitingNodeExecutionId` 확장 + `hooks.service.ts` graceful catch). spec 본문 갱신은
`plan/in-progress/eia-command-waiting-surface-guard.md` 의 S-1 로 project-planner 위임 등재되어
있어 본 PR 범위 밖 — 코드 내 주석·JSDoc·swagger 설명의 정확성에 집중했다.

## 발견사항

- **[WARNING] `resolveWaitingNodeExecutionId` JSDoc — "표면 불일치" 항목이 중복 등재되고 케이스 열거 리스트가 무관한 문단으로 끊긴다**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5153-5174` (`resolveWaitingNodeExecutionId` 위 JSDoc)
  - 상세: diff 가 같은 리스트에 두 번 편집을 가했다. 먼저 기존 `- 0건 …` / `- 2건 이상 …` 리스트 바로 뒤에 짧은 한 줄 `- 표면 불일치 — {@link assertCommandMatchesWaitingSurface} 참조.`(L5160)를 추가했고, 그다음 기존에 있던 "DB lookup 자체의 infra 실패는 …" 문단(L5162-5163, 원래 이 함수의 별도 note로 리스트 밖에 있었음) 바로 뒤에 다시 훨씬 긴 `- 표면(interactionType) 불일치 — …`(L5165-5171) 블록과 `@param expectedCommand`(L5173-5175) 를 추가했다. 결과적으로 (a) 같은 "표면 불일치" 케이스가 한 번은 1줄 요약으로, 한 번은 풀 설명으로 **두 번** 등장하고, (b) 열거형 케이스 리스트(0건/2건 이상/표면 불일치)가 성격이 다른 "DB lookup infra 실패" 문단에 의해 시각적으로 두 조각으로 쪼개져, 리스트를 읽는 사람이 "표면(interactionType) 불일치"가 DB lookup 실패에 대한 하위 설명인지 별개의 3번째 케이스인지 헷갈리기 쉽다.
  - 제안: 짧은 `- 표면 불일치 — {@link assertCommandMatchesWaitingSurface} 참조.`(L5160) 한 줄만 남기고 상세 설명(L5165-5171)은 제거하거나(이미 `assertCommandMatchesWaitingSurface` 자체의 JSDoc에 동일 내용이 온전히 있음, L5241- 부근), 반대로 상세 블록만 남기고 짧은 줄을 지운다. 어느 쪽이든 리스트 3항목(0건/2건 이상/표면 불일치)을 연속으로 두고, "DB lookup 자체의 infra 실패는 …" 문단은 리스트 앞이나 뒤로 옮겨 리스트를 끊지 않게 재배치할 것. `@param expectedCommand` 는 JSDoc 관례상 본문 뒤 최하단에 두는 것이 표준이라 위치 자체는 무방하나, 중간에 낀 중복 리스트 항목부터 정리가 우선.

- **[WARNING] `waiting-surface-guard.ts` JSDoc 의 spec 상대경로 링크가 깨져 있음 (1단계 부족)**
  - 위치: `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts:8`
  - 상세: `[interaction-type-registry §1.2](../../../../spec/conventions/interaction-type-registry.md)` — 이 파일의 실제 경로는 `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts` 이므로 repo root(`spec/`)까지는 `../../../../../`(5단계: execution-engine→modules→src→backend→codebase→root)가 필요하다. 현재 4단계(`../../../../`)로는 `codebase/spec/conventions/interaction-type-registry.md` 를 가리켜 존재하지 않는 경로가 된다. 실측 확인(`os.path.normpath`): 4단계 경로는 미존재, 5단계 경로만 실제 파일과 일치.
    이 파일은 코드베이스 전체에서 유일하게 spec 문서를 markdown 링크 문법(`[text](path)`)으로 참조하는 곳이라(다른 파일들은 `spec/…md §n` 형태의 평문 인용을 씀) IDE 에서 hover 시 깨진 링크로 보인다.
  - 제안: `../../../../../spec/conventions/interaction-type-registry.md` 로 한 단계 추가하거나, 이 코드베이스의 기존 관례(평문 `spec/conventions/interaction-type-registry.md §1.2` 인용)를 따라 markdown 링크 문법 자체를 제거할 것.

- **[WARNING] CHANGELOG.md 미갱신 — 리포지토리 관례상 이 정도 규모의 동작 변경/버그 수정은 항목 추가가 기대됨**
  - 위치: `/CHANGELOG.md` (변경 없음 — 이번 PR 범위에 미포함)
  - 상세: `git log --oneline -- CHANGELOG.md` 로 확인한 최근 관례상, 사용자에게 보이는 동작 변화나 조용한 데이터 오염류 버그 수정은 거의 예외 없이 `## Unreleased — <제목> (<spec 영역> §n)` 항목을 동반한다(예: `feat(integrations): 활동 탭 "연결 안 됨" 상태 배너 (#894)` 커밋의 두 번째 fixup 로그에 정확히 "CHANGELOG 항목 (doc W2)"라는 항목이 있어, 이전 documentation reviewer 가 동일한 종류의 누락을 WARNING 으로 지적해 반영된 선례가 있다). 본 PR 은 "form 대기 중 `end_conversation` 이 빈 폼 제출로 조용히 오처리"되던 실제 데이터 무결성 버그를 수정하는, e2e 회귀 테스트까지 딸린 의미 있는 변경인데 CHANGELOG 항목이 없다.
  - 제안: `## Unreleased — EIA/WS continuation 명령 ↔ 대기 노드 표면 검증 (5-system/4-execution-engine §7.5.1)` 형태로 항목을 추가할 것. spec 본문(§7.5.1 표 신설 행 등)이 아직 project-planner 위임 대기 상태(S-1)이므로, CHANGELOG 항목은 이번 코드 PR 에서 미리 넣거나 최소한 후속 spec 동기화 커밋에서 반드시 함께 넣도록 plan 체크리스트에 항목을 추가해 둘 것 — 현재 plan 체크리스트(`plan/in-progress/eia-command-waiting-surface-guard.md`)에는 CHANGELOG 언급이 없다.

- **[INFO] `hooks.service.ts` graceful catch 의 JSDoc/로그 문구가 "표면 불일치"만 전제 — 드문 race 케이스에는 부정확할 수 있음**
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:705-717`(JSDoc), `:747-758`(catch 블록, `chat-channel inbound '${dto.command}' 이 현재 대기 표면과 맞지 않아 거부됨` 경고 로그)
  - 상세: catch 는 `err instanceof ConflictException` 전체를 잡는다. 현재 코드베이스에서 `interactionService.interact()` 가 던지는 `ConflictException` 은 두 출처뿐이다 — `assertWaiting()`(execution 이 `waiting_for_input` 아님) 과 `dispatchContinuation` 의 `InvalidExecutionStateError → STATE_MISMATCH` 매핑(0건/다중row invariant 위반 **또는** 신규 표면 불일치). 호출부(`hooks.service.ts:602` 부근)가 이미 `activeStatus === WAITING_FOR_INPUT` 확인 후에만 `forwardToInteractionService` 를 부르므로 `assertWaiting` 실패는 사실상 배제되지만, `resolveWaitingNodeExecutionId` 의 0건/다중row invariant 케이스(레이스로 인해 방금 사이 execution 이 대기 상태를 벗어난 경우 등)는 여전히 이 catch 를 통과하며 "표면과 맞지 않아 거부됨" 로그를 남긴다 — 실제로는 표면 문제가 아닐 수 있다. 기능적 버그는 아니고(둘 다 같은 `STATE_MISMATCH`로 정상 삼켜짐), 서버 로그 진단 정확성만의 이슈.
  - 제안: 굳이 세분화할 필요는 낮으나(드문 race), 원한다면 로그 문구를 "대기 상태/표면 불일치로 거부됨"처럼 조금 더 포괄적으로 완화하거나, JSDoc 에 "이 catch 는 표면 불일치 외에 드문 0건/다중row invariant race 도 함께 삼킨다"는 한 줄을 덧붙여 향후 디버깅 시 오도되지 않게 할 것. 반드시 고칠 필요는 없음.

- **[정보 확인 — 문제 없음] swagger(`interaction.controller.ts`) `ApiConflictResponse` 설명 갱신은 정확**
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts:83-87`
  - `STATE_MISMATCH` 설명에 "명령이 현재 대기 노드의 인터랙션 표면과 불일치 — 예: Form 대기 중 end_conversation" 을 추가한 것은 실제 신규 동작(`assertCommandMatchesWaitingSurface`)과 정확히 일치한다. 새 API 엔드포인트·필드 추가가 아니라 기존 409 조건의 서술 확장이라 그 외 swagger 항목(요청/응답 DTO, 다른 응답 코드) 변경은 불필요 — 적절한 범위.

- **[정보 확인 — 문제 없음] `interaction.service.ts` 클래스 docstring 신규 단락 — facade 원칙 서술이 실제 코드와 일치**
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:69-76`
  - "WS gateway 도 같은 chokepoint 를 지나므로 두 표면이 자동으로 정합한다"는 주장을 `websocket.gateway.ts` 가 동일한 `ExecutionEngineService.continueButtonClick`/`continueAiConversation`/`endAiConversation` 등을 호출하는지 직접 grep 으로 확인했고 정확했다. `assertWaiting`/`resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface` 책임 분리 서술도 실제 구현과 일치.

- **[정보 확인 — 문제 없음] 테스트 주석(파일 1, 3, 7, 9)** — `execution-engine.service.spec.ts` 의 `rawPersisted`/`outputData` 관련 신규 주석, `waiting-surface-guard.spec.ts` 상단 "불변식 두 가지" 헤더 주석, `hooks.service.spec.ts` 의 두 신규 테스트 설명, e2e 회귀 테스트(`execution-park-resume.e2e-spec.ts`)의 "종전엔 …, 이제 …" 서술 모두 실제 mock 배선·assertion 과 대조 확인했으며 정확하다. 특히 `armSlowPathResume` 헬퍼의 "`outputData` 는 park 이 실제로 영속한 envelope 그대로" 주석은 `rawPersisted` 가 실제로 `mockNodeExecutionRepo.save` 호출 인자에서 추출됨을 코드로 확인해 정확함을 검증했다.

- **[정보 확인 — 범위 밖, 문제 없음] `plan/in-progress/eia-command-waiting-surface-guard.md`** — 배경/결정/체크리스트/spec 동기 대상/후속 항목(F-1/F-2) 구조가 명확하고, "본 PR 이 커버하지 않는 범위"(F-1 nodeId 불일치 검사, F-2 chat-channel 안내 문구)를 코드 주석에서도 정확히 동일 plan 파일을 back-reference(`hooks.service.ts:717` 의 `F-2` 언급)해 추적 가능성이 좋다. `review/consistency/2026/07/10/23_19_34/*.md` 는 이 plan 착수 전 `--impl-prep` 산출물로, 이미 WARNING 들이 plan 체크리스트에 "WARNING 반영" 문구로 소비된 흔적이 확인된다(fail-open→fail-closed 정정 등) — 별도 조치 불요.

## 요약

핵심 신규 파일(`waiting-surface-guard.ts`/`.spec.ts`)과 swagger·서비스 클래스 docstring 은 전반적으로 상세하고 정확하다 — 특히 `SURFACE_ALLOWED_COMMANDS` 매트릭스의 "왜 form/buttons 는 엄격하고 ai_conversation 은 관대한가"에 대한 설명이 실제 spec 계약(AI Agent §6.2 step 2.c, Presentation §10.9)을 정확히 인용한다. 다만 `resolveWaitingNodeExecutionId` JSDoc 은 diff 두 번의 편집이 겹쳐 같은 "표면 불일치" 케이스가 중복 서술되고 무관한 문단이 리스트를 끊는 구조적 결함이 있고, 신규 파일의 markdown 링크는 상대경로가 1단계 부족해 깨져 있다. 또한 리포지토리 관례(CHANGELOG.md 에 유사 규모 변경마다 항목 추가, 과거 documentation reviewer 가 같은 종류의 누락을 지적해 반영된 선례 존재)에 비추어 CHANGELOG 항목이 비어 있는 점도 반영이 필요하다. 세 WARNING 모두 구현 로직 자체를 막을 사유는 아니며 `--impl-done` 이전에 정리 가능한 수준이다.

## 위험도

LOW
