# Code Review 통합 보고서

## 전체 위험도
**LOW** — chat-channel 에러 코드 i18n 완료 변경 set. Critical 발견 없음. WARNING 2건(generator 재실행 시 광범위 파일 변경 가능성, `_generator.py` 자동화 테스트 부재)은 의도된 trade-off 로 명시된 비차단 사항. 전반적 구현 품질 양호.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `_generator.py` `resp_param_rows` 조건 변경 — 재실행 시 현재 커밋(`appstore-orders.md`·`order/orders.md`·`store/orders-setting.md`) 외 다른 카탈로그 파일이 추가 변경됨. RESOLUTION.md · `cafe24-backlog-residual.md §G-4` 에 의도된 후속 작업으로 명시 | `spec/conventions/cafe24-api-catalog/_generator.py` `resp_param_rows` | 재생성 전 팀 공유. 후속 PR 에서 변경 파일 일괄 커밋. |
| 2 | testing | `_generator.py` `resp_param_rows` 컨테이너 kind 가드 로직에 pytest 없음. 수동 레시피(`_overview.md §7.3`)와 결과물이 정황 증거로 제공되나 자동화 검증 부재 | `spec/conventions/cafe24-api-catalog/_generator.py` | 별도 기술 부채 태스크로 pytest 추가 추적 권장 (blocking 아님). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `entity_id` 기반 캐시 경로에 이론적 경로 트래버설 가능성. 개발자 전용 CLI + 신뢰된 입력이라 실제 공격면 극히 제한적 | `_generator.py` `fetch_entity_json()` | `os.path.basename` 등 방어적 코딩 권장 |
| 2 | side_effect | `TRIGGER_NOT_FOUND` 번역이 chat-channel 외 일반 webhook 경로에서도 적용 — 표현이 chat-channel 편향 | `backend-labels.ts` `TRIGGER_NOT_FOUND` | 중립 표현 검토 (영문 SoT "Webhook endpoint not found" 충실 번역이라 유지 결정) |
| 3 | maintainability | `CHAT_CHANNEL_CODES` 와 `LOCALIZED_ERROR_CODES` 에 코드 중복 열거 | `backend-labels.test.ts` | 상호 참조 또는 재사용 검토 |
| 4 | maintainability | `INVALID_BOT_TOKEN` / `BOT_TOKEN_INVALID` 발생 흐름 구분 주석 보강 여지 | `backend-labels.ts` | 인라인 주석 명기 |
| 5 | maintainability | 신규 chat-channel 블록 주석이 기존 패턴 대비 상세 | `backend-labels.ts` | 스타일 일치 검토 |
| 6 | testing | `LOCALIZED_ERROR_CODES` stale-entry 미탐지 (기존 기술 부채) | `backend-labels.test.ts` | 장기 parity 전환 |
| 7 | testing | `_generator.py` 핵심 파싱 함수 pytest 전무 (기존 기술 부채) | `_generator.py` | 장기 pytest 픽스처 |
| 8 | documentation | `WORKSPACE_ID_REQUIRED` callout 미포함 | `triggers.mdx`/`.en.mdx` | 포함 또는 공용 안내 |
| 9 | documentation | `spec_impact` 필드 plan-lifecycle 스키마 미정의 | `fix-spec-frontmatter-catalog.md` | 스키마 절 추가 |
| 10 | documentation | `worktree: (unstarted)` sentinel 미정의 | `spec-sync-chat-channel-gaps.md` | 규약 명문화 |
| 11 | documentation | `fix-spec-frontmatter-catalog.md` 후속 비차단 항목 추적 링크 부재 | 해당 plan | plan 링크 추가 |
| 12 | documentation | `resp_param_rows` docstring 컨테이너 제외 규칙 (해소됨 — 이미 보강) | `_generator.py` | 완료 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | entity_id 캐시 경로 이론적 트래버설(INFO). 에러 메시지 정보 노출 없음 |
| requirement | NONE | spec §5.4 실패 응답 7종 전부 frontend i18n 반영 완료. 이전 WARNING 전부 해소 |
| scope | NONE | 변경 전체가 chat-channel i18n 완료 의도 범위. 무관 수정 없음 |
| side_effect | LOW | generator 재실행 광범위 변경(WARNING, 관리됨). TRIGGER_NOT_FOUND 번역 범용성(INFO) |
| maintainability | NONE | INFO 수준 개선 사항만 |
| testing | LOW | `_generator.py` pytest 부재(WARNING, 기술 부채). i18n 테스트 구조 양호 |
| documentation | LOW | 스키마 미정의·callout 미기재 등 INFO 수준 |
| user_guide_sync | NONE | KO/EN callout parity 정합. 누락 동반 갱신 0건 |

## 발견 없는 에이전트
- requirement, scope, user_guide_sync

## 권장 조치사항
1. **[비차단, 후속 PR]** `_generator.py` 재실행 시 변경되는 카탈로그 파일 전체를 `cafe24-backlog-residual.md §G-4` 계획대로 후속 PR 에서 일괄 커밋.
2. **[비차단, 기술 부채]** `_generator.py` pytest 추가 — 별도 task.
3. **[INFO]** plan-lifecycle 에 `spec_impact` / `(unstarted)` sentinel 명문화 (별 doc task).
4. **[INFO]** 나머지는 비차단 — RESOLUTION.md disposition 참조.

## 라우터 결정
라우터 미사용 — `routing=all`. 전체 8 reviewer 실행, 제외 없음.
