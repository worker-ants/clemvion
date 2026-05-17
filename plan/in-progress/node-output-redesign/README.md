# Node 개선안 — 노드별 종합 인덱스

> **3차 확장 (2026-05-16 구현 분석)**: 본 폴더는 28종 노드별 spec ↔ **backend 구현** ↔ 기존 plan 을 모두 비교한 종합 분석 단계로 확장됐다. 모든 노드 plan 파일에 `## 구현 분석 (2026-05-16)` 과 `## 종합 개선안 (2026-05-16)` 두 새 섹션이 추가되었다. 28종 중 **잔여 권고가 1건 이상인 노드 27 / 완전 부합 1**(split). 권고는 `(spec)` · `(impl)` · `(frontend)` 접두로 분류한다. 자세한 단면별 통계는 §"종합 개선안 통계 (2026-05-16)" 표.
>
> **2차 갱신 (2026-05-16 spec 정합)**: 본 폴더의 노드별 plan 들은 1차 초안(2026-04 / commit `e228ec96`) 이후 spec/4-nodes/ 와 spec/conventions/node-output.md 가 여러 차례 개선됐다. 본 갱신에서 (a) 모든 plan 파일 상단에 `최신화 검토 (2026-05-16)` 상태 블록을 추가해 현재 spec 부합 여부와 잔여 권고 항목을 명시했고, (b) 신규 노드 **Cafe24** ([cafe24.md](./cafe24.md)) 를 인덱스·요약 표·잔여 권고 통계에 편입했다. 노드 카운트는 27 → 28 로 변경됐다.

본 plan 폴더는 `spec/4-nodes/` 의 모든 노드 spec 을 검토하여, 각 노드의 `output` 필드 정의가 다음 정의에 부합하는지 진단하고 노드별 개선안을 모은 자료다. 2026-05-16 갱신부터 backend 구현 (`backend/src/nodes/**/*.handler.ts`, `*.schema.ts`, `*.spec.ts`) 정합성도 함께 다룬다.

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

### Phase 1 — spec 본문 정합 관점 (12종 잔여 / 16종 부합)

대부분의 노드 spec 은 conventions 11 Principle 에 부합하도록 정리된 상태다. 28 종 중 잔여 권고 항목이 남은 12종 / 부합 16종 으로 구성된다.

#### 잔여 권고가 있는 노드 (12종)

| 노드 | 잔여 권고 요약 |
| --- | --- |
| [variable-modification](./variable-modification.md) | `config.recordValues` raw echo 추가 |
| [map](./map.md) | §5.1 외부 노출 표현 명확화, `_skipped` 인라인 vs ForEach 별도 패턴 통일 검토 |
| [foreach](./foreach.md) | §5.1 표현 명확화, Map 과 skipped 패턴 통일 검토 |
| [parallel](./parallel.md) | §5.2 (`done`) `meta.durationMs` + `meta.branches` 보강 |
| [merge](./merge.md) | `meta.strategy` / `meta.outputFormat` 의 `config` 중복 제거 검토 |
| [workflow](./11-workflow.md) | Async `output.workflowId` / `output.status: 'started'` 중복 제거 |
| [ai-agent](./ai-agent.md) | waiting/resumed `output.messages` ↔ 종결 `output.result.messages` 경로 통일 검토 |
| [text-classifier](./text-classifier.md) | `output.originalInput` 위치 일관성 (정상 inside `result`, 에러 top-level 분기) |
| [information-extractor](./information-extractor.md) | waiting `output.maxTurns` 제거 (config 중복), `output.message` (단수) 제거 |
| [http-request](./http-request.md) | Transport 실패 시 `output.response: { error }` legacy 잔재 제거 |
| [carousel](./carousel.md) | `config.buttonConfig` (runtime 생성 부분) 위치 검토 (`meta` 이동 또는 표현 명확화) |
| [table](./table.md) | `output.rendered` HTML snapshot 의 위치 (`meta.rendered` 이동 또는 frontend client-side 렌더 전환) — Carousel/Chart 와 일관성 |

#### 부합 (잔여 권고 없음) 노드 (16종)

if-else / switch / loop / variable-declaration / split / filter / background / transform / code / database-query / send-email / cafe24 / chart / form / template / manual-trigger

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

