### 발견사항

- **[INFO]** `pull.py --task` 가 문서마다 curl 프로세스를 새로 띄워 직렬로 받는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:426-452` (`cmd_task` 의 키 루프), `:311-322` (`Nerv.get`)
  - 상세: 키마다 `curl` 을 새로 실행하므로 TCP·TLS 연결이 재사용되지 않습니다. 실제 NERV 서버에 읽기 GET 만 보내 측정했습니다. 토큰은 출력하지 않았고 저장소 밖 scratch 에서 돌렸습니다.
    - `specs/tree` 1회: 903 ms, 177 KB. `--task` 를 돌릴 때마다 전체 트리를 받고 조건부 요청도 없습니다.
    - 문서 8편 직렬: 5,464 ms (문서당 약 683 ms, 합계 413 KB).
    - 같은 8편을 스레드 4개로: 1,473 ms (약 3.7배 빠름).
    - 문서당 시간이 용량이 아니라 지연에 묶여 있습니다. ETag 304 가 줄이는 것은 바이트뿐이라 시간은 거의 그대로입니다.
    - scope 가 영역 하나(약 30편)에 이르면 직렬로 약 20초가 걸립니다. 이 수치는 측정이 아니라 문서당 683 ms 에서 외삽한 값입니다.
    - 작업 1건에 1회 돌리는 수동 도구이고 scope 가 보통 작아서 차단 수준은 아닙니다.
  - 제안: 필요해지면 받는 단계(`nerv.get`)만 `ThreadPoolExecutor(max_workers=4)` 로 병렬화합니다. `Nerv.get` 은 상태가 없어 스레드에 안전하고, `apply()` 는 이미 키 순으로 정렬해 쓰므로 출력 결정성은 유지됩니다. 캐시 쓰기와 `apply` 는 직렬로 둡니다. scope 크기가 문제로 드러나기 전에는 미뤄도 됩니다.

- **[INFO]** CI 잡 `spec-mirror-integrity` 가 저장소 전체를 checkout 한다
  - 위치: `.github/workflows/spec-link-checks.yml:142-143` (checkout), `:147` (`pull.py --check`)
  - 상세: 이 잡이 읽는 파일은 `spec/`(566개)와 `pull.py` 1개뿐입니다. 그런데 `actions/checkout@v7` 은 추적 파일 33,508개를 전부 받습니다. 그중 29,313개가 `review/` 입니다.
    - 헤더 주석의 "잡이 1초 안에 끝나" 는 스크립트 실행을 가리킵니다. 로컬 실측으로 `pull.py --check` 는 169편에 0.068초였습니다.
    - checkout 시간은 측정하지 못했고(CI 를 돌릴 수 없음) 파일 수만 근거입니다.
    - 이 잡은 `spec-link-integrity` 와 병렬로 돌아서 총 소요 시간은 늘지 않고 runner 분만 더 씁니다. 다만 `relevant` 가 `codebase/**` 전체를 포함해 대부분의 PR 에서 돕니다.
  - 제안: 이 잡의 checkout 에 sparse-checkout 을 줍니다.
    ```yaml
    - uses: actions/checkout@v7
      with:
        sparse-checkout: |
          spec
          .claude/tools/nerv-mirror
    ```
    `--check` 는 표준 라이브러리만 쓰므로 추가 경로가 필요 없습니다. 실익은 CI 에서 checkout 시간을 한 번 재 보고 판단하면 됩니다.

- **[INFO]** 미러 169편이 `review_guard` 의 spec `code:` 글로브 스캔 대상에 들어왔다 (이 diff 의 간접 효과)
  - 위치: `.claude/hooks/_lib/review_guard.py:698-717` (`_spec_code_patterns`), 호출 `:1021` (`evaluate_review`). 이 diff 의 파일은 아닙니다.
  - 상세: Stop·push 게이트가 호출될 때마다 `spec/**/*.md` 를 전부 걷고 각 파일의 frontmatter 를 읽어 `code:` 를 찾습니다. 캐시는 없습니다. 미러 frontmatter 에는 `code:` 키가 없어 스캔에 더해지는 글로브가 없습니다(미러 제외 여부와 무관하게 775개로 같음). 파일 수만 387에서 557로 늘었습니다.
    - 걷기와 파싱: 약 16~20 ms에서 약 25~29 ms로, +9 ms 안팎입니다.
    - `_spec_code_patterns` 전체(정규식 컴파일 포함)는 약 55~60 ms입니다.
    - 측정값이 흔들려 배수보다 절대값(+10 ms 미만)을 봐야 합니다.
    - 게이트가 git 호출을 동반하므로 체감할 차이는 없습니다.
  - 제안: 조치는 필요 없고 기록만 합니다. 미러가 더 커지면 `_spec_code_patterns` 가 오케스트레이터처럼 미러 경로(`CLE-*`, `README.md`)를 건너뛰게 하거나 호출 안에서 결과를 메모이즈합니다. 미러에 `code:` 가 영영 없다는 보장은 없으므로 건너뛰기는 그때 정책으로 정합니다.

### 확인하고 문제 없음으로 본 것 (측정값)

- **`pull.py` 연산**: 합성 export.zip(미러 169편을 압축한 2.0 MB)으로 `--all` 을 scratch 루트에 돌렸습니다.
  - 첫 pull(169편 쓰기)과 두 번째 pull(전부 그대로)이 각각 약 115 ms입니다.
  - `--check` 는 실제 미러 5.7 MB에 68 ms입니다.
  - `rewrite_links` 가 링크마다 `os.path.relpath`(내부 `getcwd` 2회)를 부르고 `write_if_changed` 가 `spec_root.resolve()` 를 반복합니다. 이 비용은 위 115 ms에 이미 들어 있어 최적화할 이유가 없습니다.
  - `docs_from_zip` 은 카탈로그 항목을 `zf.read` 전에 걸러서 272편을 풀지 않습니다.
  - 메모리에 전체 export 와 모든 `raw` 를 들고 있지만 수 MB 수준입니다.
- **편집 가드 훅**: 호출 1회에 20.8 ms입니다. 파이썬 기동만 12.8 ms이고, 이미 있던 `guard_default_branch_edit.py` 는 38.7 ms입니다. 등록 명령(`test ! -f … || python3 …`)은 22.8 ms입니다. `realpath` 와 조상 `.git` 탐색은 깊이 10 안팎의 stat 이라 무시할 수 있습니다. 같은 matcher 의 훅이 병렬로 돌면 지연이 더해지지 않고, 직렬이어도 편집당 약 +23 ms입니다.
- **consistency 오케스트레이터**: `is_nerv_mirror` 필터는 557개 파일에 1.85 ms입니다(`collect_markdown_files` 자체는 3.6 ms). 미러가 번들에 들어가지 않으므로 예산 경합도 없습니다.
- **frontend walker**: `inNervMirror` 는 선형 정규식이라 역추적 문제가 없습니다. `CLE-[A-Z0-9-]+` 뒤가 `\.md` 나 `/` 라서 겹치는 구간이 없습니다. `walkTree` 는 여전히 미러 디렉터리를 `readdirSync(withFileTypes)` 로 훑지만 파일 수백 개 수준이라 `skipDir` 을 더해도 얻는 것이 없습니다.
- **새 테스트 시간**:
  - `test_nerv_mirror_pull` + `test_guard_nerv_owned_paths` 58개가 4.0초입니다.
  - `NervMirrorStaysOutOfTheOldCorpusTest` 2개가 1.6초입니다. 대부분 `collect_context` 를 실제 저장소에서 돌리는 서브프로세스 1회입니다.
  - `test_tree_cycle_stops` 의 `join(10)` 은 방어가 깨졌을 때만 10초를 씁니다.

측정은 모두 저장소 밖 scratch(`/private/tmp/claude-501/-Volumes-project-private-clemvion/52477887-e230-4159-906d-cdf4c5878063/scratchpad/review-scratch-r2/performance/`)에서 했습니다. 저장소 안에서는 읽기 전용 명령과 `PYTHONDONTWRITEBYTECODE=1` 로 돌린 unittest 만 썼고, 끝난 뒤 `git status --short` 는 시작 시점과 같았습니다. 원복할 것은 없습니다.

### 요약

성능 관점에서 막을 만한 결함은 없습니다. 미러 도구와 훅, 오케스트레이터 필터, walker 필터는 모두 169편·557파일 규모에서 측정상 무시할 수 있는 비용입니다(`--all` 115 ms, `--check` 68 ms, 훅 21 ms, 필터 1.85 ms). 눈에 띄는 것은 세 가지로, 모두 INFO 입니다. 첫째는 `--task` 의 직렬 curl(문서당 약 0.68 초, 스레드 4개로 3.7배 단축)입니다. 둘째는 CI 잡의 불필요한 전체 checkout(추적 파일 33.5k개 중 필요한 것은 567개)입니다. 셋째는 미러 때문에 늘어난 `review_guard` 스캔(+9 ms)입니다. 첫째와 둘째는 필요해질 때 고치면 되고, 셋째는 기록만 합니다.

### 위험도
LOW
