# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] spec/5-system/1-auth.md — Auth Config Reveal 권한 행 추가 및 감사 로그 액션 열거 명시화

- 위치: §3.2 리소스별 권한 매트릭스, §4.1 기록 대상 액션
- 상세: `Auth Config Reveal (평문 노출)` 행이 권한 매트릭스에 추가되고, 권한 분리 근거 블록쿼트가 §3.3 직후에 삽입되어 있다. 감사 로그 액션 칸도 `auth_config.*` 와일드카드에서 `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal` 로 명시적으로 열거되었다. 두 변경 모두 변경 이력(Changelog)이나 Rationale 섹션 없이 기술되어 있으나, 해당 spec 파일에는 별도 Rationale 섹션(§1.4.I 등)이 이미 존재하며, 권한 분리 근거는 블록쿼트 인라인으로 서술되어 있어 문서 자체에서 맥락이 전달된다.
- 제안: 본 파일의 Rationale 섹션에 `Auth Config Reveal 권한 분리` 항목을 독립 서브섹션으로 추출하는 것이 일관성 면에서 낫다. 현재 인라인 블록쿼트 위치(§3.3 바로 아래)는 매트릭스 표와 거리가 있어 찾기가 번거롭다.

---

### [INFO] spec/5-system/1-auth.md — `auth_config.reveal` 감사 이벤트: API 엔드포인트 문서와의 정합 확인 필요

- 위치: §4.1 기록 대상 액션, §5 API 엔드포인트
- 상세: §4.1에 `auth_config.reveal` 감사 이벤트가 추가되었으나, §5 API 엔드포인트 목록에는 `POST /api/auth-configs/:id/reveal` 엔드포인트가 누락되어 있다. 권한 분리 근거 블록쿼트 안에 엔드포인트 경로가 서술되어 있지만(`POST /api/auth-configs/:id/reveal`), 공식 API 표에는 등재되지 않은 상태다.
- 제안: §5 API 엔드포인트 표에 `POST /api/auth-configs/:id/reveal` 행을 추가해야 한다. 인증 요구사항(현재 로그인 비밀번호 재확인), 권한(Admin+), 응답 형식, 감사 기록 여부를 명시해야 한다.

---

### [WARNING] spec/5-system/12-webhook.md — 새 인증 타입(api_key, basic_auth) 추가 시 API 엔드포인트 표에 인증 항목 미갱신

- 위치: §3.1 Webhook 수신 엔드포인트 표 중 "인증" 항목
- 상세: §3.2 요구사항 표에서 `WH-SC-06`(API Key), `WH-SC-07`(Basic Auth)가 필수 요구사항으로 새로 추가되었고, §4에도 `### 4.4 API Key`와 `### 4.5 Basic Auth` 절이 추가되었다. 그런데 §3.1 API 명세 표의 "인증" 항목은 이미 `none / api_key / bearer_token / basic_auth / hmac` 전체를 나열하고 있어 변경 diff에서 이미 반영된 것으로 보인다. 다만, §7 처리 흐름의 step 6 인라인 설명(기존 `config.authType === 'bearer'`)이 새 분기 `e. AuthConfig.type 별 분기 (bearer_token / api_key / basic_auth / hmac)`으로 교체되면서 타입명 규약(`bearer` → `bearer_token`)도 변경되었다. 이 타입명 변경이 다른 spec 문서(예: `spec/1-data-model.md §2.17`)에서 참조하는 이름과 일치하는지 교차 확인이 필요하다.
- 제안: `spec/1-data-model.md §2.17.1`의 `config.type` 허용값 목록과 12-webhook.md의 타입명이 동일한지 확인한다. 타입명이 다르면 둘 중 하나를 단일 진실(SoT)로 지정하고 나머지를 참조 표기로 처리한다.

---

### [INFO] spec/5-system/12-webhook.md — 처리 흐름(§7) step 6 에서 `HooksService` 내부 함수명 언급 없음

- 위치: §7 처리 흐름, step 6b
- 상세: `authConfigsService.findById(trigger.auth_config_id, trigger.workspace_id)` 라는 서비스 메서드 시그니처가 직접 기재되어 있다. spec 은 구현 상세보다 동작 계약을 서술하는 것이 원칙이며, 메서드 시그니처가 변경될 경우 spec 문서도 함께 수정해야 하는 결합이 발생한다.
- 제안: "AuthConfig 조회 (workspace 범위 격리)" 수준의 서술로 추상화하고, 구체 메서드명은 코드 주석이나 구현 문서에 위임한다. 현재 상태는 INFO 수준으로 차단하지 않는다.

---

### [INFO] spec/5-system/12-webhook.md — §8 보안 고려사항 — "향후 암호화 적용" 구문 삭제 확인 필요

- 위치: §8 보안 고려사항, "비밀 키 저장" 행
- 상세: 기존 텍스트 `"향후 암호화 적용"`이 삭제되고 `AES-256-GCM 으로 암호화 저장`으로 교체되었다. 변경 diff 상 이 교체는 정확하게 처리되어 있다. 이전의 TODO 성 문구가 제거되어 문서 정확성이 향상되었다.
- 제안: 없음. 양호한 변경이다.

---

### [INFO] spec/5-system/12-webhook.md — `rawBody: true` 활성화 참조 링크 제거

