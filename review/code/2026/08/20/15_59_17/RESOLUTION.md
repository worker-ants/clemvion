# RESOLUTION — 15_59_17

대상 SUMMARY: `review/code/2026/08/20/15_59_17/SUMMARY.md` (Critical **0**, WARNING **9** — 전부 LOW)

**처분: 7건 수정 · 2건 트래커 등재.** 병행 consistency(`15_59_50`)는 **WARNING 0**(전 checker NONE~LOW), INFO 3건 중 1건을 같은 턴에 반영했다.

---

## W1 · W2 — 차단 판정 서술 **9곳**이 옛 형태에 머물러 있었다 (documentation) — **수정**

**내 라운드4 fix 가 만든 재발이다.** 차단 판정에 세 번째 조건(구조 필드 coerce 실패)을
더하면서 코드만 바꾸고, 그 판정을 서술하는 문장들은 옛 형태 그대로 뒀다. 리뷰어가 4곳을
짚었고, **그 4곳을 고친 뒤 내가 전수 스캔해 5곳을 더 찾았다**(아래).

> **이 브랜치에서 같은 형태가 4번째다** — 아래에 캐비엇을 덧붙이면서 **위의 결론 문장은
> 옛 값에 두는** 실수. (DTO JSDoc → spec.ts 소제목 → `ResponseExecution` 토픽 문장 → 이번.)

리뷰어가 지목한 4곳:

- `CHANGELOG.md` — "두 조건" → "세 조건", 세 번째 우회 경로(무효 JSON) 서술 추가
- `spec/5-system/14-external-interaction-api.md:1571` §R17 표 — Re-run 모달 행
- `spec/5-system/13-replay-rerun.md` §10.2 — 차단 해제 조건
- `plan/in-progress/eia-inputdata-marker-guard.md:125,156`

### 그리고 그 4곳을 고친 뒤 **내가 쓴 재발 방지 문장 자체가 거짓이었다**

*"그 수를 세는 문장 전부를 같은 편집에서 훑는다"* 고 적고서, 훑지 않은 채 이 문서를 썼다.
직후 `git grep` 으로 전수 스캔하니 **5곳이 더** 나왔다 — 그중 둘은 **코드 JSDoc**이고,
셋은 아예 **1라운드 술어**("비어 있는 동안")가 두 번의 개정을 지나 살아남은 것이다:

| 위치 | 상태 |
| --- | --- |
| `rerun-blocked` JSDoc 소제목 + 2행 표 (`rerun-modal.tsx`) | "두 조건" — 표 아래 `### 세 번째 조건` 을 덧붙인 그 형태 그대로. **5번째 재발** |
| `splitMaskedParameters` JSDoc (`rerun-modal.tsx`) | "그 키가 **비어 있는 동안** 제출을 막는다" — 1라운드 술어 |
| `CHANGELOG.md:10` | 같은 1라운드 술어 (세 조건 문단은 그 **아래**에 있었다) |
| `plan/…/spec-sync-…-gaps.md:307` · `eia-inputdata-marker-guard.md:117` | 같은 1라운드 술어 |
| `spec-draft-inputdata-egress-masking.md:102,218` | 초안 시점 문구 — 승계 노트로 표시(이력은 보존) |
| `rerun-modal.test.tsx:568` 테스트 이름 | *"비어 있는 동안"* 이라 **차단 원인을 오귀속**. 실제로 그 케이스를 막는 건 터치 조건이다 → 이름 정정 |

전부 조치했다. JSDoc 표는 3행으로 다시 짜고, 각 행에 *"이 조건이 빠지면 뚫리는 경로"* 를
붙여 **다음에 조건이 늘 때 이 표를 고쳐야 한다는 사실이 표 안에서 보이게** 했다.

> **교훈은 "훑어라" 가 아니다.** 나는 그렇게 적고도 안 훑었다. 재발 방지가 성립하려면
> 조치가 **행위 규칙이 아니라 산출물**이어야 한다 — 여기서는 조건 표 자체가 그 자리다.

## W4 — JSDoc 이 설명 대상과 떨어져 있다 (maintainability) — **수정**

`blockedByMaskedInput` 의 대형 JSDoc 과 그 선언 사이에 `isStructuredField` 헬퍼가 끼어
있었다. 헬퍼를 JSDoc 블록 **앞으로** 옮겨 문서-선언을 인접시켰다.

- `codebase/frontend/src/components/executions/rerun-modal.tsx`

