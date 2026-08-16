# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff origin/main...HEAD --stat` (89 files, +5840/-56)로 전체 changeset 을 파악한 뒤,
프롬프트 번들이 생략한 대형 diff(`executions.service.ts`, `executions.service.spec.ts`,
spec 5개 파일, `plan/complete/*` 신규 5개)는 저장소에서 직접 `git diff` 로 재확인했다.

핵심 작업은 "내부 REST/WS 읽기 경로에도 `Execution.error`/`NodeExecution.error` egress
마스킹을 적용한다"(EIA §R17 I1 결정, 2026-08-16)이다.

## 발견사항

- **[INFO]** 핵심 코드 diff 는 작업 의도에 정확히 국한된다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`(신규),
    `codebase/backend/src/modules/executions/executions.service.ts`,
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`,
    관련 `.spec.ts` 2개, DTO JSDoc 2개
  - 상세: 신규 leaf util 1개(`deepRedactSecrets` 위임) + 그 소비처 4곳
    (`findById`/`toExecutionDto`/`getChain`/`stop`) + `background-runs` body 노드 1곳으로
    범위가 정확히 닫혀 있다. `stripPrivateRelations`→`toResponseExecution` 개명과
    `stop`/`stopInternal` 분리는 겉보기엔 리팩터링이지만 실제로는 "마스킹 관문을 한
    자리로 모은다"는 이번 작업의 **직접 요구사항**이지 별건 정리가 아니다(CHANGELOG·spec
    §R17 교체 불릿도 동일하게 이 리팩터를 마스킹의 일부로 서술). 신규 import 는
    `redactStoredErrorForResponse` 1개뿐이고 미사용 import·불필요한 정리는 없다. `package.json`/
    lockfile 변경 0건, frontend/config 파일 변경 0건.
  - 제안: 없음.

- **[INFO]** `plan-lifecycle.md` 의 `pending_plans` 신규 절(22줄)은 핵심 코드 변경과 직접
  연결되지는 않지만, 같은 diff 안에서 신설되는 `plan/in-progress/eia-internal-rest-error-masking.md`
  가 **plan 레벨 `pending_plans:`** frontmatter 를 처음으로 구조적 관행처럼 쓰기 때문에 그
  의미를 문서화한 것이다. 이 changeset 자체의 세션 내 이전 리뷰 라운드(`17_35_49`
  documentation, `16_48_55`/`17_35_13` consistency)에서 이미 같은 항목이 지적·검토됐고
  차단 사유가 아닌 것으로 다뤄졌다 — 새로 지적할 실익이 낮아 INFO 로만 남긴다.
  - 위치: `.claude/docs/plan-lifecycle.md:80-101`
  - 제안: 없음(이미 다회 검토·수용됨).

