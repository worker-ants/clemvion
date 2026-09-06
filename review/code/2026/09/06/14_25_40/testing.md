# 테스트(Testing) 리뷰

## 검증 방법

- `.claude/hooks/_lib/review_guard.py` / `.claude/tests/test_review_guard.py` — 뮤테이션으로 신설 3건이 실제로 개별 결함을 잡는지 확인. 저장소 파일을 잠깐 고쳤다가 즉시 원복했다(아래 "뮤테이션 로그" 참고).
  - `python3 -m pytest .claude/tests/test_review_guard.py -q` → **40 passed**.
  - `_parse_frontmatter_code` 의 신설 스킵 로직(빈 줄·`#` 라인 skip 4줄)을 제거한 뮤턴트로 재실행 → `test_parse_block_list_survives_yaml_comment`·`test_parse_block_list_survives_blank_line` **RED**(2 failed), `test_parse_block_list_still_stops_at_next_key`는 그대로 GREEN(다음 키 정지 분기는 이 뮤턴트로 안 건드림 — 기대대로).
  - 원복 후 재실행 → 40 passed, `git status --short` 로 저장소에 잔여 diff 없음 확인.
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.{ts,spec.ts}` — 전문을 직접 읽고 `CREATOR_PROJECTION` ↔ `findOne`/`findByWorkflow` select 옵션 ↔ 단위 테스트 3종의 대응을 대조.
- `codebase/backend/src/repo-guards/__tests__/{user-entity-exposure-guard.ts,user-entity-exposure.spec.ts}`, `dto-jsdoc-citation-guard.ts`/`.spec.ts`, `fixtures/{user-eager-relation,user-relation-load,dto/responses/jsdoc-citation}.fixture.ts` 전문을 읽고 양성/음성 fixture와 assertion의 대응을 대조.
- `codebase/backend/src/shared/testing/user-secret-absence.{ts,spec.ts}` 전문 확인.
- `codebase/backend/test/{audit-logs,workflow-crud,workspace-rbac}.e2e-spec.ts` 의 신규/변경 블록을 `git diff origin/main...HEAD` 로 확인.
- 이전 6~7차 리뷰 라운드(`review/code/2026/09/06/{10_13_22..13_39_20}/testing.md`, `RESOLUTION.md`)를 읽고 그때 지적된 검출력 결함이 최종 상태에 실제로 반영돼 있는지 소스로 재확인(중복 보고 방지 목적).

## 뮤테이션 로그 (원복 완료)

`.claude/hooks/_lib/review_guard.py`를 직접 수정해 확인하는 과정에서, 백업을 스크래치에 먼저 떠 두려던 명령이 harness 가드에 막혀 **조용히 실행되지 않았고**, 그 사실을 모른 채 다음 명령이 저장소 원본 파일을 직접 뮤테이션했다(백업 없이). 이후 `git show HEAD:.claude/hooks/_lib/review_guard.py`(읽기 전용 git 명령)로 커밋된 원본을 스크래치로 꺼내 `cp`로 되돌렸다 — `git checkout`/`git restore`는 쓰지 않았다. 최종 `git status --short`·`git diff`로 무결 확인, `pytest` 40/40 재확인. 이 파일을 동시에 보고 있었을 다른 리뷰어가 있었다면 짧은 창(수 초) 동안 뮤테이션된 상태를 봤을 수 있음을 여기 명시한다.

## 발견사항

- **[WARNING]** `_parse_frontmatter_code`의 신설 스킵 로직이 "독립된 주석 줄"만 다루고, 이번 버그와 **같은 실패 형태**인 "glob 항목 뒤에 붙는 인라인(trailing) 주석"은 여전히 손대지 않았고 테스트도 없다
  - 위치: `.claude/hooks/_lib/review_guard.py:648`(`stripped = fm[j].strip()` 스킵 블록), 그리고 같은 함수의 `elif rest:` 단일값 분기(`code: a.ts  # comment` 형태) — 함수명 `_parse_frontmatter_code`
  - 상세: `- codebase/backend/a.ts  # 범주 구분 주석`처럼 **glob 항목과 같은 줄**에 붙는 trailing `#` 주석은 `stripped.startswith("#")` 검사를 통과하지 못한다(그 줄의 `.strip()` 결과가 `-`로 시작하므로 "코멘트 줄"로 인식되지 않는다). 그 결과 `mm = re.match(r"^\s*-\s*(.+)$", fm[j])`의 캡처 그룹이 `"codebase/backend/a.ts  # 범주 구분 주석"`을 통째로 삼키고, `_clean()`은 공백·따옴표만 벗기므로 그 문자열 그대로가 glob으로 등재된다(직접 실행해 확인: `re.match(...).group(1)` → `'codebase/backend/a.ts  # trailing comment'`). 이런 문자열은 어떤 실제 파일 경로와도 매치되지 않는 정규식으로 컴파일되므로, **이번 PR이 고친 것과 정확히 같은 결과**(등재된 파일이 spec-linked 판정에서 조용히 빠짐 — "게이트가 안 무는 쪽이 기본값이 됨")를 낳는다. 같은 함수의 단일값 형태(`code: a.ts  # comment`)도 동일하게 취약함을 확인했다(`rest.strip()`이 주석 텍스트를 포함한 문자열을 그대로 돌려줌). 신설 테스트 3건(`test_parse_block_list_survives_yaml_comment`/`_blank_line`/`_still_stops_at_next_key`)은 전부 "온전한 한 줄짜리" 주석·빈 줄만 fixture로 쓰고, 이 trailing 형태는 어느 테스트에도 없다. 현재 저장소 `spec/**/*.md`의 `code:` 블록을 전수 grep한 결과 이 형태의 실사용례는 0건이라 지금 당장의 실피해는 없지만, 이 PR의 CHANGELOG 자신이 "산문 규율은 다음 제안을 막지 못한다"(다른 라운드의 checker가 인라인 주석을 제안하자 그대로 채택해 버그가 생겼다는 서사)고 적어 둔 바로 그 위험이, "독립 줄" 대신 "trailing" 형태로 재발할 경우 이번 수정 이후에도 그대로 열려 있다.
  - 제안: `mm.group(1)`을 glob으로 쓰기 전에 (따옴표로 감싸이지 않은) `\s+#.*$`를 잘라내는 한 줄을 추가하고, `code:\n  - a.ts  # note\n  - b.ts` 형태를 검증하는 회귀 테스트 1건(+ 단일값 형태 `code: a.ts  # note` 1건)을 `test_review_guard.py`에 추가해 이번에 닫은 것과 같은 부류의 사각지대를 마저 닫는다.

