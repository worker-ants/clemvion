# 정식 규약 준수 검토 — `spec/4-nodes` (--impl-prep, M-5 노드 DI 레이어1)

검토 대상: 구현 착수 전 (`--impl-prep`, scope=`spec/4-nodes`).
작업 맥락: `plan/in-progress/refactor-m5-node-di-layer1.md` — 노드 등록을 `ALL_NODE_COMPONENTS` 정적 배열 → NestJS multi-provider DI 로 전환 (레이어1, behavior-preserving).
관점: 정식 규약(`spec/conventions/**`) 준수 — 명명·출력 포맷·문서 구조·API 문서·금지 항목.

---

## 발견사항

### [CRITICAL] 동적 포트 ID 네이밍 — logic `0-common.md §7` 이 정식 규약(`node-output.md Principle 6`)·overview §1.3 과 모순 (UUID v4 vs slug)

- target 위치:
  - `spec/4-nodes/1-logic/0-common.md §7` (line 140) — "동적 포트: 생성 시 **UUID v4** 를 할당. … 기존 포트 ID는 불변."
  - 대비: `spec/4-nodes/0-overview.md §1.3` (line 121) — "동적 포트: config 항목이 보유한 **stable slug id** 를 포트 ID 로 사용 … slug 는 `^[a-zA-Z0-9_-]{1,64}$` … 인덱스 기반 fallback(`case_0`, `branch_1`) … (**UUID v4 는 사용하지 않는다**.)"
- 위반 규약: `spec/conventions/node-output.md` **Principle 6 — 동적 포트 ID 네이밍**. 규약은 동적 생성 포트를 `<prefix>_<index>` (`class_0`/`branch_0`) 또는 글로벌/per-item 버튼은 `config.buttons[i].id` / `${buttonId}__item_${index}` 로 규정한다. **UUID v4 는 규약 어디에도 없다.**
- 상세: overview §1.3 와 코드(`port-id.util.ts`, `resolve-dynamic-ports.ts`, `10-parallel.md §3.2` 의 `branch_<index>` "Principle 6 의 `<prefix>_<index>` 규칙" 인용)는 모두 slug/index 모델로 정합한다. 그러나 logic `0-common.md §7` 만 "UUID v4 할당" 이라는 옛 모델 문구가 잔존한다 — 정식 규약과 직접 충돌하며, 같은 폴더 상위 문서(overview)와도 정면 모순. 동적 포트 ID 모델은 "다른 시스템(frontend resolver·엔진 라우팅·edge 보존)이 가정한 invariant" 의 핵심이므로 CRITICAL.
- 제안: **target 수정** — `0-common.md §7` 의 "생성 시 UUID v4 를 할당" 을 overview §1.3 / Principle 6 와 동일한 slug-id(`^[a-zA-Z0-9_-]{1,64}$`, 형식 위반 시 `<prefix>_<index>` fallback, "UUID v4 사용 안 함") 문구로 교체. planner 위임 사항이며 본 DI 리팩터 PR 의 직접 blast-radius 밖이지만, `--impl-prep` 단계에서 spec drift 로 명시 기록되어야 한다. (규약 갱신 불요 — Principle 6 가 올바르고 §7 이 stale.)

### [WARNING] §1.0 / §4 등록 메커니즘 기술이 "정적 배열" 로 고정 — DI 전환 후 갱신 필요 (이미 plan 추적 중)

- target 위치:
  - `spec/4-nodes/0-overview.md §1.0` (line 55) — "`NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)`을 호출하고, … 그 배열을 순회하며 …"
  - `spec/4-nodes/0-overview.md §4` (line 244) — "`nodes/index.ts` 의 `ALL_NODE_COMPONENTS` **정적 배열**로 부팅 시 부트스트랩 … 런타임 플러그인/마켓플레이스 로딩 경로는 존재하지 않는다."
- 위반 규약: 정식 규약(`spec/conventions/**`) 직접 위반 아님 — `spec/conventions/` 에는 DI/모듈/multi-provider 구조를 규정한 규약 파일이 **없다** (grep 확인: 어떤 conventions 파일도 `multi: true`·InjectionToken·NestJS 모듈 구조를 정의하지 않음). 본 항목은 "구현 후 spec 본문 약속과 코드의 정합" 관점의 사전 경고다.
- 상세: 레이어1 리팩터는 `bootstrap(ALL_NODE_COMPONENTS, deps)` → `@Inject(NODE_COMPONENT) components[]` 주입으로 교체한다(plan D-1). 전환 후 위 두 문장은 "정적 배열 순회" 가 아니라 "DI 부팅 등록(multi-provider)" 이 되므로 본문 기술이 코드와 어긋난다. plan 체크리스트(line 33)가 이를 명시적으로 planner 위임 항목으로 잡고 있어(`"정적 배열"→"DI 부팅 등록"`, "런타임 로딩 경로 없음" 제한 유지, Rationale 번복 아님) **이미 추적 중**이다.
- 제안: 갱신 시 (1) §4 의 "마켓플레이스/동적 노드 로딩 = 미구현(Planned)" invariant 는 **유지**(DI 전환은 런타임 플러그인 경로를 열지 않는 behavior-preserving 변경), (2) §1.0 의 `NodeComponentRegistry.bootstrap(...)` 호출 계약 문장은 "lifecycle 진입점이 `@Inject(NODE_COMPONENT)` 주입 집합을 bootstrap 으로 전달" 로 정밀화. `node-bootstrap.service.ts` 의 기존 docstring 이 "spec §1.0 의 등록 계약은 그대로 유지 — lifecycle 진입점일 뿐" 이라 적시하므로 동일 톤으로 맞추면 정합.

### [INFO] DI 토큰·per-category 모듈 명명은 기존 코드베이스 컨벤션과 정합 (규약 위반 없음)

- target 위치: plan `refactor-m5-node-di-layer1.md` D-1/D-2/D-3 (신규 `NODE_COMPONENT` 토큰, `{ provide: NODE_COMPONENT, useValue, multi: true }`, per-category Nest 모듈).
- 위반 규약: 없음. 확인 결과:
  - **DI 토큰 명명**: 기존 선례 `WORKFLOW_EXECUTOR = 'WORKFLOW_EXECUTOR'` (`nodes/core/workflow-executor.interface.ts:84`, 문자열 토큰·UPPER_SNAKE·interface 파일 co-locate, `execution-engine.module.ts:133` 에서 `provide: WORKFLOW_EXECUTOR`). 계획된 `NODE_COMPONENT` 가 이 패턴을 정확히 답습 — 일관성 양호.
  - **파일 명명**: overview §1.0 트리의 `<category>/<type>/<type>.{schema,component,handler}.ts` 컨벤션과 per-category 모듈 추가는 충돌 없음. 신규 `<category>/<category>.module.ts` 류 파일이 생길 경우 NestJS 표준 `*.module.ts` 접미사를 따르면 됨(기존 `nodes.module.ts` 와 동형).
- 상세: 정식 규약(`spec/conventions/**`)이 DI/모듈 토폴로지를 규정하지 않으므로 "규약 위반" 으로 등급화할 항목이 없다. 코드베이스 내부 관례(token/module 명명)만 적용되며 계획안이 이를 준수한다.
- 제안: 신규 토큰을 `nodes/core/node-component.interface.ts` (또는 동급 core interface 파일)에 `export const NODE_COMPONENT = 'NODE_COMPONENT'` 로 co-locate 해 `WORKFLOW_EXECUTOR` 선례와 동일 위치 규칙을 유지. (규약 갱신 불요.)

### [INFO] 출력 포맷 규약(`node-output.md`) 준수 — 번들된 logic 문서는 정합

