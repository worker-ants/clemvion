# 변경 범위(Scope) Review — `.claude/tests/README.md` 외 27개 파일

## 검토 방법

`git diff --stat origin/main...HEAD` 로 실제 커밋 2개(`30943e8c8`, `e94230233`)의 전체 diff
(28파일)를 프롬프트 페이로드와 대조했다. 두 커밋 메시지, `plan/in-progress/harness-review-gate-followups.md`
의 해당 체크리스트 항목(2026-09-02 완료 표기), 그리고 이 PR 자신의 1라운드 `/ai-review` 산출물
(`review/code/2026/09/02/11_27_26/{SUMMARY,RESOLUTION}.md`)을 근거로 "요청된 범위"를 재구성했다.
요청 범위: *frontend 테스트 코드가 어떤 게이트에서도 타입체크되지 않는 사각을 backend 와 같은 방식의
ratchet 게이트로 막는다* + *그 게이트 신설에 대한 1라운드 리뷰의 Critical 2·Warning 2 조치*.

## 발견사항

- **[INFO]** backend 스크립트(`scripts/check-backend-typecheck-ratchet.py`)를 요청 범위(frontend
  게이트 신설) 밖까지 리팩터링해 판정 로직 전체를 신규 공유 코어 `scripts/_typecheck_ratchet.py`
  로 옮기고, backend 엔트리포인트는 `RatchetConfig` 설정만 남겼다.
  - 위치: `scripts/check-backend-typecheck-ratchet.py` (기존 199줄 로직 삭제, `_typecheck_ratchet`
    import 로 대체) / `scripts/_typecheck_ratchet.py` (신규, 230줄)
  - 상세: 엄밀히는 "frontend 에 새 게이트 하나 추가"만으로 충분했고, 기존에 정상 동작하던 backend
    스크립트를 건드리지 않는 선택지도 있었다. 다만 (1) 커밋 메시지·docstring 양쪽에 "이 저장소가
    같은 클래스의 사본 drift 로 이미 세 번 데였다"(`plan_guard.py` ↔ `plan-stale-audit.sh` 등)는
    구체적 선례가 적혀 있고, (2) 리팩터가 동작을 보존했는지 `test_typecheck_ratchet.py` 의
    `PerPackageShapeTest`/`EntrypointWiringTest` 로 backend/frontend 양쪽을 subTest 로 커버하며,
    (3) 커밋 메시지에 실측(backend ratchet 199/38 — 리팩터 무회귀)이 명시돼 있다. 이 항목은 이미
    1라운드 자체 리뷰(`review/code/2026/09/02/11_27_26/SUMMARY.md` "조치 불요" 절)에서 동일하게
    지적·검토돼 "근거 충분, 조치 불요"로 판정된 바 있고, 이번 검토에서도 그 판단이 유지된다 —
    over-engineering 이라기보다 이 저장소가 반복 검증한 실패 클래스(사본 drift)를 미리 차단하는
    설계 선택으로 본다.
  - 제안: 조치 불요. 다만 향후 세 번째 패키지(예: `codebase/packages/*`)가 같은 사각을 필요로 할
    때 이 공유 코어가 실제로 재사용되는지가 이 설계 선택의 사후 검증 포인트다.

- **[INFO]** `codebase/frontend/src/test/jest-axe.d.ts` / `vitest-matchers.d.ts` 는 "frontend
  게이트 신설"이라는 제목과 무관해 보이지만, 실측 근거가 있는 전제조건 수정이다.
  - 위치: `codebase/frontend/src/test/jest-axe.d.ts` (19줄 삭제) / `codebase/frontend/src/test/vitest-matchers.d.ts` (신규 27줄)
  - 상세: `check-frontend-typecheck-ratchet.py` 의 docstring 과 plan 체크리스트 정정문에 "분리 전
    전체 진단이 1,414건이었고 그중 1,256건이 `jest-axe.d.ts` 의 `declare module "vitest"` shadowing
    버그에서 나온 phantom 이었다"는 실측이 명시돼 있다 — 고치지 않으면 baseline 자체가 무의미해지는
    선행 결함이라 같은 PR 안에서 처리하는 것이 합리적이다. `AmbientDeclarationIsAModuleTest` 로
    회귀도 고정했다.
  - 제안: 조치 불요.

