# 신규 식별자 충돌 검토 — `eia-internal-rest-error-masking.md` (라운드 `17_35_13`)

## 검토 범위 및 방법

이전 라운드(`16_48_55`, 위험도 NONE)가 이미 이 target 의 신규 식별자 6종(함수명
`redactStoredErrorForResponse`, private 메서드 `stopInternal`/`toResponseExecution`,
secret-store.md `비대상 — Trigger.config.interaction.triggerToken` 블록, §R17 교체 불릿,
plan 파일 경로)을 전수 대조해 충돌 없음을 확인했다. 본 라운드는 그 이후 커밋
(`4c1f89e55` 문서 6곳 등재, `9dee1caa0` `/ai-review` WARNING 6건 반영)이 새로 도입한
식별자만 델타로 대조했다 — `git diff origin/main...HEAD -- spec/5-system/ codebase/backend/src`
및 각 커밋의 개별 diff를 절대경로 워크트리에서 직접 확인.

## 발견사항

델타로 새로 도입된 식별자는 TS 타입 `ResponseExecution` 하나뿐이며, 나머지는 기존 식별자에
대한 재참조·문서 교차링크·테스트 추가였다.

- **TS 타입 `ResponseExecution`** (`codebase/backend/src/modules/executions/executions.service.ts:87`)
  — `Omit<Execution, 'error'|'trigger'|'executor'> & { error: Record<string, unknown> | null }`로
  신설. repo 전체(`codebase/backend`, `codebase/frontend`, `spec/`)를 grep 했으나 정의부
  (`executions.service.ts`)와 그 소비처(`stop()`/`getChain()`/`toResponseExecution()` 반환 타입,
  같은 파일의 `ExecutionDetailWithTrigger` 정의, 테스트 코멘트 1곳) 외에는 등장하지 않는다.
  같은 디렉토리에 이미 존재하는 `ExecutionDto`/`ExecutionDetailDto`/`ExecutionContinueResultDto`
  (`dto/responses/execution-response.dto.ts`)와는 접미사(`Dto`)·용도(class-transformer 로 직렬화되는
  공개 API DTO vs 서비스 내부 반환 타입)가 뚜렷이 갈려 혼동 위험이 낮다. 충돌 없음.
- **문서 교차링크 4건** — `6-websocket-protocol.md`(`execution.snapshot` 행에 마스킹 상속 캐비엇),
  `12-background.md` §8.2(`nodeExecutions.data` 행), `14-execution-history.md`(R-5 대상범위
  캐비엇), `secret-store.md` Overview(예외 caveat 문구)는 모두 기존 식별자(`findById`,
  `Execution.error`, `nodeExecutions[].error`, R-5, §R17)를 인용할 뿐 새 이름을 만들지 않는다.
- **`BackgroundRunsService`** — `redactStoredErrorForResponse` 를 새로 import 해 재사용할 뿐,
  신규 식별자를 정의하지 않는다.
- **테스트 추가**(`redact-stored-error.spec.ts` 레거시 문자열/숫자 케이스,
  `executions.service.spec.ts`/`background-runs.service.spec.ts` copy-on-change 케이스) — 신규
  export·타입 없음.
- **plan 트래커 체크박스/각주** (`spec-sync-external-interaction-api-gaps.md`,
  `eia-internal-rest-error-masking.md` 등) — 상태 전환(`[ ]`→`[x]`) 및 완료 링크
  (`./eia-terminal-error-sanitize.md` → `../complete/eia-terminal-error-sanitize.md`) 갱신뿐,
  새 요구사항 ID·엔티티명 없음.
- **API endpoint / 이벤트명 / ENV var / 설정키** — 이 델타는 controller 파일을 전혀 건드리지
  않았다(`git diff --stat`으로 확인, executions/background-runs 모듈 모두 `*.service.ts`만
  변경). 신규 endpoint, webhook/queue/SSE 이벤트명, ENV var 도입 없음 — N/A.
- **파일 경로** — 이번 델타에서 신설된 파일 없음(전부 기존 파일 편집 또는 이전 라운드에서 이미
  검증된 `redact-stored-error.ts`/`.spec.ts` 파일의 후속 편집).

## 요약

`16_48_55` 라운드가 확인한 신규 식별자 6종에 이번 델타(spec 문서 6곳 등재 커밋 + `/ai-review`
WARNING 반영 커밋)를 더해 재검증했다. 델타가 실제로 새로 도입한 식별자는 TS 타입
`ResponseExecution` 하나뿐이며, `codebase/`·`spec/` 전체 대조 결과 다른 의미로 이미 쓰이는
동일 식별자는 없다. 이전 라운드에서 CRITICAL 로 지적됐던 `redactExecutionErrorValue` 충돌은
이번에도 재발하지 않았고(치환 후 이름이 그대로 유지), 나머지 변경은 모두 기존 식별자를
재참조하는 문서 교차링크·상태 갱신·테스트 추가였다. 신규 endpoint·이벤트명·ENV var·설정키는
이번 델타 범위에 없다.

## 위험도

NONE
