# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — CRITICAL/WARNING 0건. 테스트 전용 리팩터(`plan/in-progress/e2e-race-helper.md`, `spec_impact: none`)가 `spec/5-system` 과 실질 충돌 없음을 5개 checker 모두 확인. 발견된 것은 전부 이번 diff 와 무관한 기존 문서 편차 또는 완료 시점에 처리하면 되는 plan 간 미러링 사소 항목(INFO).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | 부모 tracker(`spec-draft-nullable-notation-followups.md:5054-5055`)가 `integration-rotate-concurrency` 를 아직 "별도 판단 필요(미결)"로 서술 — 자식 plan(`e2e-race-helper.md` §B)은 이미 실측(single-fire·update-merge 구조 확인)으로 "제외 확정"까지 내림. 해소 방향은 일치, 미러링만 지연 | `plan/in-progress/spec-draft-nullable-notation-followups.md:5054-5055` vs `plan/in-progress/e2e-race-helper.md` §B | `e2e-race-helper.md` 체크리스트의 "트래커 항목 해소" 집행 시 같은 커밋에서 tracker 5054-5055 줄을 "제외 확정"으로 정정. 착수를 막을 사안 아님 |
| 2 | plan_coherence | 헬퍼 시그니처가 tracker 초안(`fire: () => Promise<T>` 단일 콜백)에서 `fires: Array<() => Promise<T>>` 배열로 변경됨 — 실측 근거(webauthn 둘째 블록이 서로 다른 thunk 두 개를 발사) 동반한 정당한 개정 | `plan/in-progress/spec-draft-nullable-notation-followups.md:5043-5050` vs `e2e-race-helper.md` §B | 완료 커밋에서 tracker 스케치도 최종 `fires` 배열 시그니처로 함께 갱신 (다음 사람이 낡은 단일-콜백 스케치를 참조하지 않도록) |
| 3 | plan_coherence | `spec/5-system/3-error-handling.md` §1.11 "이 저장소에서 유일한 예외다" 서술이 이미 실측으로 반증(`WEBAUTHN_CREDENTIAL_NOT_FOUND` 가 두 번째 예외)됐으나 아직 미정정 — 이번 plan 과 무관한 기존 drift, 별도 planner 항목으로 이미 등재됨 | `spec/5-system/3-error-handling.md` §1.11; 추적: `plan/in-progress/spec-draft-nullable-notation-followups.md:4997-5027` | 조치 불요 (별도 planner 턴 대기 중인 정상 미결 상태 — 이번 게이트 대상 아님). 재-flag 방지용 참고 |
| 4 | convention_compliance | `spec/5-system` 4개 파일(`5-expression-language.md`·`7-llm-client.md`·`11-mcp-client.md`·`16-system-status-api.md`)이 `## Overview` 대신 `## 1. 개요`(또는 헤딩 없음) 사용 — SKILL.md 의 3섹션 구성은 "권장"이라 위반 등급 아님, 오래된 기존 편차 | `spec/5-system/{5-expression-language,7-llm-client,11-mcp-client,16-system-status-api}.md` | 조치 필요 시 project-planner 턴에서 헤딩 텍스트만 `## Overview` 로 통일(내용 이동 불요). 이번 test-only PR 범위 아님 |
| 5 | convention_compliance | `spec/5-system` 디렉터리에 다른 다중파일 영역(`2-navigation`·`3-workflow-editor`·`4-nodes`·`data-flow` 등)과 달리 `0-*.md` 진입 파일이 없음(`1-auth.md` 부터 시작) | `spec/5-system/` (파일 `1-auth.md`가 사실상 시작점) | 오래된 구조적 선택, 이번 diff 와 무관. 강제할지 여부는 SKILL.md 의 "0- prefix" 규칙 표현을 먼저 명확화한 뒤 별도 project-planner 판단 |
| 6 | cross_spec | 컨텍스트 예산 초과로 `spec/5-system` 15개 파일(`4-execution-engine.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md` 등) 본문이 assembled 프롬프트에서 생략됨 | 프롬프트 조립 결과 §"컨텍스트 예산 초과로 생략된 파일 15개" | 조치 불요 — 이번 작업 도메인(auth/audit-log/RBAC/error-handling)은 전문 확보됨. 생략된 15개 파일을 직접 변경하는 후속 작업이 있으면 그때 별도로 `Read` 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 감사 액션명·RBAC 매트릭스·에러 코드 3축 전부 `1-auth.md`/`2-api-convention.md`/`3-error-handling.md`(전문 확보) 대비 정합. 예산 초과로 생략된 15개 파일은 이번 작업 범위 밖(INFO) |
| rationale_continuity | NONE | 기각된 대안 재도입·원칙 위반·무근거 번복·invariant 충돌 4관점 모두 미검출. 유일한 시그니처 번복(`fire`→`fires`)은 실측 근거와 함께 즉시 재-Rationale 화되어 형식 요건 충족 |
| convention_compliance | LOW | 위반 0건. 감사 액션·에러 코드·frontmatter 규약 정합 확인. Overview 헤딩 표기 편차·`0-` 진입 파일 부재는 "권장" 수준 기존 편차(INFO) |
| plan_coherence | LOW | 선행조건(9자리 동시삭제 결함 완료, git 이력 확인)·착수 게이트 두 결정(헬퍼 추출/`isDeleteMiss()` 미추출) 모두 근거와 함께 확정. 부모 tracker 미러링 지연 2건 + 무관한 기존 §1.11 drift 1건은 INFO |
| naming_collision | NONE | 신규 식별자는 `raceUnderHeldLock()`/`locker`/`lock`/`fires` 뿐이며 전수 grep 0건(미도입), 기존 helper export·e2e 지역 변수명과 충돌 없음. spec 차원 신규 식별자 없음(요구사항 ID/엔티티/endpoint/이벤트/env/파일경로 전부 해당 없음) |

## 권장 조치사항
1. BLOCK 없음 — `plan/in-progress/e2e-race-helper.md` 착수를 막을 사유 없음.
2. `e2e-race-helper.md` 완료 커밋 시 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `integration-rotate-concurrency`(5054-5055줄) 서술을 "제외 확정"으로, 헬퍼 시그니처 스케치(5043-5050줄)를 최종 `fires` 배열로 함께 정정.
3. (선택, 별도 project-planner 턴) `spec/5-system` 4개 파일 Overview 헤딩 통일 — 이번 PR 범위 아님.
4. `3-error-handling.md §1.11` "유일한 예외" 오기술은 이미 등재된 별도 planner 항목이므로 이번 턴에서는 조치 불요, 재-flag 만 방지.
