# 정식 규약 준수 검토 — `spec/conventions/`

## 검토 범위에 대한 선행 고지 (중요)

본 target 번들(`convention_compliance.md` 프롬프트)은 `spec/conventions/` 전체를 실었으나, **대다수 파일이 "컨텍스트 예산 초과" 로 본문이 절단**되어 있다. 완전히 렌더된 파일은 다음 뿐이다:

- `spec/conventions/audit-actions.md` (전문)
- `spec/conventions/cafe24-api-catalog/_overview.md` (전문)
- `spec/conventions/cafe24-api-catalog/category.md` · `store.md` · `translation.md` (전문)
- `spec/conventions/cafe24-api-metadata.md` (전문)

반면 **출력 포맷 규약(관점 2)·API 문서 규약(관점 4) 판단에 직접 필요한 원본** — `error-codes.md`(17,742자) · `swagger.md`(30,184자) · `node-output.md`(28,758자) · `secret-store.md`(22,431자) · `spec-impl-evidence.md`(19,522자) · `migrations.md` 등 — 은 전부 "⚠ 본문 생략됨" 절단 상태였다. `cafe24-api-catalog/` 하위 18개 리소스 인덱스 중 15개(`application.md`~`shipping.md` 등)와 field-level entity 파일 약 230개도 동일하게 절단됐다.

이는 MEMORY 에 이미 기록된 기존 결함(`consistency --spec 기본 예산이 conventions 를 통째로 떨군다`)과 같은 증상으로 보인다. **관점 2·4는 이 파일만으로는 사실상 검증 불가**이며, 아래 "발견사항 없음" 은 "확인했더니 없음" 이 아니라 "확인할 본문이 없었음" 을 뜻한다는 점을 통합 SUMMARY 가 구분해야 한다.

## 발견사항

- **[WARNING] `cafe24-api-catalog/_overview.md` 에 lifecycle frontmatter 결여**
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 최상단 (frontmatter 없이 `# CONVENTION: Cafe24 API Catalog — Overview` 로 바로 시작)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §1` (lifecycle frontmatter `id`/`status` 의무) — 해당 문서 본문은 이번 번들에서 절단되어 원문을 직접 대조하진 못했으나, 같은 디렉토리 안에서 그 규약을 **인용하는 문장**이 `_overview.md` §7.1 자신에 있다: "본 field-level 파일은 … lifecycle frontmatter(`id`/`status`) 의무에서 **제외**된다 (`<name>-api-catalog/<resource>/**/*.md` … ) … **카탈로그 최상위 `<resource>.md` 인덱스는 정식 spec 으로 계속 검증된다**."
  - 상세: 그 서술대로 실제 `category.md`/`store.md`/`translation.md` (모두 `<resource>.md`, cafe24-api-catalog/ 바로 아래 1-세그먼트 파일) 는 예외 없이 `id`/`status: implemented`/`code:` frontmatter를 갖췄다. 그런데 `_overview.md` 도 같은 디렉토리 1-세그먼트 위치(`cafe24-api-catalog/<resource>/**/*.md` 예외 glob 에 매치되지 않음 — `_overview.md` 는 `<resource>/` 하위 디렉토리가 아니라 자기 자신이 파일)이면서 frontmatter가 전혀 없다. `<resource>.md` 18개는 전부 검증 대상이라 명시했으니, 같은 레벨의 `_overview.md` 도 대상이거나, 대상이 아니라면 그 예외가 §7.1에 명시돼야 하는데 되어 있지 않다.
  - 제안: (a) `_overview.md` 에도 `id: cafe24-api-catalog-overview` 류 frontmatter 를 추가해 다른 인덱스 파일과 정합을 맞추거나, (b) 의도적으로 제외하려는 것이면 §7.1 예외 glob 서술에 `_overview.md` 를 명시적으로 추가한다. `spec-impl-evidence.md` 원문이 절단돼 실제 가드 정규식까지는 대조 못 했으므로, `--impl-prep` 재실행 시 그 파일을 온전히 포함해 확정할 것을 권한다.

- **[WARNING] entity id 명명 규칙 문서가 실제 파일명의 `__` 중첩 표기를 설명하지 않음**
  - target 위치: `spec/conventions/cafe24-api-catalog/category.md` §"Field-level 상세 카탈로그" 의 링크 목록(예: `category/categories__decorationimages.md`, `category/categories__seo.md`) 및 `_overview.md` §7.1 규칙 정의 문단
  - 위반 규약: `_overview.md` §7.1 자신 — "`<entity_id>` 는 Cafe24 docs 의 sub-resource 식별자 (**kebab-case** — docs anchor 식별자와 동일 형식, 예: `appstore-orders`). 한 resource 내 unique."
  - 상세: §7.1 이 제시하는 유일한 예시(`appstore-orders`)는 순수 kebab-case(하이픈만)다. 그런데 실제 파일명 전수(grep 결과 기준 최소 50개 이상)는 `<parent>__<child>` 또는 `<parent>__<child>__<grandchild>` 형태로 **더블 언더스코어(`__`)를 중첩 구분자로 사용**한다 — `categories__decorationimages`, `categories__seo`(category), `boards__articles__comments`(3단 중첩, community), `customers__autoupdate`/`customers__social`(customer), `orders__items__history`/`orders__items__labels`/`orders__items__options`(3단 중첩, order), `paymentgateway__paymentmethods`/`paymentmethods__paymentproviders`(store) 등. 이는 "kebab-case" 라는 서술만으로는 유도되지 않는 별도 표기 규칙이며, §7.1 어디에도 `__` 의 의미(부모-자식 nesting 구분자)가 정의돼 있지 않다.
  - 제안: §7.1 에 "sub-resource 가 다른 sub-resource 아래 중첩된 경우 `__` 로 부모-자식을 잇고, 각 세그먼트 내부는 kebab-case 를 유지한다" 같은 문장을 추가해 실제 관행을 규약에 반영한다.

- **[INFO] 같은 템플릿을 공유해야 할 `<resource>.md` 3파일 사이 섹션 구성이 갈린다**
  - target 위치: `spec/conventions/cafe24-api-catalog/store.md` (`## 표` → `## Rationale` → `## Field-level 상세 카탈로그` 순) vs `category.md`·`translation.md` (`## 표` → `## Field-level 상세 카탈로그` 만 존재, `## Rationale` 섹션 없음)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장" — 강제(CRITICAL)는 아니고 "권장" 이지만, 18개 `<resource>.md` 는 `_overview.md` 가 정의한 **동일 템플릿의 인스턴스**이므로 섹션 셋 자체가 파일마다 달라지는 것은 문서 구조 규약의 일관성 취지와 어긋난다.
  - 상세: `store.md` 의 `## Rationale` 은 실질 내용 없이 `_overview.md`/`cafe24-restricted-scopes.md` 로 위임하는 한 줄+각주뿐이라, category/translation 처럼 아예 생략해도 정보 손실은 없다 — 즉 어느 쪽으로 통일해도 무방하나 지금은 파일마다 다르다.
  - 제안: 18개 `<resource>.md` 전체를 대상으로 "## Rationale (위임 전용, `_overview.md` 참고)" 섹션 유무를 통일한다. field-level 상세 카탈로그 섹션은 위임 Rationale 보다 뒤에 오는 순서(store.md 방식)로 고정하는 편이 자연스럽다.

