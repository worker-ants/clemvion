# Plan 정합성 분석

검토 모드: --impl-done, scope=spec/conventions/, diff-base=origin/main

## 사전 조사

`git diff origin/main --name-only -- spec/conventions/` 결과: **`spec/conventions/swagger.md` 단 1 파일**이 실제 변경됨.

프롬프트에 포함된 target 문서(`audit-actions.md`, `cafe24-api-catalog/*`)는 이미 origin/main 에 병합된 파일들이 맥락 보충용으로 포함된 것이며, 현 브랜치의 실제 diff 는 아니다. 이 사실을 바탕으로 아래 분석을 진행한다.

---

## 발견사항

### [INFO] audit-actions.md `model_config` 미구현 행 — 후속 구현 plan 없음
- **target 위치**: `spec/conventions/audit-actions.md` §3 도메인별 분류 레지스트리 — `model_config | 현재형 (§2.2) | create, update, delete, set_default | 미구현`
- **관련 plan**: 없음 (`model_config` 감사 로깅을 구현할 `plan/in-progress/**` 미존재)
- **상세**: `audit-actions.md` 는 mc-cfg-polish (완료) 에서 `model_config` 감사 액션을 "미구현"으로 등재했다. 규약 문서로서 미래 구현의 의도를 표명하는 것은 정상이나, 현재 이 항목의 구현을 추적하는 in-progress plan 이 없어 추후 누락될 수 있다.
- **제안**: 단기 차단 필요 없음. `model_config` 감사 로깅 구현 시 plan 생성 시 본 항목을 `pending_plans` 로 연결할 것.

### [INFO] cafe24-backlog-residual §G-3l — planner 미결 개방, target 문서는 정합
- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` — ⚠ footnote: `applications_list`·`webhooks_list` 운영 검증/제거 결정 트랙 §G-2 참조
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md §G-3l` (planner 미결, open)
- **상세**: G-3l 은 KNOWN_G2 7개 ops 제거 결정을 planner 에게 위임한 상태로 열려 있다. `application.md` 는 이 결정을 일방적으로 내리지 않고 §G-2 트랙 참조 노트로 올바르게 유지하고 있다. 충돌 없음.
- **제안**: 현 상태 유지. G-3l 이 planner 에 의해 결정될 때 application.md 를 갱신.

### [INFO] cafe24-backlog-residual §G-4 — appstore-orders.md 수작업 fix 완료, 잔여 재생성 대기 중
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md §G-4` (`[x]` — 수작업 fix 완료, `[ ]` — 나머지 충돌 파일 재생성 대기)
- **상세**: `appstore-orders.md` 는 plan 에서 `[x]`(완료)로 표기된 파일이며, 목표 scope 에 포함돼 있다. 내용이 계획대로 `(응답 객체)` 라벨로 수정돼 있어 plan 과 정합. 잔여 재생성 대상(links 등)은 target scope 에 없으므로 본 체크 범위 외.
- **제안**: 현 상태 정합. G-4 잔여는 generator 재실행 시 별도 처리.

---

## 요약

현 브랜치(`claude/mc-cfg-polish`, worktree `swagger-paginated-wrap`)의 `spec/conventions/` 실제 변경 파일은 `swagger.md` 단 1건이다. `swagger-double-wrap-fix.md` 계획에 따른 §5-2 단일-래퍼 정정이며, 해당 변경이 다른 in-progress plan 의 미결 결정과 충돌하는 사항은 발견되지 않았다. 맥락 파일로 포함된 `audit-actions.md`·cafe24 카탈로그 파일들은 각각 mc-cfg-polish(완료)·cafe24-backlog-residual(해당 항목 정합) 트랙과 일치한다. 미해결 결정 우회나 선행 plan 미해소에 해당하는 CRITICAL/WARNING 항목은 없다.

## 위험도

NONE
