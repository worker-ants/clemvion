# 정식 규약 준수 검토 — spec-draft-webchat-i18n-scope.md

검토 모드: spec draft 검토 (--spec)
target: `plan/in-progress/spec-draft-webchat-i18n-scope.md`

방법: `spec/conventions/i18n-userguide.md`, `spec/7-channel-web-chat/{_product-overview,2-sdk,5-admin-console,1-widget-app,3-auth-session}.md`,
`spec/conventions/spec-impl-evidence.md`, `.claude/config/doc-sync-matrix.json`,
`codebase/frontend/src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` 등 실제 저장소 파일을 직접 Read 하여
draft 의 사실 주장(스캔 스코프·frontmatter 예외·anchor slug·기존 R-numbering)을 1차 검증했다.

## 발견사항

### [WARNING] Edit C 가 제안하는 신설 `### R6.` 헤딩이 2-sdk.md 안의 기존 미연결 `§R6` 참조와 충돌

- target 위치: draft `### Edit C — spec/7-channel-web-chat/2-sdk.md §4` — `Rationale ### R6. locale 은 reserved(삭제 대신 정직화) 추가`
- 위반 규약: 명문화된 `spec/conventions/*.md` 항목은 없음 — `spec/7-channel-web-chat/**` 전역에서 일관되게 관찰되는 **비-정식(암묵) R-numbering 관례**(같은 파일 안 bare `§RN` = 그 파일 로컬 Rationale, 다른 파일 참조는 항상 `[<file> §RN](<path>)` 형태로 파일명 접두 + 링크)에 대한 저촉. CLAUDE.md 의 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 원칙이 전제하는 "Rationale 항목은 그 문서 안에서 유일하게 식별된다"는 기대와도 어긋난다.
- 상세: `spec/7-channel-web-chat/2-sdk.md:108` 는 이미 `"eager-start 가드 §R6·세션 복원"` 이라는 **파일명 접두·링크 없는 bare 참조**를 갖고 있다. 실제로 "eager-start" 는 `2-sdk.md` 자신의 Rationale 이 아니라 **`1-widget-app.md` 의 `### R6. 워크플로우 시작 — 패널 open 시(eager)`** 를 가리키는 것으로 확인된다(`1-widget-app.md:19,34,36,69,73`에서 동일 "eager-start §R6" 가 자기 문서 로컬 참조로 반복 사용됨). 같은 `2-sdk.md` 안의 line 102 는 동일한 종류의 타 문서 참조를 `[3-auth-session §R6](./3-auth-session.md)` 로 **정확히 파일명+링크를 붙여** 쓴다 — 즉 line 108 은 기존에도 스타일 일탈(파일 prefix 누락)이던 잠재적 오독 소지였다. Edit C 가 `2-sdk.md` 자체에 새 로컬 `### R6.` (locale reserved) 헤딩을 만들면, 이 잠재적 오독이 **실제로 잘못 resolve** 된다 — 파일-로컬 관례상 bare `§R6` 는 이제 "같은 문서의 R6" 로 읽히게 되고, 그 R6 는 eager-start 와 무관한 "locale reserved" 항목이 된다. `spec-link-integrity` 류 자동 가드는 이 bare 텍스트를 markdown link 로 파싱하지 않으므로 build 는 통과하지만, 사람이 읽을 때 실제 의미가 어긋난다.
- 제안: Edit C 의 신규 Rationale 번호를 `R6` 대신 **`R7`**(현재 파일의 다음 미사용 번호)로 바꾸거나, 같은 PR 에서 `2-sdk.md:108` 의 `§R6` 를 `[1-widget-app §R6](./1-widget-app.md)` 로 명시 링크화해 모호성을 먼저 제거한 뒤 새 로컬 R6 를 쓴다. 후자가 부수적으로 기존 결함도 해소한다.

### [INFO] Edit A "적용 대상" 문구에서 `backend-labels.ts` 소속 표기가 모호

- target 위치: draft `### Edit A` — `**적용 대상**: codebase/frontend/**(메인 앱 + 운영 콘솔 + 사용자 가이드) · codebase/backend/**(영문 SoT / backend-labels).`
- 위반 규약: 없음(경미한 표현 정확도) — `spec/conventions/i18n-userguide.md` Principle 3 은 `backend-labels.ts` 를 `codebase/frontend/src/lib/i18n/backend-labels.ts` (frontend 소재)로 명시한다.
- 상세: `codebase/backend/**` 괄호 뒤에 "backend-labels" 를 나란히 적으면, 그 파일이 backend 쪽에 있다고 오독될 소지가 있다. 실제로는 backend 가 영문 SoT 문자열을 발행하고, backend-labels.ts(frontend) 가 그 매핑을 갖는 구조다.
- 제안: `codebase/backend/**(영문 SoT 발행)` 로 축약하거나, `→ codebase/frontend/.../backend-labels.ts 가 매핑` 을 별도로 덧붙여 소재 혼동을 없앤다. 차단 사유는 아니다.

### [INFO] 신설 "적용 범위 (Scope)" 절이 i18n-userguide.md 말미의 "자동 가드 요약" 표에 행으로 반영되지 않음

