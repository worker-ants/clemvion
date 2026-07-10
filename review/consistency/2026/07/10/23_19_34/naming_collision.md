# 신규 식별자 충돌 검토 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드

검토 모드: `--impl-prep spec/5-system` (구현 착수 전). 대상 작업: `plan/in-progress/eia-command-waiting-surface-guard.md`.
Target 문서(명시적으로 지정된 `spec/5-system/14-external-interaction-api.md`)는 아직 편집 전이므로, 착수 예정 컨텍스트 프롬프트에 명시된 신규 식별자 후보를 실제 코드베이스·spec 전수 검색으로 대조했다.

## 발견사항

- **[WARNING] 기존 `expectedCommands`(EIA §6.2) 매트릭스와 신규 서버 강제 매트릭스의 값 집합 불일치**
  - target 신규 식별자: `WAITING_SURFACE_COMMAND_MATRIX`(가안) — `WaitingInteractionType` → 허용 명령 집합
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md` §6.2 outbound notification 페이로드의 `interaction.expectedCommands` 필드(라인 560 부근) — 이미 `interactionType` 값별 허용 명령을 문서화한 클라이언트 힌트다.
    ```
    "expectedCommands": ["submit_form"] | ["click_button"] | ["submit_message", "end_conversation"]
    ```
  - 상세: 두 매트릭스는 키(`WaitingInteractionType`)는 같지만 **값 집합이 다르다**. 기존 `expectedCommands`는 `ai_conversation`에 대해 `submit_message`/`end_conversation` 2종만 나열(클라이언트에게 "다음에 보낼 명령"을 안내하는 용도)한다. 반면 `plan/in-progress/eia-command-waiting-surface-guard.md`가 확정한 서버 강제 매트릭스는 `ai_conversation`/`ai_form_render`에 대해 **4종 전부**(`submit_form`/`click_button`/`submit_message`/`end_conversation`에 대응하는 내부 continuation kind)를 허용한다 — 기존 텔레그램 stale `button_click` graceful re-park 등 방어적 관용을 보존하기 위한 의도적 설계다. 즉 "클라이언트 안내용 좁은 힌트"와 "서버 강제용 넓은 허용"이 같은 이름 계열로 나란히 존재하게 된다. 의도적 비대칭이지만, target 문서에 이 관계가 명시되지 않으면 향후 독자가 두 표를 동일한 것으로 오인하거나(정합성 재검토 시 거짓 CRITICAL 유발) 반대로 강제 로직을 `expectedCommands`값 그대로(2종만) 구현해 기존 defensive 관용을 깨뜨릴 위험이 있다.
  - 제안: (1) 신규 매트릭스 이름은 `expectedCommands`와 문자열이 겹치지 않게(`WAITING_SURFACE_COMMAND_MATRIX` 등 확정 가안 유지, `ExpectedCommands`류 타입명 금지). (2) target 문서 본문에 "§6.2 `expectedCommands`(클라이언트 안내, 좁음) vs 본 매트릭스(서버 enforcement, `ai_conversation`/`ai_form_render`는 넓음)는 의도적으로 다른 값 집합" 이라고 1문장 cross-ref. (3) 가능하면 `## Rationale`에 "AI 대기 표면만 4종 허용"의 근거(= 기존 defensive 관용 보존, `plan` 배경 절 그대로)를 옮겨 적어 산문(latest-only 서술)과 분리.

