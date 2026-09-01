# 변경 범위(Scope) 리뷰

## 검증 방법

- `_prompts/scope.md` 에 실린 32개 파일 항목 전부를 diff+게이트 번호로 확인.
- `git diff --stat origin/main -- .` 로 payload 밖의 은닉 변경이 있는지 대조 → **정확히 31개 파일**(plan 이동은 rename 1건으로 집계), payload 와 100% 일치. 은닉 drive-by 변경 없음.
- 게이트가 잘려 프롬프트에 diff 가 생략된 파일 7(`engine-error-code-anchor-guard.ts`, 261줄)은 저장소에서 `Read` 로 직접 전문 열람.
- 형제 가드 패턴 실재 확인: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` + `.spec.ts` 존재 확인(`ls`) → 신규 가드 3파일 구성(guard/fixture/spec 분리)이 저장소 기존 관례를 따른다는 서술이 사실과 일치.
- `git log --oneline -5` 로 커밋 이력 확인: `adc4a3ff6`(본 리팩터) → `4141c64e3`(1라운드 리뷰 fix) → `eb65d3e6d`(2라운드 리뷰 fix, `20_43_35` W1 대응) — 리뷰 라운드별 fix 커밋이 각 라운드가 지적한 항목에만 대응함을 커밋 메시지·`RESOLUTION.md` 대조로 확인.
- 저장소 파일은 뮤테이션하지 않음(읽기 전용 리뷰). `git status --short` 확인 결과 이번 리뷰가 새로 만든 `review/code/2026/08/31/20_59_14/` 외 변경 없음.

## 발견사항

없음. CRITICAL/WARNING 급 스코프 이탈은 발견되지 않았다.

- **[INFO]** diff 32개 파일 중 21개(`review/code/2026/08/31/20_27_29/*`, `review/code/2026/08/31/20_43_35/*`)가 이번 작업 자체가 아니라 **선행 두 리뷰 라운드의 산출물**(SUMMARY/RESOLUTION/개별 reviewer 리포트/meta.json/_retry_state.json)이다.
  - 위치: `review/code/2026/08/31/20_27_29/` 및 `review/code/2026/08/31/20_43_35/` 하위 전체(파일 11~32) — 전부 신규 파일이라 게이트 인용 대상 없음, 디렉터리 경로로 대체.
  - 상세: 리뷰 관점만 보면 "요청된 변경(9지점 리다이렉트) 외 추가 파일"로 비칠 수 있으나, 이 프로젝트는 `CLAUDE.md` 의 정보 저장 위치 표(코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 따라 리뷰 산출물을 저장소에 커밋하는 것이 표준 워크플로다. 두 라운드 모두 이번 작업(`ai-turn-orchestrator.service.ts` 등 8개 소스 파일 + plan 이동)만을 대상으로 실행됐고, `RESOLUTION.md` 의 W1 항목이 각 라운드의 fix 커밋(`4141c64e3`, `eb65d3e6d`)과 1:1 대응함을 확인했다 — 무관한 작업의 리뷰 산출물이 섞여 들어온 것이 아니다.
  - 제안: 조치 불요. 관례에 부합하는 정상 산출물.

- **[INFO]** 신규 회귀 가드 3파일(`engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}`, 총 480줄)이 "9개 맨 문자열을 상수로 리다이렉트"라는 원 처방보다 넓은 산출물이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`(신규 261줄), `engine-error-code-anchor-fixture.ts`(신규 65줄), `engine-error-code-anchor.spec.ts`(신규 154줄)
  - 상세: 순수 리다이렉트만이면 파일 1~5(합 약 100줄)로 끝났을 작업이나, 오탈자 재발 방지를 위한 AST 가드가 함께 추가됐다. `plan/complete/exec-intake-followups.md` 의 ARCH#5 완료 기록이 "재발 방지: `engine-error-code-anchor-guard.ts`(AST)"를 작업 산출물로 명시하고 있고, 동일 디렉터리의 `redis-fail-open-catalog-guard.ts`+`.spec.ts` 형제 패턴을 실재 확인했다 — "정규식 대신 AST 가드 + 별도 spec" 은 이 저장소의 기존 관례이며 이번 작업이 고치는 결함(맨 문자열 재유입)과 가드가 막는 회귀 클래스가 동일 축이다. `fixture.ts` 분리는 가드 성공 시 자기 테스트 대상이 소멸하는 자멸 문제를 막기 위한 것으로 `engine-error-code-anchor-fixture.ts` 헤더 주석에 근거가 남아 있다.
  - 제안: 조치 불요. 스코프 이탈이 아니라 이 저장소의 표준 "고친 자리에 회귀 가드를 남긴다" 관례 적용으로 판단.

- **[INFO]** 2라운드에 걸친 가드 스캔 범위 확장(`collectBoundCodes` 가 식별자 바인딩 4형태 → 생성자 positional 인자 포함 5형태로 확장, `ANCHORED_ELSEWHERE` 에 `RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 추가·`RESUME_FAILED` 제거)가 원 diff(`adc4a3ff6`) 이후 후속 커밋에서 발생했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:126-152`(`collectBoundCodes` JSDoc "## 여기서 형태 넓히기를 멈춘다"), `:46-52`(`ANCHORED_ELSEWHERE` 의 `RESUME_*` 두 항목)
  - 상세: 확장 자체는 새 기능 추가가 아니라 `20_43_35` 라운드 리뷰가 지적한 WARNING("문서한 보장이 구현보다 넓다" — JSDoc 은 "새 맨 문자열 코드가 생기면 RED" 라 적었는데 생성자 인자 형태를 못 봤다)에 대한 직접 대응이며, 커밋 메시지(`eb65d3e6d`)·`RESOLUTION.md` W1 서술과 정확히 일치한다. 확장 직후 여섯 번째 형태(`markExecutionCancelled(executionId, 'RESUME_FAILED')`, 일반 메서드 인자)가 추가로 발견됐으나, 가드 파일 자신의 JSDoc("## 여기서 형태 넓히기를 멈춘다")이 그 지점에서 명시적으로 스코프를 확정하고 이유(형태 공간이 무한히 열려 있음)를 남겼다 — 무한정 스코프가 번지는 것을 스스로 차단한 흔적이다.
  - 제안: 조치 불요. 이 확장은 스코프 크리프가 아니라 같은 작업의 리뷰 사이클 내 정상적 결함 수정.

## 요약

리뷰 대상 diff(31개 파일, origin/main 대비)는 `plan/complete/exec-intake-followups.md` 의 ARCH#5 항목("엔진 레벨 에러코드 레이어 분리")과 그 완료 과정에서 발생한 2회의 리뷰 라운드(20_27_29, 20_43_35)로 정확히 구성된다. 핵심 소스 변경(파일 1~5)은 import 1줄 + 해당 지점 치환으로 국한돼 무관한 포맷팅·주석·리팩토링·임포트 정리가 섞여 있지 않으며, `git diff --stat` 대조로 payload 밖 은닉 변경이 없음을 확인했다. 신규 회귀 가드 3파일은 원 처방보다 넓은 산출물이지만 plan 문서가 명시한 작업 산출물이고 저장소의 기존 형제 가드 패턴을 그대로 따른다. 다수를 차지하는 `review/code/**` 21개 파일은 별개 작업이 아니라 이 작업 자체에 대한 리뷰 산출물이며 프로젝트 표준 저장 위치 관례에 부합한다. 후속 라운드에서의 가드 스캔 범위 확장도 직전 라운드가 지적한 WARNING 에 국한된 대응으로, 확장 도중 스스로 경계를 문서화해 추가 확산을 막았다. 설정 파일·무관 모듈·타 노드 핸들러 파일 변경은 없다.

## 위험도

NONE
