# 유지보수성(Maintainability) 리뷰 — SSRF 가드 통합 (3라운드 / 수렴 확인)

## 컨텍스트

이번 라운드의 diff 는 origin/main 대비 브랜치 전체 누적분이며, 실질 코드 변경은 1·2라운드에서 이미 검토됐다.
3라운드에서 실제로 추가된 것은 2라운드 조치 커밋 `fce34b77b`(리뷰 문구·테스트 1건 추가·트래커 등재)와 리뷰 산출물
커밋 `bb4c5381b`(문서만) 뿐이다. 아래는 (a) 이전 라운드 WARNING 이 실제로 해소됐는지 재검증, (b) `fce34b77b` 자체가
새 결함을 들여왔는지 확인한 결과다. 저장소 파일은 수정하지 않고 `Read`/`git show`/`grep` 으로만 확인했다 —
`git status --short` 대조 불필요(변경 없음).

## 발견사항

해당 없음 — Critical·Warning 없음.

## 검증 상세 (재론 없음, 근거 기록)

- **[양성 확인] 1라운드 WARNING(메시지 접두어 매직스트링 계약) 해소 유지**
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:47`(`export class SsrfBlockedError extends Error`),
    `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:28`(`if (err instanceof SsrfBlockedError) return true;`)
  - `err.message.startsWith('SSRF_BLOCKED')` 문자열 매칭은 남아 있지 않다 — 전용 에러 클래스 + `instanceof` 로 판정한다.
    이번 라운드에서 이 부분은 변경되지 않아 재검증만 했다.

- **[양성 확인] 2라운드 WARNING(JSDoc 문단 삽입이 영어 문장 흐름을 끊음) 해소**
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:20-28`
  - `fce34b77b` 의 diff(`git show fce34b77b -- .../http-safety.ts`)를 직접 확인: 폴더 위치 설명 한국어 문단이
    `**Self-hosted opt-in**: ...` 영어 문단 뒤, 빈 주석 줄(`*`)로 분리된 별도 문단으로 옮겨졌다. "Blocks URLs..." →
    "Intended for Integration-backed requests..." 로 이어지던 원래 영어 문장도 다시 한 문단으로 붙었다. 지적된
    가독성 회귀가 정확히 해소됐다.

- **[양성 확인] 2라운드 W2(소비자 넷의 catch 가 `instanceof` 아님)는 수렴 예외로 처리 — 재-flag 하지 않음**
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`,
    `codebase/backend/src/nodes/integration/http-request/http-redirect.ts`,
    `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`,
    `codebase/backend/src/modules/integrations/database-connection-tester.ts` — 여전히 가드가 던진 것을 무엇이든
    차단으로 옮긴다(이번 diff 밖의 기존 코드, 변경 없음).
  - `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "SSRF 가드 소비자 넷의 catch 를
    `instanceof SsrfBlockedError` 로" 항목이 실제로 등재돼 있고, RESOLUTION(`review/code/2026/09/19/22_00_32/RESOLUTION.md`)
    이 수렴 예외 근거(동작 차이 없음·고치면 각 호출부의 기대 동작을 다시 정해야 함)를 명시한다 — 새 결함이 아니라
    이미 처분된 항목이므로 3라운드에서 다시 지적하지 않는다.

- **[INFO] 트래커 항목이 아직 존재하지 않는 경로를 인용**
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (LLM/S3 SSRF 항목, "2026-09-19 등재" 문단)
  - 상세: `plan/complete/ssrf-guard-integration-unify.md` «비대상» 을 근거로 인용하지만, 같은 diff 안에서 그 plan 은
    아직 `plan/in-progress/ssrf-guard-integration-unify.md` 로 존재하고 체크리스트 마지막 항목("이 plan
    `plan/complete/` 로")도 미완료(`[ ]`)다. 즉 인용 경로가 "이 plan 이 완료된 뒤" 를 가리키는 선행 참조라 지금
    시점에 그 경로를 그대로 열면 파일이 없다.
  - 제안: 코드 결함은 아니며 차단 사유도 아니다. plan 을 `complete/` 로 옮기는 커밋에서 이 참조가 실제로 유효해지는지
    (또는 옮기기 전 시점의 독자를 위해 `in-progress/`→`complete/` 경로 전환을 한 줄 덧붙일지) 확인만 권장.

- **[양성 확인] `fce34b77b` 가 새로 추가한 테스트(`http-safety.spec.ts` zone-id 폴백 2건)의 구조**
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.spec.ts` — `it.each(['fe80::1%eth0', ...])`
  - 기존 `it.each` 표 패턴과 동일한 형태(입력·설명 튜플)로, 파일 전체의 테스트 스타일과 일관된다. 뮤턴트(폴백이
    `''` 반환) 로 RED 확인됐다는 근거가 plan 체크리스트에 남아 판별력도 확보돼 있다.

## 요약

3라운드에 새로 반영된 변경(`fce34b77b`, `bb4c5381b`)은 1·2라운드에서 지적된 유지보수성 WARNING(메시지 접두어
매직스트링 계약, JSDoc 문단 삽입으로 인한 가독성 회귀) 모두를 정확히 해소했고, 새로 추가된 테스트·문서 문구도
기존 코드베이스 패턴과 일관돼 새 결함을 들여오지 않았다. `catch` 를 `instanceof` 로 통일하지 않은 소비자 넷은
근거가 기록된 수렴 예외로, 이번 리뷰에서 재지적하지 않는다. 유일하게 남는 것은 트래커 문서의 미래 시점 경로
인용(현재는 존재하지 않는 `plan/complete/...` 참조) 이라는 INFO 성격의 사소한 옥의 티뿐이며, 코드·테스트의
가독성·네이밍·함수 길이·중첩·복잡도·중복 어느 기준으로도 차단 사유가 없다.

## 위험도
NONE
