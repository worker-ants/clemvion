# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 방법

Target 문서(`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`)의
`origin/main` 대비 diff 는 실제로는 `spec/1-data-model.md` · `spec/2-navigation/14-execution-history.md` ·
`spec/4-nodes/1-logic/12-background.md` · `spec/conventions/secret-store.md` 까지 6개 spec 문서에
걸쳐 있다(§R17 "내부 읽기 경로도 같은 마스킹을 적용" 결정 하나를 여러 문서에 반영). 이 diff 와
`plan/in-progress/` 전체를 대조했다 — 특히 `pending_plans` 로 명시 연결된
`spec-sync-external-interaction-api-gaps.md`(정본 트래커)와 그 집행 plan
`eia-internal-rest-error-masking.md`를 축으로, R17/`Execution.error`/`secret-store`/`14-external-interaction-api`
를 언급하는 나머지 in-progress plan 30여 개를 grep 으로 전수 스캔했다.

## 발견사항

없음.

- **미해결 결정과의 충돌 — 없음.** target 이 새로 "결정"하는 두 항목(I1: 내부 REST/WS 읽기 경로에도
  `Execution.error` 마스킹 적용 / D: `interaction.triggerToken` 을 `secret-store.md §1` 명시 예외로
  등재)은 정본 트래커(`spec-sync-external-interaction-api-gaps.md:180-204`)에 "미결 → 택일 필요"로
  등재돼 있던 항목이고, 그 트래커 자체에 "**결정됨 (2026-08-16, 사용자 택일)**" 로 기록돼 있다.
  target 이 일방적으로 내린 결정이 아니라 사용자 택일을 spec 에 반영한 것.
- **선행 plan 미해소 — 없음.** target 이 가정하는 선행 조건(§R17 종결 emit 마스킹 #1170~#1178,
  `Execution.error` 객체화)은 모두 이미 머지된 커밋(`107c8038f`, `b5e4dbb9c` 등, `git log` 확인)으로
  선행 완료돼 있다. 코드도 실제로 존재한다 — `redact-stored-error.ts`(신규, 64줄) ·
  `executions.service.ts`(+144/-17) · `background-runs.service.ts` 변경분을 `git diff origin/main --stat`
  로 확인, spec 서술("4곳 적용", "background-runs body 노드도 같이 건다")과 diff 규모가 부합한다.
- **후속 항목 누락 — 없음.** target 은 마스킹 적용 범위를 "총칭이 아니라 열거"로 명시하며 잔여 3건을
  이름으로 못박는다 — ① WS `execution.node.*` emit 원문 잔존, ② `inputData`/`outputData` 미포함,
  ③ workflow-assistant LLM 도구(`explore-tools.service.ts`)의 약한 마스킹. 이 세 항목은 정본 트래커에
  각각 `- [ ]` 미해결 항목으로 신규 등재돼 있다(`spec-sync-external-interaction-api-gaps.md:213-232`,
  "단순 합성은 답이 아니다"라는 반증까지 포함) — target 변경이 만들어낸 후속 항목이 조용히 누락되지
  않고 트래커에 반영됨을 확인.
- **부수 확인**: `spec_impact`/`code:` frontmatter 도 동반 갱신됨 —
  `14-external-interaction-api.md` 의 `code:` 에 `redact-stored-error.ts`·`executions.service.ts` 추가,
  `14-execution-history.md`/`12-background.md` 의 `code:` 에도 전자 추가. `eia-internal-rest-error-masking.md`
  의 `spec_impact` 5개 항목이 실제 diff 파일 6개(§spec 파트) 와 대응(`1-data-model.md` 는 spec_impact
  목록에 없었지만 실제로도 수정됐음 — 사소한 누락이나 diff 자체는 트래커에 반영돼 있어 등급 부여할
  실질적 정합성 문제는 아님, WARNING 미만).
- 인접 in-progress plan(`eia-terminal-payload.md`, `spec-draft-eia-62-waiting-payload.md`,
  `ie-resume-turn-boundary-cancel.md` 등)이 `Execution.error`/R17 을 언급하지만 전부 이번 diff 와
  다른 축(구조 필드 `nodeId`, `USER_MESSAGE` 라이브 시그널 등)이라 충돌·중복이 없다.

## 요약

Target diff 는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 미결 항목 I1·D 를
사용자가 명시적으로 택일한 결과를 정확히 반영하며, 트래커 체크박스도 같은 커밋 세트 안에서 함께
갱신됐다(`[x]` 로 close + 새 잔여 3건 `[ ]` 로 신규 등재). 실행 plan(`eia-internal-rest-error-masking.md`)의
체크리스트가 4라운드 `/ai-review`·2회 `--spec`·2회 `--impl-done` 을 거친 이력까지 spec 서술과
1:1 로 대응하고, 코드 diff 규모도 서술과 부합한다. plan/spec/code 삼자가 이례적으로 긴밀하게
동기화돼 있어 정합성 문제를 찾지 못했다.

## 위험도
NONE
