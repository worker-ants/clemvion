# 변경 범위(Scope) Review 결과

## 발견사항

### 파일 1: expression-constants.ts
- **[INFO]** `$thread` ROOT_VARIABLES 추가
  - 위치: line 35
  - 상세: 파일 19(`spec-sync-expression-language-gaps.md`)에 `$thread` autocomplete 노출이 decision-free 처리 대상으로 명시되어 있으며, 정확히 그 한 줄만 추가됨. 범위 내.
  - 제안: 없음.

### 파일 2: plan/complete/spec-draft-eia-strip-llmcalls.md (신규)
- **[INFO]** `llmCalls` 외부 수신자 strip L1 결정 spec-draft를 complete로 직접 생성
  - 위치: 전체 파일
  - 상세: `worktree: eia-strip-llmcalls`로 표시. plan 라이프사이클상 in-progress → complete 이동이 아닌 complete 직접 생성이나, 해당 결정·구현이 이미 완료된 상태를 기록하는 문서임. 작업 의도(spec 정보 그루밍)에 부합.
  - 제안: 없음.

### 파일 3: plan/complete/spec-draft-node-execution-cancelled.md (신규)
- **[INFO]** `NodeExecution.cancelled` status spec-draft를 complete로 생성
  - 위치: 전체 파일
  - 상세: 설계 결정·구현 영향·Rationale 포함. 완료된 작업의 기록 문서. 범위 내.
  - 제안: 없음.

### 파일 4: plan/complete/spec-draft-workspace-settings-api.md (신규)
- **[INFO]** `interactionAllowedOrigins` 설정 API/UI spec-draft를 complete로 생성
  - 위치: 전체 파일
  - 상세: 구현 완료된 워크스페이스 설정 API 작업의 기록 문서. 범위 내.
  - 제안: 없음.

### 파일 5: plan/complete/spec-fix-impl-marker-flips.md (신규)
- **[INFO]** spec marker flip 작업 기록을 complete로 생성
  - 위치: 전체 파일
  - 상세: A~E 전 항목 처리 결과 포함. 범위 내.
  - 제안: 없음.

### 파일 6: plan/complete/spec-fix-node-summary-fallback-filter.md (신규)
- **[INFO]** `fallback:` 필터 spec 문서화 기록을 complete로 생성
  - 위치: 전체 파일
  - 상세: 범위 내.
  - 제안: 없음.

### 파일 7: plan/complete/spec-fix-statistics-planned-markers.md (신규)
- **[INFO]** statistics planned-marker 제거 기록을 complete로 생성
  - 위치: 전체 파일
  - 상세: 범위 내.
  - 제안: 없음.

### 파일 8~14: plan/complete/spec-sync-*-gaps.md (신규 7개)
- **[INFO]** auth-flow, error-empty-states, information-extractor, statistics, text-classifier, user-guide-evidence, workflow gaps 티켓을 complete로 생성
  - 위치: 각 파일 전체
  - 상세: 이미 구현 완료된 항목들의 lifecycle 완료 처리. plan-lifecycle 규약에 따른 정상 흐름. 범위 내.
  - 제안: 없음.

### 파일 15: plan/complete/spec-update-c-sync-promotions.md (신규)
- **[INFO]** spec §C 코드 갭 구현 완료 후속 작업 기록을 complete로 생성
  - 위치: 전체 파일
  - 상세: §1~§4 처리 결과 + planner 처리 결과 섹션 포함. 광범위하지만 모두 이 그루밍 작업의 결과물. 범위 내.
  - 제안: 없음.

### 파일 16: plan/in-progress/spec-sync-carousel-gaps.md (수정)
- **[INFO]** `⚠ 재분류` 섹션 추가
  - 위치: 파일 끝 4줄 추가
  - 상세: decision-free 아님으로 재분류 + 구현 위치 안내. 기존 내용 변경 없이 append. 범위 내.
  - 제안: 없음.

### 파일 17: plan/in-progress/spec-sync-data-common-gaps.md (수정)
- **[INFO]** `⚠ 재분류` 섹션 추가
  - 위치: 파일 끝 4줄 추가
  - 상세: 동일 패턴. 범위 내.
  - 제안: 없음.

