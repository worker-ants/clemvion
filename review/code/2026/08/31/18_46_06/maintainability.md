# 유지보수성(Maintainability) Review

## 사전 확인 — 직전 라운드(18_30_55) WARNING 재현 여부

이 changeset 에는 직전 코드 리뷰 라운드(`review/code/2026/08/31/18_30_55/*`)의 산출물 자체가 신규
커밋 파일로 포함돼 있어, 그 라운드가 지적한 유지보수성 WARNING 이 이번 diff 에서 실제로
해소됐는지를 저장소를 직접 열어 재검증했다(저장소 뮤테이션 없음, `Read`/`Grep`/`Bash` 로만 확인):

| 직전 WARNING/INFO | 현재 상태 | 근거 |
|---|---|---|
| 매직넘버 `20` 이 `scope_hits[:20]`/`len(scope_hits) - 20` 두 곳에 리터럴로 중복 | **해결됨** | `consistency_orchestrator.py:482` 에 `_SCOPE_HITS_DISPLAY_LIMIT = 20` 모듈 상수 신설, 두 지점 모두 이 이름을 참조 (직접 `sed`로 확인) |
| 신규 함수 삽입부 3-blank-line (파일 관례는 2줄) | **해결됨** | `consistency_orchestrator.py:477-478` 빈 줄 정확히 2개, 이후 모든 top-level 함수 경계도 2줄로 일관 (직접 확인) |
| `spec/data-flow/8-notifications.md:192` `§4.4`→`§4.5` 스윕 누락(같은 문단 자기모순) | **해결됨** | 현재 파일 192행 `이벤트 이름은 §4.5 기존` (grep 으로 잔존 `§4.4` 0건 확인, `§4.6` 언급은 그 문서 **자체** §4.6("WebSocket 동기화 (follow-up)") 절을 가리키는 것으로 오탐 아님을 heading 목록 대조로 확인) |
| `scope_hits` 20개 초과("... 외 N건") 절단 분기 테스트 커버리지 부재 | **해결됨** | `test_consistency_scope_census.py` 에 `test_under_the_limit_lists_every_path_and_does_not_fold`(n=20)·`test_over_the_limit_folds_with_the_exact_remainder`(n=25, "… 외 5건" 단언) 추가 |

## 발견사항

- **[INFO]** `_scope_delta_census` 가 "scope 델타 계산+렌더링"과 "diff 델타 계산+렌더링" 두 개의
  독립된 축을 한 함수에 담고 있다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 함수
    `_scope_delta_census` (신설)
  - 상세: 분기는 얕고(if/else 2쌍, 중첩 없음) 순환복잡도는 낮지만, scope 축과 diff 축은 서로
    무관한 두 관심사다. 다만 이 파일은 `_head_basis_notice` 처럼 계산+마크다운 렌더링을 한 함수에
    담는 헬퍼를 이미 여러 개 갖고 있어(`_omitted_notice` 등), 이 함수만 유독 이례적인 것은 아니다
    — 기존 파일 컨벤션을 그대로 따른 것이라 이번 변경이 새로 만든 결함은 아니다.
  - 제안: 지금 리팩터링을 요구할 정도는 아니다. 다만 향후 세 번째 "축"이 이 함수에 추가된다면
    그 시점에는 계산 결과를 구조화된 값(dict/dataclass)으로 만들고 렌더링을 분리하는 편이 테스트를
    "주어 있는 문자열 partial-match" 의존에서 벗어나게 해 준다.

- **[INFO]** `workflow-assistant.controller.ts` 의 `@ApiUnauthorizedResponse({ description: '인증
  실패 또는 토큰 만료' })` 가 7개 라우트에 동일 리터럴로 반복 부착된다
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` —
    `list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage` 6개 지점(신규 부착)
  - 상세: 저장소 전체에 이미 이 패턴이 다수 존재하고 클래스 레벨 데코레이터로 통합한 컨트롤러는
    하나도 없어, 이번 PR 은 기존 관례를 그대로 따른 것이라 회귀는 아니다. 다만 라우트 단위 수동
    부착에 의존하는 구조는 새 라우트가 추가될 때 이 PR 이 메우려는 것과 같은 방식(문서화 누락)으로
    다시 벌어질 수 있는 여지를 남긴다 — 이 신설 테스트 파일의 JSDoc 자체가 그 사실을 인지하고
    있다("고쳐 놓아도 다음 라우트가 추가될 때 같은 방식으로 다시 빠진다").
  - 제안: 이 PR 범위 조치는 불요. 후속으로 `applyDecorators()` 기반 합성 데코레이터(예: `@Auth()`)
    도입을 고려할 만하다(저장소 전체 스코프 리팩터라 이 PR 과 분리).

## 요약

이번 diff 의 핵심 코드 변경(harness 신규 함수 2개 + 대응 테스트, `chat-channel` 3파일 주석 정리,
`workflow-assistant` swagger 데코레이터 6곳 + 신규 회귀 테스트)은 가독성이 높고 저장소 기존
컨벤션(모듈 상수 추출, docstring 에 root-cause·측정치 서술, `swagger-probe` 공유 헬퍼 재사용, 공허
테스트 방지 사전조건 단언)을 잘 따른다. 함수 길이·중첩 깊이·순환 복잡도 모두 문제 수준이 아니며
실질적 코드 중복도 없다. 특히 직전 코드 리뷰 라운드(`18_30_55`)가 지적한 유지보수성 WARNING 4건
(매직넘버 `20` 리터럴 중복, 파일 관례를 벗어난 빈 줄, `8-notifications.md:192` 절 번호 자기모순,
scope-hits 절단 분기 테스트 갭)이 이번 diff 에서 모두 실측 확인 가능한 형태로 해소됐다. 남은 것은
낮은 우선순위 INFO 2건(계산+렌더링 결합 헬퍼의 장기 확장성, 데코레이터 반복 부착의 구조적 여지)뿐이며
둘 다 기존 컨벤션의 연장이라 이번 PR 을 막을 이유가 없다.

## 위험도
NONE
