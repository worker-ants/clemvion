# Consistency Check 통합 보고서

**BLOCK: NO**

target: `plan/in-progress/spec-draft-integration-error-facts.md` (변경안 ①~④, 통합 계열 spec 사실 정정 4건). 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 success, 전문 확보 및 디스크 영속 확인 완료(누락 없음 — 5개 checker 파일 모두 이미 디스크에 존재).

## 전체 위험도

**MEDIUM** — Critical 없음(`BLOCK: NO`). 다만 convention_compliance 가 지적한 WARNING 3건은 draft 가 "증거 갭 정정"·"과대 서술 정정" 을 표방하는 바로 그 지점에서 같은 성격의 새 갭을 남기거나(①의 `http-credentials.ts` 미등재), gate 감시망을 우회하는 형태(②의 backtick plan 경로)이거나, 정정이 불완전해 자기모순을 남길 수 있어(④의 §5.9 기존 문장 미수정) spec 반영 전에 손보는 편이 안전하다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 자체가 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | frontmatter `code:` 정정(①)이 스스로 드러낸 또 다른 누락(`http-credentials.ts`)을 남김 | 변경안 ① `1-http-request.md` frontmatter `code:` (draft 62~73행) | `spec/conventions/spec-impl-evidence.md` §2.1 (code: = 약속한 surface 의 구현 경로) | `http-redirect.ts` 옆에 `http-credentials.ts`(`resolveHttpCredentials`, §4.1 credential 적용 표의 구현 SoT)도 함께 추가 |
| 2 | convention_compliance | §4 step 8 삽입문이 `plan/in-progress/` 경로를 마크다운 링크가 아닌 backtick 코드로 인용 — `spec-link-integrity.test.ts` 감시망 밖으로 벗어남 | 변경안 ② `1-http-request.md` §4 step 8 끝 문장 (draft 93~96행) | `spec/conventions/spec-impl-evidence.md` §4.2 (`spec-link-integrity.test.ts` 가 plan 링크 staleness 를 강제 검사) | 실제 마크다운 링크로 바꾸거나, 영구 spec 본문에는 트래커 파일명을 직접 박지 않고 "열린 결정" 이라고만 서술 |
| 3 | convention_compliance | §5.9 「정책 동일」 정정(④)이 새 문장만 추가하고 기존 "403 처리 … 동일" 문장은 그대로 두어 자기모순 문장이 남을 수 있음 | 변경안 ④ §5.9 (draft 119~124행) vs `spec/2-navigation/4-integration.md` §5.9 「테스트 방법」 문단 | draft 자신의 Rationale("«정책 동일» 은 결과 코드까지 같다고 약속") 및 `spec/conventions/error-codes.md` §1 정확성 기준 | 변경안 ④에 "기존 «테스트 방법» 문장의 '403 처리 … 동일' 구절을 '401 자동 회복·transport 카운터 제외는 §5.8 정책 동일(403 은 다름 — 아래 참조)' 로 고친다" 는 지시를 명시 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `5-system/3-error-handling.md §1.4` 노드-레벨 표에 Integration 4종 공통 에러 카테고리 행 자체가 없음(사전 존재 갭, draft 스코프 밖) | `spec/5-system/3-error-handling.md` §1.4 | 별도 후속으로 트래커(`spec-draft-nullable-notation-followups.md`)에 포인터만 남김 — 이번 draft 를 막을 사유 아님 |
| 2 | rationale_continuity | `1-http-request.md` 가 "## 8. Rationale" 로 번호를 매겨 `--spec` 번들러가 놓침(다른 문서와 헤딩 불일치) — 검토 인프라 blind spot | `spec/4-nodes/4-integration/1-http-request.md` 헤딩 | 형제 문서처럼 번호 없는 "## Rationale" 로 통일하거나 번들러 정규식을 `^## (?:\d+\.\s*)?Rationale$` 로 확장(별도 트래커 항목) |
| 3 | rationale_continuity | 변경안 ②의 "가드의 고장" 분기는 오늘 코드에서 SSRF 가드가 판정 외 예외를 던지지 않아 현재는 도달 불가능한 방어적 분기 — 표만 보면 "자주 갈리는 두 번째 경로"로 오독될 여지 | 변경안 ② 전체(§89-101 부근) | (선택) "오늘 코드에서 SSRF 가드는 판정 외 예외를 던지지 않으며 이는 방어적 캐치" 한 구 추가 — 없어도 사실 왜곡 아님 |
| 4 | plan_coherence | 리다이렉트 홉의 `HTTP_TRANSPORT_FAILED` 행 문구가 "가드의 고장" 트리거를 명시적으로 담지 않는데 target 이 "이미 덮는다"고 서술 — 코드 경로상 사실은 맞으나 트래커의 열린 통일-결정 항목이 처리할 때 문구 보강도 함께 챙길 필요 | 변경안 ② 마지막 괄호("홉 쪽은 기존 `HTTP_TRANSPORT_FAILED` 행이 이미 덮는다") | 트래커(`spec-draft-nullable-notation-followups.md` 4944행 부근)에 "코드 통일 여부와 별개로 행 문구에 트리거 명시도 함께 처리" 한 구절 추가 — 이번 draft 차단 사유 아님 |
| 5 | plan_coherence | `1-http-request.md` frontmatter `code:` 편입이 별도 진행 중인 `http-safety.ts` 이동 계획(트래커, planner+developer open)과 예정된 재작업으로 다시 부딪힐 수 있음 | 변경안 ① frontmatter `code:` | 조치 불필요 — 이동 항목 실행자가 그 시점에 `http-redirect.ts` 도 재조정 범위에 있음을 인지하면 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 4개 실측 주장(①~④) 전부 코드 라인 단위로 재확인, 모순 없음. INFO 1건(상위 문서 분류표 사전 갭, 스코프 밖) |
| rationale_continuity | LOW | 2차례(1차 CRITICAL→실측표 재작성) Rationale 정합 자체 점검 확인, 이번 재검토에서도 위반 없음. INFO 2건(번들러 blind spot, 방어적 분기 설명 보강 제안) |
| convention_compliance | MEDIUM | error-codes.md 핵심 원칙(신규 코드 금지) 준수하나, draft 가 고친다고 선언한 지점에서 같은 성격의 새 갭 3건(WARNING) — CRITICAL 은 아니나 반영 전 정정 권고 |
| plan_coherence | LOW | 1차 검토 CRITICAL(트래커의 열린 developer 결정 암묵적 선취) 이번 개정에서 해소 확인. 잔여 INFO 2건 모두 비차단 |
| naming_collision | NONE | 신규 식별자 없음 — 인용된 8개 식별자 전부 기존 코드·spec 정의와 의미 일치 확인 |

## 권장 조치사항

1. (WARNING #1) `1-http-request.md` frontmatter `code:` 목록에 `http-redirect.ts` 와 함께 `http-credentials.ts` 도 추가.
2. (WARNING #2) §4 step 8 삽입문의 트래커 경로를 마크다운 링크로 바꾸거나, 영구 spec 본문에서 파일명 직접 인용을 피함.
3. (WARNING #3) 변경안 ④에 `2-navigation/4-integration.md` §5.9 기존 "403 처리 … 동일" 문장을 명시적으로 수정하는 지시를 추가해 자기모순 방지.
4. (INFO, 선택) 위 3건 정정 후 draft 를 `spec/` 에 반영하기 전 최종 `--spec` 재검증 1회 권장(특히 WARNING #2·#3 수정이 다른 절 서술과 어긋나지 않는지).
5. INFO 5건은 모두 비차단이며 즉시 조치 불요 — 각기 지정된 트래커/후속 항목에 포인터만 남기면 충분.
