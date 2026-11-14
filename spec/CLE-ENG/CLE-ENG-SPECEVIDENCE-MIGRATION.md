---
id: "CLE-ENG-SPECEVIDENCE-MIGRATION"
title: "스펙과 구현 근거 규약 — NERV 이전 영향과 걷은 결정"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ENG-SPECEVIDENCE"
ancestors: ["CLE-VISION", "CLE-ENG", "CLE-ENG-SPECEVIDENCE"]
area: "CLE-ENG"
content_hash: "6693422f5bc73db936c4d4e6cfe0c1d1cf58952b64641f4949c5380d91c43345"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "f49e0545d058dc490cf4e48424d8096830ecd3fac568d41c324528bf0acd89e2"
etag: "sha256-c859e42e3cadb0c5643e3e21b8749c77603e176108c7d8f587cdb9b40947c7d0"
---
## 개요

이 문서는 [스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) 의 하위 문서로 스펙을 NERV 로 옮기며 바뀐 전제와 전환 단계 3 · 5 에서 걷은 규칙 · 가드의 결정 요약을 정한다. 현행 규칙(18 ~ 22)과 그 근거(R-1 · R-16)는 부모 문서에 있다.
Rationale 번호는 분리 전 번호를 그대로 쓴다. 이 문서에 없는 R-1 · R-16 은 부모에, R-9 · R-12 · R-14 · R-15 는 [스펙 문서 저장소 무결성 가드](CLE-ENG-SPECEVIDENCE-INTEGRITY.md) 에 있다.

## NERV 이전 영향

이 규약의 옛 규칙은 스펙이 저장소 `spec/**.md` 파일이고 가드가 그 파일을 읽는 프론트엔드 단위 테스트라는 전제 위에 있었다. 작업 추적이 `plan/**` 파일이라는 전제는 전환 단계 3 에서 NERV Task 로 바뀌었다. 스펙이 NERV 로 옮겨지면서(전환 단계 1) 아래 전제가 바뀌었다. 전환 단계 5 에서 옛 트리를 지웠고 저장소 `spec/` 에는 미러만 남았다. 이 절은 바뀐 전제만 적는다. 바뀐 전제에 맞춘 규칙은 부모 문서의 규칙 19 ~ 22 다.

