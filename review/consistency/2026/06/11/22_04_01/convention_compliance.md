# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/5-data/` (0-common.md / 1-transform.md / 2-code.md)
검토 모드: --impl-done, diff-base=origin/main
검토 일시: 2026-06-11

---

## 발견사항

### [INFO] 0-common.md — 에러 컨트랙트 표 내 `meta.error`/`meta.errorCode`/`exitReason` 표기
- target 위치: `spec/4-nodes/5-data/0-common.md` §4 `meta` 행
- 위반 규약: `spec/conventions/node-output.md` Principle 2 — `meta` 는 실행 메트릭만
- 상세: `meta` 행 설명이 "런타임 에러는 `output.error` + `port:'error'` 로 처리 — `meta.error`/`meta.errorCode`/`exitReason` 별칭은 Phase 1 (D) 에서 폐기 (CONVENTIONS Principle 2 Code 행과 일치)" 라고 기술하고 있다. 이 표현 자체는 규약 위반이 아니나 "Phase 1 (D) 에서 폐기"라는 미래형 표현이 구현 완료(status: implemented) 상태인 현 시점과 일치하지 않는다. node-output.md Principle 2 는 이미 해당 별칭의 폐기를 완료형으로 기술한다.
- 제안: "Phase 1 (D) 에서 폐기" → "폐기됨 (CONVENTIONS Principle 2 Code 행 참조)" 으로 과거형 정리.

### [INFO] 0-common.md — `CONVENTIONS Principle 0` 참조 링크 표기
- target 위치: `spec/4-nodes/5-data/0-common.md` §4 첫 줄
- 위반 규약: 특정 규약 조항 없음. 링크 정확성 권고.
- 상세: "CONVENTIONS Principle 0" 링크가 `../../conventions/node-output.md` 를 참조하고 있으나 `Principle 0` 는 `node-output.md` 의 섹션 내용과 일치하며 정확하다. 그러나 동일 단락에서 일부 참조는 앵커 없이 파일 경로만 기술되어 있다 (예: `## 4.1 에러 컨트랙트 (CONVENTIONS Principle 3)` 의 참조가 Principle 3.3 과 3.1 두 곳에 걸침). 컨텍스트 충분하므로 INFO 수준.
- 제안: 필요시 섹션 앵커 보강.

### [INFO] 1-transform.md — `source of truth` 명시 표기 일관성
- target 위치: `spec/4-nodes/5-data/1-transform.md` §1 하단 blockquote
- 위반 규약: CLAUDE.md "단일 진실 원칙" — 정보 저장 위치 규칙
- 상세: `> Source of truth: codebase/backend/.../transform.schema.ts` 표기가 있다. spec 문서 자체가 `spec/` 에 있는 단일 진실 원칙 대상인데, 코드 파일을 "source of truth" 로 명시하면 spec 과 코드 중 어느 쪽이 SoT 인지 혼동을 줄 수 있다. 다른 노드 spec 도 동일 패턴을 쓰는 경우가 있으므로 INFO 수준.
- 제안: `> 구현 레퍼런스: ...` 또는 `> 스키마 구현: ...` 으로 표현 변경이 명확성 향상에 도움.

### [INFO] 2-code.md — `legacyCode` 필드가 `details` 하위에 포함된 이유 미기술
- target 위치: `spec/4-nodes/5-data/2-code.md` §5.3 공통 필드 표
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2.2 — `details` 의 노드별 선택 스키마
- 상세: `output.error.details.legacyCode` 는 내부 분류용 legacy 코드로 `details` 에 배치했는데, Principle 3.2.2 는 details 의 노드별 선택 스키마가 "각 노드 spec 의 `output.error.details` 표가 정의" 한다고 명시한다. 본 문서는 이를 §5.3 표에서 충실히 정의하고 있다. 다만 `legacyCode` 가 클라이언트에게 노출되는 점 (`후속 노드는 output.error.code 사용` 권고만 있음) 에 대해 convention에서 "후속 노드가 직접 사용해선 안 됨" 임을 명시한다면 더 명확하다.
- 제안: `후속 노드는 output.error.code 사용` 을 강조 인라인 blockquote 로 정리 (현재 서술은 충분하나 테이블 노트로 분리 권고).

### [INFO] 2-code.md — `5.3.3 메모리 초과` 케이스에 `meta.durationMs` 누락
- target 위치: `spec/4-nodes/5-data/2-code.md` §5.3.3 JSON 예시 (라인 618~625 구간)
- 위반 규약: `spec/conventions/node-output.md` Principle 2 — 공통 필드 `meta.durationMs: number` 필수
- 상세: §5.3.3 메모리 초과 케이스 JSON 예시에서 `meta` 가 `{ "success": false, "logs": [] }` 이고 `durationMs` 가 없다. isolate 가 폐기될 때 `durationMs` 를 측정할 수 없을 수도 있으나, Principle 2 는 `meta.durationMs` 를 **공통 필수** 로 규정한다. §5.3 공통 필드 표에도 "메모리 초과 케이스에서는 timeout 값에 근사" 같은 언급이 없다.
- 제안: 메모리 초과 시 `durationMs` 측정 방법 (예: `Date.now()` 기준 경과 또는 `0` fallback)을 spec에 기술하고, JSON 예시에 `durationMs` 필드 추가. 만약 측정 불가능하다면 `0` fallback 이유를 Rationale 또는 주석으로 명시. Principle 2 필수 필드 위반이므로 핸들러 구현도 확인 필요.

