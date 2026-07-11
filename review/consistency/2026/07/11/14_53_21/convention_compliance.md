# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md`

검토 모드: --impl-done (diff-base=origin/main)
구현 SoT 워크트리: `/Volumes/project/private/clemvion/.claude/worktrees/eia-response-dto-normalize-205f7d`

## 배경 확인

diff 는 `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (단일 파일, `InteractAckDto`/`RefreshTokenResponseDto`/`ExecutionStatusDto` 등 3개 응답 계열이 한 파일에 혼재) 를 아래로 분리한다.

- `dto/responses/execution-status-response.dto.ts` (`CurrentNodeDto`/`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`/`ExecutionStatusDto`)
- `dto/responses/interact-ack-response.dto.ts` (`InteractAckDto`)
- `dto/responses/refresh-token-response.dto.ts` (`RefreshTokenResponseDto`)

이는 [`spec/conventions/swagger.md` §5-1](../../../../../../spec/conventions/swagger.md#5-1-응답-dto-위치) 이 명시하는 응답 DTO 위치 규약(`codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`)을 **이전엔 위반하고 있던 것을 이번 diff 가 정정**한 것이다. 코드베이스 내 다른 29개 모듈(`agent-memory`/`alerts`/`auth`/`executions`/`triggers`/... )도 모두 이 패턴을 따르고 있어 실제 확립된 선례와 일치한다(`login-history.dto.ts`/`session.dto.ts`/`embed-config.dto.ts` 처럼 `-response` 접미사를 생략한 파일도 기존 선례로 존재하므로 파일명 접미사 표기는 엄격하지 않다).

JSDoc 상대경로(`../../../../../../spec/...` → `../../../../../../../spec/...`), `ConversationThread` import 경로(`../../../shared/...` → `../../../../shared/...`) 도 새 디렉토리 깊이(+1)에 맞춰 정확히 갱신됐다. `WaitingContextBaseDto.conversationThread` 의 "키 생략(present-when-available)" 처리·JSDoc 근거([API 규약 §5.4](../../../../../../spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략))도 규약과 정확히 일치한다. `ExecutionStatusDto.context` 의 `oneOf` + `discriminator` 미부여도 [`swagger.md §1-4`](../../../../../../spec/conventions/swagger.md#1-4-nested--enum--union) Rationale("discriminator 는 판별자가 sound 할 때만")과 일치한다. 코드 자체의 규약 준수도는 높다.

문제는 **target 문서(spec)** 가 이 리팩터링을 반영하지 못해 이제는 스스로 규약 위반이던 옛 구조를 "현재 구현" 인 것처럼 계속 서술한다는 점이다.

## 발견사항

- **[WARNING] §10 "구현 파일 구조" 가 옛(규약 위반) DTO 파일명을 그대로 서술**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §10 "구현 파일 구조", 코드 블록 861행 `dto:` 항목 — `responses.dto.ts`
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "응답 DTO 위치" — `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
  - 상세: 본 diff 로 `dto/responses.dto.ts` (단일 파일, `*-response.dto.ts` 패턴 미준수) 는 삭제되고 `dto/responses/execution-status-response.dto.ts` · `interact-ack-response.dto.ts` · `refresh-token-response.dto.ts` 3개 파일로 분리됐다(§5-1 규약 정합화). 그러나 target 문서 §10 은 여전히 `dto/` 하위에 `responses.dto.ts` 단일 파일만 나열하고 있어, 코드와 어긋날 뿐 아니라 **이미 정정된 §5-1 위반 상태를 최신 구조인 것처럼 서술**한다. 이 절을 참고해 향후 신규 인터랙션 관련 응답 DTO 를 추가하는 개발자가 옛 단일-파일 안티패턴을 재현할 유인이 된다.
  - 제안: §10 코드 블록의 `dto:` 하위를 아래처럼 갱신.
    ```
    dto/
      interact.dto.ts
      cancel.dto.ts
      responses/
        execution-status-response.dto.ts
        interact-ack-response.dto.ts
        refresh-token-response.dto.ts
      ...
    ```

- **[INFO] 동일 원인의 stale 참조가 `spec/conventions/interaction-type-registry.md` 에도 존재 (target 범위 밖, 참고용)**
  - target 위치: (target 문서 밖) `spec/conventions/interaction-type-registry.md` 40행
  - 위반 규약: 위와 동일 — `spec/conventions/swagger.md` §5-1
  - 상세: "이 4→3 통합은 `chat-channel.dispatcher` 및 EIA 응답 DTO(`external-interaction/dto/responses.dto.ts`) 계층의 책임이다" 라는 문장이 동일한 옛 경로를 인용한다. 4→3 통합 로직은 이번 분리 후 `execution-status-response.dto.ts` (`CurrentNodeDto`/`ExecutionStatusDto`)에 있다. target 문서 자체는 아니지만 같은 코드 변경이 유발한 stale 참조라 함께 정정하면 drift 재발을 막을 수 있다.
  - 제안: `external-interaction/dto/responses.dto.ts` → `external-interaction/dto/responses/execution-status-response.dto.ts` 로 갱신.

- **[INFO] 신규 3파일 간 class 명명 접미사가 내부적으로 불일치**
  - target 위치: (코드) `interact-ack-response.dto.ts`(`InteractAckDto`) / `execution-status-response.dto.ts`(`ExecutionStatusDto`) vs `refresh-token-response.dto.ts`(`RefreshTokenResponseDto`)
  - 위반 규약: 명시적 규약 위반은 아님 — `swagger.md` §5-1 은 파일 위치만 규정하고 class 명명은 규정하지 않는다. 참고로 §5-3 예시(`WorkflowDto` in `workflow-response.dto.ts`)는 class 명에서 "Response" 를 생략하는 쪽이다.
  - 상세: 같은 PR 로 분리된 3개 파일 중 2개(`InteractAckDto`, `ExecutionStatusDto`)는 class 명에서 "Response" 를 생략했고 1개(`RefreshTokenResponseDto`)는 유지했다 — 이번 분리 이전부터 있던 기존 명명이라 이번 diff 가 만든 문제는 아니지만, 분리 시점이 통일할 좋은 기회였다.
  - 제안: 선택 사항. 굳이 소급 정정할 필요는 없음(risk/효용 낮음) — 후속 리네이밍 시 참고.

## 요약

이번 diff(`responses.dto.ts` → `dto/responses/*-response.dto.ts` 3-파일 분리)는 `spec/conventions/swagger.md` §5-1 응답 DTO 위치 규약을 코드 레벨에서 정확히 준수시키는 정당한 정정이며, JSDoc 상대경로·import 경로·`present-when-available` 부재표현(API 규약 §5.4)·`oneOf`/discriminator 미부여(swagger §1-4 Rationale) 등 세부 규약도 모두 일치한다. 다만 target 문서(`spec/5-system/14-external-interaction-api.md`) §10 "구현 파일 구조" 는 이 리팩터링 이전의(=§5-1 위반 상태였던) `responses.dto.ts` 단일 파일명을 그대로 남겨두고 있어, spec 이 스스로 "정정된 규약 위반" 을 현재 구조인 양 서술하는 문서 drift 가 발생했다. 동일 원인의 stale 참조가 `spec/conventions/interaction-type-registry.md` 에도 있다(참고용, target 범위 밖). CRITICAL 급 위반은 없다.

## 위험도
LOW