### 파일 18: plan/in-progress/spec-sync-embedding-pipeline-gaps.md (수정)
- **[INFO]** `§4.3` 체크오프 + 구현 상태 섹션 갱신
  - 위치: line 1469, 1479~1480
  - 상세: `[ ]` → `[x]` 체크오프 및 구현 상태 텍스트 갱신. §6.1 항목은 미구현 확인 후 유지. 정확한 상태 반영. 범위 내.
  - 제안: 없음.

### 파일 19: plan/in-progress/spec-sync-expression-language-gaps.md (수정)
- **[INFO]** `$thread` 항목 체크오프 + `$trigger`/`$env` 재분류 + 처리 결과 섹션 추가
  - 위치: line 1530~1535
  - 상세: `$thread` `[x]` 처리 + `$trigger`/`$env` 는 decision-free 아님으로 재분류. 범위 내.
  - 제안: 없음.

### 파일 20~23: plan/in-progress/spec-sync-foreach/integration-common/node-common/template-gaps.md (수정)
- **[INFO]** 각 파일에 `⚠ 재분류` 섹션 추가 (4~7줄 append)
  - 위치: 각 파일 끝
  - 상세: decision-free 아님으로 재분류 + 기술적 근거 + 구현 위치 힌트 추가. 기존 내용 변경 없이 append. 범위 내.
  - 제안: 없음.

### 파일 24: spec/2-navigation/10-auth-flow.md (수정)
- **[INFO]** frontmatter status partial→implemented, pending_plans 제거, 본문 미구현 마커 제거
  - 위치: frontmatter + §2.2 Email 행 + §2.5 Resend 항목 + §4.2 안내 화면 + API 표
  - 상세: spec-sync-auth-flow-gaps.md 의 전 항목이 구현 완료되어 marker flip. 코드 구현 커밋(27b6c362, 7fc682c3)에 의해 뒷받침됨. 범위 내.
  - 제안: 없음.

### 파일 25: spec/2-navigation/11-error-empty-states.md (수정)
- **[INFO]** status partial→implemented, 본문 미구현 마커 제거
  - 위치: frontmatter + §2.2 + §2.3
  - 상세: Triggers/Schedules EmptyState CTA + 검색 reset 구현 완료 반영. 범위 내.
  - 제안: 없음.

### 파일 26: spec/2-navigation/14-execution-history.md (수정)
- **[INFO]** Nodes 열 미구현 마커 → 구현 완료 설명으로 교체
  - 위치: §2.4 note
  - 상세: `completedNodeCount`/`totalNodeCount`/`failedNodeCount` 배치 집계 구현 반영. 범위 내.
  - 제안: 없음.

### 파일 27: spec/2-navigation/7-statistics.md (수정)
- **[INFO]** status partial→implemented, pending_plans 제거, 본문 미구현 마커 제거
  - 위치: frontmatter + §2.1 기간 필터 + §2.2 Total Runs
  - 상세: 커스텀 범위 UI + 증감률(`totalExecutionsChangeRate`) + `1d` enum 정합 구현 반영. 범위 내.
  - 제안: 없음.

### 파일 28: spec/4-nodes/0-overview.md (수정)
- **[INFO]** §1.4.1 `summaryTemplate` filter DSL 표 신설
  - 위치: §1.4 뒤 새 절 삽입 (13줄)
  - 상세: `upper`/`lower`/`default:`/`fallback:` 필터 문법 명문화. spec-fix-node-summary-fallback-filter.md 의 목표 변경. 범위 내.
  - 제안: 없음.

### 파일 29: spec/4-nodes/2-flow/1-workflow.md (수정)
- **[INFO]** status partial→implemented, 미구현 마커 전면 제거
  - 위치: frontmatter + §2 설정 UI note + §2 항목 4개 + §7 캔버스 요약
  - 상세: workflow-selector 위젯, Missing workflow 배지, summaryTemplate 구현 완료 반영. 범위 내.
  - 제안: 없음.

### 파일 30: spec/4-nodes/3-ai/2-text-classifier.md (수정)
- **[INFO]** status partial→implemented, 미구현 마커 제거
  - 위치: frontmatter + §3.2 예약어 검증 note + §5.3 retryable/retryAfterSec 표 + §7 캔버스 요약
  - 상세: RESERVED_PORT_WORDS, retryable, summaryTemplate 구현 완료 반영. 범위 내.
  - 제안: 없음.