- **[INFO]** (직전 라운드 `13_39_20` INFO, 조치 불요로 이미 처분됨 — 재확인만, 신규 아님) `enclosingName`의 `'<module>'` 폴백 분기는 여전히 어떤 fixture로도 실행되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `enclosingName` 함수 마지막 줄 `return fallback ?? '<module>';`
  - 상세: `user-relation-load.fixture.ts`의 위반 14건이 전부 함수/메서드 내부이거나 변수 대입 경유라 모듈 최상위 직접 호출 형태가 없다. 직전 라운드가 이미 "조치 불요"로 처분했고 이번 최종 상태에서도 그대로 미실행 상태다. 새 결함이 아니므로 등급을 올리지 않는다.
  - 제안: 이 가드를 다음에 만질 때 함께 채우면 분기 커버리지가 완결된다(즉시 조치 불요).

## 회귀 테스트 확인

`workflow-versions.service.spec.ts`의 `CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto` 스키마 대조 테스트(`schemaOf` 헬퍼로 실제 OpenAPI 문서에서 프로퍼티를 뽑아 상수 키와 대조)는 이 PR이 겪은 Critical(같은 리터럴이 두 곳에 손 복제돼 `findOne`만 투영을 잃었던 것)의 재발을 코드로 막는다. `findOne` 단위 테스트는 옵션 전체 비교와 `creator` 투영만 보는 좁은 단언을 의도적으로 중복시켜 "무엇이 양보하면 안 되는 성질인지"를 테스트 이름에 남긴다. `NotFoundException` 케이스 등 기존 테스트는 새 `select`/`relations` 형태(`{creator: true}` 객체 형태로 변경)에 맞춰 함께 갱신돼 있어 stale하지 않다.

