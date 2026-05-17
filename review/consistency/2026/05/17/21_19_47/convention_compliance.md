# Convention Compliance Check — `cafe24-call-401-retry-after-spec`

검토 모드: `--impl-prep` (구현 착수 전)
검토 범위: Cafe24 `call()` 401 자동 재시도+갱신 구현 준비

---

## 발견사항

### 발견사항 없음 (CLEAR)

점검 관점 1~5 모두 위반 없음.

---

## 상세 점검 결과

### 1. 명명 규약

**Target 문서 내 신규 식별자/파일명 없음.**

- plan 파일: `plan/in-progress/cafe24-call-401-retry.md` — 평문 파일명, CLAUDE.md 명명 컨벤션 준수.
- plan frontmatter: `worktree: cafe24-401-refresh-a3f2c1`, `started: 2026-05-17`, `owner: developer` — 필수 3필드 모두 존재.
- 구현 대상 메서드 이름(`tryRefreshAndRetry`, `triedAuthRetry`)은 snake_case 아닌 camelCase — TypeScript 코드 영역이므로 규약 외(spec/conventions 는 파일·API endpoint 명명만 규율).
- `refreshViaQueue` source label 신규 추가 없음(plan §코드 4번째 bullet "새 source label 추가 금지" 명시) — 규약 준수.

### 2. 출력 포맷 규약

`spec/conventions/node-output.md` 기준 점검.

- **에러 코드 `CAFE24_AUTH_FAILED`**: spec §6 표에서 401 reactive refresh 경로와 403 즉시 격하 경로 양쪽을 동일 코드로 집계 — Principle 0 (5필드 불변) 및 §6 에러 코드 vocabulary와 정합. 신규 에러 코드 추가 없음.
- **output 구조**: 401 재시도 후 성공 시 동일 success 포트로 반환 (Principle 1 — output 에 실행 메트릭 미노출). 재시도 횟수(`retry count`)가 `output` 이 아닌 `meta`에만 잠재적으로 기록될 수 있음 — spec은 현재 이를 명시하지 않으나 Principle 2 방향과 부합하며 위반 아님.
- **`meta.statusCode`**: 재시도 성공 시 2차 응답의 statusCode 가 기록되어야 함 — spec §10 step 10 "응답 파싱"은 최종 응답을 기록하는 방식으로 자연스럽게 충족. 별도 규약 위반 없음.

### 3. 문서 구조 규약

- `spec/4-nodes/4-integration/4-cafe24.md`: `N-` prefix 준수(`4-cafe24.md`), 문서 상단 `## Overview`, 본문, 끝에 `## Rationale` — 3섹션 권장 구조 충족.
- 401 관련 spec 개정(§6.1 전면 교체 + §4 step 9 + §6 표 + CHANGELOG)은 plan 에서 `[x]` 완료로 표기 — 기존 파일에 인라인으로 반영하는 방식으로 별도 신규 spec 파일 불필요, 규약 준수.
- 새 별도 `spec/` 파일 미생성 — CLAUDE.md "정식 규약 신규 파일은 `spec/conventions/<name>.md` 평문" 위반 소지 없음.

### 4. API 문서 규약 (OpenAPI/Swagger)

- 본 구현은 `Cafe24ApiClient` 내부 retry 로직 변경으로, 외부 API endpoint 신규 추가/변경 없음.
- `spec/conventions/swagger.md` 관련 데코레이터·DTO 패턴 영향 없음.

### 5. 금지 항목

- **무한 retry 금지**: plan §코드에서 "재시도 분기 식별: `triedAuthRetry` boolean 인자 또는 별도 wrapper 로 분리, **재귀로 무한 retry 발생 금지**" 명시 — 규약 정신과 일치.
- **spec 직접 수정(developer skill)**: plan에서 spec 갱신은 project-planner skill로 이미 완료(`[x]`). 구현 단계에서 spec 수정 없음 — developer skill의 `spec/ read-only` 규칙 준수.
- **`claude -p` / SDK 호출**: 구현 대상 코드(`cafe24-api.client.ts`)는 외부 LLM 호출 없음. 금지 규약 비적용.
- **`plan/` 최상위 위치 금지**: plan 문서가 `plan/in-progress/` 하위에 위치 — 준수.

---

## 요약

`cafe24-call-401-retry-after-spec` 범위의 구현 착수 전 정식 규약 준수 점검 결과, 신규 spec 문서 없이 기존 파일 내 갱신으로 완결된 변경이며, 명명·출력 포맷·문서 구조·API 문서·금지 항목 모든 관점에서 위반 사항이 발견되지 않았다. 구현 착수를 차단할 CRITICAL 또는 WARNING 이 없다.

---

## 위험도

NONE