| 규칙 | 옛 전제 | NERV 에서 바뀐 점 |
| --- | --- | --- |
| 적용 대상(경로 포함 목록·basename 제외) | 스펙을 저장소 경로와 파일 이름으로 식별했다 | NERV 문서는 키(`CLE-…`)·종류(`vision`·`area`·`feature`·`design`·`convention` 등)·트리의 부모로 식별한다. 경로와 basename 이 없다. 전환 단계 5 에서 경로 포함 목록과 basename 제외를 옛 트리와 함께 걷었다. 지금 적용 대상은 미러 문서 가운데 `## 구현 위치` 절이 있는 문서다([적용 대상](CLE-ENG-SPECEVIDENCE.md#적용-대상)) |
| frontmatter `id` | basename 기반 kebab-case | NERV 문서 키가 식별자다. NERV 로 옮긴 문서 본문에는 frontmatter 가 없다. 저장소 미러 파일 맨 위의 frontmatter 는 `pull.py` 가 쓴 메타이고 본문이 아니다. 그 `status` 는 문서 상태다(`spec/README.md`). 옛 트리 frontmatter 는 전환 단계 5 에서 옛 트리와 함께 걷었다 |
| 옛 스펙 상태 `status`(5 값) | 구현 단계를 뜻했다 | NERV 문서 상태(`doc_status`: `draft`·`in_review`·`approved`)는 문서 승인 단계다. 이번 이전에서 구현 단계는 본문 머리 줄의 "구현 상태"(구현됨·부분 구현·미구현 세 값)로 옮겼고 `feature` 문서의 요구사항 줄에는 `(미구현)`·`(부분 구현)` 표시를 붙였다. `backlog` 와 `spec-only` 의 구분, `archived` 에 해당하는 값은 머리 줄에 없다. 옛 트리의 `status` 는 전환 단계 5 에서 옛 트리와 함께 걷었다 |
| `code:` 와 `spec-code-paths` 가드 | frontmatter 글로브가 파일에 매치하는지 빌드가 검사했다 | 이번 이전에서 `code:` 는 본문의 `## 구현 위치` 절(텍스트)로 옮겼다. 전환 단계 5 에서 `spec-code-paths` 를 `spec-impl-locations` 로 바꿨다(규칙 19 · 20, R-16). NERV 에서 구현 작업은 스펙 버전에서 나온 Task 가 맡고 Task 를 완료(`done`)하려면 증적(`evidence`)이 있어야 한다. 증적 종류는 `code_path`·`test`·`pr`·`commit`·`review`·`user_guide` 여섯이다. done 전이는 그 Task 에 묶인 `code`·`consistency` 리뷰 라운드가 판정을 통과했는지도 본다(프로젝트 정책 `done_gate.review_coverage`) |
| spec-linked 변경의 구현 완료 검토 | `code:` 글로브에 걸린 파일을 고친 브랜치는 `--impl-done` 검토가 있어야 push 됐다(리뷰 게이트의 spec 정합 검사) | 전환 단계 2 에서 그 검사가 없어졌다. 대신 NERV done 게이트가 Task 에 묶인 consistency 라운드를 요구한다. 그 게이트는 라운드가 있고 통과했는지만 보고 라운드가 어떤 문서를 대상으로 했는지는 보지 않는다. 그래서 `## 구현 위치` 에 적힌 파일을 고친 변경이 그 문서와 대조된다는 강제된 보장은 없다. 일관성 검토의 `--impl-done` 을 돌리면 `## 구현 위치` 가 바뀐 파일을 덮는 문서가 검토 대상에 든다(2026-10-03, NERV Task `CLE-T-VP5KDJ`). 이 대조에 기댄 Rationale([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) R-CC-22, [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) «전용 e2e 가드를 구현 위치에 나열한 이유»)도 같은 강도로 적는다 |
| `pending_plans:` 와 plan 실존 가드 | 미구현 표면을 plan 파일 경로로 가리켰다 | NERV 는 구현 작업을 Task 로 추적한다. Task 는 기준 스펙 버전(`spec_key`·`version_no`)을 가진다. 전환 단계 3 에서 `plan/` 과 그 가드(`spec-pending-plan-existence`)를 지웠다 |
| `user_guide:` | 가드 없는 선언용 cross-link | NERV Task 증적 종류에 `user_guide` 가 있다. 옛 트리의 `user_guide:` 는 전환 단계 5 에서 옛 트리와 함께 걷었다 |
| Gate C `spec_impact` | 완료 plan frontmatter 에 선언했다 | NERV Task 의 `done` 전이가 `spec_impact` 선언을 요구한다. 값은 바꾼 스펙 목록(`{changed: [...]}`)이나 `{none: true}` 이고 비어 있으면 게이트가 막는다. 전환 단계 3 에서 `plan/` 과 그 가드(`spec-plan-completion`)를 지웠다 |
| `backlog` 가드 | `id` 가 저장소 `spec/0-overview.md` 본문에 나오는지 봤다 | 0-overview 의 내용은 NERV 에서 [Clemvion 제품 개요](../CLE-VISION.md) 와 여러 영역 문서로 나뉘었다. 전환 단계 3 에서 이 가드(`spec-status-lifecycle`)를 지웠다 |
| 링크 무결성 가드 범위 1 | 스펙 본문의 저장소 상대 경로 링크와 헤딩 slug 를 대조했다 | 전환 단계 5 에서 옛 트리와 함께 걷었다. NERV 는 본문에서 문서 키(`CLE-…`)를 대상으로 하는 마크다운 링크만 읽어 references 관계를 만든다. 없는 문서를 가리킨 링크는 저장 응답의 `relations.unknown` 으로 알린다. 앵커(`#…`)는 관계 판정에서 무시한다 |
| 링크 무결성 가드 범위 2 | 코드 주석이 저장소 `spec/**.md` 파일을 상대 경로로 가리켰다 | 전환 단계 4c(NERV Task `CLE-T-9AM31N`)에서 키 링크(`[글](<키>#앵커)`)로 바꿨다. 키와 앵커는 저장소 미러 파일로 확인하고 `spec/**.md` 경로 링크는 위반으로 본다(R-14) |
| 영역 index 가드 | 영역 폴더마다 index 문서가 형제 문서를 링크했다 | NERV 는 `area` 종류 문서와 트리의 부모 관계로 영역을 묶는다. 이번 이전에서 `area` 문서는 자식 문서 목록을 `## 문서` 절에 둔다. 전환 단계 5 에서 이 가드(`spec-area-index`)를 걷었다 |
| 저장소 미러와 링크 · 영역 index 가드 | 저장소 `spec/` 에는 옛 트리만 있었다 | 전환 단계 1 부터 NERV 미러(`spec/<영역 키>/<KEY>.md` · `spec/README.md`)가 옛 트리 옆에 있었고 두 가드는 미러를 대상에서 뺐다(R-12). 전환 단계 5 에서 옛 트리를 지웠다. 저장소 `spec/` 에는 미러만 있다. 미러 무결성은 `.claude/tools/nerv-mirror/pull.py --check`(CI `spec-mirror-integrity`)가 본다 |
| Gate D spec-coverage | 산출물을 `review/spec-coverage/**` 에 커밋했다 | 전환 단계 2 부터 산출물을 로컬 `.review/spec-coverage/**` 에 두고 커밋하지 않는다. NERV 리뷰 레코드의 종류(`kind`)에 `spec_coverage` 가 있다. 감사기 SUMMARY 의 후보 하나가 info 발견 하나가 되어 역할 `spec_coverage` 로 제출되므로 라운드를 막지 않는다(2026-10-03, NERV Task `CLE-T-VP5KDJ`). 제출 절차는 저장소 `.claude/skills/spec-coverage/SKILL.md` 가 정한다. NERV 리뷰는 저장소에 파일로 커밋하지 않는다([리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md)). 전환 단계 5 에서 감사 대상을 옛 트리 frontmatter `code:` 에서 미러의 `## 구현 위치` 로 옮겼다([적용 대상](CLE-ENG-SPECEVIDENCE.md#적용-대상)) |
| 스펙 편집 경로 | 사람이 저장소 `spec/` 파일을 직접 고쳤다 | NERV 플러그인의 스펙 스킬은 저장소 `spec/**` 를 NERV 가 내보낸 읽기 전용 미러로 보고 직접 편집을 금지한다. 스펙 변경은 초안 저장·사전 검토(`nerv_spec_check`: cross-spec·rationale-continuity·convention-compliance·requirement-shape·task-coherence 5개 검사기)·사람 승인 경로로 한다 |

## Rationale

### R-2. `spec-only` TTL 90일과 `backlog` 값

(걷음. 원문은 이 문서의 버전 6 에 있다. R-17) 구현 없이 남은 스펙(`spec-only`)에 90일 TTL 을 두고 로드맵에 올린 보류 문서를 `backlog` 로 갈라 빈 약속을 막던 결정이다. TTL 과 `backlog` 등재 가드는 전환 단계 3 에서(R-13), 옛 스펙 상태 값은 전환 단계 5 에서(R-16) 걷었다.

### R-3. `backlog` 값을 새로 둔 근거

(걷음. 원문은 이 문서의 버전 6 에 있다. R-17) 구현이 분기나 해 단위 뒤에 오는 로드맵 문서를 `spec-only` 카운터에서 떼던 결정이다. 등재 가드는 `0-overview.md` 본문 전체에서 `id` 를 찾았다. 전환 단계 3 · 5 에서 걷었다(R-13 · R-16).

### R-4. `archived` 라는 이름 (Cafe24 `deprecated` 와 구분)

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

`archived` 로 이름을 지어 [Cafe24 API 카탈로그](CLE-C24-CATALOG) 의 `deprecated`(Cafe24 endpoint 폐기 상태)와 뜻을 분명히 갈랐다.

- 이 규약의 `archived`: 스펙 문서 자체의 폐기
- Cafe24 `deprecated`: 외부 API endpoint 의 폐기(다른 영역)

### R-5. `status: partial` 에 `pending_plans:` 를 의무로 둔다 (plan 라이프사이클을 거꾸로 강제)

(걷음. 원문은 이 문서의 버전 6 에 있다. R-17) Telegram 채팅 채널 사례처럼 어떤 plan 도 책임지지 않는 빈 약속을 막으려고 스펙이 자기를 책임지는 plan 을 가리키게 한 결정이다. 전환 단계 3 에서 걷었고 남은 표면은 NERV Task 가 맡는다(R-13 「약해지는 곳」).

### R-6. `code:` 의 뜻 (스펙 frontmatter 와 가이드 MDX)

(걷음. 원문은 이 문서의 버전 6 에 있다. R-17) 가이드 MDX `code:`(설명하는 코드, 항목마다 실재)와 스펙 `code:`(약속한 구현 표면, 글로브 매치)는 이름이 같아도 불변식이 달라 합치지 않았다. 스펙 쪽은 전환 단계 5 에서 `## 구현 위치` 로 바뀌었다. 지금의 구분은 [뜻이 다른 같은 이름](CLE-ENG-SPECEVIDENCE.md#뜻이-다른-같은-이름) 에 있다.

### R-7. API 카탈로그의 필드 파일을 뺀다 (`<name>-api-catalog/<resource>/**`)

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

`spec/conventions/cafe24-api-catalog/<resource>/<entity>.md` 같은 필드 단위 카탈로그는 외부 API 문서를 기계로 뽑은 **생성기 산출물**(카탈로그 개요의 `_generator.py`)이다. frontmatter 는 `resource`/`entity`/`cafe24_docs`/`source` 다. 제품 표면의 구현 라이프사이클(`backlog`→`implemented`)을 추적하는 정식 스펙이 아니다. 그래서 `id`/`status` 를 주는 것은 (a) 추적할 구현 라이프사이클이 없어 뜻이 맞지 않고 (b) 생성기가 다시 만들 때마다 수백 개 파일에 의미 없는 메타를 찍어야 해 유지보수 부담이다.

반면 카탈로그 최상위 `<resource>.md` 인덱스(`application.md` 등 18개)는 해당 리소스군의 메타데이터 구현(`code:`)을 약속하는 정식 스펙이라 `id` 와 `status: implemented` 가 있고 검증을 유지한다. 그래서 제외는 카탈로그 디렉터리 뒤에 경로 세그먼트가 하나 더 있는 중첩 경로(`<name>-api-catalog/<resource>/…`)로 한정한다. `_*.md`(밑줄 접두, leaf 아님) 제외와는 논리가 다르다(생성물과 layout·index). 그래서 따로 항목을 둔다. 가드 구현은 `spec-frontmatter-parse.ts` 의 `CATALOG_FIELD_FILE` 정규식이 제외 목록과 맞춘다.

카탈로그는 전환 단계 4a(NERV Task `CLE-T-BD48J3`)에서 저장소 `codebase/api-catalogs/` 로 옮겼다. 그래서 지금 `spec/` 아래에는 이 제외에 걸리는 파일이 없다.

### R-8. Gate C — plan 완료 시점에 `spec_impact` 선언을 의무로 둔다

(걷음. 원문은 이 문서의 버전 6 에 있다. R-17) 완료 plan frontmatter 에 `spec_impact` 선언(스펙 경로 목록 또는 `none`)을 요구하고 빌드 테스트가 선언의 유무와 실존만 보게 한 결정이다. 코드 변경을 git 이력으로 추적하는 원안은 깨지기 쉬워 버렸다. 빈 값 대신 명시적 no-op 을 요구한 이유(누락과 의도적 무변경을 가른다)는 NERV done 게이트의 `spec_impact` `{none: true}` 와 같다. 전환 단계 3 에서 Gate C 를 걷었고 같은 선언을 NERV Task 의 `done` 전이가 요구한다(R-13).

### R-10. `user_guide:` 에는 빌드 가드를 두지 않는다 (선언용 cross-link)

(걷음. 원문은 이 문서의 버전 6 에 있다. R-17) 스펙 frontmatter `user_guide:` 는 가이드 페이지로 가는 선언용 링크라 경로 실존 가드를 두지 않았다. 가이드와 스펙의 정합은 반대 방향 가드(`registry.test.ts`, [사용자 가이드 근거 규약](CLE-ENG-GUIDEEVIDENCE.md))가 맡는다. 필드는 전환 단계 5 에서 옛 트리와 함께 걷었다.

### R-11. 공유 트래커를 가리키는 `partial` 의 승격 시점

(걷음. 원문은 이 문서의 버전 6 에 있다. R-17) 트래커 파일 하나를 여러 문서의 `pending_plans` 가 가리킬 때 파일 이동 대신 그 문서 몫의 항목으로 승격을 판정하던 규칙(규칙 12)의 근거다. 전환 단계 3 에서 `pending_plans` 와 함께 걷었다(R-13).

### R-13. 전환 단계 3 에서 plan 가드와 `pending_plans` 를 걷었다 (2026-10-01)

NERV 정본 전환 단계 3(NERV Task `CLE-T-FN2JWK`)에서 저장소 `plan/` 을 지웠다. 작업 추적의 정본은 NERV Task 다. `plan/` 을 읽던 가드 넷과 그 공용 모듈(`plan-scan.ts`)을 같은 PR 에서 걷었다.

- `spec-pending-plan-existence.test.ts`(규칙 8): `pending_plans:` 의 plan 실존을 봤다. 남은 표면은 NERV Task 가 맡고, Task 는 기준 스펙 버전을 가진다.
- `spec-status-lifecycle.test.ts`(규칙 9 · 10 · 11): `spec-only` TTL · `partial` 의 `pending_plans:` 의무 · 승격 · `backlog` 등재를 봤다. 넷 다 `plan/` 이나 옛 트리 frontmatter 를 전제로 한다. 옛 트리는 전환 단계 1 부터 동결이라 새로 `spec-only` · `partial` 이 될 문서가 없다.
- `spec-plan-completion.test.ts`(Gate C, 규칙 15 · 16): 완료 plan 의 `spec_impact` 선언을 봤다. NERV Task 의 `done` 전이가 같은 선언을 요구한다.
- `plan-frontmatter.test.ts`: plan frontmatter 와 살아 있는 plan 의 링크를 봤다. 대상이 없어졌다.

검사마다 이어받는 곳이 다르다.

- `spec_impact` 선언(Gate C)은 NERV Task 의 `done` 게이트가 같은 선언을 요구한다.
- `plan-frontmatter` 는 대상이 사라졌다.
- `pending_plans:` 의 실존과 의무(규칙 8)는 남은 표면을 NERV Task 로 추적하는 절차로 옮겼다. 이 절차를 기계가 강제하지는 않는다(아래 「약해지는 곳」).
- `partial` 승격(규칙 11)은 보는 가드 없이 전이 규칙을 따른다. 전이 규칙은 전환 단계 5 에서 옛 스펙 상태 라이프사이클과 함께 걷었다(R-16).
- `spec-only` TTL(규칙 9)과 `backlog` 등재(규칙 10)는 대신하는 장치 없이 걷었다. 이 두 갈래는 plan 경로를 읽지 않고 옛 트리 frontmatter 의 `status` 와 `spec/0-overview.md` 를 읽었다. NERV 에서 문서 머리 줄의 "구현 상태" 와 영역 문서로 바뀐 전제라 같은 PR 에서 함께 걷었다. 이 시점 옛 트리의 `spec-only` 는 문서 예시뿐이고 `backlog` 는 1건이다.

(2026-10-03 정정: 승인본 v2 는 "대체 없이 끈 가드는 없다" 고 적었다.)

약해지는 곳도 있다. "`partial` 인데 남은 표면을 맡은 작업이 없음"(R-5 가 막던 빈 약속)은 이제 기계가 잡지 못한다. 남은 표면은 구현 PR 이 NERV Task 를 만드는 절차(developer SKILL 의 partial-implementation 분리)와 리뷰가 지킨다. 스펙 본문이 지운 `plan/` 경로를 추적처로 적은 줄도 보는 가드가 없다. `legacy-path-ratchet` 은 codebase 만 세고 `pull.py --check` 는 미러 본문을 읽지 않는다. 2026-10-03 미러에서 12개 문서 22줄이었고 정리는 후속 NERV Task 가 맡는다.

옛 트리 파일에 남은 `pending_plans:` 값은 이제 읽는 가드가 없고 대상 plan 도 없다. 그 값은 단계 5 에서 옛 트리와 함께 지웠다(R-16). 이 문서의 Rationale 이 가리키는 옛 plan 문서(R-8 · R-9 · R-11)는 단계 3 삭제 커밋 직전 이력에서 `git show <삭제 커밋>^:<경로>` 로 읽는다.

링크 무결성 가드 범위 1 이 루트 `plan/` · `review/` 로 해석되는 링크를 건너뛰는 것도 같은 이유다(규칙 17). 동결된 옛 트리를 고치지 않고 단계 5 에서 지울 때까지 두었다. 이 면제는 범위 1 과 함께 걷었다(R-16). 해석한 경로로 판정해 루트가 아닌 같은 이름 폴더는 그대로 검사한다. 거버넌스 문서에는 이 면제를 두지 않았다. 살아 있는 문서라 링크를 고칠 수 있다.

### R-17. 걷은 규칙과 결정을 요약으로 줄인다 (2026-10-03, 버전 7)

전환 단계 3 · 5 를 거치며 규칙 22항 중 17항과 Rationale 10개가 「걷음」 표기만 단 채 원문을 그대로 남겼다. 살아 있는 규칙(18 ~ 22)을 찾기 어렵고 걷은 규칙을 현행으로 읽기 쉽다. 이웃 문서가 걷은 필드를 현행처럼 인용한 일이 실제로 있었다(R-16 「후속 개정」). 그래서 버전 7 에서 걷은 규칙은 한 문단으로, 걷은 결정은 한두 문장 요약으로 줄였다. 원문은 NERV 의 이 문서 버전 6 에 있고 옛 트리 원문은 git 이력에 있다.

- 규칙 번호와 Rationale 제목은 지우지 않았다. 다른 문서와 코드 주석이 규칙 번호(예: 규칙 6 · 18 ~ 20)와 R 번호(예: R-4 · R-7 · R-9 · R-10 · R-14 ~ R-16)를 인용한다.
- R-4 · R-7 은 줄이지 않았다. 카탈로그 정본의 `deprecated` 행과 일관성 검토 오케스트레이터의 카탈로그 필드 문서 제외가 지금도 그 근거를 인용한다.
- R-12 · R-13 도 걷은 장치를 다루지만 줄이지 않았다. 지금 장치가 이어받은 곳과 약해지는 곳을 함께 적고 있어 현행 근거이기도 하다. R-8(Gate C)은 이어받은 곳이 NERV done 게이트 하나라 요약으로 줄였다.
- 걷은 규칙과 결정을 통째로 지우는 안은 채택하지 않았다(이 버전을 쓰며 따졌다. 따로 제안된 이력은 없다). 위 인용이 가리킬 곳이 사라진다.

### `code:` 목록에 주석을 허용한 경위 (2026-09-06)

(걷음. 원문은 이 문서의 버전 6 에 있다. R-17) 옛 리뷰 게이트 파서(`review_guard._parse_frontmatter_code`)가 `code:` 목록의 YAML 주석 뒤 항목을 조용히 버리던 결함(스펙 387개 중 7개 파일, 41개 항목)을 문서 규율 대신 파서 수정으로 막은 경위다. 블록 리스트가 빈 줄과 `#` 주석을 건너뛰게 고쳤다. 파서는 전환 단계 2 에서 걷었고 `code:` 는 전환 단계 5 에서 걷었다.

### 도입할 때 쓴 절차

(걷음. 원문은 이 문서의 버전 6 에 있다. R-17) 적용 대상 스펙 60여 개에 frontmatter 를 한 PR 에서 일괄로 더하고 첫 `status` 를 나눈 절차다. 스펙 문서 저장소 · plan 무결성 가족과 Gate C 는 나중에 더했다(R-8 · R-9). 옛 트리와 함께 걷었다(R-16).
