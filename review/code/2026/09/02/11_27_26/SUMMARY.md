# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — frontend typecheck ratchet 게이트 신설 자체는 견고하지만, (1) 진단 파서 정규식이 괄호를 포함한 경로(Next.js route group)를 조용히 누락시켜 이미 baseline 이 실측치보다 1건 적게 커밋됐고, (2) 신규 게이트가 의존하는 스크립트/코어/baseline 파일이 정작 그 게이트를 트리거해야 할 CI 워크플로(`frontend-checks.yml`/`backend-checks.yml`) 자신의 `changes` pathspecs 에 미등재되어 있어 향후 그 파일들만 바뀐 PR 은 실제 `tsc` 검증 없이 조용히 통과한다. 두 건 모두 이 PR 이 스스로 막으려던 "게이트가 조용히 헐거워진다" 실패 클래스가 재발한 형태다.

**주의 — forced reviewer 결과 상태**: router 가 `documentation, maintainability, requirement, scope, security, side_effect, testing` 7명을 안전상 강제 포함했고, 전원 결과(성공 + 본문 확보) 확인됨. 미확보/재시도 필요 reviewer 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `DIAGNOSTIC` 정규식의 file 캡처 그룹(`[^(\s][^(]*`)이 첫 `(` 에서 매치를 멈춰, 경로에 리터럴 `(` 를 포함한 tsc 진단 줄(Next.js App Router route group `(main)`/`(editor)`/`(auth)`, 이 저장소가 실제로 쓰는 구조)을 `count_by_file()` 이 조용히 버린다. 실측 재현(2회 동일): `npx tsc --noEmit -p tsconfig.typecheck.json` → 52건/15파일, 반면 게이트 자체 실행 → "51건/14파일 — baseline 과 일치, OK"(exit 0). 누락된 1건은 `src/app/(main)/w/[slug]/integrations/[id]/__tests__/scope-tab.test.tsx(44,3)`. `(main)/(editor)/(auth)` 아래 테스트 파일의 향후 타입 회귀는 이 게이트를 영구히 통과한다. 커밋된 baseline·README·plan 의 "51건/14파일" 수치도 이로 인해 부정확. | `scripts/_typecheck_ratchet.py:40`(`DIAGNOSTIC`), `:110-117`(`count_by_file()`) | file 캡처를 줄 끝의 `(숫자,숫자): error TS숫자` 를 우선 매치하는 탐욕적 패턴(`^(?P<file>.+)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+)`)으로 교체. Next.js route group 경로 픽스처를 `ParseTest`/`count_by_file` 테스트에 추가해 회귀 방지. baseline 을 실측치(52/15)로 `--update` 재생성 |
| 2 | documentation / side_effect | 신규 `typecheck-ratchet` 게이트가 실행 대상으로 삼는 `scripts/_typecheck_ratchet.py`(공유 코어, 신규) · `scripts/check-frontend-typecheck-ratchet.py`(신규) · `scripts/frontend-typecheck-baseline.json`(신규 baseline) 중 어느 하나도 `frontend-checks.yml` 자신의 `changes.pathspecs` 에 없다(`backend-checks.yml` 도 신규 공유 코어 `_typecheck_ratchet.py` 미등재는 동일). `_changed-paths.yml` 의 skip-job 메커니즘상 이 파일들만(예: `--update` baseline-only 커밋, 코어 로직만 수정) 바뀐 PR 은 `relevant=false` 로 판정돼 `typecheck-ratchet` 잡이 실제 `tsc` 를 한 번도 돌리지 않고 "무관한 변경 — 검사 생략"으로 통과 보고한다. `harness-checks.yml` 쪽에는 이 등재 원칙이 정확히 적용됐으나(코어 파일 포함), 정작 실제 검증을 수행하는 `frontend-checks.yml`/`backend-checks.yml` 자신에는 빠졌다. 이 저장소가 "여섯 번 샜다"고 스스로 기록한 실패 클래스가 harness 계층이 아닌 실제 검증 계층에서 재발. (side_effect 리뷰어는 이 항목을 WARNING 으로 평가했으나, documentation 리뷰어의 CRITICAL 판정—실제 검증 자체가 무력화된다는 직접적 근거—을 채택해 통합) | `.github/workflows/frontend-checks.yml`(`changes` 잡 `pathspecs:`, 라인 38–64, 이 diff 밖 기존 블록) / `.github/workflows/backend-checks.yml`(`changes` 잡 `pathspecs:`, 라인 56–68) | `frontend-checks.yml` 의 `changes.pathspecs` 에 `scripts/_typecheck_ratchet.py` · `scripts/check-frontend-typecheck-ratchet.py` · `scripts/frontend-typecheck-baseline.json` 추가, `backend-checks.yml` 에 `scripts/_typecheck_ratchet.py` 추가. 가능하면 `test_harness_checks_paths_coverage.py` 류 커버리지 가드를 이 두 워크플로 자신에도 일반화 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / maintainability | `TEST_FILE_RULES["frontend"]` 정규식(`__tests__/`·`.test.ts(x)$`·`src/test/`)이 `codebase/frontend/tsconfig.json` 의 실제 exclude 패턴 중 `.spec.ts(x)$` 를 빠뜨려 비대칭(backend 쪽은 대칭 확인됨). 현재는 저장소의 frontend `.spec.ts` 파일 3개가 전부 `__tests__/` 안에 있어 우연히 통과하지만, 향후 `__tests__/`/`src/test/` 밖에 colocate 된 `*.spec.ts` 가 baseline 에 진단을 내면 "프로덕션 파일" 로 오분류돼 거짓 실패를 낸다(fail-safe 방향이라 위험은 낮음). 이 PR 이 스스로 경고하는 "판정 규칙 사본이 갈리는" 위험의 축소판 | `.claude/tests/test_typecheck_ratchet.py:77-80`(`TEST_FILE_RULES["frontend"]`) | `\.(?:test|spec)\.tsx?$` 로 `.spec.ts(x)` 갈래 추가, 또는 tsconfig exclude 배열에서 정규식을 도출하는 방식 검토 |
| 2 | testing / architecture / side_effect | `test_typecheck_ratchet.py` 가 공유 코어(`_typecheck_ratchet.py`)를 `"typecheck_ratchet_core"`(CORE) 와 `"_typecheck_ratchet"`(엔트리포인트가 표준 import 로 재로드) 두 개의 다른 `sys.modules` 키로 이중 로드한다. 실측 재현: `isinstance(CONFIGS["backend"], CORE.RatchetConfig)` → `False`. 결과적으로 `PerPackageShapeTest`/`FrontendTypecheckConfigTest` 가 검사하는 `CONFIGS[label]` 은 속성값은 같지만 클래스가 다른 복제본이고, `VerdictTest`/`FailClosedTest`/`RunTscFailClosedTest` 는 전부 `fake_config()` 로 만든 새 인스턴스만 실행해 "실제 엔트리포인트의 `CONFIG`+`main` 조합이 정말 동작하는가"는 이 스위트에서 한 번도 end-to-end 로 검증되지 않는다. 삭제된 구버전 스위트에는 없던 회귀 | `.claude/tests/test_typecheck_ratchet.py:63`(`CORE = load_module(...)`), `:70-73`(`CONFIGS = {...}`) | `load_module(CORE_PATH, "_typecheck_ratchet")` 로 등록해 엔트리포인트가 참조하는 이름과 통일하거나, `CONFIGS` 로딩 전 `sys.modules["_typecheck_ratchet"] = CORE` 별칭 등록 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | "baseline 에 들어와도 되는 파일(테스트 파일)" 판별 규칙(`TEST_FILE_RULES`)이 프로덕션 `RatchetConfig` 밖, 테스트 전용 딕셔너리로만 존재해 SoT 가 갈라져 있다(fail-loud 라 조용한 통과로는 안 이어짐) | `.claude/tests/test_typecheck_ratchet.py:77` | 판별 규칙을 `RatchetConfig` 필드로 승격하거나 각 엔트리포인트 옆에 문서화 |
| 2 | architecture / side_effect | 두 엔트리포인트가 `sys.path.insert(0, ...)` 로 같은 디렉터리를 각각 삽입 — 같은 프로세스에서 둘 다 로드되면 `sys.path` 중복 삽입(저장소 기존 관례 범위 내, 당장 충돌 없음) | `scripts/check-backend-typecheck-ratchet.py:48`, `scripts/check-frontend-typecheck-ratchet.py:50` | 스크립트 수가 늘면 `if path not in sys.path` 가드 고려 |
| 3 | documentation | `jest-axe.d.ts` shadowing 버그의 진단 건수가 두 문서에서 다르게 인용(`vitest-matchers.d.ts` "TS2305 1,128건" vs `check-frontend-typecheck-ratchet.py`/`README.md`/plan "phantom 1,256건") — 부분집합 관계로 추정되나 명시 안 됨 | `codebase/frontend/src/test/vitest-matchers.d.ts`, `scripts/check-frontend-typecheck-ratchet.py` | `vitest-matchers.d.ts` 문장에 "(1,256건 phantom 중 TS2305 만)" 구절 추가 |
| 4 | testing | ambient 타입 선언이 "모듈 파일이어야 augmentation" 이라는 이번 사고의 핵심 불변식을 고정하는 빠른(비-tsc) 회귀 테스트가 없음 — 현재는 ~40초 전체 `tsc` 게이트에만 의존 | `codebase/frontend/src/test/vitest-matchers.d.ts` | `^import `/`^export ` 로 시작하는 줄 존재를 assert 하는 가벼운 유닛 테스트 추가 검토 |
| 5 | maintainability | `RatchetConfig` 7필드 리터럴이 기존 `fake_config()` 헬퍼를 우회해 한 곳 더 중복 | `.claude/tests/test_typecheck_ratchet.py:235-242` | `dataclasses.replace(fake_config(tmp), tsconfig=...)` 로 축소 |
| 6 | maintainability / documentation | docstring 한 문단이 인접 줄 대비 재래핑 누락(약 206자) | `scripts/check-frontend-typecheck-ratchet.py:32` | 인접 줄과 동일 폭으로 재줄바꿈 |
| 7 | documentation | `.claude/tests/README.md` 병합 문단에서 "the PR" 대명사가 두 PR(2026-08-09/2026-09-02) 중 어느 쪽인지 모호 | `.claude/tests/README.md:44` | "the PR" → "that 2026-08-09 PR" 등으로 명시 |
| 8 | testing | `tempfile.mkdtemp()` 임시 baseline 파일에 `tearDown`/`addCleanup` 없음(기존 스타일 계승, 무해) | `.claude/tests/test_typecheck_ratchet.py:123` 등 | 우선순위 낮음 — 헬퍼에 `addCleanup(shutil.rmtree, ...)` 추가 검토 |

