# 정식 규약 준수 검토 — spec/5-system/14-external-interaction-api.md (diff: origin/main...HEAD)

## 검토 범위

diff-base `origin/main` 대비 이번 PR 의 실질 변경은:
- `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표·§6.4 `error` 관련 문구 갱신 (`execution.failed` 의 `error` 를 전 경로 object 로 일원화한 사실 반영)
- 신규 `codebase/backend/src/shared/utils/terminal-error-payload.ts` (+spec)
- `execution-engine.service.ts` / `retry-turn.service.ts` 의 emit 지점 4곳이 신규 헬퍼 사용
- `chat-channel.dispatcher.ts` / `chat-channel/types.ts` 의 `EiaFailedEvent.error.code` 를 `string | null` 로 정정 + 레거시 string 흡수 분기 정리
- `use-execution-events.ts` 의 `execution.failed` 페이로드 소비를 object/string 겸용으로 정정

target 문서 전문(§1~§12, Rationale R1~R19)과 번들에 포함된 `spec/5-system/2-api-convention.md` 전문을 읽고, `spec/conventions/error-codes.md` · `spec/conventions/swagger.md` · `spec/conventions/spec-impl-evidence.md` · `spec/conventions/redis-keys.md` 를 대조했다. 코드 확인은 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)로 수행했다.

## 발견사항

이번 diff 범위에서 `spec/conventions/**` 위반은 발견되지 않았다. 점검한 항목과 근거:

- **에러 코드 명명** — 신규/재확인된 `WORKER_HEARTBEAT_TIMEOUT` 은 `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리에 이미 등재되어 있고 target 문서의 서술(§6.4 codeblock 주석 "무조건 붙는 `WORKER_HEARTBEAT_TIMEOUT`")과 등재 사유가 일치한다. `RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT` 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명(§1) 을 따른다.
- **부재 표현 (`null` vs 키 생략)** — `spec/5-system/2-api-convention.md` §5.4 규칙("기본은 `null`, 키 생략은 (a)/(b) 근거 명시") 에 target §6.4 의 `error.code`/`nodeId` 를 `null` 로 두는 결정이 정확히 부합한다. `toTerminalErrorPayload()` 구현도 `null`(부재) 을 스칼라·객체·문자열 입력 전체에서 유지하고, 빈 객체 대신 최상위 `null` 을 반환해 §5.4 취지("에러가 있는데 내용 없음"으로 오독되지 않게)를 그대로 구현한다.
- **DTO/Swagger 패턴** — `execution-status.literal.ts` 의 `EIA_` 접두 + `Literal` 접미 명명은 `spec/conventions/swagger.md` §5-1 이 제시하는 예시 코드와 리터럴로 일치(해당 예시가 바로 이 파일). `dto/responses/*-response.dto.ts` 배치, `@ApiPropertyOptional({ nullable: true })` 사용도 §5-4/§1-3 체크리스트를 만족한다. target §10.1 이 언급하는 `@ApiBearerAuth('interaction-token')` 분리·Hooks `@Public()` 무 `@ApiSecurity({})` 방침도 swagger.md §2-1 과 부합한다.
- **spec frontmatter** — `id: external-interaction-api` / `status: partial` / `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]` 는 `spec/conventions/spec-impl-evidence.md` §2 스키마를 만족하고, 해당 plan 파일이 실존하며 이번 PR 이 다루는 "`error` 를 객체로 통일" 항목이 그 plan 안에서 `[x]` 로 갱신돼 있어 spec↔plan 동기화도 확인된다.
- **파일/식별자 명명** — `terminal-error-payload.ts`/`.spec.ts` 는 같은 디렉토리(`shared/utils/`)의 기존 `*.ts`/`*.spec.ts` 짝 관례를 그대로 따른다.
- **Redis 키 네임스페이스** — target §8.4 의 `eia:rl:interact:<executionId>` 등은 `spec/conventions/redis-keys.md` 인벤토리와 문자열까지 일치(이번 diff 대상은 아니나 교차 오염 여부 확인 차 대조).

문서 구조(Overview/본문/Rationale 3섹션) 자체는 이번 diff 로 변경되지 않았으며 기존 구조(§Overview → §1~§12 본문 → §Rationale)를 유지한다.

## 요약

이번 PR 의 실질 diff(`terminal-error-payload.ts` 신설 + 4개 emit 지점 통일 + 관련 spec 문구 갱신)는 `spec/conventions/error-codes.md`(코드 명명·null 부재 표현), `spec/conventions/swagger.md`(DTO/래퍼 패턴), `spec/conventions/spec-impl-evidence.md`(frontmatter 스키마) 어느 것과도 충돌하지 않는다. 변경분은 오히려 기존에 문서(§6.4)만 약속하고 코드가 못 지키던 "`error` 는 명시적 `null` 을 포함한 object" 계약을 실제로 정합시키는 방향이라, 정식 규약 준수 관점에서는 개선에 해당한다. `cancelled` 이벤트의 `error` 가 아직 `nodeId`/`details` 키 자체를 만들지 않는 잔여 불일치는 target 문서 스스로가 명시적으로 고지하고 있어(§6 필드 집합 표 비고) 은폐된 위반이 아니라 알려진 백로그로 처리된다.

## 위험도
NONE
