# 문서화(Documentation) 리뷰 결과

## 발견사항

### [WARNING] `KbUnsearchableReason` 타입과 `SearchWithMetaResult` 타입의 JSDoc 블록이 분리·중복됨
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` lines 26–52
- **상세**: 기존에 `SearchWithMetaResult`를 설명하던 JSDoc 블록(lines 26–32)이 그대로 남아 있고, 그 바로 아래에 `KbUnsearchableReason`용 JSDoc 블록(lines 33–41)이 추가되어 두 블록이 연속 배치됐다. 첫 번째 JSDoc은 `SearchWithMetaResult`를 문서화하는 것처럼 보이지만 실제로는 `KbUnsearchableReason` 위에 위치하므로 연결이 모호하다. 도구(IDE, TypeDoc)에 따라 첫 번째 JSDoc이 `KbUnsearchableReason`에 붙을 수 있어 혼동을 유발한다.
- **제안**: `KbUnsearchableReason` JSDoc을 해당 타입 바로 위로 이동하고, `SearchWithMetaResult` JSDoc은 `SearchWithMetaResult` 타입 바로 위로 이동해 각각 단일 JSDoc 블록이 대응 타입 직전에 위치하도록 정리한다.

---

### [WARNING] `RagAccumulator` 클래스의 `diagnosticCount`·`unsearchableCount` 필드 문서가 클래스 수준 JSDoc이 아닌 인라인 주석으로만 존재
- **위치**: `/Volumes/project/private/clemvion/.claire/worktrees/kb-unsearchable-warning-b47e20/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` lines 393–396
- **상세**: `diagnosticCount`와 `unsearchableCount`는 `skipReason='kb_unsearchable'` 판정 로직의 핵심 카운터이지만 `// KB tool 호출 횟수와 그중 검색 불가(unsearchable) 호출 수. …` 한 줄 인라인 주석만 있다. `RagAccumulator` 클래스 JSDoc(lines 385–387)에는 이 카운터가 언급되지 않아, 클래스 문서만 읽으면 어떤 조건에서 `kb_unsearchable`이 세팅되는지 파악하기 어렵다.
- **제안**: 클래스 JSDoc에 `diagnosticCount`·`unsearchableCount` 조합 판정(`diagnosticCount > 0 && unsearchableCount === diagnosticCount`) 로직의 의도를 한 줄 추가하거나, `build()` 메서드에 JSDoc을 추가해 반환 규칙을 명시한다.

---

### [INFO] `KbToolProvider` 내 `not_searchable` 봉투 반환 경로에 인라인 주석이 있으나 `note` 문자열 자체가 영어 하드코딩임을 주석에서 명시하지 않음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` 추가 블록 (lines ~542–565 in diff)
- **상세**: `note` 문자열 `"This knowledge base is being (re)embedded and is temporarily unsearchable. Tell the user it needs re-embedding; do not claim the KB is empty or fabricate an answer."` 은 LLM에게 전달되는 지시문으로 의도적으로 영어로 고정된 것이다. i18n 대상이 아닌 이유(LLM 프롬프트 지시 목적)를 코드 주석에서 언급하지 않아 향후 기여자가 i18n 처리를 빠뜨렸다고 오인할 수 있다.
- **제안**: 해당 블록 인라인 주석에 `// LLM 프롬프트 지시용 — i18n 대상 아님` 또는 영문 동등 표현을 한 줄 추가한다.

---

