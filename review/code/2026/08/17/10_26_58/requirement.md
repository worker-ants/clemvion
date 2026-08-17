# 요구사항(Requirement) 코드 리뷰

## 검토 방법

diff 는 크게 두 계층이다 — (1) 실제 프로덕션 코드 변경(EIA §R17 잔여 마스킹 확장: WS emit
값-패턴 마스킹 + 내부 REST `inputData`/`outputData` 마스킹 + 표면 수 단일화), (2) 그 앞선
4 라운드 `/ai-review`·`/consistency-check` 산출물이 `review/**`·`plan/**` 에 새로 커밋되는
기록. (1) 은 Read/Grep 으로 현재 소스를 직접 열어 diff 주장을 재검증했고, (2) 는 문서 성격이라
내용 자기-정합성만 확인했다.

핵심 검증 대상(직접 소스 재확인):
- `codebase/backend/src/modules/executions/executions.service.ts` — `MASKED_INPUT_DATA_REASON`,
  `maskIfPresent`, `toResponseExecution`, `toExecutionDto`, `findById` 의 `nodeExecutions[]` map
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `maskWireEnvelope`/`toFanoutEnvelope`,
  두 `executionEventSubject.next` 호출부
- `codebase/backend/src/shared/utils/{redact-stored-error,sanitize-error-message}.ts`
- `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md` §4.1
- `plan/in-progress/eia-fanout-and-internal-data-masking.md` frontmatter, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`

## 발견사항

- **[INFO]** `Execution.inputData`(REST, round-trip 되는 값) 는 의도적으로 마스킹 대상에서
  제외하고, `NodeExecution.inputData`(재제출 소비처 없음) 는 마스킹 대상으로 넣는 "레벨 기준"
  카브아웃이 코드·테스트·spec 세 층에서 **정확히 대칭**으로 구현돼 있음을 직접 확인했다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution`(729행대,
    `inputData` 미포함) vs `findById` 의 `nodeExecutions[]` map(731-744행, `inputData`/`outputData`/`error`
    세 컬럼 모두 `maskIfPresent` 적용) / `toExecutionDto`(1045행, `inputData: execution.inputData ?? null`
    무마스킹).
  - 상세: `executions.service.spec.ts` 의 `①`(`inputData.note` 가 원문 `admin:pw` 를 그대로 포함해야
    한다는 양성 단언, 1156행)과 `⑤`/`⑥-b`(노드 레벨 `inputData` 는 leaky 하면 반드시 마스킹되고
    copy-on-change 도 깨져야 한다는 참조-동일성 단언, 1242-1339행)가 양방향 회귀를 모두 캐너리로
    고정했다. `background-runs.service.spec.ts:226`(`toNodeExecutionDto`, 자매 노드-레벨 표면)도 같은
    방향을 별도로 고정한다. spec `14-external-interaction-api.md:1533-1591`(2026-08-17 정정 문단 +
    "레벨이 가른다" 표)이 같은 규칙을 서술하며, 필드명·컬럼명 모두 코드와 line-level 로 일치한다.
  - 제안: 없음 — 코드·테스트·spec 3층이 서로 대칭이고 어긋남을 찾지 못했다.

- **[INFO]** WS emit 값-패턴 마스킹 초크포인트가 실제로 "공유되는 단일 관문"인지 실측 — 두
  `executionEventSubject.next` 호출부(`emitExecutionEvent`/`emitNodeEvent`) 모두 `maskWireEnvelope`
  → (`llmCalls` strip) → `toFanoutEnvelope` 순서를 거치는 것을 확인했다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `emitExecutionEvent`(253행대)
    `wireEnvelope = this.maskWireEnvelope(...)` → `fanoutEnvelope = this.toFanoutEnvelope(...)` →
    `executionEventSubject.next`, `emitNodeEvent`(326행대) 동일 순서.
  - 상세: `llmCalls` 는 `deepRedactSecretsPreserving` 의 `preserveKeys` 로 wire 단계에서 원문 보존되고,
    `toFanoutEnvelope`(외부 fanout 조립)에서 필드째 strip 되어 외부로는 노출되지 않는다는 CHANGELOG·
    spec §R17 서술과 코드가 일치한다. `sanitize-error-message.ts` 의 `deepRedactCore`/`deepRedactObject`
    가 `error`(`deepRedactSecrets`)와 `inputData`/`outputData`/wire(`deepRedactSecretsPreserving`)의
    공유 walk 로직이라는 서술도 실제 구조와 맞는다.
  - 제안: 없음.

