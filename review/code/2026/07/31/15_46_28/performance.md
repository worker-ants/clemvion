# Performance Review

## 발견사항

- **[WARNING]** (diff 범위 밖, 참고용) `build_files_section` 이 reviewer 수만큼(최대 14회) 동일한 diff 주석/파일 번호 매기기 작업을 반복 계산 — 캐싱 여지
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1103`(`prepare_session` 의 `for agent in config["agents"]:`) → `:797`(`build_agent_prompt_body`) → `:607`(`build_files_section`)
  - 상세: 이번 diff(3개 커밋: 자연 정렬·sentinel 교체·`_charge_notice` 통합) 가 직접 만든 회귀는 아니다 — 이 루프 구조 자체는 변경되지 않았다. 다만 이번 diff 가 수정한 `_charge_notice`/`_notice_text` 로직(:561, :721-728)이 바로 이 함수 내부에 있어 함께 짚어둔다. `prepare_session` 은 `config["agents"]`(기본 13개 코어 리뷰어 + 옵트인 `user_guide_sync`, 최대 14개)마다 `build_agent_prompt_body` → `build_files_section(change_infos, max_file_size, files_budget)` 를 처음부터 다시 호출한다. `change_infos`(diff·전체 파일 내용)와 `max_file_size` 는 모든 agent 에 걸쳐 완전히 동일하므로, 파일별 `line_anchors.annotate_unified_diff`/`number_source_lines`(O(size) 라인 번호 부여)와 오버사이즈 파일의 `truncate_to_line_boundary` 가 **agent 수만큼(최대 14배) 100% 동일한 입력에 대해** 반복 계산된다. `max_total_size`(prompt 전체 예산)만 agent 별 헤더 길이 차이로 미세하게 달라져 최종 자르기 위치만 조금 다를 뿐, 1차 주석/번호 매기기 단계는 순수한 중복 연산이다. 파일 자체의 주석에 `1,200 files` 스케일 실측치가 언급될 만큼 이 harness 는 대형 changeset 에서도 동작하도록 설계돼 있어, 그 스케일에서는 이 배수가 그대로 곱해진다.
  - 제안: 파일별 `annotated`/`full_content`(주석·번호 매기기 결과, `max_file_size` 컷까지)를 agent 루프 밖에서 한 번만 계산해 캐싱하고, agent 마다 실제로 달라지는 예산 배분(`remaining_budget`/`include_content` 결정)만 반복하도록 분리하면 계산량을 O(files) 로 낮출 수 있다. 이번 PR 스코프는 아니므로 차단 사유는 아니다.

- **[INFO]** `_natural_key` 가 파일 내 기존 "정규식 사전 컴파일" 관례를 따르지 않음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:213`(`_natural_key` 정의, `re.split(r"(\d+)", path)`), 호출부 `:250`(`collect_markdown_files` 의 `files.sort(key=_natural_key)`), `:341`(`prioritize_bundle_files` 의 `sorted(file_paths, key=lambda p: (tier(p), _natural_key(p)))`)
  - 상세: 같은 파일에는 이미 `_CATALOG_BULK_RE`(:266)·`RATIONALE_HEADER_RE`(:428) 처럼 모듈 레벨 `re.compile()` 상수로 정규식을 미리 컴파일해두는 관례가 있는데, `_natural_key` 만 매 호출마다 인라인 패턴 문자열로 `re.split` 을 호출한다. `_natural_key` 는 `collect_markdown_files` 의 정렬 키(파일당 1회)와 `prioritize_bundle_files` 의 2차 정렬 키(파일당 1회)로 쓰여, 세션당 spec/conventions/plan corpus 전체 파일 수(카탈로그 자동생성 문서까지 포함하면 수백 개 규모)만큼 호출된다. `sorted()`/`.sort()` 는 key 함수를 원소당 정확히 1회만 호출하므로 반복 호출로 인한 알고리즘 등급 상승은 없고, Python `re` 모듈의 패턴 캐시(기본 512개)가 재컴파일은 막아주지만 호출마다 캐시 조회 오버헤드는 남는다.
  - 제안: 모듈 레벨에 `_NATURAL_KEY_RE = re.compile(r"(\d+)")` 를 두고 `_NATURAL_KEY_RE.split(path)` 를 사용. 현재 스케일(수백~1천 파일)에서 체감 효과는 미미하지만 비용이 없고 파일의 기존 관례와 일치한다.

- **[INFO]** `_charge_notice` 의 `*notes` 가변인자 언패킹이 제너레이터의 지연 평가(스트리밍) 특성을 무효화
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:561-578`(`_charge_notice` 정의), 호출부 `:726-728`
  - 상세: 리팩터 이전에는 `remaining_budget -= sum(_notice_cost(i) for i in content_indices)` 형태로, 제너레이터가 원소 하나씩 평가되어 정수 하나만 살아있는 채로 누적됐다(피크 메모리 O(1)). 리팩터 후에는 `_charge_notice(remaining_budget, *(_notice_text(i) for i in content_indices))` 로, `*` 언패킹이 함수 호출 인자를 만들기 위해 제너레이터를 즉시 전부 소진시켜 튜플로 만든다. 그 결과 `content_indices` 에 속한 모든 파일의 "생략 안내문" **전체 텍스트**가 동시에 메모리에 존재한 뒤에야 `_charge_notice` 내부에서 `len()` 합산이 이뤄져, 피크 메모리가 파일 수(k)에 비례해 O(1)→O(k) 문자열로 늘었다. 다만 기본 `batch_size`(50)와 안내문 길이(수백 자) 기준으로는 최악의 경우도 수십 KB 수준이라 실질적 영향은 무시할 만하다.
  - 제안: `_charge_notice` 가 `*args` 대신 이터러블을 그대로 받아(`_charge_notice(budget, notes_iterable)`) 내부에서 `sum(len(n) for n in notes_iterable)` 로 순회하면, 단일 값·다중 값 호출부 형태를 모두 유지하면서 원래의 지연 평가 특성도 되살릴 수 있다.

## 요약

이번 변경(자연 정렬 `_natural_key` 도입, 파일 경계 구분자를 문자 휴리스틱에서 sentinel 로 교체, 예산 차감 산술을 `_charge_notice` 하나로 통합)은 모두 harness 번들 "정확성" 결함을 고치는 리팩터로, 새로운 알고리즘 복잡도 등급 상승·N+1 호출·블로킹 I/O·캐시 무효화 문제를 도입하지 않는다. `_natural_key` 는 정렬 key 함수로 파일당 1회만 호출되어 O(n log n) 특성을 그대로 유지하고, sentinel 교체도 `str.partition`/`split` 의 선형 시간 특성에 영향이 없다. `_charge_notice` 리팩터는 계산량이 이전과 사실상 동일한 정확성 개선이며, `*notes` 가변인자로 인한 메모리 피크 증가는 현재 배치 크기 기준 무시할 수준이다. `_natural_key` 가 파일 내 기존 정규식 사전컴파일 관례를 따르지 않는 점도 실제 영향은 미미하다. 참고로 `build_files_section` 이 reviewer(최대 14명)마다 동일한 diff/파일 주석 작업을 반복 계산하는 기존 구조가 이번 diff 가 직접 만지는 코드 바로 안에 있어 함께 짚었다 — 이는 이번 변경이 만든 회귀가 아니라 diff 범위 밖의 기존 특성이며, 세션당 최대 14배의 회피 가능한 CPU 작업이라 캐싱을 통한 개선 여지가 있다.

## 위험도

LOW
