# Rationale 연속성 검토 결과

## 발견사항

### [INFO] `re_run_initiated` → `execution.re_run` 개명 — Rationale 갱신 적절히 수행됨
- target 위치: `spec/5-system/13-replay-rerun.md §11`, `spec/data-flow/1-audit.md §1.1 + Rationale`
- 과거 결정 출처: `spec/data-flow/1-audit.md` 의 Rationale "Action 은 자유 문자열, event 는 DB CHECK 로 고정" — 과거분사형(`integration.created`)과 `re_run_initiated`(dot-prefix 이탈)의 "표기 비일관이 실제로 현실화됐다"를 인정하며 "표기 통일은 미해결 과제"로 기록했었다.
- 상세: 이번 변경은 그 미해결 과제를 이행한 것이다. `data-flow/1-audit.md` 의 Rationale 이 "과거 `re_run_initiated`가 dot-prefix를 이탈해 혼재 적재됐으나 cross-audit G-02에서 `execution.re_run`으로 정정됐다"고 명시하며 과거 결정 배경과 번복 근거를 함께 서술했다. 기각된 대안 재도입이 아니라 명시 과제 이행이므로 continuity 위반 없음.
- 제안: 해당 없음 (적절히 처리됨).

### [INFO] `AuditAction` union 도입 — Rationale의 "자유 문자열" 전제 번복, 갱신 수행됨
- target 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (신규), `audit-logs.service.ts` (`action: string` → `action: AuditAction`)
- 과거 결정 출처: `spec/data-flow/1-audit.md` Rationale "Action 은 자유 문자열" — `action: string` 자유 문자열 + "application 단에도 action을 제약하는 union/enum 타입이 없어 (grep `AuditAction` 0건)"를 기정 사실로 서술. 과거 본 문서가 "type 정의가 typo를 막아준다"고 서술했으나 그런 type이 존재하지 않아 폐기했다고 이중 철회.
- 상세: target 은 `AuditAction` union을 신설해 `record({ action })` 을 타입으로 강제한다. 이는 "type 정의가 존재하지 않는다"는 과거 Rationale 서술을 번복하는 변경이다. 그러나 `data-flow/1-audit.md` Rationale이 "application union 으로 강제(DB는 자유 문자열)"로 제목을 갱신하고, "DB CHECK 대신 application union을 택한 이유는 액션 추가가 잦고 DB 마이그레이션 비용을 피하기 위함"이라고 새 근거를 함께 명시했다. 번복과 새 Rationale이 동반됐으므로 무근거 번복에 해당하지 않는다.
- 제안: 해당 없음 (적절히 처리됨).

### [INFO] `spec/5-system/1-auth.md §4.1` — 구현됨/Planned 구분 도입 시 기존 Integration 액션 표기 정정
- target 위치: `spec/5-system/1-auth.md §4.1` — "현재 구현된 액션" 표에서 `integration.create`/`integration.update`/`integration.delete` 가 `integration.created`/`integration.updated`/`integration.deleted`(과거분사형)로 교체되고 `integration.rotated`/`integration.scope_changed`/`integration.reauthorized` 추가됨.
- 과거 결정 출처: `spec/5-system/1-auth.md §4.1` 기존 표는 `integration.create`, `integration.update`, `integration.delete`(동사 원형)를 기록했었음.
- 상세: 기존 spec §4.1 이 동사 원형(`integration.create`) 을 기록했으나 실제 코드와 data-flow/1-audit.md §1.1 표는 처음부터 과거분사형(`integration.created`)을 사용하고 있었다. 이번 변경은 spec을 코드 현실에 맞춰 동기화한 것으로, 기각된 대안 재도입이 아니라 코드-spec 불일치 해소다. spec §4.1 의 Planned 표에서 `integration.create/update/delete`가 제거되고 해당 행이 구현됨 표로 이동했으므로 spec과 코드의 단일 진실 원칙에도 부합한다. 다만 spec Rationale 에 "기존 §4.1의 동사 원형 표기가 실제 구현과 달랐음"을 별도 기록하지 않았다 — data-flow/1-audit.md Rationale이 간접 언급하고 있어 실질적 공백은 없으나, `spec/5-system/1-auth.md` 자체 Rationale에는 이 동기화 근거가 없다.
- 제안: `spec/5-system/1-auth.md` Rationale에 "§4.1 동사 원형 표기(integration.create 등)를 과거분사형(integration.created 등)으로 동기화 — 코드-spec 불일치 해소 (cross-audit G-01)" 한 줄 추가를 권장함. 현재 INFO 수준이며 차단 불필요.

### [INFO] `spec/5-system/1-auth.md §4.1` — Planned 표의 `auth_config.reveal` 이동
- target 위치: `spec/5-system/1-auth.md §4.1` — 기존 Planned 표에 있던 `auth_config.reveal`이 구현됨 표로 이동하고 Planned 표에서는 제거됨.
- 과거 결정 출처: 기존 §4.1 "설정" 행에 `auth_config.reveal`이 포함되어 있었으나 이미 구현된 call site (`auth-configs.service.ts`)였음. 분리 근거는 이번 PR 의 구현됨/Planned 구분 도입이다.
- 상세: 기존 spec이 구현·미구현을 구분하지 않고 단일 표에 혼재했으나, 이번 변경에서 구현됨/Planned 이중 표 구조로 개편했다. `auth_config.reveal`은 코드에 이미 존재하던 call site였으므로 구현됨 표로 이동이 정확하다. Rationale 위반 없음.

---

## 요약

이번 변경(G-01/G-02 audit 도메인)은 `data-flow/1-audit.md` 의 Rationale 이 "미해결 과제"로 명시적으로 남겨뒀던 표기 통일(re_run_initiated → execution.re_run)과 application 단 타입 강제(`action: string` → `AuditAction` union) 두 과제를 이행한 것이다. 과거 Rationale 에서 기각된 대안을 부활시킨 사례는 없다. 번복된 결정(자유 문자열 → union 강제, re_run_initiated 표기)은 모두 새 Rationale 서술을 동반하고 있으며, spec 세 곳(`1-auth.md §4.1`, `13-replay-rerun.md §11`, `data-flow/1-audit.md Rationale`)이 일관되게 갱신됐다. `spec/5-system/1-auth.md` 자체의 Rationale 에 동기화 근거 한 줄이 빠진 것은 INFO 수준 보완 사항이나 차단 요인은 아니다.

## 위험도

LOW
