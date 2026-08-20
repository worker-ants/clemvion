# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전부 CRITICAL 없음. WARNING 2건 · INFO 5건만 확인.

## 전체 위험도
**LOW** — `Execution.inputData` egress 마스킹 카브아웃 폐지는 데이터 모델·API 계약·plan·명명 축 전부 정합. `CHANGELOG.md` 가 이미 폐기된 중간 판정 로직을 서술하는 stale 1건(WARNING)과, 이 checker 자신의 입력 프롬프트가 diff 본체를 예산 초과로 누락했다는 프로세스 이슈(WARNING) 만 남았다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity (+ convention_compliance 중복 지적, INFO로 관측) | 같은 PR 안에서 두 번 좁혀진 차단 판정("값 비었는가"→"건드렸는가"→"건드렸고 AND 현재 값에 마커 없음") 중 이미 리뷰(`14_44_08` W2)에서 폐기된 중간 단계("터치 단일조건")를 `CHANGELOG.md` 가 여전히 최종본처럼 서술 | `CHANGELOG.md` L19 "Unreleased — `Execution.inputData` 카브아웃을 닫았다" 절 (spec/5-system/ 자체는 정확, 어긋난 건 CHANGELOG 뿐) | `spec/5-system/14-external-interaction-api.md` §R17 잔여② "닫는 조건" 표 · `spec/5-system/13-replay-rerun.md` §10.2 · `plan/in-progress/eia-inputdata-marker-guard.md` L125 (전부 AND-조건으로 최종화됨) | `CHANGELOG.md` L19 문단을 "차단 판정은 터치 여부와 현재 값의 마커 부재를 함께 본다 — 단일 축은 각각 타입 캐스팅/마커 되돌리기로 뚫린다" 로 갱신 |
| 2 | convention_compliance | checker 자신에게 주어진 프롬프트 번들에서 `<git diff origin/main...HEAD -- code_areas>` 자체가 컨텍스트 예산 초과로 생략됨 — 프롬프트만 따랐다면 코드 변경을 전혀 못 보고 판정했을 것 (이번엔 프롬프트 지시대로 워킹트리를 절대경로로 직접 열어 우회 확인함) | `_prompts/convention_compliance.md` §"컨텍스트 예산 초과로 생략된 파일 13개" 목록 (target 문서 자체의 결함 아님, 프로세스 신뢰성 문제) | 기존 알려진 결함 클래스 `feedback_consistency_spec_mode_budget.md` (conventions 통째 탈락)와 동일 계열, 이번엔 diff 본체가 탈락 | orchestrator 가 (a) diff 를 conventions 목록보다 예산 우선순위 상위에 두거나 (b) 생략 목록에서 `<git diff ...>` placeholder 를 다른 파일들과 섞지 말고 별도 강조 표시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | R-5 인용 계보가 2홉(WS §4.1 → EIA §R17 → 실행내역 R-5)을 거치며 원 출처의 스코프 caveat("R-5 의 직접 대상은 Config 탭")이 가려짐. 결론 자체는 매 단계 타당 | `spec/5-system/6-websocket-protocol.md` §4.1 값-패턴 마스킹 캐비엇 | 급하지 않음 — 다음에 이 인용부를 만질 때 "원 출처 [실행 내역 R-5]" 처럼 한 홉 더 명시 |
| 2 | rationale_continuity | `RR-PL-02`(원본 프리필 기본값) 절에 §10.2 마커 예외 캐비엇으로의 상호 링크 부재. 전면 번복 아니라 별도 Rationale 불요 판단에는 동의하나 RR-PL-02 만 읽으면 예외 존재를 모름 | `spec/5-system/13-replay-rerun.md` §RR-PL-02 vs §10.2 | RR-PL-02 말미에 "단, 값이 마스킹 마커인 경우 §10.2 참조" 1행 추가 검토 |
| 3 | plan_coherence | `eia-inputdata-marker-guard.md`·`spec-draft-inputdata-egress-masking.md` 두 plan 이 여전히 `status: in-progress`이고 체크리스트 마지막 항목("`/ai-review` → `--impl-done` → push")이 미완 — 이 호출 자체가 그 항목 실행 중이라 예상된 상태 | plan 메타 (target 밖) | 조치 불요 — push 직전 체크리스트 체크 + status 전환 |
| 4 | cross_spec (기존 트래커 등재분 반복) | `Execution.inputData` 응답 의미 반전(마스킹 없음→있음)은 OpenAPI 스키마로 드러나지 않는 콘텐츠 계약 변경이라 저장소 밖 소비자(QA/감사 export)가 스키마로 감지 불가 | `spec/5-system/14-external-interaction-api.md` | 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "외부 소비자 확인" 항목 등재 — 재등재 불요 |
| 5 | cross_spec (기존 트래커 등재분 반복) | 마커 감지 가드는 UI 정상 흐름 전용, 서버측(`inputOverride`)은 마커 리터럴 거부 안 함. §R17 "닫는 조건"이 처음부터 프런트-only 로 범위 명시 | `spec/5-system/14-external-interaction-api.md` §R17 | 이미 트래커에 "inputOverride 서버측 마커 리터럴 거부" 별건 등재 — 이번 PR 비차단 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 7개 spec 문서(§R17/data-model/websocket/replay-rerun/webhook/background/execution)가 같은 날짜·같은 결론으로 동기화 확인. 신규 모순 없음, INFO 2건은 이미 트래커 등재분 반복 |
| rationale_continuity | LOW | §R17 카브아웃 폐지 자체는 모범적 rationale 연속성. `CHANGELOG.md` stale 서술 WARNING 1건 + 인용 계보/cross-link INFO 2건 |
| convention_compliance | LOW | 명명·출력포맷·문서구조·frontend-layering 전부 준수. 프롬프트 diff 누락(프로세스) WARNING 1건 + CHANGELOG INFO(rationale_continuity와 중복) |
| plan_coherence | NONE | 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 전부 없음. INFO 1건은 조치 불요 |
| naming_collision | NONE | 신규 식별자(엔티티/i18n/파일경로) 6개 축 전수 재스캔, 충돌 없음. 직전 라운드 WARNING/INFO 해소 확인 |

## 권장 조치사항
1. `CHANGELOG.md` L19 문단을 최종 AND-조건("건드림 AND 현재 값에 마커 없음")으로 갱신 — spec/plan 과 표현 일치.
2. (프로세스, 비차단) orchestrator: consistency-check 예산 산정 시 diff 본체를 conventions 목록보다 우선순위 상위에 두거나, 생략 목록에서 diff placeholder 를 별도 강조.
3. (급하지 않음) `spec/5-system/13-replay-rerun.md` RR-PL-02 절에 §10.2 cross-link 1행 추가.
4. (급하지 않음) `spec/5-system/6-websocket-protocol.md` §4.1 R-5 인용부에 원 출처 스코프 caveat 명시 보강.
5. push 직전 `plan/in-progress/eia-inputdata-marker-guard.md` 체크리스트 마지막 항목 체크 + status 전환.