# 부작용(Side Effect) 리뷰 결과

**리뷰 대상**: 47개 파일 (review/ 산출물 37개 + spec/ 변경 10개)
**리뷰 일시**: 2026-06-11

---

## 발견사항

### **[INFO]** review/ 산출물 파일군 — 의도된 파일시스템 부작용, 범위 내
- **위치**: 파일 1–37 (`review/consistency/2026/06/11/21_19_55/**`, `22_00_31/**`, `22_04_01/**`, `22_46_26/**`, `23_14_40/**`)
- **상세**: consistency-check sub-agent 가 생성한 산출물(checker 결과 `.md`, `meta.json`, `_retry_state.json`, `SUMMARY.md`)이다. 모두 `review/consistency/` 하위 ISO 타임스탬프 경로에 생성되며, 프로젝트 정책(CLAUDE.md "일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")에 따른 의도된 쓰기다. 파일시스템 부작용 자체는 정상이며 범위 이탈 없음.
- **제안**: 없음.

### **[INFO]** `_retry_state.json` 의 `agents_pending` 초기 상태 그대로 저장
- **위치**: 파일 7 (`review/consistency/2026/06/11/22_00_31/_retry_state.json`), 파일 15, 23, 31
- **상세**: 4개 세션 모두 `_retry_state.json` 이 `"agents_pending": ["cross_spec", ...]`, `"agents_success": []` 초기 상태로 커밋됐다. 이는 세션 시작 시점의 스냅샷이며, 각 세션에 완료된 checker 출력 파일이 함께 존재하므로 실제 실행이 완료됐음은 별도로 확인된다. 다만 상태 파일이 "완료 후" 가 아닌 "시작 전" 스냅샷이라 파일 상태와 실제 실행 결과가 불일치하는 모양새다. 추후 재시도 로직이 이 파일을 읽는다면 완료된 checker 를 재실행할 위험이 있다.
- **제안**: orchestrator 가 세션 완료 시 `_retry_state.json` 의 `agents_success` / `agents_pending` 을 갱신하고 커밋하는지 확인 권장. 현재 코드리뷰 대상 세션에서는 실행 완료 후 상태 파일이 갱신되지 않은 채 커밋된 것으로 보인다. 실제 재시도 트리거 조건을 점검할 것.

