# Cross-Spec 일관성 검토 결과

- 검토 모드: --impl-done (V-06/V-08 makeshop catalog 구현 완료)
- diff-base: origin/main
- 검토 시각: 2026-06-11

---

## 발견사항

### 1. [WARNING] 4-integration.md Rationale L1147 — "초기엔 cafe24 만 응답" 문구 stale

- **target 위치**: git diff 내 `integrations.service.ts` 주석 및 `integrations.controller.ts` Swagger 설명 — 구현은 `cafe24`·`makeshop` 양쪽 응답을 정확히 반영
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-catalog-labels/spec/2-navigation/4-integration.md` L1147
- **상세**:
  - 본문 §9.3 (L816) 의 "초기 응답 정책" 항목은 이미 `:type='cafe24'` 및 `:type='makeshop'` 을 모두 명시해 갱신되어 있다.
  - 그러나 같은 파일 Rationale 절 L1147 은 **"왜 초기엔 cafe24 만 응답하나"** 라는 헤더와 "나머지 3종은 활동 로그 `apiLabel` 이 NULL 이라 catalog lookup 자체가 발생하지 않는다" 본문이 그대로 남아, makeshop 이 추가된 현 상태와 맞지 않는다.
  - 구현(서비스·컨트롤러 주석)이 "cafe24·makeshop 은 operations 목록을 채워 반환" 으로 정확히 기술되어 있는 반면, spec Rationale 의 근거가 구현과 어긋난 설명을 유지하고 있다.
- **제안**: `spec/2-navigation/4-integration.md` L1147 의 Rationale 헤더를 "왜 cafe24·makeshop 만 응답하나" 로, 본문을 "그 외 3종(http, database, email 등)은 활동 로그 `apiLabel` 이 NULL 이라 catalog lookup 자체가 발생하지 않는다 — 빈 배열을 응답해 향후 신규 서비스 추가 시 row 만 채우면 되도록 확장점을 유지한다" 로 갱신.

---

### 2. [INFO] spec/2-navigation/4-integration.md §9.3 API table "초기 응답 정책" 리스트의 미지원 type 목록에 `makeshop` 미포함 이미 갱신됨 — 확인 사항

- **target 위치**: `spec/2-navigation/4-integration.md` L816 §9.3
- **충돌 대상**: 없음 (이미 갱신됨)
- **상세**: §9.3 본문은 `:type='cafe24'` 및 `:type='makeshop'` 을 명시하고 있어 구현과 일치한다. 추가 갱신 불필요.
- **제안**: 단순 확인 — spec §9.3 은 정상. Rationale L1147 만 남은 stale 포인트.

---

### 3. [INFO] spec/conventions/cafe24-api-metadata.md §7.5 — "초기 책임 분리 표" 참조 문구 내 makeshop 언급 없음

- **target 위치**: `spec/conventions/cafe24-api-metadata.md` §7.5 (L414–L432)
- **충돌 대상**: git diff `integrations.service.ts` `buildOperationCatalog` 함수 주석 — `cafe24·makeshop 의 catalog key 조립이 동일해 단일 헬퍼로 묶는다`
- **상세**: `cafe24-api-metadata.md §7.5` 책임 분리 표는 cafe24 만 기술하며 `cafe24Catalog` dict lookup 흐름만 명시한다. makeshop 이 추가됐으므로 "i18n 변환" 행의 범위를 `cafe24Catalog` 및 `makeshopCatalog` dict 로 확장하는 것이 바람직하다. 현 상태에서는 해당 표가 makeshop 을 누락해 새로 본 문서를 읽는 개발자가 makeshop label 흐름을 파악하기 위해 `makeshop-api-metadata.md` 를 추가로 읽어야 한다. 기능 충돌은 아니지만 크로스-doc 일관성 측면에서 명시가 권장된다.
- **제안**: `cafe24-api-metadata.md §7.5` 책임 분리 표의 "i18n 변환" 행을 "frontend i18n dict `cafe24Catalog.<key>` (KO/EN) · `makeshopCatalog.<key>` (KO/EN)" 으로 확장하거나, 각 provider 별 dict 참조를 병기하는 cross-reference 주를 추가. 또는 `makeshop-api-metadata.md` 에 동등 표 추가 (현재 미보유).

---

### 4. [INFO] 4-integration.md §4.6 "API" 열 설명 — cafe24 예시만 언급, makeshop 병기 권장

- **target 위치**: `spec/2-navigation/4-integration.md` L371 §4.6 Activity 탭 표
- **충돌 대상**: 없음 (기능 충돌 아님)
- **상세**: L371 의 API 컬럼 설명은 "(cafe24 catalog key → '상품 목록 조회' 등)" 을 예시로만 쓴다. L378 에서는 이미 "makeshop 도 동일" 로 보완되어 있지만, L371 자체의 예시가 cafe24 단독이라 스캔 시 makeshop 을 빠뜨린 인상을 준다. 기능 동작은 이미 spec-correct.
- **제안**: L371 예시를 "cafe24 catalog key → '상품 목록 조회', makeshop catalog key → '주문 목록 조회' 등" 으로 병기하거나, L371 에서 L378 의 두 provider 명시 문장으로 리다이렉트 주석을 추가.

---

## 요약

구현 diff(V-06/V-08) 는 spec §9.3·§4.6·`spec/conventions/makeshop-api-metadata.md §2`·`spec/4-nodes/4-integration/_product-overview.md INT-US-05` 의 선언과 전면 일치한다 — `getServiceCatalog` 의 makeshop 분기, `buildOperationCatalog` 헬퍼의 `key`/`labelKey`/`descriptionKey` 형식, frontend `tryTranslateLabel` 의 provider-prefix flat-dict lookup 전환 모두 spec-compliant. 단, `spec/2-navigation/4-integration.md` Rationale L1147 의 "왜 초기엔 cafe24 만 응답하나" 헤더와 본문이 현 구현(cafe24+makeshop 양쪽 응답)과 어긋나 stale 상태이며(WARNING), cafe24-api-metadata §7.5 의 책임 분리 표와 §4.6 API 열 예시가 makeshop 을 누락한 INFO 수준 동기화 포인트가 2건 존재한다. 기능 모순(CRITICAL)은 없다.

## 위험도

LOW