- **[INFO]** 이번 diff 에 이전 리뷰 라운드(`review/code/2026/09/02/11_27_26/`)의 산출물 10개
  파일(SUMMARY.md·RESOLUTION.md·9명 reviewer 개별 리포트·meta.json·_retry_state.json)이 함께
  커밋돼 있다.
  - 위치: `review/code/2026/09/02/11_27_26/*`
  - 상세: `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 저장
    규약과 developer SKILL 의 "구현 완료 후 `/ai-review` + fix 는 상시 의무" 규약에 부합하는
    표준 산출물이며, 이번 PR 자신의 1라운드 리뷰 기록이다. 무관한 파일이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `.claude/tests/test_backend_typecheck_ratchet.py` 삭제 + `.claude/tests/test_typecheck_ratchet.py`
  신규 생성이 git 상 rename 으로 인식되지 않고 전량 삭제+신규로 표시된다(파일명·내부 구조가 상당히
  달라져 diff 알고리즘이 rename 유사도 임계값을 못 넘긴 것으로 보인다).
  - 위치: `.claude/tests/test_backend_typecheck_ratchet.py` (deleted) / `.claude/tests/test_typecheck_ratchet.py` (new)
  - 상세: 리뷰 판단에는 영향 없음(git 메커니즘의 한계이며 실제 diff 는 논리적으로 test 파일 병합).
    prompt payload 에는 두 파일이 별도 항목(파일 2, 파일 3)으로 나열돼 있어 "삭제 후 신규 추가"로
    오인될 수 있으나 실제로는 단일 논리적 변경(backend 전용 → backend+frontend 공유 테스트 파일).
  - 제안: 조치 불요 — 이미 1라운드 SUMMARY 에도 동일하게 기록됨.

의미 없는 포맷팅/공백만 바뀐 hunk, 요청과 무관한 파일 수정, 불필요한 주석 추가/삭제, 미사용
임포트, 의도치 않은 설정 변경은 발견되지 않았다. 모든 hunk 가 "frontend typecheck ratchet 게이트
신설" 또는 "그 게이트에 대한 1라운드 리뷰 Critical/Warning 조치"라는 두 목적 중 하나로 직접
추적된다 — `PROJECT.md`(로컬 명령 문서화 1줄), `.github/workflows/{backend,frontend,harness}-checks.yml`
(신규 잡·pathspecs 등재), `.claude/tests/test_workflow_yaml_structure.py`(신규 잡의 `if` 조건
레지스트리 1줄 등재), `codebase/frontend/tsconfig.typecheck.json`(신규, 게이트 전용 설정),
`scripts/frontend-typecheck-baseline.json`(신규 baseline) 모두 동일 축.

## 요약

두 커밋(`30943e8c8` 게이트 신설, `e94230233` 1라운드 리뷰 조치)은 plan 항목 "frontend 테스트가
어떤 게이트에서도 타입체크되지 않는다"라는 단일 목적에 수렴한다. backend 스크립트를 공유 코어로
리팩터링한 것과 `jest-axe.d.ts` shadowing 버그를 함께 고친 것은 문자 그대로의 요청 범위("frontend
게이트 신설")보다 넓지만, 둘 다 이 저장소의 반복된 실패 이력(사본 drift·미검증 전제)에 대한 구체적
근거와 실측·회귀 테스트를 동반하며, 동작 보존이 검증됐다(backend ratchet 199/38 무회귀). 이미 PR
자체의 1라운드 scope 리뷰에서 동일 판정("조치 불요")이 내려진 항목이고, 이번 독립 검토에서도 근거의
구체성·검증 가능성 면에서 그 판정이 유지된다. Critical/Warning 급 범위 위반은 없다.

## 위험도

LOW