- target 위치: draft `### Edit A`
- 위반 규약: 없음 — `i18n-userguide.md` 의 "자동 가드 요약" 표는 `Principle 1~7` 각각의 자동 가드 위치를 나열하는데, 신설 절은 Principle 이 아니라 전역 스코프 선언이라 표 대상은 아니다.
- 상세: draft 자체가 "본 절은 기존 enforcement 현실의 명문화이지 가드 변경이 아니다" 라고 명시하므로 표 갱신 의무는 없다고 판단되나, 표에 "적용 범위" 한 줄(가드 종류: 없음/문서화)을 추가하면 독자가 요약 표만 보고도 스코프 예외를 파악할 수 있어 가독성이 좋아진다.
- 제안: 선택 사항. 필수 아님.

### [INFO] Edit B 의 i18n-userguide 링크가 신설 절 anchor 를 지정하지 않음

- target 위치: draft `### Edit B` — `[i18n-userguide 적용 범위](../conventions/i18n-userguide.md)`
- 위반 규약: 없음
- 상세: 문서 전체 링크라 동작은 하지만, Edit A 가 신설하는 `## 적용 범위 (Scope)` 절의 정확한 anchor(`#적용-범위-scope`, github-slugger 기준)를 지정하면 더 정밀하다.
- 제안: 선택 사항.

## 검증된 사실(위반 아님 — draft 주장이 실측과 일치)

다음은 draft 가 근거로 제시한 사실 주장을 실제 저장소 상태와 직접 대조해 확인한 것으로, 규약 위반이 아니라 **draft 의 정확성을 뒷받침**하는 기록이다.

- `hardcoded-korean-ratchet.test.ts` 의 `SCAN_ROOTS = ["components", "app", "lib"]` (frontend/src 기준) — `channel-web-chat` 미포함, draft 주장과 일치.
- `.claude/config/doc-sync-matrix.json` 의 `new-ui-string` 행 `trigger.globs = ["codebase/frontend/src/**/*.tsx"]` — `codebase/channel-web-chat/**` 미매칭, draft 주장과 일치.
- `spec/conventions/spec-impl-evidence.md §1` 의 제외 목록에 `spec/<영역>/_*.md`(`_product-overview.md` 포함)가 명시돼 있어, Edit B 대상 파일이 frontmatter 의무 없이 편집 가능하다는 draft 의 암묵적 전제가 맞음. Edit C(`2-sdk.md`)·Edit D(`5-admin-console.md`) 는 이미 `id`/`status`/`code` frontmatter 를 보유하고 있고 draft 는 새 코드 경로를 추가하지 않으므로 frontmatter 갱신 불요 — 이 판단도 정확.
- anchor `#2-목표--비목표`(`_product-overview.md`), `#4-boot-config-스키마`(`2-sdk.md`) — 두 anchor 모두 실제 heading slug(github-slugger 기준, 후자는 저장소 내 기존 링크로 이미 검증됨)와 일치.
- draft 의 `Edit D` 가 가리키는 `5-admin-console.md §4:117-118`, `§6.1:214` 라인 참조는 실제 파일 라인과 정확히 일치.
- `plan/in-progress/spec-draft-webchat-i18n-scope.md` 파일명은 `project-planner/SKILL.md` §작업 워크플로 3 의 `plan/in-progress/spec-draft-<name>.md` 명명 컨벤션과 일치. frontmatter 3필드(`worktree`/`started`/`owner`) 모두 존재해 `plan-lifecycle.md` §2 필수 스키마 충족.
- 신설 Rationale 서브헤딩 `### 왜 channel-web-chat 위젯은 dict-indirection 스코프 밖인가`(Edit A) 는 `i18n-userguide.md` 기존 Rationale 의 `### 왜 ...는가` 패턴과 일치.

## 요약

target draft 는 실제 코드/스펙 상태(스캔 루트, doc-sync-matrix glob, frontmatter 예외, 기존 anchor)를 정확히 조사해 반영했고, 4개 Edit 모두 대상 파일의 기존 섹션 번호·헤딩 스타일·불릿 포맷·Rationale 서브헤딩 패턴을 그대로 따르고 있어 명명·구조 규약 준수 수준이 높다. 유일하게 실질적인 문제는 Edit C 가 `spec/7-channel-web-chat/2-sdk.md` 에 새로 붙이려는 `### R6.` 번호가, 같은 파일 안에 이미 존재하는 미연결(파일명 접두 없는) `§R6` bare 참조(실제로는 `1-widget-app.md` 의 R6 를 가리킴)와 충돌해 오독을 유발할 수 있다는 점이다 — 이는 어떤 `spec/conventions/*.md` 파일에도 명문화된 규칙은 아니지만, 해당 스펙 영역 전체가 일관되게 지켜온 비정식 관례를 깨뜨리므로 WARNING 으로 표시했다. 그 외 발견은 표현 정밀도 수준의 INFO 뿐이며 자동 가드(`spec-link-integrity`, `spec-frontmatter` 계열)를 깨뜨리는 항목은 없다.

## 위험도

LOW
