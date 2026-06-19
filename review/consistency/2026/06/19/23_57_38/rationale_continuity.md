# Rationale 연속성 검토 결과

검토 모드: --impl-done, scope=spec/conventions/, diff-base=origin/main

---

### 발견사항

- **[INFO]** `audit-actions.md` — 시제 taxonomy 2분류에서 3분류로 확장
  - target 위치: `spec/conventions/audit-actions.md §Rationale "왜 2분류가 아니라 3분류인가"`
  - 과거 결정 출처: 해당 없음 (기존 Rationale 에서 "2분류만 허용" 을 명시적으로 결정한 선례 없음. `5-system/1-auth.md §Rationale 4.1.A` 가 별도 SoT 이며, 본 taxonomy 분류 자체의 선행 결정 문서 없음)
  - 상세: `audit-actions.md` 는 초안이 "과거분사 / CRUD 현재형" 2분류였다가 3분류로 확장했다고 본 Rationale 에 직접 기록하고 있으며, 확장 이유(`execution.re_run`, `workspace.transfer_ownership` 부적합)를 명시했다. 기각된 대안도 명시 기록.
  - 제안: 현재 상태 이상 조치 불필요. Rationale 이 변경 근거를 충분히 담고 있음.

- **[INFO]** `cafe24-api-catalog/_overview.md §3` — `deprecated` 용어와 `spec-impl-evidence §R-4` 의 명명 충돌 경계
  - target 위치: `_overview.md §3 status enum` "deprecated" 항목 주석
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §Rationale R-4` ("archived 와 deprecated 의 의미 도메인 분리")
  - 상세: R-4 는 spec 문서의 `archived` 와 cafe24 catalog 의 `deprecated` 가 다른 도메인임을 명시하고 혼동을 경계했다. `_overview.md §3` 의 `deprecated` 항목 주석은 "spec frontmatter `status: archived`([spec-impl-evidence.md]) 와는 별 도메인 (spec 문서 자체의 폐기)" 이라는 문구를 직접 포함해 R-4 를 정확히 준수하고 있다.
  - 제안: 이상 없음. 의도된 충돌 방지 주석이 기존 Rationale 과 정합함.

- **[INFO]** `cafe24-api-catalog/<resource>/<entity>.md` 필드 파일 — `id`/`status` frontmatter 부재
  - target 위치: `application/apps.md` 등 전 field-level 파일의 frontmatter (`resource`/`entity`/`cafe24_docs`/`source` 만 포함)
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §1 적용 대상` 제외 항목 + `§Rationale R-7` ("API 레퍼런스 카탈로그 필드 파일 제외")
  - 상세: R-7 은 `<name>-api-catalog/<resource>/**/*.md` 경로의 파일을 frontmatter lifecycle 추적 대상에서 명시적으로 제외했다. 이유는 생성기 산출물이라 추적할 구현 lifecycle 이 없기 때문. `_overview.md §7.1` 도 "spec frontmatter 가드 제외(§Rationale R-7)" 라고 명시 cross-reference 한다. 필드 파일들이 `id`/`status` 를 생략한 것은 이 결정을 정확히 따른 것이다.
  - 제안: 이상 없음.

---

### 요약

검토 대상 `spec/conventions/` 내 문서들은 기존 spec Rationale 에서 기각·합의된 결정을 위반하는 사례가 없다. `audit-actions.md` 는 taxonomy 초안 2분류에서 3분류로 확장하면서 그 근거(기각 대안 포함)를 본 문서 Rationale 에 자체 기록했다. `cafe24-api-catalog` 필드 단위 파일들은 `spec-impl-evidence.md §R-7` 이 승인한 생성물 제외 패턴을 준수하며, `_overview.md §3` 의 `deprecated` 주석은 R-4 의 명명 도메인 분리 의도를 정확히 반영한다. 번복된 과거 결정, 기각 대안의 재도입, 합의된 invariant 우회는 발견되지 않았다.

---

### 위험도

NONE
