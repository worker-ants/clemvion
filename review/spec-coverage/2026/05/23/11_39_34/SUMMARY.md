# Spec Coverage Audit — 2026-05-23T11:45:27Z

## 요약

- 대상 spec: 103 개
- 후보 high: 20 개 (navigation + workflow-editor 중심 page-level UI spec; 나머지 82 건은 구조적 원인으로 별도 Note 에 기술)
- 후보 medium: 2 개 (API endpoint controller 부재)
- 후보 low: 0 개 (Heuristic 3 패턴 미발견)

> **구조적 주의**: 103 개 spec 중 101 개가 `status: spec-only` + `code: []` 상태이며, 이는 `spec/conventions/spec-impl-evidence.md §6` 의 frontmatter 일괄 롤아웃 plan (`plan/in-progress/spec-frontmatter-rollout.md`) 이 미완료임을 의미한다. UI 키워드가 있는 거의 모든 spec 이 Heuristic 1 에 걸리지만, `code: []` 는 `spec-only` 에서 **허용된 상태**이므로 high confidence 는 **가장 명백히 frontend 가 있어야 할 page-level UI spec** 20 건으로 제한한다.

---

## 후보 — high confidence

`spec-only + code: [] + 본문이 전체 화면(페이지·다이얼로그·드로어) 레이아웃을 명세한 spec` — frontend 구현 경로가 frontmatter 에 없음.

### 1. `spec/2-navigation/0-dashboard.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 48 의 UI 키워드 `카드` 등장; 대시보드 전체 페이지 레이아웃·카드 그리드·통계를 상세 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: 대시보드 page 컴포넌트 경로 (`codebase/frontend/src/app/(main)/dashboard/page.tsx` 등) 를 `code:` 에 추가하고 status `partial` 또는 `implemented` 로 갱신

### 2. `spec/2-navigation/1-workflow-list.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 52 의 UI 키워드 `토글` 등장; 워크플로 목록 페이지·필터·토글·다이얼로그 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: workflow list page 구현 경로 등록 또는 `pending_plans:` 추가

### 3. `spec/2-navigation/10-auth-flow.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 15 의 UI 키워드 `사이드바` 등장; 회원가입·로그인·이메일 인증·비밀번호 재설정 전체 플로우 페이지 명세
- **부재**: frontmatter `code: []`; frontend auth 경로 없음
- **권고**: auth pages (`app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx` 등) `code:` 등록

### 4. `spec/2-navigation/11-error-empty-states.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 7 의 UI 키워드 `페이지` 등장; 에러·빈 상태 전용 UI 컴포넌트 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: 에러·empty-state 컴포넌트 경로 `code:` 등록

### 5. `spec/2-navigation/12-workflow-version-history.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 25 의 UI 키워드 `드롭다운` 등장; 버전 이력 드롭다운·다이얼로그·체크박스 UI 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: version history UI 경로 등록 또는 미구현 시 `pending_plans:` 추가

### 6. `spec/2-navigation/13-user-guide.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 53 의 UI 키워드 `사이드바` 등장; 사용자 가이드 탭·카드·사이드바 UI 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: user-guide 페이지 컴포넌트 경로 (`codebase/frontend/src/content/docs/` 또는 app route) 등록

### 7. `spec/2-navigation/14-execution-history.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 36 의 UI 키워드 `페이지` 등장; 실행 이력 페이지·카드·버튼·탭·폼 전체 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: execution history page 컴포넌트 경로 등록

### 8. `spec/2-navigation/2-trigger-list.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 50 의 UI 키워드 `drawer` 등장; 트리거 목록·드로어·모달 전체 UI 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: triggers page + detail-drawer 컴포넌트 경로 `code:` 등록

### 9. `spec/2-navigation/3-schedule.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 51 의 UI 키워드 `다이얼로그` 등장; 스케줄 목록·다이얼로그·토글 UI 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: schedule page 컴포넌트 경로 등록

