# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `--impl-done` 프롬프트의 HEAD 예산을 매 세션 고정적으로 소비한다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` — 함수 `_scope_delta_census`, 호출부는 `collect_context` 내 `target_doc = (...)` 조립부 (게이트 769-775행)
  - 상세: `_scope_delta_census` 가 반환하는 텍스트는 `truncate_file_bundle` 이 드롭 후보로 보지 않는 HEAD 섹션에 항상 삽입된다(설계 의도 그대로). 즉 `--impl-done` 모드의 모든 세션에서, scope 델타가 최대 20건까지 나열되는 만큼 body(스펙 폴더 dump)가 쓸 수 있는 유효 예산이 그만큼 줄어드는 부작용이 있다. 이는 문서화된 트레이드오프이고(주석·plan 양쪽에 근거 기술), `CensusSurvivesTruncation` 테스트로 "본문이 잘려도 census 는 생존" 이 실측 검증되어 있어 의도치 않은 부작용은 아니다. 다만 body 예산이 상시로 미세하게 줄어드는 효과 자체는 향후 예산 회귀 조사 시 참고할 값이라 INFO 로 남긴다.
  - 제안: 조치 불요. 향후 body 절단 관련 회귀를 조사할 때 이 상수 오버헤드를 고려할 것.

- **[INFO]** OpenAPI 문서(공개 인터페이스 표면) 확장 — 동작 변경 없음
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` — `list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage` 7개 핸들러에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 데코레이터 추가 (게이트 28, 59, 79, 97, 111, 125, 141, 164)
  - 상세: 데코레이터 추가는 Nest `SwaggerModule.createDocument()` 가 생성하는 OpenAPI 문서(외부에 노출되는 `/docs`)의 401 응답 스키마를 바꾼다 — 실행 시점 동작(가드·인터셉터·응답 바디)에는 영향이 없는 순수 메타데이터 변경이다. 시그니처·런타임 인터페이스는 그대로다. 새로 추가된 `workflow-assistant.controller.swagger.spec.ts` 가 이 문서 변경을 회귀 테스트로 고정하고 있어(전제 케이스로 라우트 수 7 을 고정, `for…of` 공허 방지), 문서 axis 를 다루는 다른 게이트(예: 클라이언트 SDK 생성기)가 있다면 그쪽에서 재생성이 필요할 수 있다는 점만 참고로 남긴다 — 저장소 안에서 이 diff 를 소비하는 정적 openapi.json/클라이언트 생성 스텝은 발견되지 않았다(`grep -rl "swagger.json\|openapi.json"` 결과 `main.ts`(런타임 `/docs` serve) 외 없음).
  - 제안: 조치 불요.

## 점검 관점별 확인 결과 (문제 없음)

- **의도치 않은 상태 변경 / 전역 변수**: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 신설 함수 `_count_diff_files`·`_scope_delta_census` 는 인자만으로 문자열을 조립해 반환하는 순수 함수다 — 전역 상태를 읽거나 쓰지 않고 새 전역 변수도 도입하지 않는다. `collect_context` 호출부는 그 반환값을 `target_doc` 문자열 조립에 이어붙이기만 한다(기존 `_splice_chunk` 결과와 동일한 방식). `diff_text`(`_collect_code_diff` 반환값)는 일반 `str` 이라 `diff_section` 조립과 `_scope_delta_census` 양쪽에서 각각 읽어도 소모형 이터레이터 이중 소비 문제가 없음을 확인했다.
- **파일시스템 부작용**: 신설 코드·테스트 어느 쪽도 저장소 트리에 파일을 쓰거나 지우지 않는다. `.claude/tests/test_consistency_scope_census.py` 는 `_harness.run_in_orchestrator` 로 별도 서브프로세스(fresh interpreter)를 띄우지만 `root` 인자(`/tmp/wt`)는 텍스트 조립용 힌트일 뿐 실제 경로로 역참조되지 않는다 — 파일시스템 접근 없음. `workflow-assistant.controller.swagger.spec.ts` 가 쓰는 `buildSwaggerDocument`(기존 공유 헬퍼, 이 diff 밖)는 `app.close()` 를 `finally` 로 보장해 열린 핸들이 남지 않는다.
- **시그니처 변경**: 기존 함수 시그니처 변경 없음. `_head_basis_notice` 호출은 그대로이고, `_scope_delta_census` 는 신규 함수라 기존 호출자에게 영향이 없다. `workflow-assistant.controller.ts` 의 핸들러 시그니처(파라미터·반환 타입)도 변경되지 않았다 — 데코레이터만 추가.
- **인터페이스 변경**: 위 INFO 항목 외에 추가로 지적할 공개 API 변경은 없다. `chat-channel.dispatcher.ts`/`chat-channel.dispatcher.spec.ts`/`chat-channel/types.ts` 의 diff 는 전부 주석·JSDoc 안의 "line NNN" 인용 제거뿐이며 타입·런타임 로직은 1바이트도 바뀌지 않았다(대조 확인함).
- **환경 변수**: 관련 diff 어디에도 환경 변수 읽기/쓰기 추가 없음.
- **네트워크 호출**: 관련 diff 어디에도 신규 외부 서비스 호출 없음. `_scope_delta_census` 는 순수 문자열 처리이고, `--impl-done` 프롬프트에 실리는 내용이 달라질 뿐 이 코드 자체가 LLM/네트워크를 호출하지 않는다(호출은 orchestrator 상위 계층의 기존 경로).
- **이벤트/콜백**: 관련 diff 에 이벤트 발생·콜백 등록/해제 변경 없음.
- **plan/spec 문서 이동**: `plan/in-progress/harness-consistency-summary-downgrade-rule.md` → `plan/complete/`, `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` → `plan/complete/` 이동은 `.claude/docs/plan-lifecycle.md` 가 정의한 정상적인 plan 라이프사이클 전이이며, 코드 부작용이 아니다.

## 검증 방법

저장소 파일을 뮤테이션하지 않고 `Read`/`Bash(grep, sed -n)` 을 통한 정적 조사만 수행했다. `git status --short` 로 세션 산출물 디렉터리(`review/code/2026/08/31/18_30_55/`) 외 잔여 변경이 없음을 확인했다 — 원복할 뮤테이션이 없다.

## 요약

이번 변경분은 대부분 harness 스크립트에 순수 함수를 추가하고 그 반환값을 기존 문자열 조립 파이프라인에 이어붙이는 형태(`consistency_orchestrator.py`), 소스 코드 주석에서 썩은 줄 번호 인용을 제거하는 형태(chat-channel 3파일), 그리고 Swagger 데코레이터를 추가해 OpenAPI 문서를 보강하는 형태(`workflow-assistant.controller.ts` + 신규 회귀 테스트)로 구성된다. 전역 상태·파일시스템·시그니처·환경 변수·네트워크·이벤트 어느 축에서도 의도치 않은 부작용은 발견되지 않았다. `_scope_delta_census` 가 모든 `--impl-done` 프롬프트의 HEAD 예산을 상시로 소폭 소비하는 점과 `workflow-assistant.controller.ts` 의 OpenAPI 문서 확장은 둘 다 의도된 변경이고 테스트로 뒷받침되어 있어 INFO 로만 기록한다.

## 위험도

NONE
