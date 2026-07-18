# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: 구현 착수 전 검토 (--impl-prep, scope=`spec/conventions/`)
- target: `spec/conventions/` (전체)

## 방법론 노트 (선행 확인)

`_prompts/convention_compliance.md` 에 실제로 번들된 target 본문은 `spec/conventions/audit-actions.md` 전문 +
`spec/conventions/cafe24-api-catalog/`(`_overview.md`·`application.md`·`application/*.md` 8개·`category.md`·
`category/autodisplay.md` 일부)뿐이며, 그 뒤(`cafe24-api-metadata.md`, `frontend-layering.md`,
`interaction-type-registry.md`, `node-output.md`, `swagger.md` 등 alphabetically 후순위 파일 전부 포함)가
"... (truncated due to size limit) ..." 로 잘려 있다. **이는 신규 결함이 아니라 이 저장소의 기존 known failure
pattern이다** — `plan/in-progress/interaction-type-guard-comment-false-negative.md` 후속 항목에 "harness,
비차단 — consistency 번들러가 `cafe24-api-catalog/**` 대용량 덤프에 밀려 target spec 본문을 누락"으로 이미
추적 중이며, 이번 세션에서도 동일하게 재현됐다.

번들 누락을 보완하기 위해 filesystem 을 직접 read 해 이 브랜치(`claude/interaction-type-guard-followup-bd683a`,
최근 커밋이 `interaction-type-registry.md` 문구 정정 PR #977)와 직접 관련된 `spec/conventions/interaction-type-registry.md`
· `spec/conventions/frontend-layering.md` · `spec/conventions/spec-impl-evidence.md` · 가드 구현
(`spec-frontmatter-parse.ts`, `catalog-sync.spec.ts`) 을 추가로 대조했다. 아래 발견사항은 (a) 번들에 실제
포함된 cafe24-api-catalog 서브트리, (b) 직접 확인한 위 보완 파일들을 모두 포괄한다.

## 발견사항

- **[INFO]** 리뷰 payload 번들링이 대용량 카탈로그에 밀려 target 스펙 본문을 누락
  - target 위치: 세션 `_prompts/convention_compliance.md` 전체 (target 문서 정의 섹션)
  - 위반 규약: 해당 없음 — 규약 문서 자체의 결함이 아니라 harness(consistency-checker 오케스트레이터)의 번들링 로직 결함
  - 상세: `spec/conventions/` alphabetical 순회 중 `cafe24-api-catalog/` 서브트리(224개 파일, 수백KB)가 프롬프트
    크기 상한을 다 소진해 그 뒤 20개 flat 컨벤션 파일(`interaction-type-registry.md`·`frontend-layering.md` 포함,
    이번 작업과 가장 직접적으로 관련된 파일들)이 target 에서 통째로 빠졌다.
  - 제안: 이미 `plan/in-progress/interaction-type-guard-comment-false-negative.md` 후속 ④(harness, 비차단)로
    추적 중이므로 신규 항목 생성 불필요. 다만 재발이 반복적이므로 (예: 카탈로그 서브트리를 target 열거에서
    파일 수 상한 또는 depth 상한으로 별도 캡핑) 우선순위를 올리는 것을 권장.

- **[WARNING]** `cafe24-api-metadata.md` 가 `_overview.md §4` 의 검증 규칙 번호를 잘못 인용 (규칙8 ≠ 규칙9)
  - target 위치: `spec/conventions/cafe24-api-metadata.md:119`, `:373` (두 곳 모두 "`[_overview §4]... 검증 규칙 8 참고`")
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §4` 자체 (본 세션 target 에 포함된 문서)
  - 상세: `_overview.md §4` 의 실제 번호는 — 규칙8 = "`planned` row ↔ `planned.ts` mirror 양방향 동기", 규칙9 =
    "`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기(`level='program'` 제외 포함)". 그런데
    `cafe24-api-metadata.md` 는 `level='program'` 제외 서술 옆에서 정확히 "규칙9" 를 가리켜야 할 자리에
    "규칙8"을 인용한다(두 곳 모두 동일 오류). `_overview.md` 는 이미 규칙8 자체에 대해 "테스트 헤더 주석은
    이를 '규칙7'로 칭한다 — 본 문서 번호와 1칸 어긋남에 유의" 라고 별도의 known drift 를 자체 문서화하고
    있어, 규칙 번호가 여러 곳에서 흔들리고 있다는 신호다. 이번에 발견된 규칙8/규칙9 혼동은 그 known drift
    와는 다른 새 지점.
  - 제안: `cafe24-api-metadata.md:119,373` 의 "검증 규칙 8" → "검증 규칙 9" 로 정정. `spec/` 쓰기 권한은
    `project-planner` 소관.

- **[INFO]** `cafe24-api-catalog/_overview.md §2` 의 `id` 컬럼 명명 규칙 예시가 실제 다수 카탈로그 파일의
  명명 패턴을 대표하지 못함
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §2` (`id` 컬럼 정의, "`<resource>_<verb>`
    ... 예: `product_list`, `product_options_create`")
  - 위반 규약: 동일 문서 §2 자체 — 규칙 서술과 실제 카탈로그 데이터 간 예시 불일치 (강제 test 는 없음: 확인
    결과 `catalog-sync.spec.ts` 는 "id 의 resource 내 unique" 만 검증하고 resource-prefix 일치는 검증하지 않음)
  - 상세: 예시 두 개(`product_list`, `product_options_create`)가 모두 파일명=id-prefix 가 일치하는
    `product.md` 에서만 나왔다. 그러나 실제로 번들에 포함된 `application.md`는 `scripttags_list`·`apps_update`·
    `appstore_orders_get`·`databridge_logs_list`·`recipes_list`·`webhooks_logs_list` 등 파일의 Cafe24Resource
    이름("application")이 아니라 하위 entity 이름을 id prefix 로 쓰며, `category.md` 도 `category_*` 와
    `mains_*`/`autodisplay_*` 가 혼재한다. `_overview.md §5` 는 이미 "`store.md` 의 `privacy_*` id 명명 우려
    (별 `privacy` resource 와 prefix 충돌)" 를 별도로 인지하고 있어, 이런 류의 명명 모호성이 처음 발견되는
    것은 아니다.
  - 제안: 심각도는 낮음(강제 가드 없음, 이미 유사 사례가 문서 내 인지됨) — §2 id 정의 예시에 이질적
    sub-resource 를 묶는 파일(예: `application.md`) 케이스를 하나 추가하거나, "`<resource>`" 가 파일 단위
    Cafe24Resource 가 아니라 entity(sub-resource) 단위를 가리킬 수 있음을 명시하면 오독 위험이 줄어든다.
    Blocking 은 아님.

- **[INFO]** field-level 카탈로그 entity id 의 `__`(이중 언더스코어) 표기가 §7.1 명명 규칙 본문에
  명시적으로 문서화되지 않음
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §7.1` (entity_id 명명: "kebab-case —
    docs anchor 식별자와 동일 형식, 예: `appstore-orders`") vs 실제 파일
    `spec/conventions/cafe24-api-catalog/category/categories__decorationimages.md`
  - 위반 규약: 동일 문서 §7.1 자체
  - 상세: §7.1 이 제시하는 유일한 예시(`appstore-orders`)는 단일 하이픈 kebab-case 다. 그러나
    `categories__decorationimages.md` 는 공식 docs anchor(`#categories--decorationimages`, 이중 하이픈)를
    파일명에서 이중 언더스코어로 옮긴 사례로, 이 변환 규칙(이중 하이픈 anchor → 이중 언더스코어 파일명)이
    본문에 서술돼 있지 않다. 파일 자체는 frontmatter `entity: categories__decorationimages` 로 일관돼 있어
    동작상 문제는 없으나, 규약 문서가 이 하위 패턴을 누락해 향후 유사 entity 추가 시 재현 가능한 규칙인지
    판단하기 어렵다.
  - 제안: §7.1 에 "중첩 anchor(`--`)는 파일명에서 `__`로 치환" 한 줄만 추가하면 해소. Blocking 아님.

## 준수 확인 (긍정 발견 — 참고용)

- `audit-actions.md` frontmatter(`id`/`status`/`code`)·본문 3섹션 구조(`## Overview`→§1-3→`## Rationale`) 모두
  `spec-impl-evidence.md` 스키마와 `project-planner/SKILL.md` 의 "3섹션 권장" 을 충실히 따름. `code:` 글로브
  대상 파일(`audit-action.const.ts`) 실존 확인, `AUDIT_ACTIONS` 유니온이 문서의 "구현" 표기 항목과 정확히 일치
  (`workspace.deleted` 제외까지 포함).
- `cafe24-api-catalog/*.md` 최상위 인덱스(`application.md`, `category.md`)의 frontmatter(`id`/`status: implemented`/
  `code:`) 는 `spec-impl-evidence.md §1 제외` 정규식(`CATALOG_FIELD_FILE`)에 걸리지 않아 정식 spec 으로
  검증 유지되는 게 맞고, 실제로 `id`/`status`/`code` 를 보유 — 규약과 일치. `code:` 글로브 대상 파일
  (`application.ts`, `category.ts`) 실존 확인.
- field-level entity 파일(`application/apps.md` 등)은 `resource`/`entity`/`cafe24_docs`/`source` 4-필드
  frontmatter만 갖고 `id`/`status` 가 없음 — `spec-impl-evidence.md §1 제외`(R-7, `CATALOG_FIELD_FILE` 정규식)
  요건과 정확히 일치.
- `application.md`/`category.md` 의 표 row 수가 `_overview.md §5` Coverage Matrix 수치(각 17)와 정확히 일치.
  Field-level 링크 목록도 실제 디렉터리 파일 목록과 1:1 일치(허구 링크 없음).
- (보완 확인) `interaction-type-registry.md`, `frontend-layering.md` 는 번들에는 없었으나 직접 대조 결과
  frontmatter `code:` 경로 전량 실존, 3섹션 구조 준수, `spec-impl-evidence.md`/`spec-frontmatter-parse.ts`
  규약과 정합. 최근 커밋(PR #977)이 "grep"→"AST 스캔" 용어 drift 를 이미 정정해 현재 상태는 코드 구현과
  일치.

## 요약

번들된 target(카탈로그 서브트리)과 filesystem 직접 대조 양쪽에서 CRITICAL 급 정식 규약 위반은 발견되지
않았다. `audit-actions.md`·`cafe24-api-catalog` 최상위 인덱스·field-level 파일의 frontmatter 스키마는
`spec-impl-evidence.md`(§1 제외 규칙 포함)와 정확히 합치하며, 실제 가드 구현(`spec-frontmatter-parse.ts`,
`catalog-sync.spec.ts`)과도 어긋나지 않는다. 발견된 항목은 모두 WARNING 이하로, (1) `cafe24-api-metadata.md`
의 규칙 번호 오인용(규칙8→9, 실제 위반), (2)(3) 카탈로그 명명 규칙 서술이 실제 데이터의 일부 패턴을
완전히 커버하지 못하는 문서 명확성 갭(강제 가드 없음, 기존에도 유사 이슈 인지됨), (4) 리뷰 payload 번들링이
대용량 카탈로그에 밀려 target 본문 일부(이번 작업과 가장 관련 깊은 `interaction-type-registry.md` 등)를
누락한 이미 추적 중인 harness 결함이다. 모두 즉시 차단할 사유는 아니다.

## 위험도

LOW
