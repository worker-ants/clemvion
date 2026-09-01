# Rationale 연속성 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 발견사항

- **[INFO]** §3 예외 레지스트리가 이미 `EngineErrorCode` 멤버를 포함하고 있다는 사실을 교차 인용하면 근거가 더 강해진다
  - target 위치: `## 변경 제안` (§Overview "적용 범위" 병기 문단)
  - 과거 결정 출처: `spec/conventions/error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 행 ("HTTP 무관 — 엔진 레벨 `error.code`")
  - 상세: `WORKER_HEARTBEAT_TIMEOUT` 은 실제로는 `ErrorCode` 가 아니라 `EngineErrorCode` 의 멤버인데(`codebase/backend/src/nodes/core/error-codes.ts:147` 부근), §3 표는 이를 "원칙(§1)을 따르지 않는 기존 코드" 예외로 이미 등재하고 있다. 즉 §3 은 이미 암묵적으로 `EngineErrorCode` 표면을 규율 범위 안으로 다루고 있었다 — target 이 §Overview 에 `EngineErrorCode` 를 명시 병기하려는 근거(§1 규율이 이미 이 표면에 적용되고 있었다는 사실)와 정확히 정합한다. 이 자체는 충돌이 아니라 **target 의 주장을 뒷받침하는 추가 증거**다.
  - 제안: §Overview 편집 시 "§3 의 `WORKER_HEARTBEAT_TIMEOUT` 행이 이미 `EngineErrorCode` 표면에 §1 규율을 적용해 온 선례" 를 각주로 걸면, 이 병기가 신규 확장이 아니라 **기존 실무의 명문화**임이 더 분명해진다 (선택 사항, 필수 아님).

- **[INFO]** 동일 결정("판단 기준은 이번에 안 쓴다")이 두 plan 문서에 중복 기록됨
  - target 위치: `## 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다`
  - 과거 결정 출처: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 체크리스트 `- [x] "판단 기준을 함께 적을지" 에 대한 답 (2026-09-01)`
  - 상세: 두 문서가 **같은 결정**("이번엔 병기만 하고 central-enum-vs-자매-const 기준은 쓰지 않는다")을 각자 독립 서술로 담고 있다. 내용은 상충하지 않으나(둘 다 "재개 신호: 세 번째 자매 const 발생 시"로 일치), 어느 쪽이 SoT 인지 불명확해 향후 한쪽만 갱신되면 drift 위험이 있다.
  - 제안: 두 문서 중 하나(착수 근거 `spec-conventions-engine-error-code-surface.md`)를 판단 기준의 SoT 로 정하고, target 은 "결정 근거는 착수 근거 plan 체크리스트 참고, 본 절은 그 결정을 실행에 반영하는 서술" 정도로 포인터화하면 중복 서술의 drift 위험이 사라진다. 이는 Rationale 무결성 자체를 해치지 않으므로 INFO.

## 요약

target 은 `ErrorCode`/`EngineErrorCode` 두 surface 병기를 제안하면서, 과거 Rationale 이력을 **정확히** 재인용한다 — 기각된 것은 `EXEC_*` 값 레벨 prefix(2026-06-14 결정, `spec/5-system/4-execution-engine.md:1800`)뿐이고 값은 한 글자도 바뀌지 않았다는 점, 그리고 `RETRY_*` 선례("레이어가 달라도 한 enum")와 `EngineErrorCode`(자매 const)가 형태상 어긋난다는 점을 `exec-intake-followups.md` ARCH#5 ⑤ 원문과 대조해 인용 오류 없이 재현했다(`git log -S` 필요 없이 원문과 직접 대조 확인). 가장 중요한 판단 — "central enum 확장 vs 자매 const 신설" 판단 기준을 이번 병기에 포함시키지 않기로 한 결정 — 도 **왜 안 쓰는지**(ARCH#5 ⑤ 가 스스로 "의식적 이탈·해석의 여지" 라 유보해 둔 상태를 규약으로 조기 승격시키면 그 유보가 안 보이게 된다)를 명시적으로 적어, 결정 번복이 아니라 유보 상태를 유보로 유지하는 신중한 선택으로 기록했다. §Overview 기존 서술("프로젝트 전체 적용")을 좁히지 않고 대표 surface 열거만 확장한다는 점도 실제 §3 예외 레지스트리가 이미 `EngineErrorCode` 멤버(`WORKER_HEARTBEAT_TIMEOUT`)를 다루고 있다는 사실과 정합한다. 기각된 대안의 재도입, 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다 — 오히려 Rationale 연속성을 모범적으로 지킨 사례다. 남는 것은 순수 plan-hygiene 성격의 경미한 중복 기록 두 건뿐이다.

## 위험도

LOW
