# 요구사항(Requirement) 리뷰 — rag-webchat-doc-strings

## 발견사항

### [SPEC-DRIFT] [INFO] `cross_encoder_llm` DTO description 이 spec §3.3.1 conditional escalate 동작과 일치함 (SPEC-DRIFT 방향: 코드가 최신, spec 표기는 별도 보강 필요)
- 위치: `codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts` L36–37 (diff), `update-knowledge-base.dto.ts` L217–218 (diff)
- 상세: 구 description 의 `cross_encoder_llm 은 추가 LLM grading(후속 구현)` / `(후속 구현)` 표현이 `조건부(conditional escalate) listwise LLM grading` 으로 정정됐다. `spec/5-system/9-rag-search.md §3.3.1` 표에서 `cross_encoder_llm` 은 `cross_encoder` 후 **조건부(conditional escalate) listwise LLM grading 1콜**로 명시돼 있고 "두 모드 모두 구현됨" 이라 기재돼 있다. 코드 description 은 spec 본문과 정합하다. `spec/1-data-model.md §2.11` `rerank_llm_config_id` 필드 정의("listwise grading LLM. NULL 이면 워크스페이스 default chat LLMConfig")와도 일치.
- 제안: 코드 유지. spec/5-system/9-rag-search.md §3.3 DTO-level API description(rerankLlmConfigId 필드명 명시) 및 spec/2-navigation/5-knowledge-base.md §2.2 에 "조건부 listwise grading LLMConfig" 표기 보강은 project-planner 위임.

### [SPEC-DRIFT] [INFO] `topK` `@IsInt()` 교체 — spec §2.1 `"type":"integer"` 와 정합
- 위치: `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` L93 (diff)
- 상세: `@IsNumber()` → `@IsInt()` 교체로 float 허용을 막았다. `spec/5-system/9-rag-search.md §2.1` KB tool 정의에서 `top_k` 는 `"type":"integer"` 로 정의돼 있다. `@IsInt()` 는 해당 integer 타입 제약을 정확히 반영한다. 기존 `@IsNumber()` 가 spec 에 어긋난 기존 버그였으며, 이번 변경이 올바르게 수정했다.
- 제안: 코드 유지. 요구사항 충족.

### [INFO] `topK` Swagger `default: 5` 제거 — spec §2.1·§3.4 의 동적 컷 의미와 정합
- 위치: `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` L88 (diff, `default: 5` 제거)
- 상세: `spec/5-system/9-rag-search.md §2.1` 은 "`top_k` 는 명시 시 주입 상한 override 이며, **미지정 시 §3.4 동적 점수 컷이 주입 청크 수를 결정**(고정 default 없음)"으로 명시한다. Swagger `default: 5` 를 두면 클라이언트 코드가 "기본 5개 반환"으로 오인할 수 있어 제거가 spec 의도에 부합한다. 런타임에서 미지정 시 서비스 레이어가 `RAG_MAX_INJECT_COUNT(12)` ceiling 으로 동적 결정한다.
- 제안: 코드 유지. description 의 "미지정 시 고정 default 가 아니라 token-budget + inject-cap 동적 점수 컷이 최종 주입 수를 결정한다" 서술이 소비자에게 충분히 설명된다.

### [SPEC-DRIFT] [INFO] `firstMessage` → `profile` 교체 — spec 1-widget-app §R6 과 정합
- 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts`, `codebase/packages/web-chat-sdk/README.md`
- 상세: `spec/7-channel-web-chat/1-widget-app.md §3` 에서 "**`firstMessage` 미사용**: webhook payload 는 `profile` 만 싣는다. 첫 사용자 텍스트도 일반 `submit_message` 로 전송"으로 명시한다. §R6 에서 `firstMessage` 메커니즘이 폐기된 이유(multi_turn 이 webhook 입력을 첫 턴으로 소비하지 않아 첫 메시지 증발)를 설명한다. 코드 변경이 spec §R6 결정을 예제·README 에 올바르게 반영한다. `spec/7-channel-web-chat/2-sdk.md §2` BYO-UI 섹션은 `firstMessage` 폐기 이유·`submit_message` 흐름을 아직 명시하지 않는다 — 이는 코드가 맞고 spec 이 낡은 SPEC-DRIFT 방향.
- 제안: 코드 유지. spec/7-channel-web-chat/2-sdk.md §2 에 webhook profile-only → submit_message 흐름, firstMessage 폐기 이유 보강은 project-planner 위임.

### [INFO] `startHeadlessChat` 함수 시그니처 — 예제 파일이므로 배포 표면 외
- 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` L366–376 (diff)
- 상세: `firstMessage: string` 파라미터 제거, `profile?: Record<string, unknown>` 추가, 파라미터 순서 변경(`handlers` 가 `profile?` 앞으로)은 파괴적 변경이다. 그러나 이 파일은 `examples/` 디렉터리에 위치하며 `tsconfig` 의 `src/**` 빌드 범위 밖이다. 패키지 `package.json` 에 `files`/`exports` 에 examples 가 포함되지 않아 published 배포 표면이 아니다. 현재 직접 호출자도 0건이다. README 가 새 패턴을 정확히 보여주므로 마이그레이션 혼선 없음.
- 제안: 코드 유지. 기능 완전성 관점에서 차단 요소 없음.

