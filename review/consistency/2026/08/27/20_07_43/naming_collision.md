STATUS=success naming_collision review complete — CRITICAL:0 WARNING:0 INFO:0
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `spec/5-system/` (eia-misc-hygiene, impl-done)

## 조사 방법

prompt 에 번들된 target 문서(`spec/5-system/14-external-interaction-api.md` 전문 + 관련 spec 발췌)는
누적된 EIA 기능 spec 전체(2026-06 이후 수십 PR 에 걸쳐 쌓인 것)라 대부분의 요구사항 ID·DTO명·
endpoint·이벤트명은 **이번 라운드에서 신규 도입된 것이 아니다**. impl-done 모드의 실제 검토 대상은
`origin/main` 대비 **이번 브랜치(`eia-misc-hygiene`)가 도입한 델타**이므로, 절대경로 워크트리에서
`git diff origin/main...HEAD` 로 실측한 변경분을 기준으로 신규 식별자를 추출해 충돌을 조사했다.

**실측 결과**: `spec/5-system/` 범위의 변경은 `spec/5-system/14-external-interaction-api.md` 단
1줄(frontmatter `code:` 경로 오타 수정)뿐이다. 요구사항 ID·엔티티명·API endpoint·이벤트명·
ENV/설정키·spec 파일 경로 중 이번 라운드가 새로 부여한 것은 없다 — 전부 기존 spec 을 그대로
가리키는 문구 정정이거나 코드 리팩터다. 실질적으로 "신규 식별자"에 해당하는 것은 코드 레벨
리네임/신설 4건뿐이며, 아래에서 각각 충돌 여부를 실측했다.

## 신규/변경 식별자별 충돌 조사

### 1. 파일 경로 이동 — `node-output-allowlist.ts`

- `codebase/backend/src/shared/utils/node-output-allowlist.ts` → `codebase/backend/src/nodes/core/node-output-allowlist.ts`
- `git -C <worktree>` 확인: 목적지 디렉토리(`nodes/core/`)에 동명 파일이 기존에 없었다(신규
  배치). 이동 후 옛 경로 참조는 spec·codebase 전체에서 **0건**(실측 grep) — spec frontmatter
  (`14-external-interaction-api.md` code: 리스트)와 본문 참조(`spec/conventions/node-output.md`)
  둘 다 새 경로로 동반 갱신됨. 충돌 없음.

### 2. 함수 리네임 — `redactNodeExecutionRow` → `redactNodeExecutionRowForResponse`

- `codebase/backend/src/shared/utils/redact-stored-error.ts` 정의, 호출부
  `executions.service.ts` 등 전량 동반 갱신. 새 이름이 기존에 다른 의미로 쓰이고 있었는지
  grep 확인 — 정의·호출부 3파일 외 참조 0건. 자매 함수 `redactStoredFieldsForResponse` 와
  명명 패턴(`…ForResponse`)이 일치해 오히려 기존 컨벤션에 정합. 충돌 없음.

### 3. 신규 파일 — `codebase/backend/src/shared/testing/swagger-probe.ts`

- export: `SwaggerSchemaObject`(타입), `buildSwaggerDocument`·`schemasOf`·`schemaOf`·`propertyOf`(함수).
- 전 저장소 grep 결과 위 5개 식별자 모두 이 신규 파일과 그 소비처(4개 `*.spec.ts`, 전부 이번
  브랜치에서 이 헬퍼로 전환된 기존 테스트) 외 사용처 **0건** — 기존에 다른 의미로 쓰이던
  동명 식별자 없음.
- `src/shared/testing/**` 디렉토리 자체도 신규이며, 어떤 spec 의 `code:` frontmatter 도 이
  경로를 소유하고 있지 않다(테스트 전용 인프라라 spec-linked 대상이 아닌 것은 `repo-guards/**`
  선례와 동일 패턴). `tsconfig.build.json` exclude 배열에도 중복 항목 없이 신규 1줄만 추가.
  충돌 없음.

### 4. JSDoc 주석 정정 — `interaction.guard.ts`

- `[Spec EIA §3.3 EIA-AU-08 + §3.3.1 EIA-AU-09]` → `[Spec EIA §3.3 EIA-AU-08 + §3.3.1]`.
  이는 신규 식별자 도입이 아니라 **실재하지 않는 ID(`EIA-AU-09`) 참조를 제거**한 것이다
  (spec 본문에 `EIA-AU-09` 는 애초에 정의된 적이 없다 — §3.3 요구사항 표는 `EIA-AU-01`~`08` 까지).
  저장소 전체 재검색 결과 `EIA-AU-09` 참조 **0건**(spec·code 공통) — 오기 해소 완료, 충돌 대상
  자체가 소멸. 해당 없음.

### 5. 테스트 `describe` 블록 분리 — `nodeOutput allowlist · fanout 파이프라인 불변식`

- `websocket.service.spec.ts` 내부 조직 변경(기존 `llmCalls strip` 블록에서 allowlist 캐너리
  8건을 형제 블록으로 분리). 요구사항 ID·API·이벤트·ENV 키가 아닌 테스트 스위트 내부 라벨이라
  본 체크리스트의 6개 관점 어디에도 해당하지 않으며, 동일 파일 내 중복 이름도 없다(실측: 파일
  내 해당 문자열 1회 등장). 해당 없음.

## 발견사항

없음 — 이번 라운드가 도입한 신규 식별자 4건(경로 이동 1 · 함수 리네임 1 · 신규 헬퍼 모듈의
export 4개 · tsconfig exclude 1줄) 모두 기존 사용처와 충돌하지 않는다. 요구사항 ID·엔티티명·
API endpoint·이벤트명·ENV 변수·spec 파일 경로 축에서는 이번 라운드가 새로 부여한 것이 전무하다
(전량 리팩터/오타 정정).

## 요약

`eia-misc-hygiene` 브랜치가 `spec/5-system/` 범위에서 실제로 바꾼 것은 frontmatter 경로 오타
수정 1줄뿐이고, 동반된 코드 변경(파일 이동·함수 리네임·신규 테스트 헬퍼 모듈·JSDoc 오기 제거)도
모두 순수 위생 작업이다. 새로 도입된 식별자들(`nodes/core/node-output-allowlist.ts` 경로,
`redactNodeExecutionRowForResponse`, `swagger-probe.ts` 의 `buildSwaggerDocument`/`schemasOf`/
`schemaOf`/`propertyOf`/`SwaggerSchemaObject`)을 전 저장소 기준으로 실측 grep 한 결과 기존
사용처와 의미 충돌이 있는 사례는 없었으며, 오히려 옛 경로·옛 함수명의 잔존 참조도 0건으로
완전히 정리됐다. 신규 식별자 충돌 관점에서 이번 target 변경분은 위험이 없다.

## 위험도

NONE
