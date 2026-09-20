# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** 무관한 main 브랜치 결함 수정이 이번 작업(동시 rotate lost-update) 커밋에 함께 묶여 들어감
  - 위치: `plan/complete/spec-draft-integration-error-facts.md:2` (frontmatter `title:` 값을 큰따옴표로 감싼 수정)
  - 상세: 이 파일은 "통합 노드·연결 테스트 spec 의 사실 정정 넷"이라는, 이번 rotate-lost-update 작업과 주제상 전혀 다른 완료된 plan 문서다. 변경 내용은 `title:` 안에 `code:` 리터럴이 들어가 YAML 파싱이 깨지던 것을 따옴표로 감싸 고친 것뿐이다. `plan/in-progress/rotate-lost-update.md` 체크리스트(`- [x] TEST WORKFLOW …`)에 "덤으로 main 의 red 를 고쳤다 — 직전 PR(#1367)이 `plan/complete/` 에 넣은 draft 의 `title:` 안에 `code:` 가 들어가 YAML 이 깨져 Gate C(`spec-plan-completion.test.ts`)가 실패하고 있었다"고 스스로 명시하고 있어 은폐된 변경은 아니지만, 이번 PR 이 선언한 범위(`IntegrationsService.rotate()` 의 lost-update 수정)와는 기능적으로 무관한 별도 결함 수정이다. 커밋 로그(`f3ea25d02 test(integrations): … · main 의 Gate C red 도 함께`)도 이 두 성격이 다른 변경이 한 커밋에 섞여 있음을 그대로 보여준다.
  - 제안: 작은 1자 수정이고 이미 커밋 메시지·plan 체크리스트에 투명하게 밝혀 두었으므로 되돌릴 필요까지는 없으나, 앞으로는 "선행 커밋이 깨뜨린 main 의 게이트 수정"과 "이번 작업의 기능 변경"을 별도 커밋(가능하면 별도 PR)으로 분리해, 리뷰·bisect 시 두 변경의 책임을 구분할 수 있게 하는 편이 낫다.

- **[INFO]** `review/consistency/2026/09/20/16_43_05/**` (5개 checker 산출물 + `_target` 스냅샷 + `_retry_state.json`)이 결과적으로 **철회된(superseded)** spec draft 에 대한 검토 이력임
  - 위치: `plan/complete/spec-draft-rotate-conflict.md` (status: superseded) 및 그 검토 산출물 9개 파일
  - 상세: `--spec` 모드로 `INTEGRATION_ROTATE_CONFLICT` (409) 신설을 검토했다가 Critical 1건(BLOCK: YES)으로 반증되어 방향을 코드 전용 처방으로 틀었다. 이 자체는 CLAUDE.md 의 "project-planner 는 `spec/` 쓰기 직전 `consistency-check --spec` 의무" 규약을 따른 정상 절차이고, 방향 전환의 근거를 남기는 것도 프로젝트 관례(`feedback_planner_draft_is_an_artifact.md`: draft 는 산출물이지 임시 파일이 아니다)와 일치한다. 범위 위반은 아니지만, 최종적으로 채택되지 않은 안에 대한 리뷰 산출물 9개 파일이 diff 에 포함돼 있다는 점은 리뷰어가 "이게 이번 PR 의 실제 변경사항인가"를 판단하는 데 혼동을 줄 수 있어 참고로 남긴다.
  - 제안: 조치 불필요. `plan/in-progress/rotate-lost-update.md` §C 가 이미 왜 철회됐는지 명확히 서술하고 있어 추적 가능하다.

- 그 외 핵심 코드 변경(`integrations.service.ts`, `integrations.service.spec.ts`, 신규 `integration-rotate-concurrency.e2e-spec.ts`)은 전부 "연결 테스트가 도는 동안 다른 rotate 가 커밋한 교체를 잃지 않도록 락 안에서 재읽기 위에 머지한다"는 단일 목적에 정확히 부합한다. `dataSource: DataSource` 주입, `pessimistic_write` 락, 락 안 권한 재확인, 부분 `update` 유지, 관련 unit 테스트 갱신(호출 횟수 2→3 등)까지 전부 이 처방의 직접적 귀결이며 범위를 벗어나는 리팩토링·포맷팅·주석 정리·불필요한 import 는 발견되지 않았다. `review/consistency/2026/09/20/16_58_56/**` (impl-prep 게이트 산출물)도 CLAUDE.md 가 요구하는 필수 절차의 정상 증적이다.

## 요약

핵심 변경(서비스 로직·unit 테스트·e2e 테스트)은 "동시 rotate 의 lost update"라는 선언된 범위에 정확히 들어맞고 불필요한 리팩토링·포맷팅·주석·임포트 변경은 없다. 다만 같은 커밋에 이번 작업과 무관한 main 브랜치의 YAML 파싱 결함 수정(`plan/complete/spec-draft-integration-error-facts.md`)이 함께 섞여 들어갔다 — 투명하게 문서화되어 있고 크기도 작아 위험은 낮지만 전형적인 "의도 이상의 변경" 형태이므로 WARNING 으로 기록한다. `review/consistency/**` 아래 다수의 산출물은 철회된 spec draft 포함 프로젝트가 의무화한 검토 절차의 정상 증적으로, 범위 위반이 아니다.

## 위험도
LOW
