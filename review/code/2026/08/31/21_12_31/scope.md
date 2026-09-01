# 변경 범위(Scope) 리뷰

## 검증 방법

- `git log --oneline -5` 로 이번 리뷰가 커버하는 커밋 범위 확인: `adc4a3ff6`(엔진 에러코드 9지점 리다이렉트+가드) → `4141c64e3`/`eb65d3e6d`/`18062a61a`(3라운드 fix 커밋).
- `git diff --stat origin/main -- .` 로 전체 변경 파일(42개) 전수 확인 — payload(`_prompts/scope.md`)에 열거된 파일과 정확히 일치. 은닉·drive-by 변경 없음.
- `codebase/` 변경 6파일 각각을 `git diff origin/main -- <file>` 로 직접 열어 전문 확인(프롬프트에서 diff 가 생략된 `engine-error-code-anchor-guard.ts`·`engine-error-code-anchor.spec.ts` 포함).
- `plan/complete/exec-intake-followups.md`(신규, rename 대상) 전문 확인 — ARCH#5 항목의 완료 기록과 이번 코드 변경이 1:1 대응하는지 대조.
- `git status --short` — untracked 는 이번 리뷰 세션 산출물 디렉터리(`review/code/2026/08/31/21_12_31/`)뿐, 저장소 뮤테이션 없음.

## 발견사항

없음. CRITICAL/WARNING 급 스코프 이탈 없음. 참고용 INFO만 아래 기록.

- **[INFO]** 신규 AST 가드 3파일(`engine-error-code-anchor-guard.ts` 261줄 + `-fixture.ts` 65줄 + `.spec.ts` 158줄, 합 484줄)이 "맨 문자열 9지점을 상수로 리다이렉트"라는 최소 처방보다 넓은 산출물이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,spec.ts}` (전부 신규 파일)
  - 상세: 리다이렉트 자체는 `codebase/backend/src/nodes/core/error-codes.ts`(신규 `EngineErrorCode` const, +61줄) + 소비처 4파일(9개 hunk, import 1줄 + 치환 각 1줄)로 끝난다. 가드 3파일은 그 회귀를 막는 재발 방지 장치로 추가된 것인데, (1) `plan/complete/exec-intake-followups.md` 의 완료 기록이 "재발 방지: `engine-error-code-anchor-guard.ts`(AST)"를 작업의 명시적 산출물로 서술하고, (2) 같은 디렉터리에 이미 동형 패턴(`redis-fail-open-catalog-guard.ts` + spec, pure-logic guard/fixture/consuming-spec 3분리)이 존재해 저장소 기존 관례를 그대로 따랐으며, (3) 가드가 막는 회귀 축(엔진 모듈의 앵커 없는 맨 문자열 재유입)이 이번 리다이렉트가 고치는 결함과 동일 축이라 "요청과 무관한 기능 확장(over-engineering)"으로 보기 어렵다. 직전 라운드(`20_27_29/scope.md`)에서도 동일 지적이 INFO #8 로 이미 기록·처분(조치 불요)됐고, 이번 재확인에서도 동일 결론.
  - 제안: 조치 불요. 정보 제공 목적.
- **[INFO]** 이번 누적 diff(42파일)의 상당수(33개)는 직전 3라운드(`20_27_29`/`20_43_35`/`20_59_14`) ai-review 의 산출물(`SUMMARY.md`/`RESOLUTION.md`/개별 리뷰어 리포트/`meta.json`/`_retry_state.json`)이다.
  - 위치: `review/code/2026/08/31/{20_27_29,20_43_35,20_59_14}/**` (전부 신규 파일)
  - 상세: CLAUDE.md 정보 저장 위치 표에 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"가 명시돼 있고, 이 저장소는 리뷰 라운드 산출물을 매 라운드 커밋하는 것이 확립된 관례다. `error-codes-layer-split` 작업 자체와 무관한 다른 기능의 리뷰 산출물이 섞여 들어온 흔적은 없음(3개 디렉터리 전부 이번 작업의 fix→재리뷰 사이클) — 스코프 이탈 아님.
  - 제안: 조치 불요.

## 요약

리뷰 대상 diff 는 `plan/complete/exec-intake-followups.md` ARCH#5 항목("엔진 레벨 에러코드 레이어 분리")에 정확히 대응하며, 원 처방("파일 분리")이 재고 후 "파일은 하나·const 는 둘"로 바뀐 근거가 CHANGELOG·plan·소스 JSDoc 세 곳에 일관되게 기록돼 있다. 실제 코드 변경은 (a) `error-codes.ts` 신규 `EngineErrorCode` const 추가(+61줄, 기존 `ErrorCode`·기타 export 무변경), (b) 4개 소비처 파일에서 9개 맨 문자열 지점을 상수 참조로 치환(각 hunk 가 import 1줄 + 해당 지점 치환에 정확히 국한, 무관한 리팩토링·포맷팅·주석 정리·불필요 import 없음)으로 구성된다. 신규 AST 가드 3파일은 최소 처방보다 넓지만 저장소 기존 형제 패턴(`redis-fail-open-catalog-guard.ts`)을 그대로 따르고 plan 문서가 명시적 산출물로 서술해 스코프 이탈로 보기 어려우며, 직전 라운드 scope 리뷰에서도 동일하게 처분됐다. plan 문서 이동(`in-progress`→`complete`)과 체크박스 갱신은 이 작업 하나에 국한되고, 3라운드분 리뷰 산출물 커밋은 프로젝트 확립 관례(review/code/** 저장 규약)를 따른다. `git diff --stat` 전수 대조 결과 payload 밖 은닉 변경은 없다.

## 위험도

NONE
