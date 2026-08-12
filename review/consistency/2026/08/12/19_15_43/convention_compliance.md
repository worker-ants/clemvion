# 정식 규약 준수 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 검토 범위 메모

- Target: `spec/data-flow/**` (16개 문서, `0-overview.md` + `1`~`15` 번호 문서).
- 구현 diff: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  (+ `.spec.ts`, `test/external-interaction.e2e-spec.ts`) — Spec EIA §R8 idempotency 캐시
  대상(닫힌 목록 `2xx`/`409`/`410`)을 구현이 지금까지 지키지 못하던 것을 코드 쪽에서
  바로잡은 순수 버그 픽스. **spec 파일 자체는 이 diff 에서 변경되지 않았다**
  (`spec/data-flow/15-external-interaction.md` §1.2·§2.2 는 이미 닫힌 목록을 서술 중이었음).
- 조립 프롬프트의 `spec/conventions/**` 번들 270개 파일 중 261개가 컨텍스트 예산 초과로
  본문 절단(`> 본문 생략됨 — 컨텍스트 예산 초과`) 상태였다. 이번 diff 와 직접 관련된
  `error-codes.md`·`swagger.md`·`secret-store.md`·`interaction-type-registry.md` 는 절단
  대상이었으므로, 프롬프트 번들 대신 워크트리 절대경로(`/Volumes/project/private/clemvion/
  .claude/worktrees/eia-r8-cache-scope-4ae434/spec/conventions/*.md`)를 직접 Read 하여
  전문으로 대조했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO] 코드 변경분은 정식 규약(에러 코드 명명·API 문서·캐시 envelope) 과 이미 정합**
  - target 위치: `spec/data-flow/15-external-interaction.md` §1.2 dispatch 표, §2.2 Redis
    캐시 행(`interaction:idempotency:<key>`)
  - 근거 규약: `spec/conventions/error-codes.md` §1(UPPER_SNAKE_CASE 의미 기반 명명),
    `spec/conventions/swagger.md` (409→`@ApiConflictResponse`, 410→`@ApiGoneResponse` 등
    §5 decorator 매핑)
  - 상세: diff 가 캐시 재현 경로에서 사용하는 `STATE_MISMATCH`(409)·
    `EXECUTION_TERMINATED`(410)·`VALIDATION_ERROR`(400) 코드는 신규 코드가 아니라
    기존 `error-codes.md` 체계를 그대로 재사용한다(모두 UPPER_SNAKE_CASE, 도메인
    prefix 규칙에 저촉되는 신규 접두어 없음). 캐시 replay 가 `new HttpException(
    JSON.parse(cached.responseJson), cached.statusCode)` 로 원 예외의 응답 바디를
    그대로 재구성하므로 `api-convention §5.3` 에러 envelope 형태도 그대로 보존된다.
    `interaction.controller.ts` 의 `interact` 엔드포인트는 이미 `@ApiConflictResponse`·
    `@ApiGoneResponse` 데코레이터를 부착하고 있어(§4 API 문서 규약 관점에서) 이 diff 가
    새로 노출하는 409/410 replay 경로도 기존 문서화 표면 안에 있다.
  - 제안: 조치 불요 — 정합 확인을 위한 참고 기록.

## 문서 구조/명명 규약 점검 (spec/data-flow/ 전체)

- 파일 명명: `0-overview.md` + `1-audit.md` … `15-external-interaction.md` 로 CLAUDE.md 의
  `0-` prefix 컨벤션과 순번 규칙을 전 파일이 준수.
- 3섹션 구조(Overview / 본문 / Rationale): 16개 문서 전부 `## Overview` → 번호 매긴 본문
  섹션(대개 `1. Source → Sink` ~ `4. 외부 의존`, 문서별 3~5개) → `## Rationale` 순서를
  예외 없이 따른다 (`0-overview.md`, `1-audit.md`, `2-auth.md`, `3-execution.md`,
  `4-file-storage.md`, `5-integration.md`, `6-knowledge-base.md`, `7-llm-usage.md`,
  `8-notifications.md`, `9-observability.md`, `10-triggers.md`, `11-workflow.md`,
  `12-workspace.md`, `13-agent-memory.md`, `14-chat-channel.md`,
  `15-external-interaction.md` 헤더 위치 grep 으로 확인).
- Secret URI 명명: `15-external-interaction.md` §1.5 의
  `secret://triggers/{triggerId}/notification-signing`(및 `.v2`)은
  `spec/conventions/secret-store.md` §1 URI Scheme(`secret://<scope>/<resourceId>/<name>`,
  kebab-case name)과 정확히 일치.
- 위 범위에서 명명·구조·금지 항목 위반을 발견하지 못했다.

## 요약

이번 diff 는 `spec/data-flow/` 문서를 변경하지 않는 순수 백엔드 버그 픽스(Idempotency 캐시
대상을 Spec EIA §R8 닫힌 목록에 맞춤)이며, target 인 `spec/data-flow/**` 16개 문서는
파일 명명(`0-` prefix, 번호 순번)·3섹션 구조(Overview/본문/Rationale)·secret URI 명명·
에러 코드 명명(UPPER_SNAKE_CASE)·API 문서 데코레이터(409/410 매핑) 전 관점에서 관련 정식
규약(`spec/conventions/error-codes.md`, `swagger.md`, `secret-store.md`)과 정합했다.
프롬프트 번들 자체가 `spec/conventions/**` 270개 중 261개를 예산 초과로 절단했으나,
이번 diff 와 직접 관련된 규약 파일은 워크트리에서 전문을 직접 대조했으므로 판정의
신뢰도에는 영향이 없다. CRITICAL/WARNING 발견사항 없음.

## 위험도

NONE