1. **리터럴 config 의 `output` echo 잔재**:
   - 발견: `output.workflowId` (workflow async — `config.workflowId` 와 중복), `output.maxTurns` (information_extractor waiting — `config.maxTurns` 와 중복), `meta.strategy` / `meta.outputFormat` (merge — `config.*` 와 중복).
   - 대부분 spec 본문이 의도적으로 echo 한다고 정당화하지만 Principle 1.1 직교 위반으로 해석됨. 호환성 영향 평가 후 제거 권장.

2. **HTML/SVG snapshot 위치의 카테고리 비대칭**:
   - Carousel / Chart 는 백엔드 HTML/SVG 생성 폐지 + frontend client-side 렌더로 전환 완료.
   - Table 은 `output.rendered` (HTML) 유지 — `meta.rendered` 이동 또는 client-side 전환 검토 (conventions §4.2 footnote 명시).

3. **컨테이너 시작/완료 단계 분리의 표현 모호**:
   - Map / ForEach 의 §5.1 (시작 시점) JSON 예시가 envelope 으로 표시되어 다운스트림이 raw `items[]` 를 볼 수 있다는 오해 가능. spec 표현 명확화 (또는 handler 가 `output: null` 반환 + 별도 internal 필드로 분배) 검토.

4. **컨테이너 노드의 `meta` 누락**:
   - Parallel §5.2 (`done`) 에 `meta` 자체가 빠져 Loop / ForEach / Map 과 일관성 결여. `meta.durationMs` + `meta.branches` 보강 필요.

5. **LLM 계열 wrapper 경로 비대칭**:
   - ai_agent / information_extractor 의 multi-turn 노드에서 waiting/resumed 시 `output.messages` (top-level) vs 종결 시 `output.result.messages` (wrapper inside) 의 경로 차이로 다운스트림 분기 비대칭. 시멘틱 의도(진행 상태 vs 도메인 결과) 가 강해 호환성 영향 평가 후 통일 검토.
   - text_classifier 의 `output.originalInput` 도 정상/에러에서 위치가 달라 유사한 비대칭.

6. **Transport 실패 시 legacy 에러 표면**:
   - http_request 의 transport 실패 시 `output.response: { error: <message> }` legacy 잔재 — `output.error` 가 있으므로 중복. spec footnote 가 deprecation 의도 명시.

7. **Runtime 생성 필드의 `config` 위치**:
   - Carousel 의 `config.buttonConfig.buttons` (글로벌 + per-item 합산) 와 `buttonItemMap` 은 handler 가 runtime 생성하지만 `config` 안에 위치 — Principle 7 (config = raw echo) 와 미묘한 위배. frontend 일관 접근 의도가 강해 위치 검토.

> 옛 `output.metadata.*` 패턴 (`ai_agent`) → `meta.*` 마이그레이션, `output.type: 'form'|'carousel'|...` 판별자 폐기, `output.view` 래퍼 폐기, `output.previousOutput` 폐기, Switch `meta.value` deprecated alias 제거 (D4 마이그레이션), deprecated `conversationHistory`/`historyCount` 제거(`6f74333d`/`47a4a059`) 등 1차 초안의 핵심 정리 항목은 모두 spec 본문에 반영 완료.

### §B — 구현 분석 관점 (2026-05-16)

1. **`handler.configEcho` ↔ schema 비대칭 (빈출)**:
   - schema 에 정의된 raw config 필드 일부를 handler 가 echo 객체에 surface 하지 않는 패턴. Principle 7 ("UI 에서 설정한 비민감 값 항상 echo") 와 미세 불일치.
   - 발견: if-else `strictComparison`, switch `hasDefault`/`strictComparison`, map `errorPolicy`, foreach `errorPolicy`, carousel `maxItems`, chart `dataField`/`groupBy`/`colors`, template `helpers` 등.
   - 처리: spec §5 JSON 예시가 echo 하지 않는다면 "echo 정책 명시" (spec) 또는 "echo 추가" (impl) 중 택일. spec/impl 의 의도 정렬 필요.

2. **AI 노드 에러 컨트랙트 비대칭 (P0)**:
   - **ai-agent 만 `output.error`/`port:'error'` builder 미구현** — `llmService.chat` throw 가 엔진 FAILED 로 전파됨. spec §7.3/§7.9 의 에러 routing 미준수.
   - text-classifier / information-extractor 는 `try/catch + buildErrorOutput` 패턴 구현.
   - 우선순위: P0 — AI 3종 간 에러 처리 비대칭이 다운스트림 노드 흐름에 영향.

