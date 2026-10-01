# 테스트(Testing) 리뷰 — NERV 스펙 미러 도입 (전환 1)

검증 방법: 워크트리에서 `.claude/tests` 전체(1243 passed), 프런트 `src/lib/docs/__tests__/` 전체(23 파일 3711 passed)를 읽기 전용으로 돌렸다. 뮤테이션 17건은 저장소 밖 scratch 사본에서만 돌렸고 저장소에는 아무것도 쓰지 않았다(`git status --short` 는 리뷰 산출물 폴더 두 개만 표시). 잔여물 없음.

## 발견사항

- **[WARNING]** `--check` 가 frontmatter 만 고친 손편집을 못 잡고, 이 한계를 고정하는 테스트도 없다
  - 위치: `.claude/tools/nerv-mirror/pull.py:255-274` (`check`), `.claude/tests/test_nerv_mirror_pull.py:179-185` (`test_hand_edit_is_caught`)
  - 상세: `mirror_sha256` 은 본문만 해시한다. 실측(scratch 사본): `spec/CLE-VISION.md` 의 `status: "draft"` 를 `"approved"` 로 바꾼 뒤 `check()` 는 `[]` 를 돌려줬다. 본문을 고치고 `mirror_sha256` 을 다시 계산해 넣은 경우도 통과한다(자기 참조 지문이라 위조가 쉽다). 그런데 CHANGELOG 와 워크플로 주석은 "셸 · 손 편집을 잡는다" 고 쓴다. 테스트는 본문 한 글자 수정과 파일 이동만 고정하므로, 문서한 보장이 구현보다 넓다는 사실이 어느 테스트에도 드러나지 않는다.
  - 제안: (a) 지문 범위를 NERV 원본 frontmatter 줄 + 본문으로 넓히고 `test_frontmatter_edit_is_caught` 를 추가하거나, (b) 지금 범위를 유지한다면 "frontmatter 수정은 잡지 않는다" 를 `test_frontmatter_only_edit_is_not_caught` 로 명시 고정하고 CHANGELOG 문구를 "본문 손편집" 으로 낮춘다.

- **[WARNING]** `Nerv.get`(curl 경계)이 테스트에서 통째로 대역으로 바뀌어 보안 주장과 ETag 형식이 검증되지 않는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:221-241`, `.claude/tests/test_nerv_mirror_pull.py:204-222` (`FakeNerv`)
  - 상세: `FakeNerv.get` 은 인용 없는 `sha256-…` 만 비교하므로, 실제로 `If-None-Match: "…"` 를 만드는 인용 코드(pull.py 228행), 응답 헤더 파싱(234-240행), curl 실패(`RuntimeError`)는 어떤 테스트도 실행하지 않는다. docstring 이 명시한 "토큰은 argv 에 남기지 않는다" 도 무테스트다. scratch 에서 PATH 앞에 가짜 `curl` 을 두고 확인한 결과 현재 구현은 argv 미노출·헤더 파싱·exit 22 예외 모두 동작했다. 다만 `HTTP/1.1 100 Continue` 나 프록시 CONNECT 응답처럼 헤더 블록이 둘인 출력은 status 100 과 헤더 텍스트가 body 로 섞여 파싱된다. 토큰에 `"` 가 있으면 curl 설정 줄이 깨진다. 또 FakeNerv 는 `/api/v1/…`(tree · tasks)와 `/api/…`(md · export) 접두 혼용을 구분하지 않고 받아 준다. 잘못된 접두어가 들어가도 테스트는 초록이다.
  - 제안: PATH 앞에 가짜 `curl` 스크립트를 두는 서브프로세스 테스트 3건을 추가한다. (1) argv 에 토큰 문자열이 없고 stdin 설정에 있다, (2) 304 응답의 상태·헤더 파싱과 `If-None-Match` 인용 형태, (3) exit ≠ 0 이면 `RuntimeError`. `FakeNerv` 가 받은 경로 접두를 단언하면 엔드포인트도 고정된다.

