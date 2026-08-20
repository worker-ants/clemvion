# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 발견사항

없음.

## 상세 확인 내역

- `plan/in-progress/eia-inputdata-marker-guard.md`(developer, status: in-progress)와
  `plan/in-progress/spec-draft-inputdata-egress-masking.md`(planner, status: in-progress)는
  `Execution.inputData` egress 마스킹 카브아웃 폐지라는 **동일 결정**을 각각 구현·spec
  측면에서 다루며, target 의 실제 diff(`git diff origin/main...HEAD`)와 문장 단위로 대조한
  결과 완전히 일치한다:
  - `spec/1-data-model.md:471,550` — "egress 마스킹 대상이 아니다" → "egress 마스킹 대상이다"
    전환 + 노드 레벨 대비 문장 소멸, 두 plan 이 예고한 그대로 반영됨.
  - `spec/5-system/14-external-interaction-api.md` — 잔여 ② 종결 취소선, 표면 목록 편입,
    "닫는 조건 충족" 3-소비처 표, `1620` 판단 기준 비교표 flip, "레벨" 축 폐기 — 전부 반영.
  - `spec/5-system/13-replay-rerun.md` §10.2 — caveat 블록 재작성(세 조건 차단 판정 포함),
    `code:` frontmatter 에 `rerun-modal.tsx` 등재 — 반영.
  - `spec/5-system/12-webhook.md` §5.3 — "유일한 방어" → "이중 방어" 전환 — 반영.
  - `spec/5-system/6-websocket-protocol.md` §4.1 — "레벨이 가른다" 축 폐기 — 반영.
  - `spec/4-nodes/1-logic/12-background.md` §8.2 — 과거형 정정 — 반영.
  - `spec/3-workflow-editor/3-execution.md` §2.2 — 히스토리 로드 캐비엇 삽입 — 반영
    (동일 diff 에 §5.1 `inputData` WS 데이터 흐름 stale 서술 정정도 동반 — plan 서술 범위
    밖이지만 target 자체와는 모순 없음).
- 두 plan 의 "planner 턴이 developer 턴을 선행해야 한다"는 순서 요구는 실제 커밋 이력에서도
  확인된다 — spec 커밋(`7da315c10`)이 같은 브랜치에서 구현 커밋들보다 먼저 서 있고, 별도로
  머지되어 spec 만 앞서 나가는 창이 생기지 않는다(plan 이 명시한 "착지 순서" 그대로).
- `MASKED_INPUT_DATA_REASON` 앵커 상수 삭제 주장(두 plan 모두 "backend 5개 파일 + spec 1곳
  전수 삭제"라고 서술)을 `codebase/` 전체에서 재확인 — 코드 내 잔존 참조 0건, spec 내 잔존은
  두 plan 문서 자신의 이력 서술뿐(둘 다 과거형이라 정합).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(트래커)의
  `[x] inputData egress 마스킹 — 프런트 마커 가드가 선행돼야 한다` 항목이 "→ 해소
  (2026-08-20)"로 갱신되어 있고, 그 서술이 target diff 의 실제 변경과 일치한다. 같은 항목
  아래 후속 백로그 4건(마스킹 게이트 통합·`inputOverride` 서버측 거부·외부 소비자 확인·
  차단 판정 순수함수 추출)은 이 트래커 자체에 `[ ]` 미해결로 이미 등재돼 있어, target 변경이
  만들어낸 후속 항목이 다른 곳에 유실된 흔적은 없다.
- `plan/in-progress/` 전체(정상 청크·budget-truncated 항목 포함, `node-output-redesign/*`
  43개·`spec-sync-*`·`webchat-*` 등)에서 `MASKED_INPUT_DATA_REASON`·"카브아웃"·
  `Execution.inputData`·"재제출"·`useOriginalInput` 키워드로 실제 저장소를 재검색한 결과,
  이번 diff 가 뒤집은 결론("`inputData` 는 마스킹 대상 아님")을 전제로 삼고 있는 **다른**
  in-progress plan 은 없다. 근접한 후보(`retry-turn-terminal-guard.md` 의 `inputData` 는
  retry 상태 저장용 JSONB 키를 가리키는 무관한 용법, `spec-draft-eia-62-waiting-payload.md`
  의 `inputData` 는 node-event emit 크기/성능 논의로 다른 축)는 검토 결과 무관함을 확인.
- `plan/in-progress/6-websocket-protocol.md` frontmatter 의 `pending_plans:
  spec-sync-websocket-protocol-gaps.md` 는 이번 diff 가 건드리지 않은 §1.2·§1.3·§5·§8 범위를
  다루며 상호 간섭 없음.

## 요약

target(`spec/5-system/` diff, `origin/main` 대비 7개 spec 파일)은 같은 워크트리의
developer plan(`eia-inputdata-marker-guard.md`)과 planner plan
(`spec-draft-inputdata-egress-masking.md`)이 예고한 변경 내용과 문장·표·frontmatter 수준까지
정확히 일치하며, 상위 트래커(`spec-sync-external-interaction-api-gaps.md`)의 해당 체크리스트
항목도 "해소"로 갱신돼 있고 후속 백로그가 같은 문서 안에 명시적으로 남아 있다. `plan/` 전체를
`inputData`/카브아웃 관련 키워드로 재검색했을 때 이번 결정을 전제로 한 채 갱신되지 않은
다른 plan 은 발견되지 않았다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 중 어느
관점에서도 문제가 없다.

## 위험도

NONE
