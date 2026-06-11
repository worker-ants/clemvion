# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 파일 4: codebase/frontend/src/app/(main)/integrations/[id]/page.tsx

- **[CRITICAL]** `tryTranslateLabel` 함수가 MakeShop 라벨을 영구 miss 하여 Activity 탭 라벨이 렌더되지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-catalog-labels/codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` 라인 830–841
  - 상세: `tryTranslateLabel` 가 MakeShop 키 (`makeshop.shop.get-authority` 등)에 대해 `fullKey = "makeshopCatalog.makeshop.shop.get-authority"` 를 구성한 뒤 `t(fullKey)` 를 호출한다. i18n 코어의 `resolve()` 함수는 `.` 로 분리하여 nested dict 를 순회하므로 `dict["makeshopCatalog"]["makeshop"]["shop"]["get-authority"]` 경로를 탐색한다. 그러나 `makeshopCatalog` dict (`codebase/frontend/src/lib/i18n/dict/ko/makeshopCatalog.ts`) 는 `"makeshop.shop.get-authority"` 를 **JS 객체의 단일 flat 키**로 저장하고 있어 `dict.makeshopCatalog["makeshop"]` 이 `undefined` 가 된다. 결과적으로 `t(fullKey)` 는 키 문자열을 그대로 반환하고, `tryTranslateLabel` 의 `translated === fullKey` 분기가 `null` 을 반환한다. 파일 내 주석 "makeshop 은 dict(161 op) 가 채워져 라벨이 렌더되고" 와 실제 동작이 정반대다.
  - 근거: `codebase/frontend/src/lib/node-definitions/makeshop-extras.ts` 의 `resolveMakeshopOperationLabel` 주석 — "dict 키 자체에 `.` 가 포함돼 일반 `useT(dotted.key)` 의 nested-lookup 흐름과 충돌하므로 `makeshopCatalog` flat dict 를 직접 lookup 한다" — 가 이 문제를 명시적으로 기록하고 있다. `tryTranslateLabel` 는 같은 우회 로직 없이 `t()` 를 그대로 사용한다.
  - 제안: MakeShop 키(`makeshop.*`)에 대해서는 `t()` 를 사용하지 않고 `resolveMakeshopOperationLabel(locale, catalogKey)` 를 직접 호출하도록 변경한다. `locale` 은 `useT` 훅이 노출하거나 `useLocale()` 훅으로 획득한다. 예시:
    ```ts
    function tryTranslateLabel(catalogKey: string, t: TFunction): string | null {
      if (catalogKey.startsWith("makeshop.")) {
        const locale = getCurrentLocale(); // useLocale() 또는 동등물
        const label = resolveMakeshopOperationLabel(locale, catalogKey);
        return label === catalogKey ? null : label; // miss 시 null
      }
      if (!catalogKey.startsWith("cafe24.")) return null;
      const fullKey = `cafe24Catalog.${catalogKey}` as TranslationKey;
      const translated = t(fullKey);
      if (translated === fullKey) return null;
      return translated;
    }
    ```
    혹은, `makeshopCatalog` 를 `page.tsx` 로 직접 import 하여 flat dict lookup 을 인라인으로 수행할 수도 있다.

---

### 파일 3: codebase/backend/src/modules/integrations/integrations.service.ts

- **[INFO]** spec §9.3 — "미지원 `:type` 은 일반 404" — 코드 미반영 (기존 동작 유지)
  - 위치: `integrations.service.ts` 라인 1191 (`return { operations: [] }`)
  - 상세: spec/2-navigation/4-integration.md §9.3 는 "`:type ∈ {http, database, …}` 은 빈 배열" 과 별개로 "미지원 `:type` 은 일반 404" 를 명시한다. 현재 코드는 `cafe24`/`makeshop` 이 아닌 **모든** 타입(완전 미등록 포함)에 빈 배열을 반환한다. 이는 이번 PR 의 변경 사항이 아니라 기존 동작이며, 본 PR diff 는 이 부분을 건드리지 않았다. V-06 수정 범위에 포함되지 않은 pre-existing 상태이므로 severity INFO 로 기록한다.
  - 제안: 별도 백로그 항목으로 처리. `serviceType` 이 service registry 에 등록된 알려진 타입인지 확인 후, 미등록 타입이면 `NotFoundException` 반환.

---

### 파일 1: codebase/backend/src/modules/integrations/integrations.controller.ts

- **[INFO]** [SPEC-DRIFT] Swagger description 이 spec §9.3 의 "초기 응답 정책" 문구와 일치하도록 갱신됐으나, spec §9.3 본문은 아직 "초기엔 `cafe24` 만 채워 반환" 문구를 포함할 수 있음
  - 위치: `integrations.controller.ts` 라인 37, 43
  - 상세: diff 는 Swagger description 의 "초기엔 `cafe24` 만 채워 반환" 문구를 "`cafe24` · `makeshop` 은 operations 목록을 채워 반환" 으로 갱신한다. spec/2-navigation/4-integration.md §9.3 본문 (라인 816) 은 이미 `:type='cafe24'` 및 `:type='makeshop'` 을 모두 명시하고 있으므로 spec 과 코드 간 일치 상태이다. Swagger `@ApiOperation.description` 이 갱신되지 않았다면 drift 였을 것이나, 이번 diff 가 정확히 수정했다. 발견사항 없음.

---

### 파일 2: codebase/backend/src/modules/integrations/integrations.service.spec.ts

- **[INFO]** 테스트 regex `^makeshop\.[a-z0-9_]+\.[a-z0-9_-]+$` — `resource` 세그먼트가 `[a-z0-9_]+` 로 정의돼 있으나, 현재 7개 resource (`shop`, `product`, `order`, `member`, `benefit`, `board`, `cpik`) 는 모두 알파벳 소문자만으로 구성되어 실질적 문제 없음. 운영상 위험 없으나 spec §1 "섹션 이름은 catalog 디렉토리 및 노드 `resource` enum 과 1:1 일치" 에 따라 regex 가 overly permissive 한 수준이나 functional 오류는 없다.

- **[INFO]** `returns makeshop operations as \`makeshop.<resource>.<operation>\` keys` 테스트는 백엔드 service 레이어의 catalog 반환을 검증하지만, 프론트엔드 `tryTranslateLabel` 의 실제 라벨 렌더 경로를 검증하지 않는다. CRITICAL 발견사항(#1)의 functional regression 이 이 테스트로 감지되지 않는다.

---

### 파일 5: plan/in-progress/spec-code-cross-audit-2026-06-10.md

- **[INFO]** plan 파일이 V-06·V-08 을 "해소" 로 기록하고 있으나, CRITICAL 발견사항(#1)에 따르면 V-08 (Activity 탭 라벨 namespace cafe24 고정) 의 프론트엔드 구현이 기능적으로 불완전하다. plan 의 체크 마킹은 코드가 합쳐지면 수정이 필요할 수 있다.

---

## 요약

본 PR 의 핵심 목적인 MakeShop catalog operations 반환(백엔드 `getServiceCatalog` + 테스트)과 Swagger doc 갱신은 spec §9.3 및 `makeshop-api-metadata.md §2` 와 line-level 로 일치하며 요구사항을 충족한다. 그러나 프론트엔드 `tryTranslateLabel` 함수의 MakeShop 분기는 i18n `t()` 의 nested-key 순회 메커니즘과 `makeshopCatalog` 의 flat dotted-key 구조 간 충돌로 인해, MakeShop Activity 탭의 operation 라벨이 실제로는 렌더되지 않는다 — `resolveMakeshopOperationLabel` 이 이 문제를 이미 해결한 방식(flat dict 직접 lookup)을 사용하지 않은 것이 원인이다. 이 버그는 해당 기능을 완전히 무력화하므로 CRITICAL 등급이며 배포 전 수정이 필요하다.

## 위험도

CRITICAL
