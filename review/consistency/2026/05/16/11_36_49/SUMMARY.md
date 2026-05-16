# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. spec 반영 전 WARNING 항목 수정 후 진행 가능.

## 전체 위험도
**MEDIUM** — Critical 없음. WARNING 4건 중 CHANGELOG 불일치(W1) 및 병렬 편집 위험(W3)이 spec 반영 전 처리를 권장하는 수준. 전반적으로 정리성 변경으로 다른 spec 영역과의 직접 모순은 없음.

## Critical 위배 (BLOCK 사유)
없음

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | cross_spec / rationale_continuity / convention_compliance / plan_coherence (중복 통합) | CHANGELOG §10 초안에 드롭된 변경 3(§5 Case 번호 연속화 5.1·5.3·5.8 → 5.1·5.2·5.3)이 적용된 것처럼 기재됨 | `plan/in-progress/spec-draft-cafe24-cleanup.md` `## CHANGELOG 추가 (§10)` 블록 | 동일 문서 `## 변경 3` — "변경 3 은 적용하지 않는다" 명시 | CHANGELOG 초안에서 해당 문구 삭제. INFO 번호 목록도 "INFO 1·2"로 수정. |
| W2 | cross_spec | §9.9 "다른 통합 노드에 동일 결정을 그대로 적용" 선언이 과도하게 넓어 `http_request`의 `KeyValue[]` 직렬화 모델과 오해 유발 가능 | `plan/in-progress/spec-draft-cafe24-cleanup.md` 신규 §9.9 본문 마지막 단락 | `spec/4-nodes/4-integration/1-http-request.md` §1 — `headers: KeyValue[]`, `queryParams: KeyValue[]` | §9.9 적용 범위를 "object-shaped backend contract(`config.X: Record<string, unknown>`)를 가진 통합 노드"로 한정. `KeyValue[]`를 그대로 저장하는 http_request형 노드는 적용 대상 외임을 병기 |
| W3 | plan_coherence | `spec-update-cafe24-app-url-reuse.md`(worktree: `cafe24-app-url-reuse-f9a2e3`)의 미완 spec 갱신이 동일 파일(`spec/4-nodes/4-integration/4-cafe24.md`) §9 영역 대상 → merge 충돌 위험 | `plan/in-progress/spec-draft-cafe24-cleanup.md` `## 영향 범위` | `plan/in-progress/spec-update-cafe24-app-url-reuse.md` `[ ] spec 갱신` 항목(§9.4 install_token 소거 표기 갱신) | target plan `## 영향 범위`에 순서 의존성 명시 |
| W4 | plan_coherence | `user-guide-sync-2026-05-16.md` W4 위임 항목(§5 번호 불연속 정리)이 target의 false positive 확인 결론과 불일치 — 미갱신 상태로 중복 처리 시도 가능 | `plan/in-progress/user-guide-sync-2026-05-16.md` 후속 위임 항목 W4 | `plan/in-progress/spec-draft-cafe24-cleanup.md` `## 변경 3` — cross-node 컨벤션 확인 후 드롭 결론 | spec 반영 완료 후 `user-guide-sync-2026-05-16.md` W4 항목에 "false positive 확인 — cross-node 컨벤션이므로 변경 불필요. `spec-draft-cafe24-cleanup.md` 참고" 주석 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | cross_spec | §9.7 위치 정정 후 `spec/2-navigation/4-integration.md §3.2` inline 노트(OAuth scope wire format)와의 동기화 미확인 | `spec/4-nodes/4-integration/4-cafe24.md` L439-450 현 §9.7 orphan 본문 | §9.7 위치 정정 후 `4-integration.md §3.2` inline 노트 유효성 확인 |
| I2 | cross_spec | §9.9 출처 주석 내 이전 세션(`review/consistency/2026/05/16/09_03_04/`) INFO 번호(INFO 1·2) 실제 산출물과 일치 여부 미검증 | `plan/in-progress/spec-draft-cafe24-cleanup.md` 신규 §9.9 출처 주석 | spec 반영 전 해당 세션 SUMMARY.md INFO 항목 번호 대조 후 §9.9 본문 확정 |
| I3 | rationale_continuity | §9.9 `Record<string, unknown>` 불변 invariant의 근거 anchor 미명시 | `plan/in-progress/spec-draft-cafe24-cleanup.md` 신규 §9.9 | §9.9 끝에 "불변 전제 기준: §1 config 스키마의 `fields: Record<string, unknown>` 정의 (변경 시 본 결정 재검토 필요)" 한 줄 추가 |
| I4 | rationale_continuity | §9.7 본문 위치 정정이 편집 오류 수정임을 CHANGELOG에서 명확히 구분하지 않아 결정 번복으로 오해 가능 | `plan/in-progress/spec-draft-cafe24-cleanup.md` `## CHANGELOG 추가 (§10)` | CHANGELOG 항목에 `(편집 오류 수정 — 내용 변경 없음)` 병기 |
| I5 | convention_compliance | plan 작업 항목 `plan/complete/` 이동 체크박스에 `git mv` 사용 요건 미명시 | `plan/in-progress/spec-draft-cafe24-cleanup.md` `## 작업 항목` | `[ ] 위임 plan + 본 draft plan/complete/ 로 git mv 이동` 으로 수정 |
| I6 | convention_compliance | 신규 §9.9 Rationale 출처 참조가 nested ISO 경로 형식 정확히 준수 — 양호 | `plan/in-progress/spec-draft-cafe24-cleanup.md` 신규 §9.9 출처 주석 | 변경 불필요 |
| I7 | plan_coherence | 위임 plan `spec-update-cafe24-fields-ui-buffer.md` frontmatter worktree 미기재. target이 `cafe24-fields-spec-update-e7a3f2`에서 정상 인수 중 | `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md` frontmatter | target 완료 후 `spec-update-cafe24-fields-ui-buffer.md` 위임 체크박스 처리 표시 후 `plan/complete/` 이동 |
| I8 | plan_coherence | `cafe24-spec-cleanup-f4d8e2` worktree plan이 `spec/0-overview.md`·`spec/1-data-model.md`만 편집 — target과 파일 비중복, 충돌 없음 | `.claude/worktrees/cafe24-spec-cleanup-f4d8e2/plan/in-progress/spec-draft-cafe24-spec-cleanup.md` | 추적 메모 수준 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | WARNING 2건(CHANGELOG 드롭 변경 3 잔류, §9.9 적용 범위 과도), INFO 2건 |
| rationale_continuity | LOW | WARNING 1건(CHANGELOG 드롭 변경 3 잔류 — W1과 동일 통합), INFO 2건 |
| convention_compliance | LOW | WARNING 1건(CHANGELOG 드롭 변경 3 잔류 — W1과 동일 통합), INFO 2건 |
| plan_coherence | MEDIUM | WARNING 3건(CHANGELOG 불일치, user-guide-sync W4 미갱신, 병렬 편집 위험), INFO 2건 |
| naming_collision | LOW | 신규 식별자 충돌 없음. §9.9 섹션 번호 신규 도입 적정. INFO 1건(CHANGELOG 드롭 변경 3 잔류 — W1과 동일 통합) |
