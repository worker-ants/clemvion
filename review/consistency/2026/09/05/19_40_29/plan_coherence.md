# Plan 정합성 검토 — `plan/in-progress/spec-draft-notification-secret-storage.md`

## 발견사항

- **[WARNING]** W2 수정이 직전 planner 턴의 "완료" 서술을 부분적으로 반증하는데, 그 plan 문서를 갱신하지 않는다
  - target 위치: target 문서 §③ `spec/5-system/2-api-convention.md` (W2) — `swagger-dto-contract*.ts` 를 frontmatter `code:` 에 추가하는 항목
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:313-329` (그리고 이 항목이 인용하는 완료 원본
    `spec-draft-api-convention-verifier-registration.md`, PR #1289 로 이미 머지됨 — 현재 커밋 `983fd0ade`)
  - 상세: `spec-draft-nullable-notation-followups.md:314`는 `response-contract.ts` 를 **"§5.4 를 시행하는
    유일한 코드"** 라고 명시하고, 같은 블록(:318-320)은 "`2-api-convention.md`(§5.4 축)와 `swagger.md`
    양쪽에 등재했다" 며 이 항목을 완료(`[x]`)로 닫았다. 그런데 target 문서가 직접 실측한 대로
    `swagger-dto-contract-guard.ts` 의 판정 축(`ContractMismatch.axis: 'presence' | 'null'`,
    `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:39-41`)도 OpenAPI
    `required`/`nullable` 대 TS 타입을 대조한다 — 즉 §5.4(부재 표현) 관련 축을 **정적으로** 시행하는
    두 번째 코드다. 현재 `spec/5-system/2-api-convention.md` frontmatter `code:` (실측, 11항목)에는
    `swagger-dto-contract*.ts` 가 없고 `spec/conventions/swagger.md` 에만 있다 — target 의 W2 지적이
    정확하다. 그렇다면 `spec-draft-nullable-notation-followups.md` 의 "유일한 코드" / "완료" 서술은
    이번 turn 으로 **사실이 아니게 된다.**
  - 제안: target 커밋에 `plan/in-progress/spec-draft-nullable-notation-followups.md:313-329` 정정 주석을
    함께 추가한다 — "유일한 코드" 문구를 "§5.4 를 **런타임으로** 시행하는 유일한 코드(정적 축은
    `swagger-dto-contract-guard.ts` 가 겸함, `spec-draft-notification-secret-storage` W2 에서 등재)" 로
    좁히거나, 최소한 그 완료 블록 아래에 후속 정정 각주를 단다. 이 저장소의 관행(동일 파일 안에서도
    "문구 정정"·"확인 완료" 주석으로 stale 완료 claim 을 갱신하는 패턴, 예: `backend-lint-gate-broken-on-main.md`
    다수 사례)과 일치시킨다.

- **[WARNING]** "(b) 코드측 ref 화" 후속 작업을 추적할 plan/in-progress 항목이 없다
  - target 위치: target 문서 §② 결정부 및 §③ 변경안 — "(b) 는 코드 변경이고 그것은 developer 트랙의
    별도 PR 이다"
  - 관련 plan: 없음(신설돼야 함) — `plan/in-progress/` 전수 검색(`notification_secret`, `notification-signing`,
    `notificationSecretV2` 등) 결과 이 후속 코드 작업을 가리키는 기존 항목이 0건이다
  - 상세: target 은 `notification_secret_v2` 를 ref 화하는 코드 수정을 개시하지 않고 별도 developer PR 로
    미룬다. 그런데 그 미룬 작업을 추적하는 `plan/in-progress/*.md` 항목이나 기존 plan 안의 체크박스가
    전혀 없다 — spec 쪽(§7.1 blockquote + secret-store.md §1 각주)만 "알려진 이탈" 로 기록되고, 코드
    쪽 작업 자체는 어떤 문서에도 걸리지 않는다. 이 저장소는 유사한 "알려진 이탈/공백"을 예외 없이
        `plan/in-progress/*.md` 에 체크박스로 등재해 왔다(예: `secret-store.md §2.1` 각주가 가리키는
    "LIKE 의미론 미재현 mock" 항목, `backend-lint-gate-broken-on-main.md` 의 "다른 Redis fail-open
    소비자 배선" 항목 등 — 전부 spec 각주와 별개로 plan 트래커에 살아 있는 체크박스가 있다). 이
    선례와 달리 이번 이탈은 spec 각주만 있고 대응하는 열린 plan 항목이 없어, "알려진 이탈" 이
    표류할 위험이 있다.
  - 제안: `plan/in-progress/` 에 `notification-secret-v2-ref-migration.md`(또는 유사 이름) 신설,
    최소한 `spec-draft-notification-secret-storage.md` 자체를 developer 트랙 인계용으로 `in-progress`
    유지하며 "코드측 ref 화" 를 체크박스로 남긴다. `spec/5-system/14-external-interaction-api.md` §7.1
    새 blockquote 에서 그 plan 항목으로 역방향 링크를 걸면(spec→plan 링크는 `spec-link-integrity` 가
    plan 이동 시 깨진다는 이 문서 자신의 기존 원칙과 충돌하므로, 서술 인용으로) 발견성이 유지된다.

## 요약

target 의 핵심 결정(예외 등재 대신 코드측 ref 화, secret-store.md §1 예외 목록 불변)은 기존 plan
어디에서도 열려 있는 "결정 필요" 항목과 충돌하지 않으며, 오히려 같은 파일의 기존 정황
(`interaction.triggerToken` 이 2026-08-16 에 반대 방향(예외 등재)으로 이미 결정된 선례)과 스스로
구분해 근거를 세우고 있어 이 축은 정합하다. 다만 target 이 건드리는 `2-api-convention.md` 는
같은 날(2026-09-05) 방금 병합된 `spec-draft-api-convention-verifier-registration` 턴의 직접 후속이고,
그 턴의 "완료"·"유일한 코드" 서술을 target 의 실측이 사실상 정정하는데도 그 plan 문서 쪽에는
아무 흔적을 남기지 않는다 — 이 저장소가 반복해 온 "완료 claim 은 후속 실측이 반증하면 그 자리에서
정정한다" 관행에서 벗어난다. 또한 target 이 developer 트랙으로 넘기는 코드 fix 는 추적하는 열린
plan 항목이 없어 표류 위험이 있다. 두 문제 모두 spec 내용 자체를 막을 사유는 아니고 plan 문서
갱신으로 해소 가능하다.

## 위험도

MEDIUM