### [INFO] `profile` 없는 경우 빈 객체 `{}` 전달 — 엣지케이스 처리 확인
- 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` L385–388 (diff)
- 상세: `profile ? { profile } : {}` 로 `profile` 이 undefined/null 일 때 빈 객체를 webhook payload 로 전달한다. spec §R6 에서 "webhook payload 는 `profile` 만 싣는다"고 했으므로, `profile` 없을 때 빈 payload `{}` 전달은 허용된다. 서버 webhook 핸들러는 generic trigger input 을 수신하므로 빈 payload 도 정상 처리된다.
- 제안: 코드 유지. `profile` undefined 엣지케이스가 올바르게 처리됨.

### [INFO] `UpdateKnowledgeBaseDto` rerank 5필드 JSDoc 추가 — 요구사항과 무관한 유지보수성 사항 (이미 수정됨)
- 위치: `codebase/backend/src/modules/knowledge-base/dto/update-knowledge-base.dto.ts` L182–214 (diff)
- 상세: `/** 변경할 리랭킹 모드 */` 등 JSDoc 블록 추가는 `CreateKnowledgeBaseDto` 와 균형을 맞추는 문서화 개선이다. 이는 요구사항(비즈니스 로직·기능 완전성) 관점에서 차단 요소가 아닌 유지보수성 사항이며, 이번 변경에서 이미 적용됐다.
- 제안: 이미 수정 완료됨.

### [INFO] `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-16/V-17 항목 갱신
- 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L507–508 (diff)
- 상세: V-06/V-08 항목의 `(본 PR)` → `(PR #530)` 갱신, V-16/V-17 신규 항목 추가는 추적 문서 일관성을 위한 정상적인 plan 갱신이다. `(본 PR)` 자기참조가 V-16/V-17 항목에 남아 있으나, 이는 머지 후 PR 번호로 갱신하는 관행(V-06/V-08 선례)이라 차단 요소가 아니다.
- 제안: 머지 후 `(본 PR)` → `(PR #NNN)` 갱신.

---

## 요약

이번 변경은 Knowledge Base DTO 의 `cross_encoder_llm` 관련 doc-string 에서 `(후속 구현)` 잔재 표현을 삭제하고, `RagSearchDto.topK` 를 `@IsNumber()` → `@IsInt()` 로 수정하며, web-chat-sdk 예제/README 에서 폐기된 `firstMessage` 패턴을 `profile` + `submit_message` 패턴으로 교체하는 문서 문자열·예제 정정 작업이다. 모든 변경이 spec 본문(9-rag-search.md §2.1 integer 타입·§3.3.1 conditional escalate 동작, 1-widget-app.md §R6 firstMessage 폐기, 1-data-model.md §2.11 rerank_llm_config_id)과 정합한다. 런타임 로직 변경은 없으며, `@IsInt()` 교체는 spec 의 integer 타입 정의를 정확히 반영하는 기존 버그 수정이다. spec/7-channel-web-chat/2-sdk.md §2 와 spec/5-system/9-rag-search.md §3.3 에 DTO-level 필드명 및 BYO-UI 흐름 보강이 누락돼 있으나, 이는 코드가 spec 보다 앞선 SPEC-DRIFT 방향으로 코드 fix 대상이 아니다.

---

## 위험도

LOW
