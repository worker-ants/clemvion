# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 spec/plan 문서 changeset(`codebase/**` 변경 없음). Critical 0건. WARNING 2건은 모두 이번 changeset 의 부수 산출물(체크리스트 완결성·동봉 consistency-check SUMMARY 의 checker 귀속) 정확도 문제이며, spec/코드 본체의 사실관계 자체는 7개 reviewer 전원이 코드 실측으로 독립 검증해 정확함을 확인했다. forced whitelist 7명 전원 결과 확보됨(누락 없음) — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation, requirement | 체크리스트 "sibling `node-output-redesign/form.md:154` 에 D1 재검토 각주 + developer 후속 task 등록 (WARNING 3)" 이 `[x]` 완료로 표시됐으나, 실제 diff 는 인라인 각주 1개뿐이며 구조화된 추적 항목(신규 backlog 항목, `form.md` 자신의 `## 종합 개선안` 체크리스트에 `- [ ]` 추가 등)은 생성되지 않음. `plan_coherence.md` checker 가 사전에 정확히 같은 갭을 지적했었음("최소한 각주"를 최소 대안으로 제시) | `plan/in-progress/presentation-thread-optout-drift.md`(체크리스트 4번째 항목, `:56-59`, `:70`), `plan/in-progress/node-output-redesign/form.md:156-161` | 체크리스트 문구를 실제 산출물("각주만 추가, 구조화 task 등록은 별도")에 맞게 정정하거나, `node-output-redesign/form.md` `## 종합 개선안` 섹션에 `- [ ] (impl) form.handler.ts:44 의 { ...rawConfig } spread → 명시 enumeration 전환 (D1, 2026-07-23 재발견)` bullet 을 실제로 추가해 문구와 산출물을 일치시킨다 |
| 2 | requirement | 동봉된 `review/consistency/2026/07/23/19_48_09/SUMMARY.md` 의 WARNING #1 테이블 행이 `convention_compliance` 를 공동 제기 checker 로 귀속했으나, 그 checker 는 §2.4 관련 주제를 `[INFO]` 로만 평가(유일한 `[WARNING]`은 완전히 다른 주제). 같은 SUMMARY 파일 안에서 "WARNING 테이블"(`:16`)과 "Checker별 위험도 표"(`:37`)가 서로 모순 | `review/consistency/2026/07/23/19_48_09/SUMMARY.md:16` vs `:37`, `convention_compliance.md:7,46` | WARNING #1 행의 Checker 열에서 `convention_compliance` 제거(`cross_spec, rationale_continuity` 만 남김) 또는 두 표가 일치하도록 재집계. `presentation-thread-optout-drift.md` 는 WARNING 번호·pin 내용만 재인용하고 checker 귀속은 재인용하지 않아 실제 처리 방향엔 영향 없으나, 향후 재집계 시 오귀속이 그대로 물려받아질 위험 예방 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, scope | `plan_coherence.md` 에만 subagent 프로토콜 헤더(`STATUS=success ... / ===REPORT_MARKDOWN_BELOW===`)가 본문에 그대로 커밋됨 — 형제 checker 파일 4개(`cross_spec.md` 등)는 순수 markdown 만 시작. harness 산출 경로의 자잘한 결함으로 추정, 이번 작업이 새로 만든 결함 아님 | `review/consistency/2026/07/23/19_48_09/plan_coherence.md:1-2` | 필수 아님. 이 파일을 후속 자동 재집계가 소비할 경우 첫 2줄 스킵 로직 확인 권고 |
| 2 | documentation | 신규 대칭 각주 두 곳(§4.6→§2.4, §2.4→§4.6)이 특정 절을 가리키면서 `#fragment` 앵커를 생략 — 같은 문서군의 다른 20여 개 절 참조는 전부 앵커를 붙이는 관례 | `spec/4-nodes/6-presentation/0-common.md:167`, `spec/conventions/conversation-thread.md:194` | `#24-opt-out` 등 실제 slug 로 앵커 추가해 기존 관례와 통일 |
| 3 | maintainability | `0-common.md §4.6` 이 `## 4.6`(h2)로 선언돼 형제 서브섹션 `### 4.1`/`### 4.2`(h3)와 헤딩 레벨이 어긋남 — 이번 대폭 재작성에도 정정하지 않고 넘어감(plan 이 "앵커 파손 위험이 이득보다 큼"으로 의도적 defer 기록) | `spec/4-nodes/6-presentation/0-common.md:153` | 지금 조치 불요. §4.6 이 다음에 편집될 때(예: schema 필드 실제 추가 시) 함께 정정 |
| 4 | maintainability | "`appendInternal` 게이트는 노드 종류 무관 공통 적용"이라는 같은 규범 문장이 두 spec 파일에 각자 표현으로 근접 중복 서술 — 교차 링크는 있으나 적용 범위가 나중에 바뀌면 양쪽 다 손으로 동기화해야 함(이번 plan 자체가 그런 종류의 drift 를 정정하는 작업이었음을 감안하면 재발 여지가 남음) | `spec/4-nodes/6-presentation/0-common.md:167`, `spec/conventions/conversation-thread.md:190-191` | 강한 조치 불요. 한쪽을 "SoT는 저쪽, 여기는 요약만"으로 명시해 단방향 참조로 정리하면 유리 |
| 5 | maintainability | 신규 plan 파일명(`presentation-thread-optout-drift.md`)이 선행 plan(`presentation-previousoutput-spec-drift.md`, `-spec-` 포함)과 접미사 패턴이 다름 — `naming_collision.md` INFO #3 과 동일 사실, target 스스로 "세 번째 발생 시 통일 고려"로 명시적 defer | `plan/in-progress/presentation-thread-optout-drift.md`(파일명) | 조치 불요(의도적 defer). 세 번째 `presentation-*-drift.md` 발생 시 재검토 |
| 6 | maintainability | `form.md` 의 Principle 0–11 순번 목록 중간에 번호 없는 D1 경고 콜아웃이 삽입돼 Principle 7(raw echo 결론)과 상반되는 재평가가 목록 흐름과 분리돼 있어, 훑어보기만 하면 놓칠 여지가 약간 있음 | `plan/in-progress/node-output-redesign/form.md:156-161` | 경미, 차단 대상 아님. 후속 편집 때 Principle 7 항목 본문에 인라인 backref 추가 고려 |
| 7 | scope | `node-output-redesign/form.md` D1 각주는 본 plan(`presentation-thread-optout-drift`, §4.6 opt-out) 표제와 다른 sibling plan/다른 주제(§7 D1 config echo)에 대한 cross-file 편집이나, `presentation-thread-optout-drift.md` 의 WARNING 3 처리 항목으로 명시적으로 계획·체크리스트화된 범위라 "의도 이상"은 아님 | `plan/in-progress/node-output-redesign/form.md:156-161` | 조치 불요(근거 명시됨). 향후 유사 사례는 커밋 메시지에 "WARNING N 해소용 cross-plan 각주" 한 줄 명시 권고 |
| 8 | testing | D1 위반(`form.handler.ts` 의 `{ ...rawConfig }` spread) 후속 수정에 대한 구체적 테스트 계획이 아직 없음 — 이번 diff 범위 밖. 실측 결과 이미 명시 enumeration 을 쓰는 sibling(`carousel.handler.ts` `configEcho`)조차 "비열거 필드가 걸러지는지" 회귀 테스트가 없어(assertion 0건) 참고할 테스트 패턴 자체가 sibling 에도 부재 | `plan/in-progress/node-output-redesign/form.md:156-161`, `plan/in-progress/presentation-thread-optout-drift.md:56-59,70` | developer 후속 task 등록 시, 수정 자체뿐 아니라 "enumeration 안 된 credential-shaped 키가 output/config 에 echo 되지 않는다"를 assert 하는 회귀 테스트를 `form.handler.spec.ts`에 추가하도록 명시하고, 가능하면 `carousel.handler.spec.ts` 등 sibling 에도 소급 적용 권고 |
| 9 | testing | `form.handler.spec.ts` 의 `rawConfig`↔`config` 분리 unit 테스트 공백(체크리스트에 이미 추적 중)이 이번 diff 로 재차 노출됐으나 상태 변화 없음 — 신규 결함 아님 | `plan/in-progress/node-output-redesign/form.md:169-171,188` | 신규 조치 불요. developer 착수 시 우선순위 목록 포함 여부만 재확인 |
| 10 | side_effect | consistency-check 세션 아티팩트(`_retry_state.json`, `meta.json`)에 세션 실행 당시의 로컬 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/...`)가 하드코딩되어 커밋됨 — 다른 머신/CI 에서는 비휴대적, harness 표준 산출물이며 본 PR 이 새로 도입한 패턴 아님 | `review/consistency/2026/07/23/19_48_09/_retry_state.json`, `meta.json` | 조치 불요(기존 harness 관례). 필요 시 harness 차원 상대경로화를 별도 backlog 로 고려 |
| 11 | documentation, testing | 확인용(문제 아님) — D1 각주의 `node-output.md §7 D1` 인용, 그리고 "게이트는 노드 종류 무관" spec 주장 모두 코드/기존 회귀 테스트(`conversation-thread.service.spec.ts:112`, 기본 노드 타입 `'form'`)와 정확히 부합함을 직접 대조 검증 | `spec/conventions/node-output.md:320`, `codebase/backend/.../conversation-thread.service.spec.ts:112` | 조치 불요. spec 본문에 해당 테스트를 명시 인용하면 향후 리팩터링 시 추적 용이 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | LOW | 체크리스트 과장 주장(WARNING), fragment anchor 생략(INFO), D1 인용 검증 완료(INFO) |
| requirement | LOW | 요구사항 자체는 코드 실측 전수 검증·정확. SUMMARY.md checker 귀속 모순(WARNING), 체크리스트 과장(WARNING), plan_coherence.md 헤더 잔존(INFO) |
| scope | LOW | 스코프 위반 없음. D1 각주 cross-plan 편집(INFO, 근거 있음), plan_coherence.md 헤더 잔존(INFO) |
| maintainability | LOW | 코드 없음(N/A). 헤딩 레벨·근접 중복 서술·파일명 패턴·콜아웃 흐름 4건 모두 INFO, 대부분 기존 인지·defer 사안 |
| security | NONE | 코드 변경 없음, 보안 표면 없음. D1 spread 이론적 유출 경로는 개발 스코프 분리 확인(INFO) |
| side_effect | NONE | 실행 코드 변경 없음. spec 주장 vs 코드 대조 전부 일치. JSON 아티팩트 로컬 경로 하드코딩(INFO) |
| testing | NONE | 코드/테스트 파일 변경 없음. 신규 spec 주장은 기존 회귀 테스트로 뒷받침 확인. D1 후속 테스트 계획 부재·기존 테스트 공백 재노출(INFO) |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 발견 있음, 다만 security/side_effect/testing 은 위험도 NONE — 실질적 결함 없이 확인/맥락 제공 성격).

## 권장 조치사항

1. `presentation-thread-optout-drift.md` 체크리스트의 "developer 후속 task 등록" 항목을 실제 산출물과 일치시킨다 — `node-output-redesign/form.md` `## 종합 개선안`에 D1 위반 추적용 `- [ ]` bullet 을 실제로 추가하거나 체크리스트 문구를 "각주만 추가"로 정정 (WARNING #1).
2. `review/consistency/2026/07/23/19_48_09/SUMMARY.md` 의 WARNING #1 테이블 행에서 `convention_compliance` checker 귀속을 정정(제거 또는 재집계)해 SUMMARY 내부 자기모순을 해소한다 (WARNING #2).
3. (선택) 신규 상호참조 두 건에 fragment anchor 추가, `plan_coherence.md` 의 subagent 헤더 스트립 여부 확인 — 둘 다 비차단 정밀도 개선.
4. (향후 developer 착수 시) `form.handler.ts` D1 위반(spread→enumeration) 수정 시 credential-shaped 필드 미유출을 assert 하는 회귀 테스트를 함께 추가.

## 라우터 결정

- **라우팅 상태**: `fallback-distrusted-decision` — 라우터의 선별 판단을 신뢰할 수 없어 fallback 으로 전체 reviewer 를 강제 실행.
- **실행**: `documentation, requirement, scope, maintainability, security, side_effect, testing` (7명, 전원)
- **제외**: 없음
- **강제 포함(router_safety)**: `documentation, requirement, scope, maintainability, security, side_effect, testing` (7명 전원) — 전원 결과 확보됨(누락 없음).

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |