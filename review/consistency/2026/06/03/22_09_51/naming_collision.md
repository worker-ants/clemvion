# 신규 식별자 충돌 분석

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/, diff-base=origin/main)

## 발견사항

### 1. 엔티티/타입명 — `id: nodes-overview` 신규 도입, pre-existing `id: common` 중복은 무변화

- **[INFO]** `spec/4-nodes/0-overview.md` 에 frontmatter `id: nodes-overview` 가 새로 추가됨
  - target 신규 식별자: `nodes-overview`
  - 기존 사용처: 해당 ID 를 사용하는 spec 파일이 `spec/` 트리 내에 존재하지 않음 (확인됨 — 충돌 없음)
  - 상세: spec-impl-evidence 가드는 `id:` 중복을 파일 경로 기준이 아닌 값 기준으로 평가한다. `nodes-overview` 는 기존에 없던 신규 값이므로 충돌하지 않는다.
  - 제안: 이 ID 가 `spec-frontmatter.test.ts` 의 `collectApplicableSpecs` 범위에 포함되는지 확인 권장 (해당 파일이 `spec/4-nodes/0-overview.md` 를 가드 대상으로 포함하는 경우).

---

### 2. 표현식 변수명 — `$itemIsFirst` / `$itemIsLast` 도입, `$loop.isFirst` 와 명명 근접

- **[INFO]** `spec/4-nodes/1-logic/9-foreach.md` 및 `spec/5-system/5-expression-language.md`, `spec/5-system/4-execution-engine.md` 에 `$itemIsFirst` / `$itemIsLast` 추가
  - target 신규 식별자: `$itemIsFirst`, `$itemIsLast`
  - 기존 사용처: Loop 컨테이너는 `$loop` 객체 하위에 `$loop.isFirst`/`$loop.isLast` (루프 전용 객체 속성, `/spec/4-nodes/1-logic/3-loop.md`)를 두고, ForEach 는 `$item`, `$itemIndex` top-level 변수를 사용 중이었음
  - 상세: `$itemIsFirst` 는 Loop 의 `$loop.isFirst` 와 이름이 근접하나, **네임스페이스가 다르다** — `$loop.isFirst` 는 loop 객체의 속성, `$itemIsFirst` 는 독립 top-level 변수. ForEach 컨텍스트에서만 inject 되고 Loop 컨텍스트에서는 inject 되지 않으므로 런타임 충돌은 없다. Spec Rationale R-1 이 이 대안을 명시적으로 기각한 것도 확인됨.
  - 제안: spec 본문 (특히 `5-expression-language.md §4` 변수 표) 에 두 변수가 **ForEach 컨텍스트에서만** 주입됨을 명시적으로 구분 표기하면 독자 혼동이 줄어든다. `1-node-common.md §4.1` 자동완성 표도 동기 업데이트 필요 여부 확인 권장.

---

### 3. config 키 — `config.errorHandling` nested 구조 도입, 기존 `config.errorPolicy` flat 키와 공존

- **[WARNING]** `spec/3-workflow-editor/1-node-common.md §2.4` 에 `config.errorHandling = { policy, retryConfig?, defaultOutput? }` nested 구조가 공식 계약으로 명시됨
  - target 신규 식별자: `config.errorHandling` (nested), `config.errorHandling.policy`, `config.errorHandling.retryConfig`, `config.errorHandling.defaultOutput`
  - 기존 사용처:
    - `spec/4-nodes/1-logic/10-parallel.md` 에서 `config.errorPolicy` flat 키를 **parallel-specific 필드**로 사용하며, "공통 `errorHandling.policy` 와 별개" 라고 명시적으로 기술됨 (line 28)
    - `spec/4-nodes/1-logic/7-map.md` 다수 위치에서 `config.errorPolicy` (`stop`/`skip`/`continue`) 로 컨테이너 에러 정책을 정의
    - `spec/4-nodes/1-logic/9-foreach.md` 에서도 `config.errorPolicy` 사용
  - 상세: `config.errorPolicy` (컨테이너 노드 — Map/ForEach/Parallel 전용, `stop`/`skip`/`continue` 3값) 와 `config.errorHandling.policy` (범용 노드 에러 처리 — 5값: `stop_workflow`/`skip_node`/`use_default_output`/`retry`/`route_to_error_port`) 는 **다른 노드 레이어의 별개 식별자**로 의도적으로 분리된 구조다. `1-node-common.md §2.4` 의 신규 단락("config 저장 형태")과 `3-error-handling.md` 의 신규 cross-ref 가 이를 처음으로 명시적으로 정의했다. 두 키가 같은 노드 config JSONB 내에 존재할 때 독자(개발자)가 혼동할 위험이 있다.
  - 제안: `spec/4-nodes/1-logic/0-common.md §4-에러-정책-errorpolicy` 또는 `spec/4-nodes/0-overview.md` 에 "컨테이너 전용 `config.errorPolicy` 와 범용 `config.errorHandling.policy` 는 별개의 레이어이며 동일 노드에서 동시 사용되지 않는다" 는 명시적 구분 설명을 추가하면 혼동을 방지할 수 있다.

---

### 4. 캔버스 요약 포맷 — Template/Code/Database Query/Send Email 기존 기술과 불일치

- **[WARNING]** target spec 이 canvas 요약 포맷을 변경했으나, `spec/3-workflow-editor/0-canvas.md` 는 미갱신 상태
  - target 신규 식별자: (포맷 변경)
    - Code: `{{language|upper}}` (기존 `{language} · {N} lines`)
    - Template: `{{outputFormat}} · {{buttons.length}} buttons` (기존 `{format} · {N} lines`)
    - Database Query: `{{queryType|upper}} · {{query}}` (기존 `{queryType} · {쿼리 첫줄}`)
    - Send Email: `{{to.length}} recipients · {{subject}}` (기존 `to: {수신자}`)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/spec/3-workflow-editor/0-canvas.md:405` — `Code: {language} · {N} lines`
    - `/Volumes/project/private/clemvion/spec/3-workflow-editor/0-canvas.md:410` — `Template: {format} · {N} lines`
    - `spec/4-nodes/4-integration/0-common.md:98` (main) — Database Query `{queryType} · {쿼리 첫 줄}` (Planned 표기)
    - `spec/4-nodes/4-integration/0-common.md:99` (main) — Send Email `to: {수신자} +N` (Planned 표기)
  - 상세: target 에서 위 4개 노드의 `summaryTemplate` 포맷이 "구현됨"으로 전환됐으나, `spec/3-workflow-editor/0-canvas.md §5.3.4` 의 캔버스 요약 전체 목록 표는 여전히 옛 Planned 포맷을 기술 중이다. 이는 내부 cross-spec 불일치이나, 본 분석의 명명 충돌 관점에서는 "동일 포맷 식별자가 두 곳에서 다른 값으로 기술되는" 식별자 충돌에 해당한다.
  - 제안: `spec/3-workflow-editor/0-canvas.md §5.3.4` 표를 target spec 의 갱신된 포맷으로 동기화해야 한다. 본 diff 에서 `canvas.md` 는 변경되지 않았다.

---

### 5. spec 파일 식별자 — `id: common` 중복 (pre-existing, 본 diff 무변화)

- **[INFO]** `spec/4-nodes/{1-logic,2-flow,3-ai,4-integration,5-data,7-trigger}/0-common.md` 6개 파일이 모두 `id: common` 을 사용
  - target 신규 식별자: 없음 (본 diff 가 새로 추가한 것은 아님)
  - 기존 사용처: 위 6개 파일 모두 `id: common` — 이미 main 에 존재하는 pre-existing 상태
  - 상세: target diff 는 `spec/4-nodes/5-data/0-common.md` 의 `status` 를 `partial→implemented` 로 변경했으나 `id: common` 자체는 건드리지 않았다. 따라서 본 diff 가 새로 충돌을 도입한 것은 아니다. pre-existing 이슈.
  - 제안: 본 diff scope 밖. 별도 정리 트랙 권장.

---

## 요약

target diff (`spec/3-workflow-editor/1-node-common.md`, `spec/4-nodes/0-overview.md`, `spec/4-nodes/1-logic/9-foreach.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/4-integration/2-database-query.md`, `spec/4-nodes/4-integration/3-send-email.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/6-presentation/5-template.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/5-expression-language.md`, `spec/5-system/8-embedding-pipeline.md`) 가 도입하는 신규 식별자 중 실질적 충돌은 발견되지 않는다. `$itemIsFirst`/`$itemIsLast` 는 `$loop.isFirst` 와 이름이 근접하나 네임스페이스가 명확히 분리돼 런타임 충돌이 없고, `nodes-overview` ID 는 기존 spec 트리에서 사용된 바 없다. 다만 두 가지 주의 항목이 있다: (1) `config.errorHandling.policy` 와 `config.errorPolicy` 는 이름이 유사하고 동일 JSONB config 컬럼을 공유하는 별개 레이어 식별자로, spec 내 명시적 구분 설명이 아직 단편화돼 있어 개발자 혼동 위험이 있다. (2) 캔버스 요약 포맷이 target spec 에서 변경됐으나 `spec/3-workflow-editor/0-canvas.md` 의 전체 목록 표는 미갱신 상태이므로 동일 포맷 식별자가 두 문서에서 다른 값으로 기술되는 cross-spec 불일치가 존재한다.

## 위험도

MEDIUM
