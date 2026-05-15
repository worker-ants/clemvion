### 발견사항

- **[INFO]** `switch.schema.ts` — `id` 필드 인라인 주석 과다
  - 위치: `caseDefSchema.id` 정의부 (6줄 블록 주석)
  - 상세: 주석이 코드 본체(4줄)보다 길고, `resolve-dynamic-ports.ts` 경로·spec 섹션 번호·다른 스키마 참조를 포함한다. 참조 대상이 이동·삭제될 경우 주석만 남아 stale 정보가 된다. 동일 패턴인 `ai_agent/conditionDefSchema.id` 쪽에는 이 수준의 주석이 없다.
  - 제안: 주석을 "spec §8 stable-id — resolver fallback: `case_${i}`" 한 줄로 축약하고, 나머지 내용은 이미 생성된 `plan/node-schema-audit.md` 로 이관 (현재 plan 문서에 동일 내용이 중복 기술됨).

- **[INFO]** `plan/node-schema-audit.md` — F-1·F-3·F-5 간 `text-classifier` 관련 항목 분산
  - 위치: F-1 (HIGH), F-5 (LOW)
  - 상세: `categoryDefSchema` 에 `id` 추가(F-1)와 `name`/`description` `.default('')`(F-5)는 동일 파일·동일 스키마 대상이다. 우선순위만 다르게 별도 항목으로 분리되어 있어, 나중에 F-1 작업 시 F-5 를 누락할 가능성이 있다.
  - 제안: F-5 를 F-1 의 스코프 항목 6번으로 병합하거나 "F-1 처리 시 함께" 명시.

- **[INFO]** `send-email.schema.ts` — 출력 스키마(`sendEmailNodeOutputSchema`)의 `subject` 는 여전히 `.optional()`
  - 위치: `sendEmailNodeOutputSchema.config.subject` (라인 ~28)
  - 상세: 변경 대상인 config 스키마는 `.default('')` 로 통일됐지만, 출력 스키마의 동명 필드는 `.optional()` 그대로다. 출력 스키마는 "받을 수 있는 형태"를 기술하므로 의도적 차이이나, 리더가 두 스키마를 나란히 볼 때 불일치로 오해할 수 있다.
  - 제안: 현행 유지 가능. 단, 출력 스키마 상단 JSDoc 또는 파일 내 짧은 한 줄 주석으로 "output schema uses optional; config schema uses defaults" 차이를 명시하면 혼선 예방.

---

### 요약

변경 범위가 작고 명확하다. `send-email`의 `.default('')` 적용은 동일 파일 내 배열 필드(`to`/`cc`/`bcc`/`attachments`)의 `.default([])` 패턴과 일관되며, `switch`의 `id` 필드 추가도 `conditionDefSchema.id` 패턴을 정확히 재현했다. 유지보수 관점의 주요 위험은 인라인 주석의 과도한 외부 참조(stale 위험)와 `plan/` 문서와의 중복 기술이며, 둘 다 기능 결함은 아닌 문서 관리 수준의 이슈다.

### 위험도

**LOW**