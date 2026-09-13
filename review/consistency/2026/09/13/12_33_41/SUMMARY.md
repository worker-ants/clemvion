# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건. WARNING 다수(그 중 3개 checker 가 같은 근본 원인으로 수렴)와 INFO 다수가 있으나 착수 자체를 막을 사유는 아니다.

## 전체 위험도
**MEDIUM** — 차단 사유는 없으나, `guide-error-code-existence` 가드 가족이 자신의 SoT(`user-guide-evidence.md`)에 애초부터 미등재된 상태에서 이번 plan 이 그 가드에 새 축(환경변수)을 더 얹어 gap 을 넓힌다는 지적이 cross_spec·rationale_continuity·plan_coherence 세 checker 에서 독립적으로 수렴했다. 아울러 두 checker(cross_spec, convention_compliance)가 프롬프트 번들이 컨텍스트 예산으로 `spec/conventions/` 대다수 파일(특히 `error-codes.md`·`user-guide-evidence.md`·`spec-impl-evidence.md`)을 절단했다고 보고했으나, 양쪽 다 워크트리 파일시스템을 직접 읽어 보완했다고 명시했으므로 이번 보고서의 결론 자체는 유효하다(단, "여기 없다≠없다"는 원칙에 따라 이 캐비어트를 상단에 남긴다).

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 Critical 0건)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 이 없어 인계 대상 자체가 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec + plan_coherence (수렴) | `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 가 "SoT: `user-guide-evidence.md`" 를 자칭하지만 그 문서 §2 "Build-time 가드 (3건)" 표와 frontmatter `code:` 목록에 두 파일이 없음(`grep -rn "guide-error-code" spec/` 0건). 이번 plan 이 같은 파일에 환경변수 축을 추가해 gap 을 더 키움 | `spec/conventions/user-guide-evidence.md` §2 표 + frontmatter `code:` | `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`, `guide-error-code-existence.test.ts` (+ `guide-sanitized-message-parity.test.ts`) | `plan/in-progress/guide-identifier-existence.md` 체크리스트에 "세 파일을 §2 표 + `code:` 에 등재" 항목 추가. `developer` 는 `spec/` 쓰기 권한이 없으므로(자기-반증형 소정정 조건 불충족 — 제품/코드 evidence 목록은 예외 대상 아님) `project-planner` 턴으로 분리하거나, `harness-review-gate-followups.md` 선례처럼 유예를 재개 신호와 함께 명시 등재 |
| 2 | rationale_continuity | 이 가드의 핵심 설계 원칙("허용목록 없음", `plan/complete/guide-error-code-truth.md §D/§J` 및 코드 JSDoc 에서 확립)을 이번 plan 이 실측 근거(§B)로 정당하게 번복하지만, 그 근거가 spec `## Rationale` 로 승격되지 않고 plan/코드 주석에만 남음 | `spec/conventions/user-guide-evidence.md` (Rationale 섹션 부재) | `plan/in-progress/guide-identifier-existence.md §B/§C` | 위 #1 의 spec 등재 작업과 한 턴에 묶어, ①왜 이번 축은 "허용목록 없음" 을 유지 못했는지(§B 실측) ②왜 §D/§J 의 기각 근거(자기증명 오염)가 env 축엔 적용 안 되는지 Rationale 에 명시. 두 번 나눠 등재하면 표가 두 번 미완결 상태가 될 위험(이 가드 계열의 반복 패턴) |
| 3 | plan_coherence | `plan/in-progress/guide-identifier-existence.md` frontmatter 에 `spec_impact` 필드 자체가 없음(Gate C 관례: 실재 경로 리스트 또는 bare `none` 명시 필수, 대조군: `keyset-cursor-uuid-validation.md`·`deps-guard-hardening.md`) | `plan/in-progress/guide-identifier-existence.md` frontmatter (1~5행) | 위 #1/#2 처분 여부 | #1 을 반영하기로 하면 `spec_impact: [spec/conventions/user-guide-evidence.md]`, 반영 안 하기로 하면 `spec_impact: none` 을 명시 |
| 4 | convention_compliance | `cafe24-api-metadata.md` §4 "용어 주의" 박스가 노드 출력 envelope 정의처를 "**Principle 7**" 로 인용하나 실제 5필드 정의는 **Principle 0** 소유(Principle 7 은 config echo 전용). 인용 필드 목록도 `status` 누락. `git log -S` 확인 결과 2026-05-16 작성 시점부터 오인용, 재넘버링 결과 아님. 링크 무결성 가드는 평문 인용이라 못 잡음 | `spec/conventions/cafe24-api-metadata.md` §4 말미 | `spec/conventions/node-output.md` (Principle 0 = 5필드 정의, Principle 7 = config echo) | "Principle 7" → "Principle 0" 정정 + 필드 목록에 `status` 추가. `project-planner` 경로로 처리(이번 plan 범위와 무관한 별개 오류) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | 이번 plan §C 가 원 트래커(`spec-draft-nullable-notation-followups.md` line ~3515) 의 "처분 제안"(허용목록 대신 문맥을 좁히는 쪽이 맞다)을 실측으로 정면 번복하지만, 원문 tracker item 은 여전히 미해결 상태로 반대 방향을 "맞다"고 적어 둔 채임 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 해당 항목 | 트래커 종결 단계에서 원문에 취소선 + 번복 근거(§A/§B 실측) 병기(이 파일이 이미 쓰는 `~~원문~~` + `> 해소 —` 패턴 재사용) |
| 2 | naming_collision | 가드 파일명(`guide-error-code-*`)이 환경변수까지 포괄하도록 확장되면 이름이 실제 스코프보다 좁아짐 | 구현 예정 `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts` | 리네임(`guide-identifier-existence.*` 등) 하거나, 안 하기로 하면 그 결정과 근거를 plan 체크리스트에 명시 |
| 3 | naming_collision | 신규 판정 축(환경변수)을 기존 `CitationAxis`(`"field-table"\|"code-field"\|"prose"`) 의 `"prose"` 로 오버로드하면 axis 3 의 "실패-문맥 게이팅" 의미와 섞여 리포트만으로 구분 불가 | `guide-error-code-scan.ts:61` `CitationAxis` 타입 | 새 라벨(예: `"identifier"`/`"env-var"`) 사용 + JSDoc 축 표에 새 행 추가 |
| 4 | naming_collision | 신설 "방어적 허용목록" 이름이 `KNOWN_DOCS_ABSENT`(Cafe24 문서 부재 허용목록, 무관한 도메인) 와 `KNOWN_*` 접두를 공유하면 grep 상 혼동 | `catalog-docs-drift.spec.ts` 의 `KNOWN_DOCS_ABSENT` | 도메인 명시 접두 사용(예: `GUIDE_EXTERNAL_VOCAB_ALLOWLIST`) |
| 5 | convention_compliance | `cafe24-api-catalog/*.md` 18개 resource 인덱스 중 `## Rationale` 유무가 파일마다 들쭉날쭉(구조 위반은 아님, `spec-impl-evidence.md §4.2` 가 flat/무-index 로 이미 다르게 취급) | `spec/conventions/cafe24-api-catalog/*.md` | `_overview.md` 에 "결정이 있을 때만 Rationale 을 붙인다" 한 줄 명시(선택) |
| 6 | cross_spec | 신설 허용목록·env 기준집합 확장은 기존 named allowlist(`cafe24-restricted-scopes.md`·`egress-masking.md`·`node-output.md`) 및 `secret-store.md` 와 도메인·검증 축이 달라 충돌 없음(확인 완료) | 해당 없음 | 조치 불요 |
| 7 | cross_spec, convention_compliance | 프롬프트 번들이 컨텍스트 예산으로 `spec/conventions/` 대다수(특히 `error-codes.md`·`user-guide-evidence.md`·`spec-impl-evidence.md`) 를 절단 — 두 checker 모두 워크트리 직접 열람으로 보완했다고 명시 | 번들 조립 로직 | 향후 라운드에서 관련도 높은 파일을 우선 포함하도록 청크 순서 개선 검토(알파벳순이 budget 벽에 먼저 걸림) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 이번 plan 은 `spec/**` 무편집(harness-only) — 유일 실질 발견은 가드 SoT 미등재(WARNING #1 로 통합), 신설 허용목록/env 기준집합은 기존 정책과 충돌 없음 확인 |
| rationale_continuity | MEDIUM | "허용목록 없음" 원칙 번복 근거가 spec Rationale 로 승격되지 않음 — Rationale 연속성 메커니즘이 이 가드 계열에서 애초에 성립하지 않는 상태를 이번 변경이 넓힘 |
| convention_compliance | LOW | `cafe24-api-metadata.md` 의 Principle 번호 오인용(WARNING #4, 이번 plan 과 무관한 별개 결함) 외 frontmatter/명명 규약은 전수 확인 통과 |
| plan_coherence | MEDIUM | SoT 미등재(WARNING #1) + `spec_impact` 누락(WARNING #3) + 원 트래커 미정정(INFO #1) — 셋 다 체크리스트 보완으로 해소 가능 |
| naming_collision | LOW | 확정된 충돌 0건 — 구현 단계 명명 시 주의할 INFO 3건만 |

## 권장 조치사항
1. `plan/in-progress/guide-identifier-existence.md` 체크리스트에 "`spec/conventions/user-guide-evidence.md` §2 표 + frontmatter `code:` 에 `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`/`guide-sanitized-message-parity.test.ts` 등재" 항목 추가 (WARNING #1).
2. 같은 spec 갱신에 "허용목록 없음" 원칙 번복의 Rationale(§B 실측 vs §D/§J 기각 근거와의 구분)을 함께 기록 (WARNING #2) — 두 번 나눠 하지 말 것.
3. plan frontmatter 에 `spec_impact` 필드를 위 처분에 맞춰 채움: 등재하면 경로 리스트, 유예하면 `none` + 유예 사유 (WARNING #3).
4. `spec/conventions/cafe24-api-metadata.md` §4 의 "Principle 7" → "Principle 0" 정정 + `status` 필드 추가는 `project-planner` 턴에서 별도 처리 (WARNING #4, 이번 plan 과 무관).
5. `spec-draft-nullable-notation-followups.md` 원 트래커 항목에 취소선 + 번복 근거 병기 (INFO #1).
6. 구현 PR 에서 가드 파일명/`CitationAxis` 라벨/신설 허용목록 이름 명명 시 INFO #2~#4 반영.
