# Convention Compliance Report

**검토 모드**: impl-prep  
**Target**: `spec/2-navigation/6-config.md`  
**검토 일시**: 2026-05-29  

---

## 발견사항

### [INFO] Overview 섹션 누락 — 3섹션 구조 불완전

- **target 위치**: 파일 전체 구조 (도입부)
- **위반 규약**: `CLAUDE.md` §정보 저장 위치 — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고."  
- **상세**: 문서는 `## Part A`, `## Part B`, `## 3. API`, `## Rationale` 4개 top-level 섹션으로 구성된다. 명시적인 `## Overview` 섹션이 없다. 도입부의 짧은 무제 문장들이 Overview 역할을 암묵적으로 수행하고 있으나, 관용 3섹션 패턴의 `## Overview` 헤더가 빠져 있다.
- **제안**: 파일 상단에 `## Overview` 섹션을 명시적으로 추가하거나, 현재 도입 서술을 `## Overview` 헤더 아래로 이동. 또는 spec 설계상 Part A / Part B 가 Overview 겸 본문인 구조라면 그 의도를 Rationale 에 한 줄 추가해 검토자 혼선을 예방.

---

### [INFO] `## 3. API` 섹션 번호 체계 불일치

- **target 위치**: line 174 (`## 3. API`)
- **위반 규약**: 명시적 spec 규약 없음 — 내부 일관성 문제
- **상세**: 문서의 상위 섹션은 `## Part A`, `## Part B` 의 알파벳 파트 방식으로 구성됐는데, API 섹션만 `## 3.` 숫자 prefix 를 사용한다. `spec/5-system/2-api-convention.md` 의 섹션 체계와 다른 것이 아니라 같은 파일 내 명명 일관성 문제다.
- **제안**: `## Part C: API` 또는 `## API` 로 변경해 파트 체계를 통일.

---

### [WARNING] `spec-impl-evidence.md` TTL 검토 — `status: spec-only` + `code: []`

- **target 위치**: frontmatter (lines 1-5)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `spec-only` 상태는 **TTL 90일** 이 있으며 초과 시 build fail.
- **상세**: frontmatter 는 다음과 같다.
  ```yaml
  id: config
  status: spec-only
  code: []
  ```
  `status: spec-only` 이므로 90일 TTL 카운터가 적용된다. 파일의 마지막 spec 수정일이 `## Rationale R-2` 기준 2026-05-28 이므로 현재 TTL 초과 위험은 없다. 그러나 impl-prep 단계에서 구현에 착수한다면, 일부 구현이 완료되는 시점에 `status: partial` + `code:` + `pending_plans:` 갱신을 잊지 않도록 주의해야 한다. **구현 착수 PR 에서 frontmatter 갱신이 누락되면 `spec-frontmatter-rollout.md` plan 이 완료된 이후 가드 실패가 발생한다.**
- **제안**: 구현 PR 머지 시 `status: partial` 또는 `status: implemented` 로 승격하고 `code:` 글로브를 채우는 것을 plan 의 완료 조건에 명시.

---

### [INFO] Swagger 규약 관련 — API endpoint 에 응답 DTO / 래퍼 참조 없음

- **target 위치**: `## 3. API` (lines 178-201)
- **위반 규약**: `spec/conventions/swagger.md §5` — 응답은 DTO 클래스 + 공용 래퍼 헬퍼 (`ApiOkWrappedResponse`, `ApiOkPaginatedResponse` 등) 사용 의무. spec 문서가 구현 청사진을 담고 있으므로 이를 명시하지 않으면 구현자가 인라인 스키마로 작성할 수 있다.
- **상세**: `## 3. API` 표에는 엔드포인트 목록과 간략한 설명만 있고, 응답 DTO 명칭이나 Swagger 래퍼 헬퍼에 대한 참조가 없다. `spec/conventions/swagger.md §5-4` 의 체크리스트 항목 (응답 DTO 위치, `ApiOkWrappedResponse` 등) 을 구현 시 준수해야 함을 spec 내에서 안내하거나 링크로 연결하는 것이 관행.
- **제안**: `## 3. API` 섹션 끝에 "응답 DTO 형식은 [Swagger 규약 §5](../conventions/swagger.md#5-응답-dto-규약) 준수" 한 줄 참조 추가. spec 문서 레벨 변경이므로 낮은 우선순위이나 구현자 가이드 일관성 차원에서 유용.

---

### [INFO] `secret-store.md` 참조 누락 — AuthConfig 자격증명 암호화 계층 불명확

- **target 위치**: `## Part A §A.4 마스킹과 Reveal 흐름` 및 `## Rationale R-2`
- **위반 규약**: 명시적 규약 위반 없음 — 일관성 정보 참조 개선 권고
- **상세**: `spec/conventions/secret-store.md §1` 은 "AuthConfig.config 의 자격증명은 `auth-configs` 모듈 자체의 컬럼 transformer (AES-256-GCM) 가 직접 암복호화한다. 본 `secret://` URI scheme 의 통합 대상이 아니다. 응답 마스킹 정책의 단일 진실도 본 convention 이 아니라 `spec/1-data-model.md §2.17.2`" 라고 명시한다. `6-config.md` 는 `spec/1-data-model.md §2.17.2` 를 `§A.4` 에서 직접 참조하고 있어 SoT 참조 자체는 올바르다. 다만 secret-store convention 에서 AuthConfig 가 비대상임을 명시한 배경(`2026-05-28` changelog) 이 `6-config.md` 에는 없어, 구현자가 `SecretResolver` 를 잘못 사용할 여지가 있다.
- **제안**: `§A.4` 또는 `§A.2` 에 "AuthConfig 자격증명은 `SecretResolver` 를 거치지 않고 모듈 transformer 가 직접 암복호화한다 ([secret-store.md §1 비대상](../conventions/secret-store.md#1-uri-scheme))" 한 줄 참조 추가 (선택 개선).

---

## 요약

`spec/2-navigation/6-config.md` 는 frontmatter `id: config / status: spec-only / code: []` 형식을 포함해 `spec-impl-evidence.md` 의 기본 의무 요건을 충족한다. API endpoint 명명 (`/api/auth-configs`, `/api/llm-configs`, kebab-case 복수형) 은 `spec/5-system/2-api-convention.md §2.2` 규약과 일치하고, 마스킹·Reveal 흐름의 SoT 참조 (`spec/1-data-model.md §2.17.2`) 도 적절히 연결되어 있다. `## Rationale` 섹션은 파일 끝에 존재하며 결정 근거를 잘 담고 있다. 주요 지적사항은 (1) `## Overview` 헤더 누락으로 인한 3섹션 구조 불완전, (2) `## 3. API` 섹션의 알파벳-숫자 혼합 번호 체계, (3) impl-prep 착수 후 frontmatter `status` 갱신 누락 위험, (4) Swagger 래퍼 헬퍼 참조 미비의 4건이다. 모두 INFO 또는 WARNING 등급이며 현재 시점의 채택·구현을 블록하는 CRITICAL 위반은 없다.

---

## 위험도

LOW

STATUS: OK
