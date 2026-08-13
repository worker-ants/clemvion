# 변경 범위(Scope) 리뷰

## 검증 방법

프롬프트가 조립 문서 크기 제한으로 다수 파일 diff 를 생략했으므로, `git diff --stat origin/main...HEAD`
와 개별 `git diff`(`codebase/**`, `plan/**`, `CHANGELOG.md`, 그리고 대표 테스트 파일들)를 직접 실행해
프롬프트 발췌와 실제 저장소 상태를 대조했다.

## 발견사항

- **[INFO]** 리뷰/일관성 산출물이 이번 diff 의 133개 파일 중 117개(약 9,400줄)를 차지한다.
  - 위치: `review/code/2026/08/13/{20_36_35,22_45_24,23_07_11,23_27_48,23_46_00}/**`,
    `review/code/2026/08/14/00_00_44/**`, `review/consistency/2026/08/13/{20_36_36,22_45_25,23_07_12,23_27_49,23_46_01}/**`,
    `review/consistency/2026/08/14/00_00_45/**`
  - 상세: `git diff --stat origin/main...HEAD`(133 files, +10691/-46) 대비 `codebase/**`+`plan/**`+`CHANGELOG.md`
    는 16 files(+1266/-46)뿐이다. 나머지는 6라운드 `ai-review` + 6라운드 `consistency-check` 의 meta.json·
    RESOLUTION.md·개별 reviewer `.md` 산출물이다. 이는 `spec/conventions`/`CLAUDE.md` 가 명시한 "구현 완료
    후 자동 review/fix 는 상시 승인된 강제 의무" 워크플로의 정규 산출물이며 `review/` 는 gitignore 대상이
    아니므로(프로젝트 컨벤션) 스코프 위반은 아니다. 다만 단일 버그 수정에 6+6 라운드가 소요된 규모 자체는
    이례적으로 크므로 정보성으로만 남긴다 — PR 승인 전 리뷰어가 이 133개 중 실제 애플리케이션 코드는
    16개뿐임을 인지하고 검토 범위를 그쪽에 집중하는 것이 효율적이다.
  - 제안: 조치 불요(정보 제공 목적).

- **[INFO]** `auth-oauth.service.ts` 에 두 개의 서로 다른 버그 수정이 한 파일 diff 에 함께 들어 있다 —
  (1) `DELETE … RETURNING` 튜플 오인(이 PR 의 핵심 결함), (2) `record.rememberMe` snake_case 미매핑으로
  "로그인 유지" 가 항상 7일로 무시되던 결함.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`AuthOAuthStateRow` 인터페이스 및
    `handleCallback` 의 `remember_me` → `rememberMe` 변환부)
  - 상세: (2)는 별개 버그처럼 보이지만, 파일 자체의 JSDoc 이 밝히듯 (1) 때문에 모든 콜백이
    `OAUTH_STATE_MISMATCH` 로 죽어 있어 (2)의 코드 경로가 **도달 불가능한 dead code** 였고, (1)을 고치는
    순간 처음 실행 가능해지며 즉시 관측되는 결함이었다(원인-결과로 직결). "1커밋 1의도" 원칙을 엄격히
    적용하면 별도 커밋/PR 감이지만, 인과적으로 같은 함수·같은 라운드에서 드러난 파생 결함을 방치하면
    (1) fix 직후 (2)가 곧바로 재현되므로 함께 처리한 것은 합리적 판단이다. 커밋 메시지·docstring 모두
    이 인과관계를 명시적으로 밝히고 있어 은폐된 확장이 아니다.
  - 제안: 조치 불요 — 근거가 diff 안에 이미 문서화돼 있다.

핵심 애플리케이션 코드(`update-returning-rows.ts` 신설, `execution-engine.service.ts`·
`knowledge-base.service.ts`·`auth-oauth.service.ts` 의 정확히 8개 소비 지점 교체, 대응 테스트/e2e)는
plan(`plan/in-progress/update-returning-tuple-shape.md`)이 규정한 "UPDATE/DELETE RETURNING 이
`[rows, rowCount]` 튜플인데 8곳이 행 배열로 다뤘다" 결함 수정 하나로 수렴한다. `git diff`로 직접 대조한
결과:

