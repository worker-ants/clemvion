# 문서화(Documentation) 리뷰

- Diff base: `origin/main` (`a02db4f9a` spec + `0302bd7ea` impl)
- 대상: EIA `getStatus.context` OpenAPI 스키마화 (`ButtonsContextDto`/`NodeOutputContextDto`/`CurrentNodeDto`) + `api-convention.md §5.4` 부재 표현 규칙 신설 + `swagger.md §1-4` 개정

## 발견사항

### [WARNING] `responses.dto.ts` 내 spec cross-ref 마크다운 링크 4곳이 전부 깨져 있다 (off-by-one)

- 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:83, 96, 100, 197`
- 상세: 해당 파일은 `codebase/backend/src/modules/external-interaction/dto/` 에 있다. 저장소 루트까지는 `dto`→`external-interaction`→`modules`→`src`→`backend`→`codebase`→root 로 **6단계**가 필요하다(같은 디렉터리의 `responses.dto.spec.ts` 는 정확히 `../../../../../../spec/...` 6단계를 쓴다 — 실측 확인). 그런데 `responses.dto.ts` 의 4개 링크는 전부 **5단계**(`../../../../../spec/...`)만 써서, `codebase/spec/conventions/swagger.md` 처럼 존재하지 않는 경로로 해석된다. 실측:
  - `../../../../../spec/conventions/swagger.md` → `codebase/spec/conventions/swagger.md` — **MISSING**
  - `../../../../../spec/conventions/conversation-thread.md` → **MISSING**
  - `../../../../../spec/5-system/2-api-convention.md` → **MISSING**
  - (line 197, 두 번째 `swagger.md` 참조도 동일하게 깨짐)
  - 대조: `responses.dto.spec.ts:26-28` 은 6단계로 정확히 `spec/conventions/swagger.md` / `spec/5-system/2-api-convention.md` / `spec/5-system/14-external-interaction-api.md` 로 해석된다(실측 EXISTS 확인).
- 영향: 이 프로젝트의 자동 링크 무결성 가드(`codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`)는 backend 소스를 스캔하지 않아 이 깨짐을 잡지 못한다. 사람이 IDE 에서 링크를 따라가거나 향후 export 되는 doc 도구가 있을 경우 dangling 링크가 된다. DTO 자체가 "닫힌 union 스키마화"라는 문서화 개선 작업의 산출물인데, 그 안의 SoT cross-ref 가 깨져 있는 것은 목적에 역행한다.
- 제안: `responses.dto.ts` 의 4개 링크를 전부 `../../../../../../spec/...` (6단계, `responses.dto.spec.ts` 와 동일) 로 수정.

### [INFO] `swagger.md §1-4` 코드 예제는 실제 DTO 의 요약본 — 발산 아님

- 위치: `spec/conventions/swagger.md` §1-4 (신설 코드 블록) vs `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:158-208`
- 상세: 예제는 `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto)` + `oneOf`/`getSchemaPath`/`nullable: true` 패턴을 실제 클래스명(`ExecutionStatusDto`)으로 그대로 보여준다. 실제 코드와의 차이는 (a) `@ApiExtraModels` 인자에서 `context` union 과 무관한 `CurrentNodeDto` 가 예제에는 생략됨, (b) `description` 옵션이 생략됨 — 둘 다 설명 단순화를 위한 의도적 축약으로 보이며 패턴 자체의 정확성에는 문제 없음.
- 제안: 없음 (예제로서 충분히 정확함, 조치 불요).

### [INFO] `spec/7-channel-web-chat/1-widget-app.md` 의 `### R7` Rationale 블록 삭제 — 검증 결과 정보 손실 아님

