# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 모두 CRITICAL 없음. 5개 checker 결과 파일(`cross_spec.md`, `rationale_continuity.md`, `convention_compliance.md`, `plan_coherence.md`, `naming_collision.md`)이 디스크에 모두 존재해 재시도 필요 항목 없음.

## 전체 위험도
**LOW** — `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 3원(폼 프리필/Re-run 모달/에디터 히스토리) 신설은 spec·plan·규약·명명 전반에서 정합적이며, cross_spec 이 지적한 WARNING 1건(pre-existing stale 문서, 이번 PR 이 강화한 전제와 충돌)만 실질적으로 남음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `Execution.inputData` 의 WS 전달 여부 서술이 정반대 — target(및 이번 PR 이 강화한 "REST·WS 두 레벨 동일 규칙" 서사)은 "WS `execution.node.completed` 의 `input` 이 REST `nodeExecutions[].inputData` 와 같은 프런트 store 슬롯에 병합된다"는 전제인데, `3-execution.md` §8 은 "WS 에는 inputData 가 없다"고 반대로 서술. 코드(`execution-engine.service.ts` NODE_COMPLETED emit, `use-execution-events.ts` store 반영)로 검증한 결과 target 쪽이 사실과 일치하고 `3-execution.md` 가 stale. pre-existing 결함(이번 diff 가 만든 것은 아님)이나 이번 PR 이 그 전제를 재확인·강화해 방치 비용 증가 | `spec/5-system/6-websocket-protocol.md` §4.1, `spec/5-system/14-external-interaction-api.md` (마스킹 표) | `spec/3-workflow-editor/3-execution.md` §8 "inputData 데이터 흐름" | §8 을 "`execution.node.completed` 는 `input`(=NodeExecution.inputData, 마스킹됨)을 포함하며 REST 폴링 값과 같은 store 슬롯에 병합된다(늦은 이벤트가 먼저 온 값을 지우지 않도록 `??` 로 보존)"로 갱신. `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 또는 신규 항목으로 트래킹 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | i18n 카탈로그(§10.4)가 같은 파일 §10.2 신규 UI 상태의 키를 누락 | `spec/5-system/13-replay-rerun.md` §10.4 vs 코드(`history.ts` dict, `rerun-modal.tsx`) 의 `history.rerun.maskedInputBlocked` | §10.4 표에 `history.rerun.maskedInputBlocked` 행 추가 |
| 2 | rationale_continuity | R-5(config 탭 boundary masking parity) → §R17 → WS §4.1 로 이어지는 2홉 인용에서, 원 출처의 스코프 caveat 이 두 번째 홉에서 재노출되지 않음(3라운드째 반복, 저강도) | `spec/2-navigation/14-execution-history.md` R-5 → `spec/5-system/14-external-interaction-api.md` §R17 → `6-websocket-protocol.md` §4.1 | 급하지 않은 문서 보강. WS §4.1 에 caveat 한 줄 추가 검토 |
| 3 | convention_compliance | `masked-markers.ts` 를 `components/` → `lib/utils/` 로 승격한 것은 `frontend-layering.md` §3 이동 규약의 모범 사례 (준수 기록, 조치 불요) | `spec/5-system/14-external-interaction-api.md` frontmatter `code:` | 없음 |
| 4 | convention_compliance | 신규 i18n 키 2종(`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`) ko/en parity·dict 경유·Principle 6-B(내부 SoT 비노출) 전부 준수 (준수 기록, 조치 불요) | `codebase/frontend/src/lib/i18n/dict/{ko,en}/{editor,history}.ts` | 없음 |
| 5 | naming_collision | `MASKED_MARKERS`/`isMaskedMarker` 프런트-백엔드 동명은 target 문서가 근거를 명시한 의도적 cross-boundary 미러(충돌 아님, 조치 불요) | `codebase/frontend/src/lib/utils/masked-markers.ts` vs backend `sanitize-error-message.ts` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 1(`3-execution.md` §8 WS inputData 서술 정반대, pre-existing이나 이번 PR이 강화한 전제와 충돌) + INFO 1(i18n 카탈로그 누락 행) |
| Rationale Continuity | NONE | 4라운드째 재확인, 카브아웃 폐지가 "닫는 조건 충족 후 번복" 모범 사례. 직전 라운드 WARNING/INFO 는 후속 커밋(`b46216f1f`)에서 처분 확인. 잔존 INFO 1(3라운드 반복, 저강도) |
| Convention Compliance | NONE | 레이어 이동 규약·i18n 규약·spec-impl-evidence frontmatter 전부 준수. INFO 4건은 전부 준수 기록 |
| Plan Coherence | NONE | developer/planner 두 in-progress plan 이 diff 와 원문 단위 일치, 트래커 항목 `[ ]→[x]` 정확 전환 + 후속 3건(W4/W5/W6) 신규 등재 확인 |
| Naming Collision | NONE | 신규 식별자(함수·상수·i18n 키·파일 경로) 전부 유일, 삭제된 구 앵커(`MASKED_INPUT_DATA_REASON`) 잔존 참조 0건 |

## 권장 조치사항
1. `spec/3-workflow-editor/3-execution.md` §8 "inputData 데이터 흐름"을 코드 실측(WS `input` 필드가 REST 값과 같은 store 슬롯에 병합됨)에 맞춰 정정 — WARNING 해소, BLOCK 사유는 아니나 이번 PR 이 강화한 핵심 전제와 직접 충돌하므로 우선순위 있음.
2. `spec/5-system/13-replay-rerun.md` §10.4 i18n 카탈로그에 `history.rerun.maskedInputBlocked` 행 추가.
3. (저강도, 급하지 않음) WS §4.1 에 R-5 원 스코프 caveat 재노출 검토.