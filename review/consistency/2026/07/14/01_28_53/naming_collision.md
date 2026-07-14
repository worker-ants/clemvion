# 신규 식별자 충돌 검토 — spec/5-system/4-execution-engine.md (F-1 nodeId 검증, impl-done)

대상 diff(`origin/main...HEAD`)는 `plan/in-progress/eia-command-waiting-surface-guard.md` F-1(`resolveWaitingNodeExecutionId` nodeId 일치 검사)과 F-2(`surfaceMismatch` 안내, 이미 직전 검토 `review/consistency/2026/07/14/00_31_59/`에서 별도 처리됨)를 함께 담고 있다. `spec/5-system/4-execution-engine.md` 자체는 이번 diff 에 변경분이 없다(`(없음)`) — §7.5.1 등 관련 서술은 이미 이전 커밋에서 반영돼 있고, 본 diff 는 그 spec 약속을 구현으로 채우는 코드(`execution-engine.service.ts`, `interaction.service.ts`, 관련 spec/e2e)다. HEAD 워킹트리를 절대경로로 직접 확인해 아래 식별자들의 신규 여부와 기존 사용처를 대조했다.

신규/변경 식별자 후보:
- `expectedNodeId` (신규 optional 파라미터 — `continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation`/`resolveWaitingNodeExecutionId`)
- `InvalidExecutionStateError` (기존 클래스 재사용 — 신규 아님)
- `isInternalCtx` (기존 함수 재사용 — 신규 아님)
- e2e 테스트 ID `G-2.` (`external-interaction.e2e-spec.ts`)
- `SURFACE_MISMATCH_DEFAULTS` / `resolveSurfaceMismatchMessage` / `sendSurfaceMismatchNotice` / `languageHints.surfaceMismatch` (F-2, 직전 검토에서 이미 충돌 없음으로 결론)

## 발견사항

- **[INFO]** `expectedNodeId` — 5개 시그니처에 동시 신설, 기존 명명과 겹치지 않음
  - target 신규 식별자: `expectedNodeId?: string` (`execution-engine.service.ts` `continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation`/`resolveWaitingNodeExecutionId`, `interaction.service.ts` 지역변수)
  - 기존 사용처: 코드베이스 전체에서 사전 사용 이력 없음(diff 이전 `git grep`으로 미검출). `spec/5-system/4-execution-engine.md:1050` 이 이미 동일 이름으로 이 파라미터를 문서화하고 있고(같은 브랜치의 선행 커밋), `plan/in-progress/eia-command-waiting-surface-guard.md:109-133`, `CHANGELOG.md` 도 동일 이름을 일관되게 사용한다.
  - 상세: 코드·spec·plan·CHANGELOG 4곳이 모두 같은 이름·같은 의미(caller 지정 대상 nodeId, 대기 노드와 대조)로 정합해 실질적 충돌 위험이 없다. `interaction.service.ts` 안의 지역변수 `expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId` 도 같은 의미로 파생돼 이름 재사용이 자연스럽다.
  - 제안: 없음(그대로 유지 권장).

- **[INFO]** `InvalidExecutionStateError` / `isInternalCtx` — 신규 식별자가 아니라 기존 정의의 정당한 재사용
  - target 신규 식별자: (해당 없음 — 두 심볼 모두 diff 이전부터 존재)
  - 기존 사용처: `InvalidExecutionStateError` 는 `codebase/backend/src/modules/execution-engine/workflow-errors.ts:113` 정의, `execution-engine.service.ts` 내에서 이미 `resolveWaitingNodeExecutionId` 등에서 3곳 이상 다른 사유로 throw 되고 있었고(rows 없음/복수/표면 불일치), `interaction.service.ts:475`·`websocket.gateway.ts:892-899` 가 이를 공통으로 잡아 `STATE_MISMATCH`/보안 고정 메시지로 매핑하는 기존 패턴이 있다. `isInternalCtx` 는 `interaction.guard.ts:66` 정의, `spec/5-system/14-external-interaction-api.md:110,133` 이 "v1 구현 완료"로 이미 문서화한 기존 타입가드다.
  - 상세: 이번 diff 는 두 심볼을 **새로 선언하지 않고** nodeId 불일치라는 새 사유를 기존 `InvalidExecutionStateError` throw 지점에 추가했을 뿐이다. 클라이언트에는 고정 메시지 + `STATE_MISMATCH` 코드만 노출되고(`websocket.gateway.ts` 주석에 "client 응답에는 InvalidExecutionStateError 의 고정 메시지만 나가고" 명시), 기존 사유들과 동일한 추상화 레벨로 흡수되므로 의미 충돌이 아니라 설계상 의도된 일반화다.
  - 제안: 없음.

