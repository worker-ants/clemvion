# Plan 정합성 검토 — `spec-draft-followups-batch-a.md`

## 검토 방법

target 의 5개 항목(A-1~A-5)을 `plan/in-progress/spec-draft-nullable-notation-followups.md`(자매
트래커, 전문 확인)와 대조하고, 다른 `plan/in-progress/**` 전체(약 65개 파일)를 grep 으로 훑어
같은 spec 파일(`CLAUDE.md` · `developer/SKILL.md` · `2-trigger-list.md` · `15-chat-channel.md` ·
`2-api-convention.md` · `3-error-handling.md` · `swagger.md` · `secret-store.md` · `1-data-model.md`)을
겨누는 항목이 있는지 확인했다. 아울러 target 이 "현재 상태" 로 인용하는 라인들을 실제 spec
파일과 대조해 baseline drift 여부를 확인했다.

자매 트래커의 5개 대상 항목(CLAUDE.md harness 권한 · R-2 폐기 · frontmatter status 모순 ·
auth config dead-end · botToken 자기모순 · 도메인 에러 코드 · §5.4 신규 2축 · User 7컬럼 규범)은
전부 `[ ]`(미체크) 상태로 실재하며, target 이 인용한 baseline 문구(§5.3 `410` 기본값 문구,
§5.4 "두 검증자" 문구, `code:` frontmatter 미등재, R-2/230행대·frontmatter status/botToken 셀 원문)는
현재 spec 파일과 정확히 일치한다 — stale 근거로 작성된 항목은 없었다.

## 발견사항

- **[WARNING]** `secret-store.md`·EIA `§7.1` 의 "노출 창이 아직 닫혀 있지 않다" 서술이 이미
  거짓인데, target 이 같은 파일을 열면서도 갱신하지 않는다
  - target 위치: A-5 (`1-data-model.md §2.1` 규범 신설 + `secret-store.md §1.1` 상호 참조
    한 줄 추가) — target 은 `secret-store.md` 를 이번 턴에 직접 편집 대상으로 이미 열어 둔다
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목 —
    (1) 완료 표시된 "트리거 회전 secret 이 응답에 나간다 — 유출 차단 코드"(`[x]`, "완료 —
    `sweep-response-contract` 브랜치 전체가 그 수정이다"), (2) 아직 미체크인 "노출 창이 아직
    닫혀 있지 않다 서술이 낡는다 — `secret-store.md §1` 과 `14-external-interaction-api.md §7.1`
    두 곳"(`[ ]`)
  - 상세: `secret-store.md:69-78` 은 지금도 *"노출 창은 아직 설계대로 닫혀 있지 않다 …
    현행 구현은 `GET/POST/PATCH /api/triggers` 와 `GET /api/schedules` 응답에도 이 컬럼을
    그대로 싣는다"* 라고 적고, 그 유출 수정을
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 추적한다고 명시적으로
    가리킨다. 그런데 그 트래커 자신이 같은 유출을 **이미 완료로 체크**했고(`sweep-response-contract`
    = #1291, `git log` 상 이미 `origin/main` 에 머지됨), 같은 트래커의 별도 항목이 *"이 문장은
    내가 직전 planner 턴에 쓴 것이고, 브랜치가 머지되는 순간 현재형 서술이 거짓이 된다"* 고
    스스로 예견해 두었다. `14-external-interaction-api.md:934-936` 도 같은 문구
    (*"현재 이 컬럼은 응답에도 나간다 … 미해결 결함"*)를 복제해 갖고 있다. 즉 **두 곳 모두
    지금 시점에 이미 거짓**이고, target 은 이 정확한 정합성 사슬(#1291/#1292 sweep 의 후속)을
    A-1·A-4 에서 상세히 다루고 있으면서도 이 인접 항목은 집지 않는다.
  - 제안: target 의 A-5 편집 세션에서 `secret-store.md:69-78` 의 blockquote 를 *"이 창은
    `#1291` 로 닫혔다"* 형태로 정정하고(자매 트래커 §7.1 패턴 준용), `14-external-interaction-api.md
    §7.1` 도 동시 갱신한다 — 또는 최소한 이 항목을 target 의 스코프에 명시적으로 포함하지 않는
    이유(왜 5건에서 제외했는지)를 target 에 한 줄 남긴다. 그렇지 않으면 A-5 편집 직후에도
    같은 파일 안에 "새 규범 문장"과 "이미 거짓인 유출 경고"가 나란히 남는다.

- **[INFO]** `pending_plans` 대상 실재화가 게이트로 강제되지 않는다
  - target 위치: A-2-2 변경안 (`status: partial` + `pending_plans:
    plan/in-progress/spec-draft-nullable-notation-followups.md`) 및 체크리스트 "A-2-2 자매
    트래커에 sort/order 구현 developer 항목 신설 (`pending_plans` 대상 실재화)"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (현재 `triggers.service.findAll`
    의 sort/order whitelist 구현을 다루는 항목이 아직 없음 — 전수 확인)
  - 상세: target 은 스스로 *"`pending_plans` 가 가리킬 실재 대상이 있어야
    `spec-pending-plan-existence.test.ts` 를 통과한다"* 고 적었지만, 그 테스트는 파일
    **존재**만 확인할 가능성이 높다(예: `plan/in-progress/1-workflow-list.md` 의 선례도
    포괄적 트래커 파일을 가리킨다). 즉 체크리스트의 "developer 항목 신설"을 빠뜨려도 게이트가
    이를 못 잡고 조용히 통과할 수 있다.
  - 제안: 실행 시 체크리스트 항목을 건너뛰지 않도록, `spec-pending-plan-existence.test.ts` 가
    파일 존재만 보는지 항목 매칭까지 보는지 먼저 확인하고, 전자라면 실행 후 수동 확인
    단계를 명시적으로 남긴다.

## 요약

target 이 자매 트래커에서 가져온 5개 항목은 트래커 상태·spec 현재 텍스트와 정확히 일치하며
(모두 `[ ]` 미체크, baseline 인용문 전부 실측 일치), 다른 `plan/in-progress/**` 항목 중 같은 파일의
같은 절을 겨누는 활성 편집 충돌은 발견되지 않았다. 유일한 실질적 결함은 target 이 A-5 에서
`secret-store.md` 를 여는 바로 그 순간, 인접한 자매 트래커 항목(노출 창 서술 갱신)이 이미
충족된 전제(#1291 머지)를 갖고도 반영되지 않는다는 점이다 — CRITICAL 급 결정 충돌은 아니지만
방치하면 같은 파일에 "이미 거짓인 미해결 경고"가 새 규범 문장과 나란히 남는다.

## 위험도

LOW
