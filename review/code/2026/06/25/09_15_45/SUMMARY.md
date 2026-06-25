# Code Review 통합 보고서

> 리뷰 세션: `review/code/2026/06/25/09_15_45`
> 대상 커밋: `cbb39dec` (이후 W1·I11·I13 fix amend → `bd0d9517`, author-date 보존)
> 리뷰 일시: 2026-06-25

> **NOTE (main 후속 처분)**: 상세 처분은 `RESOLUTION.md`. security reviewer 는 워크플로에서 출력 미생성 →
> standalone 재실행으로 완료(LOW, INFO만). SPEC-DRIFT INFO(I1~I4)는 `git show HEAD:` 검증 결과 **FALSE
> POSITIVE**(spec 이미 갱신: EIA §5.2+R18, 2-sdk §3, admin-console §6+R7) — reviewer 가 대형 multi-file diff
> 의 spec hunk 를 놓친 blind spot.

---

## 전체 위험도

**LOW** — Critical 0건, Warning 1건(W1, 처리 완료). presentation 노드 `execution.message` 이벤트 / `resetSession`
세션 초기화 command / 2-column 레이아웃 3종이 기존 API 계약을 깨지 않고 additive 하게 구현됨. 발견의 절대다수는
INFO 수준 유지보수·문서 권고.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| W1 | 문서화 | `ParsedMessage.presentations`·`ParsedAiMessage.presentations` 타입+JSDoc 독립 선언 → drift 위험 | **FIXED** — `ParsedMessage.presentations` JSDoc 에 "ParsedAiMessage 와 동일 규약, 변경 시 양쪽 동기" 크로스레퍼런스 추가 (bd0d9517) |

---

## 참고 (INFO) — 처분 RESOLUTION.md

| # | 카테고리 | 발견사항 | 처분 |
|---|----------|----------|------|
| I1 | SPEC-DRIFT | execution.message EIA §5.2 누락(주장) | **FALSE** — §5.2 L387 + R18 실재 |
| I2 | SPEC-DRIFT | resetSession 2-sdk §3 누락(주장) | **FALSE** — §3 L86 실재 |
| I3 | SPEC-DRIFT | admin-console §6 미반영(주장) | **FALSE** — §6 L193·L196 + R7 실재 |
| I4 | SPEC-DRIFT | R18·R7 미선행(주장) | **FALSE** — 동일 커밋 spec 에 실재 |
| I5 | 아키텍처 | AI_MESSAGE reducer 재사용(text:"") | 수용 — 이중 텍스트 방지, 장기 전용 action 백로그 |
| I6 | 아키텍처 | postCommand action 타입 느슨 | DEFER — 단일 호출처, 저위험 |
| I7 | 아키텍처 | Parsed* presentations 중복 | W1 으로 부분 해소(크로스레퍼런스) |
| I8 | 아키텍처 | PRESENTATION_NODE_TYPES 암묵 결합 | 수용 — JSDoc 에 form 제외 의도 명시 |
| I9 | 요구사항 | adapted.config/output undefined 가능성 | adaptHandlerReturn 정규화로 항상 객체 — 저위험 |
| I10 | 요구사항 | ParsedMessage nodeId/nodeType 미노출 | 현 소비처 presentations 만 사용 — 불필요 |
| I11 | 테스트 | carousel 개별 emit 케이스 미검증 | **FIXED** — carousel emit 테스트 추가 (bd0d9517) |
| I12 | 테스트 | blocking 케이스 미발행 테스트 부재 | DEFER — 구조적 보장(emit 이 `!isBlocking` 분기 내부) + 기존 button-interaction 테스트 커버. 엔진 spec blocking 셋업(real ButtonInteractionService) 복잡·flaky 위험 |
| I13 | 테스트 | parseMessage chart 케이스 누락 | **FIXED** — chart 픽스처 추가 (bd0d9517) |
| I14 | 테스트 | use-widget execution.message/resetSession 핸들러 테스트 부재 | DEFER — 핸들러는 단순 위임(parseMessage·newChat 각각 단위테스트됨), use-widget 테스트 하네스 부재 |
| I15 | 테스트 | live-preview 버튼 가드 테스트 부재 | DEFER — 단순 UI |
| I16 | 테스트 | e2e 미작성 | DEFER — 회귀 e2e 실행. 신규 시나리오 e2e 는 후속(plan Phase 5 §2 명시) |
| I17 | 문서화 | PRESENTATION_NODE_TYPES JSDoc 소비처 stale 가능 | 수용 |
| I18 | 문서화 | WS §4.4 카탈로그 execution.message 확인 | EIA §5.2 참조 구조 — 추가 불필요 |
| I19/I23 | 문서화 | §5.2 payload executionId/seq/timestamp 주입 경로 미명시 | DEFER — 경미 |
| I20/I22 | API | resetSession 공개여부·서버상태 영향 | 2-sdk §3 에 "host→iframe 전용·서버 미변경" 명시(L91) |
| I21/I28 | API | ExecutionMessageEvent presentations/필드 타입 느슨 | DEFER — wire 파싱 leniency 의도(AiMessageEvent 동일 패턴) |
| I24~I27/I29 | 유지보수성 | 헬퍼 추출·주석 길이 등 | DEFER — 경미 |
| I30 | 보안(파일부재) | security.md 미생성 | **RESOLVED** — standalone 재실행 완료(LOW) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | LOW (standalone) | INFO만 — outputData 노출=기존 R17 하드닝 항목, resetSession origin 이중검증, presentations 렌더러 위임 |
| architecture | LOW | INFO 4건 |
| requirement | LOW | SPEC-DRIFT 3건(후속검증 FALSE) + INFO 2건 |
| scope | NONE | 범위 이탈 없음 |
| side_effect | NONE | additive·중복발화 없음 |
| maintainability | LOW | 헬퍼 추출 등 INFO |
| documentation | LOW | spec 동일 커밋 갱신·i18n 양국어 |
| performance | NONE | O(1) Set·소형 객체 |
| concurrency | NONE | resetSession 이중클릭 INFO |
| api_contract | LOW | additive 하위호환, 타입 일부 개방 |
| testing | LOW | I11/I13 fix, I12/I14~16 defer |

---

## 권장 조치사항

1. W1 — FIXED (JSDoc 크로스레퍼런스).
2. I11·I13 — FIXED (carousel emit + chart parse 테스트).
3. I1~I4 SPEC-DRIFT — FALSE POSITIVE, spec 이미 갱신(검증 완료).
4. security I30 — standalone 재실행 완료(LOW).
5. 잔여 INFO — 비차단, RESOLUTION 에 사유와 함께 defer/수용.
