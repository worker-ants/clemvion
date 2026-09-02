# Plan 정합성 검토 — `spec-draft-error-code-two-surfaces.md`

## 검토 개요

target 은 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단에 `EngineErrorCode` 를
두 번째 대표 surface 로 층(layer) 기반 병기하는 spec draft다. 착수 근거 plan
`plan/in-progress/spec-conventions-engine-error-code-surface.md`, 그 상위 이력
`plan/complete/exec-intake-followups.md` ARCH#5 ⑤, 그리고 `error-codes.md` 를 참조하는 다른
in-progress plan(`spec-update-node-cancellation-shutdown-classification.md` 등)과 대조했다.
직전 라운드(`21_36_28`)의 plan_coherence 가 이미 "다른 in-progress plan 과의 충돌 없음"을
확인해 뒀으므로, 이번 라운드는 그 확인 이후 target 에 새로 추가된 두 문단
(`재개 신호는 "세 번째 자매 const 가 생길 때"다 …` / `다른 문서의 선재 drift 는 여기서 안
고친다 …`)에 집중했다.

## 발견사항

- **[WARNING]** "재개 신호" 판단에 필요한 새 사실(`WsErrorCode` 선재)이 target 이 스스로 지정한
  SoT 인 착수 근거 plan 에 반영돼 있지 않다
  - target 위치: target 문서 `### 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다` 문단의
    `**재개 신호는 "세 번째 자매 const 가 생길 때"** 다 … (`WsErrorCode` 가 그 세 번째인지는
    재개 시점에 함께 판정한다.)`
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 체크리스트
    `[x] "판단 기준을 함께 적을지" 에 대한 답 (2026-09-01)` 항목 — `재개 신호: 세 번째 자매
    const 가 생길 때(그때는 형태가 관례가 되므로 기준이 필요해진다).` (line 54, `WsErrorCode`
    언급 없음)
  - 상세: target 은 바로 위 문장에서 "**이 결정의 SoT 는 착수 근거 plan** 이다 … 같은 결정을
    두 문서에 나란히 적으면 한쪽만 갱신되는 자리가 생긴다" 고 명시적으로 원칙을 세워 두고도,
    그 직후 자신이 새로 발견한 `WsErrorCode` 후보 정보는 SoT 로 지정한 plan 에 반영하지 않고
    이 draft 에만 적었다. `plan/`·`spec/` 전수 grep 결과 `WsErrorCode 가 그 세 번째인지`
    언급은 이 target 문서 한 곳뿐이다(`grep -rn "WsErrorCode" spec/ plan/` 확인). 이 draft 가
    spec 반영 후 `plan/complete/` 로 옮겨지면, 착수 근거 plan(계속 in-progress 로 남아 다른
    체크리스트 항목을 추적)만 남아 이 단서가 소실된다.

    더 나아가 실측 결과 이 단서는 무게가 가볍지 않다: `WsErrorCode`(`ws-error-codes.ts`)는
    `EngineErrorCode`(2026-08-31 신설)보다 **7주 이상 앞선 2026-07-07(`daaae64c2`, #843)에
    이미 신설**돼 central `ErrorCode` 를 확장하지 않고 별도 top-level const 를 만든 선례다.
    `EngineErrorCode` 의 JSDoc 자신도 "그래서 WS ack 용 `RETRY_*` 도 여기 산다"(추가 파일
    분리를 피한 이유)라고 `WsErrorCode` 류의 존재를 이미 인지하고 있다. 즉 "central enum
    확장 vs 자매 const 신설" 이라는 질문 자체는, ARCH#5 ⑤ 가 유일한 대조군으로 인용한
    `RETRY_*`(central 유지) 사례 말고도 이미 한 번 더 판정된 적이 있다(`WsErrorCode`,
    자매 const 채택) — 다만 별도 파일이라 ARCH#5 ⑤ 의 "같은 파일 안에서" 프레이밍 밖에 있어
    선례 목록에서 빠졌다. "세 번째 자매 const" 라는 문구를 "central 확장이 아닌 별도 코드값
    컨테이너" 로 넓게 읽으면 `EngineErrorCode` 자신이 이미 그 세 번째이고, 재개 신호는
    미래형이 아니라 **이미 충족된 상태**일 수 있다.
  - 제안: 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`)의 해당 체크리스트
    항목에 `WsErrorCode` 선재 사실(도입 시점 `daaae64c2`/#843, 별도 파일)과 "세 번째 자매
    const" 정의(같은 파일 한정인지 여부)의 모호성을 추가해, 재개 판정 시점에 이 draft 를 다시
    열지 않고도 판단할 수 있게 한다. target 문서 자체를 지금 더 손댈 필요는 없다 — SoT 쪽
    갱신이 더 싸고 target 의 "SoT 는 착수 근거 plan" 원칙과도 부합한다.

- **[INFO]** (직전 라운드 `21_36_28` 대비 변화 없음, 캐리오버) 두 plan 의 종결 동기화 절차가
  여전히 명시돼 있지 않다
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md` 전체
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` "## 할 일"
    체크리스트 1번째 항목(`§Overview … 두 surface 병기`) — 아직 `[ ]`
  - 상세: draft → `--spec` 검토 → spec 반영이라는 현재 흐름 자체는 정상이나, spec 반영 커밋에서
    (a) 착수 근거 plan 체크리스트 1번째 항목을 `[x]` 로 갱신하고 (b) 남은 미해결 항목(후속
    선재 drift 2건)이 있으므로 두 plan 을 아직 `complete/` 로 옮기지 않는다는 점이 draft
    본문에 언급돼 있지 않다.
  - 제안: spec 반영 실행 시점에 착수 근거 plan 체크리스트를 갱신하되, 후속 항목이 남아있으므로
    `spec-draft-error-code-two-surfaces.md` 만 완료 처리하고 `spec-conventions-engine-error-code-surface.md`
    는 `in-progress/` 에 유지한다.

## 교차 검증 결과 (문제 없음으로 확인된 항목)

- **다른 in-progress plan 과의 충돌**: `error-codes.md` 를 참조하는 plan 5개
  (`spec-update-node-cancellation-shutdown-classification.md`, `auth-guard-reflection-hardening.md`,
  `spec-sync-external-interaction-api-gaps.md`, `cafe24-backlog-residual.md`,
  `spec-sync-websocket-protocol-gaps.md`)를 재확인했다 — 전부 §1/§3/§4/§5 를 다루며 target 이
  편집하는 §Overview "적용 범위" 문단과 겹치지 않는다.
- **신규 문단 "다른 문서의 선재 drift 는 여기서 안 고친다"**: `1-data-model.md:474`
  6종 나열·`3-error-handling.md §1.4` 10종 나열(named const 2종뿐) 서술은 실측과 일치하고,
  착수 근거 plan 체크리스트 3번째 항목(후속 planner 턴)에 정확히 같은 내용으로 이미 등재돼
  있다 — 중복 등재가 아니라 포인터 일치.
  - 후속 항목 자체는 착수 근거 plan 에 이미 `[ ]` 로 살아 있고 target 은 "고치지 않는다" 는
    범위 한정만 진술하므로 무효화·신규 생성 누락 없음.
- **"판단 기준은 이번에 안 쓴다" 결정**: 착수 근거 plan 체크리스트의 동일 날짜(2026-09-01)
  동일 결론과 정확히 일치 — 일방적 결정 아님. 재확인.
- **`WORKER_HEARTBEAT_TIMEOUT` 각주 근거**: §3 예외 레지스트리 행(`error-codes.md:70`)이
  실제로 `EngineErrorCode` 멤버를 다루고 있음을 코드 JSDoc(SoT 포인터 포함)으로 확인 — 왜곡 없음.

## 요약

target 이 새로 추가한 범위 한정 문단(선재 drift 2건 안 고침)은 착수 근거 plan 의 기존 후속
항목과 정확히 맞물려 있어 문제가 없다. 다만 같은 라운드에 새로 추가된 "재개 신호" 문단은
target 스스로 "SoT 는 착수 근거 plan" 이라 선언해 놓고, 그 SoT 에 없는 새 사실(`WsErrorCode`
가 `EngineErrorCode` 보다 7주 앞서 신설된 별도-const 선례)만 draft 에 적어 두었다 — 이 draft 가
`complete/` 로 옮겨지면 그 단서가 소실될 자리다. 이 사실은 "세 번째 자매 const" 재개 신호의
정의(같은 파일 한정 여부)에 따라 트리거가 이미 충족됐을 수도 있다는 무게를 가지므로, 착수 근거
plan 쪽에 동기화할 것을 권한다. 미해결 결정을 우회하는 CRITICAL 급 발견은 없다.

## 위험도

LOW