- **[INFO]** e2e 테스트 ID `G-2.` — 파일 로컬 lettering 컨벤션과 정합
  - target 신규 식별자: `it('G-2. submit_form nodeId 가 대기 노드와 불일치 → 409 STATE_MISMATCH (F-1)', ...)` (`codebase/backend/test/external-interaction.e2e-spec.ts:309`)
  - 기존 사용처: 같은 파일에 `A.`~`J.` 및 `I-2.` 서브 ID가 이미 존재(`grep` 결과: A/B/C/D/E/F/G/H/I/I-2/J). `G-2` 로 명명된 기존 테스트는 없음 — `G.`(필수 field 누락 검증) 바로 뒤에 그 확장으로 자연스럽게 이어붙인 형태.
  - 상세: 파일 전체를 대조한 결과 `G-2` 재사용/중복 없음. `I-2` 선례와 동일한 "letter + `-N`" 서브 ID 컨벤션을 따르고 있어 명명 규칙 위반도 아니다.
  - 제안: 없음.

- **[INFO]** F-2(`surfaceMismatch` 계열) 식별자 — 직전 검토(`00_31_59`)와 결론 동일, 재확인만
  - target 신규 식별자: `SURFACE_MISMATCH_DEFAULTS`, `resolveSurfaceMismatchMessage`, `sendSurfaceMismatchNotice`, config/i18n 키 `languageHints.surfaceMismatch`
  - 기존 사용처: `review/consistency/2026/07/14/00_31_59/naming_collision.md` 가 동일 diff 범위를 대상으로 이미 상세 검토를 완료했고(`SESSION_EXPIRED_DEFAULTS`/`resolveSessionExpiredMessage`/`sendExecutionStillRunningNotice` 등 기존 형제 패턴과 명명 규칙 일치, 의미 충돌 없음), 본 checker 가 HEAD 워킹트리를 재확인한 결과도 동일하다.
  - 상세: 새로 발견된 충돌 없음. 유사 이름의 기존 별개 에러 코드(`OAUTH_STATE_MISMATCH`)는 target 이 만든 것이 아니라는 점도 직전 검토와 일치한다.
  - 제안: 중복 재검토 불필요 — 직전 산출물을 그대로 인용.

- **[INFO]** 요구사항 ID 네임스페이스 — `F-1`/`F-2`/`G-2` 는 spec 의 formal ID 가 아니라 plan-local 라벨
  - target 신규 식별자: 코드 주석의 `F-1`/`F-2` (plan `eia-command-waiting-surface-guard.md` 항목 참조), e2e 의 `G-2`
  - 기존 사용처: `spec/5-system/4-execution-engine.md` 전체를 `F-1`/`F-2`/`G-2` 로 grep 한 결과 검출 0건 — 해당 spec 은 `EXE-xx` 류의 formal 요구사항 ID 컨벤션도 쓰지 않는다(§7.5.1 처럼 절 번호로만 참조).
  - 상세: 따라서 이 라벨들이 spec 요구사항 ID 공간과 충돌할 여지가 없다. plan 문서 자체 내에서도 `F-1`(§100줄)·`F-2` 가 각각 한 항목씩만 존재해 plan 내부 중복도 없다.
  - 제안: 없음.

새 API endpoint, 새 webhook/queue/SSE 이벤트명, 새 ENV var·config key(설정 키는 `languageHints.surfaceMismatch` 1건뿐이며 F-2 검토에서 이미 무충돌 확인), 새 spec 파일 경로는 이번 diff 에 도입되지 않았다.

## 요약

이번 diff(F-1 nodeId 일치 검증 + 이미 별도 검토된 F-2 surfaceMismatch)가 실제로 새로 도입하는 식별자는 `expectedNodeId` 파라미터와 e2e 테스트 ID `G-2` 정도이며, 둘 다 코드·spec(`§7.5.1` 인접 서술)·plan·CHANGELOG 전 계층에서 동일 이름·동일 의미로 정합하고 기존 코퍼스에서 다른 의미로 쓰인 사례가 발견되지 않았다. `InvalidExecutionStateError`/`isInternalCtx` 는 신규 식별자가 아니라 기존에 확립된 심볼의 의도된 재사용(새 실패 사유를 기존 에러 클래스/가드에 추가)이며, 클라이언트 노출 계약(`STATE_MISMATCH` 고정 코드/메시지)도 종전과 동일한 추상화 레벨을 유지해 혼선 소지가 없다. 새 API endpoint·이벤트명·ENV var·spec 파일 경로 도입도 없다. CRITICAL/WARNING 등급 충돌은 발견되지 않았다.

## 위험도

NONE
