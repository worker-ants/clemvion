# 신규 식별자 충돌 검토 — naming_collision

대상: `origin/main..HEAD` (4 commits: `311015832` docs(spec) EIA 닫힌 union 스키마화 규약, `60c4c8900` refactor getStatus context 닫힌 union 화, `efc9e791e` ai-review Warning 5건 반영, `b1d69ed8c` docs(review) RESOLUTION commit hash 정정).

## 발견사항

검토 관점 (a)~(d) 전부 실제 `grep` 로 재현·검증했으며, CRITICAL/WARNING 급 신규 충돌은 발견되지 않았다.

- **[INFO]** `Context` 어휘가 두 무관 도메인에서 재사용됨 — 실충돌 아님, 참고만
  - target 신규 식별자: `WaitingContextBaseDto` / `ButtonsContextDto` / `NodeOutputContextDto` (`codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:61-143`)
  - 기존 사용처: `codebase/backend/src/nodes/core/node-handler.interface.ts:31` `export interface ExecutionContext` (엔진이 노드 핸들러에 주입하는 실행 컨텍스트) + `spec/conventions/execution-context.md` (God Object 방지 규약, `ExecutionContext`/`ParallelBranchContext` 등 어휘)
  - 상세: 두 그룹 모두 "Context" 라는 단어를 쓰지만 (1) 식별자 문자열이 완전히 다르고(`WaitingContextBaseDto` vs `ExecutionContext`), (2) 파일 위치·모듈 경계가 분리돼 있으며(`dto/` vs `nodes/core/`), (3) 의미 영역도 다르다 — 하나는 REST 응답의 "현재 인터랙션 대기 표면" DTO 봉투, 다른 하나는 엔진이 노드 핸들러에 주입하는 실행 상태 객체. `grep -rn "class ExecutionContext\|interface ExecutionContext\|type ExecutionContext" codebase/backend/src` 결과 셋 다 `node-handler.interface.ts`/`execution-context.service.ts` 뿐이라 identifier 수준 충돌은 없다.
  - 제안: 조치 불필요. 굳이 강화하려면 `WaitingContextBaseDto` JSDoc 에 "엔진 `ExecutionContext`(node-handler.interface.ts) 와 무관한 REST 응답 봉투" 한 줄을 덧붙일 수 있으나 우선순위 낮음.

## 항목별 검증 결과

### (a) 4개 신규 export DTO 명이 `codebase/` 어디서든 다른 의미로 이미 쓰이는가

