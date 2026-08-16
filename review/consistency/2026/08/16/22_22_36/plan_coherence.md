# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 발견사항

- **[WARNING]** 체크리스트가 §R17 "잔여" 세 항목 중 ①만 flip 하도록 적혀 있어, B 가 닫는 ②가 문서에 stale 로 남을 위험
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "내부 읽기 경로도 같은 마스킹을 적용한다 (결정 2026-08-16)" 불릿의 **"잔여(범위 밖)"** 서브목록 —
    - ① `WS execution.node.* emit 경로의 error 는 여전히 원문이다 ... [WS 프로토콜]이 마스킹을 규정하지 않는다`
    - ② `inputData/outputData 는 다른 컬럼이라 포함되지 않는다 — 외부 getStatus 는 stripAndRedact 를 거는데 내부 REST 는 걸지 않아 같은 형태의 비대칭이 남아 있다`
    - ③ workflow-assistant LLM 도구의 약한 마스킹 (별도 결정 사항, 이번 PR 범위 아님)
  - 관련 plan: `plan/in-progress/eia-fanout-and-internal-data-masking.md` `## 작업 체크리스트`의
    `- [ ] spec — 14-external-interaction-api.md §R17 카탈로그 등재 + **잔여 ① flip**`
    및 그 근거가 되는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의
    `- [ ] **WS execution.node.* emit 의 error 는 여전히 원문이다**`(항목 A)·
    `- [ ] **내부 REST 의 inputData/outputData 도 원문이다** (2026-08-16 등재, 같은 근거)`(항목 B)
  - 상세: 이 plan 의 §B(`토·§B 트래커가 지목한 것보다 자매가 많다`)는 정확히 §R17 "잔여" ②를 닫는 작업이다
    (`toExecutionDto`+`toResponseExecution` 두 자리에 `inputData`/`outputData` 마스킹을 적용). 그런데 spec
    갱신 체크리스트 항목은 "잔여 **①** flip"만 명시하고 ②는 언급이 없다. A/B/D 를 한 PR 로 묶어 구현한 뒤
    체크리스트를 문자 그대로 따르면, ①은 정정되지만 ②는 "같은 형태의 비대칭이 남아 있다"는 실제와 어긋난
    문장으로 target 문서에 그대로 남는다 — B 가 코드로 이미 닫은 갭을 spec 이 여전히 "미해결"로 서술하는
    drift 다. 이 저장소가 반복해 겪은 "체크박스를 옮길 때 옆 산문을 같이 안 고친다" 패턴(`eia-db-wire-invariant`
    §후속 문단 stale 사례, `⚠ duration_ms` 항목의 3연속 stale 사례)과 같은 형태.
  - 제안: `eia-fanout-and-internal-data-masking.md` 체크리스트를 구현 착수 전에 "잔여 **①·②** flip"으로
    정정하거나, spec 갱신 시 §R17 잔여 목록에서 ②를 별도로 재작성(비대칭 해소를 명시)하도록 작업 항목을
    명시적으로 추가할 것. ③(workflow-assistant)은 이번 PR 미결 결정이므로 그대로 열어 둬야 한다 — 실수로
    함께 flip 하지 않도록 체크리스트에 "③ 제외"를 명시하면 더 안전하다.

## 확인했으나 문제 없음 (참고)

- `spec/5-system/6-websocket-protocol.md` (target) 의 `execution.snapshot` 행이 이미
  "같은 소켓의 `execution.node.*` **emit** 은 이 관문을 지나지 않아 아직 원문이다" 라고 §A 가 겨냥하는
  정확한 갭을 선반영해 서술하고 있다 — plan 의 전제(§A "새는 이유")와 target 현재 상태가 정합한다.
- 결정 테이블(A=fanout 브랜치만 값-패턴 마스킹, B=#1179 구조로 닫음, D=A·B PR 에 묶음)은 2026-08-16 사용자
  택일로 이미 해소돼 있어, target 이 "결정 필요"로 남긴 항목을 이 plan 이 일방적으로 재단하는 충돌은 없다.
- ③(workflow-assistant `explore-tools.service.ts`)의 마스킹 우선순위 미해결 결정은 target·plan 양쪽에서
  일관되게 "별도 결정 항목"으로 열려 있고, 이번 A/B/D 범위가 그것을 우회하거나 선점하지 않는다.
- `plan/in-progress/ws-event-types-extract.md` 는 이미 머지(#1175, `c6dd5cb89`)됐고 잔여는
  `plan/complete/` 이동 시 `spec_impact` frontmatter 갱신뿐이라 이번 target 변경과 직접 충돌하지 않는다
  (같은 `6-websocket-protocol.md` frontmatter `code:` 를 건드리지만 병렬 worktree 문제이며 검토 대상 밖).
- `pending_plans: [spec-sync-external-interaction-api-gaps.md]` 선언은 정확하며, 그 트래커의 열린
  두 항목(WS node emit / 내부 REST inputData·outputData)이 이 plan 의 A·B 범위와 1:1 로 대응한다.

## 요약

핵심 결정(A/B/D)은 이미 사용자 택일로 해소돼 있고 target spec 의 현재 서술도 plan 의 전제와 정합한다 —
"미해결 결정 우회"나 "선행 plan 미해소" 유형의 충돌은 발견되지 않았다. 다만 spec 갱신 체크리스트가 §R17
"잔여" 세 항목 중 ①만 flip 하도록 좁게 적혀 있어, B 구현이 실제로 닫는 ②가 target 문서에 stale 서술로
남을 위험이 있다 — 구현 착수 전 체크리스트를 정정하는 편이 안전하다.

## 위험도

LOW
