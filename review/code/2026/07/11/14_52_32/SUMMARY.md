# Code Review 통합 보고서

## 전체 위험도
**LOW** — `external-interaction` 응답 DTO 를 `swagger.md §5-1` 규약에 맞춰 `dto/responses/*-response.dto.ts` 서브디렉토리로 분리하는 순수 구조 리팩터(rename 추적 결과 클래스 정의 바이트 단위 동일, wire 계약·인증·보안 통제 무변경). 실질 코드 결함은 없고, 반복 지적된 것은 plan 체크박스 미갱신(프로세스 갭)과 `status` 리터럴 유니온의 파일 간 중복(유지보수성)이다. 다만 `documentation` reviewer 는 `status=success` 로 보고됐으나 output 파일이 디스크에 존재하지 않아(disk-write gap) 내용을 검증하지 못했다 — 재확인 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Process/Plan | 본 diff 가 정확히 완료한 plan 항목("`external-interaction` 모듈 응답 DTO 위치 정규화")의 체크박스가 `[ ]` 로 미갱신 상태로 남음. 동시에 diff 에 포함된 plan 커밋(`aa9a25300`)은 이 항목이 아니라 무관한 별개의 이미 머지된 PR(#913)의 두 항목(C2, W-spec-link-ci)만 `[x]` 로 정정해, 정작 본 작업의 완료 근거는 반영되지 않았다. | `plan/in-progress/eia-context-schema-followups.md:16` (진행 노트 7행도 stale) | 같은 PR 또는 후속 커밋에서 line 16 을 `[x]` 로 전환하고 완료 근거(커밋 `31bbbac31`) 기재. 무관한 plan 문서 동기화는 별도 커밋/PR 로 분리 검토. |
| 2 | Maintainability | `ExecutionStatusDto.status` 와 `InteractAckDto.currentStatus` 가 동일한 6개 상태값 리터럴 유니온과 swagger `enum` 배열을 각자 손으로 다시 선언(순서도 서로 다름). 원본 SoT 인 `execution.entity.ts::ExecutionStatus` enum 을 참조하지 않아, `interaction.service.ts` 에 우회 캐스트(`as ExecutionStatusDto['status']`)가 필요해졌고, 향후 상태값 변경 시 3곳(entity + 2 DTO)을 컴파일러 도움 없이 수동 동기화해야 한다. 같은 모듈 계열의 `background-run-response.dto.ts` 는 이미 공유 `type` alias 관례를 쓰고 있어 이 두 DTO 만 관례를 벗어난다. | `dto/responses/execution-status-response.dto.ts:505-521`, `dto/responses/interact-ack-response.dto.ts:803-820` | 공유 `type ExecutionStatusLiteral = ...` (또는 `keyof typeof ExecutionStatus` 파생)을 한 곳에 선언해 두 DTO 필드 타입에서 재사용. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `interactionType` 리터럴 유니온(`'form'\|'buttons'\|'ai_conversation'`)이 같은 파일 안에서 `CurrentNodeDto`(nullable)/`WaitingContextBaseDto`(non-nullable) 두 클래스에 걸쳐 중복 선언됨. | `execution-status-response.dto.ts:416-420, 438-439` | 파일 상단 `type InteractionType = ...` 선언 후 양쪽에서 재사용. |
| 2 | Maintainability | "열린 map" swagger 메타데이터(`{ type: 'object', additionalProperties: true }`)가 `conversationThread`/`buttonConfig`/`nodeOutput`/`result`/`error` 5개 필드에 리터럴로 반복. | `execution-status-response.dto.ts:453-458, 464-471, 481-487, 550-556, 558-565` | 공유 상수(`OPEN_MAP_SCHEMA`)로 추출 후 spread. 우선순위 낮음. |
| 3 | Maintainability | `interaction.service.ts::getStatus()` 는 diff 범위 밖이지만 여전히 길고(~130줄) 중첩 4단계 — 단, 이미 plan 비고에 "다음 관련 변경 시 후보" 로 추적 중인 사전 존재 이슈. | `interaction.service.ts:1735-1867` | 별도 조치 불필요(이미 계획된 후속 항목). |
| 4 | Requirement | plan frontmatter `worktree` 필드가 현재 작업 worktree(`eia-response-dto-normalize-205f7d`)가 아닌 이전 worktree(`eia-client-context-types-33e771`)를 가리킴. | `plan/in-progress/eia-context-schema-followups.md:2` | 다중 worktree 진행 plan 의 frontmatter 갱신 규칙 확인 후 필요 시 갱신. 차단 사유 아님. |
| 5 | Architecture | `WaitingContextBaseDto` 가 `@ApiExtraModels` 미등록(phantom 스키마 방지 의도)인데, 회귀 테스트가 이를 직접 단언하지 않음. | `execution-status-response.dto.spec.ts` | `expect(schemas.WaitingContextBaseDto).toBeUndefined()` 1줄 추가 검토(저비용, 비차단). |
| 6 | Testing | `CurrentNodeDto` 스키마는 `toBeDefined()` 만 확인하고 `interactionType`(nullable enum) 등 필드 단위 검증이 없음 — `ButtonsContextDto`/`NodeOutputContextDto` 대비 회귀 가드가 얕음. | `execution-status-response.dto.spec.ts:95-99` | `CurrentNodeDto.interactionType` nullable enum 검증 1건 추가 고려. 저위험(런타임 값은 `interaction.service.spec.ts` 가 이미 커버). |
| 7 | Testing | `InteractAckDto`/`RefreshTokenResponseDto` 는 전용 OpenAPI 스키마 spec 이 없음(flat property 나열이라 회귀 위험 낮음, 타 24개 모듈과 동일 수준이라 일관성 있음). | `dto/responses/interact-ack-response.dto.ts`, `dto/responses/refresh-token-response.dto.ts` | 필수 조치 아님. |
| 8 | Testing | `context.oneOf` 배열 순서를 `toEqual` 로 엄격 동치 검증 — `oneOf` 는 순서 무관 집합 의미라 구현이 의미상 동일하게 순서만 바꾸면 false-positive 실패 가능. | `execution-status-response.dto.spec.ts:101-107` | 필요 시 `expect.arrayContaining` + length 검증으로 완화. 우선순위 낮음. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 구조 리팩터 — 인증 가드/idempotency/시크릿 마스킹 무변경. 실질 발견 없음. |
| architecture | NONE | God-file 해소로 응집도 개선, LSP/순환의존 문제 없음. plan 체크박스 갭(→통합 WARNING #1)만 INFO 로 지적. |
| requirement | LOW | plan 체크박스 미갱신(→WARNING #1), frontmatter worktree stale(INFO). 코드 자체는 spec 정합. |
| scope | LOW | 핵심 코드 변경은 스코프 내(rename 확인). plan 문서 커밋이 무관한 타 PR 항목만 반영(→WARNING #1 과 동일 사안). |
| side_effect | NONE | 전역 상태·파일시스템·네트워크·이벤트 부작용 없음. 신규 spec 도 try/finally 로 안전 정리. |
| maintainability | LOW | `status` 리터럴 유니온 파일 간 중복(WARNING #2), `interactionType` 중복·보일러플레이트 반복(INFO). |
| testing | LOW | 228/228 테스트 pass. 스키마 회귀 가드 세부 갭(CurrentNodeDto 필드 검증, oneOf 순서 브리틀함) 은 INFO 수준. |
| documentation | 재시도 필요 | `status=success` 로 보고됐으나 `documentation.md` 출력 파일이 디스크에 없음(disk-write gap) — 내용 미검증. |
| api_contract | NONE | 라우트/HTTP 상태코드/에러코드/인증 스킴 무변경. breaking change 없음. |

## 발견 없는 에이전트

- **security** — 보안 통제 변경 없음(인증 가드/시크릿 마스킹 로직 diff 범위 밖, 그대로 보존 확인).
- **side_effect** — 전역 상태/네트워크/파일시스템/이벤트 부작용 없음.
- **api_contract** — wire 계약·breaking change 없음.

## 권장 조치사항

1. `plan/in-progress/eia-context-schema-followups.md:16` 의 "`external-interaction` 모듈 응답 DTO 위치 정규화" 체크박스를 `[x]` 로 갱신하고 완료 근거(커밋 `31bbbac31`)를 남긴다 (WARNING #1, 4개 reviewer 가 중복 지적).
2. `ExecutionStatusDto.status` / `InteractAckDto.currentStatus` 의 리터럴 유니온을 공유 타입으로 통합해 향후 상태값 변경 시 동기화 누락을 방지한다 (WARNING #2).
3. `documentation` reviewer 를 재실행해 output 이 정상적으로 디스크에 기록되는지 확인한다 — 이번 실행은 `status=success` 였음에도 파일이 부재해 내용을 검증하지 못했다(disk-write gap, 과거 PR #901 사고와 동일 패턴).
4. (저우선) `interactionType`/`OPEN_MAP_SCHEMA` 보일러플레이트 통합, `CurrentNodeDto` 필드 단위 스키마 검증 추가, `WaitingContextBaseDto` phantom-schema 부재 단언 추가는 여유 있을 때 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — 순수 구조 리팩터임에도 router_safety 정책상 강제 실행됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 상세는 전달되지 않음) — 순수 파일 이동/import 재배선으로 성능 경로 영향 없다고 판단된 것으로 추정 |
  | dependency | 라우터 판단(사유 상세 비제공) — 신규 외부 의존성 추가 없음 |
  | database | 라우터 판단(사유 상세 비제공) — DB 쿼리/스키마 변경 없음 |
  | concurrency | 라우터 판단(사유 상세 비제공) — 동시성 로직 변경 없음 |
  | user_guide_sync | 라우터 판단(사유 상세 비제공) — 사용자 가이드 영향 없는 내부 구조 변경 |