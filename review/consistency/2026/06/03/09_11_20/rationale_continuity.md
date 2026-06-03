## 발견사항

- **[INFO]** `node-output.md` 에 `## Rationale` 섹션 미신설
  - target 위치: `spec/conventions/node-output.md` 전체 (Rationale 섹션 없음)
  - 과거 결정 출처: CLAUDE.md 단일 진실 원칙 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
  - 상세: `node-output.md` 는 Principle 7 `code.config.code` echo 정책 변경(금지 → 허용) 과 Principle 8.2 코드 실행 결과 위치 변경(`output.result` → `output` root) 이라는 두 가지 결정 번복을 담았지만, `## Rationale` 섹션이 없다. 결정 근거는 본문 인라인 박스(`> **`code.config.code` echo 명확화**`)와 `2-code.md § Rationale`에만 분산되어 있다. target 문서 `plan/in-progress/spec-draft-conventions-code-data.md`의 변경 3번 항목("잔여 INFO — `node-output.md` `## Rationale` 섹션 신설")이 본 PR scope 밖으로 분리됐음을 명시하고 있으나, conventions 문서가 중요한 결정 변경을 담으면서 자체 Rationale 섹션이 없는 상태는 향후 참조자 혼동의 소지가 있다.
  - 제안: `spec/conventions/node-output.md` 말미에 `## Rationale` 섹션 신설. 주요 항목: (1) `code.config.code` Principle 7 분류 변경 경위, (2) Code/Transform `output.result` 래핑 미적용 원칙. 단, plan에서 이미 INFO 잔여로 명시·분리됐으므로 현 PR 차단 사유는 아님.

- **[INFO]** Principle 2 `meta.error?`/`meta.errorCode?` 폐기 — 폐기 결정 Rationale 기록 위치 분산
  - target 위치: `spec/conventions/node-output.md` Principle 2 Code 행 (line ~91), `spec/4-nodes/5-data/0-common.md` §4 meta 행
  - 과거 결정 출처: `spec/4-nodes/5-data/2-code.md` §5.3 에서 이미 `output.error` + `port:'error'` 방식 채택이 사실상 결정됐으나 Rationale 로 명문화된 적 없었음
  - 상세: `meta.error?`/`meta.errorCode?`/`exitReason?` 필드가 "Phase 1 D 에서 폐기"됐다는 설명이 인라인 주석 형태로만 등장한다. 폐기 결정 Rationale(왜 `output.error` + `port:'error'`로 일원화하는가, 기각된 `meta.error` 병행 방식의 이유)가 spec에 명문화되지 않았다. 현재 변경은 drift 정합화이므로 데이터 모델 변경은 없으나, 폐기 이유가 `2-code.md § Rationale`에도 누락돼 있다.
  - 제안: `2-code.md § Rationale` 또는 `node-output.md § Rationale`에 `meta.error`/`meta.errorCode` 폐기 경위 및 `output.error + port:'error'` 단일 경로 채택 이유를 한 항으로 추가.

---

### 요약

Rationale 연속성 관점에서 본 target 변경은 **기각된 대안의 재도입이나 합의된 invariant 위반이 없다**. 세 가지 핵심 변경 — `code.config.code` echo 정책 정정, `output.result` 래핑 미적용 명확화, `meta.error?`/`meta.errorCode?` 폐기 — 모두 기존 `2-code.md §5.1·§5.3` 의 구현 사실 및 테스트와 일치하는 drift 정합화이며, `2-code.md § Rationale` 신설을 통해 결정 번복의 근거와 기각된 대안이 새로 명문화됐다. 다만 `node-output.md` 자체에 `## Rationale` 섹션이 없어 두 원칙 변경(Principle 7·8.2)의 결정 근거가 본문 인라인 박스와 `2-code.md` 간에 분산되어 있고, `meta.error` 폐기 Rationale도 누락돼 있다. 두 사항 모두 plan이 INFO 잔여로 명시 분리했으므로 현 시점에서 차단 사유는 아니나, 연속성 보완 차원의 후속 작업으로 추적이 권장된다.

### 위험도

LOW
