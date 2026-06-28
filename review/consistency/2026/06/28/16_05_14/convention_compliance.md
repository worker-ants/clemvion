# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (diff-base: `origin/main`)  
검토 범위: `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### 1. [INFO] `12-webhook.md` frontmatter `status` 전이 — `partial` → `implemented` 정합 확인

- target 위치: `spec/5-system/12-webhook.md` frontmatter
- 관련 규약: `spec/conventions/spec-impl-evidence.md §3` (status 라이프사이클 · §3.1 전이 규칙)
- 상세: `status: partial` → `status: implemented` 로 승격하면서 `pending_plans: plan/in-progress/spec-sync-webhook-gaps.md` 참조가 제거됐다. `plan/complete/spec-sync-webhook-gaps.md` 가 실존(`plan/complete/` 확인)하여 `spec-pending-plan-existence.test.ts` 가드도 통과한다. `spec-status-lifecycle.test.ts` 의 "partial 의 pending_plans 모두 complete → implemented 승격 의무" 조건과 일치한다. `code:` 에 신규 파일 `codebase/backend/src/bootstrap/hooks-body-parser.ts` 도 추가됐다.
- 제안: 이상 없음. 가드 통과 요건 충족 확인.

---

### 2. [INFO] `PAYLOAD_TOO_LARGE` 에러 코드 명명 — `UPPER_SNAKE_CASE` 준수

- target 위치: `spec/5-system/3-error-handling.md §1.3` (신규 행)  
- 관련 규약: `spec/conventions/node-output.md §3.2` · `spec/conventions/error-codes.md §1`
- 상세: 신규 코드 `PAYLOAD_TOO_LARGE` 는 `UPPER_SNAKE_CASE` 로 정확히 명명됐고, 조건의 의미(페이로드 크기 초과)를 직접 기술하는 의미 기반 명명 원칙(`error-codes.md §1`)을 충족한다. 관련 도메인 prefix 없이 시스템 전역 공용 코드로 배치된 점도 `error-codes.md §1` 의 "시스템 전역 공용 코드는 prefix 없이 쓰는 기존 카테고리"(`VALIDATION_ERROR` 류) 와 일관된다.
- 제안: 이상 없음.

---

### 3. [INFO] `2-api-convention.md` HTTP 상태 코드 표 — 413 항목 추가 위치·형식

- target 위치: `spec/5-system/2-api-convention.md §6` (HTTP 상태 코드 표)
- 관련 규약: `spec/conventions/error-codes.md §1·§2` · `spec/5-system/2-api-convention.md §5.3` (SoT 지정)
- 상세: 413 항목을 409 바로 다음(숫자 오름차순)에 삽입한 점, `code` 기본값 목록에도 `413=PAYLOAD_TOO_LARGE` 를 동기 추가한 점 모두 기존 표의 형식 및 순서 관례를 유지한다. 에러 코드 표기(`PAYLOAD_TOO_LARGE`)도 `UPPER_SNAKE_CASE` 다.
- 제안: 이상 없음.

---

### 4. [INFO] `12-webhook.md` Rationale 섹션 — 위치 규약 부합

- target 위치: `spec/5-system/12-webhook.md` 끝 섹션 `## Rationale` 내 신규 소절 `### WH-NF-02 본문 크기 — 분리 임계(옵션 C) 결정 근거`
- 관련 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: 신규 소절이 기존 `## Rationale` 블록 내에 삽입됐고, 본문("기각 — 옵션 A/B", "채택 — 옵션 C", "구현 결정", "OOM 상한 클램프", "표준 413") 이 결정 배경과 근거를 명확히 기술한다. 구조 규약(`Overview / 본문 / Rationale` 3섹션)과 일치.
- 제안: 이상 없음.

---

### 5. [WARNING] `3-error-handling.md §1.3` — `PAYLOAD_TOO_LARGE` 가 §1.3 섹션 제목("유효성 검증 에러")과 의미 불일치

