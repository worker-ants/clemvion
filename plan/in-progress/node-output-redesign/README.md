# Node Output 재설계 — 노드별 개선안 인덱스

> **최신화 검토 (2026-05-16)**: 본 폴더의 노드별 plan 들은 1차 초안(2026-04 / commit `e228ec96`) 이후 spec/4-nodes/ 와 spec/conventions/node-output.md 가 여러 차례 개선됐다. 본 갱신에서 (a) 모든 plan 파일 상단에 `최신화 검토 (2026-05-16)` 상태 블록을 추가해 현재 spec 부합 여부와 잔여 권고 항목을 명시했고, (b) 신규 노드 **Cafe24** ([cafe24.md](./cafe24.md)) 를 인덱스·요약 표·잔여 권고 통계에 편입했다. 노드 카운트는 27 → 28 로 변경됐다.

본 plan 폴더는 `spec/4-nodes/` 의 모든 노드 spec 을 검토하여, 각 노드의 `output` 필드 정의가 다음 정의에 부합하는지 진단하고 노드별 개선안을 모은 1차 초안이다.

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

각 노드 plan 파일은 다음 구성을 따른다:

1. **최신화 검토 블록** (2026-05-16 추가) — 현 spec 과의 정합 여부, 잔여 권고 항목 요약
2. **현재 output (spec 인용)** — `spec/4-nodes/.../<node>.md` 의 §5 (출력 구조) 절 인용
3. **진단** — 각 항목·필드가 위 정의 ("단계마다 채워지는 field") 와 conventions 11 원칙에 부합하는가
4. **개선안 — 정리된 output** — 단계별로 채워지는 데이터만 남긴 정리안 (가능하면 case 별 그룹)
5. **분리 제안** — `output` 에서 빠질 항목의 새 위치 (`config` / `meta` / 본문 metadata 등)
6. **Rationale** — 분류 근거 + 폐기된 대안

> 본 작업이 spec 본문에 즉시 반영되는 것은 **아니다**. plan 검토 → 합의 → 별도 phase 에서 `project-planner` 가 spec 본문을 갱신한다 (developer/agent 는 spec 쓰기 권한 없음).

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

대부분의 노드 spec 은 conventions 11 Principle 에 부합하도록 정리된 상태다. 28 종 중 잔여 권고 항목이 남은 12종 / 부합 16종 으로 구성된다.

### 잔여 권고가 있는 노드 (12종)

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

### 부합 (잔여 권고 없음) 노드 (16종)

if-else / switch / loop / variable-declaration / split / filter / background / transform / code / database-query / send-email / cafe24 / chart / form / template / manual-trigger

## 요약 — 가장 빈번한 부적절 패턴 (2026-05-16 갱신)

본 분석에서 반복적으로 검출된 패턴 (전체 plan 의 누적 통계):

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

`spec/conventions/node-output.md` 가 본 분석의 **공식 기준** 이며, 이 인덱스 §"기준 규약" 절에 11 원칙 개요를 인용했다.

## 다음 단계

1. 사용자/리뷰어가 본 폴더의 plan 파일들을 검토하여 위 §"잔여 권고가 있는 노드" 표의 12종 권고 항목에 동의/수정 사항을 적는다.
2. 합의된 개선안을 토대로 별도 phase 에서 **`project-planner` 가 `spec/` 본문을 갱신**한다 (본 plan 은 spec 변경 권한이 없는 developer/agent 가 작성한 진단 — `project-planner` 가 진입 시 `/consistency-check --spec` 의무 호출).
3. spec 본문 갱신과 동시에 backend handler / frontend resolver 의 마이그레이션이 필요하면 추가 plan 으로 분리한다.
4. 모든 노드의 spec 갱신이 완료되고 §"잔여 권고가 있는 노드" 표가 0 이 되면 본 폴더를 `plan/complete/` 로 `git mv`.
