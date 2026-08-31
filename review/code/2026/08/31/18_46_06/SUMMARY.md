# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 이번 diff(`0883c4e43`, 직전 라운드 `18_30_55`의 Warning 5건 fix)는 대체로 깨끗하나, (1) 신설 테스트 파일이 `.claude/tests/README.md` 카탈로그 가드를 현재 RED 상태로 만들고 있고(testing 발견, 개별 파일 실행으로는 안 보이고 `unittest discover` 전체 실행에서만 드러남), (2) §4.4→§4.5 절번호 스윕이 이 PR이 직접 수정한 파일(`websocket.service.ts`, `websocket.service.spec.ts`) 안에서마저 불완전해 자기모순 인용이 남아 있다(api_contract 발견). 강제(forced) reviewer 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 신설 `.claude/tests/test_consistency_scope_census.py`가 `.claude/tests/README.md` "What's covered" 카탈로그에 등재되지 않아 기존 가드 테스트가 현재 RED (재현 확인: `AssertionError: Lists differ: ['test_consistency_scope_census.py'] != []`). 개별 파일 단위 실행에서는 드러나지 않고 `python3 -m unittest discover` 전체 실행에서만 노출됨 — 커밋 메시지의 "docs 가드 통과" 서술이 이 축을 실제로 통과시킨 적이 없었음을 의미 | `.claude/tests/test_tests_readme_catalog.py:71-77` (`CatalogCoverageTest.test_every_test_file_is_documented`), 원인 파일 `.claude/tests/test_consistency_scope_census.py` | `.claude/tests/README.md` "## What's covered" 표에 해당 파일 행 1개 추가(모듈 docstring 요약을 옮기면 됨) |
| 2 | API Contract | §4.4→§4.5 절번호 스윕(이 PR의 핵심 fix 대상)이 diff로 직접 손댄 두 파일 안에서마저 불완전 — JSDoc 헤더/테스트 제목은 §4.5로 고쳤지만 같은 메서드/같은 테스트 블록의 인접 bare-prose 주석은 §4.4 그대로 남아 같은 블록 안에서 "정확한 shape"를 서로 다른 절이라 동시에 주장하는 자기모순 발생 | `websocket.service.ts:583-585`(`emitNotificationEvent` 인라인 주석, cf. 같은 파일 567행은 이미 §4.5로 수정됨) · `websocket.service.spec.ts:1283`(cf. 같은 테스트 1268행은 이미 §4.5로 수정됨) | 두 지점 `§4.4`→`§4.5` 정정. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`가 제안한 `grep -rn '§<구번호>'` 전수 스윕 절차가 이 bare-prose 인용 유형을 실제로 포함하는지 재확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | WS 세션이 핸드셰이크 이후 토큰을 재검증하지 않는 기존 갭이 plan 문서에 실측 기록됨(코드 변경 아님, 사전 존재 갭) — 토큰 만료/폐기 후에도 연결된 소켓은 계속 인가된 채 유지 | `plan/in-progress/spec-sync-websocket-protocol-gaps.md`(`auth.token_expired` 블록), `websocket.gateway.ts:156`(`jwtService.verify` 유일 호출부) | 이 PR 조치 불요. 계정 잠금/강제 로그아웃 기능이 실재한다면 별도 보안 우선순위 트리아지로 승격 검토 |
| 2 | Security | Cafe24 install rate limit Layer 1(`@nestjs/throttler`)이 여전히 in-memory(프로세스-로컬)라는 기존 한계가 plan 문서에 재확인·기록됨(기존 defer 결정 유지, 코드 변경 아님) | `plan/in-progress/cafe24-backlog-residual.md` | 조치 불요(defer 유지) |
| 3 | Documentation | `spec/data-flow/8-notifications.md:349`의 "§4.6 follow-up" 참조가 신·구 번호 체계 어느 쪽으로도 실재하지 않는 내용(`notification.read`/`notification.dismissed`)을 가리키는 죽은 참조 — 2026-05-29 기원 선재 결함, 이번 PR의 §4.4→§4.5 스윕 범위 밖(그 방법론은 "번호 이동 오인용"만 잡고 "애초에 없는 대상"은 사각지대) | `spec/data-flow/8-notifications.md:349` | PR 범위 밖. 후속으로 해당 follow-up 서술 삭제 또는 §4.5 본문에 실제 내용 추가+앵커 연결 권고 |
| 4 | API Contract | `notifications-channel-authorizer.ts`의 주석이 "emit 미구현(§4.4 Planned)"이라 적고 있으나 `notification.new` emit은 이미 구현·배선 완료 상태 — 이 PR diff 밖이라 이 PR이 만든 결함은 아니지만 §4.4→§4.5 스윕이 "훑었다"는 `codebase/` 범위에서 여전히 누락된 인스턴스 | `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts:12` | 별도 후속(비블로킹): "구현됨"으로 캡션 갱신 + §4.4→§4.5 |
| 5 | Documentation | `.claude/skills/consistency-checker/SKILL.md`의 `--impl-done` 설명이 이번에 신설된 `_scope_delta_census` HEAD 블록(2번째 HEAD 보존 구역)을 언급하지 않음 | `.claude/skills/consistency-checker/SKILL.md`(`--impl-done` bullet) | 필수 아님. 해당 bullet에 한 문장 추가 권고 |
| 6 | Testing | `diff_lines`(구현 diff 줄 수) 값이 어떤 테스트에서도 실제 숫자로 단언되지 않음 — 이전 라운드부터 유보된 저비용 갭, 이번 커밋 반영 대상에서 명시적으로 제외됨 | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:527`, `.claude/tests/test_consistency_scope_census.py:124-128` | 선택: `{ONE_FILE_DIFF 줄수}줄` 단언 한 줄 추가 |
| 7 | Testing | `spec-links` 가드가 마크다운 앵커 링크만 검사하고 `§4.x` bare 프로즈 인용은 검사하지 못하는 커버리지 갭 — 이번 diff 작업 중 뮤테이션으로 실측 확인되어 plan에 이미 등재됨(이 PR 코드 수정 범위 밖) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 조치 불요(이미 등재). 통합 조율자가 후속 우선순위 판단 |
| 8 | Maintainability | `_scope_delta_census`가 "scope 델타"와 "diff 델타"라는 서로 무관한 두 관심사를 한 함수에 담고 있음(단, 파일 기존 컨벤션과 일관되어 이 변경이 새로 만든 결함은 아님) | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`(`_scope_delta_census`) | 지금 리팩터 불요. 세 번째 "축" 추가 시 구조화된 값+렌더링 분리 고려 |
| 9 | Maintainability | `@ApiUnauthorizedResponse` 동일 리터럴이 7개 라우트에 수동 반복 부착 — 저장소 기존 관례와 일관되나 새 라우트 추가 시 같은 방식(문서화 누락)으로 재발할 여지 | `workflow-assistant.controller.ts`(6개 지점) | 이 PR 범위 조치 불요. 후속으로 `applyDecorators()` 기반 합성 데코레이터(`@Auth()`) 도입 고려(저장소 전체 스코프, 별도 PR) |
| 10 | Scope | 리뷰 prompt가 동일 plan 파일을 "있음/없음" 두 항목으로 이중 표기 — 실제로는 `git diff -M --summary` 기준 단일 rename(plan lifecycle 관례 정상 준수)이며, prompt 조립 하니스가 rename 감지 없이 diff를 뜬 것으로 보이는 표시 문제 | 프롬프트 파일 11 vs 15, 파일 13 vs 19(`harness-consistency-summary-downgrade-rule.md`, `spec-sync-stop-editor-and-forbidden-routes.md`) | 코드 변경 자체는 조치 불요. harness(diff 수집 로직)에 rename 감지 적용을 백로그로 등재할 가치 있음 |
| 11 | Scope | `spec/5-system/6-websocket-protocol.md`(§4 절번호 재배치) · `14-external-interaction-api.md`(§8.2 HMAC 화이트리스트 정정) 두 spec 편집이 CLAUDE.md의 developer 자기-반증형 소정정 예외 5조건을 충족하는지 diff만으로는 확정 불가 — 2라운드 연속 동일 INFO, 위반/정당화 어느 쪽도 새 증거 없음 | `spec/5-system/6-websocket-protocol.md`(커밋 `50caf1a85`), `14-external-interaction-api.md`(커밋 `d743251b0`) | 이 라운드 CRITICAL/WARNING 승격 근거 없음. 통합 조율자 또는 `--impl-done`(해당 scope 포함) 게이트가 트랙 구분을 별도 확인 권고 |
| 12 | Side Effect | `_scope_delta_census`가 `--impl-done` 프롬프트 HEAD 구역 예산을 매 세션 고정적으로 추가 소비(의도된 트레이드오프, 테스트로 뒷받침됨) — `_head_basis_notice`에 이은 두 번째 "HEAD 항상 보존" 블록으로 누적 방향성만 인지 | `consistency_orchestrator.py`(`_scope_delta_census` 호출부, `collect_context` 내 `target_doc` 조립부) | 조치 불요. HEAD 구역이 3번째 이상 늘어나면 총 길이 상한/관측 추가 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 변경 없음(harness 순수 함수·주석/문서 정정·swagger additive). 기존 WS 토큰 재검증 갭·Cafe24 rate limit 한계는 사전 존재 갭의 문서화일 뿐 |
| requirement | NONE | 직전 라운드 Warning 5건 전부 diff로 해소 확인(재검증 완료). 기능 결함·spec 불일치 없음 |
| scope | LOW | fix 커밋이 직전 리뷰 지적 5건에 정확히 대응, drive-by 없음. 이중 파일 표기는 rename 오독(하니스 이슈, 코드 무관). spec 편집 트랙 판정은 2라운드째 미확정 |
| side_effect | NONE | 전역상태/파일시스템/시그니처/환경변수/네트워크/이벤트 전 축에서 의도치 않은 부작용 없음 |
| maintainability | NONE | 직전 라운드 유지보수성 Warning 4건 전부 해소 확인. 잔여는 저우선순위 INFO 2건뿐 |
| testing | MEDIUM | 뮤테이션 테스트로 fix 5건 독립 재검증(GREEN/RED 예측대로). 신규 테스트 파일이 README 카탈로그 가드를 RED로 만든 것을 `unittest discover` 전체 실행에서 최초 발견 |
| documentation | LOW | 직전 라운드 문서화 Warning 전부 해소 확인. 잔여는 PR 범위 밖 선재 결함(8-notifications.md:349 죽은 참조) + SKILL.md 경미한 설명 갭 |
| api_contract | LOW | swagger 401 additive·HMAC 화이트리스트 정정은 계약 영향 없음. §4.4→§4.5 스윕이 자신이 고친 파일 안에서도 불완전(자기모순 인용 2곳) |
| user_guide_sync | NONE | 매트릭스 20 trigger 중 매칭된 2건(`backend-api-change`, `spec-major-change`) 모두 갭 없음. frontend 파일 변경 0건이라 나머지 18 trigger 전부 무관 |

## 발견 없는 에이전트

user_guide_sync — 매트릭스 기반 검토 결과 실질 발견사항 없음(무관 trigger 18건 + 매칭됐으나 갭 없는 trigger 2건).

## 권장 조치사항
1. `.claude/tests/README.md` "## What's covered" 표에 `test_consistency_scope_census.py` 행 추가 — 현재 RED 인 카탈로그 가드(`test_tests_readme_catalog.py`)를 즉시 GREEN으로 되돌리는 최소 비용 조치 (WARNING #1).
2. `websocket.service.ts:583-585`와 `websocket.service.spec.ts:1283`의 잔존 `§4.4`를 `§4.5`로 정정 — 이 PR이 직접 손댄 파일 안의 자기모순을 해소 (WARNING #2).
3. (선택, 낮은 우선순위) `notifications-channel-authorizer.ts:12`의 "미구현" 주석 갱신, `8-notifications.md:349` 죽은 참조 정리, SKILL.md `--impl-done` 설명 보강 — 이 PR 범위 밖이므로 후속 세션에서.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **제외**: 5명 (아래 표)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(변경분에 성능 영향 표면 부재) |
  | architecture | router 판단(구조적 변경 부재) |
  | dependency | router 판단(package.json 등 의존성 변경 부재) |
  | database | router 판단(DB 스키마/쿼리 변경 부재) |
  | concurrency | router 판단(동시성 관련 변경 부재) |
