# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 다수 (cross_spec, rationale_continuity)로 호출자가 차단해야 함

## 전체 위험도
**CRITICAL** — REST `getStatus()`의 terminal `result`/`error` 분기가 waiting 분기와 달리 `stripExternalOnlyFields`를 여전히 받지 못해, 이번 커밋이 스스로 "닫았다"고 선언한 것과 동일 클래스의 `llmCalls`(raw LLM 프롬프트) 유출 경로가 그대로 남아 있다. 더불어 관련 spec 문서(§R17, WS §4.4)가 코드 변경을 반영하지 못한 채 stale 서술을 유지 중이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | `getStatus()`의 terminal `result`/`error`(COMPLETED/FAILED)가 waiting 분기와 달리 `stripExternalOnlyFields`를 적용받지 못해, AI Agent가 마지막 노드인 워크플로우가 종료되면 `outputData.meta.turnDebug[].llmCalls`(시스템 프롬프트 원문)가 워크스페이스 검증 없는 `iext_*`/`itk_*` 토큰으로 그대로 노출됨 — waiting 분기에서 방금 닫은 것과 동일 클래스의 leak | `codebase/backend/src/modules/external-interaction/interaction.service.ts:406-419` | `spec/5-system/14-external-interaction-api.md:1346-1352`(§R17, 두 표면을 동일 처리 대상으로 명시) / `spec/5-system/6-websocket-protocol.md:1064,1066`(값-레벨 마스킹은 "기각된 대안"이라 명시) / `12_06_21` cross_spec CRITICAL 1 제안(두 지점 모두 요구) | `result`/`error` 조립을 `stripExternalOnlyFields(deepRedactSecrets(execution.outputData ?? null), MAX_REDACT_DEPTH)`로 교체 + `llmCalls`/`turnDebug`를 포함하는 COMPLETED fixture로 회귀 테스트 대칭 추가 |
| 2 | cross_spec | `spec/5-system/14-external-interaction-api.md` §R17 + `spec/5-system/6-websocket-protocol.md` §4.4가 이번에 REST `getStatus()`(waiting 분기)에 새로 적용된 strip을 반영하지 못한 채 "REST는 `deepRedactSecrets` 값-마스킹만, 필드 제거는 WS 전용"이라고 코드가 스스로 반증한 서술을 그대로 유지 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:341-355` | `spec/5-system/14-external-interaction-api.md:1346-1352` / `spec/5-system/6-websocket-protocol.md:519, 1056-1064` | (planner) §R17에 `stripExternalOnlyFields` 적용 사실 명시 + WS §4.4 "WS 이벤트 필드뿐" 문구를 "WS + EIA REST getStatus 양쪽"으로 확장. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 항목(7)에 REST 확장분 추가 등재 |

이 두 CRITICAL은 사실상 하나의 근본 결함(REST `getStatus` 응답 조립의 두 하위 표면 중 하나만 강화됨 + spec이 그 변화를 반영 못함)을 서로 다른 관점(코드 방어 비대칭 vs spec 서술 staleness)에서 지적한 것이다. 등급 하향 없이 모두 유지한다.

## planner 인계 (권한 밖 Critical)

> 위 Critical 중 CRITICAL#2(spec 서술 staleness)는 근본 원인이 `spec/` 갱신이며 developer 권한 밖이다. CRITICAL#1(코드 비대칭)은 developer 권한 내 코드 수정이 우선이지만, 그 수정이 확정되면 §R17 텍스트도 함께 갱신되어야 하므로 아래에 함께 인계한다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/5-system/14-external-interaction-api.md` §R17 갱신은 `spec/` 쓰기 권한(project-planner 전용) 필요 | project-planner | §R17 "표면 제약(보안)" 중 `getStatus`의 `nodeOutput`/terminal `result`·`error` 서술을 "`deepRedactSecrets`(값 마스킹) + `stripExternalOnlyFields`(`llmCalls` 등 필드 삭제)"로 갱신. "마스킹은 secret-shape만 치환" 단정 문구 정정 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 항목(7) — 단, 현재 그 항목은 §6.2 역참조만 명시하고 R17 본문 정정은 빠져 있어 함께 등재 필요 |
| 2 | `spec/5-system/6-websocket-protocol.md` §4.4/Rationale 갱신도 동일 권한 필요 | project-planner | §4.4 "strip 대상은 본 WS 이벤트 필드뿐" 문구를 "WS 이벤트(fanout) + EIA REST `getStatus()` 양쪽"으로 확장. "DB 영속 경로 영향 없다" 부분은 유지(여전히 참) | 위와 동일 |
| 3 | `spec-draft-eia-notification-payload-contract.md`가 이미 `[x]` 완료 처리한 전제("§6.2에 남은 것은 필드명 매핑뿐")가 형제 plan(`spec-draft-eia-62-waiting-payload.md`)의 실측으로 반증됨 — 커밋 `34e32e62f`가 "이 작업의 일부로 포함한다"고 명시적으로 약속했으나 실제로는 해당 plan 파일이 diff에 없음(0줄 변경, 확인됨) | project-planner (또는 이 세션 직접 후속 커밋) | `spec-draft-eia-notification-payload-contract.md:228-229` 옆에 "실측으로 전제 일부 반증됨 — §6.2 봉투 누락은 별도 잔존" 각주 추가 | plan_coherence WARNING 2 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `nodeOutput`은 새 strip을 받았지만 형제 `result`/`error`는 여전히 `deepRedactSecrets` 단독 — 지금은 `Execution.outputData` 구조상(`toEngineFlatShape`가 `.meta` 미포함) 우연히 안전하지만 문서화되지 않은 전제에 기댐 (CRITICAL#1과 동일 코드 지점, 더 넓은 구조적 위험 서술이라 별도 유지) | `interaction.service.ts:408-421` | 자체 JSDoc "fanout과 같은 수준으로 debug 필드 제거"와 실제 적용 범위 불일치 | (a) 대칭 적용 또는 (b) `Execution.outputData`가 구조적으로 `.meta`를 가질 수 없다는 불변식을 주석+spec에 명시하고 그 불변식이 깨지면 실패하는 회귀 테스트 추가 |
| 2 | rationale_continuity | `12_06_21` cross_spec CRITICAL 1 제안②(§R17에 `llmCalls` 예외 명문화)가 이번 diff에도 반영 안 됨 | `spec/5-system/14-external-interaction-api.md` §R17 | 동일 | CRITICAL#2 수정과 함께 처리 |
| 3 | convention_compliance | EIA §R17 "표면 제약(보안)"이 이번 PR의 마스킹 강화(필드 삭제 병행)를 반영 못해 실제보다 좁게 서술 — CRITICAL#2와 동일 근본 원인의 convention 관점 중복 지적 | §R17 L1346-1352 | `spec/conventions/spec-impl-evidence.md` Overview 원칙 | planner 턴에서 §R17 갱신 시 함께 정리 (CRITICAL#2 인계로 흡수) |
| 4 | plan_coherence | REST `getStatus` strip 적용이 만든 spec 후속 의무가 어느 plan에도 등재되지 않음 (CRITICAL#2/인계#1과 동일 근본) | `interaction.service.ts:342-355` vs §R17 | `spec-draft-eia-62-waiting-payload.md` 항목(7) | 항목(7) 또는 `spec-sync-external-interaction-api-gaps.md`에 "§R17 — getStatus도 stripExternalOnlyFields를 거친다는 사실 명시" 항목 신설 |
| 5 | plan_coherence | 커밋 `34e32e62f`가 약속한 "형제 plan 반증 각주"가 실제로는 `spec-draft-eia-notification-payload-contract.md`에 기록되지 않음 | 커밋 메시지 vs `spec-draft-eia-notification-payload-contract.md:228-229` (0 변경) | `spec-draft-eia-62-waiting-payload.md` 변경 제안(3) 각주 | 인계#3 참조 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `CHANGELOG.md` Unreleased 항목이 depth-1→깊이 무관 fanout 강화만 서술, REST `getStatus` 확장(`34e32e62f`)은 별도 기록 없음 | `CHANGELOG.md:3-25` | spec 갱신 시 함께 정리, 급하지 않음 |
| 2 | convention_compliance | 신설 공용 유틸 `strip-external-only-fields.ts`가 관련 spec frontmatter `code:` 목록에 명시 열거되지 않음 (glob 기반 커버리지로 CI 위반 아님) | `spec/5-system/6-websocket-protocol.md`, `14-external-interaction-api.md` frontmatter | 다음 편집 기회에 `code:`에 한 줄 추가 |
| 3 | plan_coherence | CHANGELOG가 두 유출 경로 중 하나(fanout)만 기록, REST 경로 누락 | `CHANGELOG.md:3-24` | 항목 제목에 "(REST 스냅샷 포함)" 추가 |
| 4 | naming_collision | `interaction.service.spec.ts:616` JSDoc 주석이 이동된 `stripDeep`의 소재를 여전히 옛 파일(`websocket.service.ts`)로 가리킴 (naming collision 아님, stale 문서 포인터) | `interaction.service.spec.ts:616` | JSDoc 파일 포인터를 `shared/utils/strip-external-only-fields.ts`로 정정 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | §R17/WS §4.4가 REST getStatus에 새로 적용된 strip을 반영 못함(코드가 spec을 반증) |
| rationale_continuity | CRITICAL | terminal `result`/`error` 분기가 waiting 분기와 달리 strip 미적용 — 동일 클래스 leak 잔존 |
| convention_compliance | LOW | §R17 "secret-shape만 치환" 서술이 실제(필드 삭제 병행)보다 좁음 — CRITICAL#2와 근본 동일, 그러나 convention 관점 자체 위반은 낮게 평가 |
| plan_coherence | MEDIUM | REST strip 관련 spec 후속 의무 미등재 + 커밋이 약속한 형제 plan 반증 각주 미이행 |
| naming_collision | LOW | 신규 식별자 6관점 전수 충돌 없음, stale JSDoc 파일 포인터 1건(INFO)만 |

## 권장 조치사항

1. **(BLOCK 해소 최우선, developer 권한 내)** `interaction.service.ts:406-419`의 terminal `result`/`error` 조립에 `stripExternalOnlyFields(deepRedactSecrets(execution.outputData ?? null), MAX_REDACT_DEPTH)`를 적용해 waiting 분기와 대칭시킨다. `llmCalls`/`turnDebug`를 포함하는 COMPLETED/FAILED fixture로 회귀 테스트를 waiting 분기 테스트와 대칭으로 추가한다.
2. **(BLOCK 해소, planner 인계)** `spec/5-system/14-external-interaction-api.md` §R17과 `spec/5-system/6-websocket-protocol.md` §4.4/Rationale을 이번 코드 변경(및 위 1번 수정 후 최종 상태)에 맞춰 갱신한다 — "REST는 값-마스킹만" 서술을 "값 마스킹 + `stripExternalOnlyFields` 필드 삭제 병행"으로 정정.
3. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 항목(7)에 REST `getStatus` 확장분(§R17 정정 포함)을 명시적으로 등재한다.
4. `spec-draft-eia-notification-payload-contract.md:228-229`에 형제 plan 반증 각주를 추가(또는 최소 교차 링크)한다 — 커밋 `34e32e62f`가 이미 약속했던 것이다.
5. (급하지 않음) CHANGELOG에 REST 경로 유출 항목을 별도 기재하고, `interaction.service.spec.ts:616`의 stale JSDoc 파일 포인터를 정정하고, 관련 spec frontmatter `code:`에 신규 유틸 파일을 추가한다.