3. **AI 노드 multi-turn 경로 비대칭 (Principle 8 위반)**:
   - waiting/resumed 시 `output.messages` (top-level) vs 종결 시 `output.result.messages` (wrapper inside) 경로 차이.
   - ai-agent / information-extractor 양쪽 동일 패턴. text-classifier 의 `output.originalInput` 위치 (정상 inside result / 에러 top-level) 도 같은 비대칭.

4. **AI waiting echo 잔재 (Principle 1.1 위반)**:
   - ai-agent / information-extractor 의 waiting `output.message`(단수) / `output.maxTurns` / `output.turnCount` 가 config 와 중복 echo. 함께 제거 권장.

5. **Container 4종 시작/완료 표현 비대칭**:
   - 시작 시점 output 표현 — Map/ForEach `items[]` 분배 vs Background `null` (Principle 9). 표현 통일 필요.
   - Parallel `meta` 누락 — `durationMs`/`branches` 보강 권고 (다른 컨테이너와 비대칭).
   - ForEach `collectResults` dead field (schema 부재).
   - Parallel `handler.spec.ts` 별도 파일 부재 (schema.spec 에 통합) — 다른 컨테이너와 테스트 구조 비대칭.

6. **Integration 4종 횡단**:
   - `IntegrationHandlerBase` 공통 패턴 (`resolveIntegration`/`logUsage`/`sanitizeMessage`) 4종 정합.
   - `IntegrationError` re-throw vs runtime catch 분기 — HTTP (throw 유지) vs DB/Email/Cafe24 (catch→`port:'error'`) 의도된 비대칭. spec 명시 권장.
   - `meta.statusCode` 부여 — HTTP/Cafe24 만 (DB/Email 미보유). `statusCode=0` magic number 도 HTTP/Cafe24 공유.
   - `truncateBodyForOutput` 256KB cap — HTTP requestBody / Email body 공유, DB rows / Cafe24 response 는 cap 없음.

7. **Code 노드 sandbox API 갭**:
   - `timeout` UI 슬라이더 (30s, 1–120s) spec 에 명시, schema 에 미정의.
   - `$node` / `$helpers` 스펙 약속 vs `buildSandbox` 미주입.
   - `setTimeout`/`setInterval`/`setImmediate` 명시 셰도잉 누락 (vm 격리로 우연 차단).

8. **ConversationThread v2 미구현 (information-extractor)**:
   - multi-turn push 가 single-turn `out` 만 추가. ai-agent 는 v2 push 구현 — info-extractor 만 비대칭.

9. **HTTP transport 실패 legacy**:
   - `output.response: { error: <message> }` 잔재 — `output.error` 가 있으므로 중복. spec footnote 가 deprecation 의도 명시했으나 impl 잔존.

10. **Cafe24 §1 pagination cursor 잔재**:
    - schema 에서 폐기됐지만 spec §1 에 `cursor?: string` 잔재. spec 정정 권고.

11. **Table HTML snapshot 위치 비대칭**:
    - Carousel/Chart 는 backend HTML/SVG 생성 폐지 + frontend client-side 렌더 완료, Table 만 `output.rendered` 유지. `meta.rendered` 이동 또는 client 전환 검토 (1차 분석 §B.2 와 동일).

12. **Dead schema 잔재**:
    - `chartOutputSchema` (`chart.schema.ts:113-118`) 옛 `{type, chartType, ...}` 정의 — 새 spec 본문과 불일치. Principle 1.1.4 위반. import 추적 후 제거 권장.

`spec/conventions/node-output.md` 가 본 분석의 **공식 기준** 이며, 이 인덱스 §"기준 규약" 절에 11 원칙 개요를 인용했다.

## 결정 사항 (2026-05-17)

본 plan 의 §"요약 — 가장 빈번한 부적절 패턴" 에서 도출된 6개 횡단 결정사항에 대한 사용자 결정. 후속 spec/impl 작업의 baseline.