### 조치 불요로 확인된 항목 (참고용, 문제 없음)

- **[scope]** backend 스크립트를 공유 코어로 리팩토링한 것은 요청 범위("frontend 게이트 신설")를 기술적으로 넘어서지만, 커밋 메시지·docstring 에 "사본이 갈리면 조용한 통과로 이어진다"는 구체적 선례 근거가 있고 테스트가 양쪽을 커버 — 조치 불요
- **[scope]** `jest-axe.d.ts`/`vitest-matchers.d.ts` 타입 버그 수정은 이 PR 의 전제조건(고치지 않으면 첫 baseline 이 1,414건으로 무의미) — 조치 불요
- **[scope]** 테스트 파일명 변경이 git rename 미감지(전량 삭제+신규로 표시)는 git 메커니즘의 한계일 뿐 스코프 위반 아님
- **[security]** GitHub Actions `@v7` major-tag 핀은 저장소 전역 기존 관례이며 이 PR 이 만든 신규 회귀 아님
- **[security]** `subprocess.run` 은 리스트 인자 + 정적 설정값만 사용해 커맨드 인젝션 경로 없음 — 검증 완료

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | Critical/Warning 없음. `subprocess.run` 인젝션 안전, 액션 핀은 기존 관례 |
| architecture | LOW | SRP/DIP 분리 긍정 평가. TEST_FILE_RULES SoT 분리·`sys.path` 암묵 결합은 INFO |
| requirement | HIGH | **DIAGNOSTIC 정규식 파싱 실패(CRITICAL, 실측 재현)** — 괄호 경로 진단 누락. TEST_FILE_RULES 비대칭 WARNING |
| scope | LOW | 15개 변경 파일 전부 단일 목적에 수렴, 은닉 변경 없음. 확장된 범위는 근거 충분 |
| side_effect | MEDIUM | pathspec 미등재(문서 리뷰어와 동일 이슈, WARNING 판정) + 모듈 이중 로드 INFO |
| maintainability | LOW | TEST_FILE_RULES 비대칭 WARNING(requirement 와 동일 이슈), 사소한 중복/서식 INFO |
| testing | LOW | 모듈 이중 로드로 인한 end-to-end 검증 갭 WARNING(구체적 재현 근거), 기타 INFO |
| documentation | HIGH | **pathspec 미등재(CRITICAL)** — 실제 tsc 검증이 no-op 통과 가능. 수치 불일치 WARNING |

