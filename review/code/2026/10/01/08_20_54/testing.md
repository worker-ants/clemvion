# 테스트(Testing) 리뷰

대상: NERV 정본 전환 단계 1 후속 (편집 가드 훅 · `pull.py` · 두 테스트 모듈 · CI 배선 · 문서).

검증 방법: 변경된 두 테스트 모듈(80 passed, 78 subtests)과 `.claude/tests` 전체(1296 passed, 1425 subtests)를 그대로 돌렸다. 이어서 scratch 디렉터리의 사본에서 뮤턴트를 심어 각 방어가 테스트에 묶여 있는지 쟀다. 저장소 트리에는 쓰지 않았다. 리뷰 전후 `git status --short` 가 같다(리뷰 시작 때부터 있던 untracked `review/` 3건뿐).

## 발견사항

- **[WARNING]** 오염 etag 테스트의 주입 fixture 가 `re.sub` 치환 문자열 해석으로 변형돼, 문서화한 공격 모양이 실제로는 들어가지 않는다
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:601` · `:607` (`test_malformed_mirror_etag_is_refetched_not_sent`)
  - 상세: `bad` 는 JSON 으로 유효한 문자열(`x"\nurl = "https://evil.invalid"`)을 뜻하도록 썼다. 그런데 `re.sub(..., f"etag: {bad}", text)` 의 치환 문자열은 백슬래시 이스케이프를 해석한다. 그래서 `\n` 이 실제 개행으로 바뀌어 파일에는 `etag: "x\"` 와 `url = \"https://evil.invalid\""` 두 줄이 써진다. 이 줄은 JSON 으로 읽히지 않으므로 `conditional_etag` 는 `JSONDecodeError` 로 `None` 을 돌려준다. 즉 첫 subtest 는 주석이 말하는 「미러 etag 는 설정 줄에 절대 실리지 않는다」 경로가 아니라 「깨진 JSON」 경로를 지난다.
    - 예측: 미러 etag 가 문자열이면 그대로 돌려주는 뮤턴트(`return recorded if isinstance(recorded, str) else None`)가 살아남는다.
    - 실측: 그 뮤턴트에서 이 테스트가 통과했다(`exit=0 OK`). 치환을 함수로 줘 이스케이프 해석을 끄면(`lambda m: ...`) 뮤턴트는 `'x"\nurl = "https://evil.invalid"'` 를 돌려주고 원본은 `None` 이다. 둘째 subtest(`etag: 5`)는 `return recorded` 뮤턴트만 잡는다(`[5]` vs `[None]`). 설정 줄 주입의 실제 벡터인 문자열 값은 묶여 있지 않다.
  - 제안: `re.sub(r"(?m)^etag: .*$", lambda m: f"etag: {bad}", text)` 로 바꾼다. 쓴 뒤 파일을 다시 읽어 `fm_value(..., "etag") == json.loads(bad)` 인지 확인하는 단언을 넣으면 fixture 가 의도대로 들어갔음을 테스트가 스스로 증명한다.

- **[WARNING]** `apply` 에 사전 검사 루프를 넣은 뒤 `write_if_changed` 안의 링크·경로 이탈 검사를 지키는 테스트가 없다. README 쓰기는 사전 검사 밖이다
  - 위치: `.claude/tools/nerv-mirror/pull.py:291-292` (`write_if_changed` → `_write_target`) · `:319-321` (사전 검사 루프) · `:541` (`cmd_all` 의 README 쓰기) / `.claude/tests/test_nerv_mirror_pull.py:285-291`
  - 상세: 사전 검사 루프가 문서 대상을 먼저 걸러 주므로 `test_never_writes_through_a_symlink*` 는 이제 그 루프만 지난다. `write_if_changed` 자신의 `_write_target` 호출은 `README.md` 경로에서만 쓰이는데 이를 겨눈 테스트가 없다.
    - 예측: `write_if_changed` 가 `path = spec_root / rel` 로 검사 없이 쓰는 뮤턴트가 살아남는다.
    - 실측: `AllModeTest` · `InputValidationTest` · `TaskModeTest` · `CheckTest` 전부 통과(생존). 이 뮤턴트에서는 `spec/README.md` 가 `spec/` 밖을 가리키는 심볼릭 링크일 때 링크를 따라 그 파일을 덮어쓴다. CHANGELOG 는 「심볼릭 링크는 따라가 쓰거나 지우지 않는다」 고 적었다.
    - 같은 뿌리의 실측: 실제 코드에서 `spec/README.md` 가 링크이면 문서 7편을 모두 쓴 뒤에야 `PullError` 로 멈춘다. `apply` 의 주석 「쓰기 전에 모든 대상을 먼저 검사한다. 중간에 멈추면 일부만 쓴 미러가 남는다」 가 README 에는 성립하지 않는다(밖의 파일은 무사했다).
  - 제안: `test_never_writes_through_a_symlink` 와 나란히 README 가 링크인 경우를 추가한다. 밖의 파일이 그대로이고 `self.mirrored() == []` 임을 단언한다. 그 테스트가 RED 가 되도록 `cmd_all` 에서 README 대상을 `apply` 앞에서 `_write_target` 으로 미리 검사한다.

