### 발견사항

- **[INFO]** R17 제목 date-stamp 에 이번 terminal outputData 마스킹 결정 미반영
  - target 위치: `spec/5-system/14-external-interaction-api.md` §Rationale R17 제목 (라인 1104) — `### R17. ... (결정 2026-06-25, conversationThread reload 노출 재조정 2026-07-09)`
  - 과거 결정 출처: 동일 문서 R17 — "`conversationThread` 노출로의 재조정(2026-07-09)" 단락이 선례로, 해당 문서는 R17 하위 결정을 갱신할 때마다 제목에 날짜를 병기하는 관례를 따르고 있다.
  - 상세: 이번 diff(HEAD, commit `8d39d65ee` "EIA §R17 잔여 하드닝")는 `nodeOutput.conversationConfig + terminal result/error` 불릿을 갱신해 `getStatus` 의 terminal `result`(COMPLETED)/`error`(FAILED) `outputData` 마스킹을 신규로 강제 문서화했다. 그러나 R17 제목의 날짜 병기 관례(`결정 2026-06-25, ... 재조정 2026-07-09`)가 이번 2026-07-10 변경에는 적용되지 않아, 향후 R17 을 다시 스캔하는 사람이 제목만 보고 "2026-07-09 이후 변경 없음" 으로 오인할 여지가 있다. 결정 자체의 내용은 정합하며 번복도 아니다 — 순수 문서 일관성(추적성) 이슈.
  - 제안: R17 제목에 `+ terminal outputData 마스킹 2026-07-10` 등을 추가하거나, 본문에 이미 존재하는 "선행 PR #876" 스타일로 이번 변경의 날짜·PR 참조를 명시. 필수 아님(INFO), 후속 편집 시 반영 권장.

### 요약
검토 대상 diff(`spec/5-system/14-external-interaction-api.md` §Rationale R17, origin/main 대비 유일한 변경 파일)는 `getStatus` REST 응답의 terminal `result`/`error` `outputData` 에 대해서도 `deepRedactSecrets` 마스킹을 강제하도록 R17 을 확장한 것으로, 직전 PR #876(`9ef97854f`, R17 최초 강제)이 스스로 "잔여 항목"으로 명시해 둔 갭(`plan/complete/eia-secret-masking-residuals.md` P1-2)을 그대로 이행한 것이다. 관련된 두 핵심 정책 결정 — (a) participant 채널(ai_message)도 전 표면 마스킹을 유지(observer-only 분리 미채택, "보안 우선" 원칙 계승), (b) DB-at-rest(append-time redaction)는 보류 — 은 이번 diff 가 건드리지 않은 기존 문장에서 이미 근거와 함께 명문화되어 있고, plan 문서가 "현행 유지"/"보류"를 결정 항목으로 별도 확정해 두었다. 코드 diff 역시 마스킹 로직을 `shared/utils/sanitize-error-message.ts` 의 기존 `deepRedactSecrets`(SoT)에 WeakMap depth-0 캐시를 "특수 케이스만 얇게 추가"하는 형태로 확장했을 뿐, 새 redaction 구현을 신설하지 않아 프로젝트의 secret-redaction SoT 원칙과도 정합한다. 기각된 대안의 무단 재도입, 합의 원칙 위반, 근거 없는 결정 번복, invariant 우회 등 CRITICAL/WARNING 급 충돌은 발견되지 않았다.

### 위험도
NONE
