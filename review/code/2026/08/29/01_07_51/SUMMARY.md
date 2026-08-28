# Code Review 통합 보고서

## 전체 위험도
**LOW** — 6개 파일 전부 주석/문서 전용 diff(실행 코드 변경 없음)이며, 유일한 실질 지적은 `cause` 안전성 근거 주석 한 곳(`expression-resolver.service.spec.ts:142`)이 형제 파일·실제 `ExpressionError` shape 과 어긋난 것. 강제(forced) whitelist 7개 reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원이 실행되어 결과를 확보했고 누락 없음 — "forced 인데 결과 없음" 케이스 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | C2("message·name 밖 속성이 없다") 서술이 형제 구현 파일과 어긋나고 `ExpressionError` 실제 shape 과도 안 맞는다. `spec/5-system/3-error-handling.md` §6.3.1 의 C2 원문은 "message·name 밖 **민감** 정보를 속성으로 갖지 않는다"인데, `expression-resolver.service.spec.ts:142` 는 한정어 없이 "속성이 없다"로 과잉 일반화했다. 실측: `ExpressionError`(`codebase/packages/expression-engine/src/errors.ts:14-24`)는 `message`/`name` 외에 `code: ErrorCode`, `position?: number` 를 own property 로 갖는다 — 문자 그대로는 거짓. 형제 파일 `expression-resolver.service.ts:318` 은 "민감 속성이 붙지 않는다"로 정확히 적혀 있어 이 파일만 어긋난다. `code`/`position` 이 enum·오프셋 정수라 실질 위험(=cause 부착 안전성 결론)은 유효하지만, 이 PR 의 목적 자체(요약이 정본과 갈리는 문제를 고치는 것)를 정확히 재발시킨 사례다. | `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:142` (cf. 정확한 버전: `expression-resolver.service.ts:318`) | `spec.ts:142` 를 ts 파일과 동일하게 "민감 속성이 붙지 않는다"로 정정(한 단어 추가). spec 문서(§6.3.1)는 이미 정확하므로 수정 대상 아님. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing / requirement | C2 기준("message·name 밖 민감 속성 없음")이 자동 assertion 으로 강제되지 않는다 — 현재 테스트는 C1(message 가 원본 포함)만 검증(`thrown instanceof Error`, `cause instanceof Error`, `message.toContain`). 향후 `ExpressionError`/isolated-vm 컴파일 예외에 민감 속성이 추가돼도 RED 가 나지 않는다. 오늘 시점은 `code`/`position` 이 비민감이라 위험 없음. | `expression-resolver.service.spec.ts:144-159`, `code.handler.spec.ts:204-226` | `cause` 의 own enumerable keys 가 `code`/`position`(비민감) 외에 없음을 단언하는 캐너리 테스트 추가 검토(선택). |
| 2 | security | `cause` 부착 안전성이 "저장소 내 아무도 `.cause` 를 읽지 않는다"는 전역 부재(negative) 불변식에 의존한다. 오늘은 grep 으로 소비자 부재를 확인했으나, 향후 APM/구조적 로깅 목적으로 `Error` 를 own-property 포함 직렬화하는 유틸이 추가되면 `cause` 안의 원본 에러가 함께 노출될 수 있다. | `expression-resolver.service.ts:320` 부근, `code.handler.ts:458` 부근 | (스코프 밖, 선택) `GlobalExceptionFilter`/공용 에러 직렬화 유틸에 "cause 를 클라이언트 응답에 노출하지 않는다" 회귀 테스트를 한 곳에 추가해 이 불변식을 계측 가능하게 고정. |
| 3 | maintainability | "정본(§6.3.1) 포인터 + 로컬 근거"라는 동일 보일러플레이트 패턴이 5곳(소스 3 + spec 2)에 반복돼, `§6.3.1` 이 재넘버링되면 5곳 모두 수동으로 찾아 고쳐야 한다. 이번 PR 자체가 요약 drift 재발 방지 목적이라 트레이드오프로는 legit. | `expression-resolver.service.ts:316`, `code.handler.ts:454`, `secret-resolver.service.ts:89` (+ 대응 spec 2곳) | 지금 규모(5곳)에서는 조치 불필요. 더 늘어나면 `git grep '§6.3.1'` CI 점검 또는 참조 위치를 plan/consistency 문서에 등재. |
| 4 | documentation | `secret-resolver.service.ts` 의 비부착 사유 주석이 C1 미충족만 명시하고, 형제 3곳처럼 "C1 — … C2 — …" 2줄 구조를 따르지 않는다. 논리적으로는 옳다(AND 조건에서 C1 이 거짓이면 C2 불요)지만 형식이 유일하게 다르다. | `secret-resolver.service.ts:89-92` | (선택) "C1 이 거짓이므로 C2 는 판정 불요" 한 줄을 덧붙여 형제 3곳과 형식 통일. |
| 5 | security | `secret-resolver.service.ts` 의 `cause` 비부착 판단은 근거가 정확함을 확인(crypto 에러 상세 비노출 의도, 위쪽 `logger.error` 도 plaintext/원본 상세 미기록, `#814` SSRF 메시지 일반화 선례와 정합) — 별도 조치 불요, 확인 기록 차원. | `secret-resolver.service.ts:100` | 없음. |
| 6 | maintainability | `code.handler.ts` 소스 주석이 테스트 파일의 assertion 형태 차이(cross-realm `SyntaxError` → `toBeDefined` vs `toBeInstanceOf(Error)`)까지 함께 설명 — 이례적이지만 `code.handler.spec.ts` 에도 대칭 설명이 있어 상호 참조 형태이며 리스크 없음. | `code.handler.ts:454-457` | 없음(현행 유지 가능). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `cause` 소비자 부재를 grep 으로 직접 검증, 클라이언트 노출 경로 없음 확인. C2 안전성 근거 문구가 `ExpressionError` 의 `code`/`position` 부가 속성을 "없다"고 과장 서술(비민감이라 실질 위험은 없음). |
| requirement | LOW | C2 서술이 spec.ts:142 에서 형제 파일·spec §6.3.1 원문보다 넓게(한정어 탈락) 과잉 일반화됨 — WARNING 1건. C2 미검증(테스트로 강제 안 됨)은 INFO. |
| scope | NONE | 6개 파일 전부 단일 의도(주석을 정본 §6.3.1 참조로 정리)에 수렴, 범위 이탈 없음. |
| side_effect | NONE | 실행 코드(로직·시그니처·throw 인자·조건)는 diff 전후 바이트 단위로 동일 — 상태/전역/파일시스템/네트워크/이벤트 부작용 없음. |
| maintainability | NONE | 코드 로직 변경 없음. §6.3.1 포인터 보일러플레이트가 5곳 반복(관리 가능한 수준), plan 문서 자기정정 패턴 양호. |
| testing | NONE | 실행 코드 라인 동일 확인, 기존 회귀 테스트 전부 유효. C2 미검증은 기존부터 있던 갭(이번 diff 가 악화시키지 않음). |
| documentation | NONE | spec §6.3.1 인용·PR/plan 이력을 저장소에서 직접 대조해 전부 일치. 스타일 일관성 INFO 1건. |

