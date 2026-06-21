# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
대상 경로: `spec/4-nodes/3-ai`
검토 대상: `0-common.md` / `1-ai-agent.md` / `3-information-extractor.md`

---

## 발견사항

### [INFO] §12.12 재번복 이력의 현행화 상태 — 옛 단락 보존 표기 명확성
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.12 (3개 하위 단락)
- 과거 결정 출처: AI Agent §12.12 자체 Rationale — "전용 필드 도입" 단락 → "후속 결정(위젯)" 단락 → "재번복 결정" 단락
- 상세: §12.12 는 3단계의 설계 번복 이력이 연속으로 기록되어 있으며, 각 단락 앞에 ⚠️ 경고 마커와 "이 단락은 의사결정 이력으로만 보존" 주석이 명시되어 있다. 현행 구현은 세 번째 단락("재번복 결정")인 `summaryModelConfigId`/`extractionModelConfigId`(`config.id` 저장) 을 따른다. 구현 착수 시 개발자가 첫 번째·두 번째 단락을 현행 설계로 오독할 위험이 존재한다. 기능 자체는 정확하게 `§1 config 표`·`§6.1`에 반영되어 있으므로 CRITICAL/WARNING 수준은 아니지만, 혼동 방지를 위해 각 폐기 단락에 `~~취소선~~` 또는 섹션 헤더 레벨 구분이 추가되면 가독성이 향상된다.
- 제안: §12.12 의 첫 번째("전용 필드 도입") 및 두 번째("후속 결정") 단락에 취소선 또는 `> **[폐기됨]**` 블록인용을 추가해 현행 설계 단락과 시각적으로 분리한다. ⚠️ 마커만으로는 스캔 시 충분하지 않을 수 있다.

---

### [INFO] `conversationHistory` 필드 deadweight 제거 이후 `.passthrough()` 동작 명시 — 0-common.md 에 미반영
- target 위치: `spec/4-nodes/3-ai/0-common.md` §10 (Conversation Context)
- 과거 결정 출처: AI Agent §12.2 `conversationHistory` 제거 사유 Rationale
- 상세: §12.2 는 `conversationHistory`/`historyCount` 가 deadweight 였음을 설명하고, "스키마가 `.passthrough()` 이므로 DB legacy 워크플로 데이터에 두 키가 남아 있어도 silently 통과" 함을 명시한다. 이 `.passthrough()` 정책(legacy key silently 통과)은 동일하게 AI Agent §1 의 `toolNodeIds`/`toolOverrides` 제거 시에도 언급되지만, `0-common.md §10` 의 contextScope 필드 설명에는 이 "legacy field passthrough" 불변식에 대한 언급이 없다. 구현 시 schema `.passthrough()` 가 의도된 결정인지 우연인지 불명확할 수 있다.
- 제안: `0-common.md §10` 또는 `§Rationale` 에 "스키마는 `.passthrough()` — legacy 워크플로 데이터에 옛 필드가 잔존해도 silently 통과하나 핸들러는 읽지 않음" 한 줄 기재 권장.

---

### [INFO] `information_extractor` 의 `summary_buffer` 명시 기각 — 0-common.md §10 memoryStrategy 표기와 정합 확인 필요
- target 위치: `spec/4-nodes/3-ai/0-common.md` §10, `spec/4-nodes/3-ai/3-information-extractor.md` §1
- 과거 결정 출처: `0-common.md §10` 본문 ("IE 는 `summary_buffer`(working-memory 압축 무의미) 없음") + `3-information-extractor.md §Rationale` ("summary_buffer 없음 — 추출 노드에 working-memory 압축 무의미")
- 상세: `0-common.md §10` 에서 `memoryStrategy` 의 적용 범위를 "ai_agent 는 3값, information_extractor 는 manual/persistent 2값" 으로 명시하고 있으며, `3-information-extractor.md §1` config 표도 `manual` / `persistent` 2값으로 정확히 정의한다. 기각된 `summary_buffer` 대안이 실제로 spec 에서 배제되어 있고, 구현 대상 파일 (`information-extractor.schema.ts`) 이 zod 스키마에서 이 2값만 허용해야 함이 이미 spec 에 근거된 결정이다. 상호 정합 상태 양호.
- 제안: 구현 시 `information-extractor.schema.ts` 에 `summary_buffer` 값이 우발적으로 포함되지 않도록 schema 리뷰 체크포인트로 활용.

---

### [INFO] `render_form` 의 `single_turn` 에서의 silent drop — Rationale 와 spec 본문 표기 일관성
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1.d.ii / §4.1
- 과거 결정 출처: AI Agent §12.4 "Schema 위반의 silent fallback 결정" / §12.5 "render_form 활성 form 의 timeline 인라인 표현 통합"
- 상세: `single_turn` 에서 `render_form` 이 호출되면 §4.1 "Schema 위반 처리" 와 동일하게 1회 재시도 후 silent drop 한다는 결정이 §6.1.d.ii 에 기재되어 있다. §12.4 의 "Schema 위반 silent fallback" 은 display-only 도구의 schema 위반 기각에 관한 결정이고, `render_form`/`single_turn` 의 mode-mismatch 케이스는 별도 의미이나 동일 fallback 메커니즘을 재사용하는 것으로 기술한다. 두 케이스(schema 위반 vs mode mismatch)의 기각 근거를 합산 표기하는 것이 혼동을 줄 수 있으나, 양자 모두 "사용자가 mode=multi_turn 전환으로 해결해야 함" 이라는 안내가 §6.1.d.ii 에 명시되어 있어 결정 근거는 충분히 기술됨.
- 제안: 구현 시 mode-mismatch silent drop 경로가 schema 위반 silent drop 과 **분리된 코드 브랜치** 로 구현되도록 주의. 두 케이스를 같은 코드 경로로 합산하면 `meta.presentationSchemaViolations[]` 에 mode-mismatch 가 schema 위반처럼 기록될 수 있다.

---

## 요약

`spec/4-nodes/3-ai` 영역의 target 문서는 전반적으로 기존 Rationale 결정과 높은 연속성을 유지하고 있다. 명시적으로 기각된 대안(예: `conversationHistory`, IE 의 `summary_buffer`, `toolNodeIds`/`toolOverrides`, `contextScope enum 에 auto 추가`, `render_*` 워크플로 포트 분기 흉내)이 어느 곳에서도 재도입되지 않았으며, 합의된 설계 원칙(`.passthrough()` schema, KB/MCP graceful degradation, prompt cache 안정 프리픽스 분리, config.id 저장 ModelConfig 선택)도 일관되게 적용되고 있다. §12.12 의 3단계 번복 이력이 폐기 단락과 현행 단락을 혼재시켜 가독성 위험이 있는 것이 가장 주목할 만한 사항이나, 각 단락에 ⚠️ 경고 마커와 보존 주석이 있어 결정 자체는 추적 가능하다. 구현 착수를 차단할 CRITICAL/WARNING 수준의 Rationale 연속성 위반은 발견되지 않았다.

## 위험도

LOW
