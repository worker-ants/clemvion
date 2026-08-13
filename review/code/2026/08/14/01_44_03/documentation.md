# 문서화(Documentation) 리뷰 결과

## 사전 확인

이 세션의 diff(`origin/main...HEAD`)는 이미 8라운드(`20_36_35`~`01_12_26` 및 대응 consistency
라운드)의 ai-review/consistency 를 거쳐 문서화 관점 CRITICAL/WARNING 이 전부 조치된 누적
결과다. 직전 `documentation.md`(`23_46_00`)가 지적한 두 WARNING —
(1) `update-returning-tuple-shape.md` `[planner 위임]` 블록에 상단 배너가 이미 뒤집은
"frontmatter 는 `spec_impact: none` 을 유지한다" 문장이 원문 그대로 남아 자기모순이던 것,
(2) 같은 블록 도입부 "넷이다" 가 다섯 항목 나열과 어긋나던 것 —
을 실제 파일에서 재확인했다. 두 문구(`"frontmatter는 `none`을 유지한다"`, `"넷이다"`) 모두
현재 `plan/in-progress/update-returning-tuple-shape.md` 에 더 이상 존재하지 않으며(grep 0건),
`spec_impact` frontmatter 는 5개 spec 문서 리스트로 유지되고 §후속 [planner 위임] 항목도
"다섯" 기준으로 서술돼 있어 정합함을 확인했다.

핵심 신규/변경 코드를 전수 재확인했다:

- `common/utils/update-returning-rows.ts` — JSDoc 이 실측 근거(`UPDATE`/`DELETE` 만 튜플),
  실패 모드 표, 기존 3개 관용구와의 관계, `detail` 필수화 이유, `T` 제네릭이 검증이 아니라
  단언이라는 함정까지 상세히 문서화돼 있다.
- `common/utils/assert-row-array.ts` — `updateReturningRows` 와의 분담(SELECT vs
  UPDATE/DELETE)을 헤더에 명시적으로 교차 링크(`{@link updateReturningRows}`)했다.
- `common/utils/__testing__/source-scan.ts`/`.spec.ts` — 두 구조적 회귀 가드가 공유하는
  카운팅 헬퍼를 신설하며, 왜 주석을 지우는지(비대칭 위험 표까지) JSDoc 에 남기고 그 동작을
  명시적으로 고정하는 스펙까지 갖췄다. `tsconfig.build.json` 의 `**/__testing__/**` 제외는
  파일 헤더 JSDoc 1번째 문단이 그 이유(dist 미포함)를 직접 설명한다.
- `auth-oauth.service.ts` — 신규 `AuthOAuthStateRow` 타입에 snake_case 컬럼명 함정, 자매
  `integration-oauth.service.ts` 의 우회로를 의도적으로 두지 않은 이유까지 인접 주석으로
  설명한다. `handleCallback` 내부의 옛 "RETURNING id 이므로 행 배열이다" 류 모순 주석은
  남아 있지 않음을 확인.
- `execution-engine.service.ts`/`knowledge-base.service.ts` — 8개 소비 지점 전부
  `updateReturningRows(…, detail)` 로 교체되고, 교체 이유(튜플 오인이 어떤 분기를 사문화시켰는지)
  가 각 호출부 인접 주석에 남아 있다. 이전 라운드가 지적한 "제네릭이 여전히 남은 지점"·
  "detail 생략" 은 현재 8곳 전부 해소돼 있다.
- `auth-oauth-callback.e2e-spec.ts`(신규) — 파일 상단 JSDoc 이 "왜 이 파일이 필요한가"·
  "무엇을 고정하나" 를 구조적으로 서술하고, 각 `it` 이 검증하는 실패 모드를 제목에 명시한다.
- `CHANGELOG.md` — 신규 Unreleased 항목이 결함·근거·수정·왜 4개월간 안 보였는지를 갖췄고,
  기존 두 관련 섹션(§retry_last_turn, §AI multi-turn resume turn 경계)의 "1번"·"5·6·7번"
  항목 번호를 인용한 소급 정정 배너가 양쪽 모두에 붙어 있으며 인용 번호도 실제 목록 번호와
  일치함을 직접 대조했다(1번=`finalizeGuarded` 종결 2경로, 5·6·7번=`finalizeFailedExecution`/
  terminal 집합 통합/`retry-turn` 종결 2경로).
- `plan/in-progress/*.md` 4건 — `exec-intake-followups.md`·`ie-resume-turn-boundary-cancel.md`·
  `retry-turn-terminal-guard.md`·`spec-update-node-cancellation-shutdown-classification.md`
  모두 "소급 정정" 배너로 과거 완료 선언이 어느 mock 경계 안쪽에서만 유효했는지 명확히
  갈라 적었고, spec 반영은 `developer` 권한 밖이라 `[planner 위임]` 티켓(#12)에 정확히
  집결시켰다(신규 카탈로그 항목 `OAUTH_STATE_MISMATCH` 포함, 두 표면 공유 여부까지 명시).

## 발견사항

새로 지적할 CRITICAL/WARNING 급 문서화 결함을 찾지 못했다. 참고로 남기는 INFO 는 이전
라운드(`22_45_24`/`23_07_11`/`23_46_00`)에서 이미 저비용·조치 불요로 유예된 것과 동일한
성격이며 이번 라운드에서 새로 발견한 것은 아니다:

- **[INFO]** `update-returning-rows.spec.ts` 의 `it.each` placeholder 변수명(`_l, v`)이
  자매 스펙 `assert-row-array.spec.ts`(`_label, value`)와 여전히 다르다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (`%s 면 던지고 …` 블록)
  - 상세: 기능 영향 없음. 2~3라운드 연속 유예된 스타일 항목.
  - 제안: 조치 불요 — 다음에 이 파일을 실질 변경할 때 함께 맞추면 됨.

## 요약

이번 diff 는 이미 8라운드의 ai-review·consistency 로 문서화 관점 CRITICAL/WARNING 이 모두
조치된 상태의 최종 누적본이다. 신규 헬퍼·타입·테스트·CHANGELOG·plan 파일 전반에 걸쳐 "무엇이
왜 틀렸는지"·"왜 4개월간 안 보였는지"·"이 문서를 읽는 사람이 다시 같은 실수를 하지 않으려면
무엇을 알아야 하는지" 가 코드/주석/JSDoc/plan 4개 층 모두에서 상호 일관되게 기록돼 있다.
직전 라운드(`23_46_00`)가 지적한 plan 문서 자기모순 2건(banner 와 §후속 문구 불일치,
"넷"/"다섯" 불일치)은 이번 상태에서 실제로 해소됐음을 직접 대조 확인했다. README·API 문서·
설정 문서 갱신 대상은 없다(순수 내부 버그 수정 + 신규 내부 유틸리티이며, 기존 저장소도
`assert-row-array` 같은 유사 헬퍼를 README 에 별도 등재하지 않는 관례와 일치). CHANGELOG 는
이미 갱신됐고 배포 시점 판단이 필요한 관측 항목은 plan §후속에 명시적으로 남겨 뒀다.

## 위험도

NONE
