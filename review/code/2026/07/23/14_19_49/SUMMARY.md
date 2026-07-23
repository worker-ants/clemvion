# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 0건. 7개 forced reviewer 전원 결과 확보(누락 없음). `output-shape.ts` 는 JSDoc 주석 재작성뿐(non-comment diff 0줄 실측 확인)이며, 실행 로직은 이번 diff 로 전혀 변경되지 않았다. 유지보수성 관점의 경미한 drift 위험(줄번호 하드코딩, mutation 서술 중복) 및 테스트 커버리지 사전 갭(이번 diff 범위 밖)만 존재.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability / documentation | 신규 테스트 주석에 소스 파일의 구체적 줄번호(`output-shape.ts:202`)를 하드코딩. 현재는 정확하나 JSDoc/코드가 밀리면 stale 해질 수 있고 자동 drift 감지 장치 없음 | `output-shape.test.ts:805` | 줄번호 대신 `typeof endReason === "string"` conjunct 등 코드 앵커(식별자/표현식) 기준 서술로 전환 검토 |
| 2 | maintainability / testing | mutation 실측 서술(R1/R2/R3, TS2345 결과)이 신규 테스트 주석과 `plan/in-progress/output-shape-comment-followups.md` "측정 1" 표 양쪽에 거의 동일하게 중복 기록됨 — 이번 diff 가 JSDoc 에 새로 명문화한 "근거는 한 곳에만" 원칙과 부분적으로 어긋남. plan 문서가 `complete/` 로 이관되면 두 서술이 갈라져도 감지할 SoT가 없음 | `output-shape.test.ts:800-813` vs `plan/in-progress/output-shape-comment-followups.md` "측정 1" 표 | 실측 표는 plan 문서(SoT)에만 남기고, 테스트 주석은 결론 요약(잡는 리팩터 클래스) + plan 포인터로 축약 |
| 3 | testing | `output.endReason` (top-level, non-nested) fallback 분기(`?? (output.endReason as string \| undefined)`)가 어떤 fixture 로도 단독 격리되지 않음 — 통째로 지워도 현재 40개 테스트 중 어느 것도 red 가 되지 않을 것으로 보임. 이번 diff 로 신규 도입된 갭은 아니며 사전 존재 | `output-shape.ts:202` | 후속 편집 시(또는 새 이월 항목으로) `output.endReason`-only 고립 fixture 1건 추가 + JSDoc 방어 목록에 해당 분기 언급 여부 정리 |
| 4 | maintainability / documentation | 파일 내 언어 혼재 지속 — `isConversationOutput` JSDoc 만 한국어로 통일됐고 `unwrapNodeOutput`/`extractIeSnapshot`/`extractAiMetadata`/`extractTurnDebug` 등 나머지 JSDoc 은 여전히 영어. plan 이 명시적으로 스코프를 이 함수로 좁힌 의도된 결정 | `output-shape.ts` 전체 | 이번 PR 에서는 조치 불요. 향후 해당 함수들을 편집할 기회에 언어 통일 검토 |
| 5 | requirement | plan 문서 내 spec 인용 markdown 링크가 실제 파일 위치와 어긋남 — `api-convention.md` 는 `spec/5-system/2-api-convention.md` 에 있으나 링크는 `spec/conventions/` (swagger.md 만 실존하는 디렉터리)를 가리킴. 인용 내용 자체(unsound discriminator 서술)는 사실과 부합 | `plan/in-progress/output-shape-comment-followups.md` "기각 근거(실측)" 표 3번째 행 | 링크를 `spec/5-system/2-api-convention.md#5-4-...` 로 분리 수정 (developer 권한 범위, 코드 결함 아님) |
| 6 | scope | JSDoc 재작성이 "주석 정리"라는 항목명 대비 실질적으로 구조를 확장(`## 방어적 유지` 헤딩, blockquote 등 신규 도입, diff +49/-33줄). plan 항목 3에 이미 명시적으로 포함된 결정이라 스코프 이탈은 아님 | `output-shape.ts:111-152` | 없음 (기록 목적) |
| 7 | side_effect / documentation | plan 문서 체크리스트 마지막 항목(`/ai-review` + Critical/Warning 반영)이 아직 미체크 — 본 리뷰가 그 절차 자체이므로 현재 상태는 타당 | `plan/in-progress/output-shape-comment-followups.md` | 본 리뷰 결과 반영 후 체크박스 갱신 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 모든 변경 라인이 JSDoc 블록 안(non-comment diff 0줄 실측). 신규 공격표면·시크릿·DOM sink·인증/암호화 이슈 없음 |
| requirement | NONE | 커밋 메시지·plan·diff 3자 정합 실측 확인, 신규 테스트 손 트레이스로 검증. plan 문서 링크 경로 오류만 INFO |
| scope | NONE | plan 이 정의한 이월 항목 2건(음성 테스트, 주석 정리)과 diff 정확히 1:1 대응, NO-GO 판정 2건은 diff 무흔적 |
| side_effect | NONE | 전역 상태·환경변수·네트워크·공개 API·시그니처 영향 없음. 신규 plan 문서는 규약 준수 산출물 |
| maintainability | LOW | 신규 테스트 주석의 줄번호 하드코딩·mutation 서술 중복(SoT 원칙과 부분 불일치), 파일 내 언어 혼재 잔존 |
| testing | LOW | `output.endReason` fallback 분기 미커버(사전 갭), 신규 테스트 자체는 fixture 격리 정확·mutation 근거 상세 |
| documentation | LOW | 줄번호 pin 의 장기 drift 위험, JSDoc↔테스트 주석 SoT 분리 명문화는 모범적(과거 회귀 재발 구조적 차단) |

## 발견 없는 에이전트

없음 — 실행된 7개 에이전트 모두 최소 INFO 수준 이상 관찰 사항을 보고함(대부분 "문제 없음"의 확인성 INFO 포함).

## 권장 조치사항

1. (선택, 후속 이월) 신규 테스트 주석의 mutation 실측 서술을 plan 문서 단일 SoT 로 위임하고 테스트 주석은 결론 요약만 남기기 — 이번 diff 가 JSDoc 에 세운 "근거는 한 곳에만" 원칙과의 일관성 확보.
2. (선택, 후속 이월) `output.endReason` top-level fallback 분기를 단독 격리하는 fixture 1건 추가 검토 — 사전 존재 커버리지 갭, 병합 차단 사유는 아님.
3. (경미) `plan/in-progress/output-shape-comment-followups.md` 의 `api-convention.md` 인용 링크를 실제 경로(`spec/5-system/2-api-convention.md`)로 수정.
4. 본 리뷰(Critical/Warning 0건, INFO 만 존재) 반영 후 plan 문서 체크리스트의 `/ai-review` 항목 체크 및 통상 종결 절차 진행.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 실행된 7명 전원이 router_safety 표준 화이트리스트로 강제 포함됨(고정 상시 강제 세트). 전원 결과 확보 완료, 누락 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단: 순수 JSDoc/테스트 주석 변경, 실행 성능 영향 경로 없음 |
  | architecture | router 판단: 구조/아키텍처 변경 없음(함수 시그니처·모듈 경계 무변경) |
  | dependency | router 판단: 신규 의존성 추가 없음 |
  | database | router 판단: DB 스키마/쿼리 관련 변경 없음 |
  | concurrency | router 판단: 비동기/동시성 로직 변경 없음 |
  | api_contract | router 판단: 공개 API/인터페이스 무변경 |
  | user_guide_sync | router 판단: 사용자 가시 동작 변경 없음(내부 주석/테스트 전용) |
