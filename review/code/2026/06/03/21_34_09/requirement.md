# 요구사항(Requirement) 리뷰 결과

## 발견사항

---

### [SPEC-DRIFT][WARNING] `$itemIsFirst` / `$itemIsLast` 구현 — spec §3.3 미갱신

- **위치**: `expression-resolver.service.ts` (파일 2), `evaluator.ts` (파일 25), `expression-constants.ts` (파일 20), `expression-resolver.service.spec.ts` (파일 1)
- **상세**: 코드 구현은 명확히 의도된 결정(plan 파일 `spec-sync-foreach-gaps.md` §재분류 옵션 (a) 선택)이다. `$itemIsFirst` / `$itemIsLast` 를 `ExpressionContext` 인터페이스(`evaluator.ts`)와 `buildExpressionContext`(`expression-resolver.service.ts`), `ROOT_VARIABLES`(`expression-constants.ts`) 세 곳에 일관성 있게 추가했다. 그러나 `spec/4-nodes/1-logic/9-foreach.md` §3.3 "실행 컨텍스트 변수"는 여전히 `$item`, `$itemIndex` 두 변수만 나열하고 `$itemIsFirst`/`$itemIsLast` 는 "Planned" 상태(`$item.isFirst` 형태)로만 언급하고 있다. `spec/5-system/5-expression-language.md` §4 의 변수 목록에도 이 두 변수가 없다. 코드는 올바르며 되돌리면 안 된다 — spec 두 곳 갱신 누락이 문제다.
- **제안**: 코드 유지 + 아래 spec 갱신 필요:
  - `spec/4-nodes/1-logic/9-foreach.md` §3.3 표에 `$itemIsFirst` / `$itemIsLast` 행 추가 (Planned → 구현됨으로 변경), "Planned" 주석 제거.
  - `spec/5-system/5-expression-language.md` §4 맥락에서 ForEach 컨텍스트 변수 목록(`$item`, `$itemIndex`)에 두 변수 추가.
  - `spec/4-nodes/1-logic/9-foreach.md` frontmatter `pending_plans` 에서 foreach-gaps 항목 제거(또는 resolved 마킹).

---

### [SPEC-DRIFT][WARNING] `spec/5-system/8-embedding-pipeline.md` §6.1 metadata 구현 완료 — spec 미갱신

- **위치**: 파일 4(`text-chunker.ts`), 파일 6(`embedding.service.ts`), 파일 8(`md.parser.ts`), 파일 9(`parser.factory.ts`), 파일 11(`pdf.parser.ts`)
- **상세**: `spec/5-system/8-embedding-pipeline.md` §6.1 의 `metadata` 필드 설명이 여전히 **"현재 항상 빈 `{}` 로 INSERT (page/section 채우는 파서 경로 미구현, Planned)"** 로 남아 있다. 코드는 이미 `parseDocumentSegments` 를 통해 md=section, pdf=page 메타데이터를 채우는 경로를 구현 완료했으며(plan/complete/spec-sync-embedding-pipeline-gaps.md §6.1 처리 결과 참조), 구현이 의도적이고 올바르다. spec §6.1 표 행과 frontmatter `pending_plans` 가 구현 이전 상태를 유지하고 있다.
- **제안**: 코드 유지 + 아래 spec 갱신 필요:
  - `spec/5-system/8-embedding-pipeline.md` §6.1 `metadata` 행 설명을 구현 완료 상태로 교체 (`md: { section }`, `pdf: { page }`, `txt/csv: {}`).
  - frontmatter `pending_plans: plan/in-progress/spec-sync-embedding-pipeline-gaps.md` 제거(이미 complete로 이동됨).
  - spec §2 "파이프라인 흐름" 내 "파일 파싱" → "텍스트 청킹" 사이의 흐름 기술이 segment 단위 경로를 반영하도록 선택적 업데이트 검토.

---

### [SPEC-DRIFT][WARNING] `spec/3-workflow-editor/1-node-common.md` §2.4/§2.5 — 에러 핸들링 UI 구현 완료 미반영

