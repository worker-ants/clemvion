# 신규 식별자 충돌 검토 — Cafe24 HMAC 알고리즘 재정정

**검토 대상**: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
**검토 일시**: 2026-05-16
**검토 모드**: spec draft 검토 (--spec)

---

### 발견사항

- **[INFO]** `buildHmacMessage` 함수명 — 기존 spec 내 동일 이름이 동일 의미로 사용됨 (교체 정정)
  - target 신규 식별자: `buildHmacMessage(rawQuery: string): string`
  - 기존 사용처: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 (PR #67 SEC H-1 에서 도입된 기존 `buildHmacMessage`). 동일 파일 동일 섹션에 이미 존재.
  - 상세: target 이 기존 `buildHmacMessage` 의 시그니처와 이름을 **그대로 유지**하면서 내부 로직(URLSearchParams decode 제거, rawQuery 직접 split)만 변경한다. 이름·파라미터 타입·반환 타입이 동일하므로 식별자 충돌이 아니라 교체(정정)다. 호출자(`handleInstall`, `tryRecoverByMallId`)의 코드 변경이 불필요하다고 self-check에서 명시하고 있어 시그니처 호환성이 보장된다.
  - 제안: 충돌 없음. 단, spec 코드 예시에서 기존 구현을 정확히 삭제하고 신규 구현으로 대체함을 문서화하면 혼선 예방에 도움된다 (변경 1에서 이미 명시함).

- **[INFO]** `verifyHmac` 함수명 — spec 본문에 신규 보조 함수로 추가됨
  - target 신규 식별자: `verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string): boolean`
  - 기존 사용처: 코퍼스 전체에서 `verifyHmac` 이름을 다른 의미로 사용하는 사례 없음. `spec/4-nodes/4-integration/4-cafe24.md` 기존 §9.8 에는 `buildHmacMessage` 는 있으나 `verifyHmac` 독립 함수는 없었음(검증 로직이 인라인 처리).
  - 상세: 신규 이름이며 기존 사용처와 충돌 없음. `verifyHmac` 는 암호학적 검증 책임을 명시적으로 분리한 헬퍼로, 다른 영역의 `verifyHmac`-유사 이름(예: auth 도메인의 token verify 등)과 혼동 가능성 검토 필요. spec/5-system/1-auth.md 등 인증 도메인에서는 `verifyHmac` 명칭이 사용되지 않아 충돌 없음.
  - 제안: 충돌 없음. 필요하다면 `verifyCafe24Hmac` 으로 더 범위를 좁힌 이름도 고려할 수 있으나, spec 코드 예시 수준에서는 현행 이름으로 충분하다.

- **[INFO]** Rationale 섹션 앵커 — 기존 Rationale 항목과 이름 유사성 없음
  - target 신규 식별자: `### HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)` (spec/2-navigation/4-integration.md Rationale 말미 추가)
  - 기존 사용처: `spec/2-navigation/4-integration.md` 의 기존 Rationale 항목 중 관련 이름으로는 `Cafe24 App URL 상세 페이지 표시 (2026-05-16)`, `install_token TTL 24h`, `CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제`, `Cafe24 App URL 100자 한도 대응` 등이 있음. 명칭 중복 없음.
  - 상세: 신규 Rationale 항 제목이 기존 항목과 겹치지 않으며 날짜 태그 `(2026-05-16 재정정)` 로 충분히 구분됨. 앵커 충돌 없음.
  - 제안: 충돌 없음.

- **[INFO]** CHANGELOG 태그 `2026-05-16 (hmac-raw-fix)` — 기존 CHANGELOG 항목과 구분됨
  - target 신규 식별자: CHANGELOG 행의 날짜+태그 `2026-05-16 (hmac-raw-fix)`
  - 기존 사용처: `spec/4-nodes/4-integration/4-cafe24.md` §10 CHANGELOG 에 이미 `2026-05-16 (ux-cleanup)` 행이 존재한다고 target 본문이 언급함. 두 항목은 같은 날짜이나 태그가 다름 (`ux-cleanup` vs `hmac-raw-fix`).
  - 상세: CHANGELOG 는 날짜+태그의 조합으로 고유성을 가지므로 동일 날짜 다른 태그는 허용된 패턴이다. 충돌 없음.
  - 제안: 충돌 없음.

- **[INFO]** 제거 대상 `formUrlEncode` — spec 본문 외 인용 없음 확인
  - target 신규 식별자: 해당 없음 (제거 작업)
  - 기존 사용처: target self-check 에서 "`formUrlEncode` 헬퍼는 spec 본문 외 다른 인용 없음 (grep 확인)"으로 명시. 제공된 코퍼스(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/11-error-empty-states.md`) 에서 `formUrlEncode` 참조 없음.
  - 상세: 제거 후 dangling reference 위험 없음. 단, 코퍼스에 `spec/4-nodes/4-integration/4-cafe24.md` 원문이 포함되어 있지 않아 해당 파일 내부의 다른 섹션에서 `formUrlEncode` 를 참조하는지 직접 확인 불가. self-check 의 grep 결과를 신뢰한다.
  - 제안: 구현 단계에서 `backend/` 코드의 `formUrlEncode` 호출부를 별도 grep 으로 재확인할 것을 권장한다.

---

### 요약

target 문서(`spec-draft-cafe24-hmac-raw-fix.md`)가 도입하는 신규 식별자는 `buildHmacMessage`, `verifyHmac`, `rawQuery` 파라미터, Rationale 섹션명, CHANGELOG 태그 `hmac-raw-fix` 이며, 이 중 어느 것도 기존 사용처에서 다른 의미로 사용 중인 사례가 발견되지 않았다. `buildHmacMessage` 는 기존 spec 에 동일 이름이 존재하지만 시그니처를 유지한 채 로직만 교체하는 정정(정합성 있는 교체)이므로 식별자 충돌에 해당하지 않는다. `verifyHmac` 는 순수 신규 이름으로 전체 코퍼스 내 다른 도메인에서 동일 이름의 이종 함수가 없다. 파일 경로는 기존 파일 수정이며 신규 파일 생성이 없어 파일 경로 충돌도 없다. 전체적으로 신규 식별자 충돌 관점에서 차단 사유가 없고 INFO 수준의 보완 제안만 존재한다.

---

### 위험도

NONE
