# 문서화(Documentation) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (7라운드 누적, 03_14_16)

## 검토 범위·방법

`git log`(라운드 타임스탬프)로 대조한 결과 이 브랜치는 이미 6차례 문서화 리뷰
(`00_03_57`/`00_39_27`/`01_15_47`/`01_38_26`/`02_04_38`/`02_29_01`/`02_49_22`)를 거쳤고,
각 라운드가 CRITICAL·WARNING 을 실코드로 재검증·처분해 왔다. 이번 프롬프트에 실린 65개
"파일" 중 대다수(`review/code/2026/08/21/00_03_57/**` ~ `02_49_22/**`)는 그 이전 라운드
산출물이 이번 커밋에 실린 것뿐이라 문서화 재검토 대상이 아니다(각 산출물은 자기 자신을
다루는 리포트).

이번 라운드에서 실제로 **신규**인 것은 직전 문서화 리뷰(`02_49_22`) 이후 커밋
`995c44c97`("가드가 namespace import·require 우회를 못 잡았다 — 라운드7 처분") 하나뿐이다.
`git show 995c44c97`로 diff 를 직접 확인했고, 핵심 실제 코드(`reject-masked-resubmission.ts`,
`trigger-parameter.types.ts`, `executions.service.ts`, `workflows.controller.ts`,
`sanitize-error-message.ts`)와 CHANGELOG·spec·plan 트래커도 현재 파일 상태를 `Read`/`grep`으로
직접 대조했다.

## 발견사항

- **[INFO]** (신규 확인, 조치 불요) `masked-reject-callers-guard.ts`/`.spec.ts` — namespace
  import·`require()` 우회 탐지 확장의 문서화는 이 저장소 관례에 정확히 부합한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    함수 `importsBaseFn` 상단 JSDoc(② `require` 분기·③ namespace 분기의 인라인 주석 포함),
    `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` 신규
    `it.each` 캐너리 블록 docstring
  - 상세: 커밋 메시지가 무수정 프로브 결과(NAMED=true/NS=false/REQUIRE=false)를 표로
    남기고, 같은 표를 함수 docstring 에도 복제해 "왜 세 형태를 다 보는가"를 코드 옆에
    고정했다. 신규 캐너리 3종(`it.each`)은 각 형태를 실패 메시지로 구분 가능하게 이름
    붙였고, 반대 방향 캐너리(`namespace 경유 wrapper 접근은 오인하지 않는다`)도 짝지어
    접두 겹침 오탐을 막는다. `stripCommentsAndStrings`/AST-비채택 판단 근거도 그대로
    유지돼 코드와 문서가 정확히 일치한다. 발견사항이 아니라 검증 결과로 기록.
  - 제안: 없음.