### [WARNING] 2-code.md — `5.3.1 사용자 코드 throw` 케이스 JSON에 `details.stack` 항상 노출
- target 위치: `spec/4-nodes/5-data/2-code.md` §5.3.1 JSON 예시 (라인 542~565)
- 위반 규약: `spec/conventions/node-output.md` Principle 11 — 출력 예시 문서화 규칙 + §5.3 공통 필드 표의 자체 spec
- 상세: §5.3.1 JSON 예시에 `details.stack` 이 포함되어 있으나, 동일 문서 §5.3 공통 필드 표의 `output.error.details.stack` 항목이 "**`NODE_ENV !== 'production'` 일 때만 노출** (프로덕션에서는 내부 파일 경로 노출 방지로 생략)" 이라고 명시한다. 예시는 항상 stack 을 포함하는 형태여서 독자가 stack 이 항상 존재하는 것으로 오해할 수 있다. Principle 11 은 선택적 필드를 표에 `?` 표기하도록 하는데, JSON 예시가 non-prod 가정임을 명시하지 않았다.
- 제안: §5.3.1 JSON 예시 직전 또는 직후에 `// 비프로덕션 환경에서만 stack 포함` 주석을 추가하거나, `details.stack` 을 optional로 JSON에서 명시 처리 (예: `"stack": "..." // non-production only`). 혹은 §5.3.1 케이스 헤딩 하단에 "이 예시는 비프로덕션 환경 기준" 보조 노트 추가.

### [INFO] 2-code.md — `5.3.2 타임아웃` 케이스 `details.stack` 값이 `"..."` 으로 추상화
- target 위치: `spec/4-nodes/5-data/2-code.md` §5.3.2 JSON 예시 (라인 569~595)
- 위반 규약: Principle 11 — 출력 예시 문서화 규칙 (예시의 충실성)
- 상세: `"stack": "..."` 은 문서 예시로서 실제 값을 생략한 플레이스홀더다. 타임아웃 stack 이 특정 패턴을 갖는다면 예시에 반영하는 것이 좋고, 그렇지 않으면 `"stack": "Error: Code execution timed out\n    at ..."` 형태의 대표 예시가 더 명확하다. §5.3.1 의 `"stack": "Error: boom\n    at code-node.js:3:7"` 대비 일관성 부재.
- 제안: 타임아웃 stack 대표 예시 또는 `null` / omitted 처리 일관성 확보.

### [INFO] 0-common.md / 1-transform.md — 문서 구조 (3섹션 권장)
- target 위치: `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/5-data/1-transform.md`
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: `0-common.md` 와 `1-transform.md` 는 Overview 섹션 없이 바로 본문으로 진입한다. `2-code.md` 는 `## Rationale` 섹션이 있으나, `0-common.md` 와 `1-transform.md` 는 Rationale 섹션이 없다. 특히 `1-transform.md` 는 설계 결정 사항(no-op 정책, pre-flight throw 정책 등)을 본문에 인라인으로 섞어 기술하는데 Rationale 에서 근거를 분리하면 가독성이 개선된다. 권장 사항이므로 INFO 수준.
- 제안: `1-transform.md` 에 `## Rationale` 섹션 추가하여 "Transform이 runtime 에러 포트 없음 — 전 op pre-flight throw 설계 근거", "no-op 정책 근거" 등을 이동. `0-common.md` 도 동일 권장.

---

## 요약

`spec/4-nodes/5-data/` 3개 파일은 전반적으로 `spec/conventions/node-output.md` 의 5필드 invariant, Principle 2 (meta 실행 메트릭), Principle 3 (에러 컨트랙트), Principle 7 (config echo), Principle 8.2 (LLM 계열 한정 `output.result` 래핑), Principle 11 (출력 예시 문서화) 를 충실히 준수한다. `error-codes.md` 의 `UPPER_SNAKE_CASE` 요건도 신규 에러 코드(`CODE_MEMORY_LIMIT`, `CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`) 전부 준수한다. `spec-impl-evidence.md` 의 frontmatter 스키마(`id`/`status`/`code:`) 도 세 파일 모두 올바르게 구비되어 있다. 유일한 실질적 주의 사항은 §5.3.3(메모리 초과) JSON 예시에서 Principle 2 공통 필수 필드인 `meta.durationMs` 가 누락된 점(INFO)과 §5.3.1 JSON 예시에서 `details.stack` 이 비프로덕션 한정임을 명시하지 않은 점(WARNING)이다. 나머지 발견사항은 문서 명확성 개선 권고 수준이다.

---

## 위험도

LOW