### 10. `spec/2-navigation/4-integration.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 18 의 UI 키워드 `페이지` 등장; 통합 목록·다이얼로그·카드·모달·탭 전체 UI 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: integrations page + 모달 컴포넌트 경로 등록

### 11. `spec/2-navigation/5-knowledge-base.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 43 의 UI 키워드 `버튼` 등장; knowledge base 목록·모달·페이지 UI 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: knowledge-base page 컴포넌트 경로 등록

### 12. `spec/2-navigation/6-config.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 100 의 UI 키워드 `드롭다운` 등장; 설정 페이지·드롭다운·폼 UI 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: config page 컴포넌트 경로 등록

### 13. `spec/2-navigation/8-marketplace.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 45 의 UI 키워드 `탭` 등장; 마켓플레이스 페이지·다이얼로그·카드·탭 명세. 상세 ASCII 레이아웃 다이어그램 포함
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: 미구현이면 `status: backlog` 로 격하 + `spec/0-overview.md §6.3` 로드맵 매칭 확인; 또는 `pending_plans:` 추가

### 14. `spec/2-navigation/9-user-profile.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 13 의 UI 키워드 `사이드바` 등장; 프로필·사이드바·다이얼로그·카드 UI 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: profile page 컴포넌트 경로 등록

### 15. `spec/3-workflow-editor/0-canvas.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 39 의 UI 키워드 `tab` 등장; 캔버스 전체 UI (노드·엣지·드로어·탭·폼) 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: workflow editor canvas 컴포넌트 경로 (`codebase/frontend/src/app/(main)/workflows/[id]/edit/` 등) 등록

### 16. `spec/3-workflow-editor/1-node-common.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 55 의 UI 키워드 `form` 등장; 노드 공통 UI (버튼·탭·폼·체크박스) 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: node common UI 컴포넌트 경로 등록

### 17. `spec/3-workflow-editor/3-execution.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 19 의 UI 키워드 `버튼` 등장; 실행·디버깅 UI (버튼·드로어·탭·폼·페이지) 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: execution drawer/debug panel 컴포넌트 경로 등록

### 18. `spec/3-workflow-editor/4-ai-assistant.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 9 의 UI 키워드 `폼` 등장; AI 어시스턴트 패널 UI (페이지·카드·버튼·체크박스·토글) 명세
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: AI assistant panel 컴포넌트 경로 등록

### 19. `spec/4-nodes/6-presentation/0-common.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 9 의 UI 키워드 `drawer` 등장; Presentation 노드 공통 UI (페이지·카드·버튼·드로어·모달) 명세. Presentation 노드군은 chat 채널 렌더링 표면을 직접 약속함
- **부재**: frontmatter `code: []`; frontend 경로 없음
- **권고**: Presentation render 컴포넌트 경로 등록 또는 `pending_plans:` 추가

### 20. `spec/5-system/15-chat-channel.md` — UI 키워드 vs frontend 부재
- **신호**: 본문 line 7 의 UI 키워드 `폼` 등장; 채널 설정 폼·카드·토글·탭 UI 명세. 텔레그램 chat-channel UI 영구 누락 사례의 핵심 spec (`spec-impl-evidence.md` SoT 발단)
- **부재**: frontmatter `code: []`; frontend 경로 없음. 이 spec 이 발견의 발단임에도 frontmatter 에 코드 경로 없음
- **권고**: chat-channel 설정 UI 컴포넌트 (`trigger-detail-drawer` 등) 를 `code:` 에 즉시 등록; 미구현 부분은 `pending_plans:` 추가. **rollout plan 1순위 권장**

---

## 후보 — medium confidence

(API endpoint 매칭 누락 — placeholder ID 등 false-positive 검토 필요)

