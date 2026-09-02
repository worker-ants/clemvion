# Plan 정합성 검토 — `spec-draft-error-code-two-surfaces.md`

## 검증 방법

`prompt_file` 번들의 `plan/in-progress/` 첨부는 컨텍스트 예산으로 대부분 절단돼 있어, 로컬
파일시스템에서 `plan/in-progress/` 전체를 `EngineErrorCode`/`ErrorCode`/`error-codes.md`/
`자매 const`/`central enum` 로 grep 해 관련 후보 10개 파일을 전수 확인했다(직전 라운드
`21_39_47` 과 동일 목록: `spec-update-node-cancellation-shutdown-classification.md`,
`auth-guard-reflection-hardening.md`, `spec-sync-websocket-protocol-gaps.md`,
`cafe24-backlog-residual.md`, `spec-sync-external-interaction-api-gaps.md`,
`expression-engine-error-shape-spec-broken-on-main.md`,
`spec-conventions-engine-error-code-surface.md`, `node-output-redesign/{cafe24,http-request}.md`,
target 자신). 새로 매치되는 plan 은 없었다.

**중요**: `prompt_file` 에 번들된 target 사본은 `21_39_47` 라운드가 검토한 버전과 현재 파일
사이의 중간 스냅샷으로, 실제 최신 파일에 있는 두 문단(“재개 신호는 세 번째 자매 const 가
생길 때… `WsErrorCode` 가 그 세 번째인지는 재개 시점에…” / “다른 문서의 선재 drift 는 여기서
안 고친다”)이 빠져 있었다. 번들이 아니라 `Read` 로 두 파일(target, driving plan)을 직접 열어
그 시점의 실제 내용을 기준으로 검토했다 — `review/consistency/2026/09/01/21_49_21/_target/`
스냅샷과 현재 파일이 diff 0 임을 확인해 안정 상태임을 확인했다.

## 발견사항

- **[WARNING]** driving plan 의 "할 일" 체크리스트 문구가 target 의 2차 개정으로 폐기된
  접근("목적지 필드 인라인 서술")을 여전히 지시하고 있다
  - target 위치: `## 변경 제안` 4번째 불릿 + `### 목적지 필드를 여기 안 쓰는 이유 — 두
    라운드가 반대로 가리켰다` 절 전체(현재 파일 기준 약 35~78행) — 결론은 "어느 코드가
    어느 필드에 실리는지는 카탈로그 SoT(`3-error-handling.md §1`)에 맡긴다", §Overview 에는
    **목적지 필드를 쓰지 않는다**.
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` §할 일
    첫 항목(31~34행, 아직 `[ ]`) — "`EngineErrorCode`(엔진이 싣는 `Execution.error`·
    `NodeExecution.error`)" 라고 **목적지 필드를 명시하라**는 지시문이 그대로 남아 있다.
  - 상세: target 의 Rationale 은 이 정확한 문구("`EngineErrorCode`가 두 필드에 싣는다")가
    **1차 `--spec`(`21_30_10`) cross_spec** 이 잡은 사실 오류(`EXECUTION_TIME_LIMIT_EXCEEDED`
    는 `ErrorCode` 소속인데도 `Execution.error.code` 로 실린다 — `Execution.error` 는 두
    family 가 공존)를 재생산한다고 스스로 적었고, 그래서 2차 개정에서 목적지 필드 서술
    자체를 뺐다. 그런데 이 결론을 이끈 driving plan 의 "할 일" 항목 원문은 아직 그 폐기된
    문구를 그대로 담고 있다. 이 항목은 unchecked 라 "실행 대기" 상태이므로, 나중에 이
    체크리스트 문구를 문자 그대로 따라 §Overview 를 작성하면 이미 두 라운드에 걸쳐 반증된
    표현이 되살아날 위험이 있다.
  - 제안: driving plan 31~34행을 target 의 최종 접근("층으로만 병기, 목적지는
    `3-error-handling.md §1` 로 위임")에 맞춰 갱신할 것. target 을 실제 spec 에 적용하는
    커밋에서 이 항목·`/consistency-check --spec` 항목 체크와 함께 반영하면 된다(별도 턴
    불요, 직전 라운드 INFO 가 이미 추적 중인 "적용 커밋에서 두 문서 동시 갱신" 절차에
    자연스럽게 편입 가능).

- **[INFO]** `WsErrorCode`·"인접 문서 선재 drift" 두 건은 이번 개정에서 이미 target·driving
  plan 양쪽에 일관되게 반영됨 — 확인 메모, 조치 불필요
  - target 위치: `### 판단 기준은 이번에 안 쓴다` 절의 "재개 신호…(`WsErrorCode` 가 그 세
    번째인지는 재개 시점에 함께 판정한다)" + "다른 문서의 선재 drift 는 여기서 안 고친다" 절
  - 관련 plan: `spec-conventions-engine-error-code-surface.md` §할 일의 "후속(별도 planner
    턴) — 인접 문서의 선재 drift 2건"(`1-data-model.md:474`, `3-error-handling.md §1.4`) —
    target 의 서술과 항목 범위·근거 라운드 표기(`21_39_47` cross_spec)가 정확히 일치한다.
  - 상세: 직전 라운드(`21_39_47`)가 낮은 확신의 INFO 로 남긴 `WsErrorCode` 포인터를 target
    이 그대로 흡수해 "재개 시점에 함께 판정" 으로 명문화했고, 같은 라운드의 cross_spec
    W1·W2(데이터모델 병기 서술의 삼분법 누락)도 driving plan 에 새 체크리스트 항목으로
    등재됐다 — 두 문서가 같은 근거로 동기화돼 있어 새로 열린 미해결 결정 충돌은 없다.
  - 제안: 없음.

## 요약

target 은 이미 3차례의 `--spec` 라운드를 거치며 driving plan(`spec-conventions-engine-error-code-surface.md`)이 요구한 유일한 미결 결정("판단 기준을 함께 적을지")과 인접 라운드가 지적한
사실 오류·SoT 중복 문제를 순차적으로 해소해 왔고, 이번 스냅샷에서도 두 문서(target·driving
plan) 사이에 새로 열린 결정 충돌이나 무효화된 선행 조건은 발견되지 않았다. 다만 target 이
2차 개정에서 폐기한 "목적지 필드 인라인 서술" 접근이 driving plan 의 미체크 "할 일" 항목
원문에는 아직 그대로 남아 있어, 이 문구를 문자 그대로 따라 적용하면 이미 반증된 서술이
되살아날 위험이 있다(WARNING 1건) — 적용 커밋 시점에 함께 정리하면 되는 낮은 blast-radius
항목이다.

## 위험도

LOW
