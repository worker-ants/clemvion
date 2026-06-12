# Code Review 통합 보고서

## 전체 위험도
**LOW** — chat-channel 에러 코드 i18n 매핑 추가 및 generator 버그 수정이 핵심 변경으로, 기능 결함은 없으나 i18n 커버리지 미완성(누락 2개 코드), 테스트 갭(WORKSPACE_ID_REQUIRED 직접 행동 검증 및 generator 자동화 테스트 부재)이 경고 수준으로 잔존.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | i18n 커버리지 | spec §5.4 에 등재된 `BOT_TOKEN_INVALID`(setupChannel 401/403)와 `CHAT_CHANNEL_SETUP_FAILED`(setupChannel API 실패 502)가 `ERROR_KO`에 없어 한국어 로케일에서 영문 fallback으로 표시됨. `triggers.mdx` callout이 "모두 한국어 안내 메시지로 표시돼요"라고 선언하나 이 두 코드는 예외 | `codebase/frontend/src/lib/i18n/backend-labels.ts` ERROR_KO; `spec/5-system/15-chat-channel.md §5.4` | `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 에 대한 ERROR_KO 항목 추가. 또는 의도적 생략이라면 `backend-labels.ts` 주석에 근거 명시 |
| 2 | 테스트 갭 | `WORKSPACE_ID_REQUIRED`가 `LOCALIZED_ERROR_CODES` parity 가드에는 추가됐으나 `translateBackendError` 직접 행동 테스트(케이스 (7)(8) 패턴)에서 누락됨 | `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` `describe("translateBackendError — 직접 단위 테스트")` 블록 | `CHAT_CHANNEL_CODES` 배열에 `WORKSPACE_ID_REQUIRED` 포함하거나 별도 케이스 추가. 또는 의도적 제외임을 주석으로 명시 |
| 3 | 테스트 갭 | `_generator.py` `resp_param_rows` 컨테이너 kind 가드 수정에 대한 자동화 단위 테스트 없음. 이전 review Warning#2에서 docstring + 수동 레시피로 부분 처리됐으나 자동 회귀 탐지는 미해결 | `spec/conventions/cafe24-api-catalog/_generator.py` `resp_param_rows` 함수 | `obj`/`arr` kind의 cross-map fallback 미적용, 스칼라 kind의 fallback 두 케이스에 대한 최소 pytest. CI 자동 실행 어렵다면 `_overview.md §7.3` 에 수동 검증 레시피 보강 |
| 4 | 부작용 위험 | `_generator.py` 컨테이너 fallback 제거 수정 적용 후 재실행 시 현재 커밋에 포함되지 않은 다수 카탈로그 파일에 추가 변경 발생 가능 | `spec/conventions/cafe24-api-catalog/_generator.py` | generator가 수동 CLI 전용임을 확인. `cafe24-backlog-residual.md §G-4`에 이미 backlog로 관리 중 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `_generator.py` `entity_id` 기반 경로 구성에서 이론적 path traversal. 개발자 전용 CLI + 신뢰된 입력이라 실제 공격면 없음 | `_generator.py` | 방어적 코딩 차원 `os.path.basename` 고려 |
| 2 | i18n 의미 정합성 | `TRIGGER_NOT_FOUND` 번역이 chat-channel 맥락 특화. 일반 webhook 경로 공용 | `backend-labels.ts` | 중립 표현 교체 또는 공용 주석 |
| 3 | 문서 | `WORKSPACE_ID_REQUIRED` callout 맥락 설명 없음 | `triggers.mdx`/`.en.mdx` | 공통 에러 코드 안내 추가 검토 |
| 4 | 유지보수성 | `LOCALIZED_ERROR_CODES` 단방향 동기화 (기존 기술 부채) | `backend-labels.test.ts` | 장기 parity 개선 |
| 5 | 문서 | `fix-spec-frontmatter-catalog.md` 후속 `INFO#4` 미처리 TODO | `plan/complete/fix-spec-frontmatter-catalog.md` | 처리 여부 확인 |
| 6 | 문서 | `spec_impact` 선택 필드 여부 plan-lifecycle 미명시 | plan frontmatter | 선택 필드 명시 |
| 7 | 문서 | `(unstarted)` sentinel 공식 허용 목록 명시 필요 | `spec-sync-chat-channel-gaps.md` | plan-lifecycle 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `_generator.py` 이론적 path traversal (실제 공격면 없음) |
| requirement | LOW | §5.4 `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 2종 ERROR_KO 미등재 (WARNING) |
| scope | NONE | 변경 set 목적 범위 한정, 무관 수정 없음 |
| side_effect | LOW | `TRIGGER_NOT_FOUND` 맥락 특화; generator 재실행 광범위 변경 (managed backlog) |
| maintainability | NONE | 단방향 동기화는 기존 패턴, 악화 없음 |
| testing | LOW | `WORKSPACE_ID_REQUIRED` 직접 테스트 누락 (W); generator 자동화 테스트 부재 (W) |
| documentation | LOW | callout/번역 근거 주석 미포함; spec_impact 스키마 비공식 |
| user_guide_sync | NONE | trigger 매트릭스 발화 0건, KO/EN parity 유지 |

## 발견 없는 에이전트
- scope, user_guide_sync

## 권장 조치사항
1. **[W#1]** `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` ERROR_KO 추가 → callout "모두 한국어" 현실 일치.
2. **[W#2]** `WORKSPACE_ID_REQUIRED` translateBackendError 직접 행동 테스트 추가.
3. **[W#3]** `_generator.py` `resp_param_rows` pytest 또는 `_overview.md §7.3` 레시피 보강(완료).
4. **[W#4]** generator CI 실행 경로 점검 (수동 CLI 전용 확인).
5. **[INFO]** plan 메타데이터 정비 (spec_impact / (unstarted) 명시).

## 라우터 결정
실행 8명 (router_safety 강제 7 + user_guide_sync). 제외 6명 (performance/architecture/dependency/database/concurrency/api_contract).
