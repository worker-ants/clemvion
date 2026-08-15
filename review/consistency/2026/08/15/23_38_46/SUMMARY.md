# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원에서 CRITICAL 0건, WARNING 0건. 발견된 항목은 모두 INFO(참고) 등급이다.

> 참고: fan-out 결과 헤더에는 `cross_spec` 이 `no_status` 로 기록됐으나, 세션 디렉토리에서 `cross_spec.md` 실 파일을 직접 Read 한 결과 파일 1행에 `STATUS=success` 가 명시돼 있고 본문도 완결돼 있어(전문 확보) 재시도 불요로 판단했다. 5개 checker 파일 전부 디스크에 이미 존재함을 확인(`ls` 실측) — 이번 라운드에서 누락 파일 영속화(Write)는 필요하지 않았다.

## 전체 위험도
**LOW** — target(`plan/in-progress/spec-draft-ws-types-canonical-location.md`)은 이미 구현된 `websocket-events.types.ts` 로 정본 소재가 옮겨간 사실을 spec 7곳 + `§4.4` 1곳에 반영하는 포인터 교정 draft. 5개 관점 전건 실측(라인·심볼·경로 대조) 결과 CRITICAL/WARNING 없음, 이전 라운드(`23_28_47`) 지적 3건(frontmatter 누락 CRITICAL 1 + WARNING 1 + INFO 1)도 모두 해소 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | §4.4 신규 문단의 "ES-module 그래프" 표현이 기존 forwardRef 표의 "(ES-module 순환 봉인)" 라벨과 어휘가 겹쳐 축 구분이 흐려질 수 있음(실제로는 서로 다른 실패 모드: DI 인스턴스화 순서 vs 모듈 평가 시점 값 undefined) | `spec/5-system/4-execution-engine.md` §4.4, 체크리스트 항목 ⑧ | 신규 문단에 "forwardRef 표의 'ES-module 순환 봉인'은 DI 인스턴스화 순서 문제, 본 문단은 모듈 평가 시점 undefined 문제로 서로 다른 실패 모드" 한 줄 추가(필수 아님) |
| 2 | rationale_continuity | 신규 "축이 다른 세 번째 완화책" 문단이 하단 `## Rationale` 이 아니라 본문 `§4.4` 인라인에 착지 — 다만 해당 섹션 자체가 이미 본문-인라인 결정+근거 패턴(기존 특성)이라 신규 위반은 아님 | 체크리스트 항목 ⑧ 착지점 절 | 조치 불요. 향후 §4.4 전체를 표준 패턴(본문 요약 + 근거는 하단 Rationale)으로 리팩터할 기회가 있으면 이 문단도 함께 이관 |
| 3 | convention_compliance | plan 문서(`spec-draft-ws-types-canonical-location.md`) frontmatter 의 `pending_plans:` 키가 `spec/conventions/spec-impl-evidence.md §2.1` 이 정의한 spec-레벨 의미("책임 plan")와 다른 의미(plan-레벨 "선행 plan")로 재사용됨 — 금지 위반은 아니나(top-level plan frontmatter 추가 필드 허용) 반복되는 로컬 관행(자매 문서 `spec-draft-eia-notification-payload-contract.md` 도 동일 패턴) | frontmatter 라인 30~31 | `.claude/docs/plan-lifecycle.md §4` 또는 project-planner SKILL.md 에 plan-레벨 `pending_plans:`(선행/의존) 를 spec-레벨 `pending_plans:`(책임) 와 구분해 짧게 문서화 |
| 4 | plan_coherence | "선행 plan 닫기" 체크리스트 항목이 대응 체크박스를 명시 열거하지 않음 — target 변경이 실제로는 `ws-event-types-extract.md` §후속의 두 하위 섹션(`planner 턴` 7건 + `그 밖` 2건 = 총 9개 체크박스)에 대응하는데 이를 뭉뚱그려 "대응 항목 체크"로만 서술 | target §체크리스트 "선행 plan 닫기" 항목 | "『후속』의 `planner 턴` 7건 + `그 밖`의 frontmatter `code:`/§4.4 Rationale 2건 = 총 9개 체크박스" 로 명시 나열 (실질 누락은 아님, 표현 정밀도 문제) |
| 5 | plan_coherence | 선행 plan `ws-event-types-extract.md` 자신의 최상위 체크리스트("push 게이트 통과 → PR")가 미체크 상태로 stale — 실측 결과 `#1175`(commit `c6dd5cb89`)는 이미 `origin/main` ancestor 이고 코드도 실재해 선행 조건은 이미 해소됨 | `plan/in-progress/ws-event-types-extract.md` 체크리스트 | target 범위 아님(그 plan 은 `owner: developer` 소유). 다음에 그 plan 을 여는 세션이 체크리스트를 실제 상태로 갱신 + `plan/complete/` 이동 검토 |
| 6 | naming_collision | `NotificationEventType` 동명 충돌(WS 알림 벨 enum ↔ webhook 구독 whitelist)이 이미 실재 — target 은 이 이름을 다루지 않고 스스로 "범위 밖 — 별도 백로그"로 명시 배제함 | `codebase/backend/src/modules/websocket/websocket-events.types.ts:219` vs `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:28` | 조치 불요. target 이 신설·악화시키지 않음을 확인하는 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 7곳 인용문 + §4.4 삽입 지점 전건 실측 일치. 데이터 모델/API 계약/요구사항 ID/상태 전이/RBAC/계층 책임 6관점 모두 충돌 없음 |
| rationale_continuity | LOW | 과거 결정(forwardRef/ModuleRef 축소 유예, C-1 strangler-fig) 번복 없음. "ES-module 순환" 어휘 중의성만 INFO |
| convention_compliance | LOW | 이전 라운드 CRITICAL 1 + WARNING 1 + INFO 1 전건 해소 재확인(`plan-frontmatter.test.ts` 169/169 PASS 실행 확인). 신규 위반 없음, plan `pending_plans:` 의미 중복만 INFO |
| plan_coherence | LOW | 선행 plan 과 1:1 매핑 확인, 전제 사실(#1175 머지)·인용 라인 7+1곳 전건 stale 없음. 체크리스트 표현 정밀도만 INFO |
| naming_collision | NONE | 신규 식별자(요구사항 ID/엔티티/endpoint/이벤트/ENV/경로) 미도입. 기존 `NotificationEventType` 충돌은 target 이 건드리지 않고 이미 별도 백로그로 위임됨 |

## 권장 조치사항
1. (BLOCK 사유 없음 — 즉시 조치 불요) target 은 현재 상태로 push/진행 가능.
2. (선택, 품질 개선) rationale_continuity #1: §4.4 신규 문단에 "forwardRef 표의 'ES-module 순환 봉인'(DI 인스턴스화 순서) vs 본 문단(모듈 평가 시점 undefined)은 다른 실패 모드" 한 줄 추가.
3. (선택, 규약 정비) convention_compliance #3: `.claude/docs/plan-lifecycle.md §4` 에 plan-레벨 `pending_plans:` 용법을 spec-레벨 용법과 구분해 문서화 — 반복되는 로컬 관행이므로 규약 갱신 검토.
4. (선택, 표현 정밀도) plan_coherence #4: target 체크리스트의 "선행 plan 닫기" 항목에 대응 체크박스 9개를 명시 나열.
5. (target 범위 밖, 별도 세션) plan_coherence #5: `ws-event-types-extract.md` 를 다음에 여는 세션(owner: developer)이 체크리스트를 실제 머지 완료 상태로 갱신 + `plan/complete/` 이동 검토.