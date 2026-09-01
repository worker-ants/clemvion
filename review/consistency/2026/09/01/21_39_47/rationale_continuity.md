# Rationale 연속성 검토 — `error-codes.md` §Overview 두 surface 병기 (spec draft, 2차)

## 검토 방법

프롬프트 번들의 "관련 Rationale 발췌"는 `spec/1-data-model.md`·`spec/5-system/4-execution-engine.md` 두 건은
전문이 실렸으나 그 외 다수 파일(`spec/conventions/error-codes.md` 자신 포함, `spec/5-system/3-error-handling.md`
등)은 컨텍스트 예산 초과로 절단돼 있었다. 아래 문서를 로컬 파일시스템에서 직접 읽어 대조했다:

- `spec/conventions/error-codes.md` (변경 대상 원문 + §5 Rationale) — worktree `easy-a-harness-hygiene`
- `plan/complete/exec-intake-followups.md` ARCH#5 ⑤ (target 이 인용하는 "형태의 의식적 이탈" 유보의 원문)
- `plan/in-progress/spec-conventions-engine-error-code-surface.md` (이 draft 를 planner 턴으로 지정한 driving plan, 2026-09-01 체크리스트 포함)
- `spec/1-data-model.md` §Execution 컬럼 표(`:474`) / `Execution.error ↔ NodeExecution.error` 관계 표
- `spec/5-system/3-error-handling.md` §Rationale (전문 — 번들 절단분 보강)
- **선행 라운드**: `review/consistency/2026/09/01/21_30_10/{cross_spec,plan_coherence,rationale_continuity}.md`
  — target 이 자신의 Rationale/변경 제안에서 직접 인용하는 "`--spec` `21_30_10`" 근거

## 선행 라운드 대비 변경분 확인

`21_30_10` 라운드가 낸 WARNING 2건(cross_spec) + WARNING 1건(plan_coherence)을 이번 target 이 어떻게
반영했는지 원문 대조로 확인했다 — **셋 다 정확히, 날조 없이 반영됐다**:

1. **cross_spec WARNING #1**("`Execution.error`가 두 code family 를 공존시키는데 초판이 emitter 축으로만
   서술")→ target `## 변경 제안` 이 `ErrorCode` bullet 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 예시(엔진이 쓰는
   `ErrorCode`)를 추가하고 "가르는 축은 **누가 쓸 수 있는가**" 로 재정의했다. `data-model.md:474` 의
   "엔진 인프라 차원의 코드" 열거(`SERVER_INTERRUPTED`·`WORKER_HEARTBEAT_TIMEOUT`·
   `EXECUTION_TIME_LIMIT_EXCEEDED`·`RESUME_*`)와 대조한 결과, target 의 새 이분법은 이 갭을 정확히
   닫는다 — `EXECUTION_TIME_LIMIT_EXCEEDED` 는 실제로 `error-codes.ts:73` 상 `ErrorCode` 소속이고
   target 은 정확히 그렇게 분류한다.
2. **cross_spec WARNING #2**(2026-06-14 "중앙 enum 확장" 결정과의 scope 경계 부재) → target 신설
   "### 범위 한정 — 일반 원칙 선언이 아니다" 절이 "지금 존재하는 4종을 사후 문서화할 뿐, 향후 신규
   엔진 코드가 어느 쪽으로 가야 하는지는 말하지 않는다" 로 명시 경계를 그었다.
3. **plan_coherence WARNING**("판단 기준" 질문 무응답 + "노출 경계가 다르기 때문" 으로 ARCH#5 ⑤ 의 유보를
   평평하게 만듦) → target 이 ARCH#5 ⑤ 원문을 인용문으로 직접 옮기고("형태의 의식적 이탈이다 … 해석의
   여지가 있다는 사실 자체를 여기 남긴다"), 신설 "## 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다" 절에서
   plan_coherence 제안 (b)("지금은 병기만 하기로 명시적으로 결정하고 근거를 남긴다")를 정확히 이행했다.
   driving plan(`spec-conventions-engine-error-code-surface.md:36-44`, 2026-09-01 체크됨)의 문구와
   target 의 문구가 논리·순서까지 일치 — 새로 지어낸 근거가 아니라 실제로 그 plan 에서 먼저 결정된
   내용을 옮긴 것으로 확인됐다.

## 발견사항

이번 라운드에서 **CRITICAL/WARNING 없음**. 아래는 완전성 보강 제안(INFO)이다.

