## 문서화 코드 리뷰

### 발견사항

---

**[WARNING]** spec/4-nodes/6-presentation-nodes.md — 섹션 번호 불일치
- 위치: §1.2.x 블로킹/재개 컨트랙트 참조
- 상세: spec 문서는 "Principle 1.1 / 4.3 / 4.5 기준"을 여러 곳에서 인용하지만, `CONVENTIONS.md` 파일(규약 원문)의 실제 섹션 번호와 일치하는지 검증이 없음. 참조가 단방향(spec→conventions)이라 conventions가 변경 시 orphan 참조가 됨.
- 제안: "CONVENTIONS §4.3" 등 참조 앞에 `> 원문: user_memo/node-specs-improvement/CONVENTIONS.md §X.X` 형태로 파일 경로를 직접 명시

---

**[WARNING]** spec/4-nodes/6-presentation-nodes.md — `previousOutput` 필드 미완성 문서
- 위치: Carousel Resumed 출력 형식 JSON 내 `"previousOutput"` 필드
- 상세: `"previousOutput": { /* Stage 3 전환기 호환 필드 — Phase 3 에서 제거 예정 */ }` 주석만 있고, 실제 형태(타입, 포함 필드)가 정의되어 있지 않음. 프런트엔드 개발자가 이 필드를 사용해야 하는 상황에서 구현 근거가 없음.
- 제안: 실제 포함 필드 목록 명시 또는 "내부 호환용, 외부 소비 금지"임을 명확히 표기

---

**[WARNING]** spec/5-system/3-error-handling.md — §1.4 에러 코드표와 신규 `error-codes.ts` 불일치
- 위치: §1.4 워크플로우 실행 에러 표
- 상세: §1.4에는 `NODE_EXECUTION_FAILED`, `LLM_ERROR`, `INTEGRATION_ERROR` 등 추상적 코드가 남아 있으나, 신규 `error-codes.ts`에는 `HTTP_5XX`, `LLM_CALL_FAILED` 등 구체적 코드로 교체됨. 두 목록이 공존해 혼란 가능.
- 제안: §1.4 표를 `error-codes.ts`의 `ErrorCode` enum 기준으로 갱신하거나, 레거시 코드임을 명시하고 "최신 목록은 §3.2 참조" 크로스 링크 추가

---

**[INFO]** spec/5-system/4-execution-engine.md — §1.2.x 섹션 번호 비관례적
- 위치: `### 1.2.x 블로킹/재개 컨트랙트` 헤더
- 상세: Markdown 섹션 번호가 `1.2.x`(리터럴 `x`)로 표기되어 있음. 이는 자동 TOC 생성 도구나 문서 링크에서 앵커 문제를 유발할 수 있으며, 향후 번호 체계도 불분명해짐.
- 제안: `### 1.2a` 또는 `### 1.3`으로 교체, 필요 시 이하 섹션 번호 일괄 증가

---

**[INFO]** backend/src/nodes/core/error-codes.ts — 모듈 수준 문서 충분하나 사용 예제 없음
- 위치: 파일 상단 JSDoc
- 상세: enum 목적과 conventions 참조는 잘 되어 있음. 그러나 `buildErrorEnvelope` 함수의 JSDoc에 실제 호출 예시가 없어 핸들러 작성자가 `details` 필드 형태를 파악하기 어려움.
- 제안: JSDoc에 `@example` 블록 1개 추가 (`buildErrorEnvelope(ErrorCode.HTTP_5XX, 'Bad Gateway', { statusCode: 502 })`)

---

**[INFO]** backend/src/scripts/migrate-node-output-refs.spec.ts — DB-touching `main()` 테스트 전략 미문서화
- 위치: 파일 상단 블록 주석
- 상세: "DB-touching `main()` path is exercised manually (staging dry-run before prod apply)" 는 좋은 설명이나, dry-run 실행 방법(`npx ts-node ...`)이 이 파일에는 없고 progress 체크리스트에만 있음. 테스트 파일을 독립적으로 읽는 개발자가 수동 검증 방법을 알기 어려움.
- 제안: `@see` 또는 주석에 `npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run` 명령어 명시

---

**[INFO]** memory/node-specs-improvement-progress.md — "후속 4: Spec 잔여 정비" 항목과 실제 완료 상태 불일치
- 위치: 파일 하단 후속 작업 목록
- 상세: `spec/5-system/3-error-handling.md`과 `spec/4-nodes/6-presentation-nodes.md`의 carousel/chart/table 섹션 정비가 "후속 4" 미완 항목으로 남아 있으나, 이번 diff에서 실제로 해당 섹션들이 수정됨. 체크리스트가 현황을 반영하지 못함.
- 제안: "후속 4" 항목 중 이번에 완료된 항목을 ✅로 표시하고 진행 로그에 기록

---

### 요약

전반적으로 변경된 spec 문서들은 `config/output/meta` 분리 원칙(Principle 1.1)을 일관되게 적용하고, `interaction` payload 규격을 명확히 정의한 점에서 문서화 품질이 향상되었다. 그러나 §1.4 레거시 에러 코드표가 신규 `error-codes.ts`와 병존하는 불일치, `1.2.x` 비관례적 섹션 번호, `previousOutput` 필드의 미완성 명세, 그리고 progress 체크리스트의 현황 미반영이 잠재적 혼란 요소로 남아 있다. `error-codes.ts`와 마이그레이션 스크립트의 코드 내 문서는 목적과 관계가 잘 기술되어 있으나 실사용 예제(`@example`)를 보완하면 핸들러 작성자 온보딩에 도움이 된다.

### 위험도

**LOW**