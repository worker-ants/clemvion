---
id: "CLE-ENG-SPECEVIDENCE"
title: "스펙과 구현 근거 규약"
type: "convention"
version: 9
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ENG"
ancestors: ["CLE-VISION", "CLE-ENG"]
area: "CLE-ENG"
content_hash: "4fd98a750035b5341a90c05c8ee3ebdd93c1d940a2894ae1b4671df3935ba591"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/conventions/spec-impl-evidence.md"]
mirror_sha256: "6ba405274efcf2d3173e2c17487c68315e2b0ee99c2ac19d0ba9c3046f786684"
etag: "sha256-ae6a5131bf081aa475d4cc07060eda22b2ad700163bc9df383b15bd4e027051a"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/spec-impl-evidence.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 규약은 스펙 문서 본문의 `## 구현 위치` 절이 가리키는 저장소 경로를 빌드에서 검증한다. 스펙 문서 저장소(미러)와 코드 속 스펙 언급의 무결성을 지키는 일도 이 규약이 정한다. Telegram 채팅 채널 UI 가 스펙에 약속된 채 오래 구현되지 않았던 사례처럼 "스펙 약속과 구현 부재" 사이의 갭을 빌드 가드로 막는다.

이 규약 전의 검사는 모두 변경을 계기로 돌았다.

- `/consistency-check`: 스펙 초안과 구현 착수 시점에만 돈다.
- `/ai-review`: PR diff 안만 본다.
- `user-guide-sync-reviewer`: 코드에서 가이드로 가는 한 방향만 본다.
- `nodes-coverage`·`hydration-coverage` 같은 빌드 가드: 등록부 열거만 본다.

