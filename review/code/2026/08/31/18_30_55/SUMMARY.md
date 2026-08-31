# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 이 PR 이 정확히 "썩은 줄 번호/절 번호 인용" 결함 클래스를 스윕해서 고치던 중, 그 스윕 자체가 같은 결함 클래스를 spec 문서 안에서 최소 6곳(같은 파일 내부 자기모순 포함) 재생산했다 — documentation·requirement·maintainability 3개 reviewer 가 독립적으로 동일 근본 원인을 지적. 런타임 동작 영향은 없으나(문서/주석 전용), PR 의 자체 검증 근거("앵커 링크 96건 전수 대조")가 bare 텍스트 인용을 놓치는 범위 갭이라는 점이 반복 재발의 원인으로 확인됨. forced reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 는 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서(requirement/maintainability/documentation 3인 공통 지적) | §4.4→§4.5 절 번호 스윕이 같은 문단 안에서도 불완전 — 바로 위 문장(190행)은 §4.5 로 갱신됐는데 두 줄 뒤 문장(192행)은 §4.4 그대로라 문서 내부 자기모순 발생 | `spec/data-flow/8-notifications.md:192` | `§4.4`→`§4.5` 로 정정 |
| 2 | 문서(documentation) | WS protocol 문서 자체 내부에 절 재배치(§4.3 KB 이벤트 신설 → 알림/시스템/외부표면 절 번호 순연) 후 마크다운 링크가 아닌 bare 텍스트 인용(`§4.X` 프로즈 언급) 5곳이 갱신 누락 | `spec/5-system/6-websocket-protocol.md:28,52,156,1013,1086` | 5곳 정정 + 앵커 대조 스크립트를 마크다운 링크뿐 아니라 `§\d+(\.\d+)?` bare 프로즈 인용까지 포괄하도록 확장 |
| 3 | 요구사항/문서(requirement, documentation) | 같은 절 번호 이동이 `spec/` 밖 backend 코드 주석까지 전파되지 않음 — PR 이 주장한 "앵커 96건 전수 대조" 검증 범위 밖 사각지대 | `codebase/backend/src/modules/websocket/websocket-events.types.ts:211,232`, `websocket.service.ts:567` | 3곳 `§4.4`→`§4.5` 정정, 향후 spec 절번호 이동 시 `grep -rn '<구절번호>' codebase/` 까지 스윕 범위 포함 |
| 4 | 유지보수성(maintainability) | 매직넘버 `20`(scope-hits 표시 상한)이 파일 고유 관례(모듈 상수 추출)를 벗어나 리터럴로 두 곳에 중복 | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` `_scope_delta_census` (`scope_hits[:20]`, `len(scope_hits) - 20`) | 모듈 레벨 `_SCOPE_HITS_DISPLAY_LIMIT = 20` 상수로 추출 후 두 지점에서 참조 |
| 5 | 테스트(testing) | `scope_hits` 20개 초과 시 "... 외 N건" 절단 분기가 어떤 테스트에도 커버되지 않음(fixture 전부 0~1건 규모) — 실사용(`spec/5-system/` 등 대형 scope)에서 발생 가능한 입력 | `consistency_orchestrator.py:525-528`, `.claude/tests/test_consistency_scope_census.py:98-105` | scope_hits 21~25개 fixture 로 절단 문구·정확한 N 값 단언 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | WebSocket 세션이 핸드셰이크 이후 토큰을 재검증하지 않는 기존 갭이 plan 문서에 실측 기록됨(코드 변경 아님, 이 PR 은 문서화만) — 토큰 만료/폐기가 있어도 이미 연결된 WS 소켓은 계속 인가 상태 유지 | `plan/in-progress/spec-sync-websocket-protocol-gaps.md`, `websocket.gateway.ts:156`(jwtService.verify 유일 호출부) | 이 PR 범위 조치 불요. 보안 우선순위 트리아지에서 별도 승격 검토 권고 |
| 2 | 보안 | Cafe24 install rate limit 의 Layer1(`@nestjs/throttler`)이 여전히 in-memory(프로세스-로컬) — Layer2(Redis IP lockout)가 핵심 방어를 이미 커버(기존 defer 결정 재확인, 코드 변경 아님) | `plan/in-progress/cafe24-backlog-residual.md` | 조치 불요(기존 결정 유지) |
| 3 | 아키텍처/유지보수성 | `_scope_delta_census` 가 scope 계산·diff 계산·마크다운 렌더링 책임을 한 함수에 결합 — 기존 sibling 헬퍼(`_head_basis_notice` 등)와 동일 컨벤션이라 신규 결함은 아님 | `consistency_orchestrator.py` `_scope_delta_census` | 계산 결과를 구조화(dict/dataclass)하고 렌더링 분리 고려(현재는 불요) |
| 4 | 아키텍처 | `@ApiUnauthorizedResponse` 데코레이터가 라우트마다 수동 반복 부착(저장소 전체 209곳 기존 패턴) — 새 라우트 추가 시 다시 누락될 수 있는 구조적 여지 | `workflow-assistant.controller.ts` 등 | 저장소 전체 스코프의 `applyDecorators()` 합성 데코레이터(`@Auth()`) 후속 검토(이 PR 범위 아님) |
| 5 | 아키텍처/부작용 | HEAD 구역(census 등) 콘텐츠가 `truncate_file_bundle` 드롭 후보에서 영구 제외 — 의도된 설계이나 총 길이 추적/경고 장치 없음. `--impl-done` 세션마다 body 예산을 상시 소폭 소비 | `consistency_orchestrator.py` `collect_context`/`truncate_file_bundle` | HEAD 구역이 더 늘어나면 총 길이 상한/관측 고려 |
| 6 | 변경범위(scope) | `spec/5-system/6-websocket-protocol.md`(절번호 재배치)·`14-external-interaction-api.md`(§8.2 정정) 두 spec 편집이 CLAUDE.md 의 developer 자기-반증형 소정정 예외 조건(예고 문장 한정)을 문면상 벗어남 — diff 만으론 project-planner 트랙 여부 확정 불가 | `spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md` | 통합 조율자/후속 게이트가 이 편집이 project-planner 트랙(또는 소정정 5조건 충족)이었는지 별도 확인 권고 |
| 7 | 유지보수성 | 신규 함수 삽입부에 파일 관례(2-blank-line)를 벗어난 3-blank-line 발생 | `consistency_orchestrator.py` (`_head_basis_notice` ~ `_count_diff_files` 사이, ~477~480행) | 빈 줄 1개 제거 |
| 8 | 테스트 | `diff_lines`(변경 줄 수) 값이 어떤 테스트에서도 실제 숫자로 단언되지 않음(표시용 정보, 판정 로직 무관) | `consistency_orchestrator.py:522`, `test_consistency_scope_census.py:124-128` | fixture 의 알려진 줄 수로 단언 추가(낮은 우선순위) |
| 9 | 테스트 | `CensusIsWiredIntoImplDone` 배선 테스트가 substring 존재만 확인 — `impl_done` 분기 "안"에서 호출되는지는 미검증(자체 docstring 이 한계 인지) | `test_consistency_scope_census.py:136-157` | `--impl-done` end-to-end 스모크로 승격 고려(우선순위 낮음) |
| 10 | 요구사항(방법론 노트, 결함 아님) | 리뷰 중 `workflow-assistant.controller.ts` 첫 Read 시 `list()` 라우트 데코레이터 부재를 관측했으나 즉시 재확인 시 7개 전부 존재·테스트 2/2 GREEN — 병렬 fan-out 중 다른 reviewer 의 워크트리 동시 뮤테이션 추정, 현재 상태는 clean | `workflow-assistant.controller.ts`, `workflow-assistant.controller.swagger.spec.ts` | 조치 불요(사실 기록용) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 코드 보안 변경 없음. WS 토큰 재검증 부재·Cafe24 rate limit in-memory 는 기존 갭의 문서화(INFO) |
| architecture | LOW | 신규 헬퍼 순수함수·부작용 없음. 책임 결합·데코레이터 반복·HEAD 예산 관찰은 모두 INFO |
| requirement | LOW | §4.4→§4.5 스윕 불완전 2건(WARNING), 나머지 spec-코드 대조는 전수 일치 확인 |
| scope | LOW | 8개 커밋 각각 plan 항목과 1:1 대응, drive-by 없음. spec/ 편집 트랙 확인 필요(INFO) |
| side_effect | NONE | 전역상태·파일시스템·시그니처·환경변수·네트워크·이벤트 전 축 부작용 없음 |
| maintainability | LOW | §4.4/§4.5 자기모순 재발(WARNING), 매직넘버 20(WARNING), 스타일 이슈(INFO) |
| testing | LOW | 실제 실행·뮤테이션 검증 완료(12/12, 2/2 PASS, mutation RED 확인). 20개 초과 절단 분기 커버리지 갭(WARNING) |
| documentation | MEDIUM | PR 이 고치던 결함 클래스(썩은 절번호 인용)가 같은 PR 산출물 안에서 6곳 재발(WARNING 2건, 파급 diff 밖 코드 2곳) |
| api_contract | NONE | `@ApiUnauthorizedResponse` 순수 additive 문서화, breaking change 없음. HMAC 화이트리스트 spec 정정은 코드와 이미 일치 |

## 발견 없는 에이전트

없음 — 전 9개 reviewer 가 최소 INFO 이상 발견사항을 보고함(security·side_effect·api_contract 는 위험도 NONE 이나 INFO 관찰 존재).

## 권장 조치사항

1. `spec/data-flow/8-notifications.md:192` 의 `§4.4`→`§4.5` 정정 (WARNING #1, 3개 reviewer 공통 지적).
2. `spec/5-system/6-websocket-protocol.md:28,52,156,1013,1086` 5곳 bare 텍스트 절번호 인용 정정 (WARNING #2).
3. `codebase/backend/src/modules/websocket/websocket-events.types.ts:211,232`, `websocket.service.ts:567` 의 주석 내 `§4.4`→`§4.5` 정정 (WARNING #3).
4. 위 3건 정정 후, 향후 재발 방지를 위해 spec 절번호 이동 시 `grep -rn '§구번호' spec/ codebase/` 전수 스윕을 절차화(마크다운 링크 앵커 대조만으로는 bare 프로즈 인용을 놓친다는 점이 이번에 실측 확인됨).
5. `consistency_orchestrator.py` 의 매직넘버 `20` 을 모듈 상수로 추출 (WARNING #4).
6. `scope_hits` 21개 이상 케이스에 대한 테스트 fixture 추가 (WARNING #5).
7. (낮은 우선순위) `spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md` 편집 2건이 project-planner 트랙에서 수행됐는지(또는 자기-반증형 소정정 5조건 충족 여부) 통합 조율자가 별도 확인.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보됨**, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 해당 diff 범위 밖 (문서/주석/harness 헬퍼 중심, 성능 영향 경로 없음) |
  | dependency | 의존성 추가/변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 없음 |