| ID | 항목 | 결정 | 영향 노드 |
| --- | --- | --- | --- |
| **D1** | handler.configEcho ↔ schema 비대칭 정렬 방향 | **A안 — impl 정렬**: handler 가 schema 의 모든 비민감 raw 필드를 항상 echo. Background 의 명시 enumeration + spread 회피 패턴을 baseline 으로. spec/conventions 에 "Principle 7 의 echo 는 spread 가 아닌 명시 키 enumeration 으로" 1줄 명문화. | if-else, switch, loop, map, foreach, merge, carousel, chart, template, table, variable-modification |
| **D2** | Map/ForEach 시작 시점 (§5.1) 표현 모호성 | **라안 — 현 impl 유지 + spec footnote** (2026-05-17 재결정): 코드 확인 결과 핸들러의 `output: items[]` 는 `ForEachExecutor` 가 즉시 envelope 을 overwrite 하여 **외부 노출이 없음**. 따라서 B안 (`output: null` + internal 채널) 적용 시 5필드 invariant (`NodeHandlerOutput`) 변경 비용이 외부 동작 동등성 대비 과도하다 판단. spec common §9.1 + Map/ForEach §5.1·§5.7 에 "핸들러 시작 output 은 엔진-내부 전용, 외부 노출 없음" footnote 추가하여 모호성 해소. impl 변경 없음. | map, foreach |
| **D3** | Map `_skipped` 인라인 vs ForEach `output.skipped` 별도 | **A안 — 현 정책 유지**: 시멘틱 차이(변형 배열 vs 항목 독립) 로 의도된 분기. 두 spec 본문에 footnote 로 차이 명시. | map, foreach |
| **D4** | Integration 4종 `IntegrationError` 비대칭 처리 | **B안 — 4종 모두 `port:'error'` 로 통일**: HTTP 의 throw 경로를 catch → `buildErrorOutput` + `port:'error'` 로 변경. DB/Email/Cafe24 와 일관. `0-common.md` 와 각 노드 §5.8 갱신. | http-request, database-query, send-email, cafe24 |
| **D5** | Table `output.rendered` HTML snapshot 위치 정합 | **B안 — frontend client-side 렌더로 전환**: backend handler 의 HTML rendered 생성 폐지. frontend table component 가 `output.data + config` 로 직접 렌더. Carousel/Chart 와 완전 일관. spec §5 JSON 예시에서 `output.rendered` 제거. | table |
| **D6** | AI 3종 multi-turn `messages` 경로 비대칭 | **C안 — waiting 시 `output.result.messages` 로 통합**: ai-agent / information-extractor 의 waiting/resumed 시 top-level `output.messages` 를 `output.result.messages` wrapper 안으로 이동하여 종결 경로와 통일. text-classifier `output.originalInput` 도 같은 정책 (정상/에러 모두 `output.result.originalInput` 또는 `output.error.details.originalInput`) 으로 정합. | ai-agent, information-extractor, text-classifier |

### 호환성·breaking 영향

- **Non-breaking (필드 추가형)**: D1, D3 (footnote), D2 (executor 내부 변경 — 외부 expression 영향 없음).
- **Breaking (다운스트림 expression 마이그레이션 필요)**:
  - **D4** — 기존 HTTP `IntegrationError` 가 throw → engine FAILED 로 fail-fast 되던 워크플로가 이제 `error` 포트로 흐름. 사용자 워크플로 동작 변화.
  - **D5** — `$node["T"].output.rendered` 참조 워크플로 깨짐. 다운스트림 마이그레이션 가이드 필요.
  - **D6** — `$node["X"].output.messages` (waiting) 참조 워크플로 영향. `$node["X"].output.result.messages` 로 통합 후 단일 경로.
- **마이그레이션 도구**: D4/D5/D6 변경 시 frontend autocomplete + sample fixture + 노드 spec 의 §5 JSON 예시를 동기 갱신. 필요 시 사용자 워크플로의 expression 분석/안내 도구 별도 검토.

### 처리 순서

D1 → D2 → D3 → D4 → D5 → D6 (알파벳·숫자 순서). 각 D 별로 별도 plan 분리 + 별도 PR. 처리 시 worktree 단위:

