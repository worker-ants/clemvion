# 유지보수성(Maintainability) 리뷰 — deps-guard-hardening (04_35_33 라운드)

## 스코프 메모

리뷰 대상 21개 파일 중 실질 코드는 `scripts/check-override-floors.py` 1개뿐이다(361줄, `pnpm audit`
기반 override 바닥 침식 검출 CI 가드). 나머지 20개는 직전 두 라운드(`03_47_10`=5차, `04_09_43`=6차)의
harness 자동 생성 리뷰 산출물(SUMMARY/`_retry_state.json`/`meta.json`/에이전트별 `.md`)이며,
CLAUDE.md 규약대로 `review/code/**`에 커밋되는 것이 정상 동작이다. JSON 파일 4개(`meta.json`,
`_retry_state.json` ×2세트)는 `python3 -m json.load`로 직접 파싱해 구조 손상이 없음을 확인했다.
함수 길이·중첩·매직넘버 등 코드 지표를 적용할 대상이 아니므로 별도 코드 리뷰는 하지 않는다 — 이상 없음.

`scripts/check-override-floors.py`는 이미 6차례 리뷰를 거쳤고, 그중 유지보수성 관점 리뷰는 2회
(`review/code/2026/08/01/03_47_10/maintainability.md`=5차, `review/code/2026/08/01/04_09_43/maintainability.md`=6차,
둘 다 이번 페이로드에 포함)였다. 이번 라운드는 (1) 직전 두 유지보수성 리뷰가 이미 낸 발견사항을
재확인해 중복 보고를 피하고, (2) 그 이후 실제로 바뀐 부분 — 커밋 `1598f542f`("6차 리뷰 조치")가
`load_override_targets()`를 재작성한 부분(`overrides` 키 존재 검사 → 타입 검사, `yaml.YAMLError`
처리 추가) — 을 `git show 1598f542f -- scripts/check-override-floors.py`로 직접 대조해 새로 검토했다.

## 발견사항

- **[INFO]** 진단용 "최상위 키 프리뷰" 삼항식이 두 함수에 구조적으로 동일하게 중복되어 있고,
  그중 YAML 쪽 사본만 비-문자열 키에 취약한 `sorted()`를 쓴다 — 6차 이전부터 있었지만 5·6차
  유지보수성 리뷰 어느 쪽도 지적한 적 없는 신규 관측.
  - 위치: `scripts/check-override-floors.py:143`(`load_override_targets()`) 와
    `scripts/check-override-floors.py:204`(`run_audit()`)
  - 상세: 두 곳 모두 `_undecidable()`의 `detail` 인자를 `... if isinstance(data, dict) else
    type(data).__name__` 형태의 동일한 삼항식으로 만든다 — `143`행은
    `sorted(data)[:_KEY_PREVIEW]`, `204`행은 `list(data)[:_KEY_PREVIEW]`로 정렬 여부만 다르다.
    `257`/`267`행(`classify_vulnerable()`의 스키마 드리프트 가드 2곳, 5·6차 리뷰가 이미 지적한
    별개의 중복)과 달리 이 둘은 서로 다른 파서를 다룬다: `204`행의 `data`는 `json.loads()` 결과라
    키가 항상 `str`이므로 `list()`든 `sorted()`든 안전하지만, `143`행의 `data`는
    `yaml.safe_load()` 결과라 **키가 문자열이 아닐 수 있다**(PyYAML 은 YAML 1.1 리졸버를 써서
    따옴표 없는 `on`/`off`/`yes`/`no`/`true`/`false`를 불리언으로 해석한다). 최상위에 그런 키가
    하나라도 섞이면 `sorted(data)`는 문자열·불리언 비교로 `TypeError`를 던진다(직접 재현 확인:
    `sorted({'overrides': 'x', True: 1, 'a': 1})` → `TypeError: '<' not supported between
    instances of 'bool' and 'str'`). 이 코드는 `overrides` 값이 이미 매핑이 아니라고 판정된
    **fail-closed 진단 메시지 구성 중**에만 실행되므로, 트리거되면 `_undecidable()`의 친절한
    `ERROR: ...`/exit 2 대신 처리되지 않은 파이썬 traceback 과 함께 **exit 1**로 죽는다 — 바로
    윗줄(`131-132`)의 주석이 `yaml.YAMLError`를 못 잡았을 때의 위험으로 명시적으로 경계하는
    "이 스크립트 어휘에서 1 은 '침식 발견' 이라 구문 오류가 정상 발견 신호와 같은 코드가 된다"는
    실패 형태를 아주 좁은 조건(`overrides` 도 잘못되고 다른 최상위 키도 비-문자열인 이중 조건)에서
    그대로 재현한다. 코어 불변식(조용한 성공 없음)은 깨지지 않는다 — 여전히 비-0 으로 끝난다 —
    는 점에서 `requirement.md`(5차, 이번 페이로드 파일 6)가 이미 INFO 로 판정한 "6곳 밖 스키마
    드리프트 시 미가공 예외" 항목과 같은 급이라 그와 동일하게 INFO 로 판단한다.
  - 제안: 즉시 조치 불요(발생 2회로 이 파일이 채택한 "3번째 발생 전 헬퍼 추출 보류" 기준에
    미달). 다만 이 특정 쌍은 견고성 차이가 있으므로 저비용 정합화를 권한다 — `143`행의
    `sorted(data)`를 `204`행과 동일한 `list(data)`로 바꾸거나(정렬은 프리뷰 목적상 필수가
    아님), `sorted(data, key=repr)`로 바꿔 비교 가능성을 없앤다.

