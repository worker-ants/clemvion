`spec/2-navigation/4-integration.md` 전체(867줄)와 plan을 읽었습니다. 정식 규약 3종 대비 분석합니다.

---

## 발견사항

### [WARNING] §14.2 허용목록 UI 용어 — `cafe24-api-metadata` 규약과 불일치
- **target 위치**: §14.2 워크플로우 에디터 마지막 bullet  
  > "allowlist UI 가 **Resource** 단위 grouping 으로 노출된다"
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` §6  
  > "UI 는 **카테고리** 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장)"
- **상세**: 동일 개념을 규약은 "카테고리", spec은 "Resource"로 칭함. 규약이 정식 명명 기준이므로 spec 이 따라야 함. 단순 용어 불일치지만 백엔드·프론트 구현자가 다른 추상화 경계로 읽을 수 있음.
- **제안**: §14.2 "Resource 단위 grouping" → "카테고리 단위 grouping" 으로 통일.

---

### [WARNING] §6 상태 머신 — `pending_install → expired` TTL 전이 미정의 (impl-prep 차단)
- **target 위치**: §6 상태 전이 다이어그램 및 표
- **위반 규약**: 직접 규약 위반은 아니나, plan 변경 4 ("24h TTL 후 `pending_install → expired` 자동 전이") 구현 착수 전 spec 갱신이 선행돼야 함. 현재 §6 은 `pending_install` 탈출 경로가 `install callback success → connected` 와 `install timeout/manual delete → 삭제` 뿐이며, 자동 TTL 만료 전이가 없음.
- **상세**: 구현자가 현 spec 기준으로 TTL Cron 을 짜면 명세 없이 동작을 결정해야 하고 테스트 기준도 없어짐.
- **제안**: 변경 4 구현 착수 전 project-planner 통해 §6 상태 머신에 `pending_install → expired (auto, install_timeout, TTL 24h)` 전이 추가 및 §11 스캐너 예외 규정 갱신.

---

### [WARNING] §10 OAuth 콜백 — callback 실패 시 Integration 상태 처리 정책 미기술 (impl-prep 차단)
- **target 위치**: §10.2 처리 플로우
- **위반 규약**: 직접 규약 위반은 아니나, plan 변경 0 (`markIntegrationCallbackError` 보조 메서드 + 컨트롤러 try/catch) 구현 전 spec 에 근거 없음. §10.2 는 성공 경로만 기술하고, callback 내부 실패(TOKEN_EXCHANGE_FAILED, STATE_MISMATCH, STATE_EXPIRED, RESOURCE_NOT_FOUND) 시 Integration row 처리(last_error 기록, status 유지 등)가 전무.
- **상세**: `markIntegrationCallbackError` 동작을 spec 없이 구현하면 리뷰 기준이 없어지고, 다음 일관성 검토 때 "spec 에 없는 동작이 구현됨"으로 C-등급 지적 대상이 됨.
- **제안**: 변경 0 착수 전 project-planner 통해 §10 에 "실패 경로: `pending_install`/`connected` 상태 row 의 `last_error`, `status_reason` 갱신, `status` 유지" 정책 명시.

---

### [WARNING] §9.2 Cafe24 Private install 엔드포인트 — `:installToken` 경로 파라미터 누락 (impl-prep 차단)
- **target 위치**: §9.2 표의 `GET /api/integrations/oauth/install/cafe24`
- **위반 규약**: 직접 규약 위반은 아니나, plan 변경 2 ("App URL 을 `…/cafe24/:installToken` 로 변경, 신규 라우트 `@Get('oauth/install/cafe24/:installToken')`") 구현 전 spec 이 과거 형태로 남아 있음.
- **상세**: 구현자가 현 §9.2 를 보면 토큰 없는 라우트를 추가하거나 기존 라우트를 유지할 수 있음. 특히 §9.4 `CAFE24_INSTALL_INVALID_HMAC`·`CAFE24_INSTALL_REPLAY` 에러도 토큰 lookup 흐름에 맞게 재정의 필요.
- **제안**: 변경 2 착수 전 project-planner 통해 §9.2 install URL + §9.4 에러 정의 갱신 (기존 경로 410 Gone 처리 여부 포함).

---

### [INFO] §5.8 — `spec/conventions/cafe24-api-metadata.md` 역참조 없음
- **target 위치**: §5.8 Cafe24 전체
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` 의 "관련 문서" 헤더가 `spec/2-navigation/4-integration.md#58-cafe24` 를 명시적으로 참조하지만 역방향 링크가 없음.
- **제안**: §5.8 첫 단락 또는 "AI Agent 노출" 항목에 `> 도구 메타데이터 형식·diretory 구조는 [CONVENTION: Cafe24 API Metadata](../../conventions/cafe24-api-metadata.md)` 역참조 추가.

---

### [INFO] `## Rationale` 섹션 없음
- **target 위치**: 문서 전체 (867줄, 섹션 1–14)
- **위반 규약**: CLAUDE.md "spec/\<영역\>/N-name.md 본문 끝에 `## Rationale` 섹션을 권장"
- **상세**: OAuth 팝업 모델 선택, TTL 24h 결정, install_token 식별 키 설계 등 재현 가치 있는 배경 결정이 spec 본문에 산재해 있고 구조화되지 않음.
- **제안**: §6, §9.2, §10.5 원자 갱신 근거 등을 `## Rationale` 섹션으로 별도 정리.

---

## 요약

`spec/2-navigation/4-integration.md` 는 정식 규약(`cafe24-api-metadata`, `node-output`, `migrations`)을 직접 파괴하는 **CRITICAL 위반은 없다**. 그러나 plan에 명시된 변경 0·2·4 세 항목은 각각 §10·§9.2·§6 을 spec 갱신 없이 구현하면 명세 없는 동작이 코드에 박히게 된다. 이 세 항목은 **project-planner 위임 → spec 갱신 → consistency-check 재통과** 순서를 밟은 후에야 구현 착수가 가능하다. 카테고리/Resource 용어 불일치(WARNING)는 §14.2 단어 하나 교정으로 해소된다.

## 위험도

**MEDIUM** — 규약 직접 위반은 없으나, spec 갱신 선행 없이 변경 0·2·4 구현에 착수하면 테스트 기준·API 계약이 구현 후에 역으로 맞춰지는 drift 리스크 발생.