- **[WARNING]** 「조건부 요청 없이 받은 304 는 오류」 라는 이번 변경의 핵심 분기가 회귀 테스트에 묶여 있지 않다
  - 위치: `.claude/tools/nerv-mirror/pull.py:594` (`if status == 304 and etag is not None:`) / `.claude/tests/test_nerv_mirror_pull.py:628-638` (`test_error_responses_stop_and_write_nothing`)
  - 상세: 304 subtest 는 캐시가 없는 상태에서 304 를 강제한다. 캐시가 없으면 `cached is not None` 이든 `etag is not None` 이든 결과가 같아, 옛 조건으로 되돌려도 구분하지 못한다.
    - 예측: `etag is not None` 를 옛 `cached is not None` 으로 되돌리는 뮤턴트가 살아남는다.
    - 실측: 배치 뮤테이션에서 생존. 구분되는 입력(캐시는 있고 미러 etag 와 다른 버전, 서버가 304)으로 직접 돌리면 원본은 `PullError: CLE-VISION.md 응답 304`, 뮤턴트는 오류 없이 `stale` 원문을 미러에 쓰고 `--check` 도 통과한다(`check` 가 지문을 새로 계산한 파일을 본다). 오염된 미러가 조용히 커밋된다.
  - 제안: 304 subtest 를 하나 더 둔다. `test_cache_of_another_version_means_no_conditional_request` 처럼 캐시를 옛 버전으로 덮은 뒤 `statuses` 로 304 를 강제하고, `PullError` 와 미러 불변을 단언한다.

- **[INFO]** `--check` 가 UTF-8 이 아닌 미러 파일에서 문제 줄 대신 예외를 낸다
  - 위치: `.claude/tools/nerv-mirror/pull.py:480-481` (`stale_links` 의 `read_text`), `:503` / `.claude/tests/test_nerv_mirror_pull.py:411-420`
  - 상세: `check` 의 파일별 루프는 `ValueError` 를 문제 줄로 바꾸지만(`UnicodeDecodeError` 는 `ValueError` 하위), 그보다 먼저 도는 `stale_links` 가 같은 파일을 try 없이 읽는다. 실측: 미러 파일에 `\xff\xfe` 를 넣으면 `check` 가 `UnicodeDecodeError` 를 던진다. CI 는 어느 쪽이든 실패하지만 이번 후속 커밋이 고치려던 「예외 대신 보고」 계약이 이 변형에는 성립하지 않는다. `test_odd_frontmatter_values_are_reported_not_raised` 는 타입이 틀린 값만 다룬다.
  - 제안: 그 테스트에 바이너리 파일 변형을 더하고 `stale_links` 의 읽기를 같은 `except (ValueError, ...)` 로 감싼다.

