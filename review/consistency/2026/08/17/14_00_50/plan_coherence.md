# Plan 정합성 검토 — `spec/5-system/` (eia-secret-pattern-token, impl-done)

## 검토 방법

- 대상 diff: `git diff origin/main...HEAD -- code_areas` — `sanitize-error-message.ts`(값-패턴
  `SECRET_LEAK_PATTERNS` + 키-패턴 `CREDENTIAL_KEY_PATTERN`), `websocket.service.ts`(동명
  키-패턴 미러), `mcp-error-codes.ts`(`MCP_EXTRA_SECRET_PATTERNS` 흡수)의 `token` 계열 확장.
- 소유 plan: `plan/in-progress/eia-secret-pattern-token-family.md` (본 워크트리).
- 연관 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(트래커, 이 작업의
  출처 항목 보유) · `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`(다른 worktree
  `eia-masking-round2-53afc8` 소유, 순서 의존 관계를 명시).
- target(`spec/5-system/`) 내 `11-mcp-client.md §8.3`·Rationale, `14-external-interaction-api.md`
  §R17/§11/§2, `2-api-convention.md §2.2` 를 diff·plan 서술과 대조.

## 발견사항

없음 (CRITICAL/WARNING 미발견). 아래는 검토 과정에서 명시적으로 확인·해소한 잠재 충돌
지점의 기록이다 (INFO, 추적 목적).

- **[INFO]** 순서 의존 선행 plan 확인 — 위반 없음
  - target 위치: (해당 없음 — 코드 diff 의 패턴 확장 자체)
  - 관련 plan: `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 말미
    `> **token= 패턴 확장은 이 PR 에 넣지 않는다** — 사용자가 순서를 택했다. 그 확장은
    마스킹 대상을 넓혀 이 왕복 오염 범위도 함께 넓히므로, 가드가 선 뒤에 하는 것이 맞다.`
  - 상세: 그 plan(다른 worktree 소유)은 "마스킹된 값이 폼에 프리필돼 재제출된다" 왕복
    오염 가드(마커 기반 `MASKED_MARKERS`/`isMaskedMarker`, #1181)를 **선행 조건**으로 명시하고
    본 작업(`token` 계열 패턴 확장)을 **그 뒤로** 미뤄 뒀다. 실측: 가드 커밋
    `c9cc2a923`(`fix(frontend): 마스킹된 폼 기본값이 프리필돼...` #1181)이 본 브랜치
    `claude/eia-secret-pattern-token` 히스토리에서 토큰 패턴 확장 커밋
    `45ba37792`**보다 선행**한다 — 순서 제약이 지켜졌다. 추가로 마커 감지가 값의 리터럴
    (`***`/`[REDACTED]`/`[REDACTED_DEPTH]`, `MASKED_MARKERS` 상수 exact-match)에만 의존하고
    "어느 패턴이 마스킹을 유발했는가"에는 의존하지 않음을 `sanitize-error-message.ts:110-150`
    에서 확인 — `token` 계열 확장으로 새로 마스킹되는 값들도 동일 마커(`***`)를 남기므로
    가드가 그대로 커버한다. 왕복 오염 범위가 넓어진 것은 사실이나 가드 메커니즘이 이미
    일반화돼 있어 별도 갱신이 불필요하다.
  - 제안: 조치 불요. (참고: `eia-masked-prefill-roundtrip-guard.md` 자체는 `worktree:
    eia-masking-round2-53afc8` 소유이고 체크리스트 마지막 항목 `[ ] push → PR` 이 미체크인
    채로 `plan/in-progress/` 에 남아 있다 — 커밋은 이미 본 브랜치에 병합돼 있으므로 lifecycle
    정리는 그 worktree/세션의 몫이며 본 작업의 책임 범위 밖이다.)

- **[INFO]** 소유 트래커 항목의 범위 결정과 diff 의 일치 확인
  - target 위치: `spec/5-system/11-mcp-client.md §8.3`+Rationale(`에러 message redaction 은
    공용 패턴 재사용`), `spec/5-system/14-external-interaction-api.md §R17`
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "`SECRET_LEAK_
    PATTERNS` 가 bare `token=` 을 안 잡는다" 항목(`[x]`) 및 자매 "workflow-assistant LLM
    도구가 …더 약한 마스킹" 항목(`[ ]`, 미결 유지)
  - 상세: 트래커는 마스킹 목록 4곳(① `SECRET_LEAK_PATTERNS` 값-패턴, ② `sanitize-error-
    message.ts CREDENTIAL_KEY_PATTERN` 키-패턴, ③ `websocket.service.ts` 동형 미러, ④
    `mask-sensitive-fields.util.ts DEFAULT_SENSITIVE_KEYS`) 중 **①②③만 닫고 ④는 범위 밖으로
    유지**(사용자가 이미 "range 밖"으로 결정한 workflow-assistant 항목의 소유물이며 마스킹
    형태가 다름 `****<last4>` vs `***`)한다고 명시했다. 실제 diff 는 정확히 ①②③만
    건드리고 `mask-sensitive-fields.util.ts` 는 무변경 — 소유 plan 의 범위 결정과 diff 가
    일치한다. `11-mcp-client.md` §8.3/Rationale 도 "2026-08-17 갱신 — 훅이 비었다" 문구로
    `MCP_EXTRA_SECRET_PATTERNS` 흡수를 이미 반영해 target 이 최신 상태다.
  - 제안: 조치 불요.

## 요약

이번 작업(`token` 계열 값·키 패턴 마스킹 확장)의 소유 plan(`eia-secret-pattern-token-
family.md`)은 트래커(`spec-sync-external-interaction-api-gaps.md`)가 남긴 범위 결정(①②③만
닫고 workflow-assistant 의 ④는 건드리지 않음)을 정확히 따랐고, target spec(`11-mcp-client.md`
§8.3·Rationale, `14-external-interaction-api.md` §R17/§11/§2.2)도 실제 코드 변경과 함께 이미
동기화돼 있다. 유일하게 확인이 필요했던 선행 조건 — 다른 worktree 의
`eia-masked-prefill-roundtrip-guard.md` 가 명시한 "마커 가드가 먼저, 패턴 확장은 그 뒤"
순서 제약 — 은 커밋 순서(`c9cc2a923` → `45ba37792`)로 실측 확인했고, 가드 메커니즘이
리터럴 마커 exact-match 로 일반화돼 있어 패턴 확장이 가드를 우회하거나 무효화하지 않는다.
CRITICAL/WARNING 급 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락은 발견되지 않았다.

## 위험도

NONE