- **[WARNING]** 훅의 `..` 정규화(`normpath`)가 어느 테스트에도 고정되어 있지 않다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:59` (`Path(os.path.normpath(str(path)))`), `.claude/tests/test_guard_nerv_owned_paths.py:63-65`
  - 상세: `normpath` 를 빼는 뮤턴트(`return path`)가 `test_guard_nerv_owned_paths.py` 전체를 통과(SURVIVED)했다. 그 상태에서 `<루트>/codebase/../spec/x.md` 는 첫 조각이 `codebase` 라 허용된다(정규화가 있으면 exit 2 를 scratch 에서 확인). 하위 폴더에서 `../../spec/…` 로 상대 경로를 쓰는 것이 에이전트가 실제로 만드는 형태인데 테스트에는 `..` 케이스가 없다.
  - 제안: `test_relative_path_is_resolved_against_the_payload_cwd` 에 `cwd=self.wt/"codebase"`, 경로 `../spec/x.md` → exit 2, 그리고 절대 경로 `<루트>/codebase/../spec/x.md` → exit 2 를 추가한다.

- **[WARNING]** `pull.py` 뮤턴트 다수가 살아남는다 — 문서에 적힌 불변식이 미고정
  - 위치: `.claude/tools/nerv-mirror/pull.py:47` · `73-75` · `97-102` · `119-131`, `.claude/tests/test_nerv_mirror_pull.py:114-116`
  - 상세: 실측 결과 SURVIVED 는 다음과 같다. (P2) `EXCLUDED_AREAS` 에서 `CLE-MKS` 제거: 픽스처에 C24 만 있어 D4 의 절반이 무테스트다. MKS 가 새면 카탈로그 문서가 `spec/` 에 들어온다. (P3) `is_excluded` 의 키 접두어 절(`key.startswith(a + "-")`) 제거: 지금 픽스처로는 도달하지 않는다. (P4) CRLF 정규화 제거. (P5) 본문 끝 줄바꿈 보정 제거: 두 개 모두 docstring 의 "LF, 끝 줄바꿈" 결정성 주장이 무테스트다. (P6) `source_paths` 의 앞 5줄 창을 50줄로 넓힘: 창 경계와 `원문:` 없는 문서(`[]`)가 무테스트다. (P9) `check` 의 frontmatter 파싱 실패 분기 제거: 깨진 frontmatter 는 미검증이다. 반대로 P1(`--task` 가 `prune=True`), P7(released 클레임 포함), P8(ETag 미전송), P10(빈 폴더 정리), P11(앵커 유실)은 각각 KILLED 라 핵심 경로는 견고하다.
  - 제안: 픽스처에 `CLE-MKS`(영역)와 `CLE-MKS--X`(영역 없는 카탈로그 키) 각 1편, CRLF 로 된 문서 1편(끝 줄바꿈 없음), `원문:` 없는 문서를 추가하고 각 결과를 단언한다. `check` 에는 frontmatter 없는 파일 1건을 넣어 `frontmatter 를 읽지 못했다` 문제가 나오는지 본다.

- **[WARNING]** export.zip 항목 이름을 검증하지 않아 저장소 밖 쓰기·잘못된 위치 쓰기가 가능하고, 이를 다루는 테스트가 없다
  - 위치: `.claude/tools/nerv-mirror/pull.py:183-195` (`docs_from_zip`), `.claude/tests/test_nerv_mirror_pull.py:71-78` (`make_zip`)
  - 상세: scratch 실측: `specs/../evil.md` → `area=".."` 로 `spec/../evil.md`(= 저장소 루트의 `evil.md`)를 썼다. `specs/notakey.md` 는 `spec/notakey.md` 로 써졌지만 `KEY_RE` 에 걸리지 않아 `mirror_files` 가 영영 못 보므로 prune·`--check` 대상이 아니다. `specs/a/b/CLE-DEEP.md`(4단계)는 area 없이 `spec/CLE-DEEP.md` 로 납작해진다. 출처는 인증된 NERV 라 위험은 낮지만, 파일을 쓰는 도구인데 입력 검증 테스트가 하나도 없다.
  - 제안: `docs_from_zip` 에서 `KEY_RE` 불일치·`..` 조각·깊이 ≠ 2/3 은 건너뛰거나 `SystemExit`. 그 세 이름을 담은 zip 으로 "쓰지 않는다 / 거부한다" 테스트를 추가한다.

- **[INFO]** `--task` 가 활성 클레임이 없을 때 조용히 exit 0
  - 위치: `.claude/tools/nerv-mirror/pull.py:302-307`, `.claude/tests/test_nerv_mirror_pull.py:261-270`
  - 상세: released 클레임만 있을 때(또는 `scope_spec_ids` 가 비었을 때) 실측 결과 `pull: 씀 0 · 그대로 0 · 지움 0` 을 찍고 rc 0 이다. 클레임을 잊은 세션은 미러가 갱신된 줄 안다. 이 분기는 무테스트이고, 어느 쪽 동작이 의도인지 테스트가 말해 주지 않는다. 같은 성격으로 `NERV 에 없는 키`(312행), `specs/tree`·`tasks`·md 의 200 아님(299·304·328행), `--all` 의 export 200 아님(287행), `load_env` 환경변수 누락(249행)도 무테스트다.
  - 제안: 활성 클레임 없음은 경고 또는 exit 1 로 정하고 테스트로 고정한다. 나머지 오류 경로는 `assertRaises(SystemExit)` 한 줄씩이면 충분하다.

- **[INFO]** 훅의 fail-open 예외 분기와 입력 별칭 분기가 무테스트
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:51-53` · `84` · `105-110`, `.claude/tests/test_guard_nerv_owned_paths.py:85-92`
  - 상세: SURVIVED 뮤턴트: `except` 의 `sys.exit(0)` → `sys.exit(1)`(H1), `tool_input.get("path")` 제거(H3), `payload.get("input")` 대체 경로 제거(H3b), 우회 조건을 `== "1"` → `is not None` 로 완화(H4). `test_empty_or_broken_payload_fails_open` 은 빈 입력·깨진 JSON·`tool_input` 없음만 넣어서 `_read_payload`/`_target` 이 먼저 처리해 버리므로 실제 `except Exception` 분기는 한 번도 실행되지 않는다(scratch 에서 `[]` 페이로드는 `AttributeError` 후 exit 0 확인). macOS 는 대소문자를 구분하지 않아 `<루트>/Spec/x.md` 가 허용(exit 0)되는 것, 저장소 내부 심볼릭 링크(`docs -> spec`)가 허용되는 것도 실측했다. 의도된 한계라면 기록만 하면 된다.
  - 제안: `raw="[]"`, `{"tool_input": "str"}` 를 fail-open 목록에 추가하고 `BYPASS_NERV_OWNED_PATHS=0` 은 차단을 유지하는 단언을 넣는다. 대소문자·심볼릭 링크는 훅 docstring 의 한계 목록으로 적는다.