`grep -rn "CurrentNodeDto\|WaitingContextBaseDto\|ButtonsContextDto\|NodeOutputContextDto" codebase/ --include="*.ts" --include="*.tsx"` 전수 확인 결과, 4개 이름 모두 다음 세 위치에만 나타난다:
- `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (정의)
- `codebase/backend/src/modules/external-interaction/dto/responses.dto.spec.ts` (신규 유닛 테스트, target 정의를 그대로 소비)
- `codebase/backend/dist/**/*.d.ts` (gitignore 된 컴파일 산출물 — `.gitignore:2 /dist` 확인, 추적 대상 아님)
- `codebase/channel-web-chat/src/lib/eia-types.ts:131` — `CurrentNodeDto` 를 **문자열로 언급하는 JSDoc 주석 1줄**뿐("스칼라가 아니라 객체다 (백엔드 `CurrentNodeDto`)"), 동명 타입/클래스를 프런트에 새로 선언하지 않았다.

다른 모듈·패키지(`codebase/frontend`, `codebase/packages`)에 동명 export 없음. **충돌 없음.**

### (b) `WaitingContextBase`(Dto 접미사 없음) 잔존 참조 여부

`60c4c8900` 에서 도입된 `type WaitingContextBase` 별칭은 `efc9e791e` 에서 제거되고 `abstract class WaitingContextBaseDto` 를 직접 export 하는 형태로 교체됐다 — 이는 그 직전 코드 리뷰(`review/code/2026/07/10/23_20_33/SUMMARY.md` W2: "`WaitingContextBaseDto`(abstract, 비-export) vs `WaitingContextBase`(export type) 근접 동명 쌍")가 정확히 지적한 near-duplicate naming 을 조치한 결과다.

`grep -rn "WaitingContextBase\b" . --include="*.ts" --include="*.tsx"` (word-boundary, `WaitingContextBaseDto` 는 `Base` 뒤에 경계가 없어 자동 제외) 결과 **코드 상 잔존 0건**. 유일하게 남은 문자열 매치는:
- `review/code/2026/07/10/23_20_33/*.md` — 위 W2 발견을 기록한 과거 리뷰 산출물 (히스토리, 조치 완료 기록)
- `review/consistency/2026/07/10/23_46_04/rationale_continuity.md:27` — 같은 전환을 사후 서술한 문장
- `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md:176,180` — 체크리스트에 완료 항목으로 기록

모두 **과거형 서술/문서 아카이브**이지 dangling import/reference 가 아니다. `interaction.service.ts:34` 는 `type WaitingContextBaseDto` 를 정확한(Dto 접미사 포함) 이름으로 import 하고 있음을 재확인했다(`sed -n '1,40p'`). **잔존 참조 없음 — 조치 완결.**

### (c) `WaitingContextBaseDto` 와 엔진 `ExecutionContext` 계열 / `spec/conventions/execution-context.md` 충돌 여부

위 INFO 항목 참조. 식별자 문자열·모듈 경계·의미 모두 분리돼 있어 실질 충돌 없음(NONE). `spec/conventions/execution-context.md` 는 `ExecutionContext`(엔진 핸들러 계약) 의 필드 분류 규약 문서이며, target 이 건드리는 `WaitingContextBaseDto`(REST DTO) 를 전혀 언급하지 않는다 — 상호 참조·용어 재정의 시도 없음.

### (d) 신규 spec 앵커 충돌 + inbound 링크 정확성 (EIA 자신의 §5.4 "명시적 취소" 와의 구분 포함)

- `spec/5-system/2-api-convention.md` 헤딩 전수(`grep -n "^#\{1,4\} "`) 확인 결과 신규 `### 5.4 부재 표현 — null vs 키 생략` 및 Rationale `### 왜 conversationThread 를 null 로 정규화하지 않는가 (§5.4)` 는 문서 내 기존 헤딩과 텍스트 중복 없음 → 앵커 충돌 없음.
- GitHub 스타일 슬러그 규칙(백틱/구두점 제거, 공백→`-`, 다중 공백 개별 치환)으로 직접 재계산한 결과:
  - `54-부재-표현--null-vs-키-생략` — 문서 내 실제 참조 링크(`#54-부재-표현--null-vs-키-생략`, 예: `spec/5-system/14-external-interaction-api.md:443`)와 **정확히 일치**.
  - `왜-conversationthread-를-null-로-정규화하지-않는가-54` — `interaction.service.ts` 주석·EIA §R17 참조 링크와 **정확히 일치**.
  - 깨진 inbound 링크 없음.
- `spec/conventions/swagger.md` 신규 Rationale 헤딩 3종(`§1-4 닫힌 union...`, `` `discriminator` 는 판별자가 sound 할 때만 (§1-4) ``, `왜 EIA context 는...`)도 전수 확인 결과 서로 텍스트가 달라 앵커 충돌 없음.
- **EIA 자신의 §5.4 명시적 취소와의 구분**: `spec/5-system/14-external-interaction-api.md` 는 로컬 `### 5.4 명시적 취소 — POST .../cancel` (L482) 를 이미 보유한다. `grep -n "§5\.4" spec/5-system/14-external-interaction-api.md` 로 해당 파일 내부의 모든 bare `§5.4` 언급을 전수 확인한 결과, `api-convention.md` §5.4 를 가리키는 두 지점(L443, L1148) 모두 다음과 같이 안전하다:
  - L443: `[API 규약 §5.4](./2-api-convention.md#54-부재-표현--null-vs-키-생략)` — 파일명(`API 규약`) 접두 + 상대경로 필수 qualify.
  - L1148 (R17): `[API 규약 §5.4](./2-api-convention.md#54-부재-표현--null-vs-키-생략)(본 문서 자신의 §5.4 "명시적 취소" 가 아니다)` — **명시적으로 자기 자신의 §5.4 와 다르다고 괄호로 부연**까지 돼 있어 같은 파일 안에서의 오독 여지가 없다.
  - `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md:144` 에 이 정정 자체가 계획 항목("naming_collision W5")으로 기록돼 있어, 이전 리뷰 라운드에서 지적된 동일 우려가 이번 커밋들에서 이미 반영된 것으로 확인된다.
  - bare `§5.4`(파일명 미지정) 형태로 api-convention 을 가리키는 잔여 참조는 없음 — `interact`/`cancel` 관련 다른 `§5.1`·`§5.4` 언급(L272, L750, L1109)은 모두 EIA 문서 **자기 자신의** §5.4(cancel) 를 가리키는 것으로 문맥상 올바르다(별도 파일 아님).
  - `codebase/backend/.../responses.dto.ts:12`: `[Spec EIA §5.1 / §5.4]` — 이 역시 EIA 문서 로컬 §5.1(interact)/§5.4(cancel) 를 가리키는 것으로 올바르며, 같은 파일의 다른 위치(L106,110,204,213)에서 `API 규약 §5.4` 로 명시적으로 구분해 파일명 qualify 하고 있어 두 표기가 공존해도 문맥상 모호하지 않다.

## 요약

target 이 새로 도입한 4개 export DTO(`CurrentNodeDto`/`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`)는 `codebase/` 전체에서 유일하며 다른 의미로 쓰인 기존 식별자와 충돌하지 않는다. 직전 코드 리뷰가 지적했던 `WaitingContextBase`(type)/`WaitingContextBaseDto`(abstract class) 근접 동명 쌍은 `efc9e791e` 에서 전자를 완전히 제거하고 후자로 단일화해 해소됐으며 코드 상 dangling 참조는 0건이다(문서 아카이브에만 과거형으로 남음). `WaitingContextBaseDto` 는 엔진의 `ExecutionContext` 계열·`spec/conventions/execution-context.md` 어휘와 식별자·모듈·의미 세 축 모두 분리돼 있어 혼동 소지가 낮다. 신규 spec 헤딩(`api-convention.md` §5.4, `swagger.md` Rationale 3종)은 각 문서 내에서 유일하며 GitHub 슬러그 규칙으로 재계산한 앵커가 실제 inbound 링크와 정확히 일치한다. 특히 우려됐던 EIA 문서 자신의 §5.4(명시적 취소)와 api-convention.md 신설 §5.4(부재 표현) 의 bare-reference 혼동 가능성은, 모든 cross-ref 가 파일명 qualify(`[API 규약 §5.4](./2-api-convention.md#...)`)돼 있고 R17 항목은 괄호로 명시적 반증까지 달아 두어 실질적으로 해소돼 있다. 신규 요구사항 ID·API endpoint·이벤트명·ENV/설정키는 이번 diff 범위에 추가되지 않았다.

## 위험도

NONE
STATUS: SUCCESS
