# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**HIGH** — `spec/5-system/2-api-convention.md §9`(스코프 밖 파일)가 target 이 확정하는 새 사실(아바타 업로드 엔드포인트 실재)과 정면 모순하는 배타적 서술을 그대로 유지하고 있어 target 적용 시 spec/ 내부에 새 자기모순이 생긴다. 근본 원인은 명확하고 수정 범위도 좁아(§G 신설 1건) HIGH 로 판단하며 CRITICAL(시스템 전반 붕괴) 로는 보지 않는다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/5-system/2-api-convention.md §9`(line 284) "유저 아바타는 multipart 업로드가 아니라 avatarUrl URL 필드로 관리한다(별도 업로드 엔드포인트 없음)" 이, target 이 다른 4개 문서(`0-overview.md`/`data-flow/4-file-storage.md`/`2-navigation/9-user-profile.md`/`5-system/3-error-handling.md`)에서 확정하는 반대 사실(실재하는 `POST /api/users/me/avatar` multipart 엔드포인트, 구현됨)과 정면 모순 | target frontmatter `spec_impact`(4개 파일로 한정) + `## 변경안` A~F | `spec/5-system/2-api-convention.md:284` | target `## 변경안`에 `### G. spec/5-system/2-api-convention.md §9` 신설 — line 284 문장을 "KB 문서 업로드·아바타 업로드(`POST /api/users/me/avatar`, 2MB, png/jpg/jpeg/webp/gif) 두 사용처" 서술로 교체, "최대 크기" 행에 "(엔드포인트별 상이 — KB 50MB, Avatar 2MB)" 단서 추가. `spec_impact` frontmatter·`pending_plans` 동반 등재 대상에도 이 파일 포함 |

## planner 인계 (권한 밖 Critical)

