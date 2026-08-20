# 변경 범위(Scope) 리뷰 — eia-secret-pattern-token (2회차, review-fix 커밋 포함)

## 검증 방법

`git diff --stat origin/main...HEAD` 로 실제 diff (39개 파일, 두 커밋: `45ba37792` 최초 수정 +
`e2193f8a6` review-fix)를 프롬프트의 39개 파일 목록과 대조 — 정확히 일치, 프롬프트에 안 실린 숨은
변경 없음. 두 커밋 각각의 `git show --stat`으로 어느 파일이 어느 커밋에서 바뀌었는지 분리해 확인하고,
`e2193f8a6`(review-fix)의 실제 diff 를 그 커밋 메시지·`review/code/2026/08/17/14_00_15/RESOLUTION.md`
가 주장하는 WARNING 1~5 + consistency WARNING 1 + INFO 3건 처분 내역과 라인 단위로 대조했다.

## 발견사항

- **[INFO]** 이번 diff 는 이전 라운드(`14_00_15`/`13_31_57`/`14_00_50`)의 리뷰 산출물 26개 파일을
  그대로 저장소에 커밋한다
  - 위치: `review/code/2026/08/17/14_00_15/*`(10개), `review/consistency/2026/08/17/13_31_57/*`(7개),
    `review/consistency/2026/08/17/14_00_50/*`(7개) — 전부 신규 파일(`new file mode`)
  - 상세: 얼핏 "코드 리뷰 결과물이 왜 이 PR 에 섞여 있나"로 보이지만, `CLAUDE.md`가 코드 리뷰·
    consistency 산출물 저장 위치를 `review/code/**`·`review/consistency/**`로 명시 규정하고, "구현
    완료 후 자동 review/fix 는 상시 승인된 강제 의무"라고 못박은 표준 워크플로의 흔적이다. 실제로
    `e2193f8a6` 커밋 메시지("리뷰 WARNING 5건 처분")와 새로 추가된 `RESOLUTION.md`가 이 산출물들을
    근거 문서로 인용하며, `e2193f8a6`의 실 코드 변경(WS spec 회귀 테스트·JSDoc 좁힘·CHANGELOG·plan
    수치 정정·spec §R17 캐비엇)을 라인 단위로 대조한 결과 RESOLUTION.md 가 주장한 WARNING 1~5 +
    consistency WARNING 1 + INFO 3건과 정확히 1:1 대응한다 — 몰래 끼워 넣은 추가 변경 없음.
  - 제안: 조치 불필요.

- **[INFO]** (이전 라운드 scope.md 가 이미 지적한 항목, 재확인) `mcp-error-codes.ts` 흡수 + spec
  문서 정정 3건(`hmacAlgorithm` 출처·§11 `execution.stop` 각주·§2.2 인증 family)이 리터럴 티켓
  범위("`SECRET_LEAK_PATTERNS` 가 bare `token=` 을 안 잡는다") 밖이지만, `plan/in-progress/
  eia-secret-pattern-token-family.md` 최초 작성 시점부터 "곁들이는 저비용 문서 3건"으로 명시 선언되고
  `spec-sync-external-interaction-api-gaps.md` 트래커 체크박스로 추적된다.
  - 위치: `spec/5-system/14-external-interaction-api.md`, `spec/5-system/2-api-convention.md`,
    `codebase/backend/src/modules/mcp/mcp-error-codes.ts`
  - 제안: 조치 불필요(문서 근거 존재, 이전 라운드에서 이미 처분됨).

- **[INFO]** review-fix 커밋(`e2193f8a6`)이 건드린 프로덕션 코드 범위도 WARNING 처분에 정확히
  국한된다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts`(JSDoc 병합 + 범위 명시,
    +11/-9줄), `codebase/backend/src/modules/websocket/websocket.service.spec.ts`(회귀 테스트 신설),
    `codebase/backend/src/shared/utils/sanitize-error-message.ts`(JSDoc 재작성만, 정규식 자체는
    무변경), `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts`(쿼리스트링 보존
    단언 1건 추가)
  - 상세: `mcp-error-codes.ts`/`mcp-error-codes.spec.ts`는 `e2193f8a6`에서 전혀 건드리지 않았다 —
    RESOLUTION.md 가 "INFO 6(MCP no-op 루프 인라인 주석)은 선택 항목이라 코드 라운드를 더 열지
    않는다"고 명시한 것과 정확히 일치. 두 정규식 상수(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`)
    자체의 매칭 로직 변경은 이 커밋에 없고 순수 JSDoc·테스트·CHANGELOG·plan·spec 갱신뿐이다.
  - 제안: 조치 불필요.

## 확인했으나 스코프 이탈이 아닌 항목 (참고)

- 포맷팅/공백/불필요 리팩토링/미사용 import/설정 파일 변경: 두 커밋 어디에도 없음.
- `CHANGELOG.md` Unreleased 절 추가는 직전 4커밋이 확립한 관행을 이번에만 빠뜨렸다가 review-fix 로
  보완한 것 — 새 관행 도입이 아니라 기존 관행 준수.
- `plan/in-progress/eia-secret-pattern-token-family.md`의 "설계" 절 정규식 정정(`(?:[A-Za-z0-9]+
  [_-]?)?token` → shipped 코드와 일치하는 두 정규식)은 이전 라운드 maintainability INFO 를 그대로
  반영한 문서 정정이며 기능 변경이 아니다.

## 요약

이번 diff 는 두 커밋(`45ba37792` 최초 구현 + `e2193f8a6` 리뷰 WARNING/INFO 처분)의 합이며, 후자는
CLAUDE.md 가 강제하는 "구현 완료 후 review/fix" 워크플로의 정상 산출물이다. `git diff --stat`으로
확인한 39개 파일 전체가 프롬프트와 정확히 일치하고, review-fix 커밋의 실제 코드/문서 변경을
`RESOLUTION.md`가 주장하는 WARNING 5건·consistency WARNING 1건·INFO 3건 처분 내역과 라인 단위로
대조한 결과 벗어난 항목이 없다. `mcp-error-codes.ts` 흡수·spec 문서 정정 3건 등 리터럴 티켓 범위
밖으로 보이는 항목들도 최초 plan 작성 시점부터 명시 선언되고 트래커로 추적돼 "몰래 끼워 넣은 추가
수정"이 아니다. 포맷팅 뒤섞임·불필요 리팩토링·미사용 import·설정 파일 변경·무관한 파일 수정은
이번 회차에서도 발견되지 않았다.

## 위험도

NONE