- **[INFO]** `server_ok` 가 `urlsplit` 의 `ValueError` 를 그대로 올린다. 새로 더한 두 가지도 묶이지 않았다
  - 위치: `.claude/tools/nerv-mirror/pull.py:408-413` / `.claude/tests/test_nerv_mirror_pull.py:744-758`
  - 상세: 실측: `server_ok("https://[::1")` 과 `Nerv("https://[::1", ...)` 이 `ValueError: Invalid IPv6 URL` 을 낸다. CLI 는 `(PullError, RuntimeError)` 만 잡으므로 `NERV_SERVER=https://[::1` 이면 한 줄 오류가 아니라 traceback 이 나온다. 테스트의 거부 목록에는 이런 입력이 없다. 같은 테스트에서 `u.fragment` 와 `u.password` 가지를 각각 지운 뮤턴트도 살아남았다(거부 목록에 fragment 주소와 비밀번호만 있는 주소가 없다).
  - 제안: `server_ok` 를 `try/except ValueError → False` 로 감싸고, 거부 목록에 `"https://[::1"` · `"https://nerv.example.invalid#x"` · `"https://:pw@nerv.example.invalid"` 를 더한다.

- **[INFO]** 세 판정 동치 테스트: 하한이 100에서 1로 내려갔고, 음성 쪽이 실제 `spec/` 옛 트리에 기댄다
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:825` (`assertGreater(len(tool), 1, ...)`), `:812-815`
  - 상세: 하한을 낮춘 이유가 커밋 본문(`7ce195e04`)에 없다. 「미러가 없다 — 이 대조는 공허하다」 라는 메시지와 값 1이 맞지 않는다(README 포함 2개면 통과). 또 「판정이 미러가 아닌 파일을 거른다」 는 쪽은 옛 트리 388편이 있어야 성립한다. 단계 5(`CLE-T-7M4C4X`)가 옛 트리를 지우면 `rels` 가 전부 미러가 되어, 모든 `.md` 를 고르는 판정도 통과한다.
  - 제안: 하한을 이유와 함께 정하고(또는 이유를 주석으로 남기고), 합성 이름 목록(`spec/0-overview.md` · `spec/CLE-lower.md` · `spec/CLE-X/sub/y.md` · `spec/conventions/x.md` 등 기대 판정 포함)을 세 판정에 같이 넣는 고정 케이스를 더한다. 그러면 옛 트리 삭제 뒤에도 음성 쪽이 남는다.

- **[INFO]** 새 `sparse-checkout` 이 테스트로 묶이지 않았다
  - 위치: `.github/workflows/spec-link-checks.yml:146-149` / `.claude/tests/test_nerv_mirror_pull.py:776` (`CiWiringTest`)
  - 상세: `CiWiringTest` 는 실행 명령과 `needs` 만 본다. 이 잡이 받는 경로가 `spec` 과 `.claude/tools/nerv-mirror` 뿐이라는 전제는 CI 에서만 깨진다(로컬 테스트는 전체 트리를 본다). 지금은 성립한다: 그 두 경로만 복사한 사본에서 `pull.py --check` 가 exit 0 으로 끝났다(`미러 169편 · 문제 0`). `pull.py` 가 나중에 `.claude/` 의 다른 파일을 import 하거나 목록에서 경로가 빠지면 CI 에서야 드러난다.
  - 제안: `CiWiringTest` 에 그 잡의 checkout 스텝 `with.sparse-checkout` 가 두 경로를 포함하는지 보는 단언을 더한다. 더 강하게는 그 두 경로만 scratch 로 복사해 `--check` 를 서브프로세스로 돌리는 테스트를 둔다.

- **[INFO]** 「NERV 미러도 일부러 본다」 는 주석이 fixture 로 묶이지 않았다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:27-28`
  - 상세: 주석만 바뀌었고 동작은 `walkTree` 에 미러 제외가 없다는 부재에 기댄다. 누가 `includeFile` 에 `!inNervMirror(relPath)` 를 끼워도 실제 저장소에 잔재가 없어 `잔재 태그가 없다` 는 계속 초록이고, archive fixture 는 `plan/` · `spec/archive` 만 본다.
  - 제안: 기존 archive fixture 테스트에 `spec/CLE-ACCT/CLE-ACCT.md` 에 `</content>` 를 심고 잡히는 대조군을 한 줄 더한다.

