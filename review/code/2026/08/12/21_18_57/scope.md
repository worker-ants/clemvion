# 변경 범위(Scope) 리뷰

## 검토 대상 (19개 파일, 단일 커밋열)

- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `codebase/backend/test/external-interaction.e2e-spec.ts`
- `plan/complete/spec-draft-eia-idempotency-key-scope.md` (신규, `plan/in-progress/` 에서 이동)
- `plan/in-progress/spec-draft-eia-idempotency-key-scope.md` (삭제)
- `review/code/2026/08/12/21_02_30/{RESOLUTION,SUMMARY,architecture,documentation,maintainability,performance,requirement,scope,security,side_effect,testing}.md`, `meta.json`, `_retry_state.json` (13개, 전부 신규)

의도: Spec EIA §R8 "캐시 키 스코프" — 멱등 캐시 키를 `Idempotency-Key` 헤더 값 단독에서
`<executionId>:<route>:<key>` 로 확장해 cross-execution 캐시 응답 재생을 차단한다. 이번
payload 는 최초 구현(`2e433c001` 등, 이전 `21_02_30` 스코프 라운드가 이미 위험도 NONE 으로
검토) 이후 그 라운드의 WARNING 3건을 반영한 후속 커밋(`31f0bec9b`, `d64d9e873`)과, 그 라운드
자체의 산출물(review/code/2026/08/12/21_02_30/**) 및 plan lifecycle 이동을 더한 것이다.

`git status`/`git diff --stat`으로 실제 워킹트리와 대조해 payload 에 없는 파일이 섞여
있지 않음을 확인했다(이번 세션 자신의 신규 리뷰 산출물 `21_18_57/`·`21_19_08/` 는 검토
대상 diff 밖).

## 발견사항

- **[INFO]** `idempotency.interceptor.spec.ts` — `scopedKey()` 헬퍼의 인자 순서를
  `(rawKey, executionId, route)` 에서 `(executionId, rawKey, route)` 로 재배치 + 호출부 갱신
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 함수 `scopedKey`
  - 상세: 표면적으로는 "불필요한 리팩토링" 처럼 보이지만, `review/code/2026/08/12/21_02_30/RESOLUTION.md` WARNING #1(e2e 헬퍼 `idempotencyCacheKey`와 인자 순서가 반대라 조용히 틀린 키를 단언할 위험)에 대한 직접 조치다. 같은 라운드에서 발견된 결함의 fix 이므로 범위 이탈이 아니다.
  - 제안: 없음 — scope 위반 아님.

- **[INFO]** route 축 테스트에 `redis.set` 키 단언 추가, 모듈 top docstring 에 4번째 describe 색인 추가
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (route 축 `it` 블록, 파일 상단 docstring)
  - 상세: 각각 `21_02_30` RESOLUTION WARNING #2·#3 에 대한 조치. "문서한 보장이 실제 단언보다 넓다"는 지적을 좁힌 것으로, 새 관심사를 끌어들이지 않고 같은 describe 블록 내부만 강화했다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-draft-eia-idempotency-key-scope.md` → `plan/complete/` 이동(frontmatter `status: in-progress` → `complete`, 완료 노트 추가)
  - 위치: `plan/complete/spec-draft-eia-idempotency-key-scope.md`
  - 상세: `.claude/docs/plan-lifecycle.md` 가 규정하는 표준 완료 절차이며 diff 내용도 이번 작업 자체를 설명하는 문서다. 무관한 plan 이동이 섞이지 않았다(이동된 항목은 이 작업 하나뿐).
  - 제안: 없음.

- **[INFO]** `review/code/2026/08/12/21_02_30/**` 13개 파일 신규 추가(RESOLUTION·SUMMARY·9개 reviewer 리포트·meta.json·_retry_state.json)
  - 위치: `review/code/2026/08/12/21_02_30/`
  - 상세: CLAUDE.md 가 "구현 완료 후 `/ai-review` 는 상시 승인된 강제 의무"로 규정하고, 코드 리뷰 산출물 저장 위치를 `review/code/<날짜>/<시각>/` 로 명시한다. `meta.json` 의 대상 파일 목록(`CHANGELOG.md`, 인터셉터 3파일)이 이번 diff 의 핵심 4파일과 정확히 일치해, 이 라운드가 다른 작업이 아니라 바로 이 변경을 검토한 것임을 확인했다. RESOLUTION.md 는 developer 쓰기 권한 범위(`review/**/RESOLUTION.md`) 안이고, 나머지 12개는 review skill 자신의 표준 산출물이라 developer 커밋에 섞여 있어도 워크플로 위반이 아니다.
  - 제안: 없음.

- **[INFO]** 인터셉터의 캐시 스코프를 "요청자(토큰)"가 아니라 "execution + route" 두 축으로 잡은 것 — route 축은 `plan/complete/spec-draft-eia-idempotency-key-scope.md` 본문이 스스로 "리뷰어가 지적한 범위 밖이고 내가 추가한다"고 명시
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 내 `route` 변수 산출부
  - 상세: 엄밀히는 원 지적(요청자 간 캐시 공유) 범위를 넘어선 확장이라 "기능 확장" 체크포인트에 걸릴 수 있으나, (1) 같은 인터셉터·같은 파일 안에서 (2) 같은 취약점 클래스(캐시 네임스페이스 공유)를 한 세그먼트 비용으로 닫는 것이고 (3) plan 문서 Rationale 에 "자매 호출부를 빠뜨려 방어를 한 칸 좁게 잡는" 저장소 반복 실패를 근거로 명시적으로 정당화했다. 이전 `21_02_30` 스코프 라운드도 이 축을 포함해 위험도 NONE 으로 판정했다. over-engineering 이라기보다 동일 취약점의 남은 절반을 닫은 것으로 판단한다.
  - 제안: 없음 — 참고 기록.

CRITICAL/WARNING 수준의 스코프 이탈은 없다. 확인한 항목:

- **무관한 파일 없음**: 코드 변경은 인터셉터 본체·그 unit spec·그 e2e spec 뿐이고, 나머지는 CHANGELOG·plan lifecycle 이동·같은 작업을 검토한 리뷰 산출물이다. 다른 모듈·컨트롤러·spec 문서·설정 파일은 없다.
- **포맷팅/임포트 잡음 없음**: `import type { Request }` → `RequestWithInteraction` 교체 1건은 `req.interaction.executionId` 를 읽기 위한 필수 타입 변경이며, 사용하지 않는 임포트 추가나 정리성 임포트 변경은 없다.
- **설정 변경 없음**: `package.json`/CI 설정 등 변경 없음.

## 요약

이번 diff 는 Spec EIA §R8 "캐시 키 스코프" 구현이라는 단일 목표와, 그 목표를 검토한 직전
리뷰 라운드(`21_02_30`)의 WARNING 3건에 대한 조치, 그리고 표준 plan 완료 절차·리뷰 산출물
커밋으로 구성된다. 새로 발견된 코드(인터셉터 스코프 로직)와 그 부수 수정(테스트 헬퍼 인자
순서, 신규 describe 블록, docstring 색인)은 전부 같은 취약점 하나로 직접 추적되며, 이전
스코프 라운드가 이미 검토한 route 축 확장도 명시적 Rationale 로 정당화돼 있다. 무관한 파일
수정, 불필요한 리팩토링, 요청 밖 기능 추가, 포맷팅/주석 잡음, 사용하지 않는 임포트, 의도치
않은 설정 변경은 발견되지 않았다.

## 위험도

NONE
