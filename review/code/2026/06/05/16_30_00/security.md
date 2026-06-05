# Security Review — IE persistent recall/extract (memory-strategy-extend-ad5987)

**Scope**: `git diff 21fa8194..HEAD -- codebase/`
**Date**: 2026-06-05
**Reviewer**: security sub-agent

---

## 발견사항

### INFO — workspace_id 격리: 권위값 경로 확인됨, 단 multi-turn 종결에서 state 기원 주의

- **위치**: `information-extractor.handler.ts` L870, L1215 (`state.workspaceId`)
- **상세**: single-turn 및 executeMultiTurn 첫 진입은 `context.variables.__workspaceId`(엔진 주입)에서 직접 읽는다. multi-turn 종결·resume 경로(`buildMultiTurnFinalOutput`, `processMultiTurnMessage`)는 `state.workspaceId`를 사용한다. 이 값은 `hydrateState`에서 직렬화된 state를 그대로 복원하므로 이론상 state 스토리지가 오염될 경우 외부 workspaceId가 주입될 수 있는 경로처럼 보인다. 그러나 `execution-engine.service.ts` L4386~4414에서 retry/reentry 시 `workspaceId`를 `context.variables.__workspaceId`로 **강제 덮어쓴다**. 일반 resume 경로(정상 turn2+)도 엔진이 DB의 Execution row에서 복원한 state를 넘기는 방식이므로, 사용자 입력에서 직접 workspaceId를 바꿀 수 없다. **현재 위험도는 낮지만**, 엔진 resume 경로 전체에 걸쳐 state.workspaceId를 재주입하는 보호가 일관되게 적용되는지 별도로 확인할 필요가 있다.
- **제안**: `processMultiTurnMessage` 진입부에서 `state.workspaceId`를 그대로 쓰는 대신 엔진이 호출 시 workspaceId를 인자로 명시적으로 전달하거나, IE 핸들러 내부에서 state.workspaceId를 신뢰하는 모든 지점에 주석으로 "엔진 덮어쓰기 보장 경로" 를 명시하는 것을 권장.

---

### INFO — memoryKey expression 평가 안전성: sanitize 정상 작동, 단 표현식 평가 자체는 엔진 담당

- **위치**: `information-extractor.handler.ts` L286~L292, L362~L368; `agent-memory.service.ts` L273~L302
- **상세**: `memoryKey`는 schema 상 `widget: 'expression'`으로 엔진이 `{{ $input.userId }}` 형태의 템플릿을 실행 전에 평가한다. 핸들러는 이미 평가된 문자열을 `config.memoryKey`로 받는다. `agentMemoryService.resolveScopeKey(evaluatedMemoryKey, executionId)`는 null byte·C0/C1 제어문자 제거, 512자 길이 상한 후 SHA-256 결정적 해시 축약을 적용하며, 모든 SQL 쿼리는 파라미터 바인딩을 사용한다. 인젝션 위험은 이미 차단되어 있다. `executionId`가 fallback scope가 되므로 memoryKey를 비워도 같은 실행 내에서만 격리되어 cross-workspace 노출은 없다.
- **제안**: 변경 없이도 안전. 문서화만 보강 가능.

---

### INFO — LLM 프롬프트 주입 방어: buildRecallBlock/wrapMemoryContent 재사용 확인됨

- **위치**: `information-extractor.handler.ts` L330~L333; `agent-memory-injection.ts` L64~L96, L138~L146
- **상세**: IE가 `buildRecallBlock`과 `appendStablePrefix`를 ai_agent에서 그대로 임포트해 재사용한다. `buildRecallBlock`은 회수 content마다 `wrapMemoryContent`로 `[memory]...[/memory]` 마커 wrap을 적용하고, 마커 내 동일 토큰 재등장은 U+200B(zero-width space) escape로 차단한다. DATA_FENCE_GUIDE 문구가 회수 블록 헤더 직후에 삽입되어 LLM에게 해당 블록이 지시문이 아닌 데이터임을 명시한다. ai_agent의 패턴을 동일하게 상속하므로 prompt injection 방어 수준이 동일하다.
- **제안**: 변경 없음. 단, W-2 방어는 **소프트 컨트롤**(프롬프트 레이어 한정)임을 인지할 것. data fence가 충분히 강력한 모델에서는 유효하나, 추출 LLM이 의도적으로 회피하도록 훈련된 모델은 아님. 현재로서는 업계 표준 수준.

---

### WARNING — 저장 전 instruction 필터의 적용 범위 제한 (W-2 보조 필터)

- **위치**: `agent-memory.service.ts` L77~L89, L402~L413
- **상세**: `looksLikeInstruction()` 정규식 필터가 추출된 content를 저장(`saveMemories`) 직전에 1차로 차단한다. 그러나 이 필터는 영어·한국어 일부 패턴만 커버한다. 악의적 사용자가 회피 문구(예: 다른 언어, 인코딩 변이, 단어 간 공백 삽입 등)를 사용해 정규식을 우회하면, 지시문이 메모리에 저장되고 다음 세션 recall 시 system 프롬프트로 주입될 수 있다. data-fence/wrap이 2차 방어를 담당하지만, 저장 시점 필터가 우회되면 이후 세션들의 system 컨텍스트가 오염 상태로 누적된다. IE는 사용자 대화에서 직접 사실을 추출하므로 이 공격 표면이 ai_agent와 동일하게 존재한다.
- **제안**: (1) 정규식 패턴에 추가 언어(일본어, 아랍어 등 방향지시 표현)나 변형 패턴 추가 고려. (2) 장기적으로 LLM 기반 safety classifier를 추출 pipeline에 추가하는 것이 보다 robust. 단, 현재 주 방어는 주입 시점 data-fence이므로 즉시 블로킹은 아님.