- 위치: §4.2 HMAC 서명, `rawBody 요구` 항목
- 상세: 기존에 `([§구현 §11.3 — main.ts](#))` 앵커 링크가 있었으나 이번 변경에서 `NestJS 부트스트랩에서 rawBody: true 활성화가 필수다.` 문장으로 단순화되었다. 이 앵커가 가리키던 §11.3은 존재하지 않았던 것으로 보이므로 제거는 적절하다. 다만, `main.ts`에서 `rawBody: true`를 설정해야 한다는 구현 요구사항은 공식 "구현 파일 구조" 절(§6)이나 README에 명시되지 않았으므로, 신규 개발자가 이를 누락할 수 있다.
- 제안: §6 구현 파일 구조에 `main.ts`의 `rawBody: true` 요구사항을 주석으로 명시하거나, 혹은 `hooks.module.ts`의 주석에 이를 기재한다.

---

### [INFO] spec/conventions/secret-store.md — `AuthConfig.config` 비대상 명시: Changelog 갱신 확인

- 위치: Changelog 마지막 행 (2026-05-28)
- 상세: 비대상 블록쿼트 추가와 Changelog 항목이 동일 PR에서 함께 갱신되었다. Changelog 항목의 내용이 실제 변경 범위(§1 비대상 명시, interface/scheme 변경 없음)와 정확하게 일치한다.
- 제안: 없음. 변경 이력 관리가 적절하게 이루어졌다.

---

### [INFO] spec/conventions/secret-store.md — `auth-configs` scope 미사용 명시로 인한 §7 변경 관리 안내 미갱신

- 위치: §7 변경 관리, "새 secret type 추가 시" 절차
- 상세: §1에서 `auth-configs` scope가 현재 미사용임을 명확히 했다. §7의 "새 secret type 추가 시" 절차는 현재도 유효하지만, `auth-configs` scope가 미래에 사용될 경우의 절차를 안내하는 내용이 없다. 이는 minor한 갭이며 현재 운영에 영향 없다.
- 제안: §7에 `AuthConfig` 도메인이 향후 `secret://auth-configs/...` scope를 사용하게 될 경우 본 §7 절차를 따르되 `spec/1-data-model.md §2.17` 동기화도 수행하도록 주석을 추가하는 것을 고려한다.

---

### [INFO] spec/data-flow/10-triggers.md — 응답 코드 `200` → `202` 정정

- 위치: §1.2 Webhook 진입, mermaid 다이어그램 마지막 응답 라인
- 상세: 기존 `200 { executionId } (default) OR 동기 응답 모드면 결과 반환`이 `202 { executionId } (비동기 실행)`으로 정정되었다. Spec Webhook WH-RS-01의 `202 Accepted`와 정합되었으며, 다이어그램 하단 주석도 이를 명시하고 있다. 기존의 "동기 응답 모드" 언급이 완전히 제거된 것이 맞는지 확인이 필요하다 — 현재 Webhook spec §3.3에 동기 응답 모드 관련 요구사항이 있는지 검토한다.
- 제안: Spec Webhook §3.3에 동기 응답 모드 관련 항목이 있다면 data-flow 다이어그램에서도 해당 분기를 유지하거나, 동기 응답 모드가 폐지된 경우 §3.3에서도 명시적으로 제거한다.

---

### [INFO] spec/data-flow/10-triggers.md — §3.1 `trigger.is_active = false` 동작 설명 미갱신

- 위치: §3.1 `trigger.is_active` 상태 전이 표
- 상세: §3.1의 `false` 행은 `"Webhook 호출 시 404 처리, Schedule sweep 제외"`로 기술되어 있다. 이번 변경에서 Webhook spec §7 step 5는 `config.chatChannel`이 있으면 `202 Accepted + { ignored: true }`를 반환하도록 분기가 추가되어 있으나, data-flow의 §3.1 상태 전이 표는 여전히 단순 404로만 기술하고 있다. 이 분기는 이번 PR 범위 외 사전 변경일 수 있으나, 문서 정합성 차원에서 확인이 필요하다.
- 제안: §3.1 `is_active = false` 설명을 `"Webhook 호출 시 410 Gone (config.chatChannel 트리거는 202 Accepted + { ignored: true }), Schedule sweep 제외"`로 갱신한다.

---

## 요약

이번 변경은 주로 spec 문서 4개의 갱신으로 구성되어 있으며, 문서화 관점에서 전반적으로 양호하다. Auth Config Reveal 권한 분리 근거, inline auth 폐지 배경, AuthConfig 비대상 명시, 처리 흐름 정정 등 주요 의사결정과 설계 변경에 대한 맥락 서술이 충분히 포함되어 있다. Changelog 갱신(secret-store.md)과 Rationale 서술(webhook.md)도 일관적으로 이루어졌다. 주요 지적 사항은 두 가지다: (1) `spec/5-system/1-auth.md §5` API 엔드포인트 표에 `POST /api/auth-configs/:id/reveal`이 누락되어 있어 API 문서 불완전 상태가 존재하고, (2) webhook.md §3.2의 인증 타입명(`bearer_token` 등)이 데이터 모델 spec과 일치하는지 교차 확인이 필요하다. 나머지 지적 사항은 INFO 수준으로 즉각적인 차단 없이 다음 개선 사이클에서 처리 가능하다.

## 위험도

LOW
