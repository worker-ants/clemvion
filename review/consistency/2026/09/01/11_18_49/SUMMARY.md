# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 target(`plan/in-progress/spec-draft-avatar-storage-key.md`)에 대해 Critical 위배를 보고하지 않았다.

## 전체 위험도
**MEDIUM** — Critical 없음. 다만 Rationale Continuity checker 가 MEDIUM 등급 WARNING 2건(보안 경계 서술 — "DB 권한 검증으로 격리" vs "Avatar 는 격리 대상 아님" — 이 두 자매 문서에서 불일치할 위험)을 보고했고, Plan Coherence checker 도 위임 트래커 종결 시 lifecycle 가드가 요구하는 항목 누락을 WARNING 으로 보고해 반영 권장.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `data-flow/4-file-storage.md` Rationale "이유" 문단이 Avatar 예외를 반영 못 함 — 편집 후에도 "prefix 없는 키는 DB 권한 검증으로 격리된다"고 일반화해서 읽혀, 같은 draft 가 `0-overview.md` §B 에 새로 적는 "Avatar 는 격리 대상이 아니다"(공개 읽기가 제품 결정) invariant 와 정면 모순 | target §C (`C-5`/`C-6`), `spec/data-flow/4-file-storage.md` §Rationale "S3 key 패턴: workspace prefix 를 두지 않는 이유" 문단 (앵커 `:128`, 블록쿼트 `:129-131` 바로 위) | `spec/0-overview.md` §B 신규 Rationale ("Avatar 는 격리 대상 아님 — 공개 읽기가 제품 결정") | §C 에 항목 추가: 이 문단을 KB(=DB 권한 검증으로 대체 보장)/Avatar(=애초 격리 대상 아님, `0-overview.md` Rationale 링크로 위임)로 명시적으로 갈라 고친다 |
| 2 | Rationale Continuity | `data-flow/0-overview.md :273`(§H) 편집 지시가 "주어만 넓히라"고만 하고 diff 예시가 없어, 그대로 실행되면 괄호 안 KB 전용 근거("DB 권한 검증으로 보장 — prefix scan 비용·키 길이 절감")가 Avatar 에도 잘못 전이될 위험 | target §H, `spec/data-flow/0-overview.md :273` (`## Rationale` → "KB 원본 문서 S3 key 구조") | `spec/0-overview.md` §B 가 갈라놓은 "KB=비용 근거 / Avatar=소유 모델 근거" 축 분리 | §H 본문에 실제 diff 예시 명시: 주어를 "KB 원본 키와 Avatar 키가"로 바꾸고 KB 전용 근거 괄호는 삭제, `0-overview.md` Rationale 링크로 위임 |
| 3 | Plan Coherence | 위임 트래커(`spec-update-avatar-upload-implemented.md`) "같은 턴 종결" 체크리스트가 `plan-lifecycle.md §5` 이동 자가점검 3항목(spec_impact 선언·status 종결화·인입 상대링크 정정)을 빠뜨림 | target §D-4 체크리스트 (현재 3항목만: 본문 체크박스·`complete/` 이동·"세 문서→6개 문서" 정정) | `.claude/docs/plan-lifecycle.md §5`, `spec-update-avatar-upload-implemented.md` frontmatter(`spec_impact` 없음, `status: in-progress`), `spec-sync-user-profile-gaps.md:79` 인입 링크 | §D-4 에 3항목 추가: (1) frontmatter `spec_impact:` 로 갱신 6개 spec 경로 나열 (2) `status:` 를 종결 값으로 갱신 (3) `spec-sync-user-profile-gaps.md:79` 상대링크를 `../complete/spec-update-avatar-upload-implemented.md` 로 정정 |
| 4 | Naming Collision | 신규 config 키 `s3.publicBaseUrl`/`S3_PUBLIC_BASE_URL` 이 이 저장소가 회귀 테스트로 명시 경고해 둔 미등록·금지 키 `app.publicBaseUrl`/bare `publicBaseUrl` 과 접미사가 동일 — 런타임 충돌은 아니나 검색 기반 혼동 소지 | target §C-4, `spec/data-flow/4-file-storage.md §2.3` 신설 행 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:1382-1390,1507-1511` (webhook `callbackUrl` 조립 시 `app.publicBaseUrl`/bare `publicBaseUrl` 사용 금지 회귀 테스트) | §C-4 신설 행 또는 인접 note 에 "webhook base URL(`app.publicBaseUrl`, 금지된 키)과는 별개" 근접 명명 각주 추가 — 이 저장소의 기존 `PASSWORD_INVALID`/`INVALID_PASSWORD` 류 각주 관례와 일치 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `PAYLOAD_TOO_LARGE` 카탈로그가 파일 업로드 multer 레벨 413(엔드포인트별 상이 임계값)을 포괄 못함 — draft 이전부터 있던 pre-existing gap, draft §G 가 "50MB/2MB" 표를 명시하며 더 뚜렷해짐 | `spec/5-system/3-error-handling.md` §1.3 (`:77`) vs `spec/5-system/2-api-convention.md` §9 | §F 에서 `PAYLOAD_TOO_LARGE` 행에 "파일 업로드 엔드포인트는 body-parser 전역 한도와 별개로 `limits.fileSize` 적용(§9 참조)" 한 문장 추가, 또는 후속 plan 으로 이관 |
| 2 | Convention Compliance | §D-2 413 조건에 error `code`(`PAYLOAD_TOO_LARGE`) 미기재 — 같은 항목 내 400 두 케이스는 code 명시하는데 413 만 생략해 비대칭 | target §D-2, `spec/2-navigation/9-user-profile.md:334` | 가능하면 `PAYLOAD_TOO_LARGE` 명시해 인접 셀과 형식 통일, 런타임 미실측이면 "코드 미확인" 명시 |
| 3 | Convention Compliance | 변경안 절 레터링이 본문 순서와 어긋남(A,B,C,D,**G,H**,**E,F**) — spec 본문에는 안 남지만 §D-4 대응표 작성 시 혼동 소지 | target `## 변경안` 구조 전체 | 위임 트래커 대조표 작성 시 실제 파일 순서 그대로 쓰거나, 커밋 전 E~H 를 알파벳 순 재배치 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 6개 대상 문서·실제 코드·마이그레이션·MinIO 버킷 정책·기존 tracker 전수 대조, CRITICAL/WARNING 급 충돌 없음. INFO 1건(413 카탈로그 pre-existing gap) |
| Rationale Continuity | MEDIUM | `0-overview.md` §B 는 원칙 준수(대안 재도입 없음, 근거 분리 명시)하나 같은 편집 패턴이 자매 문서 2곳(`4-file-storage.md` Rationale 문단, `0-overview.md:273` 편집 지시)에 미적용 — 보안 경계 서술 상호 모순 위험 |
| Convention Compliance | LOW | 명명·문서 구조·출력 포맷 규약 광범위 준수. INFO 2건(413 code 표기 비대칭, 절 레터링 순서) |
| Plan Coherence | LOW | 6개 spec 변경 자체는 다른 in-progress plan 과 충돌 없음. WARNING 1건(트래커 종결 체크리스트에 lifecycle §5 3항목 누락 — 동일 클래스 실패가 저장소에 실재) |
| Naming Collision | LOW | 신규 식별자 대부분 기존 구현 코드 반영이라 spec 내 충돌 없음. WARNING 1건(`s3.publicBaseUrl` 이 금지 키 `app.publicBaseUrl` 과 접미사 동일 — 근접 명명 주의 각주 권장) |

## 권장 조치사항
1. (필수 아님, 권장) target §C 에 `data-flow/4-file-storage.md` Rationale 문단 정정 항목 추가 — KB/Avatar 근거를 명시적으로 분리해 "Avatar 는 격리 대상 아님" invariant 와 자매 문서가 모순되지 않도록 한다 (WARNING #1).
2. (필수 아님, 권장) target §H 편집 지시에 실제 diff 예시 추가 — KB 전용 근거 괄호가 Avatar 에 잘못 전이되지 않도록 명시 (WARNING #2).
3. (필수 아님, 권장) target §D-4 체크리스트에 `spec_impact` 선언·`status` 종결화·`spec-sync-user-profile-gaps.md:79` 인입 링크 정정 3항목 추가 — lifecycle 가드가 이동 시점에 요구하는 항목이므로 사전에 반영해 두면 재작업을 피한다 (WARNING #3).
4. (선택) `s3.publicBaseUrl` 신설 행에 `app.publicBaseUrl`(금지 키)과 별개라는 근접 명명 각주 추가 (WARNING #4).
5. (선택) INFO 3건은 draft 를 막을 이유가 아니므로 이번 턴 또는 후속 plan 중 편한 시점에 반영.