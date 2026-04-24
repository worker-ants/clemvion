### 발견사항

- **[INFO]** `send-email.schema.ts` — `.optional()` → `.default('')` 변경에 인라인 설명 없음
  - 위치: `subject` (line 116), `body` (line 120)
  - 상세: 변경 이유("LLM이 선택 사항으로 오인해 생략할 수 있음")는 `node-schema-audit.md`에만 존재하고 스키마 파일에는 없음. 단순 UI default 변경처럼 보이지만 실제로는 LLM 행동 제약이라는 비자명한 의도를 담고 있어 향후 리뷰어가 `.optional()`로 되돌릴 위험이 있음.
  - 제안: `switch.schema.ts`의 `id` 필드처럼 짧은 주석 추가.
    ```ts
    subject: z
      .string()
      .default('') // LLM 이 optional 로 오인해 omit 하는 것을 방지
      .meta(...)
    ```

- **[WARNING]** `node-schema-audit.md` — 하드코딩된 라인 번호 참조
  - 위치: F-1 스코프 항목 3번 — `text-classifier.handler.ts:324,402`
  - 상세: 라인 번호는 다른 커밋에서 즉시 무효화됨. plan 문서가 지속적으로 참조될 경우 잘못된 위치로 안내할 수 있음.
  - 제안: 라인 번호 대신 심볼 기반 참조로 교체.
    ```md
    `text-classifier.handler.ts` — `class_${portIndex}` 하드코딩 위치 (현재 두 곳)
    ```

- **[INFO]** `switch.schema.ts` — 교차 참조 경로 불완전
  - 위치: `caseDefSchema` 주석 5번째 줄 — `ai_agent/information_extractor 의 conditionDefSchema.id`
  - 상세: 참조 패턴의 실제 파일 경로가 명시되지 않아 `conditionDefSchema`를 찾으려면 검색이 필요함. 동일 파일 상단의 `import { conditionGroupSchema } from '../if-else/if-else.schema'` 패턴과 달리 경로가 없음.
  - 제안: 구체적 경로 명시 또는 "if-else.schema.ts 의 conditionDefSchema.id 와 동일 패턴" 으로 수정 (이미 import 된 파일이므로 독자가 추적 가능).

- **[INFO]** `node-schema-audit.md` — F-2 조치 후보의 의사결정 미완
  - 위치: F-2 섹션 전체
  - 상세: "(a)가 하위 호환 우수"로 끝나고 최종 결정이 없음. plan 문서로서 의도적인 open question이지만, 이 문서가 spec 역할을 겸하게 될 경우 후임 개발자가 어느 방향으로 구현할지 판단 불가.
  - 제안: 결정 보류 상태임을 명시하거나, 사용자 승인 후 `(a) 채택, YYYY-MM-DD 확인` 형태로 기록하는 관행 적용.

---

### 요약

세 파일 모두 전반적으로 문서화 품질이 양호하다. `switch.schema.ts`의 `id` 필드 주석은 비자명한 설계 결정(fallback index 불안정, hidden UI 이유)을 잘 설명하고 있고, `node-schema-audit.md`는 follow-up 항목의 문제·스코프·발동 조건을 구조적으로 기술해 미래 작업자가 맥락 없이도 파악할 수 있는 수준이다. 단, `send-email.schema.ts`의 `.default('')` 변경은 LLM 행동 제약이라는 비자명한 이유가 plan 문서에만 존재해 스키마만 보는 사람이 되돌릴 위험이 있으며, plan 문서의 하드코딩 라인 번호는 단기 내 부패한다.

### 위험도

**LOW**