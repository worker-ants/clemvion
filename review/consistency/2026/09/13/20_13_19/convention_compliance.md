# 정식 규약 준수 검토 — convention_compliance

검토 대상: `origin/main...HEAD` 의 `codebase/**` diff (4 파일 / 639 줄, "가이드가 «코드» 로 부르던 두 이름이 코드가 아니었다 — 발행 축을 더한다" 배치). `spec/conventions/**` 자체는 이 브랜치에서 델타 0(정상 — 코드 전용 PR).

## 발견사항

- **[WARNING] 리뷰 인용이 `review-citations.md §2` 를 어긴다 — bare `hh_mm_ss`**
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:289`
    ```
    // 같은 클래스의 중복을 새로 만들었다(`19_51_33` maintainability WARNING#4).
    ```
  - 위반 규약: `spec/conventions/review-citations.md` §2 "날짜를 포함한다" — "**bare `hh_mm_ss` 는 쓰지 않는다**" (표에서 명시적으로 "금지"). 적용 범위 §3 은 `codebase/**` 코드·테스트 주석을 "적용" 대상으로 명시한다.
  - 상세: 같은 diff·같은 파일 안의 다른 8개 인용은 전부 `review/code/2026/09/13/19_51_33` 또는 `review/consistency/2026/09/13/18_40_54` 처럼 전체 경로(권장 형태)를 쓰는데, 이 한 줄만 날짜 없이 `19_51_33` 으로만 적었다. 규약이 이 패턴을 금지하는 근거(같은 시각이 여러 날짜에 걸쳐 재발해 이력으로도 해소 불가능해짐, §2 실측표)가 그대로 적용된다. 같은 함수 바로 위 문단이 정확한 형태(`review/code/2026/09/13/19_23_22`)를 쓰고 있어 단순 누락으로 보인다.
  - 제안: `19_51_33` → `review/code/2026/09/13/19_51_33` 로 정정. (이 규약 §2 는 gate 가 없다고 문서 스스로 밝히므로 CI 는 안 잡지만, 같은 PR 안에서 인접 인용과 형태가 어긋나는 것은 리뷰 시점에 고치는 편이 저렴하다.)

- **[INFO] `PROJECT.md` 의 SoT 인용이 실제로 그 절을 가리키지 않는다 (pre-existing, 이 PR 은 유지만 함)**
  - target 위치: `PROJECT.md:300` (`guide-identifier-existence.test.ts` 항목 끝, `SoT: spec/conventions/user-guide-evidence.md §2`)
  - 위반 규약: 직접적인 "금지" 위반은 아니지만 `CLAUDE.md` "정보 저장 위치" 원칙(정식 규약·SoT 인용은 실제로 그 대상을 서술하는 절을 가리켜야 함) 및 [`feedback_measured_claim_proxy_and_timing.md`] 계열 교훈("인접한 두 기준이 있는 문서는 어느 절이 대상인지가 실측의 일부")과 결이 같다.
  - 상세: `spec/conventions/user-guide-evidence.md §2` 는 `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts` **3건**만 열거한 "Build-time 가드" 표다(직접 확인: `grep -n "guide-identifier" spec/conventions/user-guide-evidence.md` → 0건, `grep -rl "GUIDE_EXTERNAL_VOCABULARY\|guide-identifier-existence" spec/conventions/` → 0건). `guide-identifier-existence.test.ts`/`GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` 는 어떤 `spec/conventions/*.md` 에도 등장하지 않는다. 이 SoT 인용은 이번 diff 이전(`origin/main`)부터 이미 이렇게 잘못 걸려 있었고, 이 PR 은 같은 줄의 가운데 서술(발행 축 추가)만 갱신하며 그대로 두었다 — 새로 만든 결함은 아니다.
  - 제안: 이 PR 의 책임 범위는 아니므로 차단 사유는 아니다. 다만 후속으로 (a) SoT 를 실제로 이 가드를 설명하는 절로 고치거나, (b) 이 가드의 정책(존재/발행 축, 두 allowlist 캡, escape-hatch 의미)을 `spec/conventions/` 문서로 승격해 SoT 를 그쪽으로 옮기는 것을 고려할 만하다.

## 명명·출력 포맷 규약 검토 (문제 없음)

- 신규 식별자 `GUIDE_NON_EMITTED_VOCABULARY` / `NON_EMITTED_VOCABULARY_CAP` / `collectQuotedLiterals` / `collectMessagePrefixes` / `collectCatalogCodes` / `isMessagePrefixOnly` 는 기존 자매 식별자(`GUIDE_EXTERNAL_VOCABULARY` / `EXTERNAL_VOCABULARY_CAP` / `collectSourceTokens` / `collectEnvDeclarations`)와 동일한 명명 스타일(UPPER_SNAKE 상수, camelCase 함수)을 그대로 따른다.
- 두 mdx 문서(`logic.mdx`/`logic.en.mdx`) 수정은 `error-codes.md §1` 의 "클라이언트는 코드의 의미로 분기하며 이름 문자열을 파싱하지 않는다" 원칙과 상충하지 않는다 — 오히려 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 실제로는 `error.code` 가 아닌 메시지 접두라고 정정해 규약과의 괴리(가이드가 코드처럼 서술)를 줄이는 방향이다. KO/EN 두 로케일이 동시에 갱신돼 `i18n-userguide.md` 의 로케일 쌍 동기 관행도 지킨다.
- `GUIDE_NON_EMITTED_VOCABULARY` 상한(5)·등록 3건은 거울상 목록(`GUIDE_EXTERNAL_VOCABULARY`)과 동일한 캡·강제 패턴(상한·여전히 인용될 것·죽은 등록 방지)을 그대로 재사용해 새 규약을 만들지 않고 기존 관례를 확장했다 — CLAUDE.md 가 요구하는 "단일 진실" 원칙에 반하지 않는다.
- `error-codes.md §3/§4` 의 historical-artifact/internal-classification 레지스트리 패턴과 이번 diff 의 "카탈로그는 요구 조건이 아니라 탈출구" 설계는 상충하지 않는다 — 이번 diff 는 `error-codes.md` 의 코드 자체를 rename/신설하지 않고 가이드 서술·가드 로직만 바꾼다.
- `spec_impact: none` (plan frontmatter) 은 `spec/conventions/**` 델타 0 과 정합적이며, 이 결정 자체가 규약 위반은 아니다(이 검토 프롬프트가 명시하듯 spec 델타 0 은 코드 전용 PR 에서 정상).

## 요약

이번 diff 는 `spec/conventions/**` 문서를 직접 건드리지 않는 코드 전용 변경이며, 명명·출력 포맷·문서 구조·API 문서 규약 관점에서 새로운 CRITICAL 급 위반은 발견되지 않았다. 유일한 실질 위반은 코드 주석 한 줄의 `review-citations.md §2` bare-timestamp 금지 조항 위반(같은 파일 인접 인용들과도 형태가 다름)이며, 부수적으로 `PROJECT.md` 의 기존(pre-existing) SoT 인용 부정확성을 재확인했다(이 PR 이 만든 결함은 아님). 둘 다 차단 사유는 아니다.

## 위험도
LOW
