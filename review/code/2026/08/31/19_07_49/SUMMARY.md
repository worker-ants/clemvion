# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. `spec/**` 을 developer 트랙에서 직접 편집한 커밋 2건이 CLAUDE.md 의 "자기-반증형 소정정" 예외 5조건을 문면상 충족하지 못해(특히 HMAC 화이트리스트 편집은 예외가 명시적으로 배제하는 "API 계약" 항목) 프로세스 관점 WARNING 으로 격상됐다. 그 외에는 문서 자기참조 정합성(§4.6→§4.7 잔여 1건, 3라운드째 재발)과 "미조치 항목의 plan 미등재" WARNING 이 있으며, 코드 로직·API 계약·보안·부작용 관점에서는 실질 결함이 발견되지 않았다. **forced(router_safety) 화이트리스트 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 프로세스/Scope | `spec/**` 직접 편집 커밋 2건(HMAC 알고리즘 화이트리스트 정정, WS §4 절 재배치)이 CLAUDE.md "자기-반증형 소정정" 예외의 5조건을 문면상 충족하지 못함 — (조건2) HMAC 화이트리스트는 예외가 명시 배제하는 "API 계약" 문장, (조건1) `git log -S` 로 원문 작성자를 추적한 결과 developer 본인 작성 근거 없음(2026-05-21 `9ed6e6305`, `spec:` prefix), (조건4) 원문을 취소선 없이 전면 치환 | 커밋 `d743251b0`(`spec/5-system/14-external-interaction-api.md` §8.2), `50caf1a85`(`spec/5-system/6-websocket-protocol.md` §4 재배치); 후속 `0883c4e43`·`f3ece1fc6` 도 코드+harness+spec 을 한 커밋에 혼재 | 두 편집이 실제 project-planner 세션에서 수행됐는지, 혹은 예외 5조건을 사후 충족하는지 확인. 후자라면 CLAUDE.md 가 요구하는 `--impl-done`(해당 spec 파일 포함 scope) 게이트 실행 여부도 확인 — diff 안에 그 실행 로그 없음 |
| 2 | 문서정합(SoT) | `spec/5-system/6-websocket-protocol.md` 자체 안에 §4.6→§4.7 절 재배치를 반영 못한 bare-prose 인용이 1곳 더 남음 — 이 PR 이 3라운드에 걸쳐 스윕하던 바로 그 파일 안에서, 3라운드 모두 놓친 4번째 인스턴스(주제어 "notification.new" 기준 grep 이 이 줄을 놓침) | `spec/5-system/6-websocket-protocol.md:979` — "SSE 어댑터가 `Last-Event-Id` 헤더로 제공한다 (§4.6, ...)" → 실제로는 현재 §4.7("외부 표면 매핑")이 다루는 내용 | `§4.6`→`§4.7` 로 정정(가능하면 앵커 링크). 후속 절 이동 시 `grep -n '§4\.[0-9]'` 전체 목록을 헤딩 시퀀스와 1:1 대조하는 절차 권고 |
| 3 | 문서화 | 이번 커밋(`f3ece1fc6`)이 직전 라운드 INFO 2건(`8-notifications.md:349` 죽은 §4.6 참조, `SKILL.md` 의 `--impl-done` census 설명 갭)을 의도적으로 미조치 처리했는데, 그 사유가 커밋 메시지에만 남고 어떤 `plan/**` 트래커에도 등재되지 않음 — "review/**·커밋 메시지는 SoT 아니다, 미룬 항목은 그 턴에 plan/ 에 적어라"는 이 저장소 확립 관례 위반 | 커밋 `f3ece1fc6` 메시지 `## 미조치 (사유)` 절; `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에는 두 항목 모두 부재(grep 확인) | 두 미조치 항목을 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(또는 신설 harness 트래커)에 체크박스로 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | `WorkflowAssistantController` 7개 라우트에 `@ApiUnauthorizedResponse` 신규 부착 — 이미 `@ApiBearerAuth` 로 인증이 강제되던 라우트의 401 OpenAPI 문서 누락(`swagger.md §2-4` 위반)을 메우는 순수 additive 변경, breaking change 없음. 신규 회귀 테스트로 라우트 수·문구 고정 | `codebase/backend/.../workflow-assistant.controller.ts` (7개 메서드), `workflow-assistant.controller.swagger.spec.ts` | 조치 불요(정상 개선) |
| 2 | 보안/API 계약 | `spec/5-system/14-external-interaction-api.md` §8.2 HMAC 알고리즘 화이트리스트 문구 정정(`hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512`) — 코드(`notification-signature.util.ts` 등)는 이미 두 알고리즘을 지원 중이었음을 확인, spec 문구가 뒤늦게 구현을 따라잡은 문서 전용 변경 | `spec/5-system/14-external-interaction-api.md` §8.2 | 조치 불요 |
| 3 | 문서정합 | `spec/data-flow/8-notifications.md:349` 의 "본 문서 §4.6 follow-up" 인용은 번호 이동에 따른 오인용이 아니라 애초부터 실재하지 않는 대상(`notification.read`/`notification.dismissed` follow-up)을 가리키는 별개 선재 결함(2026-05월 기원). 이번 PR 범위 밖 판단은 타당하나 위 WARNING #3 사유로 plan 등재 필요 | `spec/data-flow/8-notifications.md:349` | follow-up 서술 삭제 또는 §4.5 본문에 실제 내용 추가+앵커 정정 |
| 4 | 문서화 | `.claude/skills/consistency-checker/SKILL.md` 의 `--impl-done` 설명이 신설 `_scope_delta_census` HEAD 블록(절단 여부 판별용 실측 census)을 언급하지 않음 | `.claude/skills/consistency-checker/SKILL.md` `--impl-done` bullet | "target_doc 은 scope/diff 델타 census 도 head 구역에 포함한다" 한 문장 추가 |
| 5 | 테스트 | `_scope_delta_census` 가 렌더링하는 `{diff_lines}줄` 값이 어떤 테스트에서도 단언되지 않음 — `999999` 로 뮤테이션해도 14/14 GREEN 유지됨을 직접 확인(원복 검증 완료). 판정 로직에 영향 없는 표시값이라 낮은 심각도 | `consistency_orchestrator.py` `_scope_delta_census`; `.claude/tests/test_consistency_scope_census.py` | `test_present_diff_warns_that_absence_below_means_truncation` 에 `diff_lines` 값 단언 한 줄 추가 |
| 6 | 테스트 | `_count_diff_files` 의 rename-only diff(`+++`/`---` 헝크 없음) 카운트 경로가 fixture 로 검증되지 않음 — docstring 이 rename 을 명시적 동기로 들면서도 해당 fixture 부재 | `.claude/tests/test_consistency_scope_census.py` `CountDiffFiles` 클래스 | rename fixture 케이스 1건 추가 |
| 7 | 유지보수성 | `_scope_delta_census` 가 "scope 델타"와 "diff 델타" 두 독립 축을 계산+렌더링까지 한 함수에 담음(기존 파일 컨벤션 연장이라 새 결함은 아님) | `consistency_orchestrator.py` `_scope_delta_census` | 세 번째 축이 추가되는 시점에 구조화된 값(dict/dataclass)+렌더링 분리 고려 |
| 8 | 유지보수성 | `@ApiUnauthorizedResponse` 동일 리터럴이 7개 라우트에 수동 반복 부착 — 저장소 기존 관례 연장이라 회귀 아니지만, 새 라우트 추가 시 같은 누락이 재발할 구조적 여지 | `workflow-assistant.controller.ts` | 이 PR 범위 조치 불요. 후속으로 `applyDecorators()` 기반 `@Auth()` 합성 데코레이터 고려 |
| 9 | 유지보수성 | `ApiUnauthorizedResponse` import 위치가 알파벳 순서와 어긋남(기존부터 무질서, lint 미강제) | `workflow-assistant.controller.ts` import 블록 | 조치 불요 |
| 10 | Scope/프로세스 | plan 문서 다건에 "착수 전 실측" 블록만 추가되고 구현은 수반하지 않음 — 기능 확장이 아니라 착수 가능해 보이던 항목을 "결정 필요"로 좁힌 것이라 방향은 반대(정상) | `cafe24-backlog-residual.md` 등 5개 plan 파일 | 조치 불요 |
| 11 | 부작용 | `--impl-done` target_doc 조립부에 census 블록이 항상 추가되어 프롬프트 크기/형태가 이 커밋부터 바뀜(의도된 변경, 추가 I/O 없음, 다른 모드 미영향) | `consistency_orchestrator.py` `collect_context` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 코드 로직 변경 없음(주석/JSDoc/spec 문구 정정, additive swagger 데코레이터뿐). IDOR fail-closed 비교 로직 무변경 실측 확인 |
| requirement | LOW | WS protocol 문서 자기참조 §4.6→§4.7 미반영 1건(3라운드째 재발, WARNING #2) |
| scope | MEDIUM | spec/** 직접 편집 2건이 자기-반증형 소정정 예외 조건 미충족(WARNING #1) |
| side_effect | NONE | 실질 부작용 없음 — harness 신규 함수는 순수 문자열 조합, 나머지는 additive/주석 |
| maintainability | NONE | 이전 두 라운드 WARNING(매직넘버·빈줄 관례·테스트 갭) 전부 해소 확인. 잔여 INFO 3건뿐 |
| testing | LOW | `diff_lines` 미검증(뮤테이션 확인)·rename fixture 부재(INFO #5, #6) |
| documentation | LOW | 미조치 항목 2건이 plan 미등재(WARNING #3) |
| api_contract | NONE | 순수 additive, breaking change 없음, wire 계약(이벤트명/필드) 무변경 확인 |

## 발견 없는 에이전트

없음 — 전 8개 에이전트가 최소 INFO 이상을 보고했다(Critical/WARNING 없이 INFO만 낸 에이전트: security, side_effect, maintainability, api_contract).

## 권장 조치사항

1. `spec/5-system/6-websocket-protocol.md:979` 의 `§4.6` → `§4.7` 정정 (WARNING #2).
2. `spec/**` 직접 편집 커밋 2건(`d743251b0`, `50caf1a85`)이 project-planner 트랙에서 수행됐는지 확인, 아니라면 자기-반증형 소정정 5조건 충족 여부 재검토 + `--impl-done` 게이트 실행 여부 확인 (WARNING #1).
3. 미조치 처리된 두 문서 갭(`8-notifications.md:349` 죽은 §4.6 참조, `SKILL.md` census 설명 누락)을 `plan/in-progress/` 트래커에 체크박스로 등재 (WARNING #3, INFO #3·#4).
4. (낮은 우선순위) `_scope_delta_census` 의 `diff_lines` 값 단언 추가, `_count_diff_files` rename fixture 추가 (INFO #5·#6).
5. (낮은 우선순위) `@ApiUnauthorizedResponse` 등 인증 데코레이터 반복 부착을 합성 데코레이터로 통합하는 저장소 전체 스코프 리팩터 고려 (INFO #8).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — **전원 결과 확보됨, 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관(성능 영향 표면 없음) |
  | architecture | router 판단상 이번 diff 와 무관(구조 변경 없음) |
  | dependency | router 판단상 이번 diff 와 무관(의존성 변경 없음) |
  | database | router 판단상 이번 diff 와 무관(DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 무관(동시성 로직 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관(사용자 가이드 영향 없음) |
