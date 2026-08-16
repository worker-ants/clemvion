# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 발견사항

- **[WARNING]** 신규 발견 잔여 갭 2건이 정본 트래커에 아직 등재되지 않았고, 그 등재 자체가 "I1·D 닫기" 와 한 체크박스로 결합돼 있다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 (:1462~1487, `execution.failed` `error` 마스킹 불릿) — 이 불릿이 곧 `plan/in-progress/eia-internal-rest-error-masking.md` §"spec 초안 ①" 로 교체될 자리
  - 관련 plan:
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — I1(:180-184)·D(:186-190), 둘 다 아직 `- [ ]` (미결)
    - `plan/in-progress/eia-internal-rest-error-masking.md` — "범위 밖" 절(:96-104, :145-146)이 `NodeExecution.error` 와 `inputData`/`outputData` 를 "같은 클래스의 유출 가능성" 으로 실측 기록하면서도 **"정본 트래커에 신규 등재한다"** 를 현재형/미래형으로만 쓰고, 실제 등재는 "조치" 체크리스트 마지막 항목(:171) `정본 트래커 I1·D 닫기 + 신규 잔여(NodeExecution.error·inputData/outputData) 등재` 하나로 미뤄 두었다
  - 상세: 이 정확한 실패 형태(약속을 미래형으로 쓰고 그 턴에 실제 등재하지 않음)는 같은 트래커 파일 안에서 **이미 5회** 자백·기록됐다("별건 등재됨" 3회, 엔티티 nullability 주석, 실 DB e2e 항목 — :402-426). 게다가 이 체크박스는 **성격이 다른 두 작업을 하나로 묶고 있다** — "기존 I1·D 를 닫는 것"(이번 PR 의 직접 성과)과 "새로 발견한 별개 컬럼(`NodeExecution.error`/`inputData`/`outputData`)의 등재"(다음 PR 의 시작점)를 한 체크박스로 두면, I1·D 만 닫고 체크하는 순간 신규 등재가 조용히 함께 "완료" 로 읽힐 위험이 있다. 이 트래커 자신도 정확히 같은 이유로 최상단(:13-16)에서 "결합 항목을 둘로 쪼갰다"(`durationMs`/`result.outputs` 분리) — 같은 저장소가 이미 겪고 고친 패턴의 재발이다
  - 제안: (a) `eia-internal-rest-error-masking.md` 의 "조치" 마지막 항목을 "I1·D 닫기" 와 "신규 잔여 2건 등재" 두 체크박스로 분리하고, (b) 가능하면 이 plan 문서 작성 시점(지금)에 바로 `spec-sync-external-interaction-api-gaps.md` 에 `NodeExecution.error`·`inputData`/`outputData` 를 새 미결 항목으로 등재해 "그 턴에 적어라" 교훈을 따를 것

- **[INFO]** 트래커의 I1·D 항목 원문이 아직 "택일됨" 상태를 반영하지 않는다
  - target 위치: 해당 없음 (target 은 아직 미변경 — 정상)
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md` :180-190 (I1·D, 여전히 "둘 중 하나를 고르는 것이 이 항목이다" / "택일해서 근거를 Rationale 에 남긴다" 로만 서술)
  - 상세: `eia-internal-rest-error-masking.md` 가 2026-08-16 사용자 결정으로 I1="내부 경로에도 마스킹", D="secret-store.md 비대상 등재" 를 확정했다고 적었지만, 정본 트래커 쪽에는 아직 그 결정이 한 줄도 반영돼 있지 않다(체크박스도 `[ ]` 그대로, 각주도 없음). 구현이 끝나야 트래커를 갱신하는 현재 순서 자체는 이 저장소의 기존 관행(구현→planner 턴→트래커 닫기)과 어긋나지 않지만, 결정이 내려진 시점과 트래커에 그 사실이 드러나는 시점 사이의 공백이 길다
  - 제안: 필수는 아니나, 트래커 I1·D 옆에 "결정(2026-08-16), 집행 중: `eia-internal-rest-error-masking.md`" 한 줄만 지금 추가해 두면 트래커만 읽는 다음 세션이 이미 열린 질문으로 재검토하는 것을 막을 수 있다

## 확인했으나 문제 없음 (참고)

- target `14-external-interaction-api.md` :1484-1487 은 "내부 REST 와의 비대칭은 미결이다" 를 여전히 정확히 서술 중 — plan 이 이 미결 상태를 일방적으로 우회하지 않고, 결정을 명시적으로 사용자에게 올린 뒤(§근거) planner 턴을 별도 체크리스트 항목으로 예정해 두었다. §R17 `execution.ai_message` 선례·R-5 범위(Config 탭 한정, `Execution.error` 미포함) 인용도 target 원문과 대조해 정확했다
- `secret-store.md §1` 의 기존 "비대상" 패턴(`AuthConfig.config`)과 plan 의 신규 "비대상" 제안(`interaction.triggerToken`)이 같은 구조를 따른다 — 선례와 충돌 없음
- `spec/2-navigation/14-execution-history.md` R-5 의 실제 대상(Config 탭)을 plan 이 스스로 "과대인용하지 않는다" 고 명시해 자기 검증까지 마쳤다
- `auth-workspace-membership-guard.md`(complete) 는 cross-workspace 멤버십 검증이라는 다른 축이고, 이번 plan 의 "GET /executions/:id 에 @Roles 없음" 관찰(intra-workspace viewer 가시성)과 겹치지 않는다 — 중복 작업 아님
- `eia-terminal-payload.md`(in-progress, 체크리스트 전항목 완료) 는 wire 형태(§6.4) 통일이 주제이고, 이번 plan 은 "값 마스킹" 만을 범위로 명시적으로 구분(`toTerminalErrorPayload` 재사용 안 함) — 두 plan 간 충돌 없음

## 요약

target(`spec/5-system/`)은 정본 트래커가 "결정 필요" 로 남긴 I1·D 를 우회하거나 미리 판정하지 않고 여전히 정확히 미결 상태를 서술하고 있어, 진행 중인 `eia-internal-rest-error-masking.md` plan 과 충돌하는 지점은 없다. 다만 그 plan 이 실측으로 새로 찾아낸 두 잔여 갭(`NodeExecution.error`, `inputData`/`outputData`)을 정본 트래커에 즉시 등재하지 않고 "조치" 체크리스트의 결합 항목(I1·D 닫기 + 신규 등재)으로 미뤄 둔 것은, 같은 트래커 문서가 이미 5차례 자백하고 한 차례 직접 교정(체크박스 분리)까지 한 바로 그 실패 패턴의 재발 소지가 있다 — CRITICAL 급 충돌은 아니지만 plan 갱신을 권고한다.

## 위험도
LOW
