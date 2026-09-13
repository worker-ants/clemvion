# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff --stat origin/main...HEAD`로 전체 changeset(172 files, +13320/-393)을 실 코드와
문서/plan/review 산출물로 분리했다. 실 코드 델타는 5개 파일뿐이다:

- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` — 삭제(189행)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` — 삭제(184행)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 신규(421행)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — 신규(279행)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` — 주석 2줄

나머지는 `CHANGELOG.md`/`PROJECT.md`(가드 카탈로그 문구), `plan/in-progress/*.md` 2개(신규
plan + 트래커 갱신), 그리고 `review/code/**`·`review/consistency/**`(6라운드
`/ai-review` + 7라운드 `--impl-prep`/`--impl-done` 산출물)이다. 신규 두 파일(`guide-identifier-
existence.test.ts`, `guide-identifier-scan.ts`)을 전문 `Read`로 확인했고, 삭제된 두 파일과
`diff`로 직접 대조했다. 저장소에 아무것도 쓰지 않았다(`git status --short` 확인 — 이 세션이
만든 리뷰 폴더 2개뿐, `.bak` 류 0건).

## 발견사항

- **[INFO]** 공유 트래커 파일에 이번 작업과 무관한 새 백로그 항목 1건이 함께 추가됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3406` (`cafe24-api-metadata.md §4` Principle 7→0 오인용 항목)
  - 상세: `--impl-prep`(`review/consistency/2026/09/13/12_33_41` convention_compliance WARNING#4) 도중 우연히 발견한, 이번 `guide-identifier-existence` 작업과 무관한 spec 오인용이다. `developer`는 `spec/` 쓰기 권한이 없어 직접 고칠 수 없고, 발견 즉시 `plan/` 백로그로 등재하는 것이 이 저장소의 확립된 관례다(CLAUDE.md `자기-반증형 소정정` 절 및 plan §D 처리 표). 항목 자체에도 "이번 plan 과 무관한 선재 결함"이라고 명시돼 있어 은폐 없이 투명하게 처리됐다.
  - 제안: 조치 불요 — 관례를 정확히 따른 것이라 CRITICAL/WARNING 대상이 아니다.

- **[INFO]** 같은 트래커 파일에 이번 PR 자신이 발견한 코드 결함(비-spec) 1건도 함께 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3416` (`guide-identifier-scan.ts`의 `lastIndex` 리셋 보일러플레이트 4곳 복제)
  - 상세: `/ai-review` 라운드 5(`review/code/2026/09/13/16_04_15` maintainability WARNING#2)가 지적한 것으로, 이번 PR이 만든 파일 자체의 개선 항목이라 무관 항목과는 성격이 다르다. 즉시 고치는 대신 "이 가드 하나의 범위를 넘는 폴더 공용 유틸 배치"로 미루고 선실측 조건까지 적어 등재한 것은 스코프 절제(over-fix 회피)로 보이며 문제 삼을 수준이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 가드 파일 교체가 `git mv` 대신 delete+create로 이뤄져 이력이 끊김
  - 위치: `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`(삭제) → `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`(신규)
  - 상세: diff가 `deleted file mode` + `new file mode` 쌍으로 나타나 git이 rename으로 인식하지 못한다(`--find-renames=25%`로도 재인식 안 됨 — 라운드 1 RESOLUTION에서 실측 확인됨). 축 구조·기준집합·허용목록까지 상당히 재설계됐으니 순수 리네임은 아니지만, `git blame`/`git log --follow` 추적이 끊기는 비용이 있다. 이미 6라운드에 걸쳐 반복 확인·수용된 사항이라 재발 지적이 아니라 재확인이다.
  - 제안: 조치 불요(이미 병합 진행 중인 diff 형태를 되돌리는 비용이 더 큼) — 다음에 유사한 대규모 가드 재설계 시 `git mv` 후 편집하는 두 커밋 분리를 고려.

- **[INFO]** `review/code/**`·`review/consistency/**` 산출물 다수(126개 파일, 이번 changeset의 대다수)가 함께 커밋됨
  - 위치: `review/code/2026/09/13/{14_41_14,15_03_06,15_24_12,15_42_54,16_04_15,16_28_47}/**`, `review/consistency/2026/09/13/{12_33_41,14_41_43,15_03_36,15_23_53,15_43_24,16_04_45,16_28_53}/**`
  - 상세: 6라운드의 `/ai-review` + 7라운드의 `--impl-prep`/`--impl-done` 산출물 전체가 이번 diff에 포함된다. 표면적으로는 방대해 보이지만, 이 저장소 CLAUDE.md의 review-fix 워크플로(구현 완료 후 `/ai-review`+critical/warning fix가 상시 승인된 강제 의무, 산출물은 `review/code/<타임스탬프>/`에 저장)와 정확히 일치하는 정상 산출물이며, 전부 이 단일 PR("가이드 식별자 실재성 가드")의 반복 리뷰-수정 사이클에서 나온 것이라 무관한 다른 작업의 혼입이 아니다.
  - 제안: 조치 불요.

## 요약

핵심 실 코드 변경(5개 파일)은 트래커 항목 하나("가이드가 적는 식별자가 실재하는지 세는 가드가 없다")를 닫는 단일 목적에 완전히 수렴한다 — `guide-error-code-existence`(에러 코드 전용, 허용목록 없음)를 `guide-identifier-existence`(에러 코드+환경변수, 4강제 허용목록)로 리네임·확장한 것이 전부이며, 확장 근거(과거 결함 `MCP_INSECURE_URL_ALLOWED`를 구 가드 3축이 전부 놓친다는 실측)가 plan·코드 주석에 상세히 기록돼 있다. `CHANGELOG.md`·`PROJECT.md`·`guide-sanitized-message-parity.test.ts`의 수정은 리네임에 따른 필연적 전방 참조 갱신에 그친다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 편집도 원 항목 종결(체크박스+번복 근거)과 리네임 참조 갱신, 그리고 이번 작업 중 발견한 두 건(무관 spec 오인용 1건 · 자기 코드 개선 항목 1건)의 백로그 등재로 국한되며, 둘 다 프로젝트 관례("발견 즉시 등재")를 명시적으로 따르고 스스로 성격을 밝혔다. 나머지 대부분(126개 파일)은 이 단일 작업의 6라운드 `/ai-review` + 7라운드 consistency-check 산출물이며 저장소의 표준 review-fix 워크플로에 부합한다. 포맷팅·불필요한 리팩토링·기능 확장(over-engineering)·무관한 임포트/설정 변경은 관찰되지 않았다.

## 위험도

LOW
