# 요구사항(Requirement) 리뷰 결과

**리뷰 대상**: `http-ssrf-all-auth` 브랜치 변경 — consistency review 산출물(review/consistency/) + spec 파일 변경(spec/4-nodes/4-integration/, spec/5-system/, spec/conventions/, spec/data-flow/, spec/1-data-model.md 등)
**리뷰 일시**: 2026-06-11
**리뷰어**: requirement reviewer

---

## 발견사항

### [WARNING] `spec/5-system/3-error-handling.md` §3.2 표에 `HTTP_BLOCKED` 누락 — §1.4 표와 불일치

- **위치**: `spec/5-system/3-error-handling.md` line 222 (§3.2 "대표 에러 코드" 표)
- **상세**: `3-error-handling.md` §1.4 (line 79)는 HTTP 카테고리에 `HTTP_TIMEOUT` · `HTTP_BLOCKED` 를 포함하는 완전한 목록을 제공한다. 그러나 §3.2 의 "대표 에러 코드" 표 HTTP 행 (line 222)은 `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX`, `HTTP_TIMEOUT` 만 나열하고 `HTTP_BLOCKED` 가 빠져 있다. `spec/4-nodes/4-integration/1-http-request.md §4` 및 `§4.2`에서 `HTTP_BLOCKED` 는 전 인증 방식 공통 SSRF 차단 코드로 명확히 정의되어 있고, 구현(`http-request.handler.ts` line 356, 365)에서도 사용된다. 두 섹션이 동일 spec 문서 내에서 불일치한다.
- **제안**: `3-error-handling.md` §3.2 HTTP 행을 `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX`, `HTTP_TIMEOUT`, `HTTP_BLOCKED` (SSRF 차단) 로 갱신해 §1.4 와 일치시킨다.

---

### [WARNING] `spec/5-system/3-error-handling.md` §3.2 표에 `HTTP_TIMEOUT` 등재 vs 구현에서 미사용 — 역방향 불일치

- **위치**: `spec/5-system/3-error-handling.md` line 222, `spec/conventions/chat-channel-adapter.md` line 381
- **상세**: `3-error-handling.md` §1.4 및 §3.2 표와 `chat-channel-adapter.md §3.1` 분류 표는 `HTTP_TIMEOUT` 을 HTTP 카테고리 코드로 등재한다. 그러나 `spec/4-nodes/4-integration/1-http-request.md §4` step 12에서 fetch reject (타임아웃 포함)는 `HTTP_TRANSPORT_FAILED` 로 처리됨을 명시하고, 구현(`http-request.handler.ts`)도 `AbortController` timeout 포함 모든 `fetch` reject를 `HTTP_TRANSPORT_FAILED` 로만 라우팅한다. 실제 `HTTP_TIMEOUT` 코드를 발행하는 Integration 노드 핸들러가 존재하지 않는다. `error-codes.ts` 에는 `HTTP_TIMEOUT` 이 정의되어 있으나(`line 13`) 호출하는 핸들러가 없다. 외부 통합(`notification-webhook.processor.ts`)은 HTTP_TIMEOUT 상수 이름이 아닌 일반 변수명으로 timeout을 쓰는 것이라 무관하다. `chat-channel-adapter.md §3.1` 의 `HTTP_TIMEOUT → executionFailedTimeout` 행은 실제 발생하지 않는 코드를 분류하는 dead path가 됐다.
- **제안**: `3-error-handling.md` §1.4 및 §3.2 의 `HTTP_TIMEOUT` 을 제거하거나 "(미발행 — `HTTP_TRANSPORT_FAILED` 로 통합)" 주석을 추가한다. `chat-channel-adapter.md §3.1` 의 `HTTP_TIMEOUT` 행도 동일하게 처리. 또는 `1-http-request.md §4` step 12가 의도적으로 `HTTP_TRANSPORT_FAILED` 로 통합했음을 `3-error-handling.md` 에 명시해 독자 혼란을 방지한다.

---

### [WARNING] `spec/4-nodes/4-integration/1-http-request.md §5.3.2` `output.response: { error }` legacy 잔재 — 제거 의도 미선언

- **위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.3.2 (Transport 실패 케이스 JSON 예시)
- **상세**: 구현(`http-request.handler.ts` line 511)에서 transport 실패 시 `output.response: { error: message }` 를 포함한다. `spec/4-nodes/4-integration/1-http-request.md` §5.3.2 는 이에 대한 spec 예시는 있으나, 이것이 legacy 잔재이며 `node-output-redesign/http-request.md P3` 에서 제거 예정임을 spec 본문에 명시하지 않는다. 워크플로 작성자가 `output.response.error` 로 transport 실패 메시지에 접근하는 코드를 작성할 경우 향후 P3 제거 시 breaking change가 된다. P3 는 현재 별도 plan 에만 존재하고 spec 본문에 deprecation 의도가 없다.
- **제안**: `1-http-request.md §5.3.2` JSON 예시에 `"response": { "error": "..." }` 필드에 `// legacy — 제거 예정 (P3)` 또는 footnote 를 추가해 소비자에게 `output.error` 를 사용하도록 안내한다.

---

### [INFO] `spec/5-system/3-error-handling.md` §3.2 표 헤딩 — "대표" vs 완전 목록 의도 불명확

