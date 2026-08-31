# 유지보수성(Maintainability) Review

## 사전 확인 — 이전 두 라운드(18_30_55, 18_46_06) 지적 사항의 최종 반영 여부

이 changeset 은 브랜치 전체 diff(`origin/main...HEAD`, 커밋 10개, `f3ece1fc6` 까지)이며, 그 안에
직전 두 코드 리뷰 라운드의 산출물 자체가 커밋으로 포함돼 있다. 두 라운드가 낸 유지보수성
WARNING 은 모두 저장소를 직접 열어 재검증했다(뮤테이션 없이 `Read`/`Bash(grep, sed -n)` 만 사용,
`git status --short` 로 세션 산출물 디렉터리 외 잔여 변경 없음 확인).

| 이전 WARNING/INFO | 현재 상태 | 근거 |
|---|---|---|
| 매직넘버 `20` 이 `scope_hits[:20]`/`len(scope_hits) - 20` 두 곳에 리터럴 중복 | **해결됨** | `consistency_orchestrator.py:482` `_SCOPE_HITS_DISPLAY_LIMIT = 20` 모듈 상수 신설, 두 지점(`scope_hits[:_SCOPE_HITS_DISPLAY_LIMIT]`, `len(scope_hits) - _SCOPE_HITS_DISPLAY_LIMIT`) 모두 참조 (직접 `sed -n '460,575p'` 로 확인) |
| 신규 함수 삽입부 3-blank-line (파일 관례는 2줄) | **해결됨** | `_head_basis_notice` 종료와 `_count_diff_files` 사이 빈 줄 정확히 2개, 이후 모든 top-level 경계도 2줄로 일관 |
| `scope_hits` 20개 초과("... 외 N건") 절단 분기 테스트 커버리지 부재 | **해결됨** | `test_consistency_scope_census.py` 에 `test_under_the_limit_lists_every_path_and_does_not_fold`(n=20)·`test_over_the_limit_folds_with_the_exact_remainder`(n=25, `"… 외 5건"` 단언) 존재 (직접 열람, 206줄 전체 확인) |
| `spec/data-flow/8-notifications.md:192` 등 §4.4→§4.5 스윕 잔여 | **해결됨** | 코드 관점에서는 `websocket.service.ts:567,583,585`·`websocket.service.spec.ts:1268,1283`·`notifications-channel-authorizer.ts` 전부 §4.5 로 정정, `notifications-channel-authorizer.ts` 의 "emit 미구현이라 실피해 0" 서술도 실배선 사실에 맞게 갱신됨(`f3ece1fc6`) — 문서(spec) 쪽 잔여 여부는 documentation/requirement reviewer 영역이라 본 리뷰에서는 코드 주석 축만 확인 |

세 라운드 모두 신규 코드 결함(맹점)을 새로 만들지 않았고, 스스로 지적받은 것을 정확히 그 지점에서
고쳤다.

## 발견사항

- **[INFO]** `_scope_delta_census` 가 "scope 델타 계산+렌더링"과 "diff 델타 계산+렌더링" 두 개의 독립된 축을 한 함수에 담고 있다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 함수 `_scope_delta_census` (신설)
  - 상세: 분기는 얕고(if/else 2쌍, 중첩 없음) 순환복잡도는 낮지만, "scope 축"과 "diff 축"은 서로 무관한 두 관심사이며 렌더링 문자열까지 함께 조립한다. 다만 같은 파일이 `_head_basis_notice`처럼 계산+마크다운 렌더링을 한 함수에 담는 헬퍼를 이미 여러 개 갖고 있어(기존 파일 컨벤션), 이 함수만 유독 이례적인 것은 아니다 — 이번 변경이 새로 만든 결함은 아니다.
  - 제안: 지금 리팩터링을 요구할 정도는 아니다. 다만 향후 세 번째 "축"(예: rationale 델타 등)이 이 함수에 추가된다면, 그 시점엔 계산 결과를 구조화된 값(dict/dataclass)으로 만들고 렌더링을 분리하는 편이 테스트를 "주어 있는 문자열 partial-match" 의존에서 벗어나게 해 준다.

