# 부작용(Side Effect) 리뷰

## 검토 범위

이번 diff(`origin/main...HEAD`, 25개 파일)의 실질 코드 변경은 3곳뿐이고 나머지는 문서/리뷰 산출물이다.

- `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `forbidNonWhitelisted` 축을 고정하는 신규 테스트 (`+38`)
- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — 죽은 `workflowId` 쿼리 필드 + `@IsUUID`/`@Transform` 데코레이터 제거
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — JSDoc만 재실측치로 갱신, 판정 로직(`findSwaggerContractMismatches` 등) 불변
- `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 문서
- `review/code/2026/09/04/18_34_04/**`, `review/consistency/2026/09/04/18_51_26/**` — 이전 리뷰 라운드의 산출물이 이번 커밋으로 신규 파일 12개 추가

이 라운드는 직전 리뷰(`18_34_04`)의 W2(테스트 부재)를 메우려고 `validation.pipe.spec.ts` 를 추가한 RESOLUTION 커밋이다. `18_34_04/side_effect.md` 가 이미 지적한 breaking-change 축(아래)은 이번 diff에도 그대로 남아 있어 재확인했다.

## 검증 절차

- `git status --short` — 이 세션의 산출 디렉터리(`review/code/2026/09/04/18_56_22/`)만 untracked, 저장소 뮤테이션 없음.
- `codebase/backend/src/common/pipes/validation.pipe.ts` 를 직접 Read — `CustomValidationPipe` 는 인스턴스 필드가 없는 순수 stateless 클래스이고, `whitelist`/`forbidNonWhitelisted` 는 `transform()` 호출마다 인라인 리터럴로 `validate()` 에 전달된다(전역 변수·모듈 스코프 캐시 없음).
- `grep -rn workflowId codebase/backend/src/modules/executions/` — DTO 에서 제거된 쿼리 필드에 대한 잔존 참조(`query.workflowId` 형태) 없음을 재확인. 남은 `workflowId` 히트는 전부 엔티티 필드·경로 파라미터로 무관.

## 발견사항

- **[WARNING]** (직전 라운드에서 이미 식별, 이번 diff에도 유효) 공개 REST 쿼리 파라미터 제거로 미검증 외부 소비자는 `200`(무시) → `400` 이 된다.
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (전체 파일 컨텍스트 게이트 1~15, `workflowId?: string | null` 필드·`@IsOptional()`·`@IsUUID()`·`@Transform` 삭제) / 전역 파이프 설정은 `codebase/backend/src/common/pipes/validation.pipe.ts:31`(`forbidNonWhitelisted: true`)
  - 상세: 시그니처·인터페이스 관점(점검 관점 4·5)에서 이 diff의 유일한 실질 부작용이다. 저장소 내부 소비자(서비스 구조분해·FE·spec·e2e·OpenAPI 코드젠) 부재는 이번 라운드에서도 재확인했고, 이번 커밋이 그 갭 중 하나(테스트 미고정)를 `validation.pipe.spec.ts` 신규 테스트로 메웠다. 다만 저장소 밖 제3자 클라이언트가 이 쿼리를 보내고 있었을 가능성은 여전히 "관측 범위 밖"이며 이 diff로 판단할 수 없다.
  - 제안: 이미 CHANGELOG·plan에 영향 분석과 배포 시 확인 안내가 있어 추가 코드 조치는 불요. 새로 추가할 것은 없음 — 직전 라운드의 권고가 그대로 유효.

- **[INFO]** `validation.pipe.spec.ts` 신규 `describe` 블록은 부작용 없이 격리돼 있다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts` (게이트 84~108, `describe('CustomValidationPipe — forbidNonWhitelisted', ...)`)
  - 상세: `const pipe = new CustomValidationPipe();` 를 이 블록 안에서 새로 생성해 상단 블록(게이트 22~24)의 `pipe`/`meta` 와 공유하지 않는다. `NarrowDto` 는 export되지 않는 로컬 클래스로 다른 모듈에 영향 없음(저장소 전체 유일 사용처). `CustomValidationPipe` 자체가 stateless(모듈 스코프 변수·싱글턴 캐시 없음)이므로 두 describe 블록 간 실행 순서에 따른 오염 가능성도 없다.

- **[INFO]** `swagger-dto-contract-guard.ts` 변경은 순수 JSDoc — 실행 경로 불변.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (게이트 100~121 부근, `findSwaggerContractMismatches` 위 주석 블록)
  - 상세: diff 전체가 블록 주석 텍스트 교체이며, 함수 로직·AST 순회·판정 조건은 unchanged. 부작용 없음.

- **[INFO]** 이번 커밋이 저장소에 신규로 쓰는 파일 12개(`review/code/2026/09/04/18_34_04/**`, `review/consistency/2026/09/04/18_51_26/**`)는 이전 리뷰/일관성 검토 라운드의 산출물이다. `CLAUDE.md`의 "코드 리뷰 산출물 → `review/code/<...>/`, 일관성 검토 산출물 → `review/consistency/<...>/`" 규약과 정확히 일치하는 위치이고, 실행되는 코드가 아니라 runtime 부작용은 없다. 예상 밖의 파일시스템 부작용은 아니다.

- **[INFO]** CHANGELOG.md / plan 문서 갱신은 순수 프로즈·체크박스 변경으로 부작용 없음(전역 상태·파일시스템·네트워크·환경변수 영향 요소 없음).

CRITICAL 은 발견되지 않았다. 전역 변수 신설·수정, 예상치 못한 파일 생성/삭제(리뷰 산출물 제외), 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 이번 diff 어디에도 없다.

## 요약

이번 diff의 유일한 실질 부작용은 직전 라운드에서 이미 식별된 것과 동일하다 — `QueryExecutionDto.workflowId` 제거가 전역 `forbidNonWhitelisted: true` 파이프와 맞물려 만드는 공개 REST 인터페이스 breaking change(외부 미지 클라이언트 200→400)이며, 저장소 내부 소비자 부재는 재확인됐고 이번 커밋이 그 동작을 고정하는 회귀 테스트(`validation.pipe.spec.ts`)까지 신설해 직전 라운드 WARNING(테스트 부재)을 메웠다. 신규 테스트 자체는 stateless 파이프를 대상으로 격리된 로컬 클래스로 구성돼 부작용이 없고, `swagger-dto-contract-guard.ts` 변경은 로직 불변의 주석뿐이며, 대량으로 추가된 리뷰 산출물 파일들은 프로젝트 관례상 정상 위치에 기록된 비실행 문서다. 새로운 CRITICAL/WARNING 급 부작용은 없다.

## 위험도

LOW