## 발견 없는 에이전트

- security (NONE — INFO 2건만, 조치 불요 항목)

## 권장 조치사항

1. **[Critical #1]** `DIAGNOSTIC` 정규식을 file 캡처가 줄 끝의 `(line,col): error TSxxxx` 를 우선 매치하도록 수정하고, Next.js route group 경로 픽스처로 회귀 테스트 추가 후 baseline 을 실측치(52건/15파일)로 재생성한다.
2. **[Critical #2]** `frontend-checks.yml`/`backend-checks.yml` 의 `changes.pathspecs` 에 `scripts/_typecheck_ratchet.py`·`scripts/check-frontend-typecheck-ratchet.py`·`scripts/frontend-typecheck-baseline.json` 을 등재해, 게이트 의존 파일만 바뀐 PR 에서도 실제 `tsc` 검증이 돌도록 한다.
3. **[Warning #1]** `TEST_FILE_RULES["frontend"]` 에 `.spec.ts(x)$` 갈래를 추가해 tsconfig exclude 패턴과 대칭시킨다.
4. **[Warning #2]** 테스트 하네스의 공유 코어 모듈 로딩을 `_typecheck_ratchet` 이름으로 통일(또는 별칭 등록)해 엔트리포인트의 실제 `CONFIG`+`main` 배선이 end-to-end 로 검증되도록 한다.
5. (선택) INFO 항목 중 수치 불일치(1,128 vs 1,256) 관계 명시, docstring 재래핑, README 대명사 명확화 등 문서 정돈.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(성공 + 본문 확인)
  - **제외**: 아래 표 (6명, router 판단 — 구체적 사유 문자열은 prompt 에 미포함)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 관련 낮음 (harness/CI 도구 계층, 런타임 성능 경로 없음) |
  | dependency | router 판단상 이번 diff 와 관련 낮음 (신규 외부 패키지 의존성 추가 없음) |
  | database | router 판단상 이번 diff 와 관련 낮음 (DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 관련 낮음 (동시성 제어 로직 변경 없음) |
  | api_contract | router 판단상 이번 diff 와 관련 낮음 (외부 API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 관련 낮음 (사용자 대상 문서 없음, 개발자 도구 문서만) |
