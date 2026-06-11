# 변경 범위(Scope) 리뷰

## 작업 의도

`rag-webchat-doc-strings` 브랜치의 목적은 cross-audit V-16/V-17 두 항목의 문서 문자열(doc-string) 정정이다.

- **V-16**: KB DTO Swagger에서 `cross_encoder_llm 후속 구현` stale 문자열 제거 및 실제 구현 내용 반영
- **V-17**: `web-chat-sdk` README 및 `byo-ui-headless.ts` 예제의 폐기된 `firstMessage` 패턴을 `profile` + `submit_message` 패턴으로 교체

---

## 발견사항

### [INFO] plan 파일 V-06/V-08 항목 갱신 — 타 브랜치 소관 변경 포함
- 위치: `/plan/in-progress/spec-code-cross-audit-2026-06-10.md`
- 상세: V-06/V-08 항목의 `"본 PR"` 표기를 `"PR #530"` 으로 수정한 것은 `makeshop-catalog-labels` 브랜치/PR의 이력이다. 본 브랜치의 직접 범위 밖 내용을 동일 파일에서 함께 편집했다. 단, 해당 편집은 이미 머지 완료된 #530의 PR 번호를 기재한 순수 plan 기록 갱신이므로 코드 동작에 영향이 없고, 동일 파일 편집이라 충돌 없이 포함한 것으로 보인다.
- 제안: 기능적 문제 없음. 향후 plan 파일에서 타 브랜치 소관 항목을 함께 수정할 경우 commit message에 명시하면 추적성이 높아진다.

### [INFO] `@IsInt()` 임포트 추가 + validator 교체 — doc-string 범위를 약간 초과
- 위치: `/codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts`
- 상세: 작업 의도는 doc-string 정정이나, `@IsNumber()` → `@IsInt()` 교체 및 `IsInt` 임포트 추가가 함께 포함됐다. 이는 순수 문서 변경을 초과한 validator 동작 변경이다(float 입력을 이제 거부). RESOLUTION에서 "spec §2.1 `integer` 타입 요구사항과 일치"로 정당화했고, 동일 필드의 description을 수정하면서 검토된 연관 수정임을 명시했다. 런타임 동작 변경이지만 spec 정합 수정이라 정당 범위 내로 볼 수 있다.
- 제안: 차단 불요. 단, commit message나 PR description에 "validator 수정 포함(spec §2.1 integer)" 을 명시해 pure doc-string 수정이 아님을 구분하는 것을 권장한다.

### [INFO] `UpdateKnowledgeBaseDto` JSDoc 5개 추가 — doc-string 확장
- 위치: `/codebase/backend/src/modules/knowledge-base/dto/update-knowledge-base.dto.ts`
- 상세: V-16 범위인 `rerankLlmConfigId` description 수정 외에, rerank 관련 5개 필드 전체에 JSDoc 블록(`/** 변경할 … */`)이 새로 추가됐다. V-16의 직접 대상이 아닌 `rerankMode`, `rerankConfigId`, `rerankCandidateK`, `rerankScoreThreshold` 필드도 수정됐다. 이는 `CreateKnowledgeBaseDto`와의 균형 목적의 일관성 개선으로, 해당 파일을 열어 수정하면서 함께 처리한 합리적 범위 확장이다.
- 제안: 차단 불요. 변경 의도와 연관된 파일 내 일관성 개선으로 수용 가능.

---

## 요약

변경 범위 관점에서 이 PR은 V-16/V-17 doc-string 정정이라는 주 목적에 충실하며, 벗어난 변경은 모두 경미한 수준이다. `@IsNumber()` → `@IsInt()` 교체는 validator 동작을 변경하지만 spec 정합 수정으로 정당하며 동일 필드 수정 중에 발견·적용됐다. `UpdateKnowledgeBaseDto` JSDoc 5개 추가는 동일 파일 내 일관성 개선이다. plan 파일에서 타 브랜치 소관 항목(V-06/V-08 PR #530)을 함께 갱신한 것은 순수 기록 정리로 해악이 없다. 의도하지 않은 설정 파일 변경, 불필요한 리팩토링, 기능 확장, 포맷팅 전용 변경은 발견되지 않았다.

## 위험도

LOW
