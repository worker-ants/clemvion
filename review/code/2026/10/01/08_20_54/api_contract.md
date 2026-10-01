# API 계약 리뷰

## 발견사항

- **[INFO]** 제품 API(백엔드 엔드포인트 · DTO · 응답 스키마)를 바꾸는 변경이 없다
  - 위치: 변경 16개 파일 전체
  - 상세: 변경은 전부 하네스(`.claude/hooks` · `.claude/tools` · `.claude/tests` · `.claude/skills`), CI 워크플로, 문서(`CHANGELOG.md` · `PROJECT.md` · `spec/README.md` · `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md`), 프런트엔드 docs 가드 테스트 헬퍼(`codebase/frontend/src/lib/docs/__tests__/*`)다. `codebase/backend` 의 컨트롤러 · DTO · 라우트 변경은 없다. 하위 호환성 · 버전 관리 · 응답 형식 · 에러 응답 · 요청 검증 · URL 설계 · 페이지네이션 · 인증/인가 관점에서 제품 API 에 미치는 영향은 없다.
  - 제안: 없음.

- **[INFO]** `pull.py` 가 NERV 서버 API 를 읽는 클라이언트 쪽 계약은 일관되고 입력 검증도 강화됐다
  - 위치: `.claude/tools/nerv-mirror/pull.py:408-413` (`server_ok`), `:425-435` (`Nerv.get`), `:592-597` (`cmd_task`)
  - 상세: 이 도구는 NERV 의 `/api/v1/projects/<p>/specs/tree` · `/tasks/<Task>` 와 `/api/projects/<p>/specs/<KEY>.md?task=` · `export.zip?basis=approved&layout=tree` 를 호출하는 소비자다. 이번 변경이 이 소비 계약에 더한 것은 다음과 같고 모두 타당하다.
    - URL 에 들어가는 값(`project`, `key`, `task`, `etag`)을 `fullmatch` 정규식으로 검증한다(`PROJECT_RE`, `KEY_RE`, `TASK_RE`, `ETAG_RE`). `cmd_task` 는 `mirror_relpath` 로 키를 검증한 뒤(`:592`) 요청을 보내므로 서버가 준 키가 검증 없이 URL 에 들어가지 않는다.
    - 토큰을 보내도 되는 서버를 https 또는 loopback 의 http 로 제한하고, 사용자 정보 · 쿼리 · fragment 를 거부한다. 옛 `startswith("http://localhost")` 는 `http://localhost.evil.com` 을 통과시켰는데 이제 호스트명을 정확히 비교한다.
    - 304 처리가 `status == 304 and etag is not None` 이라 조건부 요청을 보낸 경우에만 캐시 원문을 쓴다. 조건부 요청 없이 받은 304 는 `응답 304` 오류로 끝난다.
    - `If-None-Match` 는 따옴표 붙은 강한 검증자(`"sha256-…"`)로 보낸다.
  - 제안: 없음. 참고로 남긴다.

- **[INFO]** `--basis` 옵션 제거와 `PullError` 의 상위 클래스 변경은 호환성 문제가 아니다
  - 위치: `.claude/tools/nerv-mirror/pull.py` `main()` 의 argparse 블록(게이트 `652-653` 사이에서 `--basis` 삭제), `class PullError` (`:112`), 하단 `__main__` 블록(`:676-679`)
  - 상세: `--basis approved|latest` 를 지우고 `EXPORT_BASIS = "approved"` 로 고정했다. `cmd_all` 시그니처도 바뀌었다. 저장소 전체에서 `--basis` 와 `cmd_all` 호출처를 찾았을 때 `pull.py` 와 그 테스트 외에는 없다. 그리고 `git log origin/main -- .claude/tools/nerv-mirror/pull.py` 가 비어 있어 이 도구는 아직 main 에 들어가지 않은 미출시 상태다. 그래서 깨질 소비자가 없다. `PullError` 를 `SystemExit` 에서 `Exception` 으로 바꾼 것도 같은 이유로 안전하다. CLI 종료 경로는 `__main__` 블록이 `PullError` 와 `RuntimeError` 를 잡아 `pull: <이유>` 와 exit 1 로 끝낸다.
  - 제안: 없음. 다만 출시 이후에 같은 일을 하면 breaking change 가 되므로, 그때는 CHANGELOG 에 옵션 제거를 적는다.

- **[INFO]** 서버가 200 으로 JSON · zip 이 아닌 본문을 주면 CLI 오류 형식이 일관되지 않다
  - 위치: `.claude/tools/nerv-mirror/pull.py:576`, `:579` (`json.loads`), `docs_from_zip` 의 `zipfile.ZipFile(...)`, `:676-679`
  - 상세: `__main__` 블록은 `PullError` 와 `RuntimeError` 만 잡는다. 프록시나 Cloudflare 가 200 으로 HTML 페이지를 돌려주면 `json.JSONDecodeError`(`ValueError` 계열) 나 `zipfile.BadZipFile` 이 그대로 올라와 traceback 으로 끝난다. exit 코드는 1 이라 CI 계약은 지켜지고, 이 도구의 `get()` 이 이미 상태 코드 200 이 아닌 경우를 `PullError` 로 바꾸므로 발생 가능성이 낮다.
  - 제안: 원하면 `get_ok` 호출 뒤 파싱을 `except (ValueError, zipfile.BadZipFile)` 로 감싸 `PullError` 로 바꾼다. 필수는 아니다.

- **[INFO]** PreToolUse 훅이 읽는 페이로드 키를 줄였다. 하네스 계약과 맞는다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:73-86` (`_target`)
  - 상세: `tool_input.path` 를 더는 편집 대상으로 보지 않고 `file_path`(Write · Edit · MultiEdit) 와 `notebook_path`(NotebookEdit) 만 본다. 등록 matcher 가 `Write|Edit|MultiEdit|NotebookEdit` 이고 이 도구들은 `path` 키를 쓰지 않으므로 차단 범위는 줄지 않는다. 테스트가 `{"path": ...}` 페이로드는 통과해야 한다고 고정한다. 모양이 틀린 페이로드(`tool_input` 이 문자열 · 리스트, `file_path` 가 숫자 · 리스트 · NUL 포함, `cwd` 가 문자열이 아님)는 예외 없이 "대상 없음" 으로 통과하고, 예상 밖 예외는 `except Exception` 에서 exit 0 이다. 훅 계약(exit 0 허용 · exit 2 차단 · 그 밖 런타임 오류는 허용)과 일관된다.
  - 제안: 없음.

## 요약

이번 변경 세트에는 제품 API 코드(`codebase/backend` 의 컨트롤러 · DTO · 라우트)가 없다. 하네스 훅과 미러 도구, CI 워크플로, 문서, 프런트엔드 docs 가드 테스트 헬퍼가 전부이므로 API 계약 관점의 breaking change · 버전 · 응답 형식 · 에러 응답 · 페이지네이션 · 인증/인가 위험은 해당 없음이다. 참고로 `pull.py` 가 NERV 서버를 호출하는 클라이언트 경계는 URL 구성 값 검증, 토큰을 보낼 서버 제한, 조건부 요청(ETag/304) 처리가 오히려 강화됐다. 제거된 `--basis` 옵션과 `PullError` 상위 클래스 변경은 이 도구가 main 에 아직 없어 소비자가 없으므로 호환성 문제가 아니다. 남은 것은 200 응답의 본문이 JSON · zip 이 아닐 때 traceback 으로 끝날 수 있다는 낮은 확률의 INFO 하나다.

## 위험도

NONE
