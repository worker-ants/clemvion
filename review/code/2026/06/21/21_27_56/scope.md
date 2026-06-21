# 변경 범위(Scope) 리뷰 결과

## 발견사항

발견된 범위 일탈 항목 없음.

각 파일에 대한 범위 적합성 확인:

**파일1 (`V101__add_user_email_lower_index.sql`)**: 단일 `CREATE INDEX IF NOT EXISTS` 문과 설명 주석만 포함. 인덱스 추가라는 작업 목적에 정확히 일치. 불필요한 테이블 변경·트리거·기타 DDL 없음.

**파일2 (`users-email-change.e2e-spec.ts`)**: 기존 e2e 파일에 3개 케이스 추가(resend 성공, resend-without-pending, verify-race-condition). plan/complete/impl-email-change.md 체크리스트에서 resend 엔드포인트와 선점 시나리오가 명시 기능임을 확인. 기존 테스트 수정 없이 순수 추가만. 범위 내.

**파일3 (`verify-email-change.test.tsx`)**: 신규 파일. `/profile/change-email/verify` 랜딩 페이지의 unit 테스트. 3개 케이스(성공·실패·토큰없음)만 커버. 관련 없는 컴포넌트 테스트 없음. 범위 내.

**파일4 (`profile-info-card.test.tsx`)**: `renderCard` 타입에 `pendingEmail` 파라미터 추가 및 3개 테스트 케이스 추가(CTA 링크, pending 없음, pending 있음). spec §3.4 및 plan에서 `pendingEmail`, CTA, pending 표시가 명시 요구사항임을 확인. 기존 6개 케이스는 수정 없이 보존. 범위 내.

**파일5~7 (`plan/complete/*.md`)**: plan/complete 폴더로 이관되는 문서들. CLAUDE.md plan 라이프사이클 규칙에 따른 정상 이동. 내용은 해당 작업의 배경·체크리스트·설계 메모로만 구성됨. 범위 내.

**파일8 (`spec/data-flow/2-auth.md`)**: 두 곳 변경 — `§1.7.1` 이메일 변경 흐름 섹션 신설 및 `§2.1` Schema 매핑 표에 이메일 변경 행 추가. `plan/complete/email-change-followup-email-lower-index.md`의 `spec_impact: spec/data-flow/2-auth.md` 명시로 의도된 변경임이 확인됨. V101 인덱스를 Schema 매핑 표에 반영하는 것은 data-flow 문서의 SoT 역할에 부합. 기존 섹션 수정 없이 순수 추가만. 범위 내.

## 요약

이번 `email-change-followup` PR의 8개 파일 모두 작업 의도(V101 LOWER() 표현식 인덱스 추가 + ai-review W1 후속 누락 테스트 보강)에 직결된다. 불필요한 리팩토링, 무관 파일 수정, 포맷팅 잡음, 설정 파일 변경이 일절 없다. spec/data-flow/2-auth.md 수정은 plan frontmatter에서 `spec_impact`로 사전 선언된 의도된 변경이다. 기존 코드 영역을 건드리지 않고 순수 추가로만 구성되어 있어 변경 범위가 명확히 통제되어 있다.

## 위험도

NONE
