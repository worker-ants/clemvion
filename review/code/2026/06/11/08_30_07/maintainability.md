# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: create-knowledge-base.dto.ts

- **[INFO]** `rerankMode` description 문자열이 단일 행에 길게 기술됨
  - 위치: 라인 211 (`@ApiPropertyOptional description`)
  - 상세: 변경 후 description이 한 줄에 약 130자로 길어졌다. 이미 `CreateKnowledgeBaseDto` 의 다른 description들(예: ragMode, extractionLlmConfigId)은 40~80자 수준이라 이 필드만 눈에 띄게 길다. 읽기는 가능하나 일관성에서 약간 벗어난다.
  - 제안: 필수 내용이라면 현행 유지 가능. 다만 `cross_encoder_llm` 동작 설명 일부를 JSDoc 블록 주석(`/** ... */`)으로 분리하면 description은 간결하게, 상세 설명은 JSDoc에 두는 패턴으로 통일도 가능하다. 이 DTO의 다른 필드들은 JSDoc이 짧고 description도 짧아 현행 패턴 유지가 더 자연스럽다면 INFO 수준.

- **[INFO]** `CreateKnowledgeBaseDto`와 `UpdateKnowledgeBaseDto` 간 description 문체 불일치 잔존
  - 위치: `create-knowledge-base.dto.ts` vs `update-knowledge-base.dto.ts`의 `rerankLlmConfigId`
  - 상세: Create DTO는 `'미지정 시 워크스페이스 default chat.'`, Update DTO는 `'미지정 시 ws default chat.'`으로 `워크스페이스`/`ws` 표기가 혼재한다. 이번 변경에서 두 파일 모두 수정했으나 약어 불일치는 그대로다.
  - 제안: `ws` → `워크스페이스`로 Update DTO도 통일하거나, 전체 코드베이스에서 `ws default` 약어 사용 여부를 일관되게 결정한다.

---

### 파일 2: rag-search.dto.ts

- **[INFO]** `topK` description에 spec 내부 절(§3.4) 참조 포함
  - 위치: 라인 334–336 (`@ApiPropertyOptional description`)
  - 상세: `'(§3.4)이 최종 주입 수를 결정한다.'` — 공개 Swagger 문서에 내부 spec 섹션 번호가 노출된다. 같은 파일의 `query`, `knowledgeBaseIds`, `threshold` description에는 spec 참조가 없어 일관성이 깨진다. 외부 개발자가 읽는 API 문서에 `§3.4`는 의미 없는 기호다.
  - 제안: `(§3.4)` 제거 또는 `(동적 점수 컷 적용)` 같은 자체 설명 텍스트로 대체.

- **[INFO]** `default: 5` 제거에 대한 JSDoc 설명 없음
  - 위치: diff 라인 `-    default: 5,`
  - 상세: Swagger `default` 값 삭제는 행동 변경이다. 코드 주석이나 JSDoc에 "default 가 없는 이유"(동적 결정)를 기술하면 향후 유지보수자가 `default: 5`를 "실수로 빠진 것"으로 오인해 재추가하는 것을 방지할 수 있다.
  - 제안: `topK` JSDoc(`/** 반환할 최대 유사 청크 개수 (inject-cap 상한) */`) 또는 `@ApiPropertyOptional` description에 "Swagger default 없음 — 동적 결정" 한 줄 추가.

---

### 파일 3: update-knowledge-base.dto.ts

- **[WARNING]** `UpdateKnowledgeBaseDto`의 rerank 관련 필드들에 JSDoc 블록 주석 누락
  - 위치: 라인 526–568 (rerankMode, rerankConfigId, rerankCandidateK, rerankScoreThreshold, rerankLlmConfigId)
  - 상세: `CreateKnowledgeBaseDto`는 각 필드마다 `/** ... */` JSDoc 블록 주석이 있다(예: `/** 리랭킹 모드 */`, `/** 사용할 RerankConfig */`). 반면 `UpdateKnowledgeBaseDto`의 rerank 섹션 5개 필드는 JSDoc이 전혀 없다. 이번 변경에서 `rerankLlmConfigId` description은 수정했지만 JSDoc은 추가하지 않았다. IDE 자동완성 시 필드 설명이 보이지 않아 유지보수성이 낮다.
  - 제안: Create DTO와 동일한 패턴으로 각 필드에 JSDoc 주석 추가. 최소한 `/** 변경할 리랭킹 모드 */` 수준이라도 일관성을 맞춘다.

- **[INFO]** `ws` 약어 잔존 (위 파일 1 INFO와 동일 맥락)
  - 위치: 라인 563 (`'미지정 시 ws default chat.'`)
  - 상세: Create DTO는 `워크스페이스 default chat`, Update DTO는 `ws default chat`. 동일 개념을 다른 표현으로 기술.
  - 제안: `워크스페이스`로 통일.

