# 유지보수성(Maintainability) 리뷰

## 검토 범위 메모

`origin/main...HEAD` 는 이미 8차례의 `/ai-review` 라운드(`10_13_22`→`14_25_40`)를 거친
`User` 컬럼 노출 방어 3축(`user-entity-exposure-guard.ts`/`dto-jsdoc-citation-guard.ts`/
`user-secret-absence.ts`)과, 그 라운드들이 지적한 매직값·JSDoc orphan·검출력 0건·fixture
경로 중복 등은 이번 세션에서 실제 파일을 열어 재확인했고 전부 반영되어 재발이 없다
(예: `dto-jsdoc-citation.spec.ts` 는 `CITATION_FIXTURE` 상수로 통합되어 `13_39_20` WARNING
이 해소됨. `user-entity-exposure-guard.ts` 의 JSDoc 은 `findEagerUserRelations`/
`collectUserRelationNames` 각자 제자리에 있어 `11_55_36` WARNING 이 해소됨).

이번 라운드에서 새로 검토할 것은 직전(`14_25_40`) 라운드 **이후**에 추가된 최신 커밋
`a185846a5`(14:59:37) 뿐이다 — `.claude/hooks/_lib/review_guard.py`(YAML 트레일링 주석
파싱 수정) + `.claude/tests/test_review_guard.py`(회귀 테스트 4건) + `triggers.service.ts`
(엔드포인트 경로 UNIQUE 충돌 → 문서한 에러 계약으로 변환) + `triggers.service.spec.ts` +
`workflow-versions.service.ts` 의 헤더 주석 정정(INFO#2, 코드 로직 변경 없음). 저장소에
뮤테이션은 가하지 않았다(`git status --short` — 세션 산출물 디렉터리만 untracked).

## 발견사항

- **[INFO]** `it.each` 케이스 하나가 같은 실패 호출을 두 번 실행한다 — 사소한 중복
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `describe('TriggersService — endpoint_path UNIQUE 충돌 계약'` 안의 `it.each([...])('%s — 409 + RESOURCE_CONFLICT + details 두 키', async (_label, call) => { ... })` 블록
  - 상세: 이 블록은 `await expect(call()).rejects.toBeInstanceOf(ConflictException)` 과 `await expect(call()).rejects.toMatchObject({...})` 두 단언에서 `call()` 을 **각각** 호출한다. `triggerRepo.save` 가 `mockRejectedValue` 로 고정돼 있어 두 호출 모두 같은 거부값을 내므로 결과는 동일하지만, 서비스 메서드(`update`/`create`)를 매 테스트마다 두 번 실행하는 불필요한 중복이다. 기능 결함은 아니고 실행 비용도 미미하다.
  - 제안: `const result = call(); await expect(result).rejects.toBeInstanceOf(ConflictException); await expect(result).rejects.toMatchObject({...});` 처럼 프라미스를 한 번만 만들어 재사용하거나, `toMatchObject` 한 단언 안에 `expect.any(ConflictException)` 없이 `code`/`details` 만 검증하는 것으로 통합해도 충분하다.

- **[INFO]** 새 헬퍼 테스트의 멀티라인 문자열 리터럴 들여쓰기가 파일 내 기존 스타일과 다르다
  - 위치: `.claude/tests/test_review_guard.py` — `test_parse_block_list_starting_with_comment`/`test_parse_strips_trailing_comment_block_list`/`test_parse_strips_trailing_comment_single_and_inline`/`test_parse_hash_without_leading_space_is_not_a_comment` 4개 신설 메서드의 `sp = self._spec("...")` 이어붙이기 부분
  - 상세: 위 4개 메서드는 문자열 리터럴을 여러 줄로 나눠 이어 붙이면서, 둘째 줄의 들여쓰기가 첫 줄의 여는 따옴표 위치와 맞지 않아(`sp = self._spec("---\n...\n"` 다음 줄이 그보다 얕은 들여쓰기로 시작) 코드 블록을 훑을 때 문자열 경계가 한눈에 들어오지 않는다. 같은 파일의 인접한 기존 테스트(`test_parse_block_list_survives_yaml_comment` 등, 이번 diff 밖)는 짧은 한 줄 리터럴만 써서 이 문제가 없었다. 기능에는 영향 없다.
  - 제안: `black`/`ruff format` 대상이면 그 포매터가 자동 정렬하도록 두거나, 손으로 맞출 경우 이어지는 줄을 여는 따옴표와 같은 열에 정렬한다.

- **[INFO]** (검증 완료, 조치 불요) 직전 라운드(`14_25_40`)가 지적한 두 항목이 이번 커밋에서 실제로 해소됨
  - `review_guard.py:_parse_frontmatter_code` 의 트레일링 주석 유실(W1)은 `_strip_comment` 헬퍼로 블록 항목·단일값·인라인 리스트 세 경로 모두에서 처리되고, `a#b.ts`(공백 없는 `#`)가 값으로 남는 반대 방향 대조군까지 4개 테스트로 고정됐다.
  - `_parse_frontmatter_code` 최상단 docstring(INFO#1)에 이제 "YAML 주석은 값이 아니다"·"트레일링 주석을 잘라낸다"·프런트엔드 파서와의 일치 계약(731 대 731)이 명시돼, 함수 본문을 끝까지 안 읽어도 계약을 알 수 있다.

## 요약

이번 라운드에서 실질적으로 새로 검토할 코드는 `review_guard.py` 의 YAML 트레일링 주석
파싱 수정(+ 회귀 테스트 4건)과 `TriggersService` 의 `(workspace_id, endpoint_path)` UNIQUE
위반을 문서한 에러 계약으로 변환하는 `isEndpointPathUniqueViolation`/
`rethrowEndpointPathConflict` 뿐이며, 나머지는 이미 8라운드를 거쳐 안정화된 `User` 컬럼
방어 코드(재확인 결과 재발 없음)다. 새 코드는 이 브랜치 전체를 관통하는 패턴 — 함수명이
역할을 정확히 말하고(`isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict`), 인덱스
이름·SQLSTATE 를 매직 문자열 대신 이름 있는 상수(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`)로
고정하며, "왜 이 형태인가"·"왜 다른 UNIQUE 위반을 삼키지 않는가"·"왜 세부 코드가
top-level 이 아니라 `details` 안인가"를 인접 JSDoc/주석에 실측과 함께 남기는 — 를 그대로
따른다. `create`·`update` 양쪽에 같은 `.catch(...)` 한 줄이 반복되지만 실제 판정 로직은
`rethrowEndpointPathConflict` private 메서드 하나로 단일화돼 있어 중복이라 보기 어렵다.
발견한 것은 전부 INFO 등급의 사소한 항목(테스트의 중복 호출 1건, 신규 Python 테스트의
문자열 들여쓰기 스타일 1건)뿐이고, 기능·가독성·복잡도에 실질적 영향은 없다.

## 위험도

LOW
