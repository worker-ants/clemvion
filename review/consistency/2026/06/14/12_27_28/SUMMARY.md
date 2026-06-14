# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 5건은 merge 전 권장 해소 대상이나 차단 사유 아님.

## 전체 위험도
**LOW** — 구조적 모순 없음. 동일 에러 조건에 두 가지 코드명 공존(`SCOPE_MISMATCH` vs `TOKEN_SCOPE_MISMATCH`)과 202 응답 body 기술 내부 불일치가 조기 정렬을 요하는 주요 항목.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Naming Collision | `SCOPE_MISMATCH`(target §5.1)와 `TOKEN_SCOPE_MISMATCH`(data-flow)가 동일 조건에 다른 코드명으로 공존 — 구현 및 클라이언트 분기 혼선 우려 | `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 (403 행) | `spec/data-flow/15-external-interaction.md` 269행 `TOKEN_SCOPE_MISMATCH` | 하나로 통일. target이 공개 API 정의이므로 `SCOPE_MISMATCH`를 권위로 하고 data-flow를 정정하거나, 반대로 `TOKEN_SCOPE_MISMATCH`로 target 수정. |
| W2 | Convention Compliance | `§5` 서두의 "202 Accepted + body 없음(no-content path)" 설명과 `§5.1` 본문의 `{ "executionId", "accepted", "currentStatus" }` body 기술이 직접 모순 — 구현자가 body 반환 여부 결정 불가 | `spec/5-system/14-external-interaction-api.md` §5 서두 주석 및 §5.1 202 응답 블록 | 동일 문서 내 모순 | (a) body를 반환한다면 §5 서두 "body 없음" 설명 삭제 후 `{ "data": { "executionId", "accepted", "currentStatus" } }` wire format 명시. (b) body 없이 204라면 §5.1 응답 JSON 블록 제거. |
| W3 | Convention Compliance | `MESSAGE_TOO_LONG`에 도메인 prefix 없어 전역 공용 vs EIA-전용 범주 모호. `error-codes.md §1` "도메인 범주화가 의미 있는 코드는 prefix 권장" | `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 (400 행) | `spec/conventions/error-codes.md §1` | (a) `EIA_MESSAGE_TOO_LONG`으로 rename, 또는 (b) `MESSAGE_TOO_LONG`을 전역 공용으로 확정하고 `error-codes.md §1`에 등재. 신규 코드이므로 rename 비용 없음. |
| W4 | Convention Compliance | `§10.1 Swagger` 절에 응답 DTO(`dto/responses/`) 및 공용 래퍼 헬퍼(`ApiAcceptedWrappedResponse` 등) 사용 의무 cross-link 누락 | `spec/5-system/14-external-interaction-api.md` §10.1 | `spec/conventions/swagger.md §5-2·§5-4` | §10.1 끝에 한 줄 추가: `> 응답 DTO 위치·공용 래퍼 헬퍼 패턴은 [Spec Swagger 규약 §5](../conventions/swagger.md#5-응답-dto-규약) 참조.` |
| W5 | Naming Collision | `MESSAGE_TOO_LONG`이 `spec/5-system/3-error-handling.md` 공용 에러 코드 카탈로그에 미등재 — 카탈로그 검색 시 해당 코드 미탐 | `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 | `spec/5-system/3-error-handling.md` 공용 카탈로그 | `3-error-handling.md`에 EIA REST 전용 에러 코드 섹션 추가 또는 `MESSAGE_TOO_LONG` 각주 언급으로 카탈로그 가시성 확보. W3과 연동(rename 시 함께 반영). |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `3-error-handling.md` §1.3 note가 EIA 진입점의 `STATE_MISMATCH`(409)를 미언급 — `INVALID_STATE`(422)만 읽으면 EIA REST도 동일 코드로 오인 가능 | `spec/5-system/3-error-handling.md` §1.3 note 107행 | note에 "단 EIA 외부 진입점은 `STATE_MISMATCH`(409)로 별도 매핑 — [실행 엔진 §7.5.1]/[EIA §5.1]" 보충 권장. target 변경 불필요. |
| I2 | Cross-Spec | `3-error-handling.md`에 EIA 전용 신규 코드(`SCOPE_MISMATCH`/`EXECUTION_NOT_FOUND`/`EXECUTION_TERMINATED`/`TOO_MANY_CONNECTIONS`) 미등재 | `spec/5-system/3-error-handling.md` | `3-error-handling.md`에 "EIA 전용 에러 코드는 [Spec EIA §5.1] 참조" cross-link 추가 권장. |
| I3 | Cross-Spec | EIA §5.2 "WS §4.1·§4.4와 동일" 표현과 notification envelope 미포함 전송 특성 병존으로 동일/비동일 범위 약간 혼재 | `spec/5-system/14-external-interaction-api.md` §5.2 | "이벤트 이름·payload 필드는 WS §4.1·§4.4와 동일하나 notification envelope(`triggerId`·`workflowId`·`timestamp`) 없이 fanout wire 원형 전송"으로 명확화 권장(선택). |
| I4 | Cross-Spec | `config.interaction.triggerToken` 평문 보관 보안 caveat가 data-model 단에 미반영 | `spec/1-data-model.md` §2.8 `config` JSONB | `spec/1-data-model.md` §2.8에 "(per_trigger token은 현재 JSONB 평문 — EIA §7.1 security caveat 참조)" 짧은 주석 추가 권장(선택). |
| I5 | Rationale Continuity | WS → REST 에러 코드 재매핑 패턴(`STATE_MISMATCH`←`INVALID_EXECUTION_STATE`, `MESSAGE_TOO_LONG`←`EXECUTION_MESSAGE_TOO_LONG`)이 Rationale 섹션에 미기록 | `spec/5-system/14-external-interaction-api.md` Rationale | `## Rationale`에 `### R13. WS 에러 코드 → EIA REST 코드 매핑 원칙` 항 추가 권장. 필수 아님. |
| I6 | Convention Compliance | frontmatter `id: external-interaction-api` — basename `14-external-interaction-api`의 숫자 prefix 생략. 규약은 권장이므로 빌드 차단 없음 | frontmatter 1행 | 프로젝트 전반 관행과 일치(다른 spec도 prefix 생략)하므로 변경 불필요. |
| I7 | Convention Compliance | `[Spec API 규칙 §5.3](./2-api-convention.md)` 링크에 anchor 미지정 — 다른 cross-link는 모두 anchor 포함 | `spec/5-system/14-external-interaction-api.md` §5.1 에러 응답 설명 | `[Spec API 규칙 §5.3](./2-api-convention.md#53-에러-응답)`으로 anchor 추가. |
| I8 | Convention Compliance | Overview 내부 소절(`### 1.`·`### 2.`)과 본문 최상위(`## 3.`) 번호 연속성으로 계층 경계 모호 | 문서 구조 전체 | `§` prefix 소절 또는 `## 본문` 구분으로 명확화 권장(선택). 기존 패턴과 일치하므로 강제 변경 불필요. |
| I9 | Naming Collision | `TOKEN_INVALID`/`TOKEN_EXPIRED` — 워크스페이스 JWT 문맥 코드를 interaction token 검증 실패에 재사용. data-flow에는 `TOKEN_REVOKED`·`TOKEN_AUDIENCE_MISMATCH`도 있으나 target §5.1에서 미노출 | `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 | EIA 에러 표에 `TOKEN_REVOKED` 추가 또는 data-flow 세분화 코드와 정렬. |
| I10 | Naming Collision | `EXECUTION_NOT_FOUND` — 워크스페이스 JWT 문맥과 EIA interaction token 문맥에서 동일 코드 재사용. 인증 체계 차이로 의미 경계 모호 | `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 (404 행) | target에 "executionId 없음 또는 토큰 scope에 포함되지 않는 execution"으로 설명 보강. |
| I11 | Plan Coherence | `plan_coherence` checker 출력 파일 미존재 (파일 not found) | `review/consistency/2026/06/14/12_27_28/plan_coherence.md` | 해당 checker 재실행 필요. 현 보고서는 4개 checker 결과 기준. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 구조적 모순 없음. 4건 모두 INFO(누락·문서화 개선 제안) |
| Rationale Continuity | NONE | 기존 Rationale 번복 없음. INFO 1건(WS→REST 매핑 패턴 미기록) |
| Convention Compliance | LOW | WARNING 3건: 202 body 기술 내부 모순(W2), `MESSAGE_TOO_LONG` 도메인 prefix 모호(W3), Swagger 래퍼 cross-link 누락(W4). INFO 3건. |
| Plan Coherence | N/A | 출력 파일 미존재 — 재시도 필요 |
| Naming Collision | LOW | WARNING 2건: `SCOPE_MISMATCH` vs `TOKEN_SCOPE_MISMATCH` 동일 조건 이명(W1), `MESSAGE_TOO_LONG` 카탈로그 미등재(W5). INFO 2건. |

