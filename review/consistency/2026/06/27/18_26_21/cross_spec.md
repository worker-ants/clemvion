# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-done`
- 대상 영역: `spec/2-navigation/`
- diff-base: `origin/main`
- 검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `spec/2-navigation/16-agent-memory.md` API 경로 — `/api/` prefix 누락

- **target 위치**: `spec/2-navigation/16-agent-memory.md §2 기능 상세`
- **충돌 대상**: `spec/2-navigation/` 내 모든 다른 API 표 (예: `0-dashboard.md §7`, `14-execution-history.md §5`, `6-config.md §3` 등) — 일관되게 `/api/...` 전체 경로 사용
- **상세**: `16-agent-memory.md §2` 의 API 경로 표기가 `GET /agent-memories/scopes`, `DELETE /agent-memories/:id`, `DELETE /agent-memories?scopeKey=` 형식으로, 다른 모든 navigation spec 의 `/api/...` full-path 표기 관행과 다르다. 실제 계약의 SoT 는 `spec/5-system/17-agent-memory.md §6` 으로 명시되어 있어 runtime 충돌은 없으나, 독자가 다른 spec 표기와 대조 시 혼란을 준다.
- **제안**: `16-agent-memory.md §2` 의 경로를 `/api/agent-memories/scopes`, `/api/agent-memories/:id`, `/api/agent-memories?scopeKey=` 로 prefix 통일. 또는 "경로는 `spec/5-system/17-agent-memory.md §6` 참조" 단일 주석으로 대체.

---

### [INFO] `waiting_for_input` 상태 아이콘 — 화면별 불일치

- **target 위치**: `spec/2-navigation/0-dashboard.md §5 최근 실행 이력 (Status 아이콘 표)`
- **충돌 대상**: `spec/2-navigation/14-execution-history.md §2.4 테이블 (Status 열 설명)`
- **상세**: 동일한 `waiting_for_input` 상태에 대해 두 화면 spec 이 서로 다른 아이콘을 사용한다.
  - `0-dashboard.md §5`: `✋ waiting_for_input`
  - `14-execution-history.md §2.4`: `🙋 Waiting`
  실행 상태 아이콘 SoT 가 어느 spec 에도 명시되어 있지 않아 구현이 어느 쪽을 따를지 불명확하다.
- **제안**: 두 spec 중 한 곳에서 아이콘을 통일하거나, `spec/conventions/` 에 실행 상태 아이콘 매핑 테이블을 단일 진실로 추가하고 두 spec 이 참조하도록 변경.

---

### [INFO] `14-execution-history.md §2.1` 목업 — Trigger 열 누락

- **target 위치**: `spec/2-navigation/14-execution-history.md §2.1 화면 구성 (ASCII 목업 표)`
- **충돌 대상**: 동일 파일 `§2.4 테이블 (열 정의 표)` — Status / **Trigger** / Started At / Duration / Nodes 5열 정의
- **상세**: `§2.1` ASCII 목업에는 `Status | Started At | Duration | Nodes` 4열만 표시되어 있으나, `§2.4` 에서 정의하는 실제 테이블은 `Trigger` 열이 Status 다음에 추가된 5열 구성이다. 목업이 구현과 일치하지 않아 처음 읽는 독자에게 혼란을 준다.
- **제안**: `§2.1` 목업을 `Status | Trigger | Started At | Duration | Nodes` 5열 구성으로 수정. 또는 목업 하단에 "(Trigger 열 생략 — §2.4 참고)" 주석 추가.

---

## 구현 변경과 Spec 정합 확인 (조치 불필요)

본 `mc-modellistdto-fix` 변경(Swagger `ModelListDto` → `ModelInfoDto`·`ApiOkWrappedArrayResponse`)은 기존 spec 과 완전히 정합한다.

- `spec/5-system/7-llm-client.md §3.5` 는 `ModelInfo { id: string; name: string; type: ModelTypeFilter }` 배열을 `listModels` 반환 계약으로 이미 명시.
- `spec/2-navigation/6-config.md §3 Model Config API` 는 `GET /api/model-configs/:id/models` 와 `POST .../preview-models` 의 응답 shape 를 LLM client spec 에 위임 — navigation spec 과의 충돌 없음.
- 변경된 `ModelInfoDto.{ id, name, type }` 는 `ModelInfo` 인터페이스의 정확한 미러 — 이전 `ModelItemDto.{ id, name?, meta? }` 가 spec 에 없는 `meta` 를 선언하고 `name` 과 `type` 을 잘못 표현하던 것을 수정한 것.
- 프론트엔드 클라이언트(`lib/api/model-configs.ts`)는 이미 `unwrap<ModelInfo[]>()` 를 사용 중이므로 wire format 변화 없음 (Swagger metadata 전용 수정).

---

## 요약

`spec/2-navigation/` 영역은 `spec/1-data-model.md`, `spec/5-system/` 등 다른 영역과 구조적 모순이 없다. 발견된 3건은 모두 INFO 등급(아이콘 표기 비일관·경로 prefix 누락·목업 오래된 부분)으로, 런타임 동작이나 API 계약에 영향을 주지 않는 문서 동기화 권장 사항이다. 이번 구현 변경(`ModelListDto → ModelInfoDto`)은 기존 `7-llm-client.md §3.5` 계약을 Swagger 가 뒤늦게 반영한 정합 조치이며 어떤 spec 과도 충돌하지 않는다.

---

## 위험도

LOW
