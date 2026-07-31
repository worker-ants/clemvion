STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 및 스코프 확정

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21건) + `PROJECT.md` 본문을 SSOT 로 적재했다. 리뷰 대상은 `codebase/backend/src/modules/execution-engine/` 하위 5개 파일(`state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`, `retry-turn.service.ts`)이며, 이는 `execution.retry_last_turn` 재진입의 짝 전이(FAILED→RUNNING / FAILED→WAITING_FOR_INPUT)가 DB 가드에 막혀 절대 persist 되지 않던 결함을 고치는 8R/9R/10R 라운드다.

실제 변경 스코프를 확정하기 위해 fork point(`origin/main` = `71ce6c12b`)부터 HEAD(`3c306d593`)까지 전체 diff 를 확인했다 (`review/**` 산출물 제외):

- `codebase/backend/src/modules/execution-engine/{state/state-machine,execution-engine.service,ai-turn-orchestrator.service,engine-driver.interface,retry-turn.service}.ts` + 대응 `*.spec.ts`
- `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`
- `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` + `run-results.en.mdx`
- `CHANGELOG.md`, `plan/in-progress/retry-turn-terminal-guard.md`

`workflow-errors.ts` / `nodes/core/error-codes.ts` 는 fork point 대비 **diff 없음**(확인됨) — 신규 errorCode/warningCode 발행 없음.

## Trigger 매칭

| 매트릭스 행 | 매칭 여부 | 근거 |
| --- | --- | --- |
| new-node / node-schema-change | 불일치 | `codebase/backend/src/nodes/**` 변경 없음 (엔진 내부 전용) |
| new-ui-string / new-widget-chrome-string | 불일치 | `.tsx` 변경 없음 |
| integration-provider-change | 불일치 | provider 변경 없음 |
| new-userguide-section-dir | 불일치 | `05-run-and-debug/` 는 기존 디렉토리, 신규 디렉토리 아님 |
| new-warning-code / new-error-code | 불일치 | `workflow-errors.ts`/`error-codes.ts` diff 0 — 신규 코드 없음 |
| auth-session-flow-change / expression-language-change | 불일치 | 해당 경로 변경 없음 |
| **run-debug-flow-change** | **매칭** | backend 실행 엔진(execution-engine 모듈) 상태전이 흐름 변경 → target: `codebase/frontend/src/content/docs/05-run-and-debug/` |
| spec-major-change | 매칭(참고) | `spec/4-*`, `spec/5-*` 변경 — frontmatter 정합은 본 리뷰어의 9개 점검 관점 밖(별도 reviewer 소관)이라 深검토 생략 |

## 발견사항

- **[WARNING]** `run-debug-flow-change` 동반 갱신은 수행됐으나 EN 문서의 신규 문단 삽입 위치가 KO 와 달라 목록 구조가 깨짐 (ko/en 구조 비대칭)
  - 변경 파일: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx` (line 93-101)
  - 매트릭스 항목: `run-debug-flow-change` (실행·디버깅 흐름 변경) — targets: `"codebase/frontend/src/content/docs/05-run-and-debug/"`
  - 상세: 커밋 `3c306d593` 가 "W6(user_guide_sync) run-results ko/en" 로 이 trigger 를 이미 인지하고 양쪽 언어에 콘텐츠를 추가했다(정성적으로는 올바른 판단). 그런데 실제 삽입 위치가 언어 간 다르다.
    - **KO** (`run-results.mdx` line 104-113, 올바름): `재시도 가능`/`재시도 불가` 두 불릿이 먼저 완결된 뒤, 그 다음에 신규 문단("재시도가 성공했을 때 보이는 화면은 두 가지예요")과 그 하위 2-불릿이 이어지고, 마지막에 "60분 이내" 문단으로 마무리된다. 순서가 논리적으로 맞다(오류 유형 분류 → 성공 후 결과 분기 → 재시도 제약).
    - **EN** (`run-results.en.mdx` line 93-101, 결함): 신규 문단("A successful retry ends in one of two ways")과 그 2-불릿(`The conversation is finished` / `The conversation continues`)이 `**Retryable**` 불릿과 `**Not retryable**` 불릿 **사이**에 끼워 넣어졌다. `Read` 로 직접 확인한 결과 line 100(`on the conversation.`)과 line 101(`- **Not retryable**: ...`) 사이에 공백 줄이 없어, `Not retryable` 이 "성공 시 두 갈래" 목록의 세 번째 항목처럼 같은 리스트로 이어진다 — 원래 `Retryable`/`Not retryable` 은 짝을 이루는 에러-유형 분류 불릿인데 EN 버전에서는 이 짝이 갈라지고 `Not retryable` 이 엉뚱하게 "성공적 재시도의 결과" 리스트에 흡수된 것처럼 읽힌다.
    - 사용자 영향: 영문 사용자 가이드를 읽는 사용자는 "재시도 성공 시 두 갈래" 설명 직후 맥락 전환 없이 "Not retryable(인증 오류 등)" 항목을 만나 이것이 마치 "성공적 재시도가 끝나는 세 번째 방식"인 것처럼 오독할 수 있다. 정보 자체는 존재하지만(완전 누락 아님) 구조가 KO 버전과 달라 순수 병렬 번역이 아니다.
  - 제안: `run-results.en.mdx` 에서 신규 블록(line 95-100)을 `Not retryable` 불릿(line 101) **뒤**, "Retry is available **once within 60 minutes**" 문단 **앞**으로 이동해 KO 버전과 동일한 순서(Retryable → Not retryable → 성공 시 두 갈래 → 60분 제약)로 맞춘다.

## 요약

매트릭스 21개 행 중 이 diff(`origin/main`→HEAD, `execution-engine` 모듈 5파일 + 부속 spec/docs)에 실질적으로 매칭되는 trigger 는 `run-debug-flow-change` 1건뿐이며(신규 노드·스키마·UI 문자열·통합·신규 섹션·신규 warning/error code 트리거는 모두 불일치 — `workflow-errors.ts`/`error-codes.ts` diff 0 으로 실측 확인), 이 1건은 이미 같은 커밋 체인(`3c306d593`, "W6 user_guide_sync") 안에서 ko/en 양쪽 `run-results.mdx`/`.en.mdx` 에 동반 갱신이 시도됐다. 다만 EN 버전의 신규 문단 삽입 위치가 KO 와 달라(불릿 목록 중간 삽입) 구조적 비대칭이 발생했다 — CRITICAL 급 "누락"은 아니지만(양쪽 다 정보는 존재) 병렬성이 깨진 WARNING 1건으로 분류한다. 그 외 i18n dict, backend-labels, locale.ts, 노드 문서 트리거는 전부 해당 없음.

## 위험도

LOW
