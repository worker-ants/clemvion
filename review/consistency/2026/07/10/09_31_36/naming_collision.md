# 신규 식별자 충돌 검토

## 사전 확인 메모

`_prompts/naming_collision.md` 에 포함된 "Target 문서" 페이로드는 `spec/data-flow/` 전체 폴더를
통째로 pasting 한 매우 큰(3510줄) 템플릿이었으나, 지시받은 대로 `git diff origin/main...HEAD` 로
**실제 diff** 를 직접 재확인했다. 실제 변경 범위는 다음 두 소스 파일 + 대응 테스트 + 선행 코드리뷰
산출물뿐이며, **`spec/` 아래는 이번 diff 에 전혀 포함되지 않았다**(`git diff --stat` 상 `spec/*` 항목 0건):

- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (기존 파일 수정)
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.spec.ts` (신규 테스트)
- `codebase/backend/src/modules/schedules/schedule-runner.service.ts` (기존 파일 수정)
- `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts` (기존 파일에 테스트 케이스 추가)
- `review/code/2026/07/10/09_17_14/*`, `review/code/2026/07/10/09_29_31/*` (선행 `/ai-review` 산출물 — 식별자 없음)

이하 발견사항은 **이 실제 diff** 를 기준으로 한 신규 식별자 충돌 분석이다. `_prompts` 페이로드의
`spec/data-flow/` 전문은 이번 변경과 무관한 것으로 판단해 분석 대상에서 제외했다(오케스트레이터 측
페이로드 구성 이슈로 보이며, 별도 보고 사항은 아래 요약에 기재).

## 발견사항

이번 diff 는 **신규 식별자를 도입하지 않는다.** 도입부에서 명시한 대로 기존 shared SoT
(`redactSecrets`, `shared/utils/sanitize-error-message.ts`)와 기존 모듈 함수(`sanitizeErrorMessage`,
`modules/execution-engine/sanitize-error-message.ts`)를 재사용(import)하는 것이 변경의 전부다. 6개
점검 관점(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 / 파일 경로)
전부를 확인했으며 CRITICAL/WARNING 대상은 없다.

- **[INFO]** `sanitizeErrorMessage` / `redactSecrets` 재사용 관계는 명명 SoT 규약과 일치
  - target 신규 식별자: 없음 (신규 export 없음)
  - 기존 사용처:
    - `codebase/backend/src/shared/utils/sanitize-error-message.ts:49` — `export function redactSecrets(raw: string)` (shared SoT, `SECRET_LEAK_PATTERNS` 기반). 기존에도 `shared/conversation-thread/thread-renderer.ts`, `modules/execution-engine/ai-turn-orchestrator.service.ts` 가 이미 소비 중.
    - `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:25` — `export function sanitizeErrorMessage(err: unknown): string` (모듈 로컬, 전 커밋 `e3e30c35f`/`d97ac6520` 에서 이미 도입). 기존 소비처: `execution-engine.service.ts`, `queues/background-execution.processor.ts`.
  - 상세: 이번 diff 는 (1) `sanitize-error-message.ts` 내부에서 `redactSecrets` 를 import 해 마스킹 단계를 추가하고, (2) `schedule-runner.service.ts` 에서 기존 `sanitizeErrorMessage` 를 새로 import 해 `schedule_failed` 알림 메시지에 적용한 것뿐이다. 두 함수 모두 **이름·시그니처·의미가 그대로 유지**된 채 소비처만 넓어졌다 — grep 결과 프로젝트 전체에서 `export function sanitizeErrorMessage` 정의는 위 1곳, `export function redactSecrets` 정의는 shared 1곳뿐으로 동명 함수의 이중 정의(shadowing) 없음을 확인했다.
  - 제안: 없음 — 사용자 메모리(SoT 규약: "에러 메시지 토큰 마스킹은 `shared/utils/sanitize-error-message.ts` `SECRET_LEAK_PATTERNS` 재사용, 새로 구현 금지")에 정확히 부합하는 재사용 패턴. 유지.

- **[INFO]** `EIA §R17` 참조는 기존 요구사항 ID 재인용 (신규 아님)
  - target 신규 식별자: 없음
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:1104` — `### R17. getStatus 의 currentNode/context 실값 노출 (...)`. 이미 `spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/3-auth-session.md`, `spec/conventions/conversation-thread.md` 등에서도 인용 중인 기존 ID.
  - 상세: 변경된 두 소스 파일의 주석·테스트 설명(`EIA §R17 잔여 하드닝`, `EIA §R17 — 알림/이메일 누출 차단`)이 이 기존 requirement ID 를 인용한다. 새 번호를 채번하지 않고 기존 R17(external-interaction secret 마스킹 결정)의 연장선임을 정확히 표시했으므로 충돌이 아니라 올바른 cross-reference.
  - 제안: 없음.

- **[INFO]** `sanitize-error-message.ts` 동명 파일 2곳 존재는 이번 diff 로 인한 신규 충돌이 아님
  - target 신규 식별자: 해당 없음 (두 파일 모두 이번 diff 이전부터 존재)
  - 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (전 커밋에 이미 존재) vs `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (커밋 `d97ac6520`/`e3e30c35f` 에서 이미 도입, 이번 diff 는 그 파일을 **수정**할 뿐 생성하지 않음 — `git log --diff-filter=A` 로 확인).
  - 상세: 동일 basename 이 서로 다른 책임(shared 범용 secret redaction util vs execution-engine 전용 에러 메시지 정리 util)을 갖고 공존하는 것은 기존 구조이며, 이번 diff 가 이 구조를 새로 만들거나 악화시키지 않는다. import 경로(`../../shared/utils/sanitize-error-message` vs `./sanitize-error-message`)로 명확히 구분되어 실질적 혼동 리스크는 낮다.
  - 제안: 이번 PR 범위 밖 — 조치 불필요. (참고용 기록)

- **[INFO]** `_prompts/naming_collision.md` 페이로드와 실제 diff 간 불일치
  - target 신규 식별자: 해당 없음 — 오케스트레이터 입력 데이터 이슈
  - 기존 사용처: 해당 없음
  - 상세: 프롬프트 페이로드의 "Target 문서" 섹션이 `spec/data-flow/` 폴더 전문(수십 개 도메인 spec, mermaid 다이어그램, BullMQ 큐 카탈로그 등)을 담고 있으나, 실제 `git diff origin/main...HEAD` 는 `spec/` 변경을 전혀 포함하지 않는 순수 코드(2개 파일) 변경이다. 이는 이번 검토 대상(secret 마스킹 재사용)과 관련이 없어 보이는, 오케스트레이터 측 payload 구성 오류로 추정된다.
  - 제안: 오케스트레이터가 checker 호출 시 `target 문서` 인자를 실제 변경 스코프(`codebase/backend/src/modules/execution-engine/`, `codebase/backend/src/modules/schedules/`)에 맞게 재구성할 것을 권장. 이번 응답은 사용자 지시대로 실제 diff 를 SoT 로 삼아 처리했으므로 검토 결과 자체에는 영향 없음.

## 요약

이번 변경은 `execution-engine/sanitize-error-message.ts` 와 `schedules/schedule-runner.service.ts` 두
파일에서 **기존에 이미 export 된 `redactSecrets`(shared SoT)와 `sanitizeErrorMessage`(execution-engine
모듈)를 그대로 재사용**하며, 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키·파일
경로를 하나도 신규 도입하지 않는다. `EIA §R17` 인용도 기존 requirement ID 재사용으로 정확하다. 신규
식별자 충돌 관점에서 CRITICAL/WARNING 은 0건이며, 참고할 INFO 항목(동명 파일 구조는 기존 상태 유지,
프롬프트 페이로드와 실제 diff 불일치는 오케스트레이터 이슈)만 기록했다.

## 위험도

NONE
