# 신규 식별자 충돌 검토 결과

대상: `spec/4-nodes/6-presentation/4-form.md`  
검토 모드: `--impl-prep` (파일검증 cluster 구현 착수 전)

---

## 발견사항

### 발견사항 1

- **[WARNING]** Slack chat-channel 파일 submit payload 형식과 form.md §1.5 표준 metadata 형식 간 미문서화 불일치
  - target 신규 식별자: `form.md §1.5` 의 file 제출 payload `{ name, size, type, lastModified }` (브라우저 `File` 객체 4-field metadata 배열)
  - 기존 사용처: `spec/4-nodes/7-trigger/providers/slack.md` L354 — Slack chat-channel 경로의 EIA `submit_form` 에서 동일 슬롯(`data.<fieldName>`)에 `{ fileId, filename, mimeType, urlPrivate }` 형식으로 적재함
  - 상세: `output.interaction.data.<fieldName>` 이라는 동일 키 슬롯에 두 가지 다른 payload 형식이 흘러들어온다. 브라우저 frontend 경로는 `{ name, size, type, lastModified }` 배열, Slack 어댑터 경로는 `{ fileId, filename, mimeType, urlPrivate }` 단일 객체(또는 배열). form.md §1.5 는 브라우저 경로 형식만 SoT 로 정의하고 Slack 어댑터 경로의 divergence 를 명시하지 않는다. 파일 검증 cluster 구현 시 `assertFormSubmissionValid` 가 이 슬롯을 검증할 때 어느 형식을 기준으로 하는지 모호해진다.
  - 제안: form.md §1.5 "제출 payload (metadata-only)" 절에 "Chat-channel 어댑터(Slack 등)는 `{ fileId, filename, mimeType, urlPrivate }` 형식으로 같은 슬롯을 채울 수 있다 — 이 경우 `size`(바이트) 가 없어 `maxFileSize`/`maxTotalSize` 서버 검증 대상 외" 취지의 Planned 주석 또는 별도 NOTE 를 추가한다. 대안으로 slack.md R-S-7 이 SoT 임을 form.md 에서 명시적 링크로 위임한다. 파일검증 cluster 구현 계획(`impl-form-file-validation.md §5~7`) 에서도 chat-channel 경로가 `validateFileField` 에 도달하는지 여부를 명시적으로 결정해야 한다(plan L16~18 에서 "file 검증 위치 = execution-engine 경로 전용"으로 Slack 경로 제외 의도가 있으나, form.md §6.2 "검증 지점" 주석 업데이트 시 이 사실을 포함시킬 것).

---

### 발견사항 없음 (나머지 관점)

1. **요구사항 ID 충돌**: form.md 는 요구사항 ID(`NAV-*`, `ND-*` 형식)를 독립적으로 부여하지 않는다. 참조하는 기존 ID(`EIA §5.1`, `WS §4.2` 등)는 기존 spec 과 동일 의미로 사용되고 있다. 충돌 없음.

2. **엔티티/타입명 충돌**:
   - `FormField`: `spec/4-nodes/6-presentation/0-common.md` L28 에서 "Form 노드는 자체 FormField 구조를 사용"으로 명시 참조 — 동일 의미. 충돌 없음.
   - `ValidationRule`, `ValidationPreset`: form.md 단독 정의 타입명. 다른 spec 에서 동일 이름을 다른 의미로 사용하는 사례 없음.
   - `FormValidationError`, `validateFormSubmission`: EIA spec(`spec/5-system/14-external-interaction-api.md` L1003, L313)·WS spec(`spec/5-system/6-websocket-protocol.md` L313)에서 같은 의미로 참조됨. 충돌 없음.
   - `toFileMetadata`, `FormModalField`: spec 레벨에서는 정의 없이 코드 참조(form.md L104). spec 간 충돌 없음.

3. **API endpoint 충돌**: form.md 는 새 API endpoint 를 정의하지 않는다. 기존 `execution.submit_form` WebSocket 명령과 `POST /api/external/executions/:id/interact` EIA endpoint 를 참조할 뿐이다. 충돌 없음.

4. **이벤트/메시지명 충돌**: `form_submitted` 식별자는 `0-common.md §10.9`, `node-output §4.5`, `EIA §5.1`, `execution-engine §7.4` 모두에서 동일 의미로 사용 중이며 4 layer 분리(`0-common.md` L382~389)가 명확히 문서화돼 있다. 충돌 없음.

5. **환경변수·설정키 충돌**: form.md 는 새 환경변수나 설정키를 도입하지 않는다. 연관 상수 `FORM_SUBMITTED_MAX_BYTES` 는 `spec/4-nodes/3-ai/1-ai-agent.md` L1218 에서 AI Agent 레이어용으로 정의됐으며 form.md 가 새로 정의하는 것이 아니다. 충돌 없음.

6. **파일 경로 충돌**: `spec/4-nodes/6-presentation/4-form.md` 는 기존 컨벤션(`N-name.md` 형식)을 준수하며 같은 폴더(`0-common.md`, `1-carousel.md`, `2-table.md`, `3-chart.md`, `5-template.md`)와 일관된 prefix 체계를 따른다. 충돌 없음.

---

## 요약

`spec/4-nodes/6-presentation/4-form.md` 가 도입 또는 사용하는 식별자는 기존 spec 영역과 의미적으로 일관성을 유지하고 있다. 요구사항 ID·API endpoint·이벤트명·환경변수·파일 경로 측면에서 충돌은 발견되지 않았다. 단, `§1.5` 의 브라우저 file metadata 형식(`{ name, size, type, lastModified }`)과 `slack.md R-S-7` 의 Slack 어댑터 file submit 형식(`{ fileId, filename, mimeType, urlPrivate }`)이 동일 `output.interaction.data.<fieldName>` 슬롯에 서로 다른 shape 으로 흘러들어오는 점이 명시적으로 문서화되지 않은 경계 조건으로, 파일검증 cluster 구현 시 `assertFormSubmissionValid` 의 검증 대상 경로를 결정할 때 혼선을 초래할 수 있다. plan `impl-form-file-validation.md` 가 "file 검증 위치 = execution-engine 경로 전용(chat-channel modal 제외)" 이라고 명시하고 있으므로 구현 의도는 있지만, form.md 본문이 이 divergence 를 다루지 않는 상태로 신규 구현자를 오도할 수 있다.

---

## 위험도

LOW