---

### 파일 4: web-chat-sdk/README.md

- **[INFO]** 코드 블록 내 인라인 주석이 3줄로 늘어 코드 흐름 파악이 다소 방해됨
  - 위치: 라인 673–676 (triggerWebhook 앞 주석 3줄)
  - 상세: README 예제 코드의 목적은 빠른 사용법 파악이다. 3줄 주석이 추가되어 단 2줄 실제 코드(triggerWebhook + token 추출) 앞에 설명이 길어졌다. 내용 자체는 올바르고 필요하지만, 예제 코드 가독성 측면에서 "코드 먼저, 주석은 짧게" 패턴과 어긋난다.
  - 제안: 인라인 주석을 코드 블록 밖 산문 설명으로 이동하거나, `// webhook: profile only (첫 메시지는 send()로)` 한 줄로 압축. 이미 바로 아래 `// 첫 사용자 텍스트...` 한 줄 주석이 있으므로 위 3줄은 중복 설명에 가깝다.

---

### 파일 5: byo-ui-headless.ts

- **[INFO]** 함수 시그니처 인자 순서 변경(`firstMessage` 제거, `profile?` 추가)이 breaking change인데 마이그레이션 가이드 없음
  - 위치: 함수 선언 (apiBase, endpointPath, handlers, profile?)
  - 상세: `firstMessage: string` (필수)가 제거되고 `profile?: Record<string, unknown>` (선택)이 추가됐다. 기존 호출자는 컴파일 에러가 발생하거나, `handlers` 위치로 인자를 잘못 전달할 수 있다. 이 파일은 `examples/` 폴더의 예제이므로 공개 API는 아니지만, README에서 직접 참조된다(`전체 예제: examples/byo-ui-headless.ts`).
  - 제안: 파일 상단 주석 또는 함수 JSDoc에 `@deprecated firstMessage — v[N] 이후 제거, send()로 전송` 이력 한 줄 추가. 혹은 CHANGELOG / README에 migration note 기술.

- **[INFO]** `profile ? { profile } : {}` 패턴 — 의도는 명확하나 대안 고려 가능
  - 위치: 라인 795–797
  - 상세: `profile ? { profile } : {}` 는 의도가 명확하다. 다만 `{ ...(profile && { profile }) }` 스프레드 패턴이 이 코드베이스의 다른 곳에서 쓰인다면 일관성 문제가 생긴다. 단독 사용은 문제 없음.
  - 제안: 코드베이스 전체 패턴과 일치하는 방식 선택. 현행 유지도 무방.

- **[INFO]** `e.data` 타입 단언 `(e.data as { message?: string; text?: string })` 이 예제 코드에 인라인으로 삽입
  - 위치: 라인 809
  - 상세: 기존 코드부터 있던 패턴이지만, 예제 코드에 `as` 캐스팅이 드러나면 초심자에게 불안한 인상을 준다. 이번 변경 범위는 아니나 인지해 둘 사항.
  - 제안: 별도 타입 가드나 헬퍼 함수로 분리하면 예제 가독성 향상.

---

### 파일 6: plan/in-progress/spec-code-cross-audit-2026-06-10.md

- **[INFO]** plan 파일 변경 — 유지보수성 관점에서 특이사항 없음
  - 위치: 전체
  - 상세: 브랜치명(`본 PR` → `PR #530`) 수정 및 V-16/V-17 완료 체크박스 추가. 내용이 명확하고 기존 문서 스타일과 일관성 있다.

---

## 요약

변경의 핵심은 문서 문자열(doc-string) 정정으로, 코드 로직 변경이 없어 구조적 유지보수성 위험은 낮다. 주요 관찰 사항은 두 가지다. 첫째, `CreateKnowledgeBaseDto`와 `UpdateKnowledgeBaseDto` 간 JSDoc 주석 커버리지 불균형이 이번 변경에서도 해소되지 않았다 — Update DTO의 rerank 필드 5개에 JSDoc이 없어 IDE 지원과 코드 탐색성이 Create DTO에 비해 떨어진다. 둘째, `워크스페이스` vs `ws` 약어 혼용, Swagger description에 내부 spec 절 번호(§3.4) 노출 등 소규모 일관성 문제가 잔존한다. `byo-ui-headless.ts`의 breaking 시그니처 변경은 예제 파일이라 영향 범위가 제한적이지만, 이력 주석이 없으면 향후 호출 측에서 혼란 가능성이 있다. 전반적으로 문서 정확도는 개선됐으며, WARNING 1건(UpdateKnowledgeBaseDto JSDoc 누락)과 다수의 낮은 심각도 INFO로 구성된다.

## 위험도

LOW
