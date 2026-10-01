# 성능 리뷰

대상: NERV 전환 단계 1 후속 (편집 가드 훅, 미러 도구 `pull.py`, 관련 테스트와 문서, CI 잡).
실측 환경: Python 3.11.9, macOS, 실제 미러 169편(5.76MB, 미러 링크 5,895개). 측정 스크립트는 모두 저장소 밖 scratchpad 에 뒀고 저장소 트리는 건드리지 않았다(`git status --short` 가 시작 시점과 같다).

### 발견사항

- **[INFO]** 편집 가드 훅이 `traceback` 을 모든 호출에서 미리 불러온다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:47` (`import traceback`), 사용처 `:135`
  - 상세: 이 훅은 Write · Edit · MultiEdit · NotebookEdit 호출마다 새 python 프로세스로 돈다. 이전에는 `except Exception` 분기 안에서 `import traceback` 을 했고, 정상 경로(대부분의 호출)는 이 모듈을 불러오지 않았다. 이번 변경으로 최상위 import 가 됐다. `-X importtime` 으로 `traceback` 의 누적 import 비용은 약 1.6ms 였다. 같은 payload(`codebase/x.ts` 편집)로 프로세스 기동부터 종료까지 150회씩 3라운드 잰 중앙값은 새 코드 23.5~24.8ms, 예전 형태(지연 import) 22.6~22.9ms 였다. 호출당 약 1~1.5ms(약 5%) 늘었다.
  - 제안: 절대 크기는 작아서 차단할 이유는 아니다. 그래도 얻는 것이 없는 비용이다. `RUNTIME_ERROR_PROBE` 는 `json.loads` 를 바꿔서 예외 분기를 밟으므로 지연 import 여도 그대로 동작한다. `except` 블록 안에서 import 하는 예전 형태로 되돌리는 쪽을 권한다. 최상위 import 를 유지한다면 그 이유(린터 규칙 등)를 주석으로 남긴다.

- **[INFO]** `--check` 의 `stale_links` 가 링크마다 `stat` 을 하고, 같은 파일을 두 번 읽는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:481-490` (`stale_links`), `:504-507` (`check` 의 파일 루프)
  - 상세: `stale_links` 는 미러 파일마다 `read_text` 를 하고 링크마다 `target.exists()` 를 부른다. 실제 미러에서 `Path.exists` 호출이 5,895번이었다. `check()` 전체 85ms 중 `stale_links` 가 53ms(약 62%)다. 이어지는 `for path in files` 루프가 같은 파일을 다시 `read_text` 해서 파일당 읽기가 2회다(338회). 링크 수에 선형이라 미러가 지금의 몇 배로 커져도 1초를 넘지 않는다. CI 잡 `timeout-minutes: 5` 와 python 기동 시간에 비하면 문제가 안 된다.
  - 제안: 조치하지 않아도 된다. 줄이고 싶다면 `(디렉터리, 상대 경로)` 별로 `exists()` 결과를 dict 에 캐시하면 호출이 대상 문서 수 수준(수백 번)으로 준다. 본문을 `stale_links` 와 `check` 루프가 함께 쓰도록 한 번만 읽는 방법도 있다.

- **[INFO]** `apply` 의 쓰기 전 검사 루프가 `resolve()` 를 문서마다 두 번 더 부른다
  - 위치: `.claude/tools/nerv-mirror/pull.py:319-321` (검사 루프), `:283-288` (`_write_target`)
  - 상세: `_write_target` 은 호출마다 `path.resolve()` 와 `spec_root.resolve()` 를 부른다. 검사 루프가 생기면서 문서 하나당 호출이 2번(검사 + 쓰기)이 됐다. 169편 기준으로 검사 루프만 9.3ms, `apply` 전체는 약 88ms(검사 루프가 약 11%)였다. `--all` 은 수동 실행이고 9MB 다운로드가 지배하므로 영향은 없다. 검사를 쓰기 앞으로 끌어낸 목적(중간에 멈춰 일부만 쓴 미러를 남기지 않기)은 정당하다.
  - 제안: 조치 불필요. 줄이려면 `spec_root.resolve()` 를 `apply` 에서 한 번만 계산해 `_write_target` 에 넘긴다.

