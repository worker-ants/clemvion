# 보안(Security) 코드 리뷰

대상 커밋: `a8c9460564df00131fcb39c516d9ee8ca6a3383b` (fix(ai-end-reason): 리뷰 WARNING#1,2,5,6,9,10 정리)

## 대상 파일 요약

| # | 파일 | 변경 성격 |
|---|---|---|
| 1 | `codebase/backend/Dockerfile` | 주석 텍스트만 수정 (패키지 개수 4→5, 실제 COPY 목록은 무변경) |
| 2 | `codebase/frontend/Dockerfile.playwright-e2e` | 주석 텍스트만 수정 (패키지 개수 4→5, 6→7, 실제 COPY 목록은 무변경) |
| 3 | `.../run-results/__tests__/output-shape.test.ts` | 신규 negative-path 테스트 1건 추가 (화이트리스트 거부 경로) |
| 4 | `.../run-results/output-shape.ts` | JSDoc 재배치 + 고아 주석 삭제 — **로직 변경 없음** |
| 5 | `.../conversation/__tests__/interaction-type-registry.test.ts` | 신규 테스트 파일 (상수 값 단언) |
| 6 | `codebase/packages/ai-end-reason/README.md` | 문서(빌드/사용법) 섹션 추가 |
| 7 | `plan/in-progress/is-conversation-output-restructure.md` | plan 문서 각주 정정 (실행 이력 기록) |

7개 파일 중 실제 런타임 코드가 담긴 파일은 `output-shape.ts` 하나뿐이며, 그 diff 조차 JSDoc 블록을 24줄 아래(함수 선언부 바로 위)로 옮기고 이관 잔재 주석을 삭제한 것뿐으로 **함수 바디·조건문·타입 가드는 1바이트도 변경되지 않았다** (`unwrapNodeOutput`, `isConversationOutput`, `CONVERSATION_END_REASONS.has(...)` 등 모두 diff 컨텍스트 라인으로만 등장). 나머지는 Dockerfile 주석 오탈자 정정, 테스트 추가, README/plan 문서 갱신으로 전부 비실행 경로다.

## 발견사항

- **[INFO]** 신규 negative-path 테스트는 방어적 검증을 강화 (보안 결함 아님, 정보성)
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:346-365` (동형 assertion 추가: `interaction-type-registry.test.ts:1-23`)
  - 상세: `isConversationOutput` 이 화이트리스트(`CONVERSATION_END_REASONS`) 밖의 `endReason`("bogus_value")을 대화 종결로 오인하지 않는지 검증하는 테스트가 신설됐다. 기존 테스트는 화이트리스트 안 값에 대한 positive-only 검증이라 화이트리스트의 거부(reject) 경로 자체가 무검증이었던 사각지대였다. 다만 `isConversationOutput`/`unwrapNodeOutput`은 인증 경계나 신뢰 경계를 넘는 함수가 아니라 — 이미 인증된 세션이 조회하는 워크플로 실행 결과(backend 가 생산한 output)를 "대화 미리보기 탭을 보여줄지" 판단하는 **UI 렌더링 게이팅 로직**이다. 화이트리스트 판정이 틀려도 정보 노출/권한 상승으로 이어지지 않고 탭 표시 여부(UX)만 바뀐다. 즉 이번 추가는 신뢰 경계 보강이 아니라 회귀 방지용 테스트 커버리지 개선이다.
  - 제안: 조치 불필요. 현행 유지 권장.

- **[INFO]** Dockerfile 변경은 주석(문서) 텍스트 정정뿐, 실제 빌드 지시문 무변경
  - 위치: `codebase/backend/Dockerfile:72`, `codebase/frontend/Dockerfile.playwright-e2e:219-222`
  - 상세: diff 는 "backend closure (= @workflow 4개)만" → "5개)만" (frontend e2e 는 "4개"→"5개", "6개"→"7개") 로 개수 서술만 고친 것이고, 그 위·아래에 실제로 존재하는 `COPY` 라인 목록(`codebase/packages/ai-end-reason`, `expression-engine`, `node-summary`, `chat-channel-validation`, `graph-warning-rules`)은 이 diff 이전부터 이미 정확했다(주석만 stale 이었다는 커밋 메시지와 일치, 전체 파일 컨텍스트로 교차 확인). 두 Dockerfile 모두 여전히 `--frozen-lockfile` 로 설치하고, 프로덕션 러너 스테이지는 `USER node`(non-root)·`NODE_ENV=production`·멀티스테이지 분리(devDependencies 미포함)를 유지한다 — 이 diff 로 인한 공급망/이미지 표면적 변화 없음.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 7개 파일 전체
  - 상세: diff·전체 파일 컨텍스트를 통틀어 API 키·비밀번호·토큰·인증서·연결 문자열 패턴이 발견되지 않았다. 테스트 픽스처의 문자열(`"bogus_value"`, `"m"`, 문서명 등)은 시크릿이 아닌 임의 테스트 데이터다.
  - 제안: 조치 불필요.

## 항목별 점검 결과

| 점검 관점 | 결과 |
|---|---|
| 인젝션 취약점 (SQL/XSS/커맨드/LDAP/경로탐색) | 해당 없음 — 실행 코드 변경 없음(JSDoc 이동 제외), 사용자 입력을 새로 파싱/렌더링하는 경로 미도입 |
| 하드코딩된 시크릿 | 없음 |
| 인증/인가 | 해당 없음 — 인증/인가 코드 미접촉. `isConversationOutput` 은 신뢰 경계가 아닌 UI 렌더링 게이트 |
| 입력 검증 | 기존 타입 가드(`typeof`, `Array.isArray`, `in` 연산자) 무변경, 오히려 화이트리스트 거부 경로 테스트가 신설되어 커버리지 개선 |
| OWASP Top 10 | 해당 사항 없음 |
| 암호화 | 해당 없음 — 암호화/해시 코드 미접촉 |
| 에러 처리 | 해당 없음 — 에러 처리 코드 미접촉, 민감정보 노출 경로 없음 |
| 의존성 보안 | package.json/lockfile 변경 없음. Dockerfile 의 base 이미지 태그(`node:24-alpine`, `mcr.microsoft.com/playwright:v1.61.0-jammy`)·COPY 목록 모두 이 diff 이전과 동일 |

## 요약

이번 변경은 이전 PR(#961) 리뷰 WARNING 6건을 정리하는 후속 커밋으로, 실질적으로는 (1) Dockerfile 주석의 패키지 개수 오탈자 정정 2건, (2) `output-shape.ts` 의 JSDoc 재배치(로직 무변경), (3) 화이트리스트 거부 경로를 검증하는 신규 테스트 2건, (4) README/plan 문서 갱신으로 구성된다. 신뢰 경계·입력 검증 로직·인증/인가·암호화·에러 처리·의존성 목록 중 어느 것도 실질적으로 변경되지 않았고, 시크릿 하드코딩이나 새로운 공격 표면도 발견되지 않았다. 유일하게 동작에 영향을 줄 수 있는 파일(`output-shape.ts`)조차 diff 는 주석 이동뿐이며, 신설된 테스트는 오히려 기존 화이트리스트 로직의 거부 경로 커버리지를 보강해 방어적 견고성을 소폭 개선한다.

## 위험도

NONE
