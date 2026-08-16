# 정식 규약 준수 검토 — spec/5-system/ (impl-done)

검토 범위: `git diff origin/main...HEAD`(9 커밋 누적)의 실제 변경 파일 —
`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`,
`spec/conventions/secret-store.md`, `spec/1-data-model.md`, `spec/2-navigation/14-execution-history.md`,
`spec/4-nodes/1-logic/12-background.md` + 대응 코드
(`codebase/backend/src/shared/utils/redact-stored-error.ts`(신규),
`codebase/backend/src/modules/executions/executions.service.ts`,
`codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`,
`codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`,
`codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`).

주제: `Execution.error`/`NodeExecution.error` 응답 egress 값-패턴 마스킹을 종결 emit 경로뿐 아니라
내부 읽기 경로(REST 4곳 + WS `execution.snapshot` + background-run body 노드)에도 확장한 결정을
spec 6개 문서에 등재 + `secret-store.md` 에 `triggerToken` 평문 보관 비대상 예외 등재.

## 발견사항

- **[INFO]** `BackgroundRunNodeExecutionDto.error` 의 `description` 이 파일 내 다른 필드 대비 이례적으로 길다
  - target 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` 의 `error` 필드 `@ApiPropertyOptional({ description: ... })`
  - 위반 규약: `spec/conventions/swagger.md` §3 "주석/설명 톤" — "DTO `description`은 10~40자 내외"
  - 상세: 신설된 설명("에러 정보. 자격증명으로 판별된 값은 마스킹되어 반환된다…SoT: EIA §R17…")이 약 180자로 §3 권장치를 크게 초과한다. 같은 파일의 다른 모든 필드(`id`/`nodeId`/`status`/`inputData`/`outputData` 등)는 10~60자 내외로 §3 을 따르고 있어, 이 필드만 눈에 띄게 길다. (다만 `spec/5-system/14-external-interaction-api.md` §R17 이 요구하는 "egress 마스킹으로 값이 DB 원문과 달라질 수 있다"는 보안·정합성 정보는 API 소비자에게 실제로 필요한 내용이라, 형식 위반보다 정보 가치가 우선하는 사례로 보인다. `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` 의 `ExecutionDto.error`/`NodeExecutionSummaryDto.error` 는 이미 이전부터 멀티라인 JSDoc 관행이 있던 파일이라 같은 초과가 새 패턴이 아니지만, `background-run-response.dto.ts` 는 이번이 최초 초과 사례다.
  - 제안: 형식을 굳이 맞추려면 "에러 정보 (자격증명 마스킹됨 — 상세: EIA §R17)" 수준으로 축약하고 상세 근거는 링크만 남기는 방법이 있다. 다만 이 프로젝트가 보안 관련 필드에 한해 상세 JSDoc 관행을 이미 다른 파일에서도 반복 채택하고 있어(§Overview 참고), 이 편차 자체를 §3 예외로 명문화(규약 갱신)하는 편이 더 정직할 수 있다 — 강제 조치는 불필요.

- **[INFO]** `secret-store.md` §1 신규 예외 블록의 형식적 위치가 기존 "비대상" 블록과 동일 패턴을 그대로 재사용
  - target 위치: `spec/conventions/secret-store.md` §1 (`> **비대상 — Trigger.config.interaction.triggerToken**` 블록)
  - 위반 규약: 해당 없음(위반이 아니라 준수 확인 차원의 노트)
  - 상세: `AuthConfig.config` 비대상 예외와 같은 위치(§1 하단)·같은 `>` blockquote 형식·같은 "SoT 는 이 문서가 아니다" 교차참조 패턴을 그대로 따른다. `secret-store.md` 서두 문장도 새 예외를 `#1-uri-scheme` 앵커로 정확히 가리키도록 갱신됐다. 문서 구조·명명 규약 위반 없음 — 참고용으로만 기록.

## 규약 준수 확인 (위반 없음, 교차검증 완료)