- **[INFO]** 그 밖에 살아남은 뮤턴트(낮은 위험)
  - 위치: `.claude/tools/nerv-mirror/pull.py:676-679` · `:259-280` · `:329`
  - 상세:
    - `__main__` 의 `except (PullError, RuntimeError)` 에서 `RuntimeError` 를 뺀 뮤턴트 생존. CLI 동작 자체는 정상이다(가짜 curl exit 7 로 `pull: curl 실패...` 한 줄, exit 1 확인). `test_cli_reports_errors_in_one_line` 이 `PullError` 만 본다.
    - `stray_entries` 에서 미러 폴더 안 하위 디렉터리, 키 이름이 아닌 최상위 폴더(`spec/CLE-lower/`)를 stray 로 안 보는 뮤턴트 각각 생존. 실제 코드는 둘 다 보고한다. 테스트는 `.md` 파일만 넣는다.
    - `apply` 의 빈 폴더 정리에서 `not d.is_symlink()` 를 뺀 뮤턴트 생존. 링크 대상 폴더가 비어 있지 않아서 그 가지를 지나지 않는다.
  - 제안: 각각 한 줄짜리 케이스(스텁 curl 로 CLI exit 1, `CLE-ACCT/sub/` 와 `CLE-lower/` 를 `check` 에 넣기, 빈 폴더를 가리키는 링크)로 묶는다.

## 잘 된 점 (변경 없음 권장)

- 편집 가드 훅: 새 방어를 하나씩 뺀 뮤턴트가 전부 죽는다. 각 payload 와 죽이는 입력이 일대일이다.
  - `\x00` 검사 제거 → `file_path NUL`
  - `tool_input` 타입 검사 제거 → `tool_input str` · `tool_input list`
  - `file_path` 타입 검사 제거 → `file_path int` · `file_path list`
  - `cwd` 타입 검사 제거 → `odd cwd`
  - `path` 키 복원 → `path key`
- `__main__` fail-open 분기: exit 2 로 바꾸기, try/except 제거, traceback 출력 제거, `except ValueError` 로 좁히기 전부 `test_runtime_errors_fail_open` 이 죽인다. `RUNTIME_ERROR_PROBE` 가 `except Exception` 을 결정적으로 밟는 구성도 타당하다.
- `test_the_real_repository_is_guarded` 는 훅이 조용히 꺼지는 경로(표지 파일 이동)를 실제 저장소에서 본다.
- `CheckTest.test_limitation_*` 두 건은 문서에 적은 한계를 테스트로 고정한다. `FakeNerv.get_ok` 가 실제 `Nerv.get_ok` 를 호출하도록 바꾼 것은 복제 대역 drift 를 없앤다.
- 회귀: 변경된 두 모듈 80 passed, 전체 `.claude/tests` 1296 passed. 훅 · `PullError` · 이름을 바꾼 `_checkout_root` · `_owned_root` 의 외부 소비처는 없다(grep 확인).

## 요약

이번 diff 의 테스트는 전반적으로 두텁다. 훅은 새 방어마다 뮤턴트 대응 입력이 있고 fail-open 분기까지 결정적으로 밟으며, `pull.py` 도 링크 prune · 서버 경계 · curl 인자 · 크기 상한 · 한계 고정을 촘촘히 묶었다. 다만 세 군데는 "묶였다" 는 서술이 실측과 어긋난다. (1) 오염 etag fixture 가 `re.sub` 이스케이프로 변형돼 설정 줄 주입의 문자열 벡터가 열려 있다. (2) `apply` 에 사전 검사를 넣은 뒤 `write_if_changed` 의 링크 검사는 어떤 테스트도 지키지 않고, `spec/README.md` 가 링크일 때는 사전 검사 밖이라 문서를 쓴 뒤에 멈춘다. (3) 304 분기 회귀(오래된 캐시로 오염된 미러가 `--check` 를 통과)가 캐시 없는 304 fixture 로는 구분되지 않는다. 셋 다 테스트 보강으로 닫히고, 3번은 입력 하나를 더하면 된다. 나머지는 `--check` 의 바이너리 파일 처리, `server_ok` 의 예외, 동치 테스트의 공허성 하한, sparse-checkout 의 미고정 같은 낮은 위험의 갭이다. 저장소 전체 하네스 테스트는 통과한다.

## 위험도

LOW
