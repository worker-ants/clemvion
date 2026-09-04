# 부작용(Side Effect) 리뷰 — `ExecutionStatusDto` 5필드 `required` false→true (3R, `15_49_38`)

## 검토 범위 확인

`git log origin/main..HEAD` 로 이 브랜치가 5개 커밋(`499675277` 응답 83곳 flip → `441761478`
83→15 축소 → `145b7ddcd` plan 기록 → `5a2acd664` 15→5 재축소(`ExecutionDto` 10곳 되돌림) →
`24c68d484` 무관 plan `spec-draft-scope-and-anchor-drift` complete 이동)의 누적임을 확인했다.
`git diff origin/main...HEAD --stat` 로 순(net) diff 를 재현한 결과 실질 코드 변경은
**2개 파일**(`execution-status-response.dto.ts`, 그 `.spec.ts`)과 `CHANGELOG.md`/plan md 3개뿐이며,
나머지 39개는 `review/code/**`·`review/consistency/**` 산출물 신규 커밋이다 — 프로젝트 컨벤션상
정상 저장 위치(`CLAUDE.md` "코드 리뷰/일관성 검토 산출물" 표)라 부작용 대상이 아니다.

저장소에는 아무것도 쓰지 않았다(`Read`/`Bash grep`/`git diff`/`git log`/`git status` 만 사용).
`git status --short` 결과 본 리뷰 세션 디렉터리(`review/code/2026/09/04/15_49_38/`) 외 미커밋
변경 없음을 확인했다.

## 발견사항

- **[INFO]** 공개 인터페이스 변경 — OpenAPI `required` 5필드 false→true (누적 배치의 최종 net 결과)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
    (`durationMs`:130, `currentNode`:138, `context`:156, `result`:165, `error`:174 — 5개 필드
    전부 `@ApiPropertyOptional`→`@ApiProperty`, `field?:`→`field:`)
  - 상세: OpenAPI 스키마로 타입을 생성하는 클라이언트 입장에서 이 5필드는 이제 "항상 존재"로
    문서화된다. `@ApiProperty`/`@ApiPropertyOptional` 은 `@nestjs/swagger` 문서화 데코레이터이고
    `class-validator`/`class-transformer` 데코레이터가 이 클래스에 전혀 없음을 직접 파일을 열어
    확인했다 — 런타임 직렬화·검증 경로에 관여하지 않으므로 wire 바이트는 불변이다. 노출 경로는
    `interaction.service.ts:331` `getStatus()` **하나뿐**이고, 반환 객체 리터럴(441~470행 부근)이
    5필드 전부를 `?? null` 또는 `null` 기본값으로 항상 채우는 것을 직접 확인했다 — TS 구조적 타입
    체크가 실제로 발동하는 유일한 경로라는 CHANGELOG 의 주장과 일치한다.
  - 제안: 조치 불요 — 이미 CHANGELOG 에 영향 명시, 3라운드에 걸쳐 여러 리뷰어가 반복 확인.

- **[INFO]** 직전 라운드(2R) side_effect WARNING(`ExecutionDto` "노출 경로 4개 중 1개에서만 tsc
  가 검증" — `stop`/`getChain`/`reRun` 은 `ResponseExecution`(엔티티 파생 `Omit`)을 반환해 DTO
  선언과 구조적으로 무관)이 이번 라운드에서 **완전히 되돌려져(commit `5a2acd664`) net diff 에서
  사라졌음**을 실측 확인
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    — `git diff origin/main...HEAD -- <이 파일>` 출력 없음(완전 넷 제로)
  - 상세: 개별 커밋(`441761478`)은 이 파일의 10필드를 `@ApiProperty`로 뒤집었지만, 후속 커밋
    (`5a2acd664`)이 정확히 그 10필드를 다시 `@ApiPropertyOptional`+`?:`로 되돌려 브랜치 순
    diff 에서 완전히 상쇄됐다. `execution-status-response.dto.spec.ts` 의 `NULL_PRESENT_FIELDS`
    가드는 애초에 `ExecutionStatusDto` 전용이라 `ExecutionDto` 되돌림과 결합에 따른 잔여 참조나
    stale 단언도 없다. `CHANGELOG.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`
    양쪽 모두 "5곳"으로 정확히 수렴하고, `ExecutionDto` 10곳은 "2단계: 검증자 없는 응답 DTO
    78곳"(패스스루 68 + `ExecutionDto` 10)으로 명시 이관돼 있어 되돌림이 문서에서도 고아 상태로
    남지 않았다.
  - 제안: 조치 불요 — 이전 라운드가 지적한 부작용 위험이 이번 diff 로 실제로 제거됐음을 확인.

