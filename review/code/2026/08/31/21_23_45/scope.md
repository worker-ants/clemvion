# 변경 범위(Scope) 리뷰 — `error-codes-layer-split` (5라운드, `21_23_45`)

## 검증 방법

- `git log --oneline -6` 으로 커밋 계보 확인: `adc4a3ff6`(본 구현) → `4141c64e3`/`eb65d3e6d`/`18062a61a`/`e6f2b5c8c`(1~4R fix). 이번 라운드는 그 누적에 대한 5번째(수렴 확인) 패스.
- `git diff --stat origin/main -- .` 로 전체 변경 파일 전수 확인(54개) — `_prompts/scope.md` 에 열거된 파일 목록과 정확히 일치. 은닉·drive-by 변경 없음.
- `git show --stat e6f2b5c8c` + `git diff 18062a61a..e6f2b5c8c -- codebase/ plan/ CHANGELOG.md` 로 **이번 라운드가 새로 리뷰하는 실질 델타**(직전 4R fix 커밋)만 분리해 확인.
- `git diff --stat origin/main -- plan/` 로 plan 이동이 rename 1건으로 잡히는지 확인(delete+add 아님).
- `git status --short` — 이번 세션 산출물 디렉터리(`review/code/2026/08/31/21_23_45/`)만 untracked, 저장소 뮤테이션 없음.

## 발견사항

없음. CRITICAL/WARNING 급 스코프 이탈 없음. 아래는 참고용 기록.

- **[INFO]** (재확인, 신규 아님) 신규 AST 가드 3파일(`engine-error-code-anchor-{guard.ts,fixture.ts,spec.ts}`, 합 484줄)이 "맨 문자열 9지점을 상수로 리다이렉트"라는 최소 처방보다 넓은 산출물이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`, `engine-error-code-anchor-fixture.ts`, `engine-error-code-anchor.spec.ts` (전부 신규 파일)
  - 상세: 1~4라운드 scope 리뷰(`20_27_29`/`20_43_35`/`20_59_14`/`21_12_31`)가 동일 항목을 이미 지적하고 매 라운드 "조치 불요"로 처분했다 — (1) `plan/complete/exec-intake-followups.md` 완료 기록이 가드를 명시적 산출물로 서술, (2) 같은 디렉터리의 기존 형제 패턴(`redis-fail-open-catalog-guard.ts` + spec)을 그대로 따름, (3) 가드가 막는 회귀 축(엔진 모듈의 앵커 없는 맨 문자열 재유입)이 이번 리다이렉트가 고치는 결함과 동일 축. 이번 라운드 재확인에서도 판단 변경 없음.
  - 제안: 조치 불요. 상태 변화 없음을 확인한 기록.

- **[INFO]** 이번 라운드의 **실질 코드/문서 델타**(직전 4R fix 커밋 `e6f2b5c8c`)는 정확히 직전 라운드(`21_12_31`) 리뷰 발견사항 3건에 국한된다 — 스코프 드리프트 없음.
  - 위치: `codebase/backend/src/nodes/core/error-codes.spec.ts`(+23줄, `EngineErrorCode` 형식/겹침/공허 검사 3개 테스트 추가), `plan/complete/exec-intake-followups.md`(④ 단락에 세 번째 미러 인용 블록 추가)
  - 상세: `18062a61a..e6f2b5c8c` diff 를 `codebase/`·`plan/`·`CHANGELOG.md` 범위로 필터링한 결과, 코드/문서 변경은 이 두 파일뿐이었다(`error-codes.spec.ts` 델타는 파일 5 diff 와 정확히 일치, `plan/complete/exec-intake-followups.md` 델타는 "④ 옮기지 않은 것" 단락을 "세 카테고리"로 세분화 + 3R→4R 미러 누락 경위 인용 블록 추가). 둘 다 `21_12_31/RESOLUTION.md` 가 명시한 W1(plan 세 번째 미러 누락)·testing INFO 2/3(형식 검사·겹침 전제 검사 부재)의 직접적 fix 이고, 그 외 무관한 리팩토링·포맷팅·주석·임포트 변경은 없다.
  - 제안: 조치 불요. 정보 제공 목적.

- **[INFO]** (재확인, 신규 아님) 누적 diff(54파일)의 대다수(44개)는 1~4라운드 `/ai-review` 산출물(`RESOLUTION.md`/`SUMMARY.md`/reviewer 리포트/`meta.json`/`_retry_state.json`)이다.
  - 위치: `review/code/2026/08/31/{20_27_29,20_43_35,20_59_14,21_12_31}/**` (전부 신규 파일)
  - 상세: CLAUDE.md 가 코드 리뷰 산출물 저장 위치를 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 명시하고, 이 저장소는 매 fix→재리뷰 사이클마다 산출물을 커밋하는 관례를 이미 4라운드 연속 유지해 왔다. `error-codes-layer-split` 작업과 무관한 다른 기능의 리뷰 산출물이 섞여 들어온 흔적은 없다.
  - 제안: 조치 불요.

## 요약

리뷰 대상 누적 diff 는 `plan/complete/exec-intake-followups.md` ARCH#5 항목("엔진 레벨 에러코드 레이어 분리")에 정확히 대응하며, 5라운드 내내 실질 코드 변경은 (a) `error-codes.ts` 신규 `EngineErrorCode` const, (b) 4개 소비처 파일의 9개 맨 문자열 지점 리다이렉트, (c) 그 회귀를 막는 AST 가드 3파일로 고정돼 있다. 이번 5번째 라운드가 새로 검토하는 실질 델타(`e6f2b5c8c`)는 직전 라운드 리뷰가 지적한 3건(plan 세 번째 미러 누락, `EngineErrorCode` 형식 대칭 검사 부재, "파일 하나·const 둘" 설계의 겹침-없음 전제 미검증)을 정확히 그 범위 안에서만 고쳤다 — `error-codes.spec.ts` 테스트 3개 추가와 plan 문서 ④ 단락 갱신 외에 무관한 코드·포맷팅·주석·임포트 변경은 없다. 신규 AST 가드 3파일은 최소 처방보다 넓지만 저장소 기존 형제 패턴을 그대로 따르고 plan 문서가 명시적 산출물로 서술해 4라운드 연속 "스코프 이탈 아님"으로 처분됐으며 이번 재확인에서도 동일하다. `git diff --stat` 전수 대조 결과 payload 밖 은닉 변경은 없고, `git status --short` 는 이번 세션 산출물 외 저장소 뮤테이션이 없음을 확인시킨다.

## 위험도

NONE
