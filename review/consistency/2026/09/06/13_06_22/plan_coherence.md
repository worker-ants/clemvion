# Plan 정합성 검토 — `spec-draft-review-citations-enforcement.md`

## 발견사항

- **[WARNING]** 변경안 (B)의 실행이 자매 plan 의 열린 항목을 부분 완료시키는데, 그 사실이 어느 문서에도 동기화되지 않는다
  - target 위치: `plan/in-progress/spec-draft-review-citations-enforcement.md` — 변경안 (B) 및 `## 종결 조건`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:521-560` — 미체크 항목
    *"신규 검출 3축을 §5.4 「검증 층」과 `code:` 에 등재"* (표에 **구조 축·이름 축·JSDoc 인용 축** 3행,
    JSDoc 인용 축의 등재 대상이 정확히 `review-citations.md` 로 명시돼 있다)
  - 상세: target 의 변경안 (B)(`review-citations.md` frontmatter `code:` 에
    `dto-jsdoc-citation*.ts` 등재)는 위 3축 중 **JSDoc 축 1개를 그대로 실행**하는 것과 동일하다.
    그런데 target 의 `## 종결 조건`(5개 체크박스)에는 이 부분 완료를 `spec-draft-nullable-notation-followups.md`
    쪽에 반영하는 항목이 없다. target 하단 "함께 처리할 것" §1 은 구조축·이름축만 언급하고
    (*"§5.4 「검증 층」에 구조 축·이름 축 등재… 개수를 다시 쓰지 말고 나열형으로"*), JSDoc 축이
    target 자신에 의해 먼저 처리된다는 사실과 그로 인해 parent 표의 3행 중 1행이 완료됨을
    명시하지 않는다. 이 상태로 두 PR/턴이 각각 별도로 머지되면, `spec-draft-nullable-notation-followups.md`
    독자는 "3축 모두 미등재"로 계속 읽게 되고, 나중에 구조축·이름축만 등재하면서 이미 끝난
    JSDoc 축을 중복 처리하거나, 반대로 3행 중 1행이 조용히 낡은 채 방치될 위험이 있다.
    (사용자 메모리 `feedback_stale_plan_claims_and_checklist_sync.md` 가 지적한 바로 그 패턴 —
    "체크리스트는 두 군데 동기화해야 한다".)
  - 제안: target 의 `## 종결 조건`에 "`spec-draft-nullable-notation-followups.md` 의 JSDoc 축 행을
    완료로 표시(또는 구조·이름 2축으로 좁힘)" 항목을 추가하거나, 최소한 target 커밋 메시지/PR
    설명에 그 parent 표의 JSDoc 행이 이 변경으로 닫힌다는 점을 명시해 다음 사람이 두 문서를
    따로 열어도 어긋나지 않게 한다.

- **[INFO]** "함께 처리할 것" 3건은 target 자신의 종결 조건에 포함되지 않아, target 이 단독으로 머지되면 이행 여부가 추적되지 않는다
  - target 위치: `plan/in-progress/spec-draft-review-citations-enforcement.md` §"함께 처리할 것"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:521-560, 562-572`;
    `plan/in-progress/spec-draft-api-convention-verifier-registration.md`(전체)
  - 상세: 세 항목(§5.4 구조·이름 축 등재 / `User` 7컬럼 노출 금지 규범화 / verifier-registration
    plan 을 `plan/complete/` 로 이동)은 "같은 턴에서 처리하면 중복 비용이 없다"는 권고일 뿐
    target 자신의 `## 종결 조건` 체크박스에는 없다. 세 번째 항목은 실측으로 확인했다 —
    `spec-draft-api-convention-verifier-registration.md` 는 체크박스가 하나도 없고 본문 내용이
    이미 `spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md` 에 반영돼 있으며
    (`983fd0ade` / `21182db02`, PR #1289), target 의 주장대로 이동 대상이 맞다. 다만 이 이동이
    target 자신의 종결 조건이 아니므로, target 만 머지되고 "함께 처리"가 스킵되면 이 plan 은
    `plan/in-progress/`에 계속 남아 이미 완료된 작업으로 그루밍 비용을 반복 유발한다.
  - 제안: 권고 사항이 실제로 실행되는지 별도 추적(같은 세션의 스크래치 체크리스트 등)이 필요.
    plan 문서 자체의 구조를 바꾸라는 요구는 아니다 — target 이 명시적으로 "권고"로 표시했으므로
    구속력 있는 종결 조건으로 승격할지는 판단 재량.

## 요약

target 이 스스로 진단한 핵심 사실(§3 JSDoc 카브아웃을 이제 `dto-jsdoc-citation-guard.ts` 가
AST 로 강제한다, `review-citations.md`·`spec-impl-evidence.md §2.1` 의 "시행 코드 없음" 전제가
거짓이 됐다)은 저장소 실측(`spec/conventions/review-citations.md`,
`spec/conventions/spec-impl-evidence.md:81`, `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`
현재 상태 확인)과 정확히 일치한다. 미해결 결정을 우회하는 CRITICAL 급 충돌은 없다 — developer
자기-반증 예외의 5조건 검토도 CLAUDE.md 문면과 부합하게 판단했다. 다만 target 의 변경안 (B)가
`spec-draft-nullable-notation-followups.md` 의 열린 3축 등재 항목 중 1축(JSDoc)을 선행 실행하는
셈인데, 그 사실이 parent plan 쪽에 동기화되지 않아 두 plan 문서가 서로 다른 완료 상태를 주장하게
될 위험이 하나 있다(WARNING). "함께 처리할 것" 3건은 권고 수준으로 남아 있어 실행 누락 시
추적이 어렵다(INFO). 둘 다 plan 갱신으로 해소 가능한 수준이며 spec 반영 자체를 막을 사안은
아니다.

## 위험도

LOW
