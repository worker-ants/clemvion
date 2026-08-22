# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-prep)

## 사전 확인

- `git diff origin/main -- spec/5-system/` 결과 **0줄** — 이번 target 은 spec/5-system/ 본문을 새로 바꾸지 않는다(`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 전문을 읽었고, 나머지는 예산상 절단됐지만 diff 자체가 없으므로 신규 식별자 후보가 아니다).
- 실제 작업 대상은 `plan/in-progress/rerun-input-resolution-extract.md` (frontmatter `spec_impact: none`) — `ExecutionsService.reRun` 의 40줄 입력 해석 블록을 private 헬퍼 `resolveManualOverrideInput` 로 뽑는 **순수 리팩터**(동작·에러코드·응답 필드 무변경)다. 코드(`codebase/backend/src/modules/executions/executions.service.ts`)에 이미 반영되어 있었다.
- 즉 이번 target 이 실제로 도입하는 "신규 식별자"는 spec 레벨 ID/엔티티/엔드포인트/이벤트/env var 가 아니라, **private 메서드명 `resolveManualOverrideInput` 하나**뿐이다. 아래는 그 식별자에 대한 충돌 검토와, 혹시 있을 spec/5-system/ 전역 관점의 이상 유무를 점검한 결과다.

## 발견사항

검토 관점 1~6(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로) 전부에서 target 이 새로 도입하는 충돌은 발견되지 않았다.

- **요구사항 ID / 엔티티·타입명**: spec 본문 변경 없음 → 신규 ID·엔티티 없음.
- **API endpoint**: 신규 endpoint 없음 (리팩터는 controller/route 를 건드리지 않음, `reRun` 서비스 로직 내부 구조만 재배치).
- **이벤트/메시지명**: 신규 audit action·webhook·SSE 이벤트 없음. `AUDIT_ACTIONS.EXECUTION_RE_RUN`(`execution.re_run`)은 기존 값 그대로 재사용된다.
- **환경변수·설정키**: 없음.
- **파일 경로**: 신규 spec 파일 없음. `plan/in-progress/rerun-input-resolution-extract.md` 경로는 기존 plan 명명 컨벤션(`<주제>-<동작>.md`, kebab-case)과 일치.
- **코드 식별자 `resolveManualOverrideInput`**: `grep -rn "resolveManualOverrideInput" codebase/` 결과 정의(L547)·호출(L487) 2곳뿐이며 `ExecutionsService` 내부에 유일하게 존재. 동일/유사 이름(`ManualOverrideInput`, `manualOverrideInput`)의 다른 정의도 없음 — 다른 의미로 이미 쓰이고 있는 이름이 아니다. 인접한 `resolveTriggerParameters`/`resolveTriggerParametersRejectingMasked`(base/wrapper 쌍, `masked-reject-callers-guard` 감시 대상)와도 이름이 명확히 구분되며, 새 헬퍼는 wrapper(`resolveTriggerParametersRejectingMasked`)를 올바르게 호출하고 있어 가드 탐지축(AST identifier)과도 충돌하지 않는다.

## 요약

target 은 spec/5-system/ 본문을 변경하지 않는 순수 코드 리팩터(`spec_impact: none`)이며, 유일하게 새로 도입되는 식별자인 private 헬퍼 `resolveManualOverrideInput` 은 코드베이스 전역에서 유일하고 기존 사용처와 의미가 겹치지 않는다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 파일 경로 어느 축에서도 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
