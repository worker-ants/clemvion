# Code Review 통합 보고서

## 전체 위험도
**LOW** — Carousel/blocking 노드 pre-park window intra-row inconsistency 의 read-side 정규화 버그 수정. Critical 발견 없음. SPEC-DRIFT WARNING 2건(spec 갱신 필요), 아키텍처/사이드이펙트 WARNING 2건(in-place mutation 관련). 코드 기능 자체는 올바르게 구현되었다.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md` §1.1 "원자성 보장"이 `pre-park window` intra-row inconsistency 와 `reconcilePreParkWaitingStatus` 보정 전략을 기술하지 않음. 코드가 올바르고 spec이 낡음 | `spec/5-system/4-execution-engine.md` §1.1 | spec §1.1에 "Pre-park read-window 정규화" 항목 추가 (project-planner 위임). 코드는 그대로 유지 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] frontend `isNodeWaitingForInput` 의 "WS snapshot·read-replica 경로에서도 intra-row 도달 가능" 2차 defense-in-depth 전략이 spec에 미기재 | `spec/5-system/4-execution-engine.md` §1.1; `apply-execution-snapshot.ts` JSDoc | spec §1.1에 "frontend `applyExecutionSnapshot`도 동일 봉투 신호를 `isNodeWaitingForInput`으로 2차 방어(defense-in-depth)" 취지 보강 (project-planner 위임) |
| 3 | 아키텍처 | `reconcilePreParkWaitingStatus`(backend)와 `isNodeWaitingForInput`(frontend) 동일 판정 규칙이 두 레이어에 독립 사본으로 존재하며 연결고리가 코드에 명시되지 않음. 한쪽만 변경될 위험 | `executions.service.ts` `reconcilePreParkWaitingStatus` / `apply-execution-snapshot.ts` `isNodeWaitingForInput` | `isNodeWaitingForInput` JSDoc에 "이 조건 변경 시 backend `reconcilePreParkWaitingStatus`도 동일 조건으로 변경 필요" 명시. 또는 spec에 "양측 방어 계층" 전략을 의도적 중복으로 선언 |
| 4 | 사이드이펙트/아키텍처 | `reconcilePreParkWaitingStatus`가 TypeORM 엔티티를 in-place 변이(`ne.status = ...`)하여 `snapshotCache`에 변이된 참조가 저장됨. DB write는 없지만 캐시 오염 가능성 존재 | `executions.service.ts` `reconcilePreParkWaitingStatus` (in-place mutation) | pure function으로 전환(`{ ...ne, status: ... }` 매핑 반환)하거나, 최소한 함수명·JSDoc에 in-place mutation 명시 및 `@param` 태그 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스팅 | `PENDING` 상태 노드의 봉투 신호 채택 경로(backend·frontend 모두)에 테스트 없음 | spec/test | `status: 'pending'` + `outputData.status='waiting_for_input'` 픽스처 추가 |
| 2 | 테스팅 | `isNodeWaitingForInput` 공개 함수에 직접 unit 테스트 없음 | apply-execution-snapshot.test.ts | 직접 import 경계값 케이스 추가 |
| 3 | 테스팅 | `form`/`ai_agent` 노드 타입 intra-row 정규화 테스트 없음 (carousel 픽스처만) | 양측 spec | nodeType 픽스처 또는 "nodeType 무관" 코멘트 |
| 4 | 테스팅 | 복수 nodeExecutions 혼합 케이스 미테스트 | executions.service.spec.ts | 두 노드 픽스처로 선택적 변환 검증 |
| 5 | 테스팅 | 첫 intra-row 케이스(prevStatus=waiting)에서 per-node status 단언 누락 | apply-execution-snapshot.test.ts | nodeStatuses 단언 추가 |
| 6 | 문서화/유지보수 | plan 파일 말미 `</content>`, `</invoke>` XML 아티팩트 잔재 | plan/in-progress/fix-carousel-waiting-status.md | 삭제 |
| 7 | 유지보수 | `reconcilePreParkWaitingStatus` JSDoc 과도한 길이 | executions.service.ts | spec 링크로 압축 |
| 8 | 유지보수 | `'waiting_for_input'` 문자열 하드코딩 | executions.service.ts | enum 값 사용 |
| 9 | 유지보수 | 신규 케이스 `mockReturnValue`(영구) vs 기존 `mockReturnValueOnce` 혼재 | executions.service.spec.ts | mockReturnValueOnce 로 통일 |
| 10 | 아키텍처 | `isNodeWaitingForInput` export 캡슐화 약화 | apply-execution-snapshot.ts | 배럴 제외 또는 공유 유틸 |
| 11 | 요구사항 | `findByWorkflow` list 경로 정규화 미적용 — 의도된 동작 | executions.service.ts | 적절. 기록용 |
| 12 | 보안 | e2e fallback JWT 시크릿 하드코딩 — 테스트 전용 명시 | execution-park-resume.e2e-spec.ts | 운영 유입 없는지 주기 확인 |
| 13 | 범위 | e2e 포맷팅 변경 혼재 — Prettier 자동 조정 | execution-park-resume.e2e-spec.ts | 별도 분리 이상적, 그대로도 무방 |
| 14 | 문서화 | JSDoc `@param`/`@returns` 태그 미포함 | executions.service.ts | 태그 추가 |
| 15 | 문서화 | backend·frontend JSDoc spec 참조 형식 불일치 | 양측 JSDoc | 통일 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. JSONB literal 비교 안전. e2e JWT 시크릿 테스트 전용 |
| architecture | LOW | in-place mutation + snapshotCache 참조 공유(W), 양측 중복 판정 로직(W) |
| requirement | LOW | SPEC-DRIFT W 2건(spec 갱신, 코드 버그 아님) |
| scope | LOW | 7개 파일 범위 내. e2e 포맷팅 + W8 flaky 수정 plan 명시 |
| side_effect | LOW | in-place mutation 후 캐시 저장(W). DB write 없음 |
| maintainability | LOW | 연결고리 미명시(W), 하드코딩, JSDoc 길이, plan XML 잔재 |
| testing | LOW | PENDING 분기·isNodeWaitingForInput 직접·혼합 픽스처 미테스트 |
| documentation | LOW | plan XML 아티팩트. 나머지 스타일 |

---

## 권장 조치사항

1. **(SPEC-DRIFT — project-planner 위임)** spec §1.1 에 pre-park read-window 정규화 + frontend defense-in-depth 전략 추가. 코드 유지.
2. **(WARNING)** `isNodeWaitingForInput` JSDoc 에 backend 동기 변경 필요 명시 (양측 중복 연결고리).
3. **(WARNING)** `reconcilePreParkWaitingStatus` pure function 전환 또는 mutation 명시.
4. **(INFO 즉시)** plan XML 아티팩트 삭제.
5~8. **(INFO)** 테스트 보강(PENDING/직접 unit/혼합), 하드코딩 enum 화, mock 패턴 통일.

---

## 라우터 결정

routing_status=done. 실행 8명(security/architecture/requirement/scope/side_effect/maintainability/testing/documentation, 전원 router_safety 강제 포함). 제외 6명(performance/dependency/database/concurrency/api_contract/user_guide_sync — 라우터 선별 제외).
</content>
