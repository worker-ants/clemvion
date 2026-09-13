# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff --stat origin/main...HEAD`로 전체 changeset(192 files, +15610/-393)을 실 코드와
문서/plan/review 산출물로 분리했다. 이번 라운드(8라운드째 code review)는 직전
`review/code/2026/09/13/16_56_29`(scope 담당이 이미 LOW로 판정)의 CRITICAL/WARNING을 고친
`fix(guards): 라운드 7`(`1a2e78519`, 17:26:26 커밋) 만큼만 새로 얹힌 상태다. 그 커밋의
비-리뷰산출물 diff를 직접 확인했다:

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `BACKTICK` 축을
  2단(스팬 분리 → 안쪽 재스캔)으로 바꾸고, `FIELD_TABLE_NAME`의 키-순서 의존을 완화, 관련
  JSDoc 갱신
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 위 두
  결함을 이름으로 고정하는 회귀 테스트 4건 + vacuity 하한 테스트 1건 추가
- `plan/in-progress/guide-identifier-existence.md` — §G(라운드 7) 절 추가, 체크리스트 갱신

세 파일 모두 직전 라운드 reviewer가 낸 CRITICAL 1건·WARNING 4건에 좁게 대응하며, 무관한
코드·주석·포맷팅·임포트 변경은 없었다(diff 전문 확인). 브랜치 전체 9개 커밋
(`d03141e6e`~`1a2e78519`)의 비-`review/**` 변경분을 각각 `git show --stat`으로 대조한 결과,
모든 커밋이 예외 없이 `CHANGELOG.md`·`PROJECT.md`·`guide-identifier-*`·
`guide-sanitized-message-parity.test.ts`·`plan/in-progress/{guide-identifier-existence,
spec-draft-nullable-notation-followups}.md` 집합 안에서만 움직였다 — 9개 커밋 중 단 하나도
이 집합 밖의 파일을 건드리지 않았다. 저장소에 아무것도 쓰지 않았다(`git status --short`
확인 — 이 세션이 만든 리뷰 폴더 2개뿐, `.bak` 류 0건, `find . -name "*.bak*"` 0건).

## 발견사항

- **[INFO]** 공유 트래커 파일에 이번 작업과 무관한 새 백로그 항목 1건이 함께 등재됨 (선재 확인 사항, 재확인)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — `cafe24-api-metadata.md §4` Principle 7→0 오인용 항목 (`grep -n "cafe24-api-metadata.md §4" plan/in-progress/spec-draft-nullable-notation-followups.md`로 위치 특정)
  - 상세: `--impl-prep`(`review/consistency/2026/09/13/12_33_41` convention_compliance WARNING#4) 도중 발견한, 이번 `guide-identifier-existence` 작업과 무관한 spec 오인용이다. `developer`는 `spec/` 쓰기 권한이 없어 직접 고칠 수 없고, 발견 즉시 `plan/` 백로그로 등재하는 것이 이 저장소의 확립된 관례다(`CLAUDE.md` 자기-반증형 소정정 절, plan §D 처리 표). 항목 자체가 "선재, 무관"이라고 명시해 은폐 없이 처리했다. 라운드 1~7 scope 리뷰어 전원이 동일하게 조치 불요로 판정했고 상태 변화 없음.
  - 제안: 조치 불요 — 관례 준수.

- **[INFO]** 가드 파일 교체가 `git mv` 대신 delete+create로 이뤄져 이력이 끊김 (선재 확인 사항, 재확인)
  - 위치: `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`(삭제) → `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`(신규)
  - 상세: `deleted file mode` + `new file mode` 쌍으로 나타나 git이 rename으로 인식하지 못한다(`--find-renames=25%`로도 재인식 안 됨 — 라운드 1 RESOLUTION에서 실측 확인). 축 구조·기준집합·허용목록까지 재설계됐으니 순수 리네임은 아니지만 `git log --follow` 추적이 끊기는 비용이 있다. 6라운드 이상 반복 확인·수용된 사항.
  - 제안: 조치 불요(되돌리는 비용 > 이익) — 다음에 유사한 대규모 가드 재설계 시 `git mv` 후 편집하는 두 커밋 분리를 고려.

- **[INFO]** `review/code/**`·`review/consistency/**` 산출물 다수(약 177개 파일, changeset의 대다수)가 함께 커밋됨
  - 위치: `review/code/2026/09/13/{14_41_14,15_03_06,15_24_12,15_42_54,16_04_15,16_56_29}/**`, `review/consistency/2026/09/13/{12_33_41,14_41_43,15_03_36,15_23_53,15_43_24,16_04_45,16_28_53,16_56_35}/**`
  - 상세: 6라운드의 `/ai-review` + 8라운드의 `--impl-prep`/`--impl-done` 산출물 전체가 이번 diff에 포함된다. 이 저장소 CLAUDE.md의 review-fix 워크플로(구현 완료 후 `/ai-review`+critical/warning fix가 상시 승인된 강제 의무, 산출물은 `review/code/<타임스탬프>/`에 저장하는 정식 규약)와 정확히 일치하는 정상 산출물이며, 전부 이 단일 트래커 항목("가이드가 적는 식별자가 실재하는지 세는 가드가 없다")의 반복 리뷰-수정 사이클에서 나온 것이라 무관한 다른 작업의 혼입이 아니다.
  - 제안: 조치 불요.

## 요약

이번 라운드에서 새로 얹힌 실 코드 변경(`guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`·plan 파일)은 직전 라운드(`16_56_29`)가 낸 CRITICAL 1건·WARNING 4건에만 좁게 대응하며, 새로운 목적이나 무관한 수정은 없다. 브랜치 전체로 봐도 9개 커밋 각각의 비-리뷰산출물 diff가 하나의 고정된 파일 집합(`CHANGELOG.md`·`PROJECT.md`·`guide-identifier-*`·`guide-sanitized-message-parity.test.ts`·관련 plan 2개) 밖을 벗어난 적이 없다 — 트래커 항목 하나를 닫는 단일 목적에 완전히 수렴한다. 나머지 대부분(177개 파일)은 이 단일 작업의 반복 `/ai-review`+`--impl-prep`/`--impl-done` 산출물이며 저장소의 표준 review-fix 워크플로에 부합한다. 유일하게 스코프 경계선에 걸리는 항목(무관 spec 오인용 백로그 등재, delete+create로 인한 이력 단절)은 라운드 1부터 7까지 이미 반복 확인·조치 불요로 처분된 사항이며 이번 라운드에서도 상태 변화가 없다. 포맷팅·불필요한 리팩토링·기능 확장(over-engineering)·무관한 임포트/설정 변경은 관찰되지 않았다.

## 위험도

LOW
