# 신규 식별자 충돌 검토 — `spec/5-system/4-execution-engine.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/5-system/4-execution-engine.md` (전체)

---

## 발견사항

### **[WARNING]** 내부 레이블 `D6` 의 이중 의미 — 동일 코퍼스에서 다른 맥락에 쓰임

- **target 신규 식별자**: `exec-park D6` — `exec-park-durable-resume` plan 결정 레이블로, `Execution.resume_call_stack jsonb`(V087) 영속·중첩 sub-workflow blocking durable 화를 가리킴. `spec/5-system/4-execution-engine.md §7.5`, §6.2, §Rationale "exec-park D6"
- **기존 사용처**: `D6` 레이블이 AI 노드 spec 3개 파일에서 "AI 노드 output 경로 단일화" 결정을 가리키는 단독 레이블로 이미 사용 중
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md:751` — `> **D6 결정**: waiting/resumed 의 messages … 종결 시점 … 단일 경로로 통일`
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/3-information-extractor.md:334,370,386,430` — 동일 결정을 `D6` 로 반복 참조
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/2-text-classifier.md:340,350` — `D6 통일` / `D6 결정` 으로 참조
- **상세**: 두 `D6` 는 서로 다른 결정을 가리키며 범주도 다르다(전자: 실행 엔진 rehydration 인프라 / 후자: AI 노드 output 경로 규약). target 문서 자체가 §7.5 주석에서 "AI 노드 spec의 동명 D6와 무관"임을 명시하고 있으나, 이는 충돌을 인식한 해설이지 충돌 해소가 아니다. 코퍼스를 검색하면 `D6` 단독 키워드로 두 의미가 혼재한다.
- **제안**: exec-park plan 결정 번호 체계(`D1~D6`)와 AI 노드 output 단일화 결정(`D6`)을 구별할 수 있도록 한쪽의 레이블을 바꾼다. 예: exec-park plan 결정은 `EP-D6`(`exec-park D6`) 방식으로 접두사를 붙이거나, AI 노드 output 단일화 `D6`를 해당 스펙 전용 prefix(`AI-D6`) 로 rename. 현재 target 문서는 이미 `exec-park D6` 라는 접두어를 쓰고 있으므로 AI 노드 측 파일(`1-ai-agent.md`, `3-information-extractor.md`, `2-text-classifier.md`)의 단독 `D6` 언급에 `AI-D6` 등 명확한 prefix 추가가 더 적은 범위 변경이다.

---

### **[INFO]** `CHECKPOINT_SCHEMA_VERSION` 과 `CALL_STACK_SCHEMA_VERSION` 상수 — spec 내 유일 정의, 코드 상수명 충돌 없음

- **target 신규 식별자**: `CHECKPOINT_SCHEMA_VERSION`(AI multi-turn checkpoint 버전 가드), `CALL_STACK_SCHEMA_VERSION`(resume_call_stack 버전 가드)
- **기존 사용처**: spec 코퍼스 내 다른 파일에서 동명 상수가 정의된 사례 없음. 코드 상수 충돌 여부는 codebase 검색 필요 (spec만 검토 범위)
- **상세**: 두 상수 모두 동일 파일(`4-execution-engine.md §1.3, §7.5`) 에서만 정의되고, `CALL_STACK_SCHEMA_VERSION` 이 `CHECKPOINT_SCHEMA_VERSION` 과 **독립** 임을 spec 이 명시(§7.5 "checkpoint 와 독립 상수"). spec 수준 충돌은 없다. 구현 시 동일 파일/모듈에 두 상수가 공존할 경우 네이밍 혼동 주의 — prefix 통일(`CHECKPOINT_*`) 또는 명확한 주석 보강을 권장.
- **제안**: 구현 시 `RESUME_CHECKPOINT_SCHEMA_VERSION` / `RESUME_CALL_STACK_SCHEMA_VERSION` 처럼 공통 prefix 로 구분하면 충돌 가능성을 원천 차단할 수 있다. spec 수준에서는 현행 이름도 문맥상 구분 가능.

---

### **[INFO]** `exec-park D4` / `D3` 레이블 — AI 노드 spec 의 `D6` 와 동일 series 인가 여부 불명확

- **target 신규 식별자**: `D4`(turn-단위 park, §4.x, §Rationale), `D3`(fresh-config-per-turn, §6.1, §Rationale)
- **기존 사용처**: spec 코퍼스 검색 결과 `D3`, `D4` 단독 레이블은 AI 노드 spec 에서 발견되지 않음
- **상세**: target 문서가 `exec-park-durable-resume` plan 의 결정 번호 체계로 `D3`~`D6` 를 사용하지만, AI 노드 spec 의 `D6` 가 별도 numbering 임이 확인됐다(위 WARNING). `D4`/`D3` 단독 참조는 target 파일 내부에만 있어 현재 cross-file 충돌은 없다. 그러나 AI 노드 spec 이 향후 `D3`/`D4` 레이블을 독립적으로 정의하면 충돌이 재발한다.
- **제안**: exec-park plan 결정 레이블 전체(`D1~D6`)에 `EP-` 접두사를 붙여 namespace 를 격리하는 것이 장기적으로 안전하다.

---

### **[INFO]** 환경변수 `EXECUTION_RUN_WORKER_CONCURRENCY` — 기존 spec 파일이 이미 참조 중

- **target 신규 식별자**: `EXECUTION_RUN_WORKER_CONCURRENCY`(§4.3, §11)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/16-system-status-api.md:22` 가 동일 env var 를 이미 참조
- **상세**: 충돌이 아닌 **일치** — 두 문서가 동일 env var 를 동일 의미로 참조한다. cross-reference 정합성이 유지되고 있음. 충돌 없음.
- **제안**: 없음.

---

### **[INFO]** 에러 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` — 기존 error-handling spec 과의 일관성

- **target 신규 식별자**: `EXECUTION_TIME_LIMIT_EXCEEDED`(§8, §Rationale "타임아웃")
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md:60` 가 동일 코드를 동일 의미로 이미 정의
- **상세**: 충돌 없음. 두 파일이 동일 에러 코드를 동일 의미로 정의하고 있다. error-handling spec 이 SoT 로 cross-link 유지.
- **제안**: 없음.

---

## 요약

`spec/5-system/4-execution-engine.md` 가 새로 도입하는 식별자(환경변수, 에러 코드, BullMQ 큐 이름, Redis 키 패턴, 인터페이스명)는 기존 spec 코퍼스와 대부분 정합하거나 기존 cross-reference 를 그대로 일치시키는 형태다. 주요 충돌은 내부 레이블 **`D6`** 이 `exec-park-durable-resume` plan 결정(중첩 sub-workflow blocking durable 화)과 AI 노드 output 경로 단일화 결정을 동시에 가리켜 발생하는 이름 중복 하나(WARNING)이다. target 문서 자체가 이를 인지한 해설 주석을 달고 있지만 충돌을 spec 레벨에서 해소하지는 않았다. AI 노드 측 파일의 단독 `D6` 레이블에 명확한 prefix 를 추가하는 것이 최소 변경 권장안이다. 나머지 발견사항은 INFO 수준 일관성 보완 제안이다.

## 위험도

LOW
