# 신규 식별자 충돌 검토 — masked-marker-shared-package.md

## 검토 범위와 방법

target(`plan/in-progress/masked-marker-shared-package.md`)이 실제로 새로 도입하는 식별자는
`codebase/packages/masked-markers/` 패키지 경로(및 함의된 패키지명 `@workflow/masked-markers`) 하나뿐이다.
나머지(`MASKED_MARKERS`/`isMaskedMarker`/`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/
`MAX_REDACT_DEPTH`)는 이미 backend·frontend 양쪽에 **동일한 이름·동일한 의미**로 존재하는 심볼을
한 곳으로 병합하는 것이라 "신규 식별자 충돌" 범주가 아니다(오히려 기존 미러를 없애는 방향).
아래는 실제 저장소 상태를 grep/파일 대조로 확인한 결과다.

- `codebase/packages/` 기존 목록: `ai-end-reason`, `chat-channel-validation`, `expression-engine`,
  `graph-warning-rules`, `node-summary`, `sdk`, `web-chat-sdk` — `masked-markers` 이름은 없음.
- `.claude/test-stages.sh` `INTERNAL_PACKAGES` 배열, `.github/workflows/packages-checks.yml` 의
  `pathspecs`/`matrix.pkg` 두 손 목록 모두 `masked-markers`/`@workflow/masked-markers` 미포함 — 충돌 없음.
- 각 기존 패키지의 `package.json` `"name"` 필드는 전부 `@workflow/<디렉터리명>` 패턴
  (`@workflow/ai-end-reason` 등) — target 이 함의하는 `@workflow/masked-markers` 는 이 컨벤션과
  일치하고 기존 이름과 겹치지 않음.
- `MASKED_MARKERS`/`isMaskedMarker`/`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/
  `MAX_REDACT_DEPTH` 전수 grep(`codebase/`, `spec/`, `plan/`) 결과, 용례가 전부 이 마스킹 계약과
  일치한다 — 다른 의미로 쓰인 곳 없음.
- `MAX_SANITIZE_DEPTH`(websocket)는 target 이 명시적으로 "건드리지 않는다"고 선언하고 다른
  불변식(`>` vs `>=`, 상한 11 vs 10)임을 실측 표로 근거를 댐 — 이름·값이 비슷해 보여도 의도적으로
  분리된 상태이며, 병합을 시도하지 않으므로 충돌 항목이 아니다.
- `codebase/frontend/src/lib/utils/masked-markers.ts` 내부 전용 상수 `MAX_MARKER_SCAN_DEPTH` 는
  export 되지 않고 파일 밖 소비처가 없음(전수 grep 확인) — 재export 시 이름을 유지하든 바꾸든
  외부 충돌 위험이 없음.
- `plan/` 하위 `*masked*` 파일: `plan/complete/eia-masked-prefill-roundtrip-guard.md`,
  `plan/complete/spec-update-masked-reject-framing.md`, target 자신 — 파일명이 서로 다른
  하위 주제로 명확히 구분되어 충돌 없음.
- API endpoint·webhook/queue/SSE 이벤트명·ENV/설정키 신설은 target 에 없음(순수 내부 패키지
  추출) — 해당 관점(3~5)은 target 범위에 해당 사항 없음.

## 발견사항

- **[INFO]** 깊이 상한 상수의 패키지 내 canonical 이름 미정
  - target 신규 식별자: `codebase/packages/masked-markers/` 가 export 할 깊이 상한 상수의 이름
  - 기존 사용처: backend `sanitize-error-message.ts:112` `export const MAX_REDACT_DEPTH = 10` (5개
    소비 파일에서 이 이름으로 import) / frontend `masked-markers.ts:96`
    `const MAX_MARKER_SCAN_DEPTH = 10`(비-export, 파일 내부 전용)
  - 상세: target 표(§"무엇을 옮기나")는 두 이름을 나란히 적어 "같은 값의 미러"임을 밝혔지만,
    패키지가 내부적으로 어떤 이름을 canonical 로 export 할지는 명시하지 않았다. 작업 항목에는
    "backend/frontend 파일이 재export 유지"라고만 돼 있어 구현 단계에서 이름이 정해질 것으로
    보이나, 두 재export 별칭이 실제로는 하나의 canonical 값을 가리킨다는 사실이 패키지
    README/JSDoc 에 명시되지 않으면 향후 제3의 소비처가 어느 이름이 SoT 인지 헷갈릴 수 있다.
    충돌이라기보다 명확화 여지.
  - 제안: 패키지 내부 canonical 이름(예: `MAX_MASK_DEPTH`)을 하나 정하고, backend/frontend
    재export 파일에서 그 이름에 대한 별칭(`export { MAX_MASK_DEPTH as MAX_REDACT_DEPTH }` 등)임을
    JSDoc 한 줄로 명시하면 이관 후 "어느 이름이 진짜냐"는 혼선을 예방할 수 있다.

## 요약

target 이 실제로 새로 도입하는 식별자는 패키지 경로/이름(`codebase/packages/masked-markers/`,
함의된 `@workflow/masked-markers`) 하나뿐이며, 기존 7개 내부 패키지 이름·등록 표(`INTERNAL_PACKAGES`
배열, `packages-checks.yml` pathspec/matrix)·package.json 명명 컨벤션 어디와도 겹치지 않는다. 이관
대상 심볼들(`MASKED_MARKERS`/`isMaskedMarker`/마스크 리터럴 3종/`MAX_REDACT_DEPTH`)은 이미 두 런타임에
동일한 이름·의미로 존재하던 것을 병합하는 것이라 "신규 식별자가 기존 다른 의미와 충돌"하는 사례가
아니며, 오히려 `MAX_SANITIZE_DEPTH`(websocket)처럼 이름이 비슷해도 다른 불변식을 가진 이웃 상수는
실측 근거로 명시적으로 병합 대상에서 제외해 혼동을 예방하고 있다. API endpoint·이벤트명·ENV/설정키·
요구사항 ID 신설은 이 target 범위에 없다. CRITICAL/WARNING 급 충돌은 발견되지 않았고, 패키지 내부
canonical 상수명 미정 1건만 INFO 로 남긴다.

## 위험도

NONE
