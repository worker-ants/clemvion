# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — `spec/5-system/` 은 이번 diff(`origin/main` 대비)에서 전혀 변경되지 않았고, 실제 변경분(`codebase/**` 29개 파일)은 ESLint 9→10 업그레이드에 수반된 기계적 정리(lint 설정, `preserve-caught-error`/`no-useless-assignment` 대응, peer-guard 파서 확장)로 5개 checker 전원이 NONE 등급을 보고했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `preserve-caught-error` 자동수정으로 `cause: err` 를 붙인 `expression-resolver.service.ts`/`code.handler.ts` 에는, `secret-resolver.service.ts` 만큼의 "왜 안전한가" 근거 코멘트가 없음 (실측상 두 경로 모두 원본 에러 메시지를 이미 바깥 message 에 노출 중이라 추가 정보 누출은 없음을 확인) | `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`, `codebase/backend/src/nodes/data/code/code.handler.ts` | (선택) `cause: err` 옆에 "message 에 이미 원문 노출 중이라 cause 부착이 추가 노출을 만들지 않음 — secret-resolver 의 SS-SE-05 억제와는 구분됨" 1줄 코멘트 추가 |
| 2 | convention_compliance | 동일 사안 — `cause` 노출 판단 근거의 문서화 비대칭 (secret-resolver 는 SS-SE-05/#814 명시, 나머지 2곳은 무코멘트) | 상동 | (선택) `spec/conventions/secret-store.md`/`error-codes.md` 갱신 시 "message 에 이미 원문이 포함된 경로는 cause 부착이 안전하다"는 판별 기준 한 줄 명문화 |
| 3 | plan_coherence | `deps-peer-gating-and-eslint10.md` 가 착수 전 `--impl-prep` 로 확인한 WARNING 4건 중 2건(③`OAUTH_STATE_MISMATCH` 미등재, ④execution-engine/embedding-pipeline/graph-rag 소급 caveat)은 이미 타 in-progress plan(`spec-update-node-cancellation-shutdown-classification.md`, `update-returning-tuple-shape.md`)에 위임되어 있어 신규 등재 불요 — 이번 diff 가 `spec/5-system/**` 를 건드리지 않아 그 판단이 그대로 유효함 | 해당 없음 (target 미변경) | 조치 불요 (수렴 확인) |
| 4 | plan_coherence | `execution-engine.service.ts` 편집은 줄 수 변화 없는 1:1 치환이라, 타 plan(`spec-update-node-cancellation-shutdown-classification.md`)이 라인 번호로 앵커링한 `:645`/`:4657`/`:4844` 등이 이번 PR 이후에도 유효 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | 조치 불요 (예방적 확인 — 향후 줄-수 변화가 있는 PR 시 재검증 필요) |
| 5 | plan_coherence | plan 체크리스트의 `TEST WORKFLOW + /ai-review` 하위 `/consistency-check --impl-done` 항목이 바로 이번 검토 실행 자체 | `plan/in-progress/deps-peer-gating-and-eslint10.md` | 이 검토 결과 반영 후 plan 체크박스 갱신 (통상 developer 워크플로 절차) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/5-system/**` 미변경, 코드 변경분도 엔티티/API/RBAC/상태전이와 무관한 lint 정리뿐이라 충돌 표면 없음 |
| rationale_continuity | NONE | `preserve-caught-error` vs CWE-209 마스킹 원칙 교차점을 실측 검토, `secret-resolver.service.ts` 는 기존 결정(SS-SE-05/#814)을 정확히 계승. INFO 1건(문서화 비대칭) |
| convention_compliance | NONE | 에러 응답 봉투·문서 구조·명명 규약 위반 없음. INFO 1건(문서화 비대칭, rationale_continuity 와 동일 사안) |
| plan_coherence | NONE | 담당 plan 이 착수 전 `--impl-prep` 로 관련 spec drift 4건을 이미 확인·배분 완료, 라인 앵커 무결성 유지, §3 미결정 사항은 범위 밖으로 격리됨. INFO 3건(수렴 확인·예방적 확인·절차 참고) |
| naming_collision | NONE | `spec/5-system/**` 미변경으로 신규 식별자 도입 없음. 신규 코드 식별자(`readInstalledPackageJson`, `parseGteFloor`)는 테스트 전용 내부 유틸로 spec 표면과 무관 |

## 권장 조치사항
1. (선택, 비차단) `expression-resolver.service.ts`/`code.handler.ts` 의 `cause: err` 옆에 안전 근거 1줄 코멘트 추가 — 향후 동일 lint rule 이 새 파일에서 발화할 때 재조사 비용 절감.
2. (선택, 비차단) `spec/conventions/secret-store.md` 또는 `error-codes.md` 갱신 시 "message 에 이미 원문 노출 중인 경로는 cause 부착 안전" 판별 기준 명문화.
3. 이 검토 결과를 `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트의 `/consistency-check --impl-done` 항목에 반영해 체크.