> (없음) — 이 target 자체가 `spec/` 변경을 다루는 spec draft(project-planner 권한 범위 내)이며, 위 Critical 은 같은 draft 의 `## 변경안`에 절을 하나 추가하는 것으로 호출자 권한 안에서 해소 가능하다. 권한 밖 발견 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | `spec/data-flow/0-overview.md` Rationale "KB 원본 키만 workspaceId prefix 를 제외한다"는 배타적 서술이 target 의 `spec_impact`·본문 어디에도 언급 없이 수정 범위 밖에 남음 — target §B 가 `spec/0-overview.md` 에서 고치는 것과 동일한 배타적 주장을 자매 문서가 그대로 유지 | target frontmatter `spec_impact`(이 파일 없음) | `spec/data-flow/0-overview.md`(~:269-274) | `spec_impact` 에 `spec/data-flow/0-overview.md` 추가, "KB 원본 키만" → "KB 원본 키와 Avatar 키" 로 정정(또는 `0-overview.md §2.7 Rationale` 참조로 exclusivity 서술 자체 제거) |
| 2 | rationale_continuity | `spec/data-flow/4-file-storage.md` Rationale "S3 GET 은 worker 임베딩 단계의 서버사이드 `s3Service.download` 뿐이다" 서술이, target §C 가 신설하는 브라우저의 공개 익명 GetObject 경로 도입 후에도 갱신 대상에서 빠짐(§E 는 앵커 링크만 갱신) | target §C(§1.3 신설)/§E(앵커만) | `spec/data-flow/4-file-storage.md:127` | 해당 문장 뒤에 "(아바타는 예외 — 공개 버킷 익명 GetObject)" 한정 추가 또는 §C 범위를 이 Rationale 문단까지 확장 |
| 3 | plan_coherence | target §D-4 가 지시하는 `pending_plans` 신규 등재(`spec-update-avatar-upload-implemented.md`)가, 같은 diff 가 그 트래커의 할 일 체크리스트를 전항목 흡수·소진시킨다는 사실을 반영하지 못해 등재 즉시 dangling 참조가 됨 — `plan-lifecycle.md §4` "가리키던 plan 을 complete/ 로 옮기면 같은 commit 에서 pending_plans 도 갱신" 규칙과 충돌 | target §D-4 | `plan/in-progress/spec-update-avatar-upload-implemented.md` 할 일 체크리스트(A~F 로 전항목 해소됨) | target 실행과 같은 턴에 (a) 트래커 체크리스트 전항목 체크 후 `plan/complete/` 이동, (b) §D-4 의 `pending_plans` 등재 대상 재검토(불필요하면 제거, 유지한다면 사유 명시) |
| 4 | naming_collision | A-1 트리 diff hunk 의 context 텍스트("Form 영역")가 실제 파일("Form/Avatar 영역")과 어긋나, 적용 시 옛 "Avatar" 문구와 새 최상위 `avatars/` 노드가 같은 블록에 중복 잔존할 위험 — target 이 해소하려는 오독을 스스로 재도입할 수 있음 | target §A-1 diff hunk | `spec/0-overview.md:265` 실제 텍스트 | A-1 적용 지시에 `{workspaceId}/` 줄 주석에서 "Form/Avatar 영역" → "Form 영역"으로 명시적으로 고쳐야 함을 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec / convention_compliance | §F(`error-handling.md` 에러 카탈로그) 변경 지점이 다른 절(A~E, 전부 `:줄번호` 앵커)과 달리 "§1 에러 카탈로그"로만 지목돼 어느 서브섹션(§1.3 vs §1.8/1.9 패턴)에 삽입할지 불명확 | target `### F.` 절 | §1.3 표 말미 삽입임을 명시하고 정확한 라인 앵커(`:xxx`) 추가, 또는 §1.3 을 선택한 근거("범용 검증 에러이지 KB 전용 아님") 한 줄 기재 |
| 2 | cross_spec | `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 "대상은 세 문서다" 서술이 target 의 실제 범위(§G 포함 시 5개 문서)와 어긋남 — WARNING 3 과 근본 원인 공유, 함께 정정 필요 | 트래커 본문 | target 실행 시 트래커의 대상 문서 서술·체크리스트를 실제 범위로 동기화 |
| 3 | rationale_continuity | §E 의 앵커 링크 갱신은 `grep -rn "s3-객체-키-prefix-설계" spec/` 기반이라 앵커 **링크**만 잡고, WARNING 1/2 같은 산문 텍스트 중복 서술은 포착하지 못함 | target §E (방법론) | 앵커 grep 외에 `"KB.*만"`/`"KB 원본.*제외"` 류 텍스트 검색을 병행해 유사 재발 방지 |
| 4 | naming_collision | `s3.publicBaseUrl` 신규 키가 §2.3 표에만 추가되고 문서 상단 인라인 요약(`:19`, "ConfigService 키: s3.bucket, s3.endpoint, ...")에는 동반 갱신 지시가 없음 | target §C-4 | C-4 지시에 `:19` 인라인 목록에도 `s3.publicBaseUrl` 추가하는 항목 추가 |
| 5 | plan_coherence | 이전 라운드(`review/consistency/2026/09/01/01_51_41`) WARNING 6(`s3.publicBaseUrl`/`app.publicBaseUrl` leaf 이름 혼동 방지 주석, developer 코드 스코프)이 어느 `plan/in-progress` 문서에도 추적되지 않음 | target 범위 밖(코드 변경) | `spec-sync-user-profile-gaps.md` 아바타 항목 하위에 캐너리로 등재하거나 target `## 관련`에 "코드 스코프 잔여(미추적)"로 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `api-convention.md §9` CRITICAL 모순(1건) + F 삽입 위치·트래커 스코프 불일치 INFO 2건 |
| rationale_continuity | MEDIUM | `data-flow/0-overview.md`·`data-flow/4-file-storage.md` 두 자매 문서의 배타적 Rationale 서술 미수정 WARNING 2건 |
| convention_compliance | NONE | `spec/conventions/**`(swagger.md·error-codes.md) 직접 위반 없음, F 절 라인 앵커 INFO 1건 |
| plan_coherence | MEDIUM | `pending_plans` 신규 등재 dangling 위험 WARNING 1건 + 이전 라운드 WARNING6 미추적 INFO 1건 |
| naming_collision | LOW | 신규 식별자 충돌 0건(전수 grep 확인), A-1 diff context 불일치 WARNING 1건 + `s3.publicBaseUrl` 요약 누락 INFO 1건 |

## 권장 조치사항
1. (BLOCK 해소 최우선) target `## 변경안`에 `### G. spec/5-system/2-api-convention.md §9` 신설 — line 284 문장 정정 + "최대 크기" 행 단서 추가, `spec_impact` frontmatter 에 이 파일 추가.
2. `spec_impact` 에 `spec/data-flow/0-overview.md` 추가, "KB 원본 키만" 배타 서술 정정.
3. `spec/data-flow/4-file-storage.md` Rationale "S3 GET 은 서버사이드 뿐" 문장에 아바타 예외 한정 문구 추가.
4. target 실행과 같은 턴에 `spec-update-avatar-upload-implemented.md` 체크리스트 전항목 완료 처리 + `plan/complete/` 이동, §D-4 `pending_plans` 등재 재검토.
5. A-1 diff 지시에 `{workspaceId}/` 주석 정정("Form/Avatar 영역"→"Form 영역") 문구 추가.
6. (경미) F절 삽입 위치 명시, `s3.publicBaseUrl` 문서 상단 요약 목록 동기화, WARNING6 을 `spec-sync-user-profile-gaps.md` 에 캐너리 등재.
