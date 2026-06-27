# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` | 대상: `spec/2-navigation/6-config.md`

---

## 발견사항

### [INFO] Rationale ID R-7 이 여러 spec 파일에 동명으로 존재

- **target 신규 식별자**: `spec/2-navigation/6-config.md §R-7` — "action-POST 인 test 와 preview-models 를 Editor 로 게이트"
- **기존 사용처**:
  - `spec/2-navigation/2-trigger-list.md §R-7` — "detail drawer 에서 Recent Calls 카드 제거" (line 279)
  - `spec/3-workflow-editor/3-execution.md §R-7` — "인-에디터 실행 히스토리 — frontend-only" (line 719)
  - `spec/conventions/spec-impl-evidence.md §R-7` — "API 카탈로그 필드 파일 제외" (line 228)
- **상세**: 각 spec 파일은 독자적인 R-N 번호 체계(문서 내 로컬 앵커 `#r-7-...`)를 사용한다. 전역 ID 네임스페이스가 아니므로 런타임·시스템 충돌은 발생하지 않는다. 비공식 문서 참조 시 "Rationale R-7" 만 언급하면 어느 파일인지 모호해질 수 있다.
- **제안**: 비공식 논의 시 문서 경로를 병기(`6-config.md §R-7`, `2-trigger-list.md §R-7`)하는 컨벤션을 권장한다. 스펙 자체의 변경은 불필요 — 현재 모든 인라인 참조가 앵커(`#r-7-action-post-...`)로 구분되어 있어 충돌 없음.

### [INFO] `testConnection` 메서드명이 두 도메인에 존재

- **target 신규 식별자**: `LlmModelConfigController.testConnection` (`POST /api/model-configs/:id/test`, `spec/2-navigation/6-config.md §B.3` + `spec/5-system/7-llm-client.md §8.3`)
- **기존 사용처**: `IntegrationsService.testConnection` (`POST /api/integrations/:id/test`, `spec/2-navigation/4-integration.md` line 1217·1221)
- **상세**: 동일 메서드명이 서로 다른 서비스 계층(`LlmService`/`LlmModelConfigController` vs `IntegrationsService`)에 존재한다. 공개 API 경로 프리픽스(`/api/model-configs/` vs `/api/integrations/`)가 달라 엔드포인트 충돌은 없고, 각각 다른 모듈에 격리되어 있다. 구현 코드에서 혼용 위험은 낮다.
- **제안**: 변경 불필요. 단 테스트 코드 작성 시 두 `testConnection` 구현을 import 혼동하지 않도록 모듈 경로를 명확히 한다.

---

## 요약

`spec/2-navigation/6-config.md` 의 구현 대상 영역이 `(없음)` — 이번 태스크(`mc-endpoint-hardening`)는 플래너가 이미 완료한 spec(`R-7` Rationale, `6-config.md §3` Editor+ 명문화, `7-llm-client.md §8.3` 권한 줄)을 코드로 구현하는 단계다. 신규로 도입되는 spec 식별자가 없으므로 CRITICAL·WARNING 등급 충돌은 존재하지 않는다. Rationale R-N 의 문서 내 로컬 번호 중복과 `testConnection` 메서드명의 두 도메인 공유는 설계상 의도된 패턴이며, 각각 앵커 스코프·모듈 분리로 충돌이 방지된다.

---

## 위험도

NONE
