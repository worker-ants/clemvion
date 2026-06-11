# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**MEDIUM** — WARNING 2건 (rationale_continuity): spec §2.6.3 트랙 배정 목록 및 13-user-guide.md `code:` frontmatter 갱신 누락. 나머지 4개 checker 는 NONE.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | rationale_continuity | `spec/3-workflow-editor/1-node-common.md §2.6.3` "override 잔존" 목록에 `text_classifier`·`information_extractor` 가 여전히 남아 있음 — 구현(OVERRIDE_REGISTRY 제거)과 역전 | `spec/3-workflow-editor/1-node-common.md §2.6.3` (line 274 부근) | `codebase/frontend/.../override-registry.ts` (OVERRIDE_REGISTRY 에서 두 노드 제거 완료) | §2.6.3 "auto-form 이행 완료" 목록에 `text_classifier`·`information_extractor` 추가, "override 잔존" 목록에서 두 노드 제거, `## Rationale` 에 R-3 항으로 bespoke 폼 폐기 근거(zod schema 충분 커버) 명문화 |
| W-2 | rationale_continuity | `spec/2-navigation/13-user-guide.md` line 115 의 `code:` frontmatter 에 삭제된 `ai-configs.tsx` 경로 잔존 | `spec/2-navigation/13-user-guide.md` line 115 | `codebase/frontend/.../node-configs/ai-configs.tsx` (파일 삭제됨) | line 115 의 `ai-configs.tsx` 를 `auto-form/schema-form.tsx` 또는 `auto-form/**` 로 교체 |

> **중복 통합 주의**: cross_spec checker 는 W-2 에 해당하는 경로 교체를 "이미 수행됐다"고 판단했으나, rationale_continuity checker 는 실제 diff 에서 frontmatter `code:` 경로가 여전히 구 경로임을 지적함. 두 checker 의 발견이 동일 위치를 다른 결론으로 평가한 것이므로, rationale_continuity 지적(갱신 미완)이 더 강한 근거를 가짐 — W-2 유지.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | convention_compliance | 신규 테스트 파일명 `.test.ts` — 기존 패턴과 일치 | `node-configs/__tests__/override-registry.test.ts` | 없음 |
| I-2 | convention_compliance | 예시 YAML 내 `code:` 경로(`auto-form/schema-form.tsx`) 실존 여부는 가드 대상 아님 | `spec/2-navigation/13-user-guide.md` lines 108–116 | 문서 검토자가 `auto-form/schema-form.tsx` 실존 한 번 확인으로 충분 |
| I-3 | convention_compliance | `1-node-common.md` Rationale R-3 추가 — 3섹션 구조 규약 준수 | `spec/3-workflow-editor/1-node-common.md` `## Rationale` 말미 | 없음 |
| I-4 | cross_spec | `1-node-common.md` R-3 Rationale 의 과거형 `ai-configs.tsx` 언급은 역사 기록 목적 — spec 모순 아님 | `spec/3-workflow-editor/1-node-common.md` R-3 | 변경 불필요 |
| I-5 | plan_coherence | `node-output-redesign` Phase 2 표에서 `text-classifier`·`information-extractor` frontend 열 해소 처리 미반영 | `plan/in-progress/node-output-redesign/README.md` Phase 2 | 두 노드 행 frontend 열에 본 PR(ai-node-override-fields)로 override 제거 완료 메모 추가 |
| I-6 | plan_coherence | `spec-code-cross-audit-2026-06-10.md` V-02 해소 기록 자기-설명적으로 기재됨 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §V-02 | PR 머지 후 V-02 체크박스 [x] 처리 |
| I-7 | naming_collision | 삭제된 `ai-configs.tsx` 의 frontend export(`TextClassifierConfig`, `InformationExtractorConfig`)와 backend 동명 타입은 별개 네임스페이스 — 충돌 없음 | `codebase/frontend/.../ai-configs.tsx` (삭제) vs backend schema | 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·API·요구사항 ID·상태 전이·RBAC 충돌 없음. spec ↔ 코드 정합 확인 완료 |
| rationale_continuity | MEDIUM | W-1: §2.6.3 트랙 배정 목록 구현 역전. W-2: 13-user-guide.md `code:` frontmatter dead 링크 잔존 |
| convention_compliance | NONE | 정식 규약 직접 위반 없음. INFO 3건(패턴 일치·예시 경로·Rationale 형식) |
| plan_coherence | NONE | V-02 plan 대응 완결. node-output-redesign Phase 2 표 업데이트 INFO |
| naming_collision | NONE | 신규 식별자 없음. 제거된 레지스트리 키 재사용 없음 |

---

## 권장 조치사항

1. **(W-1 해소)** `spec/3-workflow-editor/1-node-common.md §2.6.3` 수정:
   - "auto-form 이행 완료" 목록에 `text_classifier`·`information_extractor` 추가.
   - "override 잔존" 목록에서 두 노드 제거.
   - `## Rationale` 에 R-3 항 신설: bespoke 폼 폐기 근거(zod schema 의 ui hint 가 해당 노드 전 필드를 커버해 redundant 해짐) 명문화.

2. **(W-2 해소)** `spec/2-navigation/13-user-guide.md` line 115 의 `code:` frontmatter 에서 `ai-configs.tsx` 를 `auto-form/schema-form.tsx` 또는 `auto-form/**` 로 교체. dead 링크 제거.

3. **(I-5 권장)** `plan/in-progress/node-output-redesign/README.md` Phase 2 표의 `text-classifier`·`information-extractor` 행 frontend 열에 본 PR 로 override 제거 완료 처리 메모 추가 (다음 Phase E 착수 전 반영 가능).

4. **(I-6 권장)** PR 머지 후 `spec-code-cross-audit-2026-06-10.md` V-02 체크박스를 `[x]` 처리.