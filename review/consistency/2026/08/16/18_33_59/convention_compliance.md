# 정식 규약 준수 검토 — convention_compliance

검토 대상: `spec/5-system/**` 변경분 (impl-done, diff-base `origin/main`) — 핵심은
`spec/5-system/14-external-interaction-api.md`(§7.1 caveat 정정 + §R17 확장) ·
`spec/5-system/6-websocket-protocol.md`(§4.1 execution.snapshot 캐비엇 추가) ·
`spec/conventions/secret-store.md`(§1 신규 비대상 예외) 및 대응 구현
(`redact-stored-error.ts`, `executions.service.ts`, `background-runs.service.ts`, 대응 DTO).
프롬프트 파일의 `<git diff origin/main...HEAD -- code_areas>` 청크가 컨텍스트 예산 초과로
절단돼 있어, 해당 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`)에서
`git diff origin/main...HEAD` 를 직접 재실행해 diff·spec 원문·conventions 원문을 절대경로로 재확인했다.

## 발견사항

- **[WARNING]** plan `spec_impact` 목록이 실제로 수정한 spec 파일 하나를 누락
  - target 위치: `plan/in-progress/eia-internal-rest-error-masking.md` frontmatter `spec_impact:`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §Rationale R-8 (Gate C — "완료 시점 작성자가
    정합 결정(spec 경로 목록)을 명시") 및 `plan-lifecycle.md` 의 plan↔spec 동기 요구
  - 상세: 이번 diff 는 `spec/5-system/14-external-interaction-api.md` · `spec/5-system/6-websocket-protocol.md` ·
    `spec/conventions/secret-store.md` · `spec/2-navigation/14-execution-history.md` ·
    `spec/4-nodes/1-logic/12-background.md` **와 함께 `spec/1-data-model.md` 도** 수정했다
    (`git diff origin/main...HEAD --stat -- 'spec/**'` 로 6개 파일 확인 — §2.14 표에 "응답 마스킹" 행 1줄 추가).
    그런데 이 작업의 plan `spec_impact:` 는 앞의 5개만 나열하고 `spec/1-data-model.md` 는 빠져 있다.
    plan 본문 자체는 이 파일을 두 번 직접 인용한다("데이터 모델 §2.14 가 `Execution.error` 를
    …복사로 정의" — 168행·276행) — 즉 작성자가 그 파일을 건드릴 것을 알고 있었는데 frontmatter
    목록만 누락됐다. Gate C(`spec-plan-completion.test.ts`)는 나열된 경로의 *실존*만 검증해 지금은
    build 를 깨지 않지만(plan 이 아직 `in-progress`), 이 상태로 `plan/complete/` 로 이동하면
    "정합 결정을 완료 시점에 명시" 하는 Gate C 의 취지(R-8)가 실질적으로 훼손된다 — 목록이
    실제 diff 보다 좁아 이 plan 을 참조하는 후속 독자가 `1-data-model.md` 변경을 놓칠 수 있다.
  - 제안: `spec_impact:` 에 `spec/1-data-model.md` 추가. (plan 을 `plan/complete/` 로 옮기기 전에
    반드시 동기화 — Gate C 는 이동 시점에 실행된다.)

## 점검했으나 위반 없음 (근거 요약)

- **명명 규약**: 신규 파일 `codebase/backend/src/shared/utils/redact-stored-error.ts` 는 형제
  `terminal-error-payload.ts` 와 동일 층 배치, kebab-case 파일명 · camelCase 함수명
  (`redactStoredErrorForResponse`) · PascalCase 타입(`ResponseExecution`/`ResponseNodeExecution`)
  모두 기존 컨벤션과 일치. 코드베이스 전수 grep 결과 `ResponseExecution` 명 충돌 없음.
- **DTO/Swagger 규약** (`spec/conventions/swagger.md`): `execution-response.dto.ts` ·
  `background-run-response.dto.ts` 의 `error` 필드 JSDoc 보강은 §1-1(JSDoc 우선) 패턴을 따르고,
  타입 선언(`type:'object', additionalProperties:true, nullable:true`)은 변경 없이 유지돼 §1-4
  "열린 map" 분류에도 부합(진짜 open key set). `ResponseExecution`/`ResponseNodeExecution` 는
  서비스 내부 반환 타입일 뿐 `@ApiProperty` 로 노출되지 않으므로 §5-1(응답 DTO는
  `dto/responses/*.dto.ts`) 대상이 아니다 — 실제 wire 를 서술하는 `ExecutionDto`/
  `NodeExecutionSummaryDto` 는 그대로 있다.
- **출력 포맷 규약**: 이번 변경은 `error` 필드의 **형태**(shape)를 바꾸지 않고 **값**만 마스킹한다
  (`toTerminalErrorPayload` 재사용을 의도적으로 피함 — JSDoc 이 "형태가 아니라 값" 이라고 명시).
  `spec/5-system/2-api-convention.md §5.3` 의 "내부 구현 원문을 echo 하지 않는다(CWE-209)" 원칙과
  레이어가 다르다는 신규 caveat 문구도 §5.3 원문(직접 읽어 확인)과 모순되지 않는다.
  `spec/5-system/3-error-handling.md §6.3`(로그 마스킹)과도 레이어 구분이 명시적이라
  (DB·로그는 원문 유지) 상충 없음.
- **SoT/상호참조**: `spec/1-data-model.md` §2.14 · `spec/2-navigation/14-execution-history.md` R-5 ·
  `spec/4-nodes/1-logic/12-background.md` §8.2 세 곳 모두 새 정책을 재정의하지 않고 EIA §R17 을
  단일 SoT 로 지목 — 규약 문서 구조(중복 정의 금지) 준수. 상대경로 링크(`../1-data-model.md`,
  `../../5-system/14-external-interaction-api.md`, `../../../../../spec/2-navigation/...` in-code
  JSDoc 등)를 전부 절대경로로 직접 resolve 해 깨진 링크 없음을 확인.
- **frontmatter `code:` 규약** (`spec-impl-evidence.md` §2·R-1): `redact-stored-error.ts` 를
  `14-external-interaction-api.md` · `14-execution-history.md` · `12-background.md` 세 spec 의
  `code:` 에 각각 등재 — 복수 spec 이 한 공유 유틸을 참조하는 것은 R-1 이 금지하지 않는 패턴.
  `background-runs.service.ts` 는 기존 glob(`.../background-runs/**`)에 이미 포함돼 추가 불요.
- **금지 항목**: `secret-store.md` 신규 비대상 예외 블록은 "이 블록을 평문 보관 일반의 선례로
  인용하면 안 된다" 는 자기 제한 문구를 명시해, 규약이 우려하는 "예외의 예외적 확산"을 문서
  자체가 차단하고 있음. `deepRedactSecrets`/`SECRET_LEAK_PATTERNS` 는 새로 만들지 않고 기존
  shared SoT(`sanitize-error-message.ts`)를 재사용 — 패턴 중복 신설 금지 취지에 부합.
- **세션 산출물(`17_12_34` 등) 인용 스타일**: 코드 주석·spec 본문에 리뷰 라운드 타임스탬프를
  근거로 남기는 패턴은 이번 PR 신설이 아니라 `spec/4-nodes/1-logic/10-parallel.md` ·
  `spec/7-channel-web-chat/4-security.md` 등에 이미 선례가 있는 이 저장소의 기존 관행 — 새 위반
  아님.

## 요약

이번 diff 는 `Execution.error`/`NodeExecution.error` 내부 읽기 경로 마스킹을 도입하면서
spec(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md`, `1-data-model.md`,
`2-navigation/14-execution-history.md`, `4-nodes/1-logic/12-background.md`)과
`spec/conventions/secret-store.md` 를 함께 갱신했고, 명명·DTO/Swagger·출력 포맷·SoT 상호참조·
frontmatter `code:` 규약을 모두 실측 대조한 결과 직접적 위반은 발견되지 않았다. 유일한 흠은
정식 규약(spec-impl-evidence.md Gate C) 이 요구하는 "완료 시점 정합 선언"의 전조 단계인 plan
`spec_impact` 목록이 실제 diff 보다 한 파일(`spec/1-data-model.md`) 좁다는 점으로, 현재는 build 를
막지 않지만 plan 완료 전 동기화가 필요하다.

## 위험도

LOW
