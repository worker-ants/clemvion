# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/` (impl-done, diff-base=origin/main)
실제 변경 파일: `spec/2-navigation/4-integration.md` 1 파일, 39 라인 diff

---

## 발견사항

### [WARNING] MakeShop `api_label` catalog key 정책 번복 — Rationale 갱신 부분적·불완전

- **target 위치**: `spec/2-navigation/4-integration.md` §4.6 DTO 테이블 (line ~830), Rationale "활동 로그 API 식별 — 3컬럼 (label/method/path) + catalog endpoint 신설" (lines 1132–1147)
- **과거 결정 출처**: 동일 문서 Rationale "활동 로그 API 식별" 항 (origin/main 기준). 원래 서술:
  - 3컬럼 채우기 정책 표에 `makeshop` 행 포함: `catalog key (makeshop.<resource>.<operation>)` / HTTP method / path template
  - "cafe24·makeshop 이 catalog 라벨을 갖고 나머지(http/database/email 등)는 endpoint-only" — 3컬럼 denormalize 근거로 두 provider 의 `(label, endpoint)` 2줄 표시를 명시
  - DB 저장 항목: `catalog key (cafe24.<resource>.<operation> / makeshop.<resource>.<operation>)`
  - Frontend i18n dict: `cafe24Catalog / makeshopCatalog` dict
  - Catalog endpoint 반환 정책: `cafe24·makeshop 만 operations[] 채워 반환`
- **상세**: target 에서 makeshop 을 catalog-label 제공 통합에서 제외(NULL 처리)하도록 Rationale 와 채우기 정책 표를 수정했다. 그러나 동일 문서의 **비-Rationale 본문 두 곳**이 makeshop catalog 를 여전히 살아있는 정책으로 서술하고 있어 내부 불일치가 발생했다:
  1. **§4.6 activity label 서술** (line 378): `"makeshop 도 동일 (makeshop.<resource>.<operation> + services/makeshop/catalog). 그 외 통합은 apiLabel 이 NULL 이라 endpoint 만 표시"` — makeshop 이 여전히 catalog-lookup 통합으로 기술.
  2. **§9.3 API 표** (line 816): `"초기 응답 정책: :type='cafe24' 및 :type='makeshop' 만 backend 메타데이터에서 추출한 operations[] 를 채워 반환"` — makeshop 이 catalog operations 를 채우는 provider 로 명시.

  또한 Rationale 자체가 번복 이유(왜 makeshop 은 NOW NULL 인가)를 제공하지 않는다 — 구현 코드(activity-label.ts / integrations.service.ts)는 makeshop catalog 를 제거하는 방향으로 구현됐지만, spec Rationale 은 "왜 이 결정을 번복하는가 / makeshop 구현이 완료되지 않아서인가 / 향후 복원 계획은 있는가" 를 기록하지 않았다.

- **제안**:
  1. `spec/2-navigation/4-integration.md` §4.6 line 378 의 makeshop catalog 서술을 제거하거나 "(현재 미구현 — Planned)" 로 표기.
  2. §9.3 API 표 line 816 의 `초기 응답 정책` 을 `:type='cafe24' 만` 으로 수정.
  3. Rationale "활동 로그 API 식별" 항 말미에 makeshop 제외 이유(예: "makeshop 은 현재 구현에서 api_label NULL 정책을 적용하므로 catalog entry 가 없다. 향후 구현 완료 시 재추가한다") 를 한 문단 추가.

---

### [INFO] Rationale 채우기 정책 표 — makeshop 행 제거는 구현 현실 반영이나 §9.3·§4.6 본문과 단절

- **target 위치**: `spec/2-navigation/4-integration.md` Rationale 3컬럼 정책 표 (lines 1132–1138)
- **과거 결정 출처**: 동일 Rationale, 동일 표 (origin/main)
- **상세**: Rationale 표에서 makeshop 행 삭제 자체는 구현 코드(activity-label.ts 가 makeshop catalog 조회를 하지 않음)와 정합이다. 그러나 Rationale 표만 갱신하고 본문(§4.6, §9.3)을 갱신하지 않아, "정책이 어디가 SoT인가" 가 불명확해졌다. INFO 수준이지만 위 WARNING 항과 연결된 동일 근본 원인이다.
- **제안**: 위 WARNING 의 본문 갱신으로 동시에 해소 가능.

---

## 요약

`spec/2-navigation/4-integration.md` 에서 MakeShop 의 `api_label` catalog key 정책을 번복(채움 → NULL)하는 Rationale 갱신이 이루어졌다. 갱신 방향은 구현 코드(activity-label.ts)와 정합하나, 동일 spec 문서의 §4.6 서술(line 378)과 §9.3 API 표(line 816) 두 곳이 makeshop 을 여전히 catalog-operations 제공 provider 로 기술해 spec 내부 불일치가 생겼다. 또한 번복 이유(왜 makeshop 이 지금은 NULL 인가)를 Rationale 에 기록하지 않아, 이후 검토자가 "makeshop 을 의도적으로 제외한 것인가 vs 미구현 상태인가"를 판단할 근거가 없다. 이 두 본문 위치를 갱신하고 번복 근거 한 문단을 Rationale 에 추가하면 연속성 위험이 해소된다.

## 위험도

MEDIUM

---

STATUS: SUCCESS
