# 변경 범위(Scope) 리뷰

## 발견사항

### 발견사항 없음 (NONE) — 코드 변경

모든 코드 변경(파일 1~13)은 §A.3 호출 이력 기능 구현이라는 단일 의도에 부합한다. 세부 항목별 확인:

**[INFO] `hooks.service.ts` — `clientIp` 지역 변수 추출 위치 이동**
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts`, line 133 및 238
- 상세: 기존 `extractClientIp(input.headers)` 가 인증 검증 콜백 안에서만 호출되던 것을, 인증 검증 + 호출 이력 영속 두 곳에서 공용으로 쓰기 위해 상단으로 끌어올렸다. 추출 로직 자체가 변경된 것이 아니라 호출 위치가 이동한 것이며 §A.3 sourceIp 영속을 위해 필요한 최소 변경이다.
- 제안: 없음. 의도된 변경 범위 내.

**[INFO] `ExecuteOptions` 타입 리터럴 블록 포맷 확장**
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, line 556~766
- 상세: 기존 `| { executedBy?: never; triggerId: string }` 인라인 단일 라인이 `sourceIp?`·`responseCode?` 필드 추가로 멀티라인 객체 리터럴로 변경되었다. 포맷 변경처럼 보이지만 신규 필드 추가에 따른 불가피한 형태 변화다.
- 제안: 없음.

**[INFO] `plan/in-progress/spec-sync-config-gaps.md` — plan 파일 갱신**
- 위치: `plan/in-progress/spec-sync-config-gaps.md`
- 상세: `## 미구현 — 결정 필요 / 후속` 섹션이 `## §A.3 호출 이력 (2026-06-14, impl-config-call-history PR) — 구현 완료` 로 교체되고 기존 미체크 항목들이 체크 완료로 전환되었다. plan 파일 갱신은 개발자 SKILL 에 따라 `plan/**` 쓰기 권한 범위에 속하며 구현 상태를 반영한 정당한 변경이다.
- 제안: 없음.

**[INFO] `review/consistency/2026/06/14/14_33_40/` — consistency-check 산출물 포함**
- 위치: 파일 15~22 (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md)
- 상세: consistency-check --impl-prep 게이트 산출물이 이번 PR 에 포함되어 있다. `CLAUDE.md` 정보 저장 위치 규약("일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")에 따라 이 경로에 커밋하는 것은 정상이다. MEMORY 에도 "review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋"이 명시되어 있다.
- 제안: 없음.

---

### 전체 구조 요약

| 파일 | 변경 성격 | 범위 내 여부 |
|------|-----------|------------|
| V096 migration (소스IP/응답코드 컬럼 + 인덱스) | 신규 기능 — 스키마 | 범위 내 |
| `execution.entity.ts` (sourceIp·responseCode 컬럼) | 신규 기능 — 엔티티 | 범위 내 |
| `execution-engine.service.ts` (ExecuteOptions 타입 + execute() 영속) | 신규 기능 — 서비스 | 범위 내 |
| `execution-engine.service.spec.ts` (sourceIp/responseCode 영속 테스트) | 신규 기능 — 테스트 | 범위 내 |
| `hooks.service.ts` (clientIp 추출 위치 이동 + sourceIp/responseCode execute 전달) | 신규 기능 — 서비스 | 범위 내 |
| `hooks.service.spec.ts` (XFF + chat-channel 소스IP/응답코드 테스트) | 신규 기능 — 테스트 | 범위 내 |
| `auth-configs.service.ts` (getUsage periodCounts + sourceIp/responseCode 반환) | 신규 기능 — 서비스 | 범위 내 |
| `auth-configs.service.spec.ts` (getUsage periodCounts/폴백/orphan 테스트) | 신규 기능 — 테스트 | 범위 내 |
| `auth-config-response.dto.ts` (AuthConfigUsagePeriodCountsDto, 신규 필드) | 신규 기능 — DTO | 범위 내 |
| `authentication/page.tsx` (periodCounts BarChart + sourceIp/responseCode 컬럼) | 신규 기능 — UI | 범위 내 |
| `usage-drawer.test.tsx` (신규 테스트) | 신규 기능 — 테스트 | 범위 내 |
| `i18n/en/authentication.ts` (7개 키 추가) | 신규 기능 — i18n | 범위 내 |
| `i18n/ko/authentication.ts` (7개 키 추가) | 신규 기능 — i18n | 범위 내 |
| `plan/in-progress/spec-sync-config-gaps.md` | plan 상태 갱신 | 범위 내 |
| `review/consistency/2026/06/14/14_33_40/` (8개 파일) | consistency-check 게이트 산출물 | 범위 내 |

의도하지 않은 리팩토링, 기능 확장, 무관 파일 수정, 의미 없는 포맷팅 변경은 발견되지 않았다. `authentication/page.tsx` 의 usage drawer 영역 수정은 plan 메모(`I-11: 본 PR 은 usage drawer 만 수정, create/edit 폼 영역 무변경`)에 명시된 대로 범위가 관리되고 있다. God Component 분리 후속 스코프와의 충돌도 plan 에 기록되어 있다.

## 요약

이번 변경은 spec §A.3 호출 이력 기능(소스 IP·응답 코드 영속 + 기간별 호출 수 집계 + UI 표시)을 구현하는 데 필요한 레이어(DB 마이그레이션, 엔티티, 실행 엔진, 훅 서비스, 사용량 서비스, DTO, 프론트엔드, i18n, 테스트)를 모두 포함하고 있으며, 각 변경이 이 단일 기능 목적에 직결된다. 의도를 벗어난 추가 수정, 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 오염은 전혀 발견되지 않았다. consistency-check 게이트 산출물과 plan 상태 갱신도 프로젝트 규약에 따른 정상적인 산출물이다.

## 위험도

NONE
