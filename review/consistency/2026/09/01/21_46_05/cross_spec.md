# Cross-Spec 일관성 검토 — `spec-draft-error-code-two-surfaces.md`

## 발견사항

- **[WARNING]** "층(layer)" 이분법이 실제 const 멤버십·카탈로그 조직과 정확히 대응하지 않아 오독 위험이 있다
  - target 위치: `## 변경 제안` 절, "`ErrorCode` — **노드 핸들러 층**의 대표 surface" / "`EngineErrorCode` — **엔진 층**의 대표 surface" 두 불릿
  - 충돌 대상: `spec/1-data-model.md` §2.13 `Execution.error` 필드 설명("각 노드 핸들러가 정의 **외에** 엔진 인프라 차원의 코드를 포함한다 — `SERVER_INTERRUPTED`, `WORKER_HEARTBEAT_TIMEOUT`, `EXECUTION_TIME_LIMIT_EXCEEDED`, `RESUME_FAILED`/`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE`") + `spec/5-system/3-error-handling.md` §1.4 "엔진 수준 에러" 표 + `codebase/backend/src/nodes/core/error-codes.ts` 실제 const 정의
  - 상세: 실측(`error-codes.ts`)으로 확인한 실제 멤버십은 다음과 같다.
    - `EngineErrorCode` (4종): `EXECUTION_QUEUE_WAIT_TIMEOUT`, `WORKER_HEARTBEAT_TIMEOUT`, `SERVER_INTERRUPTED`, `WEBCHAT_IDLE_TIMEOUT`
    - `ErrorCode` 안에도 "엔진/WS-ack 레벨" 코드가 여럿 섞여 있다: `EXECUTION_TIME_LIMIT_EXCEEDED`(코드 주석 자신이 "Execution Engine — engine-level limits"라고 명명), `EXECUTION_INTERNAL_ERROR`/`EXECUTION_MESSAGE_TOO_LONG`/`EXECUTION_ENQUEUE_FAILED`(주석: "not a node `output.error.code`, but live here so canonical code strings have one source of truth"), `RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY`(WS ack nested `error` 객체용, 노드 output 아님)
    - `RESUME_FAILED`/`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 는 **둘 중 어느 const 에도 없다** — `RehydrationError.code` 리터럴 유니온(또는 `RESUME_FAILED` 는 앵커 없는 bare string)으로 별도 관리된다(`error-codes.ts` `EngineErrorCode` JSDoc "여기 있는 것 / 없는 것" 문단이 이 셋을 명시적으로 "옮기지 않았다"고 적는다)

    즉 `1-data-model.md` 가 `Execution.error` 필드에서 하나로 묶어 "엔진 인프라 차원의 코드"라 부르는 6개 코드 중 실제 `EngineErrorCode` 멤버는 2개(`SERVER_INTERRUPTED`, `WORKER_HEARTBEAT_TIMEOUT`)뿐이고, 1개(`EXECUTION_TIME_LIMIT_EXCEEDED`)는 `ErrorCode`, 3개(`RESUME_*`)는 제3의 앵커(`RehydrationError.code`)다. `3-error-handling.md` §1.4 "엔진 수준 에러" 표도 이 6개+α 를 const 구분 없이 flat 하게 나열한다(카탈로그의 조직 원칙은 "발행 주체(const)"가 아니라 "트리거 도메인"이다).

    target 이 §Overview 에 `ErrorCode`="노드 핸들러 층", `EngineErrorCode`="엔진 층" 이라는 **새 공식 이분법 용어**를 처음 도입하면, 이미 존재하는 `1-data-model.md`/`3-error-handling.md` 의 "엔진 (수준/인프라) 코드"라는 느슨한 서술과 이 새 이분법을 나란히 읽는 사람이 "그 6개는 전부 `EngineErrorCode` 멤버겠지"라고 추론할 위험이 크다 — 실측상 4/6 이 틀린 추론이다. target 초판이 정확히 이 함정("EngineErrorCode 가 `Execution.error`·`NodeExecution.error` 에 싣는다")에 빠졌었고 1차 라운드가 그것을 반박했는데, 이번 최종안은 필드 매핑 문장은 뺐지만 **"층" 명명 자체**는 남아 있어 같은 오독을 다른 경로(용어 유추)로 다시 유발할 수 있다
  - 제안: §Overview 병기 불릿에 한 문장만 추가 — 예) "두 const 의 경계는 **누가 코드를 발행하는가**(node handler vs 엔진 자신) 기준이며, 카탈로그의 '엔진 수준 에러' 분류(`3-error-handling.md §1.4`)나 `1-data-model.md` `Execution.error` 서술의 '엔진 인프라 차원' 이라는 표현과 1:1 대응하지 않는다(`ErrorCode` 에도 `EXECUTION_TIME_LIMIT_EXCEEDED`·WS-ack 코드가 섞여 있다)." `1-data-model.md` 를 다시 열 필요는 없다 — 병기 문구 자체에 한 clause 만 넣으면 해소된다

- **[INFO]** 조립 프롬프트 번들이 `spec/conventions/**` 전체 및 `3-error-handling.md`·`4-execution-engine.md` 본문을 예산 초과로 누락함(플레이스홀더만 존재)
  - target 위치: N/A (harness 산출물 — `_prompts/cross_spec.md` 조립 결과)
  - 충돌 대상: `_prompts/cross_spec.md` 라인 1155~1162 등 "⚠️ 본문 생략됨 — 컨텍스트 예산 초과" 플레이스홀더, 그리고 `spec/conventions/*.md` 전체가 파일 목록에서조차 등장하지 않음(생략 표시조차 없이 완전 누락)
  - 상세: target 이 직접 편집하는 `spec/conventions/error-codes.md` 자신과, target 이 위임처로 지목하는 `spec/5-system/3-error-handling.md §1`, 그리고 범위-한정 근거로 인용하는 `spec/5-system/4-execution-engine.md` 세 곳 모두 이번 번들에서 실질적으로 비어 있었다. 이번 리뷰는 저장소 파일을 직접 열람해 보완했지만(기존 known issue — `feedback_consistency_spec_mode_budget`), 번들만 보는 향후 라운드는 이 판단을 재현하지 못할 수 있다
  - 제안: 새 spec-impact 항목이 아니라 harness 쪽 known issue 추적(이미 메모리에 기록됨) — 본 라운드에서는 실제 파일 열람으로 갭을 메웠음을 SUMMARY 에 남겨 재작업 방지

## 요약

target 의 핵심 사실 주장("파일은 하나, const 는 둘", 키 비중첩)은 `codebase/backend/src/nodes/core/error-codes.ts` 및 `error-codes.spec.ts` 실측과 정확히 일치하고, 위임처로 지목한 `3-error-handling.md §1.4/§1.5` 도 실제로 코드→전이 매핑을 이미 상세히 보유하고 있어 "목적지는 카탈로그 SoT 에 맡긴다"는 결정은 근거가 튼튼하다. `5-system/4-execution-engine.md` 의 2026-06-14 결정("신규 client-safe 코드는 `ErrorCode` 의 `EXECUTION_*` 네임스페이스 확장")도 continuation-ack 코드에 국한된 것이라 target 의 "이 병기는 향후 방향을 말하지 않는다"는 범위 한정과 상충하지 않는다. 유일한 실질 리스크는 새로 도입하는 "층(node-handler 층 / 엔진 층)" 이분 명명이, 이미 존재하는 `1-data-model.md`/`3-error-handling.md` 의 느슨한 "엔진 (수준/인프라) 코드" 서술과 겹쳐 읽혀 const 멤버십을 오추론시킬 수 있다는 점이다(실측상 6개 중 4개가 그 오추론과 다른 소속). 이는 한 문장 clause 로 해소 가능한 WARNING 이며, `1-data-model.md` 재개봉은 불필요하다.

## 위험도

LOW
