# 신규 식별자 충돌 검토 — `plan/in-progress/spec-update-assistant-masking.md`

## 검토 방법

target 은 **새 식별자를 도입하지 않는** 유형의 planner 턴이다 — 기존 요구사항 `ED-AI-37`(spec/3-workflow-editor/4-ai-assistant.md)과 기존 §R17 "잔여 ③"(spec/5-system/14-external-interaction-api.md)의 **서술을 개정**하는 것이 전부다. 그래서 점검의 초점을 "target 이 참조/도입하는 각 이름이 기존 사용처와 의미가 다른가"에 맞추고, 아래를 직접 열어 실측했다:

- `spec/3-workflow-editor/4-ai-assistant.md` (§4.1.1, PRD 매핑 §14, Rationale 헤더 목록)
- `spec/5-system/14-external-interaction-api.md` (§R17, "잔여 ③" 본문 및 인접 결정 로그)
- `spec/conventions/egress-masking.md` (2026-08-22 신설된 마스킹 좌표계 SoT)
- `codebase/packages/masked-markers/src/index.ts` (`VALUE_MASK_MARKER` 등 마커 상수 SoT)
- `spec/` 전역 `deepRedactSecrets` / `maskSensitiveFields` / `ED-AI-37` / "잔여 ③" grep
- `plan/in-progress/` 기존 `spec-update-*`/`spec-sync-*`/`spec-draft-*` 파일명 목록

## 발견사항

없음 (CRITICAL/WARNING 없음). 아래는 확인 결과를 근거로 한 판단 메모 (INFO 1건):

- **[INFO]** `deepRedactSecrets` 소비처 표(egress-masking.md §1 표 2행)가 신규 소비처를 아직 열거하지 않음
  - target 신규 식별자 아님 — `deepRedactSecrets` 자체는 기존 심볼 재사용
  - 기존 사용처: `spec/conventions/egress-masking.md:45` 표 2행이 `deepRedactSecrets` 의 소비처를 "REST 응답·저장 에러·conversation thread"로 **열거**하고 있고, `explore-tools.service.ts`(workflow-assistant 도구)는 그 열거에 없음
  - 상세: target 의 자매 developer plan(`assistant-mask-leak.md`)이 `explore-tools.service.ts` 에 `deepRedactSecrets` 를 새로 중첩 적용한다. 심볼 자체는 충돌이 아니지만(같은 함수, 같은 의미로 재사용 — 오히려 바람직), 좌표계 SoT 문서의 소비처 열거가 이 신규 호출부를 반영하지 못하면 문서-코드 drift 후보가 된다. `egress-masking.md` §3 은 "표가 낡는 진짜 조건은 마스커가 늘거나·합쳐지거나·상한/연산자가 바뀌는 것"이라고 명시적으로 좁혀 뒀으므로(호출부 추가만으로는 stale 트리거가 아니라고 스스로 선언) 이 자체는 그 문서의 정의상 의무 사항은 아니다. 다만 target 의 `spec_impact` 목록에 `egress-masking.md` 가 없어, 소비처 표를 갱신할지 여부를 판단할 기회가 이번 PR 에서 열리지 않는다.
  - 제안: 필수는 아니지만, planner 턴에서 `egress-masking.md` 표 2행 소비처 열에 `explore-tools.service.ts` 를 추가하는 1줄 갱신을 함께 검토할 가치가 있다. (naming collision 자체는 없으므로 차단 사유는 아님.)

## 긍정 확인 (참고용 — 충돌 아님)

- **포맷 `"***"` 은 신규 리터럴이 아니라 기존 SoT 상수와 정확히 일치한다** — `codebase/packages/masked-markers/src/index.ts` 의 `VALUE_MASK_MARKER = "***"`. target 이 spec §4.1.1 을 `"***"` 로 고치는 것은 **이미 코드 전역(EIA §R17, egress-masking.md, `deepRedactSecrets`)에서 쓰이는 값과 spec 을 맞추는 것**이라 오히려 충돌 해소 방향이다.
- **`ED-AI-37`** 은 target 이 새로 부여하는 ID 가 아니라 `spec/3-workflow-editor/4-ai-assistant.md:789`·`_product-overview.md:237`·`assistant-mask-leak.md` 가 이미 참조 중인 기존 ID의 본문 개정이다. 다른 의미로 쓰인 곳 없음(전역 grep 3곳 모두 동일 요구사항 지칭).
- **§R17 "잔여 ③"** 텍스트(`spec/5-system/14-external-interaction-api.md:1652`)는 유일한 정의 위치이며, 이를 인용하는 다른 문서(`plan/complete/eia-internal-rest-error-masking.md`, `plan/complete/spec-draft-eia-fanout-masking.md`)는 모두 완료된 archive 이거나 동일 문구 재인용이라 헤딩 anchor 충돌 없음.
- **파일 경로** `plan/in-progress/spec-update-assistant-masking.md` 는 기존 `spec-update-node-cancellation-shutdown-classification.md` 와 동일한 `spec-update-<topic>.md` 명명 컨벤션을 따르고, 동명 파일 없음.
- **`DEFAULT_SENSITIVE_KEYS`/`CREDENTIAL_KEY_PATTERN`** — target 본문에 직접 등장하진 않지만 자매 plan 경유로 언급된 이 심볼들도 이미 `spec/5-system/14-external-interaction-api.md:1648` 에 정의된 기존 SoT 이름이며 충돌 없음.
- API endpoint · webhook/queue/SSE 이벤트명 · ENV var/config key — target 은 이들 중 어느 것도 신규 도입하지 않는다(순수 서술 개정).

## 요약

target 은 신규 식별자를 사실상 도입하지 않고 기존 요구사항 ID(`ED-AI-37`)와 기존 열린 결정(§R17 잔여 ③)을 개정·확정하는 planner 턴이다. 실측 결과 target 이 언급/재확인하는 모든 심볼(`ED-AI-37`, `deepRedactSecrets`, `maskSensitiveFields`, `"***"`/`VALUE_MASK_MARKER`)은 이미 동일한 의미로 spec·convention·code 전역에서 일관되게 쓰이고 있어 충돌이 없으며, 오히려 spec 서술을 기존 코드/컨벤션 SoT 값과 일치시키는 방향이다. 파일 경로도 기존 명명 컨벤션을 따른다. 유일한 참고 사항은 `egress-masking.md` 소비처 표가 신규 호출부(`explore-tools.service.ts`)를 아직 반영하지 않는다는 점인데, 이는 충돌이 아니라 완결성 보완 제안(INFO)이다.

## 위험도

NONE
