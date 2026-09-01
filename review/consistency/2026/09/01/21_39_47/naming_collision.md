# 신규 식별자 충돌 검토 — `spec-draft-error-code-two-surfaces.md`

## 검토 개요

target 이 편집하는 자리는 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단
하나다. 이 draft 가 문서에 "새로 등장시키는" 이름은 `EngineErrorCode` 뿐이며, 그마저도
**코드에는 이미 존재**하고(`codebase/backend/src/nodes/core/error-codes.ts:147`) **spec/ 전체에
지금까지 한 번도 등장한 적이 없었다**(`grep -rn "EngineErrorCode" spec/` → 0건, 실측). 즉
"코드 세계의 기존 식별자를 spec 세계로 처음 들여오는" 성격의 변경이라, 순수 신규 조어보다는
낮은 리스크지만 그 자체가 이 checker 의 정확한 대상이다.

## 실측 확인

| 항목 | 확인 방법 | 결과 |
|---|---|---|
| `EngineErrorCode` spec/ 내 기존 사용 | `grep -rn "EngineErrorCode" spec/` | 0건 — target 도입 전 spec 미등재 |
| `EngineErrorCode` codebase 전체 사용처 | `grep -rl "EngineErrorCode" codebase/` | `error-codes.ts`(정의) · `error-codes.spec.ts` · `engine-error-code-anchor-guard.ts`(+spec) · `execution-engine.service.ts` · `shutdown-state.service.ts` — 전부 target 이 서술하는 "엔진 전용" 의미와 일치, 다른 의미로 쓰인 곳 없음 |
| `ErrorCode`/`EngineErrorCode` 키 겹침 | `error-codes.spec.ts:55-60` `overlap` 단언 | `Object.keys(EngineErrorCode).filter(k => k in ErrorCode)` → `[]` 로 **테스트가 disjoint 를 고정** — target 이 "키가 겹치지 않는다" 고 적은 서술과 일치 |
| `EXECUTION_TIME_LIMIT_EXCEEDED` 소속 | `error-codes.ts:73`(`ErrorCode` 블록 내부) | target 서술과 일치 — `ErrorCode` 소속, `EngineErrorCode` 아님 |
| `EXECUTION_TIME_LIMIT_EXCEEDED` 를 엔진이 `Execution.error.code` 로 싣는지 | `execution-engine.service.ts:8270` 부근 주석 | `Execution.error.code = EXECUTION_TIME_LIMIT_EXCEEDED` 로 종결 — target 서술과 일치 |
| `EngineErrorCode` 4종 목록 | `error-codes.ts:153,160,165,170` | `EXECUTION_QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT`/`SERVER_INTERRUPTED`/`WEBCHAT_IDLE_TIMEOUT` — target 열거와 일치 |
| `Execution.error` 필드가 두 family 를 공존시키는지 | `spec/1-data-model.md:474` | 이미 `SERVER_INTERRUPTED`(`EngineErrorCode`)와 `EXECUTION_TIME_LIMIT_EXCEEDED`(`ErrorCode`)를 **같은 컬럼 설명 안에 나열** — target 이 §Overview 에 적으려는 "공존" 서술과 기존 spec 서술이 이미 정합 |
| "대표 surface" 문구 중복 여부 | `grep -rn "대표 surface" spec/` | `error-codes.md:26` 단 1건 — target 이 수정하려는 바로 그 문장. 다른 문서에 같은 문구로 다른 의미를 붙인 곳 없음 |
| 파일 경로 충돌 | `ls plan/in-progress/`, `find plan -iname "spec-draft-*"` | `plan/in-progress/spec-draft-error-code-two-surfaces.md` 는 신규 경로, 동명 파일 없음. `plan/complete/spec-draft-error-codes.md`(2026-06-02, `error-codes.md` **신설** 당시 draft)와 이름이 유사하나 완료본이고 스코프가 다르며(신설 vs 이번 병기), `spec-draft-<주제>` 명명 컨벤션(현재 in-progress 에만 동형 3건, complete 에 70+건)을 그대로 따른 정상 사례 |

## 발견사항

없음 — CRITICAL/WARNING 레벨 신규 식별자 충돌 미발견.

- **[INFO]** `EngineErrorCode` 는 spec/ 전역에 처음 등장하는 이름이지만 충돌이 아니다
  - target 신규 식별자: `EngineErrorCode` (spec 문서 내 최초 언급)
  - 기존 사용처: `codebase/backend/src/nodes/core/error-codes.ts:147` (코드 정의), `spec/1-data-model.md:474` (간접 서술 — 값만 나열, 타입명 자체는 미언급)
  - 상세: 코드에는 2026-08-31 자매 const 로 이미 존재하고 테스트(`error-codes.spec.ts:59`)가 `ErrorCode` 와 키 disjoint 를 고정하고 있다. spec 쪽은 값(`SERVER_INTERRUPTED` 등)만 개별 인용했을 뿐 상위 타입명 `EngineErrorCode` 를 명명한 적이 없어, target 이 그 이름을 처음 spec 어휘로 승격시키는 것 — 다른 의미로 쓰이고 있던 자리는 없다.
  - 제안: 조치 불필요. 병기 서술이 코드·기존 spec 서술(`1-data-model.md:474`, `error-codes.ts` 자체 docstring)과 값 수준까지 일치함을 확인했다.

- **[INFO]** 계획 문서 명명 유사 쌍(`spec-draft-error-codes.md` vs `spec-draft-error-code-two-surfaces.md`)은 충돌이 아니라 정상 컨벤션
  - target 신규 식별자: `plan/in-progress/spec-draft-error-code-two-surfaces.md` (파일 경로)
  - 기존 사용처: `plan/complete/spec-draft-error-codes.md` (2026-06-02, `error-codes.md` 문서 자체를 신설한 완료 draft)
  - 상세: 이름이 유사해 얼핏 중복처럼 보이나, 전자는 이번 §Overview 병기 세션의 `--spec` 산출물이고 후자는 그 문서를 애초에 만든 완료된 별개 작업이다. `spec-draft-<주제>` 는 `--spec` 세션 산출물을 세션 종료 후에도 보존하는 harness 컨벤션(commit `a0e6034e2`)이며, 부모 트래커(`spec-conventions-engine-error-code-surface.md`, in-progress)와 짝을 이루는 것도 정상 패턴(다른 in-progress 항목 2건도 동형).
  - 제안: 조치 불필요.

## 요약

target 이 spec 에 새로 들여오는 유일한 이름(`EngineErrorCode`)은 이미 코드에 존재하고 값 수준
disjoint 가 테스트로 고정돼 있으며, 관련 값들이 `spec/1-data-model.md:474` 에 이미 병기돼 있어
target 의 §Overview 서술과 정합한다. 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·설정키는
전혀 도입되지 않으며, 대상 파일 경로도 기존 명명 컨벤션(`spec-draft-<주제>`)을 그대로 따른다.
CRITICAL/WARNING 레벨 신규 식별자 충돌은 발견되지 않았다.

## 위험도
NONE