- **[INFO]** 다운로드 본문 크기에는 상한이 없다. 해제 후 크기에만 상한이 있다 (변경의 효과는 확인했다)
  - 위치: `.claude/tools/nerv-mirror/pull.py:433` (`subprocess.run(..., capture_output=True)`), `:350-353` (`docs_from_zip` 상한)
  - 상세: 새 `MAX_ENTRY_BYTES` · `MAX_EXPORT_BYTES` 는 zip 헤더의 `info.file_size` 로 판정한다. 헤더가 거짓이어도 상한이 깨지는지 확인했다. 20MB 항목의 중앙 디렉터리 크기를 100 으로 고친 zip 을 만들어 `zf.read(info)` 를 불렀더니 100바이트만 읽고 `BadZipFile: Bad CRC-32` 가 났다(CPython 3.11). 즉 선언 크기가 해제량을 실제로 막는다. 다만 압축된 응답 본문은 `capture_output` 으로 전부 메모리에 올라가고 `parse_response` 의 `partition` 이 본문을 한 번 더 복사한다. 크기를 묶는 것은 `--max-time 120` 뿐이다. 서버가 신뢰 대상(토큰 인증 NERV)이고 실측 export 는 9.3MB 여서 지금은 실질 위험이 없다.
  - 제안: 필요하면 curl 에 `--max-filesize` 를 준다(Content-Length 가 있을 때만 작동한다). 덧붙여, 거짓 헤더 zip 이 던지는 `zipfile.BadZipFile` 은 `__main__` 의 `except (PullError, RuntimeError)` 에 걸리지 않아 한 줄 메시지 대신 traceback 이 나온다. 성능이 아니라 오류 표시 문제라 참고만 한다.

- **[INFO]** `--task` 는 스펙 한 건마다 curl 프로세스를 새로 띄운다 (이번 변경이 만든 것은 아님)
  - 위치: `.claude/tools/nerv-mirror/pull.py:584-599` (`cmd_task` 루프), `:433` (`Nerv.get`)
  - 상세: scope 의 키 N개에 대해 순차로 N번 `subprocess.run(["curl", ...])` 을 하며 TLS 연결을 재사용하지 못한다. 이번 diff 는 이 구조를 바꾸지 않았고 호출 횟수도 같다(`paths_for` 는 루프 뒤로 옮겨졌지만 여전히 1회). 구현 Task 의 scope 는 보통 수 편이라 수 초 안이다. scope 가 수십 편으로 커지면 체감된다.
  - 제안: 지금은 조치하지 않는다. 커지면 하나의 curl 설정에 `url =` 을 여러 개 주어 연결을 재사용하거나 키별 요청을 병렬로 돌린다. 이때 `-D -` 응답 파서가 여러 응답을 나눠야 한다.

### 확인했지만 문제가 아닌 것

- `fingerprint()` 는 frontmatter 안에서만 줄을 찾고 닫는 `---` 에서 멈춘다. 예전에는 전체 줄을 훑으며 리스트를 새로 만들었으므로 오히려 싸졌다.
- `MIRROR_LINK_RE` 와 `SOURCE_LINE_RE`: 모두 본문을 줄 단위로(또는 `](` 시작점마다) 훑는다. `[^()\s#]*` 가 공백과 괄호를 빼서 시작점 사이로 역추적이 번지지 않는다. `stale_links` 전체가 53ms 이므로 이차 증가 징후는 없다.
- 새 `KEY_RE.fullmatch` 전환은 성능 중립이다.
- `_mirror_entries` · `stray_entries` · `mirror_links` 가 `spec/` 을 여러 번 나열하지만, 디렉터리 항목은 수십 개다. `check()` 85ms 안에서 측정 가능한 비중이 아니다.
- CI `spec-mirror-integrity` 의 `sparse-checkout: spec, .claude/tools/nerv-mirror` 는 추적 파일 약 3.3만 개 전체 checkout 을 피하는 개선이다. `--check` 가 읽는 것은 이 두 경로뿐이라 동작도 맞다.
- 테스트 쪽에서 새로 생긴 비용은 미미하다. 서브프로세스 몇 개와 실제 `spec/` 스캔 하나이고, 순환 테스트의 `join(10)` 은 방어가 깨졌을 때만 기다린다.
- 문서(`README.md` · `CHANGELOG.md` · `PROJECT.md` · spec 미러)와 주석만 바뀐 파일(오케스트레이터 · 번들 우선순위 테스트 · `spec-links.ts` · `stray-tool-tags.test.ts` · `tree-walk.test.ts`)은 성능과 무관하다.

### 요약

성능 관점에서 막을 만한 변경은 없다. 미러가 169편 · 5.7MB 라서 `--check` 는 85ms, `--all` 의 `apply` 는 약 88ms 로 끝나고 모든 항목이 선형이다. 실측한 증가분은 작다. 편집 훅의 `traceback` 미리 import 가 호출마다 약 1~1.5ms 를 더하는 것이 유일하게 반복 실행 경로에 닿는 비용이고(권장: 지연 import 로 환원), 나머지는 `stale_links` 의 중복 `stat`/읽기, `apply` 검사 루프의 중복 `resolve()`, 다운로드 크기 상한 부재, `--task` 의 키별 curl 호출이다. 해제 후 크기 상한은 거짓 헤더에도 유효함을 확인했고 CI sparse-checkout 은 순수한 개선이다.

### 위험도
LOW
