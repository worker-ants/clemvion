# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — 2건의 WARNING(spec 기술 불일치)이 있으나 모두 구현 차단 수준이 아님. Critical 위배 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `validation.message` 적용 범위 — 구현 계획이 spec Planned 약속을 근거 없이 침묵 축소 | `plan/in-progress/impl-form-file-validation.md` 설계 결정 6번째 항 | `spec/4-nodes/6-presentation/4-form.md §1.5` (MIME 불일치 시 `validation.message` 사용 Planned 명시) | (A) `validation.message` 적용을 구현에 포함(scalar 패턴과 동일, 추가 비용 소). 또는 (B) v1 제외 시 plan 에 근거 명기 + spec §1.5 해당 Planned 문구를 `(Planned, v2)` 로 갱신해 의도된 축소임을 명시 |
| 2 | Naming Collision | 브라우저 file metadata `{ name, size, type, lastModified }` vs Slack 어댑터 `{ fileId, filename, mimeType, urlPrivate }` 가 동일 슬롯(`output.interaction.data.<fieldName>`)에 다른 shape 으로 흘러드나 form.md 에 미문서화 | `spec/4-nodes/6-presentation/4-form.md §1.5` 제출 payload 절 | `spec/4-nodes/7-trigger/providers/slack.md` L354 (R-S-7, Slack 어댑터 file submit 형식) | form.md §1.5 에 chat-channel 어댑터(Slack 등) divergence 주석 추가 또는 slack.md R-S-7 링크 위임. `impl-form-file-validation.md §6.2` 검증 지점 업데이트 시 Slack 경로 제외 사실을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `excludeFromConversationThread` 공통 config 필드가 §1 config 테이블에 미기재 | `spec/4-nodes/6-presentation/4-form.md §1` | §1 config 테이블 하단에 행 또는 각주로 인입 명시 (`0-common §4.6` 공통 필드 출처 표기) |
| 2 | Cross-Spec | S3 Object Storage 파일 업로드 키 패턴(`{workspaceId}/forms/{executionId}/{fileId}_{originalName}`)이 form.md 에 cross-ref 없음 | `spec/4-nodes/6-presentation/4-form.md §1.5` / §Rationale | §1 또는 §Rationale 에 `spec/0-overview.md §2.7` cross-ref 추가 (binary upload 채널 설계 예약 안내) |
| 3 | Cross-Spec | EIA `data` 필드명 vs WS `formData` 필드명 차이 — 의도된 설계이나 form.md §4 에 EIA REST 경로 미언급 | `spec/4-nodes/6-presentation/4-form.md §4` | §6.2 "검증 지점" 주석이 이미 3 경로를 명시하고 있어 추가 조치 불필요 |
| 4 | Rationale Continuity | file 검증 위치를 "execution-engine 전용"으로 결정한 근거가 plan 에만 있고 spec Rationale 에 예외 선언 없음 | `spec/4-nodes/6-presentation/4-form.md §Rationale "검증 지점"` | §Rationale 에 한 줄 추가 — `type: 'file'` 검증은 chat-channel modal 이 file 미수용(`isFieldModalCompatible` 배제, chat-channel-adapter §4.1)이므로 `assertFormSubmissionValid` 경로만 file 검증 수행 |
| 5 | Rationale Continuity | `coerceFormSubmission` 제거 — spec 에 Rationale 기록 없는 코드 계약 변경 | `plan/in-progress/impl-form-file-validation.md` 마지막 설계 결정 항 | plan 체크리스트 비고로 `"coerceFormSubmission 제거 — coerceFormValue 로 동일 보장 커버 확인"` 명기 (spec Rationale 갱신 불필요) |
| 6 | Convention Compliance | `node-output.md` Principle 4.1 다이어그램의 `view` 잔존이 form.md §5.4 의 `{}` 표현과 불일치하나 target 문서 책임 아님 | `spec/conventions/node-output.md` Principle 4.1 (규약 문서 내부 문제) | 검토자 참고. target 문서 조치 불필요 |
| 7 | Convention Compliance | `output.interaction.data` 필드 설명에 `via?: 'ai_render'` optional sentinel 미언급 | `spec/4-nodes/6-presentation/4-form.md §5.5` | `output.interaction.data` 테이블에 `via` optional 필드 행 또는 주석 추가 |
| 8 | Plan Coherence | file 검증 기술이 `impl-form-file-validation.md` 설계 결정과 일치 — 충돌 없음, 추적 기록 | `spec/4-nodes/6-presentation/4-form.md §6.2`, §Rationale, §1.5 | 구현 완료 시 Planned 주석 제거 및 체크박스 갱신 (plan step 4 에 포함됨) |
| 9 | Plan Coherence | `spec-sync-form-gaps.md` INFO 후속(min/max·pattern 통합 테스트 케이스) 미완료 상태 — 현 plan step 5~7 에 포함됨 | `plan/in-progress/spec-sync-form-gaps.md` INFO 후속 | 현 plan 에서 자연 처리 예정. 별도 조치 불필요 |
| 10 | Plan Coherence | `node-output-redesign/form.md` 잔여 개선안(file 검증 책임 경계 명시)이 target spec 에 이미 반영됨 | `plan/in-progress/node-output-redesign/form.md` §"종합 개선안" 3번째 항목 | 해당 항목을 완료 처리 고려 (비차단) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `excludeFromConversationThread` 미기재 / S3 cross-ref 누락 — 모두 INFO |
| Rationale Continuity | LOW | `validation.message` v1 축소 근거 미명시(WARNING 1건) |
| Convention Compliance | NONE | 12개 규약 항목 전부 준수. INFO 2건(규약 문서 내부 문제·sentinel 미언급) |
| Plan Coherence | NONE | 진행 중 plan 과 target spec 완전 정합. INFO 3건 |
| Naming Collision | LOW | 브라우저·Slack 어댑터 file payload 형식 divergence 미문서화(WARNING 1건) |

