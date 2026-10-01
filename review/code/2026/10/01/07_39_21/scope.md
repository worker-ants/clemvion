# 변경 범위(Scope) 리뷰 — 라운드 2

범위: 커밋 `d82040273..8a45684cd` 의 단계 1 코드 전체(17개 파일). 첫 미러 스냅샷(`spec/CLE-*`)은 범위 밖이다.
기준: Task `CLE-T-VA4YA1` 의 산출물 목록과 결정 D1~D4 · D8, 경계("옛 `spec/<영역>/**` 는 지우지 않는다", "새 plan 파일을 만들지 않는다").

## 확인한 것

- `git diff --name-status origin/main...HEAD` 에서 `spec/` 아래 변경은 `spec/CLE-*` 추가와 `spec/README.md` 추가뿐이다. 옛 트리 파일은 수정 · 삭제가 0건이다.
- `plan/**` 변경이 없다. `.gitignore` 변경이 없다(`.nerv/cache/mirror` 는 기존 `.nerv` 항목이 이미 덮는다: `git check-ignore` 로 확인).
- 공백 · 줄바꿈만 바꾼 hunk 가 없다. 기존 코드의 리팩토링도 없다. 기존 파일 변경은 모두 새 기능에 딸린 한두 줄이다.
- 새 Python 파일 4개에 쓰지 않는 import 가 없다(ast 로 확인).
- `.claude/settings.json` 은 훅 등록 4줄, `harness-checks.yml` 은 `.claude/settings.json` 을 pathspec 에 더하는 3줄이다. 새 테스트가 그 파일을 읽으므로 필요한 변경이다.
- `test_workflow_yaml_structure.py` 1줄은 새 잡 `spec-mirror-integrity` 의 `if: ${{ !cancelled() }}` 등록부 항목(`:263`)이다.

## 발견사항

- **[INFO]** 명세에 없는 CLI 옵션 `--basis {approved,latest}` 가 남아 있고 테스트가 없다
  - 위치: `.claude/tools/nerv-mirror/pull.py:503-504`(`--basis`), `:501-502`(`--spec`), `:513-514`(조합 거절)
  - 상세: Task 산출물은 `--task` 와 `--all` 을 적는다. D2 는 "승인본이 없으면 초안" 이고 기본값 `approved` 가 그 동작이다. `--basis latest` 는 미승인 초안을 미러에 들일 수 있는 경로인데, 요청한 적이 없다. `test_nerv_mirror_pull.py` 에서 `--basis` 는 한 번도 쓰이지 않는다(`grep basis` 는 fixture 필드 `basis_superseded` 한 곳뿐). 조합 거절 테스트(`test_incompatible_flags_are_rejected`, `:294-296`)도 `--basis` 를 고르지 않는다. 라운드 1 참고 15번이 같은 옵션을 지적했고, 이번 수정은 `parser.error` 만 더했다. `--from-zip` · `--root` 는 테스트용 이음새가 공개 플래그가 된 것이라 허용 범위다. `--spec KEY` 는 `--task` 의 scope 해석이 실측 전에는 불확실했던 것에 대한 탈출구라 남겨 둘 이유가 있다.
  - 제안: `--basis` 를 지워 `approved` 로 고정한다. 남기려면 `--basis latest` 가 `?basis=latest` 를 URL 에 싣는 것과 `--task` 와 같이 쓰면 거절되는 것을 테스트 한 줄씩으로 고정한다.

- **[INFO]** `spec/README.md` 생성이 산출물 목록에 없고, 사용 규칙 산문이 다른 곳과 겹친다
  - 위치: `.claude/tools/nerv-mirror/pull.py:457-484`(`render_readme`), `:398`(`cmd_all` 이 쓴다)
  - 상세: 명세의 산출물은 `spec/<영역 키>/<KEY>.md` 와 도구 · 가드 · CI 이고 README 는 없다. README 는 `--all` 에서만 갱신되고 `mirror_files()` 가 제외해 `--check` 가 손편집을 못 잡는다(`pull.py:36-37` 이 이 한계를 이미 적는다). 본문에는 `pull.py --task` 명령과 `/nerv:spec edit` 안내가 들어 있어, 같은 안내가 훅 메시지(`guard_nerv_owned_paths.py:45-46`), pull.py docstring, 짝 planner PR 의 거버넌스 문서에 흩어진다. 단계 2 · 3 에서 안내가 바뀌면 README 는 `--all` 을 다시 돌리기 전까지 옛 안내를 싣는다. 미러 판정 정규식 세 곳에 `README.md` 예외가 들어간 것도 이 파일 때문이다. 라운드 1 참고 14번의 일부가 그대로 남았다(보장 범위 차이만 문서화됨).
  - 제안: 이 PR 에서 문제를 일으키지는 않는다. 다만 README 본문을 "NERV 가 정본이고 사본이다 · 최신본은 NERV" 정도로 줄이고 명령은 한 곳(훅 메시지)에만 두면 겹침이 사라진다. 유지한다면 Task 본문에 산출물로 더해 둔다.

