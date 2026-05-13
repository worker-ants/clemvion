# Node Output 재설계 — 노드별 개선안 인덱스

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

각 노드 plan 파일은 다음 4 항목으로 구성된다:

1. **현재 output (spec 인용)** — `spec/4-nodes/.../<node>.md` 의 §5 (출력 구조) 절을 인용
2. **진단** — 각 항목·필드가 위 정의 ("단계마다 채워지는 field") 와 conventions 11 원칙에 부합하는가
3. **개선안 — 정리된 output** — 단계별로 채워지는 데이터만 남긴 정리안 (가능하면 case 별 그룹)
4. **분리 제안** — `output` 에서 빠질 항목의 새 위치 (`config` / `meta` / 본문 metadata 등)
5. **Rationale** — 분류 근거 + 폐기된 대안

> 본 작업이 spec 본문에 즉시 반영되는 것은 **아니다**. plan 검토 → 합의 → 별도 phase 에서 `project-planner` 가 spec 본문을 갱신한다 (developer/agent 는 spec 쓰기 권한 없음).

## 노드 목록 (총 27 개)

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
| Workflow (Sub-Workflow) | 호출 (sync/async) | [workflow.md](./workflow.md) |

### 3. AI 노드 (3 종)

| 노드 | 카테고리 | plan 파일 |
| --- | --- | --- |
| AI Agent | LLM (single/multi turn, blocking) | [ai-agent.md](./ai-agent.md) |
| Text Classifier | LLM (분류, 동적 포트) | [text-classifier.md](./text-classifier.md) |
| Information Extractor | LLM (추출, single/multi turn, blocking) | [information-extractor.md](./information-extractor.md) |

### 4. Integration 노드 (3 종)

| 노드 | 카테고리 | plan 파일 |
| --- | --- | --- |
| HTTP Request | external (success/error) | [http-request.md](./http-request.md) |
| Database Query | external (success/error) | [database-query.md](./database-query.md) |
| Send Email | external (success/error) | [send-email.md](./send-email.md) |

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

## 요약 — 가장 빈번한 부적절 패턴

본 분석에서 반복적으로 검출된 패턴 (전체 plan 의 누적 통계):

1. **리터럴 config 의 `output` echo** — `output.fields` / `output.title` / `output.chartType` / `output.layout` / `output.maxTurns` 등 사용자가 UI 로 정의한 값을 `output` 으로 복사하던 옛 패턴이 일부 spec 에는 명시적으로 폐기 마킹되어 있고, 일부는 잔재 (예: AI Agent 의 `output.metadata.*` 가 `meta.*` 로 이동된 history). 새 spec 본문은 대체로 정리되어 있으나 일관성 점검 필요.
2. **노드 타입 판별자 (`output.type` / `output.view`)** — Presentation 노드 4종(Carousel/Table/Chart/Template) 에 옛 `output.type: 'carousel'|'table'|...` 과 `output.view` 래퍼가 폐기되어야 함을 spec 이 명시. 본 plan 은 frontend / 데이터 마이그레이션 가드 (DB 잔존 값 처리) 까지 추가 점검.
3. **부분 결과 / 에러의 병존 컨트랙트 모호** — AI 카테고리 multi-turn (`ai_agent`, `information_extractor`) 에서 `output.error` + `output.result` 병존 케이스가 있고 이를 다운스트림이 어떻게 분기해야 하는지(`output.error` 존재 여부로 판정) spec 이 명시하나, 일부 노드(예: HTTP Request 의 `output.response` + `output.error` 병존) 와의 일관성 점검 필요.

`spec/conventions/node-output.md` 가 본 분석의 **공식 기준** 이며, 이 인덱스 §"기준 규약" 절에 11 원칙 개요를 인용했다.

## 다음 단계

1. 사용자/리뷰어가 본 폴더의 plan 파일들을 검토하여 노드별 개선안에 동의/수정 사항을 적는다.
2. 합의된 개선안을 토대로 별도 phase 에서 **`project-planner` 가 `spec/` 본문을 갱신**한다 (본 plan 은 spec 변경 권한이 없는 developer/agent 가 작성한 1차 초안).
3. spec 본문 갱신과 동시에 backend handler / frontend resolver 의 마이그레이션이 필요하면 추가 plan 으로 분리한다.
4. 모든 노드의 spec 갱신이 완료되고 후속 항목이 0 이 되면 본 폴더를 `plan/complete/` 로 `git mv`.
