# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done)

## 조사 방법

`git diff origin/main...HEAD` 로 실제 변경분을 확인 (prompt 에는 대상 spec 본문이 컨텍스트 예산 초과로
생략되어 있었으므로, 직접 diff 를 열어 target 이 도입하는 식별자를 특정했다):

- spec 변경 3파일: `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`,
  `spec/5-system/14-external-interaction-api.md` — 모두 문구 정정/주석 추가 (자기-반증형 소정정: "boundary
  masking parity" → "egress masking parity" 용어 정정 + `maskSensitiveFields` boundary 제거 사실의
  명문화).
- 코드 변경 5파일: `mask-sensitive-fields.util.ts`(상수 export 전환), `handler-output.adapter.ts`
  (config echo 마스킹 제거 + 주석), `execution-context.service.ts`(JSDoc 추가), `websocket.service.ts`
  (용어 정정), `ai-turn-executor.ts`(주석 정정).

이 diff 는 **새 요구사항 ID·엔티티·endpoint·이벤트·ENV 변수·파일을 도입하지 않는다** — 기존 용어의
정합화(용어 통일)와 주석/문서 보강이 전부다. 아래는 그럼에도 "새 식별자"에 준하는 변경 2건을 확인한
결과다.

## 발견사항

### 1. 용어 교체 "boundary masking parity" → "egress masking parity" — 충돌 아님, 기존 용어와 정합

- target 신규(?) 식별자: `egress masking parity` (spec/5-system/4-execution-engine.md L1530,
  spec/5-system/6-websocket-protocol.md L196, spec/5-system/14-external-interaction-api.md 주변)
- 기존 사용처: `spec/2-navigation/14-execution-history.md:467,469` — 이미 2026-08-16 시점부터
  **동일한 의미**로 "egress masking parity" 를 쓰고 있었다 (`git grep -n "egress masking parity"` 로 확인).
- 상세: 이번 diff 이전에는 `spec/5-system/` 3개 파일만 옛 용어 "boundary masking parity" 를 쓰고 있어
  같은 원칙(EIA §R17)을 가리키는 두 개의 다른 이름이 spec 영역 간에 공존하는 상태였다. target 은 이
  drift 를 없애고 이미 정착된 "egress masking parity" 로 통일한다 — 즉 **새 식별자를 도입한 것이 아니라
  기존 용어와의 충돌(drift)을 해소**했다.
- 판정: 충돌 없음(오히려 사전에 존재하던 용어 불일치를 닫음). `plan/complete/*.md` 아카이브 3개 파일에는
  옛 표현 "boundary masking parity" 가 여전히 남아 있으나, 이들은 완료된 1회성 이력 문서라 컨벤션상
  소급 수정 대상이 아니다 — 새 충돌로 등재하지 않는다.

### 2. `DEFAULT_SENSITIVE_KEYS` export 전환 — 충돌 없음

- target 신규 식별자: `export const DEFAULT_SENSITIVE_KEYS` (이전엔 파일-로컬 미export 상수였음,
  `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:10`)
- 기존 사용처 검색: `grep -rn "DEFAULT_SENSITIVE_KEYS" --include=*.ts codebase/` 로 backend 전역 확인.
  이름이 겹치는 다른 export 는 없다 (`DEFAULT_*` 상수 전수 grep 결과 동일 이름 0건 — 가장 가까운 것은
  `DEFAULT_MEMORY_TOKEN_BUDGET`/`DEFAULT_FILE_MAX_*` 등 별개 도메인).
- 상세: 새 소비처는 같은 backend 모듈 내부 spec 테스트(`mask-sensitive-fields.util.spec.ts`,
  포함관계 캐너리)뿐이며, export 범위가 넓어졌을 뿐 이름 자체의 의미 충돌은 없다.
- 판정: 충돌 없음.

### 3. API endpoint / 이벤트 / ENV var / 파일 경로 — 신규 도입 없음

- `git diff origin/main...HEAD -- codebase/` 에서 `@Get/@Post/@Put/@Delete/@Patch/@OnEvent/
  @MessagePattern/process.env./emit(` 패턴을 전수 grep 했으나 신규 추가된 라인이 0건이다.
- 새로 생성된 spec 파일도 없다(변경된 3개 spec 파일 모두 기존 파일의 라인 수정).
- 판정: 해당 관점들은 이번 diff 범위에서 적용 대상이 없다(N/A).

## 요약

target 변경은 spec/5-system/ 3개 파일에서 이미 다른 spec 영역(`spec/2-navigation/14-execution-history.md`)에
2026-08-16 부터 정착돼 있던 "egress masking parity" 용어로 통일하는 자기-반증형 소정정이며, 코드 측에서는
기존 파일-로컬 상수 하나를 export 로 승격했을 뿐이다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·
ENV 변수·spec 파일 경로 중 어느 축에서도 새로 도입되는 식별자가 기존 사용처와 다른 의미로 충돌하는
사례를 찾지 못했다. 오히려 이번 변경은 사전에 존재하던 용어 drift(같은 개념을 가리키는 두 이름의 공존)를
줄이는 방향이다.

## 위험도

NONE