### **[WARNING]** `spec/5-system/1-auth.md §4.1` — `audit-action.const.ts` 링크 경로 수정이 호출자 계약에 영향
- **위치**: 파일 42 (`spec/5-system/1-auth.md`), 라인 `../../codebase/backend/src/modules/audit-logs/audit-action.const.ts`
- **상세**: 이전 버전의 링크는 `codebase/backend/...` (루트 상대)였고, 이번 변경으로 `../../codebase/backend/...` (파일 위치 기준 상대 경로)로 수정됐다. spec 문서 내 링크이므로 코드 런타임 부작용은 없지만, 다른 active worktree(PR #545 `unified-model-mgmt-pr4`)가 동일 줄의 링크 경로를 `../../codebase/backend/...` 로 수정했다는 사실이 `review/consistency/2026/06/11/22_00_31/plan_coherence.md` WARNING 에 이미 기록됐다. PR #545 는 MERGED(stale) 로 확인됐으므로 실제 merge conflict 위험은 소멸됐으나, 현재 diff 가 그 수정을 재현하는 것이 의도된 것인지 확인 필요. 중복 수정이 아닌 독립적 동일 방향 수정임이 일관성 검토에서 확인됐으므로 실질 위험은 낮음.
- **제안**: 링크 경로가 spec 파일 위치(`spec/5-system/`) 기준 상대경로로 올바른지(`../../codebase/...` = spec/5-system → spec → 루트 → codebase) 최종 확인 권장.

### **[WARNING]** `spec/5-system/1-auth.md §4.1` 구현됨 표 확장 — 기존 Planned 항목 이동으로 `auth_config.create/update/delete/regenerate` 계약 변경
- **위치**: 파일 42 (`spec/5-system/1-auth.md`), `auth_config` 행 변경
- **상세**: `auth_config.create`, `auth_config.update`, `auth_config.delete`, `auth_config.regenerate` 가 Planned 표에서 "현재 구현된 액션" 표로 이동했다. 이는 스펙 계약 변경으로, 이 액션들이 실제 `AuditLogsService.record` 를 호출하도록 `auth-configs.service.ts` 가 이미 수정됐음을 전제한다. `spec/data-flow/1-audit.md` §1.1 (파일 45)의 call site 수가 9→13으로 증가하고 4종 액션이 신규 행으로 추가됐으므로 구현과 spec이 일치한다. 단, 이 변경이 외부 소비자(감사 로그 조회 API, 알림 훅 등)에게 새 이벤트를 노출시키는 공개 인터페이스 확장임을 인지해야 한다.
- **제안**: `auth-configs.service.ts` 의 실제 `AuditLogsService.record` 호출 코드가 4종 액션을 모두 커버하는지 코드 레벨에서 확인. spec과 구현 사이의 동기화가 완료됐음을 이 PR의 코드 diff에서 검증할 것.

### **[INFO]** `spec/5-system/3-error-handling.md` — `CODE_MEMORY_LIMIT` 추가 및 `MODEL_CONFIG_INVALID/NOT_FOUND` 추가
- **위치**: 파일 43 (`spec/5-system/3-error-handling.md`)
- **상세**: 공개 에러 코드 카탈로그에 세 코드가 추가됐다. 이는 공개 API 변경으로, 클라이언트가 에러 코드 기반으로 분기 로직을 작성했다면 영향을 받을 수 있다. 단, 세 코드 모두 신규 추가(기존 코드 변경 아님)이므로 기존 클라이언트의 핸들러를 깨뜨리지 않는다. `CODE_MEMORY_LIMIT` 는 이전에 미구현(Planned)으로 분류돼 있었으므로 실제 발생하지 않던 코드이다. `MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND` 는 신규 400/404 에러로 기존 일반 에러(`VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`)를 대체하지 않고 병존한다.
- **제안**: 없음. 신규 추가 방향이므로 기존 소비자에 breaking change 없음.

### **[INFO]** `spec/conventions/chat-channel-adapter.md §3.1` — `executionFailedInternal` 분류 행 확장
- **위치**: 파일 44 (`spec/conventions/chat-channel-adapter.md`), 라인 2229
- **상세**: `CODE_MEMORY_LIMIT` 와 `HTTP_BLOCKED` 가 `executionFailedInternal` 버킷에 추가됐다. 채팅 채널 어댑터(Slack/Discord/Telegram) 구현이 이 표를 기준으로 분류 로직을 작성하므로, 이 spec 변경이 실제 코드(`execution-failure-classifier.ts`)에 반영되지 않으면 두 코드는 여전히 unknown fallback 으로 처리된다. naming_collision 검토(파일 19)에서 이미 `CODE_MEMORY_LIMIT` 가 `execution-failure-classifier.ts` 화이트리스트에 미등재됨이 WARNING 으로 지적됐고, 이번 spec 변경이 그 해소를 선언한다. 그러나 `HTTP_BLOCKED` 는 같은 검토에서 별도로 지적됐는데(파일 35) 여기서 spec 에 추가됐으므로 spec↔구현 간격은 일시적으로 확대될 수 있다.
- **제안**: `execution-failure-classifier.ts` 에 `CODE_MEMORY_LIMIT` 와 `HTTP_BLOCKED` 를 추가하는 코드 변경이 이 PR 또는 직후 PR 에 포함돼 있는지 확인. spec 이 구현보다 앞서 변경됐다면, 코드 구현이 완료될 때까지 분류 오분류 상태임을 tracking 해야 한다.

### **[INFO]** `spec/data-flow/1-audit.md §1.1` — call site 수 9→13 변경이 Rationale 에도 반영
- **위치**: 파일 45 (`spec/data-flow/1-audit.md`), 두 곳 모두 "9개 → 13개" 갱신
- **상세**: Rationale 마지막 단락의 "4개 모듈 9개 call site" 도 "13개" 로 갱신됐다. 이 숫자 갱신은 의도된 상태 변경이며, SoT 파일인 §1.1 표와 Rationale 의 서술이 일치하도록 유지됐다. 부작용 없음.
- **제안**: 없음.

### **[INFO]** `spec/1-data-model.md` — `embedding_llm_config_id` 제거 타임라인이 V092→PR4b 로 변경
- **위치**: 파일 38 (`spec/1-data-model.md`)
- **상세**: `embedding_llm_config_id` / `embedding_model` 컬럼의 제거 예정 타임라인이 `V092` 에서 `PR4b` 로 변경됐다. 이는 마이그레이션 계획 변경으로, V092 에서 이미 이 컬럼을 DROP 했을 것으로 가정한 다른 코드·spec·플랜이 있다면 혼선을 줄 수 있다. `구현 상태` 블록의 설명도 "V092 구 테이블/컬럼 정리" → "orphaned rerank_config 테이블 DROP(V092), KB legacy 컬럼은 PR4b 이월" 로 수정됐다. V092 의 실제 마이그레이션 파일이 이 변경을 반영하는지 확인이 필요하다.
- **제안**: V092 마이그레이션 파일에서 `embedding_llm_config_id` DROP 이 제거됐는지 코드 레벨에서 검증. 기존에 V092 가 이 컬럼을 DROP 하는 것으로 계획됐다가 실제로는 제외됐다면, 마이그레이션 파일이 이미 배포된 경우 혼란이 생길 수 있다.

### **[INFO]** `spec/2-navigation/6-config.md` — 구 alias 문구 "제거 예정" → "제거 완료" 로 변경
- **위치**: 파일 39 (`spec/2-navigation/6-config.md`)
- **상세**: `/api/llm-configs`, `/api/rerank-configs` alias 와 `code:` frontmatter 에 등재된 구 레거시 파일 경로가 제거됐다. frontmatter 의 `code:` 에서 `codebase/frontend/src/app/(main)/llm-configs/page.tsx` 등 6개 파일 경로가 삭제됐다. 이들 파일이 실제로 삭제됐다면 spec 갱신이 정확하지만, 파일이 여전히 존재한다면 spec-impl 불일치가 발생한다. alias 설명이 "유지 예정(PR4 에서 제거)" → "PR4 에서 제거됨" 과거형으로 변경됐으므로, PR4 이전에 이 spec 을 읽는 독자에게 혼선이 없도록 PR4 완료 전 merge 되지 않아야 한다. 현재 PR #545 (`unified-model-mgmt-pr4`) 가 MERGED 상태이므로 조건은 충족됐다.
- **제안**: 없음. PR #545 MERGED 로 전제 조건 충족.

### **[INFO]** `spec/4-nodes/0-overview.md §5` — `node:vm → isolated-vm` 샌드박싱 표 갱신
- **위치**: 파일 40 (`spec/4-nodes/0-overview.md`)
- **상세**: 샌드박싱 표에서 `node:vm`/`buildSandbox` 참조가 `isolated-vm`/`memoryLimit:128` 로 교체됐고, "메모리 제한 미구현(Planned)" 행이 "구현됨(code 노드)" 로 변경됐다. `plan_coherence.md`(파일 20) WARNING 이 지적한 불일치가 해소됐다. 이 변경은 실제 구현(`code.handler.ts`)과 동기화된 spec 갱신이므로 의도된 상태 변경이다.
- **제안**: 없음.

---

## 요약

이번 변경은 크게 두 유형으로 구성된다. (1) review/ 산출물 파일 37개는 consistency-check 자동화 파이프라인이 생성한 기록 파일이며 코드 런타임에 영향을 주지 않는다. 다만 4개 `_retry_state.json` 이 모두 "초기 상태" 스냅샷으로 커밋돼 있어, 재시도 로직이 이 파일을 읽을 경우 이미 완료된 checker 를 재실행할 잠재 위험이 있다. (2) spec/ 변경 10개는 모두 구현 완료 후 spec 동기화(isolated-vm 전환, auth_config audit 구현 완료, ModelConfig 통합 정리, SSRF 가드 확장)로 설명된다. 가장 주의할 부분은 `spec/conventions/chat-channel-adapter.md §3.1` 에 `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED` 가 spec 에만 추가된 상태로, 실제 `execution-failure-classifier.ts` 코드에 반영됐는지 추가 확인이 필요하다는 점이다. 기존 공개 인터페이스의 breaking change(기존 코드·에러 코드 제거)는 없으며, 모든 변경은 추가 또는 clarification 방향이다.

---

## 위험도

LOW