---

### WARNING — memoryTopK에 상한 미적용: 사용자 구성값이 SQL LIMIT로 직접 전달

- **위치**: `information-extractor.handler.ts` L294; `agent-memory.service.ts` L320, L360~L361
- **상세**: `injectRecallPrefix`에서 `args.config.memoryTopK as number`를 그대로 `recall()` 호출에 넘기고, `recall()`은 이를 SQL의 `LIMIT $5`에 바인딩한다. 스키마(`information-extractor.schema.ts` L174)에서 `.positive()`로 양수 검증은 하지만 **상한이 없다**. 워크플로 편집자가 `memoryTopK: 100000`을 설정하면 단일 쿼리로 수십만 건을 회수해 메모리·토큰·LLM 비용이 급증할 수 있다. 이 문제는 ai_agent에도 동일하게 존재하는 기존 결함이지만 IE에서도 그대로 상속되었다.
- **제안**: `recall()` 내부 또는 `injectRecallPrefix` 진입부에서 `topK = Math.min(topK, MAX_RECALL_TOP_K)` 캡 적용. `MAX_RECALL_TOP_K = 100` 정도가 적절. 스키마에서도 `.max(100)` 추가.

---

### INFO — 추출 민감정보: 추출 LLM이 대화에서 민감 데이터를 저장할 가능성

- **위치**: `agent-memory.service.ts` L394~L413 (saveMemories 내 looksLikeInstruction 필터)
- **상세**: IE의 추출 대상(`outputSchema`)에 이메일·전화·신용카드 등 PII가 포함될 수 있다. 추출된 JSON은 ConversationThread에 push된 뒤 extraction queue를 통해 `saveMemories`로 저장된다. 저장 단계에서 PII 감지 또는 스크러빙 로직은 존재하지 않는다. 이는 ai_agent와 동일한 설계이나, IE는 명시적으로 구조화된 PII(이름, 이메일 등)를 추출하도록 설계되므로 노출 표면이 ai_agent보다 더 직접적이다. GDPR/개인정보 관점에서 persistent 전략 사용 시 PII가 agent_memory 테이블에 장기 보존될 수 있다.
- **제안**: 사용자 문서(ai.mdx/ai.en.mdx)에 "persistent 전략 사용 시 PII 포함 outputSchema는 TTL 설정을 권장" 경고 추가. 기술적으로는 추출 processor에 PII 감지 레이어를 추가하는 것이 근본 해결이나 이는 설계 범위 밖의 변경.

---

### INFO — conversationThreadRef의 state 직렬화: 전체 turn 데이터가 state에 포함

- **위치**: `information-extractor.handler.ts` L711~L712 (`conversationThreadRef: context.conversationThread`)
- **상세**: persistent 전략에서 멀티턴 상태를 영속할 때 `ConversationThread` 전체 객체(모든 turn 텍스트 포함)가 `_resumeState`에 포함된다. 이는 ai_agent의 기존 패턴과 동일하지만, 대화가 길어질수록 state 직렬화 크기가 선형 증가한다. state가 DB에 저장되므로 해당 row 접근 권한을 가진 내부자가 과거 대화 전체를 볼 수 있다. 현재 DB 레이어에서 state 컬럼은 암호화되지 않는다고 가정한다.
- **제안**: 기존 ai_agent와 동일한 수준이므로 IE 고유 위험은 아님. 설계 검토는 별도 이슈로 추적. 현재 변경에서는 수용 가능.

---

### INFO — extractionModel이 expression widget: 실행 간 모델 동적 변경 가능

- **위치**: `information-extractor.schema.ts` L236~L248 (`widget: 'expression'`)
- **상세**: `extractionModel`은 expression 위젯으로 실행마다 다른 모델을 지정할 수 있다. 추출 모델의 변경은 추출 결과의 품질 변화를 야기하지만, 저장된 임베딩은 `embeddingModel`이 고정되어 있으므로 recall 차원 불일치는 발생하지 않는다. `embeddingModel`을 의도적으로 `text`(정적) 위젯으로 제한한 판단은 올바르다. `extractionModel`에 대해서는 보안 위험보다 일관성 리스크가 있으나 심각하지는 않다.
- **제안**: 변경 불필요. 문서에 "extractionModel을 expression으로 동적 변경하면 추출 품질이 회차마다 달라질 수 있음" 주의사항 추가 정도.

---

## 요약

이번 변경(IE persistent recall/extract)은 ai_agent의 기존 메모리 아키텍처를 IE에 신중하게 이식한 구현이다. workspace_id는 실행 컨텍스트에서 권위값으로 주입되고, SQL은 파라미터 바인딩을 일관 적용하며, memoryKey sanitize(제어문자 제거 + 길이 상한 + SHA-256 결정적 해시)와 prompt injection 방어(data-fence wrap + DATA_FENCE_GUIDE)가 모두 ai_agent 수준 그대로 재사용된다. 주요 보안 우려 사항은 두 가지다: 첫째, `memoryTopK`에 상한이 없어 극단값이 그대로 SQL LIMIT로 전달될 수 있으며(WARNING), 둘째, 저장 전 instruction-style 필터가 영어·한국어 패턴 일부만 커버해 다국어·변형 우회 가능성이 있다(WARNING). 나머지 항목들은 ai_agent와 동일한 설계 수준으로 수용 가능한 INFO 수준이다.

## 위험도

**LOW** (WARNING 2건은 ai_agent와 공유된 기존 결함의 상속이며 즉시 익스플로잇 경로가 없음)

---

BLOCK: NO
