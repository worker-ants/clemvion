---
id: "CLE-ENG-SPECEVIDENCE"
title: "스펙과 구현 근거 규약"
type: "convention"
version: 6
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ENG"
ancestors: ["CLE-VISION", "CLE-ENG"]
area: "CLE-ENG"
content_hash: "ec98772a69816854a0eefb8a0e4e0eeee24521ab61e1825a657999367ea78cee"
read_as: "approved_fallback"
task: "CLE-T-7M4C4X"
source_paths: ["spec/conventions/spec-impl-evidence.md"]
mirror_sha256: "c104e9295c99de6410cf2e351ba3d1914668332129b4f5e6b68ef262f06fbe94"
etag: "sha256-129d45189efb4a7be4974472e18641f6522a38c10cd141752a748d6b8f94dc08"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/spec-impl-evidence.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 규약은 스펙 문서 본문의 `## 구현 위치` 절이 가리키는 저장소 경로를 빌드에서 검증한다. 스펙 문서 저장소(미러)와 코드 속 스펙 언급의 무결성을 지키는 일도 이 규약이 정한다. Telegram 채팅 채널 UI 가 스펙에 약속된 채 오래 구현되지 않았던 사례처럼 "스펙 약속과 구현 부재" 사이의 갭을 빌드 가드로 막는다.

이 규약 전의 검사는 모두 변경을 계기로 돌았다.

- `/consistency-check`: 스펙 초안과 구현 착수 시점에만 돈다.
- `/ai-review`: PR diff 안만 본다.
- `user-guide-sync-reviewer`: 코드에서 가이드로 가는 한 방향만 본다.
- `nodes-coverage`·`hydration-coverage` 같은 빌드 가드: 등록부 열거만 본다.

