# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 형제 두 커밋이 세운 CHANGELOG 관행을 이 PR 만 건너뛰었다
  - 위치: `CHANGELOG.md` (이번 diff 에 파일 자체가 없음 — 부재가 발견 대상). 비교 대상 커밋: `4a9828afe`(fix(workflows), `CHANGELOG.md` 상단에 "## Unreleased — 동시 DELETE 두 건이 `workflow.deleted` 감사 행을 두 번 남겼다" 신설), `ae4fbc374`(fix(integrations), 마찬가지로 "## Unreleased —" 신설). 이번 트리거 fix 는 `bb0cfbe3b` 로 이미 커밋됐고 `git show --stat bb0cfbe3b` 로 확인한 12개 변경 파일 목록에 `CHANGELOG.md` 가 없다.
  - 상세: 이 PR 은 `plan/in-progress/trigger-dup-delete.md` 본문과 새 e2e 파일의 독스트링(`trigger-delete-concurrency.e2e-spec.ts` — "`workflow-/workspace-delete-concurrency.e2e-spec.ts` 의 세 번째 짝") 양쪽에서 스스로를 "네 삭제 경로 중 마지막 한 자리"·"형제 둘의 세 번째 짝"이라고 명시적으로 규정한다. 형제 둘(워크플로·워크스페이스, 통합 rotate)은 똑같이 "동시 요청 두 건 중 진 쪽의 HTTP 상태 코드가 바뀐다"는 **wire-visible 동작 변경**이고, 실제로 둘 다 `CHANGELOG.md`에 "무엇이 깨져 있었는지 / 무엇을 고쳤는지 / 판별력을 어떻게 실측했는지" 3단 구성의 항목을 남겼다. 트리거 쪽도 정확히 같은 성격의 변경이다 — 동시 DELETE 두 번째 요청이 `204`(오작동, 중복 `trigger.deleted` 감사)에서 `404 RESOURCE_NOT_FOUND`(spec §4.4 계약)로 바뀐다. 같은 트래커 파일(`plan/in-progress/spec-draft-nullable-notation-followups.md:601`, `:1309`)도 "동작 변경은 `CHANGELOG.md` 에 등재", "wire 변경이라 CHANGELOG 를 동반해야 한다"는 관행을 스스로 명문화하고 있어, 이번 누락은 프로젝트가 이미 세운 자기 기준에서 벗어난다.
  - 제안: 형제 두 항목과 같은 형식(문제 서술 → 고친 것 → 판별력 실측 값)으로 `CHANGELOG.md` 에 "## Unreleased — 동시 DELETE 두 건이 `trigger.deleted` 감사 행을 두 번 남겼다" 항목을 추가한다. `[204, 204]` → `[204, 404]`, 감사 2건 → 1건이라는 실측값은 이미 plan 체크리스트와 커밋 메시지에 있으므로 그대로 옮기면 된다.

## 요약

핵심 구현(`triggers.service.ts`)과 신규 테스트(unit·e2e) 자체의 문서화 수준은 높다 — 새 코드 블록마다 "왜"를 설명하는 인라인 주석이 붙어 있고, 그 주석들이 실제 코드 동작·spec §4.4·상수값(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`)과 대조했을 때 전부 정확하다. e2e 스펙 파일의 헤더 독스트링은 형제 파일과의 관계·락 종류 차이·타임아웃 상호작용·판별력까지 상세히 기록했고, plan 문서(`plan/in-progress/trigger-dup-delete.md`)는 결함 원인·처방·재현 절차·무효 뮤턴트 경험까지 남겨 추적성이 좋다. spec 문서(`spec/2-navigation/2-trigger-list.md` §4.4)는 이미 이 동작을 계약으로 정해 두었으므로 spec 갱신도 불필요(`spec_impact: none` 이 정확)하며, 앞선 consistency-check 가 지적한 "§4.4 caveat 미기재" INFO 도 이 PR 이 구현을 spec 에 맞춤으로써 자연 해소된다는 SUMMARY 의 판단도 실측과 부합한다. 유일한 실질적 공백은 CHANGELOG — 바로 앞 두 형제 커밋(#1369, #1368)이 세운 "동시 삭제 동작 변경은 CHANGELOG 에 3단 구성으로 남긴다"는 관행을, 스스로를 그 형제들의 "세 번째 짝"으로 규정한 이 PR 만 따르지 않았다.

## 위험도

LOW
