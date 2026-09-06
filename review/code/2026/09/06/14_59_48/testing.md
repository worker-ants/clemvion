# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `WorkspacesService.listMembers` — 이 PR 이 스스로 "가드가 지키지 못한다" 고 명시한 유일한 채널인데 단위 테스트가 0건이다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (함수 `listMembers`, 약 199~225줄) / 부재 확인: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (전체 `describe`/`it` 목록에 `listMembers` 없음) · `workspaces.controller.spec.ts:36` 은 `listMembers: jest.fn()` 으로 **모킹만** 하고 실제 매핑 로직은 통과시키지 않는다.
  - 상세: `user-entity-exposure.spec.ts` 의 `EXPECTED_USER_RELATION_LOADS` 주석은 `listMembers` 를 "**JS 단 수동 매핑**이라 이 가드가 지키지 못한다. 안전망은 `workspace-rbac.e2e-spec.ts` 의 `J.` 뿐" 이라고 명시적으로 인정한다. 즉 저장소 전체에서 이 함수가 향후 `...m.user` 스프레드나 필드 하나 추가로 회귀했을 때 이를 잡을 수 있는 자동화된 그물은 **신규로 추가된 e2e 테스트 1건**이 유일하다. e2e 는 실 DB·서버 인프라가 필요해 로컬 `jest` 단위 실행이나 빠른 피드백 루프에서 돌지 않고(레포 관례상 e2e 는 별도 `make e2e-test-full` 로만 수행), 또한 e2e 스펙 하나에 실패 원인(어느 필드가 새는지, 매핑 로직 자체의 계약인지)을 결정론적으로 좁혀 주지 못한다. `WorkflowVersionsService` 의 `creator` 투영처럼 리포지토리 옵션(`select`)으로 방어되는 다른 자리는 전부 단위 테스트가 옵션 객체를 직접 단언하는데, 유일하게 수동 매핑인 이 자리만 그 계층의 테스트가 없다.
  - 제안: `workspaces.service.spec.ts` 에 `listMembers` 단위 테스트를 추가해, mock `memberRepository.find` 가 `user` 에 `passwordHash` 등 임의의 추가 필드를 포함한 목(mock)을 반환해도 결과 객체의 키가 `{id, userId, email, name, role, joinedAt}` 로 정확히 좁혀지는지 단언한다. e2e 를 대체하는 것이 아니라 계층을 하나 추가해, 이 자리가 회귀했을 때 더 빠르고 더 좁은 실패 지점을 얻게 한다.

- **[WARNING]** `.claude/hooks/_lib/review_guard.py` 의 신규 "YAML 트레일링 주석 제거" 수정이 **따옴표로 감싼 스칼라 + 트레일링 주석** 조합을 다루지 않고, 새 테스트 매트릭스도 이 조합을 검증하지 않는다 — 재현 결과 동일 결함 클래스가 재생산된다
  - 위치: `.claude/hooks/_lib/review_guard.py` 함수 `_strip_comment`(신규, `_parse_frontmatter_code` 내부, "따옴표 없는 스칼라의 트레일링 YAML 주석" 처리) — `t.startswith('"') or t.startswith("'")` 인 경우 **주석 제거 없이 그대로 반환**하는 분기. 회귀 테스트는 `.claude/tests/test_review_guard.py` 의 `test_parse_strips_trailing_comment_block_list` / `test_parse_strips_trailing_comment_single_and_inline` / `test_parse_hash_without_leading_space_is_not_a_comment` 세 곳 모두 **따옴표 없는** 값만 사용한다.
  - 상세: 이 PR 의 목적 자체가 "entry 가 조용히 사라지는(또는 값이 잘려 죽은 glob 이 되는) 것을 막는다" 이고, 신규 docstring 은 "프런트엔드 gray-matter 파서와 같은 답을 내야 한다" 고 명시한다. 그런데 `- "codebase/backend/a.ts"  # note` 처럼 따옴표로 감싼 값 뒤에 트레일링 주석이 붙으면, `_strip_comment` 가 조기 반환하여 이후 `_clean` 의 `.strip('"')` 가 **여는 따옴표만** 벗기고 닫는 따옴표+주석 텍스트는 그대로 남아 `codebase/backend/a.ts"  # note` 라는, 어떤 실제 파일과도 매치되지 않는 죽은 glob 이 만들어진다. 실측(스크래치 디렉터리에서 원본 파일을 임시 로드해 직접 호출, 저장소는 미변경):
    ```
    입력: - "codebase/backend/a.ts"  # note
    결과: ['codebase/backend/a.ts"  # note', 'codebase/frontend/b.ts']
    ```
    이는 이 PR 이전부터 있던 동작(`_clean` 원본이 `tok.strip().strip('"').strip("'")` 뿐이었음)이라 **이 PR 이 새로 만든 회귀는 아니다.** 다만 이 PR 이 "트레일링 주석" 이라는 결함 클래스를 정면으로 다루면서 3개 형태(블록 리스트 항목/단일값/인라인 리스트) 전부에 대해 언쿼트 케이스를 촘촘히 대조군까지 추가해 놓고, 같은 클래스의 인접 변형(따옴표 스칼라)은 대조군 없이 지나갔다 — 이 저장소가 반복적으로 지적해 온 "정의를 한 칸 좁게 잡는 패턴" 과 같은 모양이다. 현재 `spec/**/*.md` frontmatter 의 `code:` 블록에는 따옴표+트레일링 주석 조합이 실존하지 않아(grep 확인) **지금 당장 41개 유실 재발을 일으키지는 않는다.**
  - 제안: (a) 의도적으로 범위를 언쿼트 스칼라로 좁힌 것이라면 그 이유(예: "이 저장소 관례상 따옴표+주석 조합은 안 쓴다")를 docstring 에 한 줄 남기고 반대방향 대조군(따옴표+주석이 입력이어도 최소한 안전하게 죽지 않는다는 것, 혹은 명시적으로 실패시키는 것)을 테스트로 고정한다. (b) 마무리까지 닫으려면 `_strip_comment` 에서 닫는 따옴표 위치를 찾아 그 뒤의 트레일링 텍스트를 잘라내는 분기를 추가하고 `test_parse_strips_trailing_comment_quoted` 류의 테스트를 세 형태 모두에 추가한다.

