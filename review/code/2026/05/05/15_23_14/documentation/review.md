## 문서화 리뷰 결과

### 발견사항

- **[INFO]** `spec §8` 참조가 여러 파일에서 모호하게 사용됨
  - 위치: `resolve-dynamic-ports.ts:86`, `text-classifier.schema.ts:9-14`
  - 상세: 두 파일 모두 `// spec §8 stable port id` 주석으로 교차 참조하지만, 어느 문서의 §8인지 명시하지 않음. 시스템 프롬프트(`system-prompt.ts`)의 컨텍스트를 보면 `CONVENTIONS.md Principle 8`을 의미하는 것으로 추정되나, 파일 경로 없이 `spec §8`만으로는 독자가 즉시 확인하기 어려움
  - 제안: `// CONVENTIONS.md Principle 8 — stable port id` 또는 `// user_memo/node-specs-improvement/CONVENTIONS.md §8` 형태로 명확화

- **[INFO]** 공개 export된 `categoryDefSchema`에 JSDoc 없음
  - 위치: `text-classifier.schema.ts:9`
  - 상세: `categoryDefSchema`가 이전에는 모듈 내부용이었으나 이번 변경으로 `export`되어 `schema.spec.ts`에서 직접 테스트됨. 하지만 이 export에 JSDoc이 없어 `id` 필드의 slug 제약이 포트 라우팅에 어떤 영향을 미치는지 계약이 문서화되지 않음
  - 제안: 스키마 위에 `id` 필드 포맷 제약 및 포트 라우팅과의 관계를 설명하는 JSDoc 추가

- **[INFO]** `id` 필드의 `hidden: true` UI 상태가 스펙 문서에 미표기
  - 위치: `text-classifier.schema.ts:16`, `spec/4-nodes/3-ai-nodes.md` CategoryDef 표
  - 상세: `categoryDefSchema`의 `id` 필드는 `hidden: true`로 설정패널에서 보이지 않으나, 스펙의 `CategoryDef` 표에 이 사실이 기술되지 않음. 스펙만 읽는 개발자/사용자는 "설정 UI에서 이 필드를 어떻게 지정하는가?"라는 의문을 가질 수 있음. AI Assistant를 통해서만 설정 가능한 필드임을 명시해야 함
  - 제안: CategoryDef 표의 `id` 설명에 "설정 UI에 노출되지 않으며, AI Assistant가 `add_node`/`update_node` 페이로드 생성 시 자동 지정" 추가

- **[INFO]** 테스트 제목에서 `${i}`가 single-quote 문자열 안에 리터럴로 사용됨
  - 위치: `text-classifier.handler.spec.ts:492`, `:507` (단일 레이블), `:912`, `:927` (멀티 레이블)
  - 상세: `'should fall back to class_${i} when id is missing (legacy)'` 형태의 테스트 이름은 의도는 명확하나, single-quote 문자열의 `${i}`는 보간되지 않는 리터럴이므로, JavaScript에 익숙한 독자에게 혼란을 줄 수 있음
  - 제안: `` `should fall back to class_0, class_1, … (index-based) when id is missing (legacy)` `` 또는 `'should fall back to class_N (index-based) when id is missing (legacy)'`로 변경

- **[INFO]** `buildCategoryPortIds` JSDoc에 미러 대상 파일의 경로 미포함
  - 위치: `text-classifier.handler.ts:14-20`
  - 상세: "Mirrors the resolver fallback in `classifierCategoriesPorts` (resolve-dynamic-ports.ts)" 문구가 파일명만 기재하고 경로가 없음. 두 파일이 서로 다른 디렉토리(`nodes/ai/text-classifier/` vs `modules/workflow-assistant/tools/`)에 위치하므로 탐색에 불편함
  - 제안: `(../../../modules/workflow-assistant/tools/resolve-dynamic-ports.ts)` 형태의 상대 경로 또는 monorepo 기준 경로 추가

- **[INFO]** `information_extractor` 예외 설명이 AI 어시스턴트 스펙의 고밀도 셀 말미에 삽입됨
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md`, "워크플로우 조립 규칙" 행
  - 상세: `information_extractor` 예외 설명이 이미 텍스트가 매우 긴 테이블 셀 끝에 괄호로 추가되어 가독성이 낮음. `system-prompt.ts`에서는 별도 bullet으로 잘 분리된 것과 대조적
  - 제안: 테이블 셀 내 별도 문단으로 분리하거나 **bold** 강조 처리로 시인성 향상

---

### 요약

이번 변경은 `text_classifier` 노드에 안정적 포트 ID(`category.id`)를 도입하는 기능으로, 스펙 문서(`3-ai-nodes.md`, `4-ai-assistant.md`)와 시스템 프롬프트(`system-prompt.ts`)가 함께 업데이트되어 구현-문서 정합성은 양호하다. `buildCategoryPortIds`의 JSDoc은 미러링 계약을 명확히 설명하고 있으며 `information_extractor`의 예외 동작 명문화도 올바르다. 다만, `spec §8` 참조의 모호함, `categoryDefSchema` export에 대한 JSDoc 부재, `hidden: true`로 UI에서 진입 불가한 `id` 필드의 접근 방법 미기술이 실용적인 개선 포인트이며, 이는 향후 이 기능을 직접 사용하거나 유지보수하는 개발자의 온보딩 비용을 높일 수 있다.

### 위험도

**LOW**