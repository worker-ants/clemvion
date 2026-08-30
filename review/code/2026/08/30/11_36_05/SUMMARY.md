# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실질 코드 변경은 `websocket.service.spec.ts` 재수출 facade 테스트 1건(+23줄)뿐이며 보안·기능·부작용 관점에서 결함 없음. 다만 함께 이동한 plan 문서(`documentation` 리뷰어)에서 같은 changeset 이 스스로 정정한 수치가 자매 트래커에 미반영되는 WARNING 2건 발견 — 코드/CI 영향은 없으나 문서 정합성 조치가 필요.

forced(router_safety) whitelist 7명 전원 결과 확보됨(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 같은 PR 이 `ws-event-types-extract.md` 에서 "타입만 가져가는 곳 0" 을 취소선으로 무효화하고 재측정값 "1" 로 정정했는데, 같은 리스트 항목 바로 아래(자매 트래커)에는 옛 값 "0" 이 그대로 남아 한 PR 안에서 두 문서가 다른 수치를 주장 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1389` (vs `plan/complete/ws-event-types-extract.md:82`) | 1389번 줄도 함께 정정하거나, 정정된 문서로의 포인터를 추가 |
| 2 | documentation | `complete/` 로 봉인 확정된 문서에 "frontmatter 가 `none` 인데 실제로는… 갱신해야 Gate C 를 통과한다" 는 문장이 남아 있는데, 같은 파일의 frontmatter 는 이미 이 커밋에서 `spec_impact` 7개 목록으로 갱신 완료됨 — 아직 안 된 것처럼 읽히는 잔여 문장 | `plan/complete/ws-event-types-extract.md:409-411` | "✅ 완료 — frontmatter 는 위 7개 목록으로 갱신됨(2026-08-30)" 한 줄 추가 또는 과거형으로 수정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | 신규 테스트의 목적 서술("왜 이 값만 명시 단언이 필요한가")이 코드 JSDoc 과 plan 문서 두 곳에 중복 유지 — 한쪽만 갱신되면 낡을 위험 | `websocket.service.spec.ts:1449-1461` / `plan/complete/ws-event-types-extract.md` | 조치 불요. 이 테스트 개명/제거 시 두 서술의 정합만 함께 확인 |
| 2 | testing | `InAppNotificationEventType` 는 현재 단일 멤버(`NOTIFICATION_NEW`)라 리터럴 비교로 완전히 덮이지만, 멤버가 추가되면 수동으로 단언을 늘려야 함(자매 가드는 파싱 기반 전수 비교 원칙을 채택 중이라 대비됨) | `websocket.service.spec.ts:1462-1470` | 멤버 추가 시 개별 `expect` 추가 또는 `Object.values()` 전수 순회로 확장 |
| 3 | requirement | `REEXPORT_FACADE_TEST` allowlist 가 이 스펙 파일 하나만 eager import 예외로 인정 — 파일이 삭제/경로 변경되면 자매 가드가 RED 로 이를 잡는 구조적 결합을 실측 확인(결함 아님, 설계 의도가 코드로 강제됨) | `websocket-events.types.spec.ts` (`REEXPORT_FACADE_TEST`) | 조치 불요 |
| 4 | side_effect | 커밋 메시지의 "나머지 참조는 백틱 코드 스팬이라 대상 아님" 근거가 부정확 — 실제로는 살아있는 마크다운 링크 2건이나, `plan/complete/**` 가 링크 가드 스캔에서 명시 제외되어 있어 기능적 위험은 없음 | 커밋 `10f7a2350` 메시지 / `plan/complete/spec-draft-egress-masking-convention.md:118,138` | 다음에 이 메시지를 인용할 때 "plan/complete/** 링크는 규약상 스캔 제외 대상이라 갱신 불요(링크 자체는 존재)"로 정정 |
| 5 | documentation | `egress-masking.md` 캐비엇에 대한 "유지" 판정(2026-08-24 기록)의 전제가 같은 changeset 의 앞선 커밋에서 이미 무너졌는데(캐비엇 문단 자체가 spec 에서 제거됨) 그 트래커 줄은 갱신되지 않음(이번 diff 파일 목록 밖, 후속 과제로 남김) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:376` | 후속 세션에서 §3(캐비엇 회수) 처분과 함께 이 줄도 정리 |
| 6 | scope | 이 PR 과 목적이 다른 별도 워크트리(`spec-followups-drain-08e637`, owner `project-planner`) 소유 plan 을 함께 `complete/` 로 이동 — 커밋 메시지에 사유 명시, 실질 변경은 `status` 1줄뿐이라 위험 낮음 | `plan/complete/spec-draft-followups-drain-2026-08-30.md` | 조치 불요 |
| 7 | scope | plan 이동 시 frontmatter `worktree` 필드가 원 작업 워크트리 식별자에서 현재 워크트리로 덮어써짐 — 이력 정밀도 손실(계약 위반 아님) | `plan/complete/ws-event-types-extract.md` frontmatter | 조치 불요 |
| 8 | maintainability | `describe('re-export facade', …)` 타이틀이 파일 내 다른 top-level `describe` 와 달리 순수 영어(자매 파일 용어와는 일관) | `websocket.service.spec.ts:1462` | 조치 불요 |

### 확인했으나 결함 아님 (오탐 방지 기록)

- `plan/complete/spec-draft-egress-masking-convention.md:118,138` 의 `ws-event-types-extract.md` 링크 2건은 이번 이동으로 DEAD 가 되지만, `spec-links.ts` `findBrokenPlanLinks()` 가 `plan/complete/**` 를 스캔 범위에서 명시적으로 제외(`plan-lifecycle.md §3` 규약)하고 있어 문서화된 정상 상태다 (requirement·side_effect·documentation 3개 리뷰어가 독립적으로 동일 결론에 도달).
- `websocket.service.spec.ts` 신규 JSDoc·인라인 주석은 실측과 정확히 일치(과장/오기 없음).
- plan 파일 4건의 in-progress→complete "삭제+추가" 표시는 실제로는 `git mv` rename(유사도 낮아 diff 도구가 rename 미인식)이며, 최종 상태엔 경로당 1개 파일만 남는다 — 중복 아님.
- CHANGELOG 미갱신, README/API 문서화 누락 — 순수 테스트 추가(행동 변화 0)이며 신규 기능/엔드포인트/env var 없어 해당 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 변경 없음(테스트 1건뿐), 발견사항 없음 |
| requirement | NONE | plan 계획대로 정확히 구현, spec fidelity 확인, INFO 2건(비결함 확인 포함) |
| scope | LOW | 무관 plan 동반 이동 등 부수 작업(INFO 2건), 핵심 변경은 범위 내 |
| side_effect | NONE | 부작용 없음, 커밋 메시지 근거 오기 1건(INFO, 기능 무영향) |
| maintainability | NONE | 유지보수 리스크 없음, 관찰성 INFO 3건 |
| testing | NONE | RED/GREEN 뮤테이션으로 직접 재현 검증 완료, 리터럴 비교 한계 INFO 1건 |
| documentation | LOW | WARNING 2건 (plan 문서 간 수치 불일치, 미완료로 읽히는 잔여 문장) |

## 발견 없는 에이전트

- security — 지적할 사항 없음 (실행 코드 변경이 순수 테스트 1건뿐이라 인젝션/시크릿/인증/의존성 등 전 항목 해당 없음)

## 권장 조치사항

1. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1389` 의 "타입만 가져가던 곳 0" 을, 같은 PR 이 `ws-event-types-extract.md` 에서 이미 재측정 정정한 값("1", 의도된 facade 예외)에 맞춰 갱신하거나 포인터를 추가한다. (WARNING #1)
2. `plan/complete/ws-event-types-extract.md:409-411` 의 잔여 미완료형 문장에 "✅ 완료" 표시를 붙이거나 과거형으로 정정한다. (WARNING #2)
3. (선택, 낮은 우선순위) `InAppNotificationEventType` 에 두 번째 멤버가 생기는 시점엔 명시 단언을 늘리거나 `Object.values()` 전수 순회로 전환한다. (INFO #2)
4. (선택) `egress-masking.md` 캐비엇 "유지" 판정 줄(`spec-sync-external-interaction-api-gaps.md:376`)을 §3 캐비엇 회수 처분과 함께 정리한다. (INFO #5)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(프롬프트에 상세 사유 미포함, 변경분이 성능 영향 경로 없음으로 판단된 것으로 추정) |
  | architecture | 상동 — 아키텍처 변경 없음 |
  | dependency | 상동 — 의존성/lockfile 변경 없음 |
  | database | 상동 — DB 접근 코드 변경 없음 |
  | concurrency | 상동 — 동시성 관련 코드 변경 없음 |
  | api_contract | 상동 — API 계약 변경 없음 |
  | user_guide_sync | 상동 — 사용자 가이드 대상 변경 없음 |