- **위치**: 파일 22(`node-settings-panel.tsx`), 파일 21(`node-settings-panel-error-handling.test.tsx`), 파일 23/24(i18n 사전)
- **상세**: `spec/3-workflow-editor/1-node-common.md` §2.4 는 `Retry maxRetries/retryInterval 입력 UI 는 **미구현 (Planned)**`, §2.5.1 은 **"기본값 설정 UI (미구현 — Planned)"** 로 명시되어 있다. 코드는 두 기능을 모두 구현했으며(policy=retry 시 maxRetries/retryInterval 입력 필드, policy=use_default_output 시 JSON 에디터+유효성검증+Reset 버튼), config shape 도 flat `errorPolicy` 에서 nested `errorHandling.{policy, retryConfig?, defaultOutput?}` 로 전환했다. 이는 plan/complete/spec-sync-node-common-gaps.md §재분류 결정 이후의 의도적 구현이다. spec §2.4/§2.5.1 의 "Planned" 표기와 구현부재 서술이 stale하다.
- **제안**: 코드 유지 + 아래 spec 갱신 필요:
  - `spec/3-workflow-editor/1-node-common.md` §2.4 Retry 행: "미구현 (Planned)" → 구현됨으로 변경.
  - §2.5.1 제목 `"(미구현 — Planned)"` 제거, 구현된 UI 서술로 교체.
  - spec 에 `config.errorHandling` nested shape 과 policy vocabulary (`stop_workflow`, `skip_node`, `use_default_output`, `retry`, `route_to_error_port`) 를 명시. 레거시 `errorPolicy` 마이그레이션 규칙 추가.

---

### [SPEC-DRIFT][WARNING] `spec/4-nodes/5-data/0-common.md` §3 Code 노드 캔버스 요약 — 결정 반영 미완

- **위치**: 파일 13(`code.schema.ts`), 파일 12(`code.schema.spec.ts`)
- **상세**: `spec/4-nodes/5-data/0-common.md` §3 Code 행은 `{language} · {N} lines` 포맷을 **"미구현 (Planned)"** 으로 기술하고 있다. 코드는 `summaryTemplate: { template: '{{language|upper}}' }` 를 구현했다 — plan/complete/spec-sync-data-common-gaps.md §재분류에 따르면 DSL 이 줄 세기/title-case 를 미지원하므로 downscope 방향으로 결정된 것이다. spec §3 의 Code 행이 결정된 실제 포맷(`JAVASCRIPT`, upper-case only)을 반영하지 않고 있다.
- **제안**: 코드 유지 + `spec/4-nodes/5-data/0-common.md` §3 Code 행을 구현된 `{{language|upper}}` 출력(`JAVASCRIPT`) 으로 업데이트. "미구현 (Planned)" 제거.

---

### [SPEC-DRIFT][WARNING] `spec/4-nodes/6-presentation/5-template.md` §7 캔버스 요약 — 결정 반영 미완

- **위치**: 파일 19(`template.schema.ts`), 파일 18(`template.schema.spec.ts`)
- **상세**: `spec/4-nodes/6-presentation/5-template.md` §7 "버튼 없음" 행은 `{outputFormat} · {N} lines` 포맷을 기술한다. 코드는 `summaryTemplate: { template: '{{outputFormat}} · {{buttons.length}} buttons' }` 를 구현했다(plan/complete/spec-sync-template-gaps.md §재분류 결정). spec §7 의 "버튼 없음" 행(`html · 9 lines`)이 구현된 동작(`html · 2 buttons`)과 일치하지 않는다.
- **제안**: 코드 유지 + `spec/4-nodes/6-presentation/5-template.md` §7 표를 구현된 `{{outputFormat}} · {{buttons.length}} buttons` 포맷으로 업데이트. "버튼 없음" / "버튼 있음" 분기 대신 단일 포맷으로 통일.

---

### [WARNING] `node-settings-panel.tsx` — `use_default_output` 정책에서 빈 JSON 처리 시 `null` 저장

- **위치**: 파일 22 (`node-settings-panel.tsx`), diff 의 `errorHandling.defaultOutput` 계산 경로
- **상세**: `defaultOutputText.trim()` 가 falsy 일 때(빈 문자열 또는 공백만) `defaultOutput` 값으로 `null` 을 저장한다(`JSON.parse` 를 건너뛰고 `null`). 그러나 초기값은 `"{}"` 로 세팅되어 있고 Reset 버튼도 `"{}"` 로 돌아가므로 실제로 빈 문자열 경로에 도달하는 시나리오는 사용자가 내용을 모두 지운 경우다. `spec/3-workflow-editor/1-node-common.md` §2.5.2 에서 미지정 시 기본값은 타입별 기본값(`{}`, `[]`, `""` 등)이고, 사용자 미설정 시 `null` 이 아닌 타입 기본값 적용을 명시한다. UI 에서 에디터를 비우면 `null` 이 저장되는 것은 spec §2.5.2 의 타입별 기본값 자동 적용 규칙과 충돌한다. 저장 시 유효성 검사(`JSON.parse`)를 건너뛰므로 의도치 않은 `null` 이 `defaultOutput` 에 저장될 수 있다.
- **제안**: `defaultOutputText.trim()` falsy 일 때 `null` 대신 저장을 막거나(`setDefaultOutputError` 호출) 기본값 `'{}'` 로 폴백하도록 수정. 또는 해당 케이스를 명시적으로 `{}` (빈 객체 기본값)으로 처리.