- target 위치: `1-logic/0-common.md §5·§9·§9.1`, `1-if-else.md §5`, `10-parallel.md §5`, `11-merge.md §5`, `12-background.md §5`.
- 위반 규약: 없음 — `spec/conventions/node-output.md` 와 정합 확인:
  - 5필드 invariant `{ config, output, meta?, port?, status? }` (Principle 0) — 각 문서 §5 헤더가 "5필드 외 top-level 키 금지" 명시.
  - 컨테이너 엔진 오버라이트 `{ <컬렉션>, count }` (Principle 9.2) — `0-common §9.1` 표 + `10-parallel §5.2/§5.7` 정합. `count` 복원 Rationale(2026-06-03 결정 B)도 규약·코드와 일치.
  - 에러 컨트랙트(Principle 3.1 pre-flight throw vs runtime `port:'error'`) — if_else/parallel/merge/background §6 모두 준수.
  - config echo(Principle 7) — merge `§4-5` / background `§5.1` 의 `rawConfig` 명시 echo·credential strip 정합.
  - `port` 활성화 모델(Principle 5) — parallel handler `string[]` fan-out → engine `'done'` 단일 문자열 정합.
- 상세/제안: 조치 불요. DI 리팩터는 핸들러 출력 컨트랙트를 건드리지 않으므로(behavior-preserving) 본 정합성은 리팩터 후에도 유지되어야 한다.

### [INFO] 문서 구조·API 문서 규약 — 준수

- 문서 구조: 번들된 문서 모두 frontmatter(`id`/`status`/`code`) + `> 관련 문서` 링크 + 본문 + (parallel/background) `## Rationale` 3섹션 권장 구조 준수. `0-` prefix(`0-overview.md`/`0-common.md`)·`_product-overview.md` 참조 컨벤션 정합.
- API 문서 규약: overview §1.0 `GET /api/nodes/definitions`, background §8.1 `GET /api/executions/:executionId/background-runs/:backgroundRunId` 는 `spec/conventions/swagger.md` 의 endpoint/DTO 패턴(REST 명사·중첩 path·UUID param)과 충돌 없음. DI 리팩터는 이 엔드포인트 표면을 바꾸지 않음(`listDefinitions()` 계약 유지).
- 금지 항목: conventions 가 명시 금지한 패턴(`output.view` 판별자, `output.metadata.*`, `port` 를 포트 ID 외 용도 사용 등)을 번들 문서가 답습하지 않음.

---

## 요약

본 검토 대상인 M-5 노드 DI 레이어1 리팩터(정적 배열 → multi-provider DI)는 **정식 규약(`spec/conventions/**`) 을 직접 위반하지 않는다** — `spec/conventions/` 에 DI·모듈·multi-provider 토폴로지를 규정한 규약 자체가 없고, 계획된 `NODE_COMPONENT` 토큰·per-category 모듈 명명은 기존 코드베이스 선례(`WORKFLOW_EXECUTOR` 문자열 토큰, `*.module.ts`)를 정확히 답습한다. 번들된 logic 출력 포맷 문서(if_else/parallel/merge/background)는 `node-output.md` 의 5필드 invariant·컨테이너 오버라이트(Principle 9.2)·에러 컨트랙트·config echo 와 모두 정합한다. 다만 `--impl-prep` 관점에서 두 가지 사전 처리 사항이 있다: (1) **CRITICAL** — logic `0-common.md §7` 의 동적 포트 "UUID v4 할당" 문구가 정식 규약 `node-output.md Principle 6`(`<prefix>_<index>`/slug 모델) 및 같은 영역 overview §1.3("UUID v4 사용 안 함")과 정면 모순하는 stale drift(리팩터 blast-radius 밖이나 영역 내 규약 위반이므로 명시); (2) **WARNING** — overview §1.0/§4 의 "정적 배열 순회" 기술이 DI 전환 후 코드와 어긋나게 되며, 이는 plan 체크리스트가 이미 planner 위임으로 추적 중이다(규약 위반 아님). 두 항목 모두 DI 핸들러 출력 컨트랙트와 무관하므로 리팩터의 behavior-preserving 성격을 위협하지 않는다.

## 위험도

LOW

(DI 리팩터 자체는 규약 위반 0. CRITICAL 등급 발견은 리팩터가 건드리지 않는 영역의 pre-existing spec drift 이며, 정식 규약 준수 관점에서 영역 내 위반이라 등급은 CRITICAL 로 표기했으나 본 작업의 차단 사유는 아니다 — planner 정정 위임으로 처리. WARNING 은 plan 이 이미 추적. 따라서 본 검토 작업 단위의 종합 위험도는 LOW.)