- **[INFO]** `workflow-assistant.controller.ts` 의 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 가 7개 라우트에 동일 리터럴로 반복 부착된다
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` — `list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage` 각 지점(신규 부착)
  - 상세: 저장소 전체에 이미 이 patttern 이 널리 쓰이고 클래스 레벨 데코레이터로 통합한 컨트롤러는 하나도 없어(직접 확인), 이번 PR 은 기존 관례를 그대로 따른 것이라 회귀는 아니다. 다만 라우트 단위 수동 부착에 의존하는 구조는 새 라우트가 추가될 때 이 PR 이 메우려는 것(`swagger.md §2-4` 401 문서화 누락)과 같은 방식으로 다시 벌어질 수 있는 여지를 남긴다 — 신설 테스트 파일의 JSDoc 자체가 "고쳐 놓아도 다음 라우트가 추가될 때 같은 방식으로 다시 빠진다"고 이미 인지하고 있다.
  - 제안: 이 PR 범위 조치는 불요. 후속으로 `applyDecorators()` 기반 합성 데코레이터(예: `@Auth()`)로 `@ApiBearerAuth`+`@ApiUnauthorizedResponse` 를 한 번에 부착하는 안을 저장소 전체 스코프의 별도 리팩터로 고려할 만하다.

- **[INFO]** import 목록에 `ApiUnauthorizedResponse` 가 `ApiForbiddenResponse` 바로 앞에 삽입되어, 알파벳 순서와 어긋난다
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` 상단 `@nestjs/swagger` import 블록 (`ApiUnauthorizedResponse` 삽입 줄)
  - 상세: 이 import 블록은 이 diff 이전부터 완전한 알파벳 순이 아니었다(`ApiForbiddenResponse` 가 원래도 목록 맨 끝, `ApiOkResponse`/`ApiOperation` 뒤에 위치). `eslint.config.mjs` 에 `import/order` 규칙이 없어 lint 로도 강제되지 않는다. 이번 diff 는 그 기존 무질서에 한 줄을 같은 스타일로 추가했을 뿐이라 새로 만든 결함은 아니다.
  - 제안: 조치 불요 — 참고용 관찰.

## 검증 메모

저장소 뮤테이션 없이 `Read`/`Grep`/`Bash(sed, grep)` 로만 검증했다. `consistency_orchestrator.py` 의
`_scope_delta_census`/`_count_diff_files` 정의부(460~575행 부근)를 직접 `sed -n` 으로 열어 매직넘버·
빈 줄 관례를 재확인했고, `.claude/tests/test_consistency_scope_census.py` 206줄 전체를 열람해 클래스별
구성(`CountDiffFiles`/`ScopeDeltaCensus`/`CensusIsWiredIntoImplDone`/`CensusSurvivesTruncation`)·
네이밍·docstring 근거를 확인했다. `websocket.service.ts`/`websocket.service.spec.ts`/
`notifications-channel-authorizer.ts` 는 `git diff origin/main...HEAD -- <path>` 로 최종 상태를
직접 대조해 §4.4→§4.5 정정이 코드 주석 전 지점에서 완결됐음을 확인했다. `git status --short` 로
세션 산출물 디렉터리(`review/code/2026/08/31/19_07_49/`) 외 잔여 변경이 없음을 확인했다 — 원복할
뮤테이션이 없다.

## 요약

이번 changeset 의 실질 코드 변경(harness 신규 함수 2개 + 대응 테스트 14케이스, chat-channel/websocket
3~6개 파일의 주석 정정, `workflow-assistant.controller.ts` 의 swagger 데코레이터 7곳 + 신규 회귀
테스트)은 가독성이 높고 저장소의 기존 컨벤션(모듈 상수 추출, docstring 에 root-cause·측정치 서술,
`_harness` 기반 테스트 하네스, swagger 문구 재사용)을 잘 따른다. 함수 길이·중첩 깊이·순환 복잡도
모두 문제 수준이 아니며 실질적 코드 중복도 없다. 특히 직전 두 코드 리뷰 라운드(`18_30_55`,
`18_46_06`)가 낸 유지보수성 WARNING(매직넘버 `20` 리터럴 중복, 파일 관례를 벗어난 빈 줄, scope-hits
절단 분기 테스트 갭, §4.4→§4.5 코드 주석 잔존)이 이번 최종 diff 에서 전부 실측 확인 가능한 형태로
해소됐다. 남은 것은 우선순위 낮은 INFO 3건(계산+렌더링 결합 헬퍼의 장기 확장성, 데코레이터 반복
부착의 구조적 여지, import 정렬 사소한 불일치)뿐이며 모두 기존 컨벤션의 연장이거나 이 PR 범위 밖의
사소한 관찰이라 이번 PR 을 막을 이유가 없다.

## 위험도

NONE