## W5 — 구조 타입 술어가 같은 파일에 3중 (maintainability) — **수정**

`type === "object" || type === "array"` 가 `displayValue` · `coerceInput` ·
`isStructuredField` 셋에 흩어져 있었다. **차단 판정이 이 술어에 의존하게 된 라운드4부터
위험이 생겼다** — 한 곳만 넓히면 "JSON 으로 편집된다" 와 "차단 대상이다" 가 조용히 갈린다.
`isStructuredType(type)` 하나로 모았다.

- `codebase/frontend/src/components/executions/rerun-modal.tsx`

## W6 — 캐너리 ⑥ 이 `inputData` 표면을 안 본다 + 근거 주석이 stale (testing) — **수정**

ingestion 마커 보존 캐너리(`⑥`)가 `outputData` 만 겨눴고, 그 이유를 주석이
*"`inputData` 는 마스커를 아예 안 지나므로 거기서 단언하면 vacuous"* 라고 적어 뒀다.
**이번 PR 의 카브아웃 폐지가 바로 그 전제를 깼다** — `inputData` 도 관문을 지나므로
여기가 마커 보존의 진짜 미보호 지점이었다. webhook ingestion 이
`Execution.inputData.headers.authorization` 에 남긴 `[REDACTED]` 를 egress 값-마스커가
덮으면 같은 헤더가 읽는 표면마다 달라진다.

**재검증(뮤테이션)** — `sanitize-error-message.ts:284` 의 마커 보존을 제거
(`r = isMaskedMarker(v) ? v : VALUE_MASK_MARKER` → `r = VALUE_MASK_MARKER`):

| 단계 | 결과 |
| --- | --- |
| 뮤턴트 적용 | `Expected "[REDACTED]" / Received "***"` — **RED** (`:1294`, outputData) |
| outputData 단언만 무력화 후 재실행 | **RED** (`:1301`, **inputData**) — 신규 단언 단독 비-vacuous |
| 두 파일 원복 | `git diff` 에 마스커 파일 없음 (무변경 확인) |

> 첫 RED 가 outputData 라인이라 그것만 보고 "잡았다" 로 끝냈으면 **신규 단언의 유효성은
> 미검증**으로 남았을 것이다. 앞선 단언이 먼저 죽는 캐너리는 뒤 단언을 가린다.

- `codebase/backend/src/modules/executions/executions.service.spec.ts`

## W7 — i18n 카탈로그가 실제 문자열이 아니다 (documentation) — **수정**

`13-replay-rerun.md` §10.4 의 신규 키 행이 `…` 로 잘린 요약이었다. 코드의 ko/en dict
리터럴 전문으로 교체했다.

- `spec/5-system/13-replay-rerun.md`

## consistency `15_59_50` INFO-3 — **수정**

§R17 "닫는 조건은 충족됐다" 에 **보장의 경계**를 명시했다 — `isMaskedMarker` 는 값 전체가
마커와 정확히 일치할 때만 감지한다. 부분 치환형(`scheme://***@host`)은 감지 대상이
아니다. 자격증명은 이미 제거된 뒤라 노출 위험은 없지만 **round-trip 성질은 남는다**.

- `spec/5-system/14-external-interaction-api.md`

---

## 트래커 등재 (2건)

- **W3** — 차단 판정을 순수 함수로 추출해 진리표 8행을 직접 테스트. 지금은 컴포넌트 본문
  표현식이라 **모달을 렌더해 DOM 경유로만** 검증되고, 렌더 경유는 실질 도달 가능한 조합만
  친다(조건을 늘릴 때마다 우회로가 하나씩 나온 이유이기도 하다). 동작 무변경 리팩터라
  diff 성격이 갈려 이번엔 안 한다 — **조건이 넷째로 늘어나는 순간**이 착수 시점.
  → `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- **W8 · W9** — 서버측 마커 리터럴 거부 · 마커 미러 계약 테스트. **이미 등재분**이라 무조치
  (같은 파일 `14_44_08` W6 · `12_33_36` INFO-1 항목).

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (48s) |
| unit | PASS — backend jest **427 suites / 8,832** · frontend vitest **286 files / 6,064** · web-chat **23 / 451** |
| build | PASS (139s) + backend 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (215s) — backend supertest **276** · playwright **51** (로그 `51 passed (55.6s)` 실측) |

모달 스위트 단독 **28 passed**.
