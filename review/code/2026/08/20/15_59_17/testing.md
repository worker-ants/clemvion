STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 코드 리뷰 — eia-inputdata-marker-guard (15_59_17, 라운드 5)

## 컨텍스트

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃 폐지를
다루며, 이미 네 라운드(`14_08_45`→`14_44_08`→`15_10_25`→`15_32_34`)의 code review 가
testing 관점을 포함해 CRITICAL 2건·다수 WARNING 을 발견·처분했다(무효 JSON 우회, 터치
영구해제 우회, 값-비었는가 우회, object/array leaf 누락 등 — 전부 캐너리로 고정 확인됨).
`codebase/frontend/src/components/executions/rerun-modal.tsx`+`.test.tsx`,
`codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`+
`editor-toolbar-run-input.test.tsx`, `codebase/frontend/src/lib/utils/masked-markers.ts`+
`.test.ts` 를 직접 재확인한 결과, 이전 라운드가 처분한 항목은 전부 실측상 반영돼 있고
mutation 관점(3-조건 OR 판정의 각 항이 빠지면 RED가 되는지)도 재검증했다 — 신규로
지적할 결함을 찾지 못했다.

이번 라운드는 아직 어느 라운드도 짚지 않은 자리 하나를 새로 찾았다 — backend
`executions.service.spec.ts`/`background-runs.service.spec.ts` 의 "ingestion 마커 보존"
캐너리가 **`outputData` 에만 있고 `inputData` 에는 없다**. 이 PR 이 바로 `inputData` 를
같은 마스커 경로에 편입시켰으므로, 이 갭은 이번 diff 가 직접 만든 것이다.

## 발견사항

