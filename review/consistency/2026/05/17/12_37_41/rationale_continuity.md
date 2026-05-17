# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/` (cafe24-restricted-scopes 작업 — impl-prep)
검토 기준 Rationale: `spec/2-navigation/4-integration.md §Rationale — Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)`

---

### 발견사항

이번 검토에서 CRITICAL 또는 WARNING 등급의 Rationale 연속성 위반은 발견되지 않았다. 아래는 검토 과정에서 확인된 정합 사항과 INFO 수준 보완 제안이다.

- **[INFO]** `restricted` 컬럼 순서 — `_overview.md §2` 기재 순서와 개별 파일 헤더 일치 여부
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §2` 컬럼 표 (restricted 항목 기술), 개별 파일 mileage/notification/privacy 표 헤더
  - 과거 결정 출처: Rationale "Cafe24 별도 승인 scope 의 식별·안내" — `restricted` 컬럼을 `status` 와 직교하는 별도 컬럼으로 정의
  - 상세: `_overview.md §2` 의 컬럼 나열 순서는 `scope | paginated | restricted | status | docs` 순이지만(표에서 paginated 뒤에 restricted 기재), mileage/notification/privacy/store 파일의 실제 테이블 헤더는 `scope | restricted | paginated | status` 순서를 사용한다. 두 표현이 컬럼 기재 순서에서 미묘하게 다르다. 의미 충돌은 아니며 파싱·동기 테스트는 컬럼 이름 기반이므로 순서 차이가 runtime 오류를 유발하지는 않는다. 그러나 사람이 새 카탈로그 파일을 추가할 때 _overview.md 를 참조 표준으로 쓴다면 순서 혼동이 생길 수 있다.
  - 제안: `_overview.md §2` 컬럼 표의 순서를 실제 파일들의 헤더 순서(`scope | restricted | paginated`)와 맞추거나, 반대로 파일들의 헤더를 _overview.md 기준(`scope | paginated | restricted`)으로 통일한다. 어느 쪽이든 한 방향으로 통일하면 충분하다.

---

### Rationale 정합 확인 사항 (위반 없음)

1. **기각 대안 C (status enum 확장) 미채택 확인**: `_overview.md §2` 가 "이 컬럼은 `status` 와 직교하며 `status` 의 값이 아니다 — `supported` + `restricted: op` 조합이 정상이다" 를 명시하여, Rationale 에서 기각한 "catalog `status` enum 확장" 대안을 재도입하지 않았다. 정합.

2. **기각 대안 A (차단 정책) 미채택 확인**: 카탈로그의 `restricted` 컬럼은 안내 데이터(WarningBadge·tooltip 렌더 재료)로 설계되어 있으며, 차단 동작을 카탈로그 spec 자체에 포함하지 않는다. Rationale 의 "차단 없음, 안내만" 원칙과 일치.

3. **기각 대안 B (신규 에러 코드 추가) 미채택 확인**: 카탈로그 파일에 새 에러 코드 정의가 없다. 에러 경로는 기존 `INSUFFICIENT_SCOPE(403)` + `details.requiresCafe24Approval` 보강 필드 경로를 사용하는 Rationale 결정과 충돌하지 않는다.

4. **동기 규칙 8 신설**: `_overview.md §4` 의 검증 규칙 8 (`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기)은 Rationale 에 명시된 "backend 메타데이터의 `restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로" 결정의 직접 구현이다. `level='program'` 메타데이터 row 를 카탈로그 검증 대상에서 제외한 것도 Rationale 의 "별도 트랙 (Analytics 등)" 처리와 정합.

5. **기존 Rationale 의 invariant (install_token / OAuth 흐름 / status machine 등)**: 이번 target 변경 (카탈로그 `restricted` 컬럼 추가) 은 OAuth 흐름·install_token·status machine 과 무관한 metadata 레이어 변경이다. 관련 invariant 를 우회하거나 충돌하는 내용 없음.

---

### 요약

`spec/conventions/cafe24-api-catalog/` 의 `restricted` 컬럼 추가 및 개별 리소스 파일(mileage/notification/privacy/store) 갱신은 `spec/2-navigation/4-integration.md` Rationale "Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)" 의 결정을 충실히 구현하고 있으며, 해당 Rationale 에서 명시적으로 기각된 세 대안(A 차단 정책·B 신규 에러 코드·C status enum 확장) 중 어느 것도 재도입하지 않았다. 과거 결정의 직교 컬럼 원칙과 동기 테스트 규칙도 spec 본문에 명확히 반영되어 있다. 유일한 관찰 사항은 `_overview.md §2` 컬럼 나열 순서와 개별 파일 헤더 순서 사이의 표기 불일치(INFO 수준)로, 의미 충돌이나 테스트 오류를 유발하지는 않으나 사람이 신규 파일을 추가할 때 혼동을 방지하기 위해 통일을 권장한다.

---

### 위험도

NONE
