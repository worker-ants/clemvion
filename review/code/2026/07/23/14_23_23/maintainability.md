# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 테스트 코퍼스와 `RELEASED` dict 간 명령 리터럴 중복 (이중 SoT)
  - 위치: `.claude/tests/test_push_guard_allowlist.py` — `CORPUS` 리스트(예: `'git commit -m "add push notification"'`, `"git commit -F - <<'EOF'\nadd push flow\nEOF"` 등)와 `RELEASED` dict 의 키가 **동일한 문자열 리터럴을 두 곳에 각각 타이핑**해 유지한다.
  - 상세: 개념적으로 "이 명령은 legacy-block 이었고 지금은 release 됐다"는 하나의 사실인데, 이를 표현하는 문자열이 `CORPUS`(주석 `"FP: -m message"` 등과 짝) 와 `RELEASED`(안전 논증과 짝) 두 컬렉션에 별도로 존재한다. 한쪽만 손보면(예: 공백 하나 수정, 따옴표 스타일 변경) 다른 쪽과 어긋난다. 다행히 `test_no_new_false_negatives`/`test_every_enumerated_release_actually_releases` 가 drift 를 **시끄럽게 실패**시키므로 silent regression 은 아니지만, 새 release 항목을 추가할 때마다 두 곳을 동기화해야 하는 수작업 부담이 남는다.
  - 제안: `RELEASED` 를 `dict[str, str]` 대신 `CORPUS` 항목 자체에 3번째 필드(`released_reason: str | None`)로 흡수하거나, `CORPUS` 를 `(command, note, release_reason)` 튜플 리스트로 재구성해 명령 리터럴이 정확히 한 곳에만 존재하도록 리팩터링. (테스트 안전망이 있으므로 당장 급하지는 않음.)

- **[INFO]** `_blank_commit_heredocs` 함수 뒤에 공백 줄 3개 (PEP8 은 2개)
  - 위치: `.claude/hooks/guard_review_before_push.py` — `_blank_commit_heredocs` 정의와 `_read_payload` 사이 (diff 상 176~178행, 전체 파일 기준 389~391행).
  - 상세: 이 리포지토리에 flake8/black 설정이 발견되지 않아 CI 가 잡지는 않지만, 파일의 나머지 부분은 top-level 정의 사이 2줄 관례를 따른다. 사소한 스타일 불일치.
  - 제안: 공백 줄 1개 제거.

- **[INFO]** 신규 정규식 2종(`_COMMIT_STDIN_CMD`, `_MESSAGE_ARG`)의 밀도가 높아 향후 유지보수 시 재독해 비용이 큼
  - 위치: `guard_review_before_push.py` `_COMMIT_STDIN_CMD`(lookaround 다수), `_MESSAGE_ARG`(named group + lookahead 재귀형 본문).
  - 상세: 각 패턴 위에 잘 쓰인 산문 주석이 있어 "왜"는 설명되지만, 패턴 내부 각 토큰이 "무엇"을 하는지는 주석과 코드를 오가며 대조해야 한다. 이 모듈 상단에 "DO NOT EDIT" 경고가 붙은 `_GIT_PUSH` 만큼 이 두 패턴도 실수로 건드리면 조용히 오탐/오탈락을 만들 수 있는 지점이다.
  - 제안: 여유가 될 때 `re.VERBOSE` + 인라인 주석으로 토큰 단위 분해를 고려(선택 사항, 현재도 차단은 아님 — 밀도 대비 주석 품질이 이미 평균 이상).

- **[INFO]** `_ESCAPED_PIPE.sub()` 치환이 "길이 보존" 불변식을 암묵적으로만 지킴
  - 위치: `guard_review_before_push.py` `_redact_inert_text()` 1단계 — `out = _ESCAPED_PIPE.sub(lambda m: m.group(1) + " ", out)`.
  - 상세: `_blank()` 는 자신의 길이-보존 불변식을 docstring 에 명시하는 반면(`"preserving length (and thus offsets)"`), 이 `sub()` 호출도 동일한 불변식(매치 길이 == 치환 길이, 이후 오프셋 기반 연산이 깨지지 않아야 함)에 의존하지만 그 사실이 코드 근처에 명시돼 있지 않다. `_ESCAPED_PIPE` 패턴을 수정하는 사람이 이 제약을 놓치기 쉽다.
  - 제안: `.sub()` 호출 옆에 한 줄 주석으로 "치환 길이가 매치 길이와 같아야 이후 오프셋이 유효함" 을 명시.

## 요약

`guard_review_before_push.py` 의 blind-regex + enumerated-allowlist 재설계는 이름·구조·주석 품질이 전반적으로 높다. 각 정규식·헬퍼가 단일 책임을 가지며(`_is_inert`, `_blank`, `_owns_heredoc_as_message` 등), 함수 길이와 중첩 깊이도 도메인(셸 텍스트 휴리스틱) 난이도에 비해 적절히 억제돼 있다. 특히 "왜 이 설계인가"·"이전 시도가 왜 실패했는가"를 코드 주석과 plan 문서(`harness-push-guard-subcommand-detection.md`)에 동일하게 남겨 코드-문서 정합성이 좋다. 발견된 항목은 모두 사소한 수준으로, 테스트 코퍼스/`RELEASED` dict 의 리터럴 이중 관리(자기검증 테스트로 완화됨)와 몇 가지 문서화 디테일에 그친다. 신규 대형 테스트 파일(`test_push_guard_allowlist.py`)도 관심사별로 클래스를 잘 나누어(고정/차등/거부/해제/기존 갭) 가독성이 높다.

## 위험도

LOW