- **[WARNING]** `inputData` 가 마스킹 대상이 됐는데도 "ingestion `[REDACTED]` 마커 보존" 캐너리가 여전히 `outputData` 에만 있다 — 자매 테스트의 rationale 주석도 이제 사실과 다르다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:1261` (`it('⑥ ingestion 의 [REDACTED] 헤더 마커를 덮지 않는다 …')`), 특히 `:1262`~`:1263` 의 주석("`outputData` 로 겨눈다 — `inputData` 는 마스커를 아예 안 지나므로 거기서 단언하면 … vacuous 테스트가 된다")
  - 상세:
    1. **주석이 이번 diff 로 인해 사실이 아니게 됐다.** `inputData` 는 더 이상 "마스커를 안 지나는" 필드가 아니다 — 바로 이 파일의 같은 describe 안, `①`(`:1160`)·`②`(`:1178`)·`⑤`(`:1251`) 테스트가 증명하듯 `Execution.inputData` 와 노드 레벨 `inputData` 모두 `redactStoredDataForResponse` 를 지난다(`executions.service.ts:1010`, `:1075`, `:730`대 `maskIfPresent`). 이 저장소가 세 라운드째 반복 지적해 온 "코드가 바뀌었는데 그 위 주석이 옛 결론을 현재형으로 단언" 패턴(`14_08_45` C2, `14_44_08` W7, `15_10_25` W1)이 이번엔 테스트 파일의 **가정 주석**에서 재발했다.
    2. **더 중요한 건 실제 커버리지 갭이다.** `Execution.inputData`(및 node-level `inputData`)는 webhook ingestion 이 민감 헤더를 `[REDACTED]` 로 마스킹해 저장하는 실제 필드다 — `codebase/backend/src/modules/hooks/hooks.service.spec.ts:229`("민감 헤더는 execute inputData 에 `[REDACTED]` 로 마스킹")이 이를 실측 확인한다. 그리고 이 값을 마스킹하는 `redactStoredDataForResponse` 자신의 JSDoc(`codebase/backend/src/shared/utils/redact-stored-error.ts:43-52`)은 **`inputData` 를 마커-보존 계약의 원 동기로 명시**하면서 "이 층은 그 마커를 덮지 않는다 — `.spec.ts` 캐너리가 고정한다"고 적는다. 그런데 실제로 그 캐너리는 `redact-stored-error.spec.ts:150`(함수 단위, `inputData`/`outputData` 를 가리지 않는 저수준 단위 테스트)에만 있고, `executions.service.spec.ts`/`background-runs.service.spec.ts` 의 **표면(통합) 레벨**에서는 `outputData` 에만 있다 — `inputData` 가 실제로 이 관문을 타는 통합 지점에서, ingestion 마커가 살아남는지는 아무도 검증하지 않는다.
    3. 이 갭 자체가 이 저장소에서 **재발한 형태**다: `background-runs.service.spec.ts:270`("ingestion 마커 보존 캐너리")의 주석이 스스로 "자매 표면(`ExecutionsService` ⑥ · `redact-stored-error.spec.ts`)에는 있는데 여기만 없었다"고 적어, 예전엔 정확히 이런 "표면 A 는 있는데 표면 B 는 없다" 갭이 `23_50_03` testing W4 로 잡혔다. 지금은 그 반대축이다 — `outputData` 표면 둘(`executions.service.spec.ts:1261`, `background-runs.service.spec.ts:274`)엔 있고 `inputData` 표면 어디에도 없다.
  - 영향 범위: 함수 자체(`redactStoredDataForResponse`)가 `inputData`/`outputData` 를 구분하지 않으므로 **현재 동작이 깨져 있을 가능성은 낮다** — `redact-stored-error.spec.ts` 의 단위 테스트가 그 함수 수준 보장은 고정한다. 다만 **통합 배선**(어느 호출부가 이 함수를 쓰는가)이 바뀌는 회귀 — 예를 들어 트래커에 이미 등재된 "마스킹 게이트 4곳을 단일 헬퍼로 통합"(`plan/in-progress/eia-inputdata-marker-guard.md` 2026-08-20 등재 #4) 리팩터가 `inputData` 경로만 실수로 다른 마스킹 함수로 연결하거나 raw string 치환으로 바뀌는 경우 — 는 지금 **어떤 테스트도 잡지 못한다**. 정확히 이 클래스의 결함을 이 시리즈가 여러 번 겪었다(마커 미보존 → 같은 웹훅 헤더가 표면마다 다르게 보임).
  - 제안: `executions.service.spec.ts` 의 `⑥` 테스트를 `outputData`/`inputData` 양쪽에서 도는 케이스로 확장(또는 `⑥-c` 를 신설)하고, `background-runs.service.spec.ts:274` 에도 `inputData` 버전을 추가한다. 동시에 `:1262-1263` 주석의 "`inputData` 는 마스커를 안 지난다" 서술을 삭제/정정한다(이번 PR 자신이 그 전제를 무효화했다).

## 확인했으나 재지적하지 않은 것

- `rerun-modal.tsx`/`.test.tsx`, `editor-toolbar.tsx`/`editor-toolbar-run-input.test.tsx`, `masked-markers.ts`/`.test.ts` — 3-조건(안건드림/leaf잔존/coerce실패) 각각을 targeted 캐너리로 mutation-resistant 하게 고정했고(각 조건을 제거·반전하면 기존 단언 중 하나가 RED), non-string 입력·부분-포함 오탐 경계(`a***b`)도 양방향으로 고정돼 있다. 재확인 결과 이전 라운드가 처분한 항목(무효 JSON 우회, 영구 터치 해제, `some`→`every` 뮤테이션, 실제 유입 경로(`getById→JSON.stringify→setJsonInput`) 재현)이 전부 유효하게 남아 있다.
- `masked-markers.test.ts` 가 backend `MASKED_MARKERS` 리터럴을 손으로 복제해 대조하는 방식(기계적 cross-repo 대조 아님)은 `plan/in-progress/eia-inputdata-marker-guard.md` 에 "마커 미러 계약 테스트" 로 이미 별도 트래킹돼 있어 재지적하지 않는다.
- 모달 재사용 시 상태 리셋 e2e·왕복(Re-run 후보) 테스트 부재는 이전 라운드(`15_10_25` RESOLUTION)에서 리뷰어가 "선택" 으로 이미 판정한 항목이라 재지적하지 않는다.

## 요약

핵심 마스킹-차단 로직(프런트 3소비처)의 테스트는 다섯 라운드에 걸쳐 매우 촘촘히 다져졌고 mutation 관점에서도 각 조건이 개별적으로 고정돼 있어 추가로 지적할 점을 찾지 못했다. 대신 backend 쪽에서 이번 PR 자신이 만든 새로운 갭 하나를 찾았다 — `Execution.inputData`/node-level `inputData` 가 이번에 처음으로 egress 마스킹 대상에 편입됐는데, "ingestion 시점에 이미 `[REDACTED]` 로 마스킹된 헤더를 egress 마스커가 다시 덮지 않는다"는 계약(12-webhook §5.3)을 검증하는 통합 레벨 캐너리는 여전히 `outputData` 표면에만 있다. 함수 자체는 단위 테스트로 안전하지만, 배선(어느 필드가 어느 함수를 타는가) 자체를 보호하는 테스트가 `inputData` 에는 없어 향후 마스킹 게이트 통합 리팩터(이미 트래커에 등재됨) 같은 변경에서 조용히 깨질 수 있다.

## 위험도

LOW