- 위치: `spec/7-channel-web-chat/1-widget-app.md` (23줄 삭제, PR #874 에서 신설됐던 "헤더 세션 컨트롤 — booting 게이팅 + graceful/cancel 분기" Rationale)
- 상세: 이 파일은 EIA context 스키마 작업과 직접 관련 없어 보이나 diff 에 포함돼 있어 확인함. 삭제된 R7 텍스트 자체가 "신규 결정이 아니라 §2·§3.1 산문에 흩어져 있던 근거의 Rationale 승격"이라고 명시하는데, 실측 결과 그 산문(booting 게이팅 사유, graceful/cancel 분기, optimistic 종료)이 현재도 §2(헤더 행, L42)·§3.1(L75-88)에 고스란히 남아 있다. 다른 spec 파일 어디에도 `1-widget-app.md#r7-...` 형태로 이 앵커를 가리키는 inbound 링크가 없어(전수 grep 확인) dangling 참조도 발생하지 않는다. 즉 중복 제거이지 정보 손실이 아니다.
- 제안: 없음 — 다만 이 파일 변경이 본 PR 의 표제 범위(EIA context 스키마) 밖이므로, 커밋 메시지/PR 설명에 "선택 정리(dedup)" 라고 한 줄 밝혀두면 리뷰어 혼선을 줄일 수 있다.

## 체크리스트별 결과 요약

1. **모든 신규 DTO 필드에 한국어 JSDoc** (swagger.md §1-1) — 준수. `CurrentNodeDto`(id/type/interactionType), `WaitingContextBaseDto`(interactionType/waitingNodeId/conversationThread), `ButtonsContextDto.buttonConfig`, `NodeOutputContextDto.nodeOutput`, `WaitingContextBase` 타입, 그리고 `ExecutionStatusDto` 의 수정된 필드(`currentNode`/`context`/`result`/`error`/`seq`) 전부 필드 직전에 한국어 JSDoc 보유.
2. **`responses.dto.ts` 내 상대 링크** — **불일치 발견**(위 WARNING). 4곳 모두 5단계로, 정확한 6단계보다 한 단계 짧아 `codebase/spec/...` 로 잘못 해석됨.
3. **`responses.dto.spec.ts` 헤더 링크** — 정확. 6단계(`../../../../../../spec/...`)로 `spec/conventions/swagger.md`·`spec/5-system/2-api-convention.md`·`spec/5-system/14-external-interaction-api.md` 전부 실측 존재 확인.
4. **spec 앵커 3종** — 전부 정확. GitHub 슬러그 알고리즘(백틱/구두점 제거 후 소문자·공백→하이픈, 연속 공백은 연속 하이픈)으로 직접 계산해 대조:
   - `#54-부재-표현--null-vs-키-생략` ↔ `spec/5-system/2-api-convention.md` `### 5.4 부재 표현 — \`null\` vs 키 생략` (L172) — 일치.
   - `#discriminator-는-판별자가-sound-할-때만-1-4` ↔ `spec/conventions/swagger.md` `### \`discriminator\` 는 판별자가 sound 할 때만 (§1-4)` (L351) — 일치.
   - `#1-4-nested--enum--union` ↔ `spec/conventions/swagger.md` `### 1-4. nested / enum / union` (L85) — 일치.
   - 부수 확인: `#왜-conversationthread-를-null-로-정규화하지-않는가-54`, `#1-3-optional-필드` 도 대조해 전부 일치.
5. **오래된 주석(stale)** — 발견 안 됨. 종전 `ExecutionStatusDto` 클래스 JSDoc 의 "클라이언트는 `currentNode.interactionType` 으로 분기" 서술은 diff 에서 "판별자 없는 닫힌 2-variant union … 키 존재로 분기" 로 정정됨. EIA §5.3 예시 JSON 의 유령 top-level `formConfig`/`conversationConfig` 키도 `nodeOutput` 내부 중첩으로 정정되고 각주로 명시됨. `interaction.service.ts` 의 조립부 주석도 실제 3-way 분기(`buttons`+`bc` / else / interactionType 미인식)와 정합.
6. **swagger.md §1-4 코드 예제 vs 실제 DTO** — 패턴 일치(위 INFO). 실제보다 축약됐을 뿐 오류 없음.

## 요약

핵심 산출물(신규 DTO 클래스·필드 JSDoc, 신정합 주석, spec 앵커 3종, `responses.dto.spec.ts` 헤더 링크, swagger.md §1-4 예제)은 모두 정확하고 이 프로젝트의 자동 링크 무결성 가드가 감지하지 못하는 영역까지 촘촘히 대조해도 문제가 없었다. 유일한 실질 결함은 `responses.dto.ts` 자체의 상대경로 링크 4곳이 같은 디렉터리의 형제 파일(`responses.dto.spec.ts`)과 다른(한 단계 짧은) 깊이를 써서 전부 깨져 있다는 점이다 — 기계적으로 검증 가능하고 수정도 단순(6단계로 통일)하지만, 이 PR 이 "닫힌 union 스키마화로 문서 신뢰도를 높인다"는 취지인 만큼 방치하면 취지와 어긋난다. `1-widget-app.md` 의 무관해 보이는 삭제는 실측 결과 정보 손실이 아닌 중복 제거로 확인됐다.

## 위험도

LOW