- **[INFO]** `spec/5-system/6-websocket-protocol.md:184` 의 과거 자기모순(`execution.node.*` emit 이
  "이 관문을 지나지 않아 아직 원문이다" vs 같은 파일 §4.1 캐비엇의 "emit 시점에 마스킹된다")이 이번
  changeset 반영본에는 **더 이상 존재하지 않음**을 재확인했다 — `:184` 각주가 "이 관문(`findById`)을
  지나지 않지만, 별도의 emit 시점 값-마스킹을 받는다"로 이미 정정돼 두 서술이 더 이상 충돌하지 않는다.
  이전 라운드 consistency-checker(`23_10_41` naming_collision WARNING)가 지적한 항목이 실제로 해소된
  상태로 커밋에 들어와 있다.
  - 위치: `spec/5-system/6-websocket-protocol.md:184`, `:193`.
  - 제안: 없음.

- **[INFO]** RESOLUTION.md·CHANGELOG 가 주장하는 "잔여 갭"(bare `token=` 미탐지, `MASKED_MARKERS`
  JSDoc 귀속 문제) 이 실제로 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 각각
  등재돼 있는지 직접 확인했다 — `:172`(bare `token=`), `:282`(`MASKED_MARKERS` JSDoc 귀속). 둘 다
  체크박스 미완료(`- [ ]`) 상태로 정확히 존재해, "review/**는 SoT 아님 → 그 턴에 트래커에 적는다"
  규율이 실제로 지켜졌다.
  - 제안: 없음.

- **[INFO]** `maskIfPresent`(`executions.service.ts:118-123`) 의 `mask(value) ?? value` 방어 분기는
  현재 `redactStoredDataForResponse`/`redactStoredErrorForResponse` 구현상 `value` 가 non-null 로
  들어오면 항상 non-null 을 돌려주므로 도달 불가능한 방어 코드다. 이미 3라운드 전 testing 리뷰어가
  INFO 로 지적했고 이번 라운드에도 동일 결론이라 새로 등급을 올릴 근거는 없다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:118-123`.
  - 제안: 조치 불요(기존 처분 유지에 동의) — 필요 시 `mask: () => null` 를 넘기는 직접 단위 테스트
    한 줄로 의도를 고정할 수 있다는 기존 제안에 추가 의견 없음.

## spec fidelity 요약

`spec/5-system/14-external-interaction-api.md` §R17(표면 "여섯" 열거, 컬럼 "둘", `Execution.inputData`
카브아웃 이유·닫는 조건), `spec/5-system/6-websocket-protocol.md` §4.1(emit 값-패턴 마스킹 캐비엇 +
`llmCalls` 예외), `spec/5-system/12-webhook.md` §5.3(마커 보존 계약) 세 문서 모두 코드의 함수명
(`redactStoredDataForResponse`/`redactStoredErrorForResponse`/`maskWireEnvelope`/`toFanoutEnvelope`/
`deepRedactSecretsPreserving`)·필드명(`inputData`/`outputData`/`error`)·표면 수·예외 목록(`llmCalls`)이
line-level 로 정확히 일치했다. SPEC-DRIFT(코드가 옳고 spec 이 낡은 경우)는 발견하지 못했다 — 오히려
이번 changeset 자체가 앞선 4 라운드에 걸쳐 spec 을 코드에 맞춰 능동적으로 동기화한 결과물이다.

## 요약

WS emit 값-패턴 마스킹(§A)과 내부 REST `inputData`/`outputData` 마스킹(§B) 확장은 기능적으로
완전하며, 가장 위험했던 결정 — `Execution.inputData` 는 재제출 경로 보호를 위해 마스킹 제외,
`NodeExecution.inputData` 는 재제출 소비처가 없어 마스킹 포함 — 이 코드·테스트·spec 3층에서
서로 어긋남 없이 대칭 구현돼 있음을 소스를 직접 열어 재검증했다. 이 changeset 은 이미 4 라운드의
`/ai-review`+`/consistency-check`(CRITICAL 1건을 포함해 전량 해소)를 거쳐 수렴한 상태이고, 독립
재검토에서도 새로운 CRITICAL/WARNING 급 결함을 찾지 못했다. 남은 항목(bare `token=` 미탐지,
`MASKED_MARKERS` JSDoc 귀속, `maskIfPresent` 방어 분기 미검증)은 전부 트래커에 정확히 등재돼 있거나
기존 라운드가 근거와 함께 조치 불요로 처분한 저위험 INFO 다.

## 위험도
NONE
