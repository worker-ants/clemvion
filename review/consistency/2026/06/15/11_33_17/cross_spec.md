# Cross-Spec 일관성 검토 결과

검토 모드: --impl-prep  
Target: `spec/4-nodes/6-presentation/4-form.md`  
검토 일시: 2026-06-15

---

## 발견사항

### [INFO] `excludeFromConversationThread` config 필드가 Form spec §1 에 누락

- target 위치: `spec/4-nodes/6-presentation/4-form.md` §1 설정(config) 테이블
- 충돌 대상: `spec/4-nodes/6-presentation/0-common.md` §4.6 (`excludeFromConversationThread` 공통 config 필드 선언), `spec/conventions/conversation-thread.md` §1.3 (Presentation 5 노드 공통 opt-out 필드 명시)
- 상세: `0-common.md §4.6` 은 "Presentation 5 노드 (Carousel / Table / Chart / Form / Template) 모두 공통으로" `excludeFromConversationThread: Boolean (default false)` 를 config 에 가진다고 명시한다. `conversation-thread.md` §1.3 및 §기타 cross-ref 도 동일하게 Form 을 5 노드 중 하나로 열거한다. 그러나 `4-form.md §1` 의 config 테이블에는 이 필드가 기재되어 있지 않다 — Carousel/Table/Chart/Template 노드 spec 에도 직접 기재 여부가 다를 수 있으나, Form 이 공통 규약을 따르는 5 노드 중 하나임을 §1 설정 표에서 확인하기 어렵다.
- 제안: `4-form.md §1` config 테이블 하단에 `excludeFromConversationThread | Boolean | | `false` | 0-common §4.6 공통 필드` 행 또는 각주로 인입 명시. 구현은 공통 schema 경유라 동작은 일치하므로 spec 기술 누락만 해소하면 된다.

---

### [INFO] S3 Object Storage 버킷 구조 — Form 파일 업로드 경로가 `spec/0-overview.md §2.7` 에 예약되어 있으나 Form spec 본문에 미참조

- target 위치: `spec/4-nodes/6-presentation/4-form.md` §1.5 (file 타입 UI 동작), §1 (allowedMimeTypes/maxFileSize/maxTotalSize/maxFiles 옵션)
- 충돌 대상: `spec/0-overview.md §2.7` Object Storage 버킷 구조 표 (`{workspaceId}/forms/{executionId}/{fileId}_{originalName}` 키 패턴, 상태: "계획 (코드 미구현)")
- 상세: `0-overview.md §2.7` 은 Form 노드 파일 업로드의 S3 키 패턴을 `{workspaceId}/forms/{executionId}/{fileId}_{originalName}` 으로 예약해 두었다. 현재 `4-form.md §1.5` 는 "metadata-only 전달 (binary 미전달)" 을 명시하고 있어 파일 업로드 자체가 현 구현에서 수행되지 않는다. 이는 모순이 아니라 미구현 경로이지만, `4-form.md` 에 `0-overview.md §2.7` 을 참조하는 cross-ref 가 없어, file 검증 cluster 구현 시 업로드 채널 설계 결정을 이 예약된 S3 키 패턴과 연결하는 문서 경로가 부재하다.
- 제안: 동작 모순이 아니므로 차단 불필요. `4-form.md §1` 또는 §Rationale 에 `0-overview.md §2.7` cross-ref 를 추가해 binary upload 채널이 정해질 때의 키 설계 예약을 독자가 찾을 수 있게 안내하면 충분하다.

---

### [INFO] EIA `§5.1 submit_form` 의 `data` 필드명과 WS `execution.submit_form` 의 `formData` 필드명 — 4-form.md 기술 방향과 일관

- target 위치: `spec/4-nodes/6-presentation/4-form.md` §4 실행 로직 step 4 ("사용자가 폼 제출 → `execution.submit_form` WebSocket 명령 송신")
- 충돌 대상: `spec/5-system/14-external-interaction-api.md §5.1` (`submit_form` 에 REST body 필드명 `data`), `spec/5-system/6-websocket-protocol.md §4.2` (WS 명령 필드명 `formData`)
- 상세: Form spec 은 WS 명령을 `execution.submit_form` 으로 지칭하며 payload 의 `formData[<fieldName>]` 에 담는다고 §1.5 에 기술한다. EIA §5.1 은 REST 표면에서 필드명을 `data` 로 달리 두고, WS §4.2 는 `formData` 를 사용하며, §4.6 외부 표면 매핑 표에서 이 차이를 명시적으로 설명한다. 이는 의도된 설계(REST 컨벤션 vs WS 컨벤션 분리)이며 Form spec 과 모순이 없다. 단, Form spec §4 가 WS 명령만 언급하고 EIA REST 경로를 별도 언급하지 않아, 구현자가 3 경로 공통 chokepoint 를 의식하지 못할 수 있다.
- 제안: 동작 모순 없음. 이미 §6.2 "검증 지점" 주석이 EIA·WS·UI 3 경로 공통을 명시하고 있어 충분한 기술이 존재한다. 추가 조치 불필요.

---

## 요약

`spec/4-nodes/6-presentation/4-form.md` 는 검토된 다른 spec 영역(데이터 모델, WS 프로토콜, EIA, Presentation 공통, S3 개요, 인터랙션 타입 레지스트리)과 실질적인 모순이 없다. 검증 규칙 열거(min/max·pattern 포함)·3 경로 공통 chokepoint·metadata-only file 전달·output 구조는 WS §4.2, EIA §5.1, 0-common §4.2/§4.5 와 일관된다. `file` 검증 cluster 가 Planned 임을 plan/in-progress/spec-sync-form-gaps.md 에서 명시 추적하고 있어 미구현 표시가 spec 내에 일관되게 반영되어 있다. INFO 2건은 모두 spec 기술 완성도(누락 필드 기재, cross-ref 보강) 수준이며 구현 차단 모순이 아니다.

## 위험도

LOW
