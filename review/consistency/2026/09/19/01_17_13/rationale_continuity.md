# Rationale 연속성 검토 — spec/2-navigation/ (target: 2-trigger-list.md)

## 검토 범위 요약

- scope 델타: `spec/2-navigation/2-trigger-list.md` 1개 파일, 2줄 변경(§2.3.1 필드 권한 매트릭스의 `endpointPath` 행, §3 API 하단 註).
  내용은 동일하게 `(workspace_id, endpoint_path) UNIQUE` → `(endpoint_path) UNIQUE(전역)` 로 서술을 교체.
- 이 변경의 실질 결정·근거는 `spec/1-data-model.md`(신규 `## Rationale` 항목 «Webhook `endpoint_path` 전역 유일 (2026-09-18)»)와
  `spec/data-flow/10-triggers.md`(기존 «Webhook `endpoint_path` 의 UNIQUE 범위» 절에 취소선 + 2026-09-18 정정 주석 추가)에 있다.
  구현 diff(`triggers.controller.ts` / `triggers.service.ts` / `V131`·`V132` 마이그레이션)도 워킹트리에서 직접 대조했다.

## 발견사항

- **[INFO]** `2-trigger-list.md` 본문에 새 Rationale 로의 역참조 링크 없음
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 `endpointPath` 행, §3 API 하단 `(endpoint_path) UNIQUE(전역 …)` 註 (두 곳 모두)
  - 과거 결정 출처: 같은 문서 §3 하단의 인접 문장들은 유사한 결정마다 R-1/R-4/R-14/R-15/R-16 처럼 `## Rationale` 항목을 인라인 링크로 붙이는 관례를 이미 세워 두었다(예: 같은 API 註 블록 안의 "인증 관련 inline 키 … 는 제거됨 (Rationale R-14)").
  - 상세: 이번 변경은 과거 `(workspace_id, endpoint_path)` UNIQUE 결정을 실질적으로 뒤집는 것인데, 그 "왜" 는 `spec/1-data-model.md` 와 `spec/data-flow/10-triggers.md` 에만 있고 `2-trigger-list.md` 자신에는 근거 링크가 없다. 사실 서술("전역 — 다른 워크스페이스의 트리거와도 겹칠 수 없다")은 정확하지만, 이 문서만 읽는 독자는 왜 스코프가 바뀌었는지 추적할 진입점이 없다. 다만 이는 CRITICAL/WARNING 수준의 "번복인데 근거 부재"가 아니다 — 근거 자체는 실재하고 상세하며(재현 실험·기각한 대안·NOTICE 정책·남는 틈까지 기록), 단지 target 문서에서의 상호링크가 빠졌을 뿐이다.
  - 제안: 위 두 자리 중 하나(§2.3.1 행 또는 §3 註)에 `([Spec 데이터 모델 Rationale](../1-data-model.md#webhook-endpoint_path-전역-유일-2026-09-18))` 형태 링크 추가.

## 정합성 확인 (문제 없음으로 판정한 항목)

- **기각된 대안 재도입 여부**: 없음. `spec/1-data-model.md` Rationale 은 "비유일 보조 인덱스 + 앱 레벨 중복 검사" 를 명시적으로 기각했고, 실제 구현(V132)도 DB UNIQUE 제약으로 갔다 — 기각안이 재도입되지 않았다.
- **합의된 원칙 위반 여부**: 없음. `spec/5-system/15-chat-channel.md` R-CC-21 이 기각한 "재등록 없는 경로 변경(provider 미재등록 상태로 경로만 바꾸는 것)" 을 이번 마이그레이션(V131)이 흉내 내지 않도록 명시적으로 피했다 — 경로가 바뀐 채팅 채널 트리거는 NOTICE 로만 표시하고, 실제 provider 재등록은 소유자가 기존 정상 경로(`setupChannel`, CCH-AD-02 멱등)로 다시 저장하게 한다. R-15 의 "endpointPath UUID = capability token" 모델과도 상충하지 않는다(이번 결정은 그 모델의 구멍 — 추측은 막아도 "알고 있는 사람의 복사"는 못 막던 부분 — 을 보강할 뿐, capability-token 전제 자체를 부정하지 않는다).
- **결정의 무근거 번복 여부**: 아님 — 번복이지만 새 Rationale 를 함께 작성했다. `spec/1-data-model.md` 에 재현 실험(PostgreSQL 18, 워크스페이스 id 순서에 따른 승자 결정)·정책 결정(오래된 트리거 우선 dedupe)·기각한 대안·남는 틈(트리거 삭제 후 경로 재점유는 여전히 막지 못함, 트래커로 이관)까지 상세히 기록되어 있다. `spec/data-flow/10-triggers.md` 도 원문을 취소선으로 보존하고 정정 주석을 남겨 이력을 추적 가능하게 했다 — CLAUDE.md 의 "Rationale 기각된 대안은 실제 이력 필수" 규약에도 부합.
- **암묵적 가정 충돌 여부**: 없음. 락 관련 invariant(§3 "동시 쓰기 직렬화")·삭제 cascade invariant(§4.3)·`TriggerDto.workflow` 키 생략형 계약(§3 註, R-17) 등 이 문서의 다른 Rationale 이 정의한 시스템 invariant 는 이번 변경과 무관하며 우회되지 않았다.
- **구현 코드 대조**: `triggers.service.ts` 의 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수가 `idx_trigger_workspace_endpoint` → `idx_trigger_endpoint_path` 로 갱신되고 주석도 새 Rationale 을 인용한다. `triggers.controller.ts` 의 Swagger 설명도 "동일 워크스페이스에" → "다른 워크스페이스의 트리거 포함 — 전역 유일" 로 갱신되어 spec 서술과 일치한다. 에러 메시지도 "같은 워크스페이스에" 라는 워딩을 제거해 스코프 변경과 정합화했다.

## 요약

이번 PR 이 `spec/2-navigation/2-trigger-list.md` 에 낸 델타는 `endpoint_path` UNIQUE 스코프를 워크스페이스 단위에서 전역으로 바꾼 서술 2줄뿐이며, 이는 과거 결정(V002 워크스페이스 단위 UNIQUE)의 실질적 번복이지만 `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 에 재현 실험·기각한 대안·이력 보존(취소선)을 갖춘 새 Rationale 이 함께 작성되어 CLAUDE.md 의 이력 요구를 충족한다. 인접 도메인(Chat Channel R-CC-21, R-CC-10)이 기각한 대안을 새 결정이 흉내 내지 않도록 명시적으로 대조하는 등 원칙 위반도 발견되지 않았고, 구현 코드(controller/service/migration)도 이 서술과 정확히 일치한다. 유일한 흠은 target 문서 자신에는 새 Rationale 로의 역참조 링크가 빠져 있다는 점(INFO)이다.

## 위험도

NONE
