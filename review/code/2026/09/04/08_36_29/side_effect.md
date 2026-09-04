# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 대조군 테스트 2건은 기존 `withFiles` tmpdir 헬퍼를 그대로 재사용 — 새로운 부작용 표면 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:387` (`it('[대조군] 관계 데코레이터끼리의 동명 충돌도 판정에서 뺀다', ...)`), `:417` (`it('[대조군] `@Column` 과 관계가 섞인 충돌도 뺀다 — 종류를 구분하지 않는다', ...)`)
  - 상세: 두 테스트 모두 `withFiles`(`:55`)를 통해 `mkdtempSync(path.join(os.tmpdir(), 'nullable-guard-'))`(`:59`)로 격리된 임시 디렉터리에 fixture 를 쓰고, `try/finally`(`:66-70`)의 `fs.rmSync(dir, { recursive: true, force: true })`(`:69`)로 항상 정리한다. 실제 저장소 소스·전역 상태·환경 변수를 읽거나 쓰지 않는다. `widenedEntityFields`/`findStaleSpecCasts` 는 인자만 소비하는 순수 함수이고 이번 diff 는 그 구현(`nullable-type-lie-cast-guard.ts`)을 전혀 건드리지 않았다(대조군 2건이 "코드는 이미 옳았다" 는 전제 위에 추가됐다는 docstring `:381-385` 과 일치). 신규 함수 시그니처 변경·공개 API 변경·이벤트/콜백 변경도 없다.
  - 제안: 없음 — 확인 완료로 기록.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md` 변경은 체크박스·서술 갱신뿐
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:233` (`- [x] **후속 — 관계 데코레이터 동명 충돌 캐너리**`)
  - 상세: `[ ]` → `[x]` 전환과 근거 문단 추가뿐이며, 코드 실행 경로·설정·환경 변수에 영향 없다.
  - 제안: 없음.

- **[INFO]** 이번 diff 는 코드 변경 2파일 외에 이전 리뷰 라운드(`08_18_51`)의 산출물 11개(`RESOLUTION.md`·`SUMMARY.md`·`_retry_state.json`·`meta.json`·7개 reviewer `.md`)를 신규 추적 파일로 함께 커밋한다
  - 위치: `review/code/2026/09/04/08_18_51/*` (전부 `new file mode`)
  - 상세: 프로젝트 관례(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")상 의도된 저장이며 gitignore 대상이 아니다(사용자 메모리 `feedback_plan_checkbox_actual_state`: "review/ 는 gitignored 아님"). 런타임 부작용은 없으나, 이 리뷰 대상 diff 의 "실제 코드 변경"이 2파일인 것과 별개로 커밋에 포함되는 파일 수가 13개로 늘어난다는 점은 side_effect 관점보다는 scope/documentation 관점에 더 가깝다 — 여기서는 파일시스템 부작용 축의 완전성을 위해 기록만 한다.
  - 제안: 없음 — 조치 불요.

- **[INFO]** 이전 리뷰 라운드 산출물(`requirement.md`, `testing.md`)이 저장소 직접 뮤테이션 사고를 스스로 고지하고 있다 — 이번 diff 자체의 결함은 아니나 side_effect 관점에서 기록할 가치가 있음
  - 위치: `review/code/2026/09/04/08_18_51/requirement.md:18-30`, `review/code/2026/09/04/08_18_51/testing.md:6`
  - 상세: 두 리뷰어 모두 `nullable-type-lie-cast-guard.ts`(가드 구현 파일, 이번 diff 대상 아님)를 뮤테이션 검증을 위해 **저장소 안에서 직접 편집**했다고 밝힌다. `requirement.md` 는 scratch 백업이 다른 세션 산출물과 뒤섞여 오염된 상태를 발견했고, `testing.md` 는 병렬 실행 중이던 다른 reviewer 가 같은 파일을 동시 편집해 자신의 뮤턴트가 덮어써지는 것을 관측했다고 적는다. 둘 다 `git show HEAD:<path>` + `cp` 로 원복했다고(즉 `git checkout`/`restore`/`stash` 를 쓰지 않았다고) 주장하며, 최종 `git status --short` 가 clean 이었다고 기록한다. 이번 리뷰에서 `git status --short` 와 `git diff --stat -- .../nullable-type-lie-cast-guard.ts` 로 직접 재확인한 결과 이 세션(`08_36_29`) 자신의 미커밋 출력 디렉터리 외에는 clean 이고 가드 파일에 diff 가 없음을 확인했다 — 즉 두 사고 모두 잔여물 없이 정리된 상태로 이 diff 에 반영돼 있다.
  - 제안: 없음 — 사고는 이미 disclosed·resolved 상태이며 이번 diff 의 실행 경로에 영향이 없다. 향후 유사 사고 재발 방지는 이미 리뷰 계약 문서(`.claude/docs/subagent-call-contract.md` 상위의 리뷰 프롬프트 규약)가 scratch 격리·`git restore` 금지를 명시하고 있어 별도 후속은 불요.

## 요약

이번 diff 의 실질 코드 변경(`nullable-type-lie-cast.spec.ts` 대조군 테스트 2건, `entity-nullable-column-type-mismatch.md` 체크박스 갱신)은 기존에 검증된 `withFiles` tmpdir 격리 패턴을 그대로 재사용하는 순수 첨가이며, 전역 상태·시그니처·공개 인터페이스·환경 변수·네트워크·이벤트/콜백 어느 축에서도 새로운 부작용 표면을 만들지 않는다. diff 에는 이전 리뷰 라운드(`08_18_51`)의 산출물 11개도 신규 파일로 포함돼 있는데, 이는 프로젝트 관례에 따른 의도된 보존이다. 다만 그 산출물 중 `requirement.md`·`testing.md` 는 리뷰 과정에서 리뷰어들이 저장소 파일(`nullable-type-lie-cast-guard.ts`)을 직접 뮤테이션했다가 scratch 오염·병렬 편집 충돌을 겪고 `cp` 기반으로 원복한 사고를 스스로 고지하고 있다 — 이번 세션에서 `git status`/`git diff` 로 재확인한 결과 잔여물은 없다. 코드 자체의 부작용 위험은 없다.

## 위험도
NONE
