# RESOLUTION — errcode-wiring PR (그룹 1: 통합 에러코드 배선)

대상 리뷰:
- ai-review `review/code/2026/06/11/.../` 의 후속 — 본 branch 1차 `00_21_47`, 재리뷰 `00_32_18`
- consistency `--impl-done` `review/consistency/2026/06/12/00_31_31`

본 PR 범위: P0 #546(code isolated-vm)·#549(http SSRF 전 인증) 후속 **비-Critical 에러코드 배선 hygiene**.
codebase 변경 4파일 + spec 무변경(코드가 기존 spec §3.1 을 따라잡음) + plan 체크박스 갱신.

## ai-review 처리

### 1차 `00_21_47` — RISK=LOW, 0 Critical, 1 Warning

| # | 발견 | 처리 |
|---|------|------|
| W1 | `RE_*`·`LEGACY_TO_NORMALIZED`·`classifyCodeNodeError` 가 사용처(`CodeHandler.failure()`)보다 아래 선언 — 코드 탐색 저해 | **FIXED** (commit 2b93a3dc): 블록을 `CodeHandler` 클래스 선언 이전으로 이동(논리적 응집). 동작 무변경, 61 unit green. |

INFO(SSRF 메시지 일반화·legacyCode 노출·redirect 비대칭·`.env.example`·나머지 HTTP literal enum 화 등)은
전부 follow-up plan(`http-ssrf-all-auth-followups.md`)에 기등재 — 본 PR 범위 밖 유지.

### 재리뷰 `00_32_18` (W1 fix 반영 상태) — RISK=LOW, 0 Critical, 2 Warning

| # | 발견 | 처리 |
|---|------|------|
| W1 | `classifyCodeNodeError` 반환 타입이 `string` 으로 넓어 `LEGACY_TO_NORMALIZED` 키 완전성을 컴파일 단계에서 강제 못함 | **FIXED**: `type CodeNodeInternalErrorCode` union 신설 → 반환 타입·`failure()` 파라미터·`LEGACY_TO_NORMALIZED` 를 모두 union 기반으로 좁힘. `Record<CodeNodeInternalErrorCode, ErrorCodeValue>` 가 **exhaustive** 라 새 내부코드 추가 시 매핑 누락이 컴파일 에러. build/lint/61 unit green. |
| W2 | `extractStatusCode()` 가 `Number.isInteger` 만 검사 — `statusCode:0`/`-200` 통과. spec §3.1 `[400,499]`/`[500,599]` 범위 의도와 잠재 불일치 | **DEFERRED (범위 밖·pre-existing)** — 아래 근거. |

#### W2 deferral 근거
- `extractStatusCode()` 는 **본 PR diff 에 포함되지 않은 pre-existing 함수**다. 본 PR 의
  `execution-failure-classifier.ts` 변경은 `INTERNAL_CODES` Set 에 2개 코드 추가뿐.
- 해당 동작(`statusCode:0` 노출)은 이미 기존 테스트 `execution-failure-classifier.spec.ts`
  의 "W#4 boundary" 케이스에서 **"설계 의도 확인"** 으로 명시 문서화돼 있다.
- spec §3.1 의 `[400,499]`/`[500,599]` 범위 조건은 `HTTP_4XX`/`HTTP_5XX` 분기의 **placeholder
  치환 대상**에 대한 것이며, `extractStatusCode` 의 범용 추출에 범위 가드를 요구하는 의미가 아니다.
- 따라서 본 PR 에서 pre-existing 동작을 바꾸는 것은 scope creep 이고, 변경 시 기존 테스트 단언과
  충돌한다. 범위 가드 신설 여부는 **planner 의 spec §3.1 의도 확정**이 선행돼야 하는 항목으로,
  필요 시 별도 spec PR(그룹 2 카탈로그 정리) 또는 후속에서 다룬다.

INFO(spy 누수 `afterEach` 격리·결과 단언 중복·SSRF 경로 단위테스트·나머지 HTTP literal enum 화·
"refactor 04 C-3" 약어 주석)는 follow-up plan 에 연계하거나 그룹 3(테스트)에서 처리.

## consistency `--impl-done` `00_31_31` — BLOCK: YES (단, 범위 밖)

**판정: 본 PR 머지 비차단.** BLOCK 사유인 Critical 1건은
`spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 의 wrapper 필드 설명 오류로,
**본 PR 이 전혀 건드리지 않은 파일**이다. BLOCK 은 내가 consistency scope 를 `spec/conventions/`
전체로 과도하게 잡아 무관한 cafe24-api-catalog 레이어가 끌려온 결과다.

checker 자신이 명시: *"errcode-wiring 구현 자체(codebase 변경 4파일)는 NONE"*, cafe24 카탈로그
이슈는 *"errcode-wiring 구현 자체와는 직교"*. 본 PR 변경에 대한 5개 checker 판정:

| Checker | 본 PR 판정 |
|---------|-----------|
| Cross-Spec | NONE — §3.1 매핑 표와 완전 정렬 |
| Rationale Continuity | NONE — INTERNAL 등재·fallback 강화 모두 기존 Rationale 준수/강화 |
| Convention Compliance | (Critical 은 cafe24-api-catalog 무관 파일 — 본 변경 무관) |
| Plan Coherence | NONE — spec/conventions 변경 0건, plan 항목 정렬 |
| Naming Collision | NONE — `classifyCodeNodeError` 충돌 없음 |

### consistency INFO → follow-up 메모 (본 PR 범위 밖)
- pre-existing 갭: `SUB_WORKFLOW_NOT_FOUND/TIMEOUT/QUEUE_FAILED` 가 `INTERNAL_CODES` 미등재 →
  후속 PR 에서 등재 + spec §3.1 명확화 권장.
- cafe24-api-catalog Critical/Warning(appstore-orders.md wrapper·`Retreive` 오타·snake_case↔
  kebab-case 규약 텍스트·Rationale 부재)은 **planner 영역의 별도 spec 정리 항목**으로 분리 — 사용자/기획자에게 보고.
- `node-output-redesign/code.md` stale "로드맵 미구현" 서술 → 그룹 5 정리 대상.

## 최종 상태
build PASS · lint PASS · code.handler/http-request/classifier unit 199+ green. 0 Critical, 모든
in-scope Warning 해소. consistency BLOCK 은 범위 밖(무관 파일) 으로 비차단 판정.
