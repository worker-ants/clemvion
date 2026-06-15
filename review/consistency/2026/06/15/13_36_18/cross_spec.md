# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done)
**Target spec**: `spec/4-nodes/6-presentation/4-form.md`
**Diff base**: `origin/main`

---

## 발견사항

### [INFO] `spec/5-system/2-api-convention.md §9` 파일 업로드 한도와 `maxTotalSize` 기본값의 네임스페이스 분리 명확화 필요

- **target 위치**: `form-mode.ts` `DEFAULT_FILE_MAX_TOTAL_SIZE_MB = 50` / `spec/4-nodes/6-presentation/4-form.md §1`
- **충돌 대상**: `spec/5-system/2-api-convention.md §9` — "단일 파일 50MB (`FileInterceptor` `limits.fileSize`)"
- **상세**: `2-api-convention.md §9` 의 50MB 는 Knowledge Base 문서 업로드 엔드포인트(`POST /api/knowledge-bases/:id/documents`)의 `multipart/form-data` 단일 파일 서버 수신 한도다. Form 노드의 `DEFAULT_FILE_MAX_TOTAL_SIZE_MB = 50` 는 `execution.submit_form` metadata-only payload 의 "파일 합계 크기 제약" 으로 전혀 다른 도메인이다. 두 50MB 가 우연히 같은 값이지만 의미가 달라 독자가 혼동할 수 있다. Form 노드는 binary 를 전달하지 않으므로 (`spec/4-nodes/6-presentation/4-form.md §1.5` — metadata-only, binary 미전달) `2-api-convention.md §9` 의 `FileInterceptor` 한도는 Form 노드 제출 경로에 적용되지 않는다.
- **제안**: 충돌은 아니나 독자 혼동 방지를 위해 `2-api-convention.md §9` 에 "Form 노드 `submit_form` 은 metadata-only 이므로 본 절 적용 범위 밖" 을 1줄 주석으로 추가하거나, Form spec §1 에 "binary 미전달이므로 api-convention §9 FileInterceptor 한도 미적용" 을 부연하면 네임스페이스가 명확해진다. (단 현재 spec 이 서로 모순되지는 않는다.)

---

### [INFO] `spec/5-system/6-websocket-protocol.md §4.2` VALIDATION_ERROR ack 의 `details[]` 미노출 정책이 구현 주석과 대칭 확인

- **target 위치**: `workflow-errors.ts` `FormValidationError` JSDoc, `execution-engine.service.ts` `assertFormSubmissionValid`
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2` — "ack payload 는 평면 `{ success:false, error, errorCode:'VALIDATION_ERROR' }` 로 field-level `details[]` 를 포함하지 않는다"
- **상세**: 구현 변경(`workflow-errors.ts` 갱신 JSDoc)은 WS ack 에 `details[]` 를 포함하지 않는다는 spec 정책과 일치한다. 다만 갱신된 `workflow-errors.ts` JSDoc 은 "EIA REST 는 `400 VALIDATION_ERROR` + `details[{field, message, code:'INVALID_FIELD'}]`, WS ack 는 평면 `errorCode='VALIDATION_ERROR'` 로 매핑" 을 명시하므로 spec 과 정합한다. 모순 없음.
- **제안**: 별도 조치 불필요.

---

### [INFO] `spec/conventions/chat-channel-adapter.md` 의 `§4.1 step 4` SoT 참조가 구현 변경을 반영하는지 점검 권장

- **target 위치**: `hooks.service.ts` `validateFormSubmission` 호출 유지 (scalar-only path)
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md` — `§4.1 step 4` ("submit_form 전 client-side 값 검증") SoT
- **상세**: 구현 변경은 `hooks.service.ts` 에서 기존 `validateFormSubmission`(scalar batch) 을 그대로 유지했다(file 필드는 native modal 미수용이라 이 경로에 도달하지 않음). 이는 `spec/4-nodes/6-presentation/4-form.md` Rationale 의 설명과 일치한다. `spec/conventions/chat-channel-adapter.md §4.1` 이 `validateFormSubmission` 을 이름으로 직접 참조하는지 확인하지 못했으나, 해당 spec 이 "file 검증은 이 경로에서 수행하지 않는다" 는 점을 명시하거나 cross-reference 한다면 독자 혼동이 줄어든다.
- **제안**: `spec/conventions/chat-channel-adapter.md §4.1` 에 "scalar 전용 경로 — file 필드는 native modal 미수용이라 이 경로 미해당, file 검증은 publisher chokepoint(`assertFormSubmissionValid`) 전담" 한 줄 부연을 선택적으로 추가 가능. 필수 사항 아님.

---

## 요약

이번 구현 변경(form file field 클라이언트·서버 검증 도입)은 `spec/4-nodes/6-presentation/4-form.md` §1/§1.5/§6.2 의 내용과 일관되게 구현됐으며, 인접 spec 영역(`spec/5-system/14-external-interaction-api.md §5.1`, `spec/5-system/6-websocket-protocol.md §4.2`, `spec/conventions/chat-channel-adapter.md`)과의 직접 모순은 발견되지 않는다. `spec/5-system/2-api-convention.md §9` 의 50MB KB 업로드 한도는 Form 노드 metadata-only 제출 경로와 완전히 다른 도메인이라 충돌이 아닌 이름 공간 혼동 가능성만 존재한다. 요구사항 ID 충돌, 상태 머신 불일치, RBAC 모순, 계층 책임 충돌은 없다. 모든 발견사항은 INFO 등급이다.

## 위험도

NONE