- **의도 이상의 변경 / 무관한 수정**: 없음. `execution-engine.service.ts`·`knowledge-base.service.ts`
  diff 전량을 직접 열람했고, 각 hunk 가 전부 `assertRowArray`/직접 소비 → `updateReturningRows` 치환 및
  그에 딸린 주석 갱신에 국한된다. 무관한 로직 변경 없음.
- **불필요한 리팩토링**: `execution-engine.service.ts` 두 지점의 `assertRowArray` 제거는 `updateReturningRows`
  가 동일 배열 가드를 흡수하는 의도된 통합이며, 세 번째 `assertRowArray` 호출(`lockNonTerminalExecutionRow`,
  SELECT 지점)은 그대로 남아 드라이브바이 삭제가 아니다.
- **기능 확장**: `updateReturningRows` 는 튜플/행배열 두 shape 만 처리하는 최소 함수로 신규 옵션·플래그
  없음. over-engineering 신호 없음.
- **포맷팅 변경**: 각 hunk 가 실질 변경 줄에 국한되며 무관한 개행·공백 재정렬 없음.
- **주석 변경**: 추가된 주석은 전부 이번 결함의 실측 근거·회귀 이유를 설명하는 신규 주석이며 무관한 기존
  주석을 건드리지 않았다(단, 이전 라운드가 지적했던 stale 모순 주석은 이번 diff 에서 이미 정리됨).
- **임포트 변경**: `execution-engine.service.ts`·`knowledge-base.service.ts`·`auth-oauth.service.ts` 에
  추가된 `import { updateReturningRows } from '.../update-returning-rows'` 는 모두 실제 호출부가 있어
  사용된다. 불필요한 정리/추가 없음.
- **설정 변경**: 없음.
- **CHANGELOG.md**: 신규 `## Unreleased` 항목 1개(이 PR 이 고친 결함 서술) + 기존 `retry-turn` 항목에
  "소급 정정" 인용구 추가 — 둘 다 이번 수정과 직접 관련되고, 저장소의 기존 CHANGELOG 관행(Unreleased +
  소급 정정 인용구)과 일치한다. 무관한 CHANGELOG 편집 없음.
- **plan/in-progress/*.md**: 신규 plan(`update-returning-tuple-shape.md`) 외에 4개 자매 plan
  (`exec-intake-followups.md`, `ie-resume-turn-boundary-cancel.md`, `retry-turn-terminal-guard.md`,
  `spec-update-node-cancellation-shutdown-classification.md`)에 소급 정정 배너/위임 항목이 추가됐다.
  이 4개 plan 은 모두 "동시 cancel/admission 방어가 검증됐다" 는 과거 결론이 바로 이 튜플 버그(반환값이
  항상 `true`)에 의존하고 있었음을 각 문서가 실측으로 밝혀 정정하는 것으로, 이번 코드 수정의 직접적
  파생 효과다. 무관한 plan 편집이 아니다.

## 요약

리뷰 대상 애플리케이션 코드(`codebase/backend/**` 16개 파일)는 "UPDATE/DELETE RETURNING 튜플 shape"
결함 수정이라는 단일 의도에서 벗어나지 않는다. 새 헬퍼·헬퍼 자체 테스트·정확히 8개 소비 지점 수정·
그 수정을 검증하는 단위/e2e 테스트·CHANGELOG·직접 인과관계가 있는 5개 plan 문서만 포함되어 있으며,
`assertRowArray` 제거도 헬퍼가 동일 가드를 흡수하는 의도된 통합이지 드라이브바이 리팩토링이 아니다.
`auth-oauth.service.ts` 의 `rememberMe` 매핑 수정은 별개 결함처럼 보이지만 이번 fix 로 처음 도달
가능해진 인접 dead code 였음이 diff 내에 문서화돼 있어 스코프 확장으로 보지 않는다. 전체 diff 133개
파일 중 117개는 이 프로젝트의 상시 강제 review/fix 워크플로가 남기는 정규 산출물(`review/code/**`,
`review/consistency/**`)이며 규모가 크지만 컨벤션에 부합한다.

## 위험도

LOW
