# 성능(Performance) 리뷰 결과

## 발견사항

- **[WARNING]** 2차(prompt 총예산) 절단이 이제 `max_file_size` 로 상한이 걸려 있지 않은
  원본 전체를 다시 자른다 — 대형 파일 1개당 O(원본 파일 크기) 로 재확대될 수 있음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:765-767`
    (함수 `build_files_section`, `else` 분기)
  - 상세: 기존 코드는 2차 절단이 항상 `full_content`(1차 `max_file_size` 절단을 이미
    거쳤거나, 애초에 그보다 작았던 문자열 — 어느 경우든 `len(...) <= max_file_size`,
    기본값 55,296자)를 대상으로 했다. 이번 변경은 "2차 절단이 1차 절단의 주석(`_truncated_note`)
    까지 포함한 문자열을 다시 잘라 총 줄 수를 오보고하는" 버그를 고치기 위해, 2차 절단
    대상을 `file_parts[i]["source_lines"]`(= `numbered`, 1차 절단이 전혀 적용되지 않은
    **원본 전체 numbered 문자열**)로 바꿨다(633-636, 662-663줄에서 저장). 그런데
    `full_file_content` 는 `build_cli_change_info`(1086줄, `f.read()`)에서 크기 상한 없이
    통째로 읽히므로, 바이너리로 분류되지 않는 대형 텍스트 파일(예: 대형 lockfile, 생성된
    JSON/SQL 덤프, 압축 안 된 번들 등)이 diff 에 포함되고 동시에 나머지 prompt 예산에도
    맞지 않는 경우, `line_anchors.truncate_to_line_boundary` 가 `text.splitlines()` 를
    **원본 전체 크기**에 대해 무조건 1회 수행하게 된다(1차 절단 때는 이 호출이 항상
    `max_file_size` 이하로 상한이 걸려 있었음). 버그 수정 자체는 타당하지만, 부작용으로
    "1차 절단이 보장하던 상한"이 2차 절단 경로에서는 사라졌다.
  - 제안: `source_lines` 를 무제한으로 보관하는 대신, `build_cli_change_info` 단계(또는
    `full_file_content` 획득 직후)에서 파일 읽기 자체에 합리적 상한(예: `max_file_size` 의
    몇 배수)을 두거나, 2차 절단 시 `source_lines` 를 사용하되 그 이전에 이미 `max_file_size`
    로 한 번 더 캡핑해 두 절단 모두 O(`max_file_size`) 를 넘지 않도록 한다. (드물게만
    발동하는 경로이고 올바름을 위한 의도적 트레이드오프이므로 CRITICAL 은 아니지만, 대형
    파일이 섞인 리뷰 세션에서 눈에 띄는 지연으로 재발할 수 있어 WARNING.)

- **[INFO]** 모든 파일에 대해 무조건 `total_lines` 를 계산 — 실제로는 2차 절단 분기에
  진입하는 소수 파일만 필요
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:634`
    (`total_lines = numbered.count("\n") + 1 if numbered else 0`)
  - 상세: 변경 전에는 "줄 수" 계산(`file_parts[i]["full_content"].count("\n") + 1`)이
    실제로 필요한 시점 — 즉 2차 절단이 발동하는 `else` 분기 안 — 에서만 수행됐다. 이번
    변경은 이를 루프 최상단으로 끌어올려 **모든** change_info 각각에 대해 무조건
    `numbered` 문자열 전체를 훑는 `.count("\n")` 호출을 추가한다. `str.count` 는 C 구현으로
    빠르고 이미 같은 줄에서 수행되는 `number_source_lines`(내부적으로 `splitlines()` +
    문자열 조립)보다 훨씬 가벼우므로 실질 영향은 작지만, 대다수 파일은 이 값을 전혀 쓰지
    않고 버려지므로(2차 절단 분기까지 가지 않는 파일이 다수) 불필요한 선행 계산이다.
  - 제안: `total_lines` 계산을 2차 절단이 실제로 필요한 지점(756번째 줄 부근, `else` 분기
    진입 시)으로 다시 늦추거나, `number_source_lines` 자체가 내부에서 이미 계산한
    `len(lines)` 를 반환하도록 확장해 재스캔을 아예 없앤다.

