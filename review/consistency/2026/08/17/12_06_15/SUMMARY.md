# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 모두 CRITICAL/WARNING 없이 위험도 NONE 판정. INFO 2건(사실상 관련 이슈 2가지, 일부 중복 지적)만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance, Plan Coherence | 신규 evidence 파일 2건(`sanitize-error-message.ts`, `dynamic-form-ui.tsx`)이 target spec frontmatter `code:` 목록에 없음 — glob 매치는 이미 통과 상태라 규약 위반은 아님 | `spec/5-system/14-external-interaction-api.md` frontmatter `code:` | 다음 spec 갱신 시 두 경로를 `code:` 배열에 추가하거나, 제외 사유를 Rationale 에 한 줄 남길 것 (강제 아님) |
| 2 | Cross-Spec | Chat Channel 위젯(`dynamic-form.tsx`)은 애초에 `defaultValue` 프리필을 하지 않아 이번 라운드가 닫으려는 왕복 오염 클래스와 무관 — 별도 기능 갭일 수 있으나 마스킹과는 무관 | `codebase/channel-web-chat/src/widget/components/dynamic-form.tsx` | 위젯 쪽 prefill 부재가 의도된 설계인지 별도로 확인 필요하면 project-planner 에 문의(이번 라운드 범위 밖) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | §R17 "프리필 왕복" 불릿·마커 상수 재배치·`DynamicFormUI` 가드가 data-model/WS-protocol/replay-rerun/webhook/Form-node/webchat-widget 과 모순 없음. 직전 라운드 WARNING(§8.2 미갱신)·`nodeLabel` 정정은 이번 top commit 이전 커밋에서 이미 해소 확인 |
| Rationale Continuity | NONE | §R17 "닫는 조건" 갱신 문구와 코드가 문자 그대로 일치. 기각된 대안(display-time 마스킹, carve-out 전면 확대) 재도입 없음. unmask-금지·SoT-미러 원칙 준수. `nodeLabel` 정정도 실측 근거 동반 |
| Convention Compliance | NONE | 명명/출력 포맷/문서 구조/API 문서/금지 항목 전축에서 위반 없음. 마커 리터럴 backend-frontend 미러 일치, i18n Principle 준수 |
| Plan Coherence | NONE | `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 가 정의한 단일 작업을 정확히 집행. 정본 트래커 체크박스 3건과 1:1 대응, 미해결 결정 우회·선행 plan 전제 미해소·후속 항목 누락 없음 |
| Naming Collision | NONE | 신규 식별자(`MASK_MARKERS`, `isMaskedValue`, `formMaskedDefaultHint` i18n 키, plan 파일 경로) 전수 grep 검증 결과 기존 사용처와 충돌 없음. 나머지 변경은 기존 필드명 서술 확장이거나 drift 정정 |

## 권장 조치사항

1. (선택, 비차단) frontmatter `code:` 배열에 `sanitize-error-message.ts`·`dynamic-form-ui.tsx` 두 경로 추가 — spec-impl-evidence 추적성 개선 목적. 강제 아님, 다음 spec 갱신 때 처리해도 무방.
2. 그 외 즉시 조치 불요. 5개 checker 전원 NONE 위험도로 수렴했으며 이번 PR(§R17 마스킹 라운드2)은 push 가능.