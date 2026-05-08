### 발견사항

---

**[WARNING] 멀티턴 resume systemPrompt 폴백 누락**
- 위치: `ai-agent.handler.ts` — resume `waitingResult` config 구성부 (~line 1186)
- 상세: 초기 턴 경로는 `systemPrompt: rawConfig.systemPrompt ?? systemPrompt`로 폴백을 제공하는 반면, resume 경로는 `systemPrompt: turnRawConfig.systemPrompt`에 폴백 없음. `state.rawConfig`가 없거나 `systemPrompt` 필드가 누락된 경우 config echo에 `undefined` 기록.
- 제안: `systemPrompt: turnRawConfig.systemPrompt ?? systemPrompt`로 통일.

---

**[WARNING] loop.handler.ts — parseNumeric void 호출은 사실상 dead code**
- 위치: `loop.handler.ts` execute() 내 두 `void` 호출
- 상세: `parseNumeric`은 순수 함수(부수효과 없음)임에도 주석에 "side-effect of validating"이라고 기술되어 있음. `void parseNumeric(count)`는 반환값을 버리고 어떤 동작도 수행하지 않음. 이전 코드는 `resolvedCount = parseNumeric(count) ?? 0`으로 실제로 파싱된 값을 사용했으나 지금은 그 역할도 없음. 주석이 의도를 오도하며 코드 리더에게 혼란을 줌.
- 제안: void 호출 라인 2개 제거. validate()가 유효성을 담당하므로 execute() 내 중복 검사는 불필요.

---

**[WARNING] table.handler.ts — output 스키마 파괴적 변경 (resolved columns 위치 이동)**
- 위치: `table.handler.ts` payload/configEcho 구성부
- 상세: 기존에 `config.columns`에 있던 `resolvedColumns`(라벨 표현식 평가 완료본)가 `output.columns`로 이동됨. `config.columns`에는 이제 raw column 정의가 들어감. `config.columns`에서 평가된 컬럼 라벨을 읽던 다운스트림 노드 또는 프론트엔드 소비자는 silently 깨짐.
- 제안: 마이그레이션 범위를 명시하거나, `output`의 `columns` 키 추가가 스펙 문서 및 소비자 코드에 반영되었는지 확인 필요.

---

**[INFO] plan/complete 배치 규약 위반 가능성**
- 위치: `plan/complete/ai-agent-tool-connection-rewrite.md`
- 상세: CLAUDE.md 규약상 `plan/complete/`는 "모든 작업·체크리스트·후속 항목까지 끝난 plan 문서만" 허용. 해당 문서의 `## 남은 작업` 섹션에는 미완성 항목 다수가 존재(재작성 작업 항목 7개, 설계 질문 4개). DEPRECATED 상태라도 체크박스 미완 항목이 있으면 in-progress에 두는 것이 규약.
- 제안: DEPRECATED 처리가 "완료"의 근거라면 문서 서두에 명시하고 CLAUDE.md에 예외 규칙 추가. 또는 `plan/in-progress/`에 유지하고 DEPRECATED 주석만 추가.

---

**[INFO] chart.handler.ts — void 변수 선언 코드 냄새**
- 위치: `chart.handler.ts` ~line 74–75
- 상세: `const chartType = config.chartType as string;`와 `const title = config.title as string | undefined;`를 선언한 직후 `void chartType; void title;`로 버림. 이전 코드에서 configEcho에 사용되던 변수를 rawConfig로 대체하면서 발생. TypeScript unused-variable 경고 회피용이지만 코드 명확성 저하.
- 제안: 두 const 선언 자체를 제거. `xAxis`/`yAxis`는 여전히 실행 로직에 사용되므로 유지.

---

**[INFO] information-extractor.handler.ts — 필드명 불일치 (outputSchema → schema)**
- 위치: `information-extractor.handler.ts` configEcho 구성
- 상세: 입력 config 키는 `outputSchema`이지만 출력 configEcho 키는 `schema`로 다름 (`rawConfig.outputSchema ?? outputSchema`를 `schema:`에 할당). 기존 동작의 유지이나 rawConfig 패턴 도입 후에도 이 불일치가 그대로 지속됨.
- 제안: 동작에 영향은 없으나 혼란 예방을 위해 스펙 주석으로 명시하거나 키를 통일.

---

**[INFO] parallel.handler.ts — 비클램핑 config echo와 실제 포트 수 불일치**
- 위치: `parallel.handler.ts` configEcho
- 상세: `config.branchCount`는 raw 값(예: 20) 그대로 echo되지만, 실제 활성화된 포트는 클램프된 값(2–16)으로 결정됨. 소비자가 echoed `config.branchCount`를 신뢰하면 실제 생성된 포트 수와 괴리. 스펙 테스트는 갱신되었으나 API 계약 문서 업데이트 여부 불명확.

---

### 요약

이번 PR은 CONVENTIONS Principle 7(config raw echo)을 36개 핸들러에 일관되게 적용한 대규모 마이그레이션으로, 패턴 자체는 `context.rawConfig ?? config` 폴백 전략으로 하위 호환성을 유지하며 올바르게 구현되었다. 그러나 멀티턴 AI Agent의 resume 경로에서 `systemPrompt` 폴백 누락(잠재적 undefined echo), `loop.handler.ts`의 dead code와 오해를 유발하는 주석, `table.handler.ts`의 resolved columns 위치 이동에 따른 파괴적 output 스키마 변경, 그리고 plan/complete 배치 규약 가능 위반이 요구사항 완전성 관점에서 점검이 필요하다.

### 위험도

**MEDIUM** — table columns schema 이동은 프론트엔드/다운스트림 소비자에게 잠재적 런타임 회귀를 유발할 수 있으며, multi-turn systemPrompt 누락은 AI Agent 실행 이력의 정합성에 영향을 줄 수 있음.