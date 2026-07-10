# Code Review 통합 보고서

- **세션**: `review/code/2026/07/10/23_20_30`
- **diff base**: `origin/main...HEAD` (커밋 `5e6f70b76`)
- **경로**: CLAUDE.md 가 허용하는 fallback 평문 Agent fan-out (Workflow subagent 의 report Write 가 harness 정책으로 차단됨 — 본 SUMMARY 는 main 이 persist)

## 전체 위험도

**LOW** — `#501` llm_usage_log attribution 회귀에 대한 순수 하드닝(타입 주석 1줄 + import, 회귀 테스트 1건 추가)으로
런타임 동작 변경이 전혀 없다. **Critical 0건**, 차단 사유 없음.

| 구분 | 건수 |
| --- | --- |
| Critical | 0 |
| Warning | 1 |
| Info | 6 |

## Critical 발견사항

없음.

## 경고 (WARNING)

### W1 — plan 체크박스 미갱신에 durable 추적 부재 (documentation)

이번 diff 가 정확히 충족하는 plan follow-up 두 항목(INFO#1 `LlmCallContext` 타입 주석, INFO#4 IE
collection-retry 2번째 chat attribution 테스트)의 체크박스가 여전히 `[ ]` 다. 병렬 진행 중인 문서 PR
**#898** 과의 동일 리스트 블록 병합 충돌을 피하기 위한 의도적 결정이며 사유가 커밋 메시지와
`review/consistency/2026/07/10/22_52_18/plan-coherence.md` 에 기록돼 있으나, 그 결정 자체가 durable 한
후속 추적 항목으로 등록돼 있지 않아 "코드는 반영됐는데 체크박스는 미체크" 상태로 SoT 가 stale 하게
방치될 위험이 있다.

- **위치**: `plan/in-progress/resume-llm-usage-attribution.md` "최종 /ai-review(02_09_15) INFO" 절 INFO#1/INFO#4
- **참고**: requirement / scope reviewer 도 동일 사실을 확인했으나 "이미 문서화된 trade-off" 로 보아 INFO 로 분류.
  사실관계는 일치, 심각도 평가만 상이.
- **처리**: `RESOLUTION.md` 참조 (defer + durable 등록).

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 처리 |
| --- | --- | --- | --- |
| 1 | maintainability / documentation | import 스타일 결 — 자매 파일 `information-extractor.handler.ts` 는 plain import, 본 파일은 로컬 관례인 inline `type` 수식어. lint 규칙 부재라 위반 아님 | 조치 불요 (의도적 선택) |
| 2 | maintainability | 신규 테스트가 인접 테스트의 2단계 mock 체인 셋업을 복제 — 파일 내 기존 3곳에서 반복되는 패턴 | 비차단. 유사 테스트가 더 늘면 `mockTwoTurnFinalize` 헬퍼 추출 고려 |
| 3 | testing | 대칭 커버리지 갭 — "attribution 이 애초에 `undefined` 인 기본 경로에서 2회차 호출도 `undefined` 로 유지되는지" 미검증. 실 리스크가 큰 방향(누락)은 이미 견고히 커버됨 | defer (RESOLUTION §2) |
| 4 | testing | `expect.objectContaining` 은 초과 필드 유출 미검출. 저장소 전역 관용구라 본 PR 만의 결함 아님 | 조치 불요 |
| 5 | security | `state.workflowId as string \| undefined` 캐스팅은 런타임 검증 우회. 본 diff 이전부터 존재, 스코프 밖. 값이 서버 내부 생성 식별자라 인가/노출 확대 없음 | 조치 불요 (스코프 밖) |
| 6 | documentation | CHANGELOG 신규 항목 불요 — 런타임 무변경이라 규약상 의무 없음 | 조치 불요 |

## 발견 없음으로 확인 (기록)

- **security**: 인젝션/인증·인가/시크릿/에러노출 어느 축에서도 신규 취약점 없음. `llmContext` 는 서버 내부
  생성 식별자만 담고 DB insert 는 TypeORM 파라미터 바인딩. 신규 테스트는 순수 mock, 하드코딩 시크릿 없음.
- **side_effect**: 타입 주석은 컴파일 타임에만 존재해 런타임 JS 산출물에 흔적 없음(순수 no-op).
  전역 상태·시그니처·공개 API·환경 변수·네트워크·이벤트 콜백 무변경. 테스트는 append-only, `beforeEach` 격리.
- **scope**: production +9/-1, 테스트 +48(append-only) 전부 선언된 의도 (e)/(g) 와 1:1 일치.
  불필요한 리팩터링·기능 확장·포맷팅 잡음 없음.
- **requirement**: #501 attribution 불변식과 코드/테스트/spec line-level 일치. reviewer 가 mutation 검증
  (오탈자 → TS2561 차단, retry 경로 누락 → 신규 테스트 단독 실패)을 **독립 재현**함.

## 에이전트별 위험도

| 에이전트 | 위험도 | 핵심 |
| --- | --- | --- |
| security | NONE | 신규 취약점 없음 |
| requirement | NONE | 불변식 일치, mutation 실효성 독립 재현 |
| scope | NONE | 선언 의도와 완전 일치 (순수 append) |
| side_effect | NONE | 런타임 no-op |
| maintainability | LOW | mock 셋업 반복, import 스타일 결 (둘 다 비차단) |
| testing | LOW | vacuous 아님 실증됨. 대칭 방향 갭 1건 (비차단) |
| documentation | LOW | 인라인 주석 우수. plan 체크박스 durable 추적 부재 → W1 |

## 라우터 결정 / skip 목록

`review-router` 는 본 세션에서 **미실행** (`routing_status=pending`). CLAUDE.md 가 허용하는 fallback 평문
Agent fan-out 경로를 사용했고, `agents_forced` 전량(7명)을 실행했다.

- **실행 (7)**: security, requirement, scope, side_effect, maintainability, testing, documentation — 전원 success.
- **제외 (7, 수동 판단)**: 변경 표면이 (1) 타입 주석 1줄 + import, (2) 단위 테스트 1건 추가로 국한.

| 제외 reviewer | 사유 |
| --- | --- |
| performance | 런타임 동작 무변경(컴파일 타임 타입 주석) — 성능 표면 없음 |
| architecture | 기존 인터페이스(`LlmCallContext`) 소비 지점 추가일 뿐, 모듈 경계 무변경 |
| dependency | 신규 의존성/버전 변경 없음 |
| database | DB 스키마/쿼리 변경 없음 |
| concurrency | 제어 흐름·동시성 로직 변경 없음 |
| api_contract | 공개 API 시그니처/계약 변경 없음 |
| user_guide_sync | 사용자 대면 기능/UX 변경 없음 (백엔드 내부 하드닝) |

## 권장 조치

1. **(W1)** `#898` 머지 직후 별도 pass 로 `plan/in-progress/resume-llm-usage-attribution.md` 의 INFO#1/INFO#4 를
   `[x]` 갱신 + `plan/complete/` 이동 검토. 의도를 PR 설명에도 남겨 본 SUMMARY 하나에만 의존하지 않을 것.
2. (선택, 비차단) `retryState()` 기본값 경로 2회차 호출도 `llmContext === undefined` 임을 확인하는 대칭 assertion.
3. (선택, 비차단) 2단계 mock 체인 셋업이 더 늘면 소형 헬퍼 추출.
4. 그 외 조치 불요 — 순수 하드닝, 차단 사유 없음.
