# Plan 정합성 검토 — target: spec/5-system/ (impl-done, diff-base origin/main)

## 검토 방법 메모

이 검토의 target scope(`spec/5-system/`)는 이 브랜치(`sweep-response-contract-5ba0ad`)에서
**0개 파일 변경**(프롬프트 실측과 일치, `git diff origin/main...HEAD --stat` 로 재확인). 대신
구현 diff 는 30개 파일 / 2068줄(DTO 6종 + `response-contract.ts`/`swagger-dto-contract-guard.ts`
+ e2e 12개 + `plan/in-progress/spec-draft-nullable-notation-followups.md` 157줄)이다. 따라서
"target 이 plan 과 충돌하는 결정을 내렸는가"는 spec 본문이 아니라 **이 브랜치가 건드린 코드·
plan 문서**를 기준으로 판정했다. `spec/5-system/2-api-convention.md`·`14-external-interaction-api.md`·
`spec/conventions/secret-store.md`·관련 `plan/in-progress/*.md` 5건을 절대경로로 직접 열어
대조했다(번들 절단분은 프롬프트 대신 워킹트리에서 직접 확인).

## 발견사항

- **[INFO]** `secret-store.md` 의 "노출 창 미마감" 서술이 이 브랜치 머지 시점에 낡는다 — 단, 이미 등재됨
  - target 위치: `spec/conventions/secret-store.md` §1 (L65, L69 `"노출 창은 아직 설계대로 닫혀 있지 않다"`) — `spec/5-system/14-external-interaction-api.md` §7.1 은 저장 형태만 다루고 노출 여부는 언급하지 않아 target 자체는 영향 없음
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목(`"secret-store.md §1 의 '노출 창이 아직 닫혀 있지 않다' 가 낡는다"`, planner 배정, `21_40_38` W2 인용) + `plan/in-progress/spec-draft-notification-secret-storage.md`(`19_59_16` 2차 반영, *"수정은 이미 병행 브랜치에 있다 … 머지되면 이 항목은 닫힌다"*)
  - 상세: 이 브랜치가 실제로 `sanitizeForResponse`(트리거 비밀 컬럼 2개 + `config.notification.signing` 키 2개 strip) + 스케줄 컨트롤러 참조 4필드 좁히기로 그 "노출 창"을 닫았다(뮤턴트로 RED 확인, 단위 회귀 포함). `spec-draft-notification-secret-storage.md`가 이미 "머지되면 닫는다"는 조건부 처분을 걸어 두었으므로 이것은 **미해결 결정과의 충돌이 아니라 그 결정의 정상 집행**이다. 다만 target 문서(`secret-store.md`)의 현재형 문장은 이 브랜치가 머지되는 순간 사실과 어긋나게 되는데, developer 는 그 문장을 쓴 사람이 아니므로(§5 자기-반증형 소정정 조건 1 불충족 — planner 가 씀) 직접 고치지 않고 plan 항목으로 올바르게 이월했다.
  - 제안: target 을 developer 가 손대라는 뜻이 아니라, planner 다음 턴에서 이 등록된 항목을 우선 처리하도록 확인 — plan 은 이미 정확하므로 갱신 불필요, 집행만 남았다는 점을 기록.

- **[INFO]** §5.4 래칫의 양성 대조군이 아직 어떤 `code:` glob 에도 걸리지 않는다 — 이 브랜치가 그 fixture 를 방금 만들었다
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:` (현재 12항목, `optional-nullable.fixture.ts` 미포함)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목(`"§5.4 래칫 canary fixture 를 code: 에 등재"`, planner 배정, `20_45_39` W1 인용)
  - 상세: 이 브랜치가 `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` 를 신설해 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫(78건)의 양성 대조군으로 쓴다. 그런데 plan 항목이 정확히 지적하듯 그 파일은 `.../fixtures/**` 경로라 `swagger-dto-contract*.ts` glob 의 `/dto/responses/` 접두 요구를 충족 못 해 spec-linked 로 안 잡힌다 — 즉 이 fixture 를 약화시키는 편집이 있어도 `--impl-done` 게이트가 `2-api-convention.md` 재검토를 트리거하지 않는다. 이미 developer 가 같은 커밋 세트 안에서 plan 항목으로 등재했으므로 "누락"은 아니지만, **머지 시점부터 planner 처리 전까지는 실제로 열려 있는 커버리지 사각지대**다.
  - 제안: target(`2-api-convention.md` frontmatter `code:`)에 `codebase/backend/src/repo-guards/__tests__/fixtures/**` 추가 — plan 이 이미 지시한 내용 그대로, 우선순위를 높여 다음 planner 턴에서 처리 권장.

- **[INFO]** 관련 plan 2건(`spec-draft-api-convention-verifier-registration.md`, `spec-draft-notification-secret-storage.md`)이 열린 체크박스 0개인데도 `status: in-progress` 로 `plan/in-progress/`에 남아 있다 — 이 브랜치가 만든 문제는 아님
  - target 위치: `spec/5-system/2-api-convention.md`(§5.4 "검증 층" 문단 + `code:` 2항목), `spec/5-system/14-external-interaction-api.md` §7.1(정정 이력) — 두 target 모두 이미 해당 plan 의 산출을 반영 완료한 상태
  - 관련 plan: 위 두 파일(둘 다 `origin/main` HEAD 커밋 `983fd0ade`/`9a9c024a6`으로 이미 병합됨, 이 브랜치의 diff 에는 없음)
  - 상세: `grep -c "^\- \[ \]"` 로 두 파일 모두 열린 항목 0건을 확인했다. target 은 이미 그 결정(검증자 등재, §1.1 신설)을 반영했으므로 target-plan 충돌은 없다. 다만 "미해결 결정" 목록에 실제로는 종결된 항목이 남아 있으면 다음 검토 라운드가 오판할 위험이 있다.
  - 제안: 이 브랜치의 책임 범위 밖(사전 존재 상태) — planner 다음 턴에서 두 plan 을 `plan/complete/`로 이동.

## 요약

target(`spec/5-system/`)은 이 브랜치에서 변경되지 않았고(델타 0, 재확인 완료), 실제 변경은
응답-계약 검증자 배선 확대 + 트리거/스케줄 비밀 노출 차단 코드 + 관련 plan 문서 갱신이다.
이 작업은 `plan/in-progress/spec-draft-notification-secret-storage.md`가 이미 "머지되면 닫는다"고
조건부로 걸어 둔 결정을 정상 집행한 것이고, 새로 생긴 설계 질문(CanvasSaveResultDto 타입,
IntegrationDto 필드 제거 검토, §5.4 스윕 2차, nav-spec 포인터 문서화 등)은 모두 developer 가
`spec/`을 직접 건드리지 않고 `spec-draft-nullable-notation-followups.md`에 planner 배정 체크박스로
올바르게 이월했다 — 미해결 결정을 우회하거나 일방적으로 확정한 사례는 발견되지 않았다. 유일한
잔여 리스크는 이 브랜치가 방금 만든 §5.4 래칫 양성 대조군이 아직 어떤 spec 의 `code:` glob 에도
걸리지 않아 머지~다음 planner 턴 사이에 실제로 열려 있는 커버리지 사각지대이지만, 이 역시 이미
plan 항목으로 정확히 등재돼 있다.

## 위험도

LOW
