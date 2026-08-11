# 유지보수성(Maintainability) Review

대상: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`,
`.claude/tests/test_consistency_bundle_priority.py`,
`plan/complete/consistency-named-in-substring-match.md`

## 발견사항

- **[INFO]** 경계 클래스의 비대칭(앞엔 `.` 포함, 뒤엔 미포함)은 바로 위 주석으로 자명하다 — 통일 위험 낮음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:289-293`
  - 상세: `_NAME_START = r"(?<![A-Za-z0-9_.\-])"` / `_NAME_END = r"(?![A-Za-z0-9_\-])"` 바로 위 3줄
    주석("`.` joins the LEADING class so `v2.store.md` does not answer for `store.md`, but not
    the trailing one: the needle already ends in `.md`, and a trailing `.` is ordinary prose")이
    비대칭의 이유를 명시적으로 설명한다. 실제 정규식 동작도 설명과 일치함을 직접 추적해 확인했다:
    `v2.store.md` 안의 `store.md`는 직전 문자 `.`가 START 클래스에 포함돼 거부되고(289-293의 취지대로),
    `secret-store.md` 안의 `store.md`도 직전 문자 `-`가 같은 클래스에 있어 거부된다(이번 수정이 막으려던
    바로 그 오매치). `store.md.`(문장 끝 마침표)는 END 클래스에 `.`이 없어 정상적으로 매칭된다. 다음
    유지보수자가 "왜 앞뒤가 다르지"라고 물었을 때 답이 코드 옆에 있다 — 좋은 상태.
  - 제안: 유지. 다만 END 클래스가 `.`을 배제하지 않는다는 것은 `store.md.bak`처럼 실제로는 다른 파일을
    가리키는 문자열도 매칭 대상이 됨을 뜻한다(정확성 관점 미세 잔여 케이스 — 이 리뷰의 범위인 가독성
    자체는 문제 없음). 향후 이 경계를 다시 여는 사람을 위해 "trailing `.`을 넣지 않는 이유"에 한 줄
    더("→ `store.md.bak`류 오탐은 감수한다" 식)를 얹으면 완전해지지만, 현재도 자명성 기준은 충족한다.

- **[WARNING]** `in` prefilter + `re.search` 이중 구조의 "성능 실측" 근거가 plan `## 검증` 절에 없다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:311-312`
    (근거 확인 대상: `plan/complete/consistency-named-in-substring-match.md:86-96` `## 검증 — 양방향 뮤테이션`)
  - 상세: 코드 주석은 "`in` first: it is the cheap reject for the overwhelmingly common 'not
    mentioned at all' case, and the regex only runs on survivors"라고만 말하고, 이번 호출 규약 프롬프트는
    "성능을 실측했다 — plan §검증 참조"를 지시한다. 그러나 plan 문서의 `## 검증` 절을 직접 열어 확인한
    결과, 그 절은 **뮤테이션 테스트 결과**(경계 제거 2건 RED / 과잉 조임 4건 RED)만 다루고 있고, `in`
    선검사가 실측으로 유의미한 시간을 줄였다는 수치(ms, 호출 횟수 등)는 어디에도 없다. 유일하게 "성능"에
    닿는 문구는 "`in` 을 먼저 돌려 싼 거절을 유지한다(정규식은 생존자에만). 리터럴 + lookaround 라
    선형이다"인데, 이는 **정규식 자체가 catastrophic backtracking이 없다(=안전하다)**는 주장이지, 이중
    구조가 단일 `re.search` 대비 실측으로 빨랐다는 근거가 아니다. 두 주장(안전성 vs 속도)이 다른데 같은
    문장으로 뭉뚱그려져 있어, 다음 사람이 "실측됐다"고 그대로 믿고 넘어갈 위험이 있다(이 저장소가 이미
    반복적으로 겪은 "미측정 전제" 패턴과 같은 모양).
  - 제안: (a) 실제 벤치마크가 있다면 수치를 주석/plan에 남기고, (b) 없다면 "cheap reject" 정도의 직관적
    정당화로 표현을 낮추거나, (c) 정말 짚어야 한다면 한 번 프로파일링해서 남긴다. 코드 자체의 복잡도
    증가는 미미(조건 1개 + 주석 2줄)해서 구조를 걷어내라는 요구는 아니다 — "측정했다"는 프레이밍과 실제
    plan 내용의 불일치만 정정하면 된다.

- **[INFO]** `_named_in`/`_n_on_topic`의 새 주석은 이 파일의 기존 컨벤션과 일치 — 다만 `_n_on_topic` 쪽은
  plan 문서와 서사가 중복된다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:283-293`(모듈 상수),
    `:297-307`(docstring), `:562-571`(`_n_on_topic`)
  - 상세: 함수 단위로만 보면 주석/코드 비율이 높다 — `_NAME_START`/`_NAME_END`는 코드 2줄에 주석 9줄,
    `_n_on_topic`은 로직 8줄에 새로 늘어난 주석만 10줄이다. 그러나 이 파일 전체가 이미 모든 함수에서
    동일한 스타일(측정 날짜·수치·이전 결함 서사를 포함하는 긴 "왜" 주석 — `_edited_rels`,
    `_collect_code_diff`, `truncate_file_bundle`, `prioritize_bundle_files` 등)을 일관되게 쓰고 있어,
    이번 추가가 새로운 이질감을 만들지는 않는다(점검 관점 8: 일관성 충족). 다만 `_n_on_topic`의 새 주석은
    `plan/complete/consistency-named-in-substring-match.md`의 `## 원인` 절 서사(같은 날짜 2026-08-11,
    같은 파일 `cafe24-api-catalog/store.md`, 같은 인용문 "cannot reach the prefix unless the branch
    edited it" · "mutating the check away left every test green")를 코드 주석에도 사실상 그대로
    재서술한다. 같은 이야기가 코드 주석과 plan 문서 두 곳에 존재해, 이해가 나중에 갱신되면 두 곳을 함께
    고쳐야 하는 드리프트 위험이 생긴다(이 저장소가 "Change both" 주석 방식의 위험성을 다른 곳에서 이미
    명시적으로 경계한 바 있다 — 예: `_load_state` 위 주석).
  - 제안: 강하게 요구하지는 않는다(파일 전체 컨벤션과 부합). 다만 필요하면 `_n_on_topic`의 서사 문단을
    "결론 + plan 문서 링크"로 압축하는 것도 고려할 만하다 — 단, 이 파일의 다른 곳들이 이미 plan을
    참조하지 않고 자체 완결적 주석을 쓰는 컨벤션이라 필수 변경은 아니다.

- **[INFO]** 같은 "본문에서 파일명을 부분 문자열로 찾는" 경계 문제가 저장소 다른 곳에 재현되는지 확인 —
  못 찾음(뜻으로 훑음, 문자열 grep 결과에만 의존하지 않음)
  - 위치: 확인 대상 — `.claude/skills/**/scripts/*.py`, `.claude/hooks/**`, `.claude/_shared/**`
  - 상세: `_named_in`과 같은 위상의 로직("텍스트 본문이 이 파일/경로를 언급하는가"를 부분 문자열로
    판정)이 있는지 개념 단위로 훑었다.
    - `code_review_orchestrator.py`(이 orchestrator의 자매)에는 `plan_text`를 받아 파일명 언급 여부를
      판정하는 함수 자체가 없다(`prioritize_bundle_files`류 우선순위 랭킹 로직 부재) — `grep -n
      "plan_text\|_named_in\|prioritize_bundle\|mention"` 0건.
    - `plan_guard.py:213-219`의 basename 비교는 `os.path.basename(p) == base` **완전 일치**이지 부분
      문자열 포함이 아니라 같은 결함 클래스가 아니다.
    - `report_paths.py`/`retry_state.py`의 basename 처리도 마찬가지로 등가 비교·집합 멤버십
      (`"SUMMARY.md" in files`형, 리스트 요소 단위)이라 서브스트링 취약점이 없다.
    - `spec-coverage`, `merge-coordinator`의 orchestrator 스크립트는 "본문이 무엇을 언급하는가"를
      코드 문자열 매칭이 아니라 checker sub-agent(LLM) 판단에 위임한다.
    - `review_guard.py`의 `**/` glob→regex 변환기는 세그먼트 경계를 다루지만 glob 컴파일 문제이지
      "본문 안 파일명 언급" 문제가 아니다.
    결론: 이번 경계 클래스(`_NAME_START`/`_NAME_END`)가 필요한 자리는 현재 이 함수 하나로 보인다 — 억지로
    두 번째 위치를 만들지 않는다.
  - 제안: 없음(현상 유지). 다만 향후 유사한 "본문이 이 식별자를 언급하는가" 판정이 다른 스크립트에
    필요해질 경우를 대비해, 이 상수들은 현재 `consistency_orchestrator.py`에 private(`_` 접두)으로 갇혀
    있어 재사용이 어렵다는 점만 참고— 그 시점이 오면 `.claude/_shared/`로 승격을 고려할 만하다(지금
    승격할 근거는 없음, YAGNI).

## 요약

이번 변경(`_named_in` 3→~12줄, 모듈 상수 2개 추가)은 실제 관측된 오매치(부분 문자열 `store.md` ⊂
`secret-store.md`)를 lookaround 기반 경계 클래스로 정확히 막고, 앞뒤 비대칭의 근거를 코드 옆 주석에
명시해 자명성을 확보했다. 함수 자체는 짧고 단일 책임이며 네이밍·중첩·복잡도 모두 문제 없고, 저장소
다른 곳에 같은 문제 형태가 재현되는 자리도 찾지 못했다(뜻으로 훑은 결과 — 억지 발견 없음). 유일하게
짚을 지점은 `in`+정규식 이중 구조에 붙은 "성능을 실측했다"는 프레이밍이 plan 문서의 실제 `## 검증` 절
내용(뮤테이션 테스트일 뿐 타이밍 벤치마크가 아님)과 어긋난다는 것 — 코드 복잡도 자체보다는 주석·plan
간 주장의 정확성 문제다. 주석 분량은 함수 단위로는 크지만 파일 전체의 기존 컨벤션과 일치해 새로운
이질감은 아니다.

## 위험도
LOW

STATUS: OK