그래서 "스펙이 약속한 표면이 **지금** 구현돼 있는가" 는 어떤 검사도 묻지 않았다. 이 규약은 스펙 문서의 `## 구현 위치` 절에 구현 경로를 적게 하고 [구현 위치 근거 가드](#빌드-가드--구현-위치-근거)로 그 경로의 실재를 강제한다. 옛 트리 frontmatter 의 옛 스펙 상태(`status`) · `code:` 로 보던 근거는 전환 단계 5 에서 옛 트리와 함께 걷었다(Rationale R-16). 스펙 문서 저장소(링크 · 도구 태그 잔재)와 코드 주석 · 텍스트 속 스펙 언급(옛 경로 · 키)의 무결성을 지키는 [별도 가드 가족](#빌드-가드--스펙-문서-저장소-무결성)도 이 문서가 정한다. 처음에는 `pending_plans:` 와 plan 무결성 가드도 이 규약에 있었다. 전환 단계 3 에서 `plan/` 과 함께 걷었다(Rationale R-13).

스펙의 정본은 NERV 문서이고 저장소 `spec/` 은 구현할 때 받은 미러다. 작업 추적은 전환 단계 3 부터 NERV Task 가 맡는다. 스펙을 NERV 로 옮기면서 바뀐 전제는 [NERV 이전 영향](#nerv-이전-영향) 에 모았다.

범위 밖:

- 사용자 가이드 본문이 약속한 코드의 실재는 [사용자 가이드 근거 규약](CLE-ENG-GUIDEEVIDENCE.md) 이 정한다.
- 작업 추적(진행 · 완료 · `spec_impact` 선언)은 NERV Task 가 맡는다. 기준은 저장소 `CLAUDE.md` 「정보 저장 위치」 다.
- spec-coverage 정기 감사의 절차와 산출물은 저장소 `.claude/skills/spec-coverage/SKILL.md` 가 정한다.

## 규칙

1. (걷음) 적용 대상 스펙 파일의 frontmatter 의무(`id` · `status` · 상태에 따른 `code:`). 옛 트리 frontmatter 는 전환 단계 5 에서 옛 트리와 함께 걷었다(R-16).
2. (걷음) 적용 대상 목록과 `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 를 함께 고친다는 규칙. 그 파서는 전환 단계 5 에서 옛 트리와 함께 걷었다(R-16).
3. (걷음) frontmatter `id` 의 kebab-case · basename 규칙. 옛 트리 frontmatter 와 함께 걷었다(R-16).
4. (걷음) 옛 스펙 상태 `status` 의 다섯 값과 라이프사이클. 옛 트리 frontmatter 와 함께 걷었다(R-16).
5. (걷음) `status` 가 `partial` · `implemented` 면 `code:` 글로브가 파일 1개 이상에 매치해야 한다는 규칙. 옛 트리 frontmatter 와 함께 걷었다. 경로의 실재는 규칙 20 이 본다(R-16).
6. (걷음) `code:` 경로의 기준과 글로브 허용. 옛 트리 frontmatter 와 함께 걷었다. 같은 내용을 규칙 19 · 20 · 21 이 `## 구현 위치` 에 정한다. 그 취지(넓은 트리 글로브로 가드만 통과시키지 않는다)는 규칙 19 가 모든 문서에 잇는다(R-16).
7. (걷음) 순수 문서형 규약의 `code:` 에 준수 예시 파일을 적는다는 규칙. 옛 트리 frontmatter 와 함께 걷었다. 준수 예시 파일은 규칙 21 로 옮겼다(R-16).
8. (걷음) `status: partial` 의 `pending_plans:` 의무. 전환 단계 3 에서 `plan/` 과 함께 걷었다. 남은 표면은 NERV Task 가 맡는다(R-13).
9. (걷음) `spec-only` 90일 TTL. 전환 단계 3 에서 그 가드(`spec-status-lifecycle`)와 함께 걷었다(R-13).
10. (걷음) `backlog` 의 `id` 가 저장소 `spec/0-overview.md` 본문에 나와야 한다는 검사. 같은 가드와 함께 걷었다(R-13).
11. (걷음) `pending_plans` 가 모두 `complete/` 로 옮겨지면 `implemented` 로 올린다는 승격 검사. 보는 가드는 전환 단계 3 에서 걷었다(R-13). 전이 규칙은 전환 단계 5 에서 옛 상태 라이프사이클과 함께 걷었다(R-16).
12. (걷음) 공유 트래커를 가리키는 `pending_plans` 의 승격 시점(R-11). `pending_plans` 와 함께 걷었다.
13. (걷음) `archived` 문서 본문 끝의 폐기 사유. 옛 트리 frontmatter 와 함께 걷었다(R-16).
14. (걷음) `user_guide:` 에 가이드 로케일 쌍을 모두 적는다는 규칙. 옛 트리 frontmatter 와 함께 걷었다(R-16).
15. (걷음) 완료 plan 의 `spec_impact` 선언(Gate C). NERV Task 의 `done` 전이가 같은 선언을 요구한다(R-13).
16. (걷음) Gate C cutoff 값을 세 곳에 같게 둔다는 규칙. Gate C 와 함께 걷었다.
17. (걷음) 스펙이 `plan/**` 을 링크하면 plan 을 옮길 때 링크를 고친다는 규칙. `plan/` 이 없어졌다.
18. 코드 주석이 스펙을 가리킬 때는 키 링크 `[글](<키>#앵커)` 를 쓴다. 미러에 없는 키는 같은 PR 에서 미러로 받는다. 미러하지 않는 카탈로그 영역(`CLE-C24` · `CLE-MKS`)은 키 링크로 쓸 수 없다. 코드 주석은 카탈로그를 `codebase/api-catalogs/<vendor>/` 경로나 링크 없는 언급으로 가리킨다. 공개 OpenAPI 채널(`*.dto.ts` · `*.controller.ts` 의 `/** */` 블록과 데코레이터 `description` · `summary`)에는 링크 없는 키도 포함해 키를 쓰지 않는다. 근거는 바로 위 `//` 주석에 키 링크로 쓴다([OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17, 백엔드 가드 `openapi-internal-ref`, R-14). 링크로 감싸지 않은 언급은 키와 절 제목으로 쓴다(예: `CLE-API-ERRCODES` 「워크플로우 실행: 엔진 수준」). NERV 제목에 번호가 붙어 있어도 번호를 빼고 제목 글자만 쓴다(예시의 실제 제목은 `6.5 워크플로우 실행: 엔진 수준`). 옛 § 번호는 옮기지 않는다. 그 키도 미러에 있어야 한다. 미러하지 않는 카탈로그 영역의 키는 가드가 확인하지 않고 통과시킨다(R-15).
19. 구현이 있는 스펙 문서는 본문 `## 구현 위치` 절에 그 표면의 구현 경로를 목록으로 적는다. 경로는 저장소 루트 기준이다. 글로브는 그 표면을 맡은 범위로 좁힌다. 넓은 트리 글로브(`codebase/backend/src/**` 같은)는 아무것도 가리키지 않는 것과 같다. 절을 적었는지와 글로브의 넓이는 기계가 보지 않는다. 리뷰와 구현 Task 의 done 점검이 본다(R-16 「약해지는 곳」).
20. `## 구현 위치` 절의 코드 스팬 가운데 `codebase/` · `.claude/` · `.github/` · `scripts/` 로 시작하는 것은 저장소 경로로 읽는다. 빌드가 그 경로의 실재를 확인한다(가드 `spec-impl-locations`). 절은 제목이 `## 구현 위치` 와 글자가 같은 H2 이고 다음 H2 에서 끝난다. 코드 펜스 안은 읽지 않는다. 판정은 다음과 같다.
    - 글로브(`*` · `**` · `?`)는 파일 1개 이상에 매치해야 한다.
    - 대괄호(`[slug]` · `[id]`)는 글자 그대로 읽는다(Next.js 동적 세그먼트). 글로브 문자 클래스로 쓰지 않는다.
    - 중괄호 `{a,b}` 는 펼친 경로가 **모두** 실재해야 한다.
    - 마지막 세그먼트가 `V<숫자>` 인 마이그레이션 경로(`codebase/backend/migrations/V117`)는 그 번호의 마이그레이션 파일(`V117__*`)이 있어야 한다.
    - 그 밖의 코드 스팬(심볼 · 파일 이름만 적은 것 · 괄호 안 보충 설명 · gitignore 대상 `.review/`)은 경로로 읽지 않는다.
21. 강제하는 코드가 없는 순수 문서형 규약은 `## 구현 위치` 에 그 규약을 실제로 지키는 예시 파일을 적어도 된다. 이때도 넓은 트리 글로브로 가드만 통과시키지 않는다(규칙 19, 옛 규칙 6 · 7 의 취지). 한 문서 안에서도 축마다 강제 여부가 갈릴 수 있으므로 이 판단은 축 단위로 한다. 준수 예시와 시행 코드를 함께 적고 범주를 문장으로 갈라도 된다(선례: [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md)).
22. 코드 변경이 `## 구현 위치` 가 가리키는 경로를 옮기거나 지우면 같은 PR 에서 그 문서의 NERV 초안을 고쳐 승인받고 미러를 받는다(`pull.py --task`). 미러를 손으로 고치지 않는다.

## 적용 대상

규칙 19 ~ 22 는 저장소 NERV 미러의 스펙 문서 가운데 본문에 `## 구현 위치` 절이 있는 문서에 적용한다. 미러 문서는 다음 두 자리에 있다. 영역 문서와 그 아래 문서는 영역 폴더에, 영역 밖 문서는 `spec/` 바로 아래에 있다.

- `spec/<KEY>.md`
- `spec/<영역 키>/<KEY>.md`

미러 안내 `spec/README.md` 는 스펙 문서가 아니므로 빠진다. 카탈로그 영역(`CLE-C24` · `CLE-MKS`)은 미러에 넣지 않으므로 대상이 아니다(규칙 18). `## 구현 위치` 절이 없는 문서에는 가드가 볼 경로가 없다.

이 대상을 읽는 곳은 셋이다.

- 가드 `spec-impl-locations`: 규칙 20 의 판정이다. 파일 이름이 `SPEC_KEY_RE` 에 맞는 미러 파일만 본다(`spec-keys.ts`). 이 판정은 `spec-impl-locations.test.ts` 의 합성 미러 테스트가 고정한다.
- spec-coverage 감사: 오케스트레이터(`.claude/skills/spec-coverage/scripts/spec_coverage_orchestrator.py`)가 이 절의 포함 목록 · 절 조건 · 제외 항목을 감사기 프롬프트에 싣는다. 판정을 코드로 갖지 않는다. 이 절과 같은지는 `.claude/tests/test_spec_coverage_prompt.py` 가 대조한다.
- 일관성 검토 `--impl-done` 의 구현 위치 대조: 바뀐 파일을 덮는 문서를 검토 대상에 더하려고 규칙 20 보다 넓게 읽는다. 저장소 최상위 폴더면 어느 것이든 경로의 첫 조각으로 받고 같은 줄에 이어 적은 파일 이름도 경로로 받는다. 대상을 놓치는 것보다 더 넣는 편이 낫기 때문이다(`consistency_orchestrator.py` 의 `impl_location_patterns`). 빌드 판정이 아니라서 규칙 20 과 맞추지 않는다.

## 작성 예

구현이 있는 문서는 본문 `## 구현 위치` 절에 다음처럼 적는다.

- `codebase/backend/src/modules/chat-channel/**`
- `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`
- `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx`

첫 줄은 글로브라서 파일 1개 이상에 매치하면 된다. 둘째 줄은 그 파일이 있어야 한다. 셋째 줄의 `[slug]` 는 Next.js 동적 세그먼트라서 글자 그대로 읽는다(규칙 20).

### 뜻이 다른 같은 이름

- **`code:` 와 `## 구현 위치`**: 사용자 가이드 MDX frontmatter 에는 `code:` 가 있다. 이 규약의 `## 구현 위치` 와 뜻은 비슷하지만 대상 문서 종류가 `.mdx`(가이드)와 미러 스펙으로 갈린다. 두 가드(`registry.test.ts`, `spec-impl-locations.test.ts`)는 각자 자기 대상만 검증한다.

## 빌드 가드 — 구현 위치 근거

아래 단위 테스트가 규칙 20 을 강제한다. 실패하면 빌드가 막힌다. `codebase/frontend/src/lib/docs/__tests__/` 에 있다. 링크 · 도구 태그 · 스펙 언급 가드는 [별도 가족](#빌드-가드--스펙-문서-저장소-무결성)이다(Rationale R-9). 옛 frontmatter 근거 가드 `spec-frontmatter.test.ts` · `spec-code-paths.test.ts` 는 전환 단계 5 에서 옛 트리와 함께 걷었다(R-16). `spec-status-lifecycle.test.ts` · `spec-pending-plan-existence.test.ts` 는 전환 단계 3 에서 걷었다(R-13).

| 가드 | 검증 |
| --- | --- |
| `spec-impl-locations.test.ts` | [적용 대상](#적용-대상) 문서의 `## 구현 위치` 경로가 실재한다(규칙 20) |

### 다른 가드와의 관계

- `registry.test.ts`(사용자 가이드 MDX 의 `spec:`/`code:` 경로 실존)와는 **대상 문서 종류**로 갈린다. 이 가드는 미러 스펙(`spec/**.md`)만, `registry.test.ts` 는 `codebase/frontend/src/content/docs/**.mdx` 만 본다.
- `nodes-coverage.test.ts`(백엔드 노드가 가이드 본문에 나오는지)와는 방향이 직교한다. `nodes-coverage` 는 노드 열거에서 가이드로, 이 가드는 스펙 약속에서 구현 코드로 간다.
- `impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts`([사용자 가이드 근거 규약](CLE-ENG-GUIDEEVIDENCE.md) 의 역방향 가드 3건)와도 검증 영역이 직교한다. 그 가드들은 가이드 약속에서 코드 심볼로(guide → code), 이 가드는 스펙 약속에서 코드 경로로(spec → code) 간다. 두 가족은 독립이고 서로를 대신하지 않는다.

## 빌드 가드 — 스펙 문서 저장소 무결성

구현 위치 근거 가드와 **다른 가족**이다. 스펙 문서 저장소(링크 · 도구 태그 잔재)와 코드 주석 · 텍스트 속 스펙 언급(옛 경로 · 키)을 지키는 빌드 차단 4건과 권고 1건이다. 이 절이 규약의 기준이고 도입 경위와 로드맵은 옛 plan `knowledge-base-quality-improvements.md`(git 이력)에 있다. 빌드 가드 4건의 구현 파일은 [구현 위치](#구현-위치)에 있다(Rationale R-9). plan frontmatter 가드(`plan-frontmatter.test.ts`)와 Gate C(`spec-plan-completion.test.ts`)는 전환 단계 3 에서 `plan/` 과 함께 걷었다(R-13). 영역 index 가드(`spec-area-index.test.ts`)는 전환 단계 5 에서 걷었다. 영역 목차는 NERV `area` 문서의 `## 문서` 절이 맡는다(R-16).

| 가드 | 대상 / 검증 | 예외 / 비고 |
| --- | --- | --- |
| `spec-link-integrity.test.ts` (빌드 차단) | 마크다운 링크가 가리키는 대상이 있는지, `#anchor` 가 대상 문서의 헤딩 slug 와 맞는지 본다. 대상은 저장소 상대 경로이거나 NERV 스펙 키(키 링크)다. 키 링크는 범위 2 · 3 에서 저장소 미러 파일로 확인한다. slug 는 실제 렌더러(`rehype-slug` = `mdast` + `github-slugger`) 파이프라인과 같게 만든다. 대상 범위는 표 아래에 있다 | 범위 1(`spec/**.md` 본문)은 전환 단계 5 에서 옛 트리와 함께 걷었다(R-16). 범위 2 는 `spec/**.md` 를 가리키는 경로 링크를 대상이 있어도 위반으로 본다(R-14). 범위별 세부는 표 아래 |
| `stray-tool-tags.test.ts` (빌드 차단) | `spec/**` 마크다운(NERV 미러)에 작성 도구가 문서를 감싸던 XML 유사 태그(content · invoke 래퍼의 닫는 태그 등)가 남았는지 본다. 원인 제거가 아니라 재발 감지다 | 코드펜스 안도 예외로 두지 않는다. `plan/**` 도 보던 루트였는데 전환 단계 3 에서 `plan/` 과 함께 뺐다 |
| `legacy-path-ratchet.test.ts` (빌드 차단) | codebase 텍스트 파일에서 옛 스펙 트리 경로와 전환 단계 3 에서 지운 `plan/` 경로(`plan/in-progress/` · `plan/complete/` · `plan/research/`)를 적은 줄을 파일별로 세어 기준값 파일(`legacy-path-ratchet.baseline.json`)과 견준다. 옛 스펙 트리 경로는 옛 트리의 최상위 이름(`spec/<번호>-<영역>/` · `spec/conventions/` · `spec/data-flow/` · 루트 `spec/<번호>-<이름>.md`)으로 시작하는 경로다. 확장자 없는 인용 · 영역 이름만 적은 언급 · 글로브도 센다. NERV 미러 경로(`spec/CLE-*` · `spec/README.md`)는 세지 않는다. 늘어도 줄어도 실패한다. 줄였으면 기준값을 다시 쓴다(R-15) | 적용된 마이그레이션(`V*.sql` · `V*.conf`)은 [DB 마이그레이션 규약](CLE-ENG-MIGRATION.md) 규칙 9 때문에 고치지 않으므로 그 언급은 기준값에 영구히 남는다. 카탈로그 생성기 산출물은 생성기를 고친다. 가드 자신의 파일은 세지 않는다 |
| `spec-key-mentions.test.ts` (빌드 차단) | codebase 텍스트 파일이 링크 안팎에 적은 스펙 키(`CLE-…`)가 미러에 있는지 본다. 키 링크의 키도 같은 판정이라 함께 본다. 키 뒤에 적은 절 제목(「…」)은 확인하지 않는다. 키 모양은 `spec-keys.ts` 의 `SPEC_KEY_RE` 를 쓴다 | NERV Task 키(`CLE-T-` + 6자)는 보지 않는다. `CLE-T` 는 Task 키 접두라 스펙 영역 키로 쓰지 않는다. 미러하지 않는 카탈로그 영역(`CLE-C24` · `CLE-MKS`)의 키는 확인하지 않고 통과시킨다(R-15). 다른 docs 가드의 대조군이 일부러 쓰는 가짜 키는 파일별 허용 목록에 둔다 |
| **Gate D** (권고. 빌드를 막지 않음) | `/spec-coverage --mode reverse`(orchestrator `--mode` 인자로 구현됨). 스펙이 가리키지 않는 controller route·이벤트·환경변수를 찾는다(구현에서 스펙으로 가는 역커버리지). 대상 스펙은 [적용 대상](#적용-대상)(미러 가운데 `## 구현 위치` 절이 있는 문서)이다 | NLP 휴리스틱이라 보고만 하고 CI 를 막지 않는다 |

`spec-link-integrity.test.ts` 의 대상 범위:

1. **(걷음) `spec/**.md` 본문.** 옛 트리와 함께 걷었다. 미러 본문의 링크는 NERV 가 references 관계로 본다(`relations.unknown`). 미러 무결성은 `pull.py --check` 가 본다(R-12 · R-16).
2. **codebase 소스의 JSDoc·주석.** `codebase/{backend,frontend,channel-web-chat}/src` · `codebase/backend/test` · `codebase/frontend/e2e` 와 `codebase/packages` 의 `.ts`/`.tsx` 를 본다. 빌드 출력(`dist`/`.next`/`build`)과 `node_modules` 는 뺀다. 이 범위에서는 스펙을 키 링크 `[글](<키>#앵커)` 로 가리킨다(규칙 18). `<키>` 자리에는 NERV 스펙 키(`CLE-…`)를 쓴다. 키 모양은 `spec-keys.ts` 의 `SPEC_KEY_RE` 를 따른다. `pull.py` 의 `KEY_RE` 보다 좁아서 이 모양이 아닌 링크는 키 링크로 보지 않는다. NERV 본문의 링크 표기와 같다(R-14).
   - 키는 저장소 미러 파일 이름으로 확인한다. 미러 파일은 `spec/<영역 키>/<KEY>.md` 이고 영역 밖 문서는 `spec/<KEY>.md` 다. 미러에 없는 키는 `KEY` 위반이다.
   - 앵커는 그 미러 파일의 제목 slug 로 확인한다. 없는 앵커는 `ANCHOR` 위반이다.
   - `spec/**.md` 를 상대 경로로 링크하면 대상 파일이 있어도 `PATH` 위반이다.
   - 그 밖의 링크는 보지 않는다. 코드 소스에는 제목이 없으므로 같은 파일 안의 `#앵커` 도 보지 않는다.
   - 공개 OpenAPI 채널은 예외다. `*.dto.ts` · `*.controller.ts` 의 `/** */` 블록(클래스 · 멤버 · 파일 수준 선언)과 데코레이터 `description` · `summary` 문자열에는 링크 없는 키도 포함해 키를 쓰지 않는다. 그 자리의 근거는 바로 위 `//` 주석에 키 링크로 적는다. 기준은 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17 이다. 이 가드는 키 링크의 대상이 있는지만 보고 공개 채널에 키가 들어갔는지는 백엔드 가드 `openapi-internal-ref` 가 본다.
   - 미러는 구현할 때 받은 문서만 담는 부분 스냅샷이다. 미러에 없는 키를 새로 링크하려면 같은 PR 에서 그 문서를 미러로 받는다. 미러에 넣지 않는 API 카탈로그 영역(`CLE-C24` · `CLE-MKS`)의 키는 미러로 받을 수 없어서 키 링크로 쓰면 `KEY` 위반이다. 코드 주석은 카탈로그를 `codebase/api-catalogs/<vendor>/` 경로나 링크 없는 언급으로 가리킨다. 이 경로 링크는 가드가 보지 않는다. 사용자 가이드 프론트매터 `spec:` 도 키를 미러 파일로 확인하지만 카탈로그 영역의 스펙 키를 허용하는 목록이 있다는 점이 다르다(R-14, [사용자 가이드](../CLE-UI/CLE-UI-GUIDE.md)).
   - 링크가 아닌 언급은 보지 않는다. 옛 스펙 트리 경로 문자열은 `legacy-path-ratchet` 이, 링크로 감싸지 않은 키는 `spec-key-mentions` 가 본다(R-15).
3. **거버넌스 문서.** 루트 `*.md`(`CLAUDE.md`·`PROJECT.md` 등, 재귀하지 않음)와 `.claude/**.md` 를 본다. `.claude/worktrees/` 는 저장소 사본이라 빼고 `node_modules` 도 뺀다. 상대 경로 링크는 대상 파일과 제목으로 확인한다. 키 링크는 범위 2 와 같은 방법으로 미러에서 확인한다. 이 범위에는 `plan/` · `review/` 면제가 없다. 살아 있는 문서라 그 링크를 고친다.

위반은 네 종류다. `DEAD` 는 상대 경로 링크의 대상 파일이 없다는 뜻이다. `ANCHOR` 는 `#앵커` 가 대상 문서의 제목에 없다는 뜻이다. `KEY` 는 키 링크의 키가 미러에 없다는 뜻이다. `PATH` 는 범위 2 에서 스펙을 경로로 링크했다는 뜻이다.

링크가 아닌 언급을 보는 두 가드(`legacy-path-ratchet.test.ts` · `spec-key-mentions.test.ts`)는 `codebase-mentions.ts` 의 공용 순회로 파일을 읽는다. 읽는 파일은 `codebase/**` 의 텍스트 파일이다. 확장자(`.ts` · `.tsx` · `.js` · `.mjs` · `.cjs` · `.py` · `.sh` · `.md` · `.mdx` · `.sql` · `.json` · `.yml` · `.yaml` · `.css` · `.svg` · `.html` · `.txt` · `.toml` · `.example` · `.conf`)로 고르고 `Dockerfile` 도 읽는다. 빌드 · 테스트 산출물 디렉터리(`node_modules` · `dist` · `build` · `coverage` · `out` · `test-results` · `playwright-report`)와 점으로 시작하는 디렉터리는 건너뛴다. 판정을 시험하는 합성 입력을 담은 가드 자신의 파일 5개는 세지 않는다. [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md) 규칙 9 · 10 을 보는 `review-citation-form.test.ts` 도 같은 순회를 쓴다. 확장자 목록 · 제외 디렉터리 · 가드 자신의 파일 목록(`GUARD_SELF_FILES`)을 바꾸면 세 가드의 범위가 함께 바뀐다. 이 목록의 기준은 이 문서다. [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md) 도 같은 목록을 적는다. 목록을 고칠 때는 두 문서를 함께 고친다.

## NERV 이전 영향

이 규약의 옛 규칙은 스펙이 저장소 `spec/**.md` 파일이고 가드가 그 파일을 읽는 프론트엔드 단위 테스트라는 전제 위에 있었다. 작업 추적이 `plan/**` 파일이라는 전제는 전환 단계 3 에서 NERV Task 로 바뀌었다. 스펙이 NERV 로 옮겨지면서(전환 단계 1) 아래 전제가 바뀌었다. 전환 단계 5 에서 옛 트리를 지웠고 저장소 `spec/` 에는 미러만 남았다. 이 절은 바뀐 전제만 적는다. 바뀐 전제에 맞춘 규칙은 규칙 19 ~ 22 다.

| 규칙 | 옛 전제 | NERV 에서 바뀐 점 |
| --- | --- | --- |
| 적용 대상(경로 포함 목록·basename 제외) | 스펙을 저장소 경로와 파일 이름으로 식별했다 | NERV 문서는 키(`CLE-…`)·종류(`vision`·`area`·`feature`·`design`·`convention` 등)·트리의 부모로 식별한다. 경로와 basename 이 없다. 전환 단계 5 에서 경로 포함 목록과 basename 제외를 옛 트리와 함께 걷었다. 지금 적용 대상은 미러 문서 가운데 `## 구현 위치` 절이 있는 문서다([적용 대상](#적용-대상)) |
| frontmatter `id` | basename 기반 kebab-case | NERV 문서 키가 식별자다. NERV 로 옮긴 문서 본문에는 frontmatter 가 없다. 옛 트리 frontmatter 는 전환 단계 5 에서 옛 트리와 함께 걷었다 |
| 옛 스펙 상태 `status`(5 값) | 구현 단계를 뜻했다 | NERV 문서 상태(`doc_status`: `draft`·`in_review`·`approved`)는 문서 승인 단계다. 이번 이전에서 구현 단계는 본문 머리 줄의 "구현 상태"(구현됨·부분 구현·미구현 세 값)로 옮겼고 `feature` 문서의 요구사항 줄에는 `(미구현)`·`(부분 구현)` 표시를 붙였다. `backlog` 와 `spec-only` 의 구분, `archived` 에 해당하는 값은 머리 줄에 없다. 옛 트리의 `status` 는 전환 단계 5 에서 옛 트리와 함께 걷었다 |
| `code:` 와 `spec-code-paths` 가드 | frontmatter 글로브가 파일에 매치하는지 빌드가 검사했다 | 이번 이전에서 `code:` 는 본문의 `## 구현 위치` 절(텍스트)로 옮겼다. 전환 단계 5 에서 `spec-code-paths` 를 `spec-impl-locations` 로 바꿨다(규칙 19 · 20, R-16). NERV 에서 구현 작업은 스펙 버전에서 나온 Task 가 맡고 Task 를 완료(`done`)하려면 증적(`evidence`)이 있어야 한다. 증적 종류는 `code_path`·`test`·`pr`·`commit`·`review`·`user_guide` 여섯이다. done 전이는 그 Task 에 묶인 `code`·`consistency` 리뷰 라운드가 판정을 통과했는지도 본다(프로젝트 정책 `done_gate.review_coverage`) |
| spec-linked 변경의 구현 완료 검토 | `code:` 글로브에 걸린 파일을 고친 브랜치는 `--impl-done` 검토가 있어야 push 됐다(리뷰 게이트의 spec 정합 검사) | 전환 단계 2 에서 그 검사가 없어졌다. 대신 NERV done 게이트가 Task 에 묶인 consistency 라운드를 요구한다. 그 게이트는 라운드가 있고 통과했는지만 보고 라운드가 어떤 문서를 대상으로 했는지는 보지 않는다. 그래서 `## 구현 위치` 에 적힌 파일을 고친 변경이 그 문서와 대조된다는 강제된 보장은 없다. 일관성 검토의 `--impl-done` 을 돌리면 `## 구현 위치` 가 바뀐 파일을 덮는 문서가 검토 대상에 든다(2026-10-03, NERV Task `CLE-T-VP5KDJ`). 이 대조에 기댄 Rationale([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) R-CC-22, [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) «전용 e2e 가드를 구현 위치에 나열한 이유»)도 같은 강도로 적는다(두 Rationale 은 2026-10-03 승인본에서 「`--impl-done` 을 돌릴 때 대조 대상에 든다」는 서술로 이미 고쳤다. NERV Task `CLE-T-VP5KDJ`) |
| `pending_plans:` 와 plan 실존 가드 | 미구현 표면을 plan 파일 경로로 가리켰다 | NERV 는 구현 작업을 Task 로 추적한다. Task 는 기준 스펙 버전(`spec_key`·`version_no`)을 가진다. 전환 단계 3 에서 `plan/` 과 그 가드(`spec-pending-plan-existence`)를 지웠다 |
| `user_guide:` | 가드 없는 선언용 cross-link | NERV Task 증적 종류에 `user_guide` 가 있다. 옛 트리의 `user_guide:` 는 전환 단계 5 에서 옛 트리와 함께 걷었다 |
| Gate C `spec_impact` | 완료 plan frontmatter 에 선언했다 | NERV Task 의 `done` 전이가 `spec_impact` 선언을 요구한다. 값은 바꾼 스펙 목록(`{changed: [...]}`)이나 `{none: true}` 이고 비어 있으면 게이트가 막는다. 전환 단계 3 에서 `plan/` 과 그 가드(`spec-plan-completion`)를 지웠다 |
| `backlog` 가드 | `id` 가 저장소 `spec/0-overview.md` 본문에 나오는지 봤다 | 0-overview 의 내용은 NERV 에서 [Clemvion 제품 개요](../CLE-VISION.md) 와 여러 영역 문서로 나뉘었다. 전환 단계 3 에서 이 가드(`spec-status-lifecycle`)를 지웠다 |
| 링크 무결성 가드 범위 1 | 스펙 본문의 저장소 상대 경로 링크와 헤딩 slug 를 대조했다 | 전환 단계 5 에서 옛 트리와 함께 걷었다. NERV 는 본문에서 문서 키(`CLE-…`)를 대상으로 하는 마크다운 링크만 읽어 references 관계를 만든다. 없는 문서를 가리킨 링크는 저장 응답의 `relations.unknown` 으로 알린다. 앵커(`#…`)는 관계 판정에서 무시한다 |
| 링크 무결성 가드 범위 2 | 코드 주석이 저장소 `spec/**.md` 파일을 상대 경로로 가리켰다 | 전환 단계 4c(NERV Task `CLE-T-9AM31N`)에서 키 링크(`[글](<키>#앵커)`)로 바꿨다. 키와 앵커는 저장소 미러 파일로 확인하고 `spec/**.md` 경로 링크는 위반으로 본다(R-14) |
| 영역 index 가드 | 영역 폴더마다 index 문서가 형제 문서를 링크했다 | NERV 는 `area` 종류 문서와 트리의 부모 관계로 영역을 묶는다. 이번 이전에서 `area` 문서는 자식 문서 목록을 `## 문서` 절에 둔다. 전환 단계 5 에서 이 가드(`spec-area-index`)를 걷었다 |
| 저장소 미러와 링크 · 영역 index 가드 | 저장소 `spec/` 에는 옛 트리만 있었다 | 전환 단계 1 부터 NERV 미러(`spec/<영역 키>/<KEY>.md` · `spec/README.md`)가 옛 트리 옆에 있었고 두 가드는 미러를 대상에서 뺐다(R-12). 전환 단계 5 에서 옛 트리를 지웠다. 저장소 `spec/` 에는 미러만 있다. 미러 무결성은 `.claude/tools/nerv-mirror/pull.py --check`(CI `spec-mirror-integrity`)가 본다 |
| Gate D spec-coverage | 산출물을 `review/spec-coverage/**` 에 커밋했다 | 전환 단계 2 부터 산출물을 로컬 `.review/spec-coverage/**` 에 두고 커밋하지 않는다. NERV 리뷰 레코드의 종류(`kind`)에 `spec_coverage` 가 있다. 감사기 SUMMARY 의 후보 하나가 info 발견 하나가 되어 역할 `spec_coverage` 로 제출되므로 라운드를 막지 않는다(2026-10-03, NERV Task `CLE-T-VP5KDJ`). 제출 절차는 저장소 `.claude/skills/spec-coverage/SKILL.md` 가 정한다. NERV 리뷰는 저장소에 파일로 커밋하지 않는다([리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md)). 전환 단계 5 에서 감사 대상을 옛 트리 frontmatter `code:` 에서 미러의 `## 구현 위치` 로 옮겼다([적용 대상](#적용-대상)) |
| 스펙 편집 경로 | 사람이 저장소 `spec/` 파일을 직접 고쳤다 | NERV 플러그인의 스펙 스킬은 저장소 `spec/**` 를 NERV 가 내보낸 읽기 전용 미러로 보고 직접 편집을 금지한다. 스펙 변경은 초안 저장·사전 검토(`nerv_spec_check`: cross-spec·rationale-continuity·convention-compliance·requirement-shape·task-coherence 5개 검사기)·사람 승인 경로로 한다 |

## 구현 위치

- `codebase/frontend/src/lib/docs/__tests__/spec-impl-locations.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/impl-locations.ts` (`## 구현 위치` 절 파서 · 경로 판정)
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-keys.ts` (`mirrorKeyPaths` · `SPEC_KEY_RE`. 키 링크의 키를 미러 파일로 잇는다)
- `codebase/frontend/src/lib/docs/__tests__/spec-keys.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` · `codebase/frontend/src/lib/__tests__/public-surface-internal-refs.test.ts` (교차 참조. `SPEC_KEY_RE` 와 같은 키 모양을 쓴다. 모양을 바꿀 때 함께 고친다)
- `codebase/frontend/src/lib/docs/__tests__/codebase-mentions.ts` (링크가 아닌 언급을 세는 공용 순회. `legacy-path-ratchet` · `spec-key-mentions` 와 [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md) 규칙 9 · 10 을 보는 `review-citation-form` 이 함께 쓴다. 고칠 때 세 가드의 영향을 본다. R-15)
- `codebase/frontend/src/lib/docs/__tests__/legacy-path-ratchet.test.ts` · `legacy-path-ratchet.baseline.json`
- `codebase/frontend/src/lib/docs/__tests__/spec-key-mentions.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts` (디렉터리 순회기. `codebase-mentions.ts` · `spec-keys.ts` 도 이 순회기를 쓴다)
- `codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts`
- `.claude/tools/nerv-mirror/pull.py` (`--check`, CI `spec-mirror-integrity`)
- `.claude/skills/spec-coverage/scripts/spec_coverage_orchestrator.py` (감사 대상 선택) · `.claude/tests/test_spec_coverage_prompt.py` (「적용 대상」 과 대조)
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` (교차 참조. `--impl-done` 의 구현 위치 대조. 「적용 대상」 셋째 항목)
- `codebase/backend/src/repo-guards/__tests__/openapi-internal-ref-guard.ts` · `openapi-internal-ref.spec.ts` 와 대조군 `fixtures/openapi-internal-ref/**` (교차 참조. 범위 2 의 공개 OpenAPI 예외를 지키는 백엔드 가드다. 기준은 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17. 키 패턴은 `SPEC_KEY_RE` 와 같은 모양의 사본이라 함께 고친다. 옛 `plan/` 경로는 `plan/in-progress/` · `plan/complete/` 둘만 센다. `public-surface-internal-refs` 도 같다. `legacy-path-ratchet` 은 `plan/research/` 까지 센다)

## Rationale

### R-1. `code:` 에 글로브를 허용한다

옛 frontmatter `code:` 의 결정이다. 같은 이유로 규칙 20 도 글로브를 허용한다. 명시 파일만 받는 안 대신 글로브를 허용했다. 영역 단위 책임(예: `codebase/backend/src/modules/chat-channel/**`)을 자연스럽게 적을 수 있고 옮기는 부담이 적다. 단점은 stale 글로브다. 없어진 파일을 가리키던 글로브가 다른 파일에 매치해 통과하는 경우를 이 가드만으로는 못 잡는다. 이 약점은 `/spec-coverage` 정기 감사가 보완한다. NLP 휴리스틱으로 스펙 본문이 약속한 UI·API 표면에 맞는 코드가 없는지 찾는다.

### R-2. `spec-only` TTL 90일과 `backlog` 값

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

`spec-only` TTL 90일과 `backlog` 값 신설로 안전망을 둘 뒀다.

- 30일 같은 짧은 TTL 은 backlog 항목까지 억지로 분류하게 해 거짓 압박을 만든다.
- 90일은 스펙을 쓴 뒤 분기에 한 번 검토하는 주기다. Phase 를 나누는 결정 주기와 맞는다.
- `backlog` 는 `id` 가 `0-overview.md` 본문에 나오도록 가드로 강제해 아무렇게나 보류하는 것을 막는다(§6.3 로드맵 등재 권장. 가드 매칭 세부는 R-3).

TTL 과 `backlog` 등재 가드는 전환 단계 3 에서 걷었다(R-13).

### R-3. `backlog` 값을 새로 둔 근거

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

0-overview §6.3 로드맵 항목(마켓플레이스, 고급 권한 모델 등)은 결정 뒤 스펙을 썼지만 구현 plan 은 분기나 해 단위 뒤에 나오는 것이 자연스럽다. 이런 문서를 `spec-only`(90일 카운터)와 떼어 카운터 압박에서 보호한다([Clemvion 제품 개요](../CLE-VISION.md)).

가드: `backlog` 의 `id` 가 `0-overview.md` 본문 텍스트에 `includes` 로 매칭돼야 한다. 걷기 전 구현은 §6.3 절에 한정하지 않고 문서 전체 텍스트를 검사했다. 로드맵 항목에 올리는 것을 권장한다. §6.3 절 단위로 좁히려면 가드를 고쳐야 한다. 이 가드는 전환 단계 3 에서 걷었다(R-13).

### R-4. `archived` 라는 이름 (Cafe24 `deprecated` 와 구분)

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

`archived` 로 이름을 지어 [Cafe24 API 카탈로그](CLE-C24-CATALOG) 의 `deprecated`(Cafe24 endpoint 폐기 상태)와 뜻을 분명히 갈랐다.

- 이 규약의 `archived`: 스펙 문서 자체의 폐기
- Cafe24 `deprecated`: 외부 API endpoint 의 폐기(다른 영역)

### R-5. `status: partial` 에 `pending_plans:` 를 의무로 둔다 (plan 라이프사이클을 거꾸로 강제)

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

기존 plan 라이프사이클은 plan 이 스펙을 가리키는 한 방향이었다(plan frontmatter `worktree`, plan 본문이 스펙 참조). 이 규약은 거꾸로 스펙이 자기를 책임지는 plan 을 가리키게 한다(`pending_plans:`).

근거: Telegram 채팅 채널 사례에서 스펙이 plan 을 가리키지 않아 "어떤 plan 도 책임지지 않는 빈 약속" 으로 오래 빠져 있었다. 거꾸로 가는 링크가 있었으면 plan 추적이 자연스럽게 찾아냈을 것이다. `spec-pending-plan-existence.test.ts` 가 스펙에서 plan 으로 가는 링크의 유효성을 강제했다. 전환 단계 3 에서 `pending_plans:` 와 이 가드를 걷었다. 같은 빈 약속은 이제 NERV Task 가 막는다(R-13).

### R-6. `code:` 의 뜻 (스펙 frontmatter 와 가이드 MDX)

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

두 곳 모두 `code:` 키가 있다. 뜻은 비슷하지만 검증 가드가 나뉜다.

- 가이드 MDX `code:` → `registry.test.ts`. 가이드가 **설명하는** 코드(참조용)
- 스펙 `.md` `code:` → `spec-code-paths.test.ts`. 스펙이 **약속한** 구현 표면(책임용)

같은 키를 검증하지만 대상 문서(`*.mdx`, `*.md`)가 다르고 검증 강도도 다르다. 가이드 `code:` 는 항목마다 실재해야 하고(글로브 불가) 스펙 `code:` 는 `implemented`·`partial` 일 때 글로브가 1개 이상 매치하면 된다. 같은 이름이지만 다른 불변식이라 합치지 않는다.

(2026-10-03 정정: 승인본 v2 는 "가이드는 stale 을 허용하고 스펙은 `implemented`/`partial` 일 때 매치가 의무다" 라고 적었다.)

### R-7. API 카탈로그의 필드 파일을 뺀다 (`<name>-api-catalog/<resource>/**`)

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

`spec/conventions/cafe24-api-catalog/<resource>/<entity>.md` 같은 필드 단위 카탈로그는 외부 API 문서를 기계로 뽑은 **생성기 산출물**(카탈로그 개요의 `_generator.py`)이다. frontmatter 는 `resource`/`entity`/`cafe24_docs`/`source` 다. 제품 표면의 구현 라이프사이클(`backlog`→`implemented`)을 추적하는 정식 스펙이 아니다. 그래서 `id`/`status` 를 주는 것은 (a) 추적할 구현 라이프사이클이 없어 뜻이 맞지 않고 (b) 생성기가 다시 만들 때마다 수백 개 파일에 의미 없는 메타를 찍어야 해 유지보수 부담이다.

반면 카탈로그 최상위 `<resource>.md` 인덱스(`application.md` 등 18개)는 해당 리소스군의 메타데이터 구현(`code:`)을 약속하는 정식 스펙이라 `id` 와 `status: implemented` 가 있고 검증을 유지한다. 그래서 제외는 카탈로그 디렉터리 뒤에 경로 세그먼트가 하나 더 있는 중첩 경로(`<name>-api-catalog/<resource>/…`)로 한정한다. `_*.md`(밑줄 접두, leaf 아님) 제외와는 논리가 다르다(생성물과 layout·index). 그래서 따로 항목을 둔다. 가드 구현은 `spec-frontmatter-parse.ts` 의 `CATALOG_FIELD_FILE` 정규식이 제외 목록과 맞춘다.

카탈로그는 전환 단계 4a(NERV Task `CLE-T-BD48J3`)에서 저장소 `codebase/api-catalogs/` 로 옮겼다. 그래서 지금 `spec/` 아래에는 이 제외에 걸리는 파일이 없다.

### R-8. Gate C — plan 완료 시점에 `spec_impact` 선언을 의무로 둔다

원안(옛 plan `spec-drift-gates.md` §C, git 이력)은 "완료 plan 이 건드린 `code:` 코드가 바뀌었으면 스펙 갱신을 강제" 였다. 빌드 테스트가 "어떤 코드를 건드렸나" 를 알려면 git 이력을 분석해야 해 깨지기 쉽다. 대신 **plan frontmatter `spec_impact` 선언**으로 바꿨다. 완료할 때 작성자가 정합 결정(스펙 경로 목록 또는 `none`)을 밝히고 빌드 테스트는 그 선언의 유무와 실존만 결정적으로 검증한다.

- **grandfather cutoff `2026-06-04`**: 기존 백로그 수십 개를 소급해 강제하면 대량으로 빨간불이 난다. `started ≥ cutoff` 인 새 plan 부터 적용한다. `spec-only` TTL 과 같은 날짜 cutoff 패턴(R-2)이라 선례와 맞는다. cutoff 값은 세 곳에 같게 둔다(규칙 16).
- **no-op 표시(`none`/`없음`/`n/a`/`na`)를 택하고 빈 문자열을 버렸다**: 빈 값은 "쓰지 않음(누락)" 과 "의도적 no-op" 을 가르지 못해 게이트의 의도(의식적 결정 강제)를 약하게 한다. 명시 표시여야 "검토했고 바꿀 것 없음" 이 드러난다.
- **분류**: plan/complete frontmatter 를 검증하므로 frontmatter 근거 가족(스펙 frontmatter)이 아니라 plan 무결성 가족이었다.

전환 단계 3 에서 Gate C 를 걷었다. 같은 선언을 NERV Task 의 `done` 전이가 요구한다(R-13).

### R-9. 스펙 문서 저장소·plan 무결성 가드를 별도 가족으로 둔다

링크 무결성·영역 index·plan frontmatter·plan 완료(Gate C) 가드는 frontmatter 근거 가드(스펙이 약속한 표면의 구현 근거)와 **검증 대상이 다르다**. 스펙·plan 문서 자체의 구조와 연결의 무결성을 본다. 그래서 한 표에 섞지 않고 별도 가족으로 둔다.

- **이 문서를 기준으로 삼은 이유와 기각한 대안**: (a) 새 규약 문서로 떼기. 가드 4건에 새 스펙 파일은 과하고 frontmatter 근거와 가까운 영역이라 한 문서에 두는 편이 응집적이다. (b) `plan-lifecycle.md` 에 합치기. plan frontmatter 만 plan 영역이고 링크·영역 index 는 스펙 영역이라 맞지 않는다. 그래서 이 문서에 묶되 `plan-frontmatter` 가드의 **규약** 기준만 `plan-lifecycle.md`(git 이력) §4 에 맡겼다(필드 정의가 거기 있었다).
- **전환 단계 3 뒤**: plan frontmatter · Gate C 가드를 걷어 이 가족에는 스펙 문서 저장소 가드만 남았다(R-13).
- **전환 단계 4g 뒤**: 코드 쪽에서는 링크만 보던 이 가족이 링크가 아닌 언급(옛 경로 · 키)까지 본다(R-14 · R-15). 언급 가드를 이 문서에 둔 것은 규칙 18 의 키 링크 규약이 이 문서 소관이고 R-14 가 코드 주석 범위를 이미 이 문서에 두었기 때문이다.
- **전환 단계 5 뒤**: 영역 index 가드와 링크 무결성 가드 범위 1 을 옛 트리와 함께 걷었다. frontmatter 근거 가족은 구현 위치 근거 가족(`spec-impl-locations`)으로 바뀌었다(R-16).
- **Gate D 를 권고로 둔 이유**: NLP 휴리스틱의 거짓 양성 부담을 빌드 차단으로 지우면 마찰이 가치를 넘는다(`.claude/skills/spec-coverage/SKILL.md` R-1 과 같은 판단). 보고형으로 둔다.

### R-10. `user_guide:` 에는 빌드 가드를 두지 않는다 (선언용 cross-link)

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

`user_guide:` 는 `code:` 와 달리 빌드 경로 실존 가드 대상이 아니다(`pending_plans:` 는 전환 단계 3 에서 걷기 전까지 가드 대상이었다). frontmatter 근거 가드 표에 들어가지 않는다. 근거는 셋이다.

- `code:` 는 스펙이 약속한 구현 표면이라 stale 경로가 "약속과 구현" 정합(이 규약의 핵심 불변식)을 바로 해친다. 빌드 차단 가치가 마찰보다 크다. `user_guide:` 는 가이드 페이지로 가는 선언용 cross-link 일 뿐이라 경로가 stale 이어도 스펙의 표면 정의와 라이프사이클 추적을 해치지 않는다.
- 가이드와 스펙의 정합은 다른 방향의 가드(`registry.test.ts` = MDX `spec:`/`code:` 실존, [사용자 가이드 근거 규약](CLE-ENG-GUIDEEVIDENCE.md) 가족)가 이미 맡는다. `user_guide:` 에 가드를 더하면 같은 관계를 양방향으로 두 번 강제해 유지보수 부담만 는다.
- 그래서 `user_guide:` 는 가드 없이 두고 오기는 리뷰와 `/consistency-check` 의 휴리스틱 검토에 맡긴다. 가이드 경로 stale 이 실제 문제로 드러나면 전용 가드(`spec-user-guide-paths.test.ts`)를 무결성 가족에 더하고 필드 정의 표와 가드 표를 함께 고친다.

### R-11. 공유 트래커를 가리키는 `partial` 의 승격 시점

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

[R-5](#r-5-status-partial-에-pending_plans-를-의무로-둔다-plan-라이프사이클을-거꾸로-강제) 의 거꾸로 가는 링크는 "어떤 plan 도 책임지지 않는 빈 약속" 을 막으려고 있다. 그런데 트래커 파일 하나가 여러 문서의 `pending_plans` 에 걸리면 문제가 생긴다. 이 규칙을 세운 2026-09-18 에 스펙 4개([워크플로우 목록과 폴더](../CLE-WF/CLE-WF-LIST.md)·[트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)·[시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md)·[채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 의 원문 파일)가 같은 트래커를 가리켰다. 이때 파일 이동을 승격 신호로 쓰는 전이 규칙은 **이미 구현된 문서를 트래커가 닫힐 때까지 `partial` 로 묶어** 반대 방향의 거짓을 만든다. 그래서 신호를 파일에서 그 문서 몫의 항목으로 옮겼다. 빈 약속을 다시 만들지 않도록 판정 기준은 필드 정의의 "미구현 표면" 으로 고정했다.

가드가 보던 자리를 사람이 본다. `spec-status-lifecycle.test.ts` 는 "전부 `complete/` 면 승격" 만 강제하므로 이 방향의 승격은 기계가 검사하지 않는다. 그래서 판정 근거(열린 항목 전부와 항목별 분류)를 승격 커밋에 남기게 했다.

이해상충도 밝혀 둔다. 이 규칙의 첫 적용 대상은 규칙을 세운 같은 변경의 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 원문이다. 트리거 삭제 때 자원 정리 하나 때문에 `partial` 로 내려갔다가 그 구현이 머지된 뒤 올라갔다. 규칙을 결론에 맞춰 만들었다는 의심을 덜려고 판정(열린 항목 6개 전부, 미구현 표면 0)을 규칙 없이도 따라갈 수 있게 옛 plan `spec-draft-deletion-release-current-tense.md`(git 이력)에 표로 남겼다. 또 그 문서는 같은 항목들이 열린 채로 2026-09-05~09-17 에 이미 `implemented` 였다. 규칙이 새 결론을 만든 것이 아니라 트리거 정리 전 상태로 되돌린 것이다.

전환 단계 3 에서 `pending_plans` 와 함께 이 규칙(규칙 12)도 걷었다(R-13).

### R-12. NERV 미러를 링크 무결성 · 영역 index 가드에서 뺀다 (전환 단계 1)

NERV 정본 전환 단계 1 에서 저장소 `spec/` 에 NERV 미러 169편(영역 문서와 그 아래는 `spec/<영역 키>/<KEY>.md`, 영역 밖 문서는 `spec/<KEY>.md`)과 `spec/README.md` 가 옛 트리 옆에 들어왔다. 미러를 두 가드에 그대로 태우자 49건이 빨간불이 됐다(영역 폴더마다 index 문서 없음, 링크 무결성). 미러가 옛 트리 규칙을 따르게 만드는 안은 기각했다.

- 카탈로그 영역은 미러하지 않아서 카탈로그 영역의 스펙 키(`CLE-C24-…` · `CLE-MKS-…`)를 가리키는 링크 125개가 풀리지 않는다.
- 앵커 1,372개(다른 문서 530 · 같은 문서 842)가 옛 가드의 slug 규칙과 맞는지 보장할 수 없다. NERV 는 앵커를 관계 판정에서 무시한다.
- 영역 index 규칙은 폴더마다 목차 파일을 요구한다. 미러는 구현 PR 이 조금씩 갱신하는 스냅샷이라 폴더 목차가 병렬 PR 의 충돌 지점이 된다.

그래서 미러는 두 가드의 대상에서 빼고, 무결성은 미러 도구의 `--check` 로 본다. 이 검사는 파일 지문 `mirror_sha256`(frontmatter 의 그 줄을 뺀 파일 전체), 파일 위치, 자리가 어긋난 미러 링크(대상 파일이 없는데 같은 키의 미러가 다른 자리에 있다)를 본다. 미러 자리(`spec/CLE-*` 와 미러 폴더 안)의 심볼릭 링크와 미러가 아닌 파일도 본다. 두 가드가 그 자리를 통째로 빼므로 거기 놓인 다른 파일은 이 검사 말고는 아무도 보지 않는다. 대상이 미러에 없는 링크는 보지 않는다. 미러는 구현 PR 이 조금씩 받는 부분 스냅샷이기 때문이다. 링크 대상의 실재는 NERV 가 저장할 때 `relations.unknown` 으로 알린다. 옛 트리를 지우는 전환 단계 5 에서 두 가드의 옛 트리 범위와 이 예외를 함께 정리한다. 전환 단계 5 에서 옛 트리를 지워 제외할 대상이 없어졌다. 제외 판정(`inNervMirror` · 일관성 검토 오케스트레이터의 `is_nerv_mirror`)과 세 판정 동치 테스트를 함께 걷었다(R-16).

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
- `partial` 승격(규칙 11)은 보는 가드 없이 전이 규칙을 따른다. 전이 규칙은 전환 단계 5 에서 옛 상태 라이프사이클과 함께 걷었다(R-16).
- `spec-only` TTL(규칙 9)과 `backlog` 등재(규칙 10)는 대신하는 장치 없이 걷었다. 이 두 갈래는 plan 경로를 읽지 않고 옛 트리 frontmatter 의 `status` 와 `spec/0-overview.md` 를 읽었다. NERV 에서 문서 머리 줄의 "구현 상태" 와 영역 문서로 바뀐 전제라 같은 PR 에서 함께 걷었다. 이 시점 옛 트리의 `spec-only` 는 문서 예시뿐이고 `backlog` 는 1건이다.

(2026-10-03 정정: 승인본 v2 는 "대체 없이 끈 가드는 없다" 고 적었다.)

약해지는 곳도 있다. "`partial` 인데 남은 표면을 맡은 작업이 없음"(R-5 가 막던 빈 약속)은 이제 기계가 잡지 못한다. 남은 표면은 구현 PR 이 NERV Task 를 만드는 절차(developer SKILL 의 partial-implementation 분리)와 리뷰가 지킨다.

옛 트리 파일에 남은 `pending_plans:` 값은 이제 읽는 가드가 없고 대상 plan 도 없다. 그 값은 단계 5 에서 옛 트리와 함께 지웠다(R-16). 이 문서의 Rationale 이 가리키는 옛 plan 문서(R-8 · R-9 · R-11)는 단계 3 삭제 커밋 직전 이력에서 `git show <삭제 커밋>^:<경로>` 로 읽는다.

링크 무결성 가드 범위 1 이 루트 `plan/` · `review/` 로 해석되는 링크를 건너뛰는 것도 같은 이유다(규칙 17). 동결된 옛 트리를 고치지 않고 단계 5 에서 지울 때까지 두었다. 이 면제는 범위 1 과 함께 걷었다(R-16). 해석한 경로로 판정해 루트가 아닌 같은 이름 폴더는 그대로 검사한다. 거버넌스 문서에는 이 면제를 두지 않았다. 살아 있는 문서라 링크를 고칠 수 있다.

### R-14. 코드 주석은 스펙을 키 링크로 가리킨다 (2026-10-03)

NERV 정본 전환 단계 4c(NERV Task `CLE-T-9AM31N`)에서 링크 무결성 가드 범위 2 를 바꿨다. 그 전에는 코드 주석이 `spec/**.md` 를 상대 경로로 링크했고 가드는 그 대상 파일과 앵커를 확인했다. 지금은 코드 주석이 키 링크 `[글](<키>#앵커)` 로 스펙을 가리킨다(규칙 18). 경로 링크는 대상이 있어도 위반이다.

경로 링크를 그만 쓴 이유는 셋이다.

- 상대 경로의 `../` 깊이를 코드 파일 위치마다 손으로 세야 했고 파일을 옮길 때마다 고쳐야 했다. 틀리면 `DEAD` 로 빌드가 깨졌다.
- 옛 트리는 전환 단계 5(NERV Task `CLE-T-7M4C4X`)에서 지웠다. 옛 트리를 가리키는 경로 링크는 그때 모두 끊겼다(R-16).
- 미러 파일을 경로로 가리켜도 `../` 깊이는 손으로 세야 한다. 문서가 다른 영역으로 옮기면 미러 경로도 바뀐다. 키는 바뀌지 않는다.

키 링크는 NERV 본문의 링크 표기와 같다. 그래서 스펙 본문과 코드 주석이 같은 표기로 문서를 가리킨다.

키와 앵커는 미러 파일로 확인한다. NERV 는 앵커를 관계 판정에서 무시하므로(R-12) 코드 주석의 앵커가 맞는지는 저장소에서 확인해야 한다. 저장소에서 키와 앵커를 확인할 수 있는 파일은 미러뿐이다. 그래서 키 링크의 대상은 미러에 있어야 한다. 미러는 구현할 때 받은 문서만 담는 부분 스냅샷이므로 미러에 없는 키를 새로 링크하려면 같은 PR 에서 그 문서를 미러로 받는다. 미러 안의 링크는 대상이 미러에 없어도 넘긴다(R-12). 그 링크는 NERV 가 저장할 때 대상을 확인하기 때문이다. 코드 주석은 NERV 를 거치지 않으므로 이 가드가 확인한다.

앵커의 확인 대상은 미러 스냅샷의 제목을 github-slugger 로 바꾼 slug 다. NERV 화면의 앵커와 같다는 보장은 없다(R-12). 미러를 새로 받는 PR 에서 제목이 바뀌어 코드 주석의 앵커가 `ANCHOR` 로 깨지면 그 PR 에서 함께 고친다. 병렬 PR 사이의 앵커 어긋남(한쪽이 미러 제목을 바꾸고 다른 쪽이 옛 앵커를 넣음)은 main CI 가 잡고 나중에 머지한 쪽이 고친다.

키를 미러 파일로 확인한다는 점은 사용자 가이드 프론트매터 `spec:` 의 키 확인(전환 단계 4b, [사용자 가이드](../CLE-UI/CLE-UI-GUIDE.md))과 같다. 다른 점도 있다. 가이드 `spec:` 는 미러하지 않는 카탈로그 영역의 키(`CLE-C24-META` · `CLE-MKS-META`)를 이름 목록 `UNMIRRORED_GUIDE_KEYS` 로 허용한다. 코드 주석의 키 링크에는 그런 허용 목록이 없다. 그래서 카탈로그 영역의 스펙 키를 키 링크로 쓰면 `KEY` 위반이다.

공개 OpenAPI 채널은 예외다. `*.dto.ts` · `*.controller.ts` 의 `/** */` 블록(클래스 · 멤버 · 파일 수준 선언)과 데코레이터 `description` · `summary` 문자열은 공개 OpenAPI 채널로 본다. 외부 소비자는 키를 열어 볼 수 없으므로 그 자리에는 링크 없는 키도 포함해 키를 쓰지 않는다. 근거는 바로 위 `//` 주석에 키 링크로 적는다([OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17). 두 파일 종류의 `/** */` 는 [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md) 이 응답 DTO 파일의 `/** */` 를 한 채널로 다룬 것과 같은 이유로 넓혔다. 리뷰 인용 쪽 강제 가드의 경계는 응답 DTO 파일로 남아 있다. 링크 가드는 키 링크의 대상이 있는지만 보고 공개 채널에 키가 들어갔는지는 백엔드 가드 `openapi-internal-ref` 가 본다.

단계 4c 에서 경로 링크 43개(22파일)를 키 링크로 바꿨다. 그중 하나는 가드 자신의 설명에 든 예시다. 옛 문서 하나가 여러 NERV 문서로 나뉜 경우가 있었다. 이때는 미러 frontmatter 의 `source_paths` 로 후보 문서를 뽑았다. 그다음 옛 절의 내용을 읽고 새 문서와 제목을 골랐다. 경로만으로는 그 절이 어느 문서로 갔는지 정할 수 없기 때문이다. 바꾼 앵커는 모두 미러 제목과 대조했다.

거버넌스 문서(범위 3)는 상대 경로 링크를 이전처럼 대상 파일과 제목으로 확인한다. 키 링크가 있으면 범위 2 와 같은 방법으로 미러에서 확인한다. 범위 1(옛 스펙 트리 본문)은 그때 바꾸지 않았고 단계 5 에서 옛 트리와 함께 걷었다(R-16).

이 가드는 마크다운 링크만 본다. 링크가 아닌 언급은 R-15 의 두 가드가 본다.

### R-15. codebase 의 옛 경로는 래칫으로 막고 고칠 때 바꾼다 (2026-10-03)

NERV 정본 전환 단계 4g(NERV Task `CLE-T-M7K35H`)에서 링크가 아닌 언급을 보는 가드 두 개를 더했다. 옛 스펙 트리는 전환 단계 5 에서 지웠다. 그 트리를 경로로 적은 줄은 그때 모두 대상을 잃었다.

한꺼번에 키로 바꾸는 안은 전환 계획에서 기각했다(주석 속 옛 경로는 래칫으로 막는다는 결정, NERV Task `CLE-T-M7K35H`). 계획은 옛 경로 언급이 늘지 않게만 막기로 정했다. 계획을 세운 2026-09-28 에 codebase 의 옛 경로 언급은 1,990줄 · 860개 파일이었다. `.md` 로 끝나는 경로만 센 값이다. 그 절반쯤은 여러 NERV 문서로 갈라진 옛 파일을 § 번호와 함께 가리킨다. 대부분의 NERV 제목에는 번호가 없다. 번호가 있어도 옛 § 번호와 1:1 로 대응하지 않는다. 그래서 기계로 옮길 수 없다. 860개 파일을 한 번에 고치면 리뷰할 범위도 지나치게 커진다. 전환 단계 4c 에서는 공개 표면과 경로 링크 43개만 바꿨다(R-14). 나머지는 늘지 않게만 막는다. 파일을 고칠 때 그 파일의 언급을 바꾼다.

- **옛 경로 래칫** `legacy-path-ratchet`: 래칫(ratchet)은 여기서 파일별 기준값보다 늘거나 줄면 실패하는 판정을 말한다. 이 가드는 옛 스펙 트리 경로를 적은 줄과 지운 `plan/` 경로를 적은 줄을 파일별로 세어 기준값과 견준다. 줄었는데 기준값을 그대로 두면 줄어든 만큼 새 언급이 늘어도 실패하지 않는다. 그래서 줄어도 실패로 본다. 백엔드 · 프론트엔드 타입체크 래칫(`scripts/_typecheck_ratchet.py`)과 같은 판정이다. 형제 래칫 `hardcoded-korean-ratchet` 은 판정이 다르다. 그 래칫은 기준값보다 줄면 통과하고 낡은 기준값에는 경고만 낸다.
- **세는 경로**: 옛 스펙 트리 경로는 옛 트리의 최상위 이름(`spec/<번호>-<영역>/` · `spec/conventions/` · `spec/data-flow/` · 루트 `spec/<번호>-<이름>.md`)으로 시작하는 경로다. 확장자는 요구하지 않는다. `.md` 를 뺀 인용(`spec/5-system/13-replay-rerun §7.2`), 줄 끝에서 끊긴 경로, 영역 이름만 적은 언급(`spec/7-channel-web-chat`), 글로브도 단계 5 뒤에는 가리킬 대상이 없기 때문이다. NERV 미러 경로(`spec/CLE-*` · `spec/README.md`)는 이 이름에 들지 않는다. `spec/` 없이 파일 이름만 적은 언급(`review-citations.md §3`)은 세지 않는다. 지운 `plan/` 경로는 `plan/in-progress/` · `plan/complete/` · `plan/research/` 로 시작하는 경로다.
- **`plan/` 경로도 세는 이유**: `plan/` 은 전환 단계 3 에서 지운 트리라 옛 스펙 경로와 같은 문제가 있다. 남은 작업은 NERV Task 키(`CLE-T-…`)로 가리킨다. 끝난 일은 PR 번호나 커밋으로 가리킨다. 리뷰 지적을 가리키던 줄은 [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md) 을 따른다. 옛 커밋 산출물 `review/<종류>/<날짜>/<시각>` 인용은 그 규약의 규칙 1 이 유지하는 인용이라 래칫 밖이다.
- **기준값**: 들일 때 기준값은 옛 스펙 경로 1,729줄 · 722개 파일과 `plan/` 경로 116줄 · 93개 파일이다(2026-10-03). 확장자 없는 인용까지 센 값이다. 계획의 1,990줄보다 적은 것은 그 뒤 전환 단계 4c 가 경로 링크 43개를 키 링크로 바꾸는 등으로 언급이 줄었기 때문이다.
- **적용된 마이그레이션**: `V*.sql` · `V*.conf` 의 언급은 고치지 않는다. [DB 마이그레이션 규약](CLE-ENG-MIGRATION.md) 규칙 9(append-only)가 수정을 막는다. 그래서 그 언급(옛 스펙 경로 76개 파일 · 122줄, `plan/` 경로 33개 파일 · 33줄)은 기준값에 영구히 남는다. 옛 트리를 지운 뒤에도 기준값이 0 이 되지 않는다. 가드가 아무것도 세지 않고 통과하는 일을 막는 하한(vacuity floor)은 이 영구 잔존분에 건다. 줄어드는 전체 합계에 걸면 언급을 줄이는 정상 작업이 쌓였을 때 거짓으로 실패하기 때문이다. 카탈로그 생성기 산출물은 그 파일 대신 생성기를 고친다.
- **기준값 갱신**: 줄였으면 `LEGACY_PATH_RATCHET_UPDATE=1` 로 기준값을 다시 쓴다. 이 모드는 줄어든 값만 쓴다. 늘어난 파일이 있으면 쓰지 않고 실패한다. 파일을 옮기거나 나눠 언급이 다른 파일로 넘어간 경우에만 `LEGACY_PATH_RATCHET_UPDATE=grow` 로 늘어난 값까지 쓴다. 그때는 PR 본문에 이유를 적는다. CI 에서는 갱신을 거부한다.
- **병렬 PR**: 기준값 파일은 파일마다 한 항목이라 두 PR 이 같은 파일의 언급을 함께 바꿀 때만 충돌한다. 그때는 나중에 머지한 쪽이 기준값을 다시 쓴다. R-14 의 앵커 어긋남과 같은 처리다.
- **단계 5 뒤**: 옛 트리를 지운 뒤에도 이 가드는 유지한다. 옛 경로가 새로 생기는 것을 막기 때문이다.
- **키 언급 가드** `spec-key-mentions`: 링크로 감싸지 않은 키도 미러에 있어야 한다. 옛 경로를 키로 바꾸는 일이 늘수록 이 언급이 는다. 오탈자 키는 아무 데도 닿지 않는 인용이 된다. 키를 뽑을 때 링크 안팎을 가르지 않는다. 키 링크의 키도 같은 판정이라 해가 없다. 키 뒤에 적은 절 제목(「…」)은 확인하지 않는다. 키 링크의 앵커는 링크 무결성 가드 범위 2 가 본다.
- **카탈로그 영역 키**: 미러하지 않는 카탈로그 영역(`CLE-C24` · `CLE-MKS`)의 키는 미러로 확인할 수 없어서 영역 단위로 통과시킨다. 같은 키를 키 링크로 쓰면 `KEY` 위반이다. 키 링크는 앵커까지 미러로 확인하는 표기라 대상이 미러에 있어야 한다(R-14). 링크 없는 언급은 키만 본다. 사용자 가이드 프론트매터 `spec:` 는 같은 영역의 키를 이름 목록(`UNMIRRORED_GUIDE_KEYS`)으로 허용한다. 코드 주석에서는 이름 목록을 두지 않았다. 카탈로그 영역의 스펙 키를 적을 때마다 목록을 고쳐야 하기 때문이다. 그 대가로 카탈로그 영역 키의 오탈자는 잡지 못한다.
- **공용 순회**: 세 가드가 `codebase-mentions.ts` 의 같은 순회를 쓴다. 이 문서의 두 가드와 [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md) 규칙 9 · 10 을 보는 `review-citation-form` 이다. 순회를 고칠 때는 세 가드의 영향을 함께 본다.
- 키 모양은 `spec-keys.ts` 의 `SPEC_KEY_RE` 한 곳에서 가져온다. 같은 모양의 정규식 복사본이 다른 가드에도 있으니 모양을 바꿀 때 함께 고친다.

### R-16. 옛 트리를 지우고 frontmatter 근거를 `## 구현 위치` 검사로 바꾼 이유 (2026-10-03, 전환 단계 5)

NERV 정본 전환 단계 5(NERV Task `CLE-T-7M4C4X`)에서 저장소의 옛 스펙 트리 파일 138개를 지웠다. 루트 `spec/0-overview.md` · `spec/1-data-model.md` · `spec/6-brand.md` 와 폴더 `spec/2-navigation/` · `spec/3-workflow-editor/` · `spec/4-nodes/` · `spec/5-system/` · `spec/7-channel-web-chat/` · `spec/conventions/` · `spec/data-flow/` 다. 저장소 `spec/` 에는 NERV 미러(`spec/<영역 키>/<KEY>.md` · `spec/<KEY>.md`)와 미러 안내 `spec/README.md` 만 남는다. 같은 PR 에서 옛 트리 전용 가드와 공용 파서 `spec-frontmatter-parse.ts`(와 그 테스트)를 걷었다. 가드별 처분은 다음과 같다.

| 가드 | 처분 | 이어받는 곳 |
| --- | --- | --- |
| `spec-frontmatter` | 걷음 | 대체 없음(NERV 문서 본문에는 frontmatter 가 없다) |
| `spec-code-paths` | 대체 | `spec-impl-locations`(규칙 20) |
| `spec-area-index` | 걷음 | NERV `area` 문서의 `## 문서` 절(기계 가드 없음) |
| 링크 무결성 범위 1 | 걷음 | NERV references 관계(`relations.unknown`) + `pull.py --check`(`spec/` 안의 미러가 아닌 파일 · 폴더도 알린다) |
| `inNervMirror` · `RETIRED_ROOT_TREES` · `RELOCATED_SPEC_TREES` · `inGeneratedCatalog` · 일관성 검토 오케스트레이터 `is_nerv_mirror` · 세 판정 동치 테스트의 제외 판정 대조 | 걷음 | 대상 소멸(옛 트리가 없다). 키 문법 · 미러 파일 수집 · `type` 읽기 대조는 `OrchestratorMirrorParityTest` 로 남았다 |
| `stray-tool-tags` · `legacy-path-ratchet` · `spec-key-mentions` · 링크 무결성 범위 2 · 3 | 유지 | — |

옛 라이프사이클 표의 `archived` 행이 적던 "마지막 커밋 뒤 90일이 지나면 파일 삭제 권장(INFO)" 은 어떤 가드도 낸 적이 없다(걷기 직전 `spec-status-lifecycle` 도 `archived` 를 보지 않았다). 문서에 적은 보장이 구현보다 넓었던 이력이다.

spec-coverage 감사(`/spec-coverage`, Gate D 포함)의 대상도 옛 트리 frontmatter `code:` 에서 미러의 `## 구현 위치` 로 옮겼다. 카탈로그 영역(`CLE-C24` · `CLE-MKS`)은 지금처럼 미러에 넣지 않는다. 카탈로그는 codebase 데이터라는 전환 계획의 결정을 2026-10-03 에 영역 단위로 다시 확인했다. 영역 문서와 `CLE-C24-META` · `CLE-C24-SCOPES` · `CLE-MKS-META` 도 미러에 없다. 그래서 카탈로그 문서는 이 규약의 적용 대상이 아니다.

- **대체 없이 끄지 않은 이유**: 옛 frontmatter 가드는 옛 트리만 읽었다. 옛 트리를 지우면 대상이 0 이 된다. `spec-code-paths` 처럼 대상마다 테스트를 등록하는 가드는 대상이 0 이면 테스트가 하나도 등록되지 않아 조용히 꺼진다(전환 계획을 세울 때 실측). 그래서 대체 없이 끄지 않고 같은 PR 에서 `spec-impl-locations` 로 바꿨다. 2026-10-03 실측에서 미러 181편 중 136편에 `## 구현 위치` 절이 있고 그 안의 저장소 경로 약 960개가 모두 실재한다. 대괄호를 글자 그대로 읽고 중괄호를 펼치고 마이그레이션 번호 약칭을 받았을 때의 값이다(규칙 20).
- **경로 후보를 좁힌 이유**: 경로로 읽는 코드 스팬을 `codebase/` · `.claude/` · `.github/` · `scripts/` 로 시작하는 것으로 좁혔다. 괄호 안 보충 설명(`README.md` · `package.json` 처럼 앞 경로를 기준으로 적은 파일 이름)과 gitignore 대상(`.review/`)을 경로로 읽으면 CI 체크아웃에서 거짓 실패나 거짓 통과가 난다. 2026-10-03 미러 실측에서 둘 다 있었다.
- **대괄호를 글자 그대로 읽는 이유**: 미러의 경로 약 960개 중 41개가 Next.js 동적 세그먼트(`[slug]` · `[id]`)를 담는다. 글로브 문자 클래스로 읽으면 그중 글로브인 13개가 거짓 실패한다(2026-10-03 실측).
- **중괄호는 펼친 경로가 모두 있어야 하는 이유**: 하나만 있어도 통과시키면 로케일 쌍(`{ko,en}`)의 한쪽이 지워져도 못 잡는다.
- **마이그레이션 번호 약칭을 받는 이유**: 미러가 `V117`~`V120` 처럼 번호로 마이그레이션을 가리킨다. 접두 일치를 모든 경로로 넓히면 너무 넓어서 `V<숫자>` 세그먼트에만 둔다.
- **검토했으나 채택하지 않은 안** (이 단계를 설계하며 함께 따졌다. 따로 제안된 이력은 없다):
  - 깨진 경로를 기준값으로 묶는 래칫. 실측 위반이 0 이라 둘 이유가 없었다.
  - 미러 밖 NERV 본문을 직접 읽는 검사. 빌드가 NERV 가용성에 묶인다. 지금 NERV 를 읽는 검사는 push 훅과 CI `review-gate` 뿐이고 둘 다 NERV 가 답하지 않으면 통과시킨다(fail-open). 빌드 가드는 구현할 때 받은 미러(그 작업의 기준 버전)를 읽는다.
- **비용**: 경로를 옮기는 코드 변경은 NERV 초안 승인을 기다려야 한다(규칙 22). 옛 흐름에서는 같은 PR 의 frontmatter 한 줄이었다.
- **약해지는 곳**: 옛 규칙 5 는 적용 대상 문서의 상태가 `partial` · `implemented` 면 `code:` 매치를 강제했다. 지금 가드는 `## 구현 위치` 절이 있는 문서만 보고 적힌 경로가 있는지만 본다. 빠진 경로와 절을 아예 적지 않은 문서는 잡지 못한다(규칙 19). 2026-10-03 미러 181편 가운데 머리 줄 구현 상태가 구현됨 · 부분 구현인데 절이 없는 문서는 29편이다. 23편은 영역 문서이고 1편은 `CLE-VISION` 이다. 옛 트리에서도 개요 · 영역 진입 문서(`0-overview.md` · `_*.md`)는 대상이 아니었다. 나머지 5편은 잎 문서다(`CLE-INT-AUTH` · `CLE-NODE-AGENT-OUTPUT` · `CLE-PLAT-ARCH` · `CLE-PLAT-NFR` · `CLE-PLAT-STORAGE`). 이 5편에 절을 더할지는 후속 Task `CLE-T-RGZBCQ` 가 정한다. 영역 index 와 `archived` 폐기 사유 의무도 기계 가드 없이 남는다.
- **후속 개정**: 걷은 규칙 · 가드 · 필드를 인용하는 다른 문서가 있다. [사용자 가이드 근거 규약](CLE-ENG-GUIDEEVIDENCE.md)(`spec-code-paths` 비교 · 필드 정의와 R-10 인용), [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md)(`code:` 필드 정의 인용), [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) R-CC-22(규칙 6 인용), 영역 문서 [개발 규약](CLE-ENG.md)(이 문서 요약), 용어 사전(`CLE-GLOSSARY` · `CLE-GLOSSARY-API` · `CLE-GLOSSARY-POLY` 의 「옛 스펙 상태」), [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)(`status: archived` 대비), [DB 마이그레이션 규약](CLE-ENG-MIGRATION.md)(문서 이름 없는 R-15 인용)이다. 인용은 걷음 표기로 이어지므로 끊기지는 않는다. 문구는 후속 Task `CLE-T-RGZBCQ` 가 각 문서의 초안으로 고친다.

### `code:` 목록에 주석을 허용한 경위 (2026-09-06)

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

`code:` 에 준수 예시와 시행 코드를 섞고 범주를 인라인 YAML 주석으로 가르는 것은 2026-09-06 부터 안전하다. 그 전에는 `review_guard._parse_frontmatter_code` 의 블록 리스트 루프가 `- ` 로 시작하지 않는 첫 줄에서 멈춰 **주석 뒤 항목이 에러 없이 사라졌다**. 실측하니 스펙 387개 중 7개 파일에서 41개 항목이 빠져 있었다. 그중 하나는 당시 작업 중이던 PR 자신이 고치던 파일을 덮고 있었다. 하루 전에 "주석을 쓰지 않는 것으로 피한다" 는 산문 규율을 적었지만 그 규율은 다음 제안을 막지 못했다.

그래서 문서 규율 대신 파서를 고쳤다. 블록 리스트가 빈 줄과 `#` 주석을 건너뛰게 했다. gray-matter 를 쓰는 프론트엔드 파서는 처음부터 주석 뒤를 읽었으므로 이 수정은 두 파서의 답을 맞춘 것이기도 했다(수정 뒤 731 대 731, 답이 갈리는 파일 0). 회귀 테스트는 `.claude/tests/test_review_guard.py` 에 두었다.

전환 단계 2(NERV Task `CLE-T-4ABTG7`)에서 리뷰 게이트가 NERV 판정으로 바뀌면서 `review_guard` 의 이 파서와 회귀 테스트는 spec-linked 변경에 `--impl-done` 을 요구하던 게이트와 함께 없어졌다(«NERV 이전 영향» 표의 spec-linked 행). 지금 `code:` 목록을 읽는 파서는 프론트엔드 파서 하나다. 주석 뒤 항목을 읽는 동작은 그 파서가 지탱하지만 주석을 끼운 `code:` 목록을 고정하는 프론트엔드 테스트는 없다. NERV 로 옮긴 문서는 `code:` 대신 본문 `## 구현 위치` 절을 쓴다. 이 공백은 옛 트리가 남아 있던 동안만 해당했고 단계 5 에서 옛 트리와 함께 사라졌다.

### 링크 무결성 가드가 거버넌스 문서를 보는 범위 (2026-08-27)

거버넌스 문서 범위(루트 `*.md` 비재귀 + `.claude/**.md`)는 2026-08-27 에 더했다. 루트를 재귀하지 않는 이유는 `spec/`·`plan/`·`codebase/` 가 딸려 들어와 다른 두 범위와 겹치고 깨진 링크가 정상인 `plan/complete/**` 까지 빨아들이기 때문이다. 예전 `scripts/check-doc-links.py` 가 내세우던 역할을 이 범위가 대신하고 그 스크립트는 지웠다. 배선된 적이 없어 실제로 아무것도 지키지 못했고 오탐도 2건 있었다.

같은 날 `plan/**` 문서 안 링크 위생의 담당도 바로잡았다. `plan-coherence-checker` 가 맡는다고 적었던 서술은 틀렸다. 그 에이전트 정의에는 링크 검증이 없다(에이전트 정의 grep 0건). 담당은 `plan-frontmatter.test.ts` 의 (3) 이었다. 전환 단계 3 에서 `plan/` 과 그 가드를 지웠다.

### 도입할 때 쓴 절차

(옛 트리 결정. 전환 단계 5 에서 대상과 함께 걷었다. R-16)

이 규약을 처음 들일 때의 일괄 적용 절차다.

1. 적용 대상 스펙 60여 개에 한 PR 안에서 frontmatter 를 한꺼번에 더했다.
2. 처음 `status` 는 이렇게 나눴다.
   - 이미 머지된 PR 로 구현을 끝낸 스펙 → `implemented` 와 `code:` 채움
   - 0-overview §6.3 로드맵에 맞는 스펙 → `backlog`
   - 일부 구현 + 후속 plan 있음 → `partial` 과 `pending_plans:` 채움
   - 그 밖 → `spec-only`
3. frontmatter 근거 가드(4건)를 함께 썼다. 스펙 문서 저장소·plan 무결성 가족(빌드 4건 + 권고 Gate D)과 Gate C 는 나중에 스펙 문서 저장소 품질 개선 작업(옛 plan `knowledge-base-quality-improvements.md`, git 이력)에서 더했다(R-8·R-9).
4. `PROJECT.md` 의 자동 가드 표에 해당 행을 더했다.
