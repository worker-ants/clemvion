# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 방법
- target diff: `git diff origin/main...HEAD -- spec/5-system/ spec/1-data-model.md spec/3-workflow-editor/3-execution.md spec/4-nodes/1-logic/12-background.md` (7 파일, worktree 절대경로 기준 실측)
- plan 근거: `plan/in-progress/eia-inputdata-marker-guard.md`(developer, 전 체크박스 완료 상태 — `push → PR` 만 잔여), `plan/in-progress/spec-draft-inputdata-egress-masking.md`(planner draft), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커) 3건 전문 대조 + 나머지 `plan/in-progress/**` 전체(파일명 grep, `.inputData`/`카브아웃`/`결정 필요` 키워드)로 미해결 결정·선행 조건 충돌 여부 스캔.

## 발견사항

없음 — CRITICAL/WARNING 급 정합성 결함을 찾지 못했다.

### 확인한 것 (근거 기록)

- **트래커 항목 종결과 diff 가 정확히 일치한다.** `spec-sync-external-interaction-api-gaps.md` 의
  `[x] inputData egress 마스킹 — 프런트 마커 가드가 선행돼야 한다` 블록이 "→ 해소 (2026-08-20)"
  로 닫혀 있고, 실제 `spec/5-system/14-external-interaction-api.md` §R17 은
  `~~잔여 ②~~ 해소(2026-08-20)`, 판단 기준 2축 재정의, 소비처 표(폼/Re-run/에디터) 까지 plan
  서술과 문장 단위로 일치한다.
- **`spec_impact` 7파일 = 실제 diff 7파일**, 1:1 매칭 확인
  (`spec/5-system/{14-external-interaction-api,13-replay-rerun,12-webhook,6-websocket-protocol}.md`
  + `spec/1-data-model.md` + `spec/3-workflow-editor/3-execution.md` +
  `spec/4-nodes/1-logic/12-background.md`). 미러 누락 없음.
- **"결정 항목"으로 명시적으로 남겨 둔 잔여 ③** (workflow-assistant `explore-tools.service.ts` 의
  `maskSensitiveFields` 우선순위 결정)은 이번 diff 에서 **건드리지 않고 "범위 밖 유지"로
  명시**돼 있다 — 미해결 결정을 우회하지 않고 정확히 경계를 지켰다.
- **`MASKED_INPUT_DATA_REASON` 앵커 전수 삭제** 주장을 `grep -rn` 으로 재검증 — 코드·spec
  전체 0건, plan 의 "6곳 전수 삭제" 주장과 일치.
- **`lib/utils/masked-markers.ts` 신설**을 `git log --diff-filter=A` 로 검증 — 이번 브랜치
  최초 커밋(`37da9b593`)에서 생성됨. 직전 상태(`37da9b593^`)에서는 마커 유틸이
  `dynamic-form-ui.tsx` 안에 있었음을 `git grep` 으로 확인 — plan 의 "설계" 절 서술
  (프런트 마커 유틸을 폼 컴포넌트에서 `lib/utils/` 로 승격)과 정확히 일치한다.
  (참고, 비차단: `spec-sync-external-interaction-api-gaps.md` 의 2026-08-17 등재 항목
  "마커 미러 계약 테스트"는 그 시점 기준으로 프런트 미러 경로를 이미 `lib/utils/masked-markers.ts`
  라 적어 뒀는데 실제로는 그 커밋까지 `dynamic-form-ui.tsx` 였다 — 표기가 결과적으로는
  이번 PR 이후 참이 되었으니 지금 시점 기준 오류는 없다. 다만 등재 시점 서술이 앞서 나갔던
  자리라 기록만 남긴다.)
- **2026-08-20 등재된 후속 4건**(`inputData` 마스킹 게이트 4곳 단일 헬퍼 통합 W4 · `inputOverride`
  서버측 마커 리터럴 거부 W6 · 응답 의미 반전의 외부 소비자 확인 W5 · Re-run 차단 판정 순수
  함수 추출 W3)이 트래커에 이미 등재돼 있다 — "후속 항목 누락" 없음.
- **DTO JSDoc 인수인계**(`12_41_29` INFO-4, "`execution-response.dto.ts` 의 `inputData` JSDoc
  갱신 요망")를 실제 diff 로 확인 — `ExecutionDto.inputData`·`NodeExecutionSummaryDto.inputData`
  양쪽 JSDoc 이 카브아웃 폐지 서술로 갱신됨.
- **타 in-progress plan 과의 선행조건 충돌 스캔**: `.inputData` 참조가 있는 나머지 plan
  (`retry-turn-terminal-guard.md`)은 in-memory `spawnedRow.inputData`(retry-state 키) 를
  다루는 별개 관심사라 egress 마스킹 정책과 무관. `결정 필요`/`택일` 류 마커가 있는 다른
  plan(`chat-channel-discord-gateway.md` 등)도 본 target 과 파일·주제가 겹치지 않는다.
  `spec-draft-eia-62-waiting-payload.md`(§6.2 envelope, 별도 worktree `eia-r8-cache-scope-4ae434`)
  가 같은 `14-external-interaction-api.md`/`6-websocket-protocol.md` 를 동시에 다루지만
  **동시 worktree 작업 경합은 본 검토 대상이 아니다** (병렬 세션은 로컬에 반영되지 않아
  신뢰 불가).

## 요약
`spec/5-system/**` diff 는 `plan/in-progress/eia-inputdata-marker-guard.md`(developer)·
`spec-draft-inputdata-egress-masking.md`(planner draft)가 기술한 변경안을 문장 단위로
충실히 집행했고, 정본 트래커 `spec-sync-external-interaction-api-gaps.md` 의 해당 항목을
정확히 닫았다. `spec_impact` 목록과 실제 diff 파일 집합이 1:1 로 일치하며, 이번 전환이
남긴 새 gap(헬퍼 통합·서버측 마커 리터럴 거부·외부 소비자 확인·순수 함수 추출)은 전부
같은 트래커에 후속 항목으로 이미 등재돼 있다. 범위 밖으로 명시한 "잔여 ③"(workflow-assistant
마스킹 우선순위)은 미해결 결정을 우회하지 않고 경계를 지켰다. Plan 정합성 관점에서
차단 사유를 찾지 못했다.

## 위험도
NONE