- **`code:` frontmatter 동기화**: `redact-stored-error.ts`(신규 파일)가 `spec/5-system/14-external-interaction-api.md`·`spec/2-navigation/14-execution-history.md`·`spec/4-nodes/1-logic/12-background.md` 세 문서의 `code:` 리스트에 모두 등재됐고, 파일이 실제로 존재해 `spec-code-paths.test.ts`(spec-impl-evidence.md §4) 가드를 통과한다. `executions.service.ts` 도 동일하게 등재됨.
- **Swagger DTO 문서화 (swagger.md §1-1)**: 마스킹 적용 대상 4개 응답 표면(`ExecutionDto.error`, `NodeExecutionSummaryDto.error`, `BackgroundRunNodeExecutionDto.error`) 모두 JSDoc/`description` 이 갱신되어 "값이 DB 원문과 다를 수 있다"는 계약 변경이 문서화됨 — 표면 하나만 빠뜨리는 패턴(이 저장소가 반복 겪은 실패 형태, R17 본문이 스스로 지적)이 이번엔 재발하지 않음.
- **API 응답 wire 계약 불변 (api-convention.md §5.4)**: `error?: Record<string, unknown> | null` 타입·`@ApiPropertyOptional({ nullable: true })` 데코레이터 모두 변경 없음 — 마스킹은 값만 바꾸고 키 존재/부재 표현을 바꾸지 않아 §5.4 "부재 표현" 규칙과 충돌하지 않는다.
- **레이어 분리 명시 (api-convention.md §5.3)**: EIA §R17 신규 불릿이 "이 마스킹은 API 규약 §5.3 의 HTTP 에러 envelope 비echo 원칙과 다른 레이어"라고 명시적으로 구분해, 두 마스킹 정책(요청 실패 응답 vs 도메인 데이터 egress)이 혼동되지 않도록 앵커(`#53-에러-응답`)까지 정확히 가리킨다.
- **에러 코드 명명 규약 (error-codes.md)**: 이번 변경은 `error.code`/`error.nodeId` 는 대상에서 제외("값 공간이 닫혀 있다")한다고 명시하며 신규 코드 값도 도입하지 않아 §1~§3 명명 규율과 무관 — 위반 소지 없음.
- **secret-store.md 신규 예외 (§1)**: `Trigger.config.interaction.triggerToken` 평문 보관 비대상 예외가 기존 `AuthConfig.config` 예외와 "같은 종류로 오독되지 않도록" 근거를 분리 서술하고, "다른 필드가 이 문단을 선례로 예외를 얻는 것이 실패 모드"라고 명시적으로 못박아 §7 "변경 관리" 절차(신규 secret type 추가 시 §1 표에 등재)의 취지에 부합한다. EIA §7.1 쪽 대응 서술도 `secret-store.md §1` 을 정확히 역참조.
- **상호 링크 무결성**: 신규 크로스레퍼런스 앵커(`./2-api-convention.md#53-에러-응답`, `../5-system/14-external-interaction-api.md`, `../../5-system/14-external-interaction-api.md`, `../../../../../spec/5-system/14-external-interaction-api.md`(코드 JSDoc 내) 등) 를 실제 헤딩·상대경로 깊이 기준으로 확인 — 전부 정합.
- **문서 구조 (Overview/본문/Rationale)**: 이번 변경은 기존 R17 Rationale 항목의 확장(신규 불릿 추가) + 본문 표/캡션 보강이며, 대상 문서들의 기존 3섹션 구조를 깨지 않는다. 신규로 작성된 섹션 없음.

## 요약

이번 diff(spec 6개 문서 + 대응 code 5개 파일)는 정식 규약(`spec/conventions/**`) 관점에서 CRITICAL/WARNING 급 위반이 없다. `code:` frontmatter 동기화, Swagger DTO JSDoc 갱신(4개 응답 표면 전부), API 응답 wire 계약(`null`/`nullable` 표현) 불변, 레이어 분리 크로스레퍼런스, secret-store 예외 등재 절차 — 모두 해당 conventions 문서의 명시 규칙을 그대로 따랐고, 이 저장소가 과거 반복해서 겪은 "자매 표면 중 하나만 갱신" 실패 패턴을 이번엔 4개 표면 전부 동시 갱신으로 피했다는 점이 특히 눈에 띈다. 유일한 관찰 사항은 `background-run-response.dto.ts` 의 `error` 필드 `description` 이 swagger.md §3 의 "10~40자 내외" 권장 톤을 크게 초과한다는 형식적 INFO 하나이며, 보안 계약 변경을 설명하기 위한 정보 가치가 형식 편차를 상쇄한다고 판단해 차단 사유로 보지 않는다.

## 위험도

NONE
