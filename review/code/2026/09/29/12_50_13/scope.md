# 변경 범위(Scope) 리뷰

대상: 커밋 `de36badf7` (NERV 정본 전환 단계 1, 파일 14개). 명세는 Task `CLE-T-VA4YA1`. 첫 미러 스냅샷 `d82040273` 은 범위 밖이다.

## 발견사항

- **[INFO]** `codebase/**` 를 건드렸다. Task 경계("codebase 를 건드리지 않는다")와 어긋나지만 의도된 예외이고 범위는 최소다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:251-265`, `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:79-100`
  - 상세: 바뀐 것은 테스트 헬퍼의 수집 필터 한 곳(`inNervMirror`)과 그 테스트뿐이고 제품 코드는 없다. `collectSpecMarkdown` 을 부르는 가드는 `spec-link-integrity` 와 `spec-area-index` 두 개이고, 나머지 spec 가드(`spec-frontmatter` · `spec-code-paths` · `spec-status-lifecycle` · `spec-pending-plan-existence`)는 `spec/2-navigation/` 같은 접두 허용 목록으로 걸러서 미러가 대상이 아니다. 그래서 필터 한 곳이 실제로 필요한 최소 변경이다. 명세의 "옛 트리 walker 가드 제외 규칙" 항목과도 맞는다.
  - 제안: 조치 불필요. 다만 `codebase/**` 가 diff 에 들어왔으므로 push 게이트(`/ai-review`)와 e2e 면제 화이트리스트 판정이 적용된다. PR 본문에 이 예외의 근거를 한 줄 적어 둔다.

- **[INFO]** 이 브랜치만으로는 훅이 막는 것을 거버넌스 문서가 아직 시킨다. 짝 planner PR 과 머지 순서가 결합돼 있다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:11-15`, `.claude/settings.json:36-39`
  - 상세: 훅 docstring 은 "거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때 더한다. 먼저 막으면 문서가 시키는 일을 훅이 막는다" 고 적는다. 그런데 짝 planner PR(`claude/nerv-cutover-1-docs-c46df0`, 커밋 `0c3d549ed`)은 이 브랜치의 조상이 아니다(`git merge-base --is-ancestor` 가 1). 이 브랜치의 `CLAUDE.md` 는 여전히 `project-planner` 의 `spec/**` 쓰기와 자기-반증형 소정정을 안내한다. 이 PR 이 먼저 머지되면 그 흐름이 훅에 막힌다.
  - 제안: 머지 순서(planner PR 먼저)를 PR 본문에 명시한다. 코드 변경은 필요 없다.

- **[INFO]** `spec/README.md` 생성(`render_readme`)은 명세 산출물 목록에 없다
  - 위치: `.claude/tools/nerv-mirror/pull.py:291`, `.claude/tools/nerv-mirror/pull.py:334-358`
  - 상세: 앞 커밋 제목에는 "169편 + README" 가 있어 의도된 산출물로 보인다. 다만 세 가지 비용이 따른다. (1) `README.md` 예외가 미러 제외 정규식 세 곳에 들어갔다(pull.py `mirror_files`, orchestrator `_NERV_MIRROR_REL`, 프런트 `NERV_MIRROR`). (2) README 는 `--all` 에서만 다시 쓴다. D3 는 구현 때 `--task` 로 부분 스냅샷을 쌓는 방식이라 README 의 영역 목록은 `--all` 이후 갱신되지 않는다. 영역 목록은 사실상 인덱스여서 "중앙 매니페스트 없음" 결정과도 가깝다. (3) 본문에 사용 규칙 산문이 들어 있어 거버넌스 문서와 이중 서술이 된다. 또 `mirror_files()` 가 README 를 제외하므로 `--check` 는 README 손편집을 못 잡는다. 훅 docstring 의 "미러는 pull.py 만 쓴다" 보다 CI 보장이 좁다.
  - 제안: README 를 유지한다면 사용 규칙 산문을 줄이고 스냅샷 시점 안내만 남긴다. 또는 `--check` 에 README 지문을 더해 보장을 맞춘다. 최소 조치는 두 보장의 범위가 다르다는 사실을 README 또는 docstring 에 적는 것이다.

- **[INFO]** 명세에 없는 CLI 옵션이 있다. `--basis {approved,latest}` 와 `--spec KEY`
  - 위치: `.claude/tools/nerv-mirror/pull.py:375-378`
  - 상세: 명세는 `--all` 은 `export.zip?layout=tree`, `--task` 는 작업 기준 `?task=` 라고만 정한다. `--basis latest` 를 쓰면 미승인 최신 초안이 미러에 들어간다. 미러를 "구현된 스펙의 스냅샷"으로 두려는 README 문구와 D2("승인본이 없으면 초안")의 취지에서 벗어날 수 있는 손잡이다. `--spec` 은 클레임 없이 키를 직접 지정하는 우회로이고, `--all` 과 함께 쓰면 조용히 무시된다.
  - 제안: 쓰임이 확정되기 전까지 `--basis` 는 `approved` 고정으로 두고 `latest` 를 빼는 쪽이 범위에 맞다. `--spec` 을 남긴다면 `--task` 없이 주면 오류로 처리한다.

- **[INFO]** 새 CI 잡의 무관 변경 판정이 공유 필터에 얹혀 있고, 생략 메시지가 실제 조건과 다르다
  - 위치: `.github/workflows/spec-link-checks.yml:125-140` (메시지는 133줄)
  - 상세: `spec-mirror-integrity` 는 docs 가드용 `changes` 필터(`codebase/**` · `plan/**` · `*.md` 포함)를 그대로 쓴다. 그래서 spec 이나 `.claude` 와 무관한 backend 변경에서도 실행된다. 반면 생략 메시지는 "spec · .claude 경로 변경 없음" 이라고 적는다. 잡이 표준 라이브러리 파이썬 한 줄이라 비용은 미미하다.
  - 제안: 메시지를 실제 조건("docs 가드 대상 경로 변경 없음")에 맞추거나, 전용 pathspecs 를 두는 쪽을 택한다.

- **[INFO]** 훅에 아직 쓰지 않는 확장 틀이 있다(`OWNED_ROOTS` 딕셔너리, 단계 2·3 로드맵 docstring)
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:11-15`, `.claude/hooks/guard_nerv_owned_paths.py:34-37`
  - 상세: 항목은 `spec` 하나뿐이고 `review/` · `plan/` 은 산문과 테스트 주석으로만 예고한다. 테스트는 두 경로가 지금 허용되는 것을 고정하고 "단계 PR 이 기대를 바꾼다" 고 적는다. 기능 확장이 아니라 다음 단계의 diff 를 한 줄로 줄이는 정도라 허용 범위다.
  - 제안: 조치 불필요.

## 범위 밖 변경 없음 확인

- `.claude/settings.json` 은 훅 항목 하나 추가뿐이다.
- `harness-checks.yml` 은 `.claude/settings.json` pathspec 한 줄과 근거 주석이다. 새 테스트 `test_guard_nerv_owned_paths.py` 가 그 파일로 배선을 판정하므로 필요한 등재다.
- `test_workflow_yaml_structure.py` 는 잡 조건 등록부 한 줄이다.
- `CHANGELOG.md` 는 항목 하나이고, `spec-area-index` 언급도 사실과 맞다.
- `.claude/tests/README.md` 는 새 테스트 두 개의 행이다.
- 포맷팅 전용 hunk, 임포트 정리, 무관한 주석 수정, 다른 파일 드라이브바이는 발견하지 못했다.
- `consistency_orchestrator.py` 의 제외는 corpus(`all_spec_files`)에만 걸리고 검사 대상 scope 파일(`--spec` · `--impl-*` 수집)은 그대로다. 미러 필터를 도입 전 실측(번들 순서 단언 RED)이 뒷받침한다.
- 이 리뷰에서 저장소 파일을 수정하지 않았다. `git status --short` 는 리뷰 산출 디렉터리 두 개(untracked)만 보인다.

## 요약

변경 14개 파일이 모두 Task 산출물(pull 도구 · 편집 가드 · CI 무결성 잡 · 옛 트리 가드 제외 · 등재)에 대응하고, 무관한 리팩토링이나 포맷팅 변경은 섞이지 않았다. 경계를 넘은 유일한 곳인 `codebase/**` 는 테스트 헬퍼 필터 한 곳과 그 테스트로 최소이고, 실제로 필요함을 호출자 조사로 확인했다. 남는 것은 명세 밖으로 살짝 넓어진 부분(README 생성, `--basis latest`/`--spec` 옵션)과 짝 planner PR 과의 머지 순서 결합이다. 모두 차단 사유는 아니다.

## 위험도

LOW
