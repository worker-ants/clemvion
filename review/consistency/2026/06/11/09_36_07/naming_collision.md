# 신규 식별자 충돌 검토 결과

검토 범위: V-02 최종 — `13-user-guide.md` 예시 YAML 의 삭제된 `ai-configs.tsx` 경로를 `schema-form.tsx` 로 정리(consistency W-1 해소). diff-base=origin/main

---

## 발견사항

충돌로 분류할 항목 없음.

변경 내용 요약:

1. **파일 삭제**: `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` 삭제.
   - 이 파일에서 export 하던 `TextClassifierConfig`, `InformationExtractorConfig` (frontend React 컴포넌트)가 제거됨.
   - 동명의 backend 타입(`TextClassifierConfig`, `InformationExtractorConfig` — `text-classifier.schema.ts`, `information-extractor.schema.ts` export)은 완전히 별개 네임스페이스(backend Node.js 모듈)이며 이 변경의 영향을 받지 않는다. 충돌 없음.

2. **`OVERRIDE_REGISTRY` 항목 제거**: `text_classifier`, `information_extractor` 두 key 가 레지스트리에서 제거됨.
   - `OVERRIDE_REGISTRY` 는 `Record<string, ComponentType<ConfigProps>>` 타입의 단일 객체. 동일 key 를 추가하는 다른 코드 없음.
   - 신규 테스트(`override-registry.test.ts`)가 `OVERRIDE_REGISTRY.ai_agent`, `.text_classifier`, `.information_extractor` 가 `undefined` 임을 고정 — 향후 재등록을 방지하는 regression guard 역할.

3. **spec 파일 경로 수정**:
   - `spec/2-navigation/13-user-guide.md` line 115: `ai-configs.tsx` → `auto-form/schema-form.tsx`
     - `schema-form.tsx` 는 이미 `spec/3-workflow-editor/1-node-common.md` §2.6 에서 SoT 로 명시된 기존 파일. 새로운 식별자가 아니라 기존 파일을 올바르게 가리키는 것으로 교체됨. 충돌 없음.
   - `spec/3-workflow-editor/1-node-common.md` §2.6.3: `text_classifier` · `information_extractor` 를 override-잔존 목록에서 auto-form 이행 완료 목록으로 이동.
     - 두 node type 식별자는 spec 전체에서 일관되게 사용 중이며 의미 변경 없음(렌더 트랙만 전환).

4. **Rationale 섹션(역사적 맥락) 내 `ai-configs.tsx` 언급**: `1-node-common.md` §R-3 의 Rationale 에 `ai-configs.tsx` 가 폐기 근거 설명용으로 남아 있음. 이는 과거 결정 기록이며 live 파일 경로 참조가 아니므로 충돌 해당 없음.

---

## 요약

이번 변경은 삭제된 `ai-configs.tsx` 에 대한 spec 내 파일 경로 참조를 실존하는 `schema-form.tsx` 로 교체하고, `1-node-common.md` 트랙 배정 현황을 구현 사실과 일치시키는 정리 작업이다. 새로 도입된 식별자가 없으며, 제거된 레지스트리 키(`text_classifier`, `information_extractor`)는 기존 spec 내 다른 의미로 재사용되지 않는다. 식별자 충돌은 발견되지 않았다.

---

## 위험도

NONE