- **[WARNING] `resolveWaitingNodeExecutionId` 개명 시 동기화가 필요한 SoT 산문 4곳**
  - target 신규 식별자: `resolveWaitingNodeExecution`(개명 후보, "Id" 제거 검토 중)
  - 기존 사용처(정의·권위 있는 계약 서술):
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5150`(정의) + 호출부 4곳(`continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation`, 라인 4609/4718/4744/4761)
    - `spec/5-system/4-execution-engine.md:1054`(§7.5.1) — 함수명을 직접 인용하며 0건/다중 row invalid-lookup 계약(에러 매핑 3표면: WS `INVALID_EXECUTION_STATE` / REST `INVALID_STATE` / EIA `STATE_MISMATCH`)을 서술하는 **권위 있는 산문** — 이 절 자체가 함수의 계약 SoT.
    - `spec/1-data-model.md:844` — NodeExecution 활성 인덱스 설명에서 함수명을 인용.
    - `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts:28` — 인덱스 docstring에서 함수명 인용.
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 내 다수 주석(라인 310/986/1028/1938 등)이 함수명을 언급.
  - 상세: 이름을 바꾸면 위 4개 파일(spec 2개 + code 2개, 테스트 주석 별도)을 **같은 PR에서 원자적으로 갱신**해야 한다. 특히 `spec/5-system/4-execution-engine.md §7.5.1`은 단순 참조가 아니라 함수의 invalid-lookup 계약을 규정하는 산문이라, 이름 변경 자체보다 "명령 expectation 불일치도 이 표에 새 행으로 추가"하는 본 작업의 핵심 편집 지점과 겹친다 — 개명과 신규 행 추가를 한 번에 하면 diff 가 커지고 리뷰가 어려워진다.
  - 제안: 이번 PR 범위에서는 **이름 유지**(`resolveWaitingNodeExecutionId`)를 권고. 파라미터만 확장(`expectedCommands?: ...` 등)해도 시그니처 변경의 의도는 충분히 전달된다. 개명이 꼭 필요하다면 별도 순수 rename PR로 분리해 §7.5.1 본문 갱신과 섞지 않는다.

- **[INFO] 대기 표면 값 참조 시 기존 변수명 `persistedInteractionType` 재사용 권고**
  - target 신규 식별자: (미정) `resolveWaitingNodeExecutionId`가 매칭된 NodeExecution의 현재 대기 표면을 함께 반환/노출해야 할 경우의 변수/필드명.
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts`의 `ResumeTurnSelector.persistedInteractionType` / `ResumeTurnContext.persistedInteractionType`, 그리고 `execution-engine.service.ts`의 `resumeFromCheckpoint` 내부 로컬 변수 `persistedInteractionType`(라인 1699) — 이미 "park 시 영속된 `meta.interactionType` 값"을 가리키는 확립된 이름이다.
  - 상세: `WaitingInteractionType`(엔진 내부 4값) · `interactionType`(노드 output meta 필드명, EIA/WS wire 필드명) · `persistedInteractionType`(rehydration 경로의 동일 개념 로컬명)까지 이미 3개의 동의어가 병존한다. 신규 가드가 4번째 동의어(예: `waitingSurface`, `surfaceType`)를 도입하면 같은 개념에 대한 용어가 더 늘어나 `interaction-type-registry.md` 매트릭스 추적이 어려워진다.
  - 제안: 신규 가드 내부에서도 `persistedInteractionType`을 재사용(또는 명시적으로 그 별칭임을 주석)해 동의어 증식을 막는다.

- **[INFO] 신규 매트릭스의 spec 등재 위치 — `interaction-type-registry.md`와의 관계**
  - target 신규 식별자: `WAITING_SURFACE_COMMAND_MATRIX`(가안) 및 그 spec 서술 위치.
  - 기존 사용처: `spec/conventions/interaction-type-registry.md`는 이미 "`WaitingInteractionType` 값별 처리 분기"를 다루는 cross-cutting 매트릭스 SoT 문서(§1 WaitingInteractionType, §2 ConversationTurnSource, §3 PresentationType)이며, 3중 가드 컨벤션(매트릭스 SoT + AST grep + TS exhaustive)이 확립돼 있다. 같은 문서 §1.2 말미에 이미 `resumeTurnRegistry`/`parkEntryRegistry`(재개·park 진입 라우팅 선택 로직)에 대한 노트도 있다.
  - 상세: 신규 "명령 ↔ 대기 표면" 매트릭스는 값의 축(`WaitingInteractionType`)이 동일하고 "표에 새 enum 소비처가 추가될 때 동기화가 깨진다"는 문제 패턴도 동일하다 — `interaction-type-registry.md`의 기존 컨벤션이 다루는 문제와 사실상 같은 클래스다. 다만 이 매트릭스는 UI 렌더 분기가 아니라 **서버 명령 인가**를 다루므로 별도 축이라는 점은 target 문서에 명시할 필요가 있다(§1.2 "처리 분기 매트릭스"와 혼동 방지).
  - 제안: 순수 정보성 제안 — `14-external-interaction-api.md`에 매트릭스 본문을 두더라도, `interaction-type-registry.md`에 "명령 인가 매트릭스는 §14 EIA 문서 참조, 본 §1.2 UI 분기 매트릭스와는 별개 축"이라는 1줄 cross-ref를 추가하면 두 매트릭스 SoT가 향후 개별적으로 진화해도 추적 가능하다. 필수는 아님(WARNING 아님).

