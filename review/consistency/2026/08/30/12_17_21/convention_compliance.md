# 정식 규약 준수 검토 — `spec/conventions/`

## 검토 범위 메모

- 이번 impl-prep bundle 은 `spec/conventions/` 전체(23개 top-level 문서 + `cafe24-api-catalog/`·`makeshop-api-catalog/` 하위 다수 파일)를 담았으나, 컨텍스트 예산 초과로 다수 파일(`chat-channel-adapter.md`, `conversation-thread.md`, `error-codes.md`, `node-output.md`, `secret-store.md`, `swagger.md`, `spec-impl-evidence.md` 등 15개 + 카탈로그 하위 대부분)이 "본문 생략됨" 상태로 절단됐다. 해당 파일은 이 worktree 의 실제 파일시스템에서 직접 읽어 보강 확인했다(`Read`/`grep` 로 `spec/conventions/*.md` 직접 열람).
- 현재 브랜치(`raw-update-guard-scope`)가 `main` 대비 실제로 변경한 `spec/conventions/` 파일은 `egress-masking.md` 단 1개(+3/-2 lines, frontmatter `code:` 1줄 추가 + §1 표 1셀 보강 + §2 캐비엇 정정)이므로, 이 diff 를 실제 검토 대상으로 중점 검증하고 나머지는 self-consistency 스캔으로 처리했다.

## 발견사항

### [INFO] `## Overview` 명시 헤딩 사용이 문서군별로 갈린다

- target 위치: `spec/conventions/*.md` 전체(23개 top-level 파일)
- 위반 규약: `CLAUDE.md` "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" · `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" — `## Overview (제품 정의)` 헤딩을 권장
- 상세: `grep -l '^## Overview$' spec/conventions/*.md` 결과 8개(`audit-actions.md`, `error-codes.md`, `egress-masking.md`, `redis-keys.md`, `migrations.md`, `rag-evaluation.md`, `frontend-layering.md`, `cafe24-restricted-scopes.md`)만 명시적 `## Overview` 헤딩을 쓰고, 나머지 15개(`cafe24-api-metadata.md`, `makeshop-api-metadata.md`, `swagger.md`, `node-output.md`, `secret-store.md`, `execution-context.md`, `conversation-thread.md`, `chat-channel-adapter.md`, `interaction-type-registry.md`, `node-cancellation.md`, `cross-node-warning-rules.md`, `data-hydration-surfaces.md`, `i18n-userguide.md`, `user-guide-evidence.md`, `spec-impl-evidence.md`)은 H1 타이틀 직후 프로즈로 Overview 역할을 대체하고 바로 번호 절(§1…)로 들어간다. `cafe24-api-catalog/{_overview,category,store,translation}.md` 도 동일 패턴(명시 헤딩 없음).
- 다만 이 갈림은 무작위가 아니라 **문서 성격 축**을 따른다 — "도메인 규칙"류(`audit-actions`, `error-codes`, `egress-masking`, `redis-keys`, `migrations`)는 명시 헤딩을, "형식/포맷 정의"류(`*-api-metadata.md`, `swagger.md`, `node-output.md`)는 인트로 프로즈를 쓰며, 두 `*-api-metadata.md` 형제 문서가 서로 그 패턴을 공유해 의도된 스타일 분화로 보인다. SKILL.md 자체가 "권장"(강제 아님)으로 명시하므로 CRITICAL/WARNING 이 아니라 INFO.
- 제안: 규약을 갱신할 필요는 없어 보이나, 만약 리뷰어/신규 기여자가 이 갈림을 "빠짐"으로 오독하는 사례가 반복되면 `project-planner/SKILL.md` 에 "형식 정의류 conventions 문서는 인트로 프로즈로 Overview 를 대체할 수 있다"는 한 줄을 추가해 명문화하는 편이 안전하다.

### [정보 확인 — 위반 아님] `_overview.md` frontmatter 부재는 의도된 예외

- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/conventions/makeshop-api-catalog/_overview.md`
- 위반 규약 후보: `spec-impl-evidence.md §1` lifecycle frontmatter(`id`/`status`) 의무
- 확인 결과: 두 `_overview.md` 모두 frontmatter 가 없는 반면 형제 리소스 파일(`category.md`, `store.md`, `translation.md`, `benefit.md` 등)은 전부 `id`/`status`/`code` frontmatter 를 보유한다. 그러나 `spec-impl-evidence.md` §"제외" 목록에 `spec/_*.md` 및 `spec/<영역>/_*.md`(밑줄 prefix, 예시로 `_overview.md` 명시)가 lifecycle 비대상으로 **명시적으로 등재**돼 있어 위반이 아니라 규약이 정확히 예측한 설계다. (§R-7 도 필드-레벨 카탈로그만 제외 대상으로 다루고 top-level `<resource>.md` 인덱스는 검증 유지한다고 밝혀, `_overview.md`(밑줄 규칙)와 `<resource>.md`(정식 spec)의 구분이 두 근거에서 일관됨.)
- 참고로 남김 — 별도 조치 불요.

### [정보 확인 — 위반 아님] `makeshop-api-catalog/*.md` 의 `id` prefix 화는 의도된 충돌 회피

- target 위치: `spec/conventions/makeshop-api-catalog/{order,product,member,shop,benefit,board,cpik}.md`
- 확인 결과: 이 파일들의 frontmatter `id` 는 `makeshop-order`, `makeshop-product` 등으로 서비스 prefix 가 붙어 있어, `cafe24-api-catalog/{order,product}.md` 의 `id: order`/`id: product` 와 basename 이 겹침에도 전역 `id` 충돌이 나지 않는다. `makeshop-api-metadata.md §8` 이 이 결정을 "cafe24 는 18 resource 가 먼저 자리잡아 prefix 없이 unique 했던 선례 — 두 번째 이커머스부터 prefix 가 필요해진 케이스"로 명시적으로 문서화하고 있어, `spec-impl-evidence.md` 의 "후발 문서가 영역 prefix 로 충돌을 회피" 규칙을 정확히 따른 사례다. CRITICAL/WARNING 아님 — 오히려 규약 준수의 좋은 선례.

### [정보 확인 — 위반 아님] 실제 diff(`egress-masking.md`) 는 자기 규약을 스스로 지킨다

- target 위치: `spec/conventions/egress-masking.md` (frontmatter `code:` +1줄, §1 표 2행 소비처 셀 보강, §2 캐비엇 정정)
- 검증: (1) 신규 등재 경로 `codebase/backend/src/shared/utils/terminal-error-payload.ts` 실재 확인. (2) 문서가 인용하는 심볼 `redactTerminalError`/`toTerminalErrorPayload` 가 그 파일에 정확히 그 이름으로 존재(§ "인용은 심볼 기준이다" 규율 준수 — 라인 번호 인용 없음). (3) `redactTerminalError` 내부가 실제로 `deepRedactSecrets` 를 호출해 "표 2행(`MAX_REDACT_DEPTH`) 소비처" 로 분류한 것이 소스와 일치. (4) "`toTerminalErrorPayload` 호출부 5곳, 전부 emit 쪽" 주장을 `grep` 으로 재현 — `chat-channel.dispatcher.ts`(1) · `execution-engine.service.ts`(3) · `retry-turn.service.ts`(1) = 5곳, 정확히 일치. (5) 본문에 마커 리터럴 값을 적지 않고 이름(`VALUE_MASK_MARKER` 등)으로만 지칭하는 §Overview 의 자기 규율도 diff 구간에서 유지됨.
- 결론: 이 변경은 명명·인용·SoT 분리 규약을 모두 준수한다. 추가 조치 불요.

## 요약

이번 bundle 의 실제 diff(`spec/conventions/egress-masking.md`, +3/-2)는 정식 규약(심볼 기준 인용, 마커 리터럴 비노출, SoT 분리, frontmatter `code:` 실존)을 정확히 준수하며 코드 실측과도 100% 일치한다. `spec/conventions/` 전체를 스캔한 정적 감사에서도 CRITICAL/WARNING 급 위반은 발견되지 않았다 — `id` 네임스페이스 충돌 회피(`makeshop-` prefix), lifecycle frontmatter 제외 규칙(`_*.md`) 적용 모두 규약이 예측한 그대로였다. 유일하게 눈에 띄는 것은 top-level conventions 문서 23개 중 8개만 명시적 `## Overview` 헤딩을 쓰고 나머지는 인트로 프로즈로 대체하는 비일관인데, 이는 CLAUDE.md/SKILL.md 가 "권장"으로 못박은 항목이고 문서 성격(도메인 규칙 vs 형식 정의)에 따라 일관되게 갈리므로 INFO 수준으로만 남긴다.

## 위험도

NONE
