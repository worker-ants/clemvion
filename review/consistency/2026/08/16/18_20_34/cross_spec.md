# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위 확정 (실측)

프롬프트 번들이 컨텍스트 예산 초과로 `<git diff origin/main...HEAD -- code_areas>` 를 포함해 15개
파일 본문을 절단했으므로, HEAD 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`)에서
`git diff origin/main...HEAD` 를 직접 재실행해 실제 변경 파일을 확정했다:

- `spec/5-system/14-external-interaction-api.md` (§R17 "내부 읽기 경로" 마스킹 결정으로 교체)
- `spec/5-system/6-websocket-protocol.md` (`execution.snapshot` 필드 표 1줄 갱신)
- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규 유틸)
- `codebase/backend/src/modules/executions/executions.service.ts` (`findById`/`toExecutionDto`/`getChain`/`stop` 4경로 마스킹 관문)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` + DTO
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (JSDoc)
- (작업트리 미커밋 diff) `spec/conventions/secret-store.md` — `triggerToken` 예외 근거 (a) 보강

이 변경은 이전 라운드(`review/consistency/2026/08/16/16_48_55/cross_spec.md`)가 지적한 **동일 결정**(내부
REST `Execution.error` egress 마스킹)의 후속 반영이다. 그 라운드가 남긴 WARNING 2건이 이번 diff 로
실제 해소됐는지를 1차로 재검증했고, 그 위에서 신규 충돌 여부를 전수 재점검했다.

## 발견사항

- **[INFO]** §5.3(HTTP 에러 envelope 비echo)과의 관계가 여전히 본문에 교차 인용되지 않음 (이전 라운드 INFO 이월, 미반영)
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "내부 읽기 경로도 같은 마스킹을 적용한다" 불릿 (라인 1486~1519 부근)
  - 충돌 대상: `spec/5-system/2-api-convention.md §5.3` (*"내부 구현 원문 ... 을 echo 하지 않는다 — CWE-209 방지"*)
  - 상세: 직접 모순은 아니다 — §5.3 은 요청 자체가 실패한 HTTP 에러 envelope(`GlobalExceptionFilter`) 규칙이고 `Execution.error` 는 200 응답 안의 도메인 데이터라 `3-error-handling.md` 의 "두 레이어 분리" 원칙으로 이미 구분돼 있다. 다만 §R17 자신의 프로브 표가 보여주듯 `deepRedactSecrets` 는 자격증명 패턴만 잡고 일반 예외 문구(`"Node ... failed"`)는 통과시킨다 — §5.3 이 요구하는 "내부 구현 원문 전면 비echo" 보다 명백히 느슨한 수준이다. 같은 "error.message"·같은 CWE-209 동기를 공유하는 두 필드가 다른 강도의 정책을 갖는다는 점이 여전히 교차 인용돼 있지 않다.
  - 제안: (16_48_55 라운드와 동일 제안 유지, 급하지 않음) §R17 불릿 옆에 한 줄 — "본 마스킹은 §5.3(HTTP 에러 envelope)과 다른 레이어(도메인 데이터)이며 자격증명 패턴만 겨냥한다" — 를 추가하면 향후 보안 감사에서 "§5.3 위반" 오탐 재지적을 예방. 이번 PR 필수는 아님.

## 이전 라운드(16_48_55) WARNING 재검증 — 해소 확인

