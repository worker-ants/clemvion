# Rationale 연속성 검토 결과

검토 범위: `spec/conventions/` — `audit-actions.md`, `cafe24-api-catalog/_overview.md`, `cafe24-api-catalog/application.md` + 하위 entity 파일, `cafe24-api-catalog/category.md` + 하위 entity 파일
diff-base: origin/main
검토 모드: --impl-done

---

## 발견사항

### 발견사항 없음 (CRITICAL / WARNING 0건)

payload 에 포함된 Rationale 발췌 (`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/*.md`) 범위 내에서 target 문서가 기각된 대안을 재도입하거나, 합의된 원칙을 직접 위반하거나, 근거 없이 기존 결정을 번복한 사례는 발견되지 않았다.

---

### [INFO] audit-actions.md 의 핵심 Rationale 의존 출처가 payload 외부

- **target 위치**: `spec/conventions/audit-actions.md § Rationale` 마지막 note
- **과거 결정 출처**: `spec/5-system/1-auth.md §Rationale 4.1.A` (payload 미포함)
- **상세**: target 문서는 taxonomy 구조 설계 근거를 본 문서에 두고, 인증 도메인(`user.*`) 측 명명 배경(dot-prefix 통일·과거분사 확정·Planned 정규화)은 `1-auth.md §Rationale 4.1.A` 가 소유한다고 명시한다. 해당 Rationale 이 이번 payload 에 포함되지 않아 audit-actions 의 `user.*` 패턴(과거분사 §2.1) 및 레지스트리 표와의 정합을 교차 검증할 수 없었다.
- **제안**: 다음 Rationale 연속성 검토 시 `spec/5-system/1-auth.md §Rationale 4.1.A` 를 payload 에 포함시켜 인증 도메인 쪽 명명 결정과의 정합을 확인한다. 현재 target 자체의 기술(§3 레지스트리 표, §2.1 `user.*` 과거분사)은 내부 일관성이 있으므로 단독으로는 문제 없다.

---

### [INFO] cafe24-api-catalog §7.1 의 spec-impl-evidence.md §Rationale R-7 참조가 payload 외부

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md §7.1` — "spec frontmatter 가드 제외"
- **과거 결정 출처**: `spec/conventions/spec-impl-evidence.md §Rationale R-7` (payload 미포함)
- **상세**: field-level 파일(`<resource>/**/*.md`)을 lifecycle frontmatter(`id`/`status`) 의무에서 면제하는 결정의 근거로 `§Rationale R-7` 을 cross-link 하고 있으나, 해당 Rationale 문서가 이번 payload 에 없어 "생성기 산출물 = 라이프사이클 면제" 원칙이 `spec-impl-evidence.md` 의 기존 결정과 충돌하지 않는지 완전 교차 검증이 불가하다. target 문서 자체는 면제 범위를 `cafe24-api-catalog/<resource>/**/*.md` 로 한정하고 최상위 `<resource>.md` 인덱스는 정식 검증 유지 대상임을 명시하고 있어 내부 기술은 일관적이다.
- **제안**: 다음 Rationale 연속성 검토 시 `spec/conventions/spec-impl-evidence.md` 전체 Rationale 절을 payload 에 포함시켜 field-level 면제 결정의 소급 정합성을 확인한다.

---

### [INFO] catalog `status: deprecated` 와 spec frontmatter `status: archived` 의 구분 — Rationale 부재

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md §3` — `deprecated` 항 비고
- **과거 결정 출처**: `spec/conventions/spec-impl-evidence.md` (payload 미포함)
- **상세**: `deprecated` (Cafe24 외부 endpoint 폐기 상태) 와 spec frontmatter `status: archived` (spec 문서 자체의 폐기) 가 별도 도메인임을 명시하고 있으나, 두 개념을 분리한 이유("왜 catalog status 를 spec lifecycle frontmatter 와 동일 어휘로 두지 않는가")에 대한 Rationale 이 본 문서 §3 또는 별도 문서에 작성되지 않았다. 현재로서는 "별도 도메인" 선언으로 끝나 설계 의도가 후속 편집자에게 명확히 전달되지 않을 수 있다.
- **제안**: `_overview.md §Rationale` 절(현재 없음)을 신설하거나 `spec-impl-evidence.md §Rationale R-7` 에 이 구분의 근거(cafe24 catalog status 는 외부 API 생명주기 표현, spec frontmatter 는 내부 문서 lifecycle 표현이라 어휘 공간을 분리)를 한 항으로 추가한다.

---

### [INFO] category.md `mains_update`/`mains_delete` seed row — 기각된 대안 부재

- **target 위치**: `spec/conventions/cafe24-api-catalog/category.md` 표 footnote `[^seed]`
- **과거 결정 출처**: 관련 Rationale 문서 payload 미포함
- **상세**: `mains_update`/`mains_delete` 가 docs 비노출임에도 `status: supported` 를 유지하는 이유를 "하위호환용 seed" 로 설명하고 follow-up 트랙(cafe24-backlog-residual §G-2)을 명시한다. 결정은 합리적이나, 왜 `status: planned` 나 `status: deprecated` 로 낮추지 않았는지에 대한 기각 대안 근거가 footnote 에 없다. 기존 카탈로그 §3 의 status enum 정의("supported = 메타데이터 row 존재")를 그대로 적용한 것으로 보이며 enum 범위 내 결정이므로 CRITICAL/WARNING 은 아니다.
- **제안**: footnote `[^seed]` 에 "docs 미노출에도 supported 를 유지하는 이유: backend 메타데이터 row 가 존재하므로 §3 정의상 supported 가 맞음. planned 로 내리면 `catalog-sync.spec.ts` 규칙1(supported→메타 존재) 과 규칙2(메타→supported) 에서 검증 대상이 달라져 혼선. deprecated 로 내리면 Cafe24 가 공식 deprecated 한 것으로 오독 가능." 한 줄을 추가해 기각 대안을 문서화한다.

---

## 요약

이번 payload 에 포함된 Rationale 발췌 범위(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/*.md`)와 target 문서(`spec/conventions/audit-actions.md`, `spec/conventions/cafe24-api-catalog/`) 사이에서 CRITICAL 또는 WARNING 등급의 Rationale 연속성 위반은 발견되지 않았다. target 문서들은 자체 `## Rationale` 절에서 채택한 결정을 명시하고, 기각된 대안(`workspace.ownership_transferred` 정규화, §4.1 산문 규약 유지 등)을 명시적으로 기록하고 있어 연속성 원칙을 준수한다. `spec/5-system/2-api-convention.md` 의 페이지네이션 응답 shape 설명 노트(+2줄)는 scope 외(`spec/conventions/`) 이며, 기존 `TransformInterceptor` pass-through 동작을 사후 문서화한 것으로 과거 결정을 번복하지 않는다. 가장 밀접한 Rationale 의존 출처(`spec/5-system/1-auth.md §Rationale 4.1.A`, `spec/conventions/spec-impl-evidence.md §Rationale R-7`)가 이번 payload 에 포함되지 않아 해당 영역의 교차 검증이 불완전하다. 위 INFO 항목 4건은 검증 공백과 소규모 Rationale 기술 보완 제안이며, 실질적 설계 오류를 나타내지는 않는다.

---

## 위험도

LOW
