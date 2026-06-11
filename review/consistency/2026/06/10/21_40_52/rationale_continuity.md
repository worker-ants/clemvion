# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 범위: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)
계획 문서: `plan/in-progress/security-fixes-audit-guard-secret-rotation.md`

---

## 발견사항

### INFO-1 — C3 fix 가 `spec/5-system/14-external-interaction-api.md §7.1` 의 `notification_secret_v2` 컬럼 의미와 충돌 가능성 검토 필요
- **target 위치**: `plan/in-progress/security-fixes-audit-guard-secret-rotation.md §설계 C3` — "promote 루프에서 `secrets.rotate(ref, wsId, v2)` + `signing.secretRef=ref` 설정(+평문 키 제거)"
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §7.1` 및 `spec/data-flow/15-external-interaction.md §1.5` Rationale "§1.5 구현 갭을 본문에 남긴 이유" — EIA spec §7.1 은 `notification_secret_v2` 컬럼을 grace 기간 동안 ref 만 보관하는 것으로 기술하고(`ref 만 보관 (rotation grace 기간)`), Rationale 는 이 갭이 "보안 운영에 직접 영향"하므로 developer plan 으로 해소한다고 명시.
- **상세**: C3 계획은 promote 루프가 v2 평문을 `secretRef` 로 승격하는 경로를 fix 하는 것이며, 이는 Rationale 이 기록한 의도된 수정 방향과 일치한다. 단, EIA spec §7.1 의 "notification_secret_v2 컬럼도 동일하게 ref 만 보관" 문장이 이미 이 컬럼을 ref 로 기술하고 있는 반면, 실제 코드는 평문을 사용 중이므로 fix 완료 후 data-flow spec §1.5 의 구현 갭 callout 을 제거하는 것 외에 EIA spec §7.1 본문(컬럼 설명) 이 코드 현실을 반영하는지 재확인이 필요하다. 이는 기각된 대안의 재도입이 아니라 갭 기술 문서 정합 문제다.
- **제안**: fix 완료 후 `spec/data-flow/15-external-interaction.md §1.5` 의 구현 갭 blockquote 제거와 함께, `spec/5-system/14-external-interaction-api.md §7.1` 의 `notification_secret_v2` 컬럼 설명이 "ref 만 보관" 으로 이미 올바르게 기술되어 있으므로 별도 변경은 불필요하다는 것을 확인하면 된다.

### INFO-2 — V-03 fix 가 `spec/5-system/1-auth.md §3.3` 의 API 인가 흐름 원칙과 부합하는지 확인
- **target 위치**: `plan/in-progress/security-fixes-audit-guard-secret-rotation.md §설계 V-03` — "`AuditLogsController.findAll` 에 `@Roles('admin')` — RolesGuard 가 membership+role 동시 검증 (비멤버 차단 포함)"
- **과거 결정 출처**: `spec/5-system/1-auth.md §3.3` API 인가 흐름 — "요청 리소스가 해당 워크스페이스에 속하는지 확인 → 역할이 해당 액션에 대한 권한을 가지는지 확인". 권한 매트릭스(§3.2) 에서 Audit Log 는 `Admin+` 로 명시.
- **상세**: `@Roles('admin')` 추가는 §3.2 와 §3.3 의 원칙을 그대로 이행하는 구현이다. 기각된 대안(전역 JwtAuthGuard 만 사용, @Roles 미지정)이 실수로 코드에 들어와 있던 상태를 바로잡는 것이므로 Rationale 위반 없음.
- **제안**: 해당 없음. 원칙 이행이다.

### INFO-3 — `spec/data-flow/1-audit.md §Rationale` 의 "userId 필터 미구현" 과 V-03 의 userId 필터 추가
- **target 위치**: `plan/in-progress/security-fixes-audit-guard-secret-rotation.md §설계 V-03` — "`QueryAuditLogDto` 에 `userId?` (`@IsUUID`) 추가 + service where 절"
- **과거 결정 출처**: `spec/5-system/1-auth.md §4.2` — "기간, 사용자, 액션 유형으로 필터링". `spec/data-flow/1-audit.md §2.1` 은 userId 필터가 현재 미구현임을 기술.
- **상세**: spec §4.2 는 userId 필터링을 요구사항으로 포함하고 있으며 data-flow §2.1 이 이를 미구현 갭으로 기록 중이다. 이번 구현은 spec 의 원래 요구사항을 이행하는 것으로 Rationale 를 번복하지 않는다. 기각된 대안은 없다.
- **제안**: 해당 없음.

---

## 요약

`spec/5-system/` 의 모든 관련 Rationale 와 계획 중인 V-03·C3 구현 사이에 **기각된 대안의 재도입, 합의된 원칙 위반, 근거 없는 결정 번복, invariant 우회** 는 발견되지 않았다. V-03 (audit-logs `@Roles('admin')` + userId 필터) 는 `1-auth.md §3.2/§3.3` 의 권한 매트릭스와 API 인가 원칙을 그대로 이행한다. C3 (rotation promote 경로 secretRef fix) 는 `data-flow/15-external-interaction.md §1.5` Rationale 와 `14-external-interaction-api.md §7.1` 이 의도한 수정 방향을 정확히 따른다. Graph RAG(10)·MCP Client(11) spec 과는 이번 계획 범위가 교차하지 않으므로 Rationale 연속성 이슈 없음. fix 완료 후 spec 갭 callout 제거(plan 체크리스트에 이미 포함) 만 정확히 수행하면 문서 정합이 유지된다.

## 위험도

NONE

---

STATUS: SUCCESS