## 발견 없는 에이전트

scope, side_effect — 실질 지적 사항 없이 diff 가 단일 의도(주석 정리)에 정확히 수렴하고 부작용이 없음을 확인.

## 권장 조치사항

1. `expression-resolver.service.spec.ts:142` 의 C2 서술을 "민감 속성이 붙지 않는다"로 정정 (형제 파일 `expression-resolver.service.ts:318` 과 동일하게, 한 단어 추가) — WARNING 유일 항목.
2. (선택) C2 를 회귀 테스트로도 고정 — `cause`(`ExpressionError`) 의 own enumerable keys 가 `code`/`position` 외에 없음을 단언하는 캐너리 추가.
3. (선택) `secret-resolver.service.ts:89-92` 에 "C1 이 거짓이므로 C2 는 판정 불요" 한 줄을 추가해 형제 3곳과 주석 구조 통일.
4. (스코프 밖, 장기) `GlobalExceptionFilter`/공용 에러 직렬화 유틸에 "cause 를 클라이언트 응답에 노출하지 않는다" 회귀 테스트를 추가해 "아무도 cause 를 안 읽는다"는 전역 불변식을 계측 가능하게 만드는 것을 검토.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — router 를 거치지 않고 강제(forced/router_safety) whitelist 7개 reviewer(security, requirement, scope, side_effect, maintainability, testing, documentation) 전체를 실행. 전원 결과 확보됨(누락 0건).