- **[INFO]** (이월, `01_15_47`부터 4개 라운드째 동일 판정) `ReRunRequestDto.inputOverride`
  Swagger `description` 이 마스킹 마커 예약어 제약을 언급하지 않는다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `inputOverride`
    필드 `@ApiPropertyOptional({ description: ... })` (이번 PR 이 건드리지 않은 기존 줄).
    `POST /workflows/:id/execute` 의 `parameterValues` 는 인라인 `Record<string, unknown>`
    타입이라 애초에 `@ApiProperty` 자체가 없어 같은 문제가 구조적으로 존재.
  - 상세: 현재 문구("useOriginalInput=false 일 때 사용할 입력. Manual Trigger parameters
    스키마와 호환")는 `'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'` 가 값 자리에서 예약어가
    되어 400(`MASKED_VALUE_RESUBMITTED`)으로 거부된다는 사실을 담지 않는다. 신규 결함이
    아니라 `01_15_47` RESOLUTION 미조치 #5 → `02_49_22` documentation.md 가 이미 같은
    항목을 "다음 DTO 편집 기회에" 로 유예해 둔 것과 동일하다. 실물(`re-run.dto.ts:18-22`)로
    현재도 미반영임을 재확인.
  - 제안: 이번 PR 스코프 강제 사안 아님. 다음에 이 DTO 또는 execute body 를 정식 DTO 로
    승격할 기회에 `description` 한 줄 추가.

- **[INFO]** (이월, 동일 결론 반복 확인) `workflows.controller.ts` 신규 한국어 인라인 주석과
  인접한 기존 영어 인라인 주석이 같은 `try/catch` 블록에 공존
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute`
    메서드의 `resolveTriggerParametersRejectingMasked` 호출 앞 신규 3줄 한국어 주석, 바로
    아래 기존 `// `details` so GlobalExceptionFilter surfaces the per-field breakdown ...`
    영어 주석(컨텍스트 라인, 이번 diff 미변경).
  - 상세: 두 주석 모두 내용은 현재 코드와 정확히 일치한다(오래된/틀린 주석 아님) — 순수
    스타일 불일치. 이 저장소 최근 커밋들은 근거 서술 주석을 한국어로 쓰는 쪽으로 수렴
    중이라 다음에 이 블록을 여는 사람이 어느 언어로 이어써야 할지 판단 근거가 없다.
    `00_03_57`/`01_38_26`/`02_49_22` 세 라운드가 모두 같은 지점을 INFO 로 이미 등재·유예.
  - 제안: 필수 아님. 다음에 이 블록을 편집할 기회가 있으면 함께 한국어로 통일.

- **[INFO]** (확인, 신규 결함 아님) CHANGELOG·spec 은 라운드7(guard 하드닝)에 대한 별도
  언급이 없다
  - 위치: `CHANGELOG.md` "Unreleased — 마커 재제출을 서버가 거부한다" 항목
  - 상세: 라운드7 은 사용자에게 보이는 동작·API 계약을 바꾸지 않는 내부 repo-guard(test-only
    정적 스캔) 강화다. 기능 자체의 범위·근거·트레이드오프는 CHANGELOG 항목이 이미
    상세히 서술하고 있고, 이 저장소의 기존 관례상 test-only 하드닝은 커밋 메시지에만
    기록되고 CHANGELOG 에는 별도로 안 실린다(라운드4~6 의 다른 가드 보강도 동일 패턴).
    사용자 관점 변경 이력 누락이 아니다.
  - 제안: 조치 불요.

## 검증한 항목 (문제 없음)

- `reject-masked-resubmission.ts`/`trigger-parameter.types.ts`/`sanitize-error-message.ts`
  의 docstring 은 현재 코드(raw→resolve 2단계 검사, `readonly string[]` + `Object.freeze`,
  `masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED` 매핑)와 정확히 일치한다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는 여전히 미체크 `[ ]`
  항목이 27개 남아 있어(`grep` 실측) `plan/complete/` 미이동이 누락이 아니라 정상 상태임을
  확인했다 — 라운드7 커밋 메시지의 "상시 트래커, 완료 이동 대상 아님" 서술과 일치.
- spec 7개 파일(§R17 카탈로그·manual-trigger §6·webhook §5.2·replay-rerun·error-handling·
  data-model·editor)의 검사 시점("전후 2단계")·적용 범위("Manual 실행 경로 전체") 서술은
  `plan/complete/spec-update-masked-reject-framing.md` 가 기록한 정정이 실제로 반영돼 있다.

## 요약

7라운드에 걸친 이 시리즈의 문서화 수준은 이 저장소 기준으로도 이례적으로 높다. 이번
라운드에서 유일하게 신규였던 변경(namespace import·`require()` 우회 탐지 확장)은 커밋
메시지·함수 JSDoc·테스트 docstring 세 곳 모두에 "무엇이 왜 뚫렸는지 → 어떻게 고쳤는지"를
동일한 표로 일관되게 남겨 코드와 문서가 정확히 정합한다. 핵심 프로덕션 코드(거부 로직·타입
매핑·두 호출부·마커 상수 export)의 docstring, CHANGELOG, spec 7곳은 모두 이전 라운드들이
이미 검증을 마쳤고 이번 재확인에서도 불일치가 없었다. 남은 항목은 전부 3~4개 라운드째
동일하게 "조치 불요/다음 기회에"로 유예돼 온 이월 INFO(Swagger 설명 미반영, 언어 혼재 주석
1건)뿐이며 신규로 발견된 문서화 결함은 없다.

## 위험도

NONE