- **[INFO]** "판단 기준 유보"의 재개 조건이 target 문서에는 없음
  - target 위치: `## 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다` 절
  - 관련 출처: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 체크리스트 —
    *"재개 신호: 세 번째 자매 const 가 생길 때(그때는 형태가 관례가 되므로 기준이 필요해진다)."*
  - 상세: target 은 "이번에는 안 쓴다"는 결정과 순서 근거는 잘 옮겼으나, 그 유보를 **언제 다시 열지**의
    조건(재개 신호)은 driving plan 체크리스트에만 있고 spec draft 자체에는 없다. `error-codes.md` 는
    canonical 규약 문서이고 driving plan 은 완료 후 `plan/complete/` 로 이동해 참조 빈도가 낮아지므로,
    다음에 이 유보를 여는 사람이 규약 문서만 보고 "언제 재론해야 하는가"를 놓칠 여지가 약간 있다.
  - 제안: 필수는 아니나, "## 판단 기준은 이번에 안 쓴다" 절 말미에 재개 신호(세 번째 자매 const 발생
    시) 한 줄을 포인터로 남기면 유보의 생애주기가 규약 문서 자체에서도 추적 가능해진다.

- **[INFO]** ARCH#5 ⑤ 의 완화 요인(mitigating factor) 생략은 안전한 방향이나 명시하면 더 견고함
  - target 위치: `## Rationale` "왜 자매 const 인가" 절의 ARCH#5 ⑤ 인용 블록(생략 부호 `…` 사용)
  - 관련 출처: `plan/complete/exec-intake-followups.md:89-92` — *"⚠️ 완화 요인도 적어 둔다 — 그 결정의
    표제는 'Continuation ack client-safe typed error' 로 WS ack 경계 코드에 한정된 맥락일 수 있다…"*
  - 상세: target 의 인용은 "의식적 이탈"·"해석의 여지" 부분만 옮기고 이 완화 요인 문장은 생략했다.
    이는 유보를 실제보다 가볍게 읽히게 하는 방향이 아니라 오히려 더 무겁게(경계를 좁히지 않는 쪽으로)
    다루는 생략이라 위험은 낮다. 다만 완전성 차원에서, 이 완화 요인까지 함께 인용하면 "왜 그럼에도 이
    형태를 택했는가"의 근거가 규약 문서에서도 자기완결적으로 읽힌다.
  - 제안: 선택 사항. 지금 상태로도 안전측 생략이라 반영을 강제할 필요는 없다.

## 그 외 확인 — 문제 없음

- **기각된 대안 재도입 없음**: 2026-06-14 결정이 기각한 것은 `EXEC_*` prefix(값 레벨)이며, target 은
  값을 하나도 바꾸지 않는다(순수 §Overview 서술 추가). `EngineErrorCode` 자체는 이 draft 가 신설하는
  것이 아니라 `exec-intake-followups.md` ARCH#5(2026-08-31 완료)에서 이미 코드에 존재하며, target 은
  그 기존 사실을 문서화할 뿐이다.
- **합의된 원칙 위반 없음**: "파일은 하나, const 는 둘" (SoT 단일성) 원칙을 target 이 그대로 보존한다 —
  §Overview 서술도 두 const 가 "같은 파일의 자매 const" 임을 명시해 SoT 분리를 시사하지 않는다.
- **결정의 무근거 번복 없음**: target 자신이 "이 병기는 2026-06-14 결정과 경쟁하지 않는다"를 반복
  강조하고, 그 근거(사후 문서화 vs 향후 지침 분리)를 §Rationale·§범위 한정 두 곳에 명시했다 — 번복이
  아니라 **번복하지 않는다는 근거를 남기는** 문서다.
- **암묵적 가정 충돌 없음**: `data-model.md` 의 "Execution.error 는 두 code family 공존" 서술과 target
  의 "누가 쓸 수 있는가" 이분법이 실측(코드 라인)과 정합함을 확인했다 — 새로 검증한 `EXECUTION_TIME_LIMIT_EXCEEDED`
  사례가 정확히 이 이분법을 만족한다.
- **인용 정확성**: ARCH#5 ⑤·driving plan·`21_30_10` 세 라운드에 대한 target 의 모든 인용/참조가 원문과
  대조해 정확했다 — 지어낸 "기각된 대안"이나 근거 오귀속은 발견되지 않았다.

## 요약

이 target 은 `21_30_10` 라운드가 낸 WARNING 3건(cross_spec 2 + plan_coherence 1)을 모두 원문 근거를
정확히 인용해 반영한 2차 개정본이다. 2026-06-14 "신규 코드는 중앙 `ErrorCode` 확장" 결정을 재도입하지도
번복하지도 않고, `EngineErrorCode` 병기가 그 결정과 경쟁하지 않는 범위(기존 4종의 사후 문서화)임을
명시적으로 경계 지었다. ARCH#5 ⑤ 가 남긴 "형태의 의식적 이탈"·"해석의 여지" 유보를 평평하게 만들지 않고
원문 그대로 규약 문서 Rationale 에 옮겼으며, driving plan 이 요구한 "판단 기준을 함께 적을지" 질문에도
"이번에는 안 쓴다"는 명시적 결정과 순서 근거(유보 중인 형태를 규약 기준으로 승격시키지 않는다)로 답했다.
CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았고, 남은 항목은 완전성 보강 수준의 INFO 2건뿐이다.

## 위험도

LOW