### [INFO] `plan/in-progress/kb-unsearchable-warning.md`의 `owner` 필드가 `project-planner→developer` 비표준 복합 값으로 기재됨
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/plan/in-progress/kb-unsearchable-warning.md` frontmatter
- **상세**: `plan-lifecycle.md §4`가 요구하는 단일 역할 문자열 대신 `project-planner→developer`라는 전환 표기를 사용했다. consistency-check SUMMARY Warning #4에서도 지적됐으며, `plan-frontmatter.test.ts` build guard 실패 위험이 있다. 또한 비표준 `name:` 키도 존재한다.
- **제안**: frontmatter를 `owner: developer`(현재 담당 역할)로 단순화하고 `name:` 키를 제거한다. 전환 이력은 본문에 서술한다.

---

### [INFO] `plan/in-progress/kb-unsearchable-warning.md`의 `spec_impact`에 `spec/5-system/8-embedding-pipeline.md` 누락
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/plan/in-progress/kb-unsearchable-warning.md` frontmatter `spec_impact`
- **상세**: 체크리스트에 `8-embedding-pipeline §7.3` 갱신이 포함되어 있고 spec-draft에도 변경 3으로 명시됐으나, `spec_impact` 목록에는 해당 파일이 빠져 있다. Gate C 통과 요건이므로 plan 완료 전 반드시 추가해야 한다.
- **제안**: frontmatter에 `- spec/5-system/8-embedding-pipeline.md` 항목을 추가한다.

---

### [INFO] i18n 사전 키(`reembeddingRequired`, `reembeddingInProgress`) 추가 시 번역 설명(설명 주석) 부재
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/codebase/frontend/src/lib/i18n/dict/en/knowledgeBases.ts` lines 909–910 및 ko 파일
- **상세**: 추가된 두 키의 사용 맥락(KB 목록 카드에서 `embeddingDimension === null` 상태를 나타내는 배지 텍스트)을 파악하려면 page.tsx를 참조해야 한다. 다른 키들도 동일한 패턴이지만, 상태 조건(`dimension null + reembedStatus` 조합)이 미묘하므로 번역가가 문맥을 오해할 여지가 있다.
- **제안**: 해당 키 위에 `// 배지: embeddingDimension NULL + reembedStatus==='idle' → 카드에 표시` 형태의 한 줄 주석을 추가한다(필수는 아님).

---

### [INFO] 프론트엔드 `page.tsx` 내 `검색 불가 경고` 인라인 JSX 주석의 SoT 참조가 `spec/2-navigation/5-knowledge-base.md §2.2.1`만 가리킴
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` 추가 블록 주석
- **상세**: 주석에 `SoT: spec/2-navigation/5-knowledge-base.md §2.2.1`을 명시한 것은 양호하다. 다만 백엔드 신호 연결(§3.1 not_searchable 봉투)은 `spec/5-system/9-rag-search.md §2.2/§3.1`에 정의됐으므로, 프론트엔드 경고 배지와 백엔드 `not_searchable` 봉투의 관계를 추적하려는 개발자에게 cross-reference 가 한 곳에 모여 있지 않다. 
- **제안**: 주석 끝에 `(백엔드 봉투: spec/5-system/9-rag-search.md §2.2)` 를 추가하면 네비게이션이 개선되지만 필수 사항은 아니다.

---

## 요약

전체적으로 이번 변경은 새로 도입한 `KbUnsearchableReason`, `SearchWithMetaResult.unsearchable`, `KbSearchDiagnostic.unsearchable`, `RagDiagnostics.skipReason('kb_unsearchable')` 등 공개 타입·인터페이스에 한국어·영어 JSDoc을 일관되게 작성했으며, 인라인 주석도 스펙 절번(§2.2/§3.1/§4.2/§6) 참조를 포함해 추적성이 높다. 다만 `KbUnsearchableReason`과 `SearchWithMetaResult` 사이에 JSDoc 블록이 연속 배치되어 IDE 연결이 모호한 점(WARNING), `RagAccumulator` 클래스 문서에 핵심 판정 조건이 빠진 점(WARNING)은 보완이 필요하다. plan frontmatter의 `owner` 비표준 값과 `spec_impact` 누락은 build guard 및 Gate C와 연결되는 운영 상 이슈로, 코드 문서화보다는 프로세스 정합 문제이지만 plan 문서화 관점에서 지적한다. README나 CHANGELOG 업데이트 필요성은 해당 프로젝트가 spec 기반 문서화 체계를 사용하고 있어 spec 파일이 사실상 API 문서 역할을 하며, 관련 spec 변경(9-rag-search.md §2.2/§4.2, 5-knowledge-base.md §2.2.1)이 동반됐음이 확인되어 별도 README 갱신 누락은 없다.

## 위험도

LOW