- **위치**: `spec/5-system/3-error-handling.md` line 218
- **상세**: §3.2 표 직전에 "대표 에러 코드 (후속 PR 에서 enum 확장)" 라고 기술해 비완전 목록임을 암시하지만, §1.4 는 "정식 목록은 `error-codes.ts` 의 `ErrorCode` enum" 으로 완전 목록을 지향한다. 두 섹션의 의도 차이가 명시되어 있지 않아 §3.2 를 SoT 로 참조하는 독자가 코드를 누락할 수 있다.
- **제안**: §3.2 헤딩 주석에 "전체 목록은 §1.4 참조" 또는 "§1.4 의 요약" 임을 명시한다.

---

### [INFO] consistency review 산출물 (파일 1~37) — 기능 완전성 관점

- **위치**: `review/consistency/2026/06/11/21_19_55/`, `22_00_31/`, `22_04_01/`, `22_46_26/`, `23_14_40/`
- **상세**: 5개 consistency check 세션의 산출물은 모두 규약에 맞는 5-checker 구조(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision)로 생성됐다. `_retry_state.json` 파일의 `agents_pending` 배열이 완료 후에도 초기값(5개 모두 pending)을 유지하고 있으나, 이는 초기화 시 기록된 snapshot 으로 SUMMARY.md 가 정상 생성됐으면 세션 자체는 완료된 것으로 해석 가능하다. `STATUS: SUCCESS` 라인이 각 세부 checker 출력에 명시되어 있다.
- **제안**: 추가 조치 불필요 — 리뷰 산출물 파일 구조 정상.

---

### [INFO] `spec/1-data-model.md` — `embedding_llm_config_id`·`embedding_model` 제거 예정 태그 변경 (`V092` → `PR4b`)

- **위치**: `spec/1-data-model.md` lines 2027-2028
- **상세**: 이전 버전에서 `[LEGACY — V092 제거 예정]` 로 기술됐던 두 컬럼이 `[LEGACY — PR4b 제거 예정]` 으로 정정됐다. V092 마이그레이션은 `rerank_config` 테이블 DROP 만 포함하고, KB legacy embedding 컬럼 제거는 데이터 마이그레이션 선행이 필요해 PR4b 로 이월됐다는 근거를 "구현 상태" 노트에 명시한다. 근거가 충분히 기술돼 있다.
- **제안**: 없음. 의도 명확.

---

### [INFO] `spec/data-flow/1-audit.md` — call site 수 9 → 13 갱신

- **위치**: `spec/data-flow/1-audit.md` lines 2244, 2266
- **상세**: `auth_config.create/update/delete/regenerate` 4종 추가로 9개 → 13개 call site 로 정확히 갱신됐다. §1.1 표도 4개 행이 추가되고 `auth_config.reveal` 행의 비고가 "auth_config 계열은 모두 `ipAddress` 를 함께 전달" 로 업데이트됐다. Rationale 끝의 "4개 모듈 9개 call site" 도 동일하게 13개로 갱신됐다 — 두 곳이 일관됨.
- **제안**: 없음.

---

### [INFO] [SPEC-DRIFT] `spec/4-nodes/4-integration/1-http-request.md §4` SSRF 가드 적용 범위 확장 — origin/main `line 96` 구 정의와의 버전 간 의미 차이

- **위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8 및 §4.2
- **상세**: `origin/main` 버전의 `1-http-request.md §4 step 8` 은 SSRF 가드를 `authentication='integration'` 일 때만 적용한다고 명시했으나, target(이번 변경)은 "전 인증 방식 공통 — `none`/`integration`/`custom` 모두" 로 확장한다. 이는 `refactor/04-security.md` C-3 의 사용자 결정(옵션 A)을 정식으로 반영한 의도적 변경이다. 구현(`http-request.handler.ts` line 334-375)도 동일하게 인증 방식 조건 없이 SSRF 가드를 적용한다. 코드가 옳고 spec 이 의도적으로 업데이트된 것이다. 단 `spec/5-system/3-error-handling.md §1.4` 의 `HTTP_BLOCKED` 설명("전 인증 방식 공통") 은 이미 반영됐으나 §3.2 에서는 누락 (위 WARNING 참조).
- **제안**: 코드 유지 + spec 반영 완료로 볼 수 있다. 단 §3.2 누락은 별도 WARNING 으로 처리 필요.

---

## 요약

이번 변경의 핵심은 SSRF 가드를 `integration` 인증 방식에만 적용하던 것을 `none`/`integration`/`custom` 전 인증 방식으로 확장한 것(`1-http-request.md §4 step 8`)이며, 이는 `refactor/04-security.md C-3` 사용자 결정을 정식 구현한 것으로 기능 완전성은 충족한다. `HTTP_BLOCKED` 에러 코드가 `chat-channel-adapter.md §3.1` 분류 표에 추가됐고(`executionFailedInternal` 그룹), `spec/5-system/3-error-handling.md §1.4` 에도 추가됐다. 그러나 동일 문서 §3.2 의 "대표 에러 코드" 표에는 `HTTP_BLOCKED` 가 누락됐다. 더 중요한 점은 `HTTP_TIMEOUT` 코드가 `3-error-handling.md §1.4`·§3.2와 `chat-channel-adapter.md §3.1` 에 여전히 등재되어 있으나, 실제 HTTP Request 핸들러는 timeout 을 포함한 모든 fetch reject를 `HTTP_TRANSPORT_FAILED` 로 통합 처리하고 `HTTP_TIMEOUT` 을 발행하지 않는다는 역방향 불일치가 존재한다. consistency review 산출물 자체는 규약에 맞게 생성됐으며 spec 변경(spec/1-data-model.md, spec/2-navigation/6-config.md, spec/4-nodes/0-overview.md, spec/5-system/1-auth.md, spec/data-flow/)의 기능 완전성은 양호하다.

---

## 위험도

MEDIUM

---

STATUS: SUCCESS
