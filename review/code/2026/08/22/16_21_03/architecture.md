# 아키텍처(Architecture) Review 결과

## 리뷰 범위 메모

이번 diff 는 **프로덕션 코드 변경이 없다.** 실제 코드 변경은
`codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 한 파일이며, 기존
`it('caps recursion depth ...')` 테스트 하나를 `describe('깊이 상한 경계 (MAX_REDACT_DEPTH)', ...)`
블록(8개 `it`)으로 대체하는 순수 테스트 추가다. 나머지 변경분(`plan/complete/*.md` 신규 2건,
`plan/in-progress/*.md` 삭제 2건, `review/code/**`·`review/consistency/**` 산출물)은 이미 머지된
선행 PR(#1189~#1191)의 워크트리 반영 + 이 PR 자체의 리뷰/컨센시스턴시 산출물이다. 이들은
아키텍처 관점에서 검토할 "설계"가 아니라 작업 이력 문서이므로, 아래 발견사항은 실질적으로
테스트 파일 자체와 그것이 검증하는 `sanitize-error-message.ts` 의 기존 구조 정합성에 한정된다.

## 발견사항

- **[INFO]** 테스트가 비공개 구현(`deepRedactCore`)이 아니라 공개 API(`deepRedactSecrets`)만
  통해 깊이 상한 경계를 검증 — 캡슐화 경계를 존중하는 설계
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (신규
    `describe('깊이 상한 경계 (MAX_REDACT_DEPTH)', ...)` 블록 전체, 예: 302-304행)
  - 상세: 새 테스트 8종 전부가 `deepRedactSecrets(...)` 호출 결과만 단언한다. 내부 재귀 함수
    `deepRedactCore`(`sanitize-error-message.ts:259` 부근, export 되지 않음)를 직접 호출하거나
    그 내부 분기를 화이트박스로 흉내 내지 않는다. 리스코프/인터페이스 분리 관점에서 테스트가
    구현 세부에 결합되지 않아, 내부 리팩터링(재귀 → 반복문 전환 등)이 있어도 공개 계약이
    유지되는 한 테스트가 깨지지 않는다.
  - 제안: 조치 불필요. 유지할 패턴.

- **[INFO]** 상한 값을 리터럴로 박지 않고 SoT 상수(`MAX_REDACT_DEPTH`, 실제로는
  `@workflow/masked-markers` 의 `MAX_MASK_DEPTH` 지역 별칭)를 import — 테스트-구현 결합이
  "값"이 아니라 "선언"을 향해 있어 결합 방향이 옳다
  - 위치: `sanitize-error-message.spec.ts` import 절(게이트 7행, `MAX_REDACT_DEPTH` 추가)
    + 각 경계 테스트의 `nestObj(MAX_REDACT_DEPTH, ...)` 호출부
  - 상세: 실측 확인 — `sanitize-error-message.ts:128` `export const MAX_REDACT_DEPTH =
    MAX_MASK_DEPTH;` (패키지 canonical 값의 지역 별칭), `:270` `if (depth >= MAX_REDACT_DEPTH)
    return VALUE_MASK_MARKER;`. 테스트가 상수를 import 해 쓰므로 SoT 값이 바뀌면(패키지 쪽)
    테스트가 자동으로 따라가고, **마스커의 비교 연산자(`>=`)나 분기 순서가 어긋나는 경우에만**
    실패한다 — 이는 plan 문서(`plan/complete/masked-marker-shared-package.md` 후속 절)가
    스스로 실측한 목표("상수 값 변경은 프런트가 잡고, 마스커 비교식 변형은 backend 만 잡는다")와
    정확히 부합하는 구조다. 값과 알고리즘을 검증 책임으로 분리한 설계.
  - 제안: 조치 불필요.

- **[INFO]** 세 개의 서로 다른 깊이 상한 불변식(`MAX_REDACT_DEPTH` `>=`/`VALUE_MASK_MARKER`,
  `MAX_SANITIZE_DEPTH` `>`/`DEPTH_MASK_MARKER`, `stripExternalOnlyFields` `>`/서브트리 보존)을
  의도적으로 통합하지 않고 분리 유지 — "공유 프리미티브 확장이 무관 경로를 오염시킨다"는
  안티패턴을 회피한 결정
  - 위치: `plan/complete/masked-marker-shared-package.md` (`### MAX_SANITIZE_DEPTH(websocket)는
    건드리지 않는다` 절) — 코드상으로는 `sanitize-error-message.ts:270`
    (`depth >= MAX_REDACT_DEPTH`) vs `websocket.service.ts` 의 `depth > MAX_SANITIZE_DEPTH`
    비교 연산자 차이로 실측 가능
  - 상세: 세 상한이 같은 숫자(10)를 공유하지만 서로 다른 계층(에러 메시지 새니타이즈 /
    WS 페이로드 새니타이즈 / 외부 노출 필드 스트립)의 서로 다른 불변식이다. 억지로 하나의
    공유 상수·공유 비교 로직으로 합쳤다면 한쪽의 의미 변경이 다른 계층에 원치 않는 동작 변경을
    유발했을 것이다(예: WS 마스킹 깊이가 11→10 으로 조용히 바뀜). 이번 신규 테스트는 정확히
    `MAX_REDACT_DEPTH` 하나만 겨냥하고 나머지 둘의 `>` 경계는 명시적으로 건드리지 않는다고
    JSDoc 에 못박아, 세 레이어의 경계가 향후에도 실수로 뒤섞이지 않게 캐너리를 걸었다.
  - 제안: 조치 불필요. 향후 세 번째 재귀 진입점(WS sanitizer)에 동일 패턴의 경계 테스트를
    추가할 때도 이 분리를 유지할 것.

## 요약

이번 PR 의 diff 는 프로덕션 아키텍처를 변경하지 않는 순수 테스트 추가다. SOLID·레이어 분리·
결합도·순환 의존성·모듈 경계 어느 관점에서도 위반 사항이 없다. 오히려 테스트가 (1) 공개 API 만
통해 검증해 캡슐화를 존중하고, (2) 매직 리터럴 대신 SoT 상수를 import 해 값과 알고리즘의 검증
책임을 분리했으며, (3) 서로 다른 세 깊이 불변식을 통합하지 않고 분리 유지하는 기존 설계 결정을
명시적 캐너리로 고정한 점에서 아키텍처적으로 바람직한 패턴을 강화한다. 함께 커밋된 `plan/**`
문서들은 이미 머지된 선행 PR(#1189~#1191)의 워크트리 반영 이력이며 이번 diff 의 코드 아키텍처에
영향을 주지 않는다.

## 위험도
NONE
