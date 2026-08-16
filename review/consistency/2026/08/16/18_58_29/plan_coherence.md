# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 방법

`git diff origin/main...HEAD -- spec/5-system/` 는 `6-websocket-protocol.md`(+2/-2, `execution.snapshot`
행 1곳)와 `14-external-interaction-api.md`(+44/-6, §R17 `:1483` 불릿 교체)만 직접 건드리지만,
같은 논리적 변경("내부 읽기 경로에도 `Execution.error` 값-패턴 마스킹 적용" 결정)이
`spec/1-data-model.md`·`spec/2-navigation/14-execution-history.md`·`spec/4-nodes/1-logic/12-background.md`·
`spec/conventions/secret-store.md` 4개 문서에도 번져 있어(전체 diff stat 확인) 6개 spec 파일을
함께 대조했다. `pending_plans`/`spec_impact` 로 명시 연결된 정본 트래커
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 와 그 집행 plan
`plan/in-progress/eia-internal-rest-error-masking.md` 를 절대경로로 전문 읽었고, 두 항목(I1·D)의
"결정 필요" 서술과 diff 후 "결정됨" 서술을 라인 단위로 대조했다. 이어 `grep -rl` 로
`plan/in-progress/**`(elided 파일 포함, 디스크 원본 기준) 전체에서 `Execution.error`·
`triggerToken`·`redact-stored-error`·`secret-store` 를 스캔해 이 diff 와 겹치는 다른 미해결
plan 이 있는지 확인했다.

## 발견사항

없음.

- **미해결 결정과의 충돌 — 없음.** target 이 반영하는 두 결정(I1: 내부 REST/WS 읽기 경로에도
  `Execution.error` 마스킹 적용, D: `interaction.triggerToken` 을 `secret-store.md §1` 명시
  예외로 등재)은 `spec-sync-external-interaction-api-gaps.md` 에 "미결 → 택일 필요" 로 등재돼
  있었고, 같은 트래커가 "**결정됨 (2026-08-16, 사용자 택일)**" 로 갱신돼 있다(diff 확인:
  두 항목 모두 `[ ]` → `[x]` + 결정 근거 blockquote 추가). target 이 일방적으로 내린 결정이
  아니라 트래커에 기록된 사용자 택일을 spec 에 옮긴 것.
- **선행 plan 미해소 — 없음.** target 이 전제하는 선행 조건(§R17 종결 emit 마스킹 #1170~#1178,
  `Execution.error` 객체화, `toTerminalErrorPayload` 도입)은 이미 머지된 커밋(`107c8038f`,
  `b5e4dbb9c` 등)으로 완료돼 있고, 코드도 워킹트리에 실재한다 —
  `codebase/backend/src/shared/utils/redact-stored-error.ts`(신규) ·
  `executions.service.ts`(+144/-17) 변경분이 diff stat 에 그대로 나타난다.
- **후속 항목 누락 — 없음.** target 은 마스킹 적용 범위를 "총칭이 아니라 열거"로 명시하며 잔여를
  이름으로 못박는다 — ① WS `execution.node.*` emit 원문 잔존, ② 내부 REST `inputData`/`outputData`
  미포함, ③ workflow-assistant LLM 도구(`explore-tools.service.ts`)가 `inputData`·`outputData`·
  `error` 세 필드를 키-이름 기반의 더 약한 마스킹으로만 내보냄. 이 세 항목은
  `spec-sync-external-interaction-api-gaps.md` 에 각각 `- [ ]` 미해결 항목으로 신규 등재돼
  있다(단순 `deepRedactSecrets` 합성이 `maskSensitiveFields` 의 `****9876` 접미 힌트를
  깨뜨린다는 실측 반증까지 함께 기록) — target 변경이 만든 후속 항목이 조용히 누락되지
  않고 트래커에 반영됨을 확인했다.
- **`NodeExecution.error` 범위 판정 정정도 트래커에 반영됨.** 실행 plan 이 초기에 "다른 컬럼이라
  범위 밖"으로 오판했던 것을 `--spec` CRITICAL 로 정정하고(§2.14 "복사" 관계상 같은 값이
  같은 응답에 원문 병존 = 최상위 마스킹 완전 우회), 트래커의 해당 항목도 "해소" 로 격상돼
  `findById` 의 `nodeExecutions[]` + `background-runs` body 노드까지 마스킹이 확장됐다.
- **frontmatter 동반 갱신 확인.** `14-external-interaction-api.md`/`14-execution-history.md`/
  `12-background.md` 의 `code:` 에 `redact-stored-error.ts` 반영, `eia-internal-rest-error-masking.md`
  의 `spec_impact` 6개 항목이 실제 diff 6개 spec 파일과 1:1 대응(`1-data-model.md` 포함, 직전
  라운드(`18_33_59`)에서 지적됐던 누락이 이미 반영돼 있음을 확인).
- **인접 in-progress plan 과의 축 분리 확인.** `eia-terminal-payload.md`(§2.14 `nodeId` nullable
  구조 필드)·`spec-draft-eia-62-waiting-payload.md`(같은 §2.14 "구조" 행, 커밋 `4b13ca5ae` 로
  이미 반영·완료 표시됨)는 이번 diff 가 추가한 "응답 마스킹" 행과 다른 행이라 충돌이 없다.
  `retry-turn-terminal-guard.md`/`spec-draft-eia-notification-payload-contract.md`/
  `ws-event-types-extract.md` 의 변경분은 `eia-terminal-emit-facade.md` 가 `plan/complete/`
  로 이동한 데 따른 링크 경로 수정뿐이며 이번 결정과 무관하다.
- **직전 동일 관점 검토(`review/consistency/2026/08/16/18_33_59/plan_coherence.md`, 위험도 NONE)
  대비 코드 변화 없음.** 그 라운드 이후 커밋(`e88ac4bdf`)은 소스 내 리뷰 이력 제거·중복 헬퍼
  정리 등 "5라운드 리뷰" 후속이며 spec/plan 정합성에 영향을 주는 구조 변경이 아니다. 독립
  재검토로도 같은 결론에 도달했다.

## 요약

Target diff(spec/5-system/ + 4개 연쇄 spec 파일)는 정본 트래커의 미결 항목 I1·D 를 사용자가
명시적으로 택일한 결과를 정확히 반영하며, 트래커 체크박스도 같은 변경 세트 안에서 함께
갱신되어 있다(I1·D `[x]` 로 close, 새 잔여 3건 `[ ]` 로 신규 등재, `NodeExecution.error` 오판정
정정 반영). 집행 plan(`eia-internal-rest-error-masking.md`)의 spec 초안 문구가 실제 spec diff
문구와 사실상 1:1 대응하고, `spec_impact`/`code:` frontmatter 도 실제 diff 파일 목록과 일치한다.
plan·spec·code 삼자가 여러 라운드의 `--spec`/`--impl-done`/`/ai-review` 를 거치며 이례적으로
긴밀하게 동기화돼 있어, 이번 독립 재검토에서도 미해결 결정 우회·선행 plan 미해소·후속 항목
누락 중 어느 것도 발견하지 못했다.

## 위험도
NONE
