# 부작용(Side Effect) 리뷰

## 검토 범위 및 방법

이번 diff(`origin/main...HEAD`, 37개 파일, `git diff --stat` 로 직접 확인)는 두 층으로 구성된다.

1. **실질 코드/문서 변경 (5파일)**: `CHANGELOG.md`, `codebase/backend/src/common/pipes/validation.pipe.spec.ts`(신규 테스트),
   `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`(`workflowId` 쿼리 필드 제거),
   `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`(JSDoc 만 갱신),
   `plan/in-progress/spec-draft-nullable-notation-followups.md`(체크리스트/트래커 동기화)
2. **직전 리뷰·consistency 라운드 산출물 (32파일)**: `review/code/2026/09/04/18_34_04/**`,
   `review/code/2026/09/04/18_56_22/**`, `review/consistency/2026/09/04/18_51_26/**` — 전부 신규 파일(new
   file mode)로, `CLAUDE.md` "정보 저장 위치" 표가 규정한 표준 경로에 영구 보존되는 정상 워크플로 산출물이다.

이 커밋 체인(`fe977e922` → `7e4c71173` → `88f4bdacd` → `22d1ec1ab`)은 이미 두 차례의 code-review
라운드(`18_34_04`, `18_56_22`)와 한 차례의 consistency-check(`18_51_26`)를 거쳤다. 저장소 트리는
뮤테이션하지 않고 `Read`/`Grep`/`Bash`(read-only)로 diff 파일과 실제 소스(`validation.pipe.ts`,
`executions.service.ts`, `executions.controller.ts`)를 직접 대조해 이전 라운드들의 주장을 독립
재검증했다. `git status --short` 최종 확인 — 이 세션의 산출 디렉터리(`review/code/.../19_14_29/`)만
untracked, 저장소 잔여 변경 없음.

## 발견사항

- **[WARNING]** (직전 두 라운드에서 이미 식별·문서화됨, 이번 diff에도 사실관계 유효) 공개 REST 쿼리
  파라미터 제거로 미검증 외부 클라이언트는 `200`(무시)에서 `400`으로 응답이 바뀐다.
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (`QueryExecutionDto`
    클래스, `workflowId?: string | null` 필드·`@IsOptional()`·`@IsUUID()`·`@Transform` 데코레이터 삭제)
  - 상세: `codebase/backend/src/common/pipes/validation.pipe.ts:29-32` 를 직접 Read 해
    `whitelist: true` + `forbidNonWhitelisted: true` 가 `validate()` 호출마다 인라인 리터럴로 전달됨을
    확인했다 — 전역 변수나 모듈 스코프 캐시 없이 매 호출 동일하게 적용되는 stateless 설정이다. 이
    설정 자체는 이번 diff 의 변경 대상이 아니지만(파일이 diff 에 포함되지 않음), `workflowId` 필드
    제거와 맞물려 이 필드를 쿼리스트링에 실어 보내던 외부 클라이언트는 이제 `400`(unknown property)을
    받는다 — 시그니처 변경(관점 4)이자 공개 인터페이스 변경(관점 5)이다.
    저장소 내부 소비자 부재는 직접 재확인했다: `grep -rn QueryExecutionDto codebase/backend/src` 결과
    사용처는 `executions.controller.ts:110`(`@Query() query: QueryExecutionDto`)와
    `executions.service.ts`(`findByWorkflow`) 단 두 곳뿐이고, `findByWorkflow` 는
    `{page, limit, sort, order, status}` 만 구조분해해 `workflowId` 를 읽지 않는다. 이번 라운드에서
    새로 추가된 `validation.pipe.spec.ts` 의 `describe('CustomValidationPipe — forbidNonWhitelisted', ...)`
    가 이 축(DTO 미선언 키 → 400)을 회귀 테스트로 고정해, 직전 라운드가 지적했던 "요점 동작 변화를
    고정하는 테스트 부재" 갭은 실제로 메워졌다(`body.code === 'VALIDATION_ERROR'` 단언까지 포함해
    직접 Read 로 확인).
    남는 위험은 여전히 **저장소 밖 제3자 클라이언트**뿐이며 이는 이 diff 로 판단 가능한 범위를
    벗어난다 — CHANGELOG 자신도 "이것은 저장소 안에서 미발견이지 소비자 부재 확인이 아니다" 로 이
    한계를 명시하고 있다.
  - 제안: 이미 CHANGELOG(`⚠️ 배포 시 확인` 절)·plan 양쪽에 영향 분석과 사용자 결정(옵션 A: 제거)이
    기록돼 있고 회귀 테스트도 신설돼 추가 코드 조치는 불필요하다. 배포 시점에 실제 릴리즈 공지
    채널에도 이 400 회귀 가능성이 반영되는지만 확인 권장.

- **[INFO]** `swagger-dto-contract-guard.ts` 변경은 순수 JSDoc — 실행 경로 영향 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`git diff` 로
    직접 확인, `findSwaggerContractMismatches` 함수 위 블록 주석만 변경)
  - 상세: `git diff origin/main...HEAD -- .../swagger-dto-contract-guard.ts` 전체를 대조한 결과 diff
    는 `/** ... */` 블록 내부 텍스트 교체뿐이다. 함수 시그니처·AST 순회·`@Transform` 판정 조건(`!decorators
    .some((d) => d.name === 'Transform')`)은 unchanged. 부작용 없음.

