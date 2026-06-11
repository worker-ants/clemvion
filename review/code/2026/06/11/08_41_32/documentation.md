### 발견사항

**[WARNING] plan 파일 자기참조 `(본 PR)` 미완결**
- 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — V-16/V-17 항목
- 상세: `rag-webchat-doc-strings` 항목이 `(본 PR)` 자기참조로 기재돼 있어 V-06/V-08 항목의 `(PR #530)` 과 불일치. 같은 파일에서 PR 번호 기재 방식이 혼용되면 히스토리 추적 시 혼란을 유발한다.
- 제안: 머지 후 확정된 PR 번호로 `(본 PR)` 을 갱신한다(관행 일치).

**[WARNING] `startHeadlessChat` JSDoc 파라미터 설명이 변경된 시그니처와 불완전하게 일치**
- 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` — 함수 JSDoc 블록
- 상세: JSDoc 에 `첫 사용자 텍스트는 webhook 에 싣지 않는다` 설명이 추가됐으나, 제거된 `firstMessage` 파라미터나 추가된 `profile?` 파라미터에 대한 `@param` 태그가 전혀 없다. 파라미터 순서도 바뀌었으므로(`handlers` 가 3번째, `profile?` 이 4번째) IDE 자동완성 맥락에서 호출자가 혼동할 수 있다.
- 제안: `@param profile` 과 `@param handlers` JSDoc `@param` 태그를 추가해 새 시그니처를 명시한다.

**[INFO] `cross_encoder_llm` 설명 갱신이 spec 에 미반영 (SPEC-DRIFT)**
- 위치: `codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts` L36, `update-knowledge-base.dto.ts` — rerankLlmConfigId description
- 상세: `(후속 구현)` 문구가 DTO Swagger description 과 JSDoc 에서 정확히 제거됐으나, `spec/5-system/9-rag-search.md §3.3` 과 `spec/2-navigation/5-knowledge-base.md §2.2` 에는 `rerankLlmConfigId` 필드명·동작 설명 직접 표기가 없다. 코드 문서가 spec 보다 앞서가는 상태.
- 제안: spec-coverage 갱신 백로그로 등록(project-planner 영역). 코드는 정확하므로 차단 불요.

**[INFO] `topK` description 의 내부 spec 절 번호 노출**
- 위치: `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` — topK `@ApiPropertyOptional.description`
- 상세: 변경 후 description 이 동적 컷 동작을 설명하지만, 이전 버전 description 의 spec 절 번호 참조(`§3.4` 등)가 공개 Swagger UI 에서 의미 없는 내부 기호로 노출될 수 있다(변경 후 현재 description 에는 없으나 검토 시점 확인 필요).
- 제안: 공개 Swagger description 에서 내부 spec 절 번호를 제거하거나 자체 설명 텍스트로 대체한다.

**[INFO] `byo-ui-headless.ts` 예제와 README 코드 스니펫 간 일관성 확인 필요**
- 위치: `codebase/packages/web-chat-sdk/README.md` M2 BYO-UI 섹션, `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts`
- 상세: README 의 인라인 코드 스니펫(`triggerWebhook(endpointPath, { profile })`)과 `examples/byo-ui-headless.ts` 의 `startHeadlessChat` 헬퍼 양쪽이 동일 패턴으로 갱신됐다. README 에 `전체 예제: examples/byo-ui-headless.ts` 링크가 있으므로 두 파일 간 패턴 일치는 잘 유지되고 있다.
- 제안: 현재 상태 유지. README 인라인 예제와 헬퍼 함수가 동일 흐름을 보여주는 것은 좋은 문서화 관행이다.

**[INFO] BYO-UI webhook profile-only → submit_message 흐름이 spec 에 미기재 (SPEC-DRIFT)**
- 위치: `codebase/packages/web-chat-sdk/README.md` M2 BYO-UI 섹션
- 상세: README 에 `firstMessage` 폐기 이유(multi_turn 증발 원리, §R6 참조)와 `submit_message` 우선 패턴이 상세히 기술됐으나 `spec/7-channel-web-chat/2-sdk.md §2` 에는 이 내용이 없다. README 가 spec 보다 더 정확하고 상세한 역전 상태.
- 제안: spec-coverage 갱신 백로그로 등록. `2-sdk.md §2` BYO-UI 섹션에 webhook profile-only → submit_message 흐름과 firstMessage 폐기 근거를 추가한다(project-planner 영역).

**[INFO] CHANGELOG 업데이트 없음**
- 위치: `codebase/packages/web-chat-sdk/` 패키지 루트
- 상세: `startHeadlessChat` 의 시그니처 변경(`firstMessage` 제거, `profile?` 추가, 파라미터 순서 변경)은 소비자 입장에서 breaking change 에 해당하는 수준의 변경이나 CHANGELOG 갱신이 없다. internal-only 패키지 + examples 는 패키지 빌드 범위 밖임을 감안해도, 이 패키지가 향후 publish 될 때 히스토리가 불명확해진다.
- 제안: `examples/byo-ui-headless.ts` 시그니처 변경 사유(`firstMessage` 폐기, spec §R6)를 CHANGELOG 또는 패키지 README 변경 이력 섹션에 한 줄 기재한다.

---

### 요약

이번 변경은 stale `(후속 구현)` 주석 제거와 `firstMessage` 폐기 패턴 교정이라는 명확한 문서화 목적의 PR로, 전반적인 문서화 품질이 개선됐다. `startHeadlessChat` 의 파라미터 변경 이유가 인라인 주석으로 상세히 설명되고 README 도 일관되게 갱신된 점은 긍정적이다. 다만 두 가지 잔여 gap 이 있다: (1) 코드가 정확해졌으나 spec(`9-rag-search.md §3.3`, `2-sdk.md §2`)이 아직 갱신되지 않아 spec-drift 상태이며, (2) plan 파일의 `(본 PR)` 자기참조는 머지 후 PR 번호로 즉시 갱신이 필요하다. `startHeadlessChat` JSDoc 에 `@param` 태그가 없는 점도 minor한 문서화 불완전이다. 전체 변경에서 런타임 로직 변경이 없어 문서화 위험도는 낮다.

### 위험도

LOW