그래서 "스펙이 약속한 표면이 **지금** 구현돼 있는가" 는 어떤 검사도 묻지 않았다. 이 규약은 스펙 문서의 `## 구현 위치` 절에 구현 경로를 적게 하고 [구현 위치 근거 가드](#빌드-가드--구현-위치-근거)로 그 경로의 실재를 강제한다. 옛 트리 frontmatter 의 옛 스펙 상태(`status`) · `code:` 로 보던 근거는 전환 단계 5 에서 옛 트리와 함께 걷었다(Rationale R-16). 스펙 문서 저장소(링크 · 도구 태그 잔재)와 코드 주석 · 텍스트 속 스펙 언급(옛 경로 · 키)의 무결성을 지키는 [별도 가드 가족](#빌드-가드--스펙-문서-저장소-무결성)도 이 문서가 정한다. `pending_plans:` 와 plan 무결성 가드는 전환 단계 3 에서 `plan/` 과 함께 걷었다(Rationale R-13).

스펙의 정본은 NERV 문서이고 저장소 `spec/` 은 구현할 때 받은 미러다. 작업 추적은 전환 단계 3 부터 NERV Task 가 맡는다. 스펙을 NERV 로 옮기면서 바뀐 전제는 [스펙과 구현 근거 규약 — NERV 이전 영향과 걷은 결정](CLE-ENG-SPECEVIDENCE-MIGRATION.md) 에 모았다.

범위 밖:

- 사용자 가이드 본문이 약속한 코드의 실재는 [사용자 가이드 근거 규약](CLE-ENG-GUIDEEVIDENCE.md) 이 정한다.
- 작업 추적(진행 · 완료 · `spec_impact` 선언)은 NERV Task 가 맡는다. 기준은 저장소 `CLAUDE.md` 「정보 저장 위치」 다.
- spec-coverage 정기 감사의 절차와 산출물은 저장소 `.claude/skills/spec-coverage/SKILL.md` 가 정한다.

## 규칙

규칙 1 ~ 17 은 걷었다. 번호는 다른 문서와 코드 주석이 인용하므로 다시 쓰지 않는다. 걷은 규칙의 원문은 NERV 의 이 문서 버전 6 에 있다(Rationale R-17).

- 규칙 1 ~ 7 · 13 · 14(옛 트리 frontmatter 의 `id` · `status` · `code:` · 폐기 사유 · `user_guide:`)는 전환 단계 5 에서 옛 트리와 함께 걷었다(R-16). `code:` 의 자리는 규칙 19 ~ 21 의 `## 구현 위치` 가 잇는다. 옛 규칙 6 의 취지(넓은 트리 글로브로 가드만 통과시키지 않는다)는 규칙 19 가, 옛 규칙 7 의 준수 예시 파일은 규칙 21 이 잇는다.
- 규칙 8 ~ 12 · 15 ~ 17(`pending_plans:` · `spec-only` TTL · `backlog` 등재 · 승격 · Gate C · `plan/**` 링크)은 전환 단계 3 에서 `plan/` 과 함께 걷었다(R-13). 남은 표면과 `spec_impact` 선언은 NERV Task 가 맡는다.

18. 코드 주석이 스펙을 가리킬 때는 키 링크 `[글](<키>#앵커)` 를 쓴다. 미러에 없는 키는 같은 PR 에서 미러로 받는다. 미러하지 않는 카탈로그 영역(`CLE-C24` · `CLE-MKS`)은 키 링크로 쓸 수 없다. 코드 주석은 카탈로그를 `codebase/api-catalogs/<vendor>/` 경로나 링크 없는 언급으로 가리킨다. 이 제한은 링크 무결성 가드가 보는 범위 2 · 3(코드 소스 주석 · 거버넌스 문서)에만 걸린다. 카탈로그 정본 마크다운(`codebase/api-catalogs/**.md`)은 그 가드 밖이라 NERV 사본과 같은 키 링크로 카탈로그 문서를 가리킨다(`codebase/api-catalogs/README.md` 「링크」). 공개 OpenAPI 채널(`*.dto.ts` · `*.controller.ts` 의 `/** */` 블록과 데코레이터 `description` · `summary`)에는 링크 없는 키도 포함해 키를 쓰지 않는다. 근거는 바로 위 `//` 주석에 키 링크로 쓴다([OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17, 백엔드 가드 `openapi-internal-ref`, R-14). 링크로 감싸지 않은 언급은 키와 절 제목으로 쓴다(예: `CLE-API-ERRCODES` 「워크플로우 실행: 엔진 수준」). NERV 제목에 번호가 붙어 있어도 번호를 빼고 제목 글자만 쓴다(예시의 실제 제목은 `6.5 워크플로우 실행: 엔진 수준`). 옛 § 번호는 옮기지 않는다. 그 키도 미러에 있어야 한다. 미러하지 않는 카탈로그 영역의 키는 가드가 확인하지 않고 통과시킨다(R-15).
19. 구현이 있는 스펙 문서는 본문 `## 구현 위치` 절에 그 표면의 구현 경로를 목록으로 적는다. 경로는 저장소 루트 기준이다. 글로브는 그 표면을 맡은 범위로 좁힌다. 넓은 트리 글로브(`codebase/backend/src/**` 같은)는 아무것도 가리키지 않는 것과 같다. 영역 문서 · 제품 개요(`CLE-VISION`) · 구성 개요 문서는 절을 두지 않아도 된다. 그 아래 문서가 구현 경로를 적는다(옛 트리에서도 개요 · 영역 진입 문서는 대상이 아니었다, R-16). 절을 적었는지와 글로브의 넓이는 빌드 가드도 NERV done 게이트도 보지 않는다. 구현 PR 의 사전 체크리스트(저장소 `PROJECT.md` 동반 갱신 매트릭스와 DOCUMENTATION 단계 체크리스트)와 코드 리뷰가 본다(R-16 「약해지는 곳」).
20. `## 구현 위치` 절의 코드 스팬 가운데 `codebase/` · `.claude/` · `.github/` · `scripts/` 로 시작하는 것은 저장소 경로로 읽는다. 빌드가 그 경로의 실재를 확인한다(가드 `spec-impl-locations`). 절은 제목이 `## 구현 위치` 와 글자가 같은 H2 이고 다음 H2 에서 끝난다. 코드 펜스 안은 읽지 않는다. 판정은 다음과 같다.
    - 글로브(`*` · `**` · `?`)는 파일 1개 이상에 매치해야 한다.
    - 대괄호(`[slug]` · `[id]`)는 글자 그대로 읽는다(Next.js 동적 세그먼트). 글로브 문자 클래스로 쓰지 않는다.
    - 중괄호 `{a,b}` 는 펼친 경로가 **모두** 실재해야 한다.
    - 마지막 세그먼트가 `V<숫자>` 인 마이그레이션 경로(`codebase/backend/migrations/V117`)는 그 번호의 마이그레이션 파일(`V117__*`)이 있어야 한다.
    - 네 루트로 시작하지 않는 코드 스팬은 경로로 읽지 않는다. 심볼, 파일 이름만 적은 것(같은 줄에 이어 적은 `V118` 같은 마이그레이션 번호 포함), gitignore 대상 `.review/` 가 여기 든다. 판정은 루트 접두 하나로 한다. 괄호 안 보충 설명이라도 네 루트로 시작하면 경로로 읽는다. 빌드가 보지 않는 파일 이름 인용의 규모는 R-16 「약해지는 곳」 에 있다.
21. 강제하는 코드가 없는 순수 문서형 규약은 `## 구현 위치` 에 그 규약을 실제로 지키는 예시 파일을 적어도 된다. 이때도 넓은 트리 글로브로 가드만 통과시키지 않는다(규칙 19, 옛 규칙 6 · 7 의 취지). 한 문서 안에서도 축마다 강제 여부가 갈릴 수 있으므로 이 판단은 축 단위로 한다. 준수 예시와 시행 코드를 함께 적고 범주를 문장으로 갈라도 된다(선례: [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md)).
22. 코드 변경이 `## 구현 위치` 가 가리키는 경로를 옮기거나 지우면 같은 PR 에서 그 문서의 NERV 초안을 고쳐 승인받고 미러를 받는다(`pull.py --task`). 미러를 손으로 고치지 않는다.

## 적용 대상

규칙 19 ~ 22 는 저장소 NERV 미러의 스펙 문서 가운데 본문에 `## 구현 위치` 절이 있는 문서에 적용한다. 미러 문서는 다음 두 자리에 있다. 영역 문서와 그 아래 문서는 영역 폴더에, 영역 밖 문서는 `spec/` 바로 아래에 있다.

- `spec/<KEY>.md`
- `spec/<영역 키>/<KEY>.md`

미러 안내 `spec/README.md` 는 스펙 문서가 아니므로 빠진다. 카탈로그 영역(`CLE-C24` · `CLE-MKS`)은 미러에 넣지 않으므로 대상이 아니다(규칙 18). `## 구현 위치` 절이 없는 문서에는 가드가 볼 경로가 없다.

이 대상을 읽고 무엇을 경로로 볼지 코드로 정하는 곳은 셋이다.

- 가드 `spec-impl-locations`: 규칙 20 의 판정이다. 파일 이름이 `SPEC_KEY_RE` 에 맞는 미러 파일만 본다(`spec-keys.ts`). 이 판정은 `spec-impl-locations.test.ts` 의 합성 미러 테스트가 고정한다.
- spec-coverage 감사: 오케스트레이터(`.claude/skills/spec-coverage/scripts/spec_coverage_orchestrator.py`)가 이 절의 포함 목록 · 절 조건 · 제외 항목을 감사기 프롬프트에 싣는다. 판정을 코드로 갖지 않는다. 이 절과 같은지는 `.claude/tests/test_spec_coverage_prompt.py` 가 대조한다.
- 일관성 검토 `--impl-done` 의 구현 위치 대조: 바뀐 파일을 덮는 문서를 검토 대상에 더하려고 규칙 20 보다 넓게 읽는다. 저장소 최상위 폴더면 어느 것이든 경로의 첫 조각으로 받고 같은 줄에 이어 적은 파일 이름도 경로로 받는다. 대상을 놓치는 것보다 더 넣는 편이 낫기 때문이다(`consistency_orchestrator.py` 의 `impl_location_patterns`). 빌드 판정이 아니라서 규칙 20 과 맞추지 않는다.

판정을 코드로 갖지 않고 이 절이나 그 루트를 따르는 곳도 있다.

- 코드 리뷰 requirement 역할의 spec 일치 항목: 바뀐 파일을 `## 구현 위치` 에 적은 문서를 대조할 스펙의 1순위로 고른다(저장소 `.claude/skills/code-review-agents/lib/role_instructions.py` · `.claude/agents/requirement-reviewer.md`). 이 문서와 같은지 대조하는 테스트는 없다.
- 동반 갱신 매트릭스의 「spec 신규/대규모 변경」 행: 이 절을 고칠 때의 점검 항목을 적는다(저장소 `.claude/config/doc-sync-matrix.json` 과 그것을 옮긴 `PROJECT.md` 표). 이 문서와 같은지 대조하는 테스트는 없다.
- 빌드 가드 워크플로(`.github/workflows/spec-link-checks.yml`)의 변경 경로 판정(`pathspecs`): 네 루트 아래 파일만 옮기는 PR 에서도 가드가 돌도록 네 루트를 모두 담는다. 절은 읽지 않는다. 루트를 모두 덮는지는 `.claude/tests/test_spec_link_checks_scope.py` 가 본다.

## 작성 예

구현이 있는 문서는 본문 `## 구현 위치` 절에 다음처럼 적는다.

- `codebase/backend/src/modules/chat-channel/**`
- `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`
- `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx`

첫 줄은 글로브라서 파일 1개 이상에 매치하면 된다. 둘째 줄은 그 파일이 있어야 한다. 셋째 줄의 `[slug]` 는 Next.js 동적 세그먼트라서 글자 그대로 읽는다(규칙 20).

### 뜻이 다른 같은 이름

- **`code:` 와 `## 구현 위치`**: 사용자 가이드 MDX frontmatter 에는 `code:` 가 있다. 이 규약의 `## 구현 위치` 와 뜻은 비슷하지만 대상 문서 종류가 `.mdx`(가이드)와 미러 스펙으로 갈린다. 두 가드(`registry.test.ts`, `spec-impl-locations.test.ts`)는 각자 자기 대상만 검증한다. 불변식도 다르다. 가이드 `code:` 는 가이드가 설명하는 코드라 항목마다 그 파일이 있어야 하고 글로브를 받지 않는다. `## 구현 위치` 는 스펙이 약속한 구현 표면이라 글로브 · 중괄호 · 마이그레이션 번호 약칭을 받는다(규칙 20).

## 빌드 가드 — 구현 위치 근거

아래 단위 테스트가 규칙 20 을 강제한다. 실패하면 빌드가 막힌다. `codebase/frontend/src/lib/docs/__tests__/` 에 있다. 링크 · 도구 태그 · 스펙 언급 가드는 [별도 가족](#빌드-가드--스펙-문서-저장소-무결성)이다(Rationale R-9). 옛 frontmatter 근거 가드(`spec-frontmatter` · `spec-code-paths`)는 전환 단계 5 에서(R-16), `spec-status-lifecycle` · `spec-pending-plan-existence` 는 전환 단계 3 에서(R-13) 걷었다.

| 가드 | 검증 |
| --- | --- |
| `spec-impl-locations.test.ts` | [적용 대상](#적용-대상) 문서의 `## 구현 위치` 경로가 실재한다(규칙 20) |

### 다른 가드와의 관계

- `registry.test.ts`(사용자 가이드 MDX 의 `spec:`/`code:` 경로 실존)와는 **대상 문서 종류**로 갈린다. 이 가드는 미러 스펙(`spec/**.md`)만, `registry.test.ts` 는 `codebase/frontend/src/content/docs/**.mdx` 만 본다.
- `nodes-coverage.test.ts`(백엔드 노드가 가이드 본문에 나오는지)와는 방향이 직교한다. `nodes-coverage` 는 노드 열거에서 가이드로, 이 가드는 스펙 약속에서 구현 코드로 간다.
- `impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts`([사용자 가이드 근거 규약](CLE-ENG-GUIDEEVIDENCE.md) 의 역방향 가드 3건)와도 검증 영역이 직교한다. 그 가드들은 가이드 약속에서 코드 심볼로(guide → code), 이 가드는 스펙 약속에서 코드 경로로(spec → code) 간다. 두 가족은 독립이고 서로를 대신하지 않는다.

## 빌드 가드 — 스펙 문서 저장소 무결성

구현 위치 근거 가드와 다른 가족이다. 스펙 문서 저장소(링크 · 도구 태그 잔재)와 코드 주석 · 텍스트 속 스펙 언급(옛 경로 · 키)을 지키는 빌드 차단 4건(`spec-link-integrity` · `stray-tool-tags` · `legacy-path-ratchet` · `spec-key-mentions`)과 권고 1건(Gate D)이다(Rationale R-9).

→ [스펙과 구현 근거 규약 — 스펙 문서 저장소 무결성 가드](CLE-ENG-SPECEVIDENCE-INTEGRITY.md#빌드-가드-목록)

## 하위 문서

Rationale 번호(R-n)는 다른 문서와 코드 주석이 인용하므로 하위 문서로 옮겨도 그대로 둔다. 분리 전에 `CLE-ENG-SPECEVIDENCE R-n` 으로 적은 인용(예: R-4 · R-7 · R-9 · R-14)과 「빌드 가드 — 스펙 문서 저장소 무결성」 절 인용은 아래 목록으로 하위 문서를 찾는다. 새로 인용할 때는 그 번호나 절이 있는 하위 문서 키를 적는다.

- [스펙과 구현 근거 규약 — 스펙 문서 저장소 무결성 가드](CLE-ENG-SPECEVIDENCE-INTEGRITY.md): 링크 무결성 · 도구 태그 · 옛 경로 래칫 · 키 언급 가드와 Gate D, 링크 무결성 가드의 대상 범위, 언급 가드의 공용 순회를 정한다. Rationale R-9 · R-12 · R-14 · R-15 와 「링크 무결성 가드가 거버넌스 문서를 보는 범위」 가 여기 있다. 맡는 요구사항 번호: 없음.
- [스펙과 구현 근거 규약 — NERV 이전 영향과 걷은 결정](CLE-ENG-SPECEVIDENCE-MIGRATION.md): 스펙을 NERV 로 옮기며 바뀐 전제와 걷은 규칙 · 가드의 결정 요약을 모은다. Rationale R-2 ~ R-8 · R-10 · R-11 · R-13 · R-17 과 「`code:` 목록에 주석을 허용한 경위」 · 「도입할 때 쓴 절차」 가 여기 있다. 맡는 요구사항 번호: 없음.

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
- `codebase/frontend/src/lib/docs/__tests__/legacy-path-ratchet.test.ts` · `codebase/frontend/src/lib/docs/__tests__/legacy-path-ratchet.baseline.json`
- `codebase/frontend/src/lib/docs/__tests__/spec-key-mentions.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts` (디렉터리 순회기. `codebase-mentions.ts` · `spec-keys.ts` 도 이 순회기를 쓴다)
- `codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts`
- `.claude/tools/nerv-mirror/pull.py` (`--check`, CI `spec-mirror-integrity`)
- `.claude/skills/spec-coverage/scripts/spec_coverage_orchestrator.py` (감사 대상 선택) · `.claude/tests/test_spec_coverage_prompt.py` (「적용 대상」 과 대조)
- `.github/workflows/spec-link-checks.yml` (빌드 가드 워크플로의 변경 경로 판정) · `.claude/tests/test_spec_link_checks_scope.py` (네 루트를 모두 덮는지 대조)
- `.claude/skills/code-review-agents/lib/role_instructions.py` · `.claude/agents/requirement-reviewer.md` · `.claude/config/doc-sync-matrix.json` (교차 참조. 「적용 대상」 에서 판정 없이 이 절을 따르는 곳이다. 대조 테스트는 없다)
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` (교차 참조. `--impl-done` 의 구현 위치 대조. 「적용 대상」 셋째 항목)
- `codebase/backend/src/repo-guards/__tests__/openapi-internal-ref-guard.ts` · `codebase/backend/src/repo-guards/__tests__/openapi-internal-ref.spec.ts` 와 대조군 `codebase/backend/src/repo-guards/__tests__/fixtures/openapi-internal-ref/**` (교차 참조. 범위 2 의 공개 OpenAPI 예외를 지키는 백엔드 가드다. 기준은 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 규칙 17. 키 패턴은 `SPEC_KEY_RE` 와 같은 모양의 사본이라 함께 고친다. 옛 `plan/` 경로는 `plan/in-progress/` · `plan/complete/` · `plan/research/` 셋을 센다. `public-surface-internal-refs` · `legacy-path-ratchet` 도 같다. `plan/research/` 는 2026-11-07 에 더했고 경위는 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) Rationale 에 있다)

## Rationale

이 문서에는 R-1 · R-16 만 있다. 나머지 번호가 있는 곳은 「하위 문서」 절에 적었다.

### R-1. `code:` 에 글로브를 허용한다

옛 frontmatter `code:` 의 결정이다. 같은 이유로 규칙 20 도 글로브를 허용한다. 명시 파일만 받는 안 대신 글로브를 허용했다. 영역 단위 책임(예: `codebase/backend/src/modules/chat-channel/**`)을 자연스럽게 적을 수 있고 옮기는 부담이 적다. 단점은 stale 글로브다. 없어진 파일을 가리키던 글로브가 다른 파일에 매치해 통과하는 경우를 이 가드만으로는 못 잡는다. 이 약점은 `/spec-coverage` 정기 감사가 보완한다. NLP 휴리스틱으로 스펙 본문이 약속한 UI·API 표면에 맞는 코드가 없는지 찾는다.

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

- **`spec-code-paths` 를 대체 없이 끄지 않은 이유**: 옛 frontmatter 가드는 옛 트리만 읽었다. 옛 트리를 지우면 대상이 0 이 된다. `spec-code-paths` 처럼 대상마다 테스트를 등록하는 가드는 대상이 0 이면 테스트가 하나도 등록되지 않아 조용히 꺼진다(전환 계획을 세울 때 실측). 그래서 대체 없이 끄지 않고 같은 PR 에서 `spec-impl-locations` 로 바꿨다. 2026-10-03 실측에서 미러 181편 중 136편에 `## 구현 위치` 절이 있고 그 안의 저장소 경로 약 960개가 모두 실재한다. 대괄호를 글자 그대로 읽고 중괄호를 펼치고 마이그레이션 번호 약칭을 받았을 때의 값이다(규칙 20).
- **미러 크기 하한**: 미러 전체를 훑는 두 가드(`spec-impl-locations` · `spec-link-integrity`)는 실측의 절반 언저리를 하한으로 둔다. 대상이 줄면 위반 0 단언이 공허하게 통과하기 때문이다. 가이드 레지스트리 가드(`registry.test.ts`)는 가이드가 인용한 키만 보므로 미러 크기와 상관없어 편 수 하한을 두지 않고 빈 미러만 막는다. 미러를 크게 줄이는 pull 이 하한에 걸리면 그때 실측의 절반으로 다시 잡는다.
- **`--impl-done` 대조는 넓게 읽는 이유**: 「적용 대상」 의 일관성 검토 `--impl-done` 은 경로 후보를 규칙 20 보다 넓게 읽는다. 빌드 판정이 아니어서 잘못 넣은 후보의 비용은 검토 대상 문서가 하나 더 실리는 것뿐이다. 반대로 빠뜨리면 바뀐 파일이 그 문서와 대조되지 않는다. 그래서 아래 빌드 판정과 반대 방향으로 정했다.
- **경로 후보를 좁힌 이유**: 경로로 읽는 코드 스팬을 `codebase/` · `.claude/` · `.github/` · `scripts/` 로 시작하는 것으로 좁혔다. 괄호 안 보충 설명(`README.md` · `package.json` 처럼 앞 경로를 기준으로 적은 파일 이름)과 gitignore 대상(`.review/`)을 경로로 읽으면 CI 체크아웃에서 거짓 실패나 거짓 통과가 난다. 2026-10-03 미러 실측에서 둘 다 있었다.
- **대괄호를 글자 그대로 읽는 이유**: 미러의 경로 약 960개 중 41개가 Next.js 동적 세그먼트(`[slug]` · `[id]`)를 담는다. 글로브 문자 클래스로 읽으면 그중 글로브인 13개가 거짓 실패한다(2026-10-03 실측).
- **중괄호는 펼친 경로가 모두 있어야 하는 이유**: 하나만 있어도 통과시키면 로케일 쌍(`{ko,en}`)의 한쪽이 지워져도 못 잡는다.
- **마이그레이션 번호 약칭을 받는 이유**: 미러가 `codebase/backend/migrations/V117` 처럼 번호로 마이그레이션을 가리킨다. 접두 일치를 모든 경로로 넓히면 너무 넓어서 `V<숫자>` 세그먼트에만 둔다. 약칭은 네 루트로 시작하는 코드 스팬 하나 안에서만 읽는다. 같은 줄에 이어 적은 번호(`V118`)나 범위 표기의 뒤쪽 번호는 경로로 읽지 않아 검증되지 않는다. 번호마다 전체 경로로 적는다. 2026-10-03 미러에서 이 형태는 [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) 한 곳이었고 같은 후속 Task(`CLE-T-RGZBCQ`)에서 그 문서의 마이그레이션 파일 이름을 모두 전체 경로로 고쳤다.
- **검토했으나 채택하지 않은 안** (이 단계를 설계하며 함께 따졌다. 따로 제안된 이력은 없다):
  - 깨진 경로를 기준값으로 묶는 래칫. 실측 위반이 0 이라 둘 이유가 없었다.
  - 미러 밖 NERV 본문을 직접 읽는 검사. 빌드가 NERV 가용성에 묶인다. 지금 NERV 를 읽는 검사는 push 훅과 CI `review-gate` 뿐이고 둘 다 NERV 가 답하지 않으면 통과시킨다(fail-open). 빌드 가드는 구현할 때 받은 미러(그 작업의 기준 버전)를 읽는다.
- **비용**: 경로를 옮기는 코드 변경은 NERV 초안 승인을 기다려야 한다(규칙 22). 옛 흐름에서는 같은 PR 의 frontmatter 한 줄이었다.
- **약해지는 곳**: 옛 규칙 5 는 적용 대상 문서의 옛 스펙 상태가 `partial` · `implemented` 면 `code:` 매치를 강제했다. 지금 가드는 `## 구현 위치` 절이 있는 문서만 보고 적힌 경로가 있는지만 본다. 빠진 경로와 절을 아예 적지 않은 문서는 잡지 못한다(규칙 19). 2026-10-03 미러 181편 가운데 머리 줄 구현 상태가 구현됨 · 부분 구현인데 절이 없는 문서는 29편이다. 23편은 영역 문서이고 1편은 `CLE-VISION` 이다. 옛 트리에서도 개요 · 영역 진입 문서(`0-overview.md` · `_*.md`)는 대상이 아니었다. 나머지 5편은 잎 문서다. 후속 Task `CLE-T-RGZBCQ` 가 문서마다 정했다. [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md) · [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) · [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) · [파일 저장소](../CLE-PLAT/CLE-PLAT-STORAGE.md) 에는 절을 더했다. [시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md) 는 구성 개요라 절을 두지 않고 컴포넌트를 맡은 문서를 개요에 적었다. 적힌 경로라도 루트 접두가 없는 파일 이름은 빌드가 보지 않는다. 2026-10-03 미러에서 절이 있는 136편 중 36편의 95줄이 그런 파일 이름 스팬 177개를 담았다(앞 경로에 이어 적은 파일 · 괄호 안 보충 설명). 영역 index 와 `archived` 폐기 사유 의무도 기계 가드 없이 남는다. (2026-10-03 정정: 버전 6 의 규칙 19 는 절을 적었는지를 「리뷰와 구현 Task 의 done 점검이 본다」 고 적었다. NERV done 게이트는 증적 · `spec_impact` · Task 에 묶인 리뷰 라운드만 보고 `## 구현 위치` 는 보지 않는다. 그래서 점검 주체를 구현 PR 의 사전 체크리스트와 코드 리뷰로 좁혔다.)
- **후속 개정**: 걷은 규칙 · 가드 · 필드를 현행처럼 인용하던 이웃 문서는 후속 Task `CLE-T-RGZBCQ` 가 같은 날(2026-10-03) 각 문서의 초안으로 고쳤다. 대상은 [사용자 가이드 근거 규약](CLE-ENG-GUIDEEVIDENCE.md) · [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md) · [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) · [개발 규약](CLE-ENG.md) · 용어 사전([용어 사전](../CLE-GLOSSARY.md) · [용어 사전 — API 와 개발 규약](../CLE-GLOSSARY-API.md) · [용어 사전 — 다의어 구분](../CLE-GLOSSARY-POLY.md)) · [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) · [DB 마이그레이션 규약](CLE-ENG-MIGRATION.md) · [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) · [사용자 가이드](../CLE-UI/CLE-UI-GUIDE.md) · [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) 과 카탈로그 사본이다. 그 초안들은 이 버전과 같은 검토 요청으로 승인받는다. 그 전까지는 이웃 승인본이 걷은 항목을 현행으로 적는다. 인용은 걷음 표기로 이어지므로 승인 전에도 끊기지는 않는다.
