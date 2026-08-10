# Rationale 연속성 검토 — eia-context-schema-followups 잔여 2건

## 사전 고지 — 번들 프롬프트 갭

`_prompts/rationale_continuity.md` 에 첨부된 "관련 Rationale 발췌" 번들은 이번 작업의 실제 target 인
`spec/5-system/14-external-interaction-api.md`(§5.4/§5/R16)와 `spec/conventions/swagger.md`(§5-1 +
Rationale)를 **둘 다 누락**했다(대신 `4-ai-assistant.md`·`2-sdk.md`·`3-auth-session.md`·`4-security.md`
등 무관한 문서의 Rationale 만 실려 있었다). 지시대로 번들에 의존하지 않고 워킹트리 `git diff` / `Read` /
`git log -S`로 직접 대조했다.

## 확인 방법

- `git diff -- spec/5-system/14-external-interaction-api.md spec/conventions/swagger.md plan/in-progress/eia-context-schema-followups.md` 로 실제 편집분 확인
- `codebase/backend/src/modules/external-interaction/interaction.controller.ts`(`cancel`)·`interaction.service.ts`(`cancel`)·`dto/responses/interact-ack-response.dto.ts` 원문 대조
- `git log -p --all -- codebase/backend/src/modules/external-interaction/interaction.service.ts` 전체 이력에서 `cancel` 메서드의 반환 shape 변화 추적 (파일 생성 커밋 `35ff9c19b` #230 까지)
- `git log -p --all -- spec/5-system/14-external-interaction-api.md` 전체 이력에서 §5.4 JSON 블록·R16 문구의 최초 도입 커밋 추적 (`9ed6e6305` #228, `907616c61` #604)
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts` docstring 원문과 신규 swagger.md §5-1 문단 대조
- `codebase/packages/sdk/src/client.ts` (`cancel()` 반환 타입) 대조
- `grep -rn "executionId, status"` 로 spec/codebase 전역에 남은 stale 참조 여부 확인

## 발견사항

발견된 CRITICAL·WARNING 없음. 세 가지 집중 검토 요청 모두 아래와 같이 실측 확인됨.

- **[INFO] 번들이 target 문서(EIA spec·swagger.md) 자체를 누락**
  - target 위치: `_prompts/rationale_continuity.md` 의 "관련 Rationale 발췌" 섹션
  - 상세: 이번 라운드가 정확히 편집한 두 문서(`14-external-interaction-api.md`, `swagger.md`)의 Rationale
    이 번들에 실리지 않았다. 기존 관측(memory: `feedback_consistency_spec_mode_budget`)이 재현.
  - 제안: 이 checker 는 직접 대조로 커버했으므로 조치 불필요. orchestrator 쪽 번들링에서 diff 대상 파일을
    예산 최상단에 고정하는 편이 재발을 줄인다.

### 점검 1 — R16 편집이 "결정 번복"인가 "사실 정정"인가

**결론: 결정은 그대로, 사실 기술만 정정. 번복 아님.**

R16 의 **채택 문구 자체**("§5.1 `interact`·§5.4 `cancel` 는 비동기 처리라 `202 Accepted` 로 응답하되 빈
body(no-content)가 아니라 ack body 를 반환한다")는 편집 전후 **글자 그대로 동일**하다. 바뀐 것은 그 뒤에
괄호로 병기하던 §5.4 의 **shape 명세**뿐이다 — `{ executionId, status }` (2필드) → `InteractAckDto`
(§5.1 과 동일, 3필드: `executionId/accepted/currentStatus`). "no-content 아님" 이라는 핵심 결정,
그 결정의 근거 3가지(SSE 구독 전 1회성 확인·accepted 신호·`{data}` 봉투 일관성)는 diff 에서 손대지 않았다.

또한 이 정정은 **번복임에도 새 Rationale 없이 지나간 사례가 아니다** — 오히려 R16 본문에
"**2026-08-10 정정.**" 콜아웃을 새로 추가해 (a) 정정 사유, (b) 근거 코드 위치
(`interaction.controller.ts` `cancel`), (c) 정정의 논거(별칭 관계이므로 동일 DTO 가 자연스럽고 클라이언트
언랩 분기를 줄인다 — R16 자신의 no-content 폐지 논거와 동형)를 명시했다. §5.4 본문·§5 봉투 각주에도 동일
논거의 병렬 문단을 추가했다. 이는 "관점 3(결정의 무근거 번복)" 이 요구하는 정확한 패턴이다.

### 점검 2 — "2필드 응답이 존재한 적이 없다" 주장의 반증 시도

**결론: 반증 실패 — 코드 실행 경로 기준으로는 참. 다만 spec 자체의 최초 기술(基層) 이력에 한 가지 뉘앙스가 있다.**

- `interaction.service.ts` 의 `cancel()` 은 파일이 최초로 생성된 커밋(`35ff9c19b`, PR2 #230,
  "External Interaction API 구현")부터 **지금까지 한 번도 바뀌지 않고**
  `{ executionId, accepted, currentStatus: 'cancelled' }` 를 반환해 왔다. `git log -p` 전체 이력에서
  이 메서드의 반환문에 대한 삭제(`-`) 라인이 전무하다 — 즉 구현이 2필드 shape 을 반환하던 시기 자체가
  없었다.
  - `interaction.controller.ts` 의 `cancel` 도 `@ApiAcceptedWrappedResponse(InteractAckDto)` +
    `Promise<InteractAckDto>` 로 §5.1 과 동일 DTO 를 명시 — 실측 재확인.
  - `codebase/packages/sdk/src/client.ts` 의 `cancel()` 도 `Promise<InteractAck>` 로 `interact()` 와
    동일 타입을 반환 — 클라이언트 쪽도 처음부터 통일돼 있었다.
- 다만 **spec 문서 자체의 최초 텍스트**는 2필드였다: §5.4 의 `{ executionId, status }` JSON 블록은
  구현이 존재하기도 전인 **PR1(spec-only, #228, `9ed6e6305`, 2026-05-21)** 에서 처음 작성됐고, 이후
  R16(PR #604, `907616c61`, 2026-06-14)이 이 stale 텍스트를 그대로 옮겨 적었다. 즉 이 2필드 서술은
  "한때 맞았다가 나중에 코드가 바뀌어 stale 해진" 것이 아니라, **최초 spec 초안(구현 전 설계) 문구가
  뒤이은 구현에서 조용히 대체된 뒤 한 번도 동기화되지 않은 채 R16 까지 이어진 것**이다.
  - target 의 "그런 응답은 존재한 적이 없다"는 **런타임/구현 관점에서는 정확**하다 — 어떤 배포된 코드
    경로도 이 shape 을 실제로 반환한 적이 없다.
  - 다만 "spec 텍스트가 존재한 적이 없다"는 의미로 오독될 여지는 있다(실제로는 spec 초안 문구는
    처음부터 있었다). 이는 검토 대상 정정문이 실제로 그렇게 오독을 유도하는 문장을 쓰지는 않았으므로
    (코드 shape 을 지칭해 "존재한 적이 없다"고 명확히 한정) 등급을 올릴 사안은 아니지만, 참고차 기록.
- 전역 grep(`executionId, status`)으로 확인한 결과, EIA `/cancel` 관련해 이 stale shape 을 참조하는
  다른 spec/코드 잔존물은 없다(다른 매치는 전부 무관한 webhook 트리거 엔드포인트·WS 이벤트·테스트 fixture).
  fix 가 남긴 orphan reference 없음.

### 점검 3 — swagger.md §5-1 신설 문단이 기존 Rationale 과 충돌하는가

**결론: 충돌 없음. 기존 §5-1 "엔티티를 그대로 노출하지 말라" 원칙을 명시적으로 인용·확장한 특수화이며,
새 기술적 근거(엔티티 enum 선언 순서가 wire enum 배열 순서를 흔든다)를 추가한 것. 새 결정 추가로 보되
기존 원칙과 정합.**

- 신설 문단의 첫 번째 이유 "(a) DTO 레이어가 엔티티에 결합되지 않아야 하고 **(위 항목)**" 는 §5-1 의
  기존 문장("엔티티를 그대로 노출하지 말고 ... 별도 DTO 를 만듭니다")을 **명시적으로 지칭**한다 — "엔티티를
  그대로 노출하지 말라"(전체 객체 노출 금지, 보안/구조 분리 취지)와 "엔티티 enum 에서 파생하지 않는다"(타입/값
  차원의 결합 회피)는 동일 원칙을 더 좁은 표면(리터럴 유니온 파생)에 적용한 것으로, 같은 취지의 확장이지
  모순이 아니다.
- 두 번째 이유 "(b) 엔티티 enum 순서가 wire enum 배열 순서를 바꾼다"는 기존 Rationale 어디에도 없던
  **새 기술적 근거**다. 다만 이는 `execution-status.literal.ts` 의 기존 docstring 을 그대로 옮긴 것으로
  확인됐다(파일 원문 대조 완료, 문구 일치) — 지어낸 근거가 아니라 **이미 코드에 존재하던 근거를 규약
  문서로 승격**한 것이다.
- 이 결정은 실은 **더 이전에 이미 암묵적으로 내려져 있었다**: 본 plan 문서 §"EIA 응답 DTO `status` 리터럴
  유니온 SoT 통합"(2026-07-12 완료, PR eia-context-dev) 항목이 "reviewer 가 제안한 `execution.entity.ts`
  enum 파생은 swagger §5-1 원칙에 어긋난다"고 **당시에도 §5-1 을 근거로 인용해 거부**한 바 있다 — 그러나
  그때는 아직 swagger.md §5-1 에 그 구체적 근거(순서 흔들림)가 문서화돼 있지 않았다. 이번 편집은 그 갭을
  메워, 개발자가 과거에 인용했던 "§5-1 원칙"을 실제 텍스트로 뒷받침한 것 — **기각된 대안을 사후적으로
  정식 Rationale 화**한 사례이며, 지어낸 이력이 아니라 같은 plan 문서·같은 파일 docstring 에 실존하는
  근거를 옮긴 것으로 확인됨.
- 문서 관행과의 정합: swagger.md 는 이미 §1-4 "예외 — 형태는 고정이나 SoT 이중화 회피로 여는 경우"
  절처럼, 본문 안에 짧은 근거를 인라인으로 두고 필요 시 `## Rationale` 항목으로 별도 승격하는 혼재 패턴을
  쓴다. 신설 §5-1 문단이 `## Rationale` 에 미러링되지 않은 것은 이 문서의 기존 관행에서 크게 벗어나지
  않는다(§0·§5·§5-4 처럼 별도 Rationale 항목이 있는 것도 있고, §1-4 의 "예외" 불릿처럼 본문 인라인 근거로
  그치는 것도 있다). 등급을 올릴 사안은 아니되, 발견성(discoverability) 관점에서 보완 여지는 있다.

## 교차 확인 — 부수 정합성

- `spec/5-system/14-external-interaction-api.md` §5 서두 봉투 각주·§5.4 본문·R16 세 곳의 문구가
  서로 다른 표현("둘 다 InteractAckDto" / "ack shape 은 §5.1 과 동일" / "2026-08-10 정정...")을 쓰지만
  가리키는 사실(§5.1=§5.4 동일 DTO)은 완전히 일치 — 세 곳 간 내부 모순 없음.
- `spec/7-channel-web-chat/*.md`·`spec/data-flow/15-external-interaction.md` 등 EIA `/cancel` 을
  참조하는 다른 spec 문서에서 옛 2필드 shape 을 재인용하는 곳 없음(grep 확인) — fix 가 다른 문서와의
  정합을 깨지 않음.
- plan 문서의 "잔여 (체크리스트)" 두 항목이 `[x]` 로 전환되면서 첨부한 근거(코드 위치·docstring 인용)가
  모두 실제 워킹트리 상태와 일치 — plan 서술이 코드보다 앞서가거나 지어낸 부분 없음.

## 요약

`eia-context-schema-followups` 의 잔여 2건 처리는 Rationale 연속성 관점에서 건전하다. R16 편집은 채택된
핵심 결정("202 + ack body, no-content 아님")을 그대로 보존한 채 §5.4 의 shape 서술만 실측에 맞게 정정했고,
정정 시점·근거·논거를 새 콜아웃으로 명시해 "무근거 번복" 금지 원칙을 지켰다. "2필드 응답이 존재한 적이
없다"는 주장은 `interaction.service.ts` 전체 이력(파일 생성 시점부터 불변)과 SDK 코드로 반증 시도했으나
성립하지 않았다 — 다만 그 2필드 문구 자체는 구현 이전 spec 초안(PR #228)에서 유래해 R16(PR #604)까지
동기화 없이 이어진 것이었다는 이력적 뉘앙스가 있다(정정문의 "코드 관점 존재한 적 없다"는 표현과는 배치되지
않음). swagger.md §5-1 신설 문단은 기존 "엔티티를 그대로 노출하지 말라" 원칙을 명시적으로 인용해 확장하고,
`execution-status.literal.ts` docstring 에 실재하던 근거를 충실히 옮겼으며, 과거 plan 항목이 암묵적으로
인용했던 "§5-1 원칙"을 사후적으로 뒷받침하는 정합적 보완이다. CRITICAL·WARNING 급 발견사항 없음.

## 위험도

NONE

STATUS=success
