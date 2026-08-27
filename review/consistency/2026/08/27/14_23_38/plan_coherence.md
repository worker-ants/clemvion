# Plan 정합성 검토 — spec/5-system/ (masking-residuals-0b195b)

## 조사 방법

프롬프트에 첨부된 target/plan 본문이 예산 초과로 생략되어, 워크트리에서 직접
`git diff origin/main...HEAD` (12 커밋) 및 관련 spec·plan 파일을 절대경로로 읽어
1차 자료로 사용했다. 핵심 변경은 `masking-expression-egress-split`(config echo
마스킹을 어댑터에서 egress 로 이관) 이며, 동일 작업이 완료 처리(`plan/complete/`)되고
후속 항목이 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재된
상태다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 정합성 결함을 찾지 못했다. 점검한 세 관점 각각의
근거는 다음과 같다.

### 1. 미해결 결정과의 충돌 — 발견 없음

- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 안에서 이번 target 변경과
  교차하는 유일한 "별도 결정 필요" 항목(두 Manual 엔드포인트 `error.code` 통일, line
  ~1360)은 이미 2026-08-22 사용자 결정으로 종결(`[x]`)되어 있고 이번 diff 범위와 무관하다.
- target 이 새로 내린 판단("config 는 egress-only 마스킹", "boundary masking parity" →
  "egress masking parity" 개명)은 `plan/complete/masking-expression-egress-split.md` 에서
  `19_26_06` CRITICAL 로 planner 턴을 거쳐 6개 spec 파일에 `spec_impact` 로 명시 반영된
  것으로 실측된다 — plan 을 우회한 일방적 spec 변경이 아니다.
- 개명("boundary" → "egress")이 인용처 전파 누락을 냈던 것도 이미 같은 세션의 커밋
  `6af73b2c8`("원칙을 개명해 놓고 인용처 3곳에 전파 안 했다")로 해소됐다 —
  `grep -rn "boundary masking parity" plan/in-progress/` 결과 0건.

### 2. 선행 plan 미해소 — 발견 없음

- target 이 전제하는 "config echo 를 다운스트림 표현식이 실제로 읽는다"는 재개 신호는
  `spec-sync-external-interaction-api-gaps.md` 의 기존 항목(`17_14_18` side_effect W1)이
  미리 지정해 둔 조건이었고, 이 PR 이 그 신호가 발화했음을 실측(`migrate-node-output-refs.ts`
  가 `$node["X"].config.<field>` 로 사용자를 이주시킴)한 뒤 착수했다 — 선행 조건이
  갖춰진 상태에서 시작된 작업이다.
- `plan/in-progress/**` 전역에서 `maskSensitiveFields`/`handler-output.adapter`/
  `config echo`/`DEFAULT_SENSITIVE_KEYS` 를 참조하는 다른 in-progress 항목을 확인했다
  (`node-output-redesign/*.md` 다수, `ie-resume-turn-boundary-cancel.md`,
  `spec-draft-eia-62-waiting-payload.md`). 전부 확인한 결과 이번 변경(어댑터의
  storage-time key-masking 제거)과는 **다른 축**을 다룬다 — echo 필드 완전성 갭
  (memory 필드 누락 등), WS 값-패턴 마스킹(`deepRedactSecrets`), waiting payload strip
  범위 등. 마스킹 *메커니즘 위치*가 바뀐 것을 전제로 깨지는 서술은 발견되지 않았다.

### 3. 후속 항목 누락 — 발견 없음 (이미 자체 등재됨)

이 변경이 만든 후속 파급(크로스-노드 자격증명 릴레이, safe-by-construction →
safe-by-convention 이동, DB/백업 등 제3경로 노출, `DEEP_REDACT_CACHE` identity 전제 약화,
`node-output.md` mutation-보호 단락 누락, predecessor 시딩의 stale 마스킹값, 리뷰
forced-coverage 자기검사 공허화, `chatChannel` 로컬 마스커 좁음)는 전부
`spec-sync-external-interaction-api-gaps.md` 에 이번 PR 자신이 작성 시점에 함께
등재했다(각 항목에 등재 시각·근거 라운드 명시, 미판정 항목은 "미판정으로 남긴다" +
재개 신호를 명시). 별도로 열어야 할 후속 plan 을 추가로 찾지 못했다.

부수적으로 확인한 사항(문제는 아님, 참고용):
- `spec/4-nodes/4-integration/1-http-request.md`·`3-send-email.md` 의 "자격증명 제거"
  서술은 `sanitizeUrlCredentials`/`integrationId` 간접화라는 **별개의, 여전히 유효한**
  방어이고, 이번에 제거된 어댑터 boundary 와 혼동되지 않는다 — target 문서(node-output.md,
  execution-history.md R-5)가 "남는 표면은 `authentication='custom'` 뿐"이라고 정확히
  좁혀 서술한 것과 일치한다.

## 요약

target(`spec/5-system/` 및 동반 `spec/conventions/*`, `spec/2-navigation/14-execution-history.md`
등) 변경은 `plan/complete/masking-expression-egress-split.md` 로 완료 처리된 단일 작업의
반영이며, planner 턴(`19_26_06` CRITICAL 해소)을 거쳐 6개 spec 파일에 `spec_impact` 로
명시됐다. 이 작업이 낳은 후속 파급은 전부 같은 커밋 세트 안에서
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 스스로 등재되어 있고,
등재되지 않은 채 남아 있는 미해결 결정 충돌·선행 plan 미해소·후속 누락을 이번 조사에서
찾지 못했다. `plan/in-progress/**` 전역에서 옛 마스킹 메커니즘(어댑터 boundary)을 전제로
하는 다른 진행 중 작업도 발견되지 않았다.

## 위험도
NONE