- **[INFO]** `plan/complete/` 로 이동된 5개 plan 문서(`eia-stalled-atomicity.md`,
  `eia-terminal-emit-facade.md`, `eia-terminal-error-sanitize.md`,
  `spec-draft-eia-error-masking-catalog.md`, `spec-draft-eia-r8-alignment.md`,
  `spec-draft-ws-types-canonical-location.md`)는 **이번 PR 의 작업 대상이 아닌, 이미
  별도로 병합된 선행 PR(#1173~#1178)의 plan 라이프사이클 이동**이다. 표면적으로는
  "무관한 파일 수정"처럼 보이지만, `.claude/docs/plan-lifecycle.md §3`
  이 *"plan 이동만 담은 별 PR 분리 금지 — 마지막 작업 PR 안에서 별 commit 으로"* 를
  명시적으로 규정하고 있고, 실제로 이 diff 안에서도 `chore(plan):` 성격의 **독립
  커밋**으로 분리돼 있다(로컬 링크 경로 수정 3건도 이 이동에 부수해 필요한 것이지
  핵심 로직과 무관한 편집이 아니다). 이 정확한 항목은 세션 내 이전 scope 리뷰
  라운드(`17_35_49`)에서 이미 지적됐고, 개발자가 위 규약을 인용해 명시적으로
  근거를 남기며 채택하지 않기로 한 바 있다(`review/code/2026/08/16/17_35_49/RESOLUTION.md` #3).
  프로젝트 규약이 정면으로 이 형태를 요구하므로 CRITICAL/WARNING 으로 재상신하지
  않는다.
  - 위치: `plan/complete/eia-terminal-emit-facade.md` 등 신규 5개 파일,
    `plan/in-progress/backend-lint-gate-broken-on-main.md:787`,
    `plan/in-progress/retry-turn-terminal-guard.md:308,372`,
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md:106`,
    `plan/in-progress/ws-event-types-extract.md:293`(각각 이동 후 상대경로 정정 1줄)
  - 제안: 없음(정책 준수 확인 완료).

- **[INFO]** `review/code/**`·`review/consistency/**` 하위 다수 신규 파일(약 60개)은 이번
  changeset 의 "코드"가 아니라, 이 작업을 만들어낸 **동일 세션의 의무 리뷰/일관성 검토
  산출물**(CLAUDE.md "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 규정에 따른
  `/ai-review` 3라운드 + `consistency-check` 4라운드의 `RESOLUTION.md`/`SUMMARY.md`/
  `<checker>.md`)이다. `review/` 하위 산출물 저장은 프로젝트 규약이 지정한 정본 위치이므로
  이를 "무관한 파일 수정"으로 분류하지 않는다.
  - 위치: `review/code/2026/08/16/{17_12_34,17_35_49}/**`,
    `review/consistency/2026/08/16/{16_03_57,16_32_42,16_48_55,17_35_13}/**`
  - 제안: 없음.

- **[INFO]** 테스트 파일 증가분(`executions.service.spec.ts` +279, `background-runs.service.spec.ts`
  +48, `redact-stored-error.spec.ts` 신규 +100)을 표본 확인한 결과 전부 이번 마스킹
  기능의 "표면 전수" 커버리지(4개 REST 반환 지점 + WS 재사용 + background-runs body +
  copy-on-change 회귀)에 직접 대응하며, 무관한 테스트 리팩터·스타일 정리는 섞여 있지
  않다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:840-` (신규
    `describe('Execution.error 응답 마스킹 — 표면 전수', ...)`),
    `codebase/backend/src/shared/utils/redact-stored-error.spec.ts`
  - 제안: 없음.

## 확인했으나 문제 없음

- 포맷팅/공백 전용 변경 없음 — 모든 hunk 가 실질 코드/문서 변경과 결합돼 있다.
- 주석·JSDoc 추가는 분량이 크지만(예: `redact-stored-error.ts` 상단 doc, `executions.service.ts`
  의 `toResponseExecution`/`stop`/`stopInternal` JSDoc) 전부 "왜 이 함수가 존재하는지·왜
  이 자리에서 마스킹을 거는지"를 설명하며 이번 diff 가 만든 결정 자체를 정당화한다 —
  기존 코드에 대한 불필요한 주석 첨삭이 아니다.
- import 변경은 `redactStoredErrorForResponse` 단일 추가뿐이며 미사용 import·순환
  재유입은 없다(파일 헤더 주석이 #1175 순환 회피를 명시).
- `spec/**` 5개 파일 변경(`1-data-model.md`, `2-navigation/14-execution-history.md`,
  `4-nodes/1-logic/12-background.md`, `5-system/{14-external-interaction-api,6-websocket-protocol}.md`,
  `conventions/secret-store.md`)은 모두 이번 마스킹 결정(I1) 또는 그와 짝을 이루는
  D(`interaction.triggerToken` secret-store 비대상) 결정을 문서화하는 것으로, 별개
  spec 영역을 건드리지 않는다.
- `CHANGELOG.md` 갱신은 저장소가 직전 6개 커밋(#1171~#1177)에서 지켜온 "wire 변화 기록"
  관행을 그대로 따른 것이며 신규 의무가 아니다.

## 요약

핵심 코드 변경(신규 leaf util + 그 5개 소비처 + 대응 테스트)은 "내부 읽기 경로 egress
마스킹"이라는 명시된 작업 범위에 정확히 닫혀 있고, over-engineering·무관한 리팩터링·
불필요한 import/설정 변경은 발견되지 않았다. 코드 외 파일(plan 이동 5건, `pending_plans`
문서화, 방대한 `review/**` 산출물)은 얼핏 "관련 없는 파일들이 섞였다"는 인상을 줄 수
있지만, 각각 (a) 프로젝트가 명문화한 plan 이동 규약(§3, "이동만 담은 별 PR 금지"),
(b) 이 diff 자신이 도입한 신규 관행의 문서화, (c) 이 저장소가 상시 의무화한 자동
review/consistency 파이프라인의 산출물 저장 규칙으로 설명되며, 이미 세션 내 별도
scope 리뷰 라운드에서 검토·근거 제시가 끝난 항목이다. 재상신할 새로운 결함은 없다.

## 위험도

NONE
