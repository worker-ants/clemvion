### 발견사항

- **[WARNING] `code:` frontmatter 선정이 스스로 인용한 precedent(exhaustive-consumer 스타일)와 어긋난다**
  - target 위치: 작업 체크리스트 두 번째 항목 (`spec/conventions/egress-masking.md` 신설 시 `code:` 4파일 지정)
  - 위반 규약: `spec/conventions/node-cancellation.md` 의 `code:` 선정 관행(정의부뿐 아니라 `http-request.handler.ts`·`executions.controller.ts`·`editor-toolbar.tsx` 등 주요 소비처까지 exhaustive 등재) — target 본문이 "`node-cancellation.md` 가 `execution-context.md` 와 SoT 를 나눈 선례를 따른다" 며 이 문서를 직접 precedent 로 인용하고 있음.
  - 상세: 계획된 `code:` 4파일(`masked-markers/src/index.ts` · `sanitize-error-message.ts` · `strip-external-only-fields.ts` · `websocket.service.ts`)은 상수·함수의 **정의처**만 담고, 좌표계 표(§실측한 좌표계)와 "⚠️ 이름이 한 글자 차이인 스캐너가 둘 있다" 경고가 명시적으로 지목하는 두 스캐너 함수의 정의 파일 — backend `hasMaskedLeaf`(`codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`, 실재 확인함)와 frontend `hasMaskedMarkerLeaf`(`codebase/frontend/src/lib/utils/masked-markers.ts`, 실재 확인함) — 는 목록 밖에 남는다. `deepRedactSecrets` 의 세 번째 소비처인 `codebase/backend/src/shared/conversation-thread/thread-renderer.ts`(`redactThreadForPublic`, `spec/conventions/conversation-thread.md` 가 언급)도 마찬가지. `spec-code-paths.test.ts` 는 ≥1 매치만 요구하므로 build gate 통과에는 지장이 없으나(§spec-impl-evidence.md §4 확인), 문서가 스스로 강조하는 핵심 심볼이 자기 문서의 `code:` 증거 목록 밖에 있는 것은 이 저장소가 반복 경계해 온 "SoT 문서와 실제 심볼의 괴리" 패턴과 같은 모양이다.
  - 제안: `code:` 에 `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 와 `codebase/frontend/src/lib/utils/masked-markers.ts` 를 추가한다(최소한 좌표계 표의 5행이 인용하는 파일은 전부 등재). 정의처만 남기는 것이 의도라면 그 선정 기준을 문서에 한 줄로 명시해 node-cancellation.md 와의 스타일 차이가 의도적임을 밝힌다.

- **[INFO] `--spec` 예산 절단으로 일부 conventions 본문이 이번 검토 입력에서 빠졌다**
  - target 위치: N/A (checker 입력 자체의 한계)
  - 위반 규약: 해당 없음 — target 문서의 결함이 아니라 검토 커버리지의 한계
  - 상세: 번들에서 `spec/conventions/conversation-thread.md`(78,317자)·`chat-channel-adapter.md`(46,835자)·`interaction-type-registry.md`(15,909자)·`swagger.md`(18,803자)·`spec-impl-evidence.md`(18,024자) 등 260개 파일이 "컨텍스트 예산 초과"로 본문 생략됐다(기지 패턴, `feedback_consistency_spec_mode_budget.md`). target 이 직접 참조하는 `error-codes.md`·`node-output.md`·`node-cancellation.md`·`secret-store.md`·`execution-context.md` 는 전문이 로드돼 있어 핵심 교차검증은 가능했고, 생략된 `conversation-thread.md`·`spec-impl-evidence.md` 는 저장소에서 직접 읽어 보완 검증했다(모순 없음 확인: `conversation-thread.md` 의 `redactThreadForPublic` 은 target 의 gap-표 "conversation thread" 소비처 서술과 일치, `spec-impl-evidence.md` 의 `code:` 최소 매치 규칙도 확인). 다른 절단분(주로 `cafe24-api-catalog/**`)은 target 과 무관.
  - 제안: 조치 불요 — 참고용 기록.

- **[INFO] `id:`/파일명/frontmatter 패턴은 기존 conventions 와 완전히 일치한다**
  - target 위치: 체크리스트 "신설" 항목의 frontmatter 계획
  - 상세: `id: egress-masking` ↔ 파일명 `egress-masking.md` 일치, `status: implemented`(이미 구현된 동작을 문서화하므로 적절 — `error-codes.md`/`secret-store.md`/`audit-actions.md` 등과 동일 값역), `code:` 4파일 전부 실재 확인(직접 `ls` 로 검증), `pending_plans` 미기재(spec-impl-evidence.md §3: `implemented` 는 `pending_plans` 불필요, 규칙과 일치). §Overview/본문/§Rationale 3섹션 계획은 `error-codes.md`(`## Overview`···`## Rationale`) 구조와 동형. 좌표계 표의 모든 셀(상수명·값·비교 연산자·소비처)을 코드 직접 대조로 실측 검증했고 전부 일치했다(`MAX_MASK_DEPTH=10`·`MAX_REDACT_DEPTH ≡ MAX_MASK_DEPTH`·`depth >= N`·`MAX_SANITIZE_DEPTH=10`(독립 선언)·`depth > N`·`stripExternalOnlyFields` 호출부 2곳 등). spec 쪽 기존 occurrence count(`MAX_REDACT_DEPTH` 1건, 나머지 0건)도 `grep` 실측과 정확히 일치. `secret-store.md` 의 `AuthConfig.config` "비대상" 콜아웃과 동형의 카브아웃 표기 패턴도 정확히 재현하고 있다. 마커 리터럴(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)은 target 본문에 0회 등장 — 문서가 스스로 세운 규율을 이미 준수 중이다.
  - 제안: 조치 불요.

### 요약

`plan/in-progress/spec-draft-egress-masking-convention.md` 는 신설을 계획 중인 `spec/conventions/egress-masking.md` 의 frontmatter 스키마(`id`/`status`/`code:`)·3섹션 구조(§Overview/본문/§Rationale)·"비대상" 카브아웃 표기·SoT 분리 서술 스타일을 기존 conventions(특히 `error-codes.md`·`secret-store.md`·`node-cancellation.md`)와 정확히 동형으로 설계했고, 좌표계 표의 상수명·값·비교 연산자·소비처를 코드 직접 대조로 전부 실측 검증한 결과 오류가 발견되지 않았다(자체 이전 회차 CRITICAL 오독도 이미 정정됨). 유일한 실질 지적은 `code:` frontmatter 4파일이 "정의처"만 담아, 문서가 직접 경고하는 두 스캐너 함수(`hasMaskedLeaf`/`hasMaskedMarkerLeaf`)의 정의 파일이 증거 목록 밖에 남는다는 점 — build gate 는 통과하지만 자신이 인용한 `node-cancellation.md` 의 exhaustive-consumer 스타일과는 거리가 있어 WARNING 으로 기록한다. CRITICAL 규약 위반은 없다.

### 위험도

LOW
