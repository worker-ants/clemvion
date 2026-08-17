# Plan 정합성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위 요약

이번 diff 는 좁다 — "마스킹된 폼 기본값이 프리필돼 실제 입력으로 제출되는" 결함을 닫는
PR 이다.

- 코드: `sanitize-error-message.ts`(마커 상수 JSDoc 재배치), `dynamic-form-ui.tsx`(`isMaskedMarker`
  가드 신설), 관련 테스트/i18n/유저가이드
- spec: `spec/5-system/14-external-interaction-api.md`(§R17 "닫는 조건" 갱신 + "프리필 왕복"
  불릿 신설), `spec/5-system/15-chat-channel.md`(R-CC-15 `nodeName`→`nodeLabel`),
  `spec/4-nodes/1-logic/12-background.md`(nodeExecutions 마스킹 대상에 `outputData`/`inputData` 추가)

대응하는 작업 plan 은 `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`(체크리스트
"코드 동결 → 최종 게이트 → push" 1건만 미완).

## 발견사항

- **[INFO]** §R17 "닫는 조건" 텍스트가 부분 해소만 정확히 주장하고 있음 — 확인됨, 문제 없음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17, `Execution.inputData`
    잔여 캐비엇 "닫는 조건" 문단
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
    `- [ ] **inputData egress 마스킹 — 프런트 마커 가드가 선행돼야 한다**` (미체크로 유지)
  - 상세: target 은 "그 가드의 **첫 조각**이 2026-08-17 에 섰다 … Re-run 모달·에디터 히스토리
    로드에 같은 가드를 확장하면 **이 컬럼도 닫을 수 있다**" 로 서술해, 이번 PR 이 닫는 것은
    `waiting_for_input` 폼 프리필 소비처 하나뿐이고 Re-run 모달/히스토리 로드(별도 소비처)는
    여전히 열려 있음을 명시한다. 이는 정본 트래커의 해당 항목이 여전히 `[ ]` 인 것과 정확히
    일치 — target 이 미해결 항목을 조기에 "닫힘" 으로 선언(과잉 주장)하지 않았다.
  - 제안: 조치 불요. plan_coherence 관점에서 정합성이 확인된 사례로 기록.

- **[INFO]** 마스킹 대상 판단 기준("외부로도 나가는가")이 기존에 개별적으로 내려진 결정과
  일치
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "프리필 왕복" 신규 불릿
    의 "**판단 기준**: 마스킹 대상이 *외부로도 나가는가* 를 먼저 본다 — 나가면 마커 가드,
    안 나가면 카브아웃이 값싸다"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
    `- [ ] **inputData egress 마스킹**` 하위 "범위 정정 (2026-08-17)" — `Execution.inputData`
    (카브아웃, 외부 미노출) vs `NodeExecution.inputData`(마스킹 대상, 외부 노출 있음 — WS emit)
    로 정확히 같은 기준을 앞서 적용
  - 상세: target 이 이 기준을 일반 원칙으로 명문화했는데, 이미 트래커에 개별 사례로 적용된
    결정과 정확히 부합한다 — 새 결정을 일방적으로 내린 것이 아니라 기존 결정을 일반화한
    서술이다.
  - 제안: 조치 불요.

- **[INFO]** `spec_impact` frontmatter ↔ 실제 diff 파일 목록 일치
  - target 위치: 3개 spec 파일 diff (`14-external-interaction-api.md`,
    `15-chat-channel.md`, `12-background.md`)
  - 관련 plan: `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` frontmatter
    `spec_impact:` 목록
  - 상세: frontmatter 가 선언한 3개 파일과 실제 `git diff origin/main...HEAD -- spec/` 가
    변경한 3개 파일이 정확히 일치. drift 없음.
  - 제안: 조치 불요.

- **[INFO]** `14-external-interaction-api.md` frontmatter `code:` 목록이 이번 diff 로 늘어난
  코드 SoT(`sanitize-error-message.ts`, `dynamic-form-ui.tsx`)를 반영
  - target 위치: frontmatter `code:` 블록
  - 관련 plan: `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 체크리스트
    `--impl-done (12_34_24)` 항목이 "WARNING 1(frontmatter code: 증거 2건 누락)" 을 같은
    턴에 반영했다고 기록
  - 상세: 실제로 두 파일이 `code:` 목록에 이미 포함돼 있음 — 확인됨.
  - 제안: 조치 불요.

미해결 결정과의 충돌(CRITICAL 후보), 선행 plan 미해소, 후속 항목 누락 — 세 관점 모두에서
실질적 결함을 찾지 못했다. `spec-draft-eia-62-waiting-payload.md`·
`spec-draft-eia-notification-payload-contract.md`·`eia-context-schema-followups.md`·
`eia-terminal-payload.md`·`retry-turn-terminal-guard.md` 등 인접 EIA/실행엔진 plan 은 이번
diff 의 변경 표면(폼 프리필 마스킹 가드)과 겹치는 결정 항목이 없으며, `node-output-redesign/
form.md` 는 Form **노드 핸들러**(엔진 config 해석)를 다뤄 이번 PR 이 건드리는
`DynamicFormUI`(waiting_for_input 프리젠테이션 렌더러)와 다른 레이어다.

## 요약

이번 PR 의 target spec 변경 3건은 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)
및 자매 plan(`eia-masked-prefill-roundtrip-guard.md`) 과 완전히 정합한다. "닫는 조건" 서술은
부분 해소만 정확히 주장하고 남은 소비처(Re-run 모달·히스토리 로드)를 열린 상태로 정확히
유지했으며, 새로 명문화한 판단 기준(외부 노출 여부에 따른 마커가드/카브아웃 분기)은 기존에
개별적으로 내려진 결정을 일반화한 것이지 새로운 일방적 결정이 아니다. frontmatter
(`spec_impact`/`code:`)도 실제 diff 와 drift 없이 일치한다. 미해결 결정 우회, 선행 plan
미해소, 후속 항목 누락 세 관점 모두 CRITICAL/WARNING 급 결함 없음.

## 위험도
NONE
