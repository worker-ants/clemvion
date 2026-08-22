# Cross-Spec 일관성 검토 — `spec/4-nodes/7-trigger/`

## 검토 범위 확인

`git diff origin/main...HEAD --stat` 실측 결과, 이 PR 이 건드리는 코드/스펙 파일은
**`codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts`
(+43줄, 캐너리 테스트 1건 추가) 단 하나**다. `spec/**` 파일은 이 diff 에 포함되지 않았다
(plan 문서 `spec_impact: none` 과 일치). 즉 target 으로 제시된 `spec/4-nodes/7-trigger/`
번들은 **이 PR 이 새로 쓴 내용이 아니라 이미 `origin/main` 에 정착된 기존 상태**이며, 이
PR 은 그 상태가 서술하는 동작(`masked_value_resubmitted` 의 raw-우선 + resolve-후-재검사
2단계, "무관한 필드의 coerce 실패가 ② 를 선점한다"는 알려진 트레이드오프)을 테스트로
기계에 고정하는 작업이다. 따라서 본 검토는 (a) 신규 테스트가 주장하는 동작이 cross-spec
SoT 와 모순되지 않는지, (b) target 번들이 인용하는 타 영역 spec(EIA §R17, webhook §5.2,
error-handling §1.7/§4.2, error-codes §5, replay-rerun §8.1/§10.2, data-model §2.13/§2.14)
과 지금도 정합한지를 확인했다.

## 확인한 교차 참조 (전부 정합)

- **EIA `spec/5-system/14-external-interaction-api.md` §R17** — Manual 실행 경로 2곳
  (`POST /workflows/:id/execute`, `POST /executions/:id/re-run`)이 `resolveTriggerParameters`
  base 가 아니라 wrapper `resolveTriggerParametersRejectingMasked` 를 호출하고, webhook·
  schedule 은 대상이 아니라는 서술이 target(`1-manual-trigger.md` §6)과 코드 배치
  (`execution-engine/utils/reject-masked-resubmission.ts`)까지 정확히 일치.
- **`spec/5-system/12-webhook.md` §5.2** — `toTriggerParameterErrorDetails` 가
  `INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED` 를 매핑하되 webhook 런타임 경로에서는
  발생하지 않는다는 서술이 target 의 판정 기준("페이로드의 저작 주체")과 일치.
- **`spec/5-system/3-error-handling.md` §1.7, §4.1/§4.2** — Manual 세 경로(실행·저장·
  re-run)가 동일 헬퍼로 `INVALID_TRIGGER_PARAMETERS` 봉투를 내고, re-run 이 그 목록에
  들어온 시점(2026-08-20, 배선 교정)과 `error.code` 자체가 통일된 시점(2026-08-22, #1193)
  이 서로 다른 사건이라는 이력이 `spec/5-system/13-replay-rerun.md` §8.1 의 Rename 각주
  ("2026-08-22 이전에는 `INVALID_INPUT`")·`spec/conventions/error-codes.md` §5 Rename
  이력 표(`INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS`, 등급 B)와 정확히 맞물린다.
  최초 언뜻 두 날짜가 같은 사건을 다르게 적은 것처럼 보였으나 실측 결과 서로 다른
  두 단계(배선 교정 vs 코드명 통일)를 가리키는 것으로 확인 — 모순 아님.
- **`spec/1-data-model.md` §2.13/§2.14** (`Execution.input_data`/`NodeExecution.input_data`) —
  "2026-08-20 이전에는 카브아웃, 프런트 마커 가드+서버 2층 거부가 서며 해소" 서술이
  EIA §R17 잔여②의 이력과 정확히 대응.
- **신규 테스트 자체** — import 하는 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/
  `DEPTH_MASK_MARKER`/`MAX_REDACT_DEPTH` 는 `shared/utils/sanitize-error-message.ts` 를
  거치는데, 해당 파일은 `@workflow/masked-markers` 재export shim으로 확인됨 — EIA §R17
  "마커 집합·깊이 상한의 SoT 는 공유 패키지 `@workflow/masked-markers`(2026-08-21 이관)"
  서술과 일치. 새 캐너리가 구 미러 정의를 참조하는 drift 는 없음.
- 테스트의 docstring 이 서술하는 트레이드오프("무관한 필드의 진짜 coerce 오류가 마커
  안내를 선점 — 보안 우회가 아니라 안내가 한 왕복 늦어지는 UX 엣지케이스")는
  `1-manual-trigger.md` §Rationale "`masked_value_resubmitted` 검사 시점 — raw 우선 +
  resolve 후 재검사"와 문장 단위로 대응하며 새로운 계약을 주장하지 않는다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 미발견). 이 PR 은 spec 을 변경하지 않고, 기존
spec 이 이미 명시한 동작을 회귀 테스트로 고정할 뿐이며, 그 서술이 참조하는 타 영역
spec(EIA/webhook/error-handling/error-codes/replay-rerun/data-model) 은 상호 정합했다.

## 요약

target 으로 제시된 `spec/4-nodes/7-trigger/` 번들은 이번 PR 의 신규 산출물이 아니라
기존에 정착된 상태이고, 실제 diff 는 `masked_value_resubmitted` 2단계 검사의 알려진
트레이드오프를 캐너리 테스트로 고정하는 것뿐이다(`spec_impact: none`). 이 트레이드오프에
대한 target 의 서술(raw 우선 + resolve 후 재검사, base/wrapper 분리, Manual 경로 한정)과
새 테스트의 단언은 EIA §R17·webhook §5.2·error-handling §1.7/§4.2·error-codes §5·
replay-rerun §8.1/§10.2·data-model §2.13/§2.14 전체와 교차 검증했으며 모순을 찾지 못했다.
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 충돌 신호가
없다.

## 위험도

NONE