- **[INFO]** `_natural_key` 가 동일 파일 목록에 대해 중복 계산되고, 모듈의 다른 정규식과
  달리 미리 컴파일되지 않음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:229-244`
    (`_natural_key` 정의), 사용처 `:266`(`collect_markdown_files` 의 `files.sort(key=_natural_key)`)
    와 `:359`(`prioritize_bundle_files` 의 `sorted(file_paths, key=lambda p: (tier(p), _natural_key(p)))`)
  - 상세: `prioritize_bundle_files` 는 이미 `collect_markdown_files` 가 `_natural_key` 로
    정렬해 넘긴 목록을 다시 받아 tier 우선 정렬을 한다. 이전 코드는 2차 정렬의 보조 키가
    단순 문자열 `p` 자체(추가 계산 없음)였지만, 이번 변경으로 2차 정렬도 매 파일마다
    `_natural_key(p)`(`re.split(r"(\d+)", path)` + 리스트 컴프리헨션)를 다시 계산한다 —
    같은 파일 목록에 대해 사실상 동일한 값을 두 번 만드는 셈이다. 같은 파일 안에서
    `RATIONALE_HEADER_RE`/`_CATALOG_BULK_RE` 는 모듈 스코프에서 `re.compile` 로
    미리 컴파일해 두는 관례가 있는데, `_natural_key` 만 매 호출마다 raw 패턴 문자열로
    `re.split` 을 호출한다(`re` 내부 캐시가 재컴파일은 막아주지만, 컴파일된 객체를 직접
    쓰는 것보다는 근소하게 느리고 관례에서도 벗어난다). 코퍼스 규모(spec/plan/conventions,
    이 PR 문서 기준 최대 약 230개 카탈로그 파일)를 감안하면 체감 영향은 미미하다.
  - 제안: 급하지 않음. 스타일 일관성 차원에서 `_NATURAL_KEY_DIGITS_RE = re.compile(r"(\d+)")`
    를 모듈 상수로 빼고, 여유가 있다면 `prioritize_bundle_files` 가 이미 자연정렬된 입력임을
    아는 호출 경로(예: `collect_markdown_files` 직후)에서는 보조 키 재계산을 생략하는 것도
    고려 가능.

- **[INFO]** `_neutralize_sentinel` 이 모든 문서 읽기 경로에 새 O(n) 스캔을 추가
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:213-227`
    (정의), 호출처 `:368`(`format_file_bundle`), `:466`(`extract_rationale_sections`),
    `:554`·`:561`(`--spec`/`--plan` target_doc), `:594`(`--impl-done` diff 섹션)
  - 상세: `text.replace(...)` 는 파일 전체를 한 번 더 훑는다. 코퍼스 전체 크기에 비례하는
    선형 비용이지만, 같은 문자열에 대해 이미 수행되는 `format_file_bundle`/
    `truncate_file_bundle` 의 partition/split 등과 동일한 차수라 상대적으로 무시할 수
    있는 수준. 정합성(경계 위조 방지)을 위해 필요한 트레이드오프이므로 문제 삼을 정도는
    아니고 참고용으로만 기재.

## 요약

이번 변경은 두 orchestrator 의 "컨텍스트 예산 절단" 로직에서 실제로 관측된 정합성 결함
(파일 경계 오인식, 2중 절단 시 총 줄 수 오보고, 사전순 정렬로 인한 대상 파일 예산 탈락)을
고치는 데 집중되어 있고, 새로 추가된 알고리즘적 비효율·N+1 호출·블로킹 I/O·캐시 무효화
문제는 없다. 유일하게 주목할 만한 항목은 `code_review_orchestrator.py` 의 2차 절단이
이제 `max_file_size` 로 상한이 걸리지 않은 원본 전체(`source_lines`)를 대상으로 하게 되어,
크기 제한 없이 통째로 읽히는 개별 대형 파일이 diff 에 섞이는 드문 경우 1차 절단이
보장하던 상한이 2차 절단 경로에서 사라진다는 점이다 — 버그 수정에 따른 의도된 트레이드오프이지만
관측 가능하므로 WARNING 으로 남긴다. 나머지(`total_lines` 선행 계산, `_natural_key` 중복
계산, `_neutralize_sentinel` 의 추가 스캔)는 모두 코퍼스/파일 크기에 선형이고 이미 존재하는
동급 연산에 비해 미미해 INFO 수준이다.

## 위험도
LOW