- **[INFO]** `triggers.service.spec.ts` 신규 `it.each` 테스트가 같은 mock 시나리오에 대해 서비스 메서드를 불필요하게 두 번 호출한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (신규 `describe('TriggersService — endpoint_path UNIQUE 충돌 계약')` 안 `it.each([...])('%s — 409 + RESOURCE_CONFLICT + details 두 키', ...)`)
  - 상세: `await expect(call()).rejects.toBeInstanceOf(ConflictException)` 다음 줄에서 다시 `await expect(call()).rejects.toMatchObject({...})` 를 호출해, 같은 테스트 케이스 안에서 `service.update`/`service.create` 가 두 번 실행된다. `mockRejectedValue`(Once 아님)라 결과가 안정적이므로 현재는 문제를 일으키지 않지만, 두 assertion 을 `const result = call(); await expect(result).rejects...; await expect(result).rejects...` 형태로 promise 를 한 번만 만들어 재사용하면 의도(같은 호출의 두 성질을 확인한다)가 더 명확해지고, 나중에 mock 이 `mockRejectedValueOnce` 로 바뀌는 리팩터링이 있을 때 조용히 깨지는 것을 막는다.
  - 제안: `call()` 결과를 변수에 담아 두 단언에서 재사용.

## 요약

이번 diff 의 테스트 품질은 전반적으로 매우 높다 — `user-entity-exposure-guard`/`user-secret-absence`/`dto-jsdoc-citation-guard` 세 신규 가드 모두 순수 로직과 소비 spec 을 분리하는 기존 관례를 따르고, 각 술어마다 **양성/음성 대조군 fixture** 를 갖추었으며, "이 대조군이 없으면 술어를 죽여도 스위트가 초록이었다" 는 실측 뮤테이션 기록을 주석에 남겨 vacuous 테스트를 반복적으로 스스로 걷어냈다(대소문자·중첩 객체·`as`/`satisfies` 두 unwrap 분기·`select` boolean-vs-object 등 세밀한 분기까지 개별 관측). `triggers.service.ts`/`workflow-versions.service.ts` 의 보안·계약 변경도 정상/반대방향 대조군(다른 UNIQUE 인덱스는 통과시킨다, DTO 스키마와 상수를 코드로 묶는다)을 갖춰 회귀 테스트로서 유효하다. 다만 두 지점은 보완이 필요하다: (1) `WorkspacesService.listMembers` 는 이 PR 이 스스로 "가드가 못 지킨다" 고 밝힌 유일한 자리인데 정작 단위 테스트가 없어 방어가 신규 e2e 한 건에 전적으로 의존한다. (2) `review_guard.py` 의 YAML 주석 처리 수정은 언쿼트 스칼라 3형태를 촘촘히 덮으면서도 따옴표로 감싼 스칼라+트레일링 주석 조합은 대조군 없이 남겨, 재현 결과 이 PR 이 막으려던 것과 같은 종류(죽은 glob → entry 조용히 무력화)의 구멍이 그 인접 변형에는 여전히 열려 있음을 확인했다(현재 spec 파일에는 그 형태가 없어 즉각적인 실해는 없음). 이 외에 회귀 테스트 유효성·테스트 격리·가독성 측면에서 지적할 결함은 발견되지 않았다.

## 위험도

LOW