- **WS 프로토콜 `execution.snapshot` drift (전 WARNING #1)** → **해소 확인**. `spec/5-system/6-websocket-protocol.md` `execution.snapshot` 필드 표 행에 "nest 된 `execution.error` 와 `execution.nodeExecutions[].error` 는 `findById` 의 마스킹 관문을 상속한다" 문장이 실제로 추가됐다(diff 확인). `execution.node.*` **emit** 은 별도 관문(원문 유지)이라는 캐비엇도 EIA §R17 잔여 ①과 대칭적으로 동기화돼 있다.
- **`12-background.md` §8.2 drift (전 WARNING #2)** → **해소 확인**. `nodeExecutions.data` 행에 "`error` 는 응답 egress 에서 값-패턴 마스킹을 거친다 ... 같은 관문이며 SoT 는 EIA §R17" 문장이 추가됐고, frontmatter `code:` 목록에도 `redact-stored-error.ts` 가 추가됐다. 코드(`background-runs.service.ts:302` 부근)도 실제로 `redactStoredErrorForResponse(row.error)` 를 호출해 서술과 일치.
- **`spec_impact` 범위 협소 (전 INFO)** → 실질 해소. `spec/2-navigation/14-execution-history.md`(R-5 경계 캐비엇 + frontmatter `code:` 목록에 `redact-stored-error.ts` 추가), `spec/1-data-model.md`(§2.14 "응답 마스킹" 행 신설), `spec/4-nodes/1-logic/12-background.md`, `spec/5-system/6-websocket-protocol.md`, `spec/conventions/secret-store.md` 5개 문서가 모두 동일 결정(2026-08-16)으로 동기화됐다 — commit `4c1f89e55`("내부 읽기 경로 마스킹 결정을 6개 문서에 등재").
- **secret-store.md Overview 절대 문구 (전 INFO)** → **해소 확인**. Overview 문장이 "— §1 하단의 필드 단위 명시적 비대상 예외는 제외" 로 갱신됐고, `AuthConfig.config` 예외 옆에 `Trigger.config.interaction.triggerToken` 비대상 예외 블록이 신설돼 근거 (a)(b)(c) + "평문 보관 일반의 선례로 인용 금지" 캐비엇까지 포함한다.

## 검증 메모 (충돌 아님 — 교차 확인)

- `spec/1-data-model.md §2.14` 원본/복사 관계 서술과 EIA §R17 의 "같은 문자열이 같은 응답에 병존" 근거가 정확히 대칭 — 데이터 모델이 먼저 정의한 복사 관계를 EIA 가 정확히 원용하고 있다.
- `spec/2-navigation/14-execution-history.md` R-5 대상 범위 캐비엇("Config 탭 하나, `Execution.error` 는 별개 정책")과 EIA §R17 의 "R-5 를 원용했을 뿐 기존 판정 아니다" 서술이 서로 모순 없이 대칭.
- RBAC — `spec/2-navigation/9-user-profile.md §4.2` 매트릭스("워크플로우 조회 = Viewer ✅")가 EIA/코드 주석의 "`GET /api/executions/:id` 에 `@Roles` 게이트 없음 = viewer 포함 전원 조회" 전제를 뒷받침한다. 코드 확인 결과 `BackgroundRunsController` 에도 `@Roles` 데코레이터가 없어 동일 전제가 성립.
- `spec/5-system/4-execution-engine.md`(번들 절단으로 원문 미포함, 직접 grep 재확인) 에는 이번 마스킹과 충돌하는 서술이 없다 — emit 경로 관련 마스킹 언급 자체가 없어 EIA §R17 잔여 ①("WS `execution.node.*` emit 은 이 마스킹 범위 밖")과 상충하지 않는다.
- `spec/3-workflow-editor/4-ai-assistant.md:259` (`maskSensitiveFields` 키 이름 기반 마스킹, workflow-assistant 도구 전용)가 이번 값-패턴 마스킹과 **다른 메커니즘**으로 병존하는 것은 EIA §R17 잔여 ③ 이 이미 명시적으로 인지·격리해 둔 상태 — "두 정책을 단순 합성하면 안 된다"는 캐비엇까지 본문에 있어 새로운 drift 가 아니라 기존에 문서화된 의도된 분리다.
- `git log -S "내부 REST 와의 비대칭은 미결"` 류 잔존 텍스트를 spec 전체에서 재검색한 결과 stale 사본 없음 — 이전 "미결" 서술이 남아 있는 다른 위치는 발견되지 않았다.
- 요구사항 ID·상태 전이·엔티티 필드 신설은 이번 diff 에 없다(응답 egress 값 마스킹만 — 계약 shape/HTTP status/엔드포인트 자체는 불변). API 계약 충돌·상태 전이 충돌·요구사항 ID 충돌 관점에서는 검토 대상 표면 자체가 없다.

## 요약

이번 diff(내부 REST/WS 읽기 경로 `Execution.error`·`nodeExecutions[].error` egress 마스킹)는 직전 cross-spec 라운드(16_48_55)가 지적한 WS 프로토콜·`12-background.md` 정본 위치 drift 2건을 실제로 반영해 해소했고, 5개 관련 spec 문서(1-data-model, 2-navigation/14-execution-history, 4-nodes/1-logic/12-background, 5-system/6-websocket-protocol, conventions/secret-store)를 같은 결정(2026-08-16)으로 동기화한 상태다. RBAC 매트릭스·데이터 모델 원본/복사 관계·기존 워크플로우-어시스턴트 마스킹 메커니즘과도 실측 대조 결과 직접 모순이 없다. 유일한 잔여는 §5.3(HTTP 에러 envelope 비echo)과의 관계를 명시적으로 교차 인용하지 않은 INFO 1건으로, 이전 라운드에서도 "직접 충돌 아님, 급하지 않음"으로 판정된 항목이 이번 PR 에서도 미반영 상태로 이월됐을 뿐이다.

## 위험도
LOW