- **[INFO]** 미러 판별 정규식이 세 곳에 복제되어 있고 결속 테스트는 부분적
  - 위치: `.claude/tools/nerv-mirror/pull.py:48`(`KEY_RE`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:200`(`_NERV_MIRROR_REL`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:255`(`NERV_MIRROR`)
  - 상세: 지금은 실제 미러 170개 파일이 세 판별 모두에 맞는 것을 실측했다(`README.md` 포함, 벗어나는 파일 0). 프런트 테스트는 실제 트리를 훑어 이를 고정하지만, 오케스트레이터 쪽 테스트는 번들 머리글만 보고(`assertTrue(heads)` 로 공허함은 막음) 미러 전수를 대조하지 않는다. 필터를 뺀 뮤턴트는 `NervMirrorStaysOutOfTheOldCorpusTest` 가 KILLED 라 그 자체는 유효하다.
  - 제안: `test_is_nerv_mirror` 에 실제 `spec/` 아래 `CLE-*` 전 파일을 순회해 전부 `True` 인지 보는 단언을 하나 더하면 세 정규식의 드리프트가 파일 하나 추가로 드러난다.

## 긍정 확인

- 새 테스트 파일 3개와 수정 테스트 2개가 전체 하네스 스위트(1243)와 docs 가드 전체(3711)에서 초록이다.
- CI 잡 `spec-mirror-integrity` 의 단계 게이팅·no-op 안내·`needs` 는 `test_required_check_skip_jobs.py` 의 `test_every_step_is_gated` · `test_each_job_announces_the_no_op_path` 등 일반 규칙이 새 잡까지 덮는다(CiWiringTest 만 보면 빠져 보이지만 중복 아님).
- 공허 방지 가드가 있다: `assertTrue(heads)`, `pull.mirror_files(spec)` 비어 있지 않음, vitest 의 `spec/CLE-VISION.md` 실재 확인. 뮤턴트 KILLED 근거는 O1(필터 제거 → `NervMirrorStaysOutOfTheOldCorpusTest` 실패), P1·P7·P8·P10·P11.
- 훅 테스트가 실제 서브프로세스와 실제 git 워크트리를 쓰므로 "가장 가까운 `.git`" 판정(워크트리 = `.git` 파일)을 진짜로 시험한다. 최상위 `.git` 을 고르는 뮤턴트는 워크트리 케이스에서 걸린다.
- 격리: 임시 디렉터리 + `addCleanup`, `pull.load_env` 는 `try/finally` 로 복원, 환경변수 `BYPASS_NERV_OWNED_PATHS` 는 매 실행 제거 후 시작.

## 요약

핵심 경로(배치 · 링크 재작성 · ETag 304 · prune 범위 · 워크트리에서의 훅 차단 · 옛 코퍼스 제외)는 테스트가 실제로 결함을 잡는다는 것을 뮤테이션으로 확인했고 기존 스위트의 회귀도 없다. 반면 (1) `--check` 가 frontmatter 손편집을 못 잡는데 문서는 "손 편집을 잡는다" 고 말하는 점, (2) curl 경계를 통째로 대역으로 바꿔 토큰 argv 비노출·ETag 인용·헤더 파싱이 무테스트인 점, (3) 훅의 `..` 정규화, (4) `CLE-MKS` · CRLF · 잘못된 zip 항목 이름 같은 경계 입력이 비어 있는 점이 남는다. 모두 현재 초록을 깨지는 않지만, 뒤에 누가 한 줄을 "정리" 했을 때 스위트가 알려 주지 못하는 자리다.

### 위험도
MEDIUM
