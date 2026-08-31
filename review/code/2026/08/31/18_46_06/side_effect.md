# 부작용(Side Effect) 리뷰

## 검토 범위 요약

이번 changeset 은 37개 파일로 구성되나, 실행 가능한 코드 변경은 소수다.

- **harness 코드**: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 신설 함수 `_count_diff_files`/`_scope_delta_census` + 모듈 상수 `_SCOPE_HITS_DISPLAY_LIMIT` + `collect_context` 배선. 대응 테스트 `.claude/tests/test_consistency_scope_census.py`(신설).
- **backend 코드**: `workflow-assistant.controller.ts` 에 `@ApiUnauthorizedResponse` 7건 additive 부착 + 신설 `workflow-assistant.controller.swagger.spec.ts`. `chat-channel.dispatcher.ts`/`.spec.ts`/`types.ts`, `websocket-events.types.ts`/`websocket.service.ts`/`websocket.service.spec.ts` 는 전부 주석·JSDoc·테스트 설명 문자열만 변경.
- **문서**: `plan/**` 다수·`spec/5-system/6-websocket-protocol.md`(§4 절번호 재배치)·`spec/5-system/14-external-interaction-api.md`(§8.2 HMAC whitelist 정정, §11 앵커 갱신)·`spec/data-flow/8-notifications.md`(§4.4→§4.5 인용 4곳 동기화) — 전부 코드가 아닌 마크다운.
- **review 산출물**: `review/code/2026/08/31/18_30_55/*` (SUMMARY.md, meta.json, 각 reviewer .md, `_retry_state.json`) — 직전 라운드 리뷰 세션의 산출물이 저장소 관례 위치(`review/code/**`)에 신규 커밋된 것.

이 라운드는 직전 리뷰(`18_30_55`)가 지적한 WARNING(§4.4→§4.5 스윕 누락 등)에 대한 후속 정정을 포함하고 있음을 diff 로 확인했다(예: `spec/data-flow/8-notifications.md:192` 가 이미 `§4.5` 로 갱신됨).

## 발견사항

- **[INFO]** `--impl-done` 프롬프트의 HEAD 예산을 매 세션 고정적으로 추가 소비한다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 함수 `_scope_delta_census`, 호출부 `collect_context` 내 `target_doc = (...)` 조립부 (게이트 778-784행)
  - 상세: `_scope_delta_census` 의 반환 텍스트는 `truncate_file_bundle` 이 드롭 후보로 보지 않는 HEAD 섹션에 항상 삽입된다(설계 의도). `--impl-done` 모드의 모든 세션에서 scope 델타가 최대 20건까지 나열되는 만큼 body(spec 폴더 dump) 가 쓸 수 있는 유효 예산이 그만큼 줄어드는 부작용이 있다. 이는 문서화된 트레이드오프이고 `CensusSurvivesTruncation` 류 테스트로 뒷받침되어 의도치 않은 부작용은 아니다. 다만 이런 "HEAD 는 항상 보존" 블록이 `_head_basis_notice` 에 이어 두 번째로 늘어난 것이라, 총 길이 상한/관측 장치가 없다는 점은 이번 변경이 만든 것은 아니지만 누적되고 있는 방향이다.
  - 제안: 조치 불요. 향후 HEAD 구역이 세 번째 이상 늘어나면 총 길이 상한 또는 관측(로그) 추가를 고려.

- **[INFO]** OpenAPI 문서(공개 인터페이스 표면) 확장 — 런타임 동작 변경 없음
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` — `list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage` 7개 핸들러에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 추가 (게이트 28, 59, 79, 97, 111, 125, 141, 164)
  - 상세: 데코레이터 추가는 `SwaggerModule.createDocument()` 가 생성하는 OpenAPI 문서(`/docs`)의 401 응답 스키마를 확장한다 — 순수 메타데이터이며 가드(`@ApiBearerAuth`/`@WorkspaceId()`/`@Roles()`)·핸들러 시그니처·응답 바디는 그대로다. 신설 `workflow-assistant.controller.swagger.spec.ts` 가 라우트 수(공허 방지 `toHaveLength(7)`)와 문구를 회귀 고정한다. 저장소 안에서 이 변경을 소비하는 정적 openapi.json/클라이언트 코드 생성 스텝은 이번에도 발견되지 않았다(`main.ts` 런타임 serve 외 없음) — 다른 axis(예: 별도 SDK 생성 파이프라인)가 있다면 재생성이 필요할 수 있다는 점만 참고로 남긴다.
  - 제안: 조치 불요.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` §4.3 절 신설·이동에 따른 §4.4~§4.6→§4.5~§4.7 재번호가 `spec/` 밖 코드/문서로 파급된다
  - 위치: `spec/5-system/14-external-interaction-api.md:1125`(§4.6→§4.7 앵커), `spec/data-flow/8-notifications.md`(§4.4→§4.5 4곳), `codebase/backend/src/modules/websocket/websocket-events.types.ts`(주석 §4.4→§4.5, 게이트 211/232), `codebase/backend/src/modules/websocket/websocket.service.ts`(주석, 게이트 567), `websocket.service.spec.ts`(테스트 설명 문자열, 게이트 1268)
  - 상세: 실행 코드·타입·테스트 단언 로직 자체는 변하지 않는다(문자열/주석만 변경) — 런타임 부작용은 없다. 다만 이는 **부작용이 아니라 spec 문서 절번호라는 "약한 링크"에 의존하는 다수 파일이 한 문서의 재번호에 연쇄적으로 종속돼 있다는 결합 패턴**이다. 이 라운드는 diff 로 확인된 만큼(위 5개 파일)은 갱신했으나, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 자체가 "bare 프로즈 인용은 앵커 가드가 못 잡는다"를 신규 백로그로 등재해 이 결합의 잔여 위험을 인지하고 있다. side-effect 관점에서는 코드 동작 영향이 없어 INFO 로 남긴다.
  - 제안: 조치 불요(이미 문서화·후속 백로그 등재됨). requirement/documentation reviewer 의 발견과 중복이라 우선순위는 그쪽에 위임.