- **[INFO]** 리뷰/일관성 검토 산출물(`review/code/2026/09/04/{14_54_36,15_22_06}/**`,
  `review/consistency/2026/09/04/{15_16_28,15_42_35}/**`) 20+개 신규 파일 커밋 — 예상된 파일시스템
  쓰기이지 부작용 아님
  - 위치: 위 4개 세션 디렉터리 전부 `new file mode 100644`
  - 상세: 이 저장소 컨벤션(`CLAUDE.md` 정보 저장 위치 표)상 `review/code/**`·`review/consistency/**`
    는 gitignore 대상이 아니고 audit trail 로 보존된다. 내용도 전부 이번 §5.4 drift 배치를 다루고
    있어 무관한 세션 산출물이 실수로 섞여 들어온 것은 아니다.
  - 제안: 조치 불요.

## 점검했으나 문제 없음으로 확인된 항목

- 전역 변수 도입/수정: 없음(순수 클래스 필드 선언·데코레이터 인자 변경).
- 환경 변수 읽기/쓰기: 없음.
- 네트워크 호출: 없음.
- 이벤트/콜백: 없음 — 런타임 흐름·이벤트 발행 지점 불변(데코레이터 메타데이터만 변경).
- 시그니처 변경의 호출자 영향: `ExecutionStatusDto` 를 구성하는 지점은
  `interaction.service.ts:getStatus()` 단 하나이며, 이미 5필드 모두를 항상 채워 반환하므로
  narrowing 으로 인한 컴파일 실패 없음(`grep` 으로 다른 생성 지점 부재 확인). 프런트엔드/패키지에서
  이 백엔드 DTO 클래스를 직접 import 하는 코드도 없음(이전 라운드 실측을 재확인).
- 필드시스템 부작용(코드 트리): 커밋된 빌드 산출물(`openapi.json`/생성 SDK)이 저장소에 없어
  stale 아티팩트 drift 위험 없음.

## 검증용 뮤테이션 관련

가설 확인용 코드 뮤테이션은 수행하지 않았다 — `git diff`/`git log`/`Read`/`grep` 만으로 revert
완결성과 노출 경로를 충분히 검증할 수 있었다. `git status --short` 로 직접 확인한 결과 본 리뷰
세션 산출물 외 잔여물 없음.

## 요약

이번 라운드(3R)의 순 diff 는 `ExecutionStatusDto` 5필드의 OpenAPI `required` 정정(런타임 wire
불변, 노출 경로 단일·전수 검증됨)으로 좁혀져 있고, 직전 라운드 side_effect 리뷰가 지적한
`ExecutionDto` 10필드의 부적절한 `required: true` 주장은 후속 커밋으로 완전히 되돌려져 net diff
에서 사라졌음을 `git diff`로 직접 확인했다 — 문서(CHANGELOG·plan)도 그 되돌림과 정확히 동기화돼
있어 고아 참조나 stale 서술이 없다. 전역 상태·파일시스템(코드)·환경변수·네트워크·이벤트 부작용은
발견되지 않았고, 함께 커밋된 `review/**` 산출물은 프로젝트 컨벤션상 정상 저장 위치라 부작용
대상이 아니다. CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE
