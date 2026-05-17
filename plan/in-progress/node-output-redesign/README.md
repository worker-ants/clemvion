# Node 개선안 — 노드별 종합 인덱스

> **4차 갱신 (2026-05-17 D 결정 phase 완료)**: §"결정 사항" 의 6개 횡단 결정 (D1~D6) 이 모두 PR 로 머지됐다 — D1 #145, D2 #148, D3 #149, D4 #159, D5 #153, D6 #157. spec / backend handler / test 모두 D 결정 방향으로 정렬 완료. 본 plan 은 D 결정이 다루지 못한 **노드별 P0/P1/P2/P3 항목** (§"진행 상태 요약" Phase 2 / §"요약 — §B 구현 분석") 이 남아 있으므로 `in-progress` 유지. 다음 phase 는 P0 (ai-agent error builder, information-extractor ConversationThread v2 등) 부터 노드 단위 처리.

> **3차 확장 (2026-05-16 구현 분석)**: 본 폴더는 28종 노드별 spec ↔ **backend 구현** ↔ 기존 plan 을 모두 비교한 종합 분석 단계로 확장됐다. 모든 노드 plan 파일에 `## 구현 분석 (2026-05-16)` 과 `## 종합 개선안 (2026-05-16)` 두 새 섹션이 추가되었다. 28종 중 **잔여 권고가 1건 이상인 노드 27 / 완전 부합 1**(split). 권고는 `(spec)` · `(impl)` · `(frontend)` 접두로 분류한다. 자세한 단면별 통계는 §"종합 개선안 통계 (2026-05-16)" 표.
>
> **2차 갱신 (2026-05-16 spec 정합)**: 본 폴더의 노드별 plan 들은 1차 초안(2026-04 / commit `e228ec96`) 이후 spec/4-nodes/ 와 spec/conventions/node-output.md 가 여러 차례 개선됐다. 본 갱신에서 (a) 모든 plan 파일 상단에 `최신화 검토 (2026-05-16)` 상태 블록을 추가해 현재 spec 부합 여부와 잔여 권고 항목을 명시했고, (b) 신규 노드 **Cafe24** ([cafe24.md](./cafe24.md)) 를 인덱스·요약 표·잔여 권고 통계에 편입했다. 노드 카운트는 27 → 28 로 변경됐다.

본 plan 폴더는 `spec/4-nodes/` 의 모든 노드 spec 을 검토하여, 각 노드의 `output` 필드 정의가 다음 정의에 부합하는지 진단하고 노드별 개선안을 모은 자료다. 2026-05-16 갱신부터 backend 구현 (`codebase/backend/src/nodes/**/*.handler.ts`, `*.schema.ts`, `*.spec.ts`) 정합성도 함께 다룬다.

## 출발점 — output 의 올바른 정의 (사용자 표현 그대로)

> **"노드 실행이 각 단계마다 끝났을 때 채워지는 field"**

예시 — Form 노드는 두 단계의 데이터가 모두 output 으로 채워진다:

1. **(a) 사용자에게 표시할 렌더링 데이터** — 노드 실행 진입(=웨이팅 시점) 단계의 산출물
2. **(b) 사용자 인터렉션 후 입력된 데이터** — 다음 단계(=재개) 단계의 산출물

따라서 `output` 에 들어가서는 **안 되는 것** (예시):

| 잘못 들어간 카테고리 | 옳은 위치 |
| --- | --- |
| 노드 실행 옵션·설정값 (사용자가 UI 에서 정의한 리터럴) | `config` |
| 정적 메타데이터 (노드 이름, 타입, model id 등) | spec 본문 또는 `meta` |
| 입력 파라미터 그 자체 (handler 가 받은 input) | 입력 / pass-through 라면 별도 분류 |
| 노드 외부에서 주입되는 값 (자격증명, expression resolver 결과의 raw) | `meta` 또는 외부 컨텍스트 |
| 실행 메트릭 (duration, tokens, status code) | `meta` |

## 기준 규약 — `spec/conventions/node-output.md`

본 plan 의 **모든 진단·개선안은 [`spec/conventions/node-output.md`](../../../spec/conventions/node-output.md) 의 11 개 Principle 을 기준**으로 한다. 핵심:

- **Principle 0** — 5필드 invariant: `{ config, output, meta?, port?, status? }` 외 top-level 키 금지
- **Principle 1** — `output` 은 비즈니스 결과물만
- **Principle 1.1** — `config` ↔ `output` 직교 (리터럴 config 는 `output` 에 echo 금지)
- **Principle 2** — `meta` 는 실행 메트릭만 (duration, tokens, status code, rowCount 등)
- **Principle 3** — 에러 컨트랙트: pre-flight throw vs `port:'error'` + `output.error.{code, message, details?}`
- **Principle 4** — 블로킹/재개: `waiting_for_input` → `resumed` 통일, `output.interaction.{type, data, receivedAt}`
- **Principle 5** — `port` 활성화 모델: `undefined` / `string` / `string[]`
- **Principle 6** — 동적 포트 ID 네이밍 + 시스템 예약어
- **Principle 7** — `config` 는 raw echo, `output` 은 evaluated
- **Principle 8** — 이중 중첩 제거, LLM 계열은 `output.result.*` 로 통일
- **Principle 9** — Container 노드의 `output: null` → 엔진 오버라이트 컨트랙트
- **Principle 10** — null/빈 입력 fallback 정책
- **Principle 11** — 출력 예시 문서화 규칙

> 본 plan 은 conventions 자체는 변경하지 않는다 — 노드 spec 본문이 conventions 를 어떻게 위반·미흡하게 따르는지에 대한 노드별 적용 진단이다.

## 진단 방법론

각 노드 plan 파일은 다음 8 섹션 구성을 따른다 (2026-05-16 §7/§8 추가):

1. **최신화 검토 블록** — 현 spec / 구현 정합 여부, 잔여 권고 항목 요약
2. **현재 output (spec 인용)** — `spec/4-nodes/.../<node>.md` 의 §5 (출력 구조) 절 인용
3. **진단** — 각 항목·필드가 정의 ("단계마다 채워지는 field") 와 conventions 11 원칙에 부합하는가 (spec 본문 관점)
4. **개선안 — 정리된 output** — 단계별로 채워지는 데이터만 남긴 정리안 (spec 본문 관점)
5. **분리 제안** — `output` 에서 빠질 항목의 새 위치 (`config` / `meta` / 본문 metadata 등)
6. **Rationale** — 분류 근거 + 폐기된 대안
7. **구현 분석 (2026-05-16)** — `*.handler.ts` / `*.schema.ts` / `*.spec.ts` / `*.component.ts` 단면별 점검. 모든 인용은 `파일:라인` 형식.
8. **종합 개선안 (2026-05-16)** — spec + 구현 + 테스트 단면을 묶어 `(spec)` / `(impl)` / `(frontend)` 접두 체크박스로 나열.

> 본 작업이 spec / 구현에 즉시 반영되는 것은 **아니다**. plan 검토 → 합의 → 별도 phase 에서 `project-planner` 가 `(spec)` 항목을, `developer` 가 `(impl)` / `(frontend)` 항목을 처리한다.

### 점검 단면 (구현 분석)

각 노드 §7 은 다음 8 단면을 순서대로 점검한다 (발견 없으면 짧게 "변경 없음"):

1. spec §5 ↔ handler `return` 정합성 (단계별 case 형태 일치)
2. schema (Zod) ↔ spec config 정합성 (default / optional / enum)
3. `handler.validate()` / `warningRules` / `validateConfig` SSOT 일관성
4. 에러 컨트랙트 (Principle 3) — pre-flight throw vs `port:'error'` + `output.error.{code,message,details?}`
5. conventions Principle 0–11 위반 패턴
6. handler 테스트 — spec §5 case 커버
7. 횡단 일관성 — 같은 카테고리 노드들과의 패턴 정합
8. 구현 품질 — dead code, 매직 넘버, 안전성 처리

## 노드 목록 (총 28 개)

### 1. Logic 노드 (12 종)

| 노드 | 카테고리 | plan 파일 |
| --- | --- | --- |
| If/Else | 분기 (pass-through) | [if-else.md](./if-else.md) |
| Switch | 분기 (pass-through, 동적 포트) | [switch.md](./switch.md) |
| Loop | 컨테이너 (반복) | [loop.md](./loop.md) |
| Variable Declaration | side-effect (pass-through) | [variable-declaration.md](./variable-declaration.md) |
| Variable Modification | side-effect (pass-through) | [variable-modification.md](./variable-modification.md) |
| Split | 데이터 변형 (단일 출력) | [split.md](./split.md) |
| Map | 컨테이너 (반복) | [map.md](./map.md) |
| Filter | 분기 (양쪽 동시) | [filter.md](./filter.md) |
| ForEach | 컨테이너 (반복) | [foreach.md](./foreach.md) |
| Parallel | 컨테이너 (병렬) | [parallel.md](./parallel.md) |
| Merge | 데이터 변형 (단일 출력) | [merge.md](./merge.md) |
| Background | 컨테이너 (fire-and-forget) | [background.md](./background.md) |

### 2. Flow 노드 (1 종)

| 노드 | 카테고리 | plan 파일 |
| --- | --- | --- |
| Workflow (Sub-Workflow) | 호출 (sync/async) | [workflow.md](./11-workflow.md) |

### 3. AI 노드 (3 종)

| 노드 | 카테고리 | plan 파일 |
| --- | --- | --- |
| AI Agent | LLM (single/multi turn, blocking) | [ai-agent.md](./ai-agent.md) |
| Text Classifier | LLM (분류, 동적 포트) | [text-classifier.md](./text-classifier.md) |
| Information Extractor | LLM (추출, single/multi turn, blocking) | [information-extractor.md](./information-extractor.md) |

### 4. Integration 노드 (4 종)

| 노드 | 카테고리 | plan 파일 |
| --- | --- | --- |
| HTTP Request | external (success/error) | [http-request.md](./http-request.md) |
| Database Query | external (success/error) | [database-query.md](./database-query.md) |
| Send Email | external (success/error) | [send-email.md](./send-email.md) |
| **Cafe24** *(신규)* | external (Cafe24 Admin API, success/error) | [cafe24.md](./cafe24.md) |

### 5. Data 노드 (2 종)

| 노드 | 카테고리 | plan 파일 |
| --- | --- | --- |
| Transform | 순수 변형 (단일 출력) | [transform.md](./transform.md) |
| Code | JS sandbox (success/error) | [code.md](./code.md) |

### 6. Presentation 노드 (5 종)

| 노드 | 카테고리 | plan 파일 |
| --- | --- | --- |
| Carousel | UI (정적/동적, blocking 가능) | [carousel.md](./carousel.md) |
| Table | UI (blocking 가능) | [table.md](./table.md) |
| Chart | UI (집계, blocking 가능) | [chart.md](./chart.md) |
| Form | UI (blocking 필수) | [form.md](./form.md) |
| Template | UI (렌더, blocking 가능) | [template.md](./template.md) |

### 7. Trigger 노드 (1 종)

| 노드 | 카테고리 | plan 파일 |
| --- | --- | --- |
| Manual Trigger | 진입점 | [manual-trigger.md](./manual-trigger.md) |

## 진행 상태 요약 (2026-05-16)

### Phase 1 — spec 본문 정합 관점 (D 결정 후 잔여 4종 / 부합 24종, 2026-05-17 갱신)

대부분의 노드 spec 은 conventions 11 Principle 에 부합하도록 정리된 상태다. **D1~D6 phase 머지 (2026-05-17) 후 잔여 4종 / 부합 24종으로 축소**.

#### 잔여 권고가 있는 노드 (4종)

| 노드 | 잔여 권고 요약 |
| --- | --- |
| [parallel](./parallel.md) | §5.2 (`done`) `meta.durationMs` + `meta.branches` 보강 |
| [merge](./merge.md) | `meta.strategy` / `meta.outputFormat` 의 `config` 중복 제거 검토 (D1 으로 일부 정리됐으나 `meta.*` echo 정책 별도 결정 필요) |
| [workflow](./11-workflow.md) | Async `output.workflowId` / `output.status: 'started'` 중복 제거 |
| [http-request](./http-request.md) | Transport 실패 시 `output.response: { error }` legacy 잔재 제거 (D4 와 별개 — D4 는 throw → port:'error' 통일이고 본 항목은 transport-failed 본문 형태 정리) |

#### D 결정 phase 로 처리된 노드 (잔여 권고 해소, 2026-05-17)

| 노드 | 해소된 권고 | 처리 PR |
| --- | --- | --- |
| [variable-modification](./variable-modification.md) | `config.recordValues` raw echo 추가 | D1 #145 |
| [map](./map.md) | §5.1 외부 노출 표현 명확화 (D2), Map/ForEach skipped 패턴 통일 검토 (D3 — 의도된 분기 결정), `errorPolicy` echo (D1) | D1 #145 / D2 #148 / D3 #149 |
| [foreach](./foreach.md) | §5.1 표현 명확화 (D2), Map/ForEach skipped 패턴 통일 (D3), `errorPolicy` echo (D1) | D1 #145 / D2 #148 / D3 #149 |
| [ai-agent](./ai-agent.md) | waiting/resumed `output.messages` ↔ 종결 `output.result.messages` 경로 통일 (D6) | D6 #157 |
| [text-classifier](./text-classifier.md) | `output.originalInput` 위치 일관성 (D6 — error 시 top-level 폐기) | D6 #157 |
| [information-extractor](./information-extractor.md) | waiting `output.maxTurns` / `output.message` / `output.turnCount` 의 `output.result.*` 이동 (D6 — 동일 단일 경로) | D6 #157 |
| [carousel](./carousel.md) | `maxItems` echo 누락 (D1), `buttonConfig` 위치 결정 (Principle 7 exception 으로 의도적 유지) | D1 #145 |
| [table](./table.md) | `output.rendered` HTML snapshot 폐기, frontend client-side 렌더 전환 (D5) + `dataSource` / `rows` / `pagination` echo (D1) | D1 #145 / D5 #153 |

#### 부합 (잔여 권고 없음) 노드 (16종)

if-else / switch / loop / variable-declaration / split / filter / background / transform / code / database-query / send-email / cafe24 / chart / form / template / manual-trigger

> 위 16종 중 `if-else` / `switch` / `loop` / `chart` / `template` 는 D1 PR #145 으로 configEcho enumeration 정렬 처리됨. `database-query` / `send-email` / `cafe24` 는 D4 PR #159 로 IntegrationError → port:'error' 통일됨. spec 정합 관점에서는 잔여 권고 없음 — Phase 2 (구현 분석) 의 P0/P1 항목은 별개.

### Phase 2 — 구현 분석 관점 (28종 전수, 2026-05-16 추가)

각 노드의 §"구현 분석" / §"종합 개선안" 섹션에서 도출된 권고를 단면별로 카운트한 표. `(spec)` 은 spec 본문 추가/정정, `(impl)` 은 backend handler/schema/tests 변경, `(frontend)` 는 frontend resolver/component 변경.

| 노드 | spec | impl | frontend | 핵심 갭 |
| --- | :-: | :-: | :-: | --- |
| [if-else](./if-else.md) | 2 | 1 | 0 | `strictComparison` echo 누락, `matchedConditions` short-circuit 명시 |
| [switch](./switch.md) | 1 | 2 | 0 | `hasDefault`/`strictComparison` echo 누락 |
| [loop](./loop.md) | 1 | 2 | 0 | `count` schema 타입 echo 일치성 |
| [split](./split.md) | **0** | **0** | **0** | **완전 부합 ✓** |
| [variable-declaration](./variable-declaration.md) | 0 | 1 | 0 | `rawConfig` fallback 안전성 |
| [variable-modification](./variable-modification.md) | 1 | 2 | 0 | `recordValues` conditional echo (Principle 7 "항상 echo" 미세 충돌) |
| [map](./map.md) | 2 | 3+1 | 0 | `errorPolicy` echo 누락, `meta.iterations/fellBackToEmpty` 부재, 시작 시점 output 표현 (items[] vs null) |
| [filter](./filter.md) | 1 | 1 | 0 | spec 정합도 최상, 미시 보강만 |
| [foreach](./foreach.md) | 1 | 3 | 0 | `errorPolicy` echo, `collectResults` dead field (schema 부재) |
| [parallel](./parallel.md) | 2 | 3 | 0 | `meta.durationMs`/`meta.branches` 누락, `handler.spec.ts` 별도 파일 부재 |
| [merge](./merge.md) | 2 | 3 | 1 | `meta.strategy`/`outputFormat` config 중복 |
| [background](./background.md) | 1 | 1 | 1 | rawConfig 명시 echo (credential leak 가드 baseline 사례) |
| [workflow](./workflow.md) | 4 | 2 | 1 | async `output.workflowId`/`output.status` 중복 제거 |
| [manual-trigger](./manual-trigger.md) | 2 | 2 | 1 | 단독 진입점 미시 보강 |
| [ai-agent](./ai-agent.md) | 3 | **6** | 0 | **CRITICAL — `output.error`/`port:'error'` builder 미구현** (`llmService.chat` throw 가 엔진 FAILED 로 빠짐) |
| [text-classifier](./text-classifier.md) | 2 | 3 | 0 | `output.originalInput` 위치 비대칭 (정상 inside result / 에러 top-level), config echo 비대칭 |
| [information-extractor](./information-extractor.md) | 1 | **7** | 0 | `output.maxTurns`/`message`/`turnCount` 잔재, ConversationThread v2 multi-turn push 미구현, `MAX_TURN_DEBUG_HISTORY` cap 누락 |
| [http-request](./http-request.md) | 1 | 3 | 0 | transport 실패 `output.response: { error }` legacy 잔재 제거 |
| [database-query](./database-query.md) | 0 | 3 | 0 | `meta.statusCode` 미부여, rows truncation cap 누락 |
| [send-email](./send-email.md) | 1 | 2 | 0 | body cap 일관성 |
| [cafe24](./cafe24.md) | 2 | 3 | 0 | §1 pagination `cursor?: string` schema 폐기 잔재 정정 |
| [transform](./transform.md) | 1 | 1 | 0 | 미시 보강만 |
| [code](./code.md) | 1 | **4** | 0 | `timeout` schema 누락 (UI 30s slider ↔ schema 부재), `$node`/`$helpers` 미주입, timer 셰도잉 명시 누락 |
| [carousel](./carousel.md) | 2 | 3 | 0 | `maxItems` echo 누락, `buttonConfig` runtime 생성 위치 |
| [table](./table.md) | 2 | 3 | 0 | `output.rendered` HTML snapshot 위치 비대칭 (Carousel/Chart 는 client 전환 완료) |
| [chart](./chart.md) | 1 | **4** | 0 | `chartOutputSchema` (schema:113-118) 옛 dead schema, `groupBy` 다중시리즈 미구현, raw echo 누락 |
| [form](./form.md) | 1 | 2 | 0 | 양호, blocking 재개 토큰 보강 |
| [template](./template.md) | 1 | **4** | 0 | `helpers` echo 누락, XSS 안전성 보강 |
| **합계** | **~39** | **~74** | **~3** | spec/impl 비율 ≈ 1:1.9 (구현 갭이 더 많이 발견됨) |

> 위 28종 중 **split** 만 모든 단면이 완전 부합 (구현 분석에서도 추가 권고 없음). 나머지 27종은 1건 이상의 새 권고 발생 — 대부분 미세 보강이지만 `ai-agent` (에러 builder 미구현) 와 `information-extractor` (ConversationThread v2 미구현) 는 P0/P1 우선순위.