## 점검 관점별 확인 결과 (문제 없음)

- **의도치 않은 상태 변경 / 전역 변수**: `_count_diff_files`·`_scope_delta_census` 는 인자만으로 문자열을 조립해 반환하는 순수 함수다(직접 소스 확인: `sed -n '440,600p'`) — 전역 상태를 읽거나 쓰지 않고 새 전역 변수(모듈 상수 `_SCOPE_HITS_DISPLAY_LIMIT` 는 불변 리터럴)도 부작용을 만들지 않는다. `collect_context` 의 `diff_text`(`_collect_code_diff` 반환값, 게이트 749행)는 `diff_section` 조립(756행)과 `_scope_delta_census`(780행) 양쪽에서 재사용되며 일반 `str` 이라 이중 소비 문제가 없다. `_rank_changed` 도 함수 로컬 변수로, 전역이 아니다.
- **파일시스템 부작용**: 신설 코드·테스트 어느 쪽도 저장소 트리에 파일을 쓰거나 지우지 않는다. `test_consistency_scope_census.py` 는 `_harness.run_in_orchestrator` 로 별도 서브프로세스를 띄우지만 인자로 넘어가는 `root`/경로 문자열은 텍스트 조립용 힌트이며 실제 파일시스템 접근이 없다.
- **시그니처 변경**: 기존 함수 시그니처 변경 없음(`_head_basis_notice`, `collect_context` 등 그대로). `_scope_delta_census`/`_count_diff_files` 는 신규 함수라 기존 호출자에게 영향이 없다. `workflow-assistant.controller.ts` 핸들러 시그니처(파라미터·반환 타입)도 데코레이터만 추가됐을 뿐 변경 없음.
- **인터페이스 변경**: OpenAPI 401 응답 추가(위 INFO)를 제외하면 추가로 지적할 공개 API 변경은 없다. `chat-channel`/`websocket` 관련 6개 파일의 diff 는 전부 주석·JSDoc·테스트 설명문 안의 인용 정정뿐이며 타입·런타임 로직은 바뀌지 않았다.
- **환경 변수**: 관련 diff 어디에도 환경 변수 읽기/쓰기 추가 없음.
- **네트워크 호출**: 관련 diff 어디에도 신규 외부 서비스 호출 없음. `_scope_delta_census` 는 순수 문자열 처리이고, 그 출력이 프롬프트에 실려 상위 계층이 기존 경로로 LLM 을 호출할 뿐 이 함수 자체가 네트워크를 만지지 않는다.
- **이벤트/콜백**: 관련 diff 에 이벤트 발생·콜백 등록/해제 변경 없음.
- **plan 문서 이동**: `plan/in-progress/harness-consistency-summary-downgrade-rule.md`·`plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` → `plan/complete/` 이동은 `.claude/docs/plan-lifecycle.md` 가 정의한 정상 전이이며 코드 부작용이 아니다.
- **review 산출물 신규 파일**: `review/code/2026/08/31/18_30_55/**`(SUMMARY.md, meta.json, `_retry_state.json`, 각 reviewer 리포트)는 이 저장소 관례(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)가 정의한 정본 위치에 쓰인 이전 리뷰 세션의 산출물이다 — 예상치 못한 파일시스템 부작용이 아니다.

## 검증 방법

저장소를 뮤테이션하지 않고 `Read`/`Bash(grep, sed -n)` 로 소스를 직접 열어 대조했다. `git status --short` 로 확인한 결과 이번 세션 자신의 산출물 디렉터리(`review/code/2026/08/31/18_46_06/`) 외 잔여 변경이 없다 — 원복할 뮤테이션이 없다.

## 요약

이번 변경분은 (1) harness 스크립트에 순수 함수 2개를 추가하고 그 반환값을 기존 문자열 조립 파이프라인에 이어붙이는 것, (2) 소스 코드 주석/JSDoc/테스트 설명문에서 썩은 줄 번호·절 번호 인용을 정정하는 것(6개 파일, 전부 non-executable 텍스트), (3) 이미 인가된 컨트롤러에 Swagger 401 문서화를 additive 로 추가하고 회귀 테스트를 신설하는 것, (4) spec 문서 절 재배치와 그 파급을 동기화하는 것, (5) 다수 plan 문서의 실측 기록/상태 갱신으로 구성된다. 전역 상태·파일시스템·함수 시그니처·환경 변수·네트워크·이벤트 어느 축에서도 의도치 않은 부작용은 발견되지 않았다. `_scope_delta_census` 의 HEAD 예산 상시 소비와 `workflow-assistant.controller.ts` 의 OpenAPI 문서 확장은 둘 다 의도된 설계이고 테스트로 뒷받침되어 있어 INFO 로만 기록하며, 이번 라운드는 직전 리뷰(`18_30_55`)가 지적한 절번호 스윕 누락에 대한 후속 정정까지 포함하고 있음을 확인했다.

## 위험도

NONE