## 권장 조치사항

1. **(WARNING 1 해소)** `validation.message` 적용 방향 결정 — (A) scalar 패턴과 동일하게 v1 에 포함하거나, (B) v1 제외 시 plan 과 spec §1.5 양쪽에 명시적 근거 기록 및 `(Planned, v2)` 표기 갱신.
2. **(WARNING 2 해소)** `spec/4-nodes/6-presentation/4-form.md §1.5` 에 Slack 어댑터 file payload 형식 divergence 주석 또는 slack.md R-S-7 링크 추가. 구현 완료 후 §6.2 검증 지점 업데이트 시 Slack 경로 제외 사실도 반영.
3. **(INFO 4 선택 보강)** spec §Rationale "검증 지점" 항에 file 검증 chat-channel 예외 선언 1줄 추가 — plan 에만 있는 근거를 spec 에도 기록.
4. **(INFO 1 선택 보강)** §1 config 테이블에 `excludeFromConversationThread` 행 또는 각주 추가 (`0-common §4.6` 공통 필드 출처 명시).
5. 나머지 INFO 항목은 구현 착수 차단 사유 없음 — 구현 완료 후 Planned 주석 제거·체크박스 갱신·인접 spec 동기화를 plan step 4/9 에 따라 수행.

---

## Developer 처리 결정 (impl-prep 후속)

- **WARNING 1 → 옵션 B 채택**: 현 scalar 검증(`validateFormSubmission`)도 실제로는 `validation.message` 를 honor 하지 않고 하드코딩 기본 메시지를 쓴다(form-mode.ts 확인). file 도 동일하게 기본 메시지로 v1 구현하고, spec §1.5 의 `validation.message` 약속을 default 메시지로 정렬한다(일관성). plan 에 근거 기록.
- **WARNING 2 → 채택**: form.md §1.5 에 Slack 등 chat-channel 어댑터 file payload divergence 주석 추가. `validateFileField` 는 `size`(number)/`type`(string) 부재 시 해당 체크 skip(방어적) — Slack shape(`{fileId,mimeType,...}`)는 size/MIME 미보유라 자연 bypass. §6.2 검증 지점에 file 은 frontend metadata-only 경로 대상임을 명시.
- **INFO 4 → 채택**: §Rationale 에 file 검증 execution-engine 전용 근거 1줄 추가.
- **INFO 5 → 채택**: plan 비고에 coerceFormSubmission 제거 근거 기록.
- INFO 1/2/3/6/7/10 → 본 cluster 범위 밖(공통 config 필드·S3·sentinel·규약문서 내부) — defer.