## 요약 — 가장 빈번한 부적절 패턴 (2026-05-16 갱신)

본 분석에서 반복적으로 검출된 패턴 (전체 plan 의 누적 통계).
**§A** — spec 본문 정합 관점 (1차 분석), **§B** — 구현 분석 관점 (2026-05-16 추가).

### §A — spec 본문 관점

1. **리터럴 config 의 `output` echo 잔재** (부분 해소):
   - 발견: `output.workflowId` (workflow async — `config.workflowId` 와 중복), ~~`output.maxTurns` (information_extractor waiting — `config.maxTurns` 와 중복)~~ ✅ D6 #157 로 `output.result.maxTurns` wrap, `meta.strategy` / `meta.outputFormat` (merge — `config.*` 와 중복).
   - 대부분 spec 본문이 의도적으로 echo 한다고 정당화하지만 Principle 1.1 직교 위반으로 해석됨. 호환성 영향 평가 후 제거 권장.

2. **HTML/SVG snapshot 위치의 카테고리 비대칭** ✅ **D5 #153 해소**:
   - Carousel / Chart 는 백엔드 HTML/SVG 생성 폐지 + frontend client-side 렌더로 전환 완료.
   - ~~Table 은 `output.rendered` (HTML) 유지~~ → D5 로 폐기, frontend `TableContent` 가 `output.rows` + `output.columns` 로 직접 렌더.

3. **컨테이너 시작/완료 단계 분리의 표현 모호** ✅ **D2 #148 해소**:
   - ~~Map / ForEach 의 §5.1 (시작 시점) JSON 예시가 envelope 으로 표시되어 다운스트림이 raw `items[]` 를 볼 수 있다는 오해 가능.~~ → D2 (라안) 으로 spec common §9.1 + Map/ForEach §5.1·§5.7 에 "handler return 은 엔진-내부 전용, 외부 노출 없음" footnote 추가. impl 변경 없음.

4. **컨테이너 노드의 `meta` 누락**:
   - Parallel §5.2 (`done`) 에 `meta` 자체가 빠져 Loop / ForEach / Map 과 일관성 결여. `meta.durationMs` + `meta.branches` 보강 필요.

5. **LLM 계열 wrapper 경로 비대칭** ✅ **D6 #157 해소**:
   - ~~ai_agent / information_extractor 의 multi-turn 노드에서 waiting/resumed 시 `output.messages` (top-level) vs 종결 시 `output.result.messages` (wrapper inside) 의 경로 차이~~ → D6 로 단일 경로 `output.result.*` 통일.
   - ~~text_classifier 의 `output.originalInput` 도 정상/에러에서 위치가 달라 유사한 비대칭.~~ → D6 로 에러 시 top-level `originalInput` 폐기, `output.error.details.originalInput` (truncated) 만 surface.