- **[정보 확인 — 충돌 없음] 에러 코드/요구사항 ID**: `STATE_MISMATCH`(EIA REST 409) · `INVALID_EXECUTION_STATE`(WS ack) · `INVALID_STATE`(REST core `/continue` 422, API 컨벤션 422 기본 코드 재사용)는 모두 기존 정의·문서(§5.1 에러 표, §7.5.1, `3-error-handling.md`)와 정확히 같은 의미로 재사용된다. `EIA-IN-13`("현재 노드 상태와 명령이 맞지 않으면 409 Conflict")도 기존 요구사항 ID이며, 신규 정의가 아니라 그 요구사항의 "노드 상태" 해석을 표면(surface) 불일치까지 넓히는 구현으로 타당하게 정합한다. `WaitingInteractionType`(`form`/`buttons`/`ai_conversation`/`ai_form_render`)과 `ContinuationJob`/`ContinuationPayload`의 `type` 값(`continue`/`cancel`/`button_click`/`ai_message`/`ai_end_conversation`/`retry_last_turn`, 그리고 sentinel `form_submitted`)도 모두 기존 정의를 그대로 재사용하며 새 값 추가가 없다. `WAITING_SURFACE_COMMAND_MATRIX`(가안) 문자열 자체와 `_MATRIX` suffix 패턴은 전수 검색 결과 다른 의미로 쓰인 기존 식별자가 없다(frontend 테스트의 `COVERAGE_MATRIX`는 무관한 별개 테스트 파일 지역 상수). API endpoint·이벤트명·ENV/config key·spec 파일 경로는 신규 도입이 없어(기존 `/interact`·`execution.*` WS 명령·기존 spec 파일 재사용) 해당 관점의 충돌도 없음.

## 요약

이번 착수 예정 작업은 새 요구사항 ID·에러 코드·엔드포인트·엔티티명을 만들지 않고 기존 `STATE_MISMATCH`/`INVALID_EXECUTION_STATE`/`INVALID_STATE`/`WaitingInteractionType`/`ContinuationJob` 계열을 그대로 재사용하도록 설계되어 있어 CRITICAL 급 식별자 충돌은 발견되지 않았다. 다만 (1) 신설 예정인 "명령↔대기표면" 매트릭스가, 이미 spec에 존재하는 클라이언트 안내용 `expectedCommands`(§6.2)와 키는 같고 값 집합(특히 `ai_conversation`)이 다른 자매 개념이라는 점을 target 문서가 명시적으로 cross-ref 하지 않으면 향후 혼동·오정합 재검토를 유발할 수 있고, (2) `resolveWaitingNodeExecutionId`의 개명은 이 함수를 권위 있는 계약으로 직접 인용하는 spec 산문(§7.5.1)과 데이터 모델 문서 2곳·코드 docstring 1곳·테스트 주석 다수를 동반 갱신해야 하는 넓은 반경을 가지므로, 이번 PR 범위에서는 이름 유지(파라미터 확장만)를 권고한다. 나머지는 INFO 수준의 명명 일관성 제안(기존 `persistedInteractionType` 재사용, `interaction-type-registry.md`와의 cross-ref)이다.

## 위험도

LOW