| ID | 새 worktree | plan 분리 |
| --- | --- | --- |
| D1 | `node-output-d1-config-echo-XXXX` | `plan/in-progress/node-output-d1-config-echo/README.md` |
| D2 | `node-output-d2-flow-spec-clarify` (라안 — spec only) | (별도 plan 분리 불필요 — common §9.1 + Map/ForEach §5.1·§5.7 footnote 만) |
| D3 | `node-output-d3-skipped-footnote-XXXX` | (D1 또는 D2 와 묶어도 무방, footnote 만) |
| D4 | `node-output-d4-integration-port-error` (send-email reference 패턴을 HTTP / DB / cafe24 핸들러에 적용. `handler.validate()` 실패만 throw, `execute()` 안의 모든 IntegrationError 는 catch + `port:'error'`) | spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query,3-send-email,4-cafe24}.md + backend integration/{http-request,database-query,cafe24}.handler.ts + 다수 *.spec.ts |
| D5 | `node-output-d5-table-client-render` (frontend `TableContent` 가 이미 client-side 렌더 중이라 backend 의 `output.rendered` 폐기만 필요) | spec/4-nodes/6-presentation/2-table.md + backend table.handler.ts / table.schema.ts / table.handler.spec.ts / buttons.spec.ts |
| D6 | `node-output-d6-ai-messages-unified` (ai-agent + information-extractor waiting/resumed `output.result.*` 통일, text-classifier 에러 top-level `originalInput` 폐기) | spec/4-nodes/3-ai/{1-ai-agent.md,2-text-classifier.md,3-information-extractor.md} + backend ai/{ai-agent,information-extractor,text-classifier}.handler.ts + ai-agent.schema.ts + 다수 *.spec.ts |

각 작업은 `developer` skill 진입 시 `/consistency-check --impl-prep` 의무 호출, `project-planner` 작업 시 `/consistency-check --spec` 의무 호출.

> **P0/P1/P2/P3** 우선순위 항목들 (ai-agent error builder, Workflow async 중복, Code sandbox API, Template XSS 등) 은 본 결정사항과 별개로 §"진행 상태 요약" Phase 2 표를 보고 각 노드별 결정 필요. 본 6개 결정은 횡단 정책에 한정.

## 다음 단계

본 plan 폴더의 권고는 두 단면 (spec 본문 / 구현) 으로 분리되어 있으므로 처리 phase 도 분리한다.

### Phase A — spec 본문 갱신 (`project-planner`)

1. 사용자/리뷰어가 §"진행 상태 요약" Phase 1 표 (잔여 권고 12종) 의 spec 권고와 Phase 2 표의 `(spec)` 항목을 검토하여 동의/수정 사항을 적는다.
2. 합의된 spec 권고를 토대로 **`project-planner` 가 `spec/4-nodes/**.md` 를 갱신**한다.
   - 진입 시 `/consistency-check --spec` 의무 호출.
   - 우선순위: ai-agent 에러 컨트랙트 명시 → workflow async 중복 제거 → handler.configEcho 정책 명시.

### Phase B — 구현 갱신 (`developer`)

1. spec 갱신과 동시에 또는 그 직후, §"진행 상태 요약" Phase 2 표의 `(impl)` 항목을 별도 plan 으로 분리해 **`developer` 가 backend handler / schema / tests 를 갱신**한다.
   - 진입 시 `/consistency-check --impl-prep` 의무 호출.
   - **P0**: ai-agent `buildErrorOutput` + `port:'error'` 추가.
   - **P1**: information-extractor ConversationThread v2 multi-turn push, Code 노드 sandbox API (`$node`/`$helpers`/`timeout` schema).
   - **P2**: handler.configEcho ↔ schema 비대칭 (각 노드 일괄), HTTP transport legacy `output.response.error` 제거, Chart `chartOutputSchema` dead schema 제거.

### Phase C — frontend 동반 (`developer`)

§"진행 상태 요약" Phase 2 표의 `(frontend)` 항목은 backend 갱신과 한 PR 로 묶거나 별도 plan 으로 분리한다. 주요 대상: workflow/manual-trigger/merge/background.

### 종료 조건

- 모든 노드의 §"종합 개선안" 체크박스가 `[x]` 처리되거나 폐기 결정.
- §"진행 상태 요약" Phase 1 잔여 권고 표가 0 종, Phase 2 표의 spec/impl/frontend 합계가 0 이 됨.
- 두 조건 충족 시 본 폴더를 `plan/complete/` 로 `git mv`.
