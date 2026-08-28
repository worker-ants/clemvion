# Code Review 통합 보고서

## 전체 위험도
**NONE** — 7개 reviewer(forced 전원, 모두 결과 확보됨) 전부 위험도 NONE 판정. 실행 코드 변경은 5개 파일에서 전부 주석뿐(non-comment diff 0줄, 여러 reviewer가 독립적으로 grep 재확인)이며, Critical·Warning 발견사항 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT / TESTING | C2 조건("message·name 밖 민감 속성 없음")을 검증하는 자동 assertion(캐너리)이 없어, `ExpressionError`/`isolated-vm` `SyntaxError`에 향후 민감 속성이 추가돼도 RED가 나지 않음. 기존 갭이며 이미 `plan/in-progress/deps-peer-gating-and-eslint10.md` §2에 INFO로 등재·유예됨(spec-linked 파일 재수정 시 `--impl-done` freshness 재무장 비용 때문). | `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts`, `codebase/backend/src/nodes/data/code/code.handler.spec.ts` | 후속 턴에 `Object.keys(cause)` 화이트리스트 비교 캐너리 추가 검토. plan에 이미 등재돼 추가 등재 불요. |
| 2 | TESTING | `cause` 비노출이 안전하다는 결론이 "저장소 전체에 `.cause` 소비자가 없다"는 전역 부재 사실에 의존하는데, 이를 지키는 회귀 테스트/계측이 `GlobalExceptionFilter`나 공용 직렬화 유틸 어디에도 없음. 기존 갭이며 plan §2 INFO #2로 이미 등재·스코프 밖 유예됨. | `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 | `GlobalExceptionFilter` 표면을 여는 별도 작업에서 "cause를 응답에 노출하지 않는다" 캐너리 추가 검토(스코프 밖). |
| 3 | SECURITY | "저장소 전체에 `.cause` 소비자가 없다"는 기존 서술이 엄밀하게는 과장 — `telegram-client.ts`의 `describeFetchError()`가 이미 `err.cause`를 로그 문자열 조합에 사용 중(단, `expression-resolver`/`code.handler`/`secret-resolver`가 던지는 에러를 소비하지 않고 클라이언트 응답으로도 반환되지 않아 이번 diff의 안전성 결론에는 영향 없음). | `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts:90-107`(diff 밖, 참고용) | 조치 불요. 다음에 이 근거를 재사용할 때 "전역 부재" 대신 "이 세 경로의 cause를 소비하는 곳이 없다"로 문구를 좁혀 쓰는 것을 권장. |
| 4 | MAINTAINABILITY | `spec/5-system/3-error-handling.md` §6.3.1 포인터 보일러플레이트 도입부 문구가 5곳(소스 3 + spec 2)에 반복돼, §6.3.1 재넘버링 시 5곳 모두 수동 동기화가 필요. 이전 라운드에서도 이미 legit한 트레이드오프로 판단됨(요약 인라인화로 인한 drift 재발 방지 목적). | `expression-resolver.service.ts:316`, `code.handler.ts:454`, `secret-resolver.service.ts:89` (+ spec 2곳) | 지금 조치 불필요. 6번째 `cause` 판단 지점 추가 시 `git grep '§6.3.1'` 점검 CI화 고려. |
| 5 | MAINTAINABILITY | `secret-resolver.service.ts`의 `catch` 블록 주석/코드 비율이 이번 diff로 더 높아짐(실질 코드는 2줄, 주석은 약 15줄) — 다만 유일한 "비부착" 사례이자 보안 판단 근거라 정당화됨. 형제 3곳(부착 사례)과 형식 차이(2줄 구조 vs 1줄 "C1 불성립으로 C2 판정 불요")는 직전 라운드 지적을 오히려 해소한 재구성. | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:86-100` | 별도 조치 불필요. `cause` 판단 지점이 더 생기면 클래스 doc-comment로 공통 근거 승격 고려(현재는 과설계). |
| 6 | MAINTAINABILITY | `plan/in-progress/deps-peer-gating-and-eslint10.md`의 자기정정 인용 블록(3중첩, 약 45줄)이 정보 밀도가 높아 시간순 추적에 스크롤 필요. 형식 자체는 CLAUDE.md의 "자기-반증형 소정정" 5조건을 잘 따름(취소선 보존+실측 근거+인접 서술 비침해). | `plan/in-progress/deps-peer-gating-and-eslint10.md:337-399` | 조치 불필요(plan 관례상 정상). `complete/` 이동 시 핵심 결론만 상단 요약으로 뽑아두면 재열람 비용 절감. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 변경 0줄(grep 재확인). `.cause` 전역 부재 서술의 엄밀성 관련 INFO 1건, 이전 WARNING #1 정정 확인. |
| requirement | NONE | 이전 라운드 WARNING(C2 한정어 탈락)이 자매 3곳까지 전수로 정정됨을 확인. spec §6.3.1 fidelity 이상 없음. C2 미검증 캐너리 부재는 기존 갭(INFO). |
| scope | NONE | 25개 파일이 단일 의도(주석 정리 + plan 자기정정 + review 산출물 커밋)로 수렴. 무관 영역 침범·기능 확장·포맷팅 잡음 없음. |
| side_effect | NONE | 5개 실행 파일 non-comment diff 0줄. 상태·전역변수·시그니처·인터페이스·환경변수·네트워크·이벤트 흐름 모두 불변. |
| maintainability | NONE | 실행 로직 변경 없음. WARNING #1을 자매 2곳까지 전수로 고치고 realm 오귀속도 취소선 정정 — 재발 방지 패턴 확인. INFO 4건은 전부 경미. |
| testing | NONE | 대상 spec 2개 실행 133/133 통과, backend 전체 9035/9035(1 skipped) 통과. WARNING #1 fix 확인. C2 캐너리·cause 비노출 계측 부재는 기존 갭(plan 등재). |
| documentation | NONE | spec 인용·타입 shape·plan 이동 이력 전부 실측 대조 일치. 발견사항 없음. |

## 발견 없는 에이전트

documentation, scope, side_effect (신규 발견사항 없음 — documentation은 "발견사항 없음"을 명시했고, scope·side_effect는 INFO도 없이 전 항목 "이상 없음"으로 확인됨)

## 권장 조치사항

1. (선택, 스코프 밖) `GlobalExceptionFilter`나 공용 직렬화 유틸 표면을 여는 별도 작업 시, `cause`가 클라이언트 응답에 노출되지 않는다는 캐너리 테스트 추가 검토 (plan §2 INFO #2, 이미 등재됨).
2. (선택, 스코프 밖) `ExpressionError`/`isolated-vm` `SyntaxError`의 own property가 화이트리스트(`code`/`position`, `message`/`stack`)를 벗어나지 않음을 검증하는 캐너리 추가 검토 (plan §2 INFO #1, 이미 등재됨).
3. (참고) 향후 "저장소에 `.cause` 소비자가 없다"는 근거를 재사용할 때는 "이 세 경로(`expression-resolver`/`code.handler`/`secret-resolver`)의 cause를 소비하는 곳이 없다"로 범위를 좁혀 서술할 것 — `telegram-client.ts`에 무관한 로그 전용 소비자가 이미 존재함.
4. 조치 불요 — 이번 라운드는 이전 WARNING의 fix 검증 라운드였고, 검증 결과 fix가 정확·전수로 반영됐음을 7개 reviewer가 독립적으로 확인함.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 — 실행된 7명 전원이 강제 화이트리스트 대상이며, **전원 결과 확보됨**. 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(주석/문서 전용)와 무관 |
  | architecture | router 판단상 이번 diff와 무관 |
  | dependency | package.json/lockfile 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 대상 변경 없음 |
