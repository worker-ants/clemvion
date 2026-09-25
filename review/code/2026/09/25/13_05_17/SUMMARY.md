# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. CHANGELOG 신규 배너가 아직 존재하지 않는 `plan/complete/changelog-criteria.md` 를 인용하는 forward-reference 오류 1건(WARNING, requirement·documentation 두 reviewer가 독립적으로 지적)이 유일한 실질 위험이며, 그 외는 이미 사전 consistency-check 가 인지·트래킹 중인 구조적 부채(INFO)다. forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / documentation | `CHANGELOG.md` 신규 기준 배너가 "2026-09-25 성문화(`plan/complete/changelog-criteria.md`)"를 인용하지만, 이 diff 시점에 그 plan 은 아직 `plan/in-progress/changelog-criteria.md` 에 있고(`status: in-progress`) `## C. 검증` 체크리스트에 `/ai-review`·"트래커 항목 닫기 + 재판정 후보 등재" 두 항목이 미완료다. 게다가 plan 자체에 "`plan/complete/` 로 이동" 을 명시하는 체크리스트 항목이 없다. 이 CHANGELOG 의 다른 항목들(`:671`, `:3105`)은 실제로 이동이 끝난 뒤에만 `plan/complete/...` 를 인용하는 관례를 지키는데, 이번 항목만 아직 일어나지 않은 이동을 기정사실로 적어 forward reference 가 된다. | `CHANGELOG.md:3` (참조), `plan/in-progress/changelog-criteria.md:89-90` (미완료 체크박스), frontmatter `status: in-progress` | (a) 문구를 실제 위치(`plan/in-progress/...`)로 바꾸거나 (b) 이번 세션에서 plan 을 실제로 `plan/complete/` 로 옮기는 마무리 커밋까지 완료한 뒤 병합. plan `## C` 에 "plan 을 `plan/complete/` 로 이동" 체크리스트 항목을 명시적으로 추가하는 것도 권장(documentation 제안). 이 중 하나 없이 병합 금지 — 누락 시 CHANGELOG 가 존재하지 않는 경로를 영구히 가리키게 된다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `review/consistency/2026/09/25/12_52_34/_retry_state.json` 이 5개 checker 모두 성공(SUMMARY·개별 리포트 실재)했음에도 `agents_pending` 에 5개 전부, `agents_success: []` 로 커밋됨 — fallback 평문 fan-out 경로가 사후 갱신을 안 해 최초 dispatch 스냅샷 그대로 남은 것으로 보임. `--resume` 이 이미 끝난 checker 를 재실행할 소지. | `review/consistency/2026/09/25/12_52_34/_retry_state.json` | 커밋 전 실제 완료 상태로 갱신하거나, fallback 경로가 `_retry_state.json` 을 아예 쓰지 않도록 스킬 문서에 명시. |
| 2 | scope | "정식 규약"에 준하는 CHANGELOG 판정 기준이 `spec/conventions/` 가 아니라 `CHANGELOG.md` 본문에 직접 신설됨(CLAUDE.md 정보 저장 위치 원칙과 편차). plan 이 위치 선택 근거를 스스로 남겼고, 동석 consistency-check(WARNING #1, BLOCK:NO)가 이미 지적해 트래킹 중. | `CHANGELOG.md:3-22` (신규 기준 블록) | 별도 조치 불요(중복 지적 방지). 향후 `spec/conventions/` 로 이관 가능성은 plan 트래커에 열어둔 채 유지. |
| 3 | scope | 한 PR 에 "기준 성문화"·"과거 이력 백필(V110~V130 21건)"·"기존 `## 부수 —` 헤딩 접두 누락 수정" 세 가지 성격이 다른 변경이 섞여 있음. plan §B/§A-1 이 각각 근거를 명시해 은닉된 확장은 아니나, 엄밀한 "PR=관심사 1개" 기준으로는 (b)는 별도 커밋으로 분리 가능했던 이력 데이터 변경. | `CHANGELOG.md:3`(기준), `:24-39`(백필 표), `:2189`(헤딩 정정) | 조치 불요. 리뷰 시 백필 표의 실측치(ms 수치·PR 번호)는 별도 사실 확인 필요(이번 리뷰에서 documentation 이 이미 대조 완료: V110 PR#1285 등 전부 일치). |
| 4 | side_effect / maintainability / testing | `documentation` 리뷰어 checklist 관점 6 문구가 SSOT(`role_instructions.py`, orchestrator 가 프롬프트에 주입)와 렌더링(`documentation-reviewer.md`, Agent fallback 경로가 로드하는 system prompt) 두 파일에 수동으로 이중 유지됨. 이번 PR 은 byte 단위로 정확히 동기화했고(사전 consistency-check WARNING #2 해소 확인), `test_agent_consistency.py` 는 registry-level 만 가드하고 이 prose 문구의 일치는 "의도적으로 unguard" 라고 docstring 에 명시 — 다음에 한쪽만 편집해도 어떤 테스트도 잡지 못하는 구조적 리스크는 남는다. | `.claude/skills/code-review-agents/lib/role_instructions.py:141`, `.claude/agents/documentation-reviewer.md:21`, `.claude/tests/test_agent_consistency.py` (docstring) | 이번 PR 범위에서는 조치 불요(이미 정확히 동기화됨). 후속으로 `role_instructions.py` 를 SSOT 로 두고 `.md` 를 생성/검증하는 regenerator 스크립트나, 이 특정 항목만 byte-diff 로 고정하는 선택적 테스트 추가를 고려. |
| 5 | maintainability | CHANGELOG 배너의 월별 이력 불완전 비율(0%·5%·37%·30%·49%)이 `CHANGELOG.md`·`plan/in-progress/changelog-criteria.md`(원본 SoT, `cl_monthly.py` 실측)·`plan/in-progress/spec-draft-nullable-notation-followups.md` 세 곳에 손으로 옮겨져 중복 기재됨. 현재 세 값은 일치하나 자동 검증(테스트·가드)은 없음. | `CHANGELOG.md:20`, `plan/in-progress/changelog-criteria.md:29-33`, `plan/in-progress/spec-draft-nullable-notation-followups.md:5185` | 조치 불요(현재 일치). 향후 재집계 시 세 곳을 동시에 `grep` 으로 찾아 갱신하도록 plan 후속 메모에 남겨둘 것. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드·SQL·시크릿·인증/인가·의존성 변경 없음 — 문서/plan/리뷰 산출물 전용. 공격 표면 없음. |
| requirement | LOW | WARNING(plan/complete 참조 오류) + `_retry_state.json` stale 상태(INFO). 핵심 기능(기준 성문화·백필)은 git log·마이그레이션 파일과 대조해 정확·완전함을 확인. |
| scope | LOW | 관심사 3종 혼재, 정책 위치를 `spec/conventions/` 대신 CHANGELOG 에 둔 편차 — 둘 다 plan/consistency-check 가 이미 인지·근거 보유. 은닉된 무관 변경·리팩터링·기능 확장 없음. |
| side_effect | NONE | 실행 로직/전역상태/네트워크 변경 0. checklist 이중 유지 구조(INFO)만 확인, 실질 영향 없음. |
| maintainability | NONE | 신규 코드 없어 전통적 품질 지표 해당 없음. 통계 3중복·plan/complete 참조·이중편집 동기화 모두 INFO 수준, 값 자체는 현재 일치. |
| testing | LOW | `codebase/**` 변경 0건(N/A). harness 전체 스위트 `python3 -m pytest .claude/tests -q` 1175 passed 실측 확인. checklist 문구 비가드(INFO)만 잔존. |
| documentation | LOW | WARNING(plan/complete forward-reference) + 백필 사실관계(PR 번호·마이그레이션·.conf 설정) 전수 대조 일치 확인. |

## 발견 없는 에이전트

없음 — 전원(7명) 이 최소 1건 이상의 INFO/WARNING 을 보고했다(순수 "문제 없음" 확인 항목 다수 포함).

## 권장 조치사항
1. **(WARNING 해소, 병합 전 필수)** `CHANGELOG.md:3` 의 `plan/complete/changelog-criteria.md` 참조를 실제 위치로 낮추거나, 이번 세션에서 plan 의 남은 두 체크박스(`/ai-review`, "트래커 항목 닫기 + 재판정 후보 등재")를 완료하고 실제로 `plan/complete/` 로 이동하는 마무리 커밋까지 마친 뒤 병합한다.
2. `plan/in-progress/changelog-criteria.md` `## C. 검증`에 "plan 을 `plan/complete/` 로 이동" 체크리스트 항목을 명시적으로 추가해 다음에도 같은 forward-reference 실수가 재발하지 않게 한다.
3. 커밋 전 `review/consistency/2026/09/25/12_52_34/_retry_state.json` 을 실제 완료 상태(`agents_success` 5개)로 갱신하거나, fallback 경로가 이 파일을 쓰지 않도록 스킬 문서에 명시한다.
4. (후속, 이번 PR 비필수) `documentation` 리뷰어 checklist 관점 6 문구의 SSOT(`role_instructions.py`)↔렌더링(`documentation-reviewer.md`) byte-parity 를 지켜주는 선택적 테스트 추가를 검토한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명)
  - **제외**: 아래 표 (7명) — 이번 diff 가 `codebase/**` 런타임 코드·인프라·DB·동시성·API 계약을 건드리지 않는 문서/plan/harness-config 전용 변경이라 해당 관점이 비적용으로 판단됨
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, ran 목록과 동일 — forced 전원 결과 확보됨, 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 실행 코드/쿼리 변경 없음 — 성능 관점 비적용 |
  | architecture | 시스템 아키텍처·모듈 구조 변경 없음 |
  | dependency | `package.json`/lockfile 변경 없음 |
  | database | SQL/마이그레이션 신규 실행 없음(과거 마이그레이션 문서 백필만) |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 아님(내부 CHANGELOG·harness 리뷰어 지침) |
