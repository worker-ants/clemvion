# 변경 범위(Scope) 리뷰

## 발견사항

없음 — 점검 관점 8개 중 문제로 볼 만한 항목을 찾지 못했다.

### 참고 (비-차단, 근거 확인용)

- **[INFO]** `throwCannotRemoveOwner()` 프라이빗 헬퍼 추출
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:355` (`private throwCannotRemoveOwner(): never`)
  - 상세: 기존엔 인라인 `throw new ForbiddenException({...})` 한 곳뿐이었는데, 이번 수정으로 같은 메시지를 던지는 자리가 (이른 가드 + DELETE 0행 후 재조회 backstop) 두 곳으로 늘어난다. 헬퍼 추출은 리터럴 중복을 막기 위한 것으로, 바로 위 `throwMemberNotFound()`(이미 같은 이유로 존재)와 동일한 선례를 따른다. JSDoc 에도 그 근거(`throwMemberNotFound()` 가 세 벌 복제로 지적받은 선례)가 명시돼 있다.
  - 판단: 요청 범위(owner 보호 가드 TOCTOU 수정)를 구현하는 데 직접 필요한 최소 리팩토링이며, 목적 없는 코드 정리가 아니다. 문제 아님.

- **[INFO]** 기존 JSDoc·주석 정정 (`removeMember` 상단 및 DELETE 위)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:802` 부근(동시성 보장 JSDoc), `:838` 부근(DELETE 위 인라인 주석)
  - 상세: 이전 PR(#1373)에서 "owner 가드까지 원자화하지 않는다"고 적어둔 예고 주석을 이번 수정이 반증(정확히 그 일을 해냄)하므로 정정한다. plan(`plan/in-progress/member-owner-toctou.md` §D)이 이 정정을 명시적으로 계획하고, "spec/ 이 아니라 코드 주석이므로 자기-반증형 소정정 조항의 대상이 아니다"라고 스스로 경계를 밝혔다.
  - 판단: 이번 diff가 그 주석이 서술하는 동작 자체를 바꾸므로 주석 정정은 실질 변경과 동행해야 하는 필수 갱신이다. 무관한 주석 손질이 아님.
  - 다만 스코프 리뷰 관점에서 참고할 점: 이 정정이 "developer가 code comment는 spec 자기반증 조항의 규율을 받지 않는다"는 스스로의 해석에 의존한다. CLAUDE.md의 자기-반증형 소정정 조항은 문언상 `spec/` 문서에 한정돼 있어 코드 주석 정정에 그 조항을 원용할 필요 자체가 없다는 점에서 이 해석은 타당해 보이나, 발견사항이 아니라 참고로만 남긴다.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`(공용 트래커) 편집
  - 위치: 해당 파일 — 3개 항목 추가(`removeMember` owner 보호 메커니즘 spec 명문화 필요 / 에러 코드 3종 카탈로그 누락 / RBAC 표 각주로 인한 GFM 테이블 분절) + 컨시스턴시 체커의 `related_specs` 후보 누락 사례 1건 기록
  - 상세: 이번 작업의 `--impl-prep`(`review/consistency/2026/09/24/07_29_15`)에서 나온 WARNING·INFO 들을 같은 턴에 트래커로 등재한 것으로, "developer는 spec 변경이 필요하면 planner에게 위임하고 즉시 트래커에 등재한다"는 프로젝트 컨벤션과 일치한다. 이 트래커는 본 작업 전용 파일이 아니라 여러 세션이 공유하는 대형 백로그 파일이지만, 추가된 내용은 모두 이번 `--impl-prep` 실행에서 직접 파생된 항목이라 무관한 수정은 아니다.
  - 판단: 문제 아님.

- **[INFO]** `review/consistency/2026/09/24/07_29_15/**` (SUMMARY.md, meta.json, 4개 체크 리포트, `_retry_state.json`) 신규 생성
  - 상세: 이는 `/consistency-check --impl-prep`가 산출한 필수 워크플로 아티팩트로, 착수 전 의무 게이트의 부산물이다. 코드 변경이 아니며 리뷰 대상 codebase 범위 밖의 관례적 산출물이다.
  - 판단: 문제 아님.

## 요약

`git diff --stat`으로 codebase 변경분을 별도 확인한 결과, 실제 애플리케이션 코드 변경은 `workspaces.service.ts`(구현) · `workspaces.service.spec.ts`(단위 테스트) · `member-remove-concurrency.e2e-spec.ts`(e2e 테스트) 3개 파일에 정확히 국한되며, 세 파일의 모든 변경분이 "removeMember owner 보호 가드의 TOCTOU 수정"이라는 단일 의도에 직접 대응한다 — import 추가(`Not`, `FindOperator`)는 새 코드가 실제로 사용하고, 신규 헬퍼(`throwCannotRemoveOwner`)는 리터럴 중복을 막기 위한 최소 추출이며, 주석·JSDoc 정정은 이번 diff가 반증한 이전 예고 문장을 고친 것이다. plan 파일(`member-owner-toctou.md`)은 §F에서 "권한 검사 순서 오라클"과 "leaveWorkspace 갈래"를 명시적으로 스코프 밖으로 배제하고 실제로 건드리지 않아 규율이 지켜졌다. 공용 트래커 편집과 consistency-check 산출물은 모두 프로젝트가 의무화한 프로세스 부산물이며 이번 작업에서 직접 파생된 내용만 담고 있다. 포맷팅·주석·임포트·설정 파일 등 관점에서 실질 변경과 무관하게 섞여 들어간 손질은 발견되지 않았다.

## 위험도

NONE
