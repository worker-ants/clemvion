# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 이번 diff(`spec/data-flow/` scope, diff-base=`origin/main`)는 spec 을 한 줄도 바꾸지 않고 `execution-engine.service.ts` 의 `updateExecutionStatus` JSDoc 주석(호출부·트랜잭션 블록 재검증 수치 정정)만 변경한다. 5개 checker 전원 Critical 없음(cross_spec LOW, 나머지 4개 NONE). cross_spec 이 이번 diff 와 무관한 **기존** WARNING 2건을 spec 스냅샷 감사 중 발견했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 계정 잠금(로그인 5회 실패) 시 이메일 알림 여부가 두 spec 영역에서 다름 — `data-flow/2-auth.md`(§3.2, §2.3)+실코드(`mail.service.ts`, `auth.service.ts`)는 알림 없음으로 일치, `5-system/1-auth.md` §1.1 표만 "이메일 알림" 요구 | `spec/data-flow/2-auth.md` §3.2/§2.3 | `spec/5-system/1-auth.md` §1.1 표 | `5-system/1-auth.md` §1.1 표에서 "이메일 알림" 문구 제거(또는 알림을 원하면 별도 구현 티켓+data-flow 갱신). project-planner 턴 필요(제품 요구사항 텍스트라 developer 자기반증 예외 대상 아님) |
| 2 | cross_spec | `alert_rule`(V016) 엔티티가 데이터 모델 SoT 문서에 부재 — 컬럼 정의가 `data-flow/9-observability.md` §2.1 에만 있고 `1-data-model.md` 에는 없음 | `spec/data-flow/9-observability.md` §2.1 | `spec/1-data-model.md` §2 (엔티티 섹션 부재) | `1-data-model.md` §2 에 `AlertRule`(V016) 엔티티 섹션 신설, `data-flow/9-observability.md` §2.1 은 발췌로 축약. project-planner 턴 필요 |

이 2건 모두 이번 PR 의 diff(주석 정정)가 유발한 것이 아니라 target 으로 번들된 `spec/data-flow/` 전체 스냅샷을 다른 spec 영역과 대조하는 과정에서 드러난 **기존** 상태이며, `plan/**` 어디에도 추적되지 않는다(cross_spec 확인). BLOCK 사유는 아니나 별도 planner 턴에서 처리할 백로그로 남긴다.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | JSDoc 이 가리키는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 경로가 향후 plan 이 `complete/`(또는 `archive/from-*/`)로 이동하면 stale 해질 수 있음 | `execution-engine.service.ts` `updateExecutionStatus` JSDoc | plan 이동 시 JSDoc 참조 경로 동반 갱신, 또는 장기적으로 이력 요약을 `spec/5-system/4-execution-engine.md` `## Rationale`(이동하지 않는 안정 SoT)로 옮기는 것 고려. 차단 사유 아님 |
| 2 | convention_compliance | `spec/data-flow/0-overview.md` 의 `0-` prefix — CLAUDE.md 표만 보면 루트 전용처럼 읽히나, `spec-impl-evidence.md:53` 이 영역 폴더 진입 문서의 `0-` prefix 를 면제 basename 으로 명시 등재해 기확립된 정식 패턴임 확인 | `spec/data-flow/0-overview.md` | 조치 불요. 향후 checker 오탐 방지용 기록 |
| 3 | convention_compliance | diff(JSDoc)가 다루는 `updateExecutionStatus` self-deadlock 서술은 `spec/data-flow/3-execution.md` 책임 범위 밖(SoT 는 `conventions/node-cancellation.md` §2.4 + plan 문서) | `spec/data-flow/3-execution.md` | 조치 불요 |
| 4 | plan_coherence | JSDoc 수치 정정(11→20→36, 어휘적→호출 스택)이 `plan/in-progress/backend-lint-gate-broken-on-main.md` L289-306 표와 숫자·서사 1:1 일치, 자매 plan(`update-returning-tuple-shape.md`)에도 교차 포인터 갱신됨 | `execution-engine.service.ts` JSDoc / plan L289-306 | 조치 불요. 추적 메모 — 향후 호출부·트랜잭션 블록 증가 시 재대조하고 같은 plan 표에 이어 적을 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 무변경 확인. 기존 WARNING 2건(계정 잠금 이메일 알림 불일치, `alert_rule` SoT 부재) 발견 — 이번 diff 유발 아님 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복 없음. plan 경로 참조 안정성 INFO 1건 |
| convention_compliance | NONE | 정식 규약 위반 없음. `0-` prefix 패턴·spec 책임 범위 확인 INFO 2건 |
| plan_coherence | NONE | 관련 plan(`backend-lint-gate-broken-on-main.md`)과 수치·서사 완전 일치, 충돌 항목 없음 |
| naming_collision | NONE | `spec/data-flow/` 무변경으로 신규 식별자 도입 자체 없음 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) 현재 PR 은 그대로 진행 가능.
2. 별도 planner 턴에서 WARNING #1(`5-system/1-auth.md` §1.1 이메일 알림 표 정정)과 WARNING #2(`1-data-model.md` 에 `AlertRule` V016 엔티티 섹션 신설) 처리 — 둘 다 이번 PR 범위 밖의 기존 spec 불일치이므로 별도 트래커(예: `plan/in-progress/`)에 등록해 추적할 것.
3. INFO #1은 plan 라이프사이클 이동 작업 시 체크리스트에 "JSDoc 참조 경로 동반 갱신" 항목을 추가하는 정도로 충분, 이번 턴에서 추가 조치 불요.