### M1. `spec/5-system/13-replay-rerun.md` + 참조 spec 3건 — re-run endpoint 부재
- **신호**: `/spec/5-system/13-replay-rerun.md` §8.1 에 `POST /api/executions/:executionId/re-run` 명세; `spec/2-navigation/14-execution-history.md`, `spec/3-workflow-editor/3-execution.md`, `spec/3-workflow-editor/4-ai-assistant.md` 에서도 동일 endpoint 참조
- **부재**: `codebase/backend/src/modules/executions/executions.controller.ts` 에 `re-run` route 없음. 현재 routes: `GET :id`, `GET workflow/:workflowId`, `POST :id/stop`, `POST :id/continue`. 전체 backend controller 전수 grep 에서도 미발견
- **권고**: re-run 구현 plan 신설 또는 spec `pending_plans:` 에 re-run plan 등록

### M2. `spec/5-system/13-replay-rerun.md` — chain endpoint 부재
- **신호**: spec §8.2 에 `GET /api/executions/:executionId/chain` 명세 (chain 실행 연쇄 조회)
- **부재**: executions controller 및 전체 backend controller 에 `chain` route 없음 (knowledge-base controller 의 `chainedGraphExtraction` 변수명은 별개)
- **권고**: M1 과 동일 plan 내에서 함께 구현; chain 미구현이면 `pending_plans:` 등록 의무

---

## 후보 — low confidence

Heuristic 3 (`### 시나리오` / `### Test scenario` / `### Acceptance criteria` heading) 패턴이 103 개 spec 전체에서 발견되지 않음 → low confidence 후보 0 건.

---

## 구조적 패턴 Note (Heuristic 1 전수 결과)

Heuristic 1 은 **103 개 중 102 개**를 후보로 검출한다:
- `spec/conventions/spec-impl-evidence.md` — 유일하게 `status: implemented` + frontend 코드 경로 보유 → 제외
- `spec/4-nodes/0-overview.md` — frontmatter 자체 없음 (FM_END=-1) → Heuristic 1 적용 불가; **별도 이슈**: spec-impl-evidence.md §1 대상임에도 frontmatter 누락 — `spec-frontmatter.test.ts` 가드 통과 여부 확인 필요
- 나머지 101 개: `status: spec-only` + `code: []` + UI 키워드 존재

이 101 건이 모두 high confidence 로 보고되지 않은 이유: `spec-only` 에서 `code: []` 는 **허용된 상태** (spec-impl-evidence.md §3 표). 일괄 frontmatter 등록이 `plan/in-progress/spec-frontmatter-rollout.md` 에 이미 계획됨. 위 high 20 건은 그 중 **진짜 미구현 가능성이 높거나 우선순위가 높은** 항목을 우선 제시.

---

## False-positive 검토 가이드

- 본 audit 은 NLP 휴리스틱 기반. 결과는 *후보* 일 뿐 confirmed 결함 아님
- high confidence 도 spec 본문이 단순 참조·예시용으로 UI 키워드를 쓴 경우 false-positive 가능 (예: `spec/5-system/2-api-convention.md` 의 `page` 언급은 pagination API 설명)
- M1/M2 의 re-run + chain endpoint 는 별도 서비스 레이어 구현 후 controller 미노출 가능성이 있으나, 전체 controller 전수 grep 확인 완료로 가능성 낮음
- `GET /api/tags` (`spec/5-system/7-llm-client.md` 언급) 는 Ollama 외부 API 경로 (`GET {base_url}/api/tags`) 이며 내부 backend controller 대상 아님 → false-positive 로 제거
- 사용자가 검토 후 실제 결함 인정한 항목만 별 plan 으로 이관 — 본 audit 은 picking 보조

---

## 환경

- 검출 임계: SPEC_COVERAGE_CONFIDENCE_FLOOR=low
- 후보 상한: SPEC_COVERAGE_MAX_FINDINGS=200
- 실제 보고: high 20 + medium 2 + low 0 = 22 건 (상한 내)