- **[INFO]** (긍정 관측) 6차 델타(`load_override_targets()` 재작성, `1598f542f`)가 파일의 기존
  관용구를 정확히 재사용해 새 결함을 들이지 않았다.
  - 위치: `scripts/check-override-floors.py:119-148`
  - 상세: 판정 기준을 "`overrides` 키가 있는가"에서 "`overrides` 값이 매핑인가"로 바꾸면서
    키 부재·오타·값 없음(`None`)·비-매핑 값 네 가지 입력 형태를 한 `isinstance` 검사로
    합쳤다(`134-144`). `yaml.YAMLError` 처리(`128-133`)도 파일 전체가 이미 쓰는
    "예외를 잡아 `_undecidable()`로 라우팅" 관용구, `NoReturn` 반환 뒤 코드가 계속되는 것에
    기대는 흐름(`except` 블록 뒤 `134`행이 `data`가 정상 할당됐다고 가정)도 `run_audit()`의
    `TimeoutExpired` 처리(`183-188`)와 동일한 이미 확립된 패턴이다. 함수 길이도 30줄(문서화
    7줄 포함)로 여전히 파일 내 최장 함수(`classify_vulnerable`, 61줄)를 넘지 않고, 중첩도
    최대 2단계(try/except 또는 if)를 넘지 않는다.
  - 제안: 조치 불요.

- **[INFO]** (재확인, 변경 없음) 5·6차 유지보수성 리뷰가 이미 보고한 항목 3건은 이번 라운드에서도
  유효하며 이번 델타로 인한 변화가 없다 — 반복 보고하지 않고 참조만 남긴다.
  - `classify_vulnerable()` 내 스키마 드리프트 가드 2곳(`:253-258`, `:263-268`)의 구조적 중복 —
    발생 2회, "3번째 발생 전 보류" 기준 미달 (`03_47_10/maintainability.md`, `04_09_43/maintainability.md`
    양쪽이 이미 지적).
  - `classify_vulnerable()`가 파일 내 최장 함수(61줄)이나 단일 응집 책임 유지 — 분리 불요
    (`04_09_43/maintainability.md`).
  - `main()`의 `widened`/`eroded` 산출 로직이 이름 없이 인라인돼 있어 파일의 나머지
    "이름 있는 함수 + `_report_*` 대칭" 관례와 결이 다름(`:286-296`, `:298-301`) — 급하지 않음
    (`04_09_43/maintainability.md`). 6차 델타는 `load_override_targets()`만 건드려 `main()`은
    변경되지 않았으므로 이 판단이 그대로 유효하다.

## 요약

이번 라운드가 새로 검토한 델타(`load_override_targets()` 재작성, 13행 순증)는 판정 기준을
"키 존재"에서 "값 타입"으로 일반화하면서도 파일이 5차례 리뷰를 거치며 수렴시킨 관용구
(`_undecidable()` 단일 진입점, `NoReturn` 타입, "왜"를 설명하는 인접 주석, named 상수)를 그대로
따라 새로운 구조적 결함을 들이지 않았다. 이번 라운드에서 직접 찾은 유일한 신규 항목은 진단
메시지용 "최상위 키 프리뷰" 삼항식이 YAML 경로(`143`행)와 JSON 경로(`204`행)에 동일한 모양으로
중복돼 있고, 그중 YAML 쪽만 비-문자열 최상위 키에 대해 `sorted()`가 `TypeError`를 던질 수 있는
좁은 견고성 격차다 — 이 파일 자신이 이미 명시적으로 경계하는 "exit 1/2 혼동" 실패 형태를 아주
좁은 조건에서 재현하지만 조용한 성공(exit 0)으로는 이어지지 않아 핵심 불변식은 유지된다. 저비용
개선(정렬 제거 또는 `key=repr`)을 권하되 이 파일이 이미 채택한 "3번째 발생 전 보류" 기준에 따라
지금 당장 조치 필수는 아니다. 5·6차 라운드가 이미 보고한 항목(스키마 드리프트 가드 2곳 중복,
`classify_vulnerable` 함수 길이, `main()` 인라인 계산 비대칭)은 이번 델타로 변화가 없어 재확인만
하고 반복 서술하지 않았다. 병합을 막을 CRITICAL·WARNING 은 없다.

## 위험도

LOW
