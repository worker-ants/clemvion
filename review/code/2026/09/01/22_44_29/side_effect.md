# 부작용(Side Effect) 코드 리뷰

## 검토 범위에 대한 메모

이번 changeset 81개 파일 중 실제 실행 코드/테스트는 4개(`plan_guard.py`, `test_plan_guard.py`,
`spec-links.test.ts`, `stray-tool-tags.test.ts`)뿐이고, 나머지는 `plan/**` 트래킹 문서·
`review/code/2026/09/01/22_25_37/**`(1라운드 리뷰 산출물)·`review/consistency/2026/09/01/**`
(consistency-checker 세션 산출물, `--spec` 6라운드분)·`spec/conventions/error-codes.md` 본문
정정 1건이다. 이번 라운드는 직전 라운드(`22_25_37`)의 side_effect.md 가 이미 낸 판정을
독립적으로 재검증하는 형태로 진행했다 — 리포트 문구를 그대로 받지 않고 코드를 직접 열어 대조함.

## 발견사항

- **[INFO]** `_CHECKBOX` 정규식 확장(blockquote 접두 허용)이 모듈 전역 상수라 `_all_checkboxes_done()` 의 모든 호출 대상에 소급 적용된다
  - 위치: `.claude/hooks/_lib/plan_guard.py:87`(정의), `:259`(유일한 사용처, `_all_checkboxes_done` 내부)
  - 상세: `_CHECKBOX = re.compile(r"^\s*[-*]\s+\[(?P<mark>[ xX])\]")` → `re.compile(r"^[\s>]*[-*]\s+\[(?P<mark>[ xX])\]")`. 저장소 전체에서 `_CHECKBOX` 참조가 정의 1곳·사용 1곳뿐임을 직접 grep 으로 재확인했다. `_all_checkboxes_done()` 의 반환값(`complete_pending`)이 `evaluate_plan()`(`:271-330`) 안에서 실제로 어디에 쓰이는지 코드를 직접 추적했다: `complete_pending` 은 `PlanDecision` 의 두 번째 필드(`complete_but_in_progress`, Stop-gate 소프트 넛지 전용)에만 들어가고, 첫 번째 필드(`untouched`, push 하드블록)는 오직 `handled`(plan 파일이 갱신·이동됐는지)로만 결정된다(`:306,326-330`). 즉 이 정규식이 넓어져 어떤 문서가 "이제서야 완료로 판정" 되더라도, 그로 인해 **push 가 새로 막히는 경로는 없다** — 최악의 경우도 Stop nudge 문구("완료된 것 같은데 이동을 잊었다")가 잘못 뜨는 정도다. blast radius 는 in-progress plan 의 소프트 안내로 국한된다.
  - 이 변경 자체가 의도적으로 넓힌 확장이며, diff 의 인라인 주석이 스스로 "역방향 오탐 부재"를 실측(인용문 안 `[ ]` 6건 중 불릿 구조 3건)해 두었다 — `grep -rnP '^\s*>[\s>]*[-*]\s+\[ \]' plan/` 로 직접 재현해 일치를 확인했다. 다만 그 실측은 **현재 스냅샷 한정**이다. 앞으로 "체크박스 문법을 blockquote 로 예시하는 서술"(`> - [ ] 예시` 형태)이 plan 문서에 추가되면 오탐 가능성이 구조적으로 남아 있다 — 코드가 fenced code block 을 구분하지 않는 것은 이번 diff 가 새로 만든 gap 이 아니라 옛 정규식에도 있던 pre-existing 특성이다.
  - 제안: 조치 불요(blast radius 가 소프트 넛지로 이미 좁고, 역방향 실측도 남아 있음). 참고용 기록.

## 확인했으나 문제 없음 (근거 기록)