## 권장 조치사항

1. **(W1 — 최우선)** `SCOPE_MISMATCH` vs `TOKEN_SCOPE_MISMATCH` 코드명 통일 — 공개 API 표면인 target(`SCOPE_MISMATCH`)을 권위로 하고 `spec/data-flow/15-external-interaction.md` 269행을 정정한다.
2. **(W2)** `§5.1` 202 응답 body 유무 확정 — body를 반환하는 설계라면 §5 서두 "no-content" 설명 삭제 및 `{ "data": ... }` wire format 명시. body 없다면 §5.1 JSON 블록 제거.
3. **(W3 + W5 연동)** `MESSAGE_TOO_LONG` 도메인 prefix 결정 — `EIA_MESSAGE_TOO_LONG`으로 rename하거나 전역 공용으로 확정 후 `3-error-handling.md` 카탈로그에 등재. 신규 코드이므로 rename 비용 없음.
4. **(W4)** `§10.1` 끝에 Swagger 규약 §5 cross-link 한 줄 추가.
5. **(Plan Coherence 재시도)** `plan_coherence.md` 미생성 — checker 재실행 후 결과 반영.
6. **(I1·I2 선택)** `3-error-handling.md`에 EIA 진입점 매핑 보충 및 EIA 전용 코드 cross-link 추가.
7. **(I5 선택)** EIA spec Rationale에 `R13. WS 에러 코드 → EIA REST 코드 매핑 원칙` 항 추가.