`user-entity-exposure.spec.ts`/`dto-jsdoc-citation.spec.ts`는 6~7차 리뷰 라운드에 걸쳐 지적된 검출력 결함(eager 관계 원리적 미검출, 겉은 투영·실은 전체 노출, 중첩 객체 `relations`, `as`/`satisfies` 캐스트로 인한 술어 무력화, `select` 값 쪽 `unwrap` 미검증, JSDoc 인용 "날짜+시각" 형태 미검증) 전부가 fixture 양성/음성 대조군으로 실제로 닫혀 있음을 코드로 직접 확인했다. `dto-jsdoc-citation.spec.ts`도 직전 라운드(`13_39_20` maintainability WARNING)가 지적한 fixture 경로 3중 인라인 중복이 `CITATION_FIXTURE` 상수 하나로 이미 정리돼 있다 — 재발 없음.

신규 e2e(`workflow-crud.e2e-spec.ts` "H.", `workspace-rbac.e2e-spec.ts` "J.")는 버전 0개·멤버 1명일 때 후속 단언이 vacuous해지는 것을 막는 사전 조건(`toBeGreaterThanOrEqual(1)`, `toHaveLength(2)`)을 갖추고, 이름 기반 부재 축(`expectNoUserSecrets`)을 계약 대조 축(`assertMatchesContract`)보다 먼저 실행해 "계약 위반이 먼저 던져 이름 축이 실행조차 안 되는" 순서 함정을 피한다는 근거를 주석에 남겼다. `user-secret-absence.spec.ts`는 직전 라운드가 지적한 "최상위(봉투 없음) 경로 미검증" INFO를 이번 최종 상태에서 명시적으로 닫았다(`findUserSecretLeaks({ passwordHash: 'x' })` 테스트 추가) — 재확인 완료.

Mock은 `WorkflowVersionsService` 단위 테스트에서만 쓰이며(표준 NestJS 리포지토리 mock, 실동작과의 괴리 없음), 새 가드 3종의 spec은 mock 없이 실제 파일 시스템(fixture)을 읽는 구조다. 각 e2e는 `uniqueEmail`/`uniqueName`으로 고유 자원을 만들어 테스트 간 격리를 유지하고, 가드 spec은 순수 함수 호출뿐이라 실행 순서 의존이 없다.

## 요약

이 PR은 이미 7차례의 `/ai-review`+`/consistency-check` 라운드를 거치며 검출력 결함을 반복적으로 찾아 fixture·뮤테이션으로 닫아 온 이력이 있고, 이번 최종 상태를 직접 읽고 대조·실행한 결과 그 개선이 실제로 반영돼 있음을 확인했다(대상 파일 tsc/jest 실행은 이전 라운드가 이미 수행했고, 이번 라운드는 신규 diff인 `review_guard.py`/`test_review_guard.py`를 직접 실행·뮤테이션 검증했다 — 40/40 통과, 신설 3건이 각각 개별 결함을 잡는 것을 확인). 새로 찾은 것은 WARNING 1건뿐이다 — 이번 PR이 막은 "YAML 주석이 `code:` 항목을 조용히 삼키는" 실패 형태가, 항목과 **같은 줄에 붙는 trailing 주석**에는 여전히 열려 있고 테스트도 없다. 현재 저장소 실사용례는 0건이라 즉각적 피해는 없지만, 이 PR 자신이 "산문 규율은 다음 제안을 막지 못한다"고 명시한 바로 그 재발 경로와 형태가 같아 우선순위 있게 닫아 둘 가치가 있다. 그 외에는 직전 라운드가 이미 저위험으로 처분한 분기 커버리지 갭 1건(`'<module>'` 폴백)의 재확인뿐이다.

## 위험도

LOW