- **[INFO]** 신규 테스트(`validation.pipe.spec.ts`)는 격리돼 있고 전역/공유 상태를 만들지 않는다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts` (게이트 86~116,
    `describe('CustomValidationPipe — forbidNonWhitelisted', ...)`)
  - 상세: 이 블록은 `const pipe = new CustomValidationPipe();` 를 자체적으로 새로 생성해 상단 블록의
    `pipe`/`meta` 와 공유하지 않는다. `NarrowDto` 는 export 되지 않는 로컬 클래스로 저장소 전체에서
    이 파일 1곳에만 존재한다(`grep -rn NarrowDto codebase/backend/src` 확인). `narrowMeta` 상수는 두
    `it()` 사이에서 재사용되지만 `pipe.transform()` 이 `metatype`/`value` 를 변형하지 않는 순수 조회용
    입력이라 테스트 간 오염 경로가 없다. `CustomValidationPipe` 자체도 인스턴스 필드가 없는 stateless
    클래스임을 `validation.pipe.ts` 전체 Read 로 확인했다.

- **[INFO]** `19_07_11`(commit `22d1ec1ab`) 의 재작성이 이전 INFO(리뷰 세션 ID를 영구 주석 근거로
  인용)를 실제로 해소했다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts:84` (게이트)
  - 상세: 이전 라운드(`18_56_22` maintainability INFO)가 JSDoc 이 ephemeral 한 `review/**` 세션
    ID(`18_34_04` W2)를 근거로 인용해 향후 그 디렉터리가 정리되면 dangling reference 가 될 위험을
    지적했다. 현재 파일을 직접 Read 한 결과 `Tracking: \`plan/in-progress/spec-draft-nullable-notation-followups.md\`
    §후속.` 로 SoT 문서 인용으로 교체돼 있음을 확인했다 — 이 축의 부작용(추적 불가능한 참조)은 소멸했다.

- **[INFO]** 리뷰/consistency 산출물 32개 신규 파일은 예상된 파일시스템 부작용이며 코드 실행 경로와
  무관하다.
  - 위치: `review/code/2026/09/04/18_34_04/*`, `review/code/2026/09/04/18_56_22/*`,
    `review/consistency/2026/09/04/18_51_26/*`
  - 상세: `CLAUDE.md` "정보 저장 위치" 표가 규정하는 `review/code/**`, `review/consistency/**` 경로에
    정확히 위치하고, 모두 마크다운/JSON 리포트로 실행되는 코드가 아니다. 내용을 표본 확인한 결과(각
    라운드의 `SUMMARY.md`, `meta.json`, `RESOLUTION.md`) 전부 이번 단일 작업(`QueryExecutionDto.workflowId`
    제거)에 관한 기록이며 다른 세션의 잔여물이 섞여 있지 않다. 예상치 못한 파일 생성이 아니다.

- **[INFO]** CHANGELOG.md / plan 문서 갱신은 순수 프로즈·체크박스 변경으로 부작용 없음.
  - 위치: `CHANGELOG.md`(신규 `## Unreleased` 섹션), `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (체크박스 `[x]` 전환 + 하단 트래커 표 취소선 동기화, "열려 있는 것은 넷" 하드코딩 문구 제거)
  - 상세: 두 파일 모두 `git diff` 로 직접 대조해 마크다운 텍스트/체크박스 변경뿐임을 확인했다. 전역
    상태·파일시스템·네트워크·환경변수에 영향을 줄 요소 없음.

CRITICAL 은 발견되지 않았다. 전역 변수 신설·수정, 예상치 못한 파일 생성/삭제(리뷰 산출물은 관례상
정상), 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 이번 diff 어디에도 없다.

## 요약

이번 diff의 유일한 실질 부작용은 이전 두 리뷰 라운드에서 이미 식별된 것과 동일하다 —
`QueryExecutionDto.workflowId` 제거가 전역 `forbidNonWhitelisted: true` 파이프(stateless, 인라인
리터럴 설정임을 직접 확인)와 맞물려 만드는 공개 REST 인터페이스 breaking change(외부 미지 클라이언트
`200`→`400`)다. 저장소 내부 소비자 부재는 이번 라운드에서도 `grep`/`Read` 로 독립 재확인했고, 이번
diff 가 그 동작을 고정하는 회귀 테스트(`validation.pipe.spec.ts`)까지 신설해 직전 라운드가 지적한
"테스트 부재" 갭을 메웠다. 신규 테스트는 stateless 파이프를 대상으로 격리된 로컬 클래스로 구성돼
테스트 간 오염 경로가 없고, 최신 커밋(`22d1ec1ab`)이 이전에 지적된 ephemeral 리뷰-세션-ID 인용 문제도
SoT 문서 인용으로 교체해 해소했다. `swagger-dto-contract-guard.ts` 변경은 로직 불변의 JSDoc 뿐이며,
대량으로 커밋된 32개 리뷰/consistency 산출물은 프로젝트 관례상 정상 위치에 기록된 비실행 문서다.
새로운 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