- target 위치: `spec/5-system/3-error-handling.md §1.3` 표 내 `PAYLOAD_TOO_LARGE` 신규 행
- 관련 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명 — 조건의 의미를 기술), `spec/5-system/3-error-handling.md §1.3` 섹션 제목 "유효성 검증 에러"
- 상세: `PAYLOAD_TOO_LARGE` 는 "요청 본문 크기 초과"(인프라/파서 레이어 한도)로, 사용자 입력 유효성 검증(`VALIDATION_ERROR`, `WORKSPACE_ID_REQUIRED`, `MODEL_CONFIG_INVALID` 등)과 개념상 레이어가 다르다. 현행 §1.3 섹션 제목이 "유효성 검증 에러"이고 400 계열 코드를 묶는 섹션인데, 413 코드를 그 안에 넣으면 섹션 의미론이 희석된다. API 규약(`2-api-convention.md §6`)에 413 을 별도 행으로 등재한 것과 비교할 때, 에러 카탈로그도 413 을 별도 소절로 분리하거나 §1.3 제목을 "입력 에러 (4xx)" 등으로 폭넓게 재정의하는 것이 더 일관된다.
- 제안 (둘 중 하나):
  1. `3-error-handling.md §1.3` 표 내 `PAYLOAD_TOO_LARGE` 행을 별도 소절(예: `### 1.3.1 본문 크기 에러` 또는 §1.3 과 §1.4 사이 `### 1.3a`)으로 분리.
  2. 또는 §1.3 제목을 "유효성 검증·입력 에러 (400·413)" 으로 확장해 413 포함을 명시.
  - 단, 이미 `2-api-convention.md §5.3` 과 `spec/conventions/error-codes.md §1` 이 이 코드에 위반을 선언하지 않고 있으므로 실제 invariant 가 깨지지는 않는다. 따라서 WARNING(규약과 거리감)으로 분류.

---

### 6. [INFO] `12-webhook.md` 본문 중 구현 참조 링크 정합 확인

- target 위치: `spec/5-system/12-webhook.md §4 (요청 테이블)` 내 `plan/in-progress/spec-sync-webhook-gaps.md` 링크 제거
- 관련 규약: `spec/conventions/spec-impl-evidence.md §4` (`spec-link-integrity.test.ts` — in-repo 링크 타깃 실존 의무)
- 상세: 기존 본문의 `[plan](../../plan/in-progress/spec-sync-webhook-gaps.md)` 링크가 제거됐다. 해당 파일은 `plan/complete/`로 이동해 `plan/in-progress/` 에 더 이상 없으므로, 링크를 제거한 것이 정합하다. 링크가 남아 있었다면 `spec-link-integrity.test.ts` 가 fail 했을 것.
- 제안: 이상 없음.

---

## 요약

이번 변경(`spec/5-system/` 내 `12-webhook.md`, `2-api-convention.md`, `3-error-handling.md`)은 webhook 본문 크기 분리 임계(옵션 C) 구현 완료를 spec 에 반영한 것이다. 명명 규약(`PAYLOAD_TOO_LARGE` `UPPER_SNAKE_CASE` 준수), 문서 구조 규약(Rationale 섹션 배치), 출력 포맷 규약(에러 봉투 형식·HTTP 상태 코드 표 동기), frontmatter 라이프사이클(`partial` → `implemented` 전이 + `pending_plans` 정리) 모두 정식 규약을 따른다. 유일한 개선 권고는 `3-error-handling.md §1.3` 섹션 내 `PAYLOAD_TOO_LARGE` 의 위치가 "유효성 검증 에러" 섹션 제목과 의미론적으로 다소 어긋난다는 점(WARNING)이며, 이는 invariant 를 깨지 않으므로 차단 요인이 아니다. 금지 항목 위반 없음.

## 위험도

LOW
