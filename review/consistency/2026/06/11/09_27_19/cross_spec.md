# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (V-02 IE/TC auto-form 이행, diff-base=origin/main)
검토 일시: 2026-06-11

---

## 발견사항

### [INFO] spec/2-navigation/13-user-guide.md 예시 YAML 에 삭제된 ai-configs.tsx 참조 잔존
- **target 위치**: 이번 변경 집합 (ai-configs.tsx 삭제 + override-registry.ts 갱신)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/ai-node-override-fields/spec/2-navigation/13-user-guide.md` line 115 — 섹션 §4 "프론트매터 필드" 의 `예시:` 코드 블록
- **상세**: `13-user-guide.md` §4 의 `예시:` fenced YAML 블록에 `code: [..., "codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx"]` 가 포함되어 있다. 이번 diff 에서 해당 파일이 삭제됐으므로, 이 예시 코드 블록은 존재하지 않는 경로를 보여주게 된다. 단, 이 YAML 은 실제 MDX 페이지 프론트매터가 아닌 "예시" 블록이므로 `registry.ts` 빌드 타임 경로 존재 검증 대상이 아니다. 따라서 빌드 실패를 유발하지 않지만, 해당 spec 의 `예시:` 가 stale 한 파일 경로를 보여준다는 점에서 문서 일관성 문제다.
- **제안**: `spec/2-navigation/13-user-guide.md` line 115 의 예시 `code:` 목록에서 `ai-configs.tsx` 를 삭제하거나, auto-form 패턴을 나타내는 다른 경로(예: `auto-form/schema-form.tsx`)로 교체해 삭제된 파일을 더 이상 예시로 노출하지 않도록 갱신 권장.

---

### [INFO] spec/3-workflow-editor/1-node-common.md §2.6.3 Rationale(R-3) 이미 갱신됨 — 충돌 없음
- **target 위치**: 이번 diff 의 `OVERRIDE_REGISTRY` 에서 `text_classifier`·`information_extractor` 제거
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/ai-node-override-fields/spec/3-workflow-editor/1-node-common.md` §2.6.3 + R-3
- **상세**: branch HEAD 의 `1-node-common.md §2.6.3` 는 `text_classifier`·`information_extractor` 를 "auto-form 이행 완료" 목록에 이미 포함하고 있으며, R-3 rationale(line 359–361) 이 이번 변경의 배경을 명시하고 있다. 구현(`OVERRIDE_REGISTRY` 항목 제거 + `ai-configs.tsx` 삭제)과 spec 기술이 일치한다. **충돌 없음**, 확인 완료.

---

### [INFO] spec/4-nodes/3-ai/2-text-classifier.md · 3-information-extractor.md frontmatter code: 에 ai-configs.tsx 미포함 — 충돌 없음
- **target 위치**: 이번 diff 의 `ai-configs.tsx` 삭제
- **충돌 대상**: `spec/4-nodes/3-ai/2-text-classifier.md` frontmatter (line 4–8), `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter (line 4–9)
- **상세**: 두 AI 노드 spec 의 `code:` 목록에는 처음부터 `ai-configs.tsx` 가 포함되지 않았고 backend 핸들러·스키마 경로만 나열되어 있다. 삭제로 인한 dead link 없음.

---

### [INFO] spec/3-workflow-editor/1-node-common.md frontmatter code: 는 glob `node-configs/**` 포함 — 삭제로 인한 영향 없음
- **target 위치**: `spec/3-workflow-editor/1-node-common.md` frontmatter line 8 (`node-configs/**`)
- **충돌 대상**: 이번 diff 의 `ai-configs.tsx` 삭제
- **상세**: glob 패턴이므로 특정 파일이 삭제돼도 pattern 자체는 유효하다. 남아있는 파일들이 여전히 glob 을 충족한다.

---

## 요약

이번 변경(V-02: `text_classifier`·`information_extractor` auto-form 이행, `ai-configs.tsx` 삭제, `OVERRIDE_REGISTRY` 항목 제거, override-registry 회귀 테스트 추가)은 Cross-Spec 관점에서 전반적으로 일관성이 확보되어 있다. `spec/3-workflow-editor/1-node-common.md §2.6.3` 및 R-3 이 이미 두 노드의 auto-form 이행을 명문화했고 구현과 일치한다. 유일한 주의 사항은 `spec/2-navigation/13-user-guide.md` §4 의 예시 YAML 블록에 삭제된 `ai-configs.tsx` 경로가 잔존한다는 점이다. 이는 빌드 실패나 API 계약 충돌이 아닌 문서 예시의 stale 참조이므로 등급은 INFO 다. 데이터 모델 충돌·API 계약 충돌·요구사항 ID 충돌·상태 전이 충돌·RBAC 모델 충돌·계층 책임 충돌은 발견되지 않았다.

## 위험도

LOW

STATUS: OK