6. **Transport 실패 시 legacy 에러 표면**:
   - http_request 의 transport 실패 시 `output.response: { error: <message> }` legacy 잔재 — `output.error` 가 있으므로 중복. spec footnote 가 deprecation 의도 명시. (D4 #159 와 별개 — D4 는 throw → port:'error' 통일, 본 항목은 transport-failed envelope 의 잔재 정리)

7. **Runtime 생성 필드의 `config` 위치**:
   - Carousel 의 `config.buttonConfig.buttons` (글로벌 + per-item 합산) 와 `buttonItemMap` 은 handler 가 runtime 생성하지만 `config` 안에 위치 — Principle 7 (config = raw echo) 와 미묘한 위배. frontend 일관 접근 의도가 강해 위치 검토.

> 옛 `output.metadata.*` 패턴 (`ai_agent`) → `meta.*` 마이그레이션, `output.type: 'form'|'carousel'|...` 판별자 폐기, `output.view` 래퍼 폐기, `output.previousOutput` 폐기, Switch `meta.value` deprecated alias 제거 (D4 마이그레이션), deprecated `conversationHistory`/`historyCount` 제거(`6f74333d`/`47a4a059`) 등 1차 초안의 핵심 정리 항목은 모두 spec 본문에 반영 완료.

### §B — 구현 분석 관점 (2026-05-16, D 결정 후 갱신)

1. **`handler.configEcho` ↔ schema 비대칭 (빈출)** ✅ **D1 #145 해소**:
   - ~~schema 에 정의된 raw config 필드 일부를 handler 가 echo 객체에 surface 하지 않는 패턴.~~
   - ~~발견: if-else `strictComparison`, switch `hasDefault`/`strictComparison`, map `errorPolicy`, foreach `errorPolicy`, carousel `maxItems`, chart `dataField`/`groupBy`/`colors`, template `helpers` 등.~~
   - → D1 으로 11개 노드 명시 enumeration baseline 정렬 완료. spec/conventions/node-output.md Principle 7 에 enumeration 의무화 명문화.

2. **AI 노드 에러 컨트랙트 비대칭 (P0)**:
   - **ai-agent 만 `output.error`/`port:'error'` builder 미구현** — `llmService.chat` throw 가 엔진 FAILED 로 전파됨. spec §7.3/§7.9 의 에러 routing 미준수.
   - text-classifier / information-extractor 는 `try/catch + buildErrorOutput` 패턴 구현.
   - 우선순위: P0 — AI 3종 간 에러 처리 비대칭이 다운스트림 노드 흐름에 영향. **D 결정 phase 와 별개 — 별도 plan 필요**.

3. **AI 노드 multi-turn 경로 비대칭 (Principle 8 위반)** ✅ **D6 #157 해소**:
   - ~~waiting/resumed 시 `output.messages` (top-level) vs 종결 시 `output.result.messages` (wrapper inside) 경로 차이.~~
   - ~~text-classifier 의 `output.originalInput` 위치 (정상 inside result / 에러 top-level) 도 같은 비대칭.~~
   - → D6 로 모든 경로 `output.result.*` 단일화 + text-classifier 의 error top-level originalInput 폐기.

4. **AI waiting echo 잔재 (Principle 1.1 위반)** ✅ **D6 #157 부분 해소**:
   - ~~ai-agent / information-extractor 의 waiting `output.message`(단수) / `output.maxTurns` / `output.turnCount` 가 config 와 중복 echo.~~
   - → D6 로 `output.result.{message, maxTurns, turnCount}` 로 wrap 이동. `output.result.*` 자체가 runtime 라이브 스냅샷 namespace 로 정착되어 `config` 직교 위배 우려는 해소.

5. **Container 4종 시작/완료 표현 비대칭** (부분 해소):
   - ✅ **D2 해소** — 시작 시점 output 표현 — Map/ForEach `items[]` 분배 vs Background `null` (Principle 9) 의 표현 통일은 D2 (라안 — handler return 은 엔진-내부 전용이라는 spec footnote) 로 해소.
   - Parallel `meta` 누락 — `durationMs`/`branches` 보강 권고 (다른 컨테이너와 비대칭). **잔여**.
   - ForEach `collectResults` dead field (schema 부재). **잔여**.
   - Parallel `handler.spec.ts` 별도 파일 부재 (schema.spec 에 통합) — 다른 컨테이너와 테스트 구조 비대칭. **잔여**.

6. **Integration 4종 횡단** (부분 해소):
   - `IntegrationHandlerBase` 공통 패턴 (`resolveIntegration`/`logUsage`/`sanitizeMessage`) 4종 정합.
   - ✅ **D4 #159 해소** — ~~`IntegrationError` re-throw vs runtime catch 분기 — HTTP (throw 유지) vs DB/Email/Cafe24 (catch→`port:'error'`) 의도된 비대칭.~~ → D4 로 4종 모두 catch + `port:'error'` 통일. send-email 의 catch-all 패턴이 reference 가 됨.
   - `meta.statusCode` 부여 — HTTP/Cafe24 만 (DB/Email 미보유). `statusCode=0` magic number 도 HTTP/Cafe24 공유. **잔여**.
   - `truncateBodyForOutput` 256KB cap — HTTP requestBody / Email body 공유, DB rows / Cafe24 response 는 cap 없음. **잔여**.

7. **Code 노드 sandbox API 갭** (잔여 P1):
   - `timeout` UI 슬라이더 (30s, 1–120s) spec 에 명시, schema 에 미정의.
   - `$node` / `$helpers` 스펙 약속 vs `buildSandbox` 미주입.
   - `setTimeout`/`setInterval`/`setImmediate` 명시 셰도잉 누락 (vm 격리로 우연 차단).

8. **ConversationThread v2 미구현 (information-extractor)** (잔여 P1):
   - multi-turn push 가 single-turn `out` 만 추가. ai-agent 는 v2 push 구현 — info-extractor 만 비대칭.

9. **HTTP transport 실패 legacy** (잔여):
   - `output.response: { error: <message> }` 잔재 — `output.error` 가 있으므로 중복. spec footnote 가 deprecation 의도 명시했으나 impl 잔존. D4 와 별개로 정리 필요.

10. **Cafe24 §1 pagination cursor 잔재** (잔여):
    - schema 에서 폐기됐지만 spec §1 에 `cursor?: string` 잔재. spec 정정 권고.

11. **Table HTML snapshot 위치 비대칭** ✅ **D5 #153 해소**:
    - ~~Carousel/Chart 는 backend HTML/SVG 생성 폐지 + frontend client-side 렌더 완료, Table 만 `output.rendered` 유지.~~ → D5 로 Table 도 client-side 전환, `output.rendered` 폐기. 3종 일관.

12. **Dead schema 잔재** (잔여):
    - `chartOutputSchema` (`chart.schema.ts:113-118`) 옛 `{type, chartType, ...}` 정의 — 새 spec 본문과 불일치. Principle 1.1.4 위반. import 추적 후 제거 권장.

`spec/conventions/node-output.md` 가 본 분석의 **공식 기준** 이며, 이 인덱스 §"기준 규약" 절에 11 원칙 개요를 인용했다.

## 결정 사항 (2026-05-17)

본 plan 의 §"요약 — 가장 빈번한 부적절 패턴" 에서 도출된 6개 횡단 결정사항에 대한 사용자 결정. 후속 spec/impl 작업의 baseline. **6개 모두 PR 머지 완료** (2026-05-17).

| ID | 상태 | 항목 | 결정 | 영향 노드 |
| --- | --- | --- | --- | --- |
| **D1** | ✅ #145 | handler.configEcho ↔ schema 비대칭 정렬 방향 | **A안 — impl 정렬**: handler 가 schema 의 모든 비민감 raw 필드를 항상 echo. Background 의 명시 enumeration + spread 회피 패턴을 baseline 으로. spec/conventions 에 "Principle 7 의 echo 는 spread 가 아닌 명시 키 enumeration 으로" 1줄 명문화. | if-else, switch, loop, map, foreach, merge, carousel, chart, template, table, variable-modification |
| **D2** | ✅ #148 | Map/ForEach 시작 시점 (§5.1) 표현 모호성 | **라안 — 현 impl 유지 + spec footnote** (2026-05-17 재결정): 코드 확인 결과 핸들러의 `output: items[]` 는 `ForEachExecutor` 가 즉시 envelope 을 overwrite 하여 **외부 노출이 없음**. 따라서 B안 (`output: null` + internal 채널) 적용 시 5필드 invariant (`NodeHandlerOutput`) 변경 비용이 외부 동작 동등성 대비 과도하다 판단. spec common §9.1 + Map/ForEach §5.1·§5.7 에 "핸들러 시작 output 은 엔진-내부 전용, 외부 노출 없음" footnote 추가하여 모호성 해소. impl 변경 없음. | map, foreach |
| **D3** | ✅ #149 | Map `_skipped` 인라인 vs ForEach `output.skipped` 별도 | **A안 — 현 정책 유지**: 시멘틱 차이(변형 배열 vs 항목 독립) 로 의도된 분기. 두 spec 본문에 footnote 로 차이 명시. | map, foreach |
| **D4** | ✅ #159 | Integration 4종 `IntegrationError` 비대칭 처리 | **B안 — 4종 모두 `port:'error'` 로 통일**: HTTP 의 throw 경로를 catch → `buildErrorOutput` + `port:'error'` 로 변경. DB/Email/Cafe24 와 일관. `0-common.md` 와 각 노드 §5.8 갱신. send-email 의 catch-all 패턴을 reference 로 적용. | http-request, database-query, send-email, cafe24 |
| **D5** | ✅ #153 | Table `output.rendered` HTML snapshot 위치 정합 | **B안 — frontend client-side 렌더로 전환**: backend handler 의 HTML rendered 생성 폐지. frontend table component 가 `output.data + config` 로 직접 렌더. Carousel/Chart 와 완전 일관. spec §5 JSON 예시에서 `output.rendered` 제거. | table |
| **D6** | ✅ #157 | AI 3종 multi-turn `messages` 경로 비대칭 | **C안 — waiting 시 `output.result.messages` 로 통합**: ai-agent / information-extractor 의 waiting/resumed 시 top-level `output.messages` 를 `output.result.messages` wrapper 안으로 이동하여 종결 경로와 통일. text-classifier 의 error 시 top-level `output.originalInput` (full) 폐기 — error 케이스는 `output.error.details.originalInput` (truncated) 만 surface. | ai-agent, information-extractor, text-classifier |

### 호환성·breaking 영향

- **Non-breaking (필드 추가형)**: D1, D3 (footnote), D2 (executor 내부 변경 — 외부 expression 영향 없음).
- **Breaking (다운스트림 expression 마이그레이션 필요)**:
  - **D4** — 기존 HTTP `IntegrationError` 가 throw → engine FAILED 로 fail-fast 되던 워크플로가 이제 `error` 포트로 흐름. 사용자 워크플로 동작 변화.
  - **D5** — `$node["T"].output.rendered` 참조 워크플로 깨짐. 다운스트림 마이그레이션 가이드 필요.
  - **D6** — `$node["X"].output.messages` (waiting) 참조 워크플로 영향. `$node["X"].output.result.messages` 로 통합 후 단일 경로.
- **마이그레이션 도구**: D4/D5/D6 변경 시 frontend autocomplete + sample fixture + 노드 spec 의 §5 JSON 예시를 동기 갱신. 필요 시 사용자 워크플로의 expression 분석/안내 도구 별도 검토.

### 처리 순서 (완료 기록)

D1 → D2 → D3 → D4 → D5 → D6 알파벳·숫자 순서로 각 D 별 worktree + PR 분리하여 처리됨 (2026-05-17). 일부 D 는 main 변동이 많아 rebase 후 재push 됨 — 모든 PR 머지 완료.

| ID | PR | worktree | 변경 범위 |
| --- | --- | --- | --- |
| D1 | [#145](https://github.com/worker-ants/clemvion/pull/145) | `node-output-d1-config-echo` | 11개 노드 handler.configEcho 명시 enumeration + spec/conventions/node-output.md Principle 7 명문화 + carousel `maxItems` echo 추가 |
| D2 | [#148](https://github.com/worker-ants/clemvion/pull/148) | `node-output-d2-flow-spec-clarify` (라안 — spec only) | spec/4-nodes/1-logic/0-common.md §9.1 + 7-map.md §5.1·§5.7 + 9-foreach.md §5.1·§5.7 footnote. impl 변경 없음. |
| D3 | [#149](https://github.com/worker-ants/clemvion/pull/149) | `node-output-d3-skipped-footnote` | spec/4-nodes/1-logic/7-map.md + 9-foreach.md 의 errorPolicy 절에 cross-reference footnote (의도된 분기 명문화). impl 변경 없음. |
| D4 | [#159](https://github.com/worker-ants/clemvion/pull/159) | `node-output-d4-integration-port-error` | spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query,3-send-email,4-cafe24}.md + backend integration/{http-request,database-query,cafe24}.handler.ts + 다수 *.spec.ts (11개 throw 케이스 → port:'error' assertion) |
| D5 | [#153](https://github.com/worker-ants/clemvion/pull/153) | `node-output-d5-table-client-render` | spec/4-nodes/6-presentation/2-table.md + backend table.handler.ts (renderHtml/escape helper 폐기) + table.schema.ts + 6+ test 갱신. frontend `TableContent` 가 이미 client-side 렌더 중이라 frontend 변경 0 |
| D6 | [#157](https://github.com/worker-ants/clemvion/pull/157) | `node-output-d6-ai-messages-unified` | spec/4-nodes/3-ai/{1-ai-agent,2-text-classifier,3-information-extractor}.md + backend ai/{ai-agent,information-extractor,text-classifier}.handler.ts + ai-agent.schema.ts + 다수 *.spec.ts. frontend `output-shape.ts` 가 이미 result/legacy dual-path 지원 |

> **P0/P1/P2/P3** 우선순위 항목들 (ai-agent error builder, Workflow async 중복, Code sandbox API, Template XSS 등) 은 본 6개 결정과 **별개로** 각 노드별 결정 필요. §"진행 상태 요약" Phase 2 표 / §"요약 — §B 구현 분석" 참조. 본 phase 가 끝났을 뿐 plan 전체가 끝난 것은 아니다.

## 다음 단계

### Phase D — 횡단 결정 6종 ✅ 완료 (2026-05-17)

§"결정 사항" 의 D1~D6 모두 PR 머지 완료. spec/4-nodes + spec/conventions/node-output.md + backend handler + tests 의 횡단 정렬 종료. handler.configEcho enumeration baseline / Map·ForEach §5.1 표현 / Map·ForEach skipped 패턴 분기 / Integration 4종 IntegrationError → port:'error' / Table client-side 렌더 / AI 3종 `output.result.*` 통일 모두 main 에 반영.

### Phase E — P0/P1 노드별 구현 (다음, `developer` 주도)

D 결정이 다루지 못한 **노드별 구현 갭** 처리. §"진행 상태 요약" Phase 2 표 + §"요약 — §B 구현 분석" 의 남은 항목을 우선순위 순으로 단일 노드 / 단일 PR 로 분할한다.

- **P0** — ai-agent `buildErrorOutput` + `port:'error'` 추가 (`llmService.chat` throw 가 엔진 FAILED 로 전파되는 비대칭). 별도 plan + worktree 필요.
- **P1** — information-extractor ConversationThread v2 multi-turn push (ai-agent 와 패턴 정합), Code 노드 sandbox API (`$node` / `$helpers` 주입 + `timeout` schema).
- **P2** — Parallel `meta.durationMs` / `meta.branches` 보강, ForEach `collectResults` dead field 제거, Chart `chartOutputSchema` dead schema 제거, Cafe24 §1 pagination `cursor?: string` spec 정정.
- **P3** — HTTP transport-failed envelope 의 `output.response: { error }` legacy 잔재 제거, Workflow async `output.workflowId` / `output.status: 'started'` 중복 제거, Merge `meta.strategy` / `meta.outputFormat` config 중복 제거.

각 노드 항목은 `/consistency-check --impl-prep` (developer) 또는 `--spec` (project-planner) 의무 호출 후 진행.

### Phase F — frontend 동반 (`developer`)

§"진행 상태 요약" Phase 2 표의 `(frontend)` 항목은 backend 갱신과 한 PR 로 묶거나 별도 plan 으로 분리한다. 주요 대상: workflow/manual-trigger/merge/background.

### 종료 조건

- 모든 노드의 §"종합 개선안" 체크박스가 `[x]` 처리되거나 폐기 결정.
- §"진행 상태 요약" Phase 1 잔여 권고 표가 0 종, Phase 2 표의 spec/impl/frontend 합계가 0 이 됨.
- 두 조건 충족 시 본 폴더를 `plan/complete/` 로 `git mv`.