- **[INFO] `## Overview` 명시적 헤더 유무가 파일마다 다름**
  - target 위치: `spec/conventions/audit-actions.md` (`## Overview` 헤더 명시) vs `spec/conventions/cafe24-api-metadata.md`·`cafe24-api-catalog/_overview.md`·`category.md`/`store.md`/`translation.md` (헤더 없이 도입부 산문으로 대체)
  - 위반 규약: CLAUDE.md 3섹션 구성 권장(§0 "SKILL.md 참고" 각주가 상세 규칙을 위임하나, 표에서 Overview 섹션을 명시적으로 요구)
  - 상세: 이 자체가 CLAUDE.md 상 강제 사항은 아니라("권장") CRITICAL 로 보진 않으나, `spec/conventions/` 안에서도 컨벤션마다 다르다는 점은 신규 conventions 작성자가 어느 쪽을 따라야 할지 판단 근거가 없다는 뜻이다.
  - 제안: 정보성 제안 — 통일 여부는 project-planner 판단.

## 요약

완전히 렌더된 6개 파일(`audit-actions.md`, `cafe24-api-catalog/_overview.md`·`category.md`·`store.md`·`translation.md`, `cafe24-api-metadata.md`) 은 명명·frontmatter·구조 면에서 대체로 자기 정합적이며, 각 파일이 스스로 정의한 금지 항목(인라인 문자열 금지, `ISO8601 date`만 쓰는 것 금지 등)을 스스로 위반하지 않았다. 다만 (1) 카탈로그 인덱스 문서 `_overview.md` 가 형제 `<resource>.md` 들과 달리 lifecycle frontmatter 를 결여하고, (2) 실제 사용 중인 `__` 중첩 entity-id 표기가 명명 규약 문서에 반영돼 있지 않으며, (3) `<resource>.md` 18개가 공유해야 할 섹션 템플릿(`## Rationale` 유무)이 파일마다 갈리는 드리프트가 확인됐다 — 모두 CRITICAL 급 invariant 파괴는 아니고 WARNING/INFO 수준이다. 더 결정적으로는, 관점 2(출력 포맷 규약)·관점 4(API 문서 규약) 판정에 필요한 원본(`error-codes.md`, `swagger.md`, `node-output.md`, `secret-store.md`, `spec-impl-evidence.md` 등)이 이번 번들에서 컨텍스트 예산 초과로 전부 절단되어 있어 그 두 관점은 **사실상 미검증** 상태다. 통합 SUMMARY 는 이 부분을 "문제 없음"이 아니라 "커버리지 갭"으로 반영해야 하며, 필요시 예산을 늘리거나 대상 파일을 분할해 재검토를 권한다.

## 위험도

MEDIUM