- **[INFO]** consistency 오케스트레이터 변경은 Task 산출물 목록 밖이다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:197-205`(`_NERV_MIRROR_REL` · `is_nerv_mirror`), `:806-807`
  - 상세: 산출물 목록의 "옛 트리 walker 가드 제외 규칙"은 frontend docs 가드를 가리킨다. consistency-checker 는 다른 스킬의 스크립트다. 다만 미러 169편이 `related_specs` 번들에 섞여 번들 순서 단언이 깨지는 것을 실측했고(`test_consistency_bundle_priority.py:957-961` 이 기록), CHANGELOG 41행과 `NervMirrorStaysOutOfTheOldCorpusTest` 가 이 변경을 적어 두므로 무관한 수정이 아니라 이 PR 의 필연적 후속이다. 대상 문서(`target_doc`)는 별도 경로로 모으므로 미러를 대상으로 지정한 검토를 막지 않는다(`collect_context` `:806` 아래 코드 확인). 변경 폭은 14줄이다.
  - 제안: 조치 불필요. 다만 미러 판정이 세 곳(`pull.py` `KEY_RE`, 오케스트레이터 정규식, `spec-links.ts` `NERV_MIRROR`)에 복제돼 있다. `MirrorPredicateParityTest` 가 이를 묶으므로 그 테스트를 지우는 변경이 곧 복제 드리프트의 시작이라는 점을 PR 본문에 한 줄 적어 두면 좋다.

- **[INFO]** 소스 주석과 CHANGELOG 에 "이 PR" 이라는 상대 표현이 들어 있다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:10`, `.claude/tests/test_guard_nerv_owned_paths.py:19`, `CHANGELOG.md:38`
  - 상세: "2026-10-01 이 PR 을 만들던 세션에서 실제로 그렇게 막혔다" 는 머지 뒤에는 가리키는 대상이 사라진다. 날짜와 실측 사실이 이미 적혀 있어 "이 PR" 이 더하는 정보는 없다. CHANGELOG 의 다른 "이 PR" 용례는 그 항목 자신의 변경을 가리키는 관례가 있지만 소스 주석은 다르다.
  - 제안: 소스 두 곳은 "2026-10-01 이 훅을 등록한 세션에서 실측" 처럼 사건만 남긴다. CHANGELOG 는 그대로 둬도 된다.

- **[INFO]** 훅의 `OWNED_ROOTS` 사전과 단계 2 · 3 로드맵 docstring 은 지금 쓰지 않는 확장 틀이다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:16-20`, `:44-47`, `:81-91`
  - 상세: 항목이 `spec` 하나뿐인데 구조는 여러 경로를 받도록 일반화돼 있다. 테스트(`test_other_paths_are_allowed`)도 `review/` · `plan/` 이 "아직 통과" 임을 고정해 다음 단계 PR 이 기대값을 바꾸도록 설계됐다. 라운드 1 참고 19번이 "다음 단계 diff 를 한 줄로 줄이는 정도라 허용 범위" 로 판단한 그대로이고 크기도 커지지 않았다.
  - 제안: 조치 불필요.

## 경계 준수 확인

- `codebase/**` 를 건드린 것은 테스트 헬퍼 `spec-links.ts` 의 수집 필터 한 곳(`inNervMirror`, `:251-265`)과 그 테스트 · 주석뿐이다. 제품 코드 변경은 없다. Task 경계 "`codebase/**` 를 건드리지 않는다" 에 대한 의도된 예외이며 요청 본문이 이미 근거를 적었다. `spec-area-index.test.ts` · `tree-walk.test.ts` 의 변경은 주석만이고, 동작이 바뀐 `collectSpecMarkdown` 의 설명을 맞추는 것이라 범위 안이다(라운드 1 참고 18번 반영).
- 훅이 옛 `spec/<영역>/` 트리의 도구 편집도 막는다. 경계 "옛 트리는 지우지 않는다"와는 충돌하지 않고(지우지 않고 동결한다), CHANGELOG · README · 훅 docstring 이 "동결" 을 같은 말로 적는다. 이 동결은 짝 planner PR 이 먼저 머지되지 않으면 planner 의 `spec/` 쓰기 안내와 부딪히는 머지 순서 결합이며, 라운드 1 경고 4번이 다룬 사항이라 이번 범위에서는 새로 지적하지 않는다.
- `--task` 의 원문 캐시(`pull.py:403-454`)는 Task 본문이 요구한 "ETag 증분" 을 링크 재작성과 함께 안전하게 하려고 라운드 1 경고를 닫는 수정이다. 캐시를 빼면 증분이 성립하지 않으므로 기능 확장으로 보지 않는다.

## 요약

이 변경은 Task `CLE-T-VA4YA1` 의 산출물(pull 도구 · 편집 가드 · CI 잡 · 옛 트리 가드 제외 · 테스트 · 문서)에 전부 대응하고, 무관한 리팩토링 · 포맷팅 변경 · 사용하지 않는 import · 의도하지 않은 설정 변경은 찾지 못했다. `codebase/**` 접촉은 테스트 헬퍼 한 곳과 주석으로 한정되고 consistency 오케스트레이터 변경은 실측으로 필요성이 입증된 14줄 후속이다. 남은 것은 요청하지 않은 CLI 옵션 `--basis latest`(테스트 없음)와 `spec/README.md` 생성 · 그 산문의 중복, 소스 주석의 "이 PR" 상대 표현이며 모두 정보 수준이다. 라운드 1 의 범위 지적(참고 13 · 14 · 15 · 19) 중 13 · 19 는 허용 범위로 유지됐고 14 · 15 는 문서화로만 대응돼 일부 남았으며 수정이 새 범위 이탈을 만들지는 않았다.

## 위험도

LOW

(저장소 트리는 변경하지 않았다. 읽기 · grep · scratch 밖 실행 없음.)
