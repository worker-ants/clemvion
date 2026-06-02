# RESOLUTION — §2 OAuth invalid_scope 콜백 분기

SUMMARY: `review/code/2026/06/02/09_25_59/SUMMARY.md` (위험도 LOW, Critical 0 / Warning 9 / Info 13).
수동 처리.

## 조치 항목

| SUMMARY # | 분류 | 조치 | commit |
|---|---|---|---|
| WARNING 2 | 아키텍처 (state 소비 이중화) | `consumeOAuthState(state)` private 메서드로 DELETE…RETURNING+normalize 추출 → handleCallback main 경로와 rejectCafe24InvalidScope 가 공유. 소비 경로 단일화 | 본 커밋 |
| WARNING 5 | 유지보수성 (공유 err 인스턴스 조건부 throw) | `rejectCafe24InvalidScope` 를 `invalidScope()` 팩토리 + 가드 단일화로 재작성 (조기 throw 명확) | 본 커밋 |
| WARNING 3 | 테스트 갭 | `integrationId=null` (new mode) invalid_scope → save 미호출·context 없는 throw 케이스 추가 | 본 커밋 |
| WARNING 4 | 테스트 갭 | `connected` + restricted 아닌 scope → statusReason 기록·details 생략 케이스 추가 | 본 커밋 |
| WARNING 6 | 테스트 (타입 중복) | describe 상단 `type SavedIntegration` 선언 + 신규 케이스에서 재사용 | 본 커밋 |
| WARNING 8 | 테스트 픽스처 | `makeStateRow` 의 `mode='new'`+`integrationId` 조합이 cafe24 Private 초기 install 의 실제 형태임을 주석 명시 | 본 커밋 |
| WARNING 9 | 유저 가이드 | `cafe24.mdx`/`cafe24.en.mdx` invalid_scope FAQ 에 "별도 승인 필요 권한" 항목 추가 (ko/en parity, 상세 페이지 Scope & Permissions 탭 안내) | 본 커밋 |
| INFO 2 | 보안 (방어 코드) | `rejectCafe24InvalidScope` 에 `record.provider !== 'cafe24'` 가드 추가 — 다른 흐름 state 오소비 방지 | 본 커밋 |
| WARNING 7 / INFO 13 | 문서 (plan 체크리스트) | plan step 8/9/10 + 구현 체크박스 갱신 | 본 커밋 |

## 보류·후속 항목 (근거)

| SUMMARY # | 판단 | 근거 |
|---|---|---|
| WARNING 1 (CallbackContext Cafe24 특화 필드) | 보류 | `requiresCafe24Approval?` 는 **typed optional** 로 현재 단일 cafe24 소비처에 명확. generic `extra?: Record<string,unknown>` 슬롯은 타입 안전성을 잃고, 아직 multi-provider extra 패턴이 코드베이스에 없다 — 두 번째 provider 가 동일 요구를 가질 때 일괄 추상화하는 게 비용 대비 합리적. design-preference 로 보류 |
| INFO 1 (state 길이/형식 검증) | 후속 분리 | 기존 OAuth 콜백 전반의 패턴 (본 PR 이 신규 도입한 위험 아님). state 검증 강화는 콜백 전체에 적용할 별 보안 PR |
| INFO 3 (logger.warn DB 메시지) | 후속 분리 | `markIntegrationCallbackError` 의 기존 라인 (본 PR 미변경). DB 에러 클래스 구별은 별 cleanup |
| INFO 4·5·6·7 (아키텍처 OCP/타입 export/공유 타입/컴포넌트 추출) | 보류 | 중기 리팩토링 권고 — 기능·정확성 영향 없음. provider error-callback 훅·공유 DTO 타입은 별 아키텍처 작업 |
| INFO 10 (frontend scope-tab 단위 테스트) | 보류 | scope-tab 에 기존 컴포넌트 테스트 하네스 없음. `readRequiresApproval` 단위 테스트 신설은 별 frontend 테스트 작업. e2e(140) 가 통합 경로는 커버 |
| INFO 12 (restricted 교집합 없는 invalid_scope UI) | project-planner 위임 | spec 미명시 회색지대 — UI 안내 여부는 기획 결정. 현재는 details 비면 섹션 미렌더(안전) |
| 잔여 INFO (8·9·11 등) | 미조치 | JSDoc/주석 cosmetic·defence-in-depth 확인. 기능 영향 없음 |

## TEST 결과

- lint: 통과 (eslint --fix 가 매번 무관 6개 기존 파일 자동 수정 → revert)
- unit: 통과 (backend invalid_scope 7 케이스 포함)
- build: 통과 (backend+frontend + docker, .mdx content collection 포함)
- e2e: 통과 (140)

## 비고

- §10.4 spec 은 본 구현 이전에 이미 명세됨 (코드 wiring). 새 에러코드 미추가 (status_reason + details).
- consistency-check --impl-prep WARNING #4·5·6 (trigger-list R-2 폐기 주석 / execution-history·dashboard·auth-flow code: frontmatter) 는 §2 무관 타 spec 이슈 → 별도 처리 권고 (SUMMARY 기재).