### 파일 31: spec/4-nodes/3-ai/3-information-extractor.md (수정)
- **[INFO]** status partial→implemented, retryable/retryAfterSec 미구현 마커 제거
  - 위치: frontmatter + §5.3 표 2행
  - 상세: `retryabilityDetails` 헬퍼 충전 구현 반영. 범위 내.
  - 제안: 없음.

### 파일 32: spec/4-nodes/7-trigger/providers/telegram.md (수정)
- **[INFO]** 비활성 trigger 응답 바디 `{ ignored: true }` → `{ executionId: 'ignored' }`
  - 위치: §5 HTTP 응답 코드 정책 문단
  - 상세: webhook.md WH-EP-07 / chat-channel.md §5.5 실제 구현과 동기화. 단일 진실 정정. 범위 내.
  - 제안: 없음.

### 파일 33: spec/5-system/1-auth.md (수정)
- **[INFO]** §1.1 표에 "토큰 at-rest 저장"·"인증 메일 재발송" 행 추가
  - 위치: §1.1 표 2행 추가
  - 상세: SHA-256 해시 at-rest + resend-verification throttle/enumeration-safe 명문화. SEC-CRITICAL 해소 후속. 범위 내.
  - 제안: 없음.

### 파일 34: spec/5-system/12-webhook.md (수정)
- **[INFO]** WH-EP-07 미구현 마커 제거 + `{ ignored: true }` → `{ executionId: 'ignored' }` 통일
  - 위치: §3.1 WH-EP-07 행 + §3.1 응답코드 표 `410` 행 + §7 처리 흐름 step 5 + step 7c
  - 상세: chat-channel 비활성 트리거 202 처리 구현 완료 반영. 4곳 모두 동일 결정을 가리키므로 일관 수정. 범위 내.
  - 제안: 없음.

### 파일 35: spec/5-system/15-chat-channel.md (수정)
- **[INFO]** §5.5 표 "비활성 trigger" 행 + Rationale caveat 구현 완료로 교체
  - 위치: §5.5 표 1행 + Rationale R-CC-12 caveat 단락
  - 상세: 구현 완료(chatChannel 분기 선행 + inbound auth 강제)를 반영. webhook.md 와 단일 진실 동기화. 범위 내.
  - 제안: 없음.

### 파일 36: spec/5-system/5-expression-language.md (수정)
- **[INFO]** `$thread` 자동완성 미노출 note → 노출됨으로 교체
  - 위치: §4.4 note 1행
  - 상세: expression-constants.ts 수정(파일 1)에 대한 spec 측 mirror 수정. 범위 내.
  - 제안: 없음.

### 파일 37: spec/5-system/8-embedding-pipeline.md (수정)
- **[INFO]** §4.3 "미구현 — Planned" 헤딩 제거 + 미구현 본문 → 구현 완료 설명 교체
  - 위치: §4.3 헤딩 + note 단락 + "계획된 동작:" → "동작:"
  - 상세: commit 836ce29f CSV row-aware chunking 구현 반영. §6.1 는 변경 없이 미구현 유지(정확). 범위 내.
  - 제안: 없음.

### 파일 38: spec/conventions/user-guide-evidence.md (수정)
- **[INFO]** status partial→implemented, pending_plans 제거, 미구현 마커 제거
  - 위치: frontmatter + §2 가드 표 + §4 채널 2
  - 상세: api-endpoint anchor 검증 + user-guide-writer 체크리스트 구현 완료 반영. 범위 내.
  - 제안: 없음.

---

## 요약

변경 전체는 **spec-inprogress-groom** 작업 — "in-progress 상태 spec/plan 티켓에 대한 구현 완료 상태 반영·재분류·lifecycle 이동" — 의 의도 범위 안에서 이루어졌다. 코드 변경은 단 한 곳(`expression-constants.ts`의 `$thread` 1행)이며, 나머지는 `plan/complete` 신규 기록 문서 14건, `plan/in-progress` 상태 갱신 8건, `spec/**` 미구현 마커 flip 13건으로 구성된다. 모든 수정은 이미 완료된 구현을 spec·plan 에 반영하거나(marker flip), 아직 미결인 항목을 decision-free 아님으로 재분류하거나, plan lifecycle 완료 처리를 수행하는 것으로, 요청하지 않은 기능 추가·무관한 파일 수정·포맷팅 오염·불필요한 임포트·설정 변경은 확인되지 않는다.

## 위험도

NONE

STATUS: SUCCESS