---

### [WARNING] `parsePdfSegments` — 빈 페이지 텍스트 segments 포함

- **위치**: 파일 11 (`pdf.parser.ts`)
- **상세**: `parsePdfSegments` 는 `pagerender` 콜백이 반환한 텍스트를 `pages.push(text)` 하고, 빈 문자열(`""`)인 경우에도 `{ text: '', metadata: { page: N } }` 세그먼트를 생성한다. `embedding.service.ts` 는 `chunkText(segment.text, ...)` 를 호출하는데, `chunkText` 내부에서 `text.trim()` 가 falsy 이면 `[]` 를 반환하므로 해당 페이지 청크는 실제로 생성되지 않는다. 기능 동작은 올바르나 빈 페이지 텍스트 segment 를 명시적으로 필터링하지 않아 `parsePdfSegments` 반환 배열에 빈 텍스트 항목이 포함되고, 이 점이 테스트에서 검증되지 않았다. 대용량 스캔 PDF(이미지만 있는 페이지 다수)에서는 무의미한 루프가 발생할 수 있다.
- **제안**: `parsePdfSegments` 에서 `pages` push 전 `text.trim()` 가 비어 있으면 skip 하거나(`if (text.trim()) pages.push(...)`), `map` 이후 `filter(s => s.text.trim())` 를 추가하는 것을 권장.

---

### [INFO] `node-settings-panel.tsx` — `backoffMultiplier` 값 하드코딩

- **위치**: 파일 22 (`node-settings-panel.tsx`)
- **상세**: retry config 저장 시 `backoffMultiplier: 2` 로 하드코딩한다. `spec/5-system/3-error-handling.md` §3.3 에서 `backoffMultiplier` 기본값은 `2.0` 이고 UI 에서 노출한다는 명시는 없다. 현재 구현에서 사용자가 backoffMultiplier 를 변경할 UI 는 없으므로 기본값(`2`)을 고정하는 것은 spec 과 일치한다. 단, 향후 UI 확장 시 상수화 필요.

---

### [INFO] `spec/4-nodes/6-presentation/5-template.md` §7 — database-query/send-email summaryTemplate spec 대응 없음

- **위치**: 파일 14(`database-query.schema.spec.ts`), 파일 15(`database-query.schema.ts`), 파일 16(`send-email.schema.spec.ts`), 파일 17(`send-email.schema.ts`)
- **상세**: `databaseQueryNodeMetadata.summaryTemplate` (`{{queryType|upper}} · {{query}}`)와 `sendEmailNodeMetadata.summaryTemplate` (`{{to.length}} recipients · {{subject}}`)는 spec 대응 문서가 없거나 추적된 plan 이 없다. spec/4-nodes/integration 영역의 해당 노드 spec 에서 캔버스 요약 절이 정의돼 있지 않거나 아직 작성 안 된 경우다. 기능 구현 자체는 올바르며 동작한다.

---

## 요약

전반적으로 코드 변경은 의도한 기능을 완전히 구현하고 있으며 비즈니스 로직도 올바르다. 5개의 spec-drift 발견사항이 있는데, 이는 코드 구현이 계획된 방향(plan/complete 파일들의 결정)을 정확히 따랐으나 대응 spec 문서가 아직 갱신되지 않아 발생한 것이다: foreach §3.3의 `$itemIsFirst`/`$itemIsLast` 미반영, embedding-pipeline §6.1의 "미구현" 서술 유지, node-common §2.4/§2.5의 "Planned" 표기 잔존, data/0-common §3 Code 요약 포맷 미업데이트, template §7 요약 포맷 미업데이트. 코드 로직 관점에서는 `use_default_output` 정책에서 사용자가 JSON 에디터를 비울 때 `null` 이 저장되는 점이 spec §2.5.2의 타입별 기본값 규칙과 충돌하며, `parsePdfSegments` 에서 빈 페이지 텍스트 필터링이 누락된 점도 개선이 필요하다.

## 위험도

MEDIUM

---
STATUS: SUCCESS