- **`stray-tool-tags.test.ts` 의 `mkdtemp`/`rmSync` 픽스처(W4 조치분)** — 저장소 트리 밖 `os.tmpdir()` 에만 쓰고 `finally` 블록에서 `fs.rmSync(tmp, { recursive: true, force: true })` 로 정리한다(`stray-tool-tags.test.ts:135-151` 직접 확인). `spec-links.test.ts` 의 신규 멀티라인 ANCHOR 픽스처도 기존 `beforeAll`/`afterAll` 안에 들어가 별도의 tempdir 생성 없이 기존 정리 경로(`fs.rmSync(root, ...)`, `spec-links.test.ts:77-78`)를 그대로 탄다 — 새 side effect 표면이 추가되지 않았다.
- **`walkTree` 호출 통합(`collectScanTargets`)** — `stray-tool-tags.test.ts:83-90`. 전제 테스트와 `findStrayTags` 가 같은 함수를 공유해 `skipDir`/`includeFile` 옵션이 한쪽만 바뀌는 drift 표면을 없앴다(사본이 둘이던 초판 대비). 부작용 관점에서 개선.
- **`test_plan_guard.py` 신규 테스트 3건** — `tempfile.TemporaryDirectory()` 컨텍스트 매니저만 쓰고(`:273-301`), `mock.patch.object` 도 컨텍스트 매니저 범위 안에서만 유효해 테스트 종료 시 자동 원복된다. 저장소 파일이나 전역 상태를 건드리지 않는다.
- **push 하드블록 로직 미변경 재확인** — `evaluate_plan()`(`plan_guard.py:271-330`) 자체는 이번 diff 대상이 아니며(diff 범위는 정규식 리터럴 한 줄 + 주석), `git diff origin/main...HEAD --stat -- .claude/hooks/_lib/plan_guard.py` 로 실측(13줄 추가/1줄 삭제, 전부 정규식+주석)해 diff 범위가 프롬프트에 보인 그대로임을 확인했다.
- **`plan/complete/**`·`plan/in-progress/**` 문서의 `</content>`/`</invoke>` 태그 삭제** — 저장소 전체(`.claude`, `codebase`)에서 이 문자열을 파싱 마커로 쓰는 non-test 코드가 있는지 확인했으나 0건. 삭제가 다른 동작에 영향을 주지 않는다.
- **`review/code/**`·`review/consistency/**` 신규 세션 산출물 파일들의 대량 추가(60여 개)** — 이들은 코드 실행 중 생성되는 파일이 아니라 harness 가 이전 리뷰/consistency 라운드에서 이미 디스크에 쓴 것을 이번 커밋에 반영하는 문서 파일이다. `plan-lifecycle.md` 규약대로 `review/**` 는 gitignore 대상이 아니라 커밋되는 것이 정상이므로 부작용이 아니다.
- **`spec/conventions/error-codes.md` 본문 정정** — 순수 서술 문단 추가/수정이며 실행 코드·설정값·환경변수를 참조하지 않는다.
- **환경 변수·네트워크 호출·전역 변수 도입 여부** — 4개 실행 코드 파일 전체에서 `os.environ`/`process.env` 읽기·쓰기, `fetch`/`http` 류 네트워크 호출, 새 모듈 전역(정규식 상수 `_CHECKBOX` 자체 제외, 이는 기존 전역의 리터럴 변경일 뿐 신규 전역 도입이 아님) 도입을 확인했으나 없음.
- **공개 시그니처/인터페이스 변경** — `_all_checkboxes_done(repo_root, plan_rel)` 함수 시그니처, `findBrokenLinks`/`findStrayTags` 등 공개 함수 시그니처 모두 변경 없음(순수 정규식/테스트 추가).

## 요약

이번 changeset 의 유일한 실질 부작용 표면은 `plan_guard.py` 의 `_CHECKBOX` 전역 정규식 확장이며, 코드 추적으로 그 영향이 in-progress plan 의 Stop-gate 소프트 넛지로 국한되고 push 하드블록에는 영향이 없음을 직접 확인했다(직전 라운드 side_effect.md 의 동일 주장을 독립 재검증). 신규 테스트 3파일(`test_plan_guard.py`, `spec-links.test.ts` 보강, `stray-tool-tags.test.ts` 신규)은 모두 저장소 트리 밖 tempdir 만 사용하고 `finally`/`afterAll` 로 정리하며, mock 은 컨텍스트 매니저 범위로 한정돼 테스트 종료 후 잔여 상태가 없다. 시그니처·공개 인터페이스·환경 변수·네트워크 호출은 이번 diff 범위에 존재하지 않는다. 대량으로 추가된 `review/**` 세션 산출물 파일들은 harness 관례상 정상적으로 커밋되는 기록물이라 부작용으로 분류하지 않았다. 리뷰 작업 중 저장소 트리에 어떤 파일도 쓰거나 mutate 하지 않았음 — `git status --short` 로 확인.

## 위험도

LOW
