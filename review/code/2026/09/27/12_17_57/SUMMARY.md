# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 1건(신규 결함 아님 — 1R에서 이미 지적·처분된 항목이 예정된 마무리 커밋 이전이라 아직 미해소인 상태). forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | 트래커 문서가 아직 존재하지 않는 `plan/complete/folders-contract-e2e.md` 를 인용한다(댕글링 전방 참조). 1R documentation 리뷰가 이미 W2로 지적했고 RESOLUTION에서 "마무리 커밋(`git mv`)이 그 경로를 만든다 — push 전 확인"으로 처분됨. `plan/in-progress/folders-contract-e2e.md` 체크리스트의 `/ai-review`·`--impl-done` 두 항목이 아직 미체크라 마무리 커밋이 아직 실행 전 — 새 결함이 아니라 예정된 처분의 미착수 상태 | `plan/in-progress/spec-draft-nullable-notation-followups.md:1398` (인용 대상 `plan/complete/folders-contract-e2e.md`) | 기존 처분대로 push 전 마무리 커밋(체크리스트 완료 + `git mv`) 실행 후 `git show HEAD:plan/complete/folders-contract-e2e.md` 로 실재 확인. 이번 라운드에서 별도 코드 fix 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/API계약 | `omitUndefined()` 헬퍼가 `undefined` 값만 걸러낼 뿐 키 자체는 화이트리스트하지 않는다(mass-assignment 형태). 다만 두 호출부(`FoldersController`/`TriggersController`) 모두 타입 있는 DTO(`@Body() dto: UpdateFolderDto`/`UpdateTriggerDto`)로만 호출되고 전역 `CustomValidationPipe`(whitelist+forbidNonWhitelisted)가 실질 방어함을 확인 — 헬퍼 추출이 방어 범위를 바꾸지 않음 | `codebase/backend/src/common/utils/omit-undefined.ts:12-16`, `folders.service.ts:73-77`, `triggers.service.ts:619-622` | 조치 불요(실측 완료). 후속 3곳(`workflows`/`nodes`/`auth-configs`) 적용 시 트래커의 "타입 있는 DTO 확인" 항목을 따를 것 |
| 2 | API계약/부작용 | `FolderDto.parentId` OpenAPI 선언이 optional → required(+nullable)로 좁혀짐. 런타임 응답은 원래도 항상 키를 실었으므로(e2e 뮤턴트 M1 실측) 동작 변경은 아니고 선언을 실측에 맞춘 정정. 프런트엔드는 이 DTO를 codegen하지 않고 별도 수기 타입을 유지해 즉시 연동되지 않음 | `folders.service/dto/responses/folder-response.dto.ts:17-21`, `swagger-dto-contract.spec.ts`(`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 1행 제거) | 조치 불요 — 위험 낮음. 외부 codegen 클라이언트가 생기면 재생성 시 타입 변화 참고 |
| 3 | 보안/API계약 | `FoldersService` 가 `FolderDto` 매핑 없이 TypeORM 엔티티를 그대로 반환(entity passthrough). `relations`/`eager` 미사용으로 즉시 유출은 없음을 재확인. 기존 구조이며 이번 diff 범위 밖 | `folders.service.ts` 전체(`findAll`/`findById`/`create`/`update`) | 조치 불요 — `review/consistency/2026/09/27/10_39_26/convention_compliance.md` 가 이미 별도 추적 중 |
| 4 | 부작용 | 신설 e2e(`folder-crud.e2e-spec.ts`)가 환경변수(`E2E_BASE_URL`)를 읽고 외부 프로세스(백엔드 컨테이너·Postgres)로 네트워크 호출을 연다 — 테스트 하네스 범위의 기대된 I/O, 프로덕션 경로 아님 | `codebase/backend/test/folder-crud.e2e-spec.ts:28,41-47` | 조치 불요 |
| 5 | 부작용 | `FoldersService.update()` 병합 semantics 변경 — `undefined` 필드가 더는 로드된 값을 덮지 않고, 명시적 `null`은 그대로 반영됨(의도된 버그 수정). 단위·e2e·뮤턴트 표(M5, H1~H3)로 뒷받침 | `folders.service.ts:66-74` | 조치 불요 — 검증 충분. 같은 형태가 남은 `workflows`/`nodes`/`auth-configs` 의 `update()` 는 트래커에 이미 별도 등재 |
| 6 | 스코프 | `omitUndefined` 헬퍼 추출이 원 PR 축(폴더 모듈)을 넘어 `triggers.service.ts` 까지 수정(순수 리팩터, import 1줄 + 필터 로직 치환). 1R WARNING #1(DRY 복제)에 대한 직접 응답이며 CLAUDE.md의 "구현 완료 후 같은 턴 fix" 상시 승인 의무에 부합 | `codebase/backend/src/modules/triggers/triggers.service.ts` | 조치 불요 — 다음 리뷰어가 오탐하지 않도록 참고 기록 |
| 7 | 스코프 | 1R 리뷰(`review/code/2026/09/27/11_53_51/**`)·consistency-check(`review/consistency/2026/09/27/10_39_26/**`) 산출물이 기능 커밋과 같은 PR에 함께 실림 — 저장소 관례(CLAUDE.md 저장 위치 표)와 일치, 기존에 확립된 패턴 | 두 디렉터리 전체 | 조치 불요 |
| 8 | 유지보수성 | 케이스 문자(`e2e C·E`) 인용 드리프트 처방이 서비스 주석에만 적용되고 단위 테스트 주석(`folders.service.spec.ts:116`)에는 남아 있음 — 1R INFO 7의 절반만 적용 | `codebase/backend/src/modules/folders/folders.service.spec.ts:116` | 케이스 문자 대신 파일명만 인용하도록 한 줄 정리. 비차단 |
| 9 | 유지보수성 | 신규 유닛 테스트 2개(`update — parentId 재검증` 블록)만 한국어 서술이고 같은 블록의 다른 10개는 영문 — 1R INFO 6에서 이미 조치 불요로 처분됨(저장소에 한국어 서술 전례 있음) | `folders.service.spec.ts:117,137` | 처분대로 조치 불요. 팀이 한국어 전환 중이면 규약 문서에 명시 권장 |
| 10 | 테스트 | `omit-undefined.spec.ts` 에 "빈 객체 입력" 자체 캐너리가 없음 — 현재는 소비자 테스트(`folders.service.spec.ts`)가 간접적으로만 이 경로를 검증 | `codebase/backend/src/common/utils/omit-undefined.spec.ts` | `omitUndefined({})` 및 전 필드 `undefined` 입력 캐너리 2개 추가 권장. 비차단 |
| 11 | 테스트 | `omitUndefined<T extends object>` 타입 제약이 배열을 허용하지만 구현은 배열을 일반 객체로 붕괴시킴(`Object.entries`/`fromEntries`) — 현재 두 호출부는 배열을 넘기지 않아 영향 없음 | `codebase/backend/src/common/utils/omit-undefined.ts:12` | 제약을 `Record<string, unknown>` 등으로 좁히거나 "PATCH 부분 본문 전용" JSDoc 명시 권장. 비차단 |
| 12 | 테스트 | 폴더 단위 테스트의 `mockRepository.save` 목이 TypeORM의 실제 nullable-fill 동작을 재현하지 않음 — "거짓 null" 증상은 e2e 계층에서만 잡히는 의도된 계층 분리(1R testing 리뷰가 이미 지적) | `folders.service.spec.ts:22-24` | 조치 불요 — 의도적·문서화된 계층 분리 |
| 13 | API계약 | `GET /folders` 가 페이지네이션 없이 배열 반환 — 기존 설계, 이번 diff 무관, consistency-check가 이미 별도 추적 | `folders.service.ts` `findAll` | 조치 불요 — 추적 중 |
| 14 | API계약 | Folder API RBAC 매트릭스가 `spec/5-system/1-auth.md` §3.2에 미등재 — `--impl-prep` consistency-check W1로 이미 잡혔고 developer가 spec을 직접 고칠 수 없어 planner 항목으로 보강해 둠 | `spec/5-system/1-auth.md` §3.2(diff 밖) | 조치 불요(developer 스코프 밖, planner 턴 대기) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | mass-assignment 전제(호출부 DTO+전역 파이프로 방어 확인), entity passthrough 재확인 — Critical/Warning 없음 |
| requirement | NONE | spec §5.4/§2.5/§3.1과 line-level 일치, 헬퍼 추출 전후 동작 불변 확인. 트래커 댕글링 참조는 기존 처분 재확인 |
| scope | NONE | triggers.service.ts 수정은 1R WARNING 처분(같은 턴 fix 의무)의 정당한 확장, 그 외 스코프 이탈 없음 |
| side_effect | LOW | update() 병합 semantics 변경(의도된 수정)·DTO 선언 좁힘 모두 검증됨. 숨은 부작용 없음 |
| maintainability | LOW | 1R WARNING(DRY 복제) 해소 확인. 남은 것은 사소한 주석 드리프트·명명 일관성(기존 처분) |
| testing | LOW | 헬퍼 전용 스펙 신설, 회귀 테스트 유효성 확인(H1~H4 KILLED 실측). 경계 캐너리·타입 느슨함은 비차단 |
| documentation | LOW | 문서 전반 정확. 트래커 댕글링 참조 1건(WARNING, 기존 처분 대기 중) |
| api_contract | LOW | PATCH 부분 본문 결함 수정이 REST 시맨틱과 일치, DTO 선언 정정도 실측 무변화. 나머지는 기존 추적 항목 |

## 발견 없는 에이전트

없음 — 실행된 8개 에이전트 모두 최소 1건 이상의 INFO 또는 WARNING을 보고함(security 3, requirement 1, scope 2, side_effect 4, maintainability 2, testing 4, documentation 1, api_contract 5, 위 표에서 중복 제거 후 통합).

## 권장 조치사항

1. push 전 마무리 커밋(plan 체크리스트 완료 + `plan/in-progress/folders-contract-e2e.md` → `plan/complete/folders-contract-e2e.md` `git mv`)을 실행하고 `git show HEAD:plan/complete/folders-contract-e2e.md` 로 실재를 확인한다 (WARNING #1 해소).
2. (선택, 비차단) `omit-undefined.spec.ts` 에 빈 객체/전 필드 undefined 입력 캐너리 2개를 추가해 헬퍼 자체 스펙만으로 경계를 보증한다.
3. (선택, 비차단) `folders.service.spec.ts:116` 의 케이스 문자(`e2e C·E`) 인용을 파일명 참조로 정리해 1R INFO 7 처방을 완전히 적용한다.
4. (선택, 비차단) `omitUndefined<T extends object>` 의 타입 제약을 배열을 배제하는 형태로 좁히거나 JSDoc에 "PATCH 부분 본문 전용" 임을 명시한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명)
  - **제외**: 표 (아래, 6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff(PATCH 필터 헬퍼 추출·DTO 선언 정정)가 성능 특성에 영향 없다고 판단 (상세 사유 미제공) |
  | architecture | 라우터 판단 — 아키텍처 경계 변경 없음으로 판단 (상세 사유 미제공) |
  | dependency | 라우터 판단 — 신규/변경 외부 의존성 없음으로 판단 (상세 사유 미제공) |
  | database | 라우터 판단 — 스키마/쿼리 변경 없음으로 판단 (상세 사유 미제공) |
  | concurrency | 라우터 판단 — 동시성 로직(advisory lock 등) 변경 없음으로 판단 (상세 사유 미제공) |
  | user_guide_sync | 라우터 판단 — 사용자 가이드에 영향 없는 내부/API 변경으로 판단 (상세 사유 